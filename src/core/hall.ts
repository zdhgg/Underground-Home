/** 第四章：温和的旧梁风险、自由建设与六人暖屋宴。纯规则。 */
import { atuRoute, initialAtuPosition } from './atu'
import { canPlacePod } from './build'
import { canAfford, changeMaterials } from './materials'
import { HALL_PARTNERS, settledPartners } from './partners'
import { HALL_FOOT, HALL_TOP, hallConnected, hallFacilityWidth, hallFrontier, hallSpan } from './hallTopology'
import { TILE, createInitialWorld, freshHall, type Cell, type HallFacility, type HallFacilityKind, type HallState, type Inventory, type SleepPod, type WorldState } from './world'
import type { MealMove } from './meal'

export const HALL_SPECS: Record<HallFacilityKind, { name: string; width: number; cost: Inventory; parts: number; detail: string }> = {
  hall: { name: '嵌岩公共大厅', width: 8, cost: { stone: 4, wood: 4 }, parts: 2, detail: '八格宽的岩拱留在岩层里。长桌放在后侧，前面留给六位伙伴走动。' },
  memory: { name: '家园纪念墙', width: 3, cost: { stone: 2, wood: 1 }, parts: 0, detail: '记下亲手点亮核心、引来泉水、做出部件的经历。这里是旅途中的一个家，九层的故事还在继续。' },
  nest: { name: '岩壁双人小窝', width: 4, cost: { stone: 3, wood: 3 }, parts: 0, detail: '嵌在后侧岩壁的双人舱。床位与老家共用，前面的通路继续留空。' },
}
export type HallAction = 'inspect' | 'brace' | 'excavate' | 'enter' | 'extend' | 'power' | 'table' | 'feast'
export interface HallChange { before: HallState; after: HallState; cost: Inventory; parts: number; crystals: number; pod?: SleepPod }
export type HallResult = { ok: true; message: string; change: HallChange } | { ok: false; message: string }
export const hallReady = (w: WorldState): boolean => w.deep.completed
export const hallFacility = (w: WorldState, kind: HallFacilityKind): HallFacility | undefined => w.hall.facilities.find(f => f.kind === kind)
export const hallFacilityAt = (w: WorldState, p: Cell): HallFacility | undefined => p.y >= HALL_TOP && p.y <= HALL_FOOT ? w.hall.facilities.find(f => p.x >= f.x && p.x < f.x + hallFacilityWidth(f.kind)) : undefined
export const hallReach = (w: WorldState, to: Cell): Cell[] | null => atuRoute(w, w.exploration.explorer ?? initialAtuPosition(w), to, true)
export const hallCostText = (kind: HallFacilityKind): string => { const s = HALL_SPECS[kind]; return `石料 ${s.cost.stone} · 旧木料 ${s.cost.wood}${s.parts ? ` · 部件 ${s.parts}` : ''}` }

