import { describe, it, expect, vi } from 'vitest'
import { Container, Graphics } from 'pixi.js'
import { createInitialWorld, TILE, WORLD_VERSION, type Cell, type WorkerId } from '../src/core/world'
import { initializeWorkers, planPartnerWork, type WorkPlan } from '../src/core/partnerWork'
import { PartnerOrders, type WorkUI } from '../src/app/partnerOrders'
import { PartnerMotion, type MovingPartner } from '../src/render/partnerMotion'
import { canPlacePod, canRestoreDig, placePod } from '../src/core/build'
import { atuRoute } from '../src/core/atu'
import { deserialize, serialize } from '../src/core/persistence'
import { createWorldHistory } from '../src/core/history'

function ready() {
  const w = createInitialWorld()
  w.progress = { crystalFound: true, crystalCollected: true, coreRepaired: true }
  for (let x = 12; x <= 15; x++) for (let y = 9; y <= 11; y++) w.tiles[y][x] = TILE.EMPTY
  for (let x = 26; x <= 39; x++) for (let y = 9; y <= 11; y++) w.tiles[y][x] = TILE.EMPTY
  w.pods.push({ id: 1, x: 12, y: 10, door: 'right' })
  w.exploration = { clueFound: true, pickaxeUpgraded: true, entered: true, springFound: true, shaftX: 27, explorer: { x: 27, y: 21 }, lamps: [] }
  for (let y = 12; y <= 21; y++) w.tiles[y][27] = TILE.EMPTY
  for (let x = 18; x <= 33; x++) { w.tiles[21][x] = TILE.EMPTY; w.tiles[20][x] = TILE.EMPTY; w.tiles[19][x] = TILE.EMPTY }
  w.farm.waterSupplied = true
  w.farm.planters = [{ id: 1, x: 31, y: 11, growth: 3 }]
  initializeWorkers(w)
  return w
}

function harness() {
  const w = ready(), states: (WorkUI | null)[] = []
  const view = { travel: vi.fn((_id: WorkerId, _route: Cell[], _step: (p: Cell) => void, _done: () => void) => {}),
    act: vi.fn((_plan: WorkPlan, _strike: () => void, _done: () => void) => {}), cancel: vi.fn() }
  const complete = vi.fn((plan: WorkPlan) => {
    if (plan.target.kind === 'harvest') { w.farm.food++; w.farm.harvests++; w.farm.planters[0].growth = 0 }
    else if (plan.target.kind === 'water') w.farm.waterSupplied = true
    else w.exploration.lamps.push({ x: plan.target.x, y: 19 })
    return true
  })
  const notify = vi.fn(), changed = vi.fn()
  const orders = new PartnerOrders({ world: () => w, view, state: s => states.push(s), changed, complete, notify })
  const arrive = () => { const [, route, step, done] = view.travel.mock.calls.at(-1)!; route.forEach(step); done() }
  return { w, view, complete, notify, changed, orders, states, arrive }
}

