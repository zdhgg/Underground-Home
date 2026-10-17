import { describe, expect, it } from 'vitest'
import { collectCrystal, repairCore } from '../src/core/interact'
import { dig } from '../src/core/dig'
import { LANDMARKS, TILE, createInitialWorld, tileAt } from '../src/core/world'

describe('能源石互动（收集）', () => {
  it('落地入口处虽然已经挖空，也不能隔着泥土收走未发现的能源石', () => {
    const world = createInitialWorld()
    expect(world.tiles[9][15]).toBe(TILE.EMPTY)
    expect(collectCrystal(world, 15, 9)).toMatchObject({ ok: false, reason: 'not-revealed' })
    expect(world.progress.crystalCollected).toBe(false)
  })
  it('还没挖开时不能收集（泥土盖着）', () => {
    const world = createInitialWorld()
    const result = collectCrystal(world, LANDMARKS.crystal.x, LANDMARKS.crystal.y)
    expect(result.ok).toBe(false)
    expect(result.reason).toBe('not-revealed')
    expect(world.progress.crystalCollected).toBe(false)
  })

  it('挖开后可以收集', () => {
    const world = createInitialWorld()
    dig(world, LANDMARKS.crystal.x, LANDMARKS.crystal.y)
    const result = collectCrystal(world, LANDMARKS.crystal.x, LANDMARKS.crystal.y)
    expect(result.ok).toBe(true)
    expect(world.progress.crystalCollected).toBe(true)
  })

  it('互动区有容错：点能源石旁边的空位也能收集', () => {
    const world = createInitialWorld()
    dig(world, LANDMARKS.crystal.x, LANDMARKS.crystal.y)
    const result = collectCrystal(world, LANDMARKS.crystal.x + 1, LANDMARKS.crystal.y)
    expect(result.ok).toBe(true)
  })

  it('重复收集会被拒绝', () => {
    const world = createInitialWorld()
    dig(world, LANDMARKS.crystal.x, LANDMARKS.crystal.y)
    collectCrystal(world, LANDMARKS.crystal.x, LANDMARKS.crystal.y)
    const again = collectCrystal(world, LANDMARKS.crystal.x, LANDMARKS.crystal.y)
    expect(again.ok).toBe(false)
    expect(again.reason).toBe('already-collected')
  })

  it('离能源石太远不能收集', () => {
    const world = createInitialWorld()
    dig(world, LANDMARKS.crystal.x, LANDMARKS.crystal.y)
    const result = collectCrystal(world, LANDMARKS.crystal.x + 3, LANDMARKS.crystal.y)
    expect(result.ok).toBe(false)
    expect(result.reason).toBe('wrong-place')
  })

  it('撤销挖开的那一格后，能源石重新不能收集（要再挖开）', () => {
    const world = createInitialWorld()
    dig(world, LANDMARKS.crystal.x, LANDMARKS.crystal.y)
    world.tiles[LANDMARKS.crystal.y][LANDMARKS.crystal.x] = TILE.SOIL // 模拟撤销
    const result = collectCrystal(world, LANDMARKS.crystal.x, LANDMARKS.crystal.y)
    expect(result.ok).toBe(false)
    expect(result.reason).toBe('not-revealed')
  })
})

describe('能源核心互动（修复）', () => {
  it('还没收集能源石时不能修复', () => {
    const world = createInitialWorld()
    const result = repairCore(world, LANDMARKS.generator.x, LANDMARKS.generator.y)
    expect(result.ok).toBe(false)
    expect(result.reason).toBe('need-crystal')
    expect(world.progress.coreRepaired).toBe(false)
  })

  it('收好能源石后，点能源核心即可修复', () => {
    const world = createInitialWorld()
    dig(world, LANDMARKS.crystal.x, LANDMARKS.crystal.y)
    collectCrystal(world, LANDMARKS.crystal.x, LANDMARKS.crystal.y)
    const result = repairCore(world, LANDMARKS.generator.x, LANDMARKS.generator.y)
    expect(result.ok).toBe(true)
    expect(world.progress.coreRepaired).toBe(true)
  })

  it('互动区容错：点核心区的边角也能修复', () => {
    const world = createInitialWorld()
    dig(world, LANDMARKS.crystal.x, LANDMARKS.crystal.y)
    collectCrystal(world, LANDMARKS.crystal.x, LANDMARKS.crystal.y)
    const corner = {
      x: LANDMARKS.generatorZone.x + LANDMARKS.generatorZone.w - 1,
      y: LANDMARKS.generatorZone.y + LANDMARKS.generatorZone.h - 1,
    }
    expect(repairCore(world, corner.x, corner.y).ok).toBe(true)
  })

  it('重复修复会被拒绝', () => {
    const world = createInitialWorld()
    dig(world, LANDMARKS.crystal.x, LANDMARKS.crystal.y)
    collectCrystal(world, LANDMARKS.crystal.x, LANDMARKS.crystal.y)
    repairCore(world, LANDMARKS.generator.x, LANDMARKS.generator.y)
    const again = repairCore(world, LANDMARKS.generator.x, LANDMARKS.generator.y)
    expect(again.ok).toBe(false)
    expect(again.reason).toBe('already-repaired')
  })

  it('离核心太远不能修复', () => {
    const world = createInitialWorld()
    dig(world, LANDMARKS.crystal.x, LANDMARKS.crystal.y)
    collectCrystal(world, LANDMARKS.crystal.x, LANDMARKS.crystal.y)
    const result = repairCore(world, LANDMARKS.generator.x - 5, LANDMARKS.generator.y)
    expect(result.ok).toBe(false)
    expect(result.reason).toBe('wrong-place')
  })
})

describe('互动不改动地图', () => {
  it('收集与修复只改变进度位，不改瓦片和统计', () => {
    const world = createInitialWorld()
    dig(world, LANDMARKS.crystal.x, LANDMARKS.crystal.y)
    const tilesBefore = JSON.stringify(world.tiles)
    const dugBefore = world.dugCount
    collectCrystal(world, LANDMARKS.crystal.x, LANDMARKS.crystal.y)
    repairCore(world, LANDMARKS.generator.x, LANDMARKS.generator.y)
    expect(JSON.stringify(world.tiles)).toBe(tilesBefore)
    expect(world.dugCount).toBe(dugBefore)
    expect(tileAt(world, LANDMARKS.crystal.x, LANDMARKS.crystal.y)).toBe(TILE.EMPTY)
  })
})
