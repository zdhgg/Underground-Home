import {
  LANDMARKS,
  MAP_HEIGHT,
  MAP_WIDTH,
  TILE,
  WORLD_VERSION,
  type FarmState,
  type Planter,
  type TileType,
  type WorldProgress,
  type WorldState,
  type SleepPod,
  type ExplorationState,
  createInitialWorld,
  freshExploration,
  freshFarm,
  BREAKTHROUGHS,
} from './world'
import { canPlacePod } from './build'
import { canPlacePlanter, RIPE_STAGE } from './farm'
import { canStand, explorationAccessIntact, HALL_START_Y, shaftConnected, SHAFT_LAST_Y, springVisible, walkingRoute } from './exploration'

/** 存档在存储介质中的键名（保持稳定；改动需要迁移） */
export const SAVE_KEY = 'underground-home-save'
/** 双层原型始终隔离，包括生产构建；绝不打开正式版 underground-home 数据库。 */
export const LEGACY_DB_NAME = 'underground-home-depth-prototype-v2'
export const PROTOTYPE_DB_NAME = 'underground-home-spring-playtest-v1'

/** 落盘格式：带版本号，便于迁移 */
export interface SavePayload {
  version: number
  savedAt: string
  world: {
    width: number
    height: number
    dugCount: number
    /** tiles[y][x]，存数字以减小体积 */
    tiles: number[][]
    progress: WorldProgress
    pods: SleepPod[]
    exploration: ExplorationState
    /** 引水与种植（v6 起） */
    farm: FarmState
  }
}

export function serialize(world: WorldState): SavePayload {
  return {
    version: WORLD_VERSION,
    savedAt: new Date().toISOString(),
    world: {
      width: world.width,
      height: world.height,
      dugCount: world.dugCount,
      tiles: world.tiles.map((row) => [...row]),
      progress: { ...world.progress },
      pods: world.pods.map((pod) => ({ ...pod })),
      exploration: structuredClone(world.exploration),
      farm: { ...world.farm, planters: world.farm.planters.map((planter) => ({ ...planter })) },
    },
  }
}

export type LoadResult =
  | { ok: true; world: WorldState; savedAt: string }
  | { ok: false; error: string }

const err = (error: string): LoadResult => ({ ok: false, error })

interface BaseWorldData {
  width: number
  height: number
  dugCount: number
  tiles: TileType[][]
}

/** 校验共有地图数据；仅接受当前蓝图尺寸，正式旧地图不在原型中迁移。 */
function validateBaseWorld(world: unknown): { ok: true; data: BaseWorldData } | { ok: false; error: string } {
  if (typeof world !== 'object' || world === null) return { ok: false, error: '存档缺少世界数据' }
  const raw = world as { width?: unknown; height?: unknown; dugCount?: unknown; tiles?: unknown }
  if (raw.width !== MAP_WIDTH || raw.height !== MAP_HEIGHT) {
    return { ok: false, error: '存档地图尺寸与当前版本不符' }
  }
  if (!Array.isArray(raw.tiles) || raw.tiles.length !== MAP_HEIGHT) {
    return { ok: false, error: '存档地图数据不完整' }
  }
  for (const row of raw.tiles) {
    if (!Array.isArray(row) || row.length !== MAP_WIDTH) return { ok: false, error: '存档地图行数据不完整' }
    for (const cell of row) {
      if (cell !== TILE.EMPTY && cell !== TILE.SOIL && cell !== TILE.ROCK && cell !== TILE.WEAK_ROCK) {
        return { ok: false, error: '存档包含未知瓦片类型' }
      }
    }
  }
  if (typeof raw.dugCount !== 'number' || !Number.isInteger(raw.dugCount) || raw.dugCount < 0) {
    return { ok: false, error: '存档统计字段无效' }
  }
  return {
    ok: true,
    data: {
      width: raw.width,
      height: raw.height,
      dugCount: raw.dugCount,
      tiles: (raw.tiles as number[][]).map((row) => row.map((cell) => cell as TileType)),
    },
  }
}

