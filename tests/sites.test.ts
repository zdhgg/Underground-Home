import { describe, expect, it, vi } from 'vitest'
import { createInitialWorld, TILE, WORLD_VERSION } from '../src/core/world'
import { dig } from '../src/core/dig'
import { initialAtuPosition, soilPlan } from '../src/core/atu'
import { BUILDING_SITES, finishSite, nextSiteDig, siteBlueprintVisible, siteBlocker, siteById, siteWorkCells, validBuiltSites } from '../src/core/sites'
import { canAfford, digLoot } from '../src/core/materials'
import { createWorldHistory } from '../src/core/history'
import { deserialize, serialize } from '../src/core/persistence'
import { SiteEditor, type SiteUI } from '../src/app/siteEditor'
import { inspectCrack, upgradePickaxe } from '../src/core/exploration'
import { placePod } from '../src/core/build'

function powered() {
  const w = createInitialWorld()
  w.progress = { crystalFound: true, crystalCollected: true, secondCrystalFound: true, secondCrystalCollected: true, coreLoaded: true, coreRepaired: true }; w.tiles[9][14] = TILE.EMPTY
  w.exploration.explorer = initialAtuPosition(w)
  return w
}
function watered() {
  const w = powered()
  for (let x = 12; x < 15; x++) for (let y = 10; y < 12; y++) dig(w, x, y)
  placePod(w, 12, 10)
  for (const x of [26, 27]) for (const y of [11, 10]) dig(w, x, y)
  inspectCrack(w, 27, 12); upgradePickaxe(w)
  for (let y = 12; y < 19; y++) if (w.tiles[y][27] !== TILE.EMPTY) dig(w, 27, y)
  w.exploration.entered = true; w.exploration.explorer = { x: 27, y: 21 }
  for (let x = 23; x >= 18; x--) for (const y of [21, 20]) dig(w, x, y)
  w.exploration.springFound = true; w.farm.waterSupplied = true
  return w
}
function excavate(w: ReturnType<typeof powered>, id: string) {
  const s = siteById(id)!
  for (let i = 0; i < 140; i++) {
    const cell = nextSiteDig(w, s)
    if (!cell) break
    const result = soilPlan(w, w.exploration.explorer!, cell)
    expect(result.ok).toBe(true)
    if (!result.ok) break
    w.exploration.explorer = { ...result.plan.stand }; expect(dig(w, cell.x, cell.y).ok).toBe(true)
  }
  expect(siteWorkCells(w, s).every(p => w.tiles[p.y][p.x] === TILE.EMPTY)).toBe(true)
}

