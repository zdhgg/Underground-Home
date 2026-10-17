import { Container, Graphics } from 'pixi.js'
import type { Relic } from '../core/relics'
import { TILE_SIZE } from '../core/world'

/**
 * 挖出来的旧避难所遗物：程序化小道具，摆在发现的那一格地面上。
 * 只用简单形状，和现有的睡眠舱 / 伙伴示意造型同一套画法；不需要新的 PNG 素材。
 */
const OUTLINE = 0x2c3f3a

export function drawRelic(relic: Relic): Container {
  const view = new Container()
  const g = new Graphics()
  view.position.set((relic.x + 0.5) * TILE_SIZE, (relic.y + 0.74) * TILE_SIZE)

  switch (relic.id) {
    case 'seed-pouch': {
      // 小布袋 + 冒出来的嫩芽：一眼能看出"以后能种东西"
      g.roundRect(-9, -13, 18, 13, 5).fill(0xa9825c).stroke({ width: 2, color: OUTLINE })
      g.moveTo(-6, -13).lineTo(6, -13).stroke({ width: 2, color: 0x6f5237 })
      for (const dx of [-4, 0, 4]) g.circle(dx, -7, 1.8).fill(0x5c4630)
      g.moveTo(0, -14).lineTo(0, -20).stroke({ width: 2, color: 0x6ba05f })
      g.ellipse(-4, -20, 4, 2.4).fill(0x8fd38a)
      g.ellipse(4, -22, 4, 2.4).fill(0x8fd38a)
      break
    }
    case 'wrench': {
      g.roundRect(-13, -6, 24, 6, 3).fill(0xa7b3ba).stroke({ width: 2, color: OUTLINE })
      g.circle(-13, -10, 6).stroke({ width: 4, color: 0xa7b3ba })
      g.circle(-13, -10, 6).stroke({ width: 1, color: OUTLINE })
      break
    }
    case 'lamp-shade': {
      g.poly([-11, 0, 11, 0, 6, -11, -6, -11]).fill(0xf7e7bd).stroke({ width: 2, color: OUTLINE })
      g.moveTo(-11, 0).lineTo(11, 0).stroke({ width: 2, color: 0xb39a68 })
      g.circle(0, 5, 4).fill({ color: 0xffe2a8, alpha: 0.95 })
      break
    }
    default: {
      g.circle(0, -6, 7).fill(0xd9c295).stroke({ width: 2, color: OUTLINE })
    }
  }

  view.addChild(g)
  return view
}