function validateProgress(progress: unknown): WorldProgress | null {
  if (typeof progress !== 'object' || progress === null) return null
  const raw = progress as Record<string, unknown>
  if (
    typeof raw.crystalFound !== 'boolean' ||
    typeof raw.crystalCollected !== 'boolean' ||
    typeof raw.coreRepaired !== 'boolean'
  ) {
    return null
  }
  return {
    crystalFound: raw.crystalFound,
    crystalCollected: raw.crystalCollected,
    coreRepaired: raw.coreRepaired,
  }
}

/**
 * 反序列化并严格校验：任何损坏的存档都返回可读错误，由调用方回退到新世界（不白屏）。
 * 相同蓝图下的 v1 字段格式没有进度位，会自动补齐：
 * "能源石是否已发现"可从地图推导（该格是否已被挖空），其余从 false 开始。
 */
export function deserialize(raw: unknown): LoadResult {
  if (typeof raw !== 'object' || raw === null) return err('存档不是有效对象')
  const payload = raw as { version?: unknown; savedAt?: unknown; world?: unknown }
  if (typeof payload.version !== 'number') return err('存档缺少版本号')

  const base = validateBaseWorld(payload.world)
  if (!base.ok) return err(base.error)
  const savedAt = typeof payload.savedAt === 'string' ? payload.savedAt : ''

  if (payload.version === 1) {
    const found = base.data.tiles[LANDMARKS.crystal.y][LANDMARKS.crystal.x] === TILE.EMPTY
    return {
      ok: true,
      savedAt,
      world: {
        ...base.data,
        version: WORLD_VERSION,
        progress: { crystalFound: found, crystalCollected: false, coreRepaired: false },
        pods: [],
        exploration: freshExploration(),
        farm: freshFarm(),
      },
    }
  }
  if (payload.version !== 2 && payload.version !== 4 && payload.version !== 5 && payload.version !== WORLD_VERSION) {
    return err(`存档版本不匹配（存档 v${payload.version}，当前 v${WORLD_VERSION}）`)
  }

  const progress = validateProgress((payload.world as { progress?: unknown }).progress)
  if (!progress) return err('存档进度字段无效')

  const world: WorldState = { ...base.data, version: WORLD_VERSION, progress, pods: [], exploration: freshExploration(), farm: freshFarm() }
  if (payload.version === 4) {
    // 仅在用户明确复制时调用；旧版第二层从不可操作，替换下部不会损失玩家建设。
    const blueprint = createInitialWorld()
    for (let y = 12; y < MAP_HEIGHT; y++) world.tiles[y] = [...blueprint.tiles[y]]
  }
  if (payload.version === WORLD_VERSION || payload.version === 5) {
    const exploration = validateExploration((payload.world as { exploration?: unknown }).exploration, world)
    if (!exploration) return err('存档探索进度或梯道无效')
    world.exploration = exploration
  }
  if (payload.version === WORLD_VERSION || payload.version === 5 || payload.version === 4) {
    const rawPods = (payload.world as { pods?: unknown }).pods
    if (!Array.isArray(rawPods) || rawPods.length > MAP_WIDTH * MAP_HEIGHT) return err('存档睡眠舱数据无效')
    const ids = new Set<number>()
    for (const item of rawPods) {
      if (typeof item !== 'object' || item === null) return err('存档睡眠舱数据无效')
      const pod = item as SleepPod
      if (!Number.isInteger(pod.id) || pod.id < 1 || ids.has(pod.id) || !Number.isInteger(pod.x) || !Number.isInteger(pod.y) || (pod.door !== 'left' && pod.door !== 'right')) return err('存档睡眠舱数据无效')
      ids.add(pod.id)
      world.pods.push({ id: pod.id, x: pod.x, y: pod.y, door: pod.door })
    }
    const pods = world.pods
    for (const pod of pods) {
      world.pods = pods.filter((other) => other.id !== pod.id)
      if (!canPlacePod(world, pod.x, pod.y, pod.door).ok) return err('存档睡眠舱位置无效')
    }
    world.pods = pods
    if (world.exploration.clueFound && (!world.pods.length || !world.progress.coreRepaired)) return err('存档探索前置建设无效')
    if (!explorationAccessIntact(world)) return err('存档探索通路无效')
  }
  if (payload.version === WORLD_VERSION) {
    const farm = validateFarm((payload.world as { farm?: unknown }).farm, world)
    if (!farm) return err('存档引水或种植数据无效')
    world.farm = farm
  }

  return {
    ok: true,
    savedAt,
    world,
  }
}

