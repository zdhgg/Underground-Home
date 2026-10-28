import { warmLampWorld } from './fixtures/nestWarmLampWorld'
import { completedFinale, workingFinale } from './fixtures/finaleWorld'
import { workingRuins } from './fixtures/ruinsWorld'
import { workingVentilation } from './fixtures/ventilationWorld'
import { workingReservoir } from './fixtures/reservoirWorld'
import { workingGarden } from './fixtures/gardenWorld'
import { furnishedHall } from './fixtures/hallWorld'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { LANDMARKS, createInitialWorld, TILE, type Cell, type WorldState } from '../src/core/world'
import { dig } from '../src/core/dig'
import { placePod } from '../src/core/build'
import { deserialize, serialize } from '../src/core/persistence'
import type { PartnerConversation } from '../src/core/partnerInteractions'
import { inspectCrack, shaftConnected, upgradePickaxe } from '../src/core/exploration'
import { createGameSession as createSession, type SessionHooks } from '../src/app/session'
import type { SoilPlan } from '../src/core/atu'
import type { SiteUI } from '../src/app/siteEditor'
import type { WorkPlan } from '../src/core/partnerWork'
import type { WorkerId } from '../src/core/world'
import { lightField, WIDE_LAMP_ID } from '../src/core/lighting'
import { finishRoom, planRoom } from '../src/core/roomConstruction'
import { siteById, siteWorkCells } from '../src/core/sites'
import { roomFromPoint } from '../src/core/rooms'
import { playSoilDig, playBuildComplete, playPartnerFound, playUndo, playSpringFound } from '../src/render/waterSound'

const harness = vi.hoisted(() => {
  const store = { load: vi.fn(), save: vi.fn(), clear: vi.fn() }
  const renderer = {
    playHallWork: vi.fn((_at: Cell, done: () => void) => done()), setHallPreview: vi.fn(), setGardenPreview: vi.fn(),
    playOpening: vi.fn((done: () => void, _caption: (text: string) => void) => done()), finishOpening: vi.fn(), enableOpeningSound: vi.fn(),
    canvasElement: {}, isOverview: false, setWorld: vi.fn(), focusHome: vi.fn(), focusOverview: vi.fn(), stopAtuFollow: vi.fn(), zoomBy: vi.fn(), setBuildPreview: vi.fn(), panBy: vi.fn(),
    setHighlight: vi.fn(), setHoverCell: vi.fn(), setCursor: vi.fn(), refresh: vi.fn(), refreshTerrain: vi.fn(),
    refreshExploration: vi.fn(), playDigEffect: vi.fn(), focusWater: vi.fn(), focusOn: vi.fn(), followShaft: vi.fn(),
    refreshPods: vi.fn(), setNestLampPreview: vi.fn(), playNestLampLight: vi.fn(), refreshFriends: vi.fn(), refreshRelics: vi.fn(), refreshFarm: vi.fn(), refreshShelves: vi.fn(),
    playSupplyWater: vi.fn(), playHarvest: vi.fn(), playMealCelebration: vi.fn(),
    playKitchenCooking: vi.fn(), playMealGather: vi.fn((_moves: unknown, done: () => void) => done()),
    finishMealGather: vi.fn(), cancelMealGather: vi.fn(), playChapterGlance: vi.fn(),
    playPodEntrance: vi.fn((_pod: unknown, done: () => void) => done()), playPodCelebration: vi.fn(), nestAnchor: vi.fn(() => ({ x: 200, y: 200, width: 800, height: 600 })),
    playBurst: vi.fn(), playRepairCelebration: vi.fn(), playExplorationTravel: vi.fn(), destroy: vi.fn(), tileAtScreen: (cell: Cell) => cell,
    cancelExplorationAnimation: vi.fn(), playMoleReaction: vi.fn(), playBreakthrough: vi.fn(), playSpringDiscovery: vi.fn(),
    partnerAtScreen: vi.fn().mockReturnValue(null), playPartnerReaction: vi.fn(),
    setConversationPartner: vi.fn(), focusPartner: vi.fn(),
    onPartnerReveal: undefined as undefined | ((phase: 'appearing' | 'ready') => void),
    setAtuTarget: vi.fn(), hoverPartner: vi.fn(), findAtu: vi.fn(),
    setRoomPreview: vi.fn(), refreshRooms: vi.fn(),
    setLampPreview: vi.fn(), playDigLoot: vi.fn(),
    playPartnerTravel: vi.fn((_id: WorkerId, route: Cell[], step: (p: Cell) => void, done: () => void) => { route.forEach(step); done() }),
    playPartnerWork: vi.fn((_plan: WorkPlan, hit: () => void, done: () => void) => { hit(); done() }),
    cancelPartnerWork: vi.fn(),
    playSoilWork: vi.fn((_plan: SoilPlan, strike: () => void, done: () => void) => { strike(); done() }),
    // 累计帧数：看门狗用它判断画面是不是真的冻住了
    frames: 0,
    // 破岩演出在真实渲染里要挥完镐才回调；测试里立即落镐。
    playRockBreak: vi.fn((_target: Cell, onStrike: () => void) => onStrike()),
  }
  const pointer = { detach: vi.fn(), reset: vi.fn() }
  return {
    store, renderer, pointer,
    handlers: null as unknown as { onTap: (cell: Cell) => void; onPanBy: (delta: Cell) => void; onHover: (cell: Cell | null) => void },
    listeners: { document: new Map<string, () => void>(), window: new Map<string, () => void>() },
  }
})
vi.mock('../src/render/PixiRenderer', () => ({ PixiWorldRenderer: { create: async () => harness.renderer } }))
vi.mock('../src/input/pointerControls', () => ({
  attachPointerControls: (_: unknown, handlers: typeof harness.handlers) => { harness.handlers = handlers; return harness.pointer },
}))
vi.mock('../src/render/waterSound', () => ({
  playSoilDig: vi.fn(), playBuildComplete: vi.fn(), playPartnerFound: vi.fn(), playCrystalCollected: vi.fn(),
  playPowerConnected: vi.fn(), playUndo: vi.fn(), playUnavailable: vi.fn(),
  playWaterClue: vi.fn(), playRockHit: vi.fn(), playBreakthrough: vi.fn(), playLayerArrival: vi.fn(), playSpringFound: vi.fn(),
  playWaterSupplied: vi.fn(), playHarvest: vi.fn(), playMealTime: vi.fn(),
}))
// 存储仅在规则回归中显式注入，实际试玩默认不读写浏览器存档。
const createGameSession = (host: HTMLElement, hooks: SessionHooks) => createSession(host, hooks, { store: harness.store })

function readySave() {
  const w = createInitialWorld()
  w.progress = { crystalFound: true, crystalCollected: true, coreRepaired: true }
  w.tiles[9][14] = TILE.EMPTY
  for (let y = 10; y <= 11; y++) for (let x = 12; x <= 14; x++) dig(w, x, y)
  placePod(w, 12, 10)
  for (const x of [26, 27]) { dig(w, x, 11); dig(w, x, 10) }
  return serialize(w)
}

function clueSave(upgraded = false) {
  const result = deserialize(readySave())
  if (!result.ok) throw new Error(result.error)
  const world = result.world
  dig(world, 26, 11); dig(world, 27, 11)
  inspectCrack(world, 27, 12)
  if (upgraded) upgradePickaxe(world)
  return serialize(world)
}

/** 已经找到泉水、引水到家、左翼挖出一带地面的存档：用来测种植与收获 */
function farmedSave() {
  const w = createInitialWorld()
  w.progress = { crystalFound: true, crystalCollected: true, coreRepaired: true }
  w.tiles[9][14] = TILE.EMPTY
  for (let y = 10; y <= 11; y++) for (let x = 12; x <= 14; x++) dig(w, x, y)
  placePod(w, 12, 10)
  for (let x = 26; x <= 27; x++) dig(w, x, 11)
  inspectCrack(w, 27, 12)
  upgradePickaxe(w)
  for (let y = 12; y < 19; y++) if (w.tiles[y][27] !== TILE.EMPTY) dig(w, 27, y)
  w.exploration.entered = true
  for (let x = 23; x >= 18; x--) { dig(w, x, 21); dig(w, x, 20) }
  w.exploration.explorer = { x: LANDMARKS.spring.x, y: 21 }
  w.exploration.springFound = true
  for (let y = 9; y <= 11; y++) for (let x = 2; x <= 11; x++) if (w.tiles[y][x] === TILE.SOIL) dig(w, x, y)
  w.farm.waterSupplied = true
  return serialize(w)
}

/** 已经接好水、食物充足，并且灶台和餐桌都建好的存档。 */
function sharedMealSave() {  const raw = farmedSave()
  raw.world.tiles[10][26] = TILE.EMPTY
  raw.world.tiles[10][27] = TILE.EMPTY
  raw.world.tiles[21][17] = TILE.EMPTY
  raw.world.tiles[20][17] = TILE.EMPTY
  raw.world.builtSites.push({ id: 'spring-kitchen', kind: 'kitchen' }, { id: 'spring-table', kind: 'dining' })
  raw.world.farm.food = 3
  raw.world.inventory = { stone: 10, wood: 10 }
  return raw
}

/** 泉边小菜园已建成：一槽未熟、一槽成熟的菜。 */
function gardenSave() {
  const raw = farmedSave()
  // 梯口上方补出两格净空：两格高的存档通路校验才走得通（同 sharedMealSave）。
  raw.world.tiles[10][26] = TILE.EMPTY
  raw.world.tiles[10][27] = TILE.EMPTY
  raw.world.builtSites.push({ id: 'spring-garden', kind: 'garden' })
  raw.world.farm.planters.push({ id: 1, x: 28, y: 21, growth: 0 }, { id: 2, x: 30, y: 21, growth: 3 })
  return raw
}

function lampSave() {
  const raw = farmedSave()
  for (const x of [26, 27]) raw.world.tiles[10][x] = TILE.EMPTY
  for (let x = 18; x <= 38; x++) for (const y of [19, 20, 21]) raw.world.tiles[y][x] = TILE.EMPTY
  raw.world.powerDown = true
  raw.world.exploration.lamps = [{ x: 31, y: 19 }]
  return raw
}

const LISTEN = { x: 27, y: 12 }

