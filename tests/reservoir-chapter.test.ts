import { afterEach, describe, expect, it, vi } from 'vitest'
import { ReservoirChapter, type ReservoirUI } from '../src/app/reservoirChapter'
import type { PixiWorldRenderer } from '../src/render/PixiRenderer'
import { createWorldHistory } from '../src/core/history'
import { deserialize, serialize } from '../src/core/persistence'
import { initializeWorkers, type WorkPlan } from '../src/core/partnerWork'
import { performReservoir, setWaterRoute } from '../src/core/reservoir'
import { reservoirFrontier } from '../src/core/reservoirTopology'
import { TILE, type Cell } from '../src/core/world'
import { expandReservoir, reservoirAvailable, workingReservoir } from './fixtures/reservoirWorld'

function setup(w = reservoirAvailable()) {
  let state: ReservoirUI | undefined
  const saves: unknown[] = [], history = createWorldHistory(), notify = vi.fn(), milestone = vi.fn()
  const view = {
    focusOn: vi.fn(), setReservoirPreview: vi.fn(), refresh: vi.fn(), beginDeepCamera: vi.fn(), releaseDeepCamera: vi.fn(), cancelDeepAnimation: vi.fn(),
    playExplorationTravel: vi.fn((route: Cell[], done: () => void, step: (p: Cell) => void) => { route.forEach(step); done() }),
    playPartnerTravel: vi.fn((_id: string, route: Cell[], step: (p: Cell) => void, done: () => void) => { route.forEach(step); done() }),
    playPartnerWork: vi.fn((_plan: WorkPlan, strike: () => void, done: () => void) => { strike(); done() }),
    playReservoirFlow: vi.fn(), stopReservoirFlow: vi.fn(), playHallWork: vi.fn((_at: Cell, done: () => void) => done()),
  }
  const chapter = new ReservoirChapter({ world: () => w, view: view as unknown as PixiWorldRenderer, emit: value => { state = value }, prepare: vi.fn(),
    changed: () => { initializeWorkers(w); saves.push(serialize(w)) }, record: change => history.record({ kind: 'reservoir', change }), dig: p => history.record({ kind: 'dig', ...p, tile: TILE.ROCK }), notify, milestone,
  })
  return { chapter, w, view, state: () => state!, saves, notify, milestone, history }
}
afterEach(() => vi.useRealTimers())


