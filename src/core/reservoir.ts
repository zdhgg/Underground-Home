import { atuRoute, initialAtuPosition } from './atu'
import { canPlacePod } from './build'
import { canAfford, changeMaterials } from './materials'
import { partnerBed } from './partners'
import { RESERVOIR_FOOT, TUANTUAN_SPOT, reservoirCanalPath, reservoirClear, reservoirConnected, reservoirNetwork, reservoirSpan, reservoirWidth } from './reservoirTopology'
import { TILE, createInitialWorld, freshReservoir, type Cell, type Inventory, type ReservoirFacilityKind, type ReservoirState, type SleepPod, type WaterRoute, type WorldState } from './world'
export const RESERVOIR_SPECS: Record<ReservoirFacilityKind, { name: string; cost: Inventory; parts: number; detail: string }> = {
  intake: { name: '卵石滤水口', cost: { stone: 3, wood: 1 }, parts: 0, detail: '小泉把清水接进卵石层。过滤后的水送入后侧管渠，不占大家走路的地方。' },
  basin: { name: '嵌岩蓄水池', cost: { stone: 5, wood: 2 }, parts: 1, detail: '池子嵌在岩层里，三道水位线看得见。关好闸再蓄水，最多存三格，不会溢出淹家。' },
  gate: { name: '双路分水闸', cost: { stone: 2, wood: 2 }, parts: 1, detail: '团团的水闸可以关闭，也能把清水送去菌光花园或暖光大厅。一次只选一条路，水流方向看得见。' },
  wheel: { name: '提水小水轮', cost: { stone: 2, wood: 3 }, parts: 1, detail: '阿木做水轮，团团接管渠。每次提水用一格存水，把清水送回楼上；水轮在提水时才转动。' },
  nest: { name: '河狸岩壁小窝', cost: { stone: 3, wood: 3 }, parts: 0, detail: '给团团留一张真实床。苔苔小窝里空着的那张床也算，伙伴的老床位保持原样。' },
}
export type ReservoirAction = 'inspect' | 'shore' | 'excavate' | 'enter' | 'meet' | 'extend' | 'connect' | 'fill' | 'pump' | 'tour'
export interface ReservoirChange { before: ReservoirState; after: ReservoirState; cost: Inventory; parts: number; crystals: number; rides: number; pod?: SleepPod }
export type ReservoirResult = { ok: true; message: string; change: ReservoirChange } | { ok: false; message: string }
export const reservoirReady = (w: WorldState): boolean => w.garden.completed
export const reservoirFacility = (w: WorldState, kind: ReservoirFacilityKind) => w.reservoir.facilities.find(f => f.kind === kind)
export const reservoirFacilityAt = (w: WorldState, p: Cell) => p.y >= 67 && p.y <= 70 ? w.reservoir.facilities.find(f => p.x >= f.x && p.x < f.x + reservoirWidth(f.kind)) : undefined
export const reservoirReach = (w: WorldState, p: Cell): Cell[] | null => atuRoute(w, w.exploration.explorer ?? initialAtuPosition(w), p, true)
export const reservoirCostText = (kind: ReservoirFacilityKind): string => { const s = RESERVOIR_SPECS[kind]; return `石料 ${s.cost.stone} · 旧木料 ${s.cost.wood}${s.parts ? ` · 部件 ${s.parts}` : ''}` }
function placementProblem(w: WorldState, kind: ReservoirFacilityKind, x: number, restoring = false): string | null {
  if (!w.reservoir.metTuantuan) return '先到左边的旧水闸，和河狸团团打个招呼。'
  if (kind !== 'nest' && reservoirFacility(w, kind)) return '这件设施已经建好啦，点它就能使用。'
  if (kind === 'nest' && !restoring && partnerBed(w, 'tuantuan')) return '团团已经有床位啦，苔苔小窝里空着的床也算。'
  const width = reservoirWidth(kind), span = reservoirSpan(w)
  if (!Number.isInteger(x) || !span || x < 3 || x + width > w.width - 3 || x > span.right || x + width - 1 < span.left) return '先挖通这里，留出够宽的洞壁。'
  for (let col = x; col < x + width; col++) {
    if (col === w.exploration.shaftX) return '梯口要留空，大家还要上下。'
    if (!reservoirClear(w, col) || w.tiles[71][col] === TILE.EMPTY) return '先挖出四格高、有地板的空洞。'
    if (reservoirFacilityAt(w, { x: col, y: 70 }) || w.pods.some(p => p.y === 69 && col >= p.x && col < p.x + 3)) return '这里已经有设施，换一处吧。'
  }
  if (!reservoirReach(w, { x, y: 70 })) return '这里还没有连到梯口。'
  if (kind === 'nest' && !canPlacePod(w, x, 69, 'left', true).ok) return '床前要留一条能走回家的路。'
  return null
}
export function reservoirBuildProblem(w: WorldState, kind: ReservoirFacilityKind, x: number): string | null {
  return placementProblem(w, kind, x) ?? (!canAfford(w, RESERVOIR_SPECS[kind].cost) || w.deep.parts < RESERVOIR_SPECS[kind].parts ? `需要${reservoirCostText(kind)}。可继续挖土，或回三层工坊加工部件。` : null)
}
function commit(w: WorldState, before: ReservoirState, message: string, cost: Inventory = { stone: 0, wood: 0 }, parts = 0, crystals = 0, pod?: SleepPod): ReservoirResult {
  changeMaterials(w, cost, -1); w.deep.parts -= parts; w.deep.crystals -= crystals
  return { ok: true, message, change: { before, after: structuredClone(w.reservoir), cost, parts, crystals, rides: w.deep.rides, ...(pod ? { pod: { ...pod } } : {}) } }
}
export function buildReservoir(w: WorldState, kind: ReservoirFacilityKind, x: number): ReservoirResult {
  const problem = reservoirBuildProblem(w, kind, x)
  if (problem) return { ok: false, message: problem }
  const before = structuredClone(w.reservoir), spec = RESERVOIR_SPECS[kind]
  let pod: SleepPod | undefined
  if (kind === 'nest') { pod = { id: Math.max(0, ...w.pods.map(p => p.id)) + 1, x, y: 69, door: 'left', backWall: true }; w.pods.push(pod) }
  w.reservoir.facilities.push({ kind, x, y: 70, ...(pod ? { podId: pod.id } : {}) })
  return commit(w, before, `${spec.name}建好啦！`, spec.cost, spec.parts, 0, pod)
}
export function reservoirActionProblem(w: WorldState, action: ReservoirAction): string | null {
  const r = w.reservoir
  if (!reservoirReady(w)) return '先和苔苔完成花园散步，再来看看下面的水声。'
  if (action === 'inspect') return r.inspected ? '渗水岩缝已经检查过啦。' : null
  if (!r.inspected) return '先看看梯口下方渗水的岩缝。'
  if (action === 'shore') return r.shored ? '止水护框已经装牢啦。' : w.inventory.stone < 2 || w.inventory.wood < 2 || w.deep.parts < 1 ? '护框需要石料 2、旧木料 2、部件 1。' : null
  if (!r.shored) return '岩缝在渗水，先请阿岩装牢止水护框。旧家不受影响，可以随时离开。'
  if (action === 'excavate') return reservoirConnected(w) ? '梯道已经通啦。' : null
  if (action === 'enter') return !reservoirConnected(w) ? '先请阿岩凿通渗水岩盖。' : r.entered ? '已经到蓄水回廊啦。' : null
  if (!r.entered) return '先沿施工梯下到蓄水回廊。'
  if (action === 'meet') return r.metTuantuan ? '团团已经加入啦。' : reservoirReach(w, TUANTUAN_SPOT) ? null : '团团在左边旧水闸旁，先挖通两格高的路。'
  if (!r.metTuantuan) return '先认识左边水闸旁的河狸团团。'
  if (action === 'extend') return r.liftExtended ? '六站电梯已经连通啦。' : w.deep.parts < 2 || w.deep.crystals < 1 ? '延长一站需要部件 2、晶簇 1。' : null
  if (action === 'connect') return !reservoirCanalPath(w) ? '先建好滤水口、蓄水池、水闸和水轮，并挖通它们之间四格高的洞壁。' : reservoirNetwork(w) ? '后侧管渠已经连好啦。' : null
  if (!reservoirNetwork(w)) return '先请团团把四件水工设施与梯口的管渠连起来。'
  if (action === 'fill') return r.fills >= 100000 ? '家园记下很多次蓄水啦，先用完池里的清水吧。' : r.valve !== 'closed' ? '先关闭分水闸，再蓄水。' : r.water >= 3 ? '水已经到三道刻线，不用再蓄啦。' : null
  if (action === 'pump') return r.valve === 'closed' ? '先在水闸选择清水要去的地方。' : r.water < 1 ? '蓄水池空啦。先关闸，再接一池清水。' : r.valve === 'garden' && r.irrigation > 2 ? '花园还有清水可用，先请小满照料菌苗，或改送大厅。' : r.gardenDeliveries >= 100000 || r.hallDeliveries >= 100000 ? '家里清水很充足啦，先看看水位和管渠吧。' : null
  if (!r.liftExtended || !r.gardenDeliveries || !r.hallDeliveries) return '先接好六站电梯，并分别送一次清水到花园和大厅。'
  if (!partnerBed(w, 'tuantuan')) return '给团团留一张真实床，老家或苔苔小窝里的空床都算。'
  return r.tours >= 100000 ? '回廊里留下好多回忆啦，继续给家园供水吧。' : null
}
export function setWaterRoute(w: WorldState, route: WaterRoute): ReservoirResult {
  if (!['closed', 'garden', 'hall'].includes(route) || !w.reservoir.metTuantuan || !reservoirNetwork(w)) return { ok: false, message: '先建好水闸并连通管渠，再来选择水路。' }
  if (w.reservoir.valve === route) return { ok: false, message: '水闸已经在这个位置啦。' }
  const before = structuredClone(w.reservoir); w.reservoir.valve = route
  return commit(w, before, route === 'closed' ? '分水闸关好啦，可以安心蓄水。' : `水路选好啦：${route === 'garden' ? '菌光花园' : '暖光大厅'}。再转动水轮，清水才会送出去。`)
}
export function performReservoir(w: WorldState, action: ReservoirAction): ReservoirResult {
  const problem = reservoirActionProblem(w, action)
  if (problem) return { ok: false, message: problem }
  const before = structuredClone(w.reservoir), r = w.reservoir
  switch (action) {
    case 'inspect': r.inspected = true; return commit(w, before, '阿岩：水从小岩缝里慢慢渗出来。先装止水护框，再向下凿，老家的墙和床都不用搬。')
    case 'shore': r.shored = true; return commit(w, before, '护框装牢啦！水沿侧槽流走，新梯道可以开工了。', { stone: 2, wood: 2 }, 1)
    case 'enter': r.entered = true; return commit(w, before, '第 6 层 · 蓄水回廊。水声在岩洞里轻轻回响。')
    case 'meet': r.metTuantuan = true; return commit(w, before, '我是团团！小泉最会引水，我最会筑渠修闸。你选设施放哪儿，我来把它们连成水路！')
    case 'extend': r.liftExtended = true; return commit(w, before, '电梯接到第六站啦！伙伴和材料可以一起上下。', undefined, 2, 1)
    case 'connect': r.canal = reservoirCanalPath(w)!; return commit(w, before, '团团把后侧管渠连起来啦！滤水口、池子、水闸和水轮都接上了。')
    case 'fill': r.water = 3; r.fills++; return commit(w, before, '清水装到三道刻线啦，进水口自动停住，不会溢出。现在由你选清水送到哪里。')
    case 'pump': {
      r.water--
      if (r.valve === 'garden') { r.gardenDeliveries++; r.irrigation += 2; return commit(w, before, '清水送到菌光花园啦！接下来两次照料，水槽里的清水会帮菌苗一次长到展开。') }
      r.hallDeliveries++; return commit(w, before, '清水送到暖光大厅啦！长桌旁多了一瓶清水，纪念墙也记下了回廊的新故事。')
    }
    case 'tour': r.tours++; r.completed = true; return commit(w, before, '团团和小泉把水路连回了家！第六章完成，九层旅途继续。')
    default: return { ok: false, message: '请在梯口让阿岩开工。' }
  }
}
export function undoReservoir(w: WorldState, c: ReservoirChange): boolean {
  const compare = (r: ReservoirState) => JSON.stringify({ ...r, foundReed: false, foundShell: false })
  if (compare(w.reservoir) !== compare(c.after) || !c.before.inspected && c.after.inspected || !c.before.entered && c.after.entered || !c.before.metTuantuan && c.after.metTuantuan || c.before.tours !== c.after.tours) return false
  if (!c.before.shored && c.after.shored && w.tiles[59][w.exploration.shaftX!] === TILE.EMPTY || !c.before.liftExtended && c.after.liftExtended && w.deep.rides !== c.rides || c.pod && w.reservoir.completed) return false
  w.reservoir = { ...structuredClone(c.before), foundShell: w.reservoir.foundShell, foundReed: w.reservoir.foundReed }
  if (c.pod) w.pods = w.pods.filter(p => p.id !== c.pod!.id)
  changeMaterials(w, c.cost); w.deep.parts += c.parts; w.deep.crystals += c.crystals
  return true
}
export interface ReservoirGoal { done: number; title: string; speaker: string; speech: string; label: string; target: Cell; action?: ReservoirAction; build?: ReservoirFacilityKind; route?: WaterRoute }
export function reservoirGoal(w: WorldState): ReservoirGoal {
  const r = w.reservoir, shaft = { x: w.exploration.shaftX ?? 27, y: r.entered ? 70 : 58 }
  const goal = (done: number, title: string, speaker: string, speech: string, label: string, action?: ReservoirAction, build?: ReservoirFacilityKind, target: Cell = shaft, route?: WaterRoute): ReservoirGoal => ({ done, title, speaker, speech, label, action, build, target, route })
  if (!r.inspected) return goal(0, '菌光洞下面的细细水声', '阿岩', '新岩缝在渗水。我们先看清楚，再决定怎么往下挖。', '看看渗水岩缝', 'inspect')
  if (!r.shored) return goal(1, '先装牢止水护框', '阿岩', '石料 2、旧木料 2、部件 1，护住梯口，让水流进侧槽。没有倒计时，随时可以离开。', '安装止水护框', 'shore')
  if (!reservoirConnected(w)) return goal(2, '向水声伸出施工梯', '阿岩', '护框稳稳的！我一段一段凿，你随时可以让我停下来。', '凿通渗水岩盖', 'excavate')
  if (!r.entered) return goal(3, '沿梯子去蓄水回廊', '阿土', '梯子接到底啦，下面的旧水闸旁好像有人在忙。', '下到蓄水回廊', 'enter')
  if (!r.metTuantuan) return goal(4, '旧水闸旁的扁尾巴', '阿土', '左边有只尾巴扁扁的河狸！先挖通到旧水闸的路，去认识他。', '认识河狸团团', 'meet', undefined, TUANTUAN_SPOT)
  if (!r.liftExtended) return goal(5, '电梯接到第六站', '阿木', '部件 2、晶簇 1。新水路建起来之前，先让材料和伙伴上下方便。', '连通第六站电梯', 'extend')
  for (const [kind, done, speech] of [['intake', 6, '找一处洞壁，先把清水接进卵石滤水口。'], ['basin', 7, '留五格宽，给家园存下一池清水。池子的位置由你来选。'], ['gate', 8, '水闸有两个出口：一条去花园，一条去大厅。你来决定每次送哪边。'], ['wheel', 9, '把小水轮装在喜欢的洞壁。它能把存水提上楼，前面仍然能走路。']] as const) if (!reservoirFacility(w, kind)) return goal(done, `建一个${RESERVOIR_SPECS[kind].name}`, kind === 'intake' ? '小泉' : kind === 'wheel' ? '阿木' : '团团', speech, '选地方建造', undefined, kind)
  if (!reservoirNetwork(w)) return goal(10, '团团来筑一条管渠', '团团', '把四件设施之间的四格高洞壁挖通。我沿后侧把它们连到梯口，清水才能回楼上。', '请团团接通管渠', 'connect', undefined, reservoirFacility(w, 'gate'))
  if (!r.fills || !r.water && (!r.gardenDeliveries || !r.hallDeliveries)) {
    if (r.valve !== 'closed') return goal(11, '先关闸，再蓄水', '团团', '关好分水闸，蓄水池就能安心装满。存水不会因为离开而减少。', '关闭分水闸', undefined, undefined, reservoirFacility(w, 'gate'), 'closed')
    return goal(11, '把水蓄到三道刻线', '小泉', '清水经过卵石层，流进池子。只装到三道刻线，满了就停。', '蓄一池清水', 'fill', undefined, reservoirFacility(w, 'basin'))
  }
  for (const route of ['garden', 'hall'] as const) if (!(route === 'garden' ? r.gardenDeliveries : r.hallDeliveries)) {
    const name = route === 'garden' ? '菌光花园' : '暖光大厅'
    if (r.valve !== route) return goal(route === 'garden' ? 12 : 14, `清水送去${name}`, '团团', `把闸柄转到${name}。选好方向后，再去转水轮。`, `把水闸转向${name}`, undefined, undefined, reservoirFacility(w, 'gate'), route)
    return goal(route === 'garden' ? 13 : 15, `给${name}提一格水`, '小泉', route === 'garden' ? '转动水轮，给花园留两次清水照料。' : '转动水轮，暖屋长桌旁就有清水啦。', '转动水轮送清水', 'pump', undefined, reservoirFacility(w, 'wheel'))
  }
  if (!partnerBed(w, 'tuantuan')) return goal(16, '给团团留一张床', '团团', '我也想住在这里。老家的空床、苔苔旁边的空床都可以。', '选地方建岩壁小窝', undefined, 'nest')
  return goal(17, r.completed ? '清水连回了八位伙伴的家' : '一起巡看新水路', '团团', r.completed ? '继续蓄水、分流、去花园照料菌苗，也能回大厅看看新清水瓶。九层旅途继续。' : '陪我和小泉从滤水口走到水闸。水声连成一路，家园又多了一位朋友！', '一起巡看蓄水回廊', 'tour', undefined, reservoirFacility(w, 'gate'))
}
export function validReservoir(w: WorldState, raw: unknown): ReservoirState | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const r = raw as ReservoirState, saved = w.reservoir
  for (const key of Object.keys(freshReservoir()) as (keyof ReservoirState)[]) {
    if (['facilities', 'canal', 'valve'].includes(key)) continue
    const type = typeof freshReservoir()[key]
    if (type === 'boolean' ? typeof r[key] !== 'boolean' : !Number.isSafeInteger(r[key]) || Number(r[key]) < 0 || Number(r[key]) > 100000) return null
  }
  if (!['closed', 'garden', 'hall'].includes(r.valve) || r.water > 3 || r.irrigation > 4 || !Array.isArray(r.facilities) || r.facilities.length > 6 || !Array.isArray(r.canal) || r.canal.length > 38) return null
  w.reservoir = { ...r, facilities: [] }
  try {
    if (r.inspected && !reservoirReady(w) || r.shored && !r.inspected || r.entered && !reservoirConnected(w) || r.metTuantuan && (!r.entered || !atuRoute(w, initialAtuPosition(w), TUANTUAN_SPOT, true)) || r.liftExtended && !r.metTuantuan || (r.foundShell || r.foundReed) && !r.entered) return null
    const blueprint = createInitialWorld(), shaft = w.exploration.shaftX
    if (shaft !== null) for (let y = 59; y <= 66; y++) if (blueprint.tiles[y][shaft] !== TILE.EMPTY && w.tiles[y][shaft] === TILE.EMPTY && (!r.shored || w.tiles[y - 1][shaft] !== TILE.EMPTY)) return null
    for (const f of r.facilities) {
      if (!f || !Object.hasOwn(RESERVOIR_SPECS, f.kind) || f.y !== RESERVOIR_FOOT) return null
      const pods = w.pods; if (f.kind === 'nest') w.pods = pods.filter(p => p.id !== f.podId)
      let problem: string | null
      try { problem = placementProblem(w, f.kind, f.x, true) } finally { w.pods = pods }
      if (problem) return null
      if (f.kind === 'nest') { const p = pods.find(p => p.id === f.podId); if (!p || p.x !== f.x || p.y !== 69 || !p.backWall) return null }
      else if (f.podId !== undefined) return null
      w.reservoir.facilities.push({ ...f })
    }
    const path = reservoirCanalPath(w)
    if (r.canal.length && (!path || JSON.stringify(r.canal) !== JSON.stringify(path))) return null
    if ((r.water || r.fills || r.gardenDeliveries || r.hallDeliveries || r.irrigation || r.valve !== 'closed') && !reservoirNetwork(w)) return null
    if (r.water && !r.fills || r.irrigation > Math.min(4, r.gardenDeliveries * 2) || r.gardenDeliveries + r.hallDeliveries + r.water > r.fills * 3) return null
    if (r.completed !== (r.tours > 0) || r.completed && (!r.liftExtended || !r.gardenDeliveries || !r.hallDeliveries || !partnerBed(w, 'tuantuan'))) return null
    return structuredClone(w.reservoir)
  } finally { w.reservoir = saved }
}
