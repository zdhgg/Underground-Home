import { buildHall, hallActionProblem, hallBuildProblem, hallCostText, hallFacility, hallFacilityAt, hallGoal, hallReady, HALL_SPECS, performHall, planHallGathering, type HallAction, type HallChange } from '../core/hall'
import { HALL_FOOT, MURAL_SPOT, WARM_LIGHT_SPOT, hallFrontier, hallShaftCell } from '../core/hallTopology'
import { atuRoute, initialAtuPosition } from '../core/atu'
import { settledPartners } from '../core/partners'
import { TILE, TILE_SIZE as T, type Cell, type HallFacilityKind, type WorkerId, type WorldState } from '../core/world'
import type { PixiWorldRenderer } from '../render/PixiRenderer'
import { playHallSound } from '../render/hallSound'

export interface HallUI {
 finaleLift?:boolean;
  ruinsLift?:boolean;
  ventilationLift?:boolean;
  available: boolean; active: boolean; busy: boolean; entered: boolean; completed: boolean; celebrating: boolean
  title: string; speaker: string; speech: string; label: string; hint: string; done: number
  placing: HallFacilityKind | null; candidate: number | null; valid: boolean; selected: HallFacilityKind | null
  reservoirLift?: boolean; gardenLift?: boolean; beds: number; food: number; lift: boolean; parts: number; crystals: number
  album: { title: string; detail: string }[]; page: number
  buildings: { kind: HallFacilityKind; name: string; built: boolean }[]
}
export const emptyHallUI = (): HallUI => ({ available: false, active: false, busy: false, entered: false, completed: false, celebrating: false, title: '', speaker: '', speech: '', label: '', hint: '', done: 0, placing: null, candidate: null, selected: null, valid: false, beds: 0, food: 0, lift: false, parts: 0, crystals: 0, album: [], page: 0, buildings: [] })

