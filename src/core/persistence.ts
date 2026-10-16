import {
  LANDMARKS,
  MAP_HEIGHT,
  MAP_WIDTH,
  TILE,
  WORLD_VERSION,
  type TileType,
  type WorldProgress,
  type WorldState,
} from './world'

/** 存档在存储介质中的键名（保持稳定；改动需要迁移） */
export const SAVE_KEY = 'underground-home-save'

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

/** 校验 v1 / v2 共有的地图数据；返回可读错误或规整后的数据 */
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
      if (cell !== TILE.EMPTY && cell !== TILE.SOIL && cell !== TILE.ROCK) {
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
 * v1（P0 时期）没有进度位，会自动迁移：
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
      },
    }
  }
  if (payload.version !== WORLD_VERSION) {
    return err(`存档版本不匹配（存档 v${payload.version}，当前 v${WORLD_VERSION}）`)
  }

  const progress = validateProgress((payload.world as { progress?: unknown }).progress)
  if (!progress) return err('存档进度字段无效')

  return {
    ok: true,
    savedAt,
    world: { ...base.data, version: WORLD_VERSION, progress },
  }
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
export function createIndexedDbStore(dbName = 'underground-home', storeName = 'saves'): SaveStore {
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
        request.onsuccess = () => resolve(request.result)
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
