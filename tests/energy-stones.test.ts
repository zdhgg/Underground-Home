import { describe, expect, it } from 'vitest'
import { canRestoreDig, placePod } from '../src/core/build'
import { dig } from '../src/core/dig'
import { ENERGY_STONES, collectedStoneCount, nextStoneToFind } from '../src/core/energyStones'
import { canPlacePlanter } from '../src/core/farm'
import { canPlaceShelf } from '../src/core/storage'
import { collectCrystal, repairCore } from '../src/core/interact'
import { deserialize, serialize } from '../src/core/persistence'
import { soilPlan, atuRoute, initialAtuPosition } from '../src/core/atu'
import { checkRoomPlan, roomAt } from '../src/core/rooms'
import { finishSite, siteBlueprintVisible, siteById, siteRoom } from '../src/core/sites'
import { LANDMARKS, TILE, WORLD_VERSION, createInitialWorld, tileAt, type Room, type WorldState } from '../src/core/world'

const left = LANDMARKS.crystal
const right = LANDMARKS.secondCrystal

/** 按真实规则往右翼地面挖：大厅右侧地面 → 一块一块横着挖过去。 */
function digRightWingTo(world: WorldState, x: number): void {
  for (let cx = 26; cx <= x; cx++) dig(world, cx, 11)
}

describe('两块能源石的位置', () => {
  it('一开始都在泥土里，第一块先指左边那块', () => {
    const world = createInitialWorld()
    expect(ENERGY_STONES).toHaveLength(2)
    expect(tileAt(world, left.x, left.y)).toBe(TILE.SOIL)
    expect(tileAt(world, right.x, right.y)).toBe(TILE.SOIL)
    expect(nextStoneToFind(world)?.id).toBe('left')
  })

  it('第二块真的挖得到：顺着右墙挖开一列就够得着', () => {
    const world = createInitialWorld()
    // 大厅右侧地面是空的，阿土能站在那里
    expect(atuRoute(world, initialAtuPosition(world), { x: 25, y: 11 })).not.toBeNull()
    expect(dig(world, 26, 11).ok).toBe(true)
    expect(dig(world, 26, 10).ok).toBe(true)
    expect(dig(world, 26, 9).ok).toBe(true)
    // 站到挖开的那一列上，能够到石头那一格
    const plan = soilPlan(world, { x: 26, y: 11 }, { x: right.x, y: right.y })
    expect(plan.ok).toBe(true)
    expect(dig(world, right.x, right.y).ok).toBe(true)
    expect(world.progress.secondCrystalFound).toBe(true)
    expect(world.progress.crystalFound).toBe(false)
  })
})

