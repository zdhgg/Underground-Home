/** 第三层的建设、配方和章节规则。没有计时器、镜头或 UI。 */
import { atuRoute, initialAtuPosition } from './atu'
import { canAfford, changeMaterials } from './materials'
import { AYAN_SPOT, CRYSTAL_SPOT, DEEP_FOOT, DRILL_SPOT, MOSS_SPOT, deepConnected, deepFrontier, deepSpan } from './deepTopology'
import { snapFacilityX } from './placement'
import { stratumAt, TILE, createInitialWorld, freshDeep, type Cell, type DeepFacility, type DeepFacilityKind, type DeepState, type Inventory, type WorldState } from './world'

export const DEEP_SPECS: Record<DeepFacilityKind, { name: string; icon: string; width: number; cost: Inventory; crystals?: number; detail: string }> = {
  collector: { name: '晶簇采集台', icon: '💎', width: 3, cost: { stone: 2, wood: 2 }, detail: '轻轻取下晶尖，晶根留在岩壁上。每次得到晶簇 3、矿石 2。' },
  distributor: { name: '稳光配电箱', icon: '⚡', width: 2, cost: { stone: 2, wood: 1 }, crystals: 1, detail: '铜线顺着真实通道送电。前两层的灯继续亮，第三层也有自己的电。' },
  workshop: { name: '岩壁工坊', icon: '🔧', width: 5, cost: { stone: 3, wood: 3 }, detail: '搭好工作台，阿木就来帮忙。把金属锭和晶簇做成电梯部件。' },
  furnace: { name: '小石炉', icon: '🔥', width: 3, cost: { stone: 3, wood: 1 }, detail: '两块矿石变成两块金属锭。炉门关好再加工，没有等待倒计时。' },
  lamp: { name: '晶光壁灯', icon: '🏮', width: 1, cost: { stone: 1, wood: 0 }, crystals: 1, detail: '挂在岩壁上，不挡路。光沿空洞延伸，遇到岩石就停下。' },
}
export type DeepAction = 'meet' | 'excavate' | 'enter' | 'discover' | 'collect' | 'smelt' | 'craft' | 'precision' | 'pickaxe' | 'far-light' | 'support' | 'lift' | 'ride-home' | 'ride-water' | 'ride-crystal' | 'ride-hall' | 'ride-garden' | 'ride-reservoir' | 'ride-ventilation' | 'ride-ruins' | 'ride-finale'
export interface DeepChange { before: DeepState; inventory: Inventory; afterInventory: Inventory; after: DeepState }
export type DeepResult = { ok: true; message: string; change: DeepChange } | { ok: false; message: string }
export const hasDeep = (w: WorldState, kind: DeepFacilityKind): boolean => w.deep.facilities.some(f => f.kind === kind)
export const deepReady = (w: WorldState): boolean => w.farm.sharedMeals > 0 && w.powerDown && w.exploration.springFound
export const amuJoined = (w: WorldState): boolean => hasDeep(w, 'workshop')
export const deepFacilityAt = (w: WorldState, p: Cell): DeepFacility | undefined => w.deep.facilities.find(f => p.y >= 31 && p.y <= 33 && p.x >= f.x && p.x < f.x + DEEP_SPECS[f.kind].width)
export const deepReach = (w: WorldState, p: Cell): Cell[] | null => atuRoute(w, w.exploration.explorer ?? initialAtuPosition(w), p, true)
const success = (w: WorldState, before: DeepState, inventory: Inventory, message: string): DeepResult => ({ ok: true, message, change: { before, inventory, afterInventory: { ...w.inventory }, after: structuredClone(w.deep) } })

