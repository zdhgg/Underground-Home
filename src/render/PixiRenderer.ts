import { Application, Container, Graphics, Sprite, Text, Texture, TilingSprite, type Ticker } from 'pixi.js'
import {
  LANDMARKS,
  MAP_HEIGHT,
  MAP_WIDTH,
  STRATA,
  SURFACE_Y,
  TILE,
  TILE_SIZE,
  isInside,
  type Cell,
  type SleepPod,
  type TileType,
  type WorldState,
  type WorkerId,
} from '../core/world'
import { loadTerrainTextures, type EdgeDirection, type TerrainTextures } from './terrainTextures'
import { SHAFT_LAST_Y, shaftFrontier } from '../core/exploration'
import { ENERGY_CORE_DISPLAY_WIDTH, ENERGY_CORE_SOCKET_ANCHOR, loadEnergyCoreTexture } from './energyCoreTexture'
import { CRYSTAL_DISPLAY_HEIGHT, loadCrystalTexture } from './crystalTexture'
import { CRYSTAL_INSTALL_DURATION, CrystalFeedback } from './CrystalFeedback'
import { createShelterFixtures, LAMP_LOCATIONS, loadShelterFixtureTextures, type ShelterFixtureTextures } from './shelterFixtures'
import { bedSlots, drawSleepPod } from './sleepPods'
import { loadNestTextures, type NestTextures } from './nestArt'
import { loadLoungeTextures, type LoungeTextures } from './loungeArt'
import { findEntranceRoute } from './friendRoutes'
import { POD_SIZE, BEDS_PER_POD } from '../core/build'
import { availablePartners, partnerBed, type PartnerId } from '../core/partners'
import { hitPartner, type PartnerHitTarget } from './partnerHitTest'
import { PartnerFeedback } from './partnerFeedback'
import type { SoilPlan } from '../core/atu'
import { RoomScene } from './roomScene'
import { LootFeedback } from './lootFeedback'
import { digLoot } from '../core/materials'
import { podBlocksPassage } from '../core/passages'
import type { RoomPreview } from '../app/roomEditor'
import { PartnerMotion } from './partnerMotion'
import type { WorkPlan } from '../core/partnerWork'
import { LightingScene } from './lightingScene'
import { powerLinePath } from '../core/power'
import { drawCollection, loadCollectionTextures, type CollectionTextures } from './collectionScene'
import { WATER_BARREL_X, WATER_BARREL_Y, drawPlanter, drawRipeGlow, drawWaterLine } from './farmProps'
import { createStrataBackdrop, createStrataLabels, terrainTint } from './strataScene'
import { SurfaceScene, SURFACE_ENTRANCE } from './surfaceScene'
import { loadSurfaceTextures, type SurfaceTextures } from './surfaceTextures'
import { loadEnvironmentTextures, type EnvironmentTextures } from './environmentArt'
import { ExplorationScene } from './explorationScene'
import { loadMoleTextures, MoleVisual, type MoleTextures } from './moleVisual'
import { OpeningScene } from './OpeningScene'
import { OPENING_DURATION, openingFrame, openingWeatherAt } from './openingTimeline'
import { OpeningSound } from './openingSound'
import { createCompanionVisual, loadCompanionTextures, type CharacterVisual, type CompanionArt } from './companionVisual'
import {
  WORLD_PIXEL_HEIGHT,
  WORLD_PIXEL_WIDTH,
  centerOn,
  clampCamera,
  clampZoom,
  panCamera,
  screenToWorld,
  zoomAt,
  overviewCamera,
  cameraDepth,
  type DepthView,
  type Camera,
  type Viewport,
} from './camera'

/** 渲染调色板（程序化部分：机器、发光体等） */
const COLORS = {
  caveDeep: 0x22313a,
  machineCore: 0x5d6f78,
  machineCoreInner: 0x33474f,
  coreReady: 0xffc978,
  coreReadyInner: 0xfff0d0,
  coreOn: 0x8eebc1,
  coreOnInner: 0xeafff2,
  crystalGlow: 0x8dedfd,
  water: 0x5fb7d6,
  labelCream: 0xeae6d8,
  labelDim: 0xcfd6cc,
  labelReady: 0xffd9a0,
  labelOn: 0xbdf3d2,
  lamp: 0xffe3a6,
  lampCore: 0xfff3c8,
  warmGlow: 0xffd9a0,
} as const

/** 地图上的高亮指引（由会话层根据任务状态计算后传入） */
export interface HighlightSpec {
  x: number
  y: number
  width: number
  height: number
  tone: 'cyan' | 'amber'
}

/** 一次性爆发的粒子效果参数 */
export interface BurstOptions {
  color: number
  count?: number
  speed?: number
  ring?: boolean
  ringRadius?: number
  /** 重力加速度（像素/秒²）；负数 = 轻轻上飘的水汽 */
  gravity?: number
}

const LABEL_FONT = 'ui-rounded, "PingFang SC", "Microsoft YaHei", system-ui, sans-serif'

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  age: number
  life: number
  size: number
  color: number
  gravity: number
  square: boolean
}

interface Ring {
  x: number
  y: number
  age: number
  life: number
  maxRadius: number
  color: number
}

type FriendPose = 'idle' | 'walk' | 'climb' | 'rest'

interface FriendSprite {
  view: Container
  body: Graphics
  visual: CharacterVisual | null
  bodyColor: number
  /** 站立时的身体中心高度 */
  baseY: number
  phase: number
  pose: FriendPose
  /** 休息时床铺的世界坐标；未入住为 null */
  bed: { x: number; y: number } | null
  /** 入场演出正在驱动时，跳过站立 / 呼吸动画 */
  inEntrance: boolean
  /** 自己的床位属于哪一间舱；还没有床（在大厅等新朋友）时为 null */
  podId: number | null
  /** 站在大厅时用的落脚点，重建后用它重算 baseY */
  spot: { x: number; y: number }
  /** 还没入住时头顶的名字标签；住进床里就销毁 */
  nameLabel: Text | null
  /** 伙伴名字：重建与"飞出来"时都要用 */
  partnerName: string
  /** 物种 id：决定画什么特征（大爪子 / 尾灯 / 长耳朵 / 胡须） */
  partnerId: PartnerId
  /** 还没点亮时，阿灯缩在角落——不站大厅、不弹跳、没有名字 */
  hidden: boolean
  /** 角落里的尾光（只有躲着的时候有） */
  tailGlow: Graphics | null
}

interface RoutePoint {
  x: number
  y: number
  pose: 'walk' | 'climb' | 'enter'
}

interface PodTraveller {
  friend: FriendSprite
  delay: number
  duration: number
  points: RoutePoint[]
  /** points 的累计长度，用于按距离插值 */
  lengths: number[]
  total: number
  settled: boolean
}

/** 点亮之后阿灯从角落飞回大厅：一条拱形补间，落地后才有名字 */
interface LampReveal {
  friend: FriendSprite
  elapsed: number
  duration: number
  from: { x: number; y: number }
  to: { x: number; y: number }
}

interface PodEntrance {
  elapsed: number
  travellers: PodTraveller[]
  onSettled: () => void
}

interface CameraTween {
  from: Camera
  to: Camera
  /** 已运行时间；起始为负数表示开场延迟 */
  elapsed: number
  duration: number
}

/** 每格瓦片的精灵：1 张基础贴图 + 4 张方向边缘叠图 */
interface TileCellSprites {
  base: Sprite
  /** [top, right, bottom, left] */
  edges: [Sprite, Sprite, Sprite, Sprite]
}

/** 四向叠图只依赖四邻：挖掘 / 撤销刷新自身与四邻，共 5 格。 */
const NEIGHBORHOOD: ReadonlyArray<{ dx: number; dy: number }> = [
  { dx: 0, dy: 0 },
  { dx: 1, dy: 0 },
  { dx: -1, dy: 0 },
  { dx: 0, dy: 1 },
  { dx: 0, dy: -1 },
]

/** 边缘叠图方向（对应实心块的哪一侧是空洞） */
const EDGE_DIRECTIONS: ReadonlyArray<{ direction: EdgeDirection; dx: number; dy: number }> = [
  { direction: 'top', dx: 0, dy: -1 },
  { direction: 'right', dx: 1, dy: 0 },
  { direction: 'bottom', dx: 0, dy: 1 },
  { direction: 'left', dx: -1, dy: 0 },
]

function hash(x: number, y: number): number {
  const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453
  return n - Math.floor(n)
}

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n))
}

function easeInOutCubic(k: number): number {
  return k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2
}

// ---------- 伙伴：体态、站位与一次性入场 ----------

const FRIEND_RADIUS = 13
const FRIEND_REST_SCALE = 0.65
const FRIEND_OUTLINE = 0x3a4a44
/** 建成后先"准备一下"再出发，让玩家看清小床已经出现 */
const ENTRANCE_PREPARE_DELAY = 0.45
const ENTRANCE_STAGGER = 0.3
const ENTRANCE_SEGMENT_TIME = 0.22

/** 还没上床的伙伴站在大厅的位置（y 是脚下的格子行） */
const IDLE_SPOTS: Record<PartnerId, Cell> = {
  atu: { x: 18.6, y: 11 }, adeng: { x: 23.9, y: 11 },
  // 小满在泉水层的洞穴里等玩家；小泉找到水后才到泉边/大厅。
  xiaoman: { x: 25.4, y: 21 }, xiaoquan: { x: 25.3, y: 11 },
}
/** 阿土的备用造型也用暖灰褐色，其他伙伴保留原配色。 */
const FRIEND_COLORS: Record<PartnerId, number> = { atu: 0xb49478, adeng: 0xb9a7e0, xiaoman: 0xe9b6a7, xiaoquan: 0xe5cf95 }

/** 还没点亮时，阿灯缩在大厅右下角，贴着岩壁 */
const LAMP_CORNER = { x: 25.4, y: 10 } as const
/** 灯亮之后等一小会儿，再让她飞出来 */
const LAMP_REVEAL_DELAY = 0.7
const LAMP_REVEAL_DURATION = 1.25

const REPAIR_CONFETTI_ANCHORS = [
  { x: 18.6 * TILE_SIZE, y: 11.45 * TILE_SIZE - 56 },
  { x: 23.9 * TILE_SIZE, y: 11.45 * TILE_SIZE - 56 },
  { x: 21.5 * TILE_SIZE, y: 8.4 * TILE_SIZE },
]

/** 身体中心站在该格地面上的高度：向下找到第一块实心格 */
function friendWalkY(world: WorldState, cell: Cell): number {
  for (let y = cell.y + 1; y < world.height; y++) {
    if (world.tiles[y][cell.x] !== TILE.EMPTY) return y * TILE_SIZE - FRIEND_RADIUS
  }
  return (cell.y + 1) * TILE_SIZE - FRIEND_RADIUS
}

/** 爬墙时向有岩壁的一侧贴一点，避免看起来悬空 */
function friendWallOffset(world: WorldState, cell: Cell): number {
  const left = isInside(world, cell.x - 1, cell.y) && world.tiles[cell.y][cell.x - 1] !== TILE.EMPTY
  const right = isInside(world, cell.x + 1, cell.y) && world.tiles[cell.y][cell.x + 1] !== TILE.EMPTY
  if (left && !right) return -3
  if (right && !left) return 3
  return 0
}

/**
 * 四个伙伴共用一套圆身体，靠两三个特征区分物种：
 * 鼹鼠=大爪子+小圆眼镜，萤火虫=尾灯+翅膀，兔子=一立一耷的长耳朵+门牙，水獭=胡须+扁尾巴。
 * 碰撞体积仍然是 FRIEND_RADIUS，特征只是画在身体上的装饰，不影响判定。
 */
