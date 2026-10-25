import { afterEach, describe, expect, it, vi } from 'vitest'
import { HallChapter, type HallUI } from '../src/app/hallChapter'
import type { PixiWorldRenderer } from '../src/render/PixiRenderer'
import { createWorldHistory } from '../src/core/history'
import { deserialize, serialize } from '../src/core/persistence'
import { hallFrontier } from '../src/core/hallTopology'
import { TILE, type Cell } from '../src/core/world'
import type { WorkPlan } from '../src/core/partnerWork'
import type { MealMove } from '../src/core/meal'
import { furnishedHall, hallAvailable, expandHall } from './fixtures/hallWorld'

function setup(w = hallAvailable()) {
  let state: HallUI | undefined
  const saves: unknown[] = [], notify = vi.fn(), milestone = vi.fn(), history = createWorldHistory()
  const view = {
    focusOn: vi.fn(), setHallPreview: vi.fn(), refresh: vi.fn(), releaseDeepCamera: vi.fn(), beginDeepCamera: vi.fn(), cancelDeepAnimation: vi.fn(),
    playExplorationTravel: vi.fn((route: Cell[], done: () => void, step: (p: Cell) => void) => { route.forEach(step); done() }),
    playHallWork: vi.fn((_at: Cell, done: () => void) => done()),
    playPartnerTravel: vi.fn((_id: string, route: Cell[], step: (p: Cell) => void, done: () => void) => { route.forEach(step); done() }),
    playPartnerWork: vi.fn((_plan: WorkPlan, strike: () => void, done: () => void) => { strike(); done() }),
    playMealGather: vi.fn((_moves: MealMove[], done: () => void) => done()), finishMealGather: vi.fn(), cancelMealGather: vi.fn(), playMealCelebration: vi.fn(),
  }
  const chapter = new HallChapter({ world: () => w, view: view as unknown as PixiWorldRenderer, emit: s => { state = s }, prepare: vi.fn(), changed: () => { saves.push(serialize(w)) }, notify, milestone,
    record: change => history.record({ kind: 'hall', change }), dig: p => history.record({ kind: 'dig', ...p, tile: TILE.ROCK }),
  })
  return { w, chapter, view, history, saves, notify, milestone, state: () => state! }
}
afterEach(() => vi.useRealTimers())

