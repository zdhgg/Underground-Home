import { Application, Container, Graphics, Text, type Ticker } from 'pixi.js'
import { LANDMARKS, SURFACE_Y, TILE, TILE_SIZE, isInside, type Cell, type WorldState } from '../core/world'
import {
  WORLD_PIXEL_HEIGHT,
  WORLD_PIXEL_WIDTH,
  centerOn,
  clampCamera,
  panCamera,
  screenToWorld,
  zoomAt,
  type Camera,
  type Viewport,
} from './camera'

/** 渲染调色板（延续 v0.4 的暖色岩层 + 冷色天空） */
const COLORS = {
  caveDeep: 0x22313a,
  skyTop: 0x46586a,
  skyBottom: 0x83808b,
  soil: 0x9a7355,
  soilLight: 0xb18b62,
  soilDark: 0x7e604b,
  rock: 0x454e5a,
  rockLight: 0x515b68,
  rockCrack: 0x717d8c,
  caveEdge: 0xb2a189,
  grass: 0x58715c,
  wood: 0xc7a173,
  machine: 0x4a6265,
  machineInner: 0x273b48,
  machineCore: 0x5d6f78,
  machineCoreInner: 0x33474f,
  machineOn: 0x4f7a68,
  machineOnInner: 0x2e4f46,
  coreOn: 0x8eebc1,
  coreOnInner: 0xeafff2,
  crystal: 0x9ee7f4,
  crystalGlow: 0x8dedfd,
  water: 0x5fb7d6,
  labelCream: 0xeae6d8,
  labelDim: 0xcfd6cc,
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

const LABEL_FONT = 'ui-rounded, "PingFang SC", "Microsoft YaHei", system-ui, sans-serif'

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  age: number
  life: number
  size: number
}

interface FriendSprite {
  view: Container
  baseY: number
  phase: number
}

function hash(x: number, y: number): number {
  const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453
  return n - Math.floor(n)
}

/**
 * PixiJS 渲染器：只负责"世界 → 画面"。
 * 不包含任何游戏规则；挖掘 / 互动判定由 core 决定后再通知本层刷新。
 */
export class PixiWorldRenderer {
  private readonly worldLayer = new Container()
  private readonly terrain = new Graphics()
  private readonly wind = new Graphics()
  private readonly landmarkLayer = new Container()
  private readonly glowLayer = new Container()
  private readonly friendsLayer = new Container()
  private readonly darkness = new Graphics()
  private readonly lamps = new Graphics()
  private readonly highlightGfx = new Graphics()
  private readonly effects = new Graphics()
  private readonly hover = new Graphics()

  private crystal: Graphics | null = null
  private springGlow: Graphics | null = null
  private friends: FriendSprite[] = []
  private particles: Particle[] = []
  private highlight: HighlightSpec | null = null

  private world: WorldState | null = null
  private hoverCell: Cell | null = null
  private camera: Camera = { x: 0, y: 0, zoom: 1 }
  private viewport: Viewport
  private elapsed = 0
  /** 0 = 全黑，1 = 灯火通明（修复能源核心后平滑过渡） */
  private lightLevel = 0

  static async create(host: HTMLElement): Promise<PixiWorldRenderer> {
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
    return new PixiWorldRenderer(app)
  }

