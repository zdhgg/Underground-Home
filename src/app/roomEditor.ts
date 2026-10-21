import { checkRoom, checkRoomPlan, removeRoom, roomAt, roomFromPoint, roomSummary, ROOM_HINTS, ROOM_MAX_WIDTH, ROOM_NAMES, type RoomChange } from '../core/rooms'
import { canFinishRoom, excavationLeft, finishRoom, planRoom, roomCapacity, ROOM_SPECS } from '../core/roomConstruction'
import { HOME_ROOM_TOP, HOME_FLOOR_Y, type Cell, type Room, type RoomKind, type WorldState } from '../core/world'

export interface RoomUI {
  active: boolean; available: boolean; kind: RoomKind; width: number; minWidth: number; selectedId: number | null
  placed: boolean; valid: boolean; dirty: boolean; message: string; detail: string
  construction: boolean; completed: boolean; action: string; left: number; busy: boolean
  items: { id: number; kind: RoomKind; width: number; name: string; built: boolean }[]
}
export interface RoomPreview { room: Room; valid: boolean; hint: string }

/** 选址草稿可取消；保存蓝图后才进入逐格施工，关闭面板不会丢失蓝图。 */
export class RoomEditor {
  active = false
  private kind: RoomKind = 'home'
  private width = ROOM_SPECS.home.width
  private selectedId: number | null = null
  private point: Cell | null = null
  private editing = true
  private expansionEdge: 'left' | 'right' | null = null
  constructor(private readonly ports: {
    world(): WorldState; emit(state: RoomUI): void; preview(value: RoomPreview | null): void
    commit(change: RoomChange): void; notify(text: string): void
    busy?(): boolean
  }) {}
  private selected(): Room | undefined { return this.ports.world().rooms.find(r => r.id === this.selectedId) }
  private draft(): Room | null {
    if (!this.point) return null
    const original = this.selected()
    if (original && !this.editing) return { ...original }
    const left = this.point.x - Math.floor(this.width / 2)
    const existingBed = !original && this.ports.world().pods.some(p => p.x >= left && p.x + 3 <= left + this.width)
    const lowLegacyRoom = existingBed && Array.from({ length: this.width }, (_, dx) => this.ports.world().tiles[HOME_ROOM_TOP]?.[left + dx] !== 0).some(Boolean)
    const r = roomFromPoint(this.point, this.width, this.kind, original?.status === 'blueprint' ? original.id : 0, original?.h ?? (lowLegacyRoom ? 2 : 3))
    if (original?.status !== 'blueprint' && original) r.replaces = original.id
    else if (original?.replaces) r.replaces = original.replaces
    if (this.point.y < HOME_ROOM_TOP || this.point.y >= HOME_FLOOR_Y) r.y = this.point.y - 2
    return r
  }
  refresh(): void {
    const w = this.ports.world(), draft = this.active ? this.draft() : null, original = this.selected()
    const construction = !!original && original.status === 'blueprint' && !this.editing
    const completed = !!original && original.status !== 'blueprint' && !this.editing
    const check = draft ? (construction ? canFinishRoom(w, draft) : completed ? checkRoom(w, draft) : checkRoomPlan(w, draft)) : null
    const left = draft ? excavationLeft(w, draft) : 0
    const dirty = !!draft && (this.editing || construction)
    const valid = check?.ok === true && !completed && !this.ports.busy?.()
    const message = completed ? '房间已建成。想增加容量，可以向两边扩建。'
      : construction ? left ? `还要挖 ${left} 格。点泥土，阿土会走过去施工；高处用小凳子。` : check?.ok ? '空间挖好并接通啦，可以确认建成！' : check && !check.ok ? ROOM_HINTS[check.reason] : ''
      : !draft ? '先选用途，再点松软泥土或空地放蓝图。' : check && !check.ok ? ROOM_HINTS[check.reason] : '位置可以！放下蓝图后，再一格一格挖。'
    const capacity = draft ? roomCapacity(draft) : roomCapacity(roomFromPoint({ x: 0, y: 11 }, this.width, this.kind))
    const detail = completed && draft ? `${roomSummary(w, draft)}${draft.kind === 'garden' && !w.farm.waterSupplied ? ' · 等小泉接通水源' : ''}`
      : `${this.width}格宽 × ${draft?.h ?? 3}格高 · 最多${capacity}${this.kind === 'garden' && !w.farm.waterSupplied ? ' · 建好后等水' : ''}`
    this.ports.preview(draft ? { room: draft, valid: this.editing ? check?.ok === true : true, hint: message } : null)
    this.ports.emit({ active: this.active, available: w.progress.coreRepaired, kind: this.kind, width: this.width,
      minWidth: original && original.status !== 'blueprint' && this.editing ? original.w + 1 : ROOM_SPECS[this.kind].min,
      selectedId: this.selectedId, placed: !!draft, valid, dirty, message, detail, construction, completed, left,
      busy: this.ports.busy?.() === true, action: construction ? '确认建成' : original?.status === 'blueprint' ? '保存蓝图调整' : original ? '放下扩建蓝图' : '放下蓝图',
      items: w.rooms.map(r => ({ id: r.id, kind: r.kind, width: r.w, name: `${ROOM_NAMES[r.kind]}${r.status === 'blueprint' ? r.replaces ? ' · 扩建中' : ' · 施工中' : ''}`, built: r.status !== 'blueprint' })),
    })
  }
  open(): void { this.active = true; this.newRoom() }
  close(): void { this.active = false; this.point = null; this.selectedId = null; this.refresh() }
  newRoom(): void {
    // 新菜园在第二层用「种植槽」；第一层只保留住处和客厅。
    if (this.kind === 'garden') this.kind = 'home'
    this.point = null; this.selectedId = null; this.editing = true; this.expansionEdge = null; this.width = ROOM_SPECS[this.kind].width; this.refresh()
  }
  chooseKind(kind: RoomKind): void {
    if (!Object.hasOwn(ROOM_SPECS, kind) || this.selected()) return
    this.kind = kind; this.width = ROOM_SPECS[kind].width; this.refresh()
  }
  resize(delta: number): void {
    if (this.ports.busy?.()) return
    const original = this.selected()
    if (original && original.status !== 'blueprint' && original.w >= ROOM_MAX_WIDTH) return
    if (original && original.status !== 'blueprint' && !this.editing) this.expansionEdge = original.x < 17 ? 'right' : 'left'
    const min = original && original.status !== 'blueprint' ? original.w + 1 : ROOM_SPECS[this.kind].min
    const next = original && original.status !== 'blueprint' && !this.editing && delta > 0
      ? this.kind === 'home' ? (Math.floor(original.w / 3) + 1) * 3 : original.w + 2 : this.width + delta
    this.width = Math.max(min, Math.min(ROOM_MAX_WIDTH, next))
    if (original && this.expansionEdge) this.point = { x: (this.expansionEdge === 'right' ? original.x + original.w - this.width : original.x) + Math.floor(this.width / 2), y: HOME_FLOOR_Y - 1 }
    this.editing = true; this.refresh()
  }
  select(id: number): Room | null {
    if (this.ports.busy?.()) return null
    const r = this.ports.world().rooms.find(r => r.id === id)
    if (!r) return null
    // 已有扩建蓝图时，继续那份施工，避免一间房多份扩建相互覆盖。
    const plan = this.ports.world().rooms.find(p => p.replaces === r.id)
    if (plan) return this.select(plan.id)
    this.selectedId = r.id; this.kind = r.kind; this.width = r.w; this.editing = false; this.expansionEdge = null
    this.point = { x: r.x + Math.floor(r.w / 2), y: HOME_FLOOR_Y - 1 }; this.refresh(); return r
  }
  /** 返回 false 时交给真实移动/挖掘输入，蓝图不直接修改任何瓦片。 */
  tap(cell: Cell): boolean {
    if (!this.editing && this.selected()) {
      const room = roomAt(this.ports.world(), cell)
      if (room && room.id !== this.selectedId && !this.ports.busy?.()) { this.select(room.id); return true }
      return false
    }
    if (!this.selectedId) {
      const room = roomAt(this.ports.world(), cell)
      if (room) { this.select(room.id); return true }
    }
    this.expansionEdge = null; this.point = { ...cell }; this.refresh(); return true
  }
  save(): void {
    const draft = this.draft()
    if (!this.active || !draft || this.ports.busy?.()) return
    const construction = this.selected()?.status === 'blueprint' && !this.editing
    const result = construction ? canFinishRoom(this.ports.world(), draft) : checkRoomPlan(this.ports.world(), draft)
    if (!result.ok) { this.ports.notify(ROOM_HINTS[result.reason]); return }
    const change = construction ? finishRoom(this.ports.world(), draft.id) : planRoom(this.ports.world(), draft)
    if (!change) return
    this.selectedId = change.after!.id; this.editing = false
    this.ports.commit(change); this.refresh()
    this.ports.notify(construction ? `${ROOM_NAMES[draft.kind]}建好啦！${draft.kind === 'garden' && !this.ports.world().farm.waterSupplied ? '等小泉接通水源就能种菜。' : '基础设施已经安排好，前侧可以走过去。'}` : '蓝图放好啦！点泥土让阿土施工，随时可以收起面板去探索。')
  }
  remove(): void {
    if (!this.active || this.selectedId === null || this.ports.busy?.() || this.selected()?.status !== 'blueprint') return
    const change = removeRoom(this.ports.world(), this.selectedId)
    if (!change) return
    this.point = null; this.selectedId = null; this.editing = true
    this.ports.commit(change); this.refresh(); this.ports.notify('施工蓝图已取消，挖开的空间和原设施都保留。可以撤销。')
  }
}
