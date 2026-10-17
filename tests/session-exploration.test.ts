import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createInitialWorld, TILE, type Cell, type WorldState } from '../src/core/world'
import { dig } from '../src/core/dig'
import { placePod } from '../src/core/build'
import { serialize } from '../src/core/persistence'
import { shaftConnected } from '../src/core/exploration'
import { createGameSession } from '../src/app/session'

const harness = vi.hoisted(() => {
  const store = { load: vi.fn(), save: vi.fn(), clear: vi.fn() }
  const renderer = {
    canvasElement: {}, isOverview: false, setWorld: vi.fn(), focusHome: vi.fn(), setBuildPreview: vi.fn(),
    setHighlight: vi.fn(), setHoverCell: vi.fn(), setCursor: vi.fn(), refresh: vi.fn(), refreshTerrain: vi.fn(),
    refreshExploration: vi.fn(), playDigEffect: vi.fn(), focusWater: vi.fn(), focusOn: vi.fn(), followShaft: vi.fn(),
    playBurst: vi.fn(), playExplorationTravel: vi.fn(), destroy: vi.fn(), tileAtScreen: (cell: Cell) => cell,
    cancelExplorationAnimation: vi.fn(), playMoleReaction: vi.fn(), playBreakthrough: vi.fn(), playSpringDiscovery: vi.fn(),
    // 累计帧数：看门狗用它判断画面是不是真的冻住了
    frames: 0,
    // 破岩演出在真实渲染里要挥完镐才回调；测试里立即落镐。
    playRockBreak: vi.fn((_target: Cell, onStrike: () => void) => onStrike()),
  }
  const pointer = { detach: vi.fn(), reset: vi.fn() }
  return {
    store, renderer, pointer,
    handlers: null as unknown as { onTap: (cell: Cell) => void },
    listeners: { document: new Map<string, () => void>(), window: new Map<string, () => void>() },
    legacy: vi.fn(),
  }
})
vi.mock('../src/render/PixiRenderer', () => ({ PixiWorldRenderer: { create: async () => harness.renderer } }))
vi.mock('../src/input/pointerControls', () => ({
  attachPointerControls: (_: unknown, handlers: typeof harness.handlers) => { harness.handlers = handlers; return harness.pointer },
}))
vi.mock('../src/render/waterSound', () => ({
  playWaterClue: vi.fn(), playRockHit: vi.fn(), playBreakthrough: vi.fn(), playLayerArrival: vi.fn(), playSpringFound: vi.fn(),
}))
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

const LISTEN = { x: 27, y: 12 }