export function deepSpotProblem(w: WorldState, kind: DeepFacilityKind, x: number): string | null {
  if (!w.deep.entered) return '先沿施工梯到晶簇层。'
  if (kind !== 'lamp' && hasDeep(w, kind)) return '这件设施已经建好啦，点它就能使用。'
  if (!w.deep.foundCrystal) return '先看看岩壁上会发光的晶簇。'
  if (kind === 'lamp' && !hasDeep(w, 'distributor')) return '先装稳光配电箱，灯才有电。'
  if ((kind === 'workshop' || kind === 'furnace') && !hasDeep(w, 'distributor')) return '先把晶簇的电接到配电箱。'
  const spec = DEEP_SPECS[kind], span = deepSpan(w)
  if (!Number.isInteger(x) || !span || x < 3 || x + spec.width > w.width - 3) return '换一处宽一点的岩壁吧。'
  if (x > span.right || x + spec.width - 1 < span.left) return '先挖通到这里的路。'
  for (let col = x; col < x + spec.width; col++) {
    if (col === w.exploration.shaftX || col === CRYSTAL_SPOT.x) return '梯口和天然晶簇旁要留空。'
    if (![31, 32, 33].every(y => w.tiles[y][col] === TILE.EMPTY) || w.tiles[34][col] === TILE.EMPTY) return '先挖出三格高、有地板的空洞。'
    if (deepFacilityAt(w, { x: col, y: DEEP_FOOT })) return '这里放过设施啦，再选别处。'
  }
  if (!deepReach(w, { x, y: DEEP_FOOT })) return '这里还没有连到梯子。'
  return null
}
export function deepBuildProblem(w: WorldState, kind: DeepFacilityKind, x: number): string | null {
  const spot = deepSpotProblem(w, kind, x)
  if (spot) return spot
  const spec = DEEP_SPECS[kind]
  if (!canAfford(w, spec.cost) || w.deep.crystals < (spec.crystals ?? 0)) {
    const need = `还需要${deepCostText(kind)}。`
    return spec.crystals ? `${need}石料旧木料回上面挖泥土，晶簇去采集台取。` : `${need}回上面几层挖挖泥土就有啦。`
  }
  return null
}
/**
 * 推荐建造位：给孩子的引导，只作高亮提示、不限制选址。
 * 采集台贴着天然晶簇，石炉贴着工坊，其余从梯口向两侧就近找；
 * 不推荐压住苔藓和旧钻头的发现点。返回设施左格 x，找不到合适位置时为 null。
 */
export function deepSuggestion(w: WorldState, kind: DeepFacilityKind): number | null {
  if (kind !== 'lamp' && hasDeep(w, kind)) return null
  const spec = DEEP_SPECS[kind], span = deepSpan(w), shaft = w.exploration.shaftX
  if (!span || shaft === null) return null
  const clamp = (x: number): number => Math.max(span.left, Math.min(x, span.right - spec.width + 1))
  const coversAnchor = (x: number): boolean => [MOSS_SPOT.x, DRILL_SPOT.x].some(a => a >= x && a < x + spec.width)
  const fits = (x: number): boolean => !coversAnchor(x) && deepSpotProblem(w, kind, x) === null
  const near: number[] = []
  if (kind === 'collector') near.push(CRYSTAL_SPOT.x - spec.width, CRYSTAL_SPOT.x + 1)
  const workshop = w.deep.facilities.find(f => f.kind === 'workshop')
  if (kind === 'furnace' && workshop) near.push(workshop.x - spec.width, workshop.x + DEEP_SPECS.workshop.width)
  for (const x of near) { const c = clamp(x); if (fits(c)) return c }
  for (let d = 1; d <= span.right - span.left + 1; d++) {
    for (const x of [clamp(shaft + d), clamp(shaft - d)]) if (fits(x)) return x
  }
  return null
}
/**
 * 把一次点击换算成设施左格：点中推荐位就用推荐位；否则让影子盖住
 * 点击列、以点击列为中心，向两侧滑到最近能放下的位置。
 * 哪里都放不下就返回点击列本身，让红框说清还差什么——
 * 和前两层"点哪里就放哪里附近"的手感一致。
 */
export function deepCandidate(w: WorldState, kind: DeepFacilityKind, tapX: number): number {
  // 和推荐位一致：优先不压住晶苔和旧钻头的发现点，实在没有才让玩家自己看见红框。
  return snapFacilityX(tapX, DEEP_SPECS[kind].width, x => deepSpotProblem(w, kind, x) === null, { suggested: deepSuggestion(w, kind), avoid: [MOSS_SPOT.x, DRILL_SPOT.x] })
}
export function deepCostText(kind: DeepFacilityKind): string {
  const s = DEEP_SPECS[kind]
  return [`石料 ${s.cost.stone}`, s.cost.wood ? `旧木料 ${s.cost.wood}` : '', s.crystals ? `晶簇 ${s.crystals}` : ''].filter(Boolean).join(' · ')
}
/**
 * 建设目录：本章还没建的设施、各自由什么卡着，只作展示与自选入口；
 * 推荐顺序仍由 deepGoal 给出，锁住的条目把前置原因写在条目上。
 */
