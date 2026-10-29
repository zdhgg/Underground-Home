import { describe, expect, it } from 'vitest'
import { createInitialWorld, TILE, type WorldState } from '../src/core/world'
import { dig } from '../src/core/dig'
import { placePod } from '../src/core/build'
import { inspectCrack, upgradePickaxe } from '../src/core/exploration'
import { initializeWorkers } from '../src/core/partnerWork'
import { siteById, siteBlocker, siteVisible, finishSite, undoSite } from '../src/core/sites'
import { deserialize, serialize } from '../src/core/persistence'
import {
  DINING_SITE_ID,
  KITCHEN_SITE_ID,
  mealFacilities,
  mealSeats,
  planMealGathering,
  serveMeal,
  sharedMealReady,
} from '../src/core/meal'

/** 已经下到第二层、找到泉水、接过水、有床位和一槽菜的完整小世界。 */
function mealWorld(): WorldState {
  const w = createInitialWorld()
  w.progress = { crystalFound: true, crystalCollected: true, secondCrystalFound: true, secondCrystalCollected: true, coreLoaded: true, coreRepaired: true }
  w.tiles[9][14] = TILE.EMPTY
  for (let y = 10; y <= 11; y++) for (let x = 12; x <= 14; x++) dig(w, x, y)
  placePod(w, 12, 10)
  for (const x of [26, 27]) { dig(w, x, 11); dig(w, x, 10) }
  inspectCrack(w, 27, 12)
  upgradePickaxe(w)
  for (let y = 12; y < 19; y++) if (w.tiles[y][27] !== TILE.EMPTY) dig(w, 27, y)
  w.exploration.entered = true
  for (let x = 23; x >= 18; x--) { dig(w, x, 21); dig(w, x, 20) }
  w.exploration.explorer = { x: 18, y: 21 }
  w.exploration.springFound = true
  w.farm.waterSupplied = true
  // 把泉水层左侧的天然洞室接上，灶台和餐桌就在里面。
  dig(w, 17, 21)
  dig(w, 17, 20)
  w.inventory = { stone: 8, wood: 8 }
  w.farm.food = 2
  w.farm.harvests = 1
  initializeWorkers(w)
  return w
}

function buildFacilities(w: WorldState): void {
  expect(finishSite(w, siteById(KITCHEN_SITE_ID)!, 'kitchen')).not.toBeNull()
  expect(finishSite(w, siteById(DINING_SITE_ID)!, 'dining')).not.toBeNull()
}

describe('第二层灶台与餐桌', () => {
  it('两件设施都在第二层可见，材料不足时不能开工，也不会提前扣材料', () => {
    const w = mealWorld()
    const kitchen = siteById(KITCHEN_SITE_ID)!
    const dining = siteById(DINING_SITE_ID)!
    expect(siteVisible(w, kitchen)).toBe(true)
    expect(siteVisible(w, dining)).toBe(true)
    expect(kitchen.kinds).toEqual(['kitchen'])
    expect(dining.kinds).toEqual(['dining'])

    w.inventory = { stone: 0, wood: 0 }
    expect(siteBlocker(w, kitchen, 'kitchen')).toContain('还需要')
    expect(finishSite(w, kitchen, 'kitchen')).toBeNull()
    expect(w.builtSites).toEqual([])
    expect(w.inventory).toEqual({ stone: 0, wood: 0 })
    expect(sharedMealReady(w)).toBe(false)
  })

  it('建成两件设施才解锁实体共餐；材料扣除、存档恢复和撤销都正确', () => {
    const w = mealWorld()
    const kitchen = siteById(KITCHEN_SITE_ID)!
    const dining = siteById(DINING_SITE_ID)!

    const kitchenChange = finishSite(w, kitchen, 'kitchen')!
    expect(kitchenChange).not.toBeNull()
    expect(w.inventory).toEqual({ stone: 6, wood: 6 })
    expect(sharedMealReady(w)).toBe(false)
    expect(siteBlocker(w, kitchen, 'kitchen')).toContain('已经建好')

    expect(finishSite(w, dining, 'dining')).not.toBeNull()
    expect(w.inventory).toEqual({ stone: 4, wood: 3 })
    expect(w.builtSites).toEqual([
      { id: KITCHEN_SITE_ID, kind: 'kitchen' },
      { id: DINING_SITE_ID, kind: 'dining' },
    ])
    expect(sharedMealReady(w)).toBe(true)
    expect(mealFacilities(w)?.dining).toMatchObject({ x: 13, y: 19, w: 4, h: 3 })

    const loaded = deserialize(serialize(w))
    expect(loaded.ok).toBe(true)
    if (loaded.ok) {
      expect(sharedMealReady(loaded.world)).toBe(true)
      expect(loaded.world.builtSites).toEqual(w.builtSites)
    }

    const beforeUndo = { ...w.inventory }
    expect(undoSite(w, kitchenChange)).toBe(true)
    expect(w.inventory).toEqual({ stone: beforeUndo.stone + kitchen.cost.stone, wood: beforeUndo.wood + kitchen.cost.wood })
    expect(w.builtSites.some((site) => site.id === KITCHEN_SITE_ID)).toBe(false)
    expect(sharedMealReady(w)).toBe(false)
  })

  it('v13 旧存档没有新设施也没有共餐计数，仍能加载并走原吃饭方式', () => {
    const w = mealWorld()
    const raw = serialize(w)
    // 模拟真正的 v13 旧档：没有 sharedMeals 字段。
    raw.version = 13
    delete (raw.world.farm as { sharedMeals?: number }).sharedMeals
    expect(raw.world.builtSites).toEqual([])

    const loaded = deserialize(JSON.parse(JSON.stringify(raw)))
    expect(loaded.ok).toBe(true)
    if (!loaded.ok) return
    expect(sharedMealReady(loaded.world)).toBe(false)
    const result = serveMeal(loaded.world)
    expect(result).toMatchObject({ ok: true, shared: false, food: 1 })
    expect(loaded.world.farm.food).toBe(1)
  })
})

