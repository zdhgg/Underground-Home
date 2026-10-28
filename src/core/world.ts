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
export const MAP_HEIGHT = 112
export const TILE_SIZE = 32

/** 地表行：y < SURFACE_Y 为天空，y >= SURFACE_Y 为地层 */
export const SURFACE_Y = 4

/** 世界结构版本号，结构变化时递增（存档会校验并迁移） */
export const WORLD_VERSION = 26

/** 同一张剖面上的空间分带；两层通过有限的裂纹岩梯道连接。 */
export const STRATA = {
  home: { id: 'home', name: '第 1 层 · 暖窝层', top: 4, bottom: 12, focus: { x: 22, y: 10 } },
  seal: { id: 'seal', name: '坚硬岩层', top: 12, bottom: 15, focus: { x: 22, y: 13.5 } },
  water: { id: 'water', name: '第 2 层 · 泉水层', top: 15, bottom: 23, focus: { x: 22, y: 20 } },
  deepSeal: { id: 'deepSeal', name: '晶纹硬岩盖层', top: 23, bottom: 29, focus: { x: 22, y: 26 } },
  crystal: { id: 'crystal', name: '第 3 层 · 晶簇层', top: 29, bottom: 35, focus: { x: 25, y: 32 } },
  hallSeal: { id: 'hallSeal', name: '旧大厅岩盖', top: 35, bottom: 42, focus: { x: 22, y: 38 } },
  hall: { id: 'hall', name: '第 4 层 · 暖光大厅', top: 42, bottom: 48, focus: { x: 25, y: 45 } },
  gardenSeal: { id: 'gardenSeal', name: '潮湿岩盖', top: 48, bottom: 55, focus: { x: 22, y: 51 } },
  garden: { id: 'garden', name: '第 5 层 · 菌光花园', top: 55, bottom: 60, focus: { x: 28, y: 57 } },
  reservoirSeal: { id: 'reservoirSeal', name: '渗水岩盖', top: 60, bottom: 67, focus: { x: 22, y: 63 } },
  reservoir: { id: 'reservoir', name: '第 6 层 · 蓄水回廊', top: 67, bottom: 72, focus: { x: 25, y: 69 } },
  ventilationSeal: { id: 'ventilationSeal', name: '旧风井岩盖', top: 72, bottom: 79, focus: { x:22,y:75 } },
  ventilation: { id: 'ventilation', name: '第 7 层 · 听风工区', top: 79, bottom: 84, focus: { x:25,y:81 } },
  ruinsSeal: { id:'ruinsSeal',name:'旧地脉岩盖',top:84,bottom:91,focus:{x:22,y:87} },
  finaleSeal:{id:'finaleSeal',name:'暖晶岩盖',top:96,bottom:103,focus:{x:22,y:99}},
  finale:{id:'finale',name:'第 9 层 · 地心暖光',top:103,bottom:112,focus:{x:25,y:105}},
  ruins: { id:'ruins',name:'第 8 层 · 旧地脉遗迹',top:91,bottom:96,focus:{x:25,y:93} },
} as const
/** 一层是一个可居住层高。两翼净高3格，共用y=12的实心地板。 */
export const HOME_ROOM_TOP = 9
export const HOME_FLOOR_Y = STRATA.home.bottom
export type StratumId = keyof typeof STRATA
export function stratumAt(y: number): StratumId {
  return y < STRATA.seal.top ? 'home' : y < STRATA.water.top ? 'seal' : y < STRATA.deepSeal.top ? 'water' : y < STRATA.crystal.top ? 'deepSeal' : y < STRATA.hallSeal.top ? 'crystal' : y < STRATA.hall.top ? 'hallSeal' : y < STRATA.gardenSeal.top ? 'hall' : y < STRATA.garden.top ? 'gardenSeal' : y < STRATA.reservoirSeal.top ? 'garden' : y < STRATA.reservoir.top ? 'reservoirSeal' : y < STRATA.ventilationSeal.top ? 'reservoir' : y < STRATA.ventilation.top ? 'ventilationSeal' : y < STRATA.ruinsSeal.top ? 'ventilation' : y < STRATA.ruins.top ? 'ruinsSeal' : y < STRATA.finaleSeal.top ? 'ruins' : y < STRATA.finale.top ? 'finaleSeal' : 'finale'
}
export const isPreviewLayer = (y: number): boolean => y >= STRATA.water.top

