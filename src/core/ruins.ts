import { atuRoute,initialAtuPosition } from './atu'
import { canAfford,changeMaterials } from './materials'
import { foundRelics } from './relics'
import { RUINS_FOOT,RUINS_MOTIF_SPOTS,ruinsClear,ruinsConnected,ruinsSpan,ruinsWidth } from './ruinsTopology'
import { TILE,createInitialWorld,type Cell,type Inventory,type RuinsState,type RuinsMotif,type RuinsEdition,type RuinsFacilityKind,type WorldState } from './world'
export const RUINS_MOTIFS:readonly RuinsMotif[]=['lamp','spring','tools']
export const RUINS_STORIES:Record<RuinsMotif,{name:string;speaker:string;old:string;now:string}>={
 lamp:{name:'一盏灯',speaker:'阿灯',old:'旧住户围在一盏小灯旁，岩洞也能变成暖暖的家。',now:'我们修好第一层的灯，又让晶光照进了工坊和菌床。'},
 spring:{name:'一条水路',speaker:'小泉',old:'岩壁上的水纹穿过小菜槽。以前的伙伴也一起引水、种食物。',now:'我们的泉水、花园和蓄水回廊，已经连成能反复收成的家。'},
 tools:{name:'一起建造',speaker:'阿木',old:'几双小爪子扶着同一根木梁，旁边是围坐的长桌。',now:'从凿岩到筑渠，再到听风做手作，九位伙伴都有自己的本领。'},
}
export function ruinsStory(w:WorldState,motif:RuinsMotif):string{
 const story=RUINS_STORIES[motif],found=new Set(foundRelics(w).map(r=>r.id))
 const extra=motif==='lamp'&&found.has('lamp-shade')?'旧灯罩上的弧线，也出现在这幅画里。':motif==='tools'&&found.has('old-photo')?'你找到的旧照片，和岩画里的长桌很像。':motif==='tools'&&found.has('old-key')?'旧钥匙上的小纹路，也出现在岩画边框里。':''
 return `${story.old}${story.now}${extra}`
}
export const RUINS_SPECS:Record<RuinsFacilityKind,{name:string;cost:Inventory;parts:number;crystals:number;detail:string}>={
 desk:{name:'岩壁拓印台',cost:{stone:2,wood:3},parts:0,crystals:0,detail:'阿木把软纸和小刷子放在洞壁台上。发现一段岩画后，取一块旧木料做拓印夹板，原画留在原处。'},
 mosaic:{name:'地脉故事壁',cost:{stone:5,wood:2},parts:1,crystals:0,detail:'自由选六格宽的洞壁，把灯、水、建造三段拓印放回对应的浅槽，再添上我们现在的家。'},
 light:{name:'遗迹柔光灯',cost:{stone:2,wood:0},parts:1,crystals:2,detail:'阿灯安装柔和的侧光。岩画才看得清，照着印，不需要猜密码。'},
 bench:{name:'回忆石长凳',cost:{stone:2,wood:2},parts:0,crystals:0,detail:'可选的三格后侧长凳。阿土可以坐一坐，听听当前修复好的故事，前面仍能走路。'},
}
export type RuinsAction='inspect'|'brace'|'excavate'|'enter'|'extend'|'reveal'|'rub'|'mount'|'showcase'|'walk'|'rest'
export interface RuinsChange{before:RuinsState;after:RuinsState;cost:Inventory;parts:number;crystals:number;rides:number}
export type RuinsResult={ok:true;message:string;change:RuinsChange}|{ok:false;message:string}
export const ruinsReady=(w:WorldState):boolean=>w.ventilation.completed
export const ruinsFacility=(w:WorldState,k:RuinsFacilityKind)=>w.ruins.facilities.find(f=>f.kind===k)
export const ruinsFacilityAt=(w:WorldState,p:Cell)=>p.y>=93&&p.y<=94?w.ruins.facilities.find(f=>p.x>=f.x&&p.x<f.x+ruinsWidth(f.kind)):undefined
export const ruinsReach=(w:WorldState,p:Cell)=>atuRoute(w,w.exploration.explorer??initialAtuPosition(w),p,true)
export const ruinsCostText=(kind:RuinsFacilityKind):string=>{const s=RUINS_SPECS[kind];return `石料 ${s.cost.stone} · 旧木料 ${s.cost.wood}${s.parts?` · 部件 ${s.parts}`:''}${s.crystals?` · 晶簇 ${s.crystals}`:''}`}
function placementProblem(w:WorldState,kind:RuinsFacilityKind,x:number):string|null{
 if(!w.ruins.entered)return '先下到旧地脉遗迹，再布置这里。'
 if(ruinsFacility(w,kind))return '这件设施已经建好啦，点它就能查看。'
 const width=ruinsWidth(kind),span=ruinsSpan(w)
 if(!Number.isInteger(x)||!span||x<3||x+width>w.width-3||x>span.right||x+width-1<span.left)return '先挖通这里，留出够宽的洞壁。'
 for(let col=x;col<x+width;col++){
  if(col===w.exploration.shaftX)return '梯口要留空，伙伴还要上下。'
  if(!ruinsClear(w,col)||w.tiles[95][col]===TILE.EMPTY)return '先挖出四格高、有实心地板的空洞。'
  if(ruinsFacilityAt(w,{x:col,y:94}))return '这里已有设施，换一处吧。'
 }
 return ruinsReach(w,{x,y:94})?null:'这里还没有连到梯口。'
}
export function ruinsBuildProblem(w:WorldState,kind:RuinsFacilityKind,x:number):string|null{
 const s=RUINS_SPECS[kind]
 return placementProblem(w,kind,x)??(!canAfford(w,s.cost)||w.deep.parts<s.parts||w.deep.crystals<s.crystals?`需要${ruinsCostText(kind)}。可继续挖土，或回三层工坊加工。`:null)
}
function commit(w:WorldState,before:RuinsState,message:string,cost:Inventory={stone:0,wood:0},parts=0,crystals=0):RuinsResult{
 changeMaterials(w,cost,-1);w.deep.parts-=parts;w.deep.crystals-=crystals
 return {ok:true,message,change:{before,after:structuredClone(w.ruins),cost,parts,crystals,rides:w.deep.rides}}
}
export function buildRuins(w:WorldState,kind:RuinsFacilityKind,x:number):RuinsResult{
 const problem=ruinsBuildProblem(w,kind,x);if(problem)return {ok:false,message:problem}
 const before=structuredClone(w.ruins),s=RUINS_SPECS[kind];w.ruins.facilities.push({kind,x,y:94});return commit(w,before,`${s.name}建好啦！`,s.cost,s.parts,s.crystals)
}
export function ruinsActionProblem(w:WorldState,action:RuinsAction,motif?:RuinsMotif):string|null{
 const r=w.ruins
 if(!ruinsReady(w))return '先和铃铃完成听风工区，再来看更深的旧纹路。'
 if(action==='inspect')return r.inspected?'这里的旧岩纹已经检查过啦。':null
 if(!r.inspected)return '先看看梯口下方的旧拱纹。'
 if(action==='brace')return r.braced?'护拱已经装好啦。':w.inventory.stone<3||w.inventory.wood<2||w.deep.parts<1?'护拱需要石料 3、旧木料 2、部件 1。':null
 if(!r.braced)return '先请阿岩托稳这一段旧拱纹，只暂停新区域施工，老家照常使用。'
 if(action==='excavate')return ruinsConnected(w)?'遗迹梯道已经通啦。':null
 if(action==='enter')return !ruinsConnected(w)?'先沿施工梯逐段凿通岩盖。':r.entered?'已经到遗迹啦。':null
 if(!r.entered)return '先沿梯子来到旧地脉遗迹。'
 if(action==='extend')return r.liftExtended?'第八站已经接好啦。':w.deep.parts<2||w.deep.crystals<1?'延长电梯需要部件 2、晶簇 1。':null
 if(action==='reveal'||action==='rub'||action==='mount'){
  if(!motif||!RUINS_MOTIFS.includes(motif))return '先选一段岩壁故事。'
  if(!ruinsFacility(w,'light'))return '先装好遗迹柔光灯，再辨认岩壁。'
  if(action==='reveal')return r.revealed.includes(motif)?'这段岩画已经看清啦。':ruinsReach(w,RUINS_MOTIF_SPOTS[motif])?null:'先挖通到这段岩画下方的路。'
  if(!r.revealed.includes(motif))return '先和伙伴到岩壁前，看清这一段故事。'
  if(!ruinsFacility(w,'desk'))return '先自由摆一个拓印台。'
  if(action==='rub')return r.rubbings.includes(motif)?'这段故事的拓印已经做好啦。':w.inventory.wood<1?'需要旧木料 1 做拓印夹板。':null
  return !ruinsFacility(w,'mosaic')?'先建好地脉故事壁。':!r.rubbings.includes(motif)?'先把这一段岩画拓印下来。':r.mounted.includes(motif)?'这段故事已经修复到故事壁啦。':null
 }
 if(action==='rest')return !ruinsFacility(w,'bench')?'先找个地方摆回忆石长凳。':r.rests>=100000?'回忆已经好多啦，再看看岩画吧。':null
 if(r.mounted.length!==3)return '先把灯、水、建造三段故事修复到故事壁。'
 if(action==='showcase')return r.showcases>=100000?'故事已经亮过好多次啦，继续自由布置吧。':null
 if(!r.todayReady||!r.liftExtended)return '先接好八站电梯，再把我们现在的家添进故事。'
 return r.walks>=100000?'遗迹里留下好多回忆啦，继续看看故事壁吧。':null
}
export function performRuins(w:WorldState,action:RuinsAction,motif?:RuinsMotif,edition?:RuinsEdition):RuinsResult{
 const problem=ruinsActionProblem(w,action,motif);if(problem)return {ok:false,message:problem}
 if(action==='showcase'&&edition!==undefined&&!['together','journey'].includes(edition))return {ok:false,message:'请选择围坐家园或一路建家。'}
 const before=structuredClone(w.ruins),r=w.ruins
 switch(action){
  case 'inspect':r.inspected=true;return commit(w,before,'铃铃听到旧拱后有回声，阿岩看清了旧接缝。先托稳这一段，再慢慢凿。')
  case 'brace':r.braced=true;return commit(w,before,'旧拱护框装牢啦！不拆旧家，新梯道可以继续向下。',{stone:3,wood:2},1)
  case 'enter':r.entered=true;return commit(w,before,'第 8 层 · 旧地脉遗迹。三段旧故事还留在岩壁上，等我们慢慢看清。')
  case 'extend':r.liftExtended=true;return commit(w,before,'八站电梯接通啦，拓印和伙伴都能上下。',undefined,2,1)
  case 'reveal':r.revealed.push(motif!);return commit(w,before,ruinsStory(w,motif!))
  case 'rub':r.rubbings.push(motif!);return commit(w,before,`“${RUINS_STORIES[motif!].name}”拓印好啦！原来的岩画留在洞壁上。`,{stone:0,wood:1})
  case 'mount':r.mounted.push(motif!);return commit(w,before,`“${RUINS_STORIES[motif!].name}”修复到故事壁啦！旧故事和我们现在的家连起来了。`)
  case 'showcase':r.edition=edition??r.edition;r.todayReady=true;r.showcases++;return commit(w,before,r.edition==='together'?'九枚小爪印围成一个家。旧故事旁，多了我们今天的一页。':'一条暖线串起我们走过的八层。旧故事还在继续，更深的暖光留给下一章。')
  case 'walk':r.walks++;r.completed=true;return commit(w,before,'阿土、阿灯和阿木一起看完修复的故事。第八章完成，下一章去迎接地心暖光！')
  case 'rest':r.rests++;return commit(w,before,'阿土在后侧石凳歇一歇：以前的伙伴也在这里把洞变成家，我们把故事接着写。')
  default:return {ok:false,message:'请让阿岩在护拱旁开工。'}
 }
}
export function undoRuins(w:WorldState,c:RuinsChange):boolean{
 const compare=(r:RuinsState)=>JSON.stringify({...r,foundSeal:false,foundFootprint:false})
 if(compare(w.ruins)!==compare(c.after)||!c.before.inspected&&c.after.inspected||!c.before.entered&&c.after.entered||c.before.revealed.length!==c.after.revealed.length||c.before.walks!==c.after.walks)return false
 if(!c.before.braced&&c.after.braced&&w.tiles[83][w.exploration.shaftX!]===TILE.EMPTY||!c.before.liftExtended&&c.after.liftExtended&&w.deep.rides!==c.rides)return false
 w.ruins={...structuredClone(c.before),foundSeal:w.ruins.foundSeal,foundFootprint:w.ruins.foundFootprint};changeMaterials(w,c.cost);w.deep.parts+=c.parts;w.deep.crystals+=c.crystals;return true
}
export interface RuinsGoal{done:number;title:string;speaker:string;speech:string;label:string;target:Cell;action?:RuinsAction;build?:RuinsFacilityKind;motif?:RuinsMotif}
export function ruinsGoal(w:WorldState):RuinsGoal{
 const r=w.ruins,shaft={x:w.exploration.shaftX??27,y:r.entered?94:82}
 const goal=(done:number,title:string,speaker:string,speech:string,label:string,action?:RuinsAction,build?:RuinsFacilityKind,target:Cell=shaft,motif?:RuinsMotif):RuinsGoal=>({done,title,speaker,speech,label,action,build,target,motif})
 if(!r.inspected)return goal(0,'旧拱后面的回声','铃铃','风井下方有一圈旧纹路，阿岩和我先看清楚。','看看旧地脉拱纹','inspect')
 if(!r.braced)return goal(1,'把旧拱托稳','阿岩','石料 3、旧木料 2、部件 1。稳住这一段，再凿下去。','安装旧拱护框','brace')
 if(!ruinsConnected(w))return goal(2,'沿旧纹路向下','阿岩','一段一段凿，原来的拱纹和楼上的家都留下。','凿通旧地脉岩盖','excavate')
 if(!r.entered)return goal(3,'走进旧故事留下的地方','阿土','梯子接到底啦，我们去看看。','下到旧地脉遗迹','enter')
 if(!r.liftExtended)return goal(4,'电梯接到第八站','阿木','部件 2、晶簇 1，让旧故事和新伙伴上下相连。','接通第八站电梯','extend')
 for(const[k,done]of [['desk',5],['light',6],['mosaic',7]]as const)if(!ruinsFacility(w,k))return goal(done,`建一个${RUINS_SPECS[k].name}`,k==='light'?'阿灯':'阿木',RUINS_SPECS[k].detail,'选地方建造',undefined,k)
 const done=8+r.revealed.length+r.rubbings.length+r.mounted.length
 for(const motif of RUINS_MOTIFS){const st=RUINS_STORIES[motif]
  if(!r.revealed.includes(motif))return goal(done,`岩壁故事 · ${st.name}`,st.speaker,'到岩壁旁看清楚。你也可以先选另一段故事。','和伙伴看看岩画','reveal',undefined,RUINS_MOTIF_SPOTS[motif],motif)
  if(!r.rubbings.includes(motif))return goal(done,`拓印 · ${st.name}`,'阿木',ruinsStory(w,motif),'做这一段拓印','rub',undefined,ruinsFacility(w,'desk'),motif)
  if(!r.mounted.includes(motif))return goal(done,`修复 · ${st.name}`,'阿木','把对应拓印放回故事壁，原画仍留在原来的岩层里。','修复这一段故事','mount',undefined,ruinsFacility(w,'mosaic'),motif)
 }
 if(!r.todayReady)return goal(17,'把我们今天的家添进去','阿土','三段旧故事都连起来啦。选围坐家园或一路建家，再由伙伴添上九枚小爪印。','添上我们今天的家','showcase',undefined,ruinsFacility(w,'mosaic'))
 return goal(r.completed?19:18,r.completed?'八层家园，故事还在继续':'一起看看旧故事和新家','阿土',r.completed?'继续翻看三段故事、切换壁画呈现、坐一坐。第九章地心暖光仍在前方。':'陪阿灯和阿木到故事壁前，看看我们一起修好的这一页。','一起走走看故事','walk',undefined,ruinsFacility(w,'mosaic'))
}
export function validRuins(w:WorldState,raw:unknown):RuinsState|null{
 if(!raw||typeof raw!=='object'||Array.isArray(raw))return null
 const r=raw as RuinsState,saved=w.ruins
 for(const k of ['inspected','braced','entered','liftExtended','todayReady','completed','foundSeal','foundFootprint']as const)if(typeof r[k]!=='boolean')return null
 for(const k of ['showcases','walks','rests']as const)if(!Number.isSafeInteger(r[k])||r[k]<0||r[k]>100000)return null
 if(!['together','journey'].includes(r.edition)||!Array.isArray(r.facilities)||r.facilities.length>4)return null
 for(const xs of [r.revealed,r.rubbings,r.mounted])if(!Array.isArray(xs)||xs.length>3||new Set(xs).size!==xs.length||xs.some(x=>!RUINS_MOTIFS.includes(x)))return null
 w.ruins={...r,facilities:[]}
 try{
  if(r.inspected&&!ruinsReady(w)||r.braced&&!r.inspected||r.entered&&!ruinsConnected(w)||r.liftExtended&&!r.entered||(r.foundSeal||r.foundFootprint)&&!r.entered)return null
  const blueprint=createInitialWorld(),shaft=w.exploration.shaftX
  if(shaft!==null)for(let y=83;y<=90;y++)if(blueprint.tiles[y][shaft]!==TILE.EMPTY&&w.tiles[y][shaft]===TILE.EMPTY&&(!r.braced||w.tiles[y-1][shaft]!==TILE.EMPTY))return null
  for(const f of r.facilities){if(!f||!Object.hasOwn(RUINS_SPECS,f.kind)||f.y!==RUINS_FOOT||placementProblem(w,f.kind,f.x))return null;w.ruins.facilities.push({...f})}
  if(r.revealed.length&&(!ruinsFacility(w,'light')||r.revealed.some(m=>!atuRoute(w,initialAtuPosition(w),RUINS_MOTIF_SPOTS[m],true))))return null
  if(r.rubbings.some(m=>!r.revealed.includes(m))||r.rubbings.length&&!ruinsFacility(w,'desk')||r.mounted.some(m=>!r.rubbings.includes(m))||r.mounted.length&&!ruinsFacility(w,'mosaic'))return null
  if(r.todayReady!==(r.showcases>0)||r.edition==='journey'&&!r.todayReady||r.todayReady&&r.mounted.length!==3||r.rests>0&&!ruinsFacility(w,'bench')||r.completed!==(r.walks>0)||r.completed&&(!r.todayReady||!r.liftExtended))return null
  return structuredClone(w.ruins)
 }finally{w.ruins=saved}
}