function placementProblem(w: WorldState, kind: HallFacilityKind, x: number, restoring = false): string | null {
  if (!w.hall.entered) return '先把旧梁加固，再沿梯子进入大厅层。'
  if (kind !== 'nest' && hallFacility(w, kind)) return '这件设施已经建好啦。'
  if (kind === 'nest' && !restoring && settledPartners(w) >= 6) return '六位伙伴都有床位啦！可以继续布置别的设施。'
  const span = hallSpan(w), width = HALL_SPECS[kind].width
  if (!Number.isInteger(x) || !span || x < 3 || x + width > w.width - 3 || x > span.right || x + width - 1 < span.left) return '先挖通这里，再选一处够宽的岩壁。'
  for (let col = x; col < x + width; col++) {
    if (col === w.exploration.shaftX) return '梯口要留空，大家还要从这里上下。'
    if (!Array.from({ length: 4 }, (_, i) => HALL_TOP + i).every(y => w.tiles[y][col] === TILE.EMPTY) || w.tiles[HALL_FOOT + 1][col] === TILE.EMPTY) return '先挖出四格高、有地板的空洞。'
    if (hallFacilityAt(w, { x: col, y: HALL_FOOT }) || w.pods.some(p => p.y === HALL_FOOT - 1 && col >= p.x && col < p.x + 3)) return '这里已经有设施，换一处吧。'
  }
  if (!hallReach(w, { x, y: HALL_FOOT })) return '先挖通到梯口的两格高通道。'
  if (kind === 'nest' && !canPlacePod(w, x, HALL_FOOT - 1, 'left', true).ok) return '小窝门前要连着能走回家的通道。'
  return null
}
export function hallBuildProblem(w: WorldState, kind: HallFacilityKind, x: number): string | null {
  return placementProblem(w, kind, x) ?? (!canAfford(w, HALL_SPECS[kind].cost) || w.deep.parts < HALL_SPECS[kind].parts ? `还需要${hallCostText(kind)}。挖土能找到材料，三层工坊可以继续做部件。` : null)
}
function commit(w: WorldState, before: HallState, message: string, cost: Inventory = { stone: 0, wood: 0 }, parts = 0, crystals = 0, pod?: SleepPod): HallResult {
  changeMaterials(w, cost, -1); w.deep.parts -= parts; w.deep.crystals -= crystals
  return { ok: true, message, change: { before, after: structuredClone(w.hall), cost, parts, crystals, ...(pod ? { pod: { ...pod } } : {}) } }
}
export function buildHall(w: WorldState, kind: HallFacilityKind, x: number): HallResult {
  const problem = hallBuildProblem(w, kind, x)
  if (problem) return { ok: false, message: problem }
  const before = structuredClone(w.hall), spec = HALL_SPECS[kind]
  let pod: SleepPod | undefined
  if (kind === 'nest') { pod = { id: Math.max(0, ...w.pods.map(p => p.id)) + 1, x, y: HALL_FOOT - 1, door: 'left', backWall: true }; w.pods.push(pod) }
  w.hall.facilities.push({ kind, x, y: HALL_FOOT, ...(pod ? { podId: pod.id } : {}) })
  return commit(w, before, `${spec.name}建好啦！`, spec.cost, spec.parts, 0, pod)
}
export function hallActionProblem(w: WorldState, action: HallAction): string | null {
  const h = w.hall
  if (!hallReady(w)) return '先让三层电梯带着材料回家，再探索旧大厅。'
  if (action === 'inspect') return h.inspected ? '旧梁已经检查过啦。' : null
  if (!h.inspected) return '先看看梯口下方的旧木梁。'
  if (action === 'brace') return h.braced ? '新支撑很牢靠啦。' : w.deep.parts < 1 || w.inventory.wood < 2 ? '加固需要部件 1、旧木料 2。三层工坊能继续加工。' : null
  if (!h.braced) return '阿岩看见木梁松动了。先加固这里；老家仍然可以自由建设。'
  if (action === 'excavate') return hallFrontier(w) ? null : '梯道已经通啦。'
  if (action === 'enter') return !hallConnected(w) ? '先请阿岩凿通旧大厅的盖层。' : h.entered ? '已经到大厅层啦。' : null
  if (!h.entered) return '先沿施工梯进入大厅层。'
  if (action === 'extend') return h.liftExtended ? '电梯已经连通四层啦。' : w.deep.parts < 2 || w.deep.crystals < 1 ? '延长电梯需要部件 2、晶簇 1。' : null
  if (action === 'power') return h.powered ? '大厅的暖光已经亮啦。' : w.deep.crystals < 1 ? '接通暖光需要晶簇 1。' : null
  if (action === 'table') return !hallFacility(w, 'hall') ? '先选地方建公共大厅。' : !h.powered ? '先接通暖光。' : h.tableReady ? '六人餐桌已经摆好啦。' : w.inventory.wood < 2 || w.deep.parts < 1 ? '餐桌需要旧木料 2、部件 1。' : null
  if (!h.liftExtended || !h.powered || !hallFacility(w, 'hall') || !hallFacility(w, 'memory') || !h.tableReady) return '先把电梯、暖光、公共大厅、六人桌和纪念墙准备好。'
  if (settledPartners(w) < 6) return '还有伙伴没床位。老家或大厅层都能安排双人小窝。'
  if (w.farm.food < 1) return '准备一份收成就够大家一起吃啦。去泉水层收菜，再回来开席。'
  return planHallGathering(w) ? null : '还有伙伴走不到餐桌，先把梯口和餐桌前的通路接起来。'
}
export function performHall(w: WorldState, action: HallAction): HallResult {
  const problem = hallActionProblem(w, action)
  if (problem) return { ok: false, message: problem }
  const before = structuredClone(w.hall), h = w.hall
  switch (action) {
    case 'inspect': h.inspected = true; return commit(w, before, '阿岩：旧木梁有点松了。先装新支撑，再向下挖；我们随时都能回家。')
    case 'brace': h.braced = true; return commit(w, before, '木梁已经托稳！新支撑装在岩壁里，可以开工啦。', { stone: 0, wood: 2 }, 1)
    case 'enter': h.entered = true; return commit(w, before, '第 4 层 · 暖光大厅。宽宽的岩洞，留给你决定怎样布置。')
    case 'extend': h.liftExtended = true; return commit(w, before, '叮咚！四层电梯装好，旧梯子也继续保留。', undefined, 2, 1)
    case 'power': h.powered = true; return commit(w, before, '暖光顺着梯道送来了，灯光留在挖开的岩洞里。', undefined, 0, 1)
    case 'table': h.tableReady = true; return commit(w, before, '六个碗、六把小勺。每一位伙伴都有自己的位置。', { stone: 0, wood: 2 }, 1)
    case 'feast': w.farm.food--; h.feasts++; h.completed = true; return commit(w, before, '六位伙伴到齐！暖屋宴开席啦。四层家园建成了，九层旅途还在前方。')
    default: return { ok: false, message: '请在岩壁前让阿岩开工。' }
  }
}
export function planHallGathering(w: WorldState): { atu: Cell[]; moves: MealMove[] } | null {
  const hall = hallFacility(w, 'hall')
  if (!hall) return null
  const seats = HALL_PARTNERS.map((_, i) => ({ x: hall.x + i + 1, y: HALL_FOOT })), atu = hallReach(w, seats[0])
  if (!atu) return null
  const moves: MealMove[] = []
  for (let i = 1; i < HALL_PARTNERS.length; i++) {
    const id = HALL_PARTNERS[i].id
    if (id === 'atu') return null
    const from = w.workers[id], route = from && atuRoute(w, from, seats[i], true)
    if (!route) return null
    moves.push({ id, route, seat: seats[i] })
  }
  return { atu, moves }
}
export function undoHall(w: WorldState, c: HallChange): boolean {
  const comparable = (h: HallState) => JSON.stringify({ ...h, muralFound: false, warmLightFound: false })
  if (w.garden.inspected) return false
  if (comparable(w.hall) !== comparable(c.after) || c.after.feasts !== c.before.feasts || !c.before.inspected && c.after.inspected || !c.before.entered && c.after.entered) return false
  if (!c.before.braced && c.after.braced && w.tiles[34][w.exploration.shaftX!] === TILE.EMPTY || !c.before.liftExtended && c.after.liftExtended && (w.exploration.explorer?.y ?? 0) >= 34) return false
  w.hall = { ...structuredClone(c.before), muralFound: w.hall.muralFound, warmLightFound: w.hall.warmLightFound }
  if (c.pod) w.pods = w.pods.filter(p => p.id !== c.pod!.id)
  changeMaterials(w, c.cost); w.deep.parts += c.parts; w.deep.crystals += c.crystals
  return true
}
export interface HallGoal { done: number; title: string; speaker: string; speech: string; label: string; action?: HallAction; build?: HallFacilityKind; target: Cell }
export function hallGoal(w: WorldState): HallGoal {
  const h = w.hall, shaft = { x: w.exploration.shaftX ?? 27, y: h.entered ? HALL_FOOT : 33 }
  const goal = (done: number, title: string, speaker: string, speech: string, label: string, action?: HallAction, build?: HallFacilityKind, target: Cell = shaft): HallGoal => ({ done, title, speaker, speech, label, action, build, target })
  if (!h.inspected) return goal(0, '梯口下方的旧木梁', '阿岩', '电梯下面还有一扇旧门。木梁发出轻轻的吱呀声，我们先过去检查。', '看看旧木梁', 'inspect')
  if (!h.braced) return goal(1, '先把旧木梁托稳', '阿岩', '这里有一点松动。用部件 1、旧木料 2 加固，就能继续向下。没有倒计时，随时可以离开。', '安装新支撑', 'brace')
  if (!hallConnected(w)) return goal(2, '凿开通往大厅的梯道', '阿岩', '支撑稳稳的！我一段一段凿，你来决定什么时候开工和停下。', '请阿岩凿通梯道', 'excavate', undefined, hallFrontier(w) ?? shaft)
  if (!h.entered) return goal(3, '宽宽的岩洞在下面', '阿土', '施工梯接到底啦！沿梯子下去，找一处自己喜欢的岩壁。', '下到暖光大厅', 'enter')
  if (!h.liftExtended) return goal(4, '电梯再下一层', '阿木', '把电梯延长一站。部件 2、晶簇 1，四层之间都能运送材料啦。', '接好第四层电梯', 'extend')
  if (!h.powered) return goal(5, '把暖光送进旧岩洞', '阿灯', '用晶簇 1 接上暖光。旧洞先变亮，再慢慢变成大家的客厅。', '接通大厅暖光', 'power')
  if (!hallFacility(w, 'hall')) return goal(6, '选一处建公共大厅', '阿土', '清出八格宽、四格高的空洞。靠左靠右都由你，记得给梯口留路。', '选地方建公共大厅', undefined, 'hall')
  if (!h.tableReady) return goal(7, '给每个人留个座位', '阿木', '大厅搭好啦！旧木料 2、部件 1，就能做好六人桌和六个小座位。', '摆好六人长桌', 'table', undefined, hallFacility(w, 'hall'))
  if (!hallFacility(w, 'memory')) return goal(8, '留一面家园纪念墙', '阿土', '从第一盏灯到现在的四层家园，都值得记下来。选喜欢的岩壁，挂上我们的纪念墙。', '选地方挂纪念墙', undefined, 'memory')
  if (settledPartners(w) < 6) return goal(9, '每位伙伴都有一张床', '阿土', '老家的床也算！还缺床位时，可以在这里再建一个双人小窝。', '选地方建双人小窝', undefined, 'nest')
  if (!h.completed) return goal(10, '六个人的暖屋宴', '小满', '一份收成，一张长桌。等六位伙伴沿通道全部走到自己的座位，我们就开席！', '邀请大家来暖屋', 'feast', undefined, hallFacility(w, 'hall'))
  return goal(11, '四层家园，暖暖亮着', '阿土', '这里是旅途中的暖屋庆典。九层故事还没结束；现在可以继续挖土、看纪念墙、给家换个布置。', '再聚一桌暖屋饭', 'feast', undefined, hallFacility(w, 'hall'))
}

