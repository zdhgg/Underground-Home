import { describe, expect, it } from 'vitest'
import { LANDMARKS, STRATA, TILE, createInitialWorld, tileAt } from '../src/core/world'
import { dig } from '../src/core/dig'
import { createWorldHistory } from '../src/core/history'
import { missionSummary } from '../src/core/missions'
import { RELICS, foundRelics, isRelicFound, relicAt, relicSummary } from '../src/core/relics'

const inRect = (rect: { x: number; y: number; w: number; h: number }, x: number, y: number): boolean =>
  x >= rect.x && x < rect.x + rect.w && y >= rect.y && y < rect.y + rect.h

describe('旧避难所遗物：埋在暖窝层，挖开才有发现', () => {
  it('每件遗物都埋在可挖的松软泥土里，且都在第一层', () => {
    const world = createInitialWorld()
    expect(RELICS.length).toBeGreaterThanOrEqual(3)
    for (const relic of RELICS) {
      expect(tileAt(world, relic.x, relic.y)).toBe(TILE.SOIL)
      expect(relic.y).toBeLessThan(STRATA.home.bottom)
    }
  })

  it('不压住能源石、能源核心、竖井和建造建议区，也不互相重叠', () => {
    const occupiedRects = [LANDMARKS.crystalZone, LANDMARKS.generatorZone, LANDMARKS.shaft, LANDMARKS.buildSuggestion]
    const seen = new Set<string>()
    for (const relic of RELICS) {
      expect(occupiedRects.some((rect) => inRect(rect, relic.x, relic.y))).toBe(false)
      expect(seen.has(`${relic.x},${relic.y}`)).toBe(false)
      seen.add(`${relic.x},${relic.y}`)
    }
  })

  it('没挖开不算发现，挖开那一格才算；计数跟着地图走', () => {
    const world = createInitialWorld()
    const first = RELICS[0]
    expect(relicSummary(world)).toEqual({ found: 0, total: RELICS.length })
    expect(foundRelics(world)).toEqual([])
    expect(relicAt(first.x, first.y)).toBe(first)
    expect(relicAt(first.x + 1, first.y)).toBeNull()

    expect(dig(world, first.x, first.y).ok).toBe(true)
    expect(isRelicFound(world, first)).toBe(true)
    expect(foundRelics(world)).toEqual([first])
    expect(relicSummary(world).found).toBe(1)
    // 挖别的地方不会误算
    expect(dig(world, first.x + 1, first.y).ok).toBe(true)
    expect(relicSummary(world).found).toBe(1)
  })

  it('挖到遗物不影响任务进度：它是发现，不是必做步骤', () => {
    const world = createInitialWorld()
    const before = missionSummary(world)
    const first = RELICS[0]
    expect(dig(world, first.x, first.y).ok).toBe(true)
    expect(missionSummary(world)).toEqual(before)
    expect(world.progress.crystalFound).toBe(false)
  })

  it('挖掘可撤销：撤销会把遗物埋回土里，再挖开又能发现', () => {
    const world = createInitialWorld()
    const history = createWorldHistory()
    const first = RELICS[0]
    expect(dig(world, first.x, first.y).ok).toBe(true)
    history.record({ kind: 'dig', x: first.x, y: first.y, tile: TILE.SOIL })
    expect(relicSummary(world).found).toBe(1)

    expect(history.undo(world)).toMatchObject({ kind: 'dig', x: first.x, y: first.y })
    expect(relicSummary(world).found).toBe(0)
    expect(dig(world, first.x, first.y).ok).toBe(true)
    expect(relicSummary(world).found).toBe(1)
  })
})
