import { ChapterJourney } from './chapterJourney'
import { RUINS_MOTIFS,RUINS_SPECS,RUINS_STORIES,buildRuins,performRuins,ruinsActionProblem,ruinsBuildProblem,ruinsCostText,ruinsFacility,ruinsFacilityAt,ruinsGoal,ruinsReady,ruinsStory,type RuinsAction,type RuinsChange } from '../core/ruins'
import { RUINS_MOTIF_SPOTS,SEAL_SPOT,FOOTPRINT_SPOT,ruinsFrontier,ruinsShaftCell } from '../core/ruinsTopology'
import { TILE,TILE_SIZE as T,type Cell,type RuinsFacilityKind,type RuinsMotif,type RuinsEdition,type WorldState } from '../core/world'
import type { PixiWorldRenderer } from '../render/PixiRenderer'
import { playRuinsSound } from '../render/ruinsSound'
export interface RuinsUI {
 finaleLift?:boolean;
 available:boolean;active:boolean;entered:boolean;busy:boolean;completed:boolean;celebrating:boolean
 title:string;speaker:string;speech:string;label:string;hint:string;done:number
 placing:RuinsFacilityKind|null;selected:RuinsFacilityKind|null;candidate:number|null;valid:boolean;motif:RuinsMotif|null
 edition:RuinsEdition;editionChoice:RuinsEdition|null;todayReady:boolean;lift:boolean;rests:number
 stories:{id:RuinsMotif;name:string;revealed:boolean;rubbed:boolean;mounted:boolean}[]
 buildings:{kind:RuinsFacilityKind;name:string;built:boolean}[]
}
export const emptyRuinsUI=():RuinsUI=>({available:false,active:false,entered:false,busy:false,completed:false,celebrating:false,title:'',speaker:'',speech:'',label:'',hint:'',done:0,placing:null,selected:null,candidate:null,valid:false,motif:null,edition:'together',editionChoice:null,todayReady:false,lift:false,rests:0,stories:[],buildings:[]})
export class RuinsChapter {
 private opened=false
 private placing:RuinsFacilityKind|null=null
 private selected:RuinsFacilityKind|null=null
 private candidate:number|null=null
 private motif:RuinsMotif|null=null
 private editionChoice:RuinsEdition|null=null
 private celebrating=false
 private readonly journey:ChapterJourney
 get busy():boolean{return this.journey.busy}
 get active():boolean{return this.opened}
 constructor(private p:{world():WorldState;view:PixiWorldRenderer;emit(s:RuinsUI):void;changed():void;prepare():void;notify(s:string):void;record(c:RuinsChange):void;dig(p:Cell):void}){this.journey=new ChapterJourney({...p,refresh:()=>this.refresh()})}
 private motifAction(m:RuinsMotif):RuinsAction|null{const r=this.p.world().ruins;return !r.revealed.includes(m)?'reveal':!r.rubbings.includes(m)?'rub':!r.mounted.includes(m)?'mount':null}
 refresh():void {
  const w=this.p.world(),r=w.ruins,g=ruinsGoal(w)
  let {title,speaker,speech,label}=g,hint=g.action?ruinsActionProblem(w,g.action,g.motif)??'':''
  if(this.selected){title=RUINS_SPECS[this.selected].name;speaker=this.selected==='light'?'阿灯':'阿木';speech=RUINS_SPECS[this.selected].detail;label='回到当前目标';hint=''
   if(this.selected==='desk'){const pending=RUINS_MOTIFS.find(m=>r.revealed.includes(m)&&!r.rubbings.includes(m));label=pending?'做这一段拓印':'回到当前目标';hint=pending?`当前拓印：${RUINS_STORIES[pending].name} · 旧木料 1`:'先去岩壁旁看清一段故事。'}
   if(this.selected==='mosaic'&&r.mounted.length===3){label='再亮起故事壁';hint='可以选围坐家园或一路建家，再确认。'}
   if(this.selected==='bench'){label='坐一坐听故事';hint='回忆留在原处，没有时间或食物消耗。'}
  }
  if(this.motif){const action=this.motifAction(this.motif);title=`岩壁故事 · ${RUINS_STORIES[this.motif].name}`;speaker=RUINS_STORIES[this.motif].speaker;speech=r.revealed.includes(this.motif)?ruinsStory(w,this.motif):'先到这段岩画旁边，用柔和的光看清旧纹路。';label=action==='reveal'?'和伙伴看看岩画':action==='rub'?'做这一段拓印':action==='mount'?'修复这一段故事':'看看下一段故事';hint=action?ruinsActionProblem(w,action,this.motif)??(action==='rub'?'旧木料 1 · 原画留在原处':'伙伴实际到场后才会变化。'):'这段故事已经修复好啦，随时可以回来再读。'}
  if(this.editionChoice){title='添上我们今天的家';speaker='阿土';speech=this.editionChoice==='together'?'九枚小爪印围坐成一圈，把现在的家添在旧故事旁。':'一条暖线串起我们走过的八层，继续把故事往下写。';label='确认添上这一页';hint='选择不会马上改变壁画；阿木到场完成后才添上。'}
  if(this.placing){title=`摆放${RUINS_SPECS[this.placing].name}`;speaker='阿土';speech='点喜欢的洞壁选位置。绿框能建，红框说明原因；拖动只移动地图。';label='就在这里建造';hint=this.candidate===null?ruinsCostText(this.placing):ruinsBuildProblem(w,this.placing,this.candidate)??ruinsCostText(this.placing)}
  if(this.celebrating){title='八层家园，故事还在继续';speaker='阿土';speech='旧岩画留下从前的家，我们添上了九位伙伴的新故事。更深的地心暖光，留给下一章。';label='继续布置旧地脉遗迹';hint='第八章完成，可以再读故事、换壁画呈现，或坐一坐。'}
  if(this.busy){label='';speech='伙伴正沿实际通道走到现场，完成后才扣材料、拓印或修复。';hint='随时停下来，已完成的部分保留。'}
  this.p.emit({finaleLift:w.finale.liftExtended,available:ruinsReady(w),active:this.opened,entered:r.entered,busy:this.busy,completed:r.completed,celebrating:this.celebrating,title,speaker,speech,label,hint,done:r.completed?19:g.done,placing:this.placing,selected:this.selected,candidate:this.candidate,valid:this.placing!==null&&this.candidate!==null&&!ruinsBuildProblem(w,this.placing,this.candidate),motif:this.motif,edition:r.edition,editionChoice:this.editionChoice,todayReady:r.todayReady,lift:r.liftExtended,rests:r.rests,stories:RUINS_MOTIFS.map(id=>({id,name:RUINS_STORIES[id].name,revealed:r.revealed.includes(id),rubbed:r.rubbings.includes(id),mounted:r.mounted.includes(id)})),buildings:(Object.keys(RUINS_SPECS)as RuinsFacilityKind[]).map(kind=>({kind,name:RUINS_SPECS[kind].name,built:!!ruinsFacility(w,kind)}))})
 }
 show(focus=false):void{if(this.busy||!ruinsReady(this.p.world()))return;this.p.prepare();this.opened=true;this.selected=null;this.placing=null;this.candidate=null;this.motif=null;this.editionChoice=null;this.celebrating=false;this.p.view.setRuinsPreview?.(null,null);if(focus){const at=ruinsGoal(this.p.world()).target;this.p.view.focusOn((at.x+.5)*T,(at.y-1)*T,'building')}this.refresh()}
 close():void{if(this.busy)this.journey.cancel();this.opened=false;this.selected=null;this.placing=null;this.candidate=null;this.motif=null;this.editionChoice=null;this.celebrating=false;this.p.view.setRuinsPreview?.(null,null);this.p.view.releaseDeepCamera?.();this.refresh()}
 cancel():void{this.journey.cancel()}
 select(kind:RuinsFacilityKind):void{if(this.busy)return;this.show();const f=ruinsFacility(this.p.world(),kind);this.selected=f?kind:null;this.placing=f?null:kind;this.p.view.focusOn(((f?.x??this.p.world().exploration.shaftX??27)+1.5)*T,93*T,'building');this.refresh()}
 chooseMotif(m:RuinsMotif):void{if(this.busy||!this.p.world().ruins.entered)return;this.show();this.motif=m;const at=RUINS_MOTIF_SPOTS[m];this.p.view.focusOn((at.x+.5)*T,92*T,'building');this.refresh()}
 chooseEdition(edition:RuinsEdition):void{if(this.busy||this.p.world().ruins.mounted.length!==3)return;this.selected='mosaic';this.motif=null;this.placing=null;this.candidate=null;this.editionChoice=edition;this.p.view.setRuinsPreview?.(null,null);this.refresh()}
 tap(cell:Cell):boolean {
  const w=this.p.world();if(!ruinsReady(w))return false;if(this.busy)return true
  if(this.placing){if(cell.y<91||cell.y>95){this.p.notify('在第八层洞壁选一个位置吧。');return true}this.candidate=cell.x;this.p.view.setRuinsPreview?.(this.placing,cell.x);this.refresh();return true}
  if(!w.ruins.entered&&ruinsShaftCell(w,cell.x,cell.y)){this.show();return true}
  if(w.ruins.entered&&[91,92].includes(cell.y)&&w.tiles[cell.y][cell.x]===TILE.EMPTY){const m=RUINS_MOTIFS.find(m=>RUINS_MOTIF_SPOTS[m].x===cell.x);if(m){this.chooseMotif(m);return true}}
  if(w.ruins.entered&&cell.y===94&&w.tiles[94][cell.x]===TILE.EMPTY&&[SEAL_SPOT.x,FOOTPRINT_SPOT.x].includes(cell.x)){const k=cell.x===SEAL_SPOT.x?'foundSeal':'foundFootprint';if(!w.ruins[k]){w.ruins[k]=true;this.p.changed();playRuinsSound('discovery');this.p.notify(k==='foundSeal'?'发现旧石印：岩层里的小小印纹，像以前住户留下的记号。':'发现小爪印：一排小印子朝着旧故事壁，原来从前也有人一起走过。');return true}}
  const f=ruinsFacilityAt(w,cell);if(f){this.select(f.kind);return true}return false
 }
 primary():void {
  if(this.busy)return;if(this.celebrating){this.close();return}const w=this.p.world()
  if(this.placing){if(this.candidate===null)return;const kind=this.placing,x=this.candidate,problem=ruinsBuildProblem(w,kind,x);if(problem){this.p.notify(problem);return}this.journey.run({x,y:94},kind==='light'?'adeng':'amu',()=>{const result=buildRuins(w,kind,x);if(result.ok){this.p.record(result.change);this.placing=null;this.candidate=null;this.p.view.setRuinsPreview?.(null,null);this.p.view.refresh();playRuinsSound('build')}this.p.notify(result.message);this.journey.finish()});return}
  if(this.editionChoice){this.perform('showcase',undefined,this.editionChoice);return}
  if(this.motif){const action=this.motifAction(this.motif);if(action)this.perform(action,this.motif);else{this.motif=null;this.refresh()}return}
  if(this.selected){if(this.selected==='bench')this.perform('rest');else if(this.selected==='mosaic'&&w.ruins.mounted.length===3)this.chooseEdition(w.ruins.edition);else if(this.selected==='desk'){const m=RUINS_MOTIFS.find(m=>w.ruins.revealed.includes(m)&&!w.ruins.rubbings.includes(m));if(m){this.motif=m;this.perform('rub',m)}else{this.selected=null;this.refresh()}}else{this.selected=null;this.refresh()}return}
  const g=ruinsGoal(w);if(g.build)this.select(g.build);else if(g.action==='showcase')this.chooseEdition(w.ruins.edition);else if(g.action)this.perform(g.action,g.motif)
 }
 perform(action:RuinsAction,motif?:RuinsMotif,edition?:RuinsEdition):void {
  if(this.busy)return;const w=this.p.world(),problem=ruinsActionProblem(w,action,motif);if(problem){this.p.notify(problem);this.refresh();return}
  if(action==='excavate'){this.journey.excavate(()=>ruinsFrontier(w),p=>{this.p.dig(p);playRuinsSound('chisel')},()=>{});return}
  const at=action==='reveal'?RUINS_MOTIF_SPOTS[motif!]:action==='rub'?ruinsFacility(w,'desk')!:['mount','showcase','walk'].includes(action)?ruinsFacility(w,'mosaic')!:action==='rest'?ruinsFacility(w,'bench')!:{x:w.exploration.shaftX!,y:['inspect','brace'].includes(action)?82:94}
  this.p.view.beginDeepCamera?.();this.p.view.focusOn((at.x+.5)*T,(at.y-1)*T,'building')
  const done=()=>{const result=performRuins(w,action,motif,edition);if(result.ok){if(!['inspect','enter','reveal','walk'].includes(action))this.p.record(result.change);this.selected=null;this.editionChoice=null;this.motif=action==='reveal'||action==='rub'?motif!:null;if(action==='walk')this.celebrating=true;playRuinsSound(action==='reveal'?'discovery':action==='rub'?'rubbing':action==='mount'?'restore':action==='showcase'?'light':action==='walk'?'chapter':'build')}this.p.notify(result.message);this.journey.finish()}
  if(action==='walk'){this.journey.begin();this.journey.moveAtu(at,()=>this.journey.moveWorker('adeng',{x:at.x+1,y:94},()=>this.journey.moveWorker('amu',{x:at.x+2,y:94},done)));return}
  const actor=action==='inspect'?'lingling':action==='brace'?'ayan':action==='enter'||action==='rest'?'atu':action==='reveal'?motif==='lamp'?'adeng':motif==='spring'?'xiaoquan':'amu':'amu'
  this.journey.run(at,actor,done)
 }
}