/** v18：校验真实结构和前置依赖；预算与 UI 不参与存档判定。 */
export function validHall(w: WorldState, raw: unknown): HallState | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const r = raw as HallState, saved = w.hall
  for (const key of Object.keys(freshHall()) as (keyof HallState)[]) {
    if (key === 'facilities') continue
    if (key === 'feasts' ? !Number.isSafeInteger(r[key]) || r[key] < 0 || r[key] > 100000 : typeof r[key] !== 'boolean') return null
  }
  if (!Array.isArray(r.facilities) || r.facilities.length > 5) return null
  w.hall = { ...r, facilities: [] }
  try {
    if (r.inspected && !hallReady(w) || r.braced && !r.inspected || r.entered && !hallConnected(w) || (r.liftExtended || r.powered || r.muralFound || r.warmLightFound) && !r.entered) return null
    const x = w.exploration.shaftX, blueprint = createInitialWorld()
    if (x !== null) for (let y = 34; y <= 42; y++) if (blueprint.tiles[y][x] !== TILE.EMPTY && w.tiles[y][x] === TILE.EMPTY && (!r.braced || w.tiles[y - 1][x] !== TILE.EMPTY)) return null
    for (const f of r.facilities) {
      if (!f || !Object.hasOwn(HALL_SPECS, f.kind) || f.y !== HALL_FOOT) return null
      const pods = w.pods
      if (f.kind === 'nest') w.pods = pods.filter(p => p.id !== f.podId)
      let problem: string | null
      try { problem = placementProblem(w, f.kind, f.x, true) } finally { w.pods = pods }
      if (problem) return null
      if (f.kind === 'nest') {
        const pod = w.pods.find(p => p.id === f.podId)
        if (!pod || !pod.backWall || pod.x !== f.x || pod.y !== HALL_FOOT - 1) return null
      } else if (f.podId !== undefined) return null
      w.hall.facilities.push({ ...f })
    }
    if (r.tableReady && (!r.powered || !hallFacility(w, 'hall'))) return null
    if (r.completed !== (r.feasts > 0) || r.completed && (!r.liftExtended || !r.tableReady || !hallFacility(w, 'memory') || settledPartners(w) < 6)) return null
    return structuredClone(w.hall)
  } finally { w.hall = saved }
}