function paintFriend(body: Graphics, color: number, pose: FriendPose, partnerId: string): void {
  body.clear()
  if (pose === 'rest') {
    paintResting(body, color, partnerId)
    return
  }
  paintBackFeatures(body, color, partnerId)
  body.circle(0, 0, FRIEND_RADIUS).fill(color).stroke({ width: 2, color: FRIEND_OUTLINE })
  paintFace(body, partnerId)
  paintFrontFeatures(body, color, partnerId)
}

function paintPartner(friend: FriendSprite): void {
  friend.body.visible = friend.visual === null
  if (friend.visual) friend.visual.update(0, friend.pose, 1, friend.hidden)
  else paintFriend(friend.body, friend.bodyColor, friend.pose, friend.partnerId)
}

/** 画在身体之前：耳朵、尾巴、翅膀——根部要被身体压住 */
function paintBackFeatures(body: Graphics, color: number, partnerId: string): void {
  const outline = { width: 1.8, color: FRIEND_OUTLINE }
  if (partnerId === 'xiaoman') {
    // 兔子：左耳立着、右耳耷下来，外加一团圆尾巴
    body.ellipse(-5, -20, 4.5, 10).fill(color).stroke(outline)
    body.ellipse(-5, -20, 2, 6).fill(0xf7d5cc)
    body.ellipse(9, -15, 9, 4.5).fill(color).stroke(outline)
    body.ellipse(9, -15, 5, 2).fill(0xf7d5cc)
    body.circle(13, 8, 3.6).fill(0xfdf6ec).stroke({ width: 1.2, color: FRIEND_OUTLINE })
    return
  }
  if (partnerId === 'xiaoquan') {
    // 水獭：小圆耳朵 + 又粗又扁的尾巴
    body.circle(-8, -10, 4).fill(color).stroke(outline)
    body.circle(8, -10, 4).fill(color).stroke(outline)
    body.ellipse(-14, 9, 6, 3.5).fill(color).stroke({ width: 1.4, color: FRIEND_OUTLINE })
    return
  }
  if (partnerId === 'adeng') {
    // 萤火虫：半透明小翅膀 + 两根触角
    body.ellipse(-11, -8, 7, 4).fill({ color: 0xf4f0ff, alpha: 0.55 })
    body.ellipse(11, -8, 7, 4).fill({ color: 0xf4f0ff, alpha: 0.55 })
    body.moveTo(-4, -12).lineTo(-7, -19).stroke({ width: 1.2, color: FRIEND_OUTLINE })
    body.moveTo(4, -12).lineTo(7, -19).stroke({ width: 1.2, color: FRIEND_OUTLINE })
    body.circle(-7, -19, 1.5).fill(0xffe9a8)
    body.circle(7, -19, 1.5).fill(0xffe9a8)
    return
  }
  // 鼹鼠：耳朵很小，几乎藏在毛里
  body.circle(-9, -9, 3).fill(color).stroke(outline)
  body.circle(9, -9, 3).fill(color).stroke(outline)
}

function paintFace(body: Graphics, partnerId: string): void {
  const ink = 0x2f2a26
  if (partnerId === 'atu') {
    // 鼹鼠：小圆眼镜——他视力不好，挖洞靠鼻子
    body.circle(-5, -3, 4.2).stroke({ width: 1.4, color: 0x3a4a44 })
    body.circle(5, -3, 4.2).stroke({ width: 1.4, color: 0x3a4a44 })
    body.moveTo(-0.8, -3).lineTo(0.8, -3).stroke({ width: 1.4, color: 0x3a4a44 })
    body.circle(-5, -3, 1.3).fill(ink)
    body.circle(5, -3, 1.3).fill(ink)
    return
  }
  if (partnerId === 'adeng') {
    // 萤火虫：一双大眼睛
    body.circle(-4, -2, 2.4).fill(ink)
    body.circle(4, -2, 2.4).fill(ink)
    body.circle(-4.8, -3, 0.8).fill(0xffffff)
    body.circle(3.2, -3, 0.8).fill(0xffffff)
    return
  }
  if (partnerId === 'xiaoman') {
    // 兔子：眼睛 + 两颗门牙
    body.circle(-4, -2, 1.9).fill(ink)
    body.circle(4, -2, 1.9).fill(ink)
    body.roundRect(-2.8, 5, 2.4, 3.6, 1).fill(0xffffff).stroke({ width: 0.8, color: 0xb8a89a })
    body.roundRect(0.4, 5, 2.4, 3.6, 1).fill(0xffffff).stroke({ width: 0.8, color: 0xb8a89a })
    return
  }
  // 水獭：圆眼睛 + 小鼻子
  body.circle(-4, -2, 1.9).fill(ink)
  body.circle(4, -2, 1.9).fill(ink)
  body.circle(0, 2.5, 1.8).fill(0x5a4a3a)
}

/** 把颜色压暗一档：爪子、尾巴这类"同色但更深"的部件用它，换角色配色时不会打架 */
function shade(color: number, factor: number): number {
  const r = Math.round(((color >> 16) & 0xff) * factor)
  const g = Math.round(((color >> 8) & 0xff) * factor)
  const b = Math.round((color & 0xff) * factor)
  return (r << 16) | (g << 8) | b
}

/** 画在身体之后：爪子、尾灯、胡须 */
function paintFrontFeatures(body: Graphics, color: number, partnerId: string): void {
  if (partnerId === 'atu') {
    // 鼹鼠：两只大爪子 + 粉色鼻尖
    const paw = shade(color, 0.72)
    body.ellipse(-14, 9, 5, 6).fill(paw).stroke({ width: 1.5, color: FRIEND_OUTLINE })
    body.ellipse(14, 9, 5, 6).fill(paw).stroke({ width: 1.5, color: FRIEND_OUTLINE })
    body.circle(0, 3.5, 2).fill(0xd98a82)
    return
  }
  if (partnerId === 'adeng') {
    // 萤火虫：尾巴上的灯（一小圈光晕 + 灯芯）
    body.circle(0, 12, 6).fill({ color: 0xffe9a8, alpha: 0.28 })
    body.circle(0, 12, 3.2).fill(0xffe9a8).stroke({ width: 1, color: 0xd8b96a })
    return
  }
  if (partnerId === 'xiaoquan') {
    // 水獭：四根胡须
    for (const [x1, y1, x2, y2] of [[-3, 3, -12, 1], [-3, 5, -12, 6], [3, 3, 12, 1], [3, 5, 12, 6]] as const) {
      body.moveTo(x1, y1).lineTo(x2, y2).stroke({ width: 1, color: 0x6a5a3a })
    }
  }
}

/** 睡着时只露出一个特征，孩子仍然认得出是谁 */
function paintResting(body: Graphics, color: number, partnerId: string): void {
  if (partnerId === 'xiaoman') {
    body.ellipse(-5, -20, 4.2, 9).fill(color).stroke({ width: 1.8, color: FRIEND_OUTLINE })
  } else if (partnerId === 'adeng') {
    body.circle(0, 13, 3).fill({ color: 0xffe9a8, alpha: 0.8 })
  }
  body.circle(0, 0, FRIEND_RADIUS).fill(color).stroke({ width: 2, color: FRIEND_OUTLINE })
  // 被子盖住下半身，只露出头和闭上的眼睛
  body.roundRect(-12, -2, 24, 12, 5).fill(0xfff2d8).stroke({ width: 1.5, color: 0xa9886b })
  body.moveTo(-6, -5).lineTo(-2, -5).moveTo(2, -5).lineTo(6, -5).stroke({ width: 2, color: 0x403c38 })
}

/**
 * PixiJS 渲染器：只负责"世界 → 画面"。
 * 不包含任何游戏规则；挖掘 / 互动判定由 core 决定后再通知本层刷新。
 */
export class PixiWorldRenderer {
  onViewChanged?: (view: DepthView) => void
  private overview = false
  get isOverview(): boolean { return this.overview }
  private readonly worldLayer = new Container()
  /** 地形层：底色 + 洞穴背景 + 瓦片精灵池（最底层） */
  private readonly terrainLayer = new Container()
  private readonly backdrop = new Graphics()
  private readonly surfaceScene: SurfaceScene
  private readonly landmarkLayer = new Container()
  /** 大厅后墙的收藏架：显示已经挖到的旧物，不改变通行。 */
  private readonly relicLayer = new Container()
  /** 第一层的生产道具：种植槽与"水到家"的水管 / 水缸 */
  private readonly farmLayer = new Container()
  /** 水流动感与成熟光圈：每帧重画，位于黑暗之上 */
  private readonly farmFlow = new Graphics()
  private readonly shelterFixtures: Container
  private readonly lampFixtures: Sprite[]
  private readonly glowLayer = new Container()
  private readonly friendsLayer = new Container()
  /** 阿土单独受光，暗处仍看得清脸；阿灯继续在原黑暗层里躲藏。 */
  private readonly moleLayer = new Container()
  private readonly podLayer = new Container()
  private readonly buildPreview = new Container()
  private readonly darkness = new Graphics()
  private readonly lamps = new Graphics()
  private readonly highlightGfx = new Graphics()
  private readonly effects = new Graphics()
  private readonly hover = new Graphics()
  private readonly partnerFeedback = new PartnerFeedback()
  private readonly roomScene = new RoomScene()
  private roomPreview: RoomPreview | null = null
  private readonly explorationScene: ExplorationScene
  private readonly openingScene: OpeningScene
  private readonly openingSound = new OpeningSound()
  private opening: { elapsed: number; done: () => void; caption: (text: string) => void } | null = null

  private crystal: Container | null = null
  private readonly crystalFeedback: CrystalFeedback
  private springGlow: Graphics | null = null
  private machineGlow: Graphics | null = null
  private friends: FriendSprite[] = []
  private readonly partnerMotion = new PartnerMotion()
  private readonly lightingScene = new LightingScene()
  private podEntrance: PodEntrance | null = null
  private particles: Particle[] = []
  private readonly lootFeedback = new LootFeedback()
  private rings: Ring[] = []
  private highlight: HighlightSpec | null = null
  /** 瓦片精灵池：[y][x]，y < SURFACE_Y 为 null */
  private tileSprites: (TileCellSprites | null)[][] = []

  private world: WorldState | null = null
  private hoverCell: Cell | null = null
  private camera: Camera = { x: 0, y: 0, zoom: 1 }
  private cameraTween: CameraTween | null = null
  private viewport: Viewport
  private elapsed = 0
  private frameCount = 0
  /** 0 = 全黑，1 = 灯火通明（修复能源核心后平滑过渡） */
  private lightLevel = 0
  /** 机器启动动画剩余时间（快速闪烁） */
  private spinUp = 0
  /** 等灯光亮到一定程度后触发一次庆祝 */
  private pendingCelebration = false
  private celebrationTime = 0
  /** 灯亮之后阿灯飞出来的补间与它的延迟 */
  private lampReveal: LampReveal | null = null
  private lampRevealDelay = 0
  /** 电线的发光折线（只在通电后出现） */
  private readonly powerLine = new Graphics()
  /** 0 = 第二层全黑，1 = 电已经送到 */
  private powerLevel = 0
  /** 送电瞬间沿电线跑下去的那颗光点 */
  private powerSurge = 0

  static async create(host: HTMLElement): Promise<PixiWorldRenderer> {
    // 素材加载失败时交给现有初始化反馈；不留下未使用的 GPU 应用和画布。
    const [textures, energyCoreTexture, crystalTexture, fixtureTextures, moleTextures, companionTextures, surfaceTextures, nestTextures, loungeTextures, collectionTextures, environmentTextures] = await Promise.all([
      loadTerrainTextures(), loadEnergyCoreTexture(), loadCrystalTexture(), loadShelterFixtureTextures(), loadMoleTextures(), loadCompanionTextures(),
      loadSurfaceTextures(), loadNestTextures(), loadLoungeTextures(), loadCollectionTextures(), loadEnvironmentTextures(),
    ])
    const app = new Application()
    await app.init({
      background: COLORS.caveDeep,
      resizeTo: host,
      antialias: true,
      autoDensity: true,
      resolution: Math.min(window.devicePixelRatio || 1, 2),
      preference: 'webgl',
    })
    host.appendChild(app.canvas)
    return new PixiWorldRenderer(app, textures, energyCoreTexture, crystalTexture, fixtureTextures, moleTextures, companionTextures, surfaceTextures, nestTextures, loungeTextures, collectionTextures, environmentTextures)
  }