/** 单一关注对象：目标／选址／当前设施／施工／庆典依次替换。 */
export class HallChapter {
  private opened = false
  private placing: HallFacilityKind | null = null
  private selected: HallFacilityKind | null = null
  private candidate: number | null = null
  private running = false
  private celebrating = false
  private page = 0
  private serial = 0
  private timeout: ReturnType<typeof setTimeout> | undefined
  get busy(): boolean { return this.running }
  get active(): boolean { return this.opened }
  constructor(private ports: { world(): WorldState; view: PixiWorldRenderer; emit(s: HallUI): void; prepare(): void; changed(): void; notify(s: string): void; record(c: HallChange): void; dig(p: Cell): void; milestone(title: string, detail: string): void }) {}
  refresh(): void {
    const w = this.ports.world(), h = w.hall, goal = hallGoal(w)
    let { title, speaker, speech, label } = goal, hint = ''
    if (this.selected) { title = HALL_SPECS[this.selected].name; speech = HALL_SPECS[this.selected].detail; speaker = '阿土'; label = '看看下一件事' }
    if (this.selected === 'hall' && h.tableReady) { label = '邀请大家来暖屋'; hint = hallActionProblem(w, 'feast') ?? '六个座位各不相同，大家会沿真实通路过来。' }
    if (this.placing) { title = `摆放${HALL_SPECS[this.placing].name}`; speaker = '阿土'; speech = '点岩壁选择位置。绿框能建，红框会告诉你还差什么；拖动只移动地图。'; label = '就在这里建造'; hint = this.candidate === null ? hallCostText(this.placing) : hallBuildProblem(w, this.placing, this.candidate) ?? `${hallCostText(this.placing)} · 这里放得下` }
    if (!this.placing && !this.selected && goal.action) hint = hallActionProblem(w, goal.action) ?? ''
    if (this.celebrating) { title = '六个人，一个暖暖的家'; speaker = '阿土'; speech = '阿灯举起小灯，小满端来蔬菜汤，大家都给自己的新家留了一份回忆。这里是第四章的庆典，九层旅途还在继续。'; label = '继续建设我们的家'; hint = '暖屋宴已记入家园相册，随时可以再聚一桌。' }
    if (this.running) { label = ''; hint = '拖图可以看看现场，点“停下来”会保留已完成的部分。'; speech = '伙伴沿通道走到现场，动手完成后才会扣材料、改变家园。' }
    const album = [
      ...(w.progress.coreRepaired ? [{ title: '第一盏灯', detail: '我们找到能源石，把旧避难所照亮。阿土和阿灯有了第一个家。' }] : []),
      ...(w.exploration.springFound ? [{ title: '泉水滴答响', detail: '凿通裂纹梯道，找到小泉和清水，第二层有了新的朋友。' }] : []),
      ...(w.farm.sharedMeals > 0 ? [{ title: '第一顿围坐饭', detail: '小满种的菜变成热饭。灶台和餐桌，让泉边也有了生活。' }] : []),
      ...(w.deep.batches > 0 ? [{ title: '工坊叮叮当', detail: '阿岩带我们找到晶簇，阿木把金属锭和晶光做成了部件。' }] : []),
      ...(h.liftExtended ? [{ title: '四层连成一个家', detail: '新支撑托稳旧梁，电梯再下一站。每一层的家都还在。' }] : []),
      ...(h.muralFound ? [{ title: '岩壁上的旧壁画', detail: '很久以前，也有伙伴沿着一盏小灯向下建家。旧故事和我们的新故事相遇了。' }] : []),
      ...(w.reservoir.hallDeliveries>0?[{title:'清水沿回廊回家',detail:'河狸团团筑起管渠，小泉把清水送到暖光大厅，长桌旁多了一瓶清水。'}]:[]),
      ...(w.garden.harvests > 0 ? [{ title: '菌光里的新朋友', detail: '蜗牛苔苔铺好菌毯，小满收下一篮菌伞。第五层的收成连回了老家。' }] : []),
      ...(h.feasts > 0 ? [{ title: '六个人的暖屋宴', detail: `六位伙伴都走到桌边，吃了暖暖的一餐。我们已经聚过 ${h.feasts} 桌啦。` }] : []),
    ]
    if(w.ruins.completed)album.push({title:'旧故事和新家',detail:'九位伙伴修复灯、水和共同建造三段岩画，又添上今天的家。第八层留下新的回忆，地心的暖光还在前方。'})
    if(w.finale.completed)album.push({title:'九层家园的暖屋日',detail:'九位伙伴沿亲手开出的通道到齐，把花园的收成、回廊的清水和工区的风铃聚成一桌。终章完成，家还可以继续建。'})
    this.page = Math.max(0, Math.min(this.page, album.length - 1))
    if(w.ventilation.gifts>0)album.push({title:'听见家园的风',detail:`铃铃与阿木的${w.ventilation.hallArt==='mobile'?'叶片风饰':'铜管风铃'}挂进大厅。风从第七层连回九位伙伴的家。`})
    this.ports.emit({finaleLift:w.finale.liftExtended, ruinsLift:w.ruins.liftExtended, available: hallReady(w), active: this.opened, busy: this.running, entered: h.entered, completed: h.completed, celebrating: this.celebrating, title, speaker, speech, label, hint, done: goal.done, placing: this.placing, selected: this.selected, candidate: this.candidate, valid: this.placing !== null && this.candidate !== null && !hallBuildProblem(w, this.placing, this.candidate), beds: settledPartners(w), food: w.farm.food, parts: w.deep.parts, crystals: w.deep.crystals, lift: h.liftExtended, gardenLift: w.garden.liftExtended, ventilationLift:w.ventilation.liftExtended,reservoirLift: w.reservoir.liftExtended, album, page: this.page, buildings: (Object.keys(HALL_SPECS) as HallFacilityKind[]).map(kind => ({ kind, name: HALL_SPECS[kind].name, built: !!hallFacility(w, kind) })) })
  }
  show(focus = false): void {
    if (this.running || !hallReady(this.ports.world())) return
    this.ports.prepare(); this.opened = true; this.selected = null; this.placing = null; this.candidate = null
    this.ports.view.setHallPreview?.(null, null)
    if (focus) { const p = hallGoal(this.ports.world()).target; this.ports.view.focusOn((p.x + .5) * T, (p.y - 1) * T, 'building') }
    this.refresh()
  }
  close(): void {
    if (this.running) this.cancel()
    this.opened = false; this.placing = null; this.selected = null; this.candidate = null; this.celebrating = false
    this.ports.view.setHallPreview?.(null, null); this.ports.view.releaseDeepCamera?.(); this.ports.view.finishMealGather?.(); this.refresh()
  }
  albumPage(delta: number): void { this.page += delta; this.refresh() }
  select(kind: HallFacilityKind): void {
    if (this.running) return
    this.show(); const w = this.ports.world(), f = kind === 'nest' && settledPartners(w) < 6 ? undefined : hallFacility(w, kind)
    this.selected = f ? kind : null; this.placing = f ? null : kind; this.candidate = null
    const p = f ?? { x: w.exploration.shaftX ?? 27, y: HALL_FOOT }
    this.ports.view.focusOn((p.x + (f ? HALL_SPECS[kind].width / 2 : .5)) * T, (HALL_FOOT - 1) * T, 'building'); this.refresh()
  }
  tap(p: Cell): boolean {
    const w = this.ports.world()
    if (!hallReady(w)) return false
    if (this.running) return true
    if (this.placing) {
      if (p.y < 42 || p.y > 47) { this.ports.notify('在第 4 层的岩壁上选择位置吧。'); return true }
      this.candidate = p.x; this.ports.view.setHallPreview?.(this.placing, p.x); this.refresh(); return true
    }
    if (!w.hall.entered && hallShaftCell(w, p.x, p.y)) { this.show(); return true }
    if (w.hall.entered) {
      const f = hallFacilityAt(w, p)
      if (f) { this.select(f.kind); return true }
      if (p.y === HALL_FOOT && w.tiles[p.y][p.x] === TILE.EMPTY && (p.x === MURAL_SPOT.x || p.x === WARM_LIGHT_SPOT.x)) {
        const key = p.x === MURAL_SPOT.x ? 'muralFound' : 'warmLightFound'
        if (!w.hall[key]) { w.hall[key] = true; playHallSound('memory'); this.ports.changed() }
        this.ports.notify(key === 'muralFound' ? '旧壁画里，六个小伙伴围着一盏灯。原来以前也有人在这里建家。' : '石缝里留着旧灯芯。暖光从小小一束，慢慢连成了家。'); return true
      }
    }
    return false
  }
  primary(): void {
    if (this.running) return
    if (this.celebrating) { this.close(); return }
    const w = this.ports.world()
    if (this.placing) {
      if (this.candidate === null) return
      const kind = this.placing, x = this.candidate, problem = hallBuildProblem(w, kind, x)
      if (problem) { this.ports.notify(problem); return }
      this.walk({ x, y: HALL_FOOT }, () => this.work('atu', { x, y: HALL_FOOT }, () => {
        const result = buildHall(w, kind, x)
        if (result.ok) { this.ports.record(result.change); this.placing = null; this.candidate = null; this.ports.view.setHallPreview?.(null, null); this.ports.view.refresh(); playHallSound('build') }
        this.ports.notify(result.message); this.finish()
      })); return
    }
    if (this.selected) {
      if (this.selected === 'hall' && w.hall.tableReady) this.perform('feast')
      else { this.selected = null; this.refresh() }
      return
    }
    const g = hallGoal(w)
    if (g.build) this.select(g.build)
    else if (g.action) this.perform(g.action)
  }
  private begin(): number {
    this.running = true; const token = ++this.serial, start = Date.now()
    let frame = this.ports.view.frames, last = start
    const check = () => {
      if (token !== this.serial) return
      const now = Date.now(), next = this.ports.view.frames
      if (next !== frame) { frame = next; last = now }
      if (now - start >= 45000 || typeof frame === 'number' && now - last >= 3000) { this.cancel(); this.ports.notify('动作先停下来啦，再点一次就能继续。'); return }
      this.timeout = setTimeout(check, 800)
    }
    clearTimeout(this.timeout); this.timeout = setTimeout(check, 800); this.refresh(); return token
  }
  private finish(): void { ++this.serial; this.running = false; clearTimeout(this.timeout); this.ports.changed(); this.refresh() }
  cancel(): void { ++this.serial; this.running = false; clearTimeout(this.timeout); this.ports.view.cancelDeepAnimation?.(); this.ports.view.cancelMealGather?.(); this.ports.changed(); this.refresh() }
  private walk(to: Cell, done: () => void): void {
    const w = this.ports.world(), route = atuRoute(w, w.exploration.explorer ?? initialAtuPosition(w), to, true)
    if (!route) { this.ports.notify('先挖通两格高的通道。'); return }
    const token = this.begin()
    this.ports.view.playExplorationTravel(route, () => { if (token === this.serial) { w.exploration.explorer = { ...to }; done() } }, p => { if (token === this.serial) { w.exploration.explorer = { ...p }; this.ports.changed() } })
  }
  private work(id: 'atu' | WorkerId, at: Cell, done: () => void): void {
    const w = this.ports.world(), token = this.serial
    if (id === 'atu') { this.ports.view.playHallWork(at, () => { if (token === this.serial) done() }); return }
    const from = w.workers[id], route = from && atuRoute(w, from, at, true)
    if (!route) { this.ports.notify('伙伴还走不到施工点，先接通梯口。'); this.finish(); return }
    this.ports.view.playPartnerTravel(id, route, p => { if (token === this.serial) { w.workers[id] = { ...p }; this.ports.changed() } }, () => {
      if (token === this.serial) this.ports.view.playPartnerWork({ worker: id, at, route, target: { kind: 'deep-rock', x: at.x, y: at.y + 1 } }, () => {}, () => { if (token === this.serial) done() })
    })
  }
  perform(action: HallAction): void {
    if (this.running) return
    const w = this.ports.world(), problem = hallActionProblem(w, action)
    if (problem) { this.ports.notify(problem); this.refresh(); return }
    if (action === 'excavate') { this.excavate(); return }
    if (action === 'feast') { this.feast(); return }
    const at = action === 'table' ? hallFacility(w, 'hall')! : { x: w.exploration.shaftX!, y: ['inspect', 'brace'].includes(action) ? 33 : HALL_FOOT }
    this.ports.view.beginDeepCamera?.(); this.ports.view.focusOn((at.x + .5) * T, (at.y - 1) * T, 'building')
    this.walk(at, () => this.work(action === 'brace' ? 'ayan' : action === 'extend' || action === 'table' ? 'amu' : action === 'power' ? 'adeng' : 'atu', at, () => {
      const result = performHall(w, action)
      if (result.ok) { if (!['inspect', 'enter'].includes(action)) this.ports.record(result.change); playHallSound(action === 'inspect' ? 'creak' : action === 'brace' ? 'brace' : action === 'power' ? 'light' : 'build'); if (action === 'enter') this.ports.milestone('第 4 层 · 暖光大厅', '自由选择大厅位置，给六位伙伴留一个相聚的地方') }
      this.ports.notify(result.message); this.finish()
    }))
  }
  private excavate(): void {
    const w = this.ports.world(), token = this.begin()
    const next = (): void => {
      if (token !== this.serial) return
      const target = hallFrontier(w)
      if (!target) { this.ports.milestone('旧大厅梯道凿通啦！', '新支撑已经装牢，沿施工梯下去看看'); this.finish(); return }
      const at = { x: target.x, y: target.y - 1 }, from = w.workers.ayan, route = from && atuRoute(w, from, at, true)
      if (!route) { this.ports.notify('先把梯口两格高的路接通。'); this.finish(); return }
      this.ports.view.playPartnerTravel('ayan', route, p => { if (token === this.serial) { w.workers.ayan = { ...p }; this.ports.changed() } }, () => {
        if (token !== this.serial) return
        this.ports.view.playPartnerWork({ worker: 'ayan', at, route, target: { kind: 'deep-rock', ...target } }, () => {
          if (token !== this.serial || w.tiles[target.y][target.x] === TILE.EMPTY) return
          w.tiles[target.y][target.x] = TILE.EMPTY; w.dugCount++; this.ports.dig(target); playHallSound('brace'); this.ports.changed()
        }, next)
      })
    }
    next()
  }
  private feast(): void {
    const w = this.ports.world(), plan = planHallGathering(w)
    if (!plan) return
    this.selected = null; this.ports.view.focusOn((hallFacility(w, 'hall')!.x + 4) * T, 45 * T, 'building')
    const token = this.begin()
    this.ports.view.playExplorationTravel(plan.atu, () => {
      if (token !== this.serial) return
      w.exploration.explorer = { ...plan.atu.at(-1)! }; this.ports.changed()
      this.ports.view.playMealGather(plan.moves, () => {
        if (token !== this.serial) return
        const result = performHall(w, 'feast')
        if (result.ok) { for (const move of plan.moves) w.workers[move.id] = { ...move.seat }; this.celebrating = true; playHallSound('feast'); this.ports.view.playMealCelebration(); this.ports.milestone('第 4 章 · 暖屋宴', '六位伙伴到齐，四层家园亮着暖光。九层的故事仍在继续。') }
        this.ports.notify(result.message); this.finish()
      })
    }, p => { if (token === this.serial) { w.exploration.explorer = { ...p }; this.ports.changed() } })
  }
}
