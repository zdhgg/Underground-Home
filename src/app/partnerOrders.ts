import { planPartnerWork, workAvailable, workerHomeRoute, workerName, workTitle, type WorkPlan, type WorkTarget } from '../core/partnerWork'
import { sameCell } from '../core/atu'
import type { Cell, WorkerId, WorldState } from '../core/world'

export interface WorkUI { worker: WorkerId; name: string; title: string; phase: 'walking' | 'working' | 'returning' }
interface WorkView {
  travel(id: WorkerId, route: Cell[], step: (cell: Cell) => void, done: () => void): void
  act(plan: WorkPlan, strike: () => void, done: () => void): void
  cancel(): void
}

/** 一项专业工作；结算只发生一次，取消后所有旧回调失效。 */
export class PartnerOrders {
  private order: { worker: WorkerId; applied: boolean; title: string } | null = null
  get active(): boolean { return this.order !== null }
  constructor(private readonly ports: {
    world(): WorldState; view: WorkView; state(value: WorkUI | null): void
    changed(): void; complete(plan: WorkPlan): boolean; notify(text: string): void
  }) {}
  /** 被占用时明确反馈；所有场景目标仍走原来的单项分发，不排队。 */
  explainBusy(): void {
    if (!this.order) return
    this.ports.notify(`${workerName(this.order.worker)}正在${this.order.title}。可以拖图、查看楼层；想做别的，先点“停下来，换个目标”。`)
  }
  request(target: WorkTarget): void {
    if (this.order) { this.explainBusy(); return }
    const result = planPartnerWork(this.ports.world(), target)
    if (!result.ok) { this.ports.notify(result.message); return }
    const token = { plan: result.plan, worker: result.plan.worker, applied: false, title: workTitle(result.plan.target) }
    this.order = token
    const plan = token.plan
    const state = (phase: WorkUI['phase']): void => this.ports.state({ worker: plan.worker, name: workerName(plan.worker), title: workTitle(plan.target), phase })
    const current = (): boolean => this.order === token
    const step = (cell: Cell): void => {
      if (!current()) return
      this.ports.world().workers[plan.worker] = { ...cell }; this.ports.changed()
    }
    const finish = (): void => {
      if (!current()) return
      this.order = null; this.ports.state(null)
    }
    state('walking')
    this.ports.view.travel(plan.worker, plan.route, step, () => {
      if (!current()) return
      const w = this.ports.world()
      step(plan.at)
      if (!workAvailable(w, plan.target) || !sameCell(w.workers[plan.worker] ?? null, plan.at)) { finish(); return }
      state('working')
      this.ports.view.act(plan, () => {
        if (!current() || token.applied || !workAvailable(w, plan.target)) return
        token.applied = this.ports.complete(plan)
        if (token.applied) this.ports.changed()
      }, () => {
        if (!current()) return
        // 小泉接好泉边管道后，沿原通路返回营地；取消返程保留供水成果。
        if (token.applied && plan.target.kind === 'water') {
          const route = workerHomeRoute(w, w.workers[plan.worker]!, plan.worker)
          if (route && route.length > 1) { state('returning'); this.ports.view.travel(plan.worker, route, step, finish); return }
        }
        finish()
      })
    })
  }
  /** 建床前的单次退让复用同一锁与取消边界，不生成新任务或瞬移。 */
  clearBed(worker: WorkerId, route: Cell[], done: () => void): void {
    if (this.order) return
    const token = this.order = { worker, applied: false, title: '让开床位' }
    this.ports.state({ worker, name: workerName(worker), title: '让开床位', phase: 'walking' })
    this.ports.view.travel(worker, route, p => {
      if (this.order !== token) return
      this.ports.world().workers[worker] = { ...p }; this.ports.changed()
    }, () => {
      if (this.order !== token) return
      this.ports.world().workers[worker] = { ...route.at(-1)! }; this.ports.changed()
      this.order = null; this.ports.state(null); done()
    })
  }
  cancel(message = true): void {
    if (!this.order) return
    const applied = this.order.applied, name = workerName(this.order.worker)
    this.order = null
    this.ports.view.cancel(); this.ports.state(null)
    if (message) this.ports.notify(applied ? `${name}停下来啦，刚完成的成果保留。现在可以点新的目标。` : `${name}停下来啦，现在可以点新的目标。`)
  }
}