export interface SleepPod extends Cell {
  id: number
  door: 'left' | 'right'
  /** 房间后侧设施；前侧保留真实的两格高通道。 */
  backWall?: true
  /** 小主人为这间小窝选的装饰，不影响床位和通路。 */
  mark?: 'star' | 'leaf' | 'drop'
  /** 工坊部件带回家的永久改善，不参与碰撞或照明规则。 */
  warmLamp?: true
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

/** 第一层的一格储物架：材料看得见，旧物摆得下。 */
export interface Shelf extends Cell {
  id: number
}

/** 第二层的一格育苗架：解锁新菜种（番茄）。 */
export interface Nursery extends Cell {
  id: number
}

export type RoomKind = 'home' | 'garden' | 'lounge'
/** 可建设施用途：第一层房间用途，以及第二层的灶台／餐桌。 */
export type SiteKind = RoomKind | 'kitchen' | 'dining'
/** 菜种：蔬菜（默认）与育苗架解锁的番茄。 */
export type CropKind = 'tomato'
export interface Inventory { stone: number; wood: number; clay?: number }
export interface BuiltSite { id: string; kind: SiteKind }
/** 避难所留下的少量材料，保证第一间住处可以直接开工。 */
export const freshInventory = (): Inventory => ({ stone: 4, wood: 3 })

/** 一条来自现实生活的家庭记忆；媒体内容以小型 data URL 随存档保存，不上传。 */
export type MemoryKind = 'note' | 'photo' | 'voice'
export interface MemoryEntry {
  id: number
  kind: MemoryKind
  title: string
  body: string
  createdAt: string
  photoDataUrl?: string
  voiceDataUrl?: string
}
export interface MemoryState {
  entries: MemoryEntry[]
  nextId: number
}
export const freshMemories = (): MemoryState => ({ entries: [], nextId: 1 })
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
  /** 育苗架解锁的新菜种；缺省为原有蔬菜。 */
  crop?: CropKind
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
  /** 累计围坐共餐次数：只增不减。第一次围坐（=1）就是第二层的章末完成态。 */
  sharedMeals: number
}

export const freshFarm = (): FarmState => ({ waterSupplied: false, planters: [], food: 0, harvests: 0, sharedMeals: 0 })

export type DeepFacilityKind = 'collector' | 'distributor' | 'workshop' | 'furnace' | 'lamp'
export interface DeepFacility extends Cell { kind: DeepFacilityKind }
export interface DeepState {
  metAyan: boolean; entered: boolean; foundCrystal: boolean; foundMoss: boolean; foundDrill: boolean
  crystals: number; ore: number; ingots: number; parts: number; batches: number
  facilities: DeepFacility[]
  precision: boolean; hardPickaxe: boolean; farLight: boolean; supported: boolean
  lift: boolean; rides: number; completed: boolean
}
export const freshDeep = (): DeepState => ({
  metAyan: false, entered: false, foundCrystal: false, foundMoss: false, foundDrill: false,
  crystals: 0, ore: 0, ingots: 0, parts: 0, batches: 0, facilities: [],
  precision: false, hardPickaxe: false, farLight: false, supported: false,
  lift: false, rides: 0, completed: false,
})

export type HallFacilityKind = 'hall' | 'memory' | 'nest'
export interface HallFacility extends Cell { kind: HallFacilityKind; podId?: number }
export interface HallState {
  inspected: boolean; braced: boolean; entered: boolean; liftExtended: boolean; powered: boolean
  tableReady: boolean; muralFound: boolean; warmLightFound: boolean
  facilities: HallFacility[]; feasts: number; completed: boolean
}
export const freshHall = (): HallState => ({ inspected: false, braced: false, entered: false, liftExtended: false, powered: false,
  tableReady: false, muralFound: false, warmLightFound: false, facilities: [], feasts: 0, completed: false })

export type GardenFacilityKind = 'rill' | 'bed' | 'lamp' | 'bench' | 'nest'
export interface GardenFacility extends Cell { kind: GardenFacilityKind; growth?: 0 | 1 | 2; variety?: 'bell' | 'fan'; podId?: number }
export interface GardenState {
  inspected: boolean; drained: boolean; entered: boolean; metTaitai: boolean; liftExtended: boolean
  foundSpores: boolean; foundRoot: boolean; facilities: GardenFacility[]; trail: number[]
  harvests: number; walks: number; completed: boolean
}
export const freshGarden = (): GardenState => ({ inspected: false, drained: false, entered: false, metTaitai: false, liftExtended: false,
  foundSpores: false, foundRoot: false, facilities: [], trail: [], harvests: 0, walks: 0, completed: false })