export interface DeepBuildOption { kind: DeepFacilityKind; name: string; icon: string; cost: string; locked: string | null }
export function deepBuildOptions(w: WorldState): DeepBuildOption[] {
  if (!w.deep.entered || !w.deep.foundCrystal) return []
  const order: DeepFacilityKind[] = ['collector', 'distributor', 'lamp', 'workshop', 'furnace']
  return order.filter(kind => !hasDeep(w, kind)).map(kind => {
    const locked = kind !== 'collector' && kind !== 'distributor' && !hasDeep(w, 'distributor') ? '先装稳光配电箱' : null
    return { kind, name: DEEP_SPECS[kind].name, icon: DEEP_SPECS[kind].icon, cost: deepCostText(kind), locked }
  })
}
export function buildDeep(w: WorldState, kind: DeepFacilityKind, x: number): DeepResult {
  const problem = deepBuildProblem(w, kind, x)
  if (problem) return { ok: false, message: problem }
  const before = structuredClone(w.deep), inventory = { ...w.inventory }
  changeMaterials(w, DEEP_SPECS[kind].cost, -1)
  w.deep.crystals -= DEEP_SPECS[kind].crystals ?? 0
  w.deep.facilities.push({ kind, x, y: DEEP_FOOT })
  return success(w, before, inventory, kind === 'workshop' ? '岩壁工坊搭好了！阿木带着工具来啦。' : `${DEEP_SPECS[kind].name}建好啦！点它看看。`)
}

export function deepActionProblem(w: WorldState, action: DeepAction): string | null {
  const d = w.deep
  if (!deepReady(w)) return '先和大家吃完第一顿饭、把电送到泉水层，再来听听岩壁里的声音。'
  if (action === 'meet') return d.metAyan ? '阿岩已经加入啦！' : !deepReach(w, AYAN_SPOT) ? '抓挠声在第二层右侧。先挖通两格高的路，再来打招呼。' : null
  if (!d.metAyan) return '先去侧洞和阿岩打招呼，他知道怎样凿硬岩。'
  if (action === 'excavate') return deepFrontier(w) ? null : '施工梯已经接到底啦。'
  if (action === 'enter') return !deepConnected(w) ? '先请阿岩凿通硬岩盖层。' : d.entered ? '已经到晶簇层啦。' : null
  if (!d.entered) return '先沿施工梯到晶簇层。'
  if (action === 'discover') return d.foundCrystal ? '晶簇已经发现啦。' : !deepReach(w, CRYSTAL_SPOT) ? '先挖通到晶簇旁的路。' : null
  if (!d.foundCrystal) return '先看看岩壁上的天然晶簇。'
  if (action === 'collect') return !hasDeep(w, 'collector') ? '先搭一个晶簇采集台。' : d.crystals > 99990 || d.ore > 99990 ? '材料已经很充足啦，去做点新东西吧。' : null
  if (action === 'smelt') return !hasDeep(w, 'furnace') ? '先砌好小石炉。' : d.ore < 2 ? '需要矿石 2，去采集台取一些。' : null
  if (action === 'craft') return !amuJoined(w) ? '先搭岩壁工坊。' : d.ingots < 2 || d.crystals < 1 ? '需要金属锭 2、晶簇 1。先采晶簇，再用小石炉加工。' : null
  if (action === 'precision') return !amuJoined(w) ? '先搭岩壁工坊。' : d.precision ? '精密工具已经装好啦。' : d.ingots < 1 ? '需要金属锭 1。' : null
  if (action === 'pickaxe') return !amuJoined(w) ? '先搭岩壁工坊。' : d.hardPickaxe ? '硬岩镐已经做好啦。' : d.parts < 1 || d.ingots < 1 ? '需要部件 1、金属锭 1。' : null
  if (action === 'far-light') return !hasDeep(w, 'lamp') ? '先安一盏晶光壁灯。' : d.farLight ? '远光灯已经装好啦。' : d.crystals < 1 || d.parts < 1 ? '需要晶簇 1、部件 1。' : null
  if (action === 'support') return !amuJoined(w) ? '先搭岩壁工坊。' : d.supported ? '竖井已经支撑好啦。' : d.parts < 1 ? '需要部件 1。' : null
  if (action === 'lift') return d.lift ? '电梯已经连通三层啦。' : !d.supported || !hasDeep(w, 'distributor') ? '先在工坊做好竖井支撑，并接通配电箱。' : d.parts < 3 ? '电梯需要部件 3。工坊可以继续加工。' : null
  if(action==='ride-finale'&&!w.finale.liftExtended)return '先接通第九站电梯。'
  if(action==='ride-ruins'&&!w.ruins.liftExtended)return '先接通第八站电梯。'
  if(action==='ride-ventilation'&&!w.ventilation.liftExtended)return '先接通第七站电梯。'
  if(action==='ride-reservoir'&&!w.reservoir.liftExtended)return '先接好第六站电梯。'
  if (action === 'ride-garden' && !w.garden.liftExtended) return '先接好第五层电梯。'
  if (action === 'ride-hall' && !w.hall.liftExtended) return '先接好第四层电梯。'
  return d.lift ? null : '先把电梯造好，再来乘坐。'
}

