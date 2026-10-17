import { BEDS_PER_POD } from './build'
import type { WorldState } from './world'

/**
 * 伙伴与床位：床的数量由"愿意搬进来的伙伴"决定，而不是反过来——
 * 这样才不会出现没人住的空舱（旧版把舱数锁死在 1 间，正是为了这个）。
 *
 * 水是第二拨伙伴的条件：有水喝、能种菜，另外两位朋友才肯搬进来。
 * 于是"挖到第二层的泉水"会直接决定第一层还能不能继续建。
 */
export const BASE_PARTNERS = 2
export const PARTNERS_AFTER_SPRING = 4

/** 愿意住进来的伙伴总数 */
export function partnersWilling(world: WorldState): number {
  return world.exploration.springFound ? PARTNERS_AFTER_SPRING : BASE_PARTNERS
}

/** 已经有床位的伙伴数（每间舱两位） */
export function settledPartners(world: WorldState): number {
  return world.pods.length * BEDS_PER_POD
}

/** 还能安几间舱。已有的舱永远算数，撤销 / 旧档都不会把床判成非法。 */
export function podCapacity(world: WorldState): number {
  return Math.ceil(Math.max(partnersWilling(world), settledPartners(world)) / BEDS_PER_POD)
}

/** 想搬进来、却还没有床的伙伴数（在大厅里等着的新朋友） */
export function waitingPartners(world: WorldState): number {
  return Math.max(0, partnersWilling(world) - settledPartners(world))
}

export function canBuildMorePods(world: WorldState): boolean {
  return world.pods.length < podCapacity(world)
}
