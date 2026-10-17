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
} as const

export type TileType = (typeof TILE)[keyof typeof TILE]

/** 地图尺寸（瓦片数）与瓦片像素尺寸 */
export const MAP_WIDTH = 44
export const MAP_HEIGHT = 29
export const TILE_SIZE = 32

/** 地表行：y < SURFACE_Y 为天空，y >= SURFACE_Y 为地层 */
export const SURFACE_Y = 4

/** 世界结构版本号，结构变化时递增（存档会校验并迁移） */
export const WORLD_VERSION = 3

export interface SleepPod extends Cell {
  id: number
  door: 'left' | 'right'
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
  spring: { x: 31, y: 15 },
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

/** 世界状态：一张固定小地图 + 第一夜进度 */
export interface WorldState {
  version: number
  width: number
  height: number
  /** tiles[y][x] */
  tiles: TileType[][]
  /** 累计挖开格数（展示与统计用） */
  dugCount: number
  progress: WorldProgress
  pods: SleepPod[]
}

/**
 * 岩层蓝图（软土口袋）：第一夜只开放几处被坚硬岩层包围的可挖区域，
 * 避免玩家误挖整张地图，同时给自由建设留出空间。
 */
const SOFT_POCKETS: readonly Rect[] = [
  { x: 8, y: 7, w: 9, h: 6 }, // 左侧：能源石与睡眠舱区
  { x: 26, y: 7, w: 9, h: 10 }, // 右侧：泉水与温室区
  { x: 14, y: 12, w: 4, h: 4 }, // 中部下层
  { x: 9, y: 13, w: 5, h: 2 }, // 软土边缘，留给后续自由搭建
  { x: 25, y: 12, w: 2, h: 4 },
  { x: 32, y: 17, w: 3, h: 2 },
]

/**
 * 初始已挖空的洞窟：旧避难所大厅、地表竖井、大厅左侧缺口。
 * 大厅四周保持坚硬岩石，天然禁止破坏初始核心房间。
 */
const CARVED_CAVES: readonly Rect[] = [
  { x: 17, y: 7, w: 9, h: 5 },
  { x: 21, y: 4, w: 2, h: 4 },
  { x: 15, y: 9, w: 2, h: 1 },
]

/** 创建第一夜初始世界 */
export function createInitialWorld(): WorldState {
  const tiles: TileType[][] = Array.from({ length: MAP_HEIGHT }, (_, y) =>
    Array.from({ length: MAP_WIDTH }, (): TileType => (y < SURFACE_Y ? TILE.EMPTY : TILE.ROCK)),
  )
  for (const rect of SOFT_POCKETS) fillRect(tiles, rect, TILE.SOIL)
  for (const rect of CARVED_CAVES) fillRect(tiles, rect, TILE.EMPTY)
  return {
    version: WORLD_VERSION,
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
    tiles,
    dugCount: 0,
    progress: { crystalFound: false, crystalCollected: false, coreRepaired: false },
    pods: [],
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
