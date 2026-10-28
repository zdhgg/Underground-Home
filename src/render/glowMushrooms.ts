import type { Graphics } from 'pixi.js'
import { mushroomSpots } from '../core/exploration'
import { TILE_SIZE as T, type WorldState } from '../core/world'

/**
 * 泉水边潮湿洞壁上的发光蘑菇：成簇呼吸的柔光。
 * 拾取后的点位由规则层移除，不再绘制菌根、残光或光圈。
 */
export function drawGlowMushrooms(g: Graphics, world: WorldState, elapsed: number): void {
  for (const spot of mushroomSpots(world)) {
    const mx = (spot.x + 0.5) * T
    const my = (spot.y + 0.42) * T
    const breathe = 0.5 + 0.5 * Math.sin(elapsed * 1.7 + spot.x)
    g.ellipse(mx, my - 4, 15, 11).fill({ color: 0x9fe8c8, alpha: 0.07 + 0.07 * breathe })
    for (let i = 0; i < 3; i++) {
      const cx = mx - 6 + i * 6
      const cy = my - (i % 2 === 0 ? 1 : 4)
      g.circle(cx, cy, 3.4).fill({ color: 0xcdf4de, alpha: 0.95 })
      g.circle(cx - 1, cy - 1.2, 1.4).fill({ color: 0xffffff, alpha: 0.5 })
      g.circle(cx, cy, 6 + 2 * breathe).fill({ color: 0x9fe8c8, alpha: 0.12 + 0.10 * breathe })
    }
  }
}
