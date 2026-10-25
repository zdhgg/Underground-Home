import { afterEach, describe, expect, it, vi } from 'vitest'
import { GardenChapter, type GardenUI } from '../src/app/gardenChapter'
import type { PixiWorldRenderer } from '../src/render/PixiRenderer'
import { createWorldHistory } from '../src/core/history'
import { deserialize, serialize } from '../src/core/persistence'
import { initializeWorkers, type WorkPlan } from '../src/core/partnerWork'
import { gardenBed } from '../src/core/garden'
import { gardenFrontier } from '../src/core/gardenTopology'
import { TILE, type Cell } from '../src/core/world'
import { completedGarden, expandGarden, gardenAvailable, workingGarden } from './fixtures/gardenWorld'

function setup(w = gardenAvailable()) {
  let state: GardenUI | undefined
  const saves: unknown[] = [], history = createWorldHistory(), notify = vi.fn(), milestone = vi.fn()
  const view = {
    focusOn: vi.fn(), setGardenPreview: vi.fn(), refresh: vi.fn(), beginDeepCamera: vi.fn(), releaseDeepCamera: vi.fn(), cancelDeepAnimation: vi.fn(),
    playExplorationTravel: vi.fn((route: Cell[], done: () => void, step: (p: Cell) => void) => { route.forEach(step); done() }),
    playPartnerTravel: vi.fn((_id: string, route: Cell[], step: (p: Cell) => void, done: () => void) => { route.forEach(step); done() }),
    playPartnerWork: vi.fn((_plan: WorkPlan, strike: () => void, done: () => void) => { strike(); done() }),
    playHallWork: vi.fn((_at: Cell, done: () => void) => done()),
  }
  const chapter = new GardenChapter({ world: () => w, view: view as unknown as PixiWorldRenderer, emit: value => { state = value }, prepare: vi.fn(),
    changed: () => { initializeWorkers(w); saves.push(serialize(w)) }, record: change => history.record({ kind: 'garden', change }), dig: p => history.record({ kind: 'dig', ...p, tile: TILE.ROCK }), notify, milestone,
  })
  return { chapter, w, view, state: () => state!, saves, notify, milestone, history }
}
afterEach(() => vi.useRealTimers())

