import { describe, expect, it } from 'vitest'
import { dig } from '../src/core/dig'
import { missionSummary } from '../src/core/missions'
import {
  SAVE_KEY,
  createMemoryStore,
  deserialize,
  serialize,
} from '../src/core/persistence'
import { LANDMARKS, WORLD_VERSION, createInitialWorld } from '../src/core/world'

describe('存档序列化与校验', () => {
  it('序列化-反序列化往返一致', () => {
    const world = createInitialWorld()
    dig(world, 13, 9)
    const payload = serialize(world)
    expect(payload.version).toBe(WORLD_VERSION)

    const result = deserialize(JSON.parse(JSON.stringify(payload)))
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.world.tiles).toEqual(world.tiles)
      expect(result.world.dugCount).toBe(world.dugCount)
    }
  })

  it('存档往返后任务状态保持一致', () => {
    const world = createInitialWorld()
    dig(world, LANDMARKS.crystal.x, LANDMARKS.crystal.y)
    const result = deserialize(serialize(world))
    expect(result.ok).toBe(true)
    if (result.ok) expect(missionSummary(result.world).done).toBe(1)
  })

  it('各种损坏的存档都被拒绝，并给出可读错误', () => {
    expect(deserialize(null).ok).toBe(false)
    expect(deserialize(42).ok).toBe(false)
    expect(deserialize({}).ok).toBe(false)
    expect(deserialize({ version: 999 }).ok).toBe(false)

    const payload = serialize(createInitialWorld())
    const wrongDims = { ...payload, world: { ...payload.world, width: 10 } }
    expect(deserialize(wrongDims).ok).toBe(false)

    const shortTiles = { ...payload, world: { ...payload.world, tiles: payload.world.tiles.slice(0, 5) } }
    expect(deserialize(shortTiles).ok).toBe(false)

    const badTile = JSON.parse(JSON.stringify(payload))
    badTile.world.tiles[5][5] = 9
    expect(deserialize(badTile).ok).toBe(false)

    const badCount = { ...payload, world: { ...payload.world, dugCount: -1 } }
    expect(deserialize(badCount).ok).toBe(false)
  })

  it('版本不匹配时报错信息包含两个版本号', () => {
    const result = deserialize({ version: 0, world: serialize(createInitialWorld()).world })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toContain('v0')
      expect(result.error).toContain(`v${WORLD_VERSION}`)
    }
  })
})

describe('存储适配器', () => {
  it('内存存储可以保存并恢复（模拟 IndexedDB 降级路径）', async () => {
    const store = createMemoryStore()
    expect(await store.load()).toBeNull()

    const world = createInitialWorld()
    dig(world, 12, 9)
    dig(world, 13, 9)
    await store.save(serialize(world))

    const raw = await store.load()
    const result = deserialize(raw)
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.world.dugCount).toBe(2)

    await store.clear()
    expect(await store.load()).toBeNull()
  })

  it('存储键名稳定（改动会导致旧进度读不到，需迁移）', () => {
    expect(SAVE_KEY).toBe('underground-home-save')
  })
})
