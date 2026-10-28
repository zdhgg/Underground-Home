import { ChapterJourney } from './chapterJourney'
import { FINALE_MEMORIES,FINALE_PARTNERS,FINALE_SPECS,buildFinale,finaleActionProblem,finaleBuildProblem,finaleCostText,finaleFacility,finaleFacilityAt,finaleGoal,finaleOrigin,finaleReady,finaleSeats,performFinale,type FinaleAction,type FinaleChange } from '../core/finale'
import { WARMTH_SPOT,finaleFrontier,finaleShaftCell } from '../core/finaleTopology'
import { TILE,TILE_SIZE as T,type Cell,type FinaleFacilityKind,type FinaleTheme,type WorkerId,type WorldState } from '../core/world'
import type { PixiWorldRenderer } from '../render/PixiRenderer'
import { playFinaleSound } from '../render/finaleSound'
import { HOME_OWNER, HOME_TITLE, WARM_CRYSTAL } from '../core/personal'
export interface FinaleUI{
 available:boolean;active:boolean;entered:boolean;busy:boolean;completed:boolean;celebrating:boolean;foundWarmth:boolean
 title:string;speaker:string;speech:string;label:string;hint:string;done:number
 placing:FinaleFacilityKind|null;selected:FinaleFacilityKind|null;candidate:number|null;valid:boolean
 warmthIntro:boolean;theme:FinaleTheme;themeChoice:FinaleTheme|null;foodReady:boolean;waterReady:boolean;chimePlaced:boolean;woven:boolean;lit:boolean;lift:boolean
 guests:number;memoryIndex:number|null;replay:boolean;feasts:number
 buildings:{kind:FinaleFacilityKind;name:string;built:boolean}[]
}
export const emptyFinaleUI=():FinaleUI=>({available:false,active:false,entered:false,busy:false,completed:false,celebrating:false,foundWarmth:false,title:'',speaker:'',speech:'',label:'',hint:'',done:0,placing:null,selected:null,candidate:null,valid:false,warmthIntro:false,theme:'lantern',themeChoice:null,foodReady:false,waterReady:false,chimePlaced:false,woven:false,lit:false,lift:false,guests:0,memoryIndex:null,replay:false,feasts:0,buildings:[]})
export class FinaleChapter{
 private opened=false
 private placing:FinaleFacilityKind|null=null
 private selected:FinaleFacilityKind|null=null
 private candidate:number|null=null
 private themeChoice:FinaleTheme|null=null
 private celebrating=false
 private page:number|null=null
 private guests=0
 private phase=''
 private warmthIntro=false
 private readonly journey:ChapterJourney
 get active():boolean{return this.opened}
 get busy():boolean{return this.journey.busy}
 constructor(private p:{world():WorldState;view:PixiWorldRenderer;emit(s:FinaleUI):void;changed():void;prepare():void;notify(s:string):void;record(c:FinaleChange):void;dig(p:Cell):void}){this.journey=new ChapterJourney({...p,refresh:()=>this.refresh()})}
 refresh():void{
  const w=this.p.world(),r=w.finale,g=finaleGoal(w);let{title,speaker,speech,label}=g,hint=g.action?finaleActionProblem(w,g.action)??'':''
  let memoryIndex:number|null=!this.selected&&!this.placing&&!this.themeChoice&&r.reviewOpened&&r.memoriesRead<9?r.memoriesRead:null
  if(this.selected){title=FINALE_SPECS[this.selected].name;speaker='阿土';speech=FINALE_SPECS[this.selected].detail;label='回到当前目标';hint=''
   if(this.selected==='table'&&r.decorations){const a=!r.foodReady?'food':!r.waterReady?'water':'feast';label=a==='food'?'请小满再送一份食物':a==='water'?'请团团再送一瓶清水':'再邀请九位伙伴来暖屋';hint=finaleActionProblem(w,a)??'食物和清水已备好，到齐后再开席。'}
   if(this.selected==='memory'&&r.storyReady){const m=FINALE_MEMORIES[this.page??0];title=m.title;speaker=m.speaker;speech=m.text;label=(this.page??0)<8?'看看下一页':'收起家园相册';memoryIndex=this.page??0;hint='这是重读，不改变已完成的终章进度。'}
   if(this.selected==='bench'){label='坐一坐听风铃';hint=finaleActionProblem(w,'rest')??'不消耗时间或食物，随时离开。'}
  }
  if(this.warmthIntro){title=`原来是${WARM_CRYSTAL}`;speaker='阿土';speech=`${HOME_OWNER}，这束温柔的金色，来自岩壁里一颗心形暖晶。把它留在原处，我们在旁边建一个九位伙伴都能来的家。`;label='把暖晶留在原处，继续建家';hint='原晶体不挖走，发现已记进家园相册。';memoryIndex=null}
  if(this.themeChoice){title='为暖屋日选个布置';speaker='铃铃';speech=this.themeChoice==='lantern'?'小暖灯围着长桌，风铃在石拱下轻轻响。':'菌叶花边围着长桌，小暖灯藏在叶子旁。';label='确认布置暖屋日';hint='选项只表示打算，铃铃到场完成后才改变。'}
  if(this.placing){title=`摆放${FINALE_SPECS[this.placing].name}`;speaker='阿土';speech='点喜欢的洞壁选位置。绿框能建，红框告诉你原因；拖动只移动地图。';label='就在这里建造';hint=this.candidate===null?finaleCostText(this.placing):finaleBuildProblem(w,this.placing,this.candidate)??finaleCostText(this.placing)}
  if(this.celebrating){title=`${HOME_TITLE}，终章完成`;speaker='阿土';speech=`${HOME_OWNER}，从第一盏灯到地心暖光，每一层都留下了你的选择。九位伙伴和所有设施都还在，接着把家建成你喜欢的样子吧。`;label='继续自由建设';hint='相册记住这一天，还能重读故事、再办暖屋日。';memoryIndex=null}
  if(this.busy){label='';speech=this.phase||'伙伴正沿真实通道走到现场，完成后才改变家园。';hint='随时停下来，食物和清水在送到长桌后才扣除。';memoryIndex=null}
  this.p.emit({available:finaleReady(w),active:this.opened,entered:r.entered,busy:this.busy,completed:r.completed,celebrating:this.celebrating,foundWarmth:r.foundWarmth,warmthIntro:this.warmthIntro,title,speaker,speech,label,hint,done:g.done,placing:this.placing,selected:this.selected,candidate:this.candidate,valid:this.placing!==null&&this.candidate!==null&&!finaleBuildProblem(w,this.placing,this.candidate),theme:r.theme,themeChoice:this.themeChoice,foodReady:r.foodReady,waterReady:r.waterReady,chimePlaced:r.chimePlaced,woven:r.woven,lit:r.lit,lift:r.liftExtended,guests:this.guests,memoryIndex,replay:this.selected==='memory'&&r.storyReady,feasts:r.feasts,buildings:(Object.keys(FINALE_SPECS)as FinaleFacilityKind[]).map(kind=>({kind,name:FINALE_SPECS[kind].name,built:!!finaleFacility(w,kind)}))})
 }
 show(focus=false):void{if(this.busy||!finaleReady(this.p.world()))return;this.p.prepare();this.opened=true;this.selected=null;this.placing=null;this.candidate=null;this.themeChoice=null;this.celebrating=false;this.page=null;this.guests=0;this.warmthIntro=false;this.p.view.setFinalePreview?.(null,null);if(focus){const at=finaleGoal(this.p.world()).target;this.p.view.focusOn((at.x+.5)*T,(at.y-1)*T,'building')}this.refresh()}
 close():void{if(this.busy)this.journey.cancel();this.opened=false;this.selected=null;this.placing=null;this.candidate=null;this.themeChoice=null;this.celebrating=false;this.page=null;this.guests=0;this.warmthIntro=false;this.p.view.setFinalePreview?.(null,null);this.p.view.releaseDeepCamera?.();this.refresh()}
 cancel():void{this.journey.cancel()}
 panorama():void{if(this.busy||!this.p.world().finale.completed)return;this.show();this.selected='memory';this.page=0;this.p.view.showFinalePanorama?.();this.refresh()}
 select(kind:FinaleFacilityKind):void{if(this.busy)return;this.show();const f=finaleFacility(this.p.world(),kind);this.selected=f?kind:null;this.placing=f?null:kind;this.page=kind==='memory'&&f?0:null;this.p.view.focusOn(((f?.x??this.p.world().exploration.shaftX??27)+1.5)*T,105*T,'building');this.refresh()}
 chooseTheme(theme:FinaleTheme):void{const r=this.p.world().finale;if(this.busy||!r.chimePlaced||!r.woven)return;this.selected=null;this.placing=null;this.candidate=null;this.themeChoice=theme;this.p.view.setFinalePreview?.(null,null);this.refresh()}
 tap(cell:Cell):boolean{
  const w=this.p.world();if(!finaleReady(w))return false;if(this.busy)return true
  if(this.placing){if(cell.y<103||cell.y>107){this.p.notify('在第九层洞壁选一个位置吧。');return true}this.candidate=cell.x;this.p.view.setFinalePreview?.(this.placing,cell.x);this.refresh();return true}
  if(!w.finale.entered&&finaleShaftCell(w,cell.x,cell.y)){this.show();return true}
  if(w.finale.entered&&[103,104].includes(cell.y)&&cell.x===WARMTH_SPOT.x&&w.tiles[cell.y][cell.x]===TILE.EMPTY){this.show();if(!w.finale.foundWarmth)this.perform('discover');else{this.warmthIntro=true;this.refresh()}return true}
  const f=finaleFacilityAt(w,cell);if(f){this.select(f.kind);return true}return false
 }
 primary():void{
  if(this.busy)return;const w=this.p.world(),r=w.finale
  if(this.celebrating){this.close();return}
  if(this.warmthIntro){this.warmthIntro=false;this.refresh();return}
  if(this.placing){if(this.candidate===null)return;const kind=this.placing,x=this.candidate,problem=finaleBuildProblem(w,kind,x);if(problem){this.p.notify(problem);return}this.phase='伙伴走到选好的洞壁，把这一件设施嵌进岩层。';this.journey.run({x,y:106},kind==='beacon'?'adeng':'amu',()=>{const result=buildFinale(w,kind,x);if(result.ok){this.p.record(result.change);this.placing=null;this.candidate=null;this.p.view.setFinalePreview?.(null,null);this.p.view.refresh();playFinaleSound('build')}this.p.notify(result.message);this.journey.finish()});return}
  if(this.themeChoice){this.perform('decorate',this.themeChoice);return}
  if(this.selected){if(this.selected==='bench')this.perform('rest');else if(this.selected==='memory'&&r.storyReady){if((this.page??0)<8){this.page=(this.page??0)+1;this.refresh()}else this.close()}else if(this.selected==='table'&&r.decorations)this.perform(!r.foodReady?'food':!r.waterReady?'water':'feast');else{this.selected=null;this.page=null;this.refresh()}return}
  const g=finaleGoal(w);if(g.build)this.select(g.build);else if(g.action==='decorate')this.chooseTheme(r.theme);else if(g.action)this.perform(g.action);else this.close()
 }
 private settle(action:FinaleAction,theme?:FinaleTheme):void{
  const repeatMeal=this.selected==='table'&&this.p.world().finale.feasts>0
  const result=performFinale(this.p.world(),action,theme)
  if(result.ok){if(!['inspect','enter','discover','feast','review','remember','finish'].includes(action))this.p.record(result.change);this.selected=null;this.page=null;this.themeChoice=null;if(action==='discover')this.warmthIntro=true;if(action==='finish')this.celebrating=true;playFinaleSound(action==='discover'?'discovery':action==='light'?'light':action==='feast'?'feast':action==='finish'?'chapter':action==='remember'?'page':action==='decorate'?'chime':'build')}
  if(result.ok&&repeatMeal&&['food','water','feast'].includes(action))this.selected='table'
  this.p.notify(result.message);this.journey.finish()
 }
 perform(action:FinaleAction,theme?:FinaleTheme):void{
  if(this.busy)return;this.guests=0;const w=this.p.world(),problem=finaleActionProblem(w,action);if(problem){this.p.notify(problem);this.refresh();return}
  if(action==='review'||action==='remember'||action==='finish'){if(action==='review')this.p.view.showFinalePanorama?.();this.journey.begin();this.settle(action);return}
  if(action==='excavate'){this.phase='阿岩沿施工梯一段段凿岩，已凿开的部分随时保留。';this.journey.excavate(()=>finaleFrontier(w),p=>{this.p.dig(p);playFinaleSound('chisel')},()=>{});return}
  if(action==='food'||action==='water'||action==='chime'){this.deliver(action);return}
  if(action==='feast'){this.gather();return}
  const at=action==='discover'?WARMTH_SPOT:action==='light'?finaleFacility(w,'beacon')!:action==='story'?finaleFacility(w,'memory')!:action==='rest'?finaleFacility(w,'bench')!:action==='weave'||action==='decorate'?finaleFacility(w,'table')!:{x:w.exploration.shaftX!,y:['inspect','brace'].includes(action)?94:106}
  this.p.view.beginDeepCamera?.();this.p.view.focusOn((at.x+.5)*T,(at.y-1)*T,'building');this.phase=action==='light'?'阿灯调好反光片，再由阿木接牢暖光台。':'伙伴正到现场完成这一步。'
  if(action==='light'){this.journey.begin();this.journey.moveAtu(at,()=>this.journey.work('adeng',at,()=>this.journey.work('amu',at,()=>this.settle(action))));return}
  this.journey.run(at,action==='inspect'||action==='brace'?'ayan':action==='enter'||action==='discover'||action==='story'||action==='rest'?'atu':action==='weave'?'taitai':action==='decorate'?'lingling':'amu',()=>this.settle(action,theme))
 }
 private deliver(kind:'food'|'water'|'chime'):void{
  const w=this.p.world(),source=finaleOrigin(w,kind)!,table=finaleFacility(w,'table')!,actor:WorkerId=kind==='food'?'xiaoman':kind==='water'?'tuantuan':'lingling',destination={x:table.x+(kind==='food'?2:kind==='water'?7:8),y:106}
  this.p.view.beginDeepCamera?.();this.p.view.focusOn((source.x+.5)*T,(source.y-1)*T,'building');this.phase=kind==='food'?'小满先去菌床旁装一份已有收成。':kind==='water'?'小泉和团团先到蓄水回廊装清水。':'铃铃先去工区取新风铃，大厅原来的作品保留。';this.journey.begin()
  const carry=()=>{this.phase=kind==='food'?'小满正沿通道把食物送往九层长桌。':kind==='water'?'团团正沿通道把清水送往九层长桌。':'铃铃正沿通道把新风铃送往九层长桌。';this.refresh();this.journey.moveWorker(actor,destination,()=>this.journey.work(actor,destination,()=>{this.p.view.finishChapterArrival?.(destination);this.settle(kind)}))}
  const collect=()=>this.journey.moveWorker(actor,source,()=>this.journey.work(actor,source,carry))
  if(kind==='water')this.journey.moveWorker('xiaoquan',{x:source.x+1,y:70},()=>this.journey.work('xiaoquan',{x:source.x+1,y:70},collect));else collect()
 }
 private gather():void{
  const seats=finaleSeats(this.p.world()),table=finaleFacility(this.p.world(),'table')!
  this.p.view.beginDeepCamera?.();this.p.view.focusOn((table.x+5)*T,105*T,'building');this.guests=0;this.phase='九位伙伴正沿真实通道来到各自的座位。到齐以后才开席。';const token=this.journey.begin()
  const arrived=()=>{if(!this.journey.live(token))return;this.guests++;this.refresh();if(this.guests===FINALE_PARTNERS.length)this.journey.work('atu',{x:table.x,y:106},()=>this.settle('feast'))}
  // 各人物有自己的行走轨道，同时赴席，避免九段长途串行等待。
  for(const seat of seats){if(!this.journey.live(token))break;if(seat.id==='atu')this.journey.moveAtu(seat.at,arrived);else this.journey.moveWorker(seat.id,seat.at,arrived)}
 }
}
