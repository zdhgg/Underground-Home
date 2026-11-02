import { amuJoined, buildDeep, deepActionProblem, deepBuildOptions, deepBuildProblem, deepCandidate, deepCostText, deepFacilityAt, deepGoal, deepReady, deepSuggestion, deepWarmLampPending, DEEP_SPECS, hasDeep, performDeep, type DeepAction, type DeepBuildOption, type DeepChange, type DeepGoal } from '../core/deep'
import { canDig } from '../core/dig'
import { AYAN_SPOT, CRYSTAL_SPOT, DEEP_FOOT, DRILL_SPOT, MOSS_SPOT, deepFrontier, deepShaftCell } from '../core/deepTopology'
import { atuRoute, initialAtuPosition } from '../core/atu'
import { TILE, TILE_SIZE, type Cell, type DeepFacilityKind, type WorkerId, type WorldState } from '../core/world'
import type { PixiWorldRenderer } from '../render/PixiRenderer'
import type { GuideSpot } from '../render/guideFocus'
import { playDeepSound } from '../render/deepSound'

export interface DeepUI {
 finaleLift?:boolean;
  ruinsLift?:boolean;
  ventilationLift?:boolean;
  available: boolean; active: boolean; entered: boolean; completed: boolean; busy: boolean
  /** 面板抬头：目标视图是章节名；选中设施时换成"谁的设施 · 第几层"，读作建筑自己的卡片。 */
  header: string
  title: string; speaker: string; speech: string; label: string; hint: string; done: number
  /** 最近一次动作的可见结果，玩家主动继续后才交给下一目标。 */
  feedback: { icon: string; title: string; detail: string; nextLabel?: string } | null
  /** 选址时点到还没挖开的土后，提供一个明确的“先去挖”出口。 */
  digAvailable: boolean
  digging: boolean
  /** 目标视图可以收起面板让孩子自己去地图上找；只有行动类小步提供这个次入口。 */
  scout: boolean
  /** 本章大目标轨道：当前小步属于第几个里程碑（4 = 全部完成）。 */
  milestone: number
  /** 晶簇发现后亮出"造三层电梯"的大目标横幅。 */
  plan: boolean
  /** 工坊建成后、电梯装好前：面板显示 矿石→金属锭→部件 的活配方链。 */
  chain: boolean
  /** 当前这一步还需要几个部件、为了什么（支撑竖井 / 组装电梯）。 */
  partsNeed: number; partsFor: string
  placing: DeepFacilityKind | null; selected: DeepFacilityKind | null; candidate: number | null; valid: boolean
  choicesOpen: boolean
  /** 建设步骤中可自选的其余设施（含锁定原因）；推荐项仍是唯一主操作。 */
  builds: DeepBuildOption[]
  resources: { crystals: number; ore: number; ingots: number; parts: number }
  buildings: { kind: DeepFacilityKind; built: boolean; name: string; icon: string }[]
  upgrades: { action: DeepAction; label: string; done: boolean }[]
  reservoirLift?: boolean; gardenLift?: boolean; hallLift?: boolean; lift: boolean
}
export const emptyDeepUI = (): DeepUI => ({ available: false, active: false, entered: false, completed: false, busy: false,
  header: '', scout: false,
  title: '', speaker: '', speech: '', label: '', hint: '', done: 0, feedback: null, digAvailable: false, digging: false, milestone: 0, plan: false,
  chain: false, partsNeed: 0, partsFor: '', placing: null, selected: null, candidate: null, valid: false,
  resources: { crystals: 0, ore: 0, ingots: 0, parts: 0 }, buildings: [], upgrades: [], lift: false,
  choicesOpen: false, builds: [],
})
type Choice = { action: DeepAction; label: string } | null