/** v6 起：引水状态、种植槽与食物。水必须先于种植，槽位也要仍在合法地面上。 */
function validateFarm(raw: unknown, world: WorldState): FarmState | null {
  if (typeof raw !== 'object' || raw === null) return null
  const farm = raw as FarmState
  if (typeof farm.waterSupplied !== 'boolean') return null
  if (!Number.isInteger(farm.food) || farm.food < 0) return null
  if (!Number.isInteger(farm.harvests) || farm.harvests < 0) return null
  if (!Array.isArray(farm.planters) || farm.planters.length > MAP_WIDTH * MAP_HEIGHT) return null
  // 没有泉水就没有水可引；水没引上来就不该有作物。
  if (farm.waterSupplied && !world.exploration.springFound) return null
  if (farm.planters.length > 0 && !farm.waterSupplied) return null
  const ids = new Set<number>()
  const planters: Planter[] = []
  for (const item of farm.planters) {
    if (typeof item !== 'object' || item === null) return null
    const planter = item as Planter
    if (!Number.isInteger(planter.id) || planter.id < 1 || ids.has(planter.id)) return null
    if (!Number.isInteger(planter.x) || !Number.isInteger(planter.y)) return null
    if (!Number.isInteger(planter.growth) || planter.growth < 0 || planter.growth > RIPE_STAGE) return null
    ids.add(planter.id)
    planters.push({ id: planter.id, x: planter.x, y: planter.y, growth: planter.growth })
  }
  const restored = world.farm
  world.farm = { waterSupplied: farm.waterSupplied, planters, food: farm.food, harvests: farm.harvests }
  try {
    for (const planter of planters) {
      world.farm.planters = planters.filter((other) => other.id !== planter.id)
      if (!canPlacePlanter(world, planter.x, planter.y).ok) return null
    }
    return { waterSupplied: farm.waterSupplied, planters, food: farm.food, harvests: farm.harvests }
  } finally {
    world.farm = restored
  }
}

