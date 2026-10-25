import { afterEach, describe, expect, it, vi } from 'vitest'
import { RuinsChapter, type RuinsUI } from '../src/app/ruinsChapter'
import type { PixiWorldRenderer } from '../src/render/PixiRenderer'
import { createWorldHistory } from '../src/core/history'
import { deserialize, serialize } from '../src/core/persistence'
import { initializeWorkers, type WorkPlan } from '../src/core/partnerWork'
import { performRuins } from '../src/core/ruins'
import { ruinsFrontier } from '../src/core/ruinsTopology'
import { TILE, type Cell } from '../src/core/world'
import { completedRuins, expandRuins, ruinsAvailable, workingRuins } from './fixtures/ruinsWorld'

function setup(w = ruinsAvailable()) {
  let state: RuinsUI | undefined
  const saves: unknown[] = [], history = createWorldHistory(), notify = vi.fn()
  const view = {
    focusOn: vi.fn(), setRuinsPreview: vi.fn(), refresh: vi.fn(), beginDeepCamera: vi.fn(), releaseDeepCamera: vi.fn(), cancelDeepAnimation: vi.fn(),
    playExplorationTravel: vi.fn((route: Cell[], done: () => void, step: (p: Cell) => void) => { route.forEach(step); done() }),
    playPartnerTravel: vi.fn((_id: string, route: Cell[], step: (p: Cell) => void, done: () => void) => { route.forEach(step); done() }),
    playPartnerWork: vi.fn((_plan: WorkPlan, strike: () => void, done: () => void) => { strike(); done() }),
    playHallWork: vi.fn((_at: Cell, done: () => void) => done()),
  }
  const chapter = new RuinsChapter({ world: () => w, view: view as unknown as PixiWorldRenderer, emit: value => { state = value }, prepare: vi.fn(),
    changed: () => { initializeWorkers(w); saves.push(serialize(w)) }, record: change => history.record({ kind: 'ruins', change }), dig: p => history.record({ kind: 'dig', ...p, tile: TILE.ROCK }), notify,
  })
  return { chapter, w, view, state: () => state!, saves, notify, history }
}
afterEach(() => vi.useRealTimers())

