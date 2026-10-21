import type { PartnerId } from './partners'

/**
 * 世界数据模型：瓦片地图 + 初始避难所蓝图。
 * 纯数据与纯函数，不依赖 DOM / PixiJS / 浏览器 API，方便测试与复用。
 */

/** 瓦片类型 */
export const TILE = {
  /** 已挖空的空间（洞窟） */
  EMPTY: 0,
  /** 松软泥土：当前可挖 */
  SOIL: 1,
  /** 坚硬岩石：暂不可挖，后期工具升级后解锁 */
  ROCK: 2,
  /** 有裂纹的薄弱岩脉，小铁镐可以挖。 */
  WEAK_ROCK: 3,
} as const

export type TileType = (typeof TILE)[keyof typeof TILE]

/** 地图尺寸（瓦片数）与瓦片像素尺寸 */
export const MAP_WIDTH = 44
export const MAP_HEIGHT = 28
export const TILE_SIZE = 32

/** 地表行：y < SURFACE_Y 为天空，y >= SURFACE_Y 为地层 */
export const SURFACE_Y = 4

/** 世界结构版本号，结构变化时递增（存档会校验并迁移） */
export const WORLD_VERSION = 13

/** 同一张剖面上的空间分带；两层通过有限的裂纹岩梯道连接。 */
export const STRATA = {
  home: { id: 'home', name: '第 1 层 · 暖窝层', top: 4, bottom: 12, focus: { x: 22, y: 10 } },
  seal: { id: 'seal', name: '坚硬岩层', top: 12, bottom: 15, focus: { x: 22, y: 13.5 } },
  water: { id: 'water', name: '第 2 层 · 泉水层', top: 15, bottom: 28, focus: { x: 22, y: 20 } },
} as const
/** 一层是一个可居住层高。两翼净高3格，共用y=12的实心地板。 */
export const HOME_ROOM_TOP = 9
export const HOME_FLOOR_Y = STRATA.home.bottom
export type StratumId = keyof typeof STRATA
export function stratumAt(y: number): StratumId {
  return y < STRATA.seal.top ? 'home' : y < STRATA.water.top ? 'seal' : 'water'
}
export const isPreviewLayer = (y: number): boolean => y >= STRATA.water.top

export interface SleepPod extends Cell {
  id: number
  door: 'left' | 'right'
  /** 房间后侧设施；前侧保留真实的两格高通道。 */
  backWall?: true
}

export interface Rect {
  x: number
  y: number
  w: number
  h: number
}

export interface Cell {
  x: number
  y: number
}

export type WorkerId = Exclude<PartnerId, 'atu'>
export type WorkerPositions = Partial<Record<WorkerId, Cell>>
export interface WallLamp extends Cell { wide?: true }

export type RoomKind = 'home' | 'garden' | 'lounge'
export interface Inventory { stone: number; wood: number }
export interface BuiltSite { id: string; kind: RoomKind }
/** 避难所留下的少量材料，保证第一间住处可以直接开工。 */
export const freshInventory = (): Inventory => ({ stone: 4, wood: 3 })
/** 蓝图不改变地形；扩建蓝图完成前，原房间继续使用。 */
export interface Room extends Rect {
  id: number; kind: RoomKind
  status?: 'blueprint'
  managed?: true
  replaces?: number
}

/** 第一夜的关键地点（固定叙事目标，位置由岩层蓝图保证） */
export const LANDMARKS = {
  /** 旧避难所大厅（初始已挖空） */
  shelter: { x: 17, y: 7, w: 9, h: 5 },
  /** 通往地表的竖井 */
  shaft: { x: 21, y: 4, w: 2, h: 4 },
  /** 能源石（埋在松软泥土里，挖开即露出） */
  crystal: { x: 14, y: 9 },
  /** 能源石互动区（点按收集的容错范围） */
  crystalZone: { x: 13, y: 8, w: 3, h: 3 },
  /** 能源核心（位于大厅中，P1 修复后点亮家园） */
  generator: { x: 21, y: 9 },
  /** 能源核心互动区（点按修复的容错范围） */
  generatorZone: { x: 19, y: 8, w: 4, h: 3 },
  /** 地下泉水（隐约可见，P3 使用） */
  spring: { x: 18, y: 21 },
  /** 建造引导只是可选区域，不限制玩家选址。 */
  buildSuggestion: { x: 10, y: 9, w: 7, h: 3 },
  /** 第二层泉水边的菜园建议区：只是高亮，不限制菜槽布局。 */
  gardenSuggestion: { x: 24, y: 19, w: 7, h: 3 },
} as const satisfies Record<string, Rect | Cell>

/** 第一夜的进度位：全部单调，不因撤销回退 */
export interface WorldProgress {
  /** 挖开过能源石所在泥土（发现能源石） */
  crystalFound: boolean
  /** 能源石已收集到手 */
  crystalCollected: boolean
  /** 能源核心已修复（家园点亮） */
  coreRepaired: boolean
}

/** 一格种植槽：新菜园在第二层泉水边；growth 0 刚种下 → RIPE_STAGE 可收 */
export interface Planter extends Cell {
  id: number
  growth: number
  /** 自动启用的菜槽归属，撤销房间时不误删原有作物。 */
  roomId?: number
}

/**
 * 引水与种植：第二层的水引上来之后，第一层才成为生产空间。
 * 生长不用真实时间，靠"玩家干活"推进——孩子随时收，不必等。
 */
export interface FarmState {
  /** 泉水已经引到家里（大厅有水桶，第一层可以种东西了） */
  waterSupplied: boolean
  /** 摆下的种植槽（旧档可能在第一层） */
  planters: Planter[]
  /** 收成存下的食物份数（吃饭会减少） */
  food: number
  /** 累计收成次数：只增不减，用来判断"已经收过第一份" */
  harvests: number
}