function validateExploration(raw: unknown, world: WorldState): ExplorationState | null {
  if (!raw || typeof raw !== 'object') return null
  const e = raw as ExplorationState
  if (['clueFound', 'pickaxeUpgraded', 'entered', 'springFound'].some((key) => typeof (raw as Record<string, unknown>)[key] !== 'boolean')) return null
  if (e.shaftX !== null && !BREAKTHROUGHS.some((x) => x === e.shaftX)) return null
  if (e.clueFound !== (e.shaftX !== null) || (e.pickaxeUpgraded && !e.clueFound) || (e.entered && !e.pickaxeUpgraded) || (e.springFound && !e.entered)) return null
  if (e.explorer !== null && (!Number.isInteger(e.explorer?.x) || !Number.isInteger(e.explorer?.y))) return null
  if (e.clueFound !== (e.explorer !== null) || !Array.isArray(e.lamps) || e.lamps.length > MAP_WIDTH) return null
  const blueprint = createInitialWorld()
  for (let y = 12; y < MAP_HEIGHT; y++) for (let x = 0; x < MAP_WIDTH; x++) {
    const tile = world.tiles[y][x], initial = blueprint.tiles[y][x]
    if (initial === TILE.ROCK && tile !== TILE.ROCK) return null
    if (initial === TILE.EMPTY && tile !== TILE.EMPTY) return null
    if (tile !== initial && tile !== TILE.EMPTY) return null
    if (initial === TILE.WEAK_ROCK && tile === TILE.EMPTY && (!e.pickaxeUpgraded || x !== e.shaftX || world.tiles[y - 1][x] !== TILE.EMPTY)) return null
  }
  world.exploration = structuredClone(e)
  if (e.entered && !shaftConnected(world)) return null
  if (e.explorer && (!canStand(world, e.explorer.x, e.explorer.y) || !walkingRoute(world, { x: e.shaftX!, y: HALL_START_Y }, e.explorer))) return null
  // 未抵达时阿土只在梯道里作业：梯口，或已经挖开的那一段梯子，不能提前进泉水层洞穴。
  if (!e.entered && e.explorer && (e.explorer.x !== e.shaftX || e.explorer.y < HALL_START_Y || e.explorer.y > SHAFT_LAST_Y)) return null
  if (e.springFound && !springVisible(world)) return null
  const seen = new Set<number>()
  for (const lamp of e.lamps) {
    if (!Number.isInteger(lamp?.x) || lamp.y !== 19 || lamp.x < 3 || lamp.x > 40 || seen.has(lamp.x) || BREAKTHROUGHS.some((x) => x === lamp.x) || Math.abs(lamp.x - LANDMARKS.spring.x) <= 2 || !e.springFound || ![19, 20, 21].every((y) => world.tiles[y][lamp.x] === TILE.EMPTY)) return null
    seen.add(lamp.x)
  }
  return structuredClone(e)
}

/** 只读取已存在的旧库；不存在时不创建空旧数据库。 */
export async function loadLegacySave(): Promise<unknown | null> {
  const databases = await indexedDB.databases()
  if (!databases.some((db) => db.name === LEGACY_DB_NAME)) return null
  return createIndexedDbStore(LEGACY_DB_NAME).load()
}

/** 存储适配器：浏览器用 IndexedDB，测试与降级场景用内存实现 */
export interface SaveStore {
  load(): Promise<unknown | null>
  save(payload: SavePayload): Promise<void>
  clear(): Promise<void>
}

export function createMemoryStore(): SaveStore {
  let data: unknown = null
  return {
    load: async () => data,
    save: async (payload) => {
      data = JSON.parse(JSON.stringify(payload))
    },
    clear: async () => {
      data = null
    },
  }
}

/** 极小的 IndexedDB 封装（无第三方依赖）；环境不支持时由调用方降级 */
export function createIndexedDbStore(dbName = PROTOTYPE_DB_NAME, storeName = 'saves'): SaveStore {
  const openDb = (): Promise<IDBDatabase> =>
    new Promise((resolve, reject) => {
      const request = indexedDB.open(dbName, 1)
      request.onupgradeneeded = () => {
        request.result.createObjectStore(storeName)
      }
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error ?? new Error('无法打开 IndexedDB'))
    })

  const withStore = async <T>(
    mode: IDBTransactionMode,
    run: (store: IDBObjectStore) => IDBRequest<T>,
  ): Promise<T> => {
    const db = await openDb()
    try {
      return await new Promise<T>((resolve, reject) => {
        const tx = db.transaction(storeName, mode)
        const request = run(tx.objectStore(storeName))
        tx.oncomplete = () => resolve(request.result)
        tx.onabort = () => reject(tx.error ?? new Error('IndexedDB 事务中止'))
        tx.onerror = () => reject(tx.error ?? new Error('IndexedDB 事务失败'))
        request.onerror = () => reject(request.error ?? new Error('IndexedDB 操作失败'))
      })
    } finally {
      db.close()
    }
  }

  return {
    load: () => withStore<unknown>('readonly', (store) => store.get(SAVE_KEY) as IDBRequest<unknown>),
    save: async (payload) => {
      await withStore<IDBValidKey>('readwrite', (store) => store.put(payload, SAVE_KEY))
    },
    clear: async () => {
      await withStore<undefined>('readwrite', (store) => store.delete(SAVE_KEY))
    },
  }
}