describe('预设洞室与挖掘材料', () => {
  it('房间土层清空前不显示建筑蓝图，挖空房间本体后才显示', () => {
    const w = powered(), site = BUILDING_SITES[0]
    expect(siteBlueprintVisible(w, site)).toBe(false)
    for (let y = site.y; y < site.y + site.h; y++) for (let x = site.x; x < site.x + site.w; x++) w.tiles[y][x] = TILE.EMPTY
    expect(siteBlueprintVisible(w, site)).toBe(true)
  })

  it('第一间房材料足够，施工按可达单格推进，完工才扣材料和生成床', () => {
    const w = powered(), site = BUILDING_SITES[0]
    expect(canAfford(w, site.cost)).toBe(true)
    expect(finishSite(w, site, 'home')).toBeNull(); expect(w.pods).toEqual([])
    excavate(w, site.id)
    const before = { ...w.inventory }, change = finishSite(w, site, 'home')
    expect(change).not.toBeNull(); expect(w.pods).toHaveLength(1); expect(w.rooms[0].managed).toBe(true)
    expect(w.inventory).toEqual({ stone: before.stone - 3, wood: before.wood - 2 })
    expect(finishSite(w, site, 'home')).toBeNull(); expect(w.pods).toHaveLength(1)
    expect(validBuiltSites(w)).toBe(true); expect(deserialize(serialize(w)).ok).toBe(true)
  })

  it('客厅会先清出连接大厅的通路，不跳过土层或挖坏坚硬岩石', () => {
    const w = powered(), initial = structuredClone(w.tiles), site = siteById('home-lounge')!
    excavate(w, site.id)
    expect(w.tiles[10][26]).toBe(TILE.EMPTY); expect(w.tiles[11][27]).toBe(TILE.EMPTY)
    expect(finishSite(w, site, 'lounge')).not.toBeNull()
    for (let y = 0; y < w.height; y++) for (let x = 0; x < w.width; x++) if (initial[y][x] === TILE.ROCK) expect(w.tiles[y][x]).toBe(TILE.ROCK)
    expect(deserialize(serialize(w)).ok).toBe(true)
  })

  it.each(['garden', 'lounge'] as const)('第二层二选一洞室可建为%s，旁边仍有自由建设空间', kind => {
    const w = watered(), site = siteById('water-corner')!, free = structuredClone(w.tiles.map(row => row.slice(36)))
    excavate(w, site.id)
    const change = finishSite(w, site, kind)
    expect(change).not.toBeNull(); expect(w.builtSites).toContainEqual({ id: site.id, kind })
    expect(w.farm.planters.length).toBe(kind === 'garden' ? 2 : 0)
    expect(w.tiles.map(row => row.slice(36))).toEqual(free)
    expect(deserialize(serialize(w)).ok).toBe(true)
  })

  it('没接水或材料不足时不扣费、不生成设施，旧设施不被覆盖', () => {
    const w = watered(), site = siteById('spring-garden')!, before = structuredClone(w)
    w.farm.waterSupplied = false
    expect(siteBlocker(w, site, 'garden')).toContain('接到菜园')
    expect(finishSite(w, site, 'garden')).toBeNull()
    w.farm.waterSupplied = true; w.inventory = { stone: 0, wood: 0 }
    expect(siteBlocker(w, site, 'garden')).toContain('还需要')
    expect(finishSite(w, site, 'garden')).toBeNull(); expect(w.farm.planters).toEqual([])
    w.inventory = before.inventory; w.farm.planters.push({ id: 1, x: 28, y: 21, growth: 3 })
    expect(finishSite(w, site, 'garden')).toBeNull(); expect(w.farm.planters[0].growth).toBe(3)
  })

  it('掉落只在成功挖土后入包；撤销和重挖不重复刷材料，失败无掉落', () => {
    const w = powered(), before = { ...w.inventory }, history = createWorldHistory(), loot = digLoot(14, 11, TILE.SOIL)
    dig(w, 14, 11); history.record({ kind: 'dig', x: 14, y: 11, tile: TILE.SOIL })
    expect(w.inventory).toEqual({ stone: before.stone + loot.stone, wood: before.wood + loot.wood })
    dig(w, 14, 11); dig(w, 1, 1); dig(w, 0, 10)
    expect(history.undo(w)?.kind).toBe('dig'); expect(w.inventory).toEqual(before)
    dig(w, 14, 11); expect(w.inventory).toEqual({ stone: before.stone + loot.stone, wood: before.wood + loot.wood })
  })

  it('撤销建造退还材料，挖出的空间保留，重建后只扣一次', () => {
    const w = powered(), site = BUILDING_SITES[0], history = createWorldHistory()
    excavate(w, site.id); const before = structuredClone(w)
    history.record({ kind: 'site', change: finishSite(w, site, 'home')! })
    expect(history.undo(w)?.kind).toBe('site'); expect(w.pods).toEqual([]); expect(w.rooms).toEqual([])
    expect(w.inventory).toEqual(before.inventory); expect(w.tiles).toEqual(before.tiles)
    expect(finishSite(w, site, 'home')).not.toBeNull()
    expect(w.inventory.stone).toBe(before.inventory.stone - site.cost.stone)
  })

  it('取消施工后过期回调不能继续挖或建造，之后可重新开工', () => {
    const w = powered(); excavate(w, 'first-nest'); let done = () => {}; const states: SiteUI[] = [], cancel = vi.fn()
    const editor = new SiteEditor({ world: () => w, busy: () => false, emit: state => states.push(state), preview: vi.fn(), focus: vi.fn(), notify: vi.fn(), commit: vi.fn(), cancel,
      request: (_cell, _kind, callback) => { done = callback; return true },
    })
    editor.open(); const before = structuredClone(w); editor.build()
    expect(editor.working).toBe(true); const stale = done
    editor.cancel(); stale(); expect(editor.working).toBe(false); expect(w).toEqual(before); expect(cancel).toHaveBeenCalledOnce()
    editor.build(); expect(editor.working).toBe(true); expect(states.at(-1)?.working).toBe(true)
  })

  it('v13 整层设施存档：第一层三间房加第二层四件设施都能保存并重新加载', () => {
    const w = powered()
    w.inventory = { stone: 80, wood: 80 }
    const plan = [
      ['first-nest', 'home'],
      ['home-lounge', 'lounge'],
      ['friends-nest', 'home'],
      ['spring-garden', 'garden'],
      ['water-corner', 'lounge'],
      ['spring-kitchen', 'kitchen'],
      ['spring-table', 'dining'],
    ] as const
    for (const [id, kind] of plan.slice(0, 2)) {
      excavate(w, id)
      expect(finishSite(w, siteById(id)!, kind), id).not.toBeNull()
    }
    // 第一层之后补上第二层的探索成果；不在左翼预挖，免得挡住第一间小窝的施工面。
    for (const x of [26, 27]) { dig(w, x, 11); dig(w, x, 10) }
    inspectCrack(w, 27, 12); upgradePickaxe(w)
    for (let y = 12; y < 19; y++) if (w.tiles[y][27] !== TILE.EMPTY) dig(w, 27, y)
    w.exploration.entered = true; w.exploration.explorer = { x: 27, y: 21 }
    for (let x = 23; x >= 18; x--) { dig(w, x, 21); dig(w, x, 20) }
    w.exploration.springFound = true; w.farm.waterSupplied = true
    for (const [id, kind] of plan.slice(2)) {
      excavate(w, id)
      expect(finishSite(w, siteById(id)!, kind), id).not.toBeNull()
    }
    expect(w.builtSites).toHaveLength(plan.length)
    expect(validBuiltSites(w)).toBe(true)
    expect(deserialize(serialize(w))).toMatchObject({ ok: true })
  })

  it('v13保存材料和建造结果，v12迁移保留成果并补齐物品栏，损坏字段明确拒绝', () => {
    const w = powered(); excavate(w, 'first-nest'); finishSite(w, BUILDING_SITES[0], 'home')
    const raw = serialize(w); expect(raw.version).toBe(WORLD_VERSION); expect(deserialize(raw)).toMatchObject({ ok: true, world: w })
    const old = serialize(powered()); old.version = 12
    delete (old.world as Partial<typeof old.world>).inventory; delete (old.world as Partial<typeof old.world>).builtSites
    expect(deserialize(old)).toMatchObject({ ok: true, world: { inventory: { stone: 4, wood: 3 }, builtSites: [] } })
    for (const patch of [
      (p: typeof raw) => { p.world.inventory.stone = -1 },
      (p: typeof raw) => { p.world.inventory.wood = .5 },
      (p: typeof raw) => { p.world.builtSites.push({ id: 'unknown', kind: 'home' }) },
      (p: typeof raw) => { p.world.builtSites.push({ id: 'first-nest', kind: 'home' }) },
      (p: typeof raw) => { p.world.builtSites[0].kind = 'garden' },
      (p: typeof raw) => { p.world.rooms = []; p.world.pods = [] },
    ]) { const bad = structuredClone(raw); patch(bad); expect(deserialize(bad).ok).toBe(false) }
  })
})
