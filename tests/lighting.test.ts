import { describe, expect, it } from 'vitest'
import type { Graphics } from 'pixi.js'
import { createInitialWorld, TILE, WORLD_VERSION, type WorldState } from '../src/core/world'
import { canRetrofitLamp, hasWideLampAbility, lampCoverage, lightField, lightingOpportunity, retrofitLamp, WIDE_LAMP_ID } from '../src/core/lighting'
import { upgradePartner, wideLampUpgrade } from '../src/core/partnerAbilities'
import { partnerConversation } from '../src/core/partnerInteractions'
import { initializeWorkers, planPartnerWork } from '../src/core/partnerWork'
import { createWorldHistory } from '../src/core/history'
import { deserialize, serialize } from '../src/core/persistence'
import { LightingScene } from '../src/render/lightingScene'

function ready(): WorldState {
  const w = createInitialWorld()
  w.progress = { crystalFound: true, crystalCollected: true, coreRepaired: true }; w.tiles[9][14] = TILE.EMPTY
  for (let x = 12; x <= 14; x++) for (const y of [10, 11]) w.tiles[y][x] = TILE.EMPTY
  w.pods = [{ id: 1, x: 12, y: 10, door: 'right' }]
  for (const x of [26, 27]) for (const y of [10, 11]) w.tiles[y][x] = TILE.EMPTY
  for (let y = 12; y <= 21; y++) w.tiles[y][27] = TILE.EMPTY
  for (let x = 18; x <= 38; x++) for (const y of [19, 20, 21]) w.tiles[y][x] = TILE.EMPTY
  w.exploration = { clueFound: true, pickaxeUpgraded: true, entered: true, springFound: true, metXiaoman: false, foundMushroom: false, foundClay: false, shaftX: 27, explorer: { x: 27, y: 21 }, lamps: [{ x: 31, y: 19 }] }
  w.powerDown = true; initializeWorkers(w)
  return w
}

describe('聚光灯规则与成长', () => {
  it('真实覆盖由左右各2格扩大到4格，预读不修改地图、资源或发现状态', () => {
    const w = ready(), before = structuredClone(w), lamp = w.exploration.lamps[0]
    const normal = lampCoverage(w, lamp), wide = lampCoverage(w, lamp, true)
    expect([...new Set(normal.map(p => p.x))].sort((a, b) => a - b)).toEqual([29, 30, 31, 32, 33])
    expect([...new Set(wide.map(p => p.x))].sort((a, b) => a - b)).toEqual([27, 28, 29, 30, 31, 32, 33, 34, 35])
    expect(wide.find(p => p.x === 34 && p.y === 21)?.strength).toBeGreaterThan(0)
    expect(normal.some(p => p.x === 34)).toBe(false); expect(w).toEqual(before)
  })

  it('土岩截断横向传播，光不落到未挖格，不能提前照亮未开放层', () => {
    const w = ready(), lamp = w.exploration.lamps[0]
    w.tiles[20][33] = TILE.SOIL
    expect(lampCoverage(w, lamp, true).some(p => p.x >= 33)).toBe(false)
    w.tiles[20][33] = TILE.ROCK
    expect(lampCoverage(w, lamp, true).some(p => p.x >= 33)).toBe(false)
    w.tiles[20][33] = TILE.EMPTY; w.tiles[19][32] = TILE.SOIL
    expect(lampCoverage(w, lamp, true).some(p => p.x === 32 && p.y === 19)).toBe(false)
    w.exploration.entered = false; expect(lampCoverage(w, lamp, true)).toEqual([])
    w.exploration.entered = true; w.powerDown = false; expect(lampCoverage(w, lamp, true)).toEqual([])
  })

  it('只有已送电、有普通灯且存在可达覆盖缺口时才出现建议', () => {
    const w = ready()
    expect(wideLampUpgrade(w).state).toBe('ready')
    const opportunity = lightingOpportunity(w)!
    expect(Math.abs(opportunity.target.x - opportunity.lamp.x)).toBeGreaterThan(2)
    w.powerDown = false; expect(wideLampUpgrade(w).state).toBe('locked')
    expect(wideLampUpgrade(w).lockedHint).toContain('电')
    w.powerDown = true; w.exploration.lamps = []; expect(wideLampUpgrade(w).state).toBe('locked')
    w.exploration.lamps = [28, 31, 34, 37, 21, 24].map(x => ({ x, y: 19 }))
    w.tiles[20][20] = TILE.SOIL // 泉水近旁没有合法灯位，以土面截断这一侧的候选覆盖。
    expect(lightingOpportunity(w)).toBeNull()
  })

  it('学习只保存一个稳定升级ID，不扣资源、不自动改旧灯，其他角色/未知升级不能冒领', () => {
    const w = ready(), before = structuredClone(w)
    expect(partnerConversation(w, 'adeng')?.action?.id).toBe('learn-wide-lamp')
    for (const id of ['atu', 'xiaoman', 'xiaoquan', 'unknown']) expect(upgradePartner(w, id, WIDE_LAMP_ID)).toBe(false)
    expect(upgradePartner(w, 'adeng', 'unknown')).toBe(false)
    expect(upgradePartner(w, 'adeng', WIDE_LAMP_ID)).toBe(true)
    expect(upgradePartner(w, 'adeng', WIDE_LAMP_ID)).toBe(false)
    expect(w).toEqual({ ...before, partnerUpgrades: [WIDE_LAMP_ID] })
    expect(partnerConversation(w, 'adeng')?.upgrade?.equippedLabel).toBe('已学会')
    expect(partnerConversation(w, 'adeng')?.action?.id).toBe('place-wide-lamp')
  })

  it('能力与灯配置独立：加装才扩大实际光场，重复加装无效，撤销保留原灯和学会的能力', () => {
    const w = ready(), before = lightField(w), history = createWorldHistory()
    expect(canRetrofitLamp(w, 31)).toBe(false)
    upgradePartner(w, 'adeng', WIDE_LAMP_ID)
    expect(lightField(w)).toEqual(before)
    const plan = planPartnerWork(w, { kind: 'lamp-retrofit', x: 31 })
    expect(plan.ok).toBe(true); if (plan.ok) expect(plan.plan.at).toEqual({ x: 31, y: 21 })
    expect(retrofitLamp(w, 31)).toBe(true); history.record({ kind: 'lamp-retrofit', x: 31 })
    expect(retrofitLamp(w, 31)).toBe(false); expect(lightField(w).length).toBeGreaterThan(before.length)
    expect(history.undo(w)?.kind).toBe('lamp-retrofit')
    expect(w.exploration.lamps).toEqual([{ x: 31, y: 19 }]); expect(lightField(w)).toEqual(before)
    expect(hasWideLampAbility(w)).toBe(true)
  })

  it('旧灯仍可用；撤销新聚光灯不撤回能力，光场不把重叠灯重复叠亮', () => {
    const w = ready(); upgradePartner(w, 'adeng', WIDE_LAMP_ID)
    w.exploration.lamps.push({ x: 34, y: 19, wide: true })
    const history = createWorldHistory(); history.record({ kind: 'lamp', x: 34, y: 19 })
    const field = lightField(w)
    expect(new Set(field.map(p => `${p.x},${p.y}`)).size).toBe(field.length)
    history.undo(w); expect(w.exploration.lamps).toEqual([{ x: 31, y: 19 }]); expect(hasWideLampAbility(w)).toBe(true)
  })
})

