import { Application, Container, Graphics, Sprite, Text, Texture, TilingSprite, type Ticker } from 'pixi.js'
import {
  LANDMARKS,
  MAP_HEIGHT,
  MAP_WIDTH,
  SURFACE_Y,
  TILE,
  TILE_SIZE,
  isInside,
  type Cell,
  type SleepPod,
  type TileType,
  type WorldState,
} from '../core/world'
import { loadTerrainTextures, type EdgeDirection, type TerrainTextures } from './terrainTextures'
import { ENERGY_CORE_DISPLAY_WIDTH, ENERGY_CORE_SOCKET_ANCHOR, loadEnergyCoreTexture } from './energyCoreTexture'
import { CRYSTAL_DISPLAY_HEIGHT, loadCrystalTexture } from './crystalTexture'
import { CRYSTAL_INSTALL_DURATION, CrystalFeedback } from './CrystalFeedback'
import { createShelterFixtures, LAMP_LOCATIONS, loadShelterFixtureTextures, type ShelterFixtureTextures } from './shelterFixtures'
import { bedSlots, drawSleepPod } from './sleepPods'
import { findEntranceRoute } from './friendRoutes'
import { POD_SIZE } from '../core/build'
import {
  WORLD_PIXEL_HEIGHT,
  WORLD_PIXEL_WIDTH,
  centerOn,
  clampCamera,
  clampZoom,
  panCamera,
  screenToWorld,
  zoomAt,
  type Camera,
  type Viewport,
} from './camera'

