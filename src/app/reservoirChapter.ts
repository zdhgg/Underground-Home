import { ChapterJourney } from './chapterJourney'
import { buildReservoir, reservoirActionProblem, reservoirBuildProblem, reservoirCostText, reservoirFacility, reservoirFacilityAt, reservoirGoal, reservoirReady, RESERVOIR_SPECS, performReservoir, setWaterRoute, type ReservoirAction, type ReservoirChange } from '../core/reservoir'
import { TUANTUAN_SPOT, SHELL_SPOT, REED_SPOT, reservoirCanalPath, reservoirFrontier, reservoirNetwork, reservoirShaftCell } from '../core/reservoirTopology'
import { partnerBed } from '../core/partners'
import { TILE, TILE_SIZE as T, type Cell, type ReservoirFacilityKind, type WaterRoute, type WorldState } from '../core/world'
import type { PixiWorldRenderer } from '../render/PixiRenderer'
import { playReservoirSound } from '../render/reservoirSound'

export interface ReservoirUI {
 finaleLift?:boolean;
  ruinsLift?:boolean;
  ventilationLift?:boolean;
  available: boolean; active: boolean; entered: boolean; joined: boolean; busy: boolean; completed: boolean; celebrating: boolean
  title: string; speaker: string; speech: string; label: string; hint: string; done: number
  placing: ReservoirFacilityKind | null; selected: ReservoirFacilityKind | null; candidate: number | null; valid: boolean
  water: number; valve: WaterRoute; routeChoice: WaterRoute | null; connected: boolean; irrigation: number; gardenDeliveries: number; hallDeliveries: number; bedded: boolean; lift: boolean
  buildings: { kind: ReservoirFacilityKind; name: string; built: boolean }[]
}
export const emptyReservoirUI = (): ReservoirUI => ({ available:false, active:false, entered:false, joined:false, busy:false, completed:false, celebrating:false, title:'', speaker:'', speech:'', label:'', hint:'', done:0, placing:null, selected:null, candidate:null, valid:false, water:0, valve:'closed', routeChoice:null, connected:false, irrigation:0, gardenDeliveries:0, hallDeliveries:0, bedded:false, lift:false, buildings:[] })
export class ReservoirChapter {
  private opened = false
  private placing: ReservoirFacilityKind | null = null
  private selected: ReservoirFacilityKind | null = null
  private candidate: number | null = null
  private routeChoice: WaterRoute | null = null
  private celebrating = false
  private welcoming = false
  private readonly journey: ChapterJourney
  get busy(): boolean { return this.journey.busy }
  get active(): boolean { return this.opened }
  constructor(private p: { world(): WorldState; view: PixiWorldRenderer; emit(s:ReservoirUI):void; changed():void; prepare():void; notify(s:string):void; record(c:ReservoirChange):void; dig(p:Cell):void; milestone(title:string,detail:string):void }) {
    this.journey = new ChapterJourney({ ...p, refresh:()=>this.refresh() })
  }
  refresh(): void {
    const w=this.p.world(), r=w.reservoir, goal=reservoirGoal(w)
    let {title,speaker,speech,label}=goal, hint=goal.action ? reservoirActionProblem(w,goal.action)??'' : ''
    if(this.selected) {
      title=RESERVOIR_SPECS[this.selected].name; speaker=this.selected==='intake'?'小泉':this.selected==='wheel'?'阿木':'团团'; speech=RESERVOIR_SPECS[this.selected].detail; label='看看下一件事'; hint=''
      if(this.selected==='basin'||this.selected==='intake') { label=r.valve!=='closed'?'先去关好分水闸':'蓄一池清水'; hint=reservoirActionProblem(w,'fill')??'看得见的三格水位，蓄满后自动停止。' }
      if(this.selected==='wheel') { label='转动水轮送清水'; hint=reservoirActionProblem(w,'pump')??`这一格清水送往${r.valve==='garden'?'菌光花园':'暖光大厅'}。` }
      if(this.selected==='gate') { label=!reservoirNetwork(w)?'请团团接通管渠':r.valve==='closed'?'把水闸转向菌光花园':'转动水轮送清水'; hint=reservoirNetwork(w)?`当前水路：${r.valve==='closed'?'关闭':r.valve==='garden'?'菌光花园':'暖光大厅'}。下方可以安静地选择另一条路。`:'先把四件设施之间的洞壁挖通。' }
    }
    if(this.routeChoice!==null) { title=this.routeChoice==='closed'?'关闭分水闸':`清水送往${this.routeChoice==='garden'?'菌光花园':'暖光大厅'}`; speaker='团团'; speech='你选好方向，我沿真实通道去转动闸柄。转好闸之后，清水还要经过水轮才会送出去。'; label='确认转动水闸'; hint='改变主意可以关闭面板；还没有转闸，也没有消耗存水。' }
    if(this.placing) {title=`摆放${RESERVOIR_SPECS[this.placing].name}`;speaker='阿土';speech='点一处喜欢的洞壁。绿框能建，红框会说明原因；拖动只移动地图。';label='就在这里建造';hint=this.candidate===null?reservoirCostText(this.placing):reservoirBuildProblem(w,this.placing,this.candidate)??`${reservoirCostText(this.placing)} · 可以建在这里`}
    if(this.welcoming){title='团团来帮忙啦';speaker='团团';speech='我是团团！小泉最会引水，我最会筑渠修闸。你选设施放哪儿，我把它们连成水路。也给我留一张床，好吗？';label='一起建设蓄水回廊';hint='接下来请阿木延长电梯，再由你自由选址。'}
    if(this.celebrating) {title='清水连回了八位伙伴的家';speaker='团团';speech='小泉引来清水，我们筑渠、蓄水、选好方向。花园的菌苗和大厅的长桌，都收到了新回廊的礼物。';label='继续建设蓄水回廊';hint='第六章完成，九层旅途继续。存水不会因离开而减少。'}
    if(this.busy) {label='';speech='伙伴正沿通道走到现场，完成动作后才扣材料、改变水位或送水。';hint='拖图可以看现场；点“停下来”保留已经完成的部分。'}
    this.p.emit({finaleLift:w.finale.liftExtended,ruinsLift:w.ruins.liftExtended,available:reservoirReady(w),ventilationLift:w.ventilation.liftExtended,active:this.opened,entered:r.entered,joined:r.metTuantuan,busy:this.busy,completed:r.completed,celebrating:this.celebrating,title,speaker,speech,label,hint,done:r.completed?18:goal.done,placing:this.placing,selected:this.selected,candidate:this.candidate,valid:this.placing!==null&&this.candidate!==null&&!reservoirBuildProblem(w,this.placing,this.candidate),water:r.water,valve:r.valve,routeChoice:this.routeChoice,connected:reservoirNetwork(w),irrigation:r.irrigation,gardenDeliveries:r.gardenDeliveries,hallDeliveries:r.hallDeliveries,bedded:!!partnerBed(w,'tuantuan'),lift:r.liftExtended,buildings:(Object.keys(RESERVOIR_SPECS) as ReservoirFacilityKind[]).map(kind=>({kind,name:RESERVOIR_SPECS[kind].name,built:!!reservoirFacility(w,kind)}))})
  }
  show(focus=false): void {
    if(this.busy||!reservoirReady(this.p.world()))return
    this.p.prepare();this.opened=true;this.selected=null;this.placing=null;this.candidate=null;this.routeChoice=null;this.celebrating=false;this.welcoming=false;this.p.view.setReservoirPreview?.(null,null)
    if(focus){const at=reservoirGoal(this.p.world()).target;this.p.view.focusOn((at.x+.5)*T,(at.y-1)*T,'building')}
    this.refresh()
  }
  close():void {if(this.busy)this.journey.cancel();this.opened=false;this.selected=null;this.placing=null;this.candidate=null;this.routeChoice=null;this.celebrating=false;this.welcoming=false;this.p.view.setReservoirPreview?.(null,null);this.p.view.releaseDeepCamera?.();this.refresh()}
  cancel():void {this.p.view.stopReservoirFlow?.();this.journey.cancel()}
  select(kind:ReservoirFacilityKind):void {
    if(this.busy)return
    this.show();const w=this.p.world(), f=reservoirFacility(w,kind);this.selected=f?kind:null;this.placing=f?null:kind
    this.p.view.focusOn(((f?.x??w.exploration.shaftX??27)+1.5)*T,69*T,'building');this.refresh()
  }
  chooseRoute(route:WaterRoute):void {if(this.busy||!reservoirNetwork(this.p.world()))return;this.selected='gate';this.placing=null;this.candidate=null;this.routeChoice=route;this.p.view.setReservoirPreview?.(null,null);this.refresh()}
  tap(cell:Cell):boolean {
    const w=this.p.world();if(!reservoirReady(w))return false;if(this.busy)return true
    if(this.placing){if(cell.y<67||cell.y>71){this.p.notify('在第 6 层的洞壁上选位置吧。');return true}this.candidate=cell.x;this.p.view.setReservoirPreview?.(this.placing,cell.x);this.refresh();return true}
    if(!w.reservoir.entered&&reservoirShaftCell(w,cell.x,cell.y)||w.reservoir.entered&&!w.reservoir.metTuantuan&&cell.y>=68&&cell.y<=70&&Math.abs(cell.x-TUANTUAN_SPOT.x)<=1){this.show();return true}
    const f=reservoirFacilityAt(w,cell);if(f){this.select(f.kind);return true}
    if(w.reservoir.entered&&cell.y===70&&w.tiles[70][cell.x]===TILE.EMPTY&&[SHELL_SPOT.x,REED_SPOT.x].includes(cell.x)){const key=cell.x===SHELL_SPOT.x?'foundShell':'foundReed';if(!w.reservoir[key]){w.reservoir[key]=true;this.p.changed();playReservoirSound('discovery')}this.p.notify(key==='foundShell'?'发现水纹贝印：岩壁里留下从前的小贝壳，水走过这里很久很久。':'发现芦苇小穗：细细的根曾贴着潮湿岩壁生长。它留在原地，故事记进物品栏。');return true}
    return false
  }
  primary():void {
    if(this.busy)return;if(this.welcoming){this.welcoming=false;this.refresh();return}if(this.celebrating){this.close();return}
    const w=this.p.world()
    if(this.placing){if(this.candidate===null)return;const kind=this.placing,x=this.candidate,problem=reservoirBuildProblem(w,kind,x);if(problem){this.p.notify(problem);return}
      this.journey.run({x,y:70},kind==='intake'?'xiaoquan':kind==='wheel'?'amu':'tuantuan',()=>{const r=buildReservoir(w,kind,x);if(r.ok){this.p.record(r.change);this.placing=null;this.candidate=null;this.p.view.setReservoirPreview?.(null,null);this.p.view.refresh();playReservoirSound('build')}this.p.notify(r.message);this.journey.finish()});return}
    if(this.routeChoice!==null){this.turn(this.routeChoice);return}
    if(this.selected){if(this.selected==='basin'||this.selected==='intake'){if(w.reservoir.valve!=='closed')this.chooseRoute('closed');else this.perform('fill')}else if(this.selected==='wheel')this.perform('pump');else if(this.selected==='gate'){if(!reservoirNetwork(w))this.perform('connect');else if(w.reservoir.valve==='closed')this.chooseRoute('garden');else this.perform('pump')}else{this.selected=null;this.refresh()}return}
    const g=reservoirGoal(w);if(g.build)this.select(g.build);else if(g.route)this.chooseRoute(g.route);else if(g.action)this.perform(g.action)
  }
  private turn(route:WaterRoute):void {
    const w=this.p.world(),gate=reservoirFacility(w,'gate');if(!gate||!reservoirNetwork(w))return
    this.journey.run(gate,'tuantuan',()=>{const result=setWaterRoute(w,route);if(result.ok){this.p.record(result.change);playReservoirSound('valve')}this.routeChoice=null;this.selected=null;this.p.notify(result.message);this.journey.finish()})
  }
  perform(action:ReservoirAction):void {
    if(this.busy)return;const w=this.p.world(),problem=reservoirActionProblem(w,action);if(problem){this.p.notify(problem);this.refresh();return}
    if(action==='excavate'){this.journey.excavate(()=>reservoirFrontier(w),p=>{this.p.dig(p);playReservoirSound('chisel')},()=>this.p.milestone('通到蓄水回廊啦！','止水护框与施工梯已经准备好'));return}
    const at=action==='meet'?{x:TUANTUAN_SPOT.x+1,y:70}:action==='fill'?reservoirFacility(w,'basin')!:action==='pump'?reservoirFacility(w,'wheel')!:action==='tour'?reservoirFacility(w,'intake')!:action==='connect'?reservoirFacility(w,'gate')!:{x:w.exploration.shaftX!,y:['inspect','shore'].includes(action)?58:70}
    this.p.view.beginDeepCamera?.();this.p.view.focusOn((at.x+.5)*T,(at.y-1)*T,'building')
    const done=()=>{const result=performReservoir(w,action);if(result.ok){if(!['inspect','enter','meet','tour'].includes(action))this.p.record(result.change);playReservoirSound(action==='fill'?'fill':action==='pump'?'pump':action==='tour'?'chapter':'discovery');if(action==='pump')this.p.view.playReservoirFlow?.(w.reservoir.valve);if(action==='meet'){this.welcoming=true;this.p.changed();this.p.view.refresh();this.p.milestone('团团来帮忙啦！','河狸 · 筑渠、修闸，把清水送到你选的地方')}if(action==='enter')this.p.milestone('第 6 层 · 蓄水回廊','蓄水、分流，给楼上的家送清水');if(action==='tour'){this.celebrating=true;this.p.milestone('第 6 章 · 清水回家','团团住下啦 · 花园和大厅都收到清水')}}this.p.notify(result.message);this.journey.finish()}
    if(action==='connect'){const path=reservoirCanalPath(w)!;this.journey.begin();this.journey.moveAtu(at,()=>this.journey.moveWorker('tuantuan',{x:path[0],y:70},()=>this.journey.work('tuantuan',{x:path.at(-1)!,y:70},done)));return}
    if(action==='tour'){const gate=reservoirFacility(w,'gate')!;this.journey.begin();this.journey.moveAtu(gate,()=>this.journey.moveAtu(at,()=>this.journey.moveWorker('tuantuan',{x:at.x+1,y:70},()=>this.journey.moveWorker('xiaoquan',{x:at.x+2,y:70},done))));return}
    this.journey.run(at,action==='shore'?'ayan':action==='extend'?'amu':action==='fill'?'xiaoquan':action==='pump'?'tuantuan':'atu',done)
  }
}