/** 不含挖掘与行走：施工/抵达须由会话在真实到场后单独提交。 */
export function performDeep(w: WorldState, action: DeepAction): DeepResult {
  const problem = deepActionProblem(w, action)
  if (problem) return { ok: false, message: problem }
  const before = structuredClone(w.deep), inventory = { ...w.inventory }, d = w.deep
  let message = ''
  switch (action) {
    case 'meet': d.metAyan = true; message = '我是阿岩！这双硬岩爪能凿开盖层。你来选开工的时机。'; break
    case 'enter': d.entered = true; message = '到晶簇层啦！岩壁像藏着一小片星空。'; break
    case 'discover': d.foundCrystal = true; d.crystals += 3; d.ore += 3; message = '发现晶簇！松动的晶尖和矿石收好了，晶根继续长在岩壁上。'; break
    case 'collect': d.crystals += 3; d.ore += 2; message = '取下晶簇 3、矿石 2。晶根留好，下次还能来。'; break
    case 'smelt': d.ore -= 2; d.ingots += 2; message = '叮！两块矿石变成了两块金属锭。'; break
    case 'craft': d.ingots -= 2; d.crystals--; d.parts += d.precision ? 2 : 1; d.batches++; message = d.precision ? '精密工具一次做好两个部件！' : '阿木做好一个设施部件啦！'; break
    case 'precision': d.ingots--; d.precision = true; message = '精密工具装好了！同样材料，每次能做两个部件。'; break
    case 'pickaxe': d.parts--; d.ingots--; d.hardPickaxe = true; message = '阿土换上硬岩镐！能定点挖开左边的小矿脉，整片基岩仍然保留。'; break
    case 'far-light': d.parts--; d.crystals--; d.farLight = true; message = '阿灯装上远光镜！晶光壁灯从左右各 3 格照到各 6 格。'; break
    case 'support': d.parts--; d.supported = true; message = '阿岩和阿木把竖井支撑牢啦！可以组装电梯了。'; break
    case 'lift': d.parts -= 3; d.lift = true; message = '电梯装好啦！一起把晶簇材料运回暖窝层吧。'; break
    case 'ride-home': case 'ride-water': case 'ride-crystal': case 'ride-hall': case 'ride-garden': case 'ride-finale': case 'ride-ruins': case 'ride-ventilation': case 'ride-reservoir': d.rides++; message = '叮咚，到站啦！伙伴和材料一起到家。'; break
    default: return { ok: false, message: '请在岩壁前选择施工。' }
  }
  if (d.rides > 0 && d.batches > 0 && d.lift && hasDeep(w, 'lamp') && hasDeep(w, 'distributor')) d.completed = true
  return success(w, before, inventory, message)
}

