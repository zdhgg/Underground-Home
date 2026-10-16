import { dig, type DigResult } from '../core/dig'
import { currentMission, missionSummary } from '../core/missions'
import {
  createIndexedDbStore,
  createMemoryStore,
  deserialize,
  serialize,
  type SaveStore,
} from '../core/persistence'
import { createInitialWorld } from '../core/world'
import { attachPointerControls } from '../input/pointerControls'
import { PixiWorldRenderer } from '../render/PixiRenderer'

export interface SessionHooks {
  /** 状态提示（儿童可读的短句） */
  onMessage(message: string, kind?: 'info' | 'warning'): void
  /** 任务进度变化（界面徽章） */
  onProgress(progress: SessionProgress): void
}

export interface SessionProgress {
  title: string
  done: number
  total: number
  finished: boolean
}

/** 组合根：把 world / rules / missions / persistence / render / input 装配成一次游戏会话 */
export interface GameSession {
  zoomBy(delta: number): void
  centerOnHome(): void
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

  let world = createInitialWorld()
  let saveTimer: number | undefined

  // 优先恢复存档；任何损坏都回退到新世界并给出提示
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
      title: mission ? mission.title : '第一夜 · 目标全部完成',
      done: summary.done,
      total: summary.total,
      finished: summary.done >= summary.total,
    })
  }
  pushProgress()

  const detachPointer = attachPointerControls(renderer.canvasElement, {
    onTap: (screen) => {
      const cell = renderer.tileAtScreen(screen)
      if (!cell) return
      const beforeDone = missionSummary(world).done
      const result = dig(world, cell.x, cell.y)
      if (!result.ok) {
        hooks.onMessage(describeDigFailure(result))
        return
      }
      renderer.refresh()
      scheduleSave()
      pushProgress()
      const afterDone = missionSummary(world).done
      if (afterDone > beforeDone) {
        hooks.onMessage('💎 能源石露出来了！它一定能点亮地下家园')
      } else {
        hooks.onMessage('⛏️ 挖开了一小块泥土！')
      }
    },
    onPanBy: (delta) => renderer.panBy(delta.x, delta.y),
    onHover: (screen) => renderer.setHoverCell(screen ? renderer.tileAtScreen(screen) : null),
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
    destroy: () => {
      window.clearTimeout(saveTimer)
      document.removeEventListener('visibilitychange', onVisibilityChange)
      window.removeEventListener('pagehide', onVisibilityChange)
      detachPointer()
      renderer.destroy()
    },
  }
}
