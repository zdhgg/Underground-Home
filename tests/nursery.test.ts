import { describe, expect, it } from 'vitest'
import { TILE, createInitialWorld, type WorldState } from '../src/core/world'
import { dig } from '../src/core/dig'
import { placePod } from '../src/core/build'
import { canPlaceNursery, isMushroomSpot, mushroomSpots, NURSERY_COST, placeNursery, validNurseries } from '../src/core/nursery'
import { canPlacePlanter, placePlanter } from '../src/core/farm'
import { changeMaterials, isClayCell } from '../src/core/materials'
import { createWorldHistory } from '../src/core/history'
import { deserialize, serialize } from '../src/core/persistence'
import { facilityView } from '../src/app/facilityPanel'
import { drawNursery, drawPlanter } from '../src/render/farmProps'

/** 水已引上来的第二层小世界（farmed 形状）。 */
function wateredWorld(): WorldState {
  const world = createInitialWorld()
  world.progress = { crystalFound: true, crystalCollected: true, coreRepaired: true }
  world.tiles[9][14] = TILE.EMPTY
  for (let y = 10; y <= 11; y++) for (let x = 12; x <= 14; x++) dig(world, x, y)
  placePod(world, 12, 10)
  for (const x of [26, 27]) { dig(world, x, 11); dig(world, x, 10) }
  // 让水可见：裂纹 → 换镐 → 梯道接通并抵达、泉边挖开
  world.exploration.clueFound = true
  world.exploration.pickaxeUpgraded = true
  world.exploration.entered = true
  world.exploration.springFound = true
  world.exploration.shaftX = 27
  world.exploration.explorer = { x: 18, y: 21 }
  for (let y = 12; y < 19; y++) if (world.tiles[y][27] !== TILE.EMPTY) world.tiles[y][27] = TILE.EMPTY
  for (let x = 23; x >= 18; x--) { dig(world, x, 21); dig(world, x, 20) }
  world.farm.waterSupplied = true
  world.inventory = { stone: 8, wood: 8 }
  return world
}

describe('育苗架与番茄（2C）', () => {
  it('水到菜园后可在第二层搭育苗架；费用、重叠与分层规则与菜槽同构', () => {
    const world = wateredWorld()
    expect(world.tiles[21][25]).toBe(TILE.EMPTY)
    expect(canPlaceNursery(world, 25, 21)).toEqual({ ok: true })
    expect(NURSERY_COST).toEqual({ stone: 2, wood: 2 })
    expect(placeNursery(world, 25, 21)).toMatchObject({ id: 1, x: 25, y: 21 })
    expect(canPlaceNursery(world, 25, 21)).toMatchObject({ ok: false, reason: 'overlap' })
    expect(canPlaceNursery(world, 5, 11)).toMatchObject({ ok: false, reason: 'layer' })
    // 没引水时不能搭。
    const dry = wateredWorld()
    dry.farm.waterSupplied = false
    expect(canPlaceNursery(dry, 25, 21)).toMatchObject({ ok: false, reason: 'no-water' })
  })

  it('育苗架可撤销退材料；还有番茄苗时不能撤销没建过', () => {
    const world = wateredWorld()
    const history = createWorldHistory()
    const nursery = placeNursery(world, 25, 21)!
    changeMaterials(world, NURSERY_COST, -1)
    history.record({ kind: 'nursery', id: nursery.id, cost: { ...NURSERY_COST } })
    // 种下一槽番茄：番茄失去来处前，育苗架不可撤销。
    const tomato = placePlanter(world, 31, 21)
    if (tomato) tomato.crop = 'tomato'
    expect(history.undo(world)).toBeNull()
    expect(world.nurseries).toHaveLength(1)
    // 撤掉番茄槽后可以撤育苗架。
    changeMaterials(world, { stone: 1, wood: 1 }, -1)
    history.record({ kind: 'planter', id: tomato!.id, cost: { stone: 1, wood: 1 } })
    expect(history.undo(world)).toMatchObject({ kind: 'planter' })
    expect(history.undo(world)).toMatchObject({ kind: 'nursery' })
    expect(world.nurseries).toHaveLength(0)
    expect(world.inventory).toEqual({ stone: 8, wood: 8 })
  })

  it('菜园面板出现升级入口，搭好后换成育苗架面板与番茄主操作', () => {
    const world = wateredWorld()
    const garden = facilityView(world, 'spring-garden')
    expect(garden.upgrade).toMatchObject({ kind: 'build-nursery', label: expect.stringContaining('育苗架') })
    placeNursery(world, 25, 21)
    expect(facilityView(world, 'spring-garden').upgrade).toBeNull()
    const nursery = facilityView(world, 'nursery')
    expect(nursery.primary).toMatchObject({ kind: 'plant-tomato', label: '摆一槽番茄' })
    expect(nursery.summary).toContain('番茄苗')
  })

  it('番茄槽沿用蔬菜的照料与收获规则，画面标记出番茄', () => {
    const world = wateredWorld()
    placeNursery(world, 25, 21)
    const tomato = placePlanter(world, 31, 21)!
    tomato.crop = 'tomato'
    expect(canPlacePlanter(world, 31, 21)).toMatchObject({ ok: false, reason: 'overlap' })
    const view = drawPlanter({ ...tomato, growth: 3 })
    expect(view.label).toContain('tomato')
    view.destroy({ children: true })
    const nurseryView = drawNursery({ x: 25, y: 21 })
    expect(nurseryView.label).toBe('nursery')
    nurseryView.destroy({ children: true })
  })
})

