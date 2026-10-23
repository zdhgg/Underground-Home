import { describe, expect, it } from 'vitest'
import { TILE, createInitialWorld, type WorldState } from '../src/core/world'
import { dig } from '../src/core/dig'
import { placePod } from '../src/core/build'
import { canPlaceShelf, placeShelf, SHELF_COST, validShelves } from '../src/core/storage'
import { createWorldHistory } from '../src/core/history'
import { deserialize, serialize } from '../src/core/persistence'
import { RELICS } from '../src/core/relics'
import { bagItems } from '../src/core/bag'
import { BUILDING_SITES } from '../src/core/sites'
import { changeMaterials } from '../src/core/materials'
import { facilityView } from '../src/app/facilityPanel'
import { drawShelfProp } from '../src/render/shelfProps'

function repairedWorld(): WorldState {
  const world = createInitialWorld()
  world.progress = { crystalFound: true, crystalCollected: true, coreRepaired: true }
  world.inventory = { stone: 4, wood: 3 }
  return world
}

describe('储物架放置规则', () => {
  it('第一层挖空、有地面承托的格子可以放；费用是一小把', () => {
    const world = repairedWorld()
    expect(world.tiles[11][24]).toBe(TILE.EMPTY)
    expect(canPlaceShelf(world, 24, 11)).toEqual({ ok: true })
    expect(SHELF_COST).toEqual({ stone: 1, wood: 2 })
    expect(placeShelf(world, 24, 11)).toMatchObject({ id: 1, x: 24, y: 11 })
    // 同一格不能叠加。
    expect(canPlaceShelf(world, 24, 11)).toMatchObject({ ok: false, reason: 'overlap' })
  })

  it('第二层、没挖开、悬空、没修核心都放不了', () => {
    const world = repairedWorld()
    expect(canPlaceShelf(world, 20, 21)).toMatchObject({ ok: false, reason: 'layer' })
    expect(canPlaceShelf(world, 5, 10)).toMatchObject({ ok: false, reason: 'soil' })
    expect(canPlaceShelf(world, 17, 10)).toMatchObject({ ok: false, reason: 'support' })
    expect(canPlaceShelf(createInitialWorld(), 24, 11)).toMatchObject({ ok: false, reason: 'power' })
  })

  it('竖井、旧物格子和预设洞室蓝图都留空；大厅半空处放不了', () => {
    const world = repairedWorld()
    expect(canPlaceShelf(world, 21, 11)).toMatchObject({ ok: false, reason: 'reserved' })
    // 大厅里的能源核心区悬在半空：先被"要放在地面上"拦住。
    expect(canPlaceShelf(world, 20, 9)).toMatchObject({ ok: false, reason: 'support' })
    dig(world, 4, 10)
    expect(canPlaceShelf(world, 4, 10)).toMatchObject({ ok: false, reason: 'reserved' })
    dig(world, 13, 10)
    expect(canPlaceShelf(world, 13, 10)).toMatchObject({ ok: false, reason: 'reserved' })
    placePod(world, 12, 10)
    expect(canPlaceShelf(world, 18, 11)).toEqual({ ok: true })
  })

  it('摆放扣材料、可撤销并退材料；撤销栈外不误删', () => {
    const world = repairedWorld()
    const history = createWorldHistory()
    const shelf = placeShelf(world, 24, 11)!
    changeMaterials(world, SHELF_COST, -1)
    history.record({ kind: 'shelf', id: shelf.id, cost: { ...SHELF_COST } })
    expect(world.inventory).toEqual({ stone: 3, wood: 1 })
    expect(history.undo(world)).toMatchObject({ kind: 'shelf' })
    expect(world.shelves).toHaveLength(0)
    expect(world.inventory).toEqual({ stone: 4, wood: 3 })
    expect(validShelves(world)).toBe(true)
  })

  it('存档往返保留架子；v14 旧档按没有架子补齐；位置非法的存档被拒绝', () => {
    const world = repairedWorld()
    placeShelf(world, 24, 11)
    const loaded = deserialize(serialize(world))
    expect(loaded.ok).toBe(true)
    if (loaded.ok) expect(loaded.world.shelves).toEqual([{ id: 1, x: 24, y: 11 }])

    const legacy = serialize(world)
    legacy.version = 14
    delete (legacy.world as { shelves?: unknown }).shelves
    const migrated = deserialize(JSON.parse(JSON.stringify(legacy)))
    expect(migrated.ok).toBe(true)
    if (migrated.ok) expect(migrated.world.shelves).toEqual([])

    const bad = serialize(repairedWorld())
    bad.world.shelves.push({ id: 1, x: 20, y: 9 })
    expect(deserialize(JSON.parse(JSON.stringify(bad))).ok).toBe(false)
  })
})

describe('旧照片与旧钥匙（2D 发现物）', () => {
  it('五件旧物都埋在第一层松土里，不会被初始空间或预设洞室自动挖出来', () => {
    const world = createInitialWorld()
    expect(RELICS).toHaveLength(5)
    for (const relic of RELICS) {
      expect(world.tiles[relic.y][relic.x], `${relic.id} 应埋在泥土里`).toBe(TILE.SOIL)
      const inSite = BUILDING_SITES.some(site => site.layer === 'home'
        && relic.x >= site.x && relic.x < site.x + site.w && relic.y >= site.y && relic.y < site.y + site.h)
      expect(inSite, `${relic.id} 不应落在预设洞室里`).toBe(false)
    }
  })

  it('挖到旧照片与旧钥匙后，背包讲出旧住户的故事', () => {
    const world = repairedWorld()
    dig(world, 26, 9)
    dig(world, 2, 9)
    const items = bagItems(world)
    const photo = items.find(item => item.id === 'old-photo')!
    const key = items.find(item => item.id === 'old-key')!
    expect(photo.count).toBe(1)
    expect(photo.description).toContain('长桌')
    expect(key.count).toBe(1)
    expect(key.description).toContain('更深')
  })

  it('储物架面板：还没挖完旧物时主操作是去找，挖完后是翻故事', () => {
    const world = repairedWorld()
    placeShelf(world, 24, 11)
    const hunting = facilityView(world, 'storage-shelf')
    expect(hunting).toMatchObject({ title: '储物架' })
    expect(hunting.summary).toContain('旧物 0/5')
    expect(hunting.primary).toMatchObject({ kind: 'find-relic' })
    for (const relic of RELICS) {
      world.tiles[relic.y][relic.x] = TILE.EMPTY
      if (world.tiles[relic.y + 1][relic.x] === TILE.EMPTY) world.tiles[relic.y + 1][relic.x] = TILE.SOIL
    }
    const browsing = facilityView(world, 'storage-shelf')
    expect(browsing.primary).toMatchObject({ kind: 'browse-relics' })
    expect(browsing.summary).toContain('旧物 5/5')
  })

  it('架子造型：没有旧物时摆材料示意，有旧物时把小图标摆上架子', () => {
    const empty = drawShelfProp({ relicEmojis: [] })
    expect(empty.children.length).toBeGreaterThanOrEqual(2)
    const full = drawShelfProp({ relicEmojis: ['🌱', '🔧', '🏮', '🖼️', '🗝️'] })
    expect(full.children.length).toBeGreaterThan(empty.children.length)
    empty.destroy({ children: true })
    full.destroy({ children: true })
  })
})
