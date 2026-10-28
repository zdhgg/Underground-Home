import { Container, Graphics, Text } from 'pixi.js'
import { MEMORY_CORNER, memoryCornerVisible } from '../core/memories'
import { TILE_SIZE as T, type WorldState } from '../core/world'

/** 第一层墙上的小记忆角：只显示“这里有记忆”，具体内容交给详情面板。 */
export function drawMemoryCorner(world: WorldState): Container {
  const view = new Container()
  view.label = 'memory-corner'
  view.position.set(MEMORY_CORNER.x * T, (MEMORY_CORNER.y + .08) * T)
  if (!memoryCornerVisible(world)) { view.visible = false; return view }
  const width = MEMORY_CORNER.w * T
  const plaque = new Graphics()
  plaque.roundRect(2, 5, width - 4, T - 7, 7).fill({ color: 0x476a61, alpha: .95 }).stroke({ color: 0xd9c58d, width: 2 })
  plaque.roundRect(9, 10, width - 18, T - 19, 4).fill({ color: 0xd4b675, alpha: .92 })
  plaque.circle(width / 2, 20, 6).fill(0xfff2bd).stroke({ color: 0x8a6c3d, width: 1.5 })
  plaque.moveTo(width / 2, 11).lineTo(width / 2, 29).stroke({ color: 0xfff8d3, width: 1, alpha: .65 })
  plaque.moveTo(width / 2 - 9, 20).lineTo(width / 2 + 9, 20).stroke({ color: 0xfff8d3, width: 1, alpha: .65 })
  view.addChild(plaque)
  const label = new Text({ text: `记忆角 · ${world.memories.entries.length}`, style: { fontFamily: 'Microsoft YaHei, sans-serif', fontSize: 8, fill: 0xf5e9c7, stroke: { color: 0x203b35, width: 2 } } })
  label.anchor.set(.5, 1); label.position.set(width / 2, -1); view.addChild(label)
  return view
}
