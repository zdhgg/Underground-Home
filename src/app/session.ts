import { dig, type DigResult } from '../core/dig'
import { createWorldHistory } from '../core/history'
import { canPlacePod, placePod, podAnchorFromPointer, type BuildFailure } from '../core/build'
import { collectCrystal, repairCore } from '../core/interact'
import { FIRST_NIGHT_MISSIONS, currentMission, explorationGuide, guideHighlight, missionSummary } from '../core/missions'
import { canPlaceWallLamp, inspectCrack, isShaftColumn, shaftConnected, springVisible, upgradePickaxe, walkingRoute } from '../core/exploration'
import {
  createIndexedDbStore,
  createMemoryStore,
  deserialize,
  serialize,
  loadLegacySave,
  type SaveStore,
} from '../core/persistence'
import { LANDMARKS, TILE, TILE_SIZE, createInitialWorld, type Cell, type Rect } from '../core/world'
import type { DepthView } from '../render/camera'
import { attachPointerControls } from '../input/pointerControls'
import { PixiWorldRenderer } from '../render/PixiRenderer'
import { playWaterClue } from '../render/waterSound'

export interface SessionHooks {
  /** 状态提示（儿童可读的短句） */
  onMessage(message: string, kind?: 'info' | 'warning'): void
  /** 任务进度与引导变化（小鼹鼠面板 + 徽章） */
  onProgress(progress: SessionProgress): void
  onBuild?(state: BuildState): void
  onView?(view: DepthView): void
  onExploration?(state: ExplorationUI): void
}

export interface ExplorationUI {
  clue: boolean; upgraded: boolean; connected: boolean; entered: boolean; found: boolean
  traveling: boolean; downstairs: boolean; lampMode: boolean; canImport: boolean
}

export interface BuildState {
  available: boolean
  active: boolean
  selected: boolean
  valid: boolean
  message: string
  count: number
}

const BUILD_MESSAGES: Record<BuildFailure, string> = {
  power: '先修好能源核心，再安小床。', bounds: '这里太靠边啦，换个地方试试。',
  reserved: '入口和能源核心旁边要留出位置。', overlap: '这里已经有一张小床啦。',
  soil: '先切回挖掘，挖出一块能放下小床的空地。', support: '小床下面要有泥土或岩石托住，不能悬空。',
  access: '小床的门要通到家里，也要给伙伴和核心留条路。',
  'locked-layer': '泉水层还没有开放，回暖窝层安小床吧。',
}

/** 预览旁边的短提示：孩子不用低头看底部面板也能判断 */
const BUILD_SHORT_HINTS: Record<BuildFailure, string> = {
  power: '先修好能源核心', bounds: '太靠边了', reserved: '这里要留空',
  overlap: '已经有小床', soil: '先挖空这块', support: '小床要落地', access: '门要通到家里',
  'locked-layer': '这一层还没开放',
}

/** 面向界面的一次引导快照：阿土说什么 + 唯一目标的"做完会怎样" */
export interface SessionProgress {
  title: string
  speech: string
  outcome: string
  done: number
  total: number
  finished: boolean
}

/** 组合根：把 world / rules / missions / persistence / render / input 装配成一次游戏会话 */
export interface GameSession {
  setBuildMode(active: boolean): void
  confirmBuild(): void
  zoomBy(delta: number): void
  centerOnHome(): void
  lookDown(): void
  showOverview(): void
  /** 撤销最近一次挖掘（挖错保护；能源石被挖开后不可再被埋回去） */
  undo(): void
  /** 把当前任务目标居中（"带我去看看"，只移动画面） */
  focusTarget(): void
  upgradeTool(): void
  travel(): void
  toggleLamp(): void
  importLegacy(): Promise<void>
  destroy(): void
}

const SAVE_DEBOUNCE_MS = 350

/** 按环境挑选存储：浏览器用 IndexedDB，失败时降级为内存（不会白屏） */
function pickStore(): SaveStore {
  try {
    if (typeof indexedDB !== 'undefined') return createIndexedDbStore()
  } catch {
    /* 降级到内存 */
  }
  return createMemoryStore()
}

