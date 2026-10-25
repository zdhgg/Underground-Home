import { Container, Graphics } from 'pixi.js'
import type { SoilPlan } from '../core/atu'
import { TILE_SIZE as T } from '../core/world'
import type { MoleDigPose } from './moleVisual'

/** 临时踏台、双爪姿态时序与泥屑；不另画手臂，不拥有地形、位置或任务规则。 */
export class AtuConstruction {
  readonly view = new Container()
  private readonly stool = new Graphics()
  private readonly debris = new Graphics()
  private state: { plan: SoilPlan; time: number; hit: boolean; strike(): void; done(): void } | null = null
  lift = 0
  constructor() { this.view.addChild(this.stool, this.debris) }
  get active(): boolean { return this.state !== null }
  get digging(): MoleDigPose | null {
    const s = this.state
    if (!s) return null
    const elapsed = s.time - (s.plan.lift ? .34 : 0)
    return elapsed >= 0 && elapsed < .45
      ? { elapsed, raised: s.plan.target.y < s.plan.stand.y, overhead: !!s.plan.overhead }
      : null
  }
  start(plan: SoilPlan, strike: () => void, done: () => void): void {
    this.cancel()
    this.state = { plan, time: 0, hit: false, strike, done }
  }
  cancel(): void { this.state = null; this.lift = 0; this.stool.clear(); this.debris.clear() }
  update(dt: number): number {
    const s = this.state
    if (!s) return 0
    s.time += dt
    const { plan: p, time: t } = s, setup = p.lift ? .34 : 0, strikeAt = setup + .25, end = setup + .48 + (p.lift ? .2 : 0)
    const stoolHeight = p.overhead ? 12 : T * p.lift
    this.lift = stoolHeight * Math.max(0, Math.min(1, (t - .14) / .2, (end - t) / .2))
    const x = (p.stand.x + .5) * T, floor = (p.stand.y + 1) * T - 2
    const g = this.stool.clear()
    if (p.lift) {
      const size = Math.min(1, t / .14, (end - t) / .1)
      if (p.lift === 2) g.moveTo(x - 11, floor - T).lineTo(x + 11, floor - T).stroke({ width: 3, color: 0xb89867, alpha: size })
      g.roundRect(x - 14, floor - stoolHeight, 28, 5, 2).fill({ color: 0xd5b37c, alpha: size })
      g.moveTo(x - 11, floor - stoolHeight + 5).lineTo(x - 13, floor).moveTo(x + 11, floor - stoolHeight + 5).lineTo(x + 13, floor)
        .moveTo(x - 10, floor - stoolHeight * .3).lineTo(x + 10, floor - stoolHeight * .75).stroke({ width: 3, color: 0x8b6847, alpha: size })
    }
    const direction = Math.sign(p.target.x - p.stand.x)
    const a = this.debris.clear()
    if (t >= strikeAt && t < setup + .45) {
      const k = (t - strikeAt) / .2
      const impact = p.overhead
        ? { x, y: (p.target.y + 1) * T }
        : { x: (p.target.x + (direction > 0 ? 0 : 1)) * T, y: floor - this.lift - (p.target.y < p.stand.y ? 40 : 26) }
      for (let i = 0; i < 5; i++) {
        const dx = p.overhead ? (i - 2) * (2 + 4 * k) : -direction * (2 + k * (7 + i * 2))
        const dy = -3 * Math.sin(k * Math.PI) + k * k * 14 + (i - 2) * 2
        a.circle(impact.x + dx, impact.y + dy, 1.2 + i % 2 * .5).fill({ color: i % 2 ? 0xd5b37c : 0x95613c, alpha: 1 - k })
      }
    }
    if (!s.hit && t >= strikeAt) { s.hit = true; s.strike() }
    if (this.state === s && t >= end) { this.cancel(); s.done() }
    return direction
  }
}
