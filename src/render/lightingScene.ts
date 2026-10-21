import { Container, Graphics } from 'pixi.js'
import { canPlaceWallLamp } from '../core/exploration'
import { canRetrofitLamp, hasWideLampAbility, lampCoverage, lightField } from '../core/lighting'
import { TILE_SIZE as T, type Cell, type WorldState } from '../core/world'

/** 用规则层的格子覆盖照亮已挖洞壁；没有整层提亮或穿岩光圈。 */
export class LightingScene {
  readonly view = new Container()
  readonly preview = new Graphics()
  private readonly light = new Graphics()
  constructor() { this.view.addChild(this.light) }
  refresh(w: WorldState): void {
    const g = this.light.clear()
    const field = lightField(w), levels = new Map(field.map(p => [`${p.x},${p.y}`, p.strength]))
    for (const p of field) {
      // 小条带插值，让光在已挖格内柔和退去；每一块仍严格裁在合法光场内。
      for (let dx = 0; dx < T; dx += 4) for (let dy = 0; dy < T; dy += 8) {
        const u = (dx + 2) / T, neighbor = levels.get(`${p.x + (u < .5 ? -1 : 1)},${p.y}`) ?? 0
        const strength = p.strength + (neighbor - p.strength) * Math.abs(u - .5)
        const vertical = Math.sin(((p.y - 19) * T + dy + 4) / (3 * T) * Math.PI)
        g.rect(p.x * T + dx, p.y * T + dy, 4, 8).fill({ color: 0xffdf9a, alpha: .27 * strength * vertical })
      }
    }
  }
  showPreview(w: WorldState, cell: Cell | null): void {
    const g = this.preview.clear()
    if (!cell || !hasWideLampAbility(w) || cell.y < 19 || cell.y > 21) return
    const valid = canPlaceWallLamp(w, cell.x) || canRetrofitLamp(w, cell.x)
    if (!valid) return
    for (const p of lampCoverage(w, { x: cell.x, y: 19 }, true)) {
      g.rect(p.x * T + 2, p.y * T + 2, T - 4, T - 4).fill({ color: 0xffdf9b, alpha: .08 }).stroke({ color: 0xffdf9b, width: 1, alpha: .32 })
    }
  }
}
