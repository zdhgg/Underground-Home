import { afterEach, describe, expect, it, vi } from 'vitest'
import { VentilationChapter, type VentilationUI } from '../src/app/ventilationChapter'
import type { PixiWorldRenderer } from '../src/render/PixiRenderer'
import { createWorldHistory } from '../src/core/history'
import { deserialize, serialize } from '../src/core/persistence'
import { initializeWorkers, type WorkPlan } from '../src/core/partnerWork'
import { performVentilation, setAirMode } from '../src/core/ventilation'
import { ventilationFrontier } from '../src/core/ventilationTopology'
import { TILE, type Cell } from '../src/core/world'
import { completedVentilation, expandVentilation, ventilationAvailable, workingVentilation } from './fixtures/ventilationWorld'

function setup(w = ventilationAvailable()) {
  let state: VentilationUI | undefined
  const saves: unknown[] = [], history = createWorldHistory(), notify = vi.fn()
  const view = {
    focusOn: vi.fn(), setVentilationPreview: vi.fn(), refresh: vi.fn(), beginDeepCamera: vi.fn(), releaseDeepCamera: vi.fn(), cancelDeepAnimation: vi.fn(),
    playExplorationTravel: vi.fn((route: Cell[], done: () => void, step: (p: Cell) => void) => { route.forEach(step); done() }),
    playPartnerTravel: vi.fn((_id: string, route: Cell[], step: (p: Cell) => void, done: () => void) => { route.forEach(step); done() }),
    playPartnerWork: vi.fn((_plan: WorkPlan, strike: () => void, done: () => void) => { strike(); done() }),
    playHallWork: vi.fn((_at: Cell, done: () => void) => done()),
  }
  const chapter = new VentilationChapter({ world: () => w, view: view as unknown as PixiWorldRenderer, emit: value => { state = value }, prepare: vi.fn(),
    changed: () => { initializeWorkers(w); saves.push(serialize(w)) }, record: change => history.record({ kind: 'ventilation', change }), dig: p => history.record({ kind: 'dig', ...p, tile: TILE.ROCK }), notify,
  })
  return { chapter, w, view, state: () => state!, saves, notify, history }
}
afterEach(() => vi.useRealTimers())


