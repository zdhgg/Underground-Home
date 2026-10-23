import { podBlocksPassage } from './passages'
import { BREAKTHROUGHS, HOME_FLOOR_Y, LANDMARKS, TILE, type Cell, type WorldState } from './world'

export const isShaftColumn = (x: number): boolean => BREAKTHROUGHS.some((column) => column === x)
/** 裂纹梯道最下一格；再往下就是泉水层的天然洞穴。 */
export const SHAFT_LAST_Y = 18
export const isShaftCell = (x: number, y: number): boolean => isShaftColumn(x) && y >= HOME_FLOOR_Y && y <= SHAFT_LAST_Y
/** 阿土在大厅地面的两个可达起点：还没进场时从这里出发，也用于检查裂纹可达。 */
export const HALL_START_Y = HOME_FLOOR_Y - 1
export const HALL_STARTS = [18, 25] as const
const occupied = (world: WorldState, x: number, y: number): boolean => world.pods.some((p) => podBlocksPassage(world, p) && x >= p.x && x < p.x + 3 && y >= p.y && y < p.y + 2)

export function suggestedBreakthrough(world: WorldState): number {
  return world.pods.some((p) => p.y <= 11 && p.y + 2 > 11 && p.x <= 27 && p.x + 3 > 25) ? 16 : 27
}

/** 阿土只在有地面承托的水平通道和真实梯道行走，不复用贴墙攀爬。 */
export function canStand(world: WorldState, x: number, y: number): boolean {
  return world.tiles[y]?.[x] === TILE.EMPTY && !occupied(world, x, y)
    && (world.tiles[y + 1]?.[x] !== TILE.EMPTY || (isShaftColumn(x) && y >= 11 && y <= 21))
}

export function walkingRoute(world: WorldState, from: Cell, to: Cell): Cell[] | null {
  const queue = [from]
  const previous = new Map<string, Cell | null>([[`${from.x},${from.y}`, null]])
  for (let i = 0; i < queue.length; i++) {
    const cell = queue[i]
    if (cell.x === to.x && cell.y === to.y) {
      const route: Cell[] = []
      let step: Cell | null = cell
      while (step) { route.unshift(step); step = previous.get(`${step.x},${step.y}`) ?? null }
      return route
    }
    for (const next of [{ x: cell.x - 1, y: cell.y }, { x: cell.x + 1, y: cell.y }, { x: cell.x, y: cell.y - 1 }, { x: cell.x, y: cell.y + 1 }]) {
      if (next.x < 1 || next.x >= world.width - 1 || next.y < 11 || next.y > 21) continue
      if (next.y !== cell.y && (!isShaftColumn(cell.x) || cell.x !== next.x)) continue
      const key = `${next.x},${next.y}`
      if (previous.has(key) || !canStand(world, next.x, next.y)) continue
      previous.set(key, cell)
      queue.push(next)
    }
  }
  return null
}

/** 梯道施工的下一个目标：从 y12 起往下第一块还没挖开的岩段 */
export function shaftFrontier(world: WorldState, x: number): Cell | null {
  for (let y = HOME_FLOOR_Y; y <= SHAFT_LAST_Y; y++) {
    if (world.tiles[y][x] !== TILE.EMPTY) return { x, y }
  }
  return null
}

/** 已经挖开、连成一串的梯段数（从 y12 往下数）。 */
export function shaftDugSegments(world: WorldState, x: number): number {
  let dug = 0
  for (let y = HOME_FLOOR_Y; y <= SHAFT_LAST_Y; y++) {
    if (world.tiles[y][x] !== TILE.EMPTY) break
    dug++
  }
  return dug
}

/** 从当前工作面到洞底还剩几段岩：等于真正还要挥几次镐。 */
export function shaftRemainingSegments(world: WorldState, x: number): number {
  const frontier = shaftFrontier(world, x)
  if (!frontier) return 0
  let left = 0
  for (let y = frontier.y; y <= SHAFT_LAST_Y; y++) {
    if (world.tiles[y][x] !== TILE.EMPTY) left++
  }
  return left
}

/** 前两段由玩家亲自委托（学会指挥施工），之后一次委托就能从当前梯段挖到洞底。 */
export const LEARN_SEGMENTS = 2

export function shaftChainReady(world: WorldState): boolean {
  const e = world.exploration
  if (e.shaftX === null || !e.clueFound || !e.pickaxeUpgraded || e.entered) return false
  return !shaftConnected(world) && shaftDugSegments(world, e.shaftX) >= LEARN_SEGMENTS
}

/** 阿土的一次施工路线：优先从他当前站位出发；还没进场时从大厅地面出发。 */
export function moleRoute(world: WorldState, to: Cell): Cell[] | null {
  const from = world.exploration.explorer
  const current = from ? walkingRoute(world, from, to) : null
  if (current) return current
  if (from) return null
  for (const x of HALL_STARTS) {
    if (!canStand(world, x, HALL_START_Y)) continue
    const route = walkingRoute(world, { x, y: HALL_START_Y }, to)
    if (route) return route
  }
  return null
}

