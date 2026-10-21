import { Container, Graphics, Text } from 'pixi.js'

/** 一次只显示一位伙伴的短回应。跟随实际角色位置，不驱动任务或世界。 */
export class PartnerFeedback {
  readonly view = new Container()
  private readonly background = new Graphics()
  private readonly text = new Text({ text: '', style: {
    fontFamily: '"Microsoft YaHei", sans-serif', fontSize: 11, fontWeight: '600', fill: 0x365447,
  } })
  private age = 0
  private anchor: (() => { x: number; y: number } | null) | null = null

  constructor() {
    this.text.anchor.set(0.5)
    this.view.addChild(this.background, this.text)
    this.view.visible = false
  }

  show(message: string, anchor: () => { x: number; y: number } | null): void {
    this.text.text = message
    this.anchor = anchor
    this.age = 0
    const w = this.text.width + 20, h = this.text.height + 14
    const g = this.background
    g.clear()
    g.roundRect(-w / 2, -h / 2, w, h, 8).fill(0xfffbee).stroke({ width: 1.3, color: 0xa6bd9b })
    g.moveTo(-4, h / 2 - 1).lineTo(0, h / 2 + 6).lineTo(4, h / 2 - 1).fill(0xfffbee)
    this.update(0)
  }

  reset(): void { this.anchor = null; this.view.visible = false }

  update(dt: number): void {
    this.age += dt
    const point = this.anchor?.()
    if (!point || this.age > 2.8) { this.reset(); return }
    this.view.visible = true
    this.view.position.set(point.x, point.y - 8)
    this.view.alpha = Math.min(1, (this.age + 0.08) / 0.16, (2.8 - this.age) / 0.3)
  }
}
