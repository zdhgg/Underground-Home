import { describe, expect, it, vi } from 'vitest'
import { Container } from 'pixi.js'
import { warmLampWorld } from './fixtures/nestWarmLampWorld'
import { nestWarmLampProblem, installNestWarmLamp } from '../src/core/nestWarmLamp'
import { planPartnerWork, type WorkPlan } from '../src/core/partnerWork'
import { PartnerOrders } from '../src/app/partnerOrders'
import { PartnerMotion } from '../src/render/partnerMotion'
import { createWorldHistory } from '../src/core/history'
import { deserialize, serialize } from '../src/core/persistence'
import { TILE, type Cell, type WorkerId } from '../src/core/world'
import { atuCanStand } from '../src/core/atu'
import { finishRoom, planRoom, roomCapacity } from '../src/core/roomConstruction'
import { RoomEditor, type RoomUI } from '../src/app/roomEditor'
import { drawSleepPod } from '../src/render/sleepPods'

const target = { kind: 'nest-warm-lamp', podId: 1 } as const
function harness() {
  const w = warmLampWorld(), history = createWorldHistory()
  const view = { travel: vi.fn((_id: WorkerId, _route: Cell[], _step: (c: Cell) => void, _done: () => void) => {}), act: vi.fn((_p: WorkPlan, _hit: () => void, _done: () => void) => {}), cancel: vi.fn() }
  const complete = vi.fn((plan: WorkPlan) => {
    if (plan.target.kind !== 'nest-warm-lamp' || !installNestWarmLamp(w, plan.target.podId)) return false
    history.record({ kind: 'nest-warm-lamp', podId: plan.target.podId }); return true
  })
  const orders = new PartnerOrders({ world: () => w, view, state: vi.fn(), changed: vi.fn(), complete, notify: vi.fn() })
  const arrive = () => { const [, route, step, done] = view.travel.mock.calls.at(-1)!; route.forEach(step); done() }
  return { w, history, view, orders, complete, arrive }
}

