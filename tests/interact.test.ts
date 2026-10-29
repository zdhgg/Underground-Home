import { describe, expect, it } from 'vitest'
import { collectCrystal, repairCore } from '../src/core/interact'
import { dig } from '../src/core/dig'
import { ENERGY_STONES } from '../src/core/energyStones'
import { LANDMARKS, TILE, createInitialWorld, tileAt } from '../src/core/world'

const left = LANDMARKS.crystal
const right = LANDMARKS.secondCrystal

function reveal(world: ReturnType<typeof createInitialWorld>, stone: { x: number; y: number }): void {
  dig(world, stone.x, stone.y)
}

function collectAll(world: ReturnType<typeof createInitialWorld>): void {
  for (const stone of ENERGY_STONES) {
    reveal(world, stone.cell)
    collectCrystal(world, stone.cell.x, stone.cell.y)
  }
}

describe('能源石互动（收集）', () => {
  it('落地入口处虽然已经挖空，也不能隔着泥土收走未发现的能源石', () => {
    const world = createInitialWorld()
    expect(world.tiles[9][15]).toBe(TILE.EMPTY)
    expect(collectCrystal(world, 15, 9)).toMatchObject({ ok: false, reason: 'not-revealed' })
    expect(world.progress.crystalCollected).toBe(false)
  })
  it('还没挖开时不能收集（泥土盖着）', () => {
    const world = createInitialWorld()
    const result = collectCrystal(world, left.x, left.y)
    expect(result.ok).toBe(false)
    expect(result.reason).toBe('not-revealed')
    expect(world.progress.crystalCollected).toBe(false)
  })

  it('挖开后可以收集', () => {
    const world = createInitialWorld()
    reveal(world, left)
    const result = collectCrystal(world, left.x, left.y)
    expect(result.ok).toBe(true)
    expect(result.stone).toBe('left')
    expect(world.progress.crystalCollected).toBe(true)
  })

  it('互动区有容错：点能源石旁边的空位也能收集', () => {
    const world = createInitialWorld()
    reveal(world, left)
    const result = collectCrystal(world, left.x + 1, left.y)
    expect(result.ok).toBe(true)
  })

  it('重复收集会被拒绝', () => {
    const world = createInitialWorld()
    reveal(world, left)
    collectCrystal(world, left.x, left.y)
    const again = collectCrystal(world, left.x, left.y)
    expect(again.ok).toBe(false)
    expect(again.reason).toBe('already-collected')
  })

  it('离能源石太远不能收集', () => {
    const world = createInitialWorld()
    reveal(world, left)
    const result = collectCrystal(world, left.x + 3, left.y)
    expect(result.ok).toBe(false)
    expect(result.reason).toBe('wrong-place')
  })

  it('撤销挖开的那一格后，能源石重新不能收集（要再挖开）', () => {
    const world = createInitialWorld()
    reveal(world, left)
    world.tiles[left.y][left.x] = TILE.SOIL // 模拟撤销
    const result = collectCrystal(world, left.x, left.y)
    expect(result.ok).toBe(false)
    expect(result.reason).toBe('not-revealed')
  })

  it('右翼那块单独判定：挖开、收集、重复收集互不影响左边那块', () => {
    const world = createInitialWorld()
    reveal(world, right)
    expect(world.progress.secondCrystalFound).toBe(true)
    expect(world.progress.crystalFound).toBe(false)
    expect(collectCrystal(world, right.x, right.y)).toMatchObject({ ok: true, stone: 'right' })
    expect(world.progress.secondCrystalCollected).toBe(true)
    expect(world.progress.crystalCollected).toBe(false)
    expect(collectCrystal(world, right.x, right.y)).toMatchObject({ ok: false, reason: 'already-collected' })
  })

  it('右翼那块没挖开时点它也只会继续挖，不会隔空收走', () => {
    const world = createInitialWorld()
    expect(collectCrystal(world, right.x, right.y)).toMatchObject({ ok: false, reason: 'not-revealed' })
    expect(world.progress.secondCrystalCollected).toBe(false)
  })
})

