import { ChapterJourney } from './chapterJourney'
import { buildGarden, changeGardenVariety, gardenActionProblem, gardenBed, gardenBedProblem, gardenBuildProblem, gardenCostText, gardenFacility, gardenFacilityAt, gardenGoal, gardenReady, gardenWeavePath, GARDEN_SPECS, performGarden, type GardenAction, type GardenChange } from '../core/garden'
import { GARDEN_FOOT, ROOT_SPOT, SPORE_SPOT, TAITAI_SPOT, gardenFrontier, gardenShaftCell } from '../core/gardenTopology'
import { partnerBed } from '../core/partners'
import { TILE, TILE_SIZE as T, type Cell, type GardenFacilityKind, type WorldState } from '../core/world'
import type { PixiWorldRenderer } from '../render/PixiRenderer'
import { playGardenSound } from '../render/gardenSound'

export interface GardenUI {
 finaleLift?:boolean;
  ruinsLift?:boolean;
  ventilationLift?:boolean;
  available: boolean; active: boolean; entered: boolean; busy: boolean; completed: boolean; celebrating: boolean; joined: boolean
  title: string; speaker: string; speech: string; label: string; hint: string; done: number
  placing: GardenFacilityKind | null; selected: GardenFacilityKind | null; candidate: number | null; valid: boolean
  selectedX: number | null; growth: number; variety: 'bell' | 'fan'; canChangeVariety: boolean; needsWeave: boolean
  reservoirLift?:boolean; irrigation?:number; food: number; harvests: number; trail: number; lift: boolean; bedded: boolean
  buildings: { kind: GardenFacilityKind; name: string; count: number }[]
}
export const emptyGardenUI = (): GardenUI => ({ available: false, active: false, entered: false, busy: false, completed: false, celebrating: false, joined: false, title: '', speaker: '', speech: '', label: '', hint: '', done: 0, placing: null, selected: null, candidate: null, selectedX: null, valid: false, growth: 0, variety: 'bell', canChangeVariety: false, needsWeave: false, food: 0, harvests: 0, trail: 0, lift: false, bedded: false, buildings: [] })
export class GardenChapter {
  private opened = false
  private placing: GardenFacilityKind | null = null
  private selected: GardenFacilityKind | null = null
  private selectedX: number | null = null
  private candidate: number | null = null
  private celebrating = false
  private readonly journey: ChapterJourney
  get busy(): boolean { return this.journey.busy }
  get active(): boolean { return this.opened }
  constructor(private p: { world(): WorldState; view: PixiWorldRenderer; emit(s: GardenUI): void; changed(): void; prepare(): void; notify(s: string): void; record(c: GardenChange): void; dig(p: Cell): void; milestone(title: string, detail: string): void }) {
    this.journey = new ChapterJourney({ ...p, refresh: () => this.refresh() })
  }
  refresh(): void {
    const w = this.p.world(), g = w.garden, goal = gardenGoal(w), bed = this.selected === 'bed' ? gardenBed(w, this.selectedX ?? undefined) : gardenBed(w)
    let { title, speaker, speech, label } = goal, hint = goal.action ? gardenActionProblem(w, goal.action) ?? '' : ''
    const path = bed && gardenWeavePath(w, bed), needsWeave = !!bed && (!path || !path.every(x => g.trail.includes(x)))
    if (this.selected) {
      title = GARDEN_SPECS[this.selected].name; speech = GARDEN_SPECS[this.selected].detail; speaker = this.selected === 'rill' ? '小泉' : this.selected === 'bed' ? '小满' : this.selected === 'lamp' ? '阿灯' : '苔苔'; label = '看看下一件事'; hint = ''
      if (this.selected === 'bed' && bed) { label = needsWeave ? '请苔苔铺菌毯' : bed.growth === 2 ? '请小满收获菌伞' : '请小满照料一次'; hint = needsWeave ? gardenActionProblem(w, 'weave', bed.x) ?? '菌毯会沿实际空洞连到这张菌床。' : gardenBedProblem(w, bed) ?? ['菌苗等着照料', '小芽长出来啦', '菌伞展开，可以收获啦'][bed.growth ?? 0] }
      if (this.selected === 'bench') label = '到长椅边歇一歇'
    }
    if (this.selected==='bed'&&w.reservoir.irrigation>0&&bed?.growth!==2) hint += ` · 回廊清水还有 ${w.reservoir.irrigation} 次，本次照料能直接展开。`
    if (this.placing) { title = `摆放${GARDEN_SPECS[this.placing].name}`; speaker = '阿土'; speech = '点一处喜欢的岩壁选位置。绿框能建，红框会说明原因。拖动只移动地图。'; label = '就在这里建造'; hint = this.candidate === null ? gardenCostText(this.placing) : gardenBuildProblem(w, this.placing, this.candidate) ?? `${gardenCostText(this.placing)} · 可以建在这里` }
    if (this.celebrating) { title = '一条菌光路，一个新朋友'; speaker = '苔苔'; speech = '小满留下菌根，小泉引来清水，阿灯点亮小灯，我们用菌丝把它们连成了花园。楼上的家也能吃到这里的收成啦！'; label = '继续布置菌光花园'; hint = '第五章完成；可以继续种菌、扩建和回家聚餐。' }
    if (this.busy) { label = ''; speech = '伙伴沿真实通道到现场，完成动作后才改变花园。'; hint = '可以拖图看看；停下来会保留已经完成的部分。' }
    this.p.emit({ available: gardenReady(w), active: this.opened, entered: g.entered, busy: this.busy, completed: g.completed, celebrating: this.celebrating, joined: g.metTaitai, title, speaker, speech, label, hint, done: goal.done,
      placing: this.placing, selected: this.selected, candidate: this.candidate, selectedX: this.selectedX, valid: this.placing !== null && this.candidate !== null && !gardenBuildProblem(w, this.placing, this.candidate),
      growth: bed?.growth ?? 0, variety: bed?.variety ?? 'bell', canChangeVariety: this.selected === 'bed' && !!g.harvests && bed?.growth === 0, needsWeave, ventilationLift:w.ventilation.liftExtended,reservoirLift:w.reservoir.liftExtended,irrigation:w.reservoir.irrigation,food: w.farm.food, harvests: g.harvests, trail: g.trail.length, lift: g.liftExtended, bedded: !!partnerBed(w, 'taitai'),
      buildings: (Object.keys(GARDEN_SPECS) as GardenFacilityKind[]).map(kind => ({ kind, name: GARDEN_SPECS[kind].name, count: g.facilities.filter(f => f.kind === kind).length })),
    })
  }
  show(focus = false): void {
    if (this.busy || !gardenReady(this.p.world())) return
    this.p.prepare(); this.opened = true; this.placing = null; this.selected = null; this.selectedX = null; this.candidate = null; this.celebrating = false; this.p.view.setGardenPreview?.(null, null)
    if (focus) { const target = gardenGoal(this.p.world()).target; this.p.view.focusOn((target.x + .5) * T, (target.y - 1) * T, 'building') }
    this.refresh()
  }
  close(): void {
    if (this.busy) this.journey.cancel()
    this.opened = false; this.placing = null; this.selected = null; this.selectedX = null; this.candidate = null; this.celebrating = false
    this.p.view.setGardenPreview?.(null, null); this.p.view.releaseDeepCamera?.(); this.refresh()
  }
  cancel(): void { this.journey.cancel() }
  select(kind: GardenFacilityKind, x?: number, add = false): void {
    if (this.busy) return
    this.show(); const w = this.p.world(), f = add ? undefined : w.garden.facilities.find(f => f.kind === kind && (x === undefined || f.x === x))
    this.selected = f ? kind : null; this.selectedX = f?.x ?? null; this.placing = f ? null : kind
    const target = f ?? { x: w.exploration.shaftX ?? 27, y: GARDEN_FOOT }
    this.p.view.focusOn((target.x + 1.5) * T, 57 * T, 'building'); this.refresh()
  }
  tap(cell: Cell): boolean {
    const w = this.p.world()
    if (!gardenReady(w)) return false
    if (this.busy) return true
    if (this.placing) { if (cell.y < 55 || cell.y > 59) { this.p.notify('在第 5 层的岩壁上选位置吧。'); return true }; this.candidate = cell.x; this.p.view.setGardenPreview?.(this.placing, cell.x); this.refresh(); return true }
    if (!w.garden.entered && gardenShaftCell(w, cell.x, cell.y) || w.garden.entered && !w.garden.metTaitai && cell.y >= 56 && cell.y <= 58 && Math.abs(cell.x - TAITAI_SPOT.x) <= 1) { this.show(); return true }
    const f = gardenFacilityAt(w, cell)
    if (f) { this.select(f.kind, f.x); return true }
    if (w.garden.entered && cell.y === GARDEN_FOOT && w.tiles[cell.y][cell.x] === TILE.EMPTY && [SPORE_SPOT.x, ROOT_SPOT.x].includes(cell.x)) {
      const key = cell.x === SPORE_SPOT.x ? 'foundSpores' : 'foundRoot'
      if (!w.garden[key]) { w.garden[key] = true; this.p.changed(); playGardenSound('discovery') }
      this.p.notify(key === 'foundSpores' ? '发现孢子云：小小的光点在菌伞旁打转，像岩洞里的星尘。' : '发现根须印：石壁里留下很久以前的根，像一张弯弯曲曲的家园地图。'); return true
    }
    return false
  }
  primary(): void {
    if (this.busy) return
    if (this.celebrating) { this.close(); return }
    const w = this.p.world()
    if (this.placing) {
      if (this.candidate === null) return
      const kind = this.placing, x = this.candidate, problem = gardenBuildProblem(w, kind, x)
      if (problem) { this.p.notify(problem); return }
      this.journey.run({ x, y: GARDEN_FOOT }, kind === 'rill' ? 'xiaoquan' : kind === 'lamp' ? 'adeng' : 'atu', () => {
        const r = buildGarden(w, kind, x)
        if (r.ok) { this.p.record(r.change); this.placing = null; this.candidate = null; this.p.view.setGardenPreview?.(null, null); this.p.view.refresh(); playGardenSound('build') }
        this.p.notify(r.message); this.journey.finish()
      }); return
    }
    if (this.selected) {
      if (this.selected === 'bed') { const bed = gardenBed(w, this.selectedX!); if (bed) { const path = gardenWeavePath(w, bed); this.perform(!path || !path.every(x => w.garden.trail.includes(x)) ? 'weave' : bed.growth === 2 ? 'harvest' : 'care', bed.x) } }
      else if (this.selected === 'bench') this.perform('rest')
      else { this.selected = null; this.selectedX = null; this.refresh() }
      return
    }
    const goal = gardenGoal(w)
    if (goal.build) this.select(goal.build, undefined, ['bed', 'lamp', 'nest'].includes(goal.build))
    else if (goal.action) this.perform(goal.action)
  }
  changeVariety(): void {
    if (this.busy || this.selected !== 'bed' || this.selectedX === null) return
    const r = changeGardenVariety(this.p.world(), this.selectedX)
    if (r.ok) { this.p.record(r.change); this.p.changed(); playGardenSound('sprout') }
    this.p.notify(r.message); this.refresh()
  }
  perform(action: GardenAction, x?: number): void {
    if (this.busy) return
    const w = this.p.world(), problem = gardenActionProblem(w, action, x)
    if (problem) { this.p.notify(problem); this.refresh(); return }
    if (action === 'excavate') { this.journey.excavate(() => gardenFrontier(w), p => { this.p.dig(p); playGardenSound('chisel') }, () => this.p.milestone('通到菌光洞啦！', '排水槽和施工梯都准备好啦')); return }
    const at = action === 'meet' ? { x: TAITAI_SPOT.x - 1, y: TAITAI_SPOT.y } : ['weave', 'care', 'harvest', 'walk'].includes(action) ? gardenBed(w, x)! : action === 'rest' ? gardenFacility(w, 'bench')! : { x: w.exploration.shaftX!, y: ['inspect', 'drain'].includes(action) ? 46 : GARDEN_FOOT }
    this.p.view.beginDeepCamera?.(); this.p.view.focusOn((at.x + .5) * T, (at.y - 1) * T, 'building')
    const finish = () => {
      const r = performGarden(w, action, x)
      if (r.ok) {
        if (!['inspect', 'enter', 'meet', 'walk', 'rest'].includes(action)) this.p.record(r.change)
        playGardenSound(action === 'harvest' ? 'harvest' : action === 'care' ? 'sprout' : action === 'weave' ? 'weave' : action === 'walk' ? 'chapter' : 'discovery')
        if (action === 'meet') { this.p.changed(); this.p.view.refresh(); this.p.milestone('苔苔来帮忙啦！', '蜗牛 · 铺菌毯，让小灯的光沿菌丝传过去') }
        if (action === 'enter') this.p.milestone('第 5 层 · 菌光花园', '滴答的清水、发光的菌伞，还有一位新朋友')
        if (action === 'walk') { this.celebrating = true; this.p.milestone('第 5 章 · 菌光成园', '苔苔住下啦 · 花园的收成连回楼上的家') }
        if (!this.selected) this.selectedX = null
      }
      this.p.notify(r.message); this.journey.finish()
    }
    if (action === 'walk') {
      const rill = gardenFacility(w, 'rill')!
      this.journey.begin(); this.journey.moveAtu(rill, () => this.journey.moveAtu(at, () => this.journey.moveWorker('taitai', { x: at.x + 1, y: 58 }, () => this.journey.moveWorker('xiaoman', { x: at.x + 2, y: 58 }, finish)))); return
    }
    if (action === 'weave') {
      const path = gardenWeavePath(w, gardenBed(w, x)!)!
      this.journey.begin(); this.journey.moveAtu(at, () => this.journey.moveWorker('taitai', { x: path[0], y: 58 }, () => this.journey.work('taitai', { x: path.at(-1)!, y: 58 }, finish))); return
    }
    this.journey.run(at, action === 'drain' ? 'xiaoquan' : action === 'extend' ? 'amu' : action === 'care' || action === 'harvest' ? 'xiaoman' : 'atu', finish)
  }
}
