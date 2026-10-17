import { BEDS_PER_POD } from './build'
import type { WorldState } from './world'

/**
 * 四位伙伴：每个人带来一个动词。
 *
 * 阿土（挖）和阿灯（照）一开始就在；小满（种）建好床就来；小泉（引）找到水就来。
 * 数组顺序即出场顺序——渲染层按同一个索引取颜色和名字，不会错位。
 */
export interface Partner {
  id: string
  name: string
  /** 物种：孩子靠外形区分他们 */
  species: string
  /** 这位伙伴带来的动词 */
  verb: string
}

export const PARTNERS: readonly Partner[] = [
  { id: 'atu', name: '阿土', species: '鼹鼠', verb: '挖' },
  { id: 'adeng', name: '阿灯', species: '萤火虫', verb: '照' },
  { id: 'xiaoman', name: '小满', species: '兔子', verb: '种' },
  { id: 'xiaoquan', name: '小泉', species: '水獭', verb: '引' },
]

/** 一开始就在的两位：阿土和阿灯 */
export const BASE_PARTNERS = 2
/** 建好第一间床后，小满闻着"家的味道"来了 */
export const PARTNERS_AFTER_BED = 3
/** 找到泉水后，小泉从水里冒出来 */
export const PARTNERS_AFTER_SPRING = 4

/** 第 index 位伙伴（0 起）。渲染与文案共用这一份名单。 */
export function partnerAt(index: number): Partner {
  return PARTNERS[index % PARTNERS.length]
}

/**
 * 愿意住进来的伙伴总数。
 *
 * 每位伙伴有自己的理由，而不是"找到水就两个人一起出现"：
 * 有了床，小满就来了；有了水，小泉才肯留下。
 * 于是"建床"和"找水"各有一个可见的回报，而不是攒到最后一起发。
 */
export function partnersWilling(world: WorldState): number {
  const willing = BASE_PARTNERS
    + (world.pods.length > 0 ? 1 : 0)
    + (world.exploration.springFound ? 1 : 0)
  return Math.min(willing, PARTNERS.length)
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

/**
 * 还在等床的伙伴名单，按出场顺序。
 * 他们站在大厅里，是"家里还缺一张床"的可见提示——小满就是下行的理由本身。
 */
export function waitingPartnerList(world: WorldState): Partner[] {
  return PARTNERS.slice(settledPartners(world), partnersWilling(world))
}

export function canBuildMorePods(world: WorldState): boolean {
  return world.pods.length < podCapacity(world)
}
