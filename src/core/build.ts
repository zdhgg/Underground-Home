import { LANDMARKS, SURFACE_Y, TILE, isInside, type Cell, type Rect, type SleepPod, type WorldState } from './world'

export const POD_SIZE = { w: 3, h: 2 } as const
// 核心机身宽于可点击区，留出完整外壳占地，避免示意舱压住现有PNG。
const CORE_FOOTPRINT: Rect = { x: 19, y: 8, w: 5, h: 3 }
export type BuildFailure = 'power' | 'bounds' | 'reserved' | 'overlap' | 'soil' | 'support' | 'access'
export type Placement = { ok: true; door: SleepPod['door'] } | { ok: false; reason: BuildFailure }
export const contains = (rect: Rect, x: number, y: number): boolean => x >= rect.x && x < rect.x + rect.w && y >= rect.y && y < rect.y + rect.h
export const podRect = (pod: Cell): Rect => ({ ...pod, ...POD_SIZE })
const overlaps = (a: Rect, b: Rect) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y
export const podDoor = (pod: SleepPod): Cell => ({ x: pod.x + (pod.door === 'left' ? -1 : POD_SIZE.w), y: pod.y + POD_SIZE.h - 1 })

export function isPodStructure(world: WorldState, x: number, y: number): boolean {
  return world.pods.some((pod) => contains(podRect(pod), x, y) || (y === pod.y + POD_SIZE.h && x >= pod.x && x < pod.x + POD_SIZE.w))
}

/** 仅作格子连通判定，不引入居民寻路或复杂AI。设施占地视为不可通行。 */
function reachable(world: WorldState, extra?: Rect): Set<number> {
  const seen = new Set<number>()
  const queue: Cell[] = [{ x: LANDMARKS.shaft.x, y: SURFACE_Y }]
  for (let i = 0; i < queue.length; i++) {
    const { x, y } = queue[i]
    const key = y * world.width + x
    if (!isInside(world, x, y) || y < SURFACE_Y || seen.has(key) || world.tiles[y][x] !== TILE.EMPTY) continue
    if (contains(LANDMARKS.generatorZone, x, y) || (extra && contains(extra, x, y)) || world.pods.some((pod) => contains(podRect(pod), x, y))) continue
    seen.add(key)
    queue.push({ x: x - 1, y }, { x: x + 1, y }, { x, y: y - 1 }, { x, y: y + 1 })
  }
  return seen
}

function accessPreserved(world: WorldState, seen: Set<number>): boolean {
  const coreAccess = { x: LANDMARKS.generatorZone.x - 1, y: LANDMARKS.generator.y }
  return [coreAccess, ...world.pods.map(podDoor)].every(({ x, y }) => seen.has(y * world.width + x))
}

export function canPlacePod(world: WorldState, x: number, y: number, preferredDoor?: SleepPod['door']): Placement {
  if (!world.progress.coreRepaired) return { ok: false, reason: 'power' }
  if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < SURFACE_Y || x + POD_SIZE.w > world.width || y + POD_SIZE.h >= world.height) return { ok: false, reason: 'bounds' }
  const rect = podRect({ x, y })
  if ([CORE_FOOTPRINT, LANDMARKS.shaft].some((area) => overlaps(rect, area))) return { ok: false, reason: 'reserved' }
  if (world.pods.some((pod) => overlaps(rect, podRect(pod)))) return { ok: false, reason: 'overlap' }
  for (let dy = 0; dy < POD_SIZE.h; dy++) for (let dx = 0; dx < POD_SIZE.w; dx++) {
    if (world.tiles[y + dy][x + dx] !== TILE.EMPTY) return { ok: false, reason: 'soil' }
  }
  for (let dx = 0; dx < POD_SIZE.w; dx++) if (world.tiles[y + POD_SIZE.h][x + dx] === TILE.EMPTY) return { ok: false, reason: 'support' }
  const seen = reachable(world, rect)
  if (!accessPreserved(world, seen)) return { ok: false, reason: 'access' }
  for (const door of preferredDoor ? [preferredDoor] : ['left', 'right'] as const) {
    const entry = podDoor({ id: 0, x, y, door })
    if (seen.has(entry.y * world.width + entry.x)) return { ok: true, door }
  }
  return { ok: false, reason: 'access' }
}

export function placePod(world: WorldState, x: number, y: number): SleepPod | null {
  const result = canPlacePod(world, x, y)
  if (!result.ok) return null
  const pod = { id: Math.max(0, ...world.pods.map((item) => item.id)) + 1, x, y, door: result.door }
  world.pods.push(pod)
  return pod
}

/** 撤销挖掘不能埋住能源石、设施，或堵住家园 / 舱门的唯一通路。 */
export function canRestoreDig(world: WorldState, x: number, y: number): boolean {
  if (!isInside(world, x, y) || world.tiles[y][x] !== TILE.EMPTY || isPodStructure(world, x, y)) return false
  if (world.progress.crystalFound && x === LANDMARKS.crystal.x && y === LANDMARKS.crystal.y) return false
  world.tiles[y][x] = TILE.SOIL
  try { return accessPreserved(world, reachable(world)) } finally { world.tiles[y][x] = TILE.EMPTY }
}