export type ReservoirFacilityKind = 'intake' | 'basin' | 'gate' | 'wheel' | 'nest'
export type WaterRoute = 'closed' | 'garden' | 'hall'
export interface ReservoirFacility extends Cell { kind: ReservoirFacilityKind; podId?: number }
export interface ReservoirState {
  inspected: boolean; shored: boolean; entered: boolean; metTuantuan: boolean; liftExtended: boolean
  facilities: ReservoirFacility[]; canal: number[]; valve: WaterRoute; water: number
  fills: number; gardenDeliveries: number; hallDeliveries: number; irrigation: number
  foundShell: boolean; foundReed: boolean; tours: number; completed: boolean
}
export const freshReservoir = (): ReservoirState => ({ inspected: false, shored: false, entered: false, metTuantuan: false, liftExtended: false,
  facilities: [], canal: [], valve: 'closed', water: 0, fills: 0, gardenDeliveries: 0, hallDeliveries: 0, irrigation: 0,
  foundShell: false, foundReed: false, tours: 0, completed: false })

export type VentilationFacilityKind = 'inlet' | 'fan' | 'baffle' | 'bench' | 'nest'
export type AirMode = 'off' | 'home' | 'work'
export type WindCraft = 'chime' | 'mobile'
export interface VentilationFacility extends Cell { kind: VentilationFacilityKind; podId?: number }
export interface VentilationState {
  inspected: boolean; braced: boolean; entered: boolean; metLingling: boolean; liftExtended: boolean
  facilities: VentilationFacility[]; duct: number[]; mode: AirMode; tested: boolean
  variety: WindCraft; readyCraft: WindCraft | null; hallArt: WindCraft | null
  crafts: number; gifts: number; tours: number; completed: boolean; foundEcho: boolean; foundVane: boolean
}
export const freshVentilation = (): VentilationState => ({ inspected:false, braced:false, entered:false, metLingling:false, liftExtended:false,
  facilities:[], duct:[], mode:'off', tested:false, variety:'chime', readyCraft:null, hallArt:null, crafts:0, gifts:0, tours:0, completed:false, foundEcho:false, foundVane:false })

export type RuinsMotif = 'lamp' | 'spring' | 'tools'
export type RuinsFacilityKind = 'desk' | 'mosaic' | 'light' | 'bench'
export type RuinsEdition = 'together' | 'journey'
export interface RuinsFacility extends Cell { kind:RuinsFacilityKind }
export interface RuinsState {
  inspected:boolean; braced:boolean; entered:boolean; liftExtended:boolean
  facilities:RuinsFacility[]; revealed:RuinsMotif[]; rubbings:RuinsMotif[]; mounted:RuinsMotif[]
  edition:RuinsEdition; todayReady:boolean; showcases:number; walks:number; rests:number; completed:boolean
  foundSeal:boolean; foundFootprint:boolean
}
export const freshRuins = ():RuinsState => ({inspected:false,braced:false,entered:false,liftExtended:false,facilities:[],revealed:[],rubbings:[],mounted:[],edition:'together',todayReady:false,showcases:0,walks:0,rests:0,completed:false,foundSeal:false,foundFootprint:false})

export type FinaleFacilityKind='beacon'|'table'|'memory'|'bench'
export type FinaleTheme='lantern'|'garden'
export interface FinaleFacility extends Cell{kind:FinaleFacilityKind}
export interface FinaleState{
 inspected:boolean;braced:boolean;entered:boolean;foundWarmth:boolean;liftExtended:boolean
 facilities:FinaleFacility[];lit:boolean;foodReady:boolean;waterReady:boolean;chimePlaced:boolean;woven:boolean;storyReady:boolean
 theme:FinaleTheme;decorations:number;foodTrips:number;waterTrips:number;feasts:number
 reviewOpened:boolean;memoriesRead:number;completed:boolean;rests:number
}
export const freshFinale=():FinaleState=>({inspected:false,braced:false,entered:false,foundWarmth:false,liftExtended:false,facilities:[],lit:false,foodReady:false,waterReady:false,chimePlaced:false,woven:false,storyReady:false,theme:'lantern',decorations:0,foodTrips:0,waterTrips:0,feasts:0,reviewOpened:false,memoriesRead:0,completed:false,rests:0})

/** 世界状态：一张固定小地图 + 第一夜进度 */
export interface WorldState {
  finale:FinaleState
  ruins:RuinsState
  ventilation: VentilationState
  reservoir: ReservoirState
  garden: GardenState
  hall: HallState
  deep: DeepState
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
  /** 第一层的储物架（v15 起） */
  shelves: Shelf[]
  /** 第二层的育苗架（v16 起） */
  nurseries: Nursery[]
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
  /** 父女共同保存的生活记录（v25 起）。 */
  memories: MemoryState
}

