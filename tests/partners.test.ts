import { describe, expect, it } from 'vitest'
import { createInitialWorld, TILE, type WorldState } from '../src/core/world'
import { dig } from '../src/core/dig'
import { placePod } from '../src/core/build'
import {
  BASE_PARTNERS,
  PARTNERS_AFTER_SPRING,
  canBuildMorePods,
  partnersWilling,
  podCapacity,
  settledPartners,
  waitingPartners,
} from '../src/core/partners'

/** 只按下床位数摆位置：这些纯函数只数 world.pods 的数量 */
function withPods(count: number, springFound = false): WorldState {
  const world = createInitialWorld()
  world.exploration.springFound = springFound
  for (let i = 0; i < count; i++) world.pods.push({ id: i + 1, x: 2 + i * 4, y: 10, door: 'left' })
  return world
}

describe('伙伴与床位：床数由愿意来住的伙伴决定', () => {
  it('一开始只有两位老住户：一间舱，没人等着', () => {
    const world = withPods(0)
    expect(partnersWilling(world)).toBe(BASE_PARTNERS)
    expect(settledPartners(world)).toBe(0)
    expect(podCapacity(world)).toBe(1)
    expect(waitingPartners(world)).toBe(BASE_PARTNERS)
    expect(canBuildMorePods(world)).toBe(true)
  })

  it('第一间舱建好后床位刚好住满：暂时不能再建，也不出现空舱', () => {
    const world = withPods(1)
    expect(waitingPartners(world)).toBe(0)
    expect(canBuildMorePods(world)).toBe(false)
  })

  it('找到水之后另外两位才肯搬来：多出第 2 间舱，他们先在大厅等着', () => {
    const world = withPods(1, true)
    expect(partnersWilling(world)).toBe(PARTNERS_AFTER_SPRING)
    expect(waitingPartners(world)).toBe(2)
    expect(podCapacity(world)).toBe(2)
    expect(canBuildMorePods(world)).toBe(true)
  })

  it('第二间舱建好：四位伙伴都有床，主线走完', () => {
    const world = withPods(2, true)
    expect(waitingPartners(world)).toBe(0)
    expect(canBuildMorePods(world)).toBe(false)
  })

  it('已有的床位永远算数：还没找到水就带两间舱的存档不会被判成非法', () => {
    const world = withPods(2, false)
    expect(podCapacity(world)).toBeGreaterThanOrEqual(2)
    expect(canBuildMorePods(world)).toBe(false)
    expect(waitingPartners(world)).toBe(0)
  })
})

describe('第二间舱要真的建得出来', () => {
  it('左翼挖出空地就能放下第二间舱，并且不碰第二层（这一层还没开放）', () => {
    const world = createInitialWorld()
    world.progress = { crystalFound: true, crystalCollected: true, coreRepaired: true }
    for (let y = 10; y <= 11; y++) for (let x = 12; x < 15; x++) dig(world, x, y)
    expect(placePod(world, 12, 10)).not.toBeNull()
    world.exploration.springFound = true
    expect(canBuildMorePods(world)).toBe(true)
    for (let y = 9; y <= 11; y++) for (let x = 5; x <= 14; x++) if (world.tiles[y][x] === TILE.SOIL) dig(world, x, y)
    expect(placePod(world, 7, 10)).not.toBeNull()
    expect(waitingPartners(world)).toBe(0)
    expect(world.tiles[19][7]).toBe(TILE.SOIL)
  })
})
