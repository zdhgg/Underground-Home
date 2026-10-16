import { dig, type DigResult } from '../core/dig'
import { createDigHistory } from '../core/history'
import { collectCrystal, repairCore } from '../core/interact'
import { currentMission, guideHighlight, missionSummary } from '../core/missions'
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
    default:
      return '这里是地图边缘，换个地方挖吧'
  }
}

export async function createGameSession(host: HTMLElement, hooks: SessionHooks): Promise<GameSession> {
  const renderer = await PixiWorldRenderer.create(host)
  const store = pickStore()
  const history = createDigHistory()

  let world = createInitialWorld()
  let saveTimer: number | undefined

  // 优先恢复存档；任何损坏都回退到新世界并给出提示（含 v1 → v2 自动迁移）
  try {
    const raw = await store.load()
    if (raw !== null && raw !== undefined) {
      const result = deserialize(raw)
      if (result.ok) {
        world = result.world
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
    const mission = currentMission(world)
    hooks.onProgress({
      title: mission ? mission.title : '第一盏灯，点亮啦',
      speech: mission ? mission.speech : '叮——灯全亮啦！家又暖暖的，谢谢你！🎉',
      outcome: mission ? mission.outcome : '',
      done: summary.done,
      total: summary.total,
      finished: summary.done >= summary.total,
    })

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
    const beforeDone = missionSummary(world).done

    // 1) 能源石区域：收集（还埋在土里则自然落入挖掘流程）
    if (inRect(LANDMARKS.crystalZone, cell)) {
      if (!world.progress.crystalCollected) {
        const result = collectCrystal(world, cell.x, cell.y)
        if (result.ok) {
          renderer.refresh()
          renderer.playBurst((LANDMARKS.crystal.x + 0.5) * TILE_SIZE, (LANDMARKS.crystal.y + 0.5) * TILE_SIZE, {
            color: 0x8dedfd,
            count: 10,
            speed: 75,
          })
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
        renderer.playBurst((LANDMARKS.generator.x + 0.5) * TILE_SIZE, (LANDMARKS.generator.y + 0.5) * TILE_SIZE, {
          color: 0xffd9a0,
          count: 16,
          speed: 95,
          ring: true,
          ringRadius: 110,
        })
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
    history.record(cell.x, cell.y)
    renderer.refresh()
    renderer.playDigEffect(cell)
    scheduleSave()
    pushProgress()
    if (missionSummary(world).done > beforeDone) {
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
      renderer.setHoverCell(cell)
      renderer.setCursor(pickCursor(cell))
    },
    onZoom: (delta, anchor) => renderer.zoomBy(delta, anchor),
  })

  const onVisibilityChange = (): void => {
    if (document.visibilityState === 'hidden') void persist()
  }
  document.addEventListener('visibilitychange', onVisibilityChange)
  window.addEventListener('pagehide', onVisibilityChange)

  return {
    zoomBy: (delta) => renderer.zoomBy(delta),
    centerOnHome: () => renderer.focusHome(),
    undo: () => {
      // 已挖开的能源石不可被埋回去（避免"任务已完成、石头又没了"的矛盾状态）
      const restored = history.undo(
        world,
        (x, y) => x === LANDMARKS.crystal.x && y === LANDMARKS.crystal.y && world.progress.crystalFound,
      )
      if (!restored) {
        hooks.onMessage('还没有可以撤销的操作')
        return
      }
      renderer.refresh()
      renderer.playDigEffect(restored)
      scheduleSave()
      pushProgress()
      hooks.onMessage('↶ 已撤销上一步')
    },
    focusTarget: () => {
      const guide = guideHighlight(world)
      const rect = guide.kind === 'none' ? LANDMARKS.shelter : guide.rect
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