  private constructor(
    private readonly app: Application,
    private readonly textures: TerrainTextures,
    private readonly energyCoreTexture: Texture,
    private readonly crystalTexture: Texture,
    fixtureTextures: ShelterFixtureTextures,
    private readonly moleTextures: MoleTextures | null,
    private readonly companionTextures: CompanionArt,
    surfaceTextures: SurfaceTextures,
    private readonly nestTextures: NestTextures,
    loungeTextures: LoungeTextures,
    private readonly collectionTextures: CollectionTextures,
    private readonly environmentTextures: EnvironmentTextures | null,
  ) {
    this.roomScene.setTextures(nestTextures)
    this.roomScene.setLoungeTextures(loungeTextures)
    this.surfaceScene = new SurfaceScene(surfaceTextures)
    this.explorationScene = new ExplorationScene(moleTextures, environmentTextures)
    this.environmentTextures = environmentTextures
    this.openingScene = new OpeningScene(moleTextures)
    const fixtures = createShelterFixtures(fixtureTextures)
    this.shelterFixtures = fixtures.view
    this.lampFixtures = fixtures.lamps
    this.crystalFeedback = new CrystalFeedback(crystalTexture)
    this.viewport = { width: app.screen.width, height: app.screen.height }
    // 地形：底色 → 洞穴背景 → 瓦片与边缘
    this.buildBackdrop()
    this.terrainLayer.addChild(this.backdrop)
    this.buildCaveBackground()
    this.buildTerrainPool()
    // 顺序即光照逻辑：结构在黑暗之下，发光物与标签在黑暗之上
    this.worldLayer.addChild(
      this.terrainLayer,
      this.surfaceScene.view,
      this.roomScene.view,
      this.lightingScene.view,
      this.shelterFixtures,
      this.landmarkLayer,
      this.relicLayer,
      this.farmLayer,
      this.podLayer,
      this.friendsLayer,
      this.darkness,
      this.moleLayer,
      this.glowLayer,
      createStrataLabels(),
      this.explorationScene.view,
      this.openingScene.view,
      this.lamps,
      this.farmFlow,
      this.powerLine,
      this.highlightGfx,
      this.effects,
      this.lootFeedback.view,
      this.partnerMotion.effects,
      this.partnerFeedback.view,
      this.crystalFeedback.view,
      this.hover,
      this.roomScene.overlay,
      this.lightingScene.preview,
      this.buildPreview,
    )
    app.stage.addChild(this.worldLayer)
    app.ticker.add(this.tick)
  }

  /** 画布元素（供输入层绑定指针事件） */
  get canvasElement(): HTMLCanvasElement {
    return this.app.canvas
  }

  playOpening(done: () => void, caption: (text: string) => void): void {
    this.cameraTween = null
    this.overview = false
    this.opening = { elapsed: 0, done, caption }
    this.openingScene.view.visible = true
    this.explorationScene.view.visible = false
    this.highlightGfx.visible = false
    this.syncMoleVisibility()
    this.updateOpening(0)
  }

  enableOpeningSound(): void { if (this.opening) this.openingSound.enable() }

  /** 跳过与自然结束共用唯一出口；不触碰地图、角色记录或任务判定。 */
  finishOpening(): void {
    const opening = this.opening
    if (!opening) return
    this.opening = null
    this.openingSound.stop()
    this.openingScene.view.visible = false
    this.explorationScene.view.visible = true
    this.highlightGfx.visible = true
    if (this.crystal) this.crystal.visible = true
    this.refreshExploration()
    this.manualCamera = false
    this.focusHome()
    if (this.app.canvas.dataset) this.app.canvas.dataset.openingPhase = 'finished'
    opening.done()
  }

  private updateOpening(dt: number): void {
    const opening = this.opening
    if (!opening) return
    opening.elapsed += dt
    if (opening.elapsed >= OPENING_DURATION) { this.finishOpening(); return }
    const destination = this.world!.exploration.explorer!
    const frame = openingFrame(opening.elapsed, (destination.x + .5) * TILE_SIZE)
    this.openingScene.update(frame)
    this.openingSound.update(frame)
    opening.caption(frame.speech || frame.caption)
    if (this.crystal) this.crystal.visible = frame.clue > 0
    const portrait = this.viewport.width < 600
    const zoom = clampZoom(Math.min(2.1, this.viewport.width / (portrait ? 360 : 560), this.viewport.height / 285))
    const close = centerOn(portrait ? 19.5 * TILE_SIZE : 21 * TILE_SIZE, frame.cameraY, this.viewport, zoom)
    const home = this.homeCamera()
    const k = frame.pullback
    this.camera = { x: close.x + (home.x - close.x) * k, y: close.y + (home.y - close.y) * k, zoom: close.zoom + (home.zoom - close.zoom) * k }
    this.applyCamera()
    if (this.app.canvas.dataset) Object.assign(this.app.canvas.dataset, { openingPhase: frame.phase, openingTime: String(frame.t), openingX: String(frame.x), openingFootY: String(frame.footY) })
  }

  /** 绑定世界数据（初始加载与替换时调用） */
  setWorld(world: WorldState): void {
    this.lootFeedback.clear()
    this.lightingScene.preview.clear()
    this.partnerMotion.cancel()
    this.roomPreview = null
    this.partnerFeedback.reset()
    this.crystalFeedback.reset()
    this.spinUp = 0
    this.pendingCelebration = false
    this.celebrationTime = 0
    this.lampReveal = null
    this.lampRevealDelay = 0
    this.cameraTween = null
    this.world = world
    this.lightLevel = world.progress.coreRepaired ? 1 : 0
    this.powerLevel = world.powerDown ? 1 : 0
    this.refresh()
  }

  /** 世界数据变化后刷新画面（收集 / 修复 / 载入 / 撤销后调用） */
  refresh(): void {
    this.refreshRooms()
    this.refreshTerrain()
    this.rebuildLandmarks()
    this.refreshRelics()
    this.refreshFarm()
    this.refreshPods()
    this.rebuildFriends()
    this.refreshExploration()
  }

  /** 只重建种植槽与水管：种下、长大、收获、引水完成后调用 */
  refreshRooms(): void { if (this.world) this.roomScene.refresh(this.world, this.roomPreview) }
  setRoomPreview(value: RoomPreview | null): void { this.roomPreview = value; this.refreshRooms() }

  refreshFarm(): void {
    for (const child of this.farmLayer.removeChildren()) child.destroy({ children: true })
    const world = this.world
    if (!world) return
    if (world.farm.waterSupplied) this.farmLayer.addChild(drawWaterLine(world, this.environmentTextures))
    for (const planter of world.farm.planters) this.farmLayer.addChild(drawPlanter(planter, this.environmentTextures))
  }

  /** 水在管子里流动 + 熟了的槽呼吸：纯画面，每帧重画，不读也不写世界。 */
  private drawFarmFlow(): void {
    const g = this.farmFlow
    g.clear()
    const world = this.world
    if (!world || !world.farm.waterSupplied) return
    const legacy = world.farm.planters.some((planter) => planter.y < 12)
      || world.rooms.some((room) => room.kind === 'garden' && room.status !== 'blueprint')
    if (legacy) {
      const column = world.exploration.shaftX
      if (column !== null) {
        const pipeX = (column + 0.5) * TILE_SIZE + 9
        const top = 11 * TILE_SIZE + 12
        const bottom = 21.8 * TILE_SIZE
        for (let i = 0; i < 6; i++) {
          const progress = ((this.elapsed * 0.42 + i / 6) % 1)
          g.circle(pipeX, bottom - progress * (bottom - top), 2.2).fill({ color: 0xd7f4ff, alpha: 0.75 })
        }
      }
    } else {
      const springX = (LANDMARKS.spring.x + 0.5) * TILE_SIZE
      const barrelX = WATER_BARREL_X * TILE_SIZE
      const pipeY = (WATER_BARREL_Y + 1) * TILE_SIZE - 8
      for (let i = 0; i < 6; i++) {
        const progress = ((this.elapsed * 0.42 + i / 6) % 1)
        g.circle(springX + (barrelX - springX) * progress, pipeY, 2.2).fill({ color: 0xd7f4ff, alpha: 0.75 })
      }
    }
    drawRipeGlow(g, world, this.elapsed)
  }

  /** 只重建伙伴精灵：建成 / 撤销睡眠舱、找到水出现新朋友时调用 */
  refreshFriends(arrivingPodId: number | null = null): void {
    this.rebuildFriends(arrivingPodId)
  }

  playPartnerTravel(id: WorkerId, route: Cell[], step: (p: Cell) => void, done: () => void): void {
    const friend = this.friends.find(f => f.partnerId === id)
    if (!friend) return
    this.finishLampReveal()
    this.partnerMotion.travel(friend, route, step, done)
  }
  playPartnerWork(plan: WorkPlan, strike: () => void, done: () => void): void {
    const friend = this.friends.find(f => f.partnerId === plan.worker)
    if (friend) this.partnerMotion.work(friend, plan, strike, done)
  }
  cancelPartnerWork(): void { this.partnerMotion.cancel(); this.rebuildFriends() }

  /** 只重建遗物道具：挖到遗物、或撤销把遗物埋回去之后调用 */
  refreshRelics(): void {
    for (const child of this.relicLayer.removeChildren()) child.destroy({ children: true })
    const world = this.world
    if (!world) return
    this.relicLayer.addChild(drawCollection(world, this.collectionTextures))
  }

  refreshExploration(): void {
    if (this.world) this.lightingScene.refresh(this.world)
    if (this.world) this.explorationScene.refresh(this.world)
    this.syncMoleVisibility()
  }
  setLampPreview(cell: Cell | null): void { if (this.world) this.lightingScene.showPreview(this.world, cell) }
  playExplorationTravel(points: Cell[], done: () => void, step?: (cell: Cell) => void): void {
    this.explorationScene.travel(points, done, step)
    this.syncMoleVisibility()
  }

  private syncMoleVisibility(): void {
    const atu = this.friends.find((friend) => friend.partnerId === 'atu')
    if (atu) atu.view.visible = !this.opening && !this.explorationScene.visible
  }

  playSoilWork(plan: SoilPlan, strike: () => void, done: () => void): void { this.explorationScene.soil(plan, strike, done) }
  setAtuTarget(target: Cell | null, stand?: Cell, lift = 0, text = ''): void { this.explorationScene.preview(target, stand, lift, text) }

  private manualCamera = false
  findAtu(): void {
    const p = this.world?.exploration.explorer
    if (p) { this.manualCamera = false; this.focusOn((p.x + .5) * TILE_SIZE, (p.y + .2) * TILE_SIZE) }
  }

  private followAtuAtEdge(dt: number): void {
    if (this.manualCamera || this.overview || this.cameraTween || !this.explorationScene.animating) return
    const p = this.explorationScene.speechAnchor
    if (!p) return
    const x = (p.x - this.camera.x) * this.camera.zoom, y = (p.y - this.camera.y) * this.camera.zoom
    if (x < 85 || x > this.viewport.width - 85 || y < 60 || y > this.viewport.height - 60) {
      const target = centerOn(p.x, p.y, this.viewport, this.camera.zoom), k = Math.min(1, dt * 3)
      this.camera = { ...this.camera, x: this.camera.x + (target.x - this.camera.x) * k, y: this.camera.y + (target.y - this.camera.y) * k }; this.applyCamera()
    }
  }

