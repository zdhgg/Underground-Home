import { describe, expect, it } from 'vitest'
import { buildHall, hallActionProblem, hallBuildProblem, hallGoal, performHall, planHallGathering } from '../src/core/hall'
import { hallConnected, hallFrontier } from '../src/core/hallTopology'
import { atuRoute, soilPlan } from '../src/core/atu'
import { canDig, dig } from '../src/core/dig'
import { canRestoreDig } from '../src/core/build'
import { createWorldHistory } from '../src/core/history'
import { deserialize, serialize } from '../src/core/persistence'
import { createInitialWorld, freshHall, TILE } from '../src/core/world'
import { settledPartners } from '../src/core/partners'
import { furnishedHall, hallAvailable, enterHall, expandHall } from './fixtures/hallWorld'

describe('第四层暖光大厅规则', () => {
  it('三层完成后检查旧梁，先有征兆再加固，不影响已有家园、没有倒计时', () => {
    const fresh = createInitialWorld(); expect(performHall(fresh, 'inspect').ok).toBe(false)
    const w = hallAvailable(), before = structuredClone(w.tiles)
    expect(hallGoal(w).action).toBe('inspect'); expect(performHall(w, 'inspect').ok).toBe(true)
    expect(canDig(w, 27, 34).ok).toBe(false); expect(performHall(w, 'excavate').ok).toBe(false)
    expect(w.tiles).toEqual(before)
    const parts = w.deep.parts, wood = w.inventory.wood
    expect(performHall(w, 'brace').ok).toBe(true); expect(w.deep.parts).toBe(parts - 1); expect(w.inventory.wood).toBe(wood - 2)
    expect(performHall(w, 'brace').ok).toBe(false); expect(w.tiles).toEqual(before)
  })
  it.each([16, 27])('两条旧梯道 x%s 都能连入第四层，往返保留原有设施与地形', shaft => {
    const w = hallAvailable(shaft), original = structuredClone(w.tiles.slice(0, 34)), facilities = structuredClone(w.deep.facilities)
    enterHall(w); expect(hallConnected(w)).toBe(true); expect(hallFrontier(w)).toBeNull()
    expect(atuRoute(w, { x: shaft, y: 46 }, { x: 18, y: 11 }, true)).not.toBeNull()
    expect(w.tiles.slice(0, 34)).toEqual(original); expect(w.deep.facilities).toEqual(facilities)
    expect(deserialize(serialize(w))).toMatchObject({ ok: true })
  })
  it('只开放四层松软泥土，四格高扩挖有真实施工架站位；前侧通路与地板保持', () => {
    const w = hallAvailable(); enterHall(w)
    for (const y of [46, 45, 44]) expect(dig(w, 23, y).ok).toBe(true)
    const p = soilPlan(w, { x: 27, y: 46 }, { x: 23, y: 43 })
    expect(p.ok).toBe(true); if (p.ok) { expect(p.plan.lift).toBe(2); expect(p.plan.stand.y).toBe(46) }
    expect(dig(w, 23, 43).ok).toBe(true)
    expect(canDig(w, 23, 47).ok).toBe(false); expect(canDig(w, 23, 41).ok).toBe(false)
  })
  it.each([16, 27])('自由选址、六床位和暖屋宴形成完整闭环（梯口 x%s）', shaft => {
    const w = furnishedHall(shaft)
    expect(settledPartners(w)).toBe(6); expect(hallGoal(w).action).toBe('feast')
    const plan = planHallGathering(w)!
    expect(plan.moves).toHaveLength(5); expect(new Set([plan.atu.at(-1)!.x, ...plan.moves.map(m => m.seat.x)]).size).toBe(6)
    expect(plan.moves.every(m => m.route.length > 0)).toBe(true)
    expect(deserialize(serialize(w))).toMatchObject({ ok: true })
    const food = w.farm.food
    expect(performHall(w, 'feast').ok).toBe(true); expect(w.farm.food).toBe(food - 1)
    expect(w.hall).toMatchObject({ completed: true, feasts: 1 }); expect(hallGoal(w).done).toBe(11)
    expect(hallGoal(w).speech).toContain('九层'); expect(deserialize(serialize(w))).toMatchObject({ ok: true })
  })
  it('材料不足、重叠、梯口、悬空、缺床与缺食物都给出提示且不扣费', () => {
    const w = hallAvailable(); enterHall(w); expandHall(w)
    expect(hallBuildProblem(w, 'hall', 24)).toContain('梯口')
    w.deep.parts = 0; const inventory = { ...w.inventory }
    expect(buildHall(w, 'hall', 28).ok).toBe(false); expect(w.inventory).toEqual(inventory)
    const full = furnishedHall(); expect(buildHall(full, 'memory', 35).ok).toBe(false)
    full.farm.food = 0; expect(hallActionProblem(full, 'feast')).toContain('收成')
    full.farm.food = 1; full.pods.pop(); expect(hallActionProblem(full, 'feast')).toContain('床位')
  })
  it('大厅建设撤销退回材料与真实床位，已使用的梯道与暖屋宴成果受保护', () => {
    const w = hallAvailable(); enterHall(w); expandHall(w)
    const history = createWorldHistory(), before = structuredClone(w)
    const r = buildHall(w, 'nest', 10); expect(r.ok).toBe(true)
    if (r.ok) history.record({ kind: 'hall', change: r.change })
    expect(w.pods.length).toBe(before.pods.length + 1); expect(history.undo(w)?.kind).toBe('hall'); expect(w).toEqual(before)
    expect(canRestoreDig(w, 27, 40)).toBe(false)
    const f = furnishedHall(), table = f.hall.facilities.find(x => x.kind === 'hall')!
    expect(canRestoreDig(f, table.x, 43)).toBe(false)
    const feast = performHall(f, 'feast'); if (feast.ok) history.record({ kind: 'hall', change: feast.change })
    expect(history.undo(f)).toBeNull()
  })
})

