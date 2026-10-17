import { describe, expect, it } from 'vitest'
import {
  LANDMARKS,
  MAP_HEIGHT,
  MAP_WIDTH,
  SURFACE_Y,
  TILE,
  countTiles,
  createInitialWorld,
  isInside,
  tileAt,
} from '../src/core/world'

describe('初始世界蓝图', () => {
  const world = createInitialWorld()

  it('地图尺寸固定，初始没有挖过', () => {
    expect(world.width).toBe(MAP_WIDTH)
    expect(world.height).toBe(MAP_HEIGHT)
    expect(world.tiles).toHaveLength(MAP_HEIGHT)
    expect(world.tiles[0]).toHaveLength(MAP_WIDTH)
    expect(world.dugCount).toBe(0)
  })

  it('瓦片数量锁定蓝图（调整岩层蓝图时同步更新此用例）', () => {
    expect(countTiles(world, TILE.EMPTY)).toBe(125)
    expect(countTiles(world, TILE.SOIL)).toBe(141)
    expect(countTiles(world, TILE.ROCK)).toBe(777)
    expect(countTiles(world, TILE.WEAK_ROCK)).toBe(13)
  })

  it('避难所大厅与竖井初始已挖空', () => {
    expect(tileAt(world, 19, 9)).toBe(TILE.EMPTY)
    expect(tileAt(world, 21, SURFACE_Y)).toBe(TILE.EMPTY)
    expect(tileAt(world, 22, 6)).toBe(TILE.EMPTY)
  })

  it('能源石埋在可挖的松软泥土里', () => {
    expect(tileAt(world, LANDMARKS.crystal.x, LANDMARKS.crystal.y)).toBe(TILE.SOIL)
  })

  it('初始核心区域受保护：大厅四周是坚硬岩石', () => {
    expect(tileAt(world, 19, 6)).toBe(TILE.ROCK) // 大厅顶部
    expect(tileAt(world, 21, 12)).toBe(TILE.ROCK) // 大厅底部
  })

  it('地图边缘全是坚硬岩石，防止挖出边界', () => {
    for (let y = SURFACE_Y; y < MAP_HEIGHT; y++) {
      expect(tileAt(world, 0, y)).toBe(TILE.ROCK)
      expect(tileAt(world, MAP_WIDTH - 1, y)).toBe(TILE.ROCK)
    }
    expect(world.tiles[MAP_HEIGHT - 1].every((tile) => tile === TILE.ROCK)).toBe(true)
  })

  it('越界坐标不属于世界', () => {
    expect(isInside(world, -1, 5)).toBe(false)
    expect(isInside(world, MAP_WIDTH, 5)).toBe(false)
    expect(tileAt(world, MAP_WIDTH, 5)).toBeNull()
  })

  it('初始进度位全部未完成', () => {
    expect(world.progress).toEqual({ crystalFound: false, crystalCollected: false, coreRepaired: false })
  })
})