describe('第六层真实水工会话',()=>{
  it('检查护框、逐块凿岩、相遇、自由选址、接渠、蓄水、两路送水到巡游，每步可恢复',()=>{
    const h=setup(),{chapter:c,w}=h;c.show(true)
    c.primary();expect(w.reservoir.inspected).toBe(true)
    c.primary();expect(w.reservoir.shored).toBe(true)
    c.primary();expect(reservoirFrontier(w)).toBeNull()
    c.primary();expect(w.reservoir.entered).toBe(true);expect(w.exploration.explorer?.y).toBe(70)
    expandReservoir(w)
    c.primary();expect(w.reservoir.metTuantuan).toBe(true);expect(w.workers.tuantuan).toBeDefined()
    expect(h.state()).toMatchObject({speaker:'团团',title:'团团来帮忙啦'});c.primary();expect(w.reservoir.liftExtended).toBe(false)
    c.primary();expect(w.reservoir.liftExtended).toBe(true)
    for(const [kind,x] of [['intake',10],['basin',18],['gate',24],['wheel',28]] as const){c.primary();expect(h.state().placing).toBe(kind);c.tap({x,y:68});c.primary()}
    c.primary();expect(w.reservoir.canal).toContain(31)
    c.primary();expect(w.reservoir.water).toBe(3)
    c.primary();expect(w.reservoir.valve).toBe('closed');expect(h.state().label).toContain('确认')
    c.primary();expect(w.reservoir.valve).toBe('garden')
    c.primary();expect(w.reservoir).toMatchObject({water:2,irrigation:2,gardenDeliveries:1})
    c.primary();c.primary();expect(w.reservoir.valve).toBe('hall')
    c.primary();expect(w.reservoir.hallDeliveries).toBe(1)
    c.primary();expect(w.reservoir.completed).toBe(true);expect(h.state()).toMatchObject({celebrating:true,busy:false,done:18})
    expect(w.exploration.explorer).toEqual({x:10,y:70});expect(w.workers.tuantuan).toEqual({x:11,y:70});expect(w.workers.xiaoquan).toEqual({x:12,y:70})
    expect(h.view.playReservoirFlow.mock.calls.map(c=>c[0])).toEqual(['garden','hall'])
    for(const s of h.saves){const r=deserialize(s);expect(r,JSON.stringify(r.ok?{ok:true}:r)).toMatchObject({ok:true})}
    c.primary();expect(h.state().active).toBe(false)
  },20000)
  it('重复点击只开一个动作，取消到场和旧工作回调不扣料、不蓄水',()=>{
    const h=setup();h.chapter.show();let arrive=()=>{}
    h.view.playExplorationTravel.mockImplementationOnce((_r,done)=>{arrive=done})
    const before=structuredClone(h.w.inventory);h.chapter.primary();h.chapter.primary();expect(h.view.playExplorationTravel).toHaveBeenCalledTimes(1)
    h.chapter.cancel();arrive();expect(h.w.reservoir.inspected).toBe(false);expect(h.w.inventory).toEqual(before)
    const a=setup(workingReservoir());a.chapter.show();let done=()=>{}
    a.view.playPartnerWork.mockImplementationOnce((_p,_hit,end)=>{done=end});a.chapter.primary();expect(a.w.reservoir.water).toBe(0)
    a.chapter.close();done();expect(a.w.reservoir.water).toBe(0)
  })
  it('闸柄选择可退出；确认后也要等团团落手，不会提前变水路或送水',()=>{
    const h=setup(workingReservoir()),c=h.chapter;performReservoir(h.w,'fill');c.show();c.chooseRoute('garden')
    expect(h.w.reservoir.valve).toBe('closed');c.close();expect(h.w.reservoir.valve).toBe('closed')
    c.show();c.chooseRoute('garden');let done=()=>{};h.view.playPartnerWork.mockImplementationOnce((_p,_hit,end)=>{done=end})
    c.primary();expect(h.w.reservoir.valve).toBe('closed');done();done();expect(h.w.reservoir).toMatchObject({valve:'garden',water:3,gardenDeliveries:0})
    c.select('wheel');h.view.playPartnerWork.mockImplementationOnce((_p,_hit,end)=>{done=end});c.primary();expect(h.w.reservoir.water).toBe(3)
    c.cancel();done();expect(h.w.reservoir.water).toBe(3);expect(h.view.playReservoirFlow).not.toHaveBeenCalled()
    c.primary();expect(h.w.reservoir.water).toBe(2);expect(h.view.playReservoirFlow).toHaveBeenCalledTimes(1)
  })
  it('凿岩按落手推进，重复落手不重复；取消保留断点，重开继续',()=>{
    const h=setup();h.chapter.show();h.chapter.primary();h.chapter.primary();let hit=()=>{},end=()=>{}
    h.view.playPartnerWork.mockImplementationOnce((_p,strike,done)=>{hit=strike;end=done})
    h.chapter.primary();const count=h.w.dugCount;hit();hit();expect(h.w.dugCount).toBe(count+1)
    h.chapter.cancel();end();expect(h.w.tiles[59][27]).toBe(TILE.EMPTY);expect(h.w.tiles[60][27]).toBe(TILE.ROCK)
    expect(deserialize(serialize(h.w))).toMatchObject({ok:true});h.chapter.primary();expect(reservoirFrontier(h.w)).toBeNull()
  })
  it('巡游等三人实际到达才完成；取消不触发旧巡游结束',()=>{
    const h=setup(workingReservoir());performReservoir(h.w,'fill');setWaterRoute(h.w,'garden');performReservoir(h.w,'pump');setWaterRoute(h.w,'hall');performReservoir(h.w,'pump');h.chapter.show()
    let done=()=>{};h.view.playPartnerTravel.mockImplementationOnce((_id,_r,_s,end)=>{done=end})
    h.chapter.primary();expect(h.w.reservoir.completed).toBe(false);h.chapter.cancel();done();expect(h.w.reservoir.completed).toBe(false)
    h.chapter.primary();expect(h.w.reservoir.completed).toBe(true)
  })
  it('停帧解锁，不重新抢镜头，发现只响应清空的脚下位置',()=>{
    vi.useFakeTimers();const h=setup(workingReservoir());Object.defineProperty(h.view,'frames',{value:0});h.view.playPartnerWork.mockImplementationOnce(()=>{})
    h.chapter.show();h.chapter.primary();vi.advanceTimersByTime(3201);expect(h.state().busy).toBe(false);expect(h.w.reservoir.water).toBe(0)
    const n=h.view.focusOn.mock.calls.length;h.chapter.refresh();h.chapter.refresh();expect(h.view.focusOn).toHaveBeenCalledTimes(n)
    h.chapter.close();expect(h.chapter.tap({x:38,y:68})).toBe(false);h.chapter.tap({x:38,y:70});expect(h.w.reservoir.foundShell).toBe(true)
  })
})
