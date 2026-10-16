import { describe, expect, it } from 'vitest'
import { dig } from '../src/core/dig'
import { createDigHistory } from '../src/core/history'
import { missionSummary } from '../src/core/missions'
import { LANDMARKS, TILE, createInitialWorld, tileAt } from '../src/core/world'

describe('挖掘撤销', () => {
  it('撤销一次挖掘：恢复泥土、统计回退', () => {
    const world = createInitialWorld()
    const history = createDigHistory()
    dig(world, 13, 9)
    history.record(13, 9)
    expect(tileAt(world, 13, 9)).toBe(TILE.EMPTY)

    const restored = history.undo(world)
    expect(restored).toEqual({ x: 13, y: 9 })
    expect(tileAt(world, 13, 9)).toBe(TILE.SOIL)
    expect(world.dugCount).toBe(0)
  })

  it('后进先出：连续撤销按倒序恢复', () => {
    const world = createInitialWorld()
    const history = createDigHistory()
    dig(world, 12, 9)
    history.record(12, 9)
    dig(world, 13, 9)
    history.record(13, 9)

    history.undo(world)
    expect(tileAt(world, 13, 9)).toBe(TILE.SOIL)
    expect(tileAt(world, 12, 9)).toBe(TILE.EMPTY)
    history.undo(world)
    expect(tileAt(world, 12, 9)).toBe(TILE.SOIL)
    expect(world.dugCount).toBe(0)
  })

  it('没有可撤销的操作时返回 null', () => {
    const world = createInitialWorld()
    const history = createDigHistory()
    expect(history.undo(world)).toBeNull()
    expect(history.size()).toBe(0)
  })

  it('撤销后可以重新挖回来', () => {
    const world = createInitialWorld()
    const history = createDigHistory()
    dig(world, 13, 9)
    history.record(13, 9)
    history.undo(world)
    const again = dig(world, 13, 9)
    expect(again.ok).toBe(true)
    expect(world.dugCount).toBe(1)
  })

  it('历史容量有限：超出上限时丢弃最旧记录', () => {
    const world = createInitialWorld()
    const history = createDigHistory(2)
    for (const x of [12, 13, 14]) {
      dig(world, x, 9)
      history.record(x, 9)
    }
    expect(history.size()).toBe(2)
    expect(history.undo(world)).toEqual({ x: 14, y: 9 })
    expect(history.undo(world)).toEqual({ x: 13, y: 9 })
    expect(history.undo(world)).toBeNull()
    expect(tileAt(world, 12, 9)).toBe(TILE.EMPTY) // 最早的记录已被丢弃
    expect(world.dugCount).toBe(1)
  })

  it('撤销挖掘不会回退任务进度（已发现能源石保持完成）', () => {
    const world = createInitialWorld()
    const history = createDigHistory()
    dig(world, LANDMARKS.crystal.x, LANDMARKS.crystal.y)
    history.record(LANDMARKS.crystal.x, LANDMARKS.crystal.y)
    expect(missionSummary(world).done).toBe(1)

    history.undo(world)
    expect(tileAt(world, LANDMARKS.crystal.x, LANDMARKS.crystal.y)).toBe(TILE.SOIL)
    expect(missionSummary(world).done).toBe(1) // 进度不回退
    expect(world.progress.crystalFound).toBe(true)
  })
})
