import { atuRoute } from './atu'
import { feedPartners } from './farm'
import { availablePartners } from './partners'
import { siteById, type BuildingSite } from './sites'
import type { Cell, WorkerId, WorldState } from './world'

/**
 * 第二层共餐（2A）：灶台 + 餐桌。
 *
 * 旧存档没有这两件设施，仍然走原来的“请大家吃饭”结算；
 * 两件都建好之后，同一个结算函数额外返回 shared，由会话层播放实体演出。
 * 这里只做规则与路线规划，不碰画面。
 */
export const KITCHEN_SITE_ID = 'spring-kitchen'
export const DINING_SITE_ID = 'spring-table'

export interface MealFacilities {
  kitchen: BuildingSite
  dining: BuildingSite
}

/** 只有“真的建成”的设施才算；蓝图、被撤销或没建的都不算。 */
export function mealFacilities(world: WorldState): MealFacilities | null {
  const built = new Set(world.builtSites.map((site) => site.id))
  if (!built.has(KITCHEN_SITE_ID) || !built.has(DINING_SITE_ID)) return null
  const kitchen = siteById(KITCHEN_SITE_ID)
  const dining = siteById(DINING_SITE_ID)
  return kitchen && dining ? { kitchen, dining } : null
}

export const sharedMealReady = (world: WorldState): boolean => mealFacilities(world) !== null

export type MealFailure = 'no-food' | 'no-partners'
export type MealResult =
  | { ok: false; reason: MealFailure }
  | { ok: true; shared: boolean; food: number }

/**
 * 唯一结算入口：两个吃饭按钮最后都只走到这里。
 * 成功时恰好调用一次 feedPartners（消耗 1 份食物）；演出中的重复触发由会话层拦住。
 */
export function serveMeal(world: WorldState): MealResult {
  if (world.farm.food <= 0) return { ok: false, reason: 'no-food' }
  if (world.pods.length === 0) return { ok: false, reason: 'no-partners' }
  const shared = sharedMealReady(world)
  if (!feedPartners(world)) return { ok: false, reason: world.farm.food <= 0 ? 'no-food' : 'no-partners' }
  return { ok: true, shared, food: world.farm.food }
}

/** 餐桌前的地面座位：从左到右，最多四位伙伴。 */
export function mealSeats(world: WorldState): Cell[] {
  const dining = mealFacilities(world)?.dining
  if (!dining) return []
  return Array.from({ length: dining.w }, (_, index) => ({ x: dining.x + index, y: dining.y + dining.h - 1 }))
}

export interface MealMove { id: WorkerId; route: Cell[]; seat: Cell }

/**
 * 一次性的围坐路线：从伙伴当前记录站位走到餐桌前的空位。
 * 走不到就不勉强这位伙伴；演出仍然可以由其他伙伴完成。
 */
export function planMealGathering(world: WorldState): MealMove[] {
  const seats = mealSeats(world)
  if (seats.length === 0) return []
  const moves: MealMove[] = []
  for (const partner of availablePartners(world)) {
    if (partner.id === 'atu') continue
    const from = world.workers[partner.id]
    if (!from) continue
    const used = new Set(moves.map((move) => `${move.seat.x},${move.seat.y}`))
    const seat = seats.find((cell) => !used.has(`${cell.x},${cell.y}`))
    if (!seat) break
    const route = atuRoute(world, from, seat, true)
    if (route) moves.push({ id: partner.id, route, seat })
  }
  return moves
}
