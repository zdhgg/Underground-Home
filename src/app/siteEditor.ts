import { BUILDING_SITES, finishSite, nextSiteDig, siteBlocker, siteBuilt, siteById, siteRoom, siteVisible, siteWorkCells, type BuildingSite, type SiteChange } from '../core/sites'
import { materialText } from '../core/materials'
import { TILE, type Cell, type SiteKind, type WorldState } from '../core/world'
import type { RoomPreview } from './roomEditor'

export interface SiteUI {
  active: boolean; working: boolean; selected: string | null; kind: SiteKind; name: string; icon: string
  description: string; message: string; cost: string; canBuild: boolean; built: boolean; choices: readonly SiteKind[]
  sites: { id: string; name: string; icon: string; layer: 'home' | 'water'; built: boolean }[]
}
export const emptySiteUI = (): SiteUI => ({ active: false, working: false, selected: null, kind: 'home', name: '', icon: '', description: '', message: '', cost: '', canBuild: false, built: false, choices: [], sites: [] })

/** 预设洞室控制器：施工复用阿土的真实单格行动；不保存动画队列。 */
export class SiteEditor {
  active = false
  working = false
  private selected: BuildingSite | null = null
  private kind: SiteKind = 'home'
  private serial = 0
  constructor(private readonly ports: {
    world(): WorldState; busy(): boolean; emit(ui: SiteUI): void; preview(value: RoomPreview | null): void
    focus(site: BuildingSite): void; request(cell: Cell, kind: 'soil' | 'move', done: () => void): boolean
    cancel(): void; commit(change: SiteChange): void; notify(text: string): void
  }) {}
  refresh(): void {
    const w = this.ports.world(), s = this.selected, built = !!s && siteBuilt(w, s)
    const message = this.working ? '阿土正在清土、布置房间。可以随时停下来。' : s ? siteBlocker(w, s, this.kind) || s.description : '点一个洞室，看看它会变成什么。'
    this.ports.emit({ active: this.active, working: this.working, selected: s?.id ?? null, kind: this.kind,
      name: s?.name ?? '一起把家建起来', icon: s?.icon ?? '🏡', description: s?.description ?? '', message,
      cost: s ? materialText(s.cost) : '', canBuild: !!s && !built && !this.working && !this.ports.busy() && !siteBlocker(w, s, this.kind), built,
      choices: s?.kinds ?? [], sites: BUILDING_SITES.filter(site => siteVisible(w, site)).map(site => ({ id: site.id, name: site.name, icon: site.icon, layer: site.layer, built: siteBuilt(w, site) })),
    })
    this.ports.preview(this.active && s ? { room: siteRoom(s, this.kind), valid: !siteBlocker(w, s, this.kind) || built || this.working, hint: message } : null)
  }
  open(layer: 'home' | 'water' = 'home'): void {
    this.active = true
    const w = this.ports.world(), s = BUILDING_SITES.find(s => s.layer === layer && siteVisible(w, s) && !siteBuilt(w, s))
    if (s) this.select(s.id)
    else { this.selected = null; this.refresh() }
  }
  select(id: string): void {
    if (this.working || this.ports.busy()) return
    const s = siteById(id)
    if (!s || !siteVisible(this.ports.world(), s)) return
    this.active = true; this.selected = s; this.kind = this.ports.world().builtSites.find(b => b.id === id)?.kind ?? s.kinds[0]
    this.ports.focus(s); this.refresh()
  }
  choose(kind: SiteKind): void { if (!this.working && this.selected?.kinds.includes(kind)) { this.kind = kind; this.refresh() } }
  close(): void { this.active = false; this.refresh() }
  cancel(): void {
    this.serial++; const wasWorking = this.working; this.working = false
    if (wasWorking) this.ports.cancel()
    this.refresh()
  }
  build(): void {
    const s = this.selected
    if (!s || this.working || this.ports.busy()) return
    const blocker = siteBlocker(this.ports.world(), s, this.kind)
    if (blocker) { this.ports.notify(blocker); return }
    this.working = true; const token = ++this.serial
    const live = () => this.working && token === this.serial
    const stop = (message: string) => { if (!live()) return; this.working = false; this.refresh(); this.ports.notify(message) }
    const finish = () => {
      if (!live()) return
      const change = finishSite(this.ports.world(), s, this.kind)
      if (!change) { stop(siteBlocker(this.ports.world(), s, this.kind) || '通道还没准备好，点开工可以继续。'); return }
      this.working = false; this.ports.commit(change); this.refresh(); this.ports.notify(`${s.name}建好啦！材料已经用上了。`)
    }
    const step = () => {
      if (!live()) return
      const w = this.ports.world(), next = nextSiteDig(w, s)
      this.refresh()
      if (next) {
        const started = this.ports.request(next, 'soil', step)
        if (!started && live()) stop('阿土暂时够不到这里，已挖的地方和材料都保留。')
        return
      }
      if (siteWorkCells(w, s).some(p => w.tiles[p.y]?.[p.x] !== TILE.EMPTY)) { stop('通路被原来的设施挡住了，先保留它们吧。'); return }
      const started = this.ports.request({ x: s.x, y: s.y + s.h - 1 }, 'move', finish)
      if (!started && live()) stop('这里暂时走不到，先把通道挖通吧。')
    }
    step()
  }
}
