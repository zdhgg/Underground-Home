import { describe, expect, it, vi } from 'vitest'
import { atuCanStand, atuRoute, initialAtuPosition, moveDestination, routeBeforePod, soilPlan, type SoilPlan } from '../src/core/atu'
import { AtuOrders } from '../src/app/atuOrders'
import { dig } from '../src/core/dig'
import { createInitialWorld, TILE, WORLD_VERSION, type Cell } from '../src/core/world'
import { deserialize, serialize } from '../src/core/persistence'
import { placePod } from '../src/core/build'
import { inspectCrack, upgradePickaxe } from '../src/core/exploration'
import { createWorldHistory } from '../src/core/history'

function setup() {
  const w = createInitialWorld()
  w.exploration.explorer = initialAtuPosition(w)
  const view = {
    travel: vi.fn<(route: Cell[], done: () => void, step: (p: Cell) => void) => void>(),
    soil: vi.fn<(plan: SoilPlan, strike: () => void, done: () => void) => void>(), cancel: vi.fn(), preview: vi.fn(),
  }
  const commit = vi.fn((p: Cell) => { dig(w, p.x, p.y) })
  const busy = vi.fn(), notify = vi.fn()
  const orders = new AtuOrders({ world: () => w, view, busy, changed: vi.fn(), dig: commit, notify, failure: r => r.reason ?? '' })
  return { w, view, commit, busy, notify, orders }
}

describe('阿土施工位置与身体净空', () => {
  it('三格高土墙有不同的地面/向上/踏台动作，规划不改世界', () => {
    const w = createInitialWorld(), from = initialAtuPosition(w), before = serialize(w)
    for (const [y, lift] of [[11, 0], [10, 0], [9, 1]]) {
      const result = soilPlan(w, from, { x: 14, y })
      expect(result.ok).toBe(true)
      if (result.ok) { expect(result.plan.lift).toBe(lift); expect(result.plan.stand).toEqual({ x: 15, y: 11 }) }
    }
    expect(serialize(w).world).toEqual(before.world)
  })

  it('先挖出身体净空才能走进新洞，不穿过一格高的缝或另一块土', () => {
    const w = createInitialWorld(), from = initialAtuPosition(w)
    dig(w, 14, 11)
    expect(atuRoute(w, from, { x: 14, y: 11 })).toBeNull()
    expect(soilPlan(w, from, { x: 12, y: 9 }).ok).toBe(false)
    dig(w, 14, 10)
    expect(atuRoute(w, from, { x: 14, y: 11 })?.at(-1)).toEqual({ x: 14, y: 11 })
    expect(moveDestination(w, from, { x: 14, y: 10 })?.at(-1)).toEqual({ x: 14, y: 11 })
  })

  it('踏台必须有地面、上方净空且不压设施；不能靠踏台放开基岩', () => {
    const w = createInitialWorld(), from = initialAtuPosition(w)
    w.tiles[9][15] = TILE.SOIL
    expect(soilPlan(w, from, { x: 14, y: 9 }).ok).toBe(false)
    w.tiles[9][15] = TILE.EMPTY
    w.tiles[12][15] = TILE.EMPTY
    expect(soilPlan(w, from, { x: 14, y: 9 }).ok).toBe(false)
    expect(soilPlan(w, from, { x: 14, y: 8 })).toMatchObject({ ok: false, failure: { reason: 'rock' } })
    w.tiles[12][15] = TILE.ROCK
    w.pods.push({ id: 1, x: 15, y: 10, door: 'right' })
    expect(soilPlan(w, from, { x: 14, y: 9 }).ok).toBe(false)
  })

  it('梯口旁清出两格净空后可在实地用矮凳向正上方挖，不在梯上架台或放开基岩', () => {
    const w = createInitialWorld()
    for (const x of [26, 27, 28]) for (const y of [10, 11]) w.tiles[y][x] = TILE.EMPTY
    w.tiles[12][27] = TILE.EMPTY
    const target = { x: 28, y: 9 }, from = { x: 28, y: 11 }
    const p = soilPlan(w, from, target)
    expect(p).toMatchObject({ ok: true, plan: { stand: from, lift: 1, overhead: true } })
    w.tiles[12][28] = TILE.EMPTY
    expect(soilPlan(w, from, target).ok).toBe(false)
    expect(soilPlan(w, { x: 26, y: 11 }, { x: 27, y: 8 }).ok).toBe(false)
  })

  it('从当前真实位置找不到路时，不改从大厅另一侧出发', () => {
    const w = createInitialWorld()
    for (const x of [12, 13, 14]) { dig(w, x, 11); dig(w, x, 10) }
    w.progress.coreRepaired = true
    placePod(w, 13, 10)
    expect(atuRoute(w, { x: 12, y: 11 }, { x: 18, y: 11 })).toBeNull()
    expect(atuCanStand(w, { x: 12, y: 11 })).toBe(true)
  })

  it('建床让位选能回家的那一侧；角色已在选址外也不能被隔断回家通路', () => {
    const w = createInitialWorld()
    for (const x of [11, 12, 13, 14, 15]) for (const y of [11, 10]) dig(w, x, y)
    const before = serialize(w).world
    const fromInside = routeBeforePod(w, { x: 14, y: 11 }, { x: 13, y: 10 })
    expect(fromInside?.at(-1)).toEqual({ x: 16, y: 11 })
    const fromOutside = routeBeforePod(w, { x: 12, y: 11 }, { x: 13, y: 10 })
    expect(fromOutside?.at(-1)).toEqual({ x: 16, y: 11 })
    expect(serialize(w).world).toEqual(before)
  })
})

