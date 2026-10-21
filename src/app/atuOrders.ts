import { moveDestination, sameCell, soilPlan, soilPlanStillValid, type SoilPlan } from '../core/atu'
import type { Cell, WorldState } from '../core/world'

export interface AtuOrderView {
  travel(route: Cell[], done: () => void, step: (cell: Cell) => void): void
  soil(plan: SoilPlan, strike: () => void, done: () => void): void
  cancel(): void
  preview(target: Cell | null, stand?: Cell, lift?: number, text?: string): void
}

/** 一项行动，一个身份令牌。中断后旧动画回调无权修改地形或结束新行动。 */
export class AtuOrders {
  private serial = 0
  private current: { target: Cell; kind: 'move' | 'soil' } | null = null
  get active(): boolean { return this.current !== null }
  matches(target: Cell): boolean { return this.current !== null && sameCell(this.current.target, target) }
  constructor(private readonly ports: {
    world(): WorldState; view: AtuOrderView; busy(value: boolean): void; changed(): void
    dig(cell: Cell): void; notify(text: string): void; failure(result: import('../core/dig').DigResult): string
  }) {}

  cancel(): void {
    this.serial++
    this.current = null
    this.ports.view.cancel()
    this.ports.view.preview(null)
    this.ports.busy(false)
  }

  request(target: Cell, kind: 'move' | 'soil', done?: () => void): void {
    if (this.current?.kind === kind && sameCell(this.current.target, target)) return
    if (this.active) this.cancel()
    const w = this.ports.world(), from = w.exploration.explorer
    if (!from) return
    let plan: SoilPlan | null = null
    let route: Cell[] | null
    if (kind === 'soil') {
      const result = soilPlan(w, from, target)
      if (!result.ok) {
        this.ports.notify(result.failure ? this.ports.failure(result.failure) : result.message)
        const hint = result.blocker ? '先挖这里' : result.failure?.reason === 'rock' ? '坚硬岩石' : result.failure?.reason === 'tool' ? '先换小铁镐' : '暂时够不到'
        this.ports.view.preview(result.blocker ?? target, undefined, 0, hint)
        return
      }
      plan = result.plan; route = plan.route
    } else route = moveDestination(w, from, target)
    if (!route) { this.ports.notify('这里还走不到，先挖出有地面、够高的通道。'); return }
    const id = ++this.serial
    let struck = false
    this.current = { target: { ...target }, kind }
    const live = () => id === this.serial && this.active
    const finish = () => {
      if (!live()) return
      this.current = null; this.ports.view.preview(null); this.ports.busy(false); this.ports.changed()
      done?.()
    }
    this.ports.view.preview(plan?.target ?? route.at(-1)!, plan?.stand, plan?.overhead ? 12 / 32 : plan?.lift, plan ? plan.overhead ? '矮凳向上挖' : plan.lift ? '踏台向上挖' : '阿土去挖' : '走到这里')
    this.ports.busy(true)
    this.ports.view.travel(route, () => {
      if (!live()) return
      w.exploration.explorer = { ...route.at(-1)! }; this.ports.changed()
      if (!plan) { finish(); return }
      if (!soilPlanStillValid(w, plan)) { this.ports.notify('施工位置变啦，再选一块试试。'); finish(); return }
      this.ports.view.soil(plan, () => {
        if (struck || !live() || !plan || !soilPlanStillValid(w, plan)) return
        struck = true
        this.ports.dig(plan.target)
      }, finish)
    }, cell => {
      if (!live()) return
      w.exploration.explorer = { ...cell }; this.ports.changed()
    })
  }
}