export interface ExplorationState {
  clueFound: boolean
  pickaxeUpgraded: boolean
  entered: boolean
  springFound: boolean
  /**
   * 第一次下到泉水层时已经和小满打过照面。
   * 只用来避免“相遇对话”每次下楼都自动重播；玩家仍可以随时点她聊天。
   */
  metXiaoman: boolean
  /** 第一次点到泉水边潮湿洞壁上的发光蘑菇（发现物，单调）。 */
  foundMushroom: boolean
  /** 第一次挖到泉边的红黏土（发现物，单调）。 */
  foundClay: boolean
  /** 选中的真实梯道；发现线索不会自动挖空岩层。 */
  shaftX: number | null
  explorer: Cell | null
  lamps: WallLamp[]
}
export const BREAKTHROUGHS = [27, 16] as const
export const WATER_FLOOR_Y = 22
export const freshExploration = (): ExplorationState => ({ clueFound: false, pickaxeUpgraded: false, entered: false, springFound: false, metXiaoman: false, foundMushroom: false, foundClay: false, shaftX: null, explorer: null, lamps: [] })

/**
 * 岩层蓝图（软土口袋）：第一夜只开放几处被坚硬岩层包围的可挖区域，
 * 避免玩家误挖整张地图，同时给自由建设留出空间。
 */
const SOFT_POCKETS: readonly Rect[] = [
  {x:3,y:103,w:38,h:4},
  {x:3,y:91,w:38,h:4},
  { x:3,y:79,w:38,h:4 },
  { x: 2, y: HOME_ROOM_TOP, w: 15, h: HOME_FLOOR_Y - HOME_ROOM_TOP }, // 左翼横向扩建，不再纵向掏成高洞
  { x: 26, y: HOME_ROOM_TOP, w: 16, h: HOME_FLOOR_Y - HOME_ROOM_TOP }, // 右翼与大厅共用同一地板
  { x: 3, y: 19, w: 38, h: 3 }, // 连续横向建设带，底面保持实心
  { x: 3, y: 31, w: 38, h: 3 }, // 晶簇层：三格净高、自由横向建设
  { x: 3, y: 43, w: 38, h: 4 }, // 暖光大厅：四格净高的公共建设带
  { x: 3, y: 67, w: 38, h: 4 },
  { x: 3, y: 55, w: 38, h: 4 }, // 菌光花园：四格净高，保留地板与前侧通路
]

/**
 * 初始已挖空的洞窟：旧避难所大厅、地表竖井、大厅左侧缺口。
 * 大厅四周保持坚硬岩石，天然禁止破坏初始核心房间。
 */
const CARVED_CAVES: readonly Rect[] = [
  {x:10,y:103,w:9,h:4},
  {x:24,y:103,w:15,h:4},
  {x:10,y:91,w:9,h:4},
  {x:24,y:91,w:15,h:4},
  { x:10,y:79,w:9,h:4 },
  { x:24,y:79,w:15,h:4 },
  { x: 17, y: 7, w: 9, h: 5 },
  { x: 21, y: 4, w: 2, h: 4 },
  { x: 15, y: 9, w: 2, h: 3 }, // 大厅左门落地连通，不必爬墙上床
  // 天然洞穴，不与暖窝层连通；轮廓保留不规则的顶、底和岩柱。
  { x: 24, y: 18, w: 8, h: 4 },
  { x: 10, y: 19, w: 7, h: 3 },
  { x: 32, y: 19, w: 5, h: 3 },
  { x: 14, y: 31, w: 5, h: 3 },
  { x: 24, y: 30, w: 13, h: 4 },
  { x: 24, y: 42, w: 14, h: 5 },
  { x: 10, y: 43, w: 9, h: 4 },
  { x: 24, y: 55, w: 15, h: 4 },
  { x: 10, y: 55, w: 9, h: 4 },
  { x: 10, y: 67, w: 9, h: 4 },
  { x: 24, y: 67, w: 15, h: 4 },
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
  // 指定的小矿脉；硬岩镐只处理这几格，不开放整个地壳。
  for (const y of [31, 32, 33]) for (const x of [10, 11]) tiles[y][x] = TILE.ROCK
  return {
    finale:freshFinale(),
    ruins:freshRuins(),
    ventilation: freshVentilation(),
    reservoir: freshReservoir(),
    garden: freshGarden(),
    hall: freshHall(),
    deep: freshDeep(),
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
    shelves: [],
    nurseries: [],
    workers: {},
    partnerUpgrades: [],
    exploration: freshExploration(),
    farm: freshFarm(),
    powerDown: false,
    memories: freshMemories(),
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