describe('第五层会话与伙伴施工', () => {
  it('湿台阶、排水、逐段凿岩、到场、相遇、自由建设、育菌、真实床位与散步逐步完成，所有快照可恢复', () => {
    const h = setup(), { chapter, w } = h
    chapter.show(true); expect(h.state()).toMatchObject({ active: true, done: 0 })
    chapter.primary(); expect(w.garden.inspected).toBe(true)
    chapter.primary(); expect(w.garden.drained).toBe(true)
    chapter.primary(); expect(gardenFrontier(w)).toBeNull()
    chapter.primary(); expect(w.garden.entered).toBe(true); expect(w.exploration.explorer?.y).toBe(58)
    chapter.primary(); expect(w.garden.metTaitai).toBe(true); expect(w.workers.taitai).toBeDefined()
    chapter.primary(); expect(w.garden.liftExtended).toBe(true)
    expandGarden(w)
    for (const [kind, x] of [['rill',24],['bed',28]] as const) { chapter.primary(); expect(h.state().placing).toBe(kind); chapter.tap({x,y:56}); chapter.primary() }
    chapter.primary(); expect(w.garden.trail).toContain(31); expect(h.view.playPartnerWork.mock.calls.some(c => c[0].worker === 'taitai')).toBe(true)
    chapter.primary(); expect(h.state().placing).toBe('lamp'); chapter.tap({x:32,y:56}); chapter.primary()
    chapter.primary(); expect(gardenBed(w,28)?.growth).toBe(1)
    chapter.primary(); expect(gardenBed(w,28)?.growth).toBe(2)
    const food = w.farm.food; chapter.primary(); expect(w.farm.food).toBe(food+2)
    chapter.primary(); expect(h.state().placing).toBe('nest'); chapter.tap({x:10,y:56}); chapter.primary()
    chapter.primary(); expect(w.garden.completed).toBe(true); expect(h.state()).toMatchObject({celebrating:true,busy:false,done:14})
    expect(w.workers.taitai).toEqual({x:29,y:58}); expect(w.workers.xiaoman).toEqual({x:30,y:58}); expect(w.exploration.explorer).toEqual({x:28,y:58})
    for (const s of h.saves) { const restored = deserialize(s); expect(restored, JSON.stringify(restored.ok ? {ok:true} : restored)).toMatchObject({ok:true}) }
    chapter.primary(); expect(h.state().active).toBe(false)
  }, 20000)
  it('重复点击不开并行动作，到场前取消不扣材料，旧抵达与工作回调无效', () => {
    const h = setup(); h.chapter.show(); let arrive = () => {}
    h.view.playExplorationTravel.mockImplementationOnce((_r, done) => { arrive = done })
    const before = structuredClone(h.w); h.chapter.primary(); h.chapter.primary(); expect(h.view.playExplorationTravel).toHaveBeenCalledTimes(1)
    h.chapter.cancel(); arrive(); expect(h.w.garden.inspected).toBe(false); expect(h.w.inventory).toEqual(before.inventory)
    h.chapter.primary(); let workDone = () => {}
    h.view.playPartnerWork.mockImplementationOnce((_p,_hit,done) => { workDone = done })
    h.chapter.primary(); expect(h.w.garden.drained).toBe(false)
    h.chapter.close(); workDone(); expect(h.w.garden.drained).toBe(false)
  })
  it('落手只凿一块，停工保留断点，重新开工继续；旧结束不再施工', () => {
    const h = setup(); h.chapter.show(); h.chapter.primary(); h.chapter.primary()
    let hit = () => {}, end = () => {}
    h.view.playPartnerWork.mockImplementationOnce((_p,strike,done) => { hit=strike; end=done })
    h.chapter.primary(); const count=h.w.dugCount; hit(); hit(); expect(h.w.dugCount).toBe(count+1)
    h.chapter.cancel(); end(); expect(h.w.tiles[47][27]).toBe(TILE.EMPTY); expect(h.w.tiles[48][27]).toBe(TILE.ROCK)
    expect(deserialize(serialize(h.w))).toMatchObject({ok:true})
    h.chapter.primary(); expect(gardenFrontier(h.w)).toBeNull()
  })
  it('小满真实到场并完成动作后才生长与收获，取消和重复结束不补食物', () => {
    const h = setup(workingGarden()); h.chapter.select('bed',28)
    let done = () => {}; h.view.playPartnerWork.mockImplementationOnce((_p,_hit,end) => {done=end})
    h.chapter.primary(); expect(gardenBed(h.w,28)?.growth).toBe(0)
    done(); done(); expect(gardenBed(h.w,28)?.growth).toBe(1)
    h.chapter.primary(); expect(gardenBed(h.w,28)?.growth).toBe(2)
    const food=h.w.farm.food; h.view.playPartnerWork.mockImplementationOnce((_p,_hit,end)=>{done=end})
    h.chapter.primary(); h.chapter.cancel(); done(); expect(h.w.farm.food).toBe(food)
    h.chapter.primary(); expect(h.w.farm.food).toBe(food+2); h.chapter.changeVariety(); expect(gardenBed(h.w,28)?.variety).toBe('fan')
  })
  it('可以再摆第二张菌床，逐床铺菌毯、照料和选菌种；不会操作旁边那张', () => {
    const h=setup(workingGarden()); h.chapter.select('bed',undefined,true); h.chapter.tap({x:34,y:56}); h.chapter.primary()
    h.chapter.select('bed',34); h.chapter.primary(); expect(h.w.garden.trail).toContain(37)
    h.chapter.primary(); expect(gardenBed(h.w,34)?.growth).toBe(1); expect(gardenBed(h.w,28)?.growth).toBe(0)
    expect(deserialize(serialize(h.w))).toMatchObject({ok:true})
  })
  it('散步等阿土、苔苔和小满都到达后才完成；中途取消只保留安全站位', () => {
    const h=setup(completedGarden()); h.w.garden.walks=0; h.w.garden.completed=false; h.chapter.show()
    let done=()=>{}; h.view.playPartnerTravel.mockImplementationOnce((_id,_route,_step,end)=>{done=end})
    h.chapter.primary(); expect(h.w.garden.completed).toBe(false)
    h.chapter.cancel(); done(); expect(h.w.garden.completed).toBe(false)
    h.chapter.primary(); expect(h.w.garden.completed).toBe(true); expect(h.w.garden.walks).toBe(1)
  })
  it('停帧看门狗与超时会解锁，刷新或拖图退出不反复抢镜头；发现物不吞掉上方土块', () => {
    vi.useFakeTimers(); const h=setup(workingGarden()); Object.defineProperty(h.view,'frames',{value:0})
    h.view.playPartnerWork.mockImplementationOnce(()=>{}); h.chapter.show(); h.chapter.primary(); vi.advanceTimersByTime(3201)
    expect(h.state().busy).toBe(false); expect(gardenBed(h.w,28)?.growth).toBe(0)
    const count=h.view.focusOn.mock.calls.length; h.chapter.refresh(); h.chapter.refresh(); expect(h.view.focusOn).toHaveBeenCalledTimes(count)
    h.chapter.close(); expect(h.view.releaseDeepCamera).toHaveBeenCalled()
    expect(h.chapter.tap({x:11,y:56})).toBe(false); h.chapter.tap({x:11,y:58}); expect(h.w.garden.foundSpores).toBe(true)
  })
})