describe('工坊成果改善小窝', () => {
  it('章末前、无部件、目标已消失时有中文原因，不改变世界', () => {
    const w = warmLampWorld(); w.deep.completed = false
    expect(nestWarmLampProblem(w, 1)).toContain('第三层'); expect(planPartnerWork(w, target).ok).toBe(false)
    expect(installNestWarmLamp(w, 1)).toBe(false)
    w.deep.completed = true; w.deep.parts = 0
    expect(planPartnerWork(w, target)).toMatchObject({ ok: false, message: expect.stringContaining('1个工坊部件') })
    expect(installNestWarmLamp(w, 1)).toBe(false)
    expect(nestWarmLampProblem(w, 999)).toContain('重新选择')
  })

  it.each([false, true])('独立舱/房间（%s）从阿灯真实站位规划到门口；不可达不瞬移、不扣费', room => {
    const w = warmLampWorld(room), from = { ...w.workers.adeng! }, parts = w.deep.parts
    if (!room) delete w.pods[0].backWall
    const result = planPartnerWork(w, target)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.plan.worker).toBe('adeng'); expect(result.plan.route[0]).toEqual(from)
    expect(result.plan.route.every(p => atuCanStand(w, p))).toBe(true)
    expect(result.plan.at.y).toBe(11)
    w.tiles[10][16] = TILE.SOIL
    expect(planPartnerWork(w, target)).toMatchObject({ ok: false, message: expect.stringContaining('走不到') })
    expect(w.workers.adeng).toEqual(from); expect(w.deep.parts).toBe(parts)
  })

  it('真实施工到最后才结算一次；连续点击、旧回调及完工后取消均保留成果', () => {
    const h = harness(), parts = h.w.deep.parts
    h.orders.request(target); h.orders.request(target); expect(h.view.travel).toHaveBeenCalledTimes(1)
    expect(h.w.deep.parts).toBe(parts); h.arrive()
    const [plan, hit, done] = h.view.act.mock.calls[0]
    const motion = new PartnerMotion(), view = new Container()
    motion.work({ view, baseY: 100, pose: 'idle', inEntrance: false, visual: null }, plan, hit, done)
    motion.update(.6); expect(h.w.pods[0].warmLamp).toBeUndefined(); expect(h.w.deep.parts).toBe(parts)
    motion.update(1.81); hit(); done(); h.orders.cancel(); hit(); done(); h.orders.request(target)
    expect(h.complete).toHaveBeenCalledTimes(1); expect(h.history.peek()).toEqual({ kind: 'nest-warm-lamp', podId: 1 })
    expect(h.w.deep.parts).toBe(parts - 1); expect(h.w.pods[0].warmLamp).toBe(true)
    expect(h.view.travel).toHaveBeenCalledTimes(1)
    motion.effects.destroy(); view.destroy()
  })

  it.each(['walking', 'working'] as const)('%s 取消后旧回调无效；刷新可再次安装，不存在半完成态', phase => {
    const h = harness(), parts = h.w.deep.parts
    h.orders.request(target)
    const [, route, step, done] = h.view.travel.mock.calls[0]
    step(route[1])
    if (phase === 'working') h.arrive()
    h.orders.cancel(); step(route.at(-1)!); done()
    h.view.act.mock.calls[0]?.[1](); h.view.act.mock.calls[0]?.[2]()
    expect(h.complete).not.toHaveBeenCalled(); expect(h.w.deep.parts).toBe(parts)
    const loaded = deserialize(serialize(h.w)); expect(loaded.ok).toBe(true)
    if (loaded.ok) { expect(loaded.world.pods[0].warmLamp).toBeUndefined(); expect(planPartnerWork(loaded.world, target).ok).toBe(true) }
    h.orders.request(target); h.arrive(); h.view.act.mock.calls.at(-1)![1]()
    expect(h.w.deep.parts).toBe(parts - 1)
  })

  it('共用撤销栈退还恰好一个部件，不修改标记/记忆/主线；重进灯具仍存在', () => {
    const h = harness(), before = structuredClone(h.w)
    h.orders.request(target); h.arrive(); h.view.act.mock.calls[0][1]()
    const result = deserialize(serialize(h.w)); expect(result.ok).toBe(true)
    if (result.ok) { expect(result.world.pods[0]).toMatchObject({ warmLamp: true, mark: 'leaf' }); expect(result.world.deep.parts).toBe(before.deep.parts - 1); expect(result.world.memories).toEqual(before.memories) }
    h.orders.cancel(); expect(h.w.pods[0].warmLamp).toBe(true)
    expect(h.history.undo(h.w)?.kind).toBe('nest-warm-lamp'); expect(h.history.undo(h.w)).toBeNull()
    expect(h.w.deep).toEqual(before.deep); expect(h.w.pods).toEqual(before.pods)
    for (const key of ['hall', 'garden', 'reservoir', 'ventilation', 'ruins', 'finale'] as const) expect(h.w[key]).toEqual(before[key])
  })

  it('v25迁移默认无灯且能继续安装；v26拒绝非法字段和未完成前置', () => {
    const save = serialize(warmLampWorld()); save.version = 25; save.world.pods[0].warmLamp = true
    const result = deserialize(save); expect(result.ok).toBe(true)
    if (result.ok) { expect(result.world.pods[0].warmLamp).toBeUndefined(); expect(installNestWarmLamp(result.world, 1)).toBe(true); expect(serialize(result.world).version).toBe(26) }
    const invalid = serialize(warmLampWorld()); (invalid.world.pods[0] as unknown as { warmLamp: unknown }).warmLamp = false
    expect(deserialize(invalid)).toMatchObject({ ok: false, error: expect.stringContaining('暖光灯') })
    invalid.world.pods[0].warmLamp = true; invalid.world.deep.completed = false
    expect(deserialize(invalid)).toMatchObject({ ok: false, error: expect.stringContaining('前置') })
  })

  it('两窝状态独立、房间扩建与撤销扩建保留原灯、床位与三个标记', () => {
    const w = warmLampWorld(true), parts = w.deep.parts, history = createWorldHistory()
    expect(w.pods).toHaveLength(2); expect(installNestWarmLamp(w, 1)).toBe(true)
    expect(w.pods[1].warmLamp).toBeUndefined(); expect(installNestWarmLamp(w, w.pods[1].id)).toBe(true)
    expect(w.deep.parts).toBe(parts - 2)
    const r = w.rooms[0], oldPods = structuredClone(w.pods)
    const plan = planRoom(w, { id: 0, kind: 'home', x: 8, y: 9, w: 7, h: 3, replaces: r.id })!
    for (let y = 9; y <= 11; y++) w.tiles[y][8] = TILE.EMPTY
    const change = finishRoom(w, plan.after!.id)!; expect(change).not.toBeNull(); history.record({ kind: 'room', change })
    expect(roomCapacity(w.rooms[0])).toBe('4个床位'); expect(w.pods).toEqual(oldPods)
    expect(history.undo(w)?.kind).toBe('room'); expect(w.pods).toEqual(oldPods)
    for (const mark of ['star', 'leaf', 'drop'] as const) {
      w.pods[0].mark = mark
      expect(deserialize(serialize(w))).toMatchObject({ ok: true, world: { pods: expect.arrayContaining([expect.objectContaining({ id: 1, mark, warmLamp: true })]) } })
    }
  })

  it('房间详情按每个pod开放入口，灯与预览只添加局部图形，不修改原床位', () => {
    const w = warmLampWorld(true), states: RoomUI[] = []
    const editor = new RoomEditor({ world: () => w, emit: s => states.push(s), preview: vi.fn(), commit: vi.fn(), notify: vi.fn() })
    editor.active = true; editor.select(w.rooms[0].id)
    expect(states.at(-1)?.nestImprovements?.map(p => p.id)).toEqual(w.pods.map(p => p.id))
    w.deep.completed = false; editor.refresh(); expect(states.at(-1)?.nestImprovements).toEqual([])
    for (const door of ['left', 'right'] as const) {
      const pod = { ...w.pods[0], door }, before = drawSleepPod(pod), preview = drawSleepPod(pod, false, undefined, true), after = drawSleepPod({ ...pod, warmLamp: true })
      expect(before.getChildByLabel('nest-warm-lamp')).toBeNull()
      expect(preview.getChildByLabel('nest-warm-lamp-preview')).toBeTruthy()
      expect(after.getChildByLabel('nest-warm-lamp')?.scale.x).toBe(door === 'left' ? 1 : -1)
      for (const view of [before, preview, after]) view.destroy({ children: true })
    }
  })
})
