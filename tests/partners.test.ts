import { describe, expect, it } from 'vitest'
import { createInitialWorld, TILE, type WorldState } from '../src/core/world'
import { dig } from '../src/core/dig'
import { placePod } from '../src/core/build'
import {
  BASE_PARTNERS,
  PARTNERS,
  PARTNERS_AFTER_ARRIVAL,
  PARTNERS_AFTER_SPRING,
  canBuildMorePods,
  partnersWilling,
  podCapacity,
  settledPartners,
  waitingPartnerList,
  waitingPartners,
  availablePartners,
  partnerBed,
  partnerById,
  type Partner,
} from '../src/core/partners'

/** 只按下床位数与到达状态摆位置：这些纯函数不跑真实地图。 */
function withPods(count: number, state: { entered?: boolean; spring?: boolean } = {}): WorldState {
  const world = createInitialWorld()
  world.exploration.entered = state.entered === true || state.spring === true
  world.exploration.springFound = state.spring === true
  for (let i = 0; i < count; i++) world.pods.push({ id: i + 1, x: 2 + i * 4, y: 10, door: 'left' })
  return world
}

describe('伙伴与床位：每位伙伴有自己的出场理由', () => {
  it('按稳定ID独立加入：到达第二层遇见小满，找到泉水才遇见小泉', () => {
    const world = withPods(0, { entered: true })
    expect(availablePartners(world).map((partner) => partner.id)).toEqual(['atu', 'adeng', 'xiaoman'])
    world.exploration.springFound = true
    expect(availablePartners(world).map((partner) => partner.id)).toEqual(['atu', 'adeng', 'xiaoman', 'xiaoquan'])
    expect(partnerById('unknown')).toBeNull()
    expect(partnerBed(world, 'unknown')).toBeNull()
  })

  it('定义顺序改变不改变身份与旧床位；床位通过角色ID取得', () => {
    const world = withPods(2, { entered: true, spring: true })
    const definitions = PARTNERS as Partner[]
    const original = [...definitions]
    try {
      definitions.reverse()
      expect(availablePartners(world).map((partner) => partner.id)).toEqual(['atu', 'adeng', 'xiaoman', 'xiaoquan'])
      expect(partnerBed(world, 'atu')).toEqual({ pod: world.pods[0], slot: 0 })
      expect(partnerBed(world, 'xiaoman')).toEqual({ pod: world.pods[1], slot: 0 })
      expect(partnerBed(world, 'xiaoquan')).toEqual({ pod: world.pods[1], slot: 1 })
    } finally { definitions.splice(0, definitions.length, ...original) }
  })
  it('九位伙伴按层独立加入，旧四位床位与动词保持原顺序', () => {
    expect(PARTNERS.map((partner) => partner.name)).toEqual(['阿土', '阿灯', '小满', '小泉', '阿岩', '阿木', '苔苔', '团团', '铃铃'])
    expect(PARTNERS.map((partner) => partner.verb)).toEqual(['挖', '照', '种', '引', '凿', '造', '连菌', '筑渠', '听风'])
    expect(partnerById('atu')?.name).toBe('阿土')
    expect(partnerById('xiaoquan')?.name).toBe('小泉')
    expect(partnerById('unknown')).toBeNull()
  })

  it('一开始只有两位老住户：阿土和阿灯，一间舱，没人有床', () => {
    const world = withPods(0)
    expect(partnersWilling(world)).toBe(BASE_PARTNERS)
    expect(settledPartners(world)).toBe(0)
    expect(waitingPartners(world)).toBe(BASE_PARTNERS)
    expect(podCapacity(world)).toBe(1)
    expect(canBuildMorePods(world)).toBe(true)
  })

  it('建好第一间床但还没下去：第一层仍是阿土和阿灯，不会凭空多出小满', () => {
    const world = withPods(1)
    expect(partnersWilling(world)).toBe(BASE_PARTNERS)
    expect(waitingPartners(world)).toBe(0)
    expect(waitingPartnerList(world)).toEqual([])
    expect(podCapacity(world)).toBe(1)
    expect(canBuildMorePods(world)).toBe(false)
  })

  it('第一次下到泉水层：遇见小满，她在大厅之外等第二张床', () => {
    const world = withPods(1, { entered: true })
    expect(partnersWilling(world)).toBe(PARTNERS_AFTER_ARRIVAL)
    expect(waitingPartners(world)).toBe(1)
    expect(waitingPartnerList(world).map((partner) => partner.name)).toEqual(['小满'])
    expect(podCapacity(world)).toBe(2)
    expect(canBuildMorePods(world)).toBe(true)
  })

  it('找到泉水：小泉从水里冒出来，四个人都想住下', () => {
    const world = withPods(1, { entered: true, spring: true })
    expect(partnersWilling(world)).toBe(PARTNERS_AFTER_SPRING)
    expect(waitingPartners(world)).toBe(2)
    expect(waitingPartnerList(world).map((partner) => partner.name)).toEqual(['小满', '小泉'])
    expect(podCapacity(world)).toBe(2)
    expect(canBuildMorePods(world)).toBe(true)
  })

  it('第二间舱建好、水也找到了：四位都有床，主线走完', () => {
    const world = withPods(2, { entered: true, spring: true })
    expect(waitingPartners(world)).toBe(0)
    expect(waitingPartnerList(world)).toEqual([])
    expect(canBuildMorePods(world)).toBe(false)
  })

  it('进入第二层、水还没找到就建了第二间床：小满住进去，空一个床位等小泉，但不会建第三间', () => {
    const world = withPods(2, { entered: true })
    expect(partnersWilling(world)).toBe(PARTNERS_AFTER_ARRIVAL)
    expect(waitingPartners(world)).toBe(0)
    expect(podCapacity(world)).toBe(2)
    expect(canBuildMorePods(world)).toBe(false)
  })

  it('已有的床位永远算数：两间舱的旧档不会被判成非法', () => {
    const world = withPods(2)
    expect(podCapacity(world)).toBeGreaterThanOrEqual(2)
    expect(canBuildMorePods(world)).toBe(false)
  })
})

describe('第二间舱要真的建得出来', () => {
  it('见到小满之后就能放下第二间舱，不用等到找到水；并且不碰第二层', () => {
    const world = createInitialWorld()
    world.progress = { crystalFound: true, crystalCollected: true, secondCrystalFound: true, secondCrystalCollected: true, coreLoaded: true, coreRepaired: true }
    for (let y = 10; y <= 11; y++) for (let x = 12; x < 15; x++) dig(world, x, y)
    expect(placePod(world, 12, 10)).not.toBeNull()
    // 还没下去：第一层只有两位老住户，第二间舱还不该出现。
    expect(canBuildMorePods(world)).toBe(false)
    world.exploration.entered = true
    // 在泉水层遇见小满，回到大厅就能给她安床。
    expect(canBuildMorePods(world)).toBe(true)
    expect(waitingPartnerList(world).map((partner) => partner.name)).toEqual(['小满'])
    for (let y = 9; y <= 11; y++) for (let x = 5; x <= 14; x++) if (world.tiles[y][x] === TILE.SOIL) dig(world, x, y)
    expect(placePod(world, 7, 10)).not.toBeNull()
    expect(waitingPartners(world)).toBe(0)
    expect(world.tiles[19][7]).toBe(TILE.SOIL)
  })
})