/** 渲染调色板（程序化部分：天空、风暴、机器、发光体等） */
const COLORS = {
  caveDeep: 0x22313a,
  skyTop: 0x46586a,
  skyBottom: 0x83808b,
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
  bodyColor: number
  /** 站立时的身体中心高度 */
  baseY: number
  phase: number
  pose: FriendPose
  /** 休息时床铺的世界坐标；未入住为 null */
  bed: { x: number; y: number } | null
  /** 入场演出正在驱动时，跳过站立 / 呼吸动画 */
  inEntrance: boolean
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

function paintFriend(body: Graphics, color: number, pose: FriendPose): void {
  body.clear()
  body.circle(0, 0, FRIEND_RADIUS).fill(color).stroke({ width: 2, color: FRIEND_OUTLINE })
  body.circle(-7, -10, 5).fill(color).stroke({ width: 2, color: FRIEND_OUTLINE })
  body.circle(7, -10, 5).fill(color).stroke({ width: 2, color: FRIEND_OUTLINE })
  if (pose === 'rest') {
    // 被子盖住下半身，只露出头和闭上的眼睛
    body.roundRect(-12, -2, 24, 12, 5).fill(0xfff2d8).stroke({ width: 1.5, color: 0xa9886b })
    body.moveTo(-6, -5).lineTo(-2, -5).moveTo(2, -5).lineTo(6, -5).stroke({ width: 2, color: 0x403c38 })
  } else {
    body.circle(-4, -2, 1.8).fill(0x403c38)
    body.circle(4, -2, 1.8).fill(0x403c38)
    body.circle(0, 4, 2.6).fill(0xd98a82)
  }
}

/**
 * PixiJS 渲染器：只负责"世界 → 画面"。
 * 不包含任何游戏规则；挖掘 / 互动判定由 core 决定后再通知本层刷新。
 */
export class PixiWorldRenderer {
  private readonly worldLayer = new Container()
  /** 地形层：底色 + 洞穴背景 + 瓦片精灵池（最底层） */
  private readonly terrainLayer = new Container()
  private readonly backdrop = new Graphics()
  private readonly wind = new Graphics()
  private readonly landmarkLayer = new Container()
  private readonly shelterFixtures: Container
  private readonly lampFixtures: Sprite[]
  private readonly glowLayer = new Container()
  private readonly friendsLayer = new Container()
  private readonly podLayer = new Container()
  private readonly buildPreview = new Container()
  private readonly darkness = new Graphics()
  private readonly lamps = new Graphics()
  private readonly highlightGfx = new Graphics()
  private readonly effects = new Graphics()
  private readonly hover = new Graphics()

  private crystal: Container | null = null
  private readonly crystalFeedback: CrystalFeedback
  private springGlow: Graphics | null = null
  private machineGlow: Graphics | null = null
  private friends: FriendSprite[] = []
  private podEntrance: PodEntrance | null = null
  private particles: Particle[] = []
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
  /** 0 = 全黑，1 = 灯火通明（修复能源核心后平滑过渡） */
  private lightLevel = 0
  /** 机器启动动画剩余时间（快速闪烁） */
  private spinUp = 0
  /** 等灯光亮到一定程度后触发一次庆祝 */
  private pendingCelebration = false
  private celebrationTime = 0

  static async create(host: HTMLElement): Promise<PixiWorldRenderer> {
    // 素材加载失败时交给现有初始化反馈；不留下未使用的 GPU 应用和画布。
    const [textures, energyCoreTexture, crystalTexture, fixtureTextures] = await Promise.all([
      loadTerrainTextures(), loadEnergyCoreTexture(), loadCrystalTexture(), loadShelterFixtureTextures(),
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
    return new PixiWorldRenderer(app, textures, energyCoreTexture, crystalTexture, fixtureTextures)
  }

  private constructor(
    private readonly app: Application,
    private readonly textures: TerrainTextures,
    private readonly energyCoreTexture: Texture,
    private readonly crystalTexture: Texture,
    fixtureTextures: ShelterFixtureTextures,
  ) {
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
      this.wind,
      this.shelterFixtures,
      this.landmarkLayer,
      this.podLayer,
      this.friendsLayer,
      this.darkness,
      this.glowLayer,
      this.lamps,
      this.highlightGfx,
      this.effects,
      this.crystalFeedback.view,
      this.hover,
      this.buildPreview,
    )
    app.stage.addChild(this.worldLayer)
    app.ticker.add(this.tick)
  }

  /** 画布元素（供输入层绑定指针事件） */
  get canvasElement(): HTMLCanvasElement {
    return this.app.canvas
  }

  /** 绑定世界数据（初始加载与替换时调用） */
  setWorld(world: WorldState): void {
    this.crystalFeedback.reset()
    this.spinUp = 0
    this.pendingCelebration = false
    this.celebrationTime = 0
    this.cameraTween = null
    this.world = world
    this.lightLevel = world.progress.coreRepaired ? 1 : 0
    this.refresh()
  }

  /** 世界数据变化后刷新画面（收集 / 修复 / 载入 / 撤销后调用） */
  refresh(): void {
    this.refreshTerrain()
    this.rebuildLandmarks()
    this.refreshPods()
    this.rebuildFriends()
  }

  /** 只重建舱体，不碰伙伴；建成演出先刷新舱体再播放入场 */
  refreshPods(): void {
    this.podEntrance = null
    for (const child of this.podLayer.removeChildren()) child.destroy({ children: true })
    for (const pod of this.world?.pods ?? []) this.podLayer.addChild(drawSleepPod(pod))
  }

  setBuildPreview(cell: Cell | null, valid = false, door: 'left' | 'right' = 'left', hint = ''): void {
    for (const child of this.buildPreview.removeChildren()) child.destroy({ children: true })
    if (!cell) return
    const color = valid ? 0x8fe3a6 : 0xff947e
    const room = drawSleepPod({ ...cell, door }, true)
    room.alpha = 0.6
    const outline = new Graphics()
    outline.rect(cell.x * TILE_SIZE, cell.y * TILE_SIZE, POD_SIZE.w * TILE_SIZE, POD_SIZE.h * TILE_SIZE)
      .fill({ color, alpha: 0.15 })
      .stroke({ width: 3, color })
    this.buildPreview.addChild(room, outline)
    if (!hint) return
    // 预览旁给一个短句：不用低头看底部面板也能知道行不行。
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
      (cell.x + POD_SIZE.w / 2) * TILE_SIZE,
      cell.y * TILE_SIZE - 10 - height / 2,
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
        gravity: 70,
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

  private startRepairCelebration(): void {
    this.rebuildLandmarks()
    this.playBurst((LANDMARKS.generator.x + 0.5) * TILE_SIZE, (LANDMARKS.generator.y + 0.5) * TILE_SIZE, {
      color: COLORS.warmGlow, count: 16, speed: 95, ring: true, ringRadius: 110,
    })
    this.spinUp = 1.2
    this.pendingCelebration = true
  }

  /** 初始 / 回家视角：一眼看到避难所、能源核心和左侧的能源石区 */
  focusHome(): void {
    this.cancelCameraTween()
    const zoom = clampZoom(Math.min(1.55, Math.max(0.9, this.viewport.width / 920)))
    const centerX = 17.8 * TILE_SIZE
    const centerY = 9.2 * TILE_SIZE - 20
    this.camera = centerOn(centerX, centerY, this.viewport, zoom)
    this.applyCamera()
  }

  /** 把某个世界坐标居中（"带我去看看"） */
  focusOn(worldX: number, worldY: number): void {
    this.cancelCameraTween()
    this.camera = centerOn(worldX, worldY, this.viewport, this.camera.zoom)
    this.applyCamera()
  }

  panBy(dxScreen: number, dyScreen: number): void {
    this.cancelCameraTween()
    this.camera = panCamera(this.camera, dxScreen, dyScreen, this.viewport)
    this.applyCamera()
  }

  zoomBy(deltaZoom: number, anchor?: { x: number; y: number }): void {
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

  setHoverCell(cell: Cell | null): void {
    this.hoverCell = cell
    this.redrawHover()
  }

  destroy(): void {
    this.app.ticker.remove(this.tick)
    this.app.destroy(true, { children: true })
  }

  // ---------- 内部：逐帧 ----------

  private readonly tick = (ticker: Ticker): void => {
    const dt = Math.min(0.1, ticker.deltaMS / 1000)
    this.elapsed += dt
    this.syncViewport()
    if (this.crystalFeedback.update(dt)) this.startRepairCelebration()
    this.updateCameraTween(dt)
    this.drawWind(this.elapsed)
    if (this.spinUp > 0) this.spinUp = Math.max(0, this.spinUp - dt)
    this.updateLighting(dt)
    this.drawHighlight()
    this.updateMachineGlow()
    this.updateFriends(dt)
    this.updateEffects(dt)
    if (this.crystal) this.crystal.alpha = 0.7 + 0.3 * Math.sin(this.elapsed * 3)
    if (this.springGlow) this.springGlow.alpha = 0.65 + 0.35 * Math.sin(this.elapsed * 1.6)
  }

  private syncViewport(): void {
    const width = this.app.screen.width
    const height = this.app.screen.height
    if (width === this.viewport.width && height === this.viewport.height) return
    this.viewport = { width, height }
    this.camera = clampCamera(this.camera, this.viewport)
    this.applyCamera()
  }

  private applyCamera(): void {
    this.worldLayer.scale.set(this.camera.zoom)
    this.worldLayer.position.set(-this.camera.x * this.camera.zoom, -this.camera.y * this.camera.zoom)
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
      g.rect(0, SURFACE_Y * TILE_SIZE, WORLD_PIXEL_WIDTH, WORLD_PIXEL_HEIGHT - SURFACE_Y * TILE_SIZE).fill({
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

  private rebuildFriends(): void {
    this.podEntrance = null
    for (const child of this.friendsLayer.removeChildren()) child.destroy({ children: true })
    this.friends = []
    const world = this.world
    if (!world) return
    const pod = world.pods[0]
    const beds = pod ? bedSlots(pod) : null
    const spots = [
      { x: 18.6 * TILE_SIZE, y: friendWalkY(world, { x: 18, y: 11 }) },
      { x: 23.9 * TILE_SIZE, y: friendWalkY(world, { x: 23, y: 11 }) },
    ]
    spots.forEach((spot, i) => {
      const bodyColor = i === 0 ? 0xa8ba8e : 0xe9b6a7
      const view = new Container()
      const body = new Graphics()
      const friend: FriendSprite = {
        view, body, bodyColor, baseY: spot.y, phase: i * 1.7, pose: 'idle', bed: null, inEntrance: false,
      }
      if (beds) {
        friend.bed = beds[i]
        friend.pose = 'rest'
        view.position.set(friend.bed.x, friend.bed.y)
        view.scale.set(FRIEND_REST_SCALE)
      } else {
        view.position.set(spot.x, spot.y)
      }
      paintFriend(body, bodyColor, friend.pose)
      view.addChild(body)
      this.friendsLayer.addChild(view)
      this.friends.push(friend)
    })
  }

  private updateFriends(dt: number): void {
    this.advancePodEntrance(dt)
    const repaired = this.world?.progress.coreRepaired ?? false
    if (this.celebrationTime > 0) this.celebrationTime = Math.max(0, this.celebrationTime - dt)
    const celebrating = this.celebrationTime > 0
    for (const friend of this.friends) {
      if (friend.inEntrance) continue
      if (friend.pose === 'rest' && friend.bed) {
        friend.view.y = friend.bed.y + Math.sin(this.elapsed * 2 + friend.phase) * 1.2
        continue
      }
      const bounce = celebrating
        ? Math.abs(Math.sin(this.elapsed * 6 + friend.phase)) * 16
        : repaired
          ? Math.abs(Math.sin(this.elapsed * 3 + friend.phase)) * 10
          : Math.sin(this.elapsed * 1.6 + friend.phase) * 1.5
      friend.view.y = friend.baseY - bounce
    }
  }

  /**
   * 第一间睡眠舱的一次性入场：沿真实空洞格走到舱门，再钻进被窝。
   * 只在建成时调用；重新载入时 rebuildFriends 会直接恢复成休息状态。
   */
  playPodEntrance(pod: SleepPod, onSettled: () => void): void {
    const world = this.world
    if (!world || this.friends.length === 0) return
    this.podEntrance = null
    const beds = bedSlots(pod)
    const travellers: PodTraveller[] = []
    this.friends.forEach((friend, i) => {
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
      points.push({ x: beds[i].x, y: beds[i].y, pose: 'enter' })
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
      paintFriend(friend.body, friend.bodyColor, 'walk')
    })
    if (travellers.length !== this.friends.length) {
      this.settleFriendsInBed(beds)
      onSettled()
      return
    }
    this.podEntrance = { elapsed: 0, travellers, onSettled }
  }

  /** 路径异常时的兜底：直接放到床上，避免伙伴卡住 */
  private settleFriendsInBed(beds: { x: number; y: number }[]): void {
    this.podEntrance = null
    this.friends.forEach((friend, i) => {
      friend.inEntrance = false
      friend.pose = 'rest'
      friend.bed = beds[i]
      friend.view.scale.set(FRIEND_REST_SCALE)
      friend.view.position.set(beds[i].x, beds[i].y)
      paintFriend(friend.body, friend.bodyColor, 'rest')
    })
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
          paintFriend(friend.body, friend.bodyColor, 'rest')
        }
        continue
      }
      allSettled = false
      const distance = (local / traveller.duration) * traveller.total
      let index = 0
      while (index < traveller.points.length - 2 && traveller.lengths[index + 1] < distance) index++
      const from = traveller.points[index]
      const to = traveller.points[index + 1]
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
        paintFriend(friend.body, friend.bodyColor, pose)
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

  /** 全图底色 + 天空色带（静态绘制一次） */
  private buildBackdrop(): void {
    const g = this.backdrop
    g.clear()
    g.rect(0, 0, WORLD_PIXEL_WIDTH, WORLD_PIXEL_HEIGHT).fill(COLORS.caveDeep)
    const skyHalf = (SURFACE_Y * TILE_SIZE) / 2
    g.rect(0, 0, WORLD_PIXEL_WIDTH, skyHalf).fill(COLORS.skyTop)
    g.rect(0, skyHalf, WORLD_PIXEL_WIDTH, skyHalf).fill(COLORS.skyBottom)
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
    this.glowLayer.addChild(
      this.makeLabel('避难所入口', (LANDMARKS.shaft.x + LANDMARKS.shaft.w / 2) * T, SURFACE_Y * T - 16, COLORS.labelCream),
    )

    // 地下泉水：藏在岩层里，只透出隐约蓝光（探索期待的伏笔）
    const spring = new Graphics()
    const springX = (LANDMARKS.spring.x + 0.5) * T
    const springY = (LANDMARKS.spring.y + 0.5) * T
    spring.ellipse(springX, springY, 26, 18).fill({ color: COLORS.water, alpha: 0.5 })
    spring.circle(springX, springY, 48).fill({ color: COLORS.water, alpha: 0.12 })
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

  private drawWind(seconds: number): void {
    const g = this.wind
    g.clear()
    const skyHeight = SURFACE_Y * TILE_SIZE + 12
    for (let i = 0; i < 14; i++) {
      const speed = 60 + hash(i, 3) * 90
      const span = WORLD_PIXEL_WIDTH + 200
      const x = ((hash(i, 1) * span + seconds * speed) % span) - 100
      const y = hash(i, 2) * skyHeight * 0.85
      const width = 50 + hash(i, 5) * 60
      g.roundRect(x, y, width, 3.5, 2).fill({ color: 0xdfe6ea, alpha: 0.16 + hash(i, 7) * 0.12 })
    }
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
