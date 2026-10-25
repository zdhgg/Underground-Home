import { atuRoute, initialAtuPosition } from './atu'
import { canPlacePod } from './build'
import { canAfford, changeMaterials } from './materials'
import { partnerBed } from './partners'
import { VENTILATION_FOOT, LINGLING_SPOT, ventilationDuctPath, ventilationClear, ventilationConnected, ventilationNetwork, ventilationSpan, ventilationWidth } from './ventilationTopology'
import { TILE, createInitialWorld, type Cell, type Inventory, type VentilationFacilityKind, type VentilationState, type SleepPod, type AirMode, type WindCraft, type WorldState } from './world'
export const VENTILATION_SPECS: Record<VentilationFacilityKind, { name:string; cost:Inventory; parts:number; detail:string }> = {
  inlet:{name:'岩缝进风口',cost:{stone:3,wood:1},parts:0,detail:'嵌在后侧洞壁的旧风口。先清开洞壁，再让新鲜的风沿风管进来。'},
  fan:{name:'岩拱送风机',cost:{stone:3,wood:2},parts:2,detail:'阿木装好风机。关机、家园微风、工区风都由你确认后切换，不会因离开而损坏。'},
  baffle:{name:'消音百叶',cost:{stone:2,wood:2},parts:1,detail:'铃铃把散乱的风梳成一条柔和的风。家园微风轻轻摇飘带，工区风让手作台的小风车转起来。'},
  bench:{name:'听风手作台',cost:{stone:3,wood:3},parts:1,detail:'阿木陪你做铜管风铃或叶片风饰。一次做一件，做好后亲自送到暖光大厅。'},
  nest:{name:'铃铃岩壁小窝',cost:{stone:3,wood:3},parts:0,detail:'给铃铃留一张真实床。小窝嵌进洞壁，前面仍能走路；老家的空床也算。'},
}
export type VentilationAction = 'inspect'|'brace'|'excavate'|'enter'|'meet'|'extend'|'trace'|'test'|'craft'|'gift'|'tour'
export interface VentilationChange { before:VentilationState; after:VentilationState; cost:Inventory; parts:number; crystals:number; rides:number; pod?:SleepPod }
export type VentilationResult = {ok:true;message:string;change:VentilationChange}|{ok:false;message:string}
export const ventilationReady = (w: WorldState): boolean => w.reservoir.completed
export const ventilationFacility = (w: WorldState, kind: VentilationFacilityKind) => w.ventilation.facilities.find(f => f.kind === kind)
export const ventilationFacilityAt = (w: WorldState, p: Cell) => p.y >= 79 && p.y <= 82 ? w.ventilation.facilities.find(f => p.x >= f.x && p.x < f.x + ventilationWidth(f.kind)) : undefined
export const ventilationReach = (w: WorldState, p: Cell): Cell[] | null => atuRoute(w, w.exploration.explorer ?? initialAtuPosition(w), p, true)
export const ventilationCostText = (kind: VentilationFacilityKind): string => { const s = VENTILATION_SPECS[kind]; return `石料 ${s.cost.stone} · 旧木料 ${s.cost.wood}${s.parts ? ` · 部件 ${s.parts}` : ''}` }
function placementProblem(w: WorldState, kind: VentilationFacilityKind, x: number, restoring = false): string | null {
  if (!w.ventilation.metLingling) return '先到右边的旧风口，和蝙蝠铃铃打个招呼。'
  if (kind !== 'nest' && ventilationFacility(w, kind)) return '这件设施已经建好啦，点它就能使用。'
  if (kind === 'nest' && !restoring && partnerBed(w, 'lingling')) return '铃铃已经有床位啦，老家的空床也算。'
  const width = ventilationWidth(kind), span = ventilationSpan(w)
  if (!Number.isInteger(x) || !span || x < 3 || x + width > w.width - 3 || x > span.right || x + width - 1 < span.left) return '先挖通这里，留出够宽的洞壁。'
  for (let col = x; col < x + width; col++) {
    if (col === w.exploration.shaftX) return '梯口要留空，大家还要上下。'
    if (!ventilationClear(w, col) || w.tiles[83][col] === TILE.EMPTY) return '先挖出四格高、有地板的空洞。'
    if (ventilationFacilityAt(w, { x: col, y: 82 }) || w.pods.some(p => p.y === 81 && col >= p.x && col < p.x + 3)) return '这里已经有设施，换一处吧。'
  }
  if (!ventilationReach(w, { x, y: 82 })) return '这里还没有连到梯口。'
  if (kind === 'nest' && !canPlacePod(w, x, 81, 'left', true).ok) return '床前要留一条能走回家的路。'
  return null
}
export function ventilationBuildProblem(w: WorldState, kind: VentilationFacilityKind, x: number): string | null {
  return placementProblem(w, kind, x) ?? (!canAfford(w, VENTILATION_SPECS[kind].cost) || w.deep.parts < VENTILATION_SPECS[kind].parts ? `需要${ventilationCostText(kind)}。可继续挖土，或回三层工坊加工部件。` : null)
}
function commit(w: WorldState, before: VentilationState, message: string, cost: Inventory = { stone: 0, wood: 0 }, parts = 0, crystals = 0, pod?: SleepPod): VentilationResult {
  changeMaterials(w, cost, -1); w.deep.parts -= parts; w.deep.crystals -= crystals
  return { ok: true, message, change: { before, after: structuredClone(w.ventilation), cost, parts, crystals, rides: w.deep.rides, ...(pod ? { pod: { ...pod } } : {}) } }
}
export function buildVentilation(w: WorldState, kind: VentilationFacilityKind, x: number): VentilationResult {
  const problem = ventilationBuildProblem(w, kind, x)
  if (problem) return { ok: false, message: problem }
  const before = structuredClone(w.ventilation), spec = VENTILATION_SPECS[kind]
  let pod: SleepPod | undefined
  if (kind === 'nest') { pod = { id: Math.max(0, ...w.pods.map(p => p.id)) + 1, x, y: 81, door: 'left', backWall: true }; w.pods.push(pod) }
  w.ventilation.facilities.push({ kind, x, y: 82, ...(pod ? { podId: pod.id } : {}) })
  return commit(w, before, `${spec.name}建好啦！`, spec.cost, spec.parts, 0, pod)
}
export function ventilationActionProblem(w:WorldState,action:VentilationAction):string|null {
  const v=w.ventilation
  if(!ventilationReady(w))return '先和团团完成蓄水回廊巡游，再听听下面的风声。'
  if(action==='inspect')return v.inspected?'这段静静的旧风井已经看过啦。':null
  if(!v.inspected)return '先看看梯口下面一动不动的旧飘带。'
  if(action==='brace')return v.braced?'护框已经装好啦。':w.inventory.stone<2||w.inventory.wood<2||w.deep.parts<1?'需要石料 2、旧木料 2、部件 1，先把旧风井护好。':null
  if(!v.braced)return '先请阿岩装好风井护框，只暂停新井道，楼上的家照常使用。'
  if(action==='excavate')return ventilationConnected(w)?'风井已经通啦。':null
  if(action==='enter')return !ventilationConnected(w)?'先请阿岩一段一段凿通风井。':v.entered?'已经来到听风工区啦。':null
  if(!v.entered)return '先沿施工梯到第七层。'
  if(action==='meet')return v.metLingling?'铃铃已经加入啦。':ventilationReach(w,LINGLING_SPOT)?null:'铃铃在右侧旧风口，先挖通两格高的路。'
  if(!v.metLingling)return '先去右侧认识蝙蝠铃铃。'
  if(action==='extend')return v.liftExtended?'第七站已经接好啦。':w.deep.parts<2||w.deep.crystals<1?'延长电梯需要部件 2、晶簇 1。':null
  if(action==='trace')return !ventilationDuctPath(w)?'先建好四件设施，挖通它们之间四格高的洞壁。':ventilationNetwork(w)?'铃铃已经听清风路，风管接好啦。':null
  if(!ventilationNetwork(w))return '先请铃铃沿真实通道听风，把风管接到四件设施。'
  if(action==='test')return v.tested?'飘带已经轻轻摆起来啦。':v.mode!=='home'?'先把风机调到家园微风，再检查飘带。':null
  if(!v.tested)return '先在家园微风下，请铃铃检查飘带。'
  if(action==='craft')return v.readyCraft?'先把做好的作品送到大厅，再做下一件。':v.mode!=='work'?'手作台需要工区风，让小风车转起来。':w.inventory.wood<1||w.deep.parts<1?'一件作品需要旧木料 1、部件 1；可回三层工坊加工。':v.crafts>=100000?'作品已经很多啦，先看看家里的收藏。':null
  if(action==='gift')return !v.readyCraft?'先在手作台做一件风铃或风饰。':v.mode!=='home'?'送回大厅前，先调回家园微风。':v.gifts>=100000?'家里已经有好多风的回忆啦。':null
  if(!v.liftExtended||!v.gifts)return '接好七站电梯，再把第一件手作送回大厅。'
  if(!partnerBed(w,'lingling'))return '给铃铃留一张真实床，老家的空床也可以。'
  return v.tours>=100000?'听风工区有好多回忆啦，继续做手作吧。':null
}
export function setAirMode(w:WorldState,mode:AirMode):VentilationResult {
  if(!['off','home','work'].includes(mode)||!w.ventilation.metLingling||!ventilationNetwork(w))return {ok:false,message:'先接通风路，再选择风机模式。'}
  if(w.ventilation.mode===mode)return {ok:false,message:'风机已经在这个模式啦。'}
  const before=structuredClone(w.ventilation);w.ventilation.mode=mode
  return commit(w,before,mode==='off'?'风机安静停下啦，家园和作品都会保留。':mode==='home'?'家园微风：百叶轻轻打开，飘带慢慢摇摆。':'工区风：手作台的小风车转起来啦，可以做新作品。')
}
export function chooseWindCraft(w:WorldState,kind:WindCraft):boolean {
  if(!['chime','mobile'].includes(kind)||!w.ventilation.metLingling||w.ventilation.readyCraft)return false
  w.ventilation.variety=kind;return true
}
export function performVentilation(w:WorldState,action:VentilationAction):VentilationResult {
  const problem=ventilationActionProblem(w,action);if(problem)return {ok:false,message:problem}
  const before=structuredClone(w.ventilation),v=w.ventilation
  switch(action){
    case 'inspect':v.inspected=true;return commit(w,before,'阿岩：旧风口的飘带不动了。我们先护住这一段，再慢慢疏通；没有倒计时。')
    case 'brace':v.braced=true;return commit(w,before,'风井护框装牢啦！旧风口已经打开，可以向下施工。',{stone:2,wood:2},1)
    case 'enter':v.entered=true;return commit(w,before,'第 7 层 · 听风工区。右侧岩壁里有小小的回声。')
    case 'meet':v.metLingling=true;return commit(w,before,'我是铃铃，耳朵能听见风经过哪里！你选设施位置，我沿通道找风路。')
    case 'extend':v.liftExtended=true;return commit(w,before,'七站电梯接通啦，老梯道仍然能走。',undefined,2,1)
    case 'trace':v.duct=ventilationDuctPath(w)!;return commit(w,before,'铃铃沿洞壁听完风，把风管和消音百叶接好啦。')
    case 'test':v.tested=true;return commit(w,before,'飘带轻轻展开啦！风路连通、百叶消音，家园微风很柔和。')
    case 'craft':v.readyCraft=v.variety;v.crafts++;return commit(w,before,v.variety==='chime'?'铜管风铃做好啦！细管会在微风里轻轻响。':'叶片风饰做好啦！小木叶能在家园微风里慢慢转。',{stone:0,wood:1},1)
    case 'gift':v.hallArt=v.readyCraft;v.readyCraft=null;v.gifts++;return commit(w,before,'作品挂到暖光大厅啦！它随着家园微风轻轻摆，纪念墙记下第七层的新故事。')
    case 'tour':v.tours++;v.completed=true;return commit(w,before,'铃铃、阿木和阿土一起听见了家园的风。第七章完成，九层旅途继续！')
    default:return {ok:false,message:'请让阿岩在风井口开工。'}
  }
}
export function undoVentilation(w:WorldState,c:VentilationChange):boolean {
  const compare=(v:VentilationState)=>JSON.stringify({...v,foundEcho:false,foundVane:false,variety:'chime'})
  if(compare(w.ventilation)!==compare(c.after)||!c.before.inspected&&c.after.inspected||!c.before.entered&&c.after.entered||!c.before.metLingling&&c.after.metLingling||c.before.tours!==c.after.tours)return false
  if(!c.before.braced&&c.after.braced&&w.tiles[71][w.exploration.shaftX!]===TILE.EMPTY||!c.before.liftExtended&&c.after.liftExtended&&w.deep.rides!==c.rides||c.pod&&w.ventilation.completed)return false
  w.ventilation={...structuredClone(c.before),variety:w.ventilation.variety,foundEcho:w.ventilation.foundEcho,foundVane:w.ventilation.foundVane}
  if(c.pod)w.pods=w.pods.filter(p=>p.id!==c.pod!.id)
  changeMaterials(w,c.cost);w.deep.parts+=c.parts;w.deep.crystals+=c.crystals;return true
}
export interface VentilationGoal {done:number;title:string;speaker:string;speech:string;label:string;target:Cell;action?:VentilationAction;build?:VentilationFacilityKind;mode?:AirMode}
export function ventilationGoal(w:WorldState):VentilationGoal {
  const v=w.ventilation,shaft={x:w.exploration.shaftX??27,y:v.entered?82:70}
  const goal=(done:number,title:string,speaker:string,speech:string,label:string,action?:VentilationAction,build?:VentilationFacilityKind,target:Cell=shaft,mode?:AirMode):VentilationGoal=>({done,title,speaker,speech,label,action,build,target,mode})
  if(!v.inspected)return goal(0,'下面的旧飘带不动了','阿岩','回廊下面有一道旧风井。先看看，再决定怎么接通。','看看旧风井','inspect')
  if(!v.braced)return goal(1,'先护好这段风井','阿岩','护框需要石料 2、旧木料 2、部件 1，楼上的家照常使用。','装好风井护框','brace')
  if(!ventilationConnected(w))return goal(2,'沿风井伸出施工梯','阿岩','一段一段凿，随时可以让我停下来。','凿通旧风井岩盖','excavate')
  if(!v.entered)return goal(3,'到旧风口听一听','阿土','梯子接到底啦，我们下去看看。','下到听风工区','enter')
  if(!v.metLingling)return goal(4,'右边的大耳朵是谁','阿土','右侧有只小蝙蝠，先挖通到旧风口的路。','认识蝙蝠铃铃','meet',undefined,LINGLING_SPOT)
  if(!v.liftExtended)return goal(5,'电梯接到第七站','阿木','部件 2、晶簇 1，让伙伴和手作材料上下方便。','接通第七站电梯','extend')
  for(const [kind,done]of [['inlet',6],['fan',7],['baffle',8],['bench',9]]as const)if(!ventilationFacility(w,kind))return goal(done,`建一个${VENTILATION_SPECS[kind].name}`,kind==='fan'||kind==='bench'?'阿木':'铃铃',VENTILATION_SPECS[kind].detail,'选地方建造',undefined,kind)
  if(!ventilationNetwork(w))return goal(10,'让铃铃听清风路','铃铃','把四件设施之间的四格高洞壁挖通，我沿通道接风管。','请铃铃沿洞壁听风','trace',undefined,ventilationFacility(w,'baffle'))
  if(!v.tested){if(v.mode!=='home')return goal(11,'先试一阵家园微风','铃铃','百叶会把风梳柔和，再让我们看看飘带。','选择家园微风',undefined,undefined,ventilationFacility(w,'fan'),'home');return goal(12,'看飘带，听一听','铃铃','飘带轻轻展开，风路就连起来啦。','请铃铃检查飘带','test',undefined,ventilationFacility(w,'baffle'))}
  if(v.readyCraft){
    if(v.mode!=='home')return goal(15,'把柔和的风送回家','铃铃','送作品之前，先调回家园微风。','选择家园微风',undefined,undefined,ventilationFacility(w,'fan'),'home')
    return goal(16,'把作品送回暖光大厅','阿土','亲自带作品回楼上，和老朋友分享。','一起送到大厅','gift',undefined,ventilationFacility(w,'bench'))
  }
  if(!v.gifts){
    if(v.mode!=='work')return goal(13,'让手作台的小风车转起来','阿木','工区风准备好了，我们就能做风铃或叶片风饰。','选择工区风',undefined,undefined,ventilationFacility(w,'fan'),'work')
    return goal(14,'做一件风的礼物','阿木','旧木料 1、部件 1，一次做一件。你可以在手作台换另一种作品。','做一件小手作','craft',undefined,ventilationFacility(w,'bench'))
  }
  if(!partnerBed(w,'lingling'))return goal(17,'给铃铃留一张床','铃铃','我也想住在这个家。老家的空床也可以。','选地方建岩壁小窝',undefined,'nest')
  return goal(v.completed?19:18,v.completed?'九位伙伴，听见同一阵风':'一起听听家园的风','铃铃',v.completed?'继续换风机模式、做不同的手作。第八、九层仍等着我们。':'陪我和阿木到手作台，一起听听新工区的风。','一起听风','tour',undefined,ventilationFacility(w,'bench'))
}
export function validVentilation(w:WorldState,raw:unknown):VentilationState|null {
  if(!raw||typeof raw!=='object'||Array.isArray(raw))return null
  const v=raw as VentilationState,saved=w.ventilation
  for(const key of ['inspected','braced','entered','metLingling','liftExtended','tested','completed','foundEcho','foundVane']as const)if(typeof v[key]!=='boolean')return null
  for(const key of ['crafts','gifts','tours']as const)if(!Number.isSafeInteger(v[key])||v[key]<0||v[key]>100000)return null
  const craft=(x:unknown)=>x==='chime'||x==='mobile'
  if(!['off','home','work'].includes(v.mode)||!craft(v.variety)||v.readyCraft!==null&&!craft(v.readyCraft)||v.hallArt!==null&&!craft(v.hallArt)||!Array.isArray(v.facilities)||v.facilities.length>6||!Array.isArray(v.duct)||v.duct.length>38)return null
  w.ventilation={...v,facilities:[]}
  try{
    if(v.inspected&&!ventilationReady(w)||v.braced&&!v.inspected||v.entered&&!ventilationConnected(w)||v.metLingling&&(!v.entered||!atuRoute(w,initialAtuPosition(w),LINGLING_SPOT,true))||v.liftExtended&&!v.metLingling||(v.foundEcho||v.foundVane)&&!v.entered)return null
    const blueprint=createInitialWorld(),shaft=w.exploration.shaftX
    if(shaft!==null)for(let y=71;y<=78;y++)if(blueprint.tiles[y][shaft]!==TILE.EMPTY&&w.tiles[y][shaft]===TILE.EMPTY&&(!v.braced||w.tiles[y-1][shaft]!==TILE.EMPTY))return null
    const seen=new Set<VentilationFacilityKind>()
    for(const f of v.facilities){
      if(!f||!Object.hasOwn(VENTILATION_SPECS,f.kind)||f.y!==VENTILATION_FOOT||seen.has(f.kind))return null
      seen.add(f.kind)
      const pods=w.pods;if(f.kind==='nest')w.pods=pods.filter(p=>p.id!==f.podId)
      let problem:string|null;try{problem=placementProblem(w,f.kind,f.x,true)}finally{w.pods=pods}
      if(problem)return null
      if(f.kind==='nest'){const p=pods.find(p=>p.id===f.podId);if(!p||p.x!==f.x||p.y!==81||!p.backWall)return null}else if(f.podId!==undefined)return null
      w.ventilation.facilities.push({...f})
    }
    const path=ventilationDuctPath(w)
    if(v.duct.length&&(!path||JSON.stringify(path)!==JSON.stringify(v.duct)))return null
    if((v.mode!=='off'||v.tested||v.crafts||v.gifts||v.hallArt||v.readyCraft)&&!ventilationNetwork(w))return null
    if(v.crafts!==v.gifts+(v.readyCraft?1:0)||!!v.hallArt!==(v.gifts>0)||v.crafts>0&&!v.tested)return null
    if(v.completed!==(v.tours>0)||v.completed&&(!v.liftExtended||!v.gifts||!partnerBed(w,'lingling')))return null
    return structuredClone(w.ventilation)
  }finally{w.ventilation=saved}
}