/** 旧集成用例自动完成普通土的走位；专门的行动用例另检查落爪前后和过期回调。 */
function tapAndFinishSoil(x: number, y: number): void {
  const w = harness.renderer.setWorld.mock.calls[0][0] as WorldState
  const soil = w.tiles[y][x] === TILE.SOIL, calls = harness.renderer.playExplorationTravel.mock.calls.length
  harness.handlers.onTap({ x, y })
  if (soil && harness.renderer.playExplorationTravel.mock.calls.length > calls) {
    const travel = harness.renderer.playExplorationTravel.mock.calls.at(-1) as unknown as [Cell[], () => void]
    travel[1]()
  }
}

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
    harness.renderer.partnerAtScreen.mockReturnValue(null)
    harness.renderer.playOpening.mockReset().mockImplementation(done => done())
    harness.renderer.finishOpening.mockReset()
    harness.renderer.playPartnerTravel.mockReset().mockImplementation((_id, route, step, done) => { route.forEach(step); done() })
    harness.renderer.playPartnerWork.mockReset().mockImplementation((_plan, hit, done) => { hit(); done() })
  })
  afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals() })


  it('小窝预览不扣款，施工期间物品栏输入门禁不取消，结算保存/撤销与旧回调安全', async () => {
    harness.store.load.mockResolvedValue(serialize(warmLampWorld(true)))
    const nest = vi.fn(), work = vi.fn(), rooms = vi.fn()
    const session = await createGameSession({} as HTMLElement, { onMessage: vi.fn(), onProgress: vi.fn(), onNestWelcome: nest, onWork: work, onRooms: rooms })
    const w = harness.renderer.setWorld.mock.calls[0][0] as WorldState, parts = w.deep.parts
    session.openNestWarmLamp(1)
    expect(nest.mock.calls.at(-1)![0]).toMatchObject({ podId: 1, lamp: { installed: false, problem: null } })
    expect(harness.renderer.setNestLampPreview).toHaveBeenLastCalledWith(1); expect(w.deep.parts).toBe(parts)
    session.closeNestWelcome(); expect(w.deep.parts).toBe(parts)
    session.openNestWarmLamp(1)
    harness.renderer.playPartnerTravel.mockImplementation(() => {})
    harness.renderer.playPartnerWork.mockImplementation(() => {})
    session.confirmNestWarmLamp(); session.confirmNestWarmLamp()
    expect(harness.renderer.playPartnerTravel).toHaveBeenCalledTimes(1)
    expect(nest).toHaveBeenLastCalledWith(null); expect(work.mock.calls.at(-1)![0].phase).toBe('walking')
    const [, route, step, arrive] = harness.renderer.playPartnerTravel.mock.calls[0]
    route.forEach(step); arrive()
    session.setInputBlocked(true); session.setInputBlocked(false)
    expect(harness.renderer.cancelPartnerWork).not.toHaveBeenCalled()
    const [, hit, done] = harness.renderer.playPartnerWork.mock.calls[0]
    expect(w.deep.parts).toBe(parts); hit(); hit(); done(); done()
    expect(w.pods[0].warmLamp).toBe(true); expect(w.deep.parts).toBe(parts - 1)
    expect(nest.mock.calls.at(-1)![0]).toMatchObject({ podId: 1, lamp: { installed: true } })
    await vi.advanceTimersByTimeAsync(1000)
    expect(deserialize(harness.store.save.mock.calls.at(-1)![0])).toMatchObject({ ok: true, world: { pods: expect.arrayContaining([expect.objectContaining({ id: 1, warmLamp: true, mark: 'leaf' })]) } })
    session.openNestWarmLamp(1); expect(nest.mock.calls.at(-1)![0].lamp.installed).toBe(true)
    session.undo(); hit(); done(); arrive()
    expect(w.deep.parts).toBe(parts); expect(w.pods[0].warmLamp).toBeUndefined(); expect(w.pods[0].mark).toBe('leaf')
    session.destroy()
  })


  it.each(['pan', 'zoom'] as const)('装灯期间主动%s后，完工保留灯且不重开详情或抢镜头', async gesture => {
    harness.store.load.mockResolvedValue(serialize(warmLampWorld()))
    const nest = vi.fn()
    const session = await createGameSession({} as HTMLElement, { onMessage: vi.fn(), onProgress: vi.fn(), onNestWelcome: nest })
    harness.renderer.playPartnerWork.mockImplementation(() => {})
    session.openNestWarmLamp(1); session.confirmNestWarmLamp()
    if (gesture === 'pan') harness.handlers.onPanBy({ x: 20, y: 10 })
    else session.zoomBy(.1)
    nest.mockClear(); harness.renderer.focusOn.mockClear()
    const [, hit, done] = harness.renderer.playPartnerWork.mock.calls[0]; hit(); done()
    expect(nest).not.toHaveBeenCalled(); expect(harness.renderer.focusOn).not.toHaveBeenCalled()
    const w = harness.renderer.setWorld.mock.calls[0][0] as WorldState
    expect(w.pods[0].warmLamp).toBe(true)
    session.destroy()
  })

  it('一次刷新仅提交最终全局目标；专属面板仍分别刷新，终章完成恢复自由建设', async () => {
    harness.store.load.mockResolvedValue(serialize(completedFinale()))
    const progress = vi.fn(), finale = vi.fn(), deep = vi.fn()
    const session = await createGameSession({} as HTMLElement, { onMessage: vi.fn(), onProgress: progress, onFinale: finale, onDeep: deep })
    progress.mockClear(); finale.mockClear(); deep.mockClear()
    session.startPlanting()
    expect(progress).toHaveBeenCalledTimes(1)
    expect(progress.mock.calls[0][0]).toMatchObject({ finished: true, action: { id: 'overview' } })
    expect(finale).toHaveBeenCalled(); expect(deep).toHaveBeenCalled()
    session.destroy()
  })

  it('锁层调用只提示；开放楼层镜头和详情切换不改变世界或伙伴站位', async () => {
    harness.store.load.mockResolvedValue(serialize(createInitialWorld()))
    const message = vi.fn(), deep = vi.fn()
    const locked = await createGameSession({} as HTMLElement, { onMessage: message, onProgress: vi.fn(), onDeep: deep })
    const initial = harness.renderer.setWorld.mock.calls[0][0] as WorldState, before = structuredClone(initial)
    harness.renderer.focusOn.mockClear(); deep.mockClear()
    locked.lookCrystal(); locked.openHall(); locked.openGarden(); locked.openReservoir(); locked.openVentilation(); locked.openRuins(); locked.openFinale()
    expect(initial).toEqual(before); expect(harness.renderer.focusOn).not.toHaveBeenCalled(); expect(deep).not.toHaveBeenCalled()
    expect(message).toHaveBeenCalledWith(expect.stringContaining('第一顿围坐饭'), undefined)
    locked.destroy(); harness.renderer.setWorld.mockClear()
    harness.store.load.mockResolvedValue(serialize(completedFinale()))
    const game = await createGameSession({} as HTMLElement, { onMessage: vi.fn(), onProgress: vi.fn() })
    const w = harness.renderer.setWorld.mock.calls[0][0] as WorldState, saved = structuredClone(w)
    for (const open of [game.openDeep, game.openHall, game.openGarden, game.openReservoir, game.openVentilation, game.openRuins, game.openFinale]) open()
    game.centerOnHome(); game.lookDown(); game.showOverview()
    expect(w).toEqual(saved)
    game.destroy()
  })

  it('伙伴工作中查看九层、拖图、缩放和关闭信息不取消；新目标提示，停止/重进不补结算', async () => {
    const save = completedFinale()
    save.farm.planters.push({ id: 1, x: 30, y: 21, growth: 3 })
    harness.store.load.mockResolvedValue(serialize(save))
    const work = vi.fn(), message = vi.fn()
    const game = await createGameSession({} as HTMLElement, { onMessage: message, onProgress: vi.fn(), onWork: work })
    const w = harness.renderer.setWorld.mock.calls[0][0] as WorldState, food = w.farm.food
    let hit = () => {}, done = () => {}
    harness.renderer.playPartnerWork.mockImplementationOnce((_plan, strike, finish) => { hit = strike; done = finish })
    harness.handlers.onTap({ x: 30, y: 21 })
    expect(work.mock.calls.at(-1)![0]).toMatchObject({ name: '小满', phase: 'working' })
    const busyWorld = structuredClone(w)
    harness.renderer.cancelPartnerWork.mockClear()
    for (const open of [game.openDeep, game.openHall, game.openGarden, game.openReservoir, game.openVentilation, game.openRuins, game.openFinale]) open()
    game.centerOnHome(); game.lookDown(); game.showOverview(); game.findPartner('xiaoman')
    harness.handlers.onPanBy({ x: 10, y: 20 }); game.zoomBy(.12)
    game.setInputBlocked(true); game.setInputBlocked(false); game.closeFacility(); game.closeRooms()
    harness.handlers.onTap({ x: 30, y: 21 }); harness.handlers.onTap({ x: 36, y: 9 })
    expect(message).toHaveBeenCalledWith(expect.stringContaining('小满正在收菜'), undefined)
    expect(harness.renderer.cancelPartnerWork).not.toHaveBeenCalled()
    expect(work.mock.calls.at(-1)![0]?.phase).toBe('working')
    expect(w).toEqual(busyWorld)
    game.cancelAction(); hit(); done()
    expect(work.mock.calls.at(-1)![0]).toBeNull(); expect(w.farm.food).toBe(food)
    expect(message).toHaveBeenCalledWith(expect.stringContaining('现在可以点新的目标'), undefined)
    const saved = serialize(w); game.destroy(); hit(); done()
    harness.store.load.mockResolvedValue(saved); harness.renderer.setWorld.mockClear()
    const restoredWork = vi.fn()
    const restored = await createGameSession({} as HTMLElement, { onMessage: vi.fn(), onProgress: vi.fn(), onWork: restoredWork })
    const loaded = harness.renderer.setWorld.mock.calls[0][0] as WorldState
    expect(loaded.farm.food).toBe(food)
    expect(restoredWork.mock.calls.some(([state]) => state !== null)).toBe(false)
    harness.handlers.onTap({ x: 30, y: 21 }); expect(loaded.farm.food).toBe(food + 1)
    restored.destroy()
  })

  it('终章与旧层互斥，后台和离页取消搬运不扣料，阿土对话与收藏定位接回九层',async()=>{
    harness.store.load.mockResolvedValue(serialize(workingFinale()));const finale=vi.fn(),ruins=vi.fn(),progress=vi.fn()
    const session=await createGameSession({}as HTMLElement,{onMessage:vi.fn(),onProgress:progress,onFinale:finale,onRuins:ruins})
    const w=harness.renderer.setWorld.mock.calls[0][0]as WorldState;expect(progress.mock.calls.at(-1)![0].action.id).toBe('finale');session.openFinale();expect(finale.mock.calls.at(-1)![0].active).toBe(true);expect(ruins.mock.calls.at(-1)![0].active).toBe(false)
    const food=w.farm.food;let old=()=>{};harness.renderer.playPartnerTravel.mockImplementationOnce((_id,_r,_step,done)=>{old=done});session.finalePrimary();Object.defineProperty(document,'visibilityState',{configurable:true,value:'hidden'});harness.listeners.document.get('visibilitychange')!();old();expect(w.farm.food).toBe(food);expect(w.finale.foodReady).toBe(false)
    Object.defineProperty(document,'visibilityState',{configurable:true,value:'visible'});harness.listeners.document.get('visibilitychange')!();session.finalePrimary();expect(w.finale.foodReady).toBe(true);expect(w.farm.food).toBe(food-1)
    session.openRuins();expect(finale.mock.calls.at(-1)![0].active).toBe(false);session.talkToPartner('atu');session.partnerAction();expect(finale.mock.calls.at(-1)![0].active).toBe(true)
    let stale=()=>{};harness.renderer.playPartnerTravel.mockImplementationOnce((_id,_r,_step,done)=>{stale=done});const water=w.reservoir.water;session.finalePrimary();harness.listeners.window.get('pagehide')!();stale();expect(w.reservoir.water).toBe(water);expect(w.finale.waterReady).toBe(false);expect(finale.mock.calls.at(-1)![0].busy).toBe(false);session.focusRelic('earth-warmth');expect(harness.renderer.focusOn).toHaveBeenLastCalledWith(36.5*32,105*32,'building');expect(deserialize(serialize(w))).toMatchObject({ok:true});session.destroy()
  })
  it('八层入口和旧层互斥，后台/离页取消不揭画，阿土对话接回遗迹',async()=>{
    harness.store.load.mockResolvedValue(serialize(workingRuins()));const ruins=vi.fn(),ventilation=vi.fn(),progress=vi.fn()
    const session=await createGameSession({}as HTMLElement,{onMessage:vi.fn(),onProgress:progress,onRuins:ruins,onVentilation:ventilation})
    const w=harness.renderer.setWorld.mock.calls[0][0]as WorldState;expect(progress.mock.calls.at(-1)![0].action.id).toBe('ruins');session.openRuins();expect(ruins.mock.calls.at(-1)![0].active).toBe(true);expect(ventilation.mock.calls.at(-1)![0].active).toBe(false)
    session.ruinsMotif('lamp');session.ruinsPrimary();const old=harness.renderer.playExplorationTravel.mock.calls.at(-1)as unknown as[Cell[],()=>void]
    Object.defineProperty(document,'visibilityState',{configurable:true,value:'hidden'});harness.listeners.document.get('visibilitychange')!();old[1]();expect(w.ruins.revealed).toHaveLength(0)
    Object.defineProperty(document,'visibilityState',{configurable:true,value:'visible'});harness.listeners.document.get('visibilitychange')!();session.openRuins();session.ruinsMotif('lamp');session.ruinsPrimary();const retry=harness.renderer.playExplorationTravel.mock.calls.at(-1)as unknown as[Cell[],()=>void];retry[1]();expect(w.ruins.revealed).toEqual(['lamp'])
    session.openVentilation();expect(ruins.mock.calls.at(-1)![0].active).toBe(false);session.talkToPartner('atu');session.partnerAction();expect(ruins.mock.calls.at(-1)![0].active).toBe(true)
    session.ruinsMotif('spring');session.ruinsPrimary();const stale=harness.renderer.playExplorationTravel.mock.calls.at(-1)as unknown as[Cell[],()=>void];harness.listeners.window.get('pagehide')!();stale[1]();expect(w.ruins.revealed).toEqual(['lamp']);expect(ruins.mock.calls.at(-1)![0].busy).toBe(false);session.focusRelic('ruins-tools');expect(harness.renderer.focusOn).toHaveBeenLastCalledWith(38.5*32,93*32,'building');expect(deserialize(serialize(w))).toMatchObject({ok:true});session.destroy()
  })
  it('第七层真实会话与旧面板互斥，铃铃对话回工区，后台和离页取消不提前调风机',async()=>{
    harness.store.load.mockResolvedValue(serialize(workingVentilation()));const ventilation=vi.fn(),reservoir=vi.fn(),progress=vi.fn()
    const session=await createGameSession({}as HTMLElement,{onMessage:vi.fn(),onProgress:progress,onVentilation:ventilation,onReservoir:reservoir})
    const w=harness.renderer.setWorld.mock.calls[0][0]as WorldState;expect(progress.mock.calls.at(-1)![0].action.id).toBe('ventilation');session.openVentilation();expect(ventilation.mock.calls.at(-1)![0].active).toBe(true);expect(reservoir.mock.calls.at(-1)![0].active).toBe(false)
    session.ventilationMode('home');session.ventilationPrimary();const old=harness.renderer.playExplorationTravel.mock.calls.at(-1)as unknown as[Cell[],()=>void]
    Object.defineProperty(document,'visibilityState',{configurable:true,value:'hidden'});harness.listeners.document.get('visibilitychange')!();old[1]();expect(w.ventilation.mode).toBe('off')
    Object.defineProperty(document,'visibilityState',{configurable:true,value:'visible'});harness.listeners.document.get('visibilitychange')!();session.openVentilation();session.ventilationMode('home');session.ventilationPrimary();const retry=harness.renderer.playExplorationTravel.mock.calls.at(-1)as unknown as[Cell[],()=>void];retry[1]();expect(w.ventilation.mode).toBe('home')
    session.talkToPartner('lingling');expect(ventilation.mock.calls.at(-1)![0].active).toBe(false);session.partnerAction();expect(ventilation.mock.calls.at(-1)![0].active).toBe(true)
    session.openReservoir();expect(ventilation.mock.calls.at(-1)![0].active).toBe(false);session.openVentilation();session.ventilationMode('work');session.ventilationPrimary();const stale=harness.renderer.playExplorationTravel.mock.calls.at(-1)as unknown as[Cell[],()=>void];harness.listeners.window.get('pagehide')!();stale[1]();expect(w.ventilation.mode).toBe('home');expect(ventilation.mock.calls.at(-1)![0].busy).toBe(false);session.focusRelic('wind-echo');expect(harness.renderer.focusOn).toHaveBeenLastCalledWith(38.5*32,81*32,'building');expect(deserialize(serialize(w))).toMatchObject({ok:true});session.destroy()
  })
  it('六层引导与旧面板交接、团团对话、后台和离页取消蓄水都不触发旧抵达',async()=>{
    harness.store.load.mockResolvedValue(serialize(workingReservoir()))
    const reservoir=vi.fn(),garden=vi.fn(),progress=vi.fn()
    const session=await createGameSession({} as HTMLElement,{onMessage:vi.fn(),onProgress:progress,onReservoir:reservoir,onGarden:garden})
    const w=harness.renderer.setWorld.mock.calls[0][0] as WorldState;expect(progress.mock.calls.at(-1)![0].action.id).toBe('reservoir')
    session.openReservoir();expect(reservoir.mock.calls.at(-1)![0].active).toBe(true);expect(garden.mock.calls.at(-1)![0].active).toBe(false)
    session.reservoirPrimary();const old=harness.renderer.playExplorationTravel.mock.calls.at(-1) as unknown as [Cell[],()=>void]
    Object.defineProperty(document,'visibilityState',{configurable:true,value:'hidden'});harness.listeners.document.get('visibilitychange')!();old[1]();expect(w.reservoir.water).toBe(0)
    Object.defineProperty(document,'visibilityState',{configurable:true,value:'visible'});harness.listeners.document.get('visibilitychange')!()
    session.reservoirPrimary();const retry=harness.renderer.playExplorationTravel.mock.calls.at(-1) as unknown as [Cell[],()=>void];retry[1]();expect(w.reservoir.water).toBe(3)
    session.talkToPartner('tuantuan');expect(reservoir.mock.calls.at(-1)![0].active).toBe(false);session.partnerAction();expect(reservoir.mock.calls.at(-1)![0].active).toBe(true)
    session.openGarden();expect(reservoir.mock.calls.at(-1)![0].active).toBe(false)
    session.openReservoir();session.reservoirRoute('garden');session.reservoirPrimary();const stale=harness.renderer.playExplorationTravel.mock.calls.at(-1) as unknown as [Cell[],()=>void]
    harness.listeners.window.get('pagehide')!();stale[1]();expect(w.reservoir.valve).toBe('closed');expect(reservoir.mock.calls.at(-1)![0].busy).toBe(false)
    expect(deserialize(serialize(w))).toMatchObject({ok:true});session.destroy()
  })
  it('第五层会话和旧面板互斥，苔苔对话回花园，菌床工作切后台取消可安全重试',async()=>{
    harness.store.load.mockResolvedValue(serialize(workingGarden()))
    const garden=vi.fn(), hall=vi.fn(), deep=vi.fn(), progress=vi.fn()
    const session=await createGameSession({} as HTMLElement,{onMessage:vi.fn(),onProgress:progress,onGarden:garden,onHall:hall,onDeep:deep})
    const w=harness.renderer.setWorld.mock.calls[0][0] as WorldState
    expect(progress.mock.calls.at(-1)![0].action.id).toBe('garden')
    session.openGarden(); expect(garden.mock.calls.at(-1)![0].active).toBe(true)
    expect(hall.mock.calls.at(-1)![0].active).toBe(false); expect(deep.mock.calls.at(-1)![0].active).toBe(false)
    session.gardenSelect('bed'); session.gardenPrimary()
    const arrive=harness.renderer.playExplorationTravel.mock.calls.at(-1) as unknown as [Cell[],()=>void]
    Object.defineProperty(document,'visibilityState',{configurable:true,value:'hidden'}); harness.listeners.document.get('visibilitychange')!()
    arrive[1](); expect(w.garden.facilities.find(f=>f.kind==='bed')?.growth).toBe(0); expect(garden.mock.calls.at(-1)![0].busy).toBe(false)
    Object.defineProperty(document,'visibilityState',{configurable:true,value:'visible'}); harness.listeners.document.get('visibilitychange')!()
    session.gardenPrimary(); const retry=harness.renderer.playExplorationTravel.mock.calls.at(-1) as unknown as [Cell[],()=>void]; retry[1]()
    expect(w.garden.facilities.find(f=>f.kind==='bed')?.growth).toBe(1)
    session.talkToPartner('taitai'); expect(garden.mock.calls.at(-1)![0].active).toBe(false)
    session.partnerAction(); expect(garden.mock.calls.at(-1)![0].active).toBe(true)
    session.openHall(); expect(garden.mock.calls.at(-1)![0].active).toBe(false)
    expect(deserialize(serialize(w))).toMatchObject({ok:true}); session.destroy()
  })

  it('第四层真实会话打开、庆典结算、退出与切后台取消不留并行面板；保存仍可恢复', async () => {
    harness.store.load.mockResolvedValue(serialize(furnishedHall()))
    const hall = vi.fn(), deep = vi.fn(), progress = vi.fn()
    const session = await createGameSession({} as HTMLElement, { onMessage: vi.fn(), onProgress: progress, onHall: hall, onDeep: deep })
    const w = harness.renderer.setWorld.mock.calls[0][0] as WorldState, food = w.farm.food
    expect(progress.mock.calls.at(-1)![0].action.id).toBe('hall')
    session.openHall(); expect(hall.mock.calls.at(-1)![0].active).toBe(true); expect(deep.mock.calls.at(-1)![0].active).toBe(false)
    session.hallPrimary(); expect(w.hall.feasts).toBe(0)
    const arrived = harness.renderer.playExplorationTravel.mock.calls.at(-1) as unknown as [Cell[], () => void]
    arrived[1](); expect(w.hall.feasts).toBe(1); expect(w.farm.food).toBe(food - 1)
    session.hallPrimary(); expect(hall.mock.calls.at(-1)![0].active).toBe(false)
    session.openHall(); session.hallPrimary()
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' })
    harness.listeners.document.get('visibilitychange')!()
    const stale = harness.renderer.playExplorationTravel.mock.calls.at(-1) as unknown as [Cell[], () => void]
    stale[1](); expect(w.hall.feasts).toBe(1)
    expect(hall.mock.calls.at(-1)![0].busy).toBe(false)
    expect(deserialize(serialize(w))).toMatchObject({ ok: true })
    session.destroy()
  })

  it('仅空存档播放开场；演出屏蔽点挖、拖图和缩放，结束保存原任务', async () => {
    harness.store.load.mockResolvedValue(null)
    let finish = () => {}
    harness.renderer.playOpening.mockImplementationOnce(done => { finish = done })
    harness.renderer.finishOpening.mockImplementation(() => finish())
    const opening = vi.fn(), progress = vi.fn()
    const session = await createGameSession({} as HTMLElement, { onMessage: vi.fn(), onProgress: progress, onOpening: opening })
    const w = harness.renderer.setWorld.mock.calls[0][0] as WorldState, before = serialize(w)
    harness.handlers.onTap({ x: 16, y: 11 }); harness.handlers.onPanBy({ x: 100, y: 80 })
    expect(serialize(w)).toEqual(before); expect(harness.renderer.panBy).not.toHaveBeenCalled()
    expect(opening.mock.calls.at(-1)![0].active).toBe(true)
    session.skipOpening(); session.skipOpening()
    expect(opening.mock.calls.at(-1)![0].active).toBe(false)
    expect(harness.store.save).toHaveBeenCalledTimes(1)
    expect(serialize(w)).toEqual(before)
    expect(progress.mock.calls.at(-1)![0].done).toBe(0)
    session.destroy()
  })

  it('包括未挖一格的新存档在内，恢复时都不播放开场', async () => {
    harness.store.load.mockResolvedValue(serialize(createInitialWorld()))
    const opening = vi.fn()
    const session = await createGameSession({} as HTMLElement, { onMessage: vi.fn(), onProgress: vi.fn(), onOpening: opening })
    expect(playBuildComplete).not.toHaveBeenCalled()
    expect(playPartnerFound).not.toHaveBeenCalled()
    expect(playSoilDig).not.toHaveBeenCalled()
    expect(harness.renderer.playOpening).not.toHaveBeenCalled()
    expect(opening).toHaveBeenLastCalledWith({ active: false, caption: '' })
    session.destroy()
  })

  it('开场切到后台走同一收尾出口，恢复存档不会出现半途角色位置', async () => {
    harness.store.load.mockResolvedValue(null)
    let finish = () => {}
    harness.renderer.playOpening.mockImplementationOnce(done => { finish = done })
    harness.renderer.finishOpening.mockImplementation(() => finish())
    const session = await createGameSession({} as HTMLElement, { onMessage: vi.fn(), onProgress: vi.fn() })
    const before = serialize(harness.renderer.setWorld.mock.calls[0][0] as WorldState)
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true })
    harness.listeners.document.get('visibilitychange')!()
    expect(harness.renderer.finishOpening).toHaveBeenCalled()
    expect(harness.store.save.mock.calls.at(-1)![0]).toEqual(before)
    session.destroy()
  })

  it('阿灯学习不自动改灯；加装走到现场才落手，重复结算无效，撤销只退灯罩', async () => {
    harness.store.load.mockResolvedValue(lampSave())
    const conversation = vi.fn(), session = await createGameSession({} as HTMLElement, { onMessage: vi.fn(), onProgress: vi.fn(), onPartnerConversation: conversation })
    const w = harness.renderer.setWorld.mock.calls[0][0] as WorldState
    session.talkToPartner('adeng')
    expect(conversation.mock.calls.at(-1)![0].action.id).toBe('learn-wide-lamp')
    const farm = structuredClone(w.farm), actor = { ...w.exploration.explorer! }, before = lightField(w)
    session.partnerAction()
    expect(w.partnerUpgrades).toEqual([WIDE_LAMP_ID]); expect(lightField(w)).toEqual(before)
    expect(conversation.mock.calls.at(-1)![0].action.id).toBe('place-wide-lamp')
    session.partnerAction() // 只进入工具，灯不改变。
    expect(harness.renderer.focusOn).toHaveBeenLastCalledWith(31.5 * 32, 20.5 * 32)
    let hit = () => {}, done = () => {}
    harness.renderer.playPartnerWork.mockImplementationOnce((_p, strike, finish) => { hit = strike; done = finish })
    harness.handlers.onTap({ x: 31, y: 19 })
    expect(harness.renderer.playPartnerTravel.mock.calls.at(-1)![1].at(-1)).toEqual({ x: 31, y: 21 })
    expect(w.exploration.lamps[0].wide).toBeUndefined()
    harness.handlers.onTap({ x: 31, y: 19 }); hit(); hit(); done()
    expect(w.exploration.lamps).toEqual([{ x: 31, y: 19, wide: true }])
    expect(lightField(w).length).toBeGreaterThan(before.length)
    expect(w.farm).toEqual(farm); expect(w.exploration.explorer).toEqual(actor)
    session.undo()
    expect(w.exploration.lamps).toEqual([{ x: 31, y: 19 }]); expect(w.partnerUpgrades).toEqual([WIDE_LAMP_ID])
    expect(deserialize(serialize(w)).ok).toBe(true)
    session.destroy()
  })

  it('取消或切后台不会补加装；刷新恢复学习成果，已加装灯不能重复工作', async () => {
    const raw = lampSave(); raw.world.partnerUpgrades = [WIDE_LAMP_ID]
    harness.store.load.mockResolvedValue(raw)
    const session = await createGameSession({} as HTMLElement, { onMessage: vi.fn(), onProgress: vi.fn() })
    const w = harness.renderer.setWorld.mock.calls[0][0] as WorldState
    let hit = () => {}, done = () => {}
    harness.renderer.playPartnerWork.mockImplementationOnce((_p, strike, finish) => { hit = strike; done = finish })
    session.toggleLamp(); harness.handlers.onTap({ x: 31, y: 19 })
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' })
    harness.listeners.document.get('visibilitychange')!(); hit(); done()
    expect(w.exploration.lamps[0].wide).toBeUndefined(); expect(w.partnerUpgrades).toEqual([WIDE_LAMP_ID])
    session.toggleLamp(); harness.handlers.onTap({ x: 31, y: 19 })
    expect(w.exploration.lamps[0].wide).toBe(true)
    const count = harness.renderer.playPartnerTravel.mock.calls.length
    session.toggleLamp(); harness.handlers.onTap({ x: 31, y: 19 })
    expect(harness.renderer.playPartnerTravel.mock.calls.length).toBe(count)
    const saved = serialize(w); session.destroy(); harness.store.load.mockResolvedValue(saved)
    const restored = await createGameSession({} as HTMLElement, { onMessage: vi.fn(), onProgress: vi.fn() })
    const reloaded = harness.renderer.setWorld.mock.calls.at(-1)![0] as WorldState
    expect(reloaded.partnerUpgrades).toEqual([WIDE_LAMP_ID]); expect(reloaded.exploration.lamps[0].wide).toBe(true)
    restored.destroy()
  })

  it('学会后新灯带灯罩，撤销新灯保留旧灯、能力和房间；非法升级档不覆盖', async () => {
    const raw = lampSave(); raw.world.partnerUpgrades = [WIDE_LAMP_ID]
    harness.store.load.mockResolvedValue(raw)
    const session = await createGameSession({} as HTMLElement, { onMessage: vi.fn(), onProgress: vi.fn() })
    const w = harness.renderer.setWorld.mock.calls[0][0] as WorldState
    session.toggleLamp(); harness.handlers.onTap({ x: 35, y: 19 })
    expect(w.exploration.lamps).toEqual([{ x: 31, y: 19 }, { x: 35, y: 19, wide: true }])
    session.undo(); expect(w.exploration.lamps).toEqual([{ x: 31, y: 19 }]); expect(w.partnerUpgrades).toEqual([WIDE_LAMP_ID])
    session.destroy()
    harness.store.save.mockClear(); raw.world.partnerUpgrades = ['bad-upgrade']; harness.store.load.mockResolvedValue(raw)
    const warning = vi.fn(), failed = await createGameSession({} as HTMLElement, { onMessage: warning, onProgress: vi.fn() })
    await vi.advanceTimersByTimeAsync(450); failed.destroy()
    expect(warning.mock.calls.some(([s]) => s.includes('升级') && s.includes('不覆盖原档'))).toBe(true)
    expect(harness.store.save).not.toHaveBeenCalled()
  })

  it('伙伴工作阻止误挖和多开，切后台取消后旧回调无效；恢复仍能收菜', async () => {
    const raw = farmedSave()
    for (let x = 26; x <= 32; x++) for (const y of [10, 11]) raw.world.tiles[y][x] = TILE.EMPTY
    raw.world.farm.planters = [{ id: 1, x: 31, y: 11, growth: 3 }]
    harness.store.load.mockResolvedValue(raw)
    const work = vi.fn(), session = await createGameSession({} as HTMLElement, { onMessage: vi.fn(), onProgress: vi.fn(), onWork: work })
    const w = harness.renderer.setWorld.mock.calls[0][0] as WorldState, actor = { ...w.exploration.explorer! }
    let hit = () => {}, done = () => {}
    harness.renderer.playPartnerWork.mockImplementationOnce((_plan, strike, finish) => { hit = strike; done = finish })
    harness.renderer.partnerAtScreen.mockReturnValue('xiaoman') // 菜槽命中优先于人物触屏容错。
    harness.handlers.onTap({ x: 31, y: 11 }); expect(work.mock.calls.at(-1)![0]).toMatchObject({ name: '小满', phase: 'working' })
    harness.handlers.onTap({ x: 31, y: 11 }); harness.handlers.onTap({ x: 33, y: 11 })
    expect(w.tiles[11][33]).toBe(TILE.SOIL); expect(w.farm.food).toBe(0)
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' })
    harness.listeners.document.get('visibilitychange')!(); hit(); done()
    expect(work.mock.calls.at(-1)![0]).toBeNull(); expect(w.farm.food).toBe(0)
    harness.handlers.onTap({ x: 31, y: 11 })
    expect(w.farm.food).toBe(1); expect(w.exploration.explorer).toEqual(actor)
    expect(deserialize(serialize(w)).ok).toBe(true)
    session.destroy()
  })

  it('伙伴让开床位时取消不建床，重试后实际退让且旧站位不会被埋进舱内', async () => {
    const raw = farmedSave()
    for (let x = 24; x <= 35; x++) for (const y of [10, 11]) raw.world.tiles[y][x] = TILE.EMPTY
    raw.world.workers = { adeng: { x: 32, y: 11 } }
    harness.store.load.mockResolvedValue(raw)
    const session = await createGameSession({} as HTMLElement, { onMessage: vi.fn(), onProgress: vi.fn() })
    const w = harness.renderer.setWorld.mock.calls[0][0] as WorldState
    let arrive = () => {}
    harness.renderer.playPartnerTravel.mockImplementationOnce((_id, _route, _step, done) => { arrive = done })
    session.setBuildMode('pod'); harness.handlers.onTap({ x: 32, y: 11 }); session.confirmBuild()
    expect(w.pods).toHaveLength(1)
    session.cancelAction(); arrive(); expect(w.pods).toHaveLength(1)
    session.confirmBuild()
    expect(w.pods).toHaveLength(2); expect(w.workers.adeng!.x).toBeLessThan(31)
    expect(deserialize(serialize(w)).ok).toBe(true)
    session.destroy()
  })

  it('退出会话后专业工作的旧落手回调不能结算', async () => {
    const raw = farmedSave(); raw.world.farm.planters = [{ id: 1, x: 17, y: 11, growth: 3 }]
    harness.store.load.mockResolvedValue(raw)
    const session = await createGameSession({} as HTMLElement, { onMessage: vi.fn(), onProgress: vi.fn() })
    const w = harness.renderer.setWorld.mock.calls[0][0] as WorldState
    let hit = () => {}, done = () => {}
    harness.renderer.playPartnerWork.mockImplementationOnce((_plan, strike, finish) => { hit = strike; done = finish })
    harness.handlers.onTap({ x: 17, y: 11 }); session.destroy(); hit(); done()
    expect(w.farm.food).toBe(0)
  })

  it('专业工作画面停止出帧时看门狗取消，旧抵达回调不能补收获', async () => {
    const raw = farmedSave(); raw.world.farm.planters = [{ id: 1, x: 17, y: 11, growth: 3 }]
    harness.store.load.mockResolvedValue(raw)
    const work = vi.fn(), session = await createGameSession({} as HTMLElement, { onMessage: vi.fn(), onProgress: vi.fn(), onWork: work })
    const w = harness.renderer.setWorld.mock.calls[0][0] as WorldState
    let arrive = () => {}
    harness.renderer.playPartnerTravel.mockImplementationOnce((_id, _route, _step, done) => { arrive = done })
    harness.handlers.onTap({ x: 17, y: 11 })
    expect(work.mock.calls.at(-1)![0]).toMatchObject({ name: '小满', phase: 'walking' })
    await vi.advanceTimersByTimeAsync(4000); arrive()
    expect(work.mock.calls.at(-1)![0]).toBeNull(); expect(w.farm.food).toBe(0)
    session.destroy()
  })

  it('第一层建首床不再提前出现小满；撤销后站位与存档仍然合法', async () => {
    harness.store.load.mockResolvedValue(null)
    const onNestWelcome = vi.fn()
    const session = await createGameSession({} as HTMLElement, { onMessage: vi.fn(), onProgress: vi.fn(), onNestWelcome })
    const w = harness.renderer.setWorld.mock.calls[0][0] as WorldState
    w.progress = { crystalFound: true, crystalCollected: true, coreRepaired: true }; w.tiles[9][14] = TILE.EMPTY
    for (const x of [12, 13, 14]) for (const y of [10, 11]) w.tiles[y][x] = TILE.EMPTY
    session.setBuildMode('pod'); harness.handlers.onTap({ x: 13, y: 11 }); session.confirmBuild()
    expect(w.workers.xiaoman).toBeUndefined(); expect(w.pods).toHaveLength(1)
    expect(onNestWelcome).toHaveBeenCalledWith(expect.objectContaining({ podId: w.pods[0].id, speech: expect.stringContaining('心心') }))
    session.undo(); expect(w.pods).toHaveLength(0); expect(w.workers.xiaoman).toBeUndefined()
    expect(w.workers.adeng).toBeDefined(); expect(deserialize(serialize(w)).ok).toBe(true)
    session.destroy()
  })

  it('入住演出期间玩家转去别处不抢回焦点；旧式独立小窝仍可点击选择标记', async () => {
    harness.store.load.mockResolvedValue(null)
    const onNestWelcome = vi.fn()
    const session = await createGameSession({} as HTMLElement, { onMessage: vi.fn(), onProgress: vi.fn(), onNestWelcome })
    const w = harness.renderer.setWorld.mock.calls[0][0] as WorldState
    w.progress = { crystalFound: true, crystalCollected: true, coreRepaired: true }; w.tiles[9][14] = TILE.EMPTY
    for (const x of [12, 13, 14]) for (const y of [10, 11]) w.tiles[y][x] = TILE.EMPTY
    let settled = () => {}
    harness.renderer.playPodEntrance.mockImplementationOnce((_pod, done) => { settled = done })
    session.setBuildMode('pod'); harness.handlers.onTap({ x: 13, y: 11 }); session.confirmBuild()
    harness.listeners.window.get('pointerdown')!(); settled()
    expect(onNestWelcome).not.toHaveBeenCalled()
    harness.handlers.onTap({ x: 13, y: 10 })
    expect(onNestWelcome).toHaveBeenLastCalledWith(expect.objectContaining({ podId: w.pods[0].id }))
    session.confirmNestMark('drop'); expect(w.pods[0].mark).toBe('drop')
    session.destroy()
  })

  it('修好核心先播放亮灯和出场，落地后阿灯才开口，随后可准备小窝', async () => {
    const raw = readySave()
    raw.world.progress = { crystalFound: true, crystalCollected: true, coreRepaired: false }
    raw.world.pods = []; raw.world.workers = {}
    harness.store.load.mockResolvedValue(raw)
    const onPartner = vi.fn()
    const session = await createGameSession({} as HTMLElement, { onMessage: vi.fn(), onProgress: vi.fn(), onPartnerConversation: onPartner })
    harness.renderer.partnerAtScreen.mockReturnValue(null)
    const w = harness.renderer.setWorld.mock.calls[0][0] as WorldState
    harness.handlers.onTap({ x: LANDMARKS.generator.x, y: LANDMARKS.generator.y })
    expect(w.progress.coreRepaired).toBe(true)
    expect(onPartner).toHaveBeenLastCalledWith(null)
    expect(harness.renderer.focusPartner).not.toHaveBeenCalled()
    harness.renderer.onPartnerReveal!('appearing')
    expect(harness.renderer.focusPartner).toHaveBeenLastCalledWith('adeng')
    expect(onPartner).toHaveBeenLastCalledWith(null)
    harness.renderer.onPartnerReveal!('ready')
    const conversation = onPartner.mock.calls.at(-1)![0] as PartnerConversation
    expect(conversation.partnerId).toBe('adeng')
    expect(conversation.lines.join(' ')).toContain('暖暖的床')
    expect(conversation.action?.id).toBe('prepare-nest')
    expect(harness.renderer.setHighlight).toHaveBeenLastCalledWith(null)
    session.partnerAction()
    expect(onPartner).toHaveBeenLastCalledWith(null)
    expect(harness.renderer.focusOn).toHaveBeenCalled()
    session.destroy()
  })

  it('出场期间拖图后不再自动拉镜头或弹对话；对话外第一次点击只关闭，不挖土', async () => {
    const raw = readySave()
    raw.world.progress.coreRepaired = false; raw.world.pods = []; raw.world.workers = {}
    harness.store.load.mockResolvedValue(raw)
    const onPartner = vi.fn(), discovery = vi.fn()
    const session = await createGameSession({} as HTMLElement, { onMessage: vi.fn(), onProgress: vi.fn(), onPartnerConversation: onPartner, onDiscovery: discovery })
    const w = harness.renderer.setWorld.mock.calls[0][0] as WorldState
    harness.handlers.onTap({ x: LANDMARKS.generator.x, y: LANDMARKS.generator.y })
    expect(discovery).toHaveBeenLastCalledWith(true)
    harness.handlers.onPanBy({ x: 40, y: 20 })
    harness.renderer.onPartnerReveal!('appearing'); harness.renderer.onPartnerReveal!('ready')
    expect(harness.renderer.focusPartner).not.toHaveBeenCalled()
    expect(onPartner).toHaveBeenLastCalledWith(null)
    expect(discovery).toHaveBeenLastCalledWith(false)
    session.talkToPartner('adeng')
    const before = structuredClone(w)
    harness.handlers.onTap({ x: 26, y: 9 })
    expect(w).toEqual(before)
    expect(harness.renderer.playExplorationTravel).not.toHaveBeenCalled()
    expect(onPartner).toHaveBeenLastCalledWith(null)
    session.destroy()
  })

  it('小窝引导在挖空前只定位且不改地图，蓝图出现后直接打开这间小窝', async () => {
    const raw = readySave(); raw.world.pods = []
    harness.store.load.mockResolvedValue(raw)
    const progress = vi.fn(), sites = vi.fn()
    const session = await createGameSession({} as HTMLElement, { onMessage: vi.fn(), onProgress: progress, onSites: sites })
    const w = harness.renderer.setWorld.mock.calls[0][0] as WorldState
    const before = structuredClone(w)
    expect(progress.mock.calls.at(-1)![0].action.label).toBe('看看要挖的小窝空间')
    session.prepareNest()
    expect(w).toEqual(before)
    expect(sites.mock.calls.at(-1)![0].active).toBe(false)
    const site = siteById('first-nest')!
    for (let y = site.y; y < site.y + site.h; y++) for (let x = site.x; x < site.x + site.w; x++) w.tiles[y][x] = TILE.EMPTY
    session.prepareNest()
    expect(progress.mock.calls.at(-1)![0].action.label).toBe('修建两人小窝')
    expect(sites.mock.calls.at(-1)![0]).toMatchObject({ active: true, selected: 'first-nest', canBuild: true })
    session.openRooms()
    expect(sites.mock.calls.at(-1)![0]).toMatchObject({ active: true, selected: null })
    session.destroy()
  })

  it('第一次下到第二层会自动和小满说话，之后下楼不再自动重播', async () => {
    const onPartner = vi.fn()
    const { session, w, tap, advance } = await startExploring(vi.fn(), vi.fn(), { onPartnerConversation: onPartner })
    tap(27, 12); advance(); tap(27, 13); advance(); tap(27, 14)
    for (let i = 0; i < 8 && !shaftConnected(w); i++) advance()
    expect(shaftConnected(w)).toBe(true)
    const arrive = () => (harness.renderer.playExplorationTravel.mock.calls.at(-1) as unknown as [Cell[], () => void])[1]()
    session.travel(); arrive()
    expect(w.exploration.entered).toBe(true)
    expect(w.exploration.metXiaoman).toBe(true)
    expect((onPartner.mock.calls.at(-1)![0] as PartnerConversation).partnerId).toBe('xiaoman')
    // 关掉对话、回楼上再下来：已经打过照面，不再自动弹出
    session.closePartnerConversation()
    onPartner.mockClear()
    session.travel(); arrive()
    session.travel(); arrive()
    expect(onPartner.mock.calls.every(([conversation]) => conversation === null)).toBe(true)
    session.destroy()
  })

  it('第二间预设住宿建成后邀请心心给新伙伴的小窝选标记', async () => {
    harness.store.load.mockResolvedValue(farmedSave())
    const onNestWelcome = vi.fn()
    const session = await createGameSession({} as HTMLElement, { onMessage: vi.fn(), onProgress: vi.fn(), onNestWelcome })
    const w = harness.renderer.setWorld.mock.calls[0][0] as WorldState
    // 阿土回到暖窝层，施工走真实可达通道；第一间住处是嵌在房间后侧的成品，前侧仍可通行。
    w.exploration.explorer = { x: 18, y: 11 }
    w.pods[0].backWall = true
    /** 施工仍是真实逐格委托：测试里替玩家把每一段走位播完。 */
    const finishSiteWork = () => {
      for (let handled = 0, guard = 0; guard < 40; guard++) {
        const calls = harness.renderer.playExplorationTravel.mock.calls
        if (calls.length === handled) break
        ;(calls[handled++] as unknown as [Cell[], () => void])[1]()
      }
    }
    expect(w.pods).toHaveLength(1)
    session.selectSite('friends-nest')
    session.buildSite()
    finishSiteWork()
    expect(w.pods).toHaveLength(2)
    expect(onNestWelcome).toHaveBeenCalledWith(expect.objectContaining({ podId: w.pods[1].id, speech: expect.stringContaining('小满') }))
    session.destroy()
  })

  it('泉水已经发现后点击水边不再重播发现庆祝', async () => {
    harness.store.load.mockResolvedValue(farmedSave())
    const session = await createGameSession({} as HTMLElement, { onMessage: vi.fn(), onProgress: vi.fn() })
    harness.handlers.onTap({ x: LANDMARKS.spring.x, y: 21 })
    expect(playSpringFound).not.toHaveBeenCalled()
    expect(harness.renderer.playSpringDiscovery).not.toHaveBeenCalled()
    session.destroy()
  })

  it('第二间住处提前建好时，小泉在发现泉水那一刻单独报“住下啦”', async () => {
    const raw = farmedSave()
    raw.world.exploration.springFound = false
    raw.world.farm.waterSupplied = false
    // 左翼已经和第一间连成一条真实通道，第二间住处提前留好了空床。
    for (const x of [15, 16]) for (const y of [10, 11]) raw.world.tiles[y][x] = TILE.EMPTY
    raw.world.pods[0].backWall = true
    raw.world.pods.push({ id: 2, x: 9, y: 10, door: 'left', backWall: true })
    harness.store.load.mockResolvedValue(raw)
    const onMilestone = vi.fn()
    const session = await createGameSession({} as HTMLElement, { onMessage: vi.fn(), onProgress: vi.fn(), onMilestone })
    harness.renderer.partnerAtScreen.mockReturnValue(null)
    const w = harness.renderer.setWorld.mock.calls[0][0] as WorldState
    expect(w.pods).toHaveLength(2)
    expect(w.workers.xiaoquan).toBeUndefined()
    harness.handlers.onTap({ x: LANDMARKS.spring.x, y: 21 })
    const arrive = () => (harness.renderer.playExplorationTravel.mock.calls.at(-1) as unknown as [Cell[], () => void])[1]()
    arrive()
    expect(w.exploration.springFound).toBe(true)
    expect(harness.renderer.playSpringDiscovery).toHaveBeenCalled()
    expect(harness.renderer.playPodCelebration).toHaveBeenCalled()
    expect(onMilestone).toHaveBeenCalledWith(expect.objectContaining({ title: '小泉住下啦！' }))
    expect(onMilestone).not.toHaveBeenCalledWith(expect.objectContaining({ title: '发现地下泉水！' }))
    session.destroy()
  })

  it('已建成的房间能直接进入扩建面板', async () => {
    const loaded = deserialize(readySave())
    expect(loaded.ok).toBe(true)
    if (!loaded.ok) return
    const w = loaded.world
    // 围住原来的床，并把房间接到大厅，得到一间真正建成的住处。
    for (const x of [12, 13, 14]) for (const y of [9, 10, 11]) w.tiles[y][x] = TILE.EMPTY
    for (const x of [15, 16]) for (const y of [10, 11]) w.tiles[y][x] = TILE.EMPTY
    const plan = planRoom(w, roomFromPoint({ x: 13, y: 11 }, 3, 'home'))!
    expect(finishRoom(w, plan.after!.id)).not.toBeNull()
    const room = w.rooms[0]
    harness.store.load.mockResolvedValue(serialize(w))
    const onRooms = vi.fn()
    const session = await createGameSession({} as HTMLElement, { onMessage: vi.fn(), onProgress: vi.fn(), onRooms })
    session.selectRoom(room.id)
    expect(onRooms.mock.calls.at(-1)![0]).toMatchObject({ active: true, selectedId: room.id, completed: true })
    session.destroy()
  })

  it('预设区域还没挖空时按普通地形处理，不提前打开建筑面板', async () => {
    const raw = readySave(); raw.world.pods = []
    harness.store.load.mockResolvedValue(raw)
    const onSites = vi.fn()
    const session = await createGameSession({} as HTMLElement, { onMessage: vi.fn(), onProgress: vi.fn(), onSites })
    const world = harness.renderer.setWorld.mock.calls[0][0] as WorldState, before = structuredClone(world)
    harness.handlers.onTap({ x: 13, y: 11 }); harness.handlers.onPanBy({ x: 40, y: 10 })
    expect(onSites.mock.calls.at(-1)![0]).toMatchObject({ active: false, selected: null, canBuild: false })
    expect(world).toEqual(before)
    session.cancelAction()
    expect((onSites.mock.calls.at(-1)![0] as SiteUI).active).toBe(false)
    expect(world).toEqual(before)
    session.destroy()
  })

  it('未挖空的预设区域悬停仍是挖掘，点击后可以继续拖图', async () => {
    const raw = readySave(); raw.world.pods = []
    harness.store.load.mockResolvedValue(raw)
    const onSites = vi.fn()
    const session = await createGameSession({} as HTMLElement, { onMessage: vi.fn(), onProgress: vi.fn(), onSites })
    const world = harness.renderer.setWorld.mock.calls[0][0] as WorldState
    const before = structuredClone(world)
    session.setBuildMode('none')
    harness.handlers.onHover({ x: 28, y: 10 })
    expect(harness.renderer.setHoverCell).toHaveBeenLastCalledWith({ x: 28, y: 10 })
    expect(harness.renderer.setCursor).toHaveBeenLastCalledWith('crosshair')
    harness.handlers.onTap({ x: 28, y: 10 })
    expect(onSites.mock.calls.at(-1)![0]).toMatchObject({ active: false, selected: null })
    expect(world).toEqual(before)
    expect(harness.renderer.playExplorationTravel).toHaveBeenCalled()
    harness.handlers.onPanBy({ x: 40, y: 10 })
    expect(harness.renderer.panBy).toHaveBeenLastCalledWith(40, 10)
    session.destroy()
  })

  it('背包打开时拦住地图点击拖图和Esc，关闭后仍可操作，收藏定位不改变世界', async () => {
    harness.store.load.mockResolvedValue(readySave())
    const onBagRequested = vi.fn(), onBag = vi.fn()
    const session = await createGameSession({} as HTMLElement, { onMessage: vi.fn(), onProgress: vi.fn(), onBagRequested, onBag })
    const world = harness.renderer.setWorld.mock.calls[0][0] as WorldState, before = structuredClone(world)
    expect(onBag.mock.calls.at(-1)![0]).toHaveLength(7)
    session.setInputBlocked(true)
    harness.handlers.onTap({ x: 18, y: 8 }); harness.handlers.onTap({ x: 26, y: 10 })
    const panCount = harness.renderer.panBy.mock.calls.length
    harness.handlers.onPanBy({ x: 40, y: 20 })
    const preventDefault = vi.fn()
    ;(harness.listeners.window.get('keydown') as unknown as (e: unknown) => void)({ key: 'Escape', preventDefault })
    expect(preventDefault).not.toHaveBeenCalled()
    expect(world).toEqual(before); expect(onBagRequested).not.toHaveBeenCalled()
    expect(harness.renderer.panBy.mock.calls.length).toBe(panCount)
    session.setInputBlocked(false)
    harness.handlers.onTap({ x: 18, y: 8 }); expect(onBagRequested).toHaveBeenCalledOnce()
    session.focusCollection(); session.focusRelic('seed-pouch')
    expect(harness.renderer.focusOn).toHaveBeenCalled()
    expect(world).toEqual(before)
    session.destroy()
  })

  it('直接点击已建成的住处会打开房间详情，而不是让阿土走动', async () => {
    harness.store.load.mockResolvedValue(readySave())
    const onRooms = vi.fn()
    const session = await createGameSession({} as HTMLElement, { onMessage: vi.fn(), onProgress: vi.fn(), onRooms })
    const world = harness.renderer.setWorld.mock.calls[0][0] as WorldState
    world.rooms.push({ id: 1, kind: 'home', x: 12, y: 9, w: 3, h: 3, managed: true })
    world.builtSites.push({ id: 'first-nest', kind: 'home' })
    harness.renderer.playExplorationTravel.mockClear()
    harness.handlers.onHover({ x: 13, y: 10 })
    expect(harness.renderer.setCursor).toHaveBeenLastCalledWith('pointer')
    harness.handlers.onTap({ x: 13, y: 10 })
    expect(onRooms.mock.calls.at(-1)![0]).toMatchObject({ active: true, selectedId: 1, completed: true })
    expect(harness.renderer.playExplorationTravel).not.toHaveBeenCalled()
    session.destroy()
  })

  it('未挖空时不会把预设区域误判成已建成设施', async () => {
    harness.store.load.mockResolvedValue(readySave())
    const onSites = vi.fn()
    const session = await createGameSession({} as HTMLElement, { onMessage: vi.fn(), onProgress: vi.fn(), onSites })
    const world = harness.renderer.setWorld.mock.calls[0][0] as WorldState, before = structuredClone(world)
    session.selectSite('first-nest'); session.buildSite(); session.closeRooms()
    expect(world).toEqual(before)
    expect(onSites.mock.calls.at(-1)![0]).toMatchObject({ active: false, built: false, canBuild: false })
    expect(deserialize(serialize(world)).ok).toBe(true)
    session.destroy()
  })

  it('空间挖空后蓝图才可开工，建成后撤销退回材料并保留洞室空间', async () => {
    const raw = readySave(); raw.world.pods = []
    harness.store.load.mockResolvedValue(raw)
    const onSites = vi.fn(), onNestWelcome = vi.fn()
    const session = await createGameSession({} as HTMLElement, { onMessage: vi.fn(), onProgress: vi.fn(), onSites, onNestWelcome })
    const world = harness.renderer.setWorld.mock.calls[0][0] as WorldState
    const site = siteById('first-nest')!
    for (let y = site.y; y < site.y + site.h; y++) for (let x = site.x; x < site.x + site.w; x++) world.tiles[y][x] = TILE.EMPTY
    const beforeTiles = structuredClone(world.tiles)
    session.openRooms()
    expect(onSites.mock.calls.at(-1)![0]).toMatchObject({ active: true, selected: null })
    session.selectSite('first-nest')
    expect(onSites.mock.calls.at(-1)![0]).toMatchObject({ active: true, selected: 'first-nest', canBuild: true })
    expect(world.tiles).toEqual(beforeTiles); expect(world.pods).toHaveLength(0)
    session.buildSite()
    expect(world.tiles).toEqual(beforeTiles); expect(world.pods).toHaveLength(0)
    expect(playBuildComplete).not.toHaveBeenCalled()
    const cancellations = harness.renderer.cancelExplorationAnimation.mock.calls.length
    harness.handlers.onTap({ x: 26, y: 11 })
    expect(onSites.mock.calls.at(-1)![0].working).toBe(true)
    expect(harness.renderer.cancelExplorationAnimation.mock.calls.length).toBe(cancellations)
    let seen = 0
    while (onSites.mock.calls.at(-1)![0].working && seen < 20) {
      const call = harness.renderer.playExplorationTravel.mock.calls.at(-1) as unknown as [Cell[], () => void]
      call[1](); seen++
    }
    expect(seen).toBeGreaterThan(0); expect(seen).toBeLessThan(20)
    expect(harness.renderer.playSoilWork).not.toHaveBeenCalled()
    expect(world.pods).toHaveLength(1); expect(world.pods[0].backWall).toBe(true)
    expect(onNestWelcome.mock.calls.at(-1)?.[0]).toMatchObject({ podId: world.pods[0].id })
    session.confirmNestMark('leaf'); expect(world.pods[0].mark).toBe('leaf')
    expect(onNestWelcome.mock.calls.at(-1)?.[0]).toBeNull()
    expect(world.rooms[0].status).toBeUndefined(); expect(world.builtSites).toEqual([{ id: 'first-nest', kind: 'home' }])
    expect(deserialize(serialize(world)).ok).toBe(true)
    harness.handlers.onTap({ x: 13, y: 10 })
    expect(onSites.mock.calls.at(-1)?.[0].active).toBe(false)
    session.openNestMark(world.pods[0].id)
    expect(onNestWelcome.mock.calls.at(-1)?.[0]).toMatchObject({ podId: world.pods[0].id, mark: 'leaf' })
    session.closeNestWelcome()
    expect(playBuildComplete).toHaveBeenCalledTimes(1)
    const materials = { ...world.inventory }
    session.undo(); expect(playUndo).toHaveBeenCalledTimes(1); expect(world.pods).toHaveLength(0); expect(world.rooms).toEqual([])
    expect(world.builtSites).toEqual([])
    expect(world.inventory).toEqual({ stone: materials.stone + 3, wood: materials.wood + 2 })
    expect(world.tiles[9][12]).toBe(TILE.EMPTY)
    session.destroy()
  })

  it('旧档未完成的蓝图仍可从兼容入口继续，不被预设覆盖', async () => {
    const loaded = deserialize(readySave()); expect(loaded.ok).toBe(true)
    if (!loaded.ok) return
    const change = planRoom(loaded.world, roomFromPoint({ x: 30, y: 11 }, 5, 'lounge'))!
    expect(change).not.toBeNull()
    harness.store.load.mockResolvedValue(serialize(loaded.world))
    const onRooms = vi.fn(), onSites = vi.fn()
    const session = await createGameSession({} as HTMLElement, { onMessage: vi.fn(), onProgress: vi.fn(), onRooms, onSites })
    session.openRooms(); session.selectRoom(change.after!.id)
    expect(onSites.mock.calls.at(-1)![0].active).toBe(false)
    expect(onRooms.mock.calls.at(-1)![0]).toMatchObject({ active: true, construction: true, selectedId: change.after!.id })
    session.destroy()
  })

  it('小泉实际接水后启用先前建好的干种植区，不重复工作或重置旧成果', async () => {
    const raw = farmedSave(); raw.world.farm.waterSupplied = false
    for (const x of [26, 27]) raw.world.tiles[10][x] = TILE.EMPTY
    const loaded = deserialize(raw); expect(loaded.ok).toBe(true)
    if (!loaded.ok) return
    const p = planRoom(loaded.world, roomFromPoint({ x: 8, y: 11 }, 5, 'garden'))!
    expect(finishRoom(loaded.world, p.after!.id)).not.toBeNull()
    harness.store.load.mockResolvedValue(serialize(loaded.world))
    const session = await createGameSession({} as HTMLElement, { onMessage: vi.fn(), onProgress: vi.fn() })
    const world = harness.renderer.setWorld.mock.calls[0][0] as WorldState
    expect(world.farm.planters).toHaveLength(0)
    session.supplyWater()
    expect(world.farm.waterSupplied).toBe(true); expect(world.farm.planters).toHaveLength(2)
    const farm = structuredClone(world.farm); session.supplyWater(); expect(world.farm).toEqual(farm)
    expect(deserialize(serialize(world)).ok).toBe(true)
    session.destroy()
  })

  it('损坏的房间存档提示原因，临时试玩和退出不覆盖失败数据', async () => {
    const raw = readySave()
    raw.world.rooms.push({ id: 1, kind: 'unknown' as 'home', x: 12, y: 10, w: 3, h: 2 }); raw.world.nextRoomId = 2
    harness.store.load.mockResolvedValue(raw)
    const onMessage = vi.fn()
    const session = await createGameSession({} as HTMLElement, { onMessage, onProgress: vi.fn() })
    await vi.advanceTimersByTimeAsync(400); session.destroy()
    expect(onMessage.mock.calls.some(([text]) => text.includes('房间') && text.includes('不覆盖原档'))).toBe(true)
    expect(harness.store.save).not.toHaveBeenCalled()
  })

  it('新开局阿土走到土旁才动手；取消后旧落爪与退出后的回调都无效', async () => {
    harness.store.load.mockResolvedValue(null)
    const session = await createGameSession({} as HTMLElement, { onMessage: vi.fn(), onProgress: vi.fn() })
    const world = harness.renderer.setWorld.mock.calls[0][0] as WorldState
    let strike = () => {}, done = () => {}
    harness.renderer.playSoilWork.mockImplementationOnce((_plan, hit, finish) => { strike = hit; done = finish })
    harness.handlers.onTap({ x: 14, y: 9 })
    expect(world.tiles[9][14]).toBe(TILE.SOIL)
    const [, arrive] = harness.renderer.playExplorationTravel.mock.calls.at(-1) as unknown as [Cell[], () => void]
    arrive()
    expect(world.exploration.explorer).toEqual({ x: 15, y: 11 })
    expect(harness.renderer.playSoilWork.mock.calls.at(-1)![0].lift).toBe(1)
    session.cancelAction(); strike(); done()
    expect(world.tiles[9][14]).toBe(TILE.SOIL)
    session.destroy(); arrive(); strike()
    expect(world.dugCount).toBe(0)
    expect(playSoilDig).not.toHaveBeenCalled()
  })

  it('普通泥土只在真实落爪时发声一次；走路、重复回调、拖图不发挖掘音', async () => {
    harness.store.load.mockResolvedValue(null)
    const session = await createGameSession({} as HTMLElement, { onMessage: vi.fn(), onProgress: vi.fn() })
    let strike = () => {}, finish = () => {}
    harness.renderer.playSoilWork.mockImplementationOnce((_plan, hit, done) => { strike = hit; finish = done })
    harness.handlers.onPanBy({ x: 30, y: 10 })
    harness.handlers.onTap({ x: 14, y: 9 })
    expect(playSoilDig).not.toHaveBeenCalled()
    const [, arrive] = harness.renderer.playExplorationTravel.mock.calls.at(-1) as unknown as [Cell[], () => void]
    arrive(); expect(playSoilDig).not.toHaveBeenCalled()
    strike(); strike(); finish()
    expect(playSoilDig).toHaveBeenCalledTimes(1)
    session.destroy()
  })

  it('能源石已经收集后，附近空地仍可让阿土走过去', async () => {
    harness.store.load.mockResolvedValue(readySave())
    const session = await createGameSession({} as HTMLElement, { onMessage: vi.fn(), onProgress: vi.fn() })
    harness.handlers.onTap({ x: 15, y: 11 })
    const [route, arrive] = harness.renderer.playExplorationTravel.mock.calls.at(-1) as unknown as [Cell[], () => void]
    expect(route.at(-1)).toEqual({ x: 15, y: 11 }); arrive()
    expect((harness.renderer.setWorld.mock.calls[0][0] as WorldState).exploration.explorer).toEqual({ x: 15, y: 11 })
    session.destroy()
  })

  it('建床先让阿土退开；让位途中取消，旧抵达回调不得继续建造', async () => {
    const saved = readySave()
    for (const y of [10, 11]) saved.world.tiles[y][28] = TILE.EMPTY
    saved.world.exploration.explorer = { x: 27, y: 11 }
    harness.store.load.mockResolvedValue(saved)
    const onBuild = vi.fn()
    const session = await createGameSession({} as HTMLElement, { onMessage: vi.fn(), onProgress: vi.fn(), onBuild })
    const world = harness.renderer.setWorld.mock.calls[0][0] as WorldState
    session.setBuildMode('pod'); harness.handlers.onTap({ x: 27, y: 11 }); session.confirmBuild()
    const [, arrive] = harness.renderer.playExplorationTravel.mock.calls.at(-1) as unknown as [Cell[], () => void]
    expect(world.pods).toHaveLength(1)
    session.cancelAction(); arrive()
    expect(world.pods).toHaveLength(1)
    expect(onBuild.mock.calls.at(-1)![0].mode).toBe('none')
    expect(deserialize(serialize(world)).ok).toBe(true)
    session.destroy()
  })

  it('撤销头顶刚挖的土前，阿土先沿真实通道退到安全格', async () => {
    harness.store.load.mockResolvedValue(null)
    const session = await createGameSession({} as HTMLElement, { onMessage: vi.fn(), onProgress: vi.fn() })
    const world = harness.renderer.setWorld.mock.calls[0][0] as WorldState
    const arrive = () => (harness.renderer.playExplorationTravel.mock.calls.at(-1) as unknown as [Cell[], () => void])[1]()
    tapAndFinishSoil(14, 11); tapAndFinishSoil(14, 10)
    harness.handlers.onTap({ x: 14, y: 11 }); arrive()
    expect(world.exploration.explorer).toEqual({ x: 14, y: 11 })
    session.undo()
    expect(world.tiles[10][14]).toBe(TILE.EMPTY)
    arrive()
    expect(world.tiles[10][14]).toBe(TILE.SOIL)
    expect(world.exploration.explorer).toEqual({ x: 15, y: 11 })
    expect(deserialize(serialize(world)).ok).toBe(true)
    session.destroy()
  })

  it('点伙伴只交流；拖动关闭对话，随后仍能自由挖土', async () => {
    harness.store.load.mockResolvedValue(readySave())
    const onPartner = vi.fn()
    const session = await createGameSession({} as HTMLElement, { onMessage: vi.fn(), onProgress: vi.fn(), onPartnerConversation: onPartner })
    const world = harness.renderer.setWorld.mock.calls[0][0] as WorldState
    const before = structuredClone(world)
    harness.renderer.partnerAtScreen.mockReturnValueOnce('atu')
    harness.handlers.onTap({ x: 18, y: 11 })
    expect((onPartner.mock.calls.at(-1)![0] as PartnerConversation).partnerId).toBe('atu')
    expect(world).toEqual(before)
    harness.handlers.onPanBy({ x: 30, y: 0 })
    expect(onPartner).toHaveBeenLastCalledWith(null)
    session.setBuildMode('none')
    tapAndFinishSoil(26, 9)
    expect(world.tiles[9][26]).toBe(TILE.EMPTY)
    expect(world.dugCount).toBe(before.dugCount + 1)
    session.destroy()
  })

  it('角色点击容错不抢走实心泥土，也不抢走建造选址', async () => {
    const raw = readySave(); raw.world.pods = []
    harness.store.load.mockResolvedValue(raw)
    const onPartner = vi.fn(), onBuild = vi.fn()
    const session = await createGameSession({} as HTMLElement, { onMessage: vi.fn(), onProgress: vi.fn(), onBuild, onPartnerConversation: onPartner })
    const world = harness.renderer.setWorld.mock.calls[0][0] as WorldState
    harness.renderer.partnerAtScreen.mockReturnValue('atu')
    session.setBuildMode('none')
    tapAndFinishSoil(26, 9)
    expect(world.tiles[9][26]).toBe(TILE.EMPTY)
    expect(harness.renderer.partnerAtScreen).not.toHaveBeenCalled()
    session.setBuildMode('pod')
    harness.handlers.onTap({ x: 18, y: 11 })
    expect(onBuild.mock.calls.at(-1)![0].selected).toBe(true)
    expect(harness.renderer.partnerAtScreen).not.toHaveBeenCalled()
    expect(onPartner).toHaveBeenLastCalledWith(null)
    session.destroy()
  })

  it('从阿土对话升级后更新装备、保存原字段；不会自动挖岩石', async () => {
    harness.store.load.mockResolvedValue(clueSave())
    const onPartner = vi.fn()
    const session = await createGameSession({} as HTMLElement, { onMessage: vi.fn(), onProgress: vi.fn(), onPartnerConversation: onPartner })
    const world = harness.renderer.setWorld.mock.calls[0][0] as WorldState
    session.talkToPartner('atu')
    expect(onPartner.mock.calls.at(-1)![0].upgrade.state).toBe('ready')
    const before = structuredClone(world)
    session.partnerAction()
    expect(world).toEqual({ ...before, exploration: { ...before.exploration, pickaxeUpgraded: true } })
    expect(onPartner.mock.calls.at(-1)![0].upgrade.state).toBe('equipped')
    expect(harness.renderer.playRockBreak).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1000)
    expect(harness.store.save).toHaveBeenCalledTimes(1)
    session.partnerAction()
    expect(harness.store.save).toHaveBeenCalledTimes(1)
    expect(onPartner).toHaveBeenLastCalledWith(null)
    session.destroy()
  })

  it('阿土站在裂纹上方时，点击实心岩块仍然发起施工', async () => {
    harness.store.load.mockResolvedValue(clueSave(true))
    const onPartner = vi.fn()
    const session = await createGameSession({} as HTMLElement, { onMessage: vi.fn(), onProgress: vi.fn(), onPartnerConversation: onPartner })
    harness.renderer.partnerAtScreen.mockReturnValue('atu')
    harness.handlers.onTap({ x: 27, y: 12 })
    expect(harness.renderer.partnerAtScreen).not.toHaveBeenCalled()
    expect(harness.renderer.playExplorationTravel).toHaveBeenCalledTimes(1)
    expect(onPartner).toHaveBeenLastCalledWith(null)
    session.destroy()
  })

  it('旧档的已升级铁镐直接显示已装备，未知伙伴不会回退为阿土', async () => {
    harness.store.load.mockResolvedValue(clueSave(true))
    const onPartner = vi.fn()
    const session = await createGameSession({} as HTMLElement, { onMessage: vi.fn(), onProgress: vi.fn(), onPartnerConversation: onPartner })
    const world = harness.renderer.setWorld.mock.calls[0][0] as WorldState
    session.talkToPartner('unknown')
    expect(onPartner.mock.calls.at(-1)?.[0] ?? null).toBeNull()
    session.talkToPartner('atu')
    expect(onPartner.mock.calls.at(-1)![0].upgrade.state).toBe('equipped')
    const before = structuredClone(world)
    session.partnerAction()
    expect(world).toEqual(before)
    expect(harness.store.save).not.toHaveBeenCalled()
    session.destroy()
  })

  /** 建好家园、听水声、换上小铁镐，停在"可以开始破岩"的那一步 */
  async function startExploring(message = vi.fn(), onMilestone = vi.fn(), extra: Omit<SessionHooks, 'onMessage' | 'onProgress'> = {}) {
    harness.store.load.mockResolvedValue(readySave())
    const session = await createGameSession({} as HTMLElement, { onMessage: message, onProgress: vi.fn(), onMilestone, ...extra })
    const w = harness.renderer.setWorld.mock.calls[0][0] as WorldState
    const tap = tapAndFinishSoil
    const arrive = () => (harness.renderer.playExplorationTravel.mock.calls.at(-1) as unknown as [Cell[], () => void])[1]()
    /** 把当前这一段走路演出推到位；委托已经取消时再调用是空操作 */
    const advance = (times = 1) => { for (let i = 0; i < times; i++) arrive() }
    tap(26, 11); tap(27, 11)
    tap(LISTEN.x, LISTEN.y)
    arrive()
    session.upgradeTool()
    harness.renderer.cancelExplorationAnimation.mockClear()
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
    const tap = tapAndFinishSoil
    const lastTravel = () => harness.renderer.playExplorationTravel.mock.calls.at(-1) as unknown as [Cell[], () => void]
    const arrive = () => lastTravel()[1]()
    tap(26, 11); tap(27, 11)
    expect(w.exploration.explorer).toEqual({ x: 18, y: 11 })
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

  it('普通泥土走近才挖，空地可移动，泉水必须抵达才发现', async () => {
    harness.store.load.mockResolvedValue(readySave())
    const session = await createGameSession({} as HTMLElement, { onMessage: vi.fn(), onProgress: vi.fn() })
    const w = harness.renderer.setWorld.mock.calls[0][0] as WorldState
    const tap = tapAndFinishSoil
    const arrive = () => (harness.renderer.playExplorationTravel.mock.calls.at(-1) as unknown as [Cell[], () => void])[1]()
    tap(26, 11); tap(27, 11); tap(27, 12); arrive()
    session.upgradeTool()
    tap(27, 12); arrive(); tap(27, 13); arrive(); tap(27, 14)
    for (let i = 0; i < 8 && !shaftConnected(w); i++) arrive()
    expect(shaftConnected(w)).toBe(true)
    session.travel(); arrive()
    expect(w.exploration.entered).toBe(true)
    // 每列先清底部再清身体净空，走近施工才挖开。
    const travelsBeforeDig = harness.renderer.playExplorationTravel.mock.calls.length
    session.closePartnerConversation() // 先结束首次相遇，再开始挖掘。
    for (let x = 23; x >= 18; x--) { tap(x, 21); tap(x, 20) }
    expect(w.tiles[21][23]).toBe(TILE.EMPTY)
    expect(harness.renderer.playExplorationTravel.mock.calls.length).toBeGreaterThan(travelsBeforeDig)
    expect(w.exploration.springFound).toBe(false)
    // 空地可移动，不会提前发现泉水；新目标可替换尚未完成的移动。
    tap(26, 21); tap(25, 20)
    expect(w.exploration.explorer).toEqual({ x: 19, y: 21 })
    // 点露面的泉水：阿土自己沿地面走到水边才算发现
    tap(18, 21)
    expect(w.exploration.springFound).toBe(false)
    const [route] = harness.renderer.playExplorationTravel.mock.calls.at(-1) as unknown as [Cell[], () => void]
    expect(route[0]).toEqual({ x: 19, y: 21 })
    expect(route.at(-1)).toEqual({ x: 18, y: 21 })
    arrive()
    expect(w.exploration.springFound).toBe(true)
    expect(w.exploration.explorer).toEqual({ x: 18, y: 21 })
    session.destroy()
  })

  it('揭开泉水后还要亲自走到那里；完成后才能安壁灯，撤销能移除壁灯', async () => {
    const onMilestone = vi.fn()
    harness.store.load.mockResolvedValue(readySave())
    const progress = vi.fn(), onPartner = vi.fn()
    const session = await createGameSession({} as HTMLElement, { onMessage: vi.fn(), onProgress: progress, onMilestone, onPartnerConversation: onPartner })
    const w = harness.renderer.setWorld.mock.calls[0][0] as WorldState
    const tap = tapAndFinishSoil
    const arrive = () => (harness.renderer.playExplorationTravel.mock.calls.at(-1) as unknown as [Cell[], () => void])[1]()
    tap(26, 11); tap(27, 11); tap(27, 12); arrive(); session.upgradeTool()
    tap(27, 12); arrive(); tap(27, 13); arrive(); tap(27, 14)
    for (let i = 0; i < 8 && !shaftConnected(w); i++) arrive()
    session.travel(); arrive()
    expect(w.exploration.entered).toBe(true)
    // 抵达第二层：里程碑卡片 + 阿土的反应各来一次
    expect(onMilestone).toHaveBeenCalledWith(expect.objectContaining({ title: '抵达第 2 层 · 泉水层' }))
    session.closePartnerConversation() // 先结束首次相遇，再开始挖掘。
    for (let x = 23; x >= 18; x--) { tap(x, 21); tap(x, 20) }
    expect(w.exploration.springFound).toBe(false)
    tap(18, 21)
    expect(w.exploration.springFound).toBe(false)
    arrive()
    expect(w.exploration.springFound).toBe(true)
    expect(harness.renderer.playSpringDiscovery).toHaveBeenCalledTimes(1)
    expect(onMilestone).toHaveBeenCalledWith(expect.objectContaining({ title: '发现地下泉水！' }))
    // 小泉从水里出来时自动开口，说明自己能引水、也想住下来
    const xiaoquan = onPartner.mock.calls.at(-1)![0] as PartnerConversation
    expect(xiaoquan.partnerId).toBe('xiaoquan')
    expect(xiaoquan.lines.join(' ')).toContain('留个住处')
    // 找到水之后还没走完：要先把水接到菜园，再安顿新朋友、种出第一份收成
    expect(progress.mock.calls.at(-1)![0]).toMatchObject({ title: '把水接到菜园', done: 5, total: 12, finished: false })
    session.toggleLamp(); tap(25, 19)
    expect(w.exploration.lamps).toEqual([{ x: 25, y: 19 }])
    session.undo()
    expect(w.exploration.lamps).toEqual([])
    session.destroy()
  })

  it('引水 → 种菜 → 干活长大 → 收菜 → 请伙伴吃饭，整条链路走通', async () => {
    const onMilestone = vi.fn()
    const onFarm = vi.fn()
    const message = vi.fn()
    harness.store.load.mockResolvedValue(readySave())
    const session = await createGameSession({} as HTMLElement, { onMessage: message, onProgress: vi.fn(), onMilestone, onFarm })
    const w = harness.renderer.setWorld.mock.calls[0][0] as WorldState
    const tap = tapAndFinishSoil
    const arrive = () => (harness.renderer.playExplorationTravel.mock.calls.at(-1) as unknown as [Cell[], () => void])[1]()
    /** 提示是否说过这句话（onMessage 带第二个参数，所以只比第一句） */
    const said = (fragment: string) => message.mock.calls.some(([text]) => String(text).includes(fragment))
    tap(26, 11); tap(27, 11); tap(27, 12); arrive(); session.upgradeTool()
    tap(27, 12); arrive(); tap(27, 13); arrive(); tap(27, 14)
    for (let i = 0; i < 8 && !shaftConnected(w); i++) arrive()
    session.travel(); arrive()
    session.closePartnerConversation() // 先结束首次相遇，再开始挖掘。
    for (let x = 23; x >= 18; x--) { tap(x, 21); tap(x, 20) }
    tap(18, 21); arrive()
    expect(w.exploration.springFound).toBe(true)
    expect(onFarm).toHaveBeenLastCalledWith(expect.objectContaining({ canSupplyWater: true, unlocked: false }))

    // 引水：小泉到泉边动手接管，阿土的位置不改变。
    const atuBefore = { ...w.exploration.explorer! }
    let connect = () => {}, finish = () => {}
    harness.renderer.playPartnerWork.mockImplementationOnce((_plan, hit, done) => { connect = hit; finish = done })
    session.supplyWater()
    expect(w.farm.waterSupplied).toBe(false)
    connect(); finish()
    expect(w.farm.waterSupplied).toBe(true)
    expect(w.exploration.explorer).toEqual(atuBefore)
    expect(harness.renderer.refreshFarm).toHaveBeenCalled()
    expect(harness.renderer.playSupplyWater).toHaveBeenCalledTimes(1)
    expect(onMilestone).toHaveBeenCalledWith(expect.objectContaining({ title: '水到菜园啦！' }))
    expect(onFarm).toHaveBeenLastCalledWith(expect.objectContaining({ unlocked: true, canSupplyWater: false }))

    // 新菜槽只在第二层建造；自由摆放仍可用，材料会扣除。
    session.setBuildMode('planter')
    tap(25, 21)
    session.confirmBuild()
    expect(w.farm.planters).toHaveLength(1)
    expect(said('种下一槽菜')).toBe(true)

    // 探索上方三格软土，作物随真实劳动生长。
    session.setBuildMode('none')
    tap(23, 19); tap(22, 19); tap(21, 19)
    expect(w.farm.planters[0].growth).toBe(3)
    expect(said('长熟啦')).toBe(true)
    tap(25, 21)
    expect(w.farm.food).toBe(1)
    expect(w.farm.harvests).toBe(1)
    expect(w.farm.planters[0].growth).toBe(0)
    expect(harness.renderer.playHarvest).toHaveBeenCalledTimes(1)
    expect(onMilestone).toHaveBeenCalledWith(expect.objectContaining({ title: '第一份收成！' }))
    tap(25, 21)
    expect(w.farm.food).toBe(1)

    // 开饭：伙伴吃一份
    expect(w.pods.length).toBeGreaterThan(0)
    session.feed()
    expect(w.farm.food).toBe(0)
    expect(harness.renderer.playMealCelebration).toHaveBeenCalledTimes(1)
    session.destroy()
  })

  it('建成灶台和餐桌后，实体共餐与旧入口共用结算，演出期间重复点击不再扣食物', async () => {
    const onFarm = vi.fn(), onMessage = vi.fn(), onMilestone = vi.fn()
    harness.store.load.mockResolvedValue(sharedMealSave())
    const session = await createGameSession({} as HTMLElement, { onMessage, onProgress: vi.fn(), onFarm, onMilestone })
    const w = harness.renderer.setWorld.mock.calls[0][0] as WorldState
    expect(onFarm.mock.calls.at(-1)![0]).toMatchObject({ kitchen: true, dining: true, mealReady: true, mealActive: false })
    const pods = w.pods.length, built = w.builtSites.length

    session.feed()
    expect(w.farm.food).toBe(2)
    expect(w.farm.sharedMeals).toBe(1)
    expect(harness.renderer.playKitchenCooking).toHaveBeenCalledTimes(1)
    expect(harness.renderer.playMealGather).toHaveBeenCalledTimes(1)
    expect(harness.renderer.playMealCelebration).toHaveBeenCalledTimes(1)
    // 第一次围坐 = 第二层章末：完成卡片 + 回望镜头各一次。
    expect(onMilestone).toHaveBeenCalledWith(expect.objectContaining({ title: '第 2 层 · 完成啦！' }))
    expect(harness.renderer.playChapterGlance).toHaveBeenCalledTimes(1)
    expect(onFarm.mock.calls.at(-1)![0]).toMatchObject({ mealActive: true })
    session.feed(); session.feed()
    expect(w.farm.food).toBe(2)

    vi.advanceTimersByTime(3000)
    expect(onFarm.mock.calls.at(-1)![0]).toMatchObject({ mealActive: false })
    expect(harness.renderer.finishMealGather).toHaveBeenCalled()

    session.feed()
    expect(w.farm.food).toBe(1)
    expect(w.farm.sharedMeals).toBe(2)
    expect(harness.renderer.playMealGather).toHaveBeenCalledTimes(2)
    // 之后的共餐不再重复章末卡片与回望。
    expect(harness.renderer.playChapterGlance).toHaveBeenCalledTimes(1)
    expect(onMilestone.mock.calls.filter(call => (call[0] as { title?: string }).title === '第 2 层 · 完成啦！')).toHaveLength(1)
    expect(w.builtSites).toHaveLength(built)
    expect(w.pods).toHaveLength(pods)
    expect(deserialize(serialize(w)).ok).toBe(true)
    session.destroy()
  })

  it('点已建好的菜园打开设施面板：状态与主操作和直点共用同一条路', async () => {
    const onFacility = vi.fn()
    harness.store.load.mockResolvedValue(gardenSave())
    const session = await createGameSession({} as HTMLElement, { onMessage: vi.fn(), onProgress: vi.fn(), onFacility })
    const w = harness.renderer.setWorld.mock.calls[0][0] as WorldState

    harness.handlers.onTap({ x: 29, y: 20 })
    const opened = onFacility.mock.calls.at(-1)![0]
    expect(opened).toMatchObject({ active: true, id: 'spring-garden', title: '泉边小菜园' })
    expect(opened.slots).toHaveLength(2)
    expect(opened.summary).toContain('熟了 1 槽')
    expect(opened.primary).toMatchObject({ kind: 'harvest', x: 30, y: 21 })

    // 面板主操作 = 小满收菜工作；开始时面板让位给工作状态，完成后食物 +1。
    session.facilityPrimary()
    expect(w.farm.food).toBe(1)
    expect(harness.renderer.playPartnerWork).toHaveBeenCalledTimes(1)
    expect(onFacility.mock.calls.at(-1)![0].active).toBe(false)
    // 再点同一处洞室重新打开；点别处的空地则收起面板。
    harness.handlers.onTap({ x: 29, y: 20 })
    expect(onFacility.mock.calls.at(-1)![0].active).toBe(true)
    harness.handlers.onTap({ x: 24, y: 21 })
    expect(onFacility.mock.calls.at(-1)![0].active).toBe(false)
    session.destroy()
  })

  it('点没熟的菜直接请小满浇水：未熟的各长一档，熟透的不再长', async () => {
    const onMessage = vi.fn()
    harness.store.load.mockResolvedValue(gardenSave())
    const session = await createGameSession({} as HTMLElement, { onMessage, onProgress: vi.fn() })
    const w = harness.renderer.setWorld.mock.calls[0][0] as WorldState

    harness.handlers.onTap({ x: 28, y: 21 })
    expect(harness.renderer.playPartnerWork).toHaveBeenCalledTimes(1)
    expect(w.farm.planters.find((p) => p.x === 28)!.growth).toBe(1)
    expect(w.farm.planters.find((p) => p.x === 30)!.growth).toBe(3)
    expect(w.farm.food).toBe(0)
    expect(onMessage.mock.calls.some(([text]) => String(text).includes('浇了水'))).toBe(true)
    // 第一趟浇完（测试里同步完成），再点一次会再派一趟：仍是同一条工作路径。
    harness.handlers.onTap({ x: 28, y: 21 })
    expect(harness.renderer.playPartnerWork).toHaveBeenCalledTimes(2)
    expect(w.farm.planters.find((p) => p.x === 28)!.growth).toBe(2)
    session.destroy()
  })

  it('灶台与餐桌面板的开饭和其他入口共用 serveMeal，同一次只扣一份', async () => {
    const onFacility = vi.fn()
    harness.store.load.mockResolvedValue(sharedMealSave())
    const session = await createGameSession({} as HTMLElement, { onMessage: vi.fn(), onProgress: vi.fn(), onFacility })
    const w = harness.renderer.setWorld.mock.calls[0][0] as WorldState

    harness.handlers.onTap({ x: 11, y: 20 })
    expect(onFacility.mock.calls.at(-1)![0]).toMatchObject({ active: true, id: 'spring-kitchen', primary: { kind: 'meal', label: '做饭，请大家吃' } })
    session.facilityPrimary()
    expect(w.farm.food).toBe(2)
    expect(w.farm.sharedMeals).toBe(1)
    expect(harness.renderer.playKitchenCooking).toHaveBeenCalledTimes(1)

    vi.advanceTimersByTime(3000)
    harness.handlers.onTap({ x: 14, y: 20 })
    const dining = onFacility.mock.calls.at(-1)![0]
    expect(dining).toMatchObject({ id: 'spring-table' })
    expect(dining.summary).toContain('吃过 1 顿饭')
    session.closeFacility()
    session.destroy()
  })

  it('储物架：第一层摆放、扣料可撤销，点架子打开面板找旧物', async () => {
    const onFacility = vi.fn(), onBuild = vi.fn(), onMessage = vi.fn()
    harness.store.load.mockResolvedValue(readySave())
    const session = await createGameSession({} as HTMLElement, { onMessage, onProgress: vi.fn(), onFacility, onBuild })
    const w = harness.renderer.setWorld.mock.calls[0][0] as WorldState

    const before = { ...w.inventory }
    session.setBuildMode('shelf')
    harness.handlers.onTap({ x: 24, y: 11 })
    session.confirmBuild()
    expect(w.shelves).toEqual([{ id: 1, x: 24, y: 11 }])
    expect(w.inventory).toEqual({ stone: before.stone - 1, wood: before.wood - 2 })
    expect(harness.renderer.refreshShelves).toHaveBeenCalledTimes(1)
    // 收起摆放模式后撤销：架子拆掉、材料退回。
    session.setBuildMode('none')
    session.undo()
    expect(w.shelves).toHaveLength(0)
    expect(w.inventory).toEqual(before)
    // 再摆一次并点它：面板主操作是「找找没挖到的旧物」。
    session.setBuildMode('shelf')
    harness.handlers.onTap({ x: 24, y: 11 })
    session.confirmBuild()
    session.setBuildMode('none')
    harness.handlers.onTap({ x: 24, y: 11 })
    expect(onFacility.mock.calls.at(-1)![0]).toMatchObject({ active: true, id: 'storage-shelf', primary: { kind: 'find-relic' } })
    session.facilityPrimary()
    expect(harness.renderer.focusOn).toHaveBeenCalled()
    expect(onMessage.mock.calls.some(([text]) => String(text).includes('旧物'))).toBe(true)
    session.destroy()
  })

  it('育苗架：菜园面板升级入口搭起后能种番茄；点蘑菇是一次发现', async () => {
    const onFacility = vi.fn(), onMilestone = vi.fn(), onMessage = vi.fn()
    harness.store.load.mockResolvedValue(gardenSave())
    const session = await createGameSession({} as HTMLElement, { onMessage, onProgress: vi.fn(), onFacility, onMilestone })
    const w = harness.renderer.setWorld.mock.calls[0][0] as WorldState
    const before = { ...w.inventory }

    // 菜园面板里出现升级入口「搭育苗架」，点击进入摆放。
    harness.handlers.onTap({ x: 29, y: 20 })
    const garden = onFacility.mock.calls.at(-1)![0]
    expect(garden.upgrade).toMatchObject({ kind: 'build-nursery' })
    session.facilityUpgrade()
    harness.handlers.onTap({ x: 25, y: 21 })
    session.confirmBuild()
    expect(w.nurseries).toEqual([{ id: 1, x: 25, y: 21 }])
    expect(w.inventory).toEqual({ ...before, stone: before.stone - 2, wood: before.wood - 2 })
    // 升级后的新做法：摆一槽番茄，照料与结算和蔬菜同一条路。
    session.startTomatoPlanting()
    harness.handlers.onTap({ x: 29, y: 21 })
    session.confirmBuild()
    expect(w.farm.planters.some(p => p.crop === 'tomato')).toBe(true)
    expect(onMessage.mock.calls.some(([text]) => String(text).includes('番茄'))).toBe(true)
    session.setBuildMode('none')
    // 番茄还在：育苗架不可撤销。
    session.undo()
    expect(w.nurseries).toHaveLength(1)
    // 点育苗架本体：面板主操作是「摆一槽番茄」。
    harness.handlers.onTap({ x: 25, y: 21 })
    expect(onFacility.mock.calls.at(-1)![0]).toMatchObject({ id: 'nursery', primary: { kind: 'plant-tomato' } })
    // 点泉水边的发光蘑菇：第一次是发现，再点不重复。
    harness.handlers.onTap({ x: 20, y: 21 })
    expect(w.exploration.foundMushroom).toBe(true)
    expect(onMilestone).toHaveBeenCalledWith(expect.objectContaining({ title: '发现发光蘑菇！' }))
    expect(onMessage.mock.calls.at(-1)![0]).toContain('空出的地方')
    const bursts = harness.renderer.playBurst.mock.calls.length
    harness.handlers.onTap({ x: 20, y: 21 })
    harness.handlers.onTap({ x: 26, y: 21 })
    expect(harness.renderer.playBurst).toHaveBeenCalledTimes(bursts)
    expect(onMilestone.mock.calls.filter(call => (call[0] as { title?: string }).title === '发现发光蘑菇！')).toHaveLength(1)
    session.destroy()
  })

  it('没有灶台和餐桌的旧存档仍能用原来的吃饭入口，不播放围坐', async () => {
    const raw = farmedSave()
    raw.world.farm.food = 2
    harness.store.load.mockResolvedValue(raw)
    const session = await createGameSession({} as HTMLElement, { onMessage: vi.fn(), onProgress: vi.fn() })
    const w = harness.renderer.setWorld.mock.calls[0][0] as WorldState
    expect(w.builtSites).toEqual([])
    session.feed()
    expect(w.farm.food).toBe(1)
    expect(harness.renderer.playMealGather).not.toHaveBeenCalled()
    expect(harness.renderer.playMealCelebration).toHaveBeenCalledTimes(1)
    session.feed()
    expect(w.farm.food).toBe(1)
    session.destroy()
  })

  it('没有食物时不能开始共餐，也不会播放庆祝', async () => {
    const onMessage = vi.fn()
    harness.store.load.mockResolvedValue(farmedSave())
    const session = await createGameSession({} as HTMLElement, { onMessage, onProgress: vi.fn() })
    const w = harness.renderer.setWorld.mock.calls[0][0] as WorldState
    session.feed()
    expect(w.farm.food).toBe(0)
    expect(harness.renderer.playMealCelebration).not.toHaveBeenCalled()
    expect(onMessage.mock.calls.some(([text]) => String(text).includes('先收点菜'))).toBe(true)
    session.destroy()
  })

  it('从泉边建设面板可以开工灶台和餐桌，完工才扣材料', async () => {
    const raw = farmedSave()
    raw.world.tiles[10][26] = TILE.EMPTY
    raw.world.tiles[10][27] = TILE.EMPTY
    raw.world.farm.food = 1
    raw.world.inventory = { stone: 8, wood: 8 }
    harness.store.load.mockResolvedValue(raw)
    const messages: string[] = []
    const session = await createGameSession({} as HTMLElement, { onMessage: (text) => { messages.push(text) }, onProgress: vi.fn() })
    const w = harness.renderer.setWorld.mock.calls[0][0] as WorldState
    /** 施工仍是真实逐格委托：测试里替玩家把每一段走位播完。 */
    const finishSiteWork = () => {
      for (let handled = 0, guard = 0; guard < 40; guard++) {
        const calls = harness.renderer.playExplorationTravel.mock.calls
        if (calls.length === handled) break
        const travel = calls[handled++] as unknown as [Cell[], () => void]
        travel[1]()
      }
    }
    const clearPreset = (id: string) => {
      const site = siteById(id)!
      for (const cell of siteWorkCells(w, site)) w.tiles[cell.y][cell.x] = TILE.EMPTY
    }
    clearPreset('spring-kitchen')
    const kitchenInventory = { ...w.inventory }
    session.selectSite('spring-kitchen')
    expect(w.inventory).toEqual({ stone: 8, wood: 8 })
    session.buildSite()
    finishSiteWork()
    expect(w.builtSites).toContainEqual({ id: 'spring-kitchen', kind: 'kitchen' })
    expect(w.inventory).toEqual({ stone: kitchenInventory.stone - 2, wood: kitchenInventory.wood - 2 })
    session.buildSite()
    expect(w.builtSites.filter((site) => site.id === 'spring-kitchen')).toHaveLength(1)

    clearPreset('spring-table')
    const tableInventory = { ...w.inventory }
    session.selectSite('spring-table')
    session.buildSite()
    finishSiteWork()
    expect(w.builtSites).toContainEqual({ id: 'spring-table', kind: 'dining' })
    expect(w.inventory).toEqual({ stone: tableInventory.stone - 2, wood: tableInventory.wood - 3 })
    expect(deserialize(serialize(w)).ok).toBe(true)
    session.destroy()
  })

  it('第二层菜园：引导打开预设洞室，也可以切到自由摆放菜槽', async () => {
    harness.store.load.mockResolvedValue(farmedSave())
    const onBuild = vi.fn(), onFarm = vi.fn(), onMessage = vi.fn()
    const session = await createGameSession({} as HTMLElement, { onMessage, onProgress: vi.fn(), onBuild, onFarm })
    const w = harness.renderer.setWorld.mock.calls[0][0] as WorldState
    expect(w.farm.waterSupplied).toBe(true)

    session.startPlanting()
    expect(harness.renderer.focusWater).toHaveBeenCalled()
    expect(onBuild.mock.calls.at(-1)![0]).toMatchObject({ mode: 'none', planterAvailable: true })
    session.setBuildMode('planter')

    harness.handlers.onTap({ x: 25, y: 21 })
    expect(onBuild.mock.calls.at(-1)![0]).toMatchObject({ mode: 'planter', selected: true, valid: true })
    session.confirmBuild()
    expect(w.farm.planters).toHaveLength(1)
    expect(w.farm.planters[0]).toMatchObject({ x: 25, y: 21 })
    expect(onFarm.mock.calls.at(-1)![0]).toMatchObject({ planterCount: 1 })
    expect(onMessage.mock.calls.some(([text]) => String(text).includes('菜园'))).toBe(true)
    session.destroy()
  })

  it('种植槽可以撤销；撤销之后那一格恢复成空地', async () => {
    harness.store.load.mockResolvedValue(farmedSave())
    const session = await createGameSession({} as HTMLElement, { onMessage: vi.fn(), onProgress: vi.fn() })
    const w = harness.renderer.setWorld.mock.calls[0][0] as WorldState
    const tap = tapAndFinishSoil
    session.setBuildMode('planter')
    tap(25, 21)
    session.confirmBuild()
    expect(w.farm.planters).toHaveLength(1)
    session.undo()
    expect(w.farm.planters).toEqual([])
    expect(harness.renderer.refreshFarm).toHaveBeenCalled()
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

  it('当前试玩默认从头开始，不打开IndexedDB、不读取旧进度、不写存档', async () => {
    const open = vi.fn(() => { throw new Error('不应访问浏览器存档') })
    vi.stubGlobal('indexedDB', { open })
    harness.store.load.mockResolvedValue(lampSave())
    const session = await createSession({} as HTMLElement, { onMessage: vi.fn(), onProgress: vi.fn() })
    const initial = harness.renderer.setWorld.mock.calls[0][0] as WorldState
    expect(initial.dugCount).toBe(0)
    expect(initial.progress.coreRepaired).toBe(false)
    expect(harness.renderer.playOpening).toHaveBeenCalledOnce()
    harness.handlers.onTap({ x: 14, y: 11 })
    await vi.advanceTimersByTimeAsync(400)
    session.destroy()
    expect(open).not.toHaveBeenCalled()
    expect(harness.store.load).not.toHaveBeenCalled()
    expect(harness.store.save).not.toHaveBeenCalled()
  })

  it('进入页预加载不播放开场，点击开始才播放且不能重复启动', async () => {
    const opening = vi.fn()
    const session = await createSession({} as HTMLElement, { onMessage: vi.fn(), onProgress: vi.fn(), onOpening: opening }, { deferOpening: true })
    expect(harness.renderer.playOpening).not.toHaveBeenCalled()
    expect(opening).not.toHaveBeenCalled()
    session.startOpening(); session.enableOpeningSound(); session.startOpening()
    expect(harness.renderer.playOpening).toHaveBeenCalledOnce()
    expect(harness.renderer.enableOpeningSound).toHaveBeenCalledOnce()
    expect(opening).toHaveBeenLastCalledWith({ active: false, caption: '' })
    session.destroy()
  })

  it('进入页能读出上次进度；继续游戏不重播开场', async () => {
    harness.store.load.mockResolvedValue(readySave())
    const opening = vi.fn()
    const session = await createGameSession({} as HTMLElement, { onMessage: vi.fn(), onProgress: vi.fn(), onOpening: opening })
    const save = session.titleSave()
    expect(save.status).toBe('ready')
    if (save.status !== 'ready') throw new Error('应读到存档')
    expect(save.summary.phase).toBe('泉水与家园')
    expect(save.summary.missionTitle).toBe('楼下有谁在喊饿')
    expect(save.summary.total).toBe(12)
    expect(save.savedAt).not.toBe('')
    expect(harness.renderer.playOpening).not.toHaveBeenCalled()

    session.startOpening()
    expect(harness.renderer.playOpening).not.toHaveBeenCalled()
    session.destroy()
  })

  it('只是为了看进入页不写新档；重新开始会清掉旧档并回到初始世界', async () => {
    harness.store.load.mockResolvedValue(null)
    const idle = await createSession({} as HTMLElement, { onMessage: vi.fn(), onProgress: vi.fn() }, { store: harness.store, deferOpening: true })
    expect(idle.titleSave()).toEqual({ status: 'none' })
    idle.destroy()
    expect(harness.store.save).not.toHaveBeenCalled()

    harness.store.load.mockResolvedValue(readySave())
    const session = await createGameSession({} as HTMLElement, { onMessage: vi.fn(), onProgress: vi.fn() })
    expect(session.titleSave().status).toBe('ready')
    harness.store.save.mockClear()

    await session.startNewGame()
    expect(harness.store.clear).toHaveBeenCalledOnce()
    const fresh = harness.renderer.setWorld.mock.calls.at(-1)![0] as WorldState
    expect(fresh.dugCount).toBe(0)
    expect(fresh.progress.coreRepaired).toBe(false)
    expect(fresh.pods).toEqual([])
    expect(session.titleSave()).toEqual({ status: 'none' })

    session.startOpening()
    expect(harness.renderer.playOpening).toHaveBeenCalledOnce()
    expect(harness.store.save).toHaveBeenCalledOnce()
    session.destroy()
  })

  it('损坏存档在进入页给出原因；重新开始后恢复自动保存', async () => {
    harness.store.load.mockResolvedValue({ version: 5, world: {} })
    const session = await createGameSession({} as HTMLElement, { onMessage: vi.fn(), onProgress: vi.fn() })
    const broken = session.titleSave()
    expect(broken.status).toBe('broken')
    if (broken.status !== 'broken') throw new Error('应识别为损坏存档')
    expect(broken.error.length).toBeGreaterThan(0)

    await session.startNewGame()
    expect(harness.store.clear).toHaveBeenCalledOnce()
    expect(session.titleSave()).toEqual({ status: 'none' })
    harness.store.save.mockClear()
    session.startOpening()
    expect(harness.store.save).toHaveBeenCalledOnce()
    session.destroy()
  })
})