/** 无后续依赖才撤回；已使用的工具、交通和材料不会被一次撤销破坏。 */
export function undoDeep(w: WorldState, change: DeepChange): boolean {
  const comparable = (state: DeepState) => JSON.stringify({ ...state, foundMoss: false, foundDrill: false })
  if (w.hall.inspected && (change.before.lift !== change.after.lift || change.before.supported !== change.after.supported || JSON.stringify(change.before.facilities) !== JSON.stringify(change.after.facilities))) return false
  if (comparable(w.deep) !== comparable(change.after)) return false
  if (!change.before.metAyan && change.after.metAyan || !change.before.entered && change.after.entered || change.after.rides !== change.before.rides) return false
  w.deep = { ...structuredClone(change.before), foundMoss: w.deep.foundMoss, foundDrill: w.deep.foundDrill }
  w.inventory.stone += change.inventory.stone - change.afterInventory.stone
  w.inventory.wood += change.inventory.wood - change.afterInventory.wood
  return true
}

/** 第一层还缺暖灯的小窝：章末把"用部件换暖灯"留在楼上，让电梯立刻派上用场。 */
function deepWarmLampPod(w: WorldState) {
  return [...w.pods].filter(p => !p.warmLamp && stratumAt(p.y) === 'home' && stratumAt(p.y + 1) === 'home').sort((a, b) => a.id - b.id)[0]
}
export function deepWarmLampPending(w: WorldState): boolean {
  return !!deepWarmLampPod(w)
}
/**
 * 章内四个里程碑：把 13 个连续小步压成孩子看得懂的"大目标"轨道。
 * 每一步仍然一次只推一个，但玩家随时看得见自己在往"三层电梯"走。
 */