export const freshFarm = (): FarmState => ({ waterSupplied: false, planters: [], food: 0, harvests: 0 })

/** 世界状态：一张固定小地图 + 第一夜进度 */
export interface WorldState {
  inventory: Inventory
  builtSites: BuiltSite[]
  version: number
  width: number
  height: number
  /** tiles[y][x] */
  tiles: TileType[][]
  /** 累计挖开格数（展示与统计用） */
  dugCount: number
  progress: WorldProgress
  pods: SleepPod[]
  rooms: Room[]
  nextRoomId: number
  /** 专业伙伴最近到达的安全站位；不保存半段动画或待执行工作。 */
  workers: WorkerPositions
  /** 已学会的专业能力升级ID；设施配置单独保存在灯上。 */
  partnerUpgrades: string[]
  exploration: ExplorationState
  farm: FarmState
  /**
   * 第一层的电已经顺着梯道送到第二层。
   * 核心修好只是"家里有电"，把电送下去之后，第二层才亮得起来。
   */
  powerDown: boolean
}

export interface ExplorationState {
  clueFound: boolean
  pickaxeUpgraded: boolean
  entered: boolean
  springFound: boolean
  /** 选中的真实梯道；发现线索不会自动挖空岩层。 */
  shaftX: number | null
  explorer: Cell | null
  lamps: WallLamp[]
}
export const BREAKTHROUGHS = [27, 16] as const
export const WATER_FLOOR_Y = 22
export const freshExploration = (): ExplorationState => ({ clueFound: false, pickaxeUpgraded: false, entered: false, springFound: false, shaftX: null, explorer: null, lamps: [] })

/**
 * 岩层蓝图（软土口袋）：第一夜只开放几处被坚硬岩层包围的可挖区域，
 * 避免玩家误挖整张地图，同时给自由建设留出空间。
 */
const SOFT_POCKETS: readonly Rect[] = [
  { x: 2, y: HOME_ROOM_TOP, w: 15, h: HOME_FLOOR_Y - HOME_ROOM_TOP }, // 左翼横向扩建，不再纵向掏成高洞
  { x: 26, y: HOME_ROOM_TOP, w: 16, h: HOME_FLOOR_Y - HOME_ROOM_TOP }, // 右翼与大厅共用同一地板
  { x: 3, y: 19, w: 38, h: 3 }, // 连续横向建设带，底面保持实心
]

/**
 * 初始已挖空的洞窟：旧避难所大厅、地表竖井、大厅左侧缺口。
 * 大厅四周保持坚硬岩石，天然禁止破坏初始核心房间。
 */
const CARVED_CAVES: readonly Rect[] = [
  { x: 17, y: 7, w: 9, h: 5 },
  { x: 21, y: 4, w: 2, h: 4 },
  { x: 15, y: 9, w: 2, h: 3 }, // 大厅左门落地连通，不必爬墙上床
  // 天然洞穴，不与暖窝层连通；轮廓保留不规则的顶、底和岩柱。
  { x: 24, y: 18, w: 8, h: 4 },
  { x: 10, y: 19, w: 7, h: 3 },
  { x: 32, y: 19, w: 5, h: 3 },
]

/** 创建第一夜初始世界 */
export function createInitialWorld(): WorldState {
  const tiles: TileType[][] = Array.from({ length: MAP_HEIGHT }, (_, y) =>
    Array.from({ length: MAP_WIDTH }, (): TileType => (y < SURFACE_Y ? TILE.EMPTY : TILE.ROCK)),
  )
  for (const rect of SOFT_POCKETS) fillRect(tiles, rect, TILE.SOIL)
  for (const rect of CARVED_CAVES) fillRect(tiles, rect, TILE.EMPTY)
  for (const x of BREAKTHROUGHS) for (let y = HOME_FLOOR_Y; y < 19; y++) {
    if (tiles[y][x] !== TILE.EMPTY) tiles[y][x] = TILE.WEAK_ROCK
  }
  return {
    version: WORLD_VERSION,
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
    tiles,
    dugCount: 0,
    inventory: freshInventory(),
    builtSites: [],
    progress: { crystalFound: false, crystalCollected: false, coreRepaired: false },
    pods: [],
    rooms: [],
    nextRoomId: 1,
    workers: {},
    partnerUpgrades: [],
    exploration: freshExploration(),
    farm: freshFarm(),
    powerDown: false,
  }
}

/** 坐标是否在地图内 */
export function isInside(world: WorldState, x: number, y: number): boolean {
  return x >= 0 && x < world.width && y >= 0 && y < world.height
}

/** 读取某格瓦片；越界返回 null */
export function tileAt(world: WorldState, x: number, y: number): TileType | null {
  return isInside(world, x, y) ? world.tiles[y][x] : null
}

/** 统计某类瓦片数量（测试与调试用） */
export function countTiles(world: WorldState, tile: TileType): number {
  let count = 0
  for (let y = SURFACE_Y; y < world.height; y++) {
    for (let x = 0; x < world.width; x++) {
      if (world.tiles[y][x] === tile) count++
    }
  }
  return count
}

function fillRect(tiles: TileType[][], rect: Rect, tile: TileType): void {
  for (let y = Math.max(SURFACE_Y, rect.y); y < rect.y + rect.h; y++) {
    for (let x = rect.x; x < rect.x + rect.w; x++) {
      if (x >= 0 && x < MAP_WIDTH && y >= 0 && y < MAP_HEIGHT) tiles[y][x] = tile
    }
  }
}
