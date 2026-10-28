import { buildDeep, deepActionProblem, deepBuildProblem, deepCostText, deepFacilityAt, deepGoal, deepReady, DEEP_SPECS, hasDeep, performDeep, type DeepAction, type DeepChange, type DeepGoal } from '../core/deep'
import { AYAN_SPOT, CRYSTAL_SPOT, DEEP_FOOT, DRILL_SPOT, MOSS_SPOT, deepFrontier, deepShaftCell } from '../core/deepTopology'
import { atuRoute, initialAtuPosition } from '../core/atu'
import { TILE, TILE_SIZE, type Cell, type DeepFacilityKind, type WorkerId, type WorldState } from '../core/world'
import type { PixiWorldRenderer } from '../render/PixiRenderer'
import { playDeepSound } from '../render/deepSound'

export interface DeepUI {
 finaleLift?:boolean;
  ruinsLift?:boolean;
  ventilationLift?:boolean;
  available: boolean; active: boolean; entered: boolean; completed: boolean; busy: boolean
  title: string; speaker: string; speech: string; label: string; hint: string; done: number
  placing: DeepFacilityKind | null; selected: DeepFacilityKind | null; candidate: number | null; valid: boolean
  choicesOpen: boolean
  resources: { crystals: number; ore: number; ingots: number; parts: number }
  buildings: { kind: DeepFacilityKind; built: boolean; name: string; icon: string }[]
  upgrades: { action: DeepAction; label: string; done: boolean }[]
  reservoirLift?: boolean; gardenLift?: boolean; hallLift?: boolean; lift: boolean
}
export const emptyDeepUI = (): DeepUI => ({ available: false, active: false, entered: false, completed: false, busy: false,
  title: '', speaker: '', speech: '', label: '', hint: '', done: 0, placing: null, selected: null, candidate: null, valid: false,
  resources: { crystals: 0, ore: 0, ingots: 0, parts: 0 }, buildings: [], upgrades: [], lift: false,
  choicesOpen: false,
})
type Choice = { action: DeepAction; label: string } | null