export function inspectCrack(world: WorldState, x: number, y: number): boolean {
  if (!world.progress.coreRepaired || !world.pods.length || !isShaftColumn(x) || y !== HOME_FLOOR_Y) return false
  if (world.exploration.clueFound) return world.exploration.shaftX === x && !world.exploration.entered
  if (!canStand(world, x, HALL_START_Y)) return false
  // 到达裂纹上方必须有从大厅地面走来的路，不能远程发现孤立洞口。
  if (!HALL_STARTS.some((startX) => canStand(world, startX, HALL_START_Y) && walkingRoute(world, { x: startX, y: HALL_START_Y }, { x, y: HALL_START_Y }))) return false
  if (world.exploration.entered) return false
  world.exploration.clueFound = true
  world.exploration.shaftX = x
  world.exploration.explorer = { x, y: HALL_START_Y }
  return true
}

export function upgradePickaxe(world: WorldState): boolean {
  if (!world.exploration.clueFound || world.exploration.pickaxeUpgraded) return false
  world.exploration.pickaxeUpgraded = true
  return true
}

export function shaftConnected(world: WorldState): boolean {
  const x = world.exploration.shaftX
  return x !== null && Array.from({ length: 11 }, (_, i) => i + 11).every((y) => canStand(world, x, y))
}

/** 已连到梯脚的地面空间；用于探索边缘、建设通路和迷雾。 */
export function waterSpan(world: WorldState): { left: number; right: number } | null {
  const x = world.exploration.shaftX
  if (!world.exploration.entered || x === null || !shaftConnected(world)) return null
  let left = x, right = x
  while (canStand(world, left - 1, 21)) left--
  while (canStand(world, right + 1, 21)) right++
  return { left, right }
}

/**
 * 发光蘑菇（发现物）：泉水边潮湿洞壁上的固定几簇，兼作柔和光源。
 * 定义放这里是因为菜槽规则也要保留这些格子（不放作物、不和蘑菇抢地）。
 */
export function mushroomSpots(world: WorldState): Cell[] {
  const span = waterSpan(world)
  if (!span) return []
  return [20, 26]
    .filter(x => x >= span.left && x <= span.right && world.tiles[21][x] === TILE.EMPTY)
    .map(x => ({ x, y: 21 }))
}

export const isMushroomSpot = (world: WorldState, x: number, y: number): boolean =>
  y === 21 && mushroomSpots(world).some(spot => spot.x === x)

export function springVisible(world: WorldState): boolean {
  const span = waterSpan(world)
  return !!span && span.left <= LANDMARKS.spring.x && span.right >= LANDMARKS.spring.x
}

/** 误挖可撤销；有人站着的格子、已使用梯道和回程地面不允许被填埋。 */
export function explorationProtects(world: WorldState, x: number, y: number): boolean {
  const e = world.exploration
  if (e.explorer?.x === x && e.explorer.y === y) return true
  if (e.lamps.some((lamp) => lamp.x === x && y >= 19 && y <= 21)) return true
  if (!e.entered || e.shaftX === null) return false
  if (x === e.shaftX && y >= 11 && y <= 21) return true
  if (y === 21 && e.explorer?.y === 21 && x >= Math.min(e.explorer.x, e.shaftX) && x <= Math.max(e.explorer.x, e.shaftX)) return true
  return e.springFound && y === 21 && x >= Math.min(LANDMARKS.spring.x, e.shaftX) && x <= Math.max(LANDMARKS.spring.x, e.shaftX)
}

/** 小壁灯嵌在洞壁上，选址自由，不占伙伴走路的地面。 */
export function canPlaceWallLamp(world: WorldState, x: number): boolean {
  const span = waterSpan(world)
  return world.exploration.springFound && !!span && x >= span.left && x <= span.right
    && !isShaftColumn(x) && Math.abs(x - LANDMARKS.spring.x) > 2
    && [19, 20, 21].every((y) => world.tiles[y][x] === TILE.EMPTY)
    && !world.exploration.lamps.some((lamp) => lamp.x === x)
}

/**
 * 大厅地面到梯口的地面通道是否还在。
 * 发现裂纹时靠它判定"阿土走得到"，再建设施之后也要靠它——否则重新载入时通路校验会失败。
 */
export function hallToShaftRouteIntact(world: WorldState): boolean {
  const x = world.exploration.shaftX
  if (!world.exploration.clueFound || x === null) return true
  const top = { x, y: HALL_START_Y }
  return HALL_STARTS.some((startX) => canStand(world, startX, HALL_START_Y)
    && !!walkingRoute(world, { x: startX, y: HALL_START_Y }, top))
}

export function explorationAccessIntact(world: WorldState): boolean {
  const e = world.exploration
  if (!e.clueFound || e.shaftX === null) return true
  if (!hallToShaftRouteIntact(world)) return false
  const top = { x: e.shaftX, y: HALL_START_Y }
  if (!e.entered) return true
  if (!shaftConnected(world) || !e.explorer || !walkingRoute(world, top, e.explorer)) return false
  return (!e.springFound || !!walkingRoute(world, top, LANDMARKS.spring))
    && e.lamps.every((lamp) => !!walkingRoute(world, top, { x: lamp.x, y: 21 }))
}
