import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createInitialWorld, TILE, type Cell, type WorldState } from '../src/core/world'
import { dig } from '../src/core/dig'
import { placePod } from '../src/core/build'
import { serialize } from '../src/core/persistence'
import { createGameSession } from '../src/app/session'

const harness = vi.hoisted(() => {
  const store = { load: vi.fn(), save: vi.fn(), clear: vi.fn() }
  const renderer = {
    canvasElement: {}, isOverview: false, setWorld: vi.fn(), focusHome: vi.fn(), setBuildPreview: vi.fn(),
    setHighlight: vi.fn(), setHoverCell: vi.fn(), setCursor: vi.fn(), refresh: vi.fn(), refreshTerrain: vi.fn(),
    refreshExploration: vi.fn(), playDigEffect: vi.fn(), focusWater: vi.fn(), focusOn: vi.fn(),
    playBurst: vi.fn(), playExplorationTravel: vi.fn(), destroy: vi.fn(), tileAtScreen: (cell: Cell) => cell,
  }
  return { store, renderer, handlers: null as unknown as { onTap: (cell: Cell) => void }, legacy: vi.fn() }
})
vi.mock('../src/render/PixiRenderer', () => ({ PixiWorldRenderer: { create: async () => harness.renderer } }))
vi.mock('../src/input/pointerControls', () => ({ attachPointerControls: (_: unknown, handlers: typeof harness.handlers) => { harness.handlers = handlers; return () => {} } }))
vi.mock('../src/render/waterSound', () => ({ playWaterClue: vi.fn() }))
vi.mock('../src/core/persistence', async (importOriginal) => ({
  ...await importOriginal<typeof import('../src/core/persistence')>(),
  createIndexedDbStore: () => harness.store,
  loadLegacySave: harness.legacy,
}))

function readySave() {
  const w = createInitialWorld()
  w.progress = { crystalFound: true, crystalCollected: true, coreRepaired: true }
  w.tiles[9][14] = TILE.EMPTY
  for (let y = 10; y <= 11; y++) for (let x = 12; x <= 14; x++) dig(w, x, y)
  placePod(w, 12, 10)
  return serialize(w)
}

describe('探索会话与存档集成', () => {
  beforeEach(() => {
    vi.useFakeTimers(); vi.clearAllMocks()
    vi.stubGlobal('window', { clearTimeout, setTimeout, addEventListener: vi.fn(), removeEventListener: vi.fn() })
    vi.stubGlobal('document', { addEventListener: vi.fn(), removeEventListener: vi.fn() })
    vi.stubGlobal('indexedDB', {})
    harness.store.save.mockResolvedValue(undefined)
  })
  afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals() })

  it('向下看只移动镜头，抵达回调前不解锁；移动期间点击和撤销不破坏梯道', async () => {
    harness.store.load.mockResolvedValue(readySave())
    const session = await createGameSession({} as HTMLElement, { onMessage: vi.fn(), onProgress: vi.fn() })
    const w = harness.renderer.setWorld.mock.calls[0][0] as WorldState
    const tap = (x: number, y: number) => harness.handlers.onTap({ x, y })
    tap(26, 11); tap(27, 11); tap(27, 12); session.upgradeTool()
    for (let y = 12; y <= 17; y++) tap(27, y)
    session.lookDown()
    expect(w.exploration.entered).toBe(false)
    session.travel()
    expect(w.exploration.entered).toBe(false)
    const before = structuredClone(w)
    tap(23, 21); session.undo()
    expect(w).toEqual(before)
    const [route, arrive] = harness.renderer.playExplorationTravel.mock.calls[0] as unknown as [Cell[], () => void]
    expect(route[0]).toEqual({ x: 27, y: 11 })
    expect(route.at(-1)).toEqual({ x: 27, y: 21 })
    arrive()
    expect(w.exploration.entered).toBe(true)
    expect(w.exploration.explorer).toEqual({ x: 27, y: 21 })
    session.destroy()
  })

  it('揭开泉水后还要亲自走到那里；完成后才能安壁灯，撤销能移除壁灯', async () => {
    harness.store.load.mockResolvedValue(readySave())
    const progress = vi.fn()
    const session = await createGameSession({} as HTMLElement, { onMessage: vi.fn(), onProgress: progress })
    const w = harness.renderer.setWorld.mock.calls[0][0] as WorldState
    const tap = (x: number, y: number) => harness.handlers.onTap({ x, y })
    tap(26, 11); tap(27, 11); tap(27, 12); session.upgradeTool()
    for (let y = 12; y <= 17; y++) tap(27, y)
    session.travel(); harness.renderer.playExplorationTravel.mock.calls.at(-1)![1]()
    for (let x = 23; x >= 18; x--) tap(x, 21)
    expect(w.exploration.springFound).toBe(false)
    tap(18, 21)
    expect(w.exploration.springFound).toBe(false)
    harness.renderer.playExplorationTravel.mock.calls.at(-1)![1]()
    expect(w.exploration.springFound).toBe(true)
    expect(progress.mock.calls.at(-1)![0]).toMatchObject({ done: 5, finished: true })
    session.toggleLamp(); tap(25, 19)
    expect(w.exploration.lamps).toEqual([{ x: 25, y: 19 }])
    session.undo()
    expect(w.exploration.lamps).toEqual([])
    session.destroy()
  })

  it('读取损坏存档后，本次挖掘和退出均不覆盖原数据', async () => {
    harness.store.load.mockResolvedValue({ version: 5, world: {} })
    const message = vi.fn()
    const session = await createGameSession({} as HTMLElement, { onMessage: message, onProgress: vi.fn() })
    harness.handlers.onTap({ x: 12, y: 10 })
    await vi.advanceTimersByTimeAsync(400)
    session.destroy()
    expect(harness.store.save).not.toHaveBeenCalled()
    expect(message.mock.calls.some(([text]) => text.includes('不覆盖原档'))).toBe(true)
  })

  it('仅明确点复制时读取v4；成功后另存，重复复制和加载期间点击被忽略', async () => {
    harness.store.load.mockResolvedValue(null)
    const v4 = readySave(); v4.version = 4
    const before = structuredClone(v4)
    harness.legacy.mockResolvedValue(v4)
    let finishSave!: () => void
    harness.store.save.mockImplementationOnce(() => new Promise<void>((resolve) => { finishSave = resolve }))
    const session = await createGameSession({} as HTMLElement, { onMessage: vi.fn(), onProgress: vi.fn() })
    expect(harness.legacy).not.toHaveBeenCalled()
    const copying = session.importLegacy()
    await Promise.resolve(); await Promise.resolve()
    harness.handlers.onTap({ x: 12, y: 10 })
    const initial = harness.renderer.setWorld.mock.calls[0][0] as WorldState
    expect(initial.dugCount).toBe(0)
    finishSave(); await copying
    const copied = harness.renderer.setWorld.mock.calls.at(-1)![0] as WorldState
    expect(copied.pods).toEqual(v4.world.pods)
    expect(copied.tiles.slice(0, 12)).toEqual(v4.world.tiles.slice(0, 12))
    await session.importLegacy()
    expect(harness.legacy).toHaveBeenCalledOnce()
    expect(v4).toEqual(before)
    session.destroy()
  })
})
