import { describe, expect, it, vi } from 'vitest'
import { createInitialWorld, TILE, WORLD_VERSION, type Room } from '../src/core/world'
import { checkRoom, checkRoomPlan, removeRoom, roomFromPoint } from '../src/core/rooms'
import { activateGardens, canFinishRoom, excavationLeft, finishRoom, planRoom, roomCapacity } from '../src/core/roomConstruction'
import { atuCanStand, atuRoute, initialAtuPosition, soilPlan } from '../src/core/atu'
import { dig } from '../src/core/dig'
import { createWorldHistory } from '../src/core/history'
import { canRestoreDig } from '../src/core/build'
import { deserialize, serialize } from '../src/core/persistence'
import { RoomEditor, type RoomUI } from '../src/app/roomEditor'

function powered() {
  const w = createInitialWorld()
  w.progress = { coreRepaired: true, crystalFound: true, crystalCollected: true }
  w.tiles[9][14] = TILE.EMPTY
  w.exploration.explorer = initialAtuPosition(w)
  return w
}
const blueprint = (x = 12, width = 3, kind: Room['kind'] = 'home') => roomFromPoint({ x: x + Math.floor(width / 2), y: 11 }, width, kind)
function clear(w: ReturnType<typeof powered>, r: Room) {
  for (let x = r.x; x < r.x + r.w; x++) for (let y = r.y; y < r.y + r.h; y++) w.tiles[y][x] = TILE.EMPTY
}

