/** 第五层纯规则：新伙伴、菌丝传光、水槽与可重复收获。 */
import { atuRoute, initialAtuPosition } from './atu'
import { canPlacePod } from './build'
import { canAfford, changeMaterials } from './materials'
import { partnerBed } from './partners'
import { GARDEN_FOOT, GARDEN_TOP, TAITAI_SPOT, gardenClearColumn, gardenConnected, gardenLight, gardenSpan, gardenWidth } from './gardenTopology'
import { TILE, createInitialWorld, freshGarden, type Cell, type GardenFacility, type GardenFacilityKind, type GardenState, type Inventory, type SleepPod, type WorldState } from './world'

export const GARDEN_SPECS: Record<GardenFacilityKind, { name: string; cost: Inventory; crystals?: number; detail: string }> = {
  rill: { name: '岩壁引水槽', cost: { stone: 3, wood: 1 }, detail: '小泉把上层清水接进浅浅的石槽。水沿已挖通的后侧管槽送到菌床，前面仍然能走路。' },
  bed: { name: '菌光培育床', cost: { stone: 2, wood: 2 }, detail: '先接水、照光，再请小满照料两次。菌苗长大就能收获食物，收完还会再长，不用等倒计时。' },
  lamp: { name: '菌光壁灯', cost: { stone: 1, wood: 0 }, crystals: 1, detail: '阿灯的小晶光照亮两格；苔苔铺的连续菌毯会把光传进整张菌床。岩石挡光，也挡住菌毯。' },
  bench: { name: '苔石长椅', cost: { stone: 2, wood: 2 }, detail: '嵌进洞壁的矮座位。种完菌苗，来这里看看家园里的一点点星光。' },
  nest: { name: '苔苔的岩壁小窝', cost: { stone: 3, wood: 3 }, detail: '给新朋友留两个真实床位。苔苔睡一张，另一张留给以后的朋友；老家的空床也一样有效。' },
}
export type GardenAction = 'inspect' | 'drain' | 'excavate' | 'enter' | 'meet' | 'extend' | 'weave' | 'care' | 'harvest' | 'walk' | 'rest'
export interface GardenChange { before: GardenState; after: GardenState; cost: Inventory; parts: number; crystals: number; food: number; pod?: SleepPod; rides: number; irrigationBefore: number; irrigationAfter: number }
export type GardenResult = { ok: true; message: string; change: GardenChange } | { ok: false; message: string }
export const gardenReady = (w: WorldState): boolean => w.hall.completed
export const gardenFacility = (w: WorldState, kind: GardenFacilityKind): GardenFacility | undefined => w.garden.facilities.find(f => f.kind === kind)
export const gardenFacilityAt = (w: WorldState, p: Cell): GardenFacility | undefined => p.y >= GARDEN_TOP && p.y <= GARDEN_FOOT ? w.garden.facilities.find(f => p.x >= f.x && p.x < f.x + gardenWidth(f.kind)) : undefined
export const gardenReach = (w: WorldState, to: Cell): Cell[] | null => atuRoute(w, w.exploration.explorer ?? initialAtuPosition(w), to, true)
export const gardenCostText = (kind: GardenFacilityKind): string => { const s = GARDEN_SPECS[kind]; return [`石料 ${s.cost.stone}`, s.cost.wood ? `旧木料 ${s.cost.wood}` : '', s.crystals ? `晶簇 ${s.crystals}` : ''].filter(Boolean).join(' · ') }
export const gardenBed = (w: WorldState, x?: number): GardenFacility | undefined => w.garden.facilities.find(f => f.kind === 'bed' && (x === undefined || f.x === x))

