/** 第九章纯规则：自由建设、跨层准备、九人暖屋日和持久后日谈。 */
import { atuRoute,initialAtuPosition } from './atu'
import { canAfford,changeMaterials } from './materials'
import { PARTNERS,partnerBed } from './partners'
import { WARMTH_SPOT,finaleClear,finaleConnected,finaleSpan,finaleWidth } from './finaleTopology'
import { TILE,createInitialWorld,type Cell,type Inventory,type FinaleState,type FinaleFacilityKind,type FinaleTheme,type WorldState } from './world'
export const FINALE_PARTNERS=PARTNERS.map(p=>p.id)
export const FINALE_MEMORIES=[
 {title:'第一盏灯',speaker:'阿灯',text:'风雪留在地面，我们把岩洞点亮。你选的第一间小窝，让这里有了家的模样。'},
 {title:'泉水和第一顿饭',speaker:'小泉',text:'你循着滴答声凿通梯子。清水来到菜园，小满种的菜变成第一顿围坐饭。'},
 {title:'工坊叮叮当',speaker:'阿木',text:'阿岩凿开岩盖，我把晶光和金属做成部件。电梯沿你开出的路，把一层层家接在一起。'},
 {title:'六个人的暖屋宴',speaker:'小满',text:'旧梁托稳了，长桌摆好了。那时六位伙伴各有一张床，第一次在暖光大厅坐成一桌。'},
 {title:'菌光里的小花园',speaker:'苔苔',text:'你选择菌床的位置，我铺上小小菌毯。照料和收获可以一遍遍继续，晶光里也能长出食物。'},
 {title:'清水沿回廊回家',speaker:'团团',text:'你决定清水送哪边，我和小泉去转水闸。楼上的花园和大厅，都听见了新的水声。'},
 {title:'听见家园的风',speaker:'铃铃',text:'顺着真实洞壁接好风路，微风让我们做的风铃轻轻响。后来，我也在这个家有了床。'},
 {title:'旧故事，新的小爪印',speaker:'阿土',text:'灯、水和一起建造的旧岩画留在原处。你把我们的家添进去，故事就有了新的这一页。'},
 {title:'九位伙伴，一个家',speaker:'阿土',text:'天然暖晶照着九人长桌。从第一盏灯到地心暖光，每一层都留着你的选择。故事到了这里，家还可以继续建。'},
]as const
export const FINALE_SPECS:Record<FinaleFacilityKind,{name:string;cost:Inventory;parts:number;crystals:number;detail:string}>={
 beacon:{name:'地心暖光台',cost:{stone:4,wood:1},parts:2,crystals:1,detail:'四格宽的嵌岩反光台。阿灯和阿木把天然暖晶的柔光引到家园标记，暖晶仍留在原岩壁。'},
 table:{name:'九人暖屋长桌',cost:{stone:4,wood:5},parts:1,crystals:0,detail:'自由选择十格宽的洞壁。九个座位各不相同，前面留给每位伙伴真正走过来。'},
 memory:{name:'九层家园纪念壁',cost:{stone:3,wood:2},parts:0,crystals:0,detail:'四格宽的后壁相册，记下九层的灯、水、工坊和朋友。未找到的小收藏可以留白。'},
 bench:{name:'暖晶小憩石凳',cost:{stone:2,wood:2},parts:0,crystals:0,detail:'可选的三格石凳，靠着岩壁听风铃，随时坐一坐。没有时间或食物消耗。'},
}
export type FinaleAction='inspect'|'brace'|'excavate'|'enter'|'discover'|'extend'|'light'|'food'|'water'|'chime'|'weave'|'story'|'decorate'|'feast'|'review'|'remember'|'finish'|'rest'
export interface FinaleChange{before:FinaleState;after:FinaleState;cost:Inventory;parts:number;crystals:number;food:number;water:number;rides:number}
export type FinaleResult={ok:true;message:string;change:FinaleChange}|{ok:false;message:string}
export const finaleReady=(w:WorldState):boolean=>w.ruins.completed
export const finaleFacility=(w:WorldState,k:FinaleFacilityKind)=>w.finale.facilities.find(f=>f.kind===k)
export const finaleFacilityAt=(w:WorldState,p:Cell)=>p.y>=105&&p.y<=106?w.finale.facilities.find(f=>p.x>=f.x&&p.x<f.x+finaleWidth(f.kind)):undefined
export const finaleReach=(w:WorldState,p:Cell)=>atuRoute(w,w.exploration.explorer??initialAtuPosition(w),p,true)
export function finaleSeats(w:WorldState):{id:typeof FINALE_PARTNERS[number];at:Cell}[]{const t=finaleFacility(w,'table');return t?FINALE_PARTNERS.map((id,i)=>({id,at:{x:t.x+i,y:106}})):[]}
export function finaleOrigin(w:WorldState,kind:'food'|'water'|'chime'):Cell|null{
 const f=kind==='food'?w.garden.facilities.find(f=>f.kind==='bed'):kind==='water'?w.reservoir.facilities.find(f=>f.kind==='basin'):w.ventilation.facilities.find(f=>f.kind==='bench')
 return f?{x:f.x,y:kind==='food'?58:kind==='water'?70:82}:null
}
export const finaleCostText=(kind:FinaleFacilityKind):string=>{const s=FINALE_SPECS[kind];return `石料 ${s.cost.stone} · 旧木料 ${s.cost.wood}${s.parts?` · 部件 ${s.parts}`:''}${s.crystals?` · 晶簇 ${s.crystals}`:''}`}
function placementProblem(w:WorldState,kind:FinaleFacilityKind,x:number):string|null{
 if(!w.finale.entered)return '先走进地心暖光，再布置这里。'
 if(finaleFacility(w,kind))return '这件设施已经建好啦，点它就能查看。'
 const width=finaleWidth(kind),span=finaleSpan(w)
 if(!Number.isInteger(x)||!span||x<3||x+width>w.width-3||x>span.right||x+width-1<span.left)return '先挖通这里，留出够宽的洞壁。'
 for(let col=x;col<x+width;col++){
  if(col===w.exploration.shaftX)return '梯口要留空，伙伴还要上下。'
  if(!finaleClear(w,col)||w.tiles[107][col]===TILE.EMPTY)return '先挖出四格高、有实心地板的空洞。'
  if(finaleFacilityAt(w,{x:col,y:106}))return '这里已有设施，换一处吧。'
 }
 return finaleReach(w,{x,y:106})?null:'这里还没有连到梯口。'
}
export function finaleBuildProblem(w:WorldState,kind:FinaleFacilityKind,x:number):string|null{const s=FINALE_SPECS[kind];return placementProblem(w,kind,x)??(!canAfford(w,s.cost)||w.deep.parts<s.parts||w.deep.crystals<s.crystals?`需要${finaleCostText(kind)}。可继续挖土，或回三层工坊加工。`:null)}
function commit(w:WorldState,before:FinaleState,message:string,cost:Inventory={stone:0,wood:0},parts=0,crystals=0,food=0,water=0):FinaleResult{
 changeMaterials(w,cost,-1);w.deep.parts-=parts;w.deep.crystals-=crystals;w.farm.food-=food;w.reservoir.water-=water
 return{ok:true,message,change:{before,after:structuredClone(w.finale),cost,parts,crystals,food,water,rides:w.deep.rides}}
}
export function buildFinale(w:WorldState,kind:FinaleFacilityKind,x:number):FinaleResult{const problem=finaleBuildProblem(w,kind,x);if(problem)return{ok:false,message:problem};const before=structuredClone(w.finale),s=FINALE_SPECS[kind];w.finale.facilities.push({kind,x,y:106});return commit(w,before,`${s.name}建好啦！`,s.cost,s.parts,s.crystals)}
export function finaleActionProblem(w:WorldState,action:FinaleAction):string|null{
 const r=w.finale
 if(!finaleReady(w))return '先看完第八章修复的故事，再来迎接地心暖光。'
 if(action==='inspect')return r.inspected?'暖晶接缝已经检查过啦。':null
 if(!r.inspected)return '先请阿岩检查下方泛暖光的岩缝。'
 if(action==='brace')return r.braced?'护框已经装牢啦。':w.inventory.stone<3||w.inventory.wood<2||w.deep.parts<1?'护框需要石料 3、旧木料 2、部件 1。':null
 if(!r.braced)return '先托稳新梯道的岩缝，再向下凿。楼上的家照常使用。'
 if(action==='excavate')return finaleConnected(w)?'地心暖光的梯道已经通啦。':null
 if(action==='enter')return !finaleConnected(w)?'先沿施工梯逐段凿通暖晶岩盖。':r.entered?'已经来到第九层啦。':null
 if(!r.entered)return '先沿梯子来到地心暖光。'
 if(action==='discover')return r.foundWarmth?'天然暖晶已经记进相册啦。':finaleReach(w,WARMTH_SPOT)?null:'先挖通到暖晶下方的路。'
 if(action==='rest')return !finaleFacility(w,'bench')?'先选一处岩壁摆小憩石凳。':r.rests>=100000?'已经留下好多小憩回忆啦。':null
 if(!r.foundWarmth)return '先走近右侧岩壁，看看天然地心暖光。'
 if(action==='extend')return r.liftExtended?'第九站电梯已经接好啦。':w.deep.parts<2||w.deep.crystals<1?'延长电梯需要部件 2、晶簇 1。':null
 if(action==='light')return !finaleFacility(w,'beacon')?'先自由摆好地心暖光台。':r.lit?'家园暖光已经接通啦。':null
 if(!r.lit)return '先让阿灯和阿木接好暖光台。'
 if(['food','water','chime','weave','feast','decorate'].includes(action)&&!finaleFacility(w,'table'))return '先给九位伙伴摆好暖屋长桌。'
 if(action==='food'||action==='water'||action==='chime'){
  const source=finaleOrigin(w,action),table=finaleFacility(w,'table')!
  if(!source||!atuRoute(w,source,table,true))return '先接通楼上设施到九层长桌的实际通路。'
  if(action==='food')return r.foodReady?'长桌的食物已经准备好啦。':r.foodTrips>=100000?'已经办过好多暖屋日啦。':w.farm.food<1?'需要食物 1。可以回菜园或菌床收获，再来准备。':null
  if(action==='water')return r.waterReady?'长桌的清水已经准备好啦。':r.waterTrips>=100000?'已经办过好多暖屋日啦。':w.reservoir.water<1?'需要存水 1。回蓄水回廊关闸蓄水，再来接清水。':null
  return r.chimePlaced?'工区的新风铃已经挂好啦。':w.ventilation.gifts<1?'先把工区的第一件手作送回大厅。':null
 }
 if(action==='weave')return r.woven?'苔苔的菌叶装饰已经铺好啦。':null
 if(action==='story')return !finaleFacility(w,'memory')?'先找一处岩壁挂九层纪念壁。':r.storyReady?'九层故事已经放进纪念壁啦。':null
 if(action==='decorate')return !r.woven||!r.chimePlaced?'先请苔苔铺菌叶、铃铃挂风铃。':r.decorations>=100000?'已经换过好多次装饰啦。':null
 if(!r.storyReady||!r.decorations||!r.liftExtended)return '先留好故事、布置长桌，再接通第九站电梯。'
 if(action==='feast'){
  if(!r.foodReady||!r.waterReady)return '先让小满和团团把食物、清水送到长桌。'
  if(FINALE_PARTNERS.some(id=>!partnerBed(w,id)))return '每位老朋友都需要一张床，老家原有的床都算。'
  const seats=finaleSeats(w)
  return seats.length!==9||seats.some(s=>!atuRoute(w,initialAtuPosition(w),s.at,true))?'先留出九个座位前的实际通路。':r.feasts>=99999?'暖屋日已经留下好多回忆啦。':null
 }
 if(!r.feasts)return '先等九位伙伴到齐，办一次暖屋日。'
 if(action==='review')return r.reviewOpened?'九层回望已经开始啦。':null
 if(!r.reviewOpened)return '先一起回望九层家园。'
 if(action==='remember')return r.memoriesRead>=9?'九层故事都看完啦。':null
 if(r.memoriesRead!==9)return '还有几页家园回忆，慢慢看完吧。'
 return r.completed?'终章已经记入家园相册，随时可以继续建设。':null
}
export function performFinale(w:WorldState,action:FinaleAction,theme?:FinaleTheme):FinaleResult{
 const problem=finaleActionProblem(w,action);if(problem)return{ok:false,message:problem}
 if(action==='decorate'&&theme!==undefined&&!['lantern','garden'].includes(theme))return{ok:false,message:'请选择灯光暖屋或菌叶花园。'}
 const before=structuredClone(w.finale),r=w.finale
 switch(action){
  case'inspect':r.inspected=true;return commit(w,before,'阿岩看清暖晶接缝，铃铃听见下面开阔的回声。先托稳新路，再慢慢向下。')
  case'brace':r.braced=true;return commit(w,before,'暖晶护框装牢啦，旧家保留，新梯道可以继续向下。',{stone:3,wood:2},1)
  case'enter':r.entered=true;return commit(w,before,'第 9 层 · 地心暖光。最深处的岩壁，透出温柔的金色。')
  case'discover':r.foundWarmth=true;return commit(w,before,'原来暖光来自岩层里的天然暖晶！把它留在原处，我们在旁边建一个大家都能来的家。')
  case'extend':r.liftExtended=true;return commit(w,before,'九站电梯连成一路，每一层的家和朋友都能回来。',undefined,2,1)
  case'light':r.lit=true;return commit(w,before,'阿灯调好反光片，阿木接牢暖光台。九层家园标记一同亮起，天然暖晶仍留在岩壁里。')
  case'food':r.foodReady=true;r.foodTrips++;return commit(w,before,'小满把楼上收获的一份食物送到长桌，开席前替大家好好留着。',undefined,0,0,1)
  case'water':r.waterReady=true;r.waterTrips++;return commit(w,before,'小泉装好清水，团团沿通道送到九层长桌。存水用去一格，回廊仍能重新蓄满。',undefined,0,0,0,1)
  case'chime':r.chimePlaced=true;return commit(w,before,'铃铃带来工区的新风铃。大厅原来的作品保留，九层也听见家园的风。')
  case'weave':r.woven=true;return commit(w,before,'苔苔沿长桌后侧铺好菌叶花边，九位伙伴的座位更好认啦。')
  case'story':r.storyReady=true;return commit(w,before,'阿土把九层走过的故事放进纪念壁。没找到的小收藏可以留白，以后慢慢找。')
  case'decorate':r.theme=theme??r.theme;r.decorations++;return commit(w,before,r.theme==='lantern'?'小暖灯照着长桌，风铃挂好啦，准备请大家来。':'菌叶和柔光围着长桌，风铃挂好啦，准备请大家来。')
  case'feast':r.feasts++;r.foodReady=false;r.waterReady=false;return commit(w,before,'九位伙伴都到自己的位置啦！一份收成、一瓶清水，大家在地心暖光里办起暖屋日。')
  case'review':r.reviewOpened=true;return commit(w,before,'从第一盏灯到地心暖光，我们一层层看回来。每一页都可以慢慢读，随时收起。')
  case'remember':r.memoriesRead++;return commit(w,before,'这一层的回忆记下来啦。')
  case'finish':r.completed=true;return commit(w,before,'九层家园，终章完成！每一层和九位伙伴都留下来了。接下来，继续把家建成你喜欢的样子。')
  case'rest':r.rests++;return commit(w,before,'阿土靠着暖晶石凳听风铃。故事已经走了很远，家里还有许多地方可以慢慢布置。')
  default:return{ok:false,message:'请让阿岩在护框旁逐段施工。'}
 }
}
export function undoFinale(w:WorldState,c:FinaleChange):boolean{
 if(JSON.stringify(w.finale)!==JSON.stringify(c.after)||c.before.inspected!==c.after.inspected||c.before.entered!==c.after.entered||c.before.foundWarmth!==c.after.foundWarmth||c.before.feasts!==c.after.feasts||c.before.reviewOpened!==c.after.reviewOpened||c.before.memoriesRead!==c.after.memoriesRead||c.before.completed!==c.after.completed)return false
 if(!c.before.braced&&c.after.braced&&w.tiles[95][w.exploration.shaftX!]===TILE.EMPTY||!c.before.liftExtended&&c.after.liftExtended&&w.deep.rides!==c.rides||c.water&&w.reservoir.water+c.water>3)return false
 w.finale=structuredClone(c.before);changeMaterials(w,c.cost);w.deep.parts+=c.parts;w.deep.crystals+=c.crystals;w.farm.food+=c.food;w.reservoir.water+=c.water;return true
}
export interface FinaleGoal{done:number;title:string;speaker:string;speech:string;label:string;target:Cell;action?:FinaleAction;build?:FinaleFacilityKind}
export function finaleGoal(w:WorldState):FinaleGoal{
 const r=w.finale,shaft={x:w.exploration.shaftX??27,y:r.entered?106:94}
 const g=(done:number,title:string,speaker:string,speech:string,label:string,action?:FinaleAction,build?:FinaleFacilityKind,target:Cell=shaft):FinaleGoal=>({done,title,speaker,speech,label,action,build,target})
 if(!r.inspected)return g(0,'岩缝里的暖光','阿岩','第八层地板下有一道暖金色接缝，我们先检查新路。','看看暖晶接缝','inspect')
 if(!r.braced)return g(1,'托稳最后一段新路','阿岩','石料 3、旧木料 2、部件 1，给新梯道装护框。老家照常使用。','安装暖晶护框','brace')
 if(!finaleConnected(w))return g(2,'沿暖光向下','阿岩','一段一段凿，施工梯接到哪里，我就走到哪里。','凿通暖晶岩盖','excavate')
 if(!r.entered)return g(3,'最深处的温柔金色','阿土','路已经通啦，沿梯子去看看地心暖光。','下到第九层','enter')
 if(!r.foundWarmth)return g(4,'天然地心暖光','阿土','暖晶藏在右侧洞壁。先走近看看，再决定在哪里建最后一层家。','走近天然暖晶','discover',undefined,WARMTH_SPOT)
 if(!r.liftExtended)return g(5,'电梯接到第九站','阿木','部件 2、晶簇 1。每一层的老家，都和这里连在一起。','接通第九站电梯','extend')
 for(const[k,done]of [['beacon',6],['table',7],['memory',8]]as const)if(!finaleFacility(w,k))return g(done,`建一个${FINALE_SPECS[k].name}`,'阿木',FINALE_SPECS[k].detail,'选地方建造',undefined,k)
 if(!r.lit)return g(9,'把暖光连进家园','阿灯','我调好反光片，阿木接牢暖光台。暖晶留在原处，家园标记会一层层亮起来。','和阿灯接好暖光','light',undefined,finaleFacility(w,'beacon'))
 if(!r.completed&&!r.feasts&& !r.foodReady)return g(10,'花园的收成来到长桌','小满','从楼上的菜园粮仓取食物 1，沿实际通道送来。取消途中不会扣走。','请小满送来食物','food',undefined,finaleFacility(w,'table'))
 if(!r.completed&&!r.feasts&& !r.waterReady)return g(11,'回廊的清水来到长桌','团团','小泉装好清水，我从蓄水回廊送来，存水使用 1 格。','请团团送来清水','water',undefined,finaleFacility(w,'table'))
 if(!r.chimePlaced)return g(12,'工区的风铃也来了','铃铃','我带一只新风铃来，不会取走大厅原来的作品。','请铃铃送来风铃','chime',undefined,finaleFacility(w,'table'))
 if(!r.woven)return g(13,'给九个座位留菌叶花边','苔苔','沿长桌后侧铺一圈小菌叶，前面的路还留给伙伴走。','请苔苔铺菌叶','weave',undefined,finaleFacility(w,'table'))
 if(!r.storyReady)return g(14,'九层故事留在这里','阿土','不需要收齐小收藏，亲手建家的经历都值得记住。','放好九层家园故事','story',undefined,finaleFacility(w,'memory'))
 if(!r.decorations)return g(15,'为暖屋日选个布置','铃铃','灯光暖屋或菌叶花园，你来选。确认后我再去布置。','选择暖屋日布置','decorate',undefined,finaleFacility(w,'table'))
 if(!r.feasts)return g(16,'九位伙伴的暖屋日','小满','九位伙伴会沿真实通路走到不同座位，到齐再开席。食物和清水已备好。','邀请九位伙伴来暖屋','feast',undefined,finaleFacility(w,'table'))
 if(!r.reviewOpened)return g(17,'一起回望九层家园','阿土','把镜头拉远，看看亲手建成的九层家。每页回忆都等你读完再翻。','一起回望九层家园','review',undefined,finaleFacility(w,'memory'))
 if(r.memoriesRead<9){const m=FINALE_MEMORIES[r.memoriesRead];return g(18,m.title,m.speaker,m.text,r.memoriesRead===8?'把这页留进相册':'看看下一层回忆','remember',undefined,finaleFacility(w,'memory'))}
 if(!r.completed)return g(19,'九层家园，一个温暖的家','阿土','从第一盏灯到地心暖光，每位伙伴都有自己的本领，每一层都有你的选择。把这天留进相册吧。','完成终章，继续建设','finish',undefined,finaleFacility(w,'memory'))
 return g(20,'家园的故事，由你继续','阿土','九层终章已经完成。继续挖土、布置设施、翻相册，也可以再办一场暖屋日。','继续自由建设')
}
export function validFinale(w:WorldState,raw:unknown):FinaleState|null{
 if(!raw||typeof raw!=='object'||Array.isArray(raw))return null
 const r=raw as FinaleState,saved=w.finale
 for(const k of ['inspected','braced','entered','foundWarmth','liftExtended','lit','foodReady','waterReady','chimePlaced','woven','storyReady','reviewOpened','completed']as const)if(typeof r[k]!=='boolean')return null
 for(const k of ['decorations','foodTrips','waterTrips','feasts','memoriesRead','rests']as const)if(!Number.isSafeInteger(r[k])||r[k]<0||r[k]>100000)return null
 if(r.memoriesRead>9||!['lantern','garden'].includes(r.theme)||!Array.isArray(r.facilities)||r.facilities.length>4)return null
 w.finale={...r,facilities:[]}
 try{
  if(r.inspected&&!finaleReady(w)||r.braced&&!r.inspected||r.entered&&!finaleConnected(w)||r.foundWarmth&&(!r.entered||!atuRoute(w,initialAtuPosition(w),WARMTH_SPOT,true))||r.liftExtended&&!r.foundWarmth)return null
  const blueprint=createInitialWorld(),shaft=w.exploration.shaftX
  if(shaft!==null)for(let y=95;y<=102;y++)if(blueprint.tiles[y][shaft]!==TILE.EMPTY&&w.tiles[y][shaft]===TILE.EMPTY&&(!r.braced||w.tiles[y-1][shaft]!==TILE.EMPTY))return null
  for(const f of r.facilities){if(!f||!Object.hasOwn(FINALE_SPECS,f.kind)||f.y!==106||placementProblem(w,f.kind,f.x))return null;w.finale.facilities.push({...f})}
  if(r.lit&&(!r.foundWarmth||!finaleFacility(w,'beacon'))||r.storyReady&&(!r.lit||!finaleFacility(w,'memory'))||r.rests&&!finaleFacility(w,'bench'))return null
  if(r.foodTrips!==r.feasts+(r.foodReady?1:0)||r.waterTrips!==r.feasts+(r.waterReady?1:0))return null
  if((r.foodTrips||r.waterTrips||r.chimePlaced||r.woven||r.decorations||r.feasts)&&(!r.lit||!finaleFacility(w,'table')))return null
  for(const k of ['food','water','chime']as const)if((k==='food'?r.foodTrips:k==='water'?r.waterTrips:r.chimePlaced)&&!finaleOrigin(w,k))return null
  if(r.chimePlaced&&w.ventilation.gifts<1||r.decorations&&(!r.chimePlaced||!r.woven)||r.theme==='garden'&&!r.decorations)return null
  if(r.feasts&&(!r.liftExtended||!r.storyReady||!r.decorations||FINALE_PARTNERS.some(id=>!partnerBed(w,id))))return null
  if(r.reviewOpened&&!r.feasts||r.memoriesRead&&!r.reviewOpened||r.completed&&(!r.reviewOpened||r.memoriesRead!==9))return null
  return structuredClone(w.finale)
 }finally{w.finale=saved}
}
