import { afterEach,describe,expect,it,vi } from 'vitest'
import { FinaleChapter,type FinaleUI } from '../src/app/finaleChapter'
import type { PixiWorldRenderer } from '../src/render/PixiRenderer'
import { createWorldHistory } from '../src/core/history'
import { deserialize,serialize } from '../src/core/persistence'
import { initializeWorkers,type WorkPlan } from '../src/core/partnerWork'
import { performFinale,finaleSeats } from '../src/core/finale'
import { performReservoir,setWaterRoute } from '../src/core/reservoir'
import { finaleFrontier } from '../src/core/finaleTopology'
import { TILE,type Cell,stratumAt } from '../src/core/world'
import { completedFinale,expandFinale,finaleAvailable,readyFinale,workingFinale } from './fixtures/finaleWorld'
function setup(w=finaleAvailable()){
 let state:FinaleUI|undefined,lastStamp=''
 const saves:unknown[]=[],history=createWorldHistory(),notify=vi.fn()
 const view={focusOn:vi.fn(),setFinalePreview:vi.fn(),refresh:vi.fn(),beginDeepCamera:vi.fn(),releaseDeepCamera:vi.fn(),cancelDeepAnimation:vi.fn(),finishChapterArrival:vi.fn(),showFinalePanorama:vi.fn(),
  playExplorationTravel:vi.fn((route:Cell[],done:()=>void,step:(p:Cell)=>void)=>{route.forEach(step);done()}),
  playPartnerTravel:vi.fn((_id:string,route:Cell[],step:(p:Cell)=>void,done:()=>void)=>{route.forEach(step);done()}),
  playPartnerWork:vi.fn((_plan:WorkPlan,strike:()=>void,done:()=>void)=>{strike();done()}),playHallWork:vi.fn((_at:Cell,done:()=>void)=>done()),
 }
 const chapter=new FinaleChapter({world:()=>w,view:view as unknown as PixiWorldRenderer,emit:v=>{state=v},prepare:vi.fn(),
  changed:()=>{initializeWorkers(w);const stamp=JSON.stringify([w.finale,w.dugCount,w.farm.food,w.reservoir.water,w.exploration.explorer&&stratumAt(w.exploration.explorer.y),Object.entries(w.workers).map(([id,p])=>[id,stratumAt(p!.y)])]);if(stamp!==lastStamp){lastStamp=stamp;saves.push(serialize(w))}},
  record:change=>history.record({kind:'finale',change}),dig:p=>history.record({kind:'dig',...p,tile:TILE.ROCK}),notify,
 })
 return{w,chapter,view,state:()=>state!,saves,history,notify}
}
afterEach(()=>vi.useRealTimers())
describe('终章真实行动、回望与后日谈',()=>{
 it('完整终章：跨层实际送达、九人不同座位、九页手动回望、持久完成；阶段和跨层快照均可恢复',()=>{
  const h=setup(),{chapter:c,w}=h;c.show(true);c.primary();expect(w.finale.inspected).toBe(true);c.primary();expect(w.finale.braced).toBe(true);c.primary();expect(finaleFrontier(w)).toBeNull();c.primary();expect(w.exploration.explorer?.y).toBe(106);expandFinale(w);c.primary();expect(w.finale.foundWarmth).toBe(true);expect(h.state().warmthIntro).toBe(true);c.primary();expect(w.finale.liftExtended).toBe(false);c.primary();expect(w.finale.liftExtended).toBe(true)
  for(const[k,x]of [['beacon',18],['table',28],['memory',8]]as const){c.primary();expect(h.state().placing).toBe(k);c.tap({x,y:105});c.primary()}
  c.primary();expect(w.finale.lit).toBe(true);c.primary();expect(w.finale.foodReady).toBe(true);expect(w.workers.xiaoman).toEqual({x:30,y:106});c.primary();expect(w.finale.waterReady).toBe(true);expect(w.workers.tuantuan).toEqual({x:35,y:106});expect(w.workers.xiaoquan?.y).toBe(70);c.primary();expect(w.finale.chimePlaced).toBe(true);expect(w.ventilation.hallArt).not.toBeNull();c.primary();expect(w.finale.woven).toBe(true);c.primary();expect(w.finale.storyReady).toBe(true)
  c.primary();expect(h.state().themeChoice).toBe('lantern');c.chooseTheme('garden');expect(w.finale.theme).toBe('lantern');c.primary();expect(w.finale.theme).toBe('garden');c.primary();expect(w.finale.feasts).toBe(1);expect(w.finale.completed).toBe(false);expect(h.state().guests).toBe(9)
  for(const s of finaleSeats(w))expect(s.id==='atu'?w.exploration.explorer:w.workers[s.id]).toEqual(s.at)
  c.primary();expect(h.view.showFinalePanorama).toHaveBeenCalledTimes(1);for(let i=0;i<9;i++){expect(h.state().memoryIndex).toBe(i);c.primary()}expect(w.finale.completed).toBe(false);c.primary();expect(h.state()).toMatchObject({celebrating:true,completed:true,done:20});expect(w.finale.memoriesRead).toBe(9)
  for(const s of h.saves){const r=deserialize(s);expect(r,JSON.stringify(r.ok?{ok:true}:r)).toMatchObject({ok:true})}c.primary();expect(h.state().active).toBe(false)
 },30000)
 it('两段搬运必须实际走过来源和目的地；取消取货或送货不扣资源，旧抵达不结算',()=>{
  const h=setup(workingFinale()),c=h.chapter;c.show();const food=h.w.farm.food,water=h.w.reservoir.water;let sourceDone=()=>{};h.view.playPartnerTravel.mockImplementationOnce((_id,_r,_step,done)=>{sourceDone=done});c.perform('food');c.primary();expect(h.w.finale.foodReady).toBe(false);c.close();sourceDone();expect(h.w.farm.food).toBe(food)
  c.show();let targetDone=()=>{};h.view.playPartnerTravel.mockImplementationOnce((_id,r,step,done)=>{r.forEach(step);done()}).mockImplementationOnce((_id,r,step,done)=>{r.forEach(step);done()}).mockImplementationOnce((_id,_r,_step,done)=>{targetDone=done});c.perform('food');expect(h.w.finale.foodReady).toBe(false);c.cancel();targetDone();expect(h.w.farm.food).toBe(food);c.perform('food');expect(h.w.finale.foodReady).toBe(true);expect(h.w.farm.food).toBe(food-1);expect(h.w.reservoir.water).toBe(water)
 })
 it('九条赴席路线并行，各自抵达只算一次，最后一位之前不开席；中断不消耗备餐',()=>{
  const h=setup(readyFinale()),c=h.chapter,pending:(()=>void)[]=[];c.show();h.view.playPartnerTravel.mockImplementation((_id,r,step,done)=>{r.forEach(step);pending.push(done)});c.perform('feast');expect(pending).toHaveLength(8);expect(h.state().guests).toBe(1);for(const done of pending.slice(0,7)){done();done()}expect(h.state().guests).toBe(8);expect(h.w.finale.feasts).toBe(0);c.close();pending[7]!();expect(h.w.finale).toMatchObject({feasts:0,foodReady:true,waterReady:true});h.view.playPartnerTravel.mockImplementation((_id,r,step,done)=>{r.forEach(step);done()});c.show();c.primary();expect(h.w.finale.feasts).toBe(1);expect(h.state().guests).toBe(9)
 })
 it('每次落手只凿一格，过期回调不能凿下一段，停帧安全释放',()=>{
  const h=setup();h.chapter.show();h.chapter.primary();h.chapter.primary();let hit=()=>{},end=()=>{};h.view.playPartnerWork.mockImplementationOnce((_p,strike,done)=>{hit=strike;end=done});h.chapter.primary();const n=h.w.dugCount;hit();hit();expect(h.w.dugCount).toBe(n+1);h.chapter.cancel();end();expect(h.w.tiles[95][27]).toBe(TILE.EMPTY);expect(h.w.tiles[96][27]).toBe(TILE.ROCK);expect(deserialize(serialize(h.w))).toMatchObject({ok:true});h.chapter.primary();expect(finaleFrontier(h.w)).toBeNull()
  vi.useFakeTimers();const a=setup(workingFinale());Object.defineProperty(a.view,'frames',{value:0});a.view.playPartnerTravel.mockImplementationOnce(()=>{});a.chapter.show();a.chapter.perform('food');vi.advanceTimersByTime(3201);expect(a.state().busy).toBe(false);expect(a.w.finale.foodReady).toBe(false)
 })
 it('选择布置只改变意图，取消工作不改变；刷新与翻页不重复抢镜头',()=>{
  const h=setup(readyFinale()),c=h.chapter;c.show();c.chooseTheme('garden');let finish=()=>{};h.view.playPartnerWork.mockImplementationOnce((_p,_hit,done)=>{finish=done});c.primary();expect(h.w.finale.theme).toBe('lantern');c.close();finish();expect(h.w.finale.theme).toBe('lantern');c.show();const n=h.view.focusOn.mock.calls.length;c.refresh();c.refresh();expect(h.view.focusOn).toHaveBeenCalledTimes(n)
 })
 it('回望中断后从已读页继续，重读不改进度；终章后仍能休息、换布置和自由选址',()=>{
  const h=setup(readyFinale()),c=h.chapter;performFinale(h.w,'feast');c.show();c.primary();c.primary();c.primary();expect(h.w.finale.memoriesRead).toBe(2);c.close();c.show();expect(h.state().memoryIndex).toBe(2);expect(h.view.showFinalePanorama).toHaveBeenCalledTimes(1)
  const a=setup(completedFinale());a.chapter.panorama();expect(a.state()).toMatchObject({memoryIndex:0,replay:true});a.chapter.primary();expect(a.state().memoryIndex).toBe(1);expect(a.w.finale.memoriesRead).toBe(9);a.chapter.select('bench');a.chapter.tap({x:23,y:105});a.chapter.primary();a.chapter.select('bench');a.chapter.primary();expect(a.w.finale.rests).toBe(1);expect(a.w.finale.completed).toBe(true);expect(deserialize(serialize(a.w))).toMatchObject({ok:true})
 })
 it('后日谈再次聚餐连续交接食物、清水与九人赴席，保持永久通关',()=>{
  const h=setup(completedFinale());setWaterRoute(h.w,'closed');expect(performReservoir(h.w,'fill').ok).toBe(true);h.chapter.select('table');expect(h.state().label).toBe('请小满再送一份食物');h.chapter.primary();expect(h.state()).toMatchObject({selected:'table',label:'请团团再送一瓶清水'});h.chapter.primary();expect(h.state().label).toBe('再邀请九位伙伴来暖屋');h.chapter.primary();expect(h.w.finale).toMatchObject({completed:true,feasts:2,foodTrips:2,waterTrips:2,memoriesRead:9});expect(deserialize(serialize(h.w))).toMatchObject({ok:true})
 })
})
