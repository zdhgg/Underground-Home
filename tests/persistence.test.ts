import { describe, expect, it } from 'vitest'
import { dig } from '../src/core/dig'
import { collectCrystal, repairCore } from '../src/core/interact'
import { missionSummary } from '../src/core/missions'
import {
  SAVE_KEY,
  createMemoryStore,
  deserialize,
  serialize,
} from '../src/core/persistence'
import { LANDMARKS, TILE, WORLD_VERSION, createInitialWorld, type WorldState } from '../src/core/world'
import { placePod } from '../src/core/build'
import { inspectCrack, upgradePickaxe } from '../src/core/exploration'

/** 已经找到泉水、引水到家、种下一槽菜的世界：用来测 v6 的引水与种植字段 */
function farmWorld(): WorldState {
  const world = createInitialWorld()
  world.progress = { crystalFound: true, crystalCollected: true, secondCrystalFound: true, secondCrystalCollected: true, coreLoaded: true, coreRepaired: true }
  world.tiles[9][14] = TILE.EMPTY
  for (let y = 10; y <= 11; y++) for (let x = 12; x <= 14; x++) dig(world, x, y)
  placePod(world, 12, 10)
  for (let x = 26; x <= 27; x++) { dig(world, x, 11); dig(world, x, 10) }
  inspectCrack(world, 27, 12)
  upgradePickaxe(world)
  for (let y = 12; y < 19; y++) if (world.tiles[y][27] !== TILE.EMPTY) dig(world, 27, y)
  world.exploration.entered = true
  for (let x = 23; x >= 18; x--) { dig(world, x, 21); dig(world, x, 20) }
  world.exploration.explorer = { x: LANDMARKS.spring.x, y: 21 }
  world.exploration.springFound = true
  for (let y = 9; y <= 11; y++) for (let x = 2; x <= 11; x++) if (world.tiles[y][x] === TILE.SOIL) dig(world, x, y)
  world.farm.waterSupplied = true
  world.farm.planters.push({ id: 1, x: 5, y: 11, growth: 2 })
  world.farm.food = 3
  world.farm.harvests = 4
  return world
}

describe('存档序列化与校验', () => {
  it('小窝标记能存取，旧版小窝无标记正常迁移，损坏标记给出反馈', () => {
    const world = farmWorld()
    world.pods[0].mark = 'leaf'
    const raw = serialize(world)
    expect(deserialize(raw)).toMatchObject({ ok: true, world: { pods: [{ mark: 'leaf' }] } })
    const old = structuredClone(raw); old.version = 23; delete old.world.pods[0].mark
    const loaded = deserialize(old)
    expect(loaded.ok && loaded.world.pods[0].mark).toBeUndefined()
    const bad = structuredClone(raw); (bad.world.pods[0] as { mark: string }).mark = 'unknown'
    expect(deserialize(bad)).toMatchObject({ ok: false, error: '存档小窝标记数据无效' })
  })
  it('序列化-反序列化往返一致（含进度位）', () => {
    const world = createInitialWorld()
    dig(world, 13, 9)
    dig(world, LANDMARKS.crystal.x, LANDMARKS.crystal.y)
    collectCrystal(world, LANDMARKS.crystal.x, LANDMARKS.crystal.y)
    const payload = serialize(world)
    expect(payload.version).toBe(WORLD_VERSION)

    const result = deserialize(JSON.parse(JSON.stringify(payload)))
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.world.tiles).toEqual(world.tiles)
      expect(result.world.dugCount).toBe(world.dugCount)
      expect(result.world.progress).toEqual(world.progress)
    }
  })

  it('完成点灯后存档往返，进入睡眠舱任务且点灯状态保持不变', () => {
    const world = createInitialWorld()
    dig(world, LANDMARKS.crystal.x, LANDMARKS.crystal.y)
    collectCrystal(world, LANDMARKS.crystal.x, LANDMARKS.crystal.y)
    dig(world, LANDMARKS.secondCrystal.x, LANDMARKS.secondCrystal.y)
    collectCrystal(world, LANDMARKS.secondCrystal.x, LANDMARKS.secondCrystal.y)
    repairCore(world, LANDMARKS.generator.x, LANDMARKS.generator.y)
    expect(missionSummary(world)).toEqual({ done: 3, total: 5 })

    const result = deserialize(JSON.parse(JSON.stringify(serialize(world))))
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(missionSummary(result.world)).toEqual({ done: 3, total: 5 })
      expect(result.world.progress.coreRepaired).toBe(true)
    }
  })

  it('v1 旧存档（P0 时期）自动迁移，已挖开的能源石记为已发现', () => {
    const world = createInitialWorld()
    dig(world, LANDMARKS.crystal.x, LANDMARKS.crystal.y)
    const v1 = {
      version: 1,
      savedAt: '2026-10-16T00:00:00.000Z',
      world: {
        width: world.width,
        height: world.height,
        dugCount: world.dugCount,
        tiles: world.tiles.map((row) => [...row]),
      },
    }
    const result = deserialize(JSON.parse(JSON.stringify(v1)))
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.world.version).toBe(WORLD_VERSION)
      expect(result.world.progress).toEqual({
        crystalFound: true,
        crystalCollected: false,
        secondCrystalFound: false,
        secondCrystalCollected: false,
        coreLoaded: false,
        coreRepaired: false,
      })
      expect(missionSummary(result.world).done).toBe(1)
    }
  })

  it('v1 旧存档没挖过能源石时，迁移后进度从零开始', () => {
    const world = createInitialWorld()
    const v1 = {
      version: 1,
      savedAt: '2026-10-16T00:00:00.000Z',
      world: {
        width: world.width,
        height: world.height,
        dugCount: 0,
        tiles: world.tiles.map((row) => [...row]),
      },
    }
    const result = deserialize(v1)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.world.progress).toEqual({
        crystalFound: false,
        crystalCollected: false,
        secondCrystalFound: false,
        secondCrystalCollected: false,
        coreLoaded: false,
        coreRepaired: false,
      })
    }
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

    const missingProgress = JSON.parse(JSON.stringify(payload))
    delete missingProgress.world.progress
    expect(deserialize(missingProgress).ok).toBe(false)

    const badProgress = { ...payload, world: { ...payload.world, progress: { crystalFound: 'yes' } } }
    expect(deserialize(badProgress).ok).toBe(false)
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

