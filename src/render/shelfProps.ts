import { Container, Graphics, Text } from 'pixi.js'
import { TILE_SIZE as T } from '../core/world'

/**
 * 一格储物架的粗版造型：立柱 + 两层隔板。
 * 发现的旧物以小图标摆上架子——"架子上摆着谁留下的东西"一眼可见；
 * 还没有旧物时先摆两摞材料示意。纯视觉，不参与交互与碰撞。
 */
export function drawShelfProp(options: { relicEmojis: string[] }): Container {
  const view = new Container({ label: 'shelf', eventMode: 'none' })
  const g = new Graphics({ label: 'shelf-body' })
  g.eventMode = 'none'
  g.rect(2, 1, 4, T - 3).rect(T - 6, 1, 4, T - 3).fill(0x8a6a42)
  g.rect(0, 9, T, 4).rect(0, 21, T, 4).fill(0xa5804f)
  g.rect(2, 1, 4, 2).rect(T - 6, 1, 4, 2).fill(0xc09a63)
  view.addChild(g)
  const emojis = options.relicEmojis.slice(0, 5)
  if (emojis.length === 0) {
    const stuff = new Graphics({ label: 'shelf-materials' })
    stuff.eventMode = 'none'
    stuff.circle(9, 12, 3).circle(14, 11, 2.4).fill(0x9aa3a8)
    stuff.rect(20, 9.5, 7, 3).rect(21, 12.5, 5, 2.6).fill(0x8a6a42)
    view.addChild(stuff)
  }
  emojis.forEach((emoji, index) => {
    const label = new Text({ text: emoji, style: { fontSize: 11 } })
    label.anchor.set(0.5)
    label.eventMode = 'none'
    label.position.set(index < 3 ? 8 + index * 8 : 12 + (index - 3) * 8, index < 3 ? 7.5 : 19.5)
    view.addChild(label)
  })
  return view
}
