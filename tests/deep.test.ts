import { describe, expect, it } from 'vitest'
import { buildDeep, deepActionProblem, deepBuildProblem, deepGoal, performDeep, undoDeep } from '../src/core/deep'
import { deepConnected, deepFrontier, deepLadderSegments, DEEP_FOOT } from '../src/core/deepTopology'
import { deepLampCoverage } from '../src/core/lighting'
import { bagItems } from '../src/core/bag'
import { atuRoute, initialAtuPosition, soilPlan } from '../src/core/atu'
import { canDig, dig } from '../src/core/dig'
import { availablePartners } from '../src/core/partners'
import { createInitialWorld, freshDeep, TILE } from '../src/core/world'
import { deserialize, serialize } from '../src/core/persistence'
import { createWorldHistory } from '../src/core/history'
import { enterDeep, expandDeep, liftReady, secondLayerComplete, workingDeep } from './fixtures/deepWorld'

describe('第三层完整建设章节', () => {
  it('梯子只出现在连续已施工段；天然洞穴不会提前浮出梯子', () => {
    const w = secondLayerComplete(); performDeep(w, 'meet')
    expect(deepLadderSegments(w)).toEqual([])
    w.tiles[22][27] = TILE.EMPTY; expect(deepLadderSegments(w)).toEqual([22])
    w.tiles[23][27] = TILE.EMPTY; expect(deepLadderSegments(w)).toEqual([22, 23])
  })
  it('远光灯扩大真实覆盖，岩石仍截断；发现和加工材料在物品栏能看见', () => {
    const w = workingDeep()
    const before = deepLampCoverage(w, 36)
    expect(before.some(p => p.x === 30)).toBe(false)
    w.deep.farLight = true
    expect(deepLampCoverage(w, 36).some(p => p.x === 30)).toBe(true)
    w.tiles[32][33] = TILE.ROCK
    expect(deepLampCoverage(w, 36).some(p => p.x < 34)).toBe(false)
    const bag = bagItems(w)
    expect(bag.find(i => i.id === 'ore')?.count).toBe(w.deep.ore)
    expect(bag.find(i => i.id === 'crystal-cluster')?.count).toBe(1)
    expect(bag.find(i => i.id === 'crystal-moss')?.count).toBe(1)
    expect(bag.find(i => i.id === 'old-drill')?.count).toBe(1)
  })
  it.each([16, 27])('旧梯道 x%s 都能接入第三层，前两层的设施和资源不退化', shaft => {
    const w = secondLayerComplete(shaft), old = structuredClone(w.tiles.slice(0, 22)), facilities = structuredClone(w.builtSites)
    expect(deserialize(serialize(w))).toMatchObject({ ok: true })
    expect(deepGoal(w).action).toBe('meet')
    expect(availablePartners(w).map(p => p.id)).toEqual(['atu', 'adeng', 'xiaoman', 'xiaoquan'])
    enterDeep(w); expandDeep(w)
    expect(deepConnected(w)).toBe(true)
    expect(atuRoute(w, initialAtuPosition(w), { x: 30, y: DEEP_FOOT })).not.toBeNull()
    expect(w.tiles.slice(0, 22)).toEqual(old); expect(w.builtSites).toEqual(facilities)
    expect(performDeep(w, 'discover').ok).toBe(true)
    expect(deserialize(serialize(w))).toMatchObject({ ok: true })
  })

  it('从晶簇到部件、支撑、电梯和首次乘坐构成真实完成态；重复操作不会重复付费', () => {
    const w = liftReady()
    expect(w.deep).toMatchObject({ lift: true, precision: true, supported: true, completed: false, parts: 0 })
    expect(availablePartners(w).map(p => p.id)).toEqual(['atu', 'adeng', 'xiaoman', 'xiaoquan', 'ayan', 'amu'])
    const before = structuredClone(w)
    expect(performDeep(w, 'lift').ok).toBe(false); expect(w).toEqual(before)
    expect(deepGoal(w).action).toBe('ride-home')
    expect(performDeep(w, 'ride-home').ok).toBe(true)
    expect(w.deep.completed).toBe(true); expect(deepGoal(w).done).toBe(13)
    expect(deserialize(serialize(w))).toMatchObject({ ok: true })
  })

  it('未相遇不能凿岩或进入，未结束第二层不能跳章；失败不消耗也不改图', () => {
    const w = createInitialWorld(), before = structuredClone(w)
    for (const action of ['meet', 'excavate', 'enter', 'discover', 'collect', 'smelt', 'lift', 'ride-home'] as const) expect(performDeep(w, action).ok).toBe(false)
    expect(canDig(w, 27, 22).ok).toBe(false); expect(w).toEqual(before)
    const ready = secondLayerComplete()
    expect(deepActionProblem(ready, 'enter')).toContain('阿岩')
    expect(deepFrontier(ready)).toEqual({ x: 27, y: 22 })
    enterDeep(ready)
    const beforeBuild = structuredClone(ready)
    expect(buildDeep(ready, 'collector', 24)).toMatchObject({ ok: false })
    expect(ready).toEqual(beforeBuild)
  })

  it('材料不足、重叠、梯口、天然晶根和未开挖的地块不可建；选址自由并可撤销', () => {
    const w = secondLayerComplete(); enterDeep(w); performDeep(w, 'discover')
    expect(deepBuildProblem(w, 'collector', 27)).toContain('梯口')
    expect(deepBuildProblem(w, 'collector', 30)).toContain('晶簇')
    expect(deepBuildProblem(w, 'collector', 20)).toContain('挖')
    w.inventory = { stone: 0, wood: 0 }
    const before = structuredClone(w)
    expect(buildDeep(w, 'collector', 24).ok).toBe(false); expect(w).toEqual(before)
    w.inventory = { stone: 20, wood: 20 }
    const result = buildDeep(w, 'collector', 24)
    expect(result.ok).toBe(true)
    expect(buildDeep(w, 'collector', 31).ok).toBe(false)
    if (!result.ok) return
    w.inventory.stone += 7 // 后续挖土的材料不能被撤销建造抹掉。
    expect(undoDeep(w, result.change)).toBe(true)
    expect(w.inventory).toEqual({ stone: 27, wood: 20 })
    expect(buildDeep(w, 'collector', 31).ok).toBe(true)
  })

  it('资源循环可以补充，精密工具改变真实产量，升级不重复扣材料', () => {
    const w = workingDeep()
    w.deep.ore = 0; w.deep.crystals = 0
    expect(performDeep(w, 'smelt').ok).toBe(false)
    expect(performDeep(w, 'collect').ok).toBe(true)
    expect(w.deep).toMatchObject({ crystals: 3, ore: 2 })
    performDeep(w, 'smelt'); performDeep(w, 'precision'); performDeep(w, 'collect'); performDeep(w, 'smelt')
    expect(performDeep(w, 'craft').ok).toBe(true); expect(w.deep.parts).toBe(2)
    const before = structuredClone(w.deep)
    expect(performDeep(w, 'precision').ok).toBe(false); expect(w.deep).toEqual(before)
  })

  it('硬岩镐只开指定矿脉，矿石真实入包；普通挖掘与撤销保留闭环', () => {
    const w = workingDeep(); w.deep.parts = 2; w.deep.ingots = 3
    performDeep(w, 'pickaxe')
    expect(canDig(w, 9, 30).ok).toBe(false)
    for (const y of [33, 32, 31]) dig(w, 12, y)
    const history = createWorldHistory(), ore = w.deep.ore
    expect(canDig(w, 11, 33).ok).toBe(true)
    const plan = soilPlan(w, w.exploration.explorer!, { x: 11, y: 33 })
    expect(plan.ok).toBe(true)
    expect(dig(w, 11, 33).ok).toBe(true); history.record({ kind: 'dig', x: 11, y: 33, tile: TILE.ROCK })
    expect(w.deep.ore).toBe(ore + 2)
    expect(history.undo(w)).not.toBeNull(); expect(w.deep.ore).toBe(ore)
    expect(w.tiles[33][11]).toBe(TILE.ROCK)
  })
})