describe('伙伴工作：从真实站位到设施', () => {
  it('加入条件独立，旧床伙伴恢复安全待命，初始化不改已有站位', () => {
    const w = createInitialWorld()
    expect(initializeWorkers(w)).toBe(false)
    w.progress.coreRepaired = true; initializeWorkers(w)
    expect(Object.keys(w.workers)).toEqual(['adeng'])
    w.pods.push({ id: 1, x: 12, y: 10, door: 'right' }); initializeWorkers(w)
    expect(w.workers.xiaoman).toBeUndefined(); expect(w.workers.xiaoquan).toBeUndefined()
    w.exploration.entered = true; initializeWorkers(w)
    expect(w.workers.xiaoman).toBeDefined(); expect(w.workers.xiaoquan).toBeUndefined()
    const before = structuredClone(w.workers)
    initializeWorkers(w); expect(w.workers).toEqual(before)
    w.exploration.entered = false; w.pods = []; initializeWorkers(w)
    expect(w.workers.xiaoman).toBeUndefined(); expect(w.workers.adeng).toBeDefined()
  })

  it('三个目标分给对应伙伴，路径不穿床、土或未开通岩层', () => {
    const w = ready(); w.farm.waterSupplied = false
    for (const [target, worker] of [[{ kind: 'harvest', x: 31, y: 11 }, 'xiaoman'], [{ kind: 'water' }, 'xiaoquan'], [{ kind: 'lamp', x: 31 }, 'adeng']] as const) {
      const result = planPartnerWork(w, target)
      expect(result.ok).toBe(true)
      if (!result.ok) continue
      expect(result.plan.worker).toBe(worker)
      expect(result.plan.route[0]).toEqual(w.workers[worker])
      for (const p of result.plan.route) expect(w.tiles[p.y][p.x]).toBe(TILE.EMPTY)
    }
    const start = { ...w.workers.xiaoman! }
    w.tiles[10][28] = TILE.SOIL
    w.workers.xiaoman = { x: 25, y: 11 }
    expect(planPartnerWork(w, { kind: 'harvest', x: 31, y: 11 }).ok).toBe(false)
    expect(w.workers.xiaoman).toEqual({ x: 25, y: 11 })
    w.workers.xiaoman = start
    w.tiles[18][27] = TILE.WEAK_ROCK
    expect(planPartnerWork(w, { kind: 'lamp', x: 31 }).ok).toBe(false)
  })

  it('取消行走保存实际到达格，旧抵达/落手回调和连点不能重复收成', () => {
    const h = harness(), t = { kind: 'harvest', x: 31, y: 11 } as const
    h.w.workers.xiaoman = { x: 25, y: 11 }
    h.orders.request(t); h.orders.request(t)
    expect(h.view.travel).toHaveBeenCalledTimes(1)
    const [, route, step, done] = h.view.travel.mock.calls[0]
    step(route[1]); h.orders.cancel(); step(route.at(-1)!); done()
    expect(h.w.workers.xiaoman).toEqual(route[1]); expect(h.view.act).not.toHaveBeenCalled()
    h.orders.request(t); h.arrive()
    const [, hit, finish] = h.view.act.mock.calls[0]
    hit(); hit(); finish(); hit(); finish()
    expect(h.complete).toHaveBeenCalledTimes(1); expect(h.w.farm.food).toBe(1)
    h.orders.request(t); expect(h.view.travel).toHaveBeenCalledTimes(2)
  })

  it('取消动手前不结算；刷新只恢复安全位置，没有待执行动作', () => {
    const h = harness(); h.orders.request({ kind: 'harvest', x: 31, y: 11 }); h.arrive()
    const [, hit, finish] = h.view.act.mock.calls[0]
    h.orders.cancel(); hit(); finish()
    expect(h.w.farm.food).toBe(0)
    const save = serialize(h.w), loaded = deserialize(save)
    expect(save.version).toBe(WORLD_VERSION); expect(loaded.ok).toBe(true)
    if (loaded.ok) expect(loaded.world.workers).toEqual(h.w.workers)
    expect(Object.keys(save.world)).not.toContain('work')
  })

  it('接水成果只结算一次，沿真实梯道返程；取消返程保留供水且不瞬移', () => {
    const h = harness(); h.w.farm.waterSupplied = false
    h.w.exploration.explorer = { x: 18, y: 11 }
    h.orders.request({ kind: 'water' }); h.arrive()
    const [, hit, done] = h.view.act.mock.calls[0]
    expect(h.w.farm.waterSupplied).toBe(false)
    hit(); done()
    expect(h.states.at(-1)?.phase).toBe('returning')
    const [, route, step, finish] = h.view.travel.mock.calls.at(-1)!
    expect(route.some(p => p.x === 27 && p.y === 15)).toBe(true)
    expect(route.at(-1)).not.toEqual(h.w.exploration.explorer)
    step(route[1]); h.orders.cancel(); finish(); hit()
    expect(h.w.workers.xiaoquan).toEqual(route[1]); expect(h.w.farm.waterSupplied).toBe(true)
    expect(h.complete).toHaveBeenCalledTimes(1)
  })

  it('设施到达前失效不结算；只允许一项专业工作', () => {
    const h = harness(); h.orders.request({ kind: 'harvest', x: 31, y: 11 })
    h.orders.request({ kind: 'lamp', x: 31 }); expect(h.view.travel).toHaveBeenCalledTimes(1)
    h.w.farm.planters = []; h.arrive()
    expect(h.orders.active).toBe(false); expect(h.view.act).not.toHaveBeenCalled()
    expect(h.complete).not.toHaveBeenCalled()
  })

  it('伙伴占用和回家路受撤销保护；床位可预览，实际建造要先沿通路退让', () => {
    const w = ready(); w.workers.xiaoman = { x: 32, y: 11 }
    expect(canRestoreDig(w, 32, 10)).toBe(false)
    const history = createWorldHistory(); history.record({ kind: 'dig', x: 32, y: 10 })
    expect(history.undo(w)).toBeNull(); expect(history.peek()).toMatchObject({ x: 32, y: 10 })
    expect(canRestoreDig(w, 29, 10)).toBe(false)
    expect(canPlacePod(w, 31, 10).ok).toBe(true)
    expect(placePod(w, 31, 10)).toBeNull()
    w.workers.xiaoman = { x: 29, y: 11 }
    expect(history.undo(w)).toMatchObject({ x: 32, y: 10 }); w.tiles[10][32] = TILE.EMPTY
    expect(placePod(w, 31, 10)).not.toBeNull()
    expect(atuRoute(w, w.workers.xiaoman, { x: 18, y: 11 })).not.toBeNull()
  })

  it('v9保留房间和成果，v10拒绝土内站位、未加入伙伴及未知身份', () => {
    const w = ready(), save = serialize(w), old = structuredClone(save); old.version = 9
    const migrated = deserialize(old)
    expect(migrated.ok && migrated.world.rooms).toEqual(w.rooms)
    if (migrated.ok) { expect(migrated.world.workers).toEqual({}); initializeWorkers(migrated.world); expect(migrated.world.farm).toEqual(w.farm) }
    for (const positions of [{ xiaoman: { x: 1, y: 11 } }, { stranger: { x: 25, y: 11 } }, { adeng: { x: 31.5, y: 21 } }]) {
      const raw = structuredClone(save); raw.world.workers = positions
      expect(deserialize(raw).ok).toBe(false)
    }
  })
})

