import { completedFinale } from './fixtures/finaleWorld'
import { completedRuins } from './fixtures/ruinsWorld'
import { completedVentilation } from './fixtures/ventilationWorld'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DeepChapter, type DeepUI } from '../src/app/deepChapter'
import { createWorldHistory } from '../src/core/history'
import { deserialize, serialize } from '../src/core/persistence'
import { initializeWorkers } from '../src/core/partnerWork'
import { deepFrontier } from '../src/core/deepTopology'
import { TILE, type Cell, type DeepFacilityKind } from '../src/core/world'
import type { WorkPlan } from '../src/core/partnerWork'
import type { PixiWorldRenderer } from '../src/render/PixiRenderer'
import { completedReservoir } from './fixtures/reservoirWorld'
import { completedGarden } from './fixtures/gardenWorld'
import { furnishedHall } from './fixtures/hallWorld'
import { enterDeep, expandDeep, liftReady, secondLayerComplete, workingDeep } from './fixtures/deepWorld'
import { buildDeep, deepSuggestion, performDeep } from '../src/core/deep'

function setup(w = secondLayerComplete(), nextMainline?: () => { label: string; open(): void } | null) {
  let state: DeepUI | undefined
  const history = createWorldHistory(), saves: unknown[] = [], notify = vi.fn(), milestone = vi.fn(), visitHome = vi.fn()
  const view = {
    focusOn: vi.fn(), focusCrystal: vi.fn(), setDeepPreview: vi.fn(), cancelDeepAnimation: vi.fn(), releaseDeepCamera: vi.fn(),
    setDeepSuggestion: vi.fn(), setGuideFocus: vi.fn(), showDeepResult: vi.fn(), clearDeepResult: vi.fn(),
    playExplorationTravel: vi.fn((route: Cell[], done: () => void, step: (p: Cell) => void) => { route.forEach(step); done() }),
    playAtuWork: vi.fn((_at: Cell, done: () => void) => done()),
    playPartnerTravel: vi.fn((_id: string, route: Cell[], step: (p: Cell) => void, done: () => void) => { route.forEach(step); done() }),
    playPartnerWork: vi.fn((_plan: WorkPlan, strike: () => void, done: () => void) => { strike(); done() }),
    playDeepLift: vi.fn((_from: number, _to: number, done: () => void) => done()),
  }
  const chapter = new DeepChapter({ world: () => w, view: view as unknown as PixiWorldRenderer,
    emit: value => { state = value }, prepare: vi.fn(), changed: () => { initializeWorkers(w); saves.push(serialize(w)) },
    record: change => history.record({ kind: 'deep', change }), dig: (p, tile) => history.record({ kind: 'dig', ...p, tile }), notify, milestone, visitHome, nextMainline,
  })
  return { w, chapter, view, notify, milestone, visitHome, history, saves, state: () => state! }
}
afterEach(() => vi.useRealTimers())