describe('单次行动、取消与过期回调', () => {
  it('走路只记录已到达的安全格，落爪才改一格；重复落爪不重复结算', () => {
    const { w, orders, view, commit, busy } = setup()
    orders.request({ x: 14, y: 9 }, 'soil')
    expect(w.tiles[9][14]).toBe(TILE.SOIL)
    const [route, arrive, step] = view.travel.mock.calls[0]
    step(route[1])
    expect(w.exploration.explorer).toEqual(route[1])
    arrive()
    const [plan, strike, done] = view.soil.mock.calls[0]
    expect(plan.lift).toBe(1)
    expect(w.tiles[9][14]).toBe(TILE.SOIL)
    strike(); strike()
    expect(w.tiles[9][14]).toBe(TILE.EMPTY)
    expect(w.dugCount).toBe(1)
    expect(commit).toHaveBeenCalledTimes(1)
    done()
    expect(busy).toHaveBeenLastCalledWith(false)
    expect(w.exploration.explorer).toEqual(plan.stand)
  })

  it('取消旧走位再点新目标，旧回调不能开挖或结束新行动', () => {
    const { w, orders, view } = setup()
    orders.request({ x: 14, y: 11 }, 'soil')
    const [, oldArrive, oldStep] = view.travel.mock.calls[0]
    orders.request({ x: 26, y: 11 }, 'soil')
    oldStep({ x: 15, y: 11 }); oldArrive()
    expect(w.exploration.explorer).toEqual({ x: 18, y: 11 })
    expect(view.soil).not.toHaveBeenCalled()
    expect(orders.active).toBe(true)
    expect(w.tiles[11][14]).toBe(TILE.SOIL)
    view.travel.mock.calls[1][1]()
    expect(view.soil.mock.calls[0][0].target).toEqual({ x: 26, y: 11 })
  })

  it('取消踏台施工后旧落爪无效；已经挖完的效果在取消后保留', () => {
    const { w, orders, view } = setup()
    orders.request({ x: 14, y: 9 }, 'soil'); view.travel.mock.calls[0][1]()
    const [, oldStrike, oldDone] = view.soil.mock.calls[0]
    orders.cancel(); oldStrike(); oldDone()
    expect(w.tiles[9][14]).toBe(TILE.SOIL)
    expect(orders.active).toBe(false)
    orders.request({ x: 14, y: 9 }, 'soil'); view.travel.mock.calls[1][1]()
    view.soil.mock.calls[1][1](); orders.cancel()
    expect(w.tiles[9][14]).toBe(TILE.EMPTY)
    expect(w.exploration.explorer).toEqual({ x: 15, y: 11 })
  })

  it('重复点同一目标不重新走路；不可达目标不暗中开挖挡路格', () => {
    const { w, orders, view, notify } = setup()
    orders.request({ x: 14, y: 9 }, 'soil'); orders.request({ x: 14, y: 9 }, 'soil')
    expect(view.travel).toHaveBeenCalledTimes(1)
    orders.request({ x: 5, y: 9 }, 'soil')
    expect(notify).toHaveBeenCalled()
    expect(w.dugCount).toBe(0)
  })
})

describe('v8主角位置与旧档', () => {
  it('没听水声前也可保存首层自由站位；非法站位和无角色的探索档被拒绝', () => {
    const { w } = setup()
    w.exploration.explorer = { x: 24, y: 11 }
    const loaded = deserialize(serialize(w))
    expect(loaded.ok && loaded.world.exploration.explorer).toEqual({ x: 24, y: 11 })
    w.exploration.explorer = { x: 14, y: 11 }
    expect(deserialize(serialize(w)).ok).toBe(false)
    w.exploration.explorer = null; w.exploration.clueFound = true; w.exploration.shaftX = 27
    expect(deserialize(serialize(w)).ok).toBe(false)
  })

  it('v7一格高旧通道中的主角回到安全处，工具与已挖地形不损失', () => {
    const w = createInitialWorld()
    w.progress = { crystalFound: true, crystalCollected: true, secondCrystalFound: true, secondCrystalCollected: true, coreLoaded: true, coreRepaired: true }
    for (let x = 12; x <= 14; x++) { dig(w, x, 11); dig(w, x, 10) }
    placePod(w, 12, 10)
    for (const x of [26, 27]) dig(w, x, 11)
    inspectCrack(w, 27, 12); upgradePickaxe(w)
    const payload = serialize(w); payload.version = 7
    const loaded = deserialize(payload)
    expect(loaded.ok).toBe(true)
    if (!loaded.ok) return
    expect(loaded.world.exploration.explorer).toEqual({ x: 18, y: 11 })
    expect(loaded.world.exploration.pickaxeUpgraded).toBe(true)
    expect(loaded.world.tiles).toEqual(w.tiles)
    expect(loaded.world.pods).toEqual(w.pods)
    expect(serialize(loaded.world).version).toBe(WORLD_VERSION)
  })

  it('占用撤销格时保留记录，退开后仍能撤销，不把角色填进土里', () => {
    const { w } = setup(), history = createWorldHistory()
    for (const y of [11, 10]) dig(w, 14, y)
    history.record({ kind: 'dig', x: 14, y: 11, tile: TILE.SOIL })
    w.exploration.explorer = { x: 14, y: 11 }
    expect(history.undo(w)).toBeNull()
    expect(history.peek()).toMatchObject({ x: 14, y: 11 })
    w.exploration.explorer = { x: 15, y: 11 }
    expect(history.undo(w)?.kind).toBe('dig')
    expect(w.tiles[11][14]).toBe(TILE.SOIL)
  })
})
