import { describe, expect, it } from 'vitest'
import { createInitialWorld, TILE, type WorldState } from '../src/core/world'
import { dig } from '../src/core/dig'
import { placePod } from '../src/core/build'
import {
  BASE_PARTNERS,
  PARTNERS,
  PARTNERS_AFTER_BED,
  PARTNERS_AFTER_SPRING,
  canBuildMorePods,
  partnerAt,
  partnersWilling,
  podCapacity,
  settledPartners,
  waitingPartnerList,
  waitingPartners,
} from '../src/core/partners'

/** 只按下床位数摆位置：这些纯函数只数 world.pods 的数量 */
function withPods(count: number, springFound = false): WorldState {
  const world = createInitialWorld()
  world.exploration.springFound = springFound
  for (let i = 0; i < count; i++) world.pods.push({ id: i + 1, x: 2 + i * 4, y: 10, door: 'left' })
  return world
}

describe('伙伴与床位：每位伙伴有自己的出场理由', () => {
  it('四位伙伴按出场顺序排好：阿土、阿灯、小满、小泉', () => {
    expect(PARTNERS.map((partner) => partner.name)).toEqual(['阿土', '阿灯', '小满', '小泉'])
    expect(PARTNERS.map((partner) => partner.verb)).toEqual(['挖', '照', '种', '引'])
    expect(partnerAt(0).name).toBe('阿土')
    expect(partnerAt(3).name).toBe('小泉')
    expect(partnerAt(4).name).toBe('阿土')
  })

  it('一开始只有两位老住户：阿土和阿灯，一间舱，没人有床', () => {
    const world = withPods(0)
    expect(partnersWilling(world)).toBe(BASE_PARTNERS)
    expect(settledPartners(world)).toBe(0)
    expect(waitingPartners(world)).toBe(BASE_PARTNERS)
    expect(podCapacity(world)).toBe(1)
    expect(canBuildMorePods(world)).toBe(true)
  })

  it('建好第一间床：小满闻着家的味道来，站在大厅等第二张床', () => {
    const world = withPods(1)
    expect(partnersWilling(world)).toBe(PARTNERS_AFTER_BED)
    expect(waitingPartners(world)).toBe(1)
    expect(waitingPartnerList(world).map((partner) => partner.name)).toEqual(['小满'])
    expect(podCapacity(world)).toBe(2)
    expect(canBuildMorePods(world)).toBe(true)
  })

  it('找到泉水：小泉从水里冒出来，四个人都想住下', () => {
    const world = withPods(1, true)
    expect(partnersWilling(world)).toBe(PARTNERS_AFTER_SPRING)
    expect(waitingPartners(world)).toBe(2)
    expect(waitingPartnerList(world).map((partner) => partner.name)).toEqual(['小满', '小泉'])
    expect(podCapacity(world)).toBe(2)
    expect(canBuildMorePods(world)).toBe(true)
  })

  it('第二间舱建好、水也找到了：四位都有床，主线走完', () => {
    const world = withPods(2, true)
    expect(waitingPartners(world)).toBe(0)
    expect(waitingPartnerList(world)).toEqual([])
    expect(canBuildMorePods(world)).toBe(false)
  })

  it('水还没找到就建了第二间床：小满住进去，空一个床位等小泉，但不会建第三间', () => {
    const world = withPods(2, false)
    expect(partnersWilling(world)).toBe(PARTNERS_AFTER_BED)
    expect(waitingPartners(world)).toBe(0)
    expect(podCapacity(world)).toBe(2)
    expect(canBuildMorePods(world)).toBe(false)
  })

  it('已有的床位永远算数：两间舱的旧档不会被判成非法', () => {
    const world = withPods(2, false)
    expect(podCapacity(world)).toBeGreaterThanOrEqual(2)
    expect(canBuildMorePods(world)).toBe(false)
  })
})

describe('第二间舱要真的建得出来', () => {
  it('建好第一间床就能放下第二间舱，不用等到找到水；并且不碰第二层', () => {
    const world = createInitialWorld()
    world.progress = { crystalFound: true, crystalCollected: true, coreRepaired: true }
    for (let y = 10; y <= 11; y++) for (let x = 12; x < 15; x++) dig(world, x, y)
    expect(placePod(world, 12, 10)).not.toBeNull()
    // 小满已经闻着家的味道来了，正等第二张床。
    expect(canBuildMorePods(world)).toBe(true)
    expect(waitingPartnerList(world).map((partner) => partner.name)).toEqual(['小满'])
    for (let y = 9; y <= 11; y++) for (let x = 5; x <= 14; x++) if (world.tiles[y][x] === TILE.SOIL) dig(world, x, y)
    expect(placePod(world, 7, 10)).not.toBeNull()
    expect(waitingPartners(world)).toBe(0)
    expect(world.tiles[19][7]).toBe(TILE.SOIL)
  })
})
