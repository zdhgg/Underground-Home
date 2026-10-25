import { Assets, Container, Sprite, Text, type Texture } from 'pixi.js'
import { COLLECTION_SHELF } from '../core/bag'
import { foundRelics, RELICS } from '../core/relics'
import { TILE_SIZE as T, type WorldState } from '../core/world'
import { ITEM_ART } from '../app/itemArt'
import shelfUrl from '../assets/art/items/shelf-v1.png'

export interface CollectionTextures { shelf: Texture; items: Record<string, Texture> }
export async function loadCollectionTextures(): Promise<CollectionTextures> {
  const shelf = await Assets.load<Texture>(shelfUrl)
  const artEntries = RELICS
    .map(relic => [relic.id, ITEM_ART[relic.id]] as const)
    .filter((entry): entry is readonly [string, string] => Boolean(entry[1]))
  const loaded = await Promise.all(artEntries.map(async ([id, url]) => [id, await Assets.load<Texture>(url)] as const))
  for (const t of [shelf, ...loaded.map(([, texture]) => texture)]) {
    t.source.scaleMode = 'linear'
    t.source.autoGenerateMipmaps = true
  }
  return { shelf, items: Object.fromEntries(loaded) }
}

export function drawCollection(w: WorldState, textures: CollectionTextures): Container {
  const view = new Container()
  view.label = 'collection-shelf'
  view.position.set(COLLECTION_SHELF.x * T, (COLLECTION_SHELF.y + .12) * T)
  if (!w.progress.coreRepaired) { view.visible = false; return view }
  const width = COLLECTION_SHELF.w * T, height = width / 3
  const shelf = new Sprite(textures.shelf)
  shelf.width = width; shelf.height = height
  view.addChild(shelf)
  const found = new Set(foundRelics(w).map(r => r.id))
  RELICS.forEach((r, i) => {
    if (!found.has(r.id)) return
    const texture = textures.items[r.id]
    if (texture) {
      const item = new Sprite(texture)
      item.label = r.id; item.anchor.set(.5, 1)
      item.width = height * .66; item.height = height * .66
      item.position.set(width * (.18 + i * .32), height * .72)
      view.addChild(item)
      return
    }
    const item = new Text({ text: r.emoji, style: { fontSize: height * .52 } })
    item.label = r.id; item.anchor.set(.5, 1)
    item.position.set(width * (.18 + i * .32), height * .72)
    view.addChild(item)
  })
  const label = new Text({ text: `收藏 ${found.size}/${RELICS.length}`, style: { fontFamily: 'Microsoft YaHei, sans-serif', fontSize: 8, fill: 0xeddcba, stroke: { color: 0x203b35, width: 2 } } })
  label.anchor.set(.5, 1); label.position.set(width / 2, -2); view.addChild(label)
  return view
}
