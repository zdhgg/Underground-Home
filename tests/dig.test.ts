import { describe, expect, it } from 'vitest'
import { canDig, dig } from '../src/core/dig'
import { LANDMARKS, TILE, createInitialWorld, tileAt } from '../src/core/world'

describe('挖掘规则', () => {
  it('松软泥土可以挖，且一次只挖一格', () => {
    const world = createInitialWorld()
    const result = dig(world, 13, 9)
    expect(result.ok).toBe(true)
    expect(tileAt(world, 13, 9)).toBe(TILE.EMPTY)
    expect(world.dugCount).toBe(1)
    expect(tileAt(world, 12, 9)).toBe(TILE.SOIL) // 相邻格不受影响
    expect(tileAt(world, 13, 8)).toBe(TILE.SOIL)
  })

  it('坚硬岩石不可挖', () => {
    const world = createInitialWorld()
    const result = canDig(world, 5, 9)
    expect(result.ok).toBe(false)
    expect(result.reason).toBe('rock')
    expect(dig(world, 5, 9).ok).toBe(false)
    expect(tileAt(world, 5, 9)).toBe(TILE.ROCK)
  })

  it('已经挖空的格子不能重复挖', () => {
    const world = createInitialWorld()
    const result = canDig(world, 21, 9)
    expect(result.ok).toBe(false)
    expect(result.reason).toBe('empty')
  })

  it('不能挖出地图边界', () => {
    const world = createInitialWorld()
    expect(canDig(world, -1, 9).reason).toBe('out-of-bounds')
    expect(canDig(world, world.width, 9).reason).toBe('out-of-bounds')
    expect(canDig(world, 10, world.height).reason).toBe('out-of-bounds')
  })

  it('不能挖地表以上的区域', () => {
    const world = createInitialWorld()
    const result = canDig(world, 10, 1)
    expect(result.ok).toBe(false)
    expect(result.reason).toBe('sky')
  })

  it('失败时世界数据保持不变', () => {
    const world = createInitialWorld()
    const snapshot = JSON.stringify(world.tiles)
    dig(world, 5, 9) // 岩石
    dig(world, -3, 9) // 越界
    dig(world, 21, 9) // 已挖空
    expect(JSON.stringify(world.tiles)).toBe(snapshot)
    expect(world.dugCount).toBe(0)
  })

  it('挖开能源石所在的泥土后，能源石露出（格子变空）', () => {
    const world = createInitialWorld()
    const result = dig(world, LANDMARKS.crystal.x, LANDMARKS.crystal.y)
    expect(result.ok).toBe(true)
    expect(tileAt(world, LANDMARKS.crystal.x, LANDMARKS.crystal.y)).toBe(TILE.EMPTY)
  })
})
