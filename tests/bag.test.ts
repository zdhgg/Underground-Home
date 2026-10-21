import { describe, expect, it } from 'vitest'
import { Container, Texture, TextureSource } from 'pixi.js'
import { bagItems } from '../src/core/bag'
import { createInitialWorld, TILE } from '../src/core/world'
import { RELICS } from '../src/core/relics'
import { dig } from '../src/core/dig'
import { createWorldHistory } from '../src/core/history'
import { deserialize, serialize } from '../src/core/persistence'
import { drawCollection } from '../src/render/collectionScene'

describe('背包与收藏架共用世界数据', () => {
  it('材料显示实时数量；未找到的旧物不消耗材料、不修改世界', () => {
    const w = createInitialWorld(), before = structuredClone(w)
    expect(bagItems(w).map(i => i.count)).toEqual([4, 3, 0, 0, 0])
    expect(w).toEqual(before)
    w.inventory.stone = 0; w.inventory.wood = 9
    expect(bagItems(w).slice(0, 2).map(i => i.count)).toEqual([0, 9])
  })
  it('旧物数量只会是0或1，撤销重挖与刷新读档不会重复获取', () => {
    const w = createInitialWorld(), h = createWorldHistory(), relic = RELICS[0]
    dig(w, relic.x, relic.y); h.record({ kind: 'dig', x: relic.x, y: relic.y, tile: TILE.SOIL })
    const item = () => bagItems(w).find(i => i.id === relic.id)!
    expect(item().count).toBe(1)
    dig(w, relic.x, relic.y); expect(item().count).toBe(1)
    expect(h.undo(w)).not.toBeNull(); expect(item().count).toBe(0)
    dig(w, relic.x, relic.y); expect(item().count).toBe(1)
    const loaded = deserialize(serialize(w)); expect(loaded.ok).toBe(true)
    if (loaded.ok) expect(bagItems(loaded.world)).toEqual(bagItems(w))
  })
  it('大厅未点亮时收藏架隐藏，点亮后展示已有旧物且不改地形和存档', () => {
    const w = createInitialWorld(), texture = () => new Texture({ source: new TextureSource({ width: 128, height: 128 }) })
    const textures = { shelf: texture(), items: Object.fromEntries(RELICS.map(r => [r.id, texture()])) }
    let view = drawCollection(w, textures)
    expect(view.visible).toBe(false); view.destroy({ children: true })
    w.progress.coreRepaired = true
    for (const r of RELICS) dig(w, r.x, r.y)
    const before = structuredClone(w)
    view = drawCollection(w, textures)
    for (const r of RELICS) expect((view as Container).getChildByLabel(r.id)).not.toBeNull()
    expect(w).toEqual(before); view.destroy({ children: true })
    expect(textures.shelf.destroyed).toBe(false)
    for (const t of [textures.shelf, ...Object.values(textures.items)]) t.destroy(true)
  })
})