export const DEEP_MILESTONES = [
  { icon: '🦔', label: '凿开新路' },
  { icon: '💎', label: '点亮晶簇层' },
  { icon: '🔧', label: '建起工坊' },
  { icon: '🛗', label: '连通三层' },
] as const
/** 当前小步属于第几个里程碑；返回 4 表示本章全部完成。 */
export function deepMilestone(done: number): number {
  return done >= 13 ? 4 : done >= 9 ? 3 : done >= 7 ? 2 : done >= 3 ? 1 : 0
}
export interface DeepGoal { title: string; speaker: string; speech: string; label: string; action?: DeepAction; build?: DeepFacilityKind; visitPod?: number; target: Cell; done: number; milestone: number }
export function deepGoal(w: WorldState): DeepGoal {
  const d = w.deep, shaft = { x: w.exploration.shaftX ?? 27, y: DEEP_FOOT }
  const goal = (done: number, title: string, speaker: string, speech: string, label: string, action?: DeepAction, build?: DeepFacilityKind, target: Cell = CRYSTAL_SPOT): DeepGoal => {
    const facility = action === 'collect' ? 'collector' : action === 'smelt' ? 'furnace' : action === 'craft' ? 'workshop' : null
    const suggested = build ? deepSuggestion(w, build) : null
    const buildTarget = build && suggested !== null ? { x: suggested + DEEP_SPECS[build].width / 2 - .5, y: DEEP_FOOT } : null
    const step = d.supported && done === 9 ? 11 : done
    return { done: step, milestone: deepMilestone(step), title, speaker, speech, label, action, build, target: w.deep.facilities.find(f => f.kind === facility) ?? buildTarget ?? target }
  }
  if (!d.metAyan) return goal(0, '岩壁里有抓挠声', '阿土', '泉水层右边有个小侧洞。有人在里面搬石头！我们去打个招呼吧。', '去侧洞见见阿岩', 'meet', undefined, AYAN_SPOT)
  if (!deepConnected(w)) return goal(1, '请阿岩凿开硬岩', '阿岩', '我的硬岩爪准备好啦！沿着旧梯口往下凿，每凿一段就接好施工梯。', '去旧梯口凿下一段', 'excavate', undefined, deepFrontier(w) ?? shaft)
  if (!d.entered) return goal(2, '沿施工梯下去', '阿岩', '通啦！梯子已经接到洞底。慢慢下去，看看发光的岩壁。', '沿施工梯下到晶簇层', 'enter', undefined, { ...shaft, y: DEEP_FOOT })
  if (!d.foundCrystal) return goal(3, '岩壁上的小星星', '阿土', '这些晶簇在轻轻发光。只取松动的晶尖，把晶根留在这里。', '去看岩壁的天然晶簇', 'discover')
  if (!hasDeep(w, 'collector')) return goal(4, '让晶簇有个采集台', '阿岩', '告诉你一个大计划：用晶簇的电，造一部不用爬梯子的电梯！先找一处喜欢的空洞，搭个低低的采集台。', '选地方搭采集台', undefined, 'collector')
  if (!hasDeep(w, 'distributor')) return goal(5, '把晶光接成稳稳的电', '阿灯', '晶簇的光一明一暗。加个配电箱，新一层的灯就能稳稳地亮起来。', '选地方装配电箱', undefined, 'distributor')
  if (!hasDeep(w, 'lamp')) return goal(6, '点亮晶簇层', '阿灯', '电送到这里啦！在岩壁上挂盏灯，让伙伴看清脚下的路。', '选一处安晶光灯', undefined, 'lamp')
  if (!amuJoined(w)) return goal(7, '搭起岩壁工坊', '阿岩', '有了光，能做更大的东西啦。搭好工作台，就有会做手工的朋友来帮忙。', '选地方搭工坊', undefined, 'workshop')
  if (!hasDeep(w, 'furnace')) return goal(8, '把矿石做成金属锭', '阿木', '你好，我是阿木！先砌个小石炉。矿石做成金属锭，就能加工电梯部件。', '选地方砌小石炉', undefined, 'furnace')
  if (!d.supported || !d.lift) {
    if (d.parts < (d.supported ? 3 : 1) && d.ore < 2 && d.ingots < 2) return goal(9, '采些晶簇和矿石', '阿岩', '材料用过了也没关系。去采集台取一点，晶根会继续留在岩壁上。', '去采集台取材料', 'collect')
    if (d.ingots < 2 && d.parts < (d.supported ? 3 : 1)) return goal(9, '小石炉开工', '阿木', '放进两块矿石，做出两块金属锭。加工很快，不用一直等。', '去小石炉炼金属锭', 'smelt')
    if (d.crystals < 1 && d.parts < (d.supported ? 3 : 1)) return goal(9, '还需要一小簇晶光', '阿灯', '晶簇是部件里的小能源。采集台上还能再取一些。', '去采集台取晶簇矿石', 'collect')
    if (d.parts < (d.supported ? 3 : 1)) return goal(9, '阿木来做设施部件', '阿木', `金属锭 2、晶簇 1，做${d.precision ? '两个' : '一个'}部件。${d.supported ? `电梯还差 ${3 - d.parts} 个部件。` : '先做 1 个，把竖井支撑牢。'}`, '去工坊做电梯部件', 'craft')
    if (!d.supported) return goal(10, '把竖井支撑牢', '阿岩', '先用一个部件，把上下三层的竖井加固。大家都能安心上下。', '去竖井口安装支撑', 'support', undefined, shaft)
    return goal(11, '组装三层电梯', '阿木', '三个部件都齐啦！把安全吊篮装到旧梯道里，梯子也继续保留。', '去旧梯道装电梯', 'lift', undefined, shaft)
  }
  if (!d.completed) return goal(12, '第一次坐电梯回家', '阿木', '把刚做好的材料和伙伴一起送上去！这次不用爬长长的梯子啦。', '乘电梯回暖窝层', 'ride-home', undefined, { ...shaft, y: DEEP_FOOT })
  // 章末尾声落在第一层：先做部件，再乘电梯把晶光带给还黑着的小窝。
  const pod = deepWarmLampPod(w)
  if (pod) {
    if (d.parts < 1) {
      if (d.crystals < 1 || d.ingots < 2 && d.ore < 2) return goal(13, '为小窝取些材料', '阿岩', '电梯已经通啦！再取一份材料，做一个部件给小窝装暖灯。', '去采集台取暖灯材料', 'collect')
      if (d.ingots < 2) return goal(13, '炼好暖灯要用的金属锭', '阿木', '先把两块矿石炼成两块金属锭，再做暖灯部件。', '去小石炉炼金属锭', 'smelt')
      return goal(13, '给小窝做一盏晶光暖灯', '阿木', '金属锭和晶簇齐啦！再做一个部件带回小窝，就能换上晶光暖灯。', '去工坊做暖灯部件', 'craft')
    }
    if (w.exploration.explorer?.y === 11) return { ...goal(13, '给小窝添盏暖光灯', '阿土', '部件已经带回家啦！先看看喜欢的小窝，再请阿灯装上暖光灯。', '去小窝看看暖光灯', undefined, undefined, { x: pod.x + 1, y: pod.y + 1 }), visitPod: pod.id }
    return goal(13, '把晶光带回小窝', '阿土', '部件做好啦！乘电梯回暖窝层，给还黑着的小窝装一盏晶光暖灯。', '乘电梯回暖窝层', 'ride-home', undefined, { ...shaft, y: DEEP_FOOT })
  }
  return goal(13, '三层家园连起来啦', '阿土', '灯亮了，工坊转起来，电梯也通啦！继续扩挖、升级工具，布置你自己的晶簇层吧。', '回晶簇层看看', 'ride-crystal', undefined, { ...shaft, y: DEEP_FOOT })
}