  private constructor(private readonly app: Application) {
    this.viewport = { width: app.screen.width, height: app.screen.height }
    // 顺序即光照逻辑：结构在黑暗之下，发光物与标签在黑暗之上
    this.worldLayer.addChild(
      this.terrain,
      this.wind,
      this.landmarkLayer,
      this.friendsLayer,
      this.darkness,
      this.glowLayer,
      this.lamps,
      this.highlightGfx,
      this.effects,
      this.hover,
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
    this.world = world
    this.lightLevel = world.progress.coreRepaired ? 1 : 0
    this.refresh()
  }

  /** 世界数据变化后刷新画面（挖掘 / 互动 / 撤销后调用） */
  refresh(): void {
    this.rebuildTerrain()
    this.rebuildLandmarks()
    this.rebuildFriends()
    this.redrawHover()
  }

  /** 设置地图高亮指引；传 null 清除 */
  setHighlight(spec: HighlightSpec | null): void {
    this.highlight = spec
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
      })
    }
  }

  /** 初始视角：对准避难所 */
  focusHome(): void {
    const zoom = Math.min(1.25, Math.max(0.85, this.viewport.width / 1280))
    const centerX = (LANDMARKS.generator.x + 0.5) * TILE_SIZE
    const centerY = (LANDMARKS.generator.y + 0.5) * TILE_SIZE - 60
    this.camera = centerOn(centerX, centerY, this.viewport, zoom)
    this.applyCamera()
  }

  /** 把某个世界坐标居中（"带我去看看"） */
  focusOn(worldX: number, worldY: number): void {
    this.camera = centerOn(worldX, worldY, this.viewport, this.camera.zoom)
    this.applyCamera()
  }

  panBy(dxScreen: number, dyScreen: number): void {
    this.camera = panCamera(this.camera, dxScreen, dyScreen, this.viewport)
    this.applyCamera()
  }

  zoomBy(deltaZoom: number, anchor?: { x: number; y: number }): void {
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
    this.drawWind(this.elapsed)
    this.updateLighting(dt)
    this.drawHighlight()
    this.updateFriends()
    this.updateParticles(dt)
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

  // ---------- 内部：光照 ----------

  private updateLighting(dt: number): void {
    const target = this.world?.progress.coreRepaired ? 1 : 0
    if (Math.abs(this.lightLevel - target) < 0.002) {
      this.lightLevel = target
    } else {
      this.lightLevel += (target - this.lightLevel) * Math.min(1, dt * 2.2)
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

    // 修复后：大厅顶部一排暖灯
    if (this.lightLevel > 0.02) {
      const flicker = 0.88 + 0.12 * Math.sin(this.elapsed * 2.6)
      for (let i = 0; i < 7; i++) {
        const lx = (17.1 + i * 1.15) * TILE_SIZE
        const ly = 7.35 * TILE_SIZE
        lampG.circle(lx, ly, 22).fill({ color: COLORS.lamp, alpha: 0.15 * this.lightLevel * flicker })
        lampG.circle(lx, ly, 4.5).fill({ color: COLORS.lampCore, alpha: 0.95 * this.lightLevel })
      }
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

  // ---------- 内部：伙伴与粒子 ----------

  private rebuildFriends(): void {
    this.friendsLayer.removeChildren()
    this.friends = []
    const world = this.world
    if (!world) return
    const spots = [
      { x: 18.6, y: 11.45 },
      { x: 23.9, y: 11.45 },
    ]
    spots.forEach((spot, i) => {
      const view = new Container()
      const body = new Graphics()
      const bodyColor = i === 0 ? 0xa8ba8e : 0xe9b6a7
      body.circle(0, 0, 13).fill(bodyColor)
      body.circle(-7, -10, 5).fill(bodyColor)
      body.circle(7, -10, 5).fill(bodyColor)
      body.circle(-4, -2, 1.8).fill(0x403c38)
      body.circle(4, -2, 1.8).fill(0x403c38)
      body.circle(0, 4, 2.6).fill(0xd98a82)
      view.addChild(body)
      view.position.set(spot.x * TILE_SIZE, spot.y * TILE_SIZE)
      this.friendsLayer.addChild(view)
      this.friends.push({ view, baseY: spot.y * TILE_SIZE, phase: i * 1.7 })
    })
  }

  private updateFriends(): void {
    const repaired = this.world?.progress.coreRepaired ?? false
    for (const friend of this.friends) {
      const bounce = repaired
        ? Math.abs(Math.sin(this.elapsed * 3 + friend.phase)) * 10
        : Math.sin(this.elapsed * 1.6 + friend.phase) * 1.5
      friend.view.y = friend.baseY - bounce
    }
  }

  private updateParticles(dt: number): void {
    const g = this.effects
    g.clear()
    if (this.particles.length === 0) return
    for (const p of this.particles) {
      p.age += dt
      p.x += p.vx * dt
      p.y += p.vy * dt
      p.vy += 90 * dt
      const k = 1 - p.age / p.life
      if (k > 0) g.circle(p.x, p.y, p.size * k).fill({ color: 0xc9a981, alpha: 0.8 * k })
    }
    this.particles = this.particles.filter((p) => p.age < p.life)
  }

  // ---------- 内部：静态绘制 ----------

  private rebuildTerrain(): void {
    const g = this.terrain
    g.clear()
    const world = this.world
    if (!world) return
    const T = TILE_SIZE

    // 洞窟底色铺满整张地图
    g.rect(0, 0, WORLD_PIXEL_WIDTH, WORLD_PIXEL_HEIGHT).fill(COLORS.caveDeep)

    // 地表风暴天空：两层色带
    const skyHalf = (SURFACE_Y * T) / 2
    g.rect(0, 0, WORLD_PIXEL_WIDTH, skyHalf).fill(COLORS.skyTop)
    g.rect(0, skyHalf, WORLD_PIXEL_WIDTH, skyHalf).fill(COLORS.skyBottom)

    const isSolid = (x: number, y: number): boolean => {
      if (x < 0 || x >= world.width || y < SURFACE_Y || y >= world.height) return false
      return world.tiles[y][x] !== TILE.EMPTY
    }

    // 地层瓦片
    for (let y = SURFACE_Y; y < world.height; y++) {
      for (let x = 0; x < world.width; x++) {
        const tile = world.tiles[y][x]
        if (tile === TILE.EMPTY) continue
        const px = x * T
        const py = y * T
        const n = hash(x, y)
        if (tile === TILE.ROCK) {
          g.rect(px, py, T, T).fill((x + y) % 3 === 0 ? COLORS.rockLight : COLORS.rock)
          g.moveTo(px + 5 + n * 5, py + 9)
            .lineTo(px + 16, py + 13 + n * 4)
            .lineTo(px + 20 + n * 3, py + 25)
            .stroke({ width: 1.2, color: COLORS.rockCrack, alpha: 0.55 })
        } else {
          g.rect(px, py, T, T).fill(COLORS.soil)
          g.circle(px + 9 + n * 13, py + 10 + n * 12, 4 + n * 3).fill({
            color: n > 0.5 ? COLORS.soilLight : COLORS.soilDark,
            alpha: 0.65,
          })
        }
      }
    }

    // 岩壁轮廓：洞窟与实体相邻的边描一道浅色线
    for (let y = SURFACE_Y; y < world.height; y++) {
      for (let x = 0; x < world.width; x++) {
        if (world.tiles[y][x] !== TILE.EMPTY) continue
        const px = x * T
        const py = y * T
        if (isSolid(x, y - 1)) g.moveTo(px, py).lineTo(px + T, py)
        if (isSolid(x - 1, y)) g.moveTo(px, py).lineTo(px, py + T)
        if (isSolid(x + 1, y)) g.moveTo(px + T, py).lineTo(px + T, py + T)
        if (isSolid(x, y + 1)) g.moveTo(px, py + T).lineTo(px + T, py + T)
      }
    }
    g.stroke({ width: 2.5, color: COLORS.caveEdge, alpha: 0.35 })

    // 地表草皮盖（竖井开口处自然留出缺口）
    for (let x = 0; x < world.width; x++) {
      const tile = world.tiles[SURFACE_Y][x]
      if (tile !== TILE.EMPTY) g.rect(x * T, SURFACE_Y * T, T, 5).fill(COLORS.grass)
    }
  }

  private rebuildLandmarks(): void {
    this.landmarkLayer.removeChildren()
    this.glowLayer.removeChildren()
    this.crystal = null
    this.springGlow = null
    const world = this.world
    if (!world) return
    const T = TILE_SIZE

    // 竖井里的木梯（结构层，受黑暗影响）
    const ladder = new Graphics()
    const ladderX = (LANDMARKS.shaft.x + LANDMARKS.shaft.w / 2) * T
    const ladderTop = LANDMARKS.shaft.y * T
    const ladderBottom = (LANDMARKS.shaft.y + LANDMARKS.shaft.h + 1) * T
    ladder.moveTo(ladderX - 9, ladderTop).lineTo(ladderX - 9, ladderBottom)
    ladder.moveTo(ladderX + 9, ladderTop).lineTo(ladderX + 9, ladderBottom)
    for (let y = ladderTop + 8; y < ladderBottom; y += 11) ladder.moveTo(ladderX - 9, y).lineTo(ladderX + 9, y)
    ladder.stroke({ width: 3, color: COLORS.wood, alpha: 0.9 })
    this.landmarkLayer.addChild(ladder)

    // 能源核心：机身（结构层）
    const repaired = world.progress.coreRepaired
    const generatorX = (LANDMARKS.generator.x + 0.5) * T
    const generatorY = (LANDMARKS.generator.y + 0.5) * T
    const machine = new Graphics()
    machine.roundRect(generatorX - 52, generatorY - 34, 104, 68, 12).fill(repaired ? COLORS.machineOn : COLORS.machine)
    machine.roundRect(generatorX - 44, generatorY - 25, 88, 50, 8).fill(repaired ? COLORS.machineOnInner : COLORS.machineInner)
    this.landmarkLayer.addChild(machine)

    // 能源核心：运转灯与标签（发光层，穿透黑暗）
    const machineGlow = new Graphics()
    if (repaired) {
      machineGlow.circle(generatorX, generatorY, 40).fill({ color: COLORS.coreOn, alpha: 0.22 })
      machineGlow.circle(generatorX, generatorY, 20).fill(COLORS.coreOn)
      machineGlow.circle(generatorX, generatorY, 11).fill(COLORS.coreOnInner)
    } else {
      machineGlow.circle(generatorX, generatorY, 20).fill(COLORS.machineCore)
      machineGlow.circle(generatorX, generatorY, 11).fill(COLORS.machineCoreInner)
    }
    this.glowLayer.addChild(machineGlow)
    this.glowLayer.addChild(
      this.makeLabel(
        repaired ? '能源核心 · 运行中' : '能源核心 · 待修复',
        generatorX,
        generatorY + 52,
        repaired ? COLORS.labelOn : COLORS.labelDim,
      ),
    )

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
      const crystal = new Graphics()
      if (revealed) {
        crystal
          .moveTo(crystalX, crystalY - 22)
          .lineTo(crystalX + 17, crystalY - 8)
          .lineTo(crystalX + 6, crystalY + 19)
          .lineTo(crystalX - 14, crystalY + 8)
          .closePath()
          .fill(COLORS.crystal)
        crystal.circle(crystalX, crystalY, 30).fill({ color: COLORS.crystalGlow, alpha: 0.18 })
        this.glowLayer.addChild(this.makeLabel('能源石', crystalX, crystalY - 38, COLORS.crystalGlow))
      } else {
        crystal.circle(crystalX, crystalY, 24).fill({ color: COLORS.crystalGlow, alpha: 0.12 })
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