describe('红黏土（发现物与材料）', () => {
  it('泉边的红土层挖出黏土；撤销对称退回', () => {
    const world = wateredWorld()
    expect(isClayCell(20, 20)).toBe(true)
    expect(isClayCell(5, 10)).toBe(false)
    const before = world.inventory.clay ?? 0
    const result = dig(world, 20, 19)
    expect(result.ok).toBe(true)
    expect(world.inventory.clay).toBe(before + 1)
    const history = createWorldHistory()
    history.record({ kind: 'dig', x: 20, y: 19, tile: TILE.SOIL })
    expect(history.undo(world)).toMatchObject({ kind: 'dig' })
    expect(world.inventory.clay ?? 0).toBe(before)
    expect(world.tiles[19][20]).toBe(TILE.SOIL)
  })
})

describe('发光蘑菇（发现物）', () => {
  it('蘑菇长在菜槽不能占的保留格上；没到过泉水层就没有', () => {
    const world = wateredWorld()
    const spots = mushroomSpots(world)
    expect(spots.length).toBeGreaterThan(0)
    for (const spot of spots) {
      expect(canPlacePlanter(world, spot.x, spot.y).ok).toBe(false)
      expect(isMushroomSpot(world, spot.x, spot.y)).toBe(true)
    }
    const dry = wateredWorld()
    dry.exploration.entered = false
    dry.exploration.springFound = false
    expect(mushroomSpots(dry)).toEqual([])
  })
})

describe('育苗架与新菜种的存档（v16）', () => {
  it('育苗架、番茄、黏土与发现位往返一致；v15 旧档按默认补齐', () => {
    const world = wateredWorld()
    placeNursery(world, 25, 21)
    const tomato = placePlanter(world, 31, 21)
    if (tomato) tomato.crop = 'tomato'
    dig(world, 20, 19)
    world.exploration.foundMushroom = true
    world.exploration.foundClay = true
    const loaded = deserialize(serialize(world))
    expect(loaded.ok).toBe(true)
    if (loaded.ok) {
      expect(loaded.world.nurseries).toEqual([{ id: 1, x: 25, y: 21 }])
      expect(loaded.world.farm.planters.some(p => p.crop === 'tomato')).toBe(true)
      expect(loaded.world.exploration.foundMushroom).toBe(true)
      expect(loaded.world.exploration.foundClay).toBe(true)
      expect(loaded.world.inventory.clay).toBe(1)
    }

    const legacy = serialize(world)
    legacy.version = 15
    delete (legacy.world as { nurseries?: unknown }).nurseries
    const migrated = deserialize(JSON.parse(JSON.stringify(legacy)))
    expect(migrated.ok).toBe(true)
    if (migrated.ok) expect(migrated.world.nurseries).toEqual([])
  })

  it('番茄没有育苗架、或育苗架站在非法位置的存档被拒绝', () => {
    const world = wateredWorld()
    const tomato = placePlanter(world, 31, 21)
    if (tomato) tomato.crop = 'tomato'
    const bad = serialize(world)
    expect(deserialize(JSON.parse(JSON.stringify(bad))).ok).toBe(false)

    const world2 = wateredWorld()
    placeNursery(world2, 25, 21)
    expect(validNurseries(world2)).toBe(true)
    const misplaced = serialize(world2)
    misplaced.world.nurseries[0] = { id: 1, x: 18, y: 8 }
    expect(deserialize(JSON.parse(JSON.stringify(misplaced))).ok).toBe(false)
  })
})
