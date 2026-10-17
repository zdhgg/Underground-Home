import { describe, expect, it, vi } from 'vitest'
import { BREAKTHROUGHS, createInitialWorld, STRATA, TILE, TILE_SIZE, MAP_WIDTH, MAP_HEIGHT, LANDMARKS, HOME_ROOM_TOP, HOME_FLOOR_Y } from '../src/core/world'
import { canDig, dig } from '../src/core/dig'
import { canPlacePod } from '../src/core/build'
import { createWorldHistory } from '../src/core/history'
import { PROTOTYPE_DB_NAME, createIndexedDbStore, deserialize, serialize } from '../src/core/persistence'
import { cameraDepth, centerOn, overviewCamera, worldToScreen } from '../src/render/camera'

describe('连续双层空间的边界', () => {
  it('住宅两翼只有3格净高，地板横贯整层，不能一层内再挖出多层', () => {
    const world = createInitialWorld()
    expect(HOME_FLOOR_Y - HOME_ROOM_TOP).toBe(3)
    for (let x = 2; x < world.width - 2; x++) {
      expect(world.tiles[HOME_FLOOR_Y][x]).toBe(BREAKTHROUGHS.some((column) => column === x) ? TILE.WEAK_ROCK : TILE.ROCK)
      expect(world.tiles[HOME_ROOM_TOP - 1][x]).not.toBe(TILE.SOIL)
    }
  })
  it('厚岩层完整隔开上下空间，任何位置都不能误挖穿', () => {
    const world = createInitialWorld()
    for (let y = STRATA.seal.top; y < STRATA.seal.bottom; y++) for (let x = 0; x < world.width; x++) {
      const weak = BREAKTHROUGHS.some((column) => column === x)
      expect(world.tiles[y][x]).toBe(weak ? TILE.WEAK_ROCK : TILE.ROCK)
      expect(canDig(world, x, y).reason).toBe(weak ? 'tool' : 'rock')
    }
    expect(LANDMARKS.spring.y).toBeGreaterThan(STRATA.water.top)
    expect(world.tiles[LANDMARKS.spring.y][LANDMARKS.spring.x]).toBe(TILE.SOIL)
  })

  it('第二层的土、天然洞和岩石都不可挖建，失败不改变进度', () => {
    const world = createInitialWorld()
    world.progress.coreRepaired = true
    const before = serialize(world).world
    for (let y = STRATA.water.top; y < world.height; y++) for (let x = 1; x < world.width - 1; x++) {
      expect(dig(world, x, y).ok).toBe(false)
    }
    expect(canPlacePod(world, 14, 19)).toEqual({ ok: false, reason: 'locked-layer' })
    expect(serialize(world).world).toEqual(before)
  })

  it('暖窝层新增的自由空间仍然单格挖掘、可以撤销，原大厅地基不变', () => {
    const world = createInitialWorld()
    expect(world.tiles.slice(4, 12).flat().filter((t) => t === TILE.SOIL).length).toBe(87)
    const before = structuredClone(world)
    const history = createWorldHistory()
    expect(dig(world, 36, 10).ok).toBe(true)
    history.record({ kind: 'dig', x: 36, y: 10 })
    expect(world.dugCount).toBe(1)
    expect(history.undo(world)).toEqual({ kind: 'dig', x: 36, y: 10 })
    expect(world).toEqual(before)
    expect(world.tiles[12][21]).toBe(TILE.ROCK)
  })
})

describe('分层镜头', () => {
  it('全景在横屏和平板内完整包含地图，同时独立于操作缩放', () => {
    for (const viewport of [{ width: 1200, height: 680 }, { width: 1000, height: 610 }]) {
      const camera = overviewCamera(viewport)
      const top = worldToScreen(camera, 0, 0)
      const bottom = worldToScreen(camera, MAP_WIDTH * TILE_SIZE, MAP_HEIGHT * TILE_SIZE)
      expect(top.x).toBeGreaterThanOrEqual(0)
      expect(top.y).toBeGreaterThanOrEqual(0)
      expect(bottom.x).toBeLessThanOrEqual(viewport.width)
      expect(bottom.y).toBeLessThanOrEqual(viewport.height)
      const water = centerOn(22 * TILE_SIZE, 20 * TILE_SIZE, viewport)
      expect(cameraDepth(water, viewport)).toEqual({ layer: 'water', overview: false })
    }
  })
})

describe('开发期存档隔离', () => {
  it('写请求成功但事务中止时，保存必须报告失败', async () => {
    const close = vi.fn()
    const transaction: { oncomplete?: () => void; onabort?: () => void; error: Error; objectStore: () => unknown } = {
      error: new Error('测试事务中止'),
      objectStore: () => ({ put: () => {
        const request: { onsuccess?: () => void; result: string } = { result: 'key' }
        queueMicrotask(() => { request.onsuccess?.(); transaction.onabort?.() })
        return request
      } }),
    }
    vi.stubGlobal('indexedDB', { open: () => {
      const request: { onsuccess?: () => void; result: unknown } = { result: { transaction: () => transaction, close } }
      queueMicrotask(() => request.onsuccess?.())
      return request
    } })
    try {
      await expect(createIndexedDbStore().save(serialize(createInitialWorld()))).rejects.toThrow('测试事务中止')
      expect(close).toHaveBeenCalledOnce()
    } finally { vi.unstubAllGlobals() }
  })

  it('默认只打开原型数据库，正式版名字永不被访问', async () => {
    const open = vi.fn(() => {
      const request = {} as IDBOpenDBRequest
      queueMicrotask(() => request.onerror?.(new Event('error')))
      return request
    })
    vi.stubGlobal('indexedDB', { open })
    try {
      await expect(createIndexedDbStore().load()).rejects.toThrow()
      expect(open).toHaveBeenCalledExactlyOnceWith(PROTOTYPE_DB_NAME, 1)
      expect(PROTOTYPE_DB_NAME).not.toBe('underground-home')
    } finally { vi.unstubAllGlobals() }
  })

  it('原型保存完整双层；真实旧尺寸存档返回错误，输入数据保持原样', () => {
    const payload = serialize(createInitialWorld())
    expect(deserialize(payload).ok).toBe(true)
    const legacy = structuredClone(payload)
    legacy.version = 3
    legacy.world.height = 29
    legacy.world.tiles = legacy.world.tiles.slice(0, 29)
    const before = structuredClone(legacy)
    expect(deserialize(legacy)).toEqual({ ok: false, error: '存档地图尺寸与当前版本不符' })
    expect(legacy).toEqual(before)
  })
})