describe('暖光大厅的真实会话流程', () => {
  it('发现、加固、逐段凿岩、下楼、自由选址与六人到场按次序交接，全部中间存档可恢复', () => {
    const h = setup(), { w, chapter } = h
    chapter.show(true); expect(h.state()).toMatchObject({ done: 0, active: true })
    chapter.primary(); expect(w.hall.inspected).toBe(true); expect(h.view.playHallWork).toHaveBeenCalled()
    chapter.primary(); expect(w.hall.braced).toBe(true)
    chapter.primary(); expect(hallFrontier(w)).toBeNull(); expect(h.view.playPartnerWork).toHaveBeenCalledTimes(9)
    chapter.primary(); expect(w.hall.entered).toBe(true); expect(w.exploration.explorer?.y).toBe(46)
    chapter.primary(); expect(w.hall.liftExtended).toBe(true)
    chapter.primary(); expect(w.hall.powered).toBe(true)
    expandHall(w)
    chapter.primary(); expect(h.state().placing).toBe('hall')
    chapter.tap({ x: 28, y: 44 }); chapter.primary(); expect(w.hall.facilities[0].kind).toBe('hall')
    chapter.primary(); expect(w.hall.tableReady).toBe(true)
    chapter.primary(); chapter.tap({ x: 24, y: 44 }); chapter.primary()
    for (const x of [10, 19]) { chapter.primary(); chapter.tap({ x, y: 44 }); chapter.primary() }
    chapter.primary(); expect(w.hall.completed).toBe(true); expect(h.state()).toMatchObject({ celebrating: true, done: 11, busy: false })
    expect(h.view.playMealGather.mock.calls[0][0]).toHaveLength(5)
    expect(Object.values(w.workers).filter(p => p?.y === 46)).toHaveLength(5)
    for (const s of h.saves) expect(deserialize(s), JSON.stringify(deserialize(s))).toMatchObject({ ok: true })
    chapter.primary(); expect(h.state().active).toBe(false)
  })
  it('重复操作不并行，落手前取消不付费；旧回调不可补建或结束新动作', () => {
    const h = setup(); h.chapter.show(); let done = () => {}
    h.view.playHallWork.mockImplementationOnce((_at, end) => { done = end })
    h.chapter.primary(); h.chapter.primary(); expect(h.view.playHallWork).toHaveBeenCalledTimes(1); expect(h.w.hall.inspected).toBe(false)
    h.chapter.cancel(); done(); expect(h.w.hall.inspected).toBe(false)
    h.chapter.primary(); expect(h.w.hall.inspected).toBe(true)
    const before = structuredClone(h.w)
    h.view.playPartnerWork.mockImplementationOnce((_plan, _hit, end) => { done = end })
    h.chapter.primary(); expect(h.w.deep.parts).toBe(before.deep.parts)
    h.chapter.close(); done(); expect(h.w.hall.braced).toBe(false); expect(h.w.inventory).toEqual(before.inventory)
  })
  it('凿开一段后停工保留断点，重复的落手只凿一次，重新打开能继续', () => {
    const h = setup(); h.chapter.show(); h.chapter.primary(); h.chapter.primary()
    let strike = () => {}, done = () => {}
    h.view.playPartnerWork.mockImplementationOnce((_plan, hit, end) => { strike = hit; done = end })
    h.chapter.primary(); strike(); strike(); expect(h.w.dugCount).toBeGreaterThan(0)
    h.chapter.cancel(); done(); expect(h.w.tiles[34][27]).toBe(TILE.EMPTY); expect(h.w.tiles[35][27]).toBe(TILE.ROCK)
    expect(deserialize(serialize(h.w))).toMatchObject({ ok: true })
    h.chapter.primary(); expect(hallFrontier(h.w)).toBeNull()
  })
  it('等六位伙伴到齐再扣一份收成，聚集中取消不结算，旧完成与重复点击不会重复开席', () => {
    const h = setup(furnishedHall()), food = h.w.farm.food, workers = structuredClone(h.w.workers)
    let done = () => {}
    h.view.playMealGather.mockImplementation((_moves, end) => { done = end })
    h.chapter.show(); h.chapter.primary(); h.chapter.primary()
    expect(h.w.farm.food).toBe(food); expect(h.w.hall.feasts).toBe(0); expect(h.state().busy).toBe(true)
    h.chapter.cancel(); done(); expect(h.w.hall.feasts).toBe(0); expect(h.w.workers).toEqual(workers)
    h.chapter.primary(); const finish = done; finish(); finish()
    expect(h.w.hall.feasts).toBe(1); expect(h.w.farm.food).toBe(food - 1); expect(h.state().celebrating).toBe(true)
    expect(deserialize(serialize(h.w))).toMatchObject({ ok: true })
  })
  it('画面停帧三秒或演出超时会解锁；旧完成不会补扣食物', () => {
    vi.useFakeTimers(); const h = setup(furnishedHall())
    Object.defineProperty(h.view, 'frames', { value: 0 })
    let done = () => {}; h.view.playMealGather.mockImplementationOnce((_moves, end) => { done = end })
    h.chapter.show(); h.chapter.primary(); vi.advanceTimersByTime(3201); done()
    expect(h.state().busy).toBe(false); expect(h.w.hall.feasts).toBe(0)
    h.chapter.primary(); expect(h.w.hall.feasts).toBe(1)
  })
  it('相册只记录真实里程碑，选择设施后只展示当前设施；刷新和退出不反复移动镜头', () => {
    const h = setup(furnishedHall()); h.chapter.select('memory')
    expect(h.state().selected).toBe('memory'); expect(h.state().album.map(x => x.title)).not.toContain('六个人的暖屋宴')
    h.chapter.albumPage(1); expect(h.state().page).toBe(1)
    const focus = h.view.focusOn.mock.calls.length; h.chapter.refresh(); h.chapter.refresh(); expect(h.view.focusOn).toHaveBeenCalledTimes(focus)
    h.chapter.close(); expect(h.view.releaseDeepCamera).toHaveBeenCalled()
    // 发现物只命中地面格，不会吞掉上方泥土的挖掘输入。
    expect(h.chapter.tap({ x: 37, y: 44 })).toBe(false); h.chapter.tap({ x: 37, y: 46 }); expect(h.w.hall.muralFound).toBe(true)
  })
})