describe('相遇标记', () => {
  it('小满相遇标记能保存；旧档没有这个字段时按未相遇补齐', () => {
    const world = farmWorld()
    world.exploration.metXiaoman = true
    const saved = deserialize(serialize(world))
    expect(saved.ok && saved.world.exploration.metXiaoman).toBe(true)

    const legacy = serialize(farmWorld()) as unknown as { world: { exploration: Record<string, unknown> } }
    delete legacy.world.exploration.metXiaoman
    const loaded = deserialize(legacy)
    expect(loaded.ok && loaded.world.exploration.metXiaoman).toBe(false)
  })

  it('没下过泉水层却带着相遇标记的存档按未相遇处理', () => {
    const legacy = serialize(createInitialWorld()) as unknown as { world: { exploration: Record<string, unknown> } }
    legacy.world.exploration.metXiaoman = true
    const loaded = deserialize(legacy)
    expect(loaded.ok && loaded.world.exploration.metXiaoman).toBe(false)
  })
})

describe('引水与种植（v6）', () => {
  it('引水、种植槽、食物与收成次数往返一致', () => {
    const world = farmWorld()
    const result = deserialize(JSON.parse(JSON.stringify(serialize(world))))
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.world.farm).toEqual(world.farm)
  })

  it('v5 旧档能读：新字段按默认值补齐，旧进度原样保留', () => {
    const world = farmWorld()
    const payload = serialize(world)
    payload.version = 5
    delete (payload.world as { farm?: unknown }).farm

    const result = deserialize(JSON.parse(JSON.stringify(payload)))
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.world.farm).toEqual({ waterSupplied: false, planters: [], food: 0, harvests: 0, sharedMeals: 0 })
      expect(result.world.progress).toEqual(world.progress)
      expect(result.world.exploration).toEqual(world.exploration)
      expect(result.world.pods).toEqual(world.pods)
    }
  })

  it('造假的数据被拒绝：没泉水却有水、没水却种了菜、生长档位越界、槽位落回土里', () => {
    const payload = serialize(farmWorld())
    expect(deserialize(JSON.parse(JSON.stringify(payload))).ok).toBe(true)

    const noSpring = JSON.parse(JSON.stringify(payload))
    noSpring.world.exploration.springFound = false
    expect(deserialize(noSpring).ok).toBe(false)

    const noWater = JSON.parse(JSON.stringify(payload))
    noWater.world.farm.waterSupplied = false
    expect(deserialize(noWater).ok).toBe(false)

    const badGrowth = JSON.parse(JSON.stringify(payload))
    badGrowth.world.farm.planters[0].growth = 99
    expect(deserialize(badGrowth).ok).toBe(false)

    const badFood = JSON.parse(JSON.stringify(payload))
    badFood.world.farm.food = -1
    expect(deserialize(badFood).ok).toBe(false)

    const buried = JSON.parse(JSON.stringify(payload))
    buried.world.tiles[11][5] = TILE.SOIL
    expect(deserialize(buried).ok).toBe(false)
  })
})

describe('围坐共餐计数（v14）', () => {
  it('v13 旧档没有 sharedMeals 字段：按 0 次补齐，其余进度原样保留', () => {
    const world = farmWorld()
    const payload = serialize(world)
    payload.version = 13
    delete (payload.world.farm as { sharedMeals?: number }).sharedMeals

    const result = deserialize(JSON.parse(JSON.stringify(payload)))
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.world.farm.sharedMeals).toBe(0)
      expect(result.world.farm.planters).toEqual(world.farm.planters)
      expect(result.world.version).toBe(WORLD_VERSION)
    }
  })

  it('声称围坐过却没有灶台和餐桌的存档按损坏处理', () => {
    const payload = serialize(farmWorld())
    ;(payload.world.farm as { sharedMeals?: number }).sharedMeals = 1
    const result = deserialize(JSON.parse(JSON.stringify(payload)))
    expect(result.ok).toBe(false)
  })
})

describe('伙伴站位迁移', () => {
  it('旧档里“建好床就加入”的小满站位会被丢弃，整份存档仍能读取', () => {
    const world = createInitialWorld()
    world.progress = { crystalFound: true, crystalCollected: true, secondCrystalFound: true, secondCrystalCollected: true, coreLoaded: true, coreRepaired: true }
    for (let y = 10; y <= 11; y++) for (let x = 12; x <= 14; x++) dig(world, x, y)
    expect(placePod(world, 12, 10)).not.toBeNull()
    world.workers = { adeng: { x: 24, y: 11 }, xiaoman: { x: 17, y: 11 } }

    const result = deserialize(serialize(world))
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.world.workers.adeng).toEqual({ x: 24, y: 11 })
      expect(result.world.workers.xiaoman).toBeUndefined()
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