describe('功能先行的房间建设', () => {
  it('蓝图可以覆盖软土，保存/取消不挖土、不送设施，编号不复用', () => {
    const w = powered(), before = structuredClone(w), history = createWorldHistory()
    expect(checkRoom(w, blueprint()).ok).toBe(false)
    const change = planRoom(w, blueprint())!; history.record({ kind: 'room', change })
    expect(w.tiles).toEqual(before.tiles); expect(w.pods).toEqual([])
    expect(excavationLeft(w, w.rooms[0])).toBe(8)
    expect(finishRoom(w, 1)).toBeNull()
    const cancelled = removeRoom(w, 1)!; history.record({ kind: 'room', change: cancelled })
    expect(w.tiles).toEqual(before.tiles)
    history.undo(w); expect(w.rooms[0].status).toBe('blueprint')
    history.undo(w); expect(w.rooms).toEqual([])
    expect(planRoom(w, blueprint())!.after!.id).toBe(2)
  })

  it('阿土按真实站位逐格挖三格高蓝图，高处用凳子；挖完才生成床位和可穿行通道', () => {
    const w = powered(), r = planRoom(w, blueprint())!.after!
    const lifts: number[] = []
    for (const x of [14, 13, 12]) for (const y of [11, 10, 9]) {
      if (w.tiles[y][x] === TILE.EMPTY) continue
      const plan = soilPlan(w, w.exploration.explorer!, { x, y })
      expect(plan.ok, `reachable ${x},${y}`).toBe(true)
      if (!plan.ok) return
      lifts.push(plan.plan.lift); w.exploration.explorer = { ...plan.plan.stand }
      expect(dig(w, x, y).ok).toBe(true)
      expect(w.pods).toEqual([])
    }
    expect(lifts).toContain(1); expect(excavationLeft(w, r)).toBe(0)
    const finish = finishRoom(w, r.id)!
    expect(finish.after).toMatchObject({ managed: true })
    expect(w.pods).toHaveLength(1); expect(w.pods[0].backWall).toBe(true)
    expect(atuCanStand(w, { x: 13, y: 11 })).toBe(true)
    expect(atuRoute(w, { x: 18, y: 11 }, { x: 12, y: 11 })?.at(-1)).toEqual({ x: 12, y: 11 })
    expect(deserialize(serialize(w)).ok).toBe(true)
  })

  it('允许规划远处软土，但没接通两格高走道不能建成；不穿一格缝或岩石', () => {
    const w = powered(), r = planRoom(w, blueprint(29, 5, 'garden'))!.after!
    clear(w, r)
    expect(finishRoom(w, r.id)).toBeNull()
    for (let x = 26; x <= 28; x++) w.tiles[11][x] = TILE.EMPTY
    expect(finishRoom(w, r.id)).toBeNull()
    for (let x = 26; x <= 28; x++) w.tiles[10][x] = TILE.EMPTY
    expect(finishRoom(w, r.id)).not.toBeNull()
    expect(atuRoute(w, { x: 18, y: 11 }, { x: 35, y: 11 })).toBeNull()
    expect(planRoom(w, blueprint(1))).toBeNull()
    expect(checkRoomPlan(w, blueprint(15))).toMatchObject({ ok: false, reason: 'reserved' })
  })

  it('扩建保留原房间与设施，完工才增加容量，撤销只撤新增部分', () => {
    const w = powered(), r = planRoom(w, blueprint())!.after!
    clear(w, r); finishRoom(w, r.id)
    const original = structuredClone(w.rooms[0]), oldPods = structuredClone(w.pods), history = createWorldHistory()
    const plan = planRoom(w, { ...blueprint(9, 6), replaces: original.id })!.after!
    expect(w.rooms).toContainEqual(original); expect(w.pods).toEqual(oldPods)
    expect(roomCapacity(plan)).toBe('4个床位')
    clear(w, plan)
    const done = finishRoom(w, plan.id)!
    history.record({ kind: 'room', change: done })
    expect(w.rooms).toHaveLength(1); expect(w.rooms[0].id).toBe(original.id)
    expect(w.pods).toHaveLength(2); expect(w.pods[0]).toEqual(oldPods[0])
    expect(atuRoute(w, { x: 18, y: 11 }, { x: 9, y: 11 })).not.toBeNull()
    expect(deserialize(serialize(w)).ok).toBe(true)
    history.undo(w)
    expect(w.rooms).toContainEqual(original); expect(w.rooms).toContainEqual(plan)
    expect(w.pods).toEqual(oldPods); expect(w.tiles[10][9]).toBe(TILE.EMPTY)
    expect(deserialize(serialize(w)).ok).toBe(true)
  })

  it('不允许缩小、改扩建用途、重叠、同一房间多份扩建；取消不拆原房间', () => {
    const w = powered(), r = planRoom(w, blueprint())!.after!
    clear(w, r); finishRoom(w, r.id)
    const old = structuredClone(w.rooms[0])
    expect(planRoom(w, { ...blueprint(12), replaces: old.id })).toBeNull()
    expect(planRoom(w, { ...blueprint(9, 6, 'garden'), replaces: old.id })).toBeNull()
    const p = planRoom(w, { ...blueprint(9, 6), replaces: old.id })!.after!
    expect(planRoom(w, { ...blueprint(8, 7), replaces: old.id })).toBeNull()
    removeRoom(w, p.id); expect(w.rooms).toEqual([old]); expect(w.pods).toHaveLength(1)
  })

  it('干种植区先建成，接水才启用；重复接水不重复菜槽，不重置旧苗或食物', () => {
    const w = powered(); for (let x = 7; x <= 14; x++) for (let y = 9; y <= 11; y++) w.tiles[y][x] = TILE.EMPTY
    const p = planRoom(w, blueprint(7, 5, 'garden'))!.after!
    finishRoom(w, p.id)
    expect(w.farm.planters).toEqual([]); expect(activateGardens(w)).toBe(0)
    w.farm.waterSupplied = true
    expect(activateGardens(w)).toBe(2)
    w.farm.planters[0].growth = 2; w.farm.food = 3; w.farm.harvests = 4
    const before = structuredClone(w.farm)
    expect(activateGardens(w)).toBe(0); expect(w.farm).toEqual(before)
  })

  it('旧设施必须保留，不能确认一个没有空间安置基础设施的空功能房间', () => {
    const w = powered(), r = blueprint(); clear(w, r)
    w.farm.planters.push({ id: 1, x: 13, y: 11, growth: 2 })
    const p = planRoom(w, r)!.after!, before = structuredClone(w)
    expect(canFinishRoom(w, p)).toEqual({ ok: false, reason: 'layout' })
    expect(finishRoom(w, p.id)).toBeNull(); expect(w).toEqual(before)
    removeRoom(w, p.id); w.farm.planters = []
    const home = planRoom(w, r)!.after!; finishRoom(w, home.id)
    expect(removeRoom(w, home.id)).toBeNull()
    // 保留一张历史独立睡眠舱作为第二个兼容场景。
    w.rooms = []
    const garden = planRoom(w, { ...r, kind: 'garden' })!.after!
    expect(canFinishRoom(w, garden)).toEqual({ ok: false, reason: 'layout' })
    expect(w.farm.waterSupplied).toBe(false)
  })

  it('先建房后接水的自动菜槽也可随房间撤销，水与已收获食物保留', () => {
    const w = powered(); for (let x = 7; x <= 14; x++) for (let y = 9; y <= 11; y++) w.tiles[y][x] = TILE.EMPTY
    const p = planRoom(w, blueprint(7, 5, 'garden'))!.after!, history = createWorldHistory()
    history.record({ kind: 'room', change: finishRoom(w, p.id)! })
    w.farm.waterSupplied = true; activateGardens(w)
    expect(w.farm.planters).toHaveLength(2)
    w.farm.food = 3; w.farm.harvests = 2
    expect(history.undo(w)?.kind).toBe('room')
    expect(w.rooms[0].status).toBe('blueprint'); expect(w.farm.planters).toHaveLength(0)
    expect(w.farm.waterSupplied).toBe(true); expect(w.farm.food).toBe(3); expect(w.farm.harvests).toBe(2)
  })

  it('旧床纳入房间后角色可从前侧经过，撤销不能把人物困回实体床，走开后可重试', () => {
    const w = powered(), r = blueprint(), history = createWorldHistory(); clear(w, r)
    w.pods.push({ id: 1, x: 12, y: 10, door: 'right' })
    const p = planRoom(w, r)!.after!
    history.record({ kind: 'room', change: finishRoom(w, p.id)! })
    w.exploration.explorer = { x: 13, y: 11 }
    expect(history.undo(w)).toBeNull(); expect(w.rooms[0].managed).toBe(true)
    expect(deserialize(serialize(w)).ok).toBe(true)
    w.exploration.explorer = { x: 18, y: 11 }
    expect(history.undo(w)?.kind).toBe('room'); expect(w.rooms[0].status).toBe('blueprint')
    expect(deserialize(serialize(w)).ok).toBe(true)
  })

  it('蓝图内的误挖可撤销，已建房间和旧作物不会被填土；完工撤销不回滚资源', () => {
    const w = powered(), r = planRoom(w, blueprint())!.after!, history = createWorldHistory()
    clear(w, r); expect(canRestoreDig(w, 12, 9)).toBe(true)
    const done = finishRoom(w, r.id)!; history.record({ kind: 'room', change: done })
    expect(canRestoreDig(w, 12, 9)).toBe(false)
    w.farm.food = 9; w.farm.harvests = 5
    history.undo(w)
    expect(w.rooms[0].status).toBe('blueprint'); expect(w.pods).toEqual([])
    expect(w.farm.food).toBe(9); expect(w.farm.harvests).toBe(5)
    w.farm.planters.push({ id: 1, x: 12, y: 11, growth: 2 })
    expect(canRestoreDig(w, 12, 11)).toBe(false)
  })

  it('蓝图与完工状态严格保存；v11原设施、作物和地形原样保留', () => {
    const w = powered(); planRoom(w, blueprint())
    const payload = serialize(w), loaded = deserialize(payload)
    expect(payload.version).toBe(WORLD_VERSION); expect(loaded.ok && loaded.world).toEqual(w)
    for (const mutate of [
      (p: typeof payload) => { p.world.rooms[0].status = 'finished' as 'blueprint' },
      (p: typeof payload) => { p.world.rooms[0].managed = true },
      (p: typeof payload) => { p.world.rooms[0].replaces = 99 },
      (p: typeof payload) => { p.world.rooms[0].x = 0 },
    ]) { const bad = structuredClone(payload); mutate(bad); expect(deserialize(bad).ok).toBe(false) }
    const legacy = serialize(powered()); legacy.version = 11
    const migrated = deserialize(legacy)
    expect(migrated.ok && serialize(migrated.world).world).toEqual(legacy.world)
  })

  it('面板按功能设置默认宽度与容量，关闭保留蓝图；施工点击交给阿土，施工中不能确认', () => {
    const w = powered(), states: RoomUI[] = []; let busy = false
    const editor = new RoomEditor({ world: () => w, emit: s => states.push(s), preview: vi.fn(), commit: vi.fn(), notify: vi.fn(), busy: () => busy })
    editor.open(); editor.chooseKind('garden'); expect(states.at(-1)?.width).toBe(5)
    editor.chooseKind('lounge'); expect(states.at(-1)?.minWidth).toBe(4)
    editor.chooseKind('home'); editor.tap({ x: 13, y: 11 }); editor.save()
    expect(states.at(-1)).toMatchObject({ construction: true, valid: false, left: 8 })
    expect(editor.tap({ x: 14, y: 11 })).toBe(false)
    editor.close(); expect(w.rooms[0].status).toBe('blueprint')
    clear(w, w.rooms[0]); editor.open(); editor.select(1); busy = true; editor.refresh(); editor.save()
    expect(states.at(-1)?.valid).toBe(false); expect(w.pods).toHaveLength(0)
    busy = false; editor.save(); expect(states.at(-1)?.completed).toBe(true)
    editor.resize(1); expect(states.at(-1)?.width).toBe(6)
    editor.close(); expect(w.rooms[0].w).toBe(3)
  })
})
