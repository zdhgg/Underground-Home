import { atuRoute, initialAtuPosition } from '../core/atu'
import { TILE, type Cell, type WorkerId, type WorldState } from '../core/world'
import type { PixiWorldRenderer } from '../render/PixiRenderer'

/** 一项施工的生命周期：真实站位、停帧恢复和过期回调隔离，不拥有章节规则。 */
export class ChapterJourney {
  private serial = 0
  private running = false
  private timeout: ReturnType<typeof setTimeout> | undefined
  get busy(): boolean { return this.running }
  get token(): number { return this.serial }
  live(token: number): boolean { return this.running && token === this.serial }
  constructor(private p: { world(): WorldState; view: PixiWorldRenderer; changed(): void; refresh(): void; notify(s: string): void }) {}
  begin(): number {
    this.running = true; const token = ++this.serial, start = Date.now()
    let frame = this.p.view.frames, last = start
    const check = () => {
      if (!this.live(token)) return
      const now = Date.now(), next = this.p.view.frames
      if (next !== frame) { frame = next; last = now }
      if (now - start >= 60000 || typeof frame === 'number' && now - last >= 3000) { this.cancel(); this.p.notify('动作先停下来啦，已完成的部分保留，再点一次就能继续。'); return }
      this.timeout = setTimeout(check, 800)
    }
    clearTimeout(this.timeout); this.timeout = setTimeout(check, 800); this.p.refresh(); return token
  }
  finish(): void { ++this.serial; this.running = false; clearTimeout(this.timeout); this.p.changed(); this.p.refresh() }
  cancel(): void { ++this.serial; this.running = false; clearTimeout(this.timeout); this.p.view.cancelDeepAnimation?.(); this.p.changed(); this.p.refresh() }
  moveAtu(to: Cell, done: () => void): void {
    const w = this.p.world(), token = this.serial, route = atuRoute(w, w.exploration.explorer ?? initialAtuPosition(w), to, true)
    if (!route) { this.p.notify('先挖通两格高、有地面的通道。'); this.finish(); return }
    let arrived = false
    this.p.view.playExplorationTravel(route, () => { if (!arrived && this.live(token)) { arrived = true; w.exploration.explorer = { x: to.x, y: to.y }; done() } }, cell => { if (!arrived && this.live(token)) { w.exploration.explorer = { x: cell.x, y: cell.y }; this.p.changed() } })
  }
  moveWorker(id: WorkerId, to: Cell, done: () => void): void {
    const w = this.p.world(), token = this.serial, from = w.workers[id], route = from && atuRoute(w, from, to, true)
    if (!route) { this.p.notify('伙伴还走不到这里，先接通通道。'); this.finish(); return }
    let arrived = false
    this.p.view.playPartnerTravel(id, route, cell => { if (!arrived && this.live(token)) { w.workers[id] = { x: cell.x, y: cell.y }; this.p.changed() } }, () => { if (!arrived && this.live(token)) { arrived = true; done() } })
  }
  work(id: 'atu' | WorkerId, at: Cell, done: () => void): void {
    const token = this.serial
    let arrived = false
    if (id === 'atu') { this.p.view.playHallWork(at, () => { if (!arrived && this.live(token)) { arrived = true; done() } }); return }
    const w = this.p.world(), atu = w.exploration.explorer
    if (atu?.x === at.x && atu.y === at.y) at = [{ x: at.x + 1, y: at.y }, { x: at.x - 1, y: at.y }].find(p => w.workers[id] && atuRoute(w, w.workers[id]!, p, true)) ?? at
    this.moveWorker(id, at, () => {
      this.p.view.playPartnerWork({ worker: id, at, route: [at], target: { kind: 'deep-rock', x: at.x, y: at.y + 1 } }, () => {}, () => { if (!arrived && this.live(token)) { arrived = true; done() } })
    })
  }
  run(to: Cell, actor: 'atu' | WorkerId, done: () => void): void { this.begin(); this.moveAtu(to, () => this.work(actor, to, done)) }
  excavate(frontier: () => Cell | null, dug: (p: Cell) => void, done: () => void): void {
    const w = this.p.world(), token = this.begin()
    const next = () => {
      if (!this.live(token)) return
      const target = frontier()
      if (!target) { done(); this.finish(); return }
      const at = { x: target.x, y: target.y - 1 }
      this.moveWorker('ayan', at, () => {
        let completed = false
        this.p.view.playPartnerWork({ worker: 'ayan', at, route: [at], target: { kind: 'deep-rock', ...target } }, () => {
          if (!this.live(token) || w.tiles[target.y][target.x] === TILE.EMPTY) return
          w.tiles[target.y][target.x] = TILE.EMPTY; w.dugCount++; dug(target); this.p.changed()
        }, () => { if (!completed && this.live(token)) { completed = true; next() } })
      })
    }
    next()
  }
}