describe('探索会话与存档集成', () => {
  beforeEach(() => {
    vi.useFakeTimers(); vi.clearAllMocks()
    harness.listeners.document.clear(); harness.listeners.window.clear()
    vi.stubGlobal('window', {
      clearTimeout, setTimeout,
      addEventListener: (type: string, fn: () => void) => { harness.listeners.window.set(type, fn) },
      removeEventListener: (type: string) => { harness.listeners.window.delete(type) },
    })
    vi.stubGlobal('document', {
      visibilityState: 'visible',
      addEventListener: (type: string, fn: () => void) => { harness.listeners.document.set(type, fn) },
      removeEventListener: (type: string) => { harness.listeners.document.delete(type) },
    })
    vi.stubGlobal('indexedDB', {})
    harness.store.save.mockResolvedValue(undefined)
  })
  afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals() })

  /** 建好家园、听水声、换上小铁镐，停在"可以开始破岩"的那一步 */
  async function startExploring(message = vi.fn(), onMilestone = vi.fn()) {
    harness.store.load.mockResolvedValue(readySave())
    const session = await createGameSession({} as HTMLElement, { onMessage: message, onProgress: vi.fn(), onMilestone })
    const w = harness.renderer.setWorld.mock.calls[0][0] as WorldState
    const tap = (x: number, y: number) => harness.handlers.onTap({ x, y })
    const arrive = () => (harness.renderer.playExplorationTravel.mock.calls.at(-1) as unknown as [Cell[], () => void])[1]()
    /** 把当前这一段走路演出推到位；委托已经取消时再调用是空操作 */
    const advance = (times = 1) => { for (let i = 0; i < times; i++) arrive() }
    tap(26, 11); tap(27, 11)
    tap(LISTEN.x, LISTEN.y)
    arrive()
    session.upgradeTool()
    return { session, w, tap, arrive, advance, message, onMilestone }
  }

  function setVisible(state: 'visible' | 'hidden'): void {
    ;(document as unknown as { visibilityState: string }).visibilityState = state
    harness.listeners.document.get('visibilitychange')?.()
  }

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
    for (let y = 12; y <= 13; y++) {
      tap(27, y)
      expect(w.tiles[y][27]).toBe(TILE.WEAK_ROCK)
      arrive()
      expect(w.tiles[y][27]).toBe(TILE.EMPTY)
      expect(w.exploration.explorer).toEqual({ x: 27, y: y - 1 })
    }
    expect(harness.renderer.playRockBreak).toHaveBeenCalledTimes(2)
    // 学会两次之后：一次点击就一口气挖到洞底，每一段仍然是真实走位 + 挥镐
    tap(27, 14)
    expect(harness.renderer.followShaft).toHaveBeenCalledWith(27)
    for (let i = 0; i < 8 && !shaftConnected(w); i++) arrive()
    expect(shaftConnected(w)).toBe(true)
    expect(harness.renderer.playRockBreak).toHaveBeenCalledTimes(6)
    expect(w.exploration.explorer).toEqual({ x: 27, y: 16 })
    expect(message.mock.calls.at(-1)![0]).toContain('梯道通到洞底')
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

  it('连续施工每段都接长梯子并报出剩余段数，挖通时弹里程碑', async () => {
    const onMilestone = vi.fn()
    const { session, w, tap, advance, message } = await startExploring(vi.fn(), onMilestone)
    tap(27, 12); advance()
    tap(27, 13); advance()
    expect(w.exploration.explorer).toEqual({ x: 27, y: 12 })
    tap(27, 14)
    expect(message.mock.calls.at(-1)![0]).toContain('一口气挖到洞底')
    advance()
    expect(w.tiles[14][27]).toBe(TILE.EMPTY)
    expect(message.mock.calls.at(-1)![0]).toContain('还剩 3 段')
    advance(3)
    expect(shaftConnected(w)).toBe(true)
    expect(onMilestone).toHaveBeenCalledWith(expect.objectContaining({ title: '岩层打通啦！' }))
    // 梯子逐段接长：每一格都真的被挖开过，没有跳过施工
    for (let y = 12; y <= 17; y++) expect(w.tiles[y][27]).toBe(TILE.EMPTY)
    expect(harness.renderer.playRockBreak).toHaveBeenCalledTimes(6)
    session.destroy()
  })

  it('切后台会安全取消进行中的委托：世界不变、输入解锁、回来能接着挖', async () => {
    const message = vi.fn()
    const { session, w, tap, advance } = await startExploring(message)
    tap(27, 12); advance()
    tap(27, 13); advance()
    // 第三次点击开始连续施工，但这一趟还没走完就切到后台
    tap(27, 14)
    const before = structuredClone(w)
    const cancelCalls = harness.renderer.cancelExplorationAnimation.mock.calls.length
    setVisible('hidden')
    expect(w).toEqual(before)                                   // 世界没有留下半成品
    expect(harness.renderer.cancelExplorationAnimation.mock.calls.length).toBe(cancelCalls + 1)
    expect(harness.store.save).toHaveBeenCalled()               // 打断后立即落盘一致的存档
    setVisible('visible')
    expect(message.mock.calls.at(-1)![0]).toContain('一路挖到底')  // 回到前台补一句怎么接着挖
    // 回来再点一次：接着把剩下的段挖完，没有重复挖
    const dugBefore = w.dugCount
    tap(27, 14)
    for (let i = 0; i < 8 && !shaftConnected(w); i++) advance()
    expect(shaftConnected(w)).toBe(true)
    expect(w.dugCount - dugBefore).toBe(4)
    expect(harness.renderer.playRockBreak).toHaveBeenCalledTimes(6)
    session.destroy()
  })

  it('画面被冻住（切后台 / 帧被冻结）时看门狗会解锁操作，不会永久卡住', async () => {
    const message = vi.fn()
    const { session, w, tap, advance } = await startExploring(message)
    tap(27, 12)
    expect(w.tiles[12][27]).toBe(TILE.WEAK_ROCK)
    await vi.advanceTimersByTimeAsync(4000)
    expect(w.tiles[12][27]).toBe(TILE.WEAK_ROCK)                // 只是取消演出，世界不动
    expect(harness.renderer.cancelExplorationAnimation).toHaveBeenCalled()
    expect(message.mock.calls.at(-1)![0]).toContain('再点一次')
    // 操作没有被锁死：再点一次就能正常走到梯口破岩
    tap(27, 12)
    advance()
    expect(w.tiles[12][27]).toBe(TILE.EMPTY)
    session.destroy()
  })

  it('画面还在出新帧时，慢一点也不会打断施工（只是慢）', async () => {
    const message = vi.fn()
    const { session, w, tap, advance } = await startExploring(message)
    tap(27, 12)
    // 每 700ms 出一帧：动画慢但在动，看门狗应当继续等
    for (let i = 0; i < 10; i++) {
      harness.renderer.frames += 1
      await vi.advanceTimersByTimeAsync(700)
    }
    expect(harness.renderer.cancelExplorationAnimation).not.toHaveBeenCalled()
    expect(message.mock.calls.some(([text]) => text.includes('再点一次'))).toBe(false)
    advance()
    expect(w.tiles[12][27]).toBe(TILE.EMPTY)
    session.destroy()
  })

  it('窗口失焦只复位指针手势，不打断施工', async () => {
    const { session, tap } = await startExploring(vi.fn())
    tap(27, 12)
    harness.listeners.window.get('blur')?.()
    expect(harness.pointer.reset).toHaveBeenCalled()
    expect(harness.renderer.cancelExplorationAnimation).not.toHaveBeenCalled()
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
    tap(27, 12); arrive(); tap(27, 13); arrive(); tap(27, 14)
    for (let i = 0; i < 8 && !shaftConnected(w); i++) arrive()
    expect(shaftConnected(w)).toBe(true)
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
    const onMilestone = vi.fn()
    harness.store.load.mockResolvedValue(readySave())
    const progress = vi.fn()
    const session = await createGameSession({} as HTMLElement, { onMessage: vi.fn(), onProgress: progress, onMilestone })
    const w = harness.renderer.setWorld.mock.calls[0][0] as WorldState
    const tap = (x: number, y: number) => harness.handlers.onTap({ x, y })
    const arrive = () => (harness.renderer.playExplorationTravel.mock.calls.at(-1) as unknown as [Cell[], () => void])[1]()
    tap(26, 11); tap(27, 11); tap(27, 12); arrive(); session.upgradeTool()
    tap(27, 12); arrive(); tap(27, 13); arrive(); tap(27, 14)
    for (let i = 0; i < 8 && !shaftConnected(w); i++) arrive()
    session.travel(); arrive()
    expect(w.exploration.entered).toBe(true)
    // 抵达第二层：里程碑卡片 + 阿土的反应各来一次
    expect(onMilestone).toHaveBeenCalledWith(expect.objectContaining({ title: '抵达第 2 层 · 泉水层' }))
    for (let x = 23; x >= 18; x--) tap(x, 21)
    expect(w.exploration.springFound).toBe(false)
    tap(18, 21)
    expect(w.exploration.springFound).toBe(false)
    arrive()
    expect(w.exploration.springFound).toBe(true)
    expect(harness.renderer.playSpringDiscovery).toHaveBeenCalledTimes(1)
    expect(onMilestone).toHaveBeenCalledWith(expect.objectContaining({ title: '发现地下泉水！' }))
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