/** 章节会话控制器：真实走位、单一面板和可中断施工；所有结算仍走纯规则。 */
export class DeepChapter {
  private opened = false
  private placing: DeepFacilityKind | null = null
  private selected: DeepFacilityKind | null = null
  private candidate: number | null = null
  private choicesOpen = false
  private choice: Choice = null
  private running = false
  private serial = 0
  private timeout: ReturnType<typeof setTimeout> | undefined
  get busy(): boolean { return this.running }
  get active(): boolean { return this.opened }
  /** 正在选址的设施；指针据此变成"可放置"，和前两层的蓝图手感一致。 */
  get placingKind(): DeepFacilityKind | null { return this.placing }
  /** 地图悬停提示只在当前任务设施进入选址后出现。 */
  get nextBuild(): DeepFacilityKind | null {
    return this.placing
  }
  constructor(private ports: {
    world(): WorldState; view: PixiWorldRenderer; emit(state: DeepUI): void
    changed(): void; prepare(): void; notify(text: string): void; record(change: DeepChange): void
    dig(cell: Cell, tile: typeof TILE.ROCK): void; milestone(title: string, detail: string): void
  }) {}
  refresh(): void {
    const w = this.ports.world(), d = w.deep, goal = deepGoal(w)
    let title = goal.title, speaker = goal.speaker, speech = goal.speech, label = goal.label, hint = ''
    if (this.selected) {
      const spec = DEEP_SPECS[this.selected]
      title = spec.name; speech = spec.detail; speaker = this.selected === 'workshop' || this.selected === 'furnace' ? '阿木' : this.selected === 'collector' ? '阿岩' : '阿灯'
      label = this.selected === 'collector' ? '采集晶簇与矿石' : this.selected === 'furnace' ? '矿石 2 → 金属锭 2' : this.selected === 'workshop' ? `金属锭 2 + 晶簇 1 → 部件 ${d.precision ? 2 : 1}` : '看看下一件事'
      hint = this.selected === 'collector'
        ? '本章只需要 1 台；每次可取晶簇 3、矿石 2，还能重复采集。'
        : this.selected === 'workshop' ? '部件用来组装电梯和改进工具。' : '设施留在后侧，前面仍然可以走路。'
    }
    if (this.choice) { title = this.choice.label; label = '确认这次改进'; speech = this.upgradeDescription(this.choice.action); speaker = this.choice.action === 'pickaxe' ? '阿土' : this.choice.action === 'far-light' ? '阿灯' : this.choice.action === 'support' ? '阿岩' : '阿木' }
    if (this.placing) {
      title = `摆放${DEEP_SPECS[this.placing].name}`; speaker = '阿土'; label = '就在这里建造'
      speech = this.placing === 'collector'
        ? '采集台建 1 台就够了。建好后点它取晶簇和矿石；先选一处你喜欢的岩壁。'
        : '点一处喜欢的岩壁。绿框表示放得下，红框会说明还差什么。'
      hint = this.candidate === null
        ? `${deepCostText(this.placing)} · ${this.placing === 'collector' ? '本章只需 1 台；' : ''}拖动只看地图，点一下才选位置。`
        : deepBuildProblem(w, this.placing, this.candidate) ?? `${deepCostText(this.placing)} · 可以建在这里。`
    }
    if (this.running) { label = ''; hint = '可以拖图看看，或点“停下来”。'; speech = '伙伴正沿真实通道走过去，动手之后才改变家园。' }
    else if (!this.placing && !this.selected && !this.choice && goal.build) {
      label = `选择位置放置${DEEP_SPECS[goal.build].name}`
      hint = goal.build === 'collector'
        ? '这一步只需要 1 台采集台；按按钮后，在地图上选一处喜欢的岩壁。'
        : `这一步先放${DEEP_SPECS[goal.build].name}，位置由你决定。`
    }
    this.ports.emit({finaleLift:w.finale.liftExtended, ruinsLift:w.ruins.liftExtended, available: deepReady(w), active: this.opened, entered: d.entered, completed: d.completed, busy: this.running,
      title, speaker, speech, label, hint, done: goal.done, placing: this.placing, selected: this.selected,
      candidate: this.candidate, valid: !!this.placing && this.candidate !== null && !deepBuildProblem(w, this.placing, this.candidate),
      choicesOpen: this.choicesOpen,
      resources: { crystals: d.crystals, ore: d.ore, ingots: d.ingots, parts: d.parts },
      buildings: (Object.keys(DEEP_SPECS) as DeepFacilityKind[]).map(kind => ({ kind, built: hasDeep(w, kind), name: DEEP_SPECS[kind].name, icon: DEEP_SPECS[kind].icon })),
      upgrades: [
        { action: 'precision', label: '精密工具 · 金属锭 1', done: d.precision },
        { action: 'pickaxe', label: '硬岩镐 · 部件 1 + 金属锭 1', done: d.hardPickaxe },
        { action: 'far-light', label: '远光灯 · 部件 1 + 晶簇 1', done: d.farLight },
        { action: 'support', label: '竖井支撑 · 部件 1', done: d.supported },
      ], lift: d.lift, hallLift: w.hall.liftExtended, gardenLift: w.garden.liftExtended, ventilationLift:w.ventilation.liftExtended,reservoirLift: w.reservoir.liftExtended,
    })
  }
  show(focus = false): void {
    if (this.running) return
    const w = this.ports.world()
    if (!deepReady(w)) { this.ports.notify('先和大家吃完第一顿饭，再来探索晶簇层。'); return }
    this.ports.prepare(); this.opened = true; this.selected = null; this.choice = null; this.placing = null; this.candidate = null; this.choicesOpen = false
    this.ports.view.setDeepPreview?.(null, null)
    if (focus) this.focus(deepGoal(w))
    this.refresh()
  }
  close(): void {
    if (this.opened || this.running) this.ports.view.releaseDeepCamera?.()
    this.opened = false; this.placing = null; this.candidate = null; this.choice = null; this.choicesOpen = false
    this.ports.view.setDeepPreview?.(null, null); this.refresh()
  }
  select(kind: DeepFacilityKind, newPlacement = false): void {
    if (this.running) return
    this.ports.prepare(); this.opened = true; this.choice = null; this.candidate = null; this.choicesOpen = false
    const w = this.ports.world(), facility = newPlacement && kind === 'lamp' ? undefined : w.deep.facilities.find(f => f.kind === kind)
    this.selected = facility ? kind : null; this.placing = facility ? null : kind
    this.ports.view.setDeepPreview?.(null, null)
    if (facility) this.ports.view.focusOn((facility.x + DEEP_SPECS[kind].width / 2) * TILE_SIZE, 32 * TILE_SIZE, 'building')
    else this.ports.view.focusCrystal?.()
    this.refresh()
  }
  selectUpgrade(action: DeepAction, label: string): void {
    if (this.running) return
    this.choice = { action, label }; this.placing = null; this.selected = null; this.choicesOpen = true
    this.ports.view.setDeepPreview?.(null, null); this.opened = true; this.refresh()
  }
  tap(p: Cell): boolean {
    const w = this.ports.world()
    if (!deepReady(w)) return false
    if (this.running) return true
    if (this.placing) {
      if (p.y < 30 || p.y > 34) { this.ports.notify('在第 3 层的岩壁上选位置吧。'); return true }
      this.candidate = p.x; this.ports.view.setDeepPreview?.(this.placing, this.candidate); this.refresh(); return true
    }
    if (!w.deep.metAyan && Math.abs(p.x - AYAN_SPOT.x) <= 1 && p.y >= 19 && p.y <= 21) { this.show(); return true }
    if (deepShaftCell(w, p.x, p.y)) { this.show(); return true }
    if (w.deep.entered && p.y >= 31 && p.y <= 33) {
      const facility = deepFacilityAt(w, p)
      if (facility) { this.select(facility.kind); return true }
      if (p.x === CRYSTAL_SPOT.x) { this.show(); if (!w.deep.foundCrystal) this.perform('discover'); else this.ports.notify('天然晶根留在岩壁上，去采集台取材料吧。'); return true }
      if (p.y === DEEP_FOOT && (p.x === MOSS_SPOT.x || p.x === DRILL_SPOT.x)) {
        if (w.tiles[33][p.x] !== TILE.EMPTY) return false
        const moss = p.x === MOSS_SPOT.x, key = moss ? 'foundMoss' : 'foundDrill'
        if (!w.deep[key]) { w.deep[key] = true; playDeepSound('discovery'); this.ports.changed() }
        this.ports.notify(moss ? '发现晶苔：它贴着潮湿岩壁，把一点点晶光留成了紫色的小星星。' : '发现旧钻头：螺纹已经磨圆。以前的伙伴也曾在这里修工具、把家往下建。')
        return true
      }
      // 尚未进入当前设施的选址时，空洞点击继续交给自由挖掘。
    }
    return false
  }
  primary(): void {
    if (this.running) return
    if (this.placing) {
      if (this.candidate === null) { this.ports.notify('先点地图选一处位置。'); return }
      const kind = this.placing, x = this.candidate, w = this.ports.world()
      const problem = deepBuildProblem(w, kind, x)
      if (problem) { this.ports.notify(problem); return }
      this.walk({ x, y: DEEP_FOOT }, () => this.workAt('atu', { x, y: DEEP_FOOT }, () => {
        const result = buildDeep(w, kind, x)
        if (result.ok) { this.ports.record(result.change); this.placing = null; this.selected = null; this.candidate = null; this.choicesOpen = false; this.ports.view.setDeepPreview?.(null, null); playDeepSound('build'); if (kind === 'workshop') this.ports.milestone('阿木来帮忙啦！', '松鼠工匠 · 金属锭与晶光能变成部件') }
        this.ports.notify(result.message); this.finish()
      })); return
    }
    if (this.choice) { this.perform(this.choice.action); return }
    if (this.selected) {
      const action = this.selected === 'collector' ? 'collect' : this.selected === 'furnace' ? 'smelt' : this.selected === 'workshop' ? 'craft' : null
      if (action) this.perform(action)
      else { this.selected = null; this.refresh() }
      return
    }
    const goal = deepGoal(this.ports.world())
    if (goal.build) this.select(goal.build)
    else if (goal.action) this.perform(goal.action)
  }
  private focus(goal: DeepGoal): void { this.ports.view.focusOn((goal.target.x + .5) * TILE_SIZE, (goal.target.y - 1) * TILE_SIZE, 'building') }
  private begin(): number {
    this.running = true; const token = ++this.serial
    const started = Date.now(); let frame = this.ports.view.frames, lastFrameAt = started
    const check = () => {
      if (token !== this.serial) return
      const now = Date.now(), nextFrame = this.ports.view.frames
      if (nextFrame !== frame) { frame = nextFrame; lastFrameAt = now }
      if (now - started >= 30000 || typeof frame === 'number' && now - lastFrameAt >= 3000) {
        this.cancel(); this.ports.notify('动作先停下来了，再点一次就能接着做。'); return
      }
      this.timeout = setTimeout(check, Math.min(800, 30000 - (now - started)))
    }
    clearTimeout(this.timeout); this.timeout = setTimeout(check, 800)
    this.refresh(); return token
  }
  private finish(): void { this.serial++; this.running = false; clearTimeout(this.timeout); this.timeout = undefined; this.choice = null; this.ports.changed(); this.refresh() }
  cancel(): void { this.serial++; this.running = false; clearTimeout(this.timeout); this.timeout = undefined; this.ports.view.cancelDeepAnimation?.(); this.ports.changed(); this.refresh() }
  private walk(to: Cell, done: () => void): void {
    const w = this.ports.world(), route = atuRoute(w, w.exploration.explorer ?? initialAtuPosition(w), to, true)
    if (!route) { this.ports.notify('先挖通两格高的路，让伙伴走到这里。'); this.ports.view.focusOn((to.x + .5) * TILE_SIZE, (to.y - 1) * TILE_SIZE, 'building'); return }
    const token = this.begin()
    this.ports.view.playExplorationTravel(route, () => { if (token === this.serial) { w.exploration.explorer = { ...to }; done() } }, p => { if (token === this.serial) { w.exploration.explorer = { ...p }; this.ports.changed() } })
  }
  private workAt(id: 'atu' | WorkerId, at: Cell, done: () => void, shared = false): void {
    const token = this.serial
    if (id === 'atu') { done(); return }
    const w = this.ports.world(), from = w.workers[id]
    if (!shared && from) {
      const beside = [{ x: at.x + 1, y: at.y }, { x: at.x - 1, y: at.y }].find(p => atuRoute(w, from, p, true))
      if (beside) at = beside
    }
    const route = from && atuRoute(w, from, at, true)
    if (!route) { this.ports.notify('伙伴还走不到这里，先挖通道路。'); this.finish(); return }
    this.ports.view.playPartnerTravel(id, route, p => { if (token === this.serial) { w.workers[id] = { ...p }; this.ports.changed() } }, () => {
      if (token !== this.serial) return
      this.ports.view.playPartnerWork({ worker: id, at, route, target: { kind: 'deep-rock', x: at.x, y: at.y + 1 } }, () => {}, () => { if (token === this.serial) done() })
    })
  }
  perform(action: DeepAction): void {
    if (this.running) return
    const w = this.ports.world(), problem = deepActionProblem(w, action)
    if (problem) { this.ports.notify(problem); this.refresh(); return }
    if (action === 'excavate') { this.excavate(); return }
    if (action.startsWith('ride-')) { this.ride(action); return }
    const target = action === 'meet' ? { x: AYAN_SPOT.x - 1, y: AYAN_SPOT.y } : action === 'enter' ? { x: w.exploration.shaftX!, y: DEEP_FOOT } : action === 'discover' ? CRYSTAL_SPOT
      : action === 'collect' ? w.deep.facilities.find(f => f.kind === 'collector')! : action === 'smelt' ? w.deep.facilities.find(f => f.kind === 'furnace')! : action === 'far-light' ? w.deep.facilities.find(f => f.kind === 'lamp')! : w.deep.facilities.find(f => f.kind === 'workshop')!
    if (!target) return
    this.ports.view.beginDeepCamera?.()
    this.ports.view.focusOn((target.x + .5) * TILE_SIZE, (target.y - 1) * TILE_SIZE, 'building')
    this.walk(target, () => {
      const actor = action === 'collect' || action === 'support' ? 'ayan' : action === 'far-light' ? 'adeng' : action === 'craft' || action === 'smelt' || action === 'precision' || action === 'pickaxe' || action === 'lift' ? 'amu' : 'atu'
      this.workAt(actor, target, () => {
        const before = w.deep.completed, result = performDeep(w, action)
        if (result.ok) {
          if (!['meet', 'enter', 'discover'].includes(action)) this.ports.record(result.change)
          this.selected = null
          playDeepSound(action === 'smelt' ? 'smelt' : action === 'craft' ? 'craft' : action === 'meet' || action === 'discover' ? 'discovery' : 'build')
          if (action === 'meet') this.ports.milestone('认识阿岩啦！', '穿山甲 · 硬岩爪只凿指定的盖层')
          if (action === 'enter') { this.ports.view.finishDeepArrival?.(); this.ports.milestone('第 3 层 · 晶簇层', '晶光、工坊和三层电梯，在这里慢慢建起来') }
          if (!before && w.deep.completed) this.celebrate()
        }
        this.ports.notify(result.message); this.finish()
      })
    })
  }
  private excavate(): void {
    const w = this.ports.world(), token = this.begin()
    this.ports.view.beginDeepCamera?.()
    this.ports.view.focusOn((w.exploration.shaftX! + .5) * TILE_SIZE, 26 * TILE_SIZE, 'building')
    const next = (): void => {
      if (token !== this.serial) return
      const target = deepFrontier(w)
      if (!target) { this.ports.milestone('晶纹盖层凿通啦！', '施工梯已接到晶簇洞 · 准备下去看看'); playDeepSound('discovery'); this.finish(); return }
      const at = { x: target.x, y: target.y - 1 }, from = w.workers.ayan, route = from && atuRoute(w, from, at, true)
      if (!route) { this.ports.notify('先挖通梯口上方两格高的通道。'); this.finish(); return }
      this.ports.view.playPartnerTravel('ayan', route, p => { if (token === this.serial) { w.workers.ayan = { ...p }; this.ports.changed() } }, () => {
        if (token !== this.serial) return
        this.ports.view.playPartnerWork({ worker: 'ayan', at, route, target: { kind: 'deep-rock', ...target } }, () => {
          if (token !== this.serial || w.tiles[target.y][target.x] === TILE.EMPTY) return
          w.tiles[target.y][target.x] = TILE.EMPTY; w.dugCount++
          this.ports.dig(target, TILE.ROCK); playDeepSound('chisel'); this.ports.changed()
        }, next)
      })
    }
    next()
  }
  private ride(action: DeepAction): void {
    const w = this.ports.world(), shaftX = w.exploration.shaftX!, from = w.exploration.explorer?.y === 11 ? 11 : w.exploration.explorer?.y === 21 ? 21 : (w.exploration.explorer?.y ?? 0) >= 95 ? 106 : (w.exploration.explorer?.y ?? 0) >= 83 ? 94 : (w.exploration.explorer?.y ?? 0) >= 71 ? 82 : (w.exploration.explorer?.y ?? 0) >= 59 ? 70 : (w.exploration.explorer?.y ?? 0) >= 47 ? 58 : (w.exploration.explorer?.y ?? 0) >= 34 ? 46 : DEEP_FOOT
    const to = action === 'ride-home' ? 11 : action === 'ride-water' ? 21 : action === 'ride-hall' ? 46 : action === 'ride-garden' ? 58 : action === 'ride-finale' ? 106 : action === 'ride-ruins' ? 94 : action === 'ride-ventilation' ? 82 : action === 'ride-reservoir' ? 70 : DEEP_FOOT
    this.walk({ x: shaftX, y: from }, () => this.workAt('amu', { x: shaftX, y: from }, () => {
      const token = this.serial
      playDeepSound('lift')
      this.ports.view.playDeepLift?.(from, to, () => {
        if (token !== this.serial) return
        w.exploration.explorer = { x: shaftX, y: to }; w.workers.amu = { x: shaftX, y: to }
        const before = w.deep.completed, result = performDeep(w, action)
        this.ports.notify(result.message)
        if (!before && w.deep.completed) this.celebrate()
        // 阿木实际走出吊篮，和阿土错开一格，避免到站后两位伙伴叠成一个人。
        const exit = [{ x: shaftX - 1, y: to }, { x: shaftX + 1, y: to }].map(p => atuRoute(w, { x: shaftX, y: to }, p, true)).find(r => r !== null)
        if (exit) this.ports.view.playPartnerTravel('amu', exit, p => { if (token === this.serial) { w.workers.amu = { ...p }; this.ports.changed() } }, () => { if (token === this.serial) this.finish() })
        else this.finish()
      })
    }, true))
  }
  private celebrate(): void { playDeepSound('chapter'); this.ports.milestone('第 3 层 · 完成啦！', '晶光亮起来 · 工坊转起来 · 电梯连通三层家园') }
  private upgradeDescription(action: DeepAction): string {
    return action === 'precision' ? '阿木给工作台装一套精密工具。金属锭 1；以后同样材料，每次能做两个部件。'
      : action === 'pickaxe' ? '阿土的新硬岩镐能挖左边指定的小矿脉。部件 1、金属锭 1；整片坚硬基岩仍然保留。'
        : action === 'far-light' ? '阿灯给晶光壁灯加远光镜。部件 1、晶簇 1；从左右各 3 格照到各 6 格，光仍不穿岩石。'
          : action === 'support' ? '阿岩和阿木一起把竖井撑牢。需要部件 1；这是组装三层电梯的准备。' : '组装家园电梯需要部件 3，先安装竖井支撑。'
  }
}
