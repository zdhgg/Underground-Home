import { BEDS_PER_POD } from './build'
import type { SleepPod, WorldState } from './world'

export type PartnerId = 'atu' | 'adeng' | 'xiaoman' | 'xiaoquan'
export type PartnerAbilityId = 'dig' | 'light' | 'grow' | 'water'

/**
 * 四位伙伴：每个人带来一个动词，也各有自己出现的那一层。
 *
 * 第一层是家：阿土（挖）和阿灯（照）一开始就在。
 * 第二层才有水与土：小满（种）在第一次下到泉水层时出现，小泉（引）在找到泉水时出现。
 * 身份、能力和床位优先位固定在定义上；加入条件独立判断，不再用人数截取名单。
 */
export interface Partner {
  id: PartnerId
  name: string
  /** 物种：孩子靠外形区分他们 */
  species: string
  /** 这位伙伴带来的动词 */
  verb: string
  abilityId: PartnerAbilityId
  /** 稳定床位优先位；不是角色数组的下标。旧四位保持原床位。 */
  bedSlot: number
  joins(world: WorldState): boolean
}

export const PARTNERS: readonly Partner[] = [
  { id: 'atu', name: '阿土', species: '鼹鼠', verb: '挖', abilityId: 'dig', bedSlot: 0, joins: () => true },
  { id: 'adeng', name: '阿灯', species: '萤火虫', verb: '照', abilityId: 'light', bedSlot: 1, joins: () => true },
  { id: 'xiaoman', name: '小满', species: '兔子', verb: '种', abilityId: 'grow', bedSlot: 2, joins: (world) => world.exploration.entered },
  { id: 'xiaoquan', name: '小泉', species: '水獭', verb: '引', abilityId: 'water', bedSlot: 3, joins: (world) => world.exploration.springFound },
]

/** 一开始就在的两位：阿土和阿灯 */
export const BASE_PARTNERS = 2
/** 第一次下到泉水层，遇见饿着肚子的小满 */
export const PARTNERS_AFTER_ARRIVAL = 3
/** 找到泉水后，小泉从水里冒出来 */
export const PARTNERS_AFTER_SPRING = 4

export function partnerById(id: string): Partner | null {
  return PARTNERS.find((partner) => partner.id === id) ?? null
}

export function availablePartners(world: WorldState): Partner[] {
  return PARTNERS.filter((partner) => partner.joins(world)).sort((a, b) => a.bedSlot - b.bedSlot)
}

export function partnerBed(world: WorldState, id: string): { pod: SleepPod; slot: number } | null {
  const partner = partnerById(id)
  if (!partner || !partner.joins(world)) return null
  const pod = world.pods[Math.floor(partner.bedSlot / BEDS_PER_POD)]
  return pod ? { pod, slot: partner.bedSlot % BEDS_PER_POD } : null
}

/**
 * 愿意住进来的伙伴总数。
 *
 * 每位伙伴有自己的理由，而不是"找到水就两个人一起出现"：
 * 走到泉水层，会遇见饿着肚子的小满；找到水，小泉才肯留下。
 * 于是"下去"和"找到水"各有一个可见的回报，而不是攒到最后一起发。
 */
export function partnersWilling(world: WorldState): number {
  return availablePartners(world).length
}

/** 已经有床位的伙伴数（每间舱两位） */
export function settledPartners(world: WorldState): number {
  return availablePartners(world).filter((partner) => partnerBed(world, partner.id) !== null).length
}

/** 还能安几间舱。已有的舱永远算数，撤销 / 旧档都不会把床判成非法。 */
export function podCapacity(world: WorldState): number {
  const requiredSlots = Math.max(0, ...availablePartners(world).map((partner) => partner.bedSlot + 1))
  return Math.max(world.pods.length, Math.ceil(requiredSlots / BEDS_PER_POD))
}

/** 想搬进来、却还没有床的伙伴数（在大厅里等着的新朋友） */
export function waitingPartners(world: WorldState): number {
  return waitingPartnerList(world).length
}

/**
 * 还在等床的伙伴名单，按出场顺序。
 * 他们站在大厅里，是"家里还缺一张床"的可见提示——小满就是下行的理由本身。
 */
export function waitingPartnerList(world: WorldState): Partner[] {
  return availablePartners(world).filter((partner) => partnerBed(world, partner.id) === null)
}

export function canBuildMorePods(world: WorldState): boolean {
  return world.pods.length < podCapacity(world)
}