  /** 是否有正在播出的探索演出（走路 / 挥镐）。 */
  get explorationAnimating(): boolean {
    return this.explorationScene.animating
  }

  /** 累计帧数：会话层用它区分"画面被冻住"和"只是慢"。 */
  get frames(): number {
    return this.frameCount
  }

  /**
   * 安全中断探索演出（切后台 / 窗口长时间失焦 / 演出超时）：
   * 只清动作并把阿土放回世界记录的位置，不回调、不改世界。
   */
  cancelExplorationAnimation(): void {
    this.explorationScene.cancel()
  }

  /** 阿土的一句反应（蹦一下 + 嘴边短句）：纯画面，不锁输入。 */
  playMoleReaction(text: string): void {
    this.explorationScene.react(text)
  }

  playPartnerReaction(id: PartnerId, text: string): void {
    this.partnerFeedback.show(text, () => {
      if (id === 'atu' && this.explorationScene.visible) return this.explorationScene.speechAnchor
      const friend = this.friends.find((friend) => friend.partnerId === id && friend.view.visible)
      return friend ? { x: friend.view.x, y: friend.view.y - (friend.pose === 'rest' ? 20 : 40) } : null
    })
  }

  /**
   * 岩层打通：镜头一次拉到能看全整条梯子的构图，凉风从洞底一路冒上来。
   * 只影响画面，世界数据早已由会话层写好了。
   */
  playBreakthrough(x: number): void {
    const zoom = clampZoom(Math.min(1.2, Math.max(0.9, this.viewport.height / (13 * TILE_SIZE))))
    this.cameraTween = {
      from: { ...this.camera },
      to: centerOn((x + 0.5) * TILE_SIZE, 16.4 * TILE_SIZE, this.viewport, zoom),
      elapsed: 0,
      duration: 0.9,
    }
    for (let y = SHAFT_LAST_Y; y >= STRATA.home.bottom; y--) {
      this.playBurst((x + 0.5) * TILE_SIZE, (y + 0.6) * TILE_SIZE, { color: 0xbfeef0, count: 5, speed: 22, gravity: -16 })
    }
    this.playBurst((x + 0.5) * TILE_SIZE, (SHAFT_LAST_Y + 0.7) * TILE_SIZE, {
      color: 0xa5efdd, count: 24, speed: 62, ring: true, ringRadius: 84,
    })
  }

  /** 首次发现泉水：水花、两层光环、上飘的水汽，镜头轻轻推近水边。 */
  playSpringDiscovery(): void {
    const x = (LANDMARKS.spring.x + 0.5) * TILE_SIZE
    const y = 22 * TILE_SIZE - 7
    this.playBurst(x, y, { color: 0xd9fdf6, count: 26, speed: 118, ring: true, ringRadius: 46 })
    this.playBurst(x, y - 2, { color: 0x9fe6e6, count: 16, speed: 56, gravity: -34 })
    this.playBurst(x, y - 6, { color: 0xfffdf2, count: 12, speed: 34, gravity: -18 })
    this.rings.push({ x, y, age: 0, life: 1.1, maxRadius: 150, color: 0xa5efdd })
    this.cameraTween = {
      from: { ...this.camera },
      to: centerOn(x, y - 30, this.viewport, clampZoom(Math.max(1.05, this.camera.zoom))),
      elapsed: -0.15,
      duration: 0.9,
    }
  }

  /**
   * 一次委托破岩：镜头平滑下移到那段梯子（不硬切），连续施工时也用它跟着走。
   * 玩家的平移 / 缩放会取消补间，镜头永远听玩家的。
   */
  followShaft(x: number): void {
    const frontier = this.world ? shaftFrontier(this.world, x) : null
    const targetY = frontier ? frontier.y : SHAFT_LAST_Y
    this.overview = false
    this.cameraTween = {
      from: { ...this.camera },
      to: centerOn((x + 0.5) * TILE_SIZE, (targetY + 0.5) * TILE_SIZE - 20, this.viewport, Math.max(0.9, this.camera.zoom)),
      elapsed: 0,
      duration: 0.55,
    }
  }

  /**
   * 破岩演出：阿土在梯段上挥镐，落镐瞬间回调（由会话层改世界并落地反馈）。
   * 挥镐期间画面先动、世界后变，孩子看到的是"挖开"而不是"隔空消失"。
   */
  playRockBreak(target: Cell, onStrike: () => void): void {
    this.explorationScene.work(target, () => {
      onStrike()
      this.playDigEffect(target)
      this.playBurst((target.x + 0.5) * TILE_SIZE, (target.y + 0.5) * TILE_SIZE, {
        color: 0xd9c295, count: 12, speed: 70, ring: true, ringRadius: 24,
      })
    })
  }

  /** 只重建舱体，不碰伙伴；建成演出先刷新舱体再播放入场 */
  refreshPods(): void {
    this.podEntrance = null
    for (const child of this.podLayer.removeChildren()) child.destroy({ children: true })
    for (const pod of this.world?.pods ?? []) this.podLayer.addChild(drawSleepPod({ ...pod, ...(!podBlocksPassage(this.world!, pod) ? { backWall: true as const } : {}) }, false, this.nestTextures.bunks))
  }

  /**
   * 建造预览：睡眠舱画舱体轮廓，种植槽画一格槽位。
   * cell 传 null 时只清空预览。hint 是预览旁的短句。
   */
  setBuildPreview(
    cell: Cell | null,
    valid = false,
    door: 'left' | 'right' = 'left',
    hint = '',
    kind: 'none' | 'pod' | 'planter' = 'pod',
    planterCell: Cell | null = null,
  ): void {
    for (const child of this.buildPreview.removeChildren()) child.destroy({ children: true })
    if (kind === 'planter' && planterCell) {
      const color = valid ? 0x8fe3a6 : 0xff947e
      const slot = new Graphics()
      slot.rect(planterCell.x * TILE_SIZE + 3, planterCell.y * TILE_SIZE + 12, TILE_SIZE - 6, TILE_SIZE - 14)
        .fill({ color, alpha: 0.18 })
        .stroke({ width: 3, color })
      const trough = drawPlanter({ id: 0, x: planterCell.x, y: planterCell.y, growth: 0 })
      trough.alpha = 0.6
      this.buildPreview.addChild(trough, slot)
      if (hint) this.addBuildHint(hint, valid, planterCell.x + 0.5, planterCell.y, 1)
      return
    }
    if (!cell) return
    const color = valid ? 0x8fe3a6 : 0xff947e
    const room = drawSleepPod({ ...cell, door }, true, this.nestTextures.bunks)
    room.alpha = 0.6
    const outline = new Graphics()
    outline.rect(cell.x * TILE_SIZE, cell.y * TILE_SIZE, POD_SIZE.w * TILE_SIZE, POD_SIZE.h * TILE_SIZE)
      .fill({ color, alpha: 0.15 })
      .stroke({ width: 3, color })
    this.buildPreview.addChild(room, outline)
    if (hint) this.addBuildHint(hint, valid, cell.x + POD_SIZE.w / 2, cell.y, 2)
  }

  /** 预览旁给一个短句：不用低头看底部面板也能知道行不行。 */
  private addBuildHint(hint: string, valid: boolean, centerX: number, topRow: number, rowsHigh: number): void {
    const label = new Text({
      text: hint,
      style: {
        fontFamily: LABEL_FONT, fontSize: 13, fontWeight: '700',
        fill: valid ? 0xc8f7d2 : 0xffd0c4,
      },
    })
    label.anchor.set(0.5)
    const padX = 8
    const padY = 4
    const width = label.width + padX * 2
    const height = label.height + padY * 2
    const tag = new Container()
    const bg = new Graphics()
    bg.roundRect(-width / 2, -height / 2, width, height, 8).fill({ color: 0x16252b, alpha: 0.82 })
    tag.addChild(bg, label)
    tag.position.set(
      centerX * TILE_SIZE,
      topRow * TILE_SIZE - 10 - height / 2 + (rowsHigh === 1 ? TILE_SIZE / 2 : 0),
    )
    this.buildPreview.addChild(tag)
  }

  /**
   * 刷新地形贴图与边缘。
   * 不传 cells = 全图刷新（载入 / 新世界）；传 cells = 只刷新这些格子及其四邻（挖掘 / 撤销）。
   */
  refreshTerrain(cells?: Cell[]): void {
    const world = this.world
    if (!world) return
    if (!cells) {
      for (let y = SURFACE_Y; y < world.height; y++) {
        for (let x = 0; x < world.width; x++) this.updateTerrainCell(x, y)
      }
      this.redrawHover()
      return
    }
    const seen = new Set<number>()
    for (const cell of cells) {
      for (const { dx, dy } of NEIGHBORHOOD) {
        const x = cell.x + dx
        const y = cell.y + dy
        if (x < 0 || x >= world.width || y < 0 || y >= world.height) continue
        const key = y * world.width + x
        if (seen.has(key)) continue
        seen.add(key)
        this.updateTerrainCell(x, y)
      }
    }
    this.redrawHover()
  }

  /** 设置地图高亮指引；传 null 清除 */
  setHighlight(spec: HighlightSpec | null): void {
    this.highlight = spec
  }

  /** 设置画布鼠标指针形状（pointer / crosshair / default） */
  setCursor(cursor: string): void {
    if (this.app.canvas.style.cursor !== cursor) this.app.canvas.style.cursor = cursor
  }

  /** 在某个格子播放挖掘尘土效果 */
  playDigEffect(cell: Cell): void {
    const cx = (cell.x + 0.5) * TILE_SIZE
    const cy = (cell.y + 0.5) * TILE_SIZE
    for (let i = 0; i < 5; i++) {
      const angle = (Math.PI * 2 * i) / 5 + hash(cell.x + i, cell.y) * 0.8
      this.particles.push({
        x: cx + Math.cos(angle) * 6,
        y: cy + Math.sin(angle) * 6,
        vx: Math.cos(angle) * 46,
        vy: Math.sin(angle) * 46 - 26,
        age: 0,
        life: 0.45,
        size: 3 + hash(i, cell.x) * 2.5,
        color: 0xc9a981,
        gravity: 90,
        square: false,
      })
    }
  }

  playDigLoot(cell: Cell, tile: TileType): void { this.lootFeedback.show(cell, digLoot(cell.x, cell.y, tile)) }

