import { ChapterJourney } from './chapterJourney'
import { buildVentilation, chooseWindCraft, performVentilation, setAirMode, ventilationActionProblem, ventilationBuildProblem, ventilationCandidate, ventilationCostText, ventilationFacility, ventilationFacilityAt, ventilationGoal, ventilationReady, VENTILATION_SPECS, type VentilationAction, type VentilationChange } from '../core/ventilation'
import { canDig } from '../core/dig'
import { LINGLING_SPOT,ECHO_SPOT,VANE_SPOT,VENTILATION_FOOT,VENTILATION_TOP,ventilationDuctPath,ventilationFrontier,ventilationNetwork,ventilationShaftCell,ventilationWidth } from '../core/ventilationTopology'
import { partnerBed } from '../core/partners'
import { TILE,TILE_SIZE as T,type Cell,type VentilationFacilityKind,type AirMode,type WindCraft,type WorldState } from '../core/world'
import type { PixiWorldRenderer } from '../render/PixiRenderer'
import type { GuideSpot } from '../render/guideFocus'
import { playVentilationSound } from '../render/ventilationSound'
export interface VentilationUI {
 finaleLift?:boolean;
  ruinsLift?:boolean;
  available:boolean;active:boolean;entered:boolean;joined:boolean;busy:boolean;completed:boolean;celebrating:boolean
  title:string;speaker:string;speech:string;label:string;hint:string;done:number
  header:string;scout:boolean
  placing:VentilationFacilityKind|null;selected:VentilationFacilityKind|null;candidate:number|null;valid:boolean
  mode:AirMode;modeChoice:AirMode|null;connected:boolean;tested:boolean;variety:WindCraft;readyCraft:WindCraft|null;hallArt:WindCraft|null;crafts:number;gifts:number;bedded:boolean;lift:boolean
  buildings:{kind:VentilationFacilityKind;name:string;built:boolean}[]
}
export const emptyVentilationUI=():VentilationUI=>({available:false,active:false,entered:false,joined:false,busy:false,completed:false,celebrating:false,header:'',scout:false,title:'',speaker:'',speech:'',label:'',hint:'',done:0,placing:null,selected:null,candidate:null,valid:false,mode:'off',modeChoice:null,connected:false,tested:false,variety:'chime',readyCraft:null,hallArt:null,crafts:0,gifts:0,bedded:false,lift:false,buildings:[]})
export class VentilationChapter {
  private opened=false
  private placing:VentilationFacilityKind|null=null
  private selected:VentilationFacilityKind|null=null
  private candidate:number|null=null
  private hoverX:number|null=null
  private modeChoice:AirMode|null=null
  private celebrating=false
  private welcoming=false
  /** "我自己去地图上找"：面板收起、目标继续在地图上发光，点到目标照常交接回面板。 */
  private scouting=false
  private readonly journey:ChapterJourney
  get busy():boolean{return this.journey.busy}
  get active():boolean{return this.opened}
  get placingKind():VentilationFacilityKind|null{return this.placing}
  placingCell(p:Cell|null):boolean{const w=this.p.world();return this.placing!==null&&!!p&&p.y>=79&&p.y<=83&&!canDig(w,p.x,p.y).ok}
  hover(p:Cell|null):void{
   if(!this.placing||this.busy||this.candidate!==null)return
   const x=this.placingCell(p)?ventilationCandidate(this.p.world(),this.placing,p!.x):null
   if(x===this.hoverX)return
   this.hoverX=x;this.p.view.setVentilationPreview?.(this.placing,x)
  }
  constructor(private p:{world():WorldState;view:PixiWorldRenderer;emit(s:VentilationUI):void;changed():void;prepare():void;notify(s:string):void;record(c:VentilationChange):void;dig(p:Cell):void}){this.journey=new ChapterJourney({...p,refresh:()=>this.refresh()})}
  refresh():void {
    const w=this.p.world(),v=w.ventilation,g=ventilationGoal(w)
    let {title,speaker,speech,label}=g,hint=g.action?ventilationActionProblem(w,g.action)??'':'',header='第 7 章 · 听风工区'
    if(this.selected){title=VENTILATION_SPECS[this.selected].name;speaker=this.selected==='bench'||this.selected==='fan'?'阿木':'铃铃';speech=VENTILATION_SPECS[this.selected].detail;hint='';label='看看下一件事';header=`${speaker}的${VENTILATION_SPECS[this.selected].name} · 第 7 层`
      if(this.selected==='fan'){label='选择家园微风';hint='下方可选关机、家园微风、工区风。确认后伙伴才会调节。'}
      if(this.selected==='inlet'){label='请铃铃沿洞壁听风';hint=ventilationActionProblem(w,'trace')??''}
      if(this.selected==='baffle'){label='请铃铃检查飘带';hint=ventilationActionProblem(w,'test')??''}
      if(this.selected==='bench'){label=v.readyCraft?'一起送到大厅':'做一件小手作';hint=ventilationActionProblem(w,v.readyCraft?'gift':'craft')??'旧木料 1 · 部件 1。空台时可以换一种作品。'}
    }
    if(this.modeChoice!==null){title=this.modeChoice==='off'?'让风机安静停下':this.modeChoice==='home'?'选择家园微风':'选择工区风';speaker='铃铃';speech='方向和声音都选好了？我到风机旁调节百叶，确认后才会变化。';label='确认调节风机';hint='改变主意可以收起面板，还没有调节或扣材料。'}
    if(this.placing){title=`摆放${VENTILATION_SPECS[this.placing].name}`;speaker='阿土';speech='点喜欢的洞壁，绿框能建，红框会说明原因。拖动只移动地图。';label='就在这里建造';hint=this.candidate===null?`${ventilationCostText(this.placing)} · 点泥土先挖开，点空洞放影子。`:ventilationBuildProblem(w,this.placing,this.candidate)??ventilationCostText(this.placing)}
    if(this.welcoming){title='铃铃听见风啦';speaker='铃铃';speech='我是铃铃！大耳朵能听见风经过哪里。你选设施的位置，我沿真实通道找风路。也给我留一张床吧！';label='一起建设听风工区';hint='读完再进入电梯和自由建设目标。'}
    if(this.celebrating){title='九位伙伴，听见同一阵风';speaker='铃铃';speech='旧风口连起来啦，作品也挂进了大厅。工区能继续做手作，家园能吹柔和的风！';label='继续建设听风工区';hint='第七章完成，第八、九层仍等着我们。'}
    if(this.busy){label='';speech='伙伴正沿通道到现场。工作完成后才扣材料、调风机或送作品。';hint='随时停下来；已完成的部分保留，旧回调不会补做。'}
    this.p.view.setVentilationPreview?.(this.placing,this.candidate??this.hoverX)
    // 行动类小步在地图上亮出发生地点：目标是已建设施就框整座，其余框目标格。
    let focusSpot: GuideSpot | null = null
    if ((this.opened || this.scouting) && !this.busy && !this.placing && !this.selected && !this.celebrating && !this.welcoming && this.modeChoice === null && !g.build && g.target) {
      const f = ventilationFacilityAt(w, g.target)
      focusSpot = f ? { x: f.x, y: VENTILATION_TOP, w: ventilationWidth(f.kind), h: VENTILATION_FOOT - VENTILATION_TOP + 1 } : { x: g.target.x, y: g.target.y, w: 1, h: 1 }
    }
    this.p.view.setGuideFocus?.(this, focusSpot)
    this.p.emit({finaleLift:w.finale.liftExtended,ruinsLift:w.ruins.liftExtended,available:ventilationReady(w),active:this.opened,entered:v.entered,joined:v.metLingling,busy:this.busy,header,scout:!this.busy&&!this.placing&&!this.selected&&!this.celebrating&&!this.welcoming&&this.modeChoice===null&&!g.build&&!!g.target,completed:v.completed,celebrating:this.celebrating,title,speaker,speech,label,hint,done:v.completed?19:g.done,placing:this.placing,selected:this.selected,candidate:this.candidate,valid:this.placing!==null&&this.candidate!==null&&!ventilationBuildProblem(w,this.placing,this.candidate),mode:v.mode,modeChoice:this.modeChoice,connected:ventilationNetwork(w),tested:v.tested,variety:v.variety,readyCraft:v.readyCraft,hallArt:v.hallArt,crafts:v.crafts,gifts:v.gifts,bedded:!!partnerBed(w,'lingling'),lift:v.liftExtended,buildings:(Object.keys(VENTILATION_SPECS)as VentilationFacilityKind[]).map(kind=>({kind,name:VENTILATION_SPECS[kind].name,built:!!ventilationFacility(w,kind)}))})
  }
  show(focus=false):void {
    if(this.busy||!ventilationReady(this.p.world()))return
    this.p.prepare();this.opened=true;this.scouting=false;this.selected=null;this.placing=null;this.candidate=null;this.hoverX=null;this.modeChoice=null;this.celebrating=false;this.welcoming=false;this.p.view.setVentilationPreview?.(null,null)
    if(focus){const at=ventilationGoal(this.p.world()).target;this.p.view.focusOn((at.x+.5)*T,(at.y-1)*T,'building')}
    this.refresh()
  }
  close():void{if(this.busy)this.journey.cancel();this.opened=false;this.scouting=false;this.selected=null;this.placing=null;this.candidate=null;this.hoverX=null;this.modeChoice=null;this.welcoming=false;this.celebrating=false;this.p.view.setVentilationPreview?.(null,null);this.p.view.releaseDeepCamera?.();this.refresh()}
  /** "我自己去地图上找"：收起面板，镜头指到这一步发生的地方，目标继续发光等孩子来点。 */
  scout():void{if(this.busy||this.placing||this.selected||this.celebrating||this.welcoming||this.modeChoice!==null)return
    const g=ventilationGoal(this.p.world());if(g.build||!g.target)return
    this.opened=false;this.scouting=true;this.p.view.focusOn((g.target.x+.5)*T,(g.target.y-1)*T,'building');this.refresh()}
  cancel():void{this.journey.cancel()}
  select(kind:VentilationFacilityKind):void {
    if(this.busy)return;this.show();const f=ventilationFacility(this.p.world(),kind);this.selected=f?kind:null;this.placing=f?null:kind
    this.p.view.focusOn(((f?.x??this.p.world().exploration.shaftX??27)+1.5)*T,81*T,'building');this.refresh()
  }
  chooseMode(mode:AirMode):void{if(this.busy||!ventilationNetwork(this.p.world()))return;this.selected='fan';this.placing=null;this.candidate=null;this.hoverX=null;this.modeChoice=mode;this.p.view.setVentilationPreview?.(null,null);this.refresh()}
  changeVariety():void{if(this.busy)return;const w=this.p.world();if(chooseWindCraft(w,w.ventilation.variety==='chime'?'mobile':'chime')){this.p.changed();this.refresh()}}
  tap(cell:Cell):boolean {
    const w=this.p.world();if(!ventilationReady(w))return false;if(this.busy)return true
    if(this.placing){if(cell.y<79||cell.y>83){this.p.notify('在第七层洞壁选一个位置吧。');return true}
      // 点到还盖着的泥土或矿脉：照旧挖开（可撤销），影子留着，挖完再点空洞放置。
      if(canDig(w,cell.x,cell.y).ok)return false
      this.candidate=ventilationCandidate(w,this.placing,cell.x);this.hoverX=null;this.p.view.setVentilationPreview?.(this.placing,this.candidate);this.refresh();return true}
    if(!w.ventilation.entered&&ventilationShaftCell(w,cell.x,cell.y)||w.ventilation.entered&&!w.ventilation.metLingling&&cell.y>=80&&cell.y<=82&&Math.abs(cell.x-LINGLING_SPOT.x)<=1){this.show();return true}
    if(w.ventilation.entered&&cell.y===82&&w.tiles[82][cell.x]===TILE.EMPTY&&[ECHO_SPOT.x,VANE_SPOT.x].includes(cell.x)){
      const key=cell.x===ECHO_SPOT.x?'foundEcho':'foundVane'
      if(!w.ventilation[key]){
        w.ventilation[key]=true;this.p.changed();playVentilationSound('echo')
        this.p.notify(key==='foundEcho'?'发现回声石：圆圆岩窝把细小的风声送回来。它留在原处，故事记进物品栏。':'发现旧风标：旧伙伴也用小飘带观察风，细细的线还留在岩壁里。')
        return true
      }
    }
    const f=ventilationFacilityAt(w,cell);if(f){this.select(f.kind);return true}
    return false
  }
  primary():void {
    if(this.busy)return;if(this.welcoming){this.welcoming=false;this.refresh();return}if(this.celebrating){this.close();return}
    const w=this.p.world()
    if(this.placing){if(this.candidate===null)return;const kind=this.placing,x=this.candidate,problem=ventilationBuildProblem(w,kind,x);if(problem){this.p.notify(problem);return}this.journey.run({x,y:82},kind==='fan'||kind==='bench'?'amu':'lingling',()=>{const r=buildVentilation(w,kind,x);if(r.ok){this.p.record(r.change);this.placing=null;this.candidate=null;this.hoverX=null;this.p.view.setVentilationPreview?.(null,null);this.p.view.refresh();playVentilationSound('build')}this.p.notify(r.message);this.journey.finish()});return}
    if(this.modeChoice!==null){const mode=this.modeChoice,fan=ventilationFacility(w,'fan')!;this.journey.run(fan,'lingling',()=>{const r=setAirMode(w,mode);if(r.ok){this.p.record(r.change);playVentilationSound('wind')}this.modeChoice=null;this.selected=null;this.p.notify(r.message);this.journey.finish()});return}
    if(this.selected){if(this.selected==='fan')this.chooseMode('home');else if(this.selected==='inlet')this.perform('trace');else if(this.selected==='baffle')this.perform('test');else if(this.selected==='bench')this.perform(w.ventilation.readyCraft?'gift':'craft');else{this.selected=null;this.refresh()}return}
    const g=ventilationGoal(w);if(g.build)this.select(g.build);else if(g.mode)this.chooseMode(g.mode);else if(g.action)this.perform(g.action)
  }
  perform(action:VentilationAction):void {
    if(this.busy)return;const w=this.p.world(),problem=ventilationActionProblem(w,action);if(problem){this.p.notify(problem);this.refresh();return}
    if(action==='excavate'){this.journey.excavate(()=>ventilationFrontier(w),p=>{this.p.dig(p);playVentilationSound('chisel')},()=>{});return}
    const bench=ventilationFacility(w,'bench'),at=action==='meet'?{x:LINGLING_SPOT.x-1,y:82}:['craft','gift','tour'].includes(action)?bench!:['trace','test'].includes(action)?ventilationFacility(w,'baffle')!:{x:w.exploration.shaftX!,y:['inspect','brace'].includes(action)?70:82}
    this.p.view.beginDeepCamera?.();this.p.view.focusOn((at.x+.5)*T,(at.y-1)*T,'building')
    const done=()=>{const r=performVentilation(w,action);if(r.ok){if(!['inspect','enter','meet','tour'].includes(action))this.p.record(r.change);if(action==='meet'){this.welcoming=true;this.p.changed();this.p.view.refresh()}if(['trace','test','craft','gift'].includes(action))this.selected=null;if(action==='tour')this.celebrating=true;playVentilationSound(action==='craft'?'craft':action==='gift'?'chime':action==='tour'?'chapter':action==='trace'?'echo':'wind')}this.p.notify(r.message);this.journey.finish()}
    if(action==='trace'){const path=ventilationDuctPath(w)!;this.journey.begin();this.journey.moveParty([at],[{id:'lingling',to:{x:path[0],y:82}}],()=>this.journey.work('lingling',{x:path.at(-1)!,y:82},done));return}
    if(action==='gift'){const hall=w.hall.facilities.find(f=>f.kind==='hall')!,home={x:hall.x+4,y:46};this.journey.begin();this.journey.moveAtu(at,()=>this.journey.work('amu',at,()=>this.journey.moveParty([home],[{id:'lingling',to:{x:home.x+1,y:46}}],()=>{this.p.view.finishChapterArrival?.(home);done()})));return}
    if(action==='tour'){this.journey.begin();this.journey.moveParty([at],[{id:'lingling',to:{x:at.x+1,y:82}},{id:'amu',to:{x:at.x+2,y:82}}],done);return}
    this.journey.run(at,action==='brace'?'ayan':action==='extend'||action==='craft'?'amu':action==='test'?'lingling':'atu',done)
  }
}
