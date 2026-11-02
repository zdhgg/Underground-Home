import { Container, Graphics, Text } from 'pixi.js'
import { TILE_SIZE as T } from '../core/world'

/** 引导高亮在地图上的目标：瓦片坐标里的一个矩形，可以是整座设施，也可以是单格。 */
export interface GuideSpot { x: number; y: number; w: number; h: number; label?: string | null }

/**
 * 当前小步的发生地点：和选址推荐位同一套金色引导语言，
 * 框住已建好的设施或要去的格子，配"在这里"小标签；呼吸动画在 update 里做。
 * 各章节控制器按真实目标计算矩形并认领高亮（同一时间只有一个面板能亮它），
 * 面板收起、进入选址/详情或开始施工时撤掉。
 */
export class GuideFocus {
  readonly view = new Container({ label: 'guide-focus' })

  place(spot: GuideSpot | null): void {
    for (const child of this.view.removeChildren()) child.destroy({ children: true })
    if (!spot) return
    const left = spot.x * T, top = spot.y * T, width = spot.w * T, height = spot.h * T, color = 0xffdf97
    const g = new Graphics()
    g.roundRect(left + 2, top + 2, width - 4, height - 4, 9).fill({ color, alpha: .1 }).stroke({ width: 2, color, alpha: .8 })
    const len = 9
    for (const [cx, cy, dx, dy] of [[left, top, 1, 1], [left + width, top, -1, 1], [left, top + height, 1, -1], [left + width, top + height, -1, -1]] as const) {
      g.moveTo(cx + dx * len, cy + dy * len).lineTo(cx, cy).lineTo(cx + dx * len, cy).stroke({ width: 3, color, alpha: .9 })
    }
    this.view.addChild(g)
    if (spot.label === null) return
    const label = new Text({ text: spot.label ?? '在这里', style: { fontFamily: 'Microsoft YaHei, sans-serif', fontSize: 11, fontWeight: '700', fill: 0xffe9b8 } })
    label.anchor.set(.5, 1)
    const bg = new Graphics()
    bg.roundRect(-label.width / 2 - 8, -label.height - 10, label.width + 16, label.height + 10, 7).fill({ color: 0x2b2413, alpha: .88 }).stroke({ width: 1, color, alpha: .55 })
    label.position.set(0, -4)
    const tag = new Container()
    tag.addChild(bg, label)
    tag.position.set(left + width / 2, top - 6)
    this.view.addChild(tag)
  }

  update(time: number): void { this.view.alpha = .6 + .3 * Math.sin(time * 2.2) }
}