function placementProblem(w: WorldState, kind: GardenFacilityKind, x: number, restoring = false): string | null {
  if (!w.garden.metTaitai) return '先到发光菌丛旁，和苔苔打个招呼。'
  if (kind === 'rill' && gardenFacility(w, kind)) return '引水槽已经接好啦，可以多搭菌床和灯。'
  if (kind === 'nest' && !restoring && partnerBed(w, 'taitai')) return '苔苔已经有床啦，老家的床也算。'
  const span = gardenSpan(w), width = gardenWidth(kind)
  if (!Number.isInteger(x) || !span || x < 3 || x + width > w.width - 3 || x > span.right || x + width - 1 < span.left) return '先挖通这里，再选一处够宽的岩壁。'
  for (let col = x; col < x + width; col++) {
    if (col === w.exploration.shaftX) return '梯口要留空，大家还要上下。'
    if (!gardenClearColumn(w, col) || w.tiles[GARDEN_FOOT + 1][col] === TILE.EMPTY) return '先挖出四格高、有地板的空洞。'
    if (gardenFacilityAt(w, { x: col, y: GARDEN_FOOT }) || w.pods.some(p => p.y === 57 && col >= p.x && col < p.x + 3)) return '这里已经放过设施，换一处吧。'
  }
  if (!gardenReach(w, { x, y: GARDEN_FOOT })) return '这里还没有连到梯口。'
  if (kind === 'nest' && !canPlacePod(w, x, 57, 'left', true).ok) return '小窝门前要有通往老家的路。'
  return null
}
export function gardenBuildProblem(w: WorldState, kind: GardenFacilityKind, x: number): string | null {
  return placementProblem(w, kind, x) ?? (!canAfford(w, GARDEN_SPECS[kind].cost) || w.deep.crystals < (GARDEN_SPECS[kind].crystals ?? 0) ? `需要${gardenCostText(kind)}。可以继续挖土，或回三层采晶簇。` : null)
}
function commit(w: WorldState, before: GardenState, message: string, cost: Inventory = { stone: 0, wood: 0 }, parts = 0, crystals = 0, food = 0, pod?: SleepPod, irrigationBefore = w.reservoir.irrigation): GardenResult {
  changeMaterials(w, cost, -1); w.deep.parts -= parts; w.deep.crystals -= crystals; w.farm.food += food
  return { ok: true, message, change: { before, after: structuredClone(w.garden), cost, parts, crystals, food, rides: w.deep.rides, irrigationBefore, irrigationAfter: w.reservoir.irrigation, ...(pod ? { pod: { ...pod } } : {}) } }
}
export function buildGarden(w: WorldState, kind: GardenFacilityKind, x: number): GardenResult {
  const problem = gardenBuildProblem(w, kind, x)
  if (problem) return { ok: false, message: problem }
  const before = structuredClone(w.garden), spec = GARDEN_SPECS[kind]
  let pod: SleepPod | undefined
  if (kind === 'nest') { pod = { id: Math.max(0, ...w.pods.map(p => p.id)) + 1, x, y: 57, door: 'left', backWall: true }; w.pods.push(pod) }
  w.garden.facilities.push({ kind, x, y: GARDEN_FOOT, ...(kind === 'bed' ? { growth: 0 as const, variety: 'bell' as const } : {}), ...(pod ? { podId: pod.id } : {}) })
  return commit(w, before, `${spec.name}建好啦！`, spec.cost, 0, spec.crystals ?? 0, 0, pod)
}
export function gardenWeavePath(w: WorldState, bed: GardenFacility): number[] | null {
  const rill = gardenFacility(w, 'rill')
  if (!rill) return null
  const left = Math.min(rill.x, bed.x), right = Math.max(rill.x + 2, bed.x + 3), path: number[] = []
  for (let x = left; x <= right; x++) { if (!gardenClearColumn(w, x)) return null; path.push(x) }
  return path
}
export function gardenBedProblem(w: WorldState, bed: GardenFacility): string | null {
  const rill = gardenFacility(w, 'rill')
  if (!rill || !atuRoute(w, rill, bed, true)) return '先建引水槽，并把水槽到菌床的通道挖通。'
  const lit = gardenLight(w)
  if (![0, 1, 2, 3].every(dx => lit.has(bed.x + dx))) return '菌床还缺光。让苔苔铺好菌毯，再在相连的路边安灯；也可以调整灯的位置。'
  return null
}
export function gardenActionProblem(w: WorldState, action: GardenAction, x?: number): string | null {
  const g = w.garden, bed = gardenBed(w, x)
  if (!gardenReady(w)) return '先和六位伙伴办完暖屋宴，再去听下面的滴答声。'
  if (action === 'inspect') return g.inspected ? '入口已经检查过啦。' : null
  if (!g.inspected) return '先检查梯口下方的湿台阶。'
  if (action === 'drain') return g.drained ? '台阶已经干爽啦。' : w.inventory.stone < 2 || w.inventory.wood < 1 ? '接好入口排水槽，需要石料 2、旧木料 1。' : null
  if (!g.drained) return '台阶有点湿滑，先请小泉把水导到侧槽。这里没有倒计时，可以随时离开。'
  if (action === 'excavate') return gardenConnected(w) ? '梯道已经通啦。' : null
  if (action === 'enter') return !gardenConnected(w) ? '先请阿岩凿通潮湿岩盖。' : g.entered ? '已经到菌光花园啦。' : null
  if (!g.entered) return '先沿施工梯下到菌光花园。'
  if (action === 'meet') return g.metTaitai ? '苔苔已经加入啦。' : gardenReach(w, TAITAI_SPOT) ? null : '发光菌丛在右边。先挖通到那里两格高的路。'
  if (!g.metTaitai) return '先认识菌丛旁的蜗牛苔苔。'
  if (action === 'extend') return g.liftExtended ? '五层电梯已经连通啦。' : w.deep.parts < 2 || w.deep.crystals < 1 ? '延长一站需要部件 2、晶簇 1，三层工坊还能加工。' : null
  if (action === 'rest') return gardenFacility(w, 'bench') ? null : '先找一处喜欢的岩壁摆苔石长椅。'
  if (action === 'weave' || action === 'care' || action === 'harvest') {
    if (!bed) return '先自由选一处地方搭菌床。'
    if (action === 'weave') { const path = gardenWeavePath(w, bed); return !path ? '先把水槽到菌床之间的四格高洞壁挖通。' : path.every(col => g.trail.includes(col)) ? '这张菌床的菌毯已经连好啦。' : null }
    if (action === 'care') return (bed.growth ?? 0) >= 2 ? '菌伞长好啦，现在可以收获。' : gardenBedProblem(w, bed)
    return bed.growth !== 2 ? '先请小满照料两次，等菌伞展开再收。' : w.farm.food > 99998 || g.harvests >= 100000 ? '食物很充足啦，先带一点回家吧。' : null
  }
  if (g.walks >= 100000) return '花园里留下好多回忆啦，可以继续种菌和自由建设。'
  if (!g.liftExtended || !g.harvests || !gardenFacility(w, 'rill') || !gardenFacility(w, 'lamp') || !bed || !g.trail.length) return '先接好电梯、水槽、菌床、灯与菌毯，并收获一次。'
  if (!partnerBed(w, 'taitai')) return '苔苔还没有床位。老家或花园里都能给她留个小窝。'
  return gardenReach(w, bed) && gardenReach(w, gardenFacility(w, 'rill')!) ? null : '先接通花园的散步路线。'
}
export function performGarden(w: WorldState, action: GardenAction, x?: number): GardenResult {
  const problem = gardenActionProblem(w, action, x)
  if (problem) return { ok: false, message: problem }
  const before = structuredClone(w.garden), g = w.garden, bed = gardenBed(w, x)
  switch (action) {
    case 'inspect': g.inspected = true; return commit(w, before, '小泉：台阶上的水会打滑。先接个侧槽，慢慢往下走，老家的设施都不受影响。')
    case 'drain': g.drained = true; return commit(w, before, '滴答，水流进侧槽，台阶干爽啦！阿岩可以继续向下凿。', { stone: 2, wood: 1 })
    case 'enter': g.entered = true; return commit(w, before, '第 5 层 · 菌光花园。岩洞里亮着一小片柔柔的光。')
    case 'meet': g.metTaitai = true; return commit(w, before, '我是苔苔！我会铺菌毯，让小小的光沿菌丝传过去。你选菌床的位置，我们一起把花园连起来。')
    case 'extend': g.liftExtended = true; return commit(w, before, '电梯再下一站！花园的收成，也能送回暖光大厅。', undefined, 2, 1)
    case 'weave': g.trail = [...new Set([...g.trail, ...gardenWeavePath(w, bed!)!])].sort((a, b) => a - b); return commit(w, before, '苔苔把菌毯连起来啦！相连的菌丝会把灯光送进菌床。')
    case 'care': {
      const irrigation = w.reservoir.irrigation
      bed!.growth = Math.min(2, (bed!.growth ?? 0) + (irrigation > 0 ? 2 : 1)) as 1 | 2
      if (irrigation > 0) w.reservoir.irrigation--
      return commit(w, before, irrigation > 0 ? '团团送来的清水派上用场啦！菌伞一次展开，可以收获了。' : bed!.growth === 1 ? '小芽探出来啦！再照料一次，菌伞就会展开。' : '菌伞展开啦！可以请小满收获了。', undefined, 0, 0, 0, undefined, irrigation)
    }
    case 'harvest': bed!.growth = 0; g.harvests++; return commit(w, before, '收好两份食物！菌根留在培育床里，还能继续照料。新的扇伞菌也可以试种啦。', undefined, 0, 0, 2)
    case 'walk': g.walks++; g.completed = true; return commit(w, before, '水滴轻响，菌光连成了路。苔苔有了新家，收成也能送回楼上！第五章完成，九层旅途继续。')
    case 'rest': return commit(w, before, '在苔石长椅边歇一歇。没有倒计时，花园会等你回来。')
    default: return { ok: false, message: '请在梯口让阿岩开工。' }
  }
}
export function changeGardenVariety(w: WorldState, x: number): GardenResult {
  const bed = gardenBed(w, x)
  if (!bed || !w.garden.harvests || bed.growth !== 0) return { ok: false, message: '收获过一次、菌床空下来时，就能换种类。' }
  const before = structuredClone(w.garden); bed.variety = bed.variety === 'fan' ? 'bell' : 'fan'
  return commit(w, before, bed.variety === 'fan' ? '换成扇伞菌苗啦！照料方式相同，长大后会展开暖杏色的菌伞。' : '换回铃伞菌苗啦！它会长成蓝绿色的小铃伞。')
}
export function undoGarden(w: WorldState, c: GardenChange): boolean {
  const compare = (g: GardenState) => JSON.stringify({ ...g, foundSpores: false, foundRoot: false })
  if (w.reservoir.inspected && JSON.stringify(c.before.facilities.map(f => ({kind:f.kind,x:f.x,podId:f.podId}))) !== JSON.stringify(c.after.facilities.map(f => ({kind:f.kind,x:f.x,podId:f.podId}))) || w.reservoir.irrigation !== c.irrigationAfter) return false
  if (compare(w.garden) !== compare(c.after) || !c.before.inspected && c.after.inspected || !c.before.entered && c.after.entered || !c.before.metTaitai && c.after.metTaitai || c.before.walks !== c.after.walks || w.farm.food < c.food) return false
  if (!c.before.drained && c.after.drained && w.tiles[47][w.exploration.shaftX!] === TILE.EMPTY || !c.before.liftExtended && c.after.liftExtended && w.deep.rides !== c.rides) return false
  if (c.pod && w.garden.completed) return false
  w.garden = { ...structuredClone(c.before), foundSpores: w.garden.foundSpores, foundRoot: w.garden.foundRoot }
  if (c.pod) w.pods = w.pods.filter(p => p.id !== c.pod!.id)
  w.reservoir.irrigation = c.irrigationBefore
  changeMaterials(w, c.cost); w.deep.parts += c.parts; w.deep.crystals += c.crystals; w.farm.food -= c.food
  return true
}
export interface GardenGoal { done: number; title: string; speaker: string; speech: string; label: string; target: Cell; action?: GardenAction; build?: GardenFacilityKind }
export function gardenGoal(w: WorldState): GardenGoal {
  const g = w.garden, shaft = { x: w.exploration.shaftX ?? 27, y: g.entered ? GARDEN_FOOT : 46 }, bed = gardenBed(w)
  const goal = (done: number, title: string, speaker: string, speech: string, label: string, action?: GardenAction, build?: GardenFacilityKind, target: Cell = shaft): GardenGoal => ({ done, title, speaker, speech, label, action, build, target })
  if (!g.inspected) return goal(0, '暖屋宴后的滴答声', '小泉', '大厅下面有水珠落下来。我们先去看看台阶，再决定怎么往下走。', '看看湿台阶', 'inspect')
  if (!g.drained) return goal(1, '给小水珠一条路', '小泉', '先用石料 2、旧木料 1 接个侧槽。台阶干爽了，大家再向下走。', '接好入口排水槽', 'drain')
  if (!gardenConnected(w)) return goal(2, '向菌光洞伸出梯子', '阿岩', '水导走啦！我一段一段凿，你随时可以叫我停下来。', '请阿岩凿通岩盖', 'excavate')
  if (!g.entered) return goal(3, '岩洞里有一小片星光', '阿土', '梯子接到底啦！下面不是星星，好像是会发光的菌伞。', '下到菌光花园', 'enter')
  if (!g.metTaitai) return goal(4, '菌丛旁的螺旋小壳', '阿土', '右边有一只背着小壳的蜗牛！先挖通到菌丛的路，去打个招呼。', '认识蜗牛苔苔', 'meet', undefined, TAITAI_SPOT)
  if (!g.liftExtended) return goal(5, '给花园接一站电梯', '阿木', '部件 2、晶簇 1，电梯就能送大家来花园，也能带收成回家。', '连通第五站电梯', 'extend')
  if (!gardenFacility(w, 'rill')) return goal(6, '花园也需要清水', '小泉', '选喜欢的位置搭个引水槽。菌床放在同一段挖通的洞壁里，就能接上水。', '选地方搭引水槽', undefined, 'rill')
  if (!bed) return goal(7, '留一块地方种菌苗', '小满', '菌苗喜欢湿润的石槽和柔柔的光。清出四格宽、四格高的空洞吧。', '选地方搭菌床', undefined, 'bed')
  const path = gardenWeavePath(w, bed)
  if (!path || !path.every(x => g.trail.includes(x))) return goal(8, '让苔苔把菌丝连起来', '苔苔', '我会在水槽和菌床之间铺一条菌毯。先把这段洞壁挖通，小灯的光就能沿着它走。', '请苔苔铺菌毯', 'weave', undefined, bed)
  if (!gardenFacility(w, 'lamp') || gardenBedProblem(w, bed)) return goal(9, '一盏灯，照进整张菌床', '阿灯', '把菌光壁灯安在菌床或菌毯旁边。灯先照两格，连起来的菌毯会接着传光。', '选地方安菌光灯', undefined, 'lamp')
  if (!g.harvests && bed.growth !== 2) return goal(10, '小满照料菌苗', '小满', bed.growth === 1 ? '小芽长出来啦！再照料一次，菌伞就会展开。' : '水和光都有啦！我去菌床边照料，让小芽慢慢展开。', '请小满照料一次', 'care', undefined, bed)
  if (!g.harvests) return goal(11, '把第一篮收成带回家', '小满', '菌伞展开啦，收好能给家里添两份食物。菌根留着，还可以接着种。', '收获第一篮菌伞', 'harvest', undefined, bed)
  if (!partnerBed(w, 'taitai')) return goal(12, '给苔苔留张床', '苔苔', '这里也像我的家啦！给我留一张床好吗？老家的空床也可以。', '选地方建岩壁小窝', undefined, 'nest')
  if (!g.completed) return goal(13, '一起走一段菌光路', '苔苔', '水在流，菌毯把光连起来。陪我和小满沿花园走一段，看看我们一起建的家。', '一起看看菌光花园', 'walk', undefined, bed)
  return goal(14, '菌光花园住进了新朋友', '苔苔', '谢谢你给我留了家！继续搭菌床、试种扇伞菌，收成还能送回楼上的暖屋宴。九层旅途继续。', '再走一段菌光路', 'walk', undefined, bed)
}

