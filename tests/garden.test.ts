import { describe, expect, it } from 'vitest'
import { buildGarden, changeGardenVariety, gardenActionProblem, gardenBed, gardenBuildProblem, gardenGoal, performGarden } from '../src/core/garden'
import { gardenConnected, gardenLight } from '../src/core/gardenTopology'
import { availablePartners, partnerBed } from '../src/core/partners'
import { planHallGathering, performHall } from '../src/core/hall'
import { deserialize, serialize } from '../src/core/persistence'
import { atuRoute, soilPlan } from '../src/core/atu'
import { canDig, dig } from '../src/core/dig'
import { canRestoreDig } from '../src/core/build'
import { createWorldHistory } from '../src/core/history'
import { freshGarden, TILE } from '../src/core/world'
import { completedGarden, enterGarden, expandGarden, gardenAvailable, workingGarden } from './fixtures/gardenWorld'

describe('第五层菌光花园与第七位伙伴', () => {
  it('先看湿台阶再导流，未导流不能开工，入口问题不损坏已有家园', () => {
    const w = gardenAvailable(), before = structuredClone(w.tiles)
    expect(gardenGoal(w).action).toBe('inspect'); expect(performGarden(w, 'excavate').ok).toBe(false)
    expect(performGarden(w, 'inspect').ok).toBe(true); expect(performGarden(w, 'excavate').ok).toBe(false)
    const inventory = { ...w.inventory }; expect(performGarden(w, 'drain').ok).toBe(true)
    expect(w.inventory).toMatchObject({ stone: inventory.stone - 2, wood: inventory.wood - 1 }); expect(w.tiles).toEqual(before)
    expect(performGarden(w, 'drain').ok).toBe(false); expect(canDig(w, 27, 47).ok).toBe(false)
  })
  it.each([16, 27])('旧梯道 x%s 可以进入第五层、扩挖四格高，前四层设施与地形保留', shaft => {
    const w = gardenAvailable(shaft), upper = structuredClone(w.tiles.slice(0, 47)), old = structuredClone(w.hall)
    enterGarden(w); expandGarden(w)
    expect(gardenConnected(w)).toBe(true); expect(w.tiles.slice(0, 47)).toEqual(upper); expect(w.hall).toEqual(old)
    expect(atuRoute(w, { x: shaft, y: 58 }, { x: 18, y: 11 }, true)).not.toBeNull()
    expect(canDig(w, 20, 59).ok).toBe(false); expect(canDig(w, 20, 54).ok).toBe(false)
    expect(deserialize(serialize(w))).toMatchObject({ ok: true })
  })
  it('蜗牛只在实际相遇后加入，独立第七床位不重排老伙伴；旧六人宴仍有六席', () => {
    const w = gardenAvailable(); enterGarden(w)
    expect(availablePartners(w)).toHaveLength(6)
    expect(performGarden(w, 'meet').ok).toBe(true)
    expect(availablePartners(w).map(p => p.id)).toEqual(['atu','adeng','xiaoman','xiaoquan','ayan','amu','taitai'])
    expect(partnerBed(w, 'taitai')).toBeNull(); expect(planHallGathering(w)?.moves).toHaveLength(5)
    expect(buildGarden(w, 'nest', 28).ok).toBe(true); expect(partnerBed(w, 'taitai')?.slot).toBe(0)
    expect(planHallGathering(w)?.moves.map(m => m.id)).not.toContain('taitai')
  })
  it('菌床确实依赖水和照明，灯只照两格，连续菌毯会传光，岩石与断开的菌毯会截断', () => {
    const w = workingGarden(), bed = gardenBed(w, 28)!
    w.garden.trail = []
    expect(gardenLight(w).has(28)).toBe(false); expect(gardenActionProblem(w, 'care', 28)).toContain('缺光')
    expect(performGarden(w, 'weave', 28).ok).toBe(true)
    expect([28,29,30,31].every(x => gardenLight(w).has(x))).toBe(true)
    w.tiles[56][30] = TILE.ROCK; expect(gardenLight(w).has(28)).toBe(false)
    w.tiles[56][30] = TILE.EMPTY; w.garden.trail = w.garden.trail.filter(x => x !== 29); expect(gardenLight(w).has(28)).toBe(false)
    expect(bed.growth).toBe(0)
  })
  it.each([16, 27])('两次照料、收获两份食物、苔苔床位和散步构成完整章节（x%s）', shaft => {
    const w = completedGarden(shaft)
    expect(w.garden).toMatchObject({ completed: true, harvests: 1, walks: 1 }); expect(gardenGoal(w).done).toBe(14)
    expect(partnerBed(w, 'taitai')).not.toBeNull(); expect(gardenGoal(w).speech).toContain('九层')
    expect(deserialize(serialize(w))).toMatchObject({ ok: true })
    const food = w.farm.food; expect(performHall(w, 'feast').ok).toBe(true); expect(w.farm.food).toBe(food - 1)
    expect(w.garden.completed).toBe(true)
  })
  it('收获可重复，保留菌根；收后解锁第二菌种，未熟不能收、不重复结算', () => {
    const w = workingGarden(), food = w.farm.food
    expect(performGarden(w, 'harvest', 28).ok).toBe(false); expect(changeGardenVariety(w, 28).ok).toBe(false)
    for (const action of ['care','care','harvest'] as const) expect(performGarden(w, action, 28).ok).toBe(true)
    expect(w.farm.food).toBe(food + 2); expect(performGarden(w, 'harvest', 28).ok).toBe(false)
    expect(changeGardenVariety(w, 28).ok).toBe(true); expect(gardenBed(w, 28)?.variety).toBe('fan')
    expect(performGarden(w, 'care', 28).ok).toBe(true); expect(changeGardenVariety(w, 28).ok).toBe(false)
    expect(deserialize(serialize(w))).toMatchObject({ ok: true })
  })
  it('自由选址拒绝梯口、重叠、悬空和缺料；误挖可撤销，菌床与菌毯保护真实通路', () => {
    const w = workingGarden(), history = createWorldHistory()
    expect(gardenBuildProblem(w, 'bed', 27)).toContain('梯口'); expect(buildGarden(w, 'bed', 29).ok).toBe(false)
    w.inventory.stone = 0; const crystals = w.deep.crystals
    expect(buildGarden(w, 'lamp', 35).ok).toBe(false); expect(w.deep.crystals).toBe(crystals)
    const before = w.tiles[58][7]; expect(dig(w, 7, 58).ok).toBe(true); history.record({ kind: 'dig', x: 7, y: 58 })
    expect(history.undo(w)?.kind).toBe('dig'); expect(w.tiles[58][7]).toBe(before)
    expect(canRestoreDig(w, 27, 50)).toBe(false); expect(canRestoreDig(w, 29, 55)).toBe(false)
  })
  it('施工架可触及第五层顶部，普通土仍逐格开挖；撤销小窝退真实床位与材料', () => {
    const w = gardenAvailable(); enterGarden(w); performGarden(w, 'meet')
    for (const y of [58,57,56]) dig(w, 23, y)
    const plan = soilPlan(w, { x:27,y:58 }, { x:23,y:55 }); expect(plan.ok).toBe(true); if (plan.ok) expect(plan.plan.lift).toBe(2)
    const history = createWorldHistory(), before = structuredClone(w), r = buildGarden(w, 'nest', 28)
    expect(r.ok).toBe(true); if (r.ok) history.record({ kind: 'garden', change:r.change })
    expect(partnerBed(w,'taitai')).not.toBeNull(); expect(history.undo(w)?.kind).toBe('garden'); expect(w).toEqual(before)
  })
})