describe('晶簇层真实会话切换和施工', () => {
  it('九站电梯从真实九层发车并返回，旧八层存档不能提前进入终章',()=>{
    const h=setup(completedFinale());h.chapter.show();h.chapter.perform('ride-home');expect(h.view.playDeepLift).toHaveBeenLastCalledWith(106,11,expect.any(Function));h.chapter.perform('ride-finale');expect(h.view.playDeepLift).toHaveBeenLastCalledWith(11,106,expect.any(Function));expect(h.w.exploration.explorer).toEqual({x:27,y:106});expect(h.w.workers.amu).toEqual({x:26,y:106});expect(deserialize(serialize(h.w))).toMatchObject({ok:true});const old=setup(completedRuins());old.chapter.perform('ride-finale');expect(old.view.playDeepLift).not.toHaveBeenCalled()
  })
  it('八站电梯从第八层真实发车再回第八站，旧七层存档不能提前乘入',()=>{
    const w=completedRuins();w.exploration.explorer={x:28,y:94};const h=setup(w);h.chapter.show();h.chapter.perform('ride-home');expect(h.view.playDeepLift).toHaveBeenLastCalledWith(94,11,expect.any(Function));h.chapter.perform('ride-ruins');expect(h.view.playDeepLift).toHaveBeenLastCalledWith(11,94,expect.any(Function));expect(h.w.exploration.explorer).toEqual({x:27,y:94});expect(h.w.workers.amu).toEqual({x:26,y:94});expect(deserialize(serialize(h.w))).toMatchObject({ok:true});const old=setup(completedVentilation());old.chapter.perform('ride-ruins');expect(old.view.playDeepLift).not.toHaveBeenCalled()
  })
  it('七站电梯按真实脚下发车，六层旧档不提前乘入七层',()=>{
    const h=setup(completedVentilation());h.chapter.show();h.chapter.perform('ride-home');expect(h.view.playDeepLift).toHaveBeenLastCalledWith(82,11,expect.any(Function));h.chapter.perform('ride-ventilation');expect(h.view.playDeepLift).toHaveBeenLastCalledWith(11,82,expect.any(Function));expect(h.w.exploration.explorer).toEqual({x:27,y:82});expect(deserialize(serialize(h.w))).toMatchObject({ok:true});const old=setup(completedReservoir());old.chapter.perform('ride-ventilation');expect(old.view.playDeepLift).not.toHaveBeenCalled()
  })

  it('第六站从真实脚下发车，旧五层存档不能提前乘入六层',()=>{
    const h=setup(completedReservoir());h.chapter.show();h.chapter.perform('ride-home')
    expect(h.view.playDeepLift).toHaveBeenLastCalledWith(70,11,expect.any(Function));expect(h.w.exploration.explorer).toEqual({x:27,y:11})
    h.chapter.perform('ride-reservoir');expect(h.view.playDeepLift).toHaveBeenLastCalledWith(11,70,expect.any(Function));expect(h.w.exploration.explorer).toEqual({x:27,y:70})
    expect(deserialize(serialize(h.w))).toMatchObject({ok:true})
    const old=setup(completedGarden());old.chapter.perform('ride-reservoir');expect(old.view.playDeepLift).not.toHaveBeenCalled()
  })

  it('五站电梯按真实第五层出发与抵达，不提前解锁新站，旧站继续可用',()=>{
    const h=setup(completedGarden()); h.chapter.show(); h.chapter.perform('ride-home')
    expect(h.view.playDeepLift).toHaveBeenLastCalledWith(58,11,expect.any(Function)); expect(h.w.exploration.explorer).toEqual({x:27,y:11})
    h.chapter.perform('ride-garden'); expect(h.view.playDeepLift).toHaveBeenLastCalledWith(11,58,expect.any(Function))
    expect(h.w.exploration.explorer).toEqual({x:27,y:58}); expect(deserialize(serialize(h.w))).toMatchObject({ok:true})
    const old=setup(liftReady()); old.chapter.perform('ride-garden'); expect(old.view.playDeepLift).not.toHaveBeenCalled()
  })

  it('四站电梯从第四层上楼与从老家回大厅均按真实当前楼层发车；未延长时不可乘坐到第四层', () => {
    const h = setup(furnishedHall())
    h.chapter.show(); h.chapter.perform('ride-home')
    expect(h.view.playDeepLift).toHaveBeenLastCalledWith(46, 11, expect.any(Function))
    expect(h.w.exploration.explorer).toEqual({ x: 27, y: 11 })
    h.chapter.perform('ride-hall')
    expect(h.view.playDeepLift).toHaveBeenLastCalledWith(11, 46, expect.any(Function))
    expect(h.w.exploration.explorer).toEqual({ x: 27, y: 46 })
    expect(deserialize(serialize(h.w))).toMatchObject({ ok: true })
    const old = setup(liftReady()); old.chapter.show(); old.chapter.perform('ride-hall')
    expect(old.view.playDeepLift).not.toHaveBeenCalled(); expect(old.w.deep.rides).toBe(0)
  })

  it('任务一次只告诉玩家下一件设施，再由玩家选择位置', () => {
    const w = secondLayerComplete(); enterDeep(w); expandDeep(w); performDeep(w, 'discover')
    const h = setup(w)
    h.chapter.show()
    expect(h.state()).toMatchObject({ placing: null, label: '选择位置放置晶簇采集台', choicesOpen: false })
    // 先按当前任务，再进入这件设施的选址；空洞点击仍留给自由挖掘/探索。
    expect(h.chapter.tap({ x: 24, y: 32 })).toBe(false)
    expect(h.state().placing).toBeNull()
    h.chapter.primary()
    expect(h.state().placing).toBe('collector')
    expect(h.state()).toMatchObject({ placing: 'collector', candidate: null, label: '就在这里建造' })
    expect(h.state().speech).toContain('采集台建 1 台就够了')
    expect(h.state().hint).toContain('本章只需 1 台')
    h.chapter.tap({ x: 24, y: 32 })
    expect(h.state()).toMatchObject({ placing: 'collector', candidate: 23, valid: true, label: '就在这里建造' })
    expect(h.view.setDeepPreview).toHaveBeenLastCalledWith('collector', 23)
  })

  it('选址前后地图都亮金色推荐位，点了候选位就让位给绿框，关面板即收起', () => {
    const w = secondLayerComplete(); enterDeep(w); expandDeep(w); performDeep(w, 'discover')
    const h = setup(w)
    h.chapter.show()
    // 任务要求放采集台但还没进入选址：推荐位先亮出来引导。
    expect(h.view.setDeepSuggestion).toHaveBeenLastCalledWith('collector', expect.any(Number))
    h.chapter.primary()
    expect(h.view.setDeepSuggestion).toHaveBeenLastCalledWith('collector', expect.any(Number))
    h.chapter.tap({ x: 24, y: 32 })
    expect(h.view.setDeepSuggestion).toHaveBeenLastCalledWith(null, null)
    h.chapter.close()
    expect(h.view.setDeepSuggestion).toHaveBeenLastCalledWith(null, null)
  })

  it('行动类小步的按钮写出地点，地图亮出发生位置；进设施视图或收起面板就撤掉', () => {
    // 当前小步是炼金属锭：按钮写出"小石炉"，地图框住整座炉。
    const h = setup(workingDeep())
    h.chapter.show()
    expect(h.state().label).toBe('去小石炉炼金属锭')
    expect(h.state().hint).toContain('小石炉在发光')
    expect(h.view.setGuideFocus).toHaveBeenLastCalledWith(h.chapter, { x: 21, y: 31, w: 3, h: 3 })
    h.chapter.select('furnace')
    expect(h.view.setGuideFocus).toHaveBeenLastCalledWith(h.chapter, null)
    expect(h.state().header).toBe('阿木的小石炉 · 第 3 层')
    h.chapter.close()
    // 缺材料时指向采集台；目标不是设施时（竖井口）亮目标格。
    const short = setup(workingDeep()); short.w.deep.ore = 0; short.w.deep.ingots = 0
    short.chapter.show()
    expect(short.state().label).toBe('去采集台取材料')
    expect(short.view.setGuideFocus).toHaveBeenLastCalledWith(short.chapter, { x: 24, y: 31, w: 3, h: 3 })
    const propped = setup(workingDeep()); propped.w.deep.parts = 1
    propped.chapter.show()
    expect(propped.state().label).toBe('去竖井口安装支撑')
    expect(propped.view.setGuideFocus).toHaveBeenLastCalledWith(propped.chapter, { x: 27, y: 33, w: 1, h: 1 })
  })

  it('"我自己去地图上找"收起面板、镜头指向目标、金光继续亮；点到发光设施照常交接', () => {
    const h = setup(workingDeep())
    h.chapter.show()
    expect(h.state().scout).toBe(true)
    h.chapter.scout()
    // 面板收起，目标地点仍然亮着；其他章节的关注点不会被误清。
    expect(h.state().active).toBe(false)
    expect(h.view.focusOn).toHaveBeenCalled()
    expect(h.view.setGuideFocus).toHaveBeenLastCalledWith(h.chapter, { x: 21, y: 31, w: 3, h: 3 })
    // 点到发光的小石炉：照常打开设施卡片并撤掉引导高亮。
    h.chapter.tap({ x: 22, y: 32 })
    expect(h.state()).toMatchObject({ active: true, selected: 'furnace' })
    expect(h.view.setGuideFocus).toHaveBeenLastCalledWith(h.chapter, null)
    // 建造类小步不提供"自己去找"入口（推荐位金框已经指了地点）。
    const build = setup(workingDeep()); build.w.deep.facilities = build.w.deep.facilities.filter(f => f.kind !== 'furnace')
    build.chapter.show()
    expect(build.state().scout).toBe(false)
  })

  it('面板开着时点泥土照旧交给挖掘，不会被选址吞掉', () => {
    const w = secondLayerComplete(); enterDeep(w); expandDeep(w); performDeep(w, 'discover')
    w.tiles[32][38] = TILE.SOIL; w.tiles[31][38] = TILE.SOIL
    const h = setup(w)
    h.chapter.show()
    expect(h.chapter.tap({ x: 38, y: 32 })).toBe(false)
    expect(h.state().placing).toBeNull()
  })

  it('选址点土不挖掘；明确切到挖掘后可返回同一设施，再自由换位置', () => {
    const w = secondLayerComplete(); enterDeep(w); expandDeep(w); performDeep(w, 'discover')
    const h = setup(w)
    h.chapter.show(); h.chapter.primary()
    expect(h.state().placing).toBe('collector')
    // x=40 是扩建口袋边缘的泥土：选址中点只留下明确的“先去挖”出口，不暗中改地形。
    expect(w.tiles[33][40]).toBe(TILE.SOIL)
    expect(h.chapter.tap({ x: 40, y: 33 })).toBe(true)
    expect(h.state().candidate).toBeNull()
    expect(h.state().digAvailable).toBe(true)
    expect(h.state().hint).toContain('先挖开')
    expect(h.chapter.dig()).toEqual({ x: 40, y: 33 })
    expect(w.tiles[33][40]).toBe(TILE.SOIL)
    expect(h.state()).toMatchObject({ active: true, digging: true, placing: null })
    expect(h.chapter.tap({ x: 40, y: 33 })).toBe(false)
    h.chapter.primary()
    expect(h.state()).toMatchObject({ digging: false, placing: 'collector' })
    // 点推荐框中间：影子落在推荐位本身，不会偏移成新左边缘。
    const suggested = deepSuggestion(w, 'collector')!
    h.chapter.tap({ x: suggested + 1, y: 32 })
    expect(h.state()).toMatchObject({ candidate: suggested, valid: true })
    // 想盖住天然晶簇那一列：没有能放下的位置，保留点击列让红框说清原因。
    h.chapter.tap({ x: 30, y: 32 })
    expect(h.state()).toMatchObject({ candidate: 30, valid: false })
    expect(h.state().hint).toContain('晶簇')
  })

  it('采集台建好后先试用一次，并在下一目标卡上保留动作结果', () => {
    const w = secondLayerComplete(); enterDeep(w); expandDeep(w); performDeep(w, 'discover')
    const h = setup(w)
    h.chapter.show(); h.chapter.primary()
    const suggested = deepSuggestion(w, 'collector')!
    h.chapter.tap({ x: suggested + 1, y: 32 }); h.chapter.primary()
    expect(h.state()).toMatchObject({ feedback: { title: '采集台建好啦', nextLabel: '试试采集台，取一份材料' } })
    expect(h.view.setGuideFocus).toHaveBeenLastCalledWith(h.chapter, { x: suggested, y: 31, w: 3, h: 3, label: null })
    expect(h.view.setDeepSuggestion).toHaveBeenLastCalledWith(null, null)
    h.chapter.primary()
    expect(h.state()).toMatchObject({ feedback: { title: '材料到手啦' } })
    expect(w.deep.crystals).toBe(6)
    expect(w.deep.ore).toBe(5)
    const after = structuredClone(w)
    h.chapter.primary()
    expect(h.state()).toMatchObject({ feedback: null, placing: null, label: '选择位置放置稳光配电箱' })
    expect(w).toEqual(after) // 查看下一步不暗中开工或扣材料。
  })

  it('点已经建好的设施仍是看用法，不会被下一件设施的选址抢走', () => {
    const w = secondLayerComplete(); enterDeep(w); expandDeep(w); performDeep(w, 'discover')
    expect(buildDeep(w, 'collector', 24).ok).toBe(true)
    expect(buildDeep(w, 'distributor', 28).ok).toBe(true)
    const h = setup(w)
    h.chapter.show()
    expect(h.state().label).toBe('选择位置放置晶光壁灯')
    expect(h.chapter.tap({ x: 25, y: 32 })).toBe(true)
    expect(h.state()).toMatchObject({ selected: 'collector', placing: null })
  })

  it('完成前章后主动打开、到侧洞相遇、逐段凿岩、沿梯到场，再按自由选址完成五类设施', () => {
    const h = setup(), { chapter, w } = h
    chapter.show(true); expect(h.state()).toMatchObject({ active: true, busy: false, done: 0 })
    chapter.primary(); expect(w.deep.metAyan).toBe(true)
    chapter.primary(); expect(deepFrontier(w)).toBeNull()
    expect(h.view.playPartnerWork).toHaveBeenCalledTimes(8)
    chapter.primary(); expect(w.deep.entered).toBe(true); expect(w.exploration.explorer?.y).toBe(33)
    chapter.primary(); expect(w.deep.foundCrystal).toBe(true)
    expandDeep(w)
    for (const [kind, x] of [['collector', 24], ['distributor', 28], ['lamp', 36], ['workshop', 31], ['furnace', 21]] as [DeepFacilityKind, number][]) {
      chapter.select(kind); expect(h.state().placing).toBe(kind)
      chapter.tap({ x, y: 32 }); expect(h.state().valid).toBe(true)
      chapter.primary(); expect(h.state()).toMatchObject({ busy: false, placing: null, selected: null })
    }
    expect(w.deep.facilities).toHaveLength(5)
    expect(h.saves.length).toBeGreaterThan(10)
    // 包括施工中与移动中的快照，每一份都能独立恢复。
    for (const save of h.saves) expect(deserialize(save)).toMatchObject({ ok: true })
    chapter.close(); expect(h.state().active).toBe(false)
  })

  it('连点不创建并行施工，停工后旧的落手和结束回调不能继续凿岩；能从真实断点重试', () => {
    const h = setup(); h.chapter.show(); h.chapter.primary()
    let strike = () => {}, done = () => {}
    h.view.playPartnerWork.mockImplementationOnce((_p, hit, end) => { strike = hit; done = end })
    h.chapter.primary(); expect(h.state().busy).toBe(true)
    h.chapter.primary(); expect(h.view.playPartnerWork).toHaveBeenCalledTimes(1)
    h.chapter.cancel(); strike(); done()
    expect(h.w.tiles[22][27]).toBe(TILE.ROCK); expect(h.state().busy).toBe(false)
    h.chapter.primary(); expect(deepFrontier(h.w)).toBeNull()
  })

  it('凿开一段后停止会保留地形；失去画面时限后解锁，旧回调不补施工', () => {
    vi.useFakeTimers()
    const h = setup(); h.chapter.show(); h.chapter.primary()
    let later = () => {}
    h.view.playPartnerWork.mockImplementationOnce((_p, hit, done) => { hit(); later = done })
    h.chapter.primary(); expect(h.w.tiles[22][27]).toBe(TILE.EMPTY)
    vi.advanceTimersByTime(30001); later()
    expect(h.state().busy).toBe(false); expect(h.w.tiles[23][27]).toBe(TILE.ROCK)
    expect(deserialize(serialize(h.w))).toMatchObject({ ok: true })
    h.chapter.primary(); expect(deepFrontier(h.w)).toBeNull()
  })

  it('画面连续三秒不出帧会及时取消，回来后能重新派工', () => {
    vi.useFakeTimers()
    const h = setup(workingDeep())
    Object.defineProperty(h.view, 'frames', { value: 0 })
    let arrive = () => {}
    h.view.playExplorationTravel.mockImplementationOnce((_r, done) => { arrive = done })
    h.chapter.show(); h.chapter.primary()
    expect(h.state().busy).toBe(true)
    vi.advanceTimersByTime(3201); arrive()
    expect(h.state().busy).toBe(false); expect(h.w.deep.ingots).toBe(0)
    h.chapter.primary(); expect(h.w.deep.ingots).toBe(2)
  })

  it('旧的工作完成回调重复到达，也只能加工一批', () => {
    const h = setup(workingDeep())
    let complete = () => {}
    h.view.playPartnerWork.mockImplementationOnce((_p, _hit, done) => { complete = done })
    h.chapter.show(); h.chapter.primary(); complete(); complete()
    expect(h.w.deep.ore).toBe(1); expect(h.w.deep.ingots).toBe(2)
  })

  it('设施在到场前不扣材料；取消选址和行走都保留世界，不重放镜头', () => {
    const h = setup(workingDeep()), before = structuredClone(h.w)
    h.chapter.select('lamp', true); h.chapter.tap({ x: 37, y: 32 })
    const focusCount = h.view.focusOn.mock.calls.length
    h.chapter.refresh(); h.chapter.refresh()
    expect(h.view.focusOn).toHaveBeenCalledTimes(focusCount)
    h.chapter.close(); expect(h.w).toEqual(before)
    h.chapter.select('lamp', true); h.chapter.tap({ x: 37, y: 32 })
    let arrive = () => {}
    h.view.playExplorationTravel.mockImplementationOnce((_r, end) => { arrive = end })
    h.chapter.primary(); expect(h.w.inventory).toEqual(before.inventory)
    h.chapter.cancel(); arrive(); expect(h.w.deep.facilities).toEqual(before.deep.facilities)
  })

  it('晶苔和钻头的发现命中不会吞掉上方泥土的扩挖点击', () => {
    const h = setup(workingDeep())
    h.w.tiles[32][38] = TILE.SOIL; h.w.tiles[31][19] = TILE.SOIL
    expect(h.chapter.tap({ x: 38, y: 32 })).toBe(false)
    expect(h.chapter.tap({ x: 19, y: 31 })).toBe(false)
  })

  it('可以另选新位置增加晶光灯；收起面板释放自动镜头', () => {
    const h = setup(workingDeep())
    h.chapter.select('lamp', true); expect(h.state().placing).toBe('lamp')
    h.chapter.tap({ x: 37, y: 32 }); h.chapter.primary()
    expect(h.w.deep.facilities.filter(f => f.kind === 'lamp')).toHaveLength(2)
    expect(deserialize(serialize(h.w))).toMatchObject({ ok: true })
    h.chapter.close(); expect(h.view.releaseDeepCamera).toHaveBeenCalled()
  })

  it('电梯先接伙伴到梯口，乘坐完成才记录抵达；中途取消不瞬移、不计完成，可重试', () => {
    const h = setup(liftReady())
    let arrived = () => {}
    h.view.playDeepLift.mockImplementationOnce((_from, _to, done) => { arrived = done })
    h.chapter.show(); h.chapter.primary()
    expect(h.state().busy).toBe(true); expect(h.w.deep.rides).toBe(0)
    h.chapter.cancel(); arrived()
    expect(h.w.deep.rides).toBe(0); expect(h.w.deep.completed).toBe(false)
    expect(h.w.exploration.explorer).toEqual({ x: 27, y: 33 })
    h.chapter.primary()
    expect(h.w.deep.completed).toBe(true); expect(h.w.deep.rides).toBe(1)
    expect(h.w.exploration.explorer).toEqual({ x: 27, y: 11 }); expect(h.w.workers.amu).toEqual({ x: 26, y: 11 })
    expect(deserialize(serialize(h.w))).toMatchObject({ ok: true })
    expect(h.state().feedback?.title).toBe('三层家园连通啦')
    expect(h.milestone).not.toHaveBeenCalled()
  })

  it('面板一直带着大目标：里程碑推进、发现晶簇亮出计划、工坊后给出部件配方链', () => {
    const h = setup(), { chapter, w } = h
    chapter.show(true)
    expect(h.state()).toMatchObject({ milestone: 0, plan: false, chain: false })
    chapter.primary(); chapter.primary(); chapter.primary()
    expect(w.deep.entered).toBe(true); expect(h.state()).toMatchObject({ plan: false, milestone: 1 })
    chapter.primary()
    expect(w.deep.foundCrystal).toBe(true)
    expect(h.state().feedback?.title).toBe('晶光找到啦')
    expect(h.milestone).not.toHaveBeenCalledWith('大计划：三层电梯！', expect.any(String))
    chapter.primary() // 看完发现结果后才交接到建造目标。
    expect(h.state()).toMatchObject({ plan: true, milestone: 1, chain: false })
    expect(h.state().builds.map(b => b.kind)).toEqual(['distributor', 'lamp', 'workshop', 'furnace'])
    expect(h.state().builds.find(b => b.kind === 'workshop')!.locked).toBe('先装稳光配电箱')
    expandDeep(w)
    for (const [kind, x] of [['collector', 24], ['distributor', 28], ['lamp', 36], ['workshop', 31], ['furnace', 21]] as [DeepFacilityKind, number][]) buildDeep(w, kind, x)
    chapter.refresh()
    expect(h.state().builds).toEqual([])
    expect(h.state()).toMatchObject({ milestone: 3, chain: true, partsNeed: 1, partsFor: '支撑竖井' })
    for (const a of ['collect', 'collect', 'smelt', 'craft', 'support'] as const) performDeep(w, a)
    chapter.refresh()
    expect(h.state()).toMatchObject({ milestone: 3, chain: true, partsNeed: 3, partsFor: '组装电梯' })
  })

  it('到站先看电梯成果，主动继续才交给小窝；不并列弹庆祝、提示或抢镜头', () => {
    const h = setup(liftReady())
    h.w.deep.parts = 1
    h.chapter.show(); h.chapter.primary()
    expect(h.w.deep.rides).toBe(1)
    expect(h.state().feedback).toMatchObject({ title: '三层家园连通啦', nextLabel: '去小窝看看暖光灯' })
    expect(h.view.setGuideFocus).toHaveBeenLastCalledWith(h.chapter, { x: 27, y: 9, w: 1, h: 3, label: null })
    expect(h.visitHome).not.toHaveBeenCalled()
    expect(h.notify).not.toHaveBeenCalled(); expect(h.milestone).not.toHaveBeenCalled()
    const focusCount = h.view.focusOn.mock.calls.length, before = structuredClone(h.w)
    h.chapter.refresh(); h.chapter.refresh()
    expect(h.view.focusOn).toHaveBeenCalledTimes(focusCount)
    h.chapter.primary()
    expect(h.visitHome).toHaveBeenCalledExactlyOnceWith(h.w.pods[0].id)
    expect(h.state()).toMatchObject({ active: false, feedback: null })
    expect(h.w).toEqual(before) // 查看小窝不安装、不扣部件，也不再乘一次电梯。
  })

  it('关闭到站成果即放弃交接，刷新不自动打开小窝；重新打开仍可主动查看', () => {
    const h = setup(liftReady()); h.w.deep.parts = 1
    h.chapter.show(); h.chapter.primary(); h.chapter.close(); h.chapter.refresh()
    expect(h.visitHome).not.toHaveBeenCalled()
    expect(h.state()).toMatchObject({ active: false, feedback: null })
    h.chapter.show()
    expect(h.state().label).toBe('去小窝看看暖光灯')
    h.chapter.primary()
    expect(h.visitHome).toHaveBeenCalledExactlyOnceWith(h.w.pods[0].id)
  })

  it('电梯耗尽材料后，尾声继续给出可执行的采集、炼锭、做部件和回家交接', () => {
    const h = setup(liftReady())
    Object.assign(h.w.deep, { crystals: 0, ore: 0, ingots: 0, parts: 0 })
    h.chapter.show(); h.chapter.primary()
    expect(h.state().feedback?.nextLabel).toContain('取些材料')
    for (const label of ['去采集台取暖灯材料', '去小石炉炼金属锭', '去工坊做暖灯部件', '乘电梯回暖窝层']) {
      h.chapter.primary() // 上一步成果 → 本步目标，不自动开工。
      expect(h.state().label).toBe(label)
      expect(h.state().feedback).toBeNull()
      h.chapter.primary()
      expect(h.state().feedback).not.toBeNull()
    }
    h.chapter.primary()
    expect(h.visitHome).toHaveBeenCalledExactlyOnceWith(h.w.pods[0].id)
    expect(h.w.deep.parts).toBe(2) // 精密工具的真实产出仍保留；查看小窝不扣料。
    expect(h.w.deep.rides).toBe(2)
    expect(deserialize(serialize(h.w))).toMatchObject({ ok: true })
  })

  it('暖灯尾声全部完成后，到站的"下一步"交给真实主线，不再指回已完成的目标', () => {
    const open = vi.fn()
    const h = setup(liftReady(), () => ({ label: '去看看暖光大厅', open }))
    h.w.deep.parts = 1
    h.chapter.show(); h.chapter.primary()
    expect(h.w.deep.completed).toBe(true)
    expect(h.state().feedback).toMatchObject({ title: '三层家园连通啦', nextLabel: '去小窝看看暖光灯' })
    h.w.pods.forEach(p => { p.warmLamp = true }) // 暖灯尾声完成 → 主线已在下一章
    h.chapter.perform('ride-crystal')
    expect(h.state().feedback).toMatchObject({ title: '到站啦', nextLabel: '去看看暖光大厅' })
    h.chapter.primary()
    expect(open).toHaveBeenCalledTimes(1)
    expect(h.state().feedback).toBeNull()
    expect(deserialize(serialize(h.w))).toMatchObject({ ok: true })
  })

  it('没有可移交的主线目标时，到站成果仍回退到本章尾声卡', () => {
    const h = setup(liftReady(), () => null)
    h.chapter.show(); h.chapter.primary()
    h.w.pods.forEach(p => { p.warmLamp = true })
    h.chapter.perform('ride-crystal')
    expect(h.state().feedback).toMatchObject({ title: '到站啦', nextLabel: '下一步：三层家园连起来啦' })
    h.chapter.primary()
    expect(h.state().feedback).toBeNull()
    expect(h.state().label).toBe('回晶簇层看看')
  })
})