export function validGarden(w: WorldState, raw: unknown): GardenState | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const r = raw as GardenState, saved = w.garden
  for (const key of Object.keys(freshGarden()) as (keyof GardenState)[]) {
    if (key === 'facilities' || key === 'trail') continue
    if (key === 'harvests' || key === 'walks' ? !Number.isSafeInteger(r[key]) || r[key] < 0 || r[key] > 100000 : typeof r[key] !== 'boolean') return null
  }
  if (!Array.isArray(r.facilities) || r.facilities.length > 38 || !Array.isArray(r.trail) || r.trail.length > 38) return null
  w.garden = { ...r, facilities: [] }
  try {
    if (r.inspected && !gardenReady(w) || r.drained && !r.inspected || r.entered && !gardenConnected(w) || r.metTaitai && !r.entered || (r.liftExtended || r.foundRoot || r.foundSpores) && !r.entered) return null
    if (r.metTaitai && !atuRoute(w, initialAtuPosition(w), TAITAI_SPOT, true)) return null
    const shaft = w.exploration.shaftX, blueprint = createInitialWorld()
    if (shaft !== null) for (let y = 47; y <= 54; y++) if (blueprint.tiles[y][shaft] !== TILE.EMPTY && w.tiles[y][shaft] === TILE.EMPTY && (!r.drained || w.tiles[y - 1][shaft] !== TILE.EMPTY)) return null
    for (const f of r.facilities) {
      if (!f || !Object.hasOwn(GARDEN_SPECS, f.kind) || f.y !== GARDEN_FOOT) return null
      const pods = w.pods; if (f.kind === 'nest') w.pods = pods.filter(p => p.id !== f.podId)
      let problem: string | null
      try { problem = placementProblem(w, f.kind, f.x, true) } finally { w.pods = pods }
      if (problem) return null
      if (f.kind === 'bed' ? ![0, 1, 2].includes(f.growth!) || !['bell', 'fan'].includes(f.variety!) || f.variety === 'fan' && !r.harvests : f.growth !== undefined || f.variety !== undefined) return null
      if (f.kind === 'nest') { const p = w.pods.find(p => p.id === f.podId); if (!p || p.x !== f.x || p.y !== 57 || !p.backWall) return null }
      else if (f.podId !== undefined) return null
      w.garden.facilities.push({ ...f })
    }
    const trail = [...new Set(r.trail)].sort((a, b) => a - b)
    if (trail.length !== r.trail.length || trail.some(x => !Number.isInteger(x) || x < 3 || x > 40 || !gardenClearColumn(w, x))) return null
    if (trail.length && (!r.metTaitai || !gardenFacility(w, 'rill') || !gardenBed(w) || trail.at(-1)! - trail[0] + 1 !== trail.length || !trail.includes(gardenFacility(w, 'rill')!.x))) return null
    if (w.garden.facilities.some(f => f.kind === 'bed' && (f.growth ?? 0) > 0 && gardenBedProblem(w, f))) return null
    if (r.harvests && (!trail.length || !gardenFacility(w, 'lamp') || !gardenBed(w))) return null
    if (r.completed !== (r.walks > 0) || r.completed && (!r.harvests || !r.liftExtended || !partnerBed(w, 'taitai'))) return null
    return structuredClone(w.garden)
  } finally { w.garden = saved }
}