describe('能源核心互动（两级修复）', () => {
  it('还没收集能源石时不能修复', () => {
    const world = createInitialWorld()
    const result = repairCore(world, LANDMARKS.generator.x, LANDMARKS.generator.y)
    expect(result.ok).toBe(false)
    expect(result.reason).toBe('need-crystal')
    expect(world.progress.coreRepaired).toBe(false)
  })

  it('只收好一块时，核心先"装上一块"：亮一点点，但还不算点亮家园', () => {
    const world = createInitialWorld()
    reveal(world, left)
    collectCrystal(world, left.x, left.y)
    const result = repairCore(world, LANDMARKS.generator.x, LANDMARKS.generator.y)
    expect(result.ok).toBe(true)
    expect(result.stage).toBe('loaded')
    expect(world.progress.coreLoaded).toBe(true)
    expect(world.progress.coreRepaired).toBe(false)
  })

  it('装上一块后再点核心：提示还差一块', () => {
    const world = createInitialWorld()
    reveal(world, left)
    collectCrystal(world, left.x, left.y)
    repairCore(world, LANDMARKS.generator.x, LANDMARKS.generator.y)
    const again = repairCore(world, LANDMARKS.generator.x, LANDMARKS.generator.y)
    expect(again.ok).toBe(false)
    expect(again.reason).toBe('need-more-stones')
    expect(world.progress.coreRepaired).toBe(false)
  })

  it('两块都收好后点核心，一次点亮家园', () => {
    const world = createInitialWorld()
    collectAll(world)
    const result = repairCore(world, LANDMARKS.generator.x, LANDMARKS.generator.y)
    expect(result.ok).toBe(true)
    expect(result.stage).toBe('repaired')
    expect(world.progress.coreLoaded).toBe(true)
    expect(world.progress.coreRepaired).toBe(true)
  })

  it('顺序无关：先收右翼那块，两块齐了照样一次点亮', () => {
    const world = createInitialWorld()
    const reversed = [...ENERGY_STONES].reverse()
    for (const stone of reversed) {
      reveal(world, stone.cell)
      collectCrystal(world, stone.cell.x, stone.cell.y)
    }
    const result = repairCore(world, LANDMARKS.generator.x, LANDMARKS.generator.y)
    expect(result).toMatchObject({ ok: true, stage: 'repaired' })
  })

  it('互动区容错：点核心区的边角也能修复', () => {
    const world = createInitialWorld()
    collectAll(world)
    const corner = {
      x: LANDMARKS.generatorZone.x + LANDMARKS.generatorZone.w - 1,
      y: LANDMARKS.generatorZone.y + LANDMARKS.generatorZone.h - 1,
    }
    expect(repairCore(world, corner.x, corner.y).ok).toBe(true)
  })

  it('重复修复会被拒绝', () => {
    const world = createInitialWorld()
    collectAll(world)
    repairCore(world, LANDMARKS.generator.x, LANDMARKS.generator.y)
    const again = repairCore(world, LANDMARKS.generator.x, LANDMARKS.generator.y)
    expect(again.ok).toBe(false)
    expect(again.reason).toBe('already-repaired')
  })

  it('离核心太远不能修复', () => {
    const world = createInitialWorld()
    collectAll(world)
    const result = repairCore(world, LANDMARKS.generator.x - 5, LANDMARKS.generator.y)
    expect(result.ok).toBe(false)
    expect(result.reason).toBe('wrong-place')
  })
})

describe('互动不改动地图', () => {
  it('收集与修复只改变进度位，不改瓦片和统计', () => {
    const world = createInitialWorld()
    reveal(world, left)
    const tilesBefore = JSON.stringify(world.tiles)
    const dugBefore = world.dugCount
    collectCrystal(world, left.x, left.y)
    repairCore(world, LANDMARKS.generator.x, LANDMARKS.generator.y)
    expect(JSON.stringify(world.tiles)).toBe(tilesBefore)
    expect(world.dugCount).toBe(dugBefore)
    expect(tileAt(world, left.x, left.y)).toBe(TILE.EMPTY)
  })
})