describe('伙伴动作与效果同步', () => {
  it('逐格回调，取消中途不调用抵达；短动作只落手一次且取消不补结算', () => {
    const friend: MovingPartner = { view: new Container(), baseY: 0, pose: 'idle', inEntrance: false, visual: { face: vi.fn() } }
    friend.view.addChild(new Graphics())
    const motion = new PartnerMotion(), step = vi.fn(), done = vi.fn(), hit = vi.fn()
    motion.travel(friend, [{ x: 25, y: 11 }, { x: 26, y: 11 }, { x: 27, y: 11 }], step, done)
    motion.update(.15); expect(step).toHaveBeenLastCalledWith({ x: 26, y: 11 }); expect(done).not.toHaveBeenCalled()
    motion.cancel(); motion.update(1); expect(done).not.toHaveBeenCalled(); expect(friend.inEntrance).toBe(false)
    const result = planPartnerWork(ready(), { kind: 'harvest', x: 31, y: 11 })
    if (!result.ok) throw new Error(result.message)
    motion.work(friend, result.plan, hit, done); motion.update(.5); expect(hit).not.toHaveBeenCalled()
    motion.update(.1); motion.update(.4); expect(hit).toHaveBeenCalledTimes(1); expect(done).toHaveBeenCalledTimes(1)
    motion.work(friend, result.plan, hit, done); motion.update(.4); motion.cancel(); motion.update(1)
    expect(hit).toHaveBeenCalledTimes(1)
    const lamp = planPartnerWork(ready(), { kind: 'lamp', x: 31 })
    if (!lamp.ok) throw new Error(lamp.message)
    friend.baseY = 21.6 * 32; friend.view.y = friend.baseY
    motion.work(friend, lamp.plan, hit, done); motion.update(.6)
    expect(friend.view.y).toBe(friend.baseY - 32)
    motion.cancel(); expect(friend.view.y).toBe(friend.baseY)
    friend.view.destroy({ children: true }); motion.effects.destroy()
  })
})
