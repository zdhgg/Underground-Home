import { dig, type DigResult } from '../core/dig'
import { createWorldHistory } from '../core/history'
import { canPlacePod, placePod, podAnchorFromPointer, type BuildFailure } from '../core/build'
import { collectCrystal, repairCore } from '../core/interact'
import { FIRST_NIGHT_MISSIONS, currentMission, guideHighlight, missionSummary } from '../core/missions'
import {
  createIndexedDbStore,
  createMemoryStore,
  deserialize,
  serialize,
  type SaveStore,
} from '../core/persistence'
import { LANDMARKS, TILE, TILE_SIZE, createInitialWorld, type Cell, type Rect } from '../core/world'
import { attachPointerControls } from '../input/pointerControls'
import { PixiWorldRenderer } from '../render/PixiRenderer'

export interface SessionHooks {
  /** 状态提示（儿童可读的短句） */
  onMessage(message: string, kind?: 'info' | 'warning'): void
  /** 任务进度与引导变化（小鼹鼠面板 + 徽章） */
  onProgress(progress: SessionProgress): void
  onBuild?(state: BuildState): void
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
}

/** 预览旁边的短提示：孩子不用低头看底部面板也能判断 */
const BUILD_SHORT_HINTS: Record<BuildFailure, string> = {
  power: '先修好能源核心', bounds: '太靠边了', reserved: '这里要留空',
  overlap: '已经有小床', soil: '先挖空这块', support: '小床要落地', access: '门要通到家里',
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
  /** 撤销最近一次挖掘（挖错保护；能源石被挖开后不可再被埋回去） */
  undo(): void
  /** 把当前任务目标居中（"带我去看看"，只移动画面） */
  focusTarget(): void
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
  const store = pickStore()
  const history = createWorldHistory()

  let world = createInitialWorld()
  let saveTimer: number | undefined
  let building = false
  let candidate: Cell | null = null
  let hoverBuild: Cell | null = null
  /** 伙伴是否已经在床上休息；不写入存档，重新载入时由第一间睡眠舱推导 */
  let resting = false

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
    const selectedResult = candidate ? canPlacePod(world, candidate.x, candidate.y) : null
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

  // 优先恢复存档；损坏反馈；v1 / v2 自动迁移到含睡眠舱的 v3。
  try {
    const raw = await store.load()
    if (raw !== null && raw !== undefined) {
      const result = deserialize(raw)
      if (result.ok) {
        world = result.world
        resting = world.pods.length > 0
        hooks.onMessage('💾 已恢复上次的进度')
      } else {
        hooks.onMessage(`存档读取失败（${result.error}），已开始新的第一夜`, 'warning')
      }
    }
  } catch {
    hooks.onMessage('存档读取失败，已开始新的第一夜', 'warning')
  }

  renderer.setWorld(world)
  renderer.focusHome()

  const persist = async (): Promise<void> => {
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
          : '伙伴睡得好香！你还可以继续挖空间，把家变得更大。',
      outcome: mission ? mission.outcome : '',
      done: pendingRest ? Math.max(0, summary.done - 1) : summary.done,
      total: summary.total,
      finished: !pendingRest && summary.done >= summary.total,
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
    if (inRect(LANDMARKS.generatorZone, cell)) return 'pointer'
    if (inRect(LANDMARKS.crystalZone, cell) && !world.progress.crystalCollected) return 'pointer'
    return world.tiles[cell.y][cell.x] === TILE.SOIL ? 'crosshair' : 'default'
  }

  const handleTap = (cell: Cell): void => {
    if (building) {
      // 点击格 = 舱体底边中间格；孩子只需点“想放床的地面”。
      candidate = podAnchorFromPointer(cell)
      pushBuild()
      return
    }
    const beforeDone = missionSummary(world).done

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
    history.record({ kind: 'dig', x: cell.x, y: cell.y })
    const revealedNow = missionSummary(world).done > beforeDone
    // 能源石露出来时需要重建地标；普通挖掘只刷新本格与四邻的边缘
    if (revealedNow) renderer.refresh()
    else renderer.refreshTerrain([cell])
    renderer.playDigEffect(cell)
    scheduleSave()
    pushProgress()
    if (revealedNow) {
      hooks.onMessage('💎 能源石露出来了！')
    }
  }

  const detachPointer = attachPointerControls(renderer.canvasElement, {
    onTap: (screen) => {
      const cell = renderer.tileAtScreen(screen)
      if (cell) handleTap(cell)
    },
    onPanBy: (delta) => renderer.panBy(delta.x, delta.y),
    onHover: (screen) => {
      const cell = screen ? renderer.tileAtScreen(screen) : null
      renderer.setHoverCell(building ? null : cell)
      renderer.setCursor(building ? 'copy' : pickCursor(cell))
      if (building) {
        hoverBuild = cell
        pushBuild()
      }
    },
    onZoom: (delta, anchor) => renderer.zoomBy(delta, anchor),
  })

  const onVisibilityChange = (): void => {
    if (document.visibilityState === 'hidden') void persist()
  }
  document.addEventListener('visibilitychange', onVisibilityChange)
  window.addEventListener('pagehide', onVisibilityChange)

  return {
    setBuildMode: (active) => {
      if (active && (!world.progress.coreRepaired || world.pods.length > 0)) return
      building = active
      candidate = null
      hoverBuild = null
      renderer.setHoverCell(null)
      pushBuild()
    },
    confirmBuild: () => {
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
        hooks.onMessage('💤 伙伴钻进被窝，睡着啦！')
      })
    },
    zoomBy: (delta) => renderer.zoomBy(delta),
    centerOnHome: () => renderer.focusHome(),
    undo: () => {
      // LIFO：优先撤销最近建设 / 挖掘，保护能源石、设施及唯一通路。
      const restored = history.undo(world)
      if (!restored) {
        hooks.onMessage('还没有可以撤销的操作')
        return
      }
      // 撤销只影响瓦片：增量刷新本格与邻域边缘
      if (restored.kind === 'pod') renderer.refresh()
      else {
        renderer.refreshTerrain([restored])
        renderer.playDigEffect(restored)
      }
      scheduleSave()
      pushProgress()
      hooks.onMessage('↶ 已撤销上一步')
    },
    focusTarget: () => {
      const guide = guideHighlight(world)
      const rect = guide.kind === 'none' && world.progress.coreRepaired && world.pods.length === 0
        ? { x: 11, y: 7, w: 6, h: 5 } : guide.kind === 'none' ? LANDMARKS.shelter : guide.rect
      renderer.focusOn((rect.x + rect.w / 2) * TILE_SIZE, (rect.y + rect.h / 2) * TILE_SIZE)
    },
    destroy: () => {
      window.clearTimeout(saveTimer)
      document.removeEventListener('visibilitychange', onVisibilityChange)
      window.removeEventListener('pagehide', onVisibilityChange)
      detachPointer()
      renderer.destroy()
    },
  }
}