/** 章节会话控制器：真实走位、单一面板和可中断施工；所有结算仍走纯规则。 */
export class DeepChapter {
  private opened = false
  private placing: DeepFacilityKind | null = null
  private selected: DeepFacilityKind | null = null
  private candidate: number | null = null
  private hoverX: number | null = null
  private choicesOpen = false
  private choice: Choice = null
  private feedback: DeepUI['feedback'] = null
  private feedbackSpot: GuideSpot | null = null
  private feedbackAction: DeepAction | null = null
  /** 成果卡的主线移交：本章完成后"下一步"打开下一章，不再指回尾声卡。 */
  private feedbackHandoff: (() => void) | null = null
  private digCell: Cell | null = null
  private digging: DeepFacilityKind | null = null
  /** "我自己去找找"：面板收起、目标继续在地图上发光，点到目标照常交接回面板。 */
  private scouting = false
  private running = false
  private serial = 0
  private timeout: ReturnType<typeof setTimeout> | undefined
  get busy(): boolean { return this.running }
  get active(): boolean { return this.opened }
  /** 正在选址的设施；指针据此变成"可放置"，和前两层的蓝图手感一致。 */
  get placingKind(): DeepFacilityKind | null { return this.placing }
  /** 选址模式覆盖整条建设带；实心格也只显示预览，不触发挖掘。 */
  placingCell(p: Cell | null): boolean {
    return this.placing !== null && !!p && p.y >= 30 && p.y <= 34
  }
  /** 地图悬停提示只在当前任务设施进入选址后出现。 */
  get nextBuild(): DeepFacilityKind | null {
    return this.placing
  }
  constructor(private ports: {
    world(): WorldState; view: PixiWorldRenderer; emit(state: DeepUI): void
    changed(): void; prepare(): void; notify(text: string): void; record(change: DeepChange): void
    dig(cell: Cell, tile: typeof TILE.ROCK): void; milestone(title: string, detail: string): void
    visitHome(podId: number): void
    /** 本章完成后的主线移交：返回全局主线真正的下一目标；没有可移交目标时为 null。 */
    nextMainline?(): { label: string; open(): void } | null
  }) {}
  refresh(): void {
    const w = this.ports.world(), d = w.deep, goal = deepGoal(w)
    let title = goal.title, speaker = goal.speaker, speech = goal.speech, label = goal.label, hint = '', header = '第 3 章 · 晶簇与工坊'
    if (this.selected) {
      const spec = DEEP_SPECS[this.selected]
      title = spec.name; speech = spec.detail; speaker = this.selected === 'workshop' || this.selected === 'furnace' ? '阿木' : this.selected === 'collector' ? '阿岩' : '阿灯'
      header = `${speaker}的${spec.name} · 第 3 层`
      label = this.selected === 'collector' ? '采集晶簇与矿石' : this.selected === 'furnace' ? '矿石 2 → 金属锭 2' : this.selected === 'workshop' ? `金属锭 2 + 晶簇 1 → 部件 ${d.precision ? 2 : 1}` : '看看下一件事'
      hint = this.selected === 'collector'
        ? '本章只需要 1 台；每次可取晶簇 3、矿石 2，还能重复采集。'
        : this.selected === 'workshop' ? '部件用来组装电梯和改进工具。' : '设施留在后侧，前面仍然可以走路。'
    }
    if (this.choice) { title = this.choice.label; label = '确认这次改进'; speech = this.upgradeDescription(this.choice.action); speaker = this.choice.action === 'pickaxe' ? '阿土' : this.choice.action === 'far-light' ? '阿灯' : this.choice.action === 'support' ? '阿岩' : '阿木' }
    if (this.placing) {
      title = `摆放${DEEP_SPECS[this.placing].name}`; speaker = '阿土'; label = '就在这里建造'
      speech = this.placing === 'collector'
        ? '采集台建 1 台就够了，建好后点它取晶簇和矿石。金框是推荐位置，也可以选别处。'
        : '点一处喜欢的岩壁。金框是推荐位置；绿框表示放得下，红框会说明还差什么。'
      hint = this.digCell
        ? '这里还没挖开，先挖开这一格，再回来放设施。'
        : this.candidate === null
        ? `${deepCostText(this.placing)} · ${this.placing === 'collector' ? '本章只需 1 台；' : ''}点空洞放影子；拖动只看地图。`
        : deepBuildProblem(w, this.placing, this.candidate) ?? `${deepCostText(this.placing)} · 可以建在这里。`
    }
    if (this.running) { label = ''; hint = '可以拖图看看，或点“停下来”。'; speech = '伙伴正沿真实通道走过去，动手之后才改变家园。' }
    else if (!this.placing && !this.selected && !this.choice && goal.build) {
      label = `选择位置放置${DEEP_SPECS[goal.build].name}`
      hint = goal.build === 'collector'
        ? '这一步只需要 1 台采集台；按按钮后，地图上的金框是推荐位置。'
        : `这一步先放${DEEP_SPECS[goal.build].name}；地图上的金框是推荐位置，选别处也可以。`
    }
    else if (!this.placing && !this.selected && !this.choice && goal.action) {
      const facility = deepFacilityAt(w, goal.target)
      if (facility) hint = `地图上的${DEEP_SPECS[facility.kind].name}在发光，点它也能开工。`
    }
    if (this.digging) {
      title = `先挖出${DEEP_SPECS[this.digging].name}的空间`
      speaker = '阿土'; speech = '点泥土挖一块，拖动只看地图。挖出三格高的空间后，再回来摆设施。'
      label = `挖好了，继续摆放${DEEP_SPECS[this.digging].name}`
      hint = '挖错可以撤销；设施的位置仍由你决定。'
    }
    // 推荐位只是金色提示框：选址中且还没点候选位时亮出来，点了候选位就交给绿/红框。
    let suggestKind: DeepFacilityKind | null = null
    if (this.opened && !this.running && !this.feedback && !this.digging) {
      if (this.placing && this.candidate === null && this.hoverX === null && !this.digCell) suggestKind = this.placing
      else if (!this.placing && !this.selected && !this.choice && goal.build) suggestKind = goal.build
    }
    this.ports.view.setDeepSuggestion?.(suggestKind, suggestKind ? deepSuggestion(w, suggestKind) : null)
    // 行动类小步在地图上亮出发生地点：目标是已建设施就框整座，其余框目标格；"自己去找"时也留着。
    let focusSpot: GuideSpot | null = null
    if (this.opened && (this.digging || this.placing) && this.digCell) focusSpot = { ...this.digCell, w: 1, h: 1, label: '先挖开这里' }
    else if (this.opened && this.feedback && !this.running && this.feedbackSpot) focusSpot = { ...this.feedbackSpot, label: null }
    else if ((this.opened || this.scouting) && !this.running && !this.placing && !this.selected && !this.choice && goal.action && goal.target) {
      const facility = deepFacilityAt(w, goal.target)
      focusSpot = facility
        ? { x: facility.x, y: 31, w: DEEP_SPECS[facility.kind].width, h: 3 }
        : { x: goal.target.x, y: goal.target.y, w: 1, h: 1 }
    }
    this.ports.view.setGuideFocus?.(this, focusSpot)
    // 影子跟着世界刷新：预览期间挖开/撤销都会让红绿框保持真实状态。
    this.ports.view.setDeepPreview?.(this.digCell ? null : this.placing, this.candidate ?? this.hoverX)
    this.ports.emit({finaleLift:w.finale.liftExtended, ruinsLift:w.ruins.liftExtended, available: deepReady(w), active: this.opened, entered: d.entered, completed: d.completed, busy: this.running,
      header, scout: !this.digging && !this.feedback && !this.running && !this.placing && !this.selected && !this.choice && !!goal.action && !!goal.target,
      title, speaker, speech, label, hint, done: goal.done, feedback: this.feedback, digAvailable: !!this.placing && !!this.digCell, digging: !!this.digging, milestone: goal.milestone, plan: d.foundCrystal,
      chain: amuJoined(w) && !d.lift, partsNeed: d.supported ? 3 : 1, partsFor: d.supported ? '组装电梯' : '支撑竖井',
      placing: this.placing, selected: this.selected,
      candidate: this.candidate, valid: !!this.placing && this.candidate !== null && !deepBuildProblem(w, this.placing, this.candidate),
      choicesOpen: this.choicesOpen,
      builds: goal.build && !this.running && !this.digging ? deepBuildOptions(w).filter(o => o.kind !== goal.build) : [],
      resources: { crystals: d.crystals, ore: d.ore, ingots: d.ingots, parts: d.parts },
      buildings: (Object.keys(DEEP_SPECS) as DeepFacilityKind[]).map(kind => ({ kind, built: hasDeep(w, kind), name: DEEP_SPECS[kind].name, icon: DEEP_SPECS[kind].icon })),
      upgrades: [
        { action: 'precision', label: '精密工具 · 金属锭 1', done: d.precision },
        { action: 'pickaxe', label: '硬岩镐 · 部件 1 + 金属锭 1', done: d.hardPickaxe },
        { action: 'far-light', label: '远光灯 · 部件 1 + 晶簇 1', done: d.farLight },
      ], lift: d.lift, hallLift: w.hall.liftExtended, gardenLift: w.garden.liftExtended, ventilationLift:w.ventilation.liftExtended,reservoirLift: w.reservoir.liftExtended,
    })
  }
  /** 撤销改变了现场时，旧成果说明不能继续留在卡片上。 */
  clearFeedback(): void {
    this.feedback = null; this.feedbackSpot = null; this.feedbackAction = null; this.feedbackHandoff = null
    this.ports.view.clearDeepResult?.()
    this.refresh()
  }
  show(focus = false): void {
    if (this.running) return
    const w = this.ports.world()
    if (!deepReady(w)) { this.ports.notify('先和大家吃完第一顿饭，再来探索晶簇层。'); return }
    this.ports.prepare(); this.opened = true; this.scouting = false; this.selected = null; this.choice = null; this.placing = null; this.digging = null; this.candidate = null; this.hoverX = null; this.digCell = null; this.feedback = null; this.feedbackHandoff = null; this.choicesOpen = false
    this.ports.view.setDeepPreview?.(null, null)
    this.ports.view.clearDeepResult?.()
    if (focus) this.focus(deepGoal(w))
    this.refresh()
  }
  close(): void {
    if (this.opened || this.running) this.ports.view.releaseDeepCamera?.()
    this.opened = false; this.scouting = false; this.placing = null; this.digging = null; this.selected = null; this.candidate = null; this.hoverX = null; this.digCell = null; this.choice = null; this.feedback = null; this.feedbackHandoff = null; this.choicesOpen = false
    this.ports.view.clearDeepResult?.()
    this.ports.view.setDeepPreview?.(null, null); this.refresh()
  }
  /** "我自己去找找"：收起面板，镜头指到这一步发生的地方，目标继续在地图上发光等孩子来点。 */
  scout(): void {
    if (this.running || this.placing || this.selected || this.choice) return
    const goal = deepGoal(this.ports.world())
    if (!goal.action || !goal.target) return
    this.opened = false; this.choicesOpen = false; this.digCell = null; this.scouting = true
    this.focusAt((goal.target.x + .5) * TILE_SIZE, (goal.target.y - 1) * TILE_SIZE)
    this.refresh()
  }
  select(kind: DeepFacilityKind, newPlacement = false): void {
    if (this.running) return
    this.ports.prepare(); this.opened = true; this.scouting = false; this.choice = null; this.digging = null; this.candidate = null; this.hoverX = null; this.digCell = null; this.feedback = null; this.feedbackHandoff = null; this.choicesOpen = false
    this.ports.view.clearDeepResult?.()
    const w = this.ports.world(), facility = newPlacement && kind === 'lamp' ? undefined : w.deep.facilities.find(f => f.kind === kind)
    this.selected = facility ? kind : null; this.placing = facility ? null : kind
    this.ports.view.setDeepPreview?.(null, null)
    if (facility) this.focusAt((facility.x + DEEP_SPECS[kind].width / 2) * TILE_SIZE, 32 * TILE_SIZE)
    else {
      const suggested = deepSuggestion(w, kind)
      if (suggested !== null) this.focusAt((suggested + DEEP_SPECS[kind].width / 2) * TILE_SIZE, 32 * TILE_SIZE)
      else this.ports.view.focusCrystal?.()
    }
    this.refresh()
  }
  selectUpgrade(action: DeepAction, label: string): void {
    if (this.running) return
    this.choice = { action, label }; this.scouting = false; this.placing = null; this.digging = null; this.selected = null; this.hoverX = null; this.digCell = null; this.feedback = null; this.feedbackHandoff = null; this.choicesOpen = true
    this.ports.view.clearDeepResult?.()
    this.ports.view.setDeepPreview?.(null, null); this.opened = true; this.refresh()
  }
  tap(p: Cell): boolean {
    const w = this.ports.world()
    if (!deepReady(w)) return false
    if (this.running) return true
    if (this.digging) return false
    if (this.placing) {
      if (p.y < 30 || p.y > 34) { this.ports.notify('在第 3 层的岩壁上选位置吧。'); return true }
      // 选址和挖掘分成两个明确状态：点到土只留下“先去挖”的出口，不偷偷改变地形。
      if (w.tiles[p.y]?.[p.x] === TILE.SOIL || canDig(w, p.x, p.y).ok) {
        this.digCell = { x: p.x, y: p.y }
        this.candidate = null; this.hoverX = null
        this.ports.view.setDeepPreview?.(null, null); this.refresh(); return true
      }
      this.digCell = null
      this.candidate = deepCandidate(w, this.placing, p.x); this.hoverX = null
      this.ports.view.setDeepPreview?.(this.placing, this.candidate); this.refresh(); return true
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
  /** 退出选址并把玩家交给明确的挖掘模式；不会在这里直接挖土。 */
  dig(): Cell | null {
    if (!this.placing || !this.digCell || this.running) return null
    const target = { ...this.digCell }
    this.digging = this.placing; this.placing = null; this.candidate = null; this.hoverX = null
    this.ports.view.setDeepPreview?.(null, null)
    this.refresh()
    return target
  }
  /** 桌面悬停：影子跟着指针走到吸附位；点下候选位后交给绿/红框，不再跟手。 */
  hover(p: Cell | null): void {
    if (!this.placing || this.running || this.candidate !== null || this.digCell) return
    const x = this.placingCell(p) ? deepCandidate(this.ports.world(), this.placing, p!.x) : null
    if (x === this.hoverX) return
    this.hoverX = x; this.ports.view.setDeepPreview?.(this.placing, x)
    this.ports.view.setDeepSuggestion?.(x === null ? this.placing : null, x === null ? deepSuggestion(this.ports.world(), this.placing) : null)
  }
  primary(): void {
    if (this.running) return
    if (this.digging) { const kind = this.digging; this.select(kind); return }
    if (this.feedback) {
      const action = this.feedbackAction, handoff = this.feedbackHandoff
      this.feedback = null; this.feedbackSpot = null; this.feedbackAction = null; this.feedbackHandoff = null
      this.ports.view.clearDeepResult?.()
      if (action) this.perform(action)
      else if (handoff) { handoff(); this.refresh() }
      else {
        const goal = deepGoal(this.ports.world())
        if (goal.visitPod !== undefined) this.visitHome(goal.visitPod)
        else { this.focus(goal); this.refresh() }
      }
      return
    }
    this.feedback = null
    if (this.placing) {
      if (this.candidate === null) { this.ports.notify('先点地图选一处位置。'); return }
      const kind = this.placing, x = this.candidate, w = this.ports.world()
      const problem = deepBuildProblem(w, kind, x)
      if (problem) { this.ports.notify(problem); return }
      this.focusAt((x + DEEP_SPECS[kind].width / 2) * TILE_SIZE, 32 * TILE_SIZE)
      this.walk({ x, y: DEEP_FOOT }, () => this.workAt('atu', { x, y: DEEP_FOOT }, () => {
        const result = buildDeep(w, kind, x)
        if (result.ok) {
          this.ports.record(result.change)
          const handoff = this.mainlineHandoff()
          this.feedback = { ...this.buildFeedback(kind), nextLabel: handoff?.label ?? (kind === 'collector' ? '试试采集台，取一份材料' : `下一步：${deepGoal(w).title}`) }
          this.feedbackHandoff = handoff?.open ?? null
          this.feedbackSpot = { x, y: 31, w: DEEP_SPECS[kind].width, h: 3 }
          this.feedbackAction = kind === 'collector' ? 'collect' : null
          this.placing = null; this.selected = null; this.candidate = null; this.digCell = null; this.hoverX = null; this.choicesOpen = false
          this.ports.view.setDeepPreview?.(null, null); playDeepSound('build')
          this.ports.view.showDeepResult?.(this.feedbackSpot, this.feedback.title)
        } else this.ports.notify(result.message)
        this.finish()
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
    if (goal.visitPod !== undefined) this.visitHome(goal.visitPod)
    else if (goal.build) this.select(goal.build)
    else if (goal.action) this.perform(goal.action)
  }
  private visitHome(podId: number): void {
    this.close()
    this.ports.visitHome(podId)
  }
  /** 本章完成且没有暖灯交接时，成果卡的"下一步"交给全局主线；否则回到本章尾声卡。 */
  private mainlineHandoff(): { label: string; open(): void } | null {
    const w = this.ports.world()
    if (!w.deep.completed || deepWarmLampPending(w)) return null
    return this.ports.nextMainline?.() ?? null
  }
  private focusAt(x: number, y: number): void {
    if (this.ports.view.focusDeepOn) this.ports.view.focusDeepOn(x, y)
    else this.ports.view.focusOn(x, y, 'building')
  }
  private focus(goal: DeepGoal): void { this.focusAt((goal.target.x + .5) * TILE_SIZE, (goal.target.y - 1) * TILE_SIZE) }
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
  private finish(): void { this.serial++; this.running = false; clearTimeout(this.timeout); this.timeout = undefined; this.choice = null; this.choicesOpen = false; this.ports.changed(); this.refresh() }
  cancel(): void { this.serial++; this.running = false; clearTimeout(this.timeout); this.timeout = undefined; this.ports.view.cancelDeepAnimation?.(); this.ports.changed(); this.refresh() }
  private walk(to: Cell, done: () => void): void {
    const w = this.ports.world(), route = atuRoute(w, w.exploration.explorer ?? initialAtuPosition(w), to, true)
    if (!route) { this.ports.notify('先挖通两格高的路，让伙伴走到这里。'); this.ports.view.focusOn((to.x + .5) * TILE_SIZE, (to.y - 1) * TILE_SIZE, 'building'); return }
    const token = this.begin()
    this.travelAtu(to, route, token, done)
  }
  /** 阿土的走位动画；token 来自 walk/walkTogether 里同一个 begin。 */
  private travelAtu(to: Cell, route: Cell[], token: number, done: () => void): void {
    const w = this.ports.world()
    this.ports.view.playExplorationTravel(route, () => { if (token === this.serial) { w.exploration.explorer = { ...to }; done() } }, p => { if (token === this.serial) { w.exploration.explorer = { ...p }; this.ports.changed() } })
  }
  /** 伙伴站位：优先目标相邻格；shared 时与阿土同站一格（如梯口）。 */
  private partnerStand(id: WorkerId, at: Cell, shared: boolean): Cell {
    const w = this.ports.world(), from = w.workers[id]
    if (shared || !from) return at
    return [{ x: at.x + 1, y: at.y }, { x: at.x - 1, y: at.y }].find(p => atuRoute(w, from, p, true)) ?? at
  }
  private travelPartner(id: WorkerId, route: Cell[], token: number, done: () => void): void {
    const w = this.ports.world()
    this.ports.view.playPartnerTravel(id, route, p => { if (token === this.serial) { w.workers[id] = { ...p }; this.ports.changed() } }, () => { if (token === this.serial) done() })
  }
  private partnerWorks(id: WorkerId, at: Cell, route: Cell[], token: number, done: () => void): void {
    this.ports.view.playPartnerWork({ worker: id, at, route, target: { kind: 'deep-rock', x: at.x, y: at.y + 1 } }, () => {}, () => { if (token === this.serial) done() })
  }
  private workAt(id: 'atu' | WorkerId, at: Cell, done: () => void, shared = false): void {
    const token = this.serial
    if (id === 'atu') { this.ports.view.playAtuWork?.(at, () => { if (token === this.serial) done() }); return }
    const w = this.ports.world(), from = w.workers[id], stand = this.partnerStand(id, at, shared)
    const route = from && atuRoute(w, from, stand, true)
    if (!route) { this.ports.notify('伙伴还走不到这里，先挖通道路。'); this.finish(); return }
    this.travelPartner(id, route, token, () => this.partnerWorks(id, stand, route, token, done))
  }
  /** 阿土和动手的伙伴同时走向现场，两条路都到了伙伴才动手。 */
  private walkTogether(id: WorkerId, at: Cell, done: () => void, shared = false): void {
    const w = this.ports.world(), atuPath = atuRoute(w, w.exploration.explorer ?? initialAtuPosition(w), at, true)
    if (!atuPath) { this.ports.notify('先挖通两格高的路，让伙伴走到这里。'); this.ports.view.focusOn((at.x + .5) * TILE_SIZE, (at.y - 1) * TILE_SIZE, 'building'); return }
    const stand = this.partnerStand(id, at, shared), from = w.workers[id], partnerPath = from && atuRoute(w, from, stand, true)
    if (!partnerPath) { this.ports.notify('伙伴还走不到这里，先挖通道路。'); return }
    const token = this.begin()
    let arrived = 0
    const both = (): void => { if (token === this.serial && ++arrived === 2) this.partnerWorks(id, stand, partnerPath, token, done) }
    this.travelAtu(at, atuPath, token, both)
    this.travelPartner(id, partnerPath, token, both)
  }
  perform(action: DeepAction): void {
    if (this.running) return
    const w = this.ports.world(), problem = deepActionProblem(w, action)
    if (problem) { this.ports.notify(problem); this.refresh(); return }
    this.feedback = null; this.feedbackSpot = null; this.feedbackAction = null; this.feedbackHandoff = null
    if (action === 'excavate') { this.excavate(); return }
    if (action.startsWith('ride-')) { this.ride(action); return }
    const target = action === 'meet' ? { x: AYAN_SPOT.x - 1, y: AYAN_SPOT.y } : action === 'enter' || action === 'support' || action === 'lift' ? { x: w.exploration.shaftX!, y: DEEP_FOOT } : action === 'discover' ? CRYSTAL_SPOT
      : action === 'collect' ? w.deep.facilities.find(f => f.kind === 'collector')! : action === 'smelt' ? w.deep.facilities.find(f => f.kind === 'furnace')! : action === 'far-light' ? w.deep.facilities.find(f => f.kind === 'lamp')! : w.deep.facilities.find(f => f.kind === 'workshop')!
    if (!target) return
    this.ports.view.beginDeepCamera?.()
    this.focusAt((target.x + .5) * TILE_SIZE, (target.y - 1) * TILE_SIZE)
    const actor = action === 'collect' || action === 'support' ? 'ayan' : action === 'far-light' ? 'adeng' : action === 'craft' || action === 'smelt' || action === 'precision' || action === 'pickaxe' || action === 'lift' ? 'amu' : 'atu'
    const settle = (): void => {
      const before = w.deep.completed, result = performDeep(w, action)
      if (result.ok) {
        if (!['meet', 'enter', 'discover'].includes(action)) this.ports.record(result.change)
        this.selected = null
        if (['discover', 'collect', 'smelt', 'craft', 'support', 'lift', 'precision', 'pickaxe', 'far-light'].includes(action)) {
          const handoff = this.mainlineHandoff()
          this.feedback = { ...this.actionFeedback(action, result.message), nextLabel: handoff?.label ?? `下一步：${deepGoal(w).title}` }
          this.feedbackHandoff = handoff?.open ?? null
          const facility = deepFacilityAt(w, target)
          this.feedbackSpot = facility ? { x: facility.x, y: 31, w: DEEP_SPECS[facility.kind].width, h: 3 } : { x: target.x, y: target.y - 2, w: 1, h: 3 }
          this.ports.view.showDeepResult?.(this.feedbackSpot, this.feedback.title)
        }
        playDeepSound(action === 'smelt' ? 'smelt' : action === 'craft' ? 'craft' : action === 'meet' || action === 'discover' ? 'discovery' : 'build')
        if (action === 'meet') this.ports.milestone('认识阿岩啦！', '穿山甲 · 硬岩爪只凿指定的盖层')
        if (action === 'enter') { this.ports.view.finishDeepArrival?.(); this.ports.milestone('第 3 层 · 晶簇层', '晶光、工坊和三层电梯，在这里慢慢建起来') }
        if (!before && w.deep.completed) this.celebrate()
      }
      if (!result.ok || !this.feedback) this.ports.notify(result.message)
      this.finish()
    }
    // 阿土自己动手时才串行；交给伙伴的活，两人一起走过去。
    if (actor === 'atu') this.walk(target, () => this.workAt('atu', target, settle))
    else this.walkTogether(actor, target, settle)
  }
  private buildFeedback(kind: DeepFacilityKind): NonNullable<DeepUI['feedback']> {
    if (kind === 'collector') return { icon: '💎', title: '采集台建好啦', detail: '点它就能取晶簇 3、矿石 2，以后还能再来取。' }
    if (kind === 'distributor') return { icon: '⚡', title: '晶光接通啦', detail: '电线沿着通道亮起来，壁灯和工坊可以工作了。' }
    if (kind === 'lamp') return { icon: '🏮', title: '这一段亮起来啦', detail: '晶光壁灯照亮左右的路，走起来更安心。' }
    if (kind === 'workshop') return { icon: '🔧', title: '阿木来帮忙啦', detail: '现在可以把金属锭和晶簇做成电梯部件。' }
    return { icon: '🔥', title: '小石炉砌好啦', detail: '放进 2 块矿石，就能得到 2 块金属锭。' }
  }
  private actionFeedback(action: DeepAction, message: string): NonNullable<DeepUI['feedback']> {
    if (action === 'discover') return { icon: '✨', title: '晶光找到啦', detail: '晶簇 3、矿石 3 到手，晶根还留在岩壁里。' }
    if (action === 'collect') return { icon: '💎', title: '材料到手啦', detail: '晶簇 +3、矿石 +2，采集台下次还可以再用。' }
    if (action === 'smelt') return { icon: '🔩', title: '金属锭做好啦', detail: '矿石 2 → 金属锭 2，这些金属锭能用来做电梯部件。' }
    if (action === 'craft') return { icon: '🧩', title: '部件做好啦', detail: `金属锭 2 + 晶簇 1 → 部件 ${this.ports.world().deep.precision ? 2 : 1}，用来加固竖井和组装电梯。` }
    if (action === 'support') return { icon: '🪵', title: '竖井撑牢啦', detail: '支撑梁装好了！再备齐 3 个部件，就能组装电梯吊篮。' }
    if (action === 'lift') return { icon: '🛗', title: '吊篮装好啦', detail: '第一次坐电梯回暖窝层，把伙伴和材料一起带回家。' }
    if (action.startsWith('ride-')) return { icon: '🏠', title: '到站啦', detail: '伙伴和材料一起到了，三层家园有了新连接。' }
    if (action === 'meet') return { icon: '🦔', title: '认识阿岩啦', detail: '他会凿开指定的硬岩盖层，帮我们找到下面的新家。' }
    if (action === 'enter') return { icon: '🪜', title: '到晶簇层啦', detail: '沿施工梯下去，就能看到岩壁上的天然晶光。' }
    return { icon: '✨', title: '完成啦', detail: message }
  }
  private excavate(): void {
    const w = this.ports.world(), token = this.begin()
    this.ports.view.beginDeepCamera?.()
    this.focusAt((w.exploration.shaftX! + .5) * TILE_SIZE, 26 * TILE_SIZE)
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
    this.focusAt((shaftX + .5) * TILE_SIZE, (from - 1) * TILE_SIZE)
    this.walkTogether('amu', { x: shaftX, y: from }, () => {
      const token = this.serial
      playDeepSound('lift')
      this.ports.view.playDeepLift?.(from, to, () => {
        if (token !== this.serial) return
        w.exploration.explorer = { x: shaftX, y: to }; w.workers.amu = { x: shaftX, y: to }
        const before = w.deep.completed, result = performDeep(w, action)
        if (result.ok) {
          const next = deepGoal(w), handoff = this.mainlineHandoff()
          this.feedback = {
            ...(!before && w.deep.completed ? { icon: '🛗', title: '三层家园连通啦', detail: '电梯把伙伴送到家啦！以后上下三层，不用再爬长长的梯子。' } : this.actionFeedback(action, result.message)),
            nextLabel: handoff?.label ?? (next.visitPod !== undefined ? next.label : `下一步：${next.title}`),
          }
          this.feedbackHandoff = handoff?.open ?? null
          this.feedbackSpot = { x: shaftX, y: to - 2, w: 1, h: 3 }
          this.ports.view.showDeepResult?.(this.feedbackSpot, this.feedback.title)
          if (!before && w.deep.completed) playDeepSound('chapter')
        } else this.ports.notify(result.message)
        // 阿木实际走出吊篮，和阿土错开一格，避免到站后两位伙伴叠成一个人。
        const exit = [{ x: shaftX - 1, y: to }, { x: shaftX + 1, y: to }].map(p => atuRoute(w, { x: shaftX, y: to }, p, true)).find(r => r !== null)
        if (exit) this.ports.view.playPartnerTravel('amu', exit, p => { if (token === this.serial) { w.workers.amu = { ...p }; this.ports.changed() } }, () => { if (token === this.serial) this.finish() })
        else this.finish()
      })
    }, true)
  }
  private celebrate(): void { playDeepSound('chapter'); this.ports.milestone('第 3 层 · 完成啦！', '晶光亮起来 · 工坊转起来 · 电梯连通三层家园') }
  private upgradeDescription(action: DeepAction): string {
    return action === 'precision' ? '阿木给工作台装一套精密工具。金属锭 1；以后同样材料，每次能做两个部件。'
      : action === 'pickaxe' ? '阿土的新硬岩镐能挖左边指定的小矿脉。部件 1、金属锭 1；整片坚硬基岩仍然保留。'
        : action === 'far-light' ? '阿灯给晶光壁灯加远光镜。部件 1、晶簇 1；从左右各 3 格照到各 6 格，光仍不穿岩石。'
          : action === 'support' ? '阿岩和阿木一起把竖井撑牢。需要部件 1；这是组装三层电梯的准备。' : '组装家园电梯需要部件 3，先安装竖井支撑。'
  }
}
