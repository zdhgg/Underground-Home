import { Container, Text } from 'pixi.js'
import { TILE_SIZE, type Cell, type Inventory } from '../core/world'

/** 掉落的图标和数量从开挖处升起；物品栏的实际数量由规则层更新。 */
export class LootFeedback {
  readonly view = new Container()
  private labels: { text: Text; age: number }[] = []
  show(cell: Cell, loot: Inventory): void {
    const text = new Text({ text: loot.wood ? '🪵 旧木料 +1' : '🪨 石料 +1', style: { fontFamily: 'Microsoft YaHei, Segoe UI Emoji, sans-serif', fontSize: 12, fontWeight: '700', fill: 0xffe4a8, stroke: { color: 0x243b32, width: 3 } } })
    text.anchor.set(.5, 1); text.position.set((cell.x + .5) * TILE_SIZE, cell.y * TILE_SIZE)
    this.view.addChild(text); this.labels.push({ text, age: 0 })
  }
  update(dt: number): void {
    for (const item of this.labels) {
      item.age += dt; item.text.y -= dt * 23; item.text.alpha = Math.min(1, (1.25 - item.age) * 3)
      if (item.age >= 1.25) item.text.destroy()
    }
    this.labels = this.labels.filter(item => item.age < 1.25)
  }
  clear(): void { for (const item of this.labels) item.text.destroy(); this.labels = [] }
}