describe('第八章真实行动与逐步交接',()=>{
 it('完整章节：实际到场，三段拓印修复，再添加今天一页；每步快照可恢复',()=>{
  const h=setup(),{chapter:c,w}=h;c.show(true);c.primary();expect(w.ruins.inspected).toBe(true);c.primary();expect(w.ruins.braced).toBe(true);c.primary();expect(ruinsFrontier(w)).toBeNull();c.primary();expect(w.exploration.explorer?.y).toBe(94);expandRuins(w);c.primary();expect(w.ruins.liftExtended).toBe(true)
  for(const[k,x]of [['desk',10],['light',15],['mosaic',28]]as const){c.primary();expect(h.state().placing).toBe(k);c.tap({x,y:93});c.primary()}
  for(const m of ['tools','lamp','spring']as const){c.chooseMotif(m);c.primary();expect(h.state().motif).toBe(m);expect(h.state().speech).toContain(m==='lamp'?'小灯':m==='spring'?'水纹':'小爪子');c.primary();expect(w.ruins.rubbings).toContain(m);c.primary();expect(w.ruins.mounted).toContain(m)}
  c.primary();expect(h.state().editionChoice).toBe('together');expect(w.ruins.todayReady).toBe(false);c.chooseEdition('journey');c.primary();expect(w.ruins).toMatchObject({todayReady:true,edition:'journey',showcases:1});c.primary();expect(h.state()).toMatchObject({celebrating:true,busy:false,done:19});expect(w.ruins.completed).toBe(true)
  expect(w.exploration.explorer).toEqual({x:28,y:94});expect(w.workers.adeng).toEqual({x:29,y:94});expect(w.workers.amu).toEqual({x:30,y:94});for(const s of h.saves){const r=deserialize(s);expect(r,JSON.stringify(r.ok?{ok:true}:r)).toMatchObject({ok:true})}c.primary();expect(h.state().active).toBe(false)
 },45000)
 it('到场前取消、重复点击及过期回调不会推进或扣料',()=>{
  const h=setup();h.chapter.show();let arrive=()=>{};h.view.playExplorationTravel.mockImplementationOnce((_r,done)=>{arrive=done});const wood=h.w.inventory.wood;h.chapter.primary();h.chapter.primary();expect(h.view.playExplorationTravel).toHaveBeenCalledTimes(1);h.chapter.close();arrive();expect(h.w.ruins.inspected).toBe(false);expect(h.w.inventory.wood).toBe(wood)
  const a=setup(workingRuins());performRuins(a.w,'reveal','lamp');a.chapter.chooseMotif('lamp');let done=()=>{};a.view.playPartnerWork.mockImplementationOnce((_p,_hit,end)=>{done=end});const before=a.w.inventory.wood;a.chapter.primary();expect(a.w.ruins.rubbings).toHaveLength(0);a.chapter.cancel();done();done();expect(a.w.ruins.rubbings).toHaveLength(0);expect(a.w.inventory.wood).toBe(before)
 })
 it('一次落手只凿一格，取消保留进度；停帧释放交互并忽略旧结束',()=>{
  const h=setup();h.chapter.show();h.chapter.primary();h.chapter.primary();let hit=()=>{},end=()=>{};h.view.playPartnerWork.mockImplementationOnce((_p,strike,done)=>{hit=strike;end=done});h.chapter.primary();const n=h.w.dugCount;hit();hit();expect(h.w.dugCount).toBe(n+1);h.chapter.cancel();end();expect(h.w.tiles[83][27]).toBe(TILE.EMPTY);expect(h.w.tiles[84][27]).toBe(TILE.ROCK);expect(deserialize(serialize(h.w))).toMatchObject({ok:true});h.chapter.primary();expect(ruinsFrontier(h.w)).toBeNull()
  vi.useFakeTimers();const a=setup(workingRuins());Object.defineProperty(a.view,'frames',{value:0});a.view.playPartnerWork.mockImplementationOnce(()=>{});a.chapter.chooseMotif('lamp');a.chapter.primary();vi.advanceTimersByTime(3201);expect(a.state().busy).toBe(false);expect(a.w.ruins.revealed).toHaveLength(0)
 })
 it('故事、设施点击区错开，土块不被故事吞掉；刷新不重复抢镜头',()=>{
  const h=setup(workingRuins());h.chapter.show();const count=h.view.focusOn.mock.calls.length;h.chapter.refresh();h.chapter.refresh();expect(h.view.focusOn).toHaveBeenCalledTimes(count);h.chapter.close();expect(h.chapter.tap({x:12,y:92})).toBe(true);expect(h.state().motif).toBe('lamp');h.chapter.close();h.w.tiles[92][12]=TILE.SOIL;expect(h.chapter.tap({x:12,y:92})).toBe(false);h.w.tiles[92][12]=TILE.EMPTY;h.chapter.tap({x:10,y:94});expect(h.w.ruins.foundSeal).toBe(true);h.chapter.tap({x:10,y:94});expect(h.state().selected).toBe('desk')
 })
 it('今天一页仅在工作完成时变化；庆典等待三人到不同站位，取消可继续',()=>{
  const h=setup(completedRuins());h.w.ruins.completed=false;h.w.ruins.walks=0;h.chapter.show();let arrive=()=>{};h.view.playPartnerTravel.mockImplementationOnce((_id,_route,_step,end)=>{arrive=end});h.chapter.primary();expect(h.w.ruins.completed).toBe(false);h.chapter.close();arrive();expect(h.w.ruins.completed).toBe(false);h.chapter.show();h.chapter.primary();expect(h.w.ruins).toMatchObject({completed:true,walks:1});h.chapter.show();h.chapter.chooseEdition('journey');expect(h.w.ruins.edition).toBe('together');h.chapter.primary();expect(h.w.ruins).toMatchObject({edition:'journey',showcases:2});h.chapter.primary();expect(h.w.ruins.walks).toBe(2)
 })
})