describe('v18 存档与安全迁移', () => {
  it('v17 的真实 44×40 地图逐格保留，只追加第四层且不篡改输入', () => {
    const w = hallAvailable(), payload = serialize(w); payload.version = 17; payload.world.height = 40; payload.world.tiles = payload.world.tiles.slice(0, 40)
    delete (payload.world as Partial<typeof payload.world>).hall
    const before = structuredClone(payload), result = deserialize(payload)
    expect(result.ok).toBe(true); expect(payload).toEqual(before)
    if (result.ok) { expect(result.world.height).toBe(112); expect(result.world.tiles.slice(0, 40)).toEqual(payload.world.tiles); expect(result.world.hall).toEqual(freshHall()); expect(result.world.deep).toEqual(w.deep) }
  })
  it('半段施工与四层角色站位可恢复，伪造绕过加固、未完成餐桌或六床条件会被拒绝', () => {
    const w = hallAvailable(); performHall(w, 'inspect'); performHall(w, 'brace'); w.tiles[34][27] = TILE.EMPTY; w.dugCount++; w.workers.ayan = { x: 27, y: 34 }
    expect(deserialize(serialize(w))).toMatchObject({ ok: true })
    const bad = serialize(w); bad.world.hall.braced = false; expect(deserialize(bad).ok).toBe(false)
    const f = furnishedHall(); performHall(f, 'feast'); const plan = planHallGathering(f)!
    f.exploration.explorer = plan.atu.at(-1)!; for (const m of plan.moves) f.workers[m.id] = m.seat
    expect(deserialize(serialize(f))).toMatchObject({ ok: true })
    const noTable = serialize(f); noTable.world.hall.tableReady = false; expect(deserialize(noTable).ok).toBe(false)
    const noBeds = serialize(f); noBeds.world.pods.pop(); expect(deserialize(noBeds).ok).toBe(false)
    const wrongHeight = serialize(f); wrongHeight.world.height = 40; expect(deserialize(wrongHeight).ok).toBe(false)
  })
})
