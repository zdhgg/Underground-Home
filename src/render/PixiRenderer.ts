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
  crystal: 0x9ee7f4,
  crystalGlow: 0x8dedfd,
  water: 0x5fb7d6,
  labelCream: 0xeae6d8,
  labelDim: 0xcfd6cc,
  labelWater: 0xa8e4f2,
} as const

const LABEL_FONT = 'ui-rounded, "PingFang SC", "Microsoft YaHei", system-ui, sans-serif'

function hash(x: number, y: number): number {
  const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453
  return n - Math.floor(n)
}

/**
 * PixiJS 渲染器：只负责"世界 → 画面"。
 * 不包含任何游戏规则，挖掘判定由 core/dig 决定后再通知本层刷新。
 */
export class PixiWorldRenderer {
  private readonly worldLayer = new Container()
  private readonly terrain = new Graphics()
  private readonly wind = new Graphics()
  private readonly landmarkLayer = new Container()
  private readonly hover = new Graphics()

  private crystal: Graphics | null = null
  private springGlow: Graphics | null = null

  private world: WorldState | null = null
  private hoverCell: Cell | null = null
  private camera: Camera = { x: 0, y: 0, zoom: 1 }
  private viewport: Viewport
  private elapsed = 0

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
    this.worldLayer.addChild(this.terrain, this.wind, this.landmarkLayer, this.hover)
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
    this.refresh()
  }

  /** 世界数据变化后刷新画面（挖掘后调用） */
  refresh(): void {
    this.rebuildTerrain()
    this.rebuildLandmarks()
    this.redrawHover()
  }

  /** 初始视角：对准避难所 */
  focusHome(): void {
    const zoom = Math.min(1.25, Math.max(0.85, this.viewport.width / 1280))
    const centerX = (LANDMARKS.generator.x + 0.5) * TILE_SIZE
    const centerY = (LANDMARKS.generator.y + 0.5) * TILE_SIZE - 60
    this.camera = centerOn(centerX, centerY, this.viewport, zoom)
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
    this.elapsed += ticker.deltaMS / 1000
    this.syncViewport()
    this.drawWind(this.elapsed)
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

  // ---------- 内部：绘制 ----------

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
    const layer = this.landmarkLayer
    layer.removeChildren()
    this.crystal = null
    this.springGlow = null
    const world = this.world
    if (!world) return
    const T = TILE_SIZE

    // 竖井里的木梯
    const ladder = new Graphics()
    const ladderX = (LANDMARKS.shaft.x + LANDMARKS.shaft.w / 2) * T
    const ladderTop = LANDMARKS.shaft.y * T
    const ladderBottom = (LANDMARKS.shaft.y + LANDMARKS.shaft.h + 1) * T
    ladder.moveTo(ladderX - 9, ladderTop).lineTo(ladderX - 9, ladderBottom)
    ladder.moveTo(ladderX + 9, ladderTop).lineTo(ladderX + 9, ladderBottom)
    for (let y = ladderTop + 8; y < ladderBottom; y += 11) ladder.moveTo(ladderX - 9, y).lineTo(ladderX + 9, y)
    ladder.stroke({ width: 3, color: COLORS.wood, alpha: 0.9 })
    layer.addChild(ladder)

    // 地表入口标签
    layer.addChild(
      this.makeLabel('避难所入口', (LANDMARKS.shaft.x + LANDMARKS.shaft.w / 2) * T, SURFACE_Y * T - 16, COLORS.labelCream),
    )

    // 能源核心（旧机器，P1 修复后点亮）
    const generatorX = (LANDMARKS.generator.x + 0.5) * T
    const generatorY = (LANDMARKS.generator.y + 0.5) * T
    const machine = new Graphics()
    machine.roundRect(generatorX - 52, generatorY - 34, 104, 68, 12).fill(COLORS.machine)
    machine.roundRect(generatorX - 44, generatorY - 25, 88, 50, 8).fill(COLORS.machineInner)
    machine.circle(generatorX, generatorY, 20).fill(COLORS.machineCore)
    machine.circle(generatorX, generatorY, 11).fill(COLORS.machineCoreInner)
    layer.addChild(machine)
    layer.addChild(this.makeLabel('能源核心 · 待修复', generatorX, generatorY + 52, COLORS.labelDim))

    // 地下泉水：藏在岩层里，只透出隐约蓝光（探索期待的伏笔）
    const spring = new Graphics()
    const springX = (LANDMARKS.spring.x + 0.5) * T
    const springY = (LANDMARKS.spring.y + 0.5) * T
    spring.ellipse(springX, springY, 26, 18).fill({ color: COLORS.water, alpha: 0.5 })
    spring.circle(springX, springY, 48).fill({ color: COLORS.water, alpha: 0.12 })
    this.springGlow = spring
    layer.addChild(spring)

    // 能源石：挖开泥土后露出；未挖开时只透出一点微光
    const revealed = world.tiles[LANDMARKS.crystal.y][LANDMARKS.crystal.x] === TILE.EMPTY
    const crystalX = (LANDMARKS.crystal.x + 0.5) * T
    const crystalY = (LANDMARKS.crystal.y + 0.5) * T
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
      layer.addChild(this.makeLabel('能源石', crystalX, crystalY - 38, COLORS.crystalGlow))
    } else {
      crystal.circle(crystalX, crystalY, 24).fill({ color: COLORS.crystalGlow, alpha: 0.12 })
    }
    this.crystal = crystal
    layer.addChild(crystal)
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