describe('第二块能源石不和建造打架', () => {
  it('已发现的石头不能被撤销挖掘埋回去', () => {
    const world = createInitialWorld()
    dig(world, left.x, left.y)
    expect(canRestoreDig(world, left.x, left.y)).toBe(false)
    digRightWingTo(world, right.x)
    expect(canRestoreDig(world, right.x, right.y)).toBe(false)
  })

  it('储物架和菜槽不会压在石头上', () => {
    const world = createInitialWorld()
    world.progress = { ...world.progress, crystalFound: true, crystalCollected: true, secondCrystalFound: true, secondCrystalCollected: true, coreLoaded: true, coreRepaired: true }
    for (const stone of ENERGY_STONES) {
      world.tiles[stone.cell.y][stone.cell.x] = TILE.EMPTY
      expect(canPlaceShelf(world, stone.cell.x, stone.cell.y).ok).toBe(false)
      expect(canPlacePlanter(world, stone.cell.x, stone.cell.y).ok).toBe(false)
    }
  })

  it('第二块石头不挡小床：挖开右翼后，小床照样能放在它周围', () => {
    const world = createInitialWorld()
    world.progress = { ...world.progress, crystalFound: true, crystalCollected: true, secondCrystalFound: true, secondCrystalCollected: true, coreLoaded: true, coreRepaired: true }
    for (const x of [25, 26, 27, 28, 29, 30, 31, 32]) for (const y of [9, 10, 11]) dig(world, x, y)
    // 石头在顶格（y9），小床只铺 y10–11，所以压不到它
    expect(right.y).toBeLessThan(10)
    expect(placePod(world, 29, 10)).not.toBeNull()
  })

  it('先建好的房间不会被后来的石头硬塞进去：石头所在格本来就是空的', () => {
    const world = createInitialWorld()
    world.progress = { ...world.progress, crystalFound: true, crystalCollected: true, secondCrystalFound: true, secondCrystalCollected: true, coreLoaded: true, coreRepaired: true }
    for (const stone of ENERGY_STONES) world.tiles[stone.cell.y][stone.cell.x] = TILE.EMPTY
    const room = siteRoom(siteById('home-lounge')!, 'lounge') as Room
    for (let y = room.y; y < room.y + room.h; y++) for (let x = room.x; x < room.x + room.w; x++) world.tiles[y][x] = TILE.EMPTY
    expect(checkRoomPlan(world, room).ok).toBe(true)
  })

  it('第二块石头在客厅预设范围内，收走以后客厅照样能建', () => {
    const world = createInitialWorld()
    world.progress = { ...world.progress, crystalFound: true, crystalCollected: true, coreLoaded: true, coreRepaired: true }
    world.exploration.explorer = { x: 25, y: 11 }
    const lounge = siteById('home-lounge')!
    for (let y = lounge.y; y < lounge.y + lounge.h; y++) for (let x = lounge.x; x < lounge.x + lounge.w; x++) dig(world, x, y)
    // 预设洞室还要一条两格高的走道接到大厅
    for (const x of [26, 27]) for (const y of [10, 11]) dig(world, x, y)
    dig(world, right.x, right.y)
    expect(siteBlueprintVisible(world, lounge)).toBe(true)
    expect(collectCrystal(world, right.x, right.y).ok).toBe(true)
    const change = finishSite(world, lounge, 'lounge')
    expect(change).not.toBeNull()
    expect(roomAt(world, { x: lounge.x + 1, y: lounge.y + 1 })?.kind).toBe('lounge')
    expect(collectedStoneCount(world)).toBe(2)
  })
})

describe('v26 存档迁移到 v27', () => {
  function legacySave(collectFirst: boolean): unknown {
    const world = createInitialWorld()
    dig(world, left.x, left.y)
    if (collectFirst) collectCrystal(world, left.x, left.y)
    const payload = serialize(world)
    payload.version = 26
    const progress = payload.world.progress as unknown as Record<string, unknown>
    delete progress.secondCrystalFound
    delete progress.secondCrystalCollected
    delete progress.coreLoaded
    return JSON.parse(JSON.stringify(payload))
  }

  it('旧档已经收好一块石头时，不会在半途被要求再挖一块', () => {
    const loaded = deserialize(legacySave(true))
    expect(loaded.ok).toBe(true)
    if (!loaded.ok) return
    expect(loaded.world.progress.coreLoaded).toBe(true)
    expect(loaded.world.progress.secondCrystalCollected).toBe(true)
    expect(repairCore(loaded.world, LANDMARKS.generator.x, LANDMARKS.generator.y).stage).toBe('repaired')
    expect(loaded.world.progress.coreRepaired).toBe(true)
  })

  it('旧档连第一块都没收时，迁移只是把新字段补成未完成', () => {
    const loaded = deserialize(legacySave(false))
    expect(loaded.ok).toBe(true)
    if (!loaded.ok) return
    expect(loaded.world.progress.secondCrystalCollected).toBe(false)
    expect(loaded.world.progress.coreLoaded).toBe(false)
    expect(loaded.world.progress.coreRepaired).toBe(false)
  })

  it('当前版本的存档缺了新进度位就按损坏处理', () => {
    const world = createInitialWorld()
    const payload = serialize(world)
    expect(payload.version).toBe(WORLD_VERSION)
    const progress = payload.world.progress as unknown as Record<string, unknown>
    delete progress.coreLoaded
    expect(deserialize(JSON.parse(JSON.stringify(payload))).ok).toBe(false)
  })
})
