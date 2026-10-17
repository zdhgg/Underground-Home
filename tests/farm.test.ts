import { describe, expect, it } from 'vitest'
import { LANDMARKS, STRATA, TILE, createInitialWorld, type WorldState } from '../src/core/world'
import { dig } from '../src/core/dig'
import { placePod } from '../src/core/build'
import { RELICS } from '../src/core/relics'
import {
  RIPE_STAGE,
  advancePlanters,
  canPlacePlanter,
  canSupplyWater,
  feedPartners,
  harvestPlanter,
  isFarmUnlocked,
  placePlanter,
  planterAt,
  ripePlanters,
} from '../src/core/farm'

/** 左翼挖空一带地面的第一层；引水与否由用例自己决定 */
function homeWorld(): WorldState {
  const world = createInitialWorld()
  world.progress = { crystalFound: true, crystalCollected: true, coreRepaired: true }
  for (let y = 9; y <= 11; y++) for (let x = 2; x <= 14; x++) if (world.tiles[y][x] === TILE.SOIL) dig(world, x, y)
  return world
}

function farmingWorld(): WorldState {
  const world = homeWorld()
  world.exploration.springFound = true
  world.farm.waterSupplied = true
  return world
}

describe('引水：水上来之前不能种', () => {
  it('没找到泉水时不能引水，找到之后才出现"把水引到家里"', () => {
    const world = homeWorld()
    expect(canSupplyWater(world)).toBe(false)
    expect(isFarmUnlocked(world)).toBe(false)
    expect(canPlacePlanter(world, 5, 11)).toMatchObject({ ok: false, reason: 'no-water' })

    world.exploration.springFound = true
    expect(canSupplyWater(world)).toBe(true)
    expect(canPlacePlanter(world, 5, 11)).toMatchObject({ ok: false, reason: 'no-water' })

    world.farm.waterSupplied = true
    expect(canSupplyWater(world)).toBe(false)
    expect(isFarmUnlocked(world)).toBe(true)
    expect(canPlacePlanter(world, 5, 11).ok).toBe(true)
  })
})

describe('种植槽：位置自由，但要落在第一层的地面上', () => {
  it('挖空的地面格可以种；悬空、泥土、第二层、梯道列、遗物那一格都不行', () => {
    const world = farmingWorld()
    expect(canPlacePlanter(world, 5, 11).ok).toBe(true)
    expect(canPlacePlanter(world, 5, 10)).toMatchObject({ ok: false, reason: 'support' })
    expect(canPlacePlanter(world, 30, 10)).toMatchObject({ ok: false, reason: 'soil' })
    expect(canPlacePlanter(world, 10, 20)).toMatchObject({ ok: false, reason: 'layer' })
    expect(canPlacePlanter(world, 16, 11)).toMatchObject({ ok: false, reason: 'reserved' })
    // 遗物摆在 (7,11)：那一格下面是实心岩，先被"遗物要留出来"挡住
    const relic = RELICS[1]
    expect(canPlacePlanter(world, relic.x, relic.y)).toMatchObject({ ok: false, reason: 'reserved' })
    expect(canPlacePlanter(world, -1, 11)).toMatchObject({ ok: false, reason: 'bounds' })
  })

  it('睡眠舱占着的地方不能种，一格也只能有一槽', () => {
    const world = farmingWorld()
    expect(placePod(world, 7, 10)).not.toBeNull()
    expect(canPlacePlanter(world, 8, 11)).toMatchObject({ ok: false, reason: 'overlap' })
    expect(placePlanter(world, 5, 11)).not.toBeNull()
    expect(canPlacePlanter(world, 5, 11)).toMatchObject({ ok: false, reason: 'overlap' })
    expect(placePlanter(world, 5, 11)).toBeNull()
    expect(world.farm.planters).toHaveLength(1)
  })

  it('种着菜的槽不能挖掉，只能收或撤销', () => {
    const world = farmingWorld()
    const planter = placePlanter(world, 5, 11)!
    expect(dig(world, planter.x, planter.y)).toMatchObject({ ok: false, reason: 'facility' })
    expect(world.tiles[11][5]).toBe(TILE.EMPTY)
  })
})

describe('生长按"你干了多少事"推进，不用等', () => {
  it('干一件事长一档，长到 RIPE_STAGE 就停住', () => {
    const world = farmingWorld()
    placePlanter(world, 5, 11)
    expect(world.farm.planters[0].growth).toBe(0)
    // 放槽本身不算干活
    for (let i = 1; i <= 5; i++) {
      advancePlanters(world)
      expect(world.farm.planters[0].growth).toBe(Math.min(RIPE_STAGE, i))
    }
    expect(ripePlanters(world)).toHaveLength(1)
  })

  it('收获：没熟收不了，熟了收一次加一份食物并把槽重新种下', () => {
    const world = farmingWorld()
    placePlanter(world, 5, 11)
    expect(harvestPlanter(world, 5, 11)).toBe(false)
    expect(world.farm.food).toBe(0)

    for (let i = 0; i < RIPE_STAGE; i++) advancePlanters(world)
    expect(harvestPlanter(world, 5, 11)).toBe(true)
    expect(world.farm.food).toBe(1)
    expect(world.farm.harvests).toBe(1)
    expect(world.farm.planters[0].growth).toBe(0)
    expect(planterAt(world, 5, 11)?.growth).toBe(0)
  })
})

describe('请伙伴吃饭', () => {
  it('没有食物或没有伙伴都吃不成；有食物时吃一份少一份', () => {
    const world = farmingWorld()
    expect(feedPartners(world)).toBe(false)

    world.farm.food = 2
    expect(feedPartners(world)).toBe(false) // 还没人住进来

    expect(placePod(world, 7, 10)).not.toBeNull()
    expect(feedPartners(world)).toBe(true)
    expect(world.farm.food).toBe(1)
    expect(feedPartners(world)).toBe(true)
    expect(world.farm.food).toBe(0)
    expect(feedPartners(world)).toBe(false)
  })
})

describe('种植槽不越过第一层', () => {
  it('第二层即使挖空了也放不下（这一层的建设留给以后）', () => {
    const world = farmingWorld()
    world.exploration.entered = true
    for (let x = 10; x <= 16; x++) dig(world, x, 20)
    expect(canPlacePlanter(world, 12, 20)).toMatchObject({ ok: false, reason: 'layer' })
    expect(LANDMARKS.spring.y).toBeGreaterThan(STRATA.home.bottom)
  })
})
