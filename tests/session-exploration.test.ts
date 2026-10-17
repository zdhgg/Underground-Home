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
    // 破岩演出在真实渲染里要挥完镐才回调；测试里立即落镐。
    playRockBreak: vi.fn((_target: Cell, onStrike: () => void) => onStrike()),
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

  it('点裂纹后阿土先沿通道走到梯口听水声；移动期间点击和撤销不破坏梯道', async () => {
    harness.store.load.mockResolvedValue(readySave())
    const message = vi.fn()
    const session = await createGameSession({} as HTMLElement, { onMessage: message, onProgress: vi.fn() })
    const w = harness.renderer.setWorld.mock.calls[0][0] as WorldState
    const tap = (x: number, y: number) => harness.handlers.onTap({ x, y })
    const lastTravel = () => harness.renderer.playExplorationTravel.mock.calls.at(-1) as unknown as [Cell[], () => void]
    const arrive = () => lastTravel()[1]()
    tap(26, 11); tap(27, 11)
    expect(w.exploration.explorer).toBeNull()
    // 听水声：先走路，走到才算发现；路上点别处 / 撤销都不改世界
    tap(27, 12)
    expect(w.exploration.clueFound).toBe(false)
    const before = structuredClone(w)
    tap(23, 21); session.undo()
    expect(w).toEqual(before)
    const [listenRoute] = lastTravel()
    expect(listenRoute[0]).toEqual({ x: 18, y: 11 })
    expect(listenRoute.at(-1)).toEqual({ x: 27, y: 11 })
    arrive()
    expect(w.exploration.clueFound).toBe(true)
    expect(w.exploration.explorer).toEqual({ x: 27, y: 11 })
    // 升级后点裂纹：阿土沿梯道逐段下去破岩，每挖一块就往下站一格
    session.upgradeTool()
    for (let y = 12; y <= 17; y++) {
      tap(27, y)
      expect(w.tiles[y][27]).toBe(TILE.WEAK_ROCK)
      arrive()
      expect(w.tiles[y][27]).toBe(TILE.EMPTY)
      expect(w.exploration.explorer).toEqual({ x: 27, y: y - 1 })
    }
    expect(message.mock.calls.at(-1)![0]).toContain('梯道通到洞底')
    expect(harness.renderer.playRockBreak).toHaveBeenCalledTimes(6)
    session.lookDown()
    expect(w.exploration.entered).toBe(false)
    session.travel()
    expect(w.exploration.entered).toBe(false)
    const [route, arriveDown] = lastTravel()
    expect(route[0]).toEqual({ x: 27, y: 16 })
    expect(route.at(-1)).toEqual({ x: 27, y: 21 })
    arriveDown()
    expect(w.exploration.entered).toBe(true)
    expect(w.exploration.explorer).toEqual({ x: 27, y: 21 })
    session.destroy()
  })

  it('阿土只会为看见的目标出动：点泥土直接挖，点空地不再移动他，点泉水才走过去', async () => {
    harness.store.load.mockResolvedValue(readySave())
    const session = await createGameSession({} as HTMLElement, { onMessage: vi.fn(), onProgress: vi.fn() })
    const w = harness.renderer.setWorld.mock.calls[0][0] as WorldState
    const tap = (x: number, y: number) => harness.handlers.onTap({ x, y })
    const arrive = () => (harness.renderer.playExplorationTravel.mock.calls.at(-1) as unknown as [Cell[], () => void])[1]()
    tap(26, 11); tap(27, 11); tap(27, 12); arrive()
    session.upgradeTool()
    for (let y = 12; y <= 17; y++) { tap(27, y); arrive() }
    session.travel(); arrive()
    expect(w.exploration.entered).toBe(true)
    // 普通泥土点一下直接挖开，不需要先走人
    const travelsBeforeDig = harness.renderer.playExplorationTravel.mock.calls.length
    for (let x = 23; x >= 18; x--) tap(x, 21)
    expect(w.tiles[21][23]).toBe(TILE.EMPTY)
    expect(harness.renderer.playExplorationTravel.mock.calls.length).toBe(travelsBeforeDig)
    expect(w.exploration.springFound).toBe(false)
    // 点已经挖空的空地：不再让阿土到处走
    tap(26, 21); tap(25, 20)
    expect(harness.renderer.playExplorationTravel.mock.calls.length).toBe(travelsBeforeDig)
    expect(w.exploration.explorer).toEqual({ x: 27, y: 21 })
    // 点露面的泉水：阿土自己沿地面走到水边才算发现
    tap(18, 21)
    expect(w.exploration.springFound).toBe(false)
    const [route] = harness.renderer.playExplorationTravel.mock.calls.at(-1) as unknown as [Cell[], () => void]
    expect(route[0]).toEqual({ x: 27, y: 21 })
    expect(route.at(-1)).toEqual({ x: 18, y: 21 })
    arrive()
    expect(w.exploration.springFound).toBe(true)
    expect(w.exploration.explorer).toEqual({ x: 18, y: 21 })
    session.destroy()
  })

  it('揭开泉水后还要亲自走到那里；完成后才能安壁灯，撤销能移除壁灯', async () => {
    harness.store.load.mockResolvedValue(readySave())
    const progress = vi.fn()
    const session = await createGameSession({} as HTMLElement, { onMessage: vi.fn(), onProgress: progress })
    const w = harness.renderer.setWorld.mock.calls[0][0] as WorldState
    const tap = (x: number, y: number) => harness.handlers.onTap({ x, y })
    const arrive = () => (harness.renderer.playExplorationTravel.mock.calls.at(-1) as unknown as [Cell[], () => void])[1]()
    tap(26, 11); tap(27, 11); tap(27, 12); arrive(); session.upgradeTool()
    for (let y = 12; y <= 17; y++) { tap(27, y); arrive() }
    session.travel(); arrive()
    for (let x = 23; x >= 18; x--) tap(x, 21)
    expect(w.exploration.springFound).toBe(false)
    tap(18, 21)
    expect(w.exploration.springFound).toBe(false)
    arrive()
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