describe('第七层真实会话、施工与送礼',()=>{
 it('完整章节每步实际行动，所有中间快照可恢复，作品送到大厅后才结算',()=>{
  const h=setup(),{chapter:c,w}=h;c.show(true);c.primary();expect(w.ventilation.inspected).toBe(true);c.primary();expect(w.ventilation.braced).toBe(true);c.primary();expect(ventilationFrontier(w)).toBeNull();c.primary();expect(w.exploration.explorer?.y).toBe(82);expandVentilation(w)
  c.primary();expect(w.ventilation.metLingling).toBe(true);expect(h.state().speaker).toBe('铃铃');c.primary();expect(w.ventilation.liftExtended).toBe(false);c.primary();expect(w.ventilation.liftExtended).toBe(true)
  for(const[k,x]of [['inlet',10],['fan',18],['baffle',24],['bench',28]]as const){c.primary();expect(h.state().placing).toBe(k);c.tap({x,y:80});c.primary()}
  c.primary();expect(w.ventilation.duct).toContain(32);c.primary();expect(w.ventilation.mode).toBe('off');c.primary();expect(w.ventilation.mode).toBe('home');c.primary();expect(w.ventilation.tested).toBe(true)
  c.primary();c.primary();expect(w.ventilation.mode).toBe('work');c.primary();expect(w.ventilation.readyCraft).toBe('chime');c.primary();c.primary();expect(w.ventilation.mode).toBe('home');c.primary();expect(w.ventilation.gifts).toBe(1);expect(w.exploration.explorer?.y).toBe(46);expect(w.workers.lingling?.y).toBe(46)
  c.primary();expect(h.state().placing).toBe('nest');c.tap({x:34,y:80});c.primary();c.primary();expect(w.ventilation.completed).toBe(true);expect(h.state()).toMatchObject({celebrating:true,busy:false,done:19})
  expect(w.exploration.explorer).toEqual({x:28,y:82});expect(w.workers.lingling).toEqual({x:29,y:82});expect(w.workers.amu).toEqual({x:30,y:82})
  for(const s of h.saves){const r=deserialize(s);expect(r,JSON.stringify(r.ok?{ok:true}:r)).toMatchObject({ok:true})}c.primary();expect(h.state().active).toBe(false)
 },20000)
 it('到场前取消、重复点击和旧工作结束不能扣料或开风机',()=>{
  const h=setup();h.chapter.show();let arrive=()=>{};h.view.playExplorationTravel.mockImplementationOnce((_r,done)=>{arrive=done});const wood=h.w.inventory.wood;h.chapter.primary();h.chapter.primary();expect(h.view.playExplorationTravel).toHaveBeenCalledTimes(1);h.chapter.cancel();arrive();expect(h.w.ventilation.inspected).toBe(false);expect(h.w.inventory.wood).toBe(wood)
  const a=setup(workingVentilation());a.chapter.show();a.chapter.chooseMode('home');let done=()=>{};a.view.playPartnerWork.mockImplementationOnce((_p,_hit,end)=>{done=end});a.chapter.primary();expect(a.w.ventilation.mode).toBe('off');a.chapter.close();done();expect(a.w.ventilation.mode).toBe('off')
 })
 it('落手只凿一格，取消保留断点；重复落手与过期结束不重复',()=>{
  const h=setup();h.chapter.show();h.chapter.primary();h.chapter.primary();let hit=()=>{},end=()=>{};h.view.playPartnerWork.mockImplementationOnce((_p,strike,done)=>{hit=strike;end=done});h.chapter.primary();const count=h.w.dugCount;hit();hit();expect(h.w.dugCount).toBe(count+1);h.chapter.cancel();end();expect(h.w.tiles[71][27]).toBe(TILE.EMPTY);expect(h.w.tiles[72][27]).toBe(TILE.ROCK);expect(deserialize(serialize(h.w))).toMatchObject({ok:true});h.chapter.primary();expect(ventilationFrontier(h.w)).toBeNull()
 })
 it('选择模式不即刻变化，确认结束只调节一次；成品不被品种选择覆盖',()=>{
  const h=setup(workingVentilation()),c=h.chapter;c.show();c.chooseMode('home');expect(h.state().modeChoice).toBe('home');expect(h.w.ventilation.mode).toBe('off');c.primary();expect(h.w.ventilation.mode).toBe('home');c.perform('test');c.chooseMode('work');c.primary();c.select('bench');c.changeVariety();expect(h.w.ventilation.variety).toBe('mobile');c.primary();expect(h.w.ventilation.readyCraft).toBe('mobile');c.changeVariety();expect(h.w.ventilation.variety).toBe('mobile')
 })
 it('送礼等待阿土和铃铃真实到大厅；途中取消不丢成品、不新增家里作品',()=>{
  const h=setup(workingVentilation()),c=h.chapter;setAirMode(h.w,'home');performVentilation(h.w,'test');setAirMode(h.w,'work');performVentilation(h.w,'craft');setAirMode(h.w,'home');c.show()
  let arrive=()=>{};h.view.playPartnerTravel.mockImplementationOnce((_id,_route,_step,end)=>{arrive=end});c.perform('gift');expect(h.w.ventilation.gifts).toBe(0);c.cancel();arrive();expect(h.w.ventilation.readyCraft).toBe('chime');expect(h.w.ventilation.hallArt).toBeNull();c.perform('gift');expect(h.w.ventilation.gifts).toBe(1);expect(h.w.workers.lingling?.y).toBe(46)
 })
 it('巡游等待阿土、铃铃与阿木分开到场，取消和重复回调不提前完成',()=>{
  const h=setup(completedVentilation());h.w.ventilation.completed=false;h.w.ventilation.tours=0;h.chapter.show();let arrive=()=>{};h.view.playPartnerTravel.mockImplementationOnce((_id,_route,_step,done)=>{arrive=done});h.chapter.primary();expect(h.w.ventilation.completed).toBe(false);h.chapter.close();arrive();expect(h.w.ventilation.completed).toBe(false);h.chapter.show();h.chapter.primary();expect(h.w.ventilation.completed).toBe(true);expect(h.w.ventilation.tours).toBe(1);expect(h.w.exploration.explorer).toEqual({x:28,y:82});expect(h.w.workers.lingling).toEqual({x:29,y:82});expect(h.w.workers.amu).toEqual({x:30,y:82})
 })
 it('章末后的第二件作品仍接回调微风和送礼目标，不被巡游抢走',()=>{
  const h=setup(completedVentilation()),c=h.chapter;c.show();setAirMode(h.w,'work');c.select('bench');c.changeVariety();c.primary();expect(h.w.ventilation.readyCraft).toBe('mobile');expect(h.state().label).toBe('选择家园微风');c.primary();c.primary();expect(h.state().label).toBe('一起送到大厅');c.primary();expect(h.w.ventilation).toMatchObject({gifts:2,hallArt:'mobile',readyCraft:null,completed:true})
 })
 it('巡游等三位到场；停帧解锁，不反复抢镜头；发现不吞上方土块',()=>{
  vi.useFakeTimers();const h=setup(workingVentilation());Object.defineProperty(h.view,'frames',{value:0});h.view.playPartnerWork.mockImplementationOnce(()=>{});h.chapter.show();h.chapter.chooseMode('home');h.chapter.primary();vi.advanceTimersByTime(3201);expect(h.state().busy).toBe(false);expect(h.w.ventilation.mode).toBe('off');const count=h.view.focusOn.mock.calls.length;h.chapter.refresh();h.chapter.refresh();expect(h.view.focusOn).toHaveBeenCalledTimes(count);h.chapter.close();expect(h.chapter.tap({x:38,y:80})).toBe(false);h.chapter.tap({x:38,y:82});expect(h.w.ventilation.foundEcho).toBe(true);h.chapter.tap({x:10,y:82});expect(h.w.ventilation.foundVane).toBe(true);h.chapter.tap({x:10,y:82});expect(h.state().selected).toBe('inlet')
 })
})