describe('照明存档与画面', () => {
  it('v10迁移完整保留成果与普通灯，v11保留学会状态和逐盏配置', () => {
    const w = ready(), old = serialize(w); old.version = 10
    const migrated = deserialize(old)
    expect(migrated.ok).toBe(true)
    if (!migrated.ok) return
    expect(migrated.world).toEqual(w)
    upgradePartner(w, 'adeng', WIDE_LAMP_ID); retrofitLamp(w, 31)
    const save = serialize(w), loaded = deserialize(save)
    expect(save.version).toBe(WORLD_VERSION); expect(loaded.ok && loaded.world).toEqual(w)
  })

  it('未知/重复升级ID、缺失升级字段、冒用灯罩和非法配置均加载失败', () => {
    const w = ready(), save = serialize(w)
    for (const mutate of [
      (p: typeof save) => { p.world.partnerUpgrades = ['unknown'] },
      (p: typeof save) => { p.world.partnerUpgrades = [WIDE_LAMP_ID, WIDE_LAMP_ID] },
      (p: typeof save) => { delete (p.world as Partial<typeof p.world>).partnerUpgrades },
      (p: typeof save) => { p.world.exploration.lamps[0].wide = true },
      (p: typeof save) => { p.world.exploration.lamps[0].wide = 'yes' as unknown as true },
      (p: typeof save) => { p.world.partnerUpgrades = [WIDE_LAMP_ID]; p.world.powerDown = false },
    ]) { const raw = structuredClone(save); mutate(raw); expect(deserialize(raw).ok).toBe(false) }
  })

  it('格子光场与预览使用同一规则，只照已挖空空间，预览/刷新不改世界', () => {
    const w = ready(); upgradePartner(w, 'adeng', WIDE_LAMP_ID)
    const scene = new LightingScene(), before = structuredClone(w)
    scene.refresh(w); const normalInstructions = (scene.view.children[0] as Graphics).context.instructions.length
    expect(normalInstructions).toBeGreaterThan(0)
    scene.showPreview(w, { x: 31, y: 19 }); expect(scene.preview.context.instructions.length).toBeGreaterThan(0)
    expect(w).toEqual(before)
    retrofitLamp(w, 31); scene.refresh(w)
    expect((scene.view.children[0] as Graphics).context.instructions.length).toBeGreaterThan(normalInstructions)
    scene.showPreview(w, null); expect(scene.preview.context.instructions).toHaveLength(0)
    scene.view.destroy({ children: true }); scene.preview.destroy()
  })
})