/** 严格校验 v17 状态与真实地形/设施；不接受半截演出存档。 */
export function validDeep(w: WorldState, raw: unknown): DeepState | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const r = raw as DeepState, d = freshDeep()
  for (const key of Object.keys(d) as (keyof DeepState)[]) {
    if (key === 'facilities') continue
    if (typeof d[key] === 'boolean' ? typeof r[key] !== 'boolean' : !Number.isSafeInteger(r[key]) || Number(r[key]) < 0 || Number(r[key]) > 100000) return null
  }
  if (!Array.isArray(r.facilities) || r.facilities.length > 35) return null
  const saved = w.deep
  w.deep = { ...r, facilities: [] }
  try {
    if (r.metAyan && !deepReady(w) || r.entered && !deepConnected(w) || r.foundCrystal && !r.entered) return null
    if ((r.foundMoss || r.foundDrill) && !r.entered) return null
    if (!r.foundCrystal && (r.crystals || r.ore || r.ingots || r.parts || r.batches)) return null
    const kinds = new Set<string>()
    for (const f of r.facilities) {
      if (!f || !Object.hasOwn(DEEP_SPECS, f.kind) || !Number.isInteger(f.x) || f.y !== DEEP_FOOT || f.x < 3 || f.x + DEEP_SPECS[f.kind].width > w.width - 3 || !r.foundCrystal) return null
      if (f.kind !== 'lamp' && kinds.has(f.kind)) return null
      for (let x = f.x; x < f.x + DEEP_SPECS[f.kind].width; x++) if (x === w.exploration.shaftX || x === CRYSTAL_SPOT.x || ![31, 32, 33].every(y => w.tiles[y][x] === TILE.EMPTY) || deepFacilityAt(w, { x, y: 33 })) return null
      if (!atuRoute(w, initialAtuPosition(w), { x: f.x, y: 33 }, true)) return null
      kinds.add(f.kind); w.deep.facilities.push({ kind: f.kind, x: f.x, y: 33 })
    }
    if (kinds.size && !r.entered || (kinds.has('lamp') || kinds.has('workshop') || kinds.has('furnace')) && !kinds.has('distributor')) return null
    if ((r.precision || r.hardPickaxe || r.supported || r.batches > 0) && !kinds.has('workshop')) return null
    if (r.farLight && !kinds.has('lamp') || r.lift && (!r.supported || !kinds.has('distributor')) || r.rides > 0 && !r.lift) return null
    if (r.completed && !(r.lift && r.rides && r.batches && kinds.has('lamp'))) return null
    const blueprint = createInitialWorld()
    for (let y = 22; y <= 30; y++) {
      const x = w.exploration.shaftX
      if (x !== null && blueprint.tiles[y][x] !== TILE.EMPTY && w.tiles[y][x] === TILE.EMPTY && (!r.metAyan || w.tiles[y - 1][x] !== TILE.EMPTY)) return null
    }
    return structuredClone(w.deep)
  } finally { w.deep = saved }
}