describe('共餐结算', () => {
  it('所有入口共用 serveMeal：一次只扣一份，食物或伙伴不足时明确失败', () => {
    const w = mealWorld()
    buildFacilities(w)

    expect(serveMeal(w)).toMatchObject({ ok: true, shared: true, food: 1 })
    expect(w.farm.sharedMeals).toBe(1)
    expect(serveMeal(w)).toMatchObject({ ok: true, shared: true, food: 0 })
    expect(w.farm.sharedMeals).toBe(2)
    expect(serveMeal(w)).toEqual({ ok: false, reason: 'no-food' })
    // 失败的开饭不计入围坐次数。
    expect(w.farm.sharedMeals).toBe(2)

    const noPartners = mealWorld()
    buildFacilities(noPartners)
    noPartners.pods = []
    noPartners.farm.food = 2
    expect(serveMeal(noPartners)).toEqual({ ok: false, reason: 'no-partners' })
    expect(noPartners.farm.food).toBe(2)
    expect(noPartners.farm.sharedMeals).toBe(0)
  })

  it('第一次围坐共餐就是第二层章末：次数入档，设施不能再撤销没建过', () => {
    const w = mealWorld()
    const kitchenChange = finishSite(w, siteById(KITCHEN_SITE_ID)!, 'kitchen')!
    const diningChange = finishSite(w, siteById(DINING_SITE_ID)!, 'dining')!
    expect(serveMeal(w)).toMatchObject({ ok: true, shared: true })
    expect(w.farm.sharedMeals).toBe(1)

    // 围坐次数随存档往返一致。
    const loaded = deserialize(serialize(w))
    expect(loaded.ok).toBe(true)
    if (loaded.ok) expect(loaded.world.farm.sharedMeals).toBe(1)

    // 共餐发生后撤销灶台/餐桌会被拒绝，避免存档出现"围坐过却没设施"的矛盾。
    expect(undoSite(w, diningChange)).toBe(false)
    expect(undoSite(w, kitchenChange)).toBe(false)
    expect(sharedMealReady(w)).toBe(true)
    expect(deserialize(serialize(w)).ok).toBe(true)
  })

  it('围坐路线只安排已加入的伙伴，终点是餐桌前的座位，不会重复占座', () => {
    const w = mealWorld()
    buildFacilities(w)
    const seats = mealSeats(w)
    expect(seats).toHaveLength(4)
    expect(seats.every((seat) => seat.y === 21)).toBe(true)

    const moves = planMealGathering(w)
    expect(moves.length).toBeGreaterThan(0)
    for (const move of moves) {
      expect(seats).toContainEqual(move.seat)
      expect(move.route.at(-1)).toEqual(move.seat)
    }
    const used = moves.map((move) => `${move.seat.x},${move.seat.y}`)
    expect(new Set(used).size).toBe(used.length)
  })

  it('没有建成设施时不规划围坐，但仍保留旧结算路径', () => {
    const w = mealWorld()
    expect(mealSeats(w)).toEqual([])
    expect(planMealGathering(w)).toEqual([])
    expect(serveMeal(w)).toMatchObject({ ok: true, shared: false })
  })
})
