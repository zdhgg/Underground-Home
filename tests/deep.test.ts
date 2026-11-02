import { describe, expect, it } from 'vitest'
import { buildDeep, deepActionProblem, deepBuildOptions, deepBuildProblem, deepCandidate, deepGoal, deepSuggestion, deepSpotProblem, performDeep, undoDeep } from '../src/core/deep'
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

  it('大目标轨道：十三个小步归入四个里程碑，晶簇发现后才亮出电梯计划', () => {
    const w = secondLayerComplete()
    expect(deepGoal(w).milestone).toBe(0)
    enterDeep(w)
    expect(deepGoal(w).milestone).toBe(1)
    expandDeep(w); performDeep(w, 'discover')
    expect(deepGoal(w)).toMatchObject({ milestone: 1, build: 'collector' })
    expect(deepGoal(w).speech).toContain('电梯')
    for (const [kind, x] of [['collector', 24], ['distributor', 28], ['lamp', 36]] as const) buildDeep(w, kind, x)
    expect(deepGoal(w).milestone).toBe(2)
    for (const [kind, x] of [['workshop', 31], ['furnace', 21]] as const) buildDeep(w, kind, x)
    expect(deepGoal(w).milestone).toBe(3)
    performDeep(w, 'smelt')
    expect(deepGoal(w).speech).toContain('先做 1 个，把竖井支撑牢')
    const done = liftReady()
    expect(deepGoal(done).milestone).toBe(3)
    performDeep(done, 'ride-home')
    expect(deepGoal(done).milestone).toBe(4)
  })

  it('章末尾声落在楼上：一层还有没暖灯的小窝时，先做部件再乘梯回窝装灯', () => {
    const w = liftReady()
    performDeep(w, 'ride-home')
    expect(w.deep.completed).toBe(true)
    expect(deepGoal(w)).toMatchObject({ action: 'collect', done: 13 })
    w.deep.parts = 1
    expect(deepGoal(w)).toMatchObject({ action: 'ride-home' })
    w.exploration.explorer = { x: w.exploration.shaftX!, y: 11 }
    expect(deepGoal(w)).toMatchObject({ action: undefined, visitPod: w.pods[0].id, label: '去小窝看看暖光灯' })
    w.pods.forEach(p => { p.warmLamp = true })
    expect(deepGoal(w)).toMatchObject({ action: 'ride-crystal' })
  })

  it.each([
    { crystals: 0, ore: 0, ingots: 0, action: 'collect' },
    { crystals: 0, ore: 3, ingots: 2, action: 'collect' },
    { crystals: 1, ore: 2, ingots: 0, action: 'smelt' },
    { crystals: 1, ore: 0, ingots: 2, action: 'craft' },
  ] as const)('暖灯尾声按真实库存给出可立即执行的 $action', ({ action, ...resources }) => {
    const w = liftReady(); performDeep(w, 'ride-home')
    Object.assign(w.deep, resources, { parts: 0 })
    expect(deepGoal(w).action).toBe(action)
    expect(deepActionProblem(w, action)).toBeNull()
  })

  it('建设目录列出还没建的设施和前置原因，建完一件少一件', () => {
    const w = secondLayerComplete(); enterDeep(w); expandDeep(w)
    expect(deepBuildOptions(w)).toEqual([])
    performDeep(w, 'discover')
    const options = deepBuildOptions(w)
    expect(options.map(o => o.kind)).toEqual(['collector', 'distributor', 'lamp', 'workshop', 'furnace'])
    expect(options.find(o => o.kind === 'workshop')!.locked).toBe('先装稳光配电箱')
    expect(options.find(o => o.kind === 'distributor')!.locked).toBeNull()
    buildDeep(w, 'distributor', 28)
    expect(deepBuildOptions(w).every(o => o.locked === null)).toBe(true)
    for (const [kind, x] of [['collector', 24], ['lamp', 36], ['workshop', 31], ['furnace', 21]] as const) buildDeep(w, kind, x)
    expect(deepBuildOptions(w)).toEqual([])
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

  it('推荐位只作提示不限制选址：采集台贴天然晶簇，建议位真可建且避开梯口和发现点', () => {
    const w = secondLayerComplete(); enterDeep(w); expandDeep(w); performDeep(w, 'discover')
    const spot = deepSuggestion(w, 'collector')
    expect(spot).not.toBeNull()
    if (spot === null) return
    expect(deepSpotProblem(w, 'collector', spot)).toBeNull()
    for (let col = spot; col < spot + 3; col++) expect([27, 30, 38, 19]).not.toContain(col)
    expect(buildDeep(w, 'collector', spot).ok).toBe(true)
    expect(deepSuggestion(w, 'collector')).toBeNull()
    const distributor = deepSuggestion(w, 'distributor')
    expect(distributor).not.toBeNull()
    if (distributor === null) return
    expect(buildDeep(w, 'distributor', distributor).ok).toBe(true)
    expect(deepSuggestion(w, 'lamp')).not.toBeNull()
  })

  it('石炉优先贴着工坊，放不下时退回梯口就近；材料不足照样给位置（提示交给红框说明）', () => {
    const w = secondLayerComplete(); enterDeep(w); expandDeep(w); performDeep(w, 'discover')
    expect(buildDeep(w, 'distributor', 28).ok).toBe(true)
    expect(buildDeep(w, 'workshop', 31).ok).toBe(true)
    const spot = deepSuggestion(w, 'furnace')
    expect(spot).not.toBeNull()
    if (spot === null) return
    expect(deepSpotProblem(w, 'furnace', spot)).toBeNull()
    for (let col = spot; col < spot + 3; col++) expect([27, 30, 38, 19]).not.toContain(col)
    const adjacent = spot === 28 - 3 || spot === 31 + 5
    const near = Math.min(Math.abs(spot - 27), Math.abs(spot + 2 - 27))
    expect(adjacent || near <= 4).toBe(true)
    // 建议位只看空间：材料不够时依旧给出位置，点下去由红框说明差什么。
    w.inventory = { stone: 0, wood: 0 }
    expect(deepSuggestion(w, 'furnace')).toBe(spot)
    expect(deepBuildProblem(w, 'furnace', spot)).toContain('还需要')
  })

  it('点击换算吸附到能放下的位置：盖住点击列、点推荐位取推荐位、放不下保留点击列', () => {
    const w = secondLayerComplete(); enterDeep(w); expandDeep(w); performDeep(w, 'discover')
    // 点中格想盖住它自己：宽 3 的采集台以点击列居中，不会整件偏到右侧。
    expect(deepCandidate(w, 'collector', 24)).toBe(23)
    // 推荐位框内任何一点都落在推荐位本身。
    const suggested = deepSuggestion(w, 'collector')!
    expect(deepCandidate(w, 'collector', suggested + 1)).toBe(suggested)
    expect(deepCandidate(w, 'collector', suggested)).toBe(suggested)
    // 盖住天然晶簇那一列无处可放：保留点击列，让红框说明原因。
    expect(deepCandidate(w, 'collector', 30)).toBe(30)
    // 宽 5 的工坊点在洞口右侧：原样放会越界，滑回最近能盖住点击列、又不压住发现点的位置。
    expect(buildDeep(w, 'distributor', 28).ok).toBe(true)
    const workshop = deepCandidate(w, 'workshop', 37)
    expect(deepSpotProblem(w, 'workshop', workshop)).toBeNull()
    expect(37).toBeGreaterThanOrEqual(workshop)
    expect(37).toBeLessThan(workshop + 5)
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