describe('v19 存档与五层迁移', () => {
  it('真实 v18 44×52 旧档只追加花园，前四层、伙伴和完成状态逐项保留', () => {
    const payload = serialize(gardenAvailable()); payload.version = 18; payload.world.height = 52; payload.world.tiles = payload.world.tiles.slice(0,52)
    delete (payload.world as Partial<typeof payload.world>).garden
    const before = structuredClone(payload), r = deserialize(payload)
    expect(payload).toEqual(before); expect(r.ok).toBe(true)
    if (r.ok) { expect(r.world.height).toBe(112); expect(r.world.tiles.slice(0,52)).toEqual(payload.world.tiles); expect(r.world.garden).toEqual(freshGarden()); expect(r.world.hall.completed).toBe(true) }
  })
  it('半段梯道、菌苗、菌毯与新伙伴站位可恢复；绕过排水、负收成、伪造光路与伙伴被拒绝', () => {
    const w = gardenAvailable(); performGarden(w,'inspect'); performGarden(w,'drain'); w.tiles[47][27] = TILE.EMPTY; w.workers.ayan = {x:27,y:47}
    expect(deserialize(serialize(w))).toMatchObject({ok:true})
    const bad = serialize(w); bad.world.garden.drained = false; expect(deserialize(bad).ok).toBe(false)
    const complete = completedGarden(); complete.workers.taitai = {x:29,y:58}; expect(deserialize(serialize(complete))).toMatchObject({ok:true})
    for (const mutate of [
      (p:ReturnType<typeof serialize>)=>{p.world.garden.harvests=-1},
      (p:ReturnType<typeof serialize>)=>{p.world.garden.trail.push(41)},
      (p:ReturnType<typeof serialize>)=>{p.world.garden.metTaitai=false},
      (p:ReturnType<typeof serialize>)=>{p.world.garden.facilities[1].growth=9 as 2},
    ]) { const p=serialize(complete); mutate(p); expect(deserialize(p).ok).toBe(false) }
  })
})