describe('三层存档与迁移', () => {
  it('v16 的真实 44×28 存档逐格保留前两层，补出第三层，输入不被修改', () => {
    const payload = serialize(secondLayerComplete())
    payload.version = 16; payload.world.height = 28; payload.world.tiles = payload.world.tiles.slice(0, 28)
    delete (payload.world as Partial<typeof payload.world>).deep
    const before = structuredClone(payload), result = deserialize(payload)
    expect(result.ok).toBe(true); expect(payload).toEqual(before)
    if (!result.ok) return
    expect(result.world.height).toBe(112); expect(result.world.tiles.slice(0, 28)).toEqual(payload.world.tiles)
    expect(result.world.deep).toEqual(freshDeep()); expect(result.world.builtSites).toEqual(payload.world.builtSites)
    expect(deserialize(serialize(result.world))).toMatchObject({ ok: true })
  })
  it('完整设施、升级、材料和角色在第三层的位置都能往返；中间施工可恢复', () => {
    const w = liftReady(); w.exploration.explorer = { x: 31, y: 33 }; w.workers.amu = { x: 32, y: 33 }
    const result = deserialize(serialize(w))
    expect(result).toMatchObject({ ok: true })
    if (result.ok) expect(result.world).toEqual(w)
    const partial = secondLayerComplete(); performDeep(partial, 'meet')
    partial.tiles[22][27] = TILE.EMPTY; partial.workers.ayan = { x: 27, y: 22 }
    expect(deserialize(serialize(partial))).toMatchObject({ ok: true })
  })
  it.each(['negative', 'unknown', 'overlap', 'fake-lift', 'missing-power', 'through-rock'] as const)('损坏状态 %s 被明确拒绝', kind => {
    const save = serialize(workingDeep())
    if (kind === 'negative') save.world.deep.parts = -1
    if (kind === 'unknown') (save.world.deep.facilities[0] as { kind: string }).kind = 'shop'
    if (kind === 'overlap') save.world.deep.facilities[1].x = 24
    if (kind === 'fake-lift') save.world.deep.lift = true
    if (kind === 'missing-power') save.world.powerDown = false
    if (kind === 'through-rock') save.world.tiles[25][20] = TILE.EMPTY
    expect(deserialize(save)).toMatchObject({ ok: false })
  })
})
