import { podBlocksPassage } from '../core/passages'
import { LANDMARKS, SURFACE_Y, TILE, isInside, type Cell, type SleepPod, type WorldState } from '../core/world'
import { contains, podDoor, podRect } from '../core/build'

/**
 * 伙伴在避难所里的初始位置（瓦片坐标）。
 * 入场路径只做一次性演出，不做持续居民 AI。
 */
export const FRIEND_HOME_CELLS: readonly Cell[] = [
  { x: 18, y: 11 },
  { x: 23, y: 11 },
]

/** 空中格代价更高：路径优先贴地面走，必须时才爬竖井或岩壁 */
const AIR_COST = 4

function keyOf(world: WorldState, x: number, y: number): number {
  return y * world.width + x
}

function isWalkable(world: WorldState, x: number, y: number): boolean {
  if (!isInside(world, x, y) || y < SURFACE_Y) return false
  if (world.tiles[y][x] !== TILE.EMPTY) return false
  if (contains(LANDMARKS.generatorZone, x, y)) return false
  if (world.pods.some((pod) => podBlocksPassage(world, pod) && contains(podRect(pod), x, y))) return false
  return true
}

/** 竖井里的木梯：有梯子的格子按地面处理，伙伴会走爬梯动作 */
function isLadderCell(x: number, y: number): boolean {
  return x >= LANDMARKS.shaft.x && x < LANDMARKS.shaft.x + LANDMARKS.shaft.w
    && y >= LANDMARKS.shaft.y && y < LANDMARKS.shaft.y + LANDMARKS.shaft.h
}

function hasGround(world: WorldState, x: number, y: number): boolean {
  return y + 1 >= world.height || world.tiles[y + 1][x] !== TILE.EMPTY
}

/**
 * 从伙伴当前位置到睡眠舱舱门的一次性路径：
 * 只走已挖空的格子，能源核心与睡眠舱体视为障碍；
 * 地面格优先，竖井梯格按地面处理，保证不会穿岩壁。
 */
export function findEntranceRoute(world: WorldState, from: Cell, pod: SleepPod): Cell[] | null {
  if (!isWalkable(world, from.x, from.y)) return null
  const goal = podDoor(pod)
  if (!isWalkable(world, goal.x, goal.y)) return null

  const size = world.width * world.height
  const dist = new Array<number>(size).fill(Number.POSITIVE_INFINITY)
  const prev = new Int32Array(size).fill(-1)
  const visited = new Uint8Array(size)
  const start = keyOf(world, from.x, from.y)
  const goalKey = keyOf(world, goal.x, goal.y)
  dist[start] = 0

  for (let step = 0; step < size; step++) {
    let current = -1
    let best = Number.POSITIVE_INFINITY
    for (let i = 0; i < size; i++) {
      if (!visited[i] && dist[i] < best) {
        best = dist[i]
        current = i
      }
    }
    if (current < 0) break
    if (current === goalKey) break
    visited[current] = 1
    const cx = current % world.width
    const cy = Math.floor(current / world.width)
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const nx = cx + dx
      const ny = cy + dy
      if (!isWalkable(world, nx, ny)) continue
      const nextKey = keyOf(world, nx, ny)
      if (visited[nextKey]) continue
      const cost = hasGround(world, nx, ny) || isLadderCell(nx, ny) ? 1 : AIR_COST
      const nextDist = dist[current] + cost
      if (nextDist < dist[nextKey]) {
        dist[nextKey] = nextDist
        prev[nextKey] = current
      }
    }
  }

  if (dist[goalKey] === Number.POSITIVE_INFINITY) return null
  const path: Cell[] = []
  let cursor = goalKey
  while (cursor >= 0) {
    path.push({ x: cursor % world.width, y: Math.floor(cursor / world.width) })
    if (cursor === start) break
    const next = prev[cursor]
    if (next < 0) return null
    cursor = next
  }
  path.reverse()
  return path.length > 0 ? path : null
}