function inRect(rect: Rect, cell: Cell): boolean {
  return cell.x >= rect.x && cell.x < rect.x + rect.w && cell.y >= rect.y && cell.y < rect.y + rect.h
}

function describeDigFailure(result: DigResult): string {
  switch (result.reason) {
    case 'rock':
      return '🪨 这是坚硬岩石，以后升级工具才能挖开'
    case 'locked-layer':
      return '💧 先挖通裂纹梯道，沿梯子真正走到第二层吧。'
    case 'tool': return '⛏ 先挖通裂纹上方的泥土，点裂纹听听，再换小铁镐。'
    case 'reach': return '先挖脚边能碰到的一块，再接着开路吧。'
    case 'empty':
      return '这里已经挖空啦，拖动画布看看别处吧'
    case 'sky':
      return '地面以上的地方不能挖哦'
    case 'facility':
      return '这是睡眠舱和它的地基，先保留它们吧。'
    default:
      return '这里是地图边缘，换个地方挖吧'
  }
}

export async function createGameSession(host: HTMLElement, hooks: SessionHooks): Promise<GameSession> {
  const renderer = await PixiWorldRenderer.create(host)
  renderer.onViewChanged = (view) => hooks.onView?.(view)
  const store = pickStore()
  const history = createWorldHistory()

  let world = createInitialWorld()
  let saveTimer: number | undefined
  let building = false
  let candidate: Cell | null = null
  let hoverBuild: Cell | null = null
  /** 伙伴是否已经在床上休息；不写入存档，重新载入时由第一间睡眠舱推导 */
  let resting = false
  let saveBlocked = false
  let traveling = false
  let lampMode = false
  let canImport = true
  let importing = false

  const pushBuild = (): void => {
    // 本阶段只开放第一间睡眠舱：建成后收起工具，避免没人使用的空舱造成误解。
    const available = world.progress.coreRepaired && world.pods.length === 0
    if (!available && building) {
      building = false
      candidate = null
      hoverBuild = null
    }
    const hoverAnchor = hoverBuild ? podAnchorFromPointer(hoverBuild) : null
    const previewPoint = building ? candidate ?? hoverAnchor : null
    const previewResult = previewPoint ? canPlacePod(world, previewPoint.x, previewPoint.y) : null
    const selectedResult = candidate ? previewResult : null
    const previewHint = previewResult
      ? previewResult.ok ? '可以建 ✓' : BUILD_SHORT_HINTS[previewResult.reason]
      : ''
    renderer.setBuildPreview(
      previewPoint,
      previewResult?.ok ?? false,
      previewResult?.ok ? previewResult.door : 'left',
      building ? previewHint : '',
    )

    let message = '点一下想放小床的地面，看看预览。'
    if (!available) {
      message = '小床已经安好啦。'
    } else if (!building) {
      message = '先挖出一块空地，再选“睡眠舱”。点一下想放小床的地面。'
    } else if (candidate && selectedResult) {
      message = selectedResult.ok
        ? '这里可以建！点“确认建造”。想换位置，再点别处。'
        : `${BUILD_MESSAGES[selectedResult.reason]} 再点别处换位置。`
    } else if (hoverAnchor && previewResult) {
      message = previewResult.ok
        ? '这里可以建！点一下这里把位置定下来。'
        : `${BUILD_MESSAGES[previewResult.reason]} 换个地方，或先挖空这里。`
    }

    hooks.onBuild?.({
      available, active: building, selected: candidate !== null,
      valid: candidate !== null && selectedResult?.ok === true, count: world.pods.length,
      message,
    })
  }

  // 只恢复独立原型存档；失败时保留原数据，禁止本次会话覆盖。
  try {
    const raw = await store.load()
    if (raw !== null && raw !== undefined) {
      const result = deserialize(raw)
      if (result.ok) {
        world = result.world
        canImport = world.dugCount === 0 && world.pods.length === 0 && !world.progress.crystalFound
        resting = world.pods.length > 0
        hooks.onMessage('💾 已恢复上次的进度')
      } else {
        canImport = false
        saveBlocked = true
        hooks.onMessage(`原型存档读取失败（${result.error}），本次临时试玩，不覆盖原档`, 'warning')
      }
    }
  } catch {
    canImport = false
    saveBlocked = true
    hooks.onMessage('原型存档无法读取，本次临时试玩，刷新后可能不保留', 'warning')
  }

  renderer.setWorld(world)
  renderer.focusHome()

  const persist = async (): Promise<void> => {
    if (saveBlocked || importing) return
    try {
      await store.save(serialize(world))
    } catch {
      hooks.onMessage('存档失败：这次进度可能不会保留', 'warning')
    }
  }

  const scheduleSave = (): void => {
    window.clearTimeout(saveTimer)
    saveTimer = window.setTimeout(() => {
      void persist()
    }, SAVE_DEBOUNCE_MS)
  }

  const pushProgress = (): void => {
    const summary = missionSummary(world)
    // 建成后到入睡前仍显示“睡眠舱”这一步；伙伴真正躺下才显示完成与庆祝。
    const pendingRest = world.pods.length > 0 && !resting
    const mission = pendingRest
      ? FIRST_NIGHT_MISSIONS[FIRST_NIGHT_MISSIONS.length - 1]
      : currentMission(world)
    hooks.onProgress({
      title: mission ? mission.title : '有灯、有床的小家园',
      speech: pendingRest
        ? '小床安好啦！伙伴准备钻进被窝……'
        : mission
          ? mission.speech
          : '伙伴睡得好香！你可以继续扩建暖窝层，也可以点“向下看看”，听听岩层深处的水声。',
      outcome: mission ? mission.outcome : '',
      done: pendingRest ? Math.max(0, summary.done - 1) : summary.done,
      total: summary.total,
      finished: !pendingRest && summary.done >= summary.total,
    })
    if (summary.done === summary.total && !pendingRest) hooks.onProgress(explorationGuide(world))
    hooks.onExploration?.({
      clue: world.exploration.clueFound, upgraded: world.exploration.pickaxeUpgraded,
      connected: shaftConnected(world), entered: world.exploration.entered, found: world.exploration.springFound,
      traveling, downstairs: world.exploration.explorer?.y === 21, lampMode, canImport: canImport && !saveBlocked,
    })
    pushBuild()

    const guide = guideHighlight(world)
    if (guide.kind === 'none') {
      renderer.setHighlight(null)
    } else {
      renderer.setHighlight({
        x: guide.rect.x * TILE_SIZE,
        y: guide.rect.y * TILE_SIZE,
        width: guide.rect.w * TILE_SIZE,
        height: guide.rect.h * TILE_SIZE,
        tone: guide.kind === 'repair' ? 'amber' : 'cyan',
      })
    }
  }
  pushProgress()

  /** 悬停时的指针形状：可互动区域用 pointer，可挖泥土用 crosshair */
  const pickCursor = (cell: Cell | null): string => {
    if (!cell) return 'default'
    if (isShaftColumn(cell.x) && cell.y >= 11 && cell.y <= 21) return 'pointer'
    if (cell.y >= 15) return world.exploration.entered ? 'crosshair' : 'not-allowed'
    if (inRect(LANDMARKS.generatorZone, cell)) return 'pointer'
    if (inRect(LANDMARKS.crystalZone, cell) && !world.progress.crystalCollected) return 'pointer'
    return world.tiles[cell.y][cell.x] === TILE.SOIL ? 'crosshair' : 'default'
  }

  const handleTap = (cell: Cell): void => {
    if (traveling) { hooks.onMessage('阿土正在沿通道走，马上就到！'); return }
    if (lampMode) {
      if (cell.y < 19 || cell.y > 21 || !canPlaceWallLamp(world, cell.x)) {
        hooks.onMessage('先挖出三格高的空地，避开泉水和梯子，再点这里安壁灯。'); return
      }
      world.exploration.lamps.push({ x: cell.x, y: 19 })
      history.record({ kind: 'lamp', x: cell.x, y: 19 })
      renderer.refreshExploration(); scheduleSave(); pushProgress()
      hooks.onMessage('🏮 新地方亮起一盏小壁灯！还能继续选位置。')
      return
    }
    if (building) {
      // 点击格 = 舱体底边中间格；孩子只需点“想放床的地面”。
      candidate = podAnchorFromPointer(cell)
      pushBuild()
      return
    }
    const beforeDone = missionSummary(world).done
    if (isShaftColumn(cell.x) && cell.y === 12 && !world.exploration.pickaxeUpgraded) {
      if (world.exploration.clueFound && world.exploration.shaftX !== cell.x) {
        hooks.onMessage('先顺着刚才发现水汽的裂纹探索吧，换上小铁镐就能挖了。')
        return
      }
      if (inspectCrack(world, cell.x, cell.y)) {
        playWaterClue()
        renderer.refreshExploration(); scheduleSave(); pushProgress()
        hooks.onMessage('💧 滴答！裂纹里透出凉凉的水汽。换小铁镐试试！')
      } else hooks.onMessage(world.pods.length ? '先挖通裂纹上方的泥土，让阿土能走到这里。' : '先给伙伴安好小床，再来听岩壁里的水声。')
      return
    }
    if (cell.y >= 19 && cell.y <= 21 && world.exploration.entered && world.tiles[cell.y][cell.x] === TILE.EMPTY && world.tiles[21][cell.x] === TILE.EMPTY) {
      const target = { x: cell.x, y: 21 }
      const from = world.exploration.explorer
      const route = from && walkingRoute(world, from, target)
      if (route) {
        moveExplorer(route, () => {
          if (Math.abs(target.x - LANDMARKS.spring.x) <= 1 && springVisible(world)) {
            const first = !world.exploration.springFound
            world.exploration.springFound = true
            if (first) {
              playWaterClue()
              renderer.playBurst((LANDMARKS.spring.x + 0.5) * TILE_SIZE, 21.5 * TILE_SIZE, { color: 0xa5efdd, count: 28, ring: true })
              hooks.onMessage('🎉 找到天然泉水啦！这里也能成为我们的家！')
            }
          }
        })
        return
      }
    }

    // 1) 能源石区域：收集（还埋在土里则自然落入挖掘流程）
    if (inRect(LANDMARKS.crystalZone, cell)) {
      if (!world.progress.crystalCollected) {
        const result = collectCrystal(world, cell.x, cell.y)
        if (result.ok) {
          renderer.refresh()
          renderer.playCrystalCollection()
          scheduleSave()
          pushProgress()
          hooks.onMessage('💎 能源石收好啦！')
          return
        }
        // not-revealed：泥土还盖着，继续按挖掘处理
      } else if (world.tiles[cell.y][cell.x] !== TILE.SOIL) {
        // 已收集：给一点点小星光，不再重复提示
        renderer.playBurst((LANDMARKS.crystal.x + 0.5) * TILE_SIZE, (LANDMARKS.crystal.y + 0.5) * TILE_SIZE, {
          color: 0x8dedfd,
          count: 6,
          speed: 50,
        })
        return
      }
      // 已收集 + 点的是泥土 → 保持自由挖掘
    }

    // 2) 能源核心区域：修复 / 提示 / 已在运转时给个小火花
    if (inRect(LANDMARKS.generatorZone, cell)) {
      const result = repairCore(world, cell.x, cell.y)
      if (result.ok) {
        renderer.refresh()
        renderer.playRepairCelebration()
        scheduleSave()
        pushProgress()
        hooks.onMessage('💡 轰隆隆——家园亮起来啦！🎉')
        return
      }
      if (result.reason === 'need-crystal') {
        hooks.onMessage('机器还没有能量：先找到能源石吧')
      } else {
        renderer.playBurst((LANDMARKS.generator.x + 0.5) * TILE_SIZE, (LANDMARKS.generator.y + 0.5) * TILE_SIZE, {
          color: 0xffd9a0,
          count: 6,
          speed: 50,
        })
      }
      return
    }

    // 3) 普通挖掘（严格单格）：尘土即反馈，不再逐次弹文字
    const result = dig(world, cell.x, cell.y)
    if (!result.ok) {
      hooks.onMessage(describeDigFailure(result))
      return
    }
    canImport = false
    history.record({ kind: 'dig', x: cell.x, y: cell.y, tile: result.tile ?? TILE.SOIL })
    const revealedNow = missionSummary(world).done > beforeDone
    // 能源石露出来时需要重建地标；普通挖掘只刷新本格与四邻的边缘
    if (revealedNow) renderer.refresh()
    else renderer.refreshTerrain([cell])
    renderer.playDigEffect(cell)
    renderer.refreshExploration()
    scheduleSave()
    pushProgress()
    if (revealedNow) {
      hooks.onMessage('💎 能源石露出来了！')
    } else if (result.tile === TILE.WEAK_ROCK) {
      hooks.onMessage(shaftConnected(world) ? '🪜 梯道接到洞底啦！点“沿梯子下去”。' : '⛏ 裂纹岩挖开啦！小梯子也接好了一段。')
    }
  }

  const moveExplorer = (route: Cell[], onArrived?: () => void): void => {
    traveling = true
    pushProgress()
    renderer.focusOn((route[Math.floor(route.length / 2)].x + 0.5) * TILE_SIZE, (route[Math.floor(route.length / 2)].y + 0.5) * TILE_SIZE)
    renderer.playExplorationTravel(route, () => {
      world.exploration.explorer = { ...route[route.length - 1] }
      traveling = false
      onArrived?.()
      renderer.refreshExploration(); scheduleSave(); pushProgress()
    })
  }

  const detachPointer = attachPointerControls(renderer.canvasElement, {
    onTap: (screen) => {
      if (renderer.isOverview) {
        hooks.onMessage('这是家园全景，点“回到家园”就能继续挖掘和建造。')
        return
      }
      const cell = renderer.tileAtScreen(screen)
      if (cell) handleTap(cell)
    },
    onPanBy: (delta) => renderer.panBy(delta.x, delta.y),
    onHover: (screen) => {
      if (renderer.isOverview) {
        renderer.setHoverCell(null)
        renderer.setCursor('default')
        return
      }
      const cell = screen ? renderer.tileAtScreen(screen) : null
      renderer.setHoverCell(building ? null : cell)
      renderer.setCursor(building ? 'copy' : pickCursor(cell))
      if (building) {
        if (hoverBuild?.x === cell?.x && hoverBuild?.y === cell?.y) return
        hoverBuild = cell
        pushBuild()
      }
    },
    onZoom: (delta, anchor) => renderer.zoomBy(delta, anchor),
  })

  const onVisibilityChange = (): void => {
    if (document.visibilityState === 'hidden') void persist()
  }
  const onPageHide = (): void => { void persist() }
  document.addEventListener('visibilitychange', onVisibilityChange)
  window.addEventListener('pagehide', onPageHide)

  return {
    setBuildMode: (active) => {
      if (traveling) return
      lampMode = false
      if (active && (!world.progress.coreRepaired || world.pods.length > 0)) return
      building = active
      candidate = null
      hoverBuild = null
      renderer.setHoverCell(null)
      pushBuild()
    },
    confirmBuild: () => {
      if (traveling) return
      if (!building || !candidate) return
      const check = canPlacePod(world, candidate.x, candidate.y)
      if (!check.ok) { hooks.onMessage(BUILD_MESSAGES[check.reason], 'warning'); return }
      const pod = placePod(world, candidate.x, candidate.y)
      if (!pod) return
      history.record({ kind: 'pod', id: pod.id })
      building = false
      candidate = null
      hoverBuild = null
      resting = false
      // 只刷新舱体：保留伙伴当前站位，随后沿真实通道播放入场。
      renderer.refreshPods()
      renderer.playBurst((pod.x + 1.5) * TILE_SIZE, (pod.y + 1) * TILE_SIZE, { color: 0xffdc95, count: 10 })
      scheduleSave()
      pushProgress()
      hooks.onMessage('🛏️ 小床安好啦！伙伴准备钻进被窝……')
      renderer.playPodEntrance(pod, () => {
        resting = true
        renderer.playPodCelebration(pod)
        pushProgress()
        renderer.refreshExploration()
        hooks.onMessage('💤 伙伴钻进被窝，睡着啦！')
      })
    },
    zoomBy: (delta) => renderer.zoomBy(delta),
    centerOnHome: () => { renderer.focusHome() },
    lookDown: () => {
      building = false
      candidate = null
      hoverBuild = null
      pushBuild()
      renderer.setHoverCell(null)
      renderer.focusWater()
    },
    showOverview: () => {
      building = false
      candidate = null
      hoverBuild = null
      pushBuild()
      renderer.setHoverCell(null)
      renderer.focusOverview()
    },
    undo: () => {
      if (traveling) { hooks.onMessage('等阿土站稳，再撤销吧。'); return }
      // LIFO：优先撤销最近建设 / 挖掘，保护能源石、设施及唯一通路。
      const restored = history.undo(world)
      if (!restored) {
        hooks.onMessage(world.exploration.clueFound ? '已经使用的梯子、脚下和回家的路要留着；新挖的空地仍能撤销。' : '还没有可以撤销的操作')
        return
      }
      // 撤销只影响瓦片：增量刷新本格与邻域边缘
      if (restored.kind === 'pod') { resting = world.pods.length > 0; renderer.refresh() }
      else if (restored.kind === 'lamp') renderer.refreshExploration()
      else {
        renderer.refreshTerrain([restored])
        renderer.playDigEffect(restored)
      }
      renderer.refreshExploration()
      scheduleSave()
      pushProgress()
      hooks.onMessage('↶ 已撤销上一步')
    },
    focusTarget: () => {
      const guide = guideHighlight(world)
      const rect = guide.kind === 'none' && world.progress.coreRepaired && world.pods.length === 0
        ? LANDMARKS.buildSuggestion : guide.kind === 'none' ? LANDMARKS.shelter : guide.rect
      renderer.focusOn((rect.x + rect.w / 2) * TILE_SIZE, (rect.y + rect.h / 2) * TILE_SIZE)
    },
    upgradeTool: () => {
      if (traveling || !upgradePickaxe(world)) return
      renderer.refreshExploration(); scheduleSave(); pushProgress()
      hooks.onMessage('⛏ 小铁镐准备好啦！点带裂纹的岩石，试着向下挖。')
    },
    travel: () => {
      if (traveling || !shaftConnected(world) || !world.exploration.explorer) return
      lampMode = false
      const down = world.exploration.explorer.y !== 21
      const route = walkingRoute(world, world.exploration.explorer, { x: world.exploration.shaftX!, y: down ? 21 : 11 })
      if (!route) { hooks.onMessage('通道还没连好，先检查梯子和地面。'); return }
      moveExplorer(route, () => {
        if (down) { world.exploration.entered = true; renderer.focusWater(); hooks.onMessage('🪜 到第二层啦！水声从土壁那边传来……') }
        else { renderer.focusHome(); hooks.onMessage('⌂ 顺着梯子回到家啦！') }
      })
    },
    toggleLamp: () => {
      if (!world.exploration.springFound || traveling) return
      lampMode = !lampMode; building = false; candidate = null; pushProgress()
      hooks.onMessage(lampMode ? '🏮 点挖空的泉水层洞壁，安一盏小灯。再点工具可以收起。' : '⛏ 继续自由挖掘吧。')
    },
    importLegacy: async () => {
      if (!canImport || saveBlocked || traveling || importing) return
      importing = true; traveling = true; canImport = false
      window.clearTimeout(saveTimer)
      pushProgress()
      try {
        const raw = await loadLegacySave()
        if (!raw) { hooks.onMessage('这个浏览器还没有 v0.1.0 进度，可以直接开始新冒险。'); return }
        if ((raw as { version?: unknown }).version !== 4) { hooks.onMessage('旧进度版本不符合 v0.1.0，原档保持原样。', 'warning'); return }
        const result = deserialize(raw)
        if (!result.ok) { hooks.onMessage(`旧进度无法复制（${result.error}），原档保持原样。`, 'warning'); return }
        await store.save(serialize(result.world))
        world = result.world; resting = world.pods.length > 0
        renderer.setWorld(world); renderer.focusHome(); pushProgress()
        hooks.onMessage('💾 已复制 v0.1.0 的家园！新冒险另存，旧进度仍在。')
      } catch { hooks.onMessage('旧进度复制失败，原档保持原样。', 'warning') }
      finally { importing = false; traveling = false; pushProgress() }
    },
    destroy: () => {
      window.clearTimeout(saveTimer)
      void persist()
      document.removeEventListener('visibilitychange', onVisibilityChange)
      window.removeEventListener('pagehide', onPageHide)
      detachPointer()
      renderer.destroy()
    },
  }
}