  /** 一次性粒子爆发（收集 / 修复等关键互动的反馈） */
  playBurst(worldX: number, worldY: number, options: BurstOptions): void {
    const count = options.count ?? 10
    const speed = options.speed ?? 80
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + hash(i, worldX) * 0.7
      const v = speed * (0.55 + hash(i, worldY) * 0.6)
      this.particles.push({
        x: worldX + Math.cos(angle) * 5,
        y: worldY + Math.sin(angle) * 5,
        vx: Math.cos(angle) * v,
        vy: Math.sin(angle) * v - 18,
        age: 0,
        life: 0.55,
        size: 2.4 + hash(i, i) * 2,
        color: options.color,
        gravity: options.gravity ?? 70,
        square: false,
      })
    }
    if (options.ring) {
      this.rings.push({
        x: worldX,
        y: worldY,
        age: 0,
        life: 0.75,
        maxRadius: options.ringRadius ?? 90,
        color: options.color,
      })
    }
  }

  /** 收集成功后的晶体上浮消失；世界状态已经由规则层确定。 */
  playCrystalCollection(): void {
    const x = (LANDMARKS.crystal.x + 0.5) * TILE_SIZE
    const y = (LANDMARKS.crystal.y + 0.5) * TILE_SIZE
    this.crystalFeedback.playCollection({ x, y })
    this.playBurst(x, y, { color: COLORS.crystalGlow, count: 10, speed: 75 })
  }

  /** 先将已携带的能源石送入槽口，再衔接原来的启动和点灯演出。 */
  playRepairCelebration(): void {
    this.crystalFeedback.playInstallation({
      x: (LANDMARKS.generator.x + 0.5) * TILE_SIZE,
      y: (LANDMARKS.generator.y + 0.5) * TILE_SIZE,
    })
    this.rebuildLandmarks()
    // 提前排入镜头演出，使安装期间的手动平移 / 缩放仍能取消自动拉远。
    this.cameraTween = {
      from: { ...this.camera },
      to: this.computeRepairShowcase(),
      elapsed: -(CRYSTAL_INSTALL_DURATION + 0.7),
      duration: 1.3,
    }
  }

  /**
   * 电顺着梯道下去：一圈电光从核心出发，沿线爬到第二层那头炸开。
   * 第二层的黑暗由 powerLevel 自己渐变，这里只负责"看得见电流在动"。
   */
  playPowerDown(): void {
    const world = this.world
    if (!world) return
    this.powerSurge = 1.4
    this.playBurst((LANDMARKS.generator.x + 0.5) * TILE_SIZE, (LANDMARKS.generator.y + 0.5) * TILE_SIZE, {
      color: 0xbfefff, count: 12, speed: 70, ring: true, ringRadius: 34,
    })
    const path = powerLinePath(world)
    const tail = path[path.length - 1]
    if (tail) {
      this.playBurst((tail.x + 0.5) * TILE_SIZE, (tail.y + 0.5) * TILE_SIZE, {
        color: 0x9fe6ff, count: 18, speed: 95, ring: true, ringRadius: 46,
      })
    }
  }

  private startRepairCelebration(): void {
    this.rebuildLandmarks()
    this.playBurst((LANDMARKS.generator.x + 0.5) * TILE_SIZE, (LANDMARKS.generator.y + 0.5) * TILE_SIZE, {
      color: COLORS.warmGlow, count: 16, speed: 95, ring: true, ringRadius: 110,
    })
    this.spinUp = 1.2
    this.pendingCelebration = true
    // 灯亮之后，躲在角落的阿灯会飞出来——这是点亮这件事的情感落点。
    if (this.friends.some((friend) => friend.hidden)) this.lampRevealDelay = LAMP_REVEAL_DELAY
  }

  /** 初始 / 回家视角：同时看见地表风雪、地下大厅和左侧能源石区。 */
  focusHome(): void {
    this.overview = false
    this.cancelCameraTween()
    this.camera = this.homeCamera()
    this.applyCamera()
  }

  private homeCamera(): Camera {
    const zoom = clampZoom(Math.min(1.55, Math.max(0.9, this.viewport.width / 920), this.viewport.height / 530))
    const centerX = 17.8 * TILE_SIZE
    const centerY = 5.2 * TILE_SIZE
    return centerOn(centerX, centerY, this.viewport, zoom)
  }

  /** 把某个世界坐标居中（"带我去看看"） */
  focusOn(worldX: number, worldY: number): void {
    this.overview = false
    this.cancelCameraTween()
    this.camera = centerOn(worldX, worldY, this.viewport, Math.max(1, this.camera.zoom))
    this.applyCamera()
  }

  panBy(dxScreen: number, dyScreen: number): void {
    if (this.overview) return
    this.cancelCameraTween()
    this.manualCamera = true
    this.camera = panCamera(this.camera, dxScreen, dyScreen, this.viewport)
    this.applyCamera()
  }

  zoomBy(deltaZoom: number, anchor?: { x: number; y: number }): void {
    if (this.overview) {
      if (deltaZoom > 0) this.focusHome()
      return
    }
    this.cancelCameraTween()
    const point = anchor ?? { x: this.viewport.width / 2, y: this.viewport.height / 2 }
    this.camera = zoomAt(this.camera, deltaZoom, point, this.viewport)
    this.applyCamera()
  }

  /** 屏幕坐标（CSS 像素）→ 瓦片坐标；在地图之外返回 null */
  tileAtScreen(screen: { x: number; y: number }): Cell | null {
    const worldPoint = screenToWorld(this.camera, screen.x, screen.y)
    const x = Math.floor(worldPoint.x / TILE_SIZE)
    const y = Math.floor(worldPoint.y / TILE_SIZE)
    if (!this.world || !isInside(this.world, x, y)) return null
    return { x, y }
  }

  /** 接受画布局部CSS像素。名字以外按真实身体范围命中，再提供触屏容错。 */
  partnerAtScreen(screen: { x: number; y: number }): PartnerId | null {
    if (this.overview) return null
    const targets: PartnerHitTarget[] = this.friends.filter((friend) => friend.view.visible).map((friend) => {
      const b = (friend.visual?.view ?? friend.body).getBounds()
      return { id: friend.partnerId, x: b.minX, y: b.minY, width: b.maxX - b.minX, height: b.maxY - b.minY }
    })
    const explorer = this.explorationScene.hitBounds
    if (explorer) targets.push({ id: 'atu', ...explorer })
    return hitPartner(screen, targets) as PartnerId | null
  }

  setHoverCell(cell: Cell | null): void {
    this.hoverCell = cell
    this.redrawHover()
  }

  hoverPartner(id: PartnerId | null): void {
    for (const friend of this.friends) if (friend.nameLabel) friend.nameLabel.visible = friend.partnerId === id
  }

  focusWater(): void {
    this.overview = false
    this.cameraTween = { from: { ...this.camera }, to: centerOn(STRATA.water.focus.x * TILE_SIZE, STRATA.water.focus.y * TILE_SIZE, this.viewport, 1), elapsed: 0, duration: 0.8 }
  }

  focusOverview(): void {
    this.cancelCameraTween()
    this.overview = true
    this.camera = overviewCamera(this.viewport)
    this.applyCamera()
  }

  destroy(): void {
    this.opening = null
    this.openingSound.stop()
    this.app.ticker.remove(this.tick)
    this.app.destroy(true, { children: true })
  }

  // ---------- 内部：逐帧 ----------

  private readonly tick = (ticker: Ticker): void => {
    const dt = Math.min(0.1, ticker.deltaMS / 1000)
    this.elapsed += dt
    this.roomScene.update(this.elapsed)
    this.frameCount += 1
    this.syncViewport()
    if (this.crystalFeedback.update(dt)) this.startRepairCelebration()
    this.updateCameraTween(dt)
    if (this.spinUp > 0) this.spinUp = Math.max(0, this.spinUp - dt)
    if (this.powerSurge > 0) this.powerSurge = Math.max(0, this.powerSurge - dt)
    this.updateLighting(dt)
    this.drawHighlight()
    this.updateMachineGlow()
    this.updateFriends(dt)
    this.partnerMotion.update(dt)
    this.updateEffects(dt)
    this.explorationScene.update(dt)
    this.followAtuAtEdge(dt)
    this.partnerFeedback.update(dt)
    this.drawFarmFlow()
    this.drawPowerLine()
    if (this.crystal) this.crystal.alpha = 0.7 + 0.3 * Math.sin(this.elapsed * 3)
    if (this.springGlow) this.springGlow.alpha = 0.65 + 0.35 * Math.sin(this.elapsed * 1.6)
    this.updateOpening(dt)
    this.surfaceScene.update(this.elapsed, this.opening ? openingWeatherAt(this.opening.elapsed) : undefined)
  }

  private syncViewport(): void {
    const width = this.app.screen.width
    const height = this.app.screen.height
    if (width === this.viewport.width && height === this.viewport.height) return
    this.viewport = { width, height }
    this.camera = this.overview ? overviewCamera(this.viewport) : clampCamera(this.camera, this.viewport)
    this.applyCamera()
  }

  private applyCamera(): void {
    this.surfaceScene.setCamera(this.camera, this.viewport)
    this.roomScene.setZoom(this.camera.zoom)
    this.worldLayer.scale.set(this.camera.zoom)
    this.worldLayer.position.set(-this.camera.x * this.camera.zoom, -this.camera.y * this.camera.zoom)
    this.app.canvas.dataset && Object.assign(this.app.canvas.dataset, { cameraX: String(this.camera.x), cameraY: String(this.camera.y), zoom: String(this.camera.zoom) })
    this.onViewChanged?.(cameraDepth(this.camera, this.viewport, this.overview))
  }

  private computeRepairShowcase(): Camera {
    const centerX = (LANDMARKS.shelter.x + LANDMARKS.shelter.w / 2) * TILE_SIZE - TILE_SIZE
    const centerY = (LANDMARKS.shelter.y + LANDMARKS.shelter.h / 2) * TILE_SIZE - 40
    const zoom = clampZoom(Math.min(1.15, this.viewport.width / 1250))
    return centerOn(centerX, centerY, this.viewport, zoom)
  }

  private cancelCameraTween(): void {
    this.cameraTween = null
  }

  private updateCameraTween(dt: number): void {
    const tween = this.cameraTween
    if (!tween) return
    tween.elapsed += dt
    if (tween.elapsed < 0) return
    const k = Math.min(1, tween.elapsed / tween.duration)
    const e = easeInOutCubic(k)
    this.camera = clampCamera(
      {
        x: tween.from.x + (tween.to.x - tween.from.x) * e,
        y: tween.from.y + (tween.to.y - tween.from.y) * e,
        zoom: tween.from.zoom + (tween.to.zoom - tween.from.zoom) * e,
      },
      this.viewport,
    )
    this.applyCamera()
    if (k >= 1) this.cameraTween = null
  }

  // ---------- 内部：光照 ----------

  private updateLighting(dt: number): void {
    const target = this.world?.progress.coreRepaired && !this.crystalFeedback.installing ? 1 : 0
    if (Math.abs(this.lightLevel - target) < 0.002) {
      this.lightLevel = target
    } else {
      this.lightLevel += (target - this.lightLevel) * Math.min(1, dt * 1.6)
    }
    if (this.pendingCelebration && this.lightLevel > 0.72) {
      this.pendingCelebration = false
      this.celebrationTime = 2.6
      this.spawnConfetti()
    }
    // 第二层要等电送下来才亮：比第一层慢一点，像电流真的顺着线爬下去。
    const powerTarget = this.world?.powerDown ? 1 : 0
    if (Math.abs(this.powerLevel - powerTarget) < 0.002) {
      this.powerLevel = powerTarget
    } else {
      this.powerLevel += (powerTarget - this.powerLevel) * Math.min(1, dt * 1.1)
    }
    this.drawLighting()
  }

  private drawLighting(): void {
    const g = this.darkness
    g.clear()
    const lampG = this.lamps
    lampG.clear()
    if (!this.world) return

    // 未点亮时的地下昏暗 + 能源核心周围的微弱暖光
    const darkAlpha = 0.42 * (1 - this.lightLevel)
    if (darkAlpha > 0.01) {
      g.rect(0, SURFACE_Y * TILE_SIZE, WORLD_PIXEL_WIDTH, (STRATA.seal.top - SURFACE_Y) * TILE_SIZE).fill({
        color: 0x0a1620,
        alpha: darkAlpha,
      })
      const gx = (LANDMARKS.generator.x + 0.5) * TILE_SIZE
      const gy = (LANDMARKS.generator.y + 0.5) * TILE_SIZE
      const warm = 0.11 * (1 - this.lightLevel)
      g.circle(gx, gy, 300).fill({ color: COLORS.warmGlow, alpha: warm * 0.3 })
      g.circle(gx, gy, 190).fill({ color: COLORS.warmGlow, alpha: warm * 0.4 })
      g.circle(gx, gy, 100).fill({ color: COLORS.warmGlow, alpha: warm * 0.5 })
    }

    // 第二层：没送电前很暗；电到了以后只剩一点夜色，泉水与壁灯才能真正亮起来。
    g.rect(0, STRATA.seal.top * TILE_SIZE, WORLD_PIXEL_WIDTH, (MAP_HEIGHT - STRATA.seal.top) * TILE_SIZE)
      .fill({ color: 0x071827, alpha: 0.43 * (1 - this.powerLevel) + 0.05 * this.powerLevel })

    // 修复后：大厅顶部的灯一盏一盏依次亮起
    for (const [i, { x: lx, y: ly }] of LAMP_LOCATIONS.entries()) {
      const on = this.lightLevel > 0.02 ? clamp01((this.lightLevel - i * 0.075) / 0.22) : 0
      // 浅色灯罩在未通电时压暗，随原有点亮进度恢复，不修改光照时序。
      const shade = Math.round(255 * (0.4 + 0.6 * on))
      this.lampFixtures[i].tint = shade * 0x010101
      if (on <= 0.01) continue
      const flicker = 0.85 + 0.15 * Math.sin(this.elapsed * (2.6 + i * 0.37) + i * 1.7)
      lampG.circle(lx, ly, 22).fill({ color: COLORS.lamp, alpha: 0.15 * on * flicker })
      lampG.circle(lx, ly, 3.5 + 1.5 * on).fill({ color: COLORS.lampCore, alpha: 0.95 * on })
    }
  }

  /**
   * 电线：从核心下到大厅地面，沿地面走到梯道，再顺着梯子下到第二层。
   * 没通电就完全不画——没接电的线不该看起来像在供电。
   */
  private drawPowerLine(): void {
    const g = this.powerLine
    g.clear()
    const world = this.world
    if (!world?.powerDown) return
    const path = powerLinePath(world)
    if (path.length < 2) return
    const pulse = 0.5 + 0.5 * Math.sin(this.elapsed * 3.2)
    const trace = (): void => {
      for (let i = 1; i < path.length; i++) {
        const a = path[i - 1]
        const b = path[i]
        g.moveTo((a.x + 0.5) * TILE_SIZE, (a.y + 0.5) * TILE_SIZE)
          .lineTo((b.x + 0.5) * TILE_SIZE, (b.y + 0.5) * TILE_SIZE)
      }
    }
    trace()
    g.stroke({ width: 6, color: 0x4fc3f7, alpha: 0.1 + 0.06 * pulse })
    trace()
    g.stroke({ width: 1.6, color: 0xcfeeff, alpha: 0.4 + 0.3 * pulse })
    // 送电的一瞬间：一颗白光沿线跑下去
    if (this.powerSurge > 0) {
      const t = 1 - this.powerSurge / 1.4
      const cell = path[Math.min(path.length - 1, Math.floor(t * (path.length - 1)))]
      g.circle((cell.x + 0.5) * TILE_SIZE, (cell.y + 0.5) * TILE_SIZE, 7)
        .fill({ color: 0xffffff, alpha: 0.75 })
    }
  }

  private updateMachineGlow(): void {
    const glow = this.machineGlow
    const world = this.world
    if (!glow || !world) return
    const { crystalCollected, coreRepaired } = world.progress
    if (coreRepaired && !this.crystalFeedback.installing) {
      // 启动瞬间快速闪烁，随后稳定运转
      glow.alpha = this.spinUp > 0 ? 0.3 + 0.7 * (0.5 + 0.5 * Math.sin(this.elapsed * 28)) : 1
    } else if (crystalCollected) {
      // 拿到能源石后核心微微呼吸，提示"可以来装了"
      glow.alpha = 0.65 + 0.35 * Math.sin(this.elapsed * 4)
    } else {
      glow.alpha = 1
    }
  }

  // ---------- 内部：高亮指引 ----------

  private drawHighlight(): void {
    const g = this.highlightGfx
    g.clear()
    const spec = this.highlight
    if (!spec) return
    const pulse = 0.5 + 0.5 * Math.sin(this.elapsed * 3)
    const color = spec.tone === 'amber' ? 0xffdf97 : 0x8ceaff
    g.rect(spec.x, spec.y, spec.width, spec.height).fill({ color, alpha: 0.05 + 0.07 * pulse })
    const len = 16
    const corners: Array<[number, number, number, number]> = [
      [spec.x, spec.y, 1, 1],
      [spec.x + spec.width, spec.y, -1, 1],
      [spec.x, spec.y + spec.height, 1, -1],
      [spec.x + spec.width, spec.y + spec.height, -1, -1],
    ]
    for (const [cx, cy, dx, dy] of corners) {
      g.moveTo(cx, cy + dy * len).lineTo(cx, cy).lineTo(cx + dx * len, cy)
    }
    g.stroke({ width: 4, color, alpha: 0.45 + 0.45 * pulse })
  }

  // ---------- 内部：伙伴与特效 ----------

  /**
   * 重建伙伴：伙伴由"床位 + 还在等的朋友"推导，每间舱睡两位。
   * arrivingPodId 的两位先在原地（大厅）等着，由入场演出把他们带进被窝；
   * 其余已入住的伙伴直接恢复成休息状态（重新载入时就是这个路径）。
   */
  private rebuildFriends(arrivingPodId: number | null = null): void {
    this.podEntrance = null
    for (const child of this.friendsLayer.removeChildren()) child.destroy({ children: true })
    for (const child of this.moleLayer.removeChildren()) child.destroy({ children: true })
    this.friends = []
    const world = this.world
    if (!world) return
    // 只渲染真的愿意来的伙伴：床位可能比人先建好（空床位留给还没来的朋友），
    // 但绝不能凭空画出一个人来。
    for (const partner of availablePartners(world)) {
      const assignment = partnerBed(world, partner.id)
      const pod = assignment?.pod ?? null
      const bedIndex = assignment?.slot ?? 0
      const spot = IDLE_SPOTS[partner.id]
      const standing = friendWalkY(world, { x: Math.floor(spot.x), y: spot.y })
      // 阿灯还没点亮时缩在角落：这是"点亮"的情感落点，不是一步任务。
      const hiding = !world.progress.coreRepaired && partner.id === 'adeng'
      const bodyColor = FRIEND_COLORS[partner.id]
      const view = new Container()
      const body = new Graphics()
      const visual = partner.id === 'atu' && this.moleTextures
        ? new MoleVisual(this.moleTextures)
        : createCompanionVisual(partner.id, this.companionTextures)
      const friend: FriendSprite = {
        view, body, visual, bodyColor, baseY: standing, phase: partner.bedSlot * 1.7, pose: 'idle', bed: null, inEntrance: false,
        podId: pod ? pod.id : null, spot: { x: spot.x, y: standing }, nameLabel: null,
        partnerName: partner.name, partnerId: partner.id, hidden: hiding, tailGlow: null,
      }
      // 已经入住的伙伴接着睡；正在入场的这一对站在原地等演出开始。
      const workerPosition = partner.id === 'atu' ? null : world.workers[partner.id]
      if (workerPosition) {
        friend.hidden = false
        friend.baseY = (workerPosition.y + .6) * TILE_SIZE
        view.position.set((workerPosition.x + .5) * TILE_SIZE, friend.baseY)
      } else if (pod && pod.id !== arrivingPodId) {
        const bed = bedSlots(pod)[bedIndex]
        friend.bed = bed
        friend.pose = 'rest'
        view.position.set(bed.x, bed.y)
        view.scale.set(FRIEND_REST_SCALE)
      } else if (hiding) {
        const cornerY = friendWalkY(world, { x: Math.floor(LAMP_CORNER.x), y: LAMP_CORNER.y })
        friend.baseY = cornerY
        friend.spot = { x: LAMP_CORNER.x, y: cornerY }
        view.position.set(LAMP_CORNER.x * TILE_SIZE, cornerY)
        view.scale.set(0.82)
        view.alpha = 0.68
      } else {
        view.position.set(spot.x * TILE_SIZE, standing)
      }
      paintPartner(friend)
      view.addChild(body)
      if (visual) view.addChild(visual.view)
      if (hiding) {
        // 只露一点点尾光：让玩家看见"角落里有个东西"，但看不清是谁。
        const glow = new Graphics()
        glow.circle(0, 7, 3.4).fill({ color: 0xffe9a8, alpha: 0.75 })
        friend.tailGlow = glow
        view.addChild(glow)
      } else if (friend.pose !== 'rest') {
        this.createNameLabel(friend)
      }
      const layer = visual && partner.id === 'atu' ? this.moleLayer : this.friendsLayer
      layer.addChild(view)
      this.friends.push(friend)
    }
  }

  /** 站着的伙伴头顶挂名字：孩子得知道"是谁在等"，而不是"一个球在等"。 */
  private createNameLabel(friend: FriendSprite): void {
    if (friend.nameLabel) return
    const label = new Text({
      text: friend.partnerName,
      style: {
        fontFamily: LABEL_FONT, fontSize: 10, fontWeight: '600',
        fill: 0xf7f2e4, stroke: { color: 0x1a2a2e, width: 3 },
      },
    })
    label.anchor.set(0.5)
    label.visible = false
    label.position.set(0, friend.visual ? friend.visual.nameY ?? -38 : -FRIEND_RADIUS - 12)
    friend.nameLabel = label
    friend.view.addChild(label)
  }

  /** 伙伴躺下后不再需要名字标签 */
  private clearNameLabel(friend: FriendSprite): void {
    if (!friend.nameLabel) return
    friend.nameLabel.destroy()
    friend.nameLabel = null
  }

  /**
   * 点亮之后，阿灯从角落飞回大厅。
   * 这是"点亮"这件事的情感落点：玩家不是完成了一步任务，是把一个怕黑的朋友请了出来。
   */
  private advanceLampReveal(dt: number): void {
    if (this.lampRevealDelay > 0) {
      this.lampRevealDelay -= dt
      if (this.lampRevealDelay <= 0) this.startLampReveal()
    }
    const reveal = this.lampReveal
    if (!reveal) return
    reveal.elapsed += dt
    const t = Math.min(1, reveal.elapsed / reveal.duration)
    const ease = 1 - Math.pow(1 - t, 3)
    const friend = reveal.friend
    friend.view.x = reveal.from.x + (reveal.to.x - reveal.from.x) * ease
    // 拱形：飞到半路稍微抬高一点，像真的在飞
    friend.view.y = reveal.from.y + (reveal.to.y - reveal.from.y) * ease - Math.sin(t * Math.PI) * 34
    friend.view.scale.set(0.82 + 0.18 * ease)
    friend.view.alpha = 0.68 + 0.32 * ease
    if (Math.floor(reveal.elapsed / 0.12) !== Math.floor((reveal.elapsed - dt) / 0.12)) {
      this.playBurst(friend.view.x, friend.view.y + 4, { color: 0xffe6a2, count: 2, speed: 16, gravity: -12 })
    }
    if (t >= 1) {
      this.finishLampReveal()
      this.playBurst(reveal.to.x, reveal.to.y - 10, { color: 0xfff0c0, count: 8, speed: 38, ring: true, ringRadius: 20 })
    }
  }

  /** 让阿灯直接落地：补间被打断时（比如玩家马上开始建床）用，别让她停在半空。 */
  private finishLampReveal(): void {
    const reveal = this.lampReveal
    if (!reveal) return
    const friend = reveal.friend
    friend.view.position.set(reveal.to.x, reveal.to.y)
    friend.view.scale.set(1)
    friend.view.alpha = 1
    friend.baseY = reveal.to.y
    if (friend.tailGlow) {
      friend.tailGlow.destroy()
      friend.tailGlow = null
    }
    this.createNameLabel(friend)
    this.lampReveal = null
  }

  private startLampReveal(): void {
    const world = this.world
    if (!world) return
    const friend = this.friends.find((item) => item.hidden)
    if (!friend) return
    const spot = IDLE_SPOTS.adeng
    const to = { x: spot.x * TILE_SIZE, y: friendWalkY(world, { x: Math.floor(spot.x), y: spot.y }) }
    friend.hidden = false
    this.lampReveal = {
      friend,
      elapsed: 0,
      duration: LAMP_REVEAL_DURATION,
      from: { x: friend.view.x, y: friend.view.y },
      to,
    }
  }

  private updateFriends(dt: number): void {
    this.advancePodEntrance(dt)
    this.advanceLampReveal(dt)
    const repaired = this.world?.progress.coreRepaired ?? false
    if (this.celebrationTime > 0) this.celebrationTime = Math.max(0, this.celebrationTime - dt)
    const celebrating = this.celebrationTime > 0
    for (const friend of this.friends) {
      friend.visual?.update(this.elapsed + friend.phase, friend.pose, friend.partnerId === 'atu' ? this.lightLevel : 1, friend.hidden)
      if (friend.inEntrance) continue
      // 正在飞出来的阿灯由补间驱动，别被呼吸动画覆盖
      if (this.lampReveal?.friend === friend) continue
      if (friend.pose === 'rest' && friend.bed) {
        friend.view.y = friend.bed.y + Math.sin(this.elapsed * 2 + friend.phase) * 1.2
        continue
      }
      // 躲在角落：只有尾光一闪一闪，不弹跳、不站起来
      if (friend.hidden) {
        if (friend.tailGlow) friend.tailGlow.alpha = 0.35 + 0.3 * Math.sin(this.elapsed * 3 + friend.phase)
        continue
      }
      const bounce = celebrating
        ? Math.abs(Math.sin(this.elapsed * 6 + friend.phase)) * 16
        : repaired
          ? Math.sin(this.elapsed * 2 + friend.phase) * 0.8
          : Math.sin(this.elapsed * 1.6 + friend.phase) * 1.5
      friend.view.y = friend.baseY - (friend.visual && !celebrating ? 0 : bounce)
    }
    this.syncMoleVisibility()
  }

  /**
   * 一间睡眠舱的一次性入场：该舱的两位伙伴沿真实空洞格走到舱门，再钻进被窝。
   * 只搬这一间舱的两位，其他舱的伙伴继续睡；重新载入时 rebuildFriends 直接恢复成休息状态。
   */
  playPodEntrance(pod: SleepPod, onSettled: () => void): void {
    const world = this.world
    if (!world || this.friends.length === 0) return
    // 专业伙伴保留床位，在设施旁待命；不重播将他们锁回床里的旧入睡演出。
    if (Object.keys(world.workers).length) { onSettled(); return }
    // 阿灯可能还在飞：先让她落地，免得和入场演出打架。
    this.finishLampReveal()
    this.podEntrance = null
    const beds = bedSlots(pod)
    const eligible = this.friends.filter(friend => friend.partnerId !== 'atu' || world.exploration.explorer === null)
    const mates = eligible.filter(friend => friend.podId === pod.id || partnerBed(world, friend.partnerId)?.pod.id === pod.id)
    // 未知舱（路径兜底 / 早期存档）：把这间舱当作"还没上床的伙伴"的去处，别让人卡在半路。
    const travellers: PodTraveller[] = []
    const moving = mates.length ? mates : eligible.filter(friend => friend.bed === null)
    moving.forEach((friend, i) => {
      const bed = beds[partnerBed(world, friend.partnerId)?.slot ?? i % BEDS_PER_POD]
      const from = { x: Math.floor(friend.view.x / TILE_SIZE), y: Math.floor(friend.view.y / TILE_SIZE) }
      const route = findEntranceRoute(world, from, pod)
      if (!route) return
      const points: RoutePoint[] = [{ x: friend.view.x, y: friend.view.y, pose: 'walk' }]
      route.forEach((cell, index) => {
        const prev = route[index - 1]
        const pose: 'walk' | 'climb' = prev && prev.y !== cell.y ? 'climb' : 'walk'
        points.push({
          pose,
          x: pose === 'climb'
            ? (cell.x + 0.5) * TILE_SIZE + friendWallOffset(world, cell)
            : (cell.x + 0.5) * TILE_SIZE,
          y: pose === 'climb' ? (cell.y + 0.5) * TILE_SIZE : friendWalkY(world, cell),
        })
      })
      points.push({ x: bed.x, y: bed.y, pose: 'enter' })
      const lengths = [0]
      for (let j = 1; j < points.length; j++) {
        lengths.push(lengths[j - 1] + Math.hypot(points[j].x - points[j - 1].x, points[j].y - points[j - 1].y))
      }
      travellers.push({
        friend,
        delay: ENTRANCE_PREPARE_DELAY + i * ENTRANCE_STAGGER,
        duration: Math.min(2.6, Math.max(0.9, points.length * ENTRANCE_SEGMENT_TIME)),
        points,
        lengths,
        total: lengths[lengths.length - 1],
        settled: false,
      })
      friend.inEntrance = true
      friend.pose = 'walk'
      paintPartner(friend)
    })
    if (travellers.length !== moving.length || travellers.length === 0) {
      this.settleFriendsInBed(moving.map((friend, i) => ({ friend, bed: beds[partnerBed(world, friend.partnerId)?.slot ?? i % BEDS_PER_POD] })))
      onSettled()
      return
    }
    this.podEntrance = { elapsed: 0, travellers, onSettled }
  }

  /** 路径异常时的兜底：直接放到床上，避免伙伴卡住 */
  private settleFriendsInBed(pairs: { friend: FriendSprite; bed: { x: number; y: number } }[]): void {
    this.podEntrance = null
    for (const { friend, bed } of pairs) {
      friend.inEntrance = false
      friend.pose = 'rest'
      friend.bed = bed
      friend.view.scale.set(FRIEND_REST_SCALE)
      friend.view.position.set(bed.x, bed.y)
      this.clearNameLabel(friend)
      paintPartner(friend)
    }
  }

  private advancePodEntrance(dt: number): void {
    const entrance = this.podEntrance
    if (!entrance) return
    entrance.elapsed += dt
    let allSettled = true
    for (const traveller of entrance.travellers) {
      const friend = traveller.friend
      const local = entrance.elapsed - traveller.delay
      if (local < 0) {
        allSettled = false
        continue
      }
      if (local >= traveller.duration) {
        if (!traveller.settled) {
          traveller.settled = true
          friend.inEntrance = false
          friend.pose = 'rest'
          friend.view.scale.set(FRIEND_REST_SCALE)
          const last = traveller.points[traveller.points.length - 1]
          friend.bed = { x: last.x, y: last.y }
          friend.view.position.set(last.x, last.y)
          this.clearNameLabel(friend)
          paintPartner(friend)
        }
        continue
      }
      allSettled = false
      const distance = (local / traveller.duration) * traveller.total
      let index = 0
      while (index < traveller.points.length - 2 && traveller.lengths[index + 1] < distance) index++
      const from = traveller.points[index]
      const to = traveller.points[index + 1]
      friend.visual?.face(to.x - from.x)
      const segLength = traveller.lengths[index + 1] - traveller.lengths[index]
      const k = segLength > 0 ? Math.min(1, Math.max(0, (distance - traveller.lengths[index]) / segLength)) : 0
      let x = from.x + (to.x - from.x) * k
      let y = from.y + (to.y - from.y) * k
      let pose: FriendPose
      if (to.pose === 'climb') {
        pose = 'climb'
        x += Math.sin(local * 13 + friend.phase) * 1.5
        y += Math.sin(local * 13 + friend.phase * 1.3) * 1
      } else if (to.pose === 'enter') {
        pose = 'walk'
        friend.view.scale.set(1 - (1 - FRIEND_REST_SCALE) * k)
      } else {
        pose = 'walk'
        friend.view.scale.set(1)
        y += Math.abs(Math.sin(local * 11 + friend.phase)) * 2
      }
      if (friend.pose !== pose) {
        friend.pose = pose
        paintPartner(friend)
      }
      friend.view.position.set(x, y)
    }
    if (allSettled) {
      const callback = entrance.onSettled
      this.podEntrance = null
      callback()
    }
  }

  /** 入舱 + 入睡完成后的庆祝反馈；只作用在新睡眠舱附近 */
  playPodCelebration(pod: SleepPod): void {
    const x = (pod.x + POD_SIZE.w / 2) * TILE_SIZE
    const y = (pod.y + POD_SIZE.h / 2) * TILE_SIZE
    this.playBurst(x, y, { color: 0xffd98a, count: 16, speed: 95, ring: true, ringRadius: 70 })
    this.spawnConfetti([{ x, y: y - 40 }])
  }

  /**
   * 接水到菜园的演出：泉水那边起一大团水花，水沿第二层地面一路流到水缸。
   * 世界数据已经由会话层写好，这里只放画面。
   */
  playSupplyWater(): void {
    const springX = (LANDMARKS.spring.x + 0.5) * TILE_SIZE
    const springY = 22 * TILE_SIZE - 7
    this.playBurst(springX, springY, { color: 0xd9fdf6, count: 24, speed: 110, ring: true, ringRadius: 44 })
    this.playBurst(springX, springY - 4, { color: 0x9fe6e6, count: 14, speed: 50, gravity: -30 })
    const legacy = this.world?.farm.planters.some((planter) => planter.y < 12)
      || this.world?.rooms.some((room) => room.kind === 'garden' && room.status !== 'blueprint')
    if (legacy) {
      // 旧档：水沿梯道回到第一层的水缸。
      for (let row = 20; row >= 12; row -= 2) {
        this.playBurst(springX, (row + 0.6) * TILE_SIZE, { color: 0xbfeef0, count: 6, speed: 26, gravity: -22 })
      }
      this.playBurst(19.4 * TILE_SIZE, 11 * TILE_SIZE, { color: 0xbfe6f2, count: 16, speed: 70, ring: true, ringRadius: 38 })
      return
    }
    const barrelX = WATER_BARREL_X * TILE_SIZE
    for (let x = springX + 28; x < barrelX; x += 34) {
      this.playBurst(x, springY - 2, { color: 0xbfeef0, count: 6, speed: 26, gravity: -22 })
    }
    this.playBurst(barrelX, (WATER_BARREL_Y + 0.6) * TILE_SIZE, { color: 0xbfe6f2, count: 16, speed: 70, ring: true, ringRadius: 38 })
  }

  /** 收菜：一格小爆发 + 上飘的叶子和光点 */
  playHarvest(cell: Cell): void {
    const x = (cell.x + 0.5) * TILE_SIZE
    const y = (cell.y + 0.45) * TILE_SIZE
    this.playBurst(x, y, { color: 0xd7f4a0, count: 14, speed: 74, ring: true, ringRadius: 24 })
    this.playBurst(x, y - 6, { color: 0xffe6ad, count: 10, speed: 40, gravity: -30 })
  }

  /** 开饭：伙伴原地开心蹦跳 + 爱心和彩纸；有菜有水，家里热闹一下 */
  playMealCelebration(): void {
    this.celebrationTime = 2.4
    if (this.friends.length === 0) return
    this.spawnConfetti(this.friends.map((friend) => ({ x: friend.view.x, y: friend.view.y - 30 })))
    for (const friend of this.friends) {
      this.playBurst(friend.view.x, friend.view.y - 18, { color: 0xff9db2, count: 7, speed: 38, gravity: -26 })
    }
    const barrelX = WATER_BARREL_X * TILE_SIZE
    this.playBurst(barrelX, (WATER_BARREL_Y + 0.2) * TILE_SIZE, { color: 0xbfe6f2, count: 10, speed: 44, gravity: -18 })
  }

  private spawnConfetti(anchors: ReadonlyArray<{ x: number; y: number }> = REPAIR_CONFETTI_ANCHORS): void {
    const colors = [0xf6c85f, 0x9ee7f4, 0xf2a7b3, 0xa8e6cf]
    for (let i = 0; i < 18; i++) {
      const anchor = anchors[i % anchors.length]
      const n = hash(i, 3)
      this.particles.push({
        x: anchor.x + (hash(i, 1) - 0.5) * 70,
        y: anchor.y + (hash(i, 2) - 0.5) * 26,
        vx: (hash(i, 4) - 0.5) * 70,
        vy: -40 - hash(i, 5) * 70,
        age: 0,
        life: 1.3 + n * 0.6,
        size: 3 + n * 2.5,
        color: colors[i % colors.length],
        gravity: 55,
        square: true,
      })
    }
  }

  private updateEffects(dt: number): void {
    this.lootFeedback.update(dt)
    const g = this.effects
    g.clear()
    if (this.particles.length === 0 && this.rings.length === 0) return
    for (const p of this.particles) {
      p.age += dt
      p.x += p.vx * dt
      p.y += p.vy * dt
      p.vy += p.gravity * dt
      const k = 1 - p.age / p.life
      if (k <= 0) continue
      if (p.square) {
        g.rect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size).fill({ color: p.color, alpha: 0.9 * k })
      } else {
        g.circle(p.x, p.y, p.size * k).fill({ color: p.color, alpha: 0.8 * k })
      }
    }
    this.particles = this.particles.filter((p) => p.age < p.life)
    for (const ring of this.rings) {
      ring.age += dt
      const k = ring.age / ring.life
      if (k >= 1) continue
      const eased = 1 - (1 - k) * (1 - k)
      g.circle(ring.x, ring.y, Math.max(1, ring.maxRadius * eased)).stroke({
        width: 4 * (1 - k) + 1,
        color: ring.color,
        alpha: 0.7 * (1 - k),
      })
    }
    this.rings = this.rings.filter((r) => r.age < r.life)
  }

  // ---------- 内部：地形（第一批素材） ----------

  /** 全图洞穴底色；天空与地表交给独立的 SurfaceScene。 */
  private buildBackdrop(): void {
    const g = this.backdrop
    g.clear()
    g.rect(0, 0, WORLD_PIXEL_WIDTH, WORLD_PIXEL_HEIGHT).fill(COLORS.caveDeep)
  }

  /** 洞穴背景：平铺贴图，位于挖空区域之后 */
  private buildCaveBackground(): void {
    const bg = new TilingSprite({
      texture: this.textures.caveBg,
      width: WORLD_PIXEL_WIDTH,
      height: WORLD_PIXEL_HEIGHT - SURFACE_Y * TILE_SIZE,
    })
    bg.position.set(0, SURFACE_Y * TILE_SIZE)
    this.terrainLayer.addChild(bg)
    this.terrainLayer.addChild(createStrataBackdrop(this.textures.caveBg))
  }

  /** 一次性建好瓦片精灵池：每格 = 1 张基础贴图 + 4 张方向边缘叠图 */
  private buildTerrainPool(): void {
    for (let y = 0; y < MAP_HEIGHT; y++) {
      const row: (TileCellSprites | null)[] = []
      for (let x = 0; x < MAP_WIDTH; x++) {
        if (y < SURFACE_Y) {
          row.push(null)
          continue
        }
        const base = this.makeTileSprite(x, y)
        const edges: [Sprite, Sprite, Sprite, Sprite] = [
          this.makeTileSprite(x, y),
          this.makeTileSprite(x, y),
          this.makeTileSprite(x, y),
          this.makeTileSprite(x, y),
        ]
        this.terrainLayer.addChild(base, ...edges)
        row.push({ base, edges })
      }
      this.tileSprites.push(row)
    }
  }

  private makeTileSprite(x: number, y: number): Sprite {
    const sprite = new Sprite(Texture.EMPTY)
    sprite.position.set(x * TILE_SIZE, y * TILE_SIZE)
    // width/height 会记住目标尺寸；setSize 在 Texture.EMPTY 换成 PNG 后只保留缩放。
    sprite.width = TILE_SIZE
    sprite.height = TILE_SIZE
    sprite.visible = false
    return sprite
  }

  /** 依据世界数据更新一格：基础贴图（确定性变体）+ 四向边缘叠图 */
  private updateTerrainCell(x: number, y: number): void {
    const world = this.world
    if (!world || y < SURFACE_Y || y >= world.height || x < 0 || x >= world.width) return
    const cell = this.tileSprites[y]?.[x]
    if (!cell) return

    const tile = world.tiles[y][x]
    if (tile === TILE.EMPTY) {
      cell.base.visible = false
      for (const edge of cell.edges) edge.visible = false
      return
    }

    cell.base.visible = true
    cell.base.tint = terrainTint(y)
    for (const edge of cell.edges) edge.tint = terrainTint(y)
    const baseTexture = this.pickVariant(tile, x, y)
    if (cell.base.texture !== baseTexture) cell.base.texture = baseTexture

    const edgeTextures = tile === TILE.SOIL ? this.textures.soilEdges : this.textures.rockEdges
    for (let i = 0; i < EDGE_DIRECTIONS.length; i++) {
      const { direction, dx, dy } = EDGE_DIRECTIONS[i]
      const sprite = cell.edges[i]
      const surfaceTop = direction === 'top' && y === SURFACE_Y
      if (!surfaceTop && !this.isOpenForEdge(x + dx, y + dy)) {
        sprite.visible = false
        continue
      }
      // 地表行朝向天空的顶边使用草边（天空一侧不画洞壁）
      const texture = surfaceTop ? this.textures.surfaceGrass : edgeTextures[direction]
      if (sprite.texture !== texture) sprite.texture = texture
      sprite.visible = true
    }
  }

  /** 洞壁判定：目标格是空洞才算（地图外与天空都不算） */
  private isOpenForEdge(x: number, y: number): boolean {
    const world = this.world
    if (!world) return false
    if (x < 0 || x >= world.width || y < 0 || y >= world.height) return false
    if (y < SURFACE_Y) return false
    return world.tiles[y][x] === TILE.EMPTY
  }

  /** 依据 (x, y) 确定性挑选填充变体（素材包约定：不引入状态） */
  private pickVariant(tile: TileType, x: number, y: number): Texture {
    const variants = tile === TILE.SOIL ? this.textures.soil : this.textures.rock
    const index = Math.min(variants.length - 1, Math.floor(hash(x, y) * variants.length))
    return variants[index]
  }

  private rebuildLandmarks(): void {
    this.landmarkLayer.removeChildren()
    this.glowLayer.removeChildren()
    this.crystal = null
    this.springGlow = null
    this.machineGlow = null
    const world = this.world
    if (!world) return
    const T = TILE_SIZE

    // 能源核心：机身（结构层）
    const installing = this.crystalFeedback.installing
    const repaired = world.progress.coreRepaired && !installing
    const ready = world.progress.crystalCollected && !repaired
    const generatorX = (LANDMARKS.generator.x + 0.5) * T
    const generatorY = (LANDMARKS.generator.y + 0.5) * T
    const machine = new Sprite(this.energyCoreTexture)
    machine.anchor.copyFrom(ENERGY_CORE_SOCKET_ANCHOR)
    machine.position.set(generatorX, generatorY)
    machine.scale.set(ENERGY_CORE_DISPLAY_WIDTH / this.energyCoreTexture.width)
    this.landmarkLayer.addChild(machine)

    // 能源核心：状态灯与标签（发光层，穿透黑暗；alpha 由 updateMachineGlow 控制）
    const machineGlow = new Graphics()
    if (repaired) {
      machineGlow.circle(generatorX, generatorY, 40).fill({ color: COLORS.coreOn, alpha: 0.22 })
      machineGlow.circle(generatorX, generatorY, 15).fill(COLORS.coreOn)
      machineGlow.circle(generatorX, generatorY, 8).fill(COLORS.coreOnInner)
    } else if (ready) {
      // 手上有能源石：核心透出暖橘色呼吸光，明确"来点我"
      machineGlow.circle(generatorX, generatorY, 44).fill({ color: COLORS.warmGlow, alpha: 0.16 })
      machineGlow.circle(generatorX, generatorY, 15).fill(COLORS.coreReady)
      machineGlow.circle(generatorX, generatorY, 8).fill(COLORS.coreReadyInner)
    } else {
      machineGlow.circle(generatorX, generatorY, 15).fill(COLORS.machineCore)
      machineGlow.circle(generatorX, generatorY, 8).fill(COLORS.machineCoreInner)
    }
    this.machineGlow = machineGlow
    this.glowLayer.addChild(machineGlow)
    const machineLabel = installing ? '能源核心 · 正在安装' : repaired ? '能源核心 · 运行中' : ready ? '能源核心 · 等待能源石' : '能源核心 · 待修复'
    const machineLabelColor = repaired ? COLORS.labelOn : ready ? COLORS.labelReady : COLORS.labelDim
    this.glowLayer.addChild(this.makeLabel(machineLabel, generatorX, generatorY + 52, machineLabelColor))

    // 地表入口标签
    const entranceLabel = this.makeLabel('避难所入口', SURFACE_ENTRANCE.x, SURFACE_ENTRANCE.labelY, COLORS.labelCream)
    entranceLabel.style.stroke = { color: 0x263e49, width: 3 }
    this.glowLayer.addChild(entranceLabel)

    // 地下泉水：藏在岩层里，只透出隐约蓝光（探索期待的伏笔）
    const spring = new Graphics()
    // 泉水由 ExplorationScene 随地面探索揭示，不能隔着未探索岩层看见。
    this.springGlow = spring
    this.glowLayer.addChild(spring)

    // 能源石：露出且未收集时显示；收集后消失；未挖开只透出一点微光
    const revealed = world.tiles[LANDMARKS.crystal.y][LANDMARKS.crystal.x] === TILE.EMPTY
    const collected = world.progress.crystalCollected
    const crystalX = (LANDMARKS.crystal.x + 0.5) * T
    const crystalY = (LANDMARKS.crystal.y + 0.5) * T
    if (!collected) {
      const crystal = new Container()
      const halo = new Graphics()
      if (revealed) {
        halo.circle(crystalX, crystalY, 30).fill({ color: COLORS.crystalGlow, alpha: 0.18 })
        const sprite = new Sprite(this.crystalTexture)
        sprite.anchor.set(0.5)
        sprite.position.set(crystalX, crystalY)
        sprite.scale.set(CRYSTAL_DISPLAY_HEIGHT / this.crystalTexture.height)
        crystal.addChild(halo, sprite)
        this.glowLayer.addChild(this.makeLabel('能源石', crystalX, crystalY - 38, COLORS.crystalGlow))
      } else {
        halo.circle(crystalX, crystalY, 24).fill({ color: COLORS.crystalGlow, alpha: 0.12 })
        crystal.addChild(halo)
      }
      this.crystal = crystal
      this.glowLayer.addChild(crystal)
    }
  }

  private redrawHover(): void {
    const g = this.hover
    g.clear()
    const world = this.world
    const cell = this.hoverCell
    if (!world || !cell || !isInside(world, cell.x, cell.y)) return
    const tile = world.tiles[cell.y][cell.x]
    if (tile === TILE.EMPTY) return
    const color = tile === TILE.SOIL ? 0xf3edbc : 0x9fb4c9
    g.rect(cell.x * TILE_SIZE + 2, cell.y * TILE_SIZE + 2, TILE_SIZE - 4, TILE_SIZE - 4)
      .stroke({ width: 2, color, alpha: 0.95 })
  }

  private makeLabel(text: string, x: number, y: number, color: number): Text {
    const label = new Text({
      text,
      style: { fontFamily: LABEL_FONT, fontSize: 12, fontWeight: '600', fill: color },
    })
    label.anchor.set(0.5)
    label.position.set(x, y)
    return label
  }
}
