import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Container, Sprite, Text, Texture, TextureSource, type Graphics, type Ticker } from 'pixi.js'
import { placePod } from '../src/core/build'
import { dig } from '../src/core/dig'
import { createDigHistory } from '../src/core/history'
import { collectCrystal, repairCore } from '../src/core/interact'
import { createInitialWorld, LANDMARKS, SURFACE_Y, TILE, TILE_SIZE, type SleepPod } from '../src/core/world'
import { inspectCrack, moleRoute, shaftFrontier, upgradePickaxe } from '../src/core/exploration'
import { PixiWorldRenderer } from '../src/render/PixiRenderer'
import { loadTerrainTextures, type TerrainTextures } from '../src/render/terrainTextures'
import { loadEnergyCoreTexture } from '../src/render/energyCoreTexture'
import { loadCrystalTexture } from '../src/render/crystalTexture'
import type { CrystalFeedback } from '../src/render/CrystalFeedback'
import { LAMP_LOCATIONS, loadShelterFixtureTextures } from '../src/render/shelterFixtures'
import { bedSlots } from '../src/render/sleepPods'

// 只替换 GPU/资源入口，地形使用真实 Pixi Sprite、Texture 和 Graphics。
vi.mock('pixi.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('pixi.js')>()
  return {
    ...actual,
    Application: class {
      screen = { width: 1200, height: 800 }
      stage = new actual.Container()
      canvas = { style: {} }
      ticker = { add: vi.fn(), remove: vi.fn() }
      init = vi.fn().mockResolvedValue(undefined)
      destroy = vi.fn()
    },
  }
})
vi.mock('../src/render/terrainTextures', async (importOriginal) => ({
  ...await importOriginal<typeof import('../src/render/terrainTextures')>(),
  loadTerrainTextures: vi.fn(),
}))
vi.mock('../src/render/energyCoreTexture', async (importOriginal) => ({
  ...await importOriginal<typeof import('../src/render/energyCoreTexture')>(),
  loadEnergyCoreTexture: vi.fn(),
}))
vi.mock('../src/render/crystalTexture', async (importOriginal) => ({
  ...await importOriginal<typeof import('../src/render/crystalTexture')>(),
  loadCrystalTexture: vi.fn(),
}))
vi.mock('../src/render/shelterFixtures', async (importOriginal) => ({
  ...await importOriginal<typeof import('../src/render/shelterFixtures')>(),
  loadShelterFixtureTextures: vi.fn(),
}))

function texture(size = 64): Texture {
  return new Texture({ source: new TextureSource({ width: size, height: size }) })
}

function textures(): TerrainTextures {
  const edges = () => ({ top: texture(), right: texture(), bottom: texture(), left: texture() })
  return {
    soil: [texture(), texture(), texture()], rock: [texture(), texture(), texture()],
    caveBg: texture(512), soilEdges: edges(), rockEdges: edges(), surfaceGrass: texture(),
  }
}

interface TerrainProbe {
  tileSprites: { base: Sprite; edges: Sprite[] }[][]
  terrainLayer: Container
  hover: Graphics
  landmarkLayer: Container
  glowLayer: Container
  machineGlow: Graphics
  crystal: Container | null
  crystalFeedback: CrystalFeedback
  lightLevel: number
  spinUp: number
  cameraTween: unknown
  shelterFixtures: Container
  worldLayer: Container
  darkness: Graphics
  lamps: Graphics
  powerLine: Graphics
  powerLevel: number
  drawLighting(): void
  drawPowerLine(): void
  podLayer: Container
  farmLayer: Container
  farmFlow: Graphics
  podEntrance: unknown
  friends: {
    view: Container
    body: Graphics
    bodyColor: number
    baseY: number
    phase: number
    pose: string
    bed: { x: number; y: number } | null
    inEntrance: boolean
    podId: number | null
    nameLabel: { text: string } | null
    hidden: boolean
    tailGlow: { alpha: number } | null
    partnerId: string
  }[]
  refreshPods(): void
  refreshFriends(arrivingPodId?: number | null): void
  refreshFarm(): void
  playPodEntrance(pod: SleepPod, onSettled: () => void): void
  playPodCelebration(pod: SleepPod): void
  drawLighting(): void
  tick(ticker: Ticker): void
  updateTerrainCell(x: number, y: number): void
}

describe('PNG 世界渲染（地形与能源核心）', () => {
  let renderer: PixiWorldRenderer
  let view: TerrainProbe
  let art: TerrainTextures
  let world: ReturnType<typeof createInitialWorld>

  beforeEach(async () => {
    vi.stubGlobal('window', { devicePixelRatio: 1 })
    art = textures()
    vi.mocked(loadTerrainTextures).mockResolvedValue(art)
    vi.mocked(loadEnergyCoreTexture).mockResolvedValue(new Texture({
      source: new TextureSource({ width: 1536, height: 1024 }),
    }))
    vi.mocked(loadCrystalTexture).mockResolvedValue(texture(1254))
    vi.mocked(loadShelterFixtureTextures).mockResolvedValue({
      ladder: new Texture({ source: new TextureSource({ width: 1024, height: 1536 }) }),
      lamp: texture(1254),
    })
    renderer = await PixiWorldRenderer.create({ appendChild: vi.fn() } as unknown as HTMLElement)
    view = renderer as unknown as TerrainProbe
    world = createInitialWorld()
    renderer.setWorld(world)
  })
  afterEach(() => {
    renderer.destroy()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('64px PNG 换入空精灵后仍为32×32，锚点和网格不变', () => {
    const cell = view.tileSprites[9][14]
    for (const sprite of [cell.base, ...cell.edges.filter((edge) => edge.visible)]) {
      expect(sprite.width).toBe(TILE_SIZE)
      expect(sprite.height).toBe(TILE_SIZE)
      expect(sprite.anchor.x).toBe(0)
      expect(sprite.anchor.y).toBe(0)
      expect([sprite.x, sprite.y]).toEqual([14 * TILE_SIZE, 9 * TILE_SIZE])
    }
  })

  it.each(Array.from({ length: 16 }, (_, mask) => mask))('四方向组合 %i：叠图在实心格上，空格不留精灵', (mask) => {
    const neighbors = [[10, 9], [11, 10], [10, 11], [9, 10]]
    neighbors.forEach(([x, y], i) => { world.tiles[y][x] = mask & (1 << i) ? TILE.EMPTY : TILE.SOIL })
    renderer.refreshTerrain()
    const center = view.tileSprites[10][10]
    expect(center.base.visible).toBe(true)
    expect(center.edges.map((edge) => edge.visible)).toEqual(neighbors.map((_, i) => Boolean(mask & (1 << i))))
    const directions = ['top', 'right', 'bottom', 'left'] as const
    directions.forEach((direction, i) => {
      if (mask & (1 << i)) expect(center.edges[i].texture).toBe(art.soilEdges[direction])
    })
    neighbors.forEach(([x, y], i) => {
      if (mask & (1 << i)) {
        expect(view.tileSprites[y][x].base.visible).toBe(false)
        expect(view.tileSprites[y][x].edges.every((edge) => !edge.visible)).toBe(true)
      }
    })
  })

  it('土岩实心交界不画洞边；挖掘交界后两种材质各用自己的叠图', () => {
    expect(view.tileSprites[10][1].edges.some((edge) => edge.visible)).toBe(false)
    expect(view.tileSprites[10][2].edges.some((edge) => edge.visible)).toBe(false)
    expect(dig(world, 2, 10).ok).toBe(true)
    renderer.refreshTerrain([{ x: 2, y: 10 }])
    expect(view.tileSprites[10][1].edges[1].visible).toBe(true)
    expect(view.tileSprites[10][1].edges[1].texture).toBe(art.rockEdges.right)
    expect(view.tileSprites[10][3].edges[3].visible).toBe(true)
    expect(view.tileSprites[10][3].edges[3].texture).toBe(art.soilEdges.left)
  })

  it('挖掘、撤销恢复四周边缘与原贴图，且清除已挖格的悬停框', () => {
    const history = createDigHistory()
    const before = view.tileSprites[10][11].base.texture
    renderer.setHoverCell({ x: 11, y: 10 })
    expect(view.hover.context.instructions.length).toBeGreaterThan(0)
    dig(world, 11, 10)
    history.record(11, 10)
    renderer.refreshTerrain([{ x: 11, y: 10 }])
    expect(view.hover.context.instructions).toHaveLength(0)
    for (const [x, y, edge] of [[11, 9, 2], [12, 10, 3], [11, 11, 0], [10, 10, 1]]) {
      expect(view.tileSprites[y][x].edges[edge].visible).toBe(true)
    }
    const restored = history.undo(world)!
    renderer.refreshTerrain([restored])
    expect(view.tileSprites[10][11].base.visible).toBe(true)
    expect(view.tileSprites[10][11].base.texture).toBe(before)
    for (const [x, y] of [[11, 9], [12, 10], [11, 11], [10, 10]]) {
      expect(view.tileSprites[y][x].edges.some((edge) => edge.visible)).toBe(false)
    }
    expect(view.hover.context.instructions.length).toBeGreaterThan(0)
  })

  it('草边只覆盖地表实心格，竖井保持开口，地图外不产生洞壁', () => {
    const surface = view.tileSprites[SURFACE_Y][0]
    expect(surface.edges[0].visible).toBe(true)
    expect(surface.edges[0].texture).toBe(art.surfaceGrass)
    expect(surface.edges[3].visible).toBe(false)
    expect(view.tileSprites[SURFACE_Y][21].base.visible).toBe(false)
    expect(view.tileSprites[SURFACE_Y][21].edges.some((edge) => edge.visible)).toBe(false)
    expect(view.tileSprites[world.height - 1][0].edges[2].visible).toBe(false)
  })

  it('全图刷新、重新加载保持坐标变体一致，不改世界或存档字段', () => {
    const snapshot = JSON.stringify(world)
    const before = view.tileSprites.map((row) => row.map((cell) => cell?.base.texture))
    renderer.setWorld(world)
    expect(view.tileSprites.map((row) => row.map((cell) => cell?.base.texture))).toEqual(before)
    expect(JSON.stringify(world)).toBe(snapshot)
    const selected = new Set(view.tileSprites[10].map((cell) => cell.base.texture))
    for (const tex of [...art.soil, ...art.rock]) expect(selected.has(tex)).toBe(true)
  })

  it('单格刷新只更新5格并复用精灵；批量重叠邻域去重、地图边界安全', () => {
    const sprites = [...view.terrainLayer.children]
    const update = vi.spyOn(view, 'updateTerrainCell')
    renderer.refreshTerrain([{ x: 11, y: 10 }])
    expect(update).toHaveBeenCalledTimes(5)
    expect(update.mock.calls).toEqual(expect.arrayContaining([[11, 10], [10, 10], [12, 10], [11, 9], [11, 11]]))
    update.mockClear()
    renderer.refreshTerrain([{ x: 11, y: 10 }, { x: 12, y: 10 }])
    expect(update).toHaveBeenCalledTimes(8)
    update.mockClear()
    renderer.refreshTerrain([{ x: 0, y: world.height - 1 }])
    expect(update).toHaveBeenCalledTimes(3)
    expect(view.terrainLayer.children).toEqual(sprites)
  })

  it('能源核心三态复用同一PNG、保持比例与槽心对齐，渲染不改变任务和存档数据', () => {
    const bodyTexture = view.landmarkLayer.children.find((child) => child instanceof Sprite)!.texture
    const assertCore = (label: string, innerColor: number) => {
      const snapshot = JSON.stringify(world)
      renderer.refresh()
      const body = view.landmarkLayer.children.find((child) => child instanceof Sprite)!
      expect(body.texture).toBe(bodyTexture)
      expect(body.width).toBe(128)
      expect(body.height).toBeCloseTo(128 * 1024 / 1536)
      expect(body.scale.x).toBe(body.scale.y)
      expect([body.anchor.x, body.anchor.y]).toEqual([0.5, 0.46])
      expect([body.x, body.y]).toEqual([(LANDMARKS.generator.x + 0.5) * TILE_SIZE, (LANDMARKS.generator.y + 0.5) * TILE_SIZE])
      expect(view.glowLayer.children.some((child) => child instanceof Text && child.text === label)).toBe(true)
      expect(view.machineGlow.context.fillStyle.color).toBe(innerColor)
      expect(JSON.stringify(world)).toBe(snapshot)
    }
    assertCore('能源核心 · 待修复', 0x33474f)
    dig(world, LANDMARKS.crystal.x, LANDMARKS.crystal.y)
    expect(collectCrystal(world, LANDMARKS.crystal.x, LANDMARKS.crystal.y).ok).toBe(true)
    assertCore('能源核心 · 等待能源石', 0xfff0d0)
    expect(repairCore(world, LANDMARKS.generator.x, LANDMARKS.generator.y).ok).toBe(true)
    assertCore('能源核心 · 运行中', 0xeafff2)
  })

  it('能源石埋藏时只有微光，挖开显示PNG，收集后消失', () => {
    expect(view.crystal?.children.some((child) => child instanceof Sprite)).toBe(false)
    dig(world, LANDMARKS.crystal.x, LANDMARKS.crystal.y)
    renderer.refresh()
    const stone = view.crystal?.children.find((child) => child instanceof Sprite)
    expect(stone).toBeDefined()
    expect(stone!.height).toBe(48)
    expect(collectCrystal(world, LANDMARKS.crystal.x, LANDMARKS.crystal.y).ok).toBe(true)
    renderer.refresh()
    renderer.playCrystalCollection()
    expect(view.crystal).toBeNull()
    expect(view.crystalFeedback.view.visible).toBe(true)
    const snapshot = JSON.stringify(world)
    for (let i = 0; i < 5; i++) view.tick({ deltaMS: 100 } as Ticker)
    expect(view.crystalFeedback.view.visible).toBe(false)
    expect(JSON.stringify(world)).toBe(snapshot)
  })

  it('探索演出可以安全取消：没落镐就不改世界，重新委托才真的挖开', () => {
    const w = world
    w.progress = { crystalFound: true, crystalCollected: true, coreRepaired: true }
    for (let y = 10; y <= 11; y++) for (let x = 12; x <= 14; x++) dig(w, x, y)
    expect(placePod(w, 12, 10)).not.toBeNull()
    for (let x = 26; x <= 27; x++) dig(w, x, 11)
    expect(inspectCrack(w, 27, 12)).toBe(true)
    expect(upgradePickaxe(w)).toBe(true)
    renderer.refresh()
    const target = shaftFrontier(w, 27)!
    // 让阿土从大厅地面出发，走一段真实的长路
    w.exploration.explorer = { x: 18, y: 11 }
    const route = moleRoute(w, { x: target.x, y: target.y - 1 })!
    expect(route.length).toBe(10)
    const snapshot = JSON.stringify(w)
    const arrived = vi.fn()
    renderer.playExplorationTravel(route, arrived)
    expect(renderer.explorationAnimating).toBe(true)
    for (let i = 0; i < 2; i++) view.tick({ deltaMS: 100 } as Ticker)
    // 走到一半被切后台 / 超时：不"到达"、不改世界
    renderer.cancelExplorationAnimation()
    expect(renderer.explorationAnimating).toBe(false)
    for (let i = 0; i < 20; i++) view.tick({ deltaMS: 100 } as Ticker)
    expect(arrived).not.toHaveBeenCalled()
    expect(JSON.stringify(w)).toBe(snapshot)
    // 挥镐到一半取消：落镐回调不触发，世界保持原样
    const struck = vi.fn()
    renderer.playRockBreak(target, struck)
    for (let i = 0; i < 3; i++) view.tick({ deltaMS: 100 } as Ticker)
    renderer.cancelExplorationAnimation()
    for (let i = 0; i < 20; i++) view.tick({ deltaMS: 100 } as Ticker)
    expect(struck).not.toHaveBeenCalled()
    expect(JSON.stringify(w)).toBe(snapshot)
    // 玩家再点一次：落镐后照常挖开一格，演出自己收尾
    renderer.playRockBreak(target, struck)
    for (let i = 0; i < 8; i++) view.tick({ deltaMS: 100 } as Ticker)
    expect(struck).toHaveBeenCalledTimes(1)
    expect(renderer.explorationAnimating).toBe(false)
  })

  it('安装动画结束才启动和点灯；任务及存档立即完成，载入已完成世界不重播', () => {
    dig(world, LANDMARKS.crystal.x, LANDMARKS.crystal.y)
    collectCrystal(world, LANDMARKS.crystal.x, LANDMARKS.crystal.y)
    repairCore(world, LANDMARKS.generator.x, LANDMARKS.generator.y)
    renderer.refresh()
    renderer.playRepairCelebration()
    const snapshot = JSON.stringify(world)
    expect(view.crystalFeedback.installing).toBe(true)
    for (let i = 0; i < 5; i++) view.tick({ deltaMS: 100 } as Ticker)
    expect(view.lightLevel).toBe(0)
    expect(view.spinUp).toBe(0)
    for (let i = 0; i < 3; i++) view.tick({ deltaMS: 100 } as Ticker)
    expect(view.crystalFeedback.installing).toBe(false)
    expect(view.spinUp).toBeGreaterThan(0)
    expect(view.lightLevel).toBeGreaterThan(0)
    expect(JSON.stringify(world)).toBe(snapshot)
    renderer.playRepairCelebration()
    renderer.setWorld(world)
    expect(view.crystalFeedback.installing).toBe(false)
    expect(view.lightLevel).toBe(1)
    expect(view.spinUp).toBe(0)
    expect(view.crystal).toBeNull()
  })

  it('安装期间手动平移仍能取消自动拉远，晶体安装与启动继续完成', () => {
    dig(world, LANDMARKS.crystal.x, LANDMARKS.crystal.y)
    collectCrystal(world, LANDMARKS.crystal.x, LANDMARKS.crystal.y)
    repairCore(world, LANDMARKS.generator.x, LANDMARKS.generator.y)
    renderer.refresh()
    renderer.playRepairCelebration()
    renderer.panBy(20, 0)
    for (let i = 0; i < 10; i++) view.tick({ deltaMS: 100 } as Ticker)
    expect(view.cameraTween).toBeNull()
    expect(view.crystalFeedback.installing).toBe(false)
    expect(view.spinUp).toBeGreaterThan(0)
  })

  it('梯架和7盏未通电灯具位于原坐标、黑暗遮罩之下，刷新复用静态精灵', () => {
    const fixtures = [...view.shelterFixtures.children] as Sprite[]
    expect(fixtures).toHaveLength(8)
    const [ladder, ...lamps] = fixtures
    expect([ladder.x, ladder.y]).toEqual([(LANDMARKS.shaft.x + LANDMARKS.shaft.w / 2) * TILE_SIZE, LANDMARKS.shaft.y * TILE_SIZE])
    expect(ladder.height).toBe((LANDMARKS.shaft.h + 1) * TILE_SIZE)
    expect(ladder.scale.x).toBe(ladder.scale.y)
    lamps.forEach((lamp, i) => {
      expect(lamp.visible).toBe(true)
      expect(lamp.tint).toBe(0x666666)
      expect([lamp.x, lamp.y]).toEqual([LAMP_LOCATIONS[i].x, LAMP_LOCATIONS[i].y])
      expect(lamp.scale.x).toBe(lamp.scale.y)
    })
    expect(view.worldLayer.getChildIndex(view.shelterFixtures)).toBeLessThan(view.worldLayer.getChildIndex(view.darkness))
    view.drawLighting()
    expect(view.lamps.context.instructions).toHaveLength(0)
    renderer.refresh()
    expect(view.shelterFixtures.children).toEqual(fixtures)
  })

  it('顶灯仍按原顺序逐盏点亮，光晕与PNG灯芯位置一致且不重建灯具', () => {
    const fixtures = [...view.shelterFixtures.children]
    const snapshot = JSON.stringify(world)
    view.lightLevel = 0.2
    view.drawLighting()
    expect(view.lamps.context.instructions).toHaveLength(6) // 前3盏：每盏光晕+灯芯
    const lampSprites = view.shelterFixtures.children.slice(1) as Sprite[]
    expect(lampSprites[0].tint).toBeGreaterThan(lampSprites[3].tint)
    expect(lampSprites[6].tint).toBe(0x666666)
    view.lightLevel = 1
    view.drawLighting()
    expect(view.lamps.context.instructions).toHaveLength(14)
    expect(lampSprites.every((lamp) => lamp.tint === 0xffffff)).toBe(true)
    view.lightLevel = 0
    view.drawLighting()
    expect(lampSprites.every((lamp) => lamp.tint === 0x666666)).toBe(true)
    expect(view.shelterFixtures.children).toEqual(fixtures)
    expect(JSON.stringify(world)).toBe(snapshot)
  })

  it('点亮核心只解除暖窝层黑暗，第二层始终保留独立遮罩', () => {
    view.lightLevel = 1
    view.drawLighting()
    expect(view.darkness.context.instructions).toHaveLength(1)
    expect(view.darkness.context.fillStyle.alpha).toBe(0.43)
    const bounds = view.darkness.getLocalBounds()
    expect(bounds.y).toBe(12 * TILE_SIZE)
    expect(bounds.height).toBe((world.height - 12) * TILE_SIZE)
    expect(view.tileSprites[17][8].base.tint).not.toBe(view.tileSprites[10][8].base.tint)
  })

  it('电送到第二层：遮罩淡下去，电线才出现', () => {
    const next = createInitialWorld()
    next.progress = { crystalFound: true, crystalCollected: true, coreRepaired: true }
    next.exploration = {
      ...next.exploration,
      clueFound: true,
      shaftX: 27,
      explorer: { x: 27, y: 11 },
      pickaxeUpgraded: true,
      entered: true,
    }
    renderer.setWorld(next)
    view.lightLevel = 1
    // 还没送电：第二层是暗的，也没有电线
    view.powerLevel = 0
    view.drawLighting()
    expect(view.darkness.context.fillStyle.alpha).toBe(0.43)
    view.drawPowerLine()
    expect(view.powerLine.context.instructions).toHaveLength(0)
    // 送电之后：第二层只剩一点夜色，电线出现
    next.powerDown = true
    view.powerLevel = 1
    view.drawLighting()
    expect(view.darkness.context.fillStyle.alpha).toBeCloseTo(0.05, 5)
    view.drawPowerLine()
    expect(view.powerLine.context.instructions.length).toBeGreaterThan(0)
  })

  it('向下镜头可取消，返回家园恢复操作视角，全景覆盖地表到基岩', () => {
    const onView = vi.fn()
    renderer.onViewChanged = onView
    renderer.focusWater()
    for (let i = 0; i < 10; i++) view.tick({ deltaMS: 100 } as Ticker)
    expect(onView).toHaveBeenLastCalledWith({ layer: 'water', overview: false })
    renderer.focusOverview()
    expect(renderer.isOverview).toBe(true)
    renderer.focusHome()
    expect(renderer.isOverview).toBe(false)
    expect(view.cameraTween).toBeNull()
    expect(onView).toHaveBeenLastCalledWith({ layer: 'home', overview: false })
    renderer.focusWater()
    renderer.panBy(0, 20)
    expect(view.cameraTween).toBeNull()
  })

  describe('点亮与阿灯', () => {
    it('还没点亮：阿灯缩在角落，只有尾光、没有名字；阿土照常站在大厅', () => {
      renderer.setWorld(createInitialWorld())
      expect(view.friends).toHaveLength(2)
      const [atu, adeng] = view.friends
      expect(atu.hidden).toBe(false)
      expect(atu.nameLabel?.text).toBe('阿土')
      expect(adeng.hidden).toBe(true)
      expect(adeng.nameLabel).toBeNull()
      expect(adeng.tailGlow).not.toBeNull()
      expect(adeng.view.alpha).toBeLessThan(0.8)
      // 她躲在右边角落，和阿土分开
      expect(adeng.view.x).toBeGreaterThan(atu.view.x)
    })

    it('点亮之后：阿灯从角落飞出来，落地后有名字、不再躲着', () => {
      const world = createInitialWorld()
      world.progress = { crystalFound: true, crystalCollected: true, coreRepaired: false }
      renderer.setWorld(world)
      const adeng = view.friends[1]
      expect(adeng.hidden).toBe(true)
      const cornerX = adeng.view.x

      world.progress.coreRepaired = true
      renderer.playRepairCelebration()
      // 安装 0.7s + 延迟 0.7s + 飞行 1.25s，留足帧数
      for (let i = 0; i < 220; i++) view.tick({ deltaMS: 16 } as Ticker)

      expect(adeng.hidden).toBe(false)
      expect(adeng.view.x).not.toBeCloseTo(cornerX, 0)
      expect(adeng.view.alpha).toBeCloseTo(1, 2)
      expect(adeng.nameLabel?.text).toBe('阿灯')
      expect(adeng.tailGlow).toBeNull()
    })

    it('每个伙伴带着自己的物种 id：画出来的不是同一个球', () => {
      const world = createInitialWorld()
      world.progress = { crystalFound: true, crystalCollected: true, coreRepaired: true }
      renderer.setWorld(world)
      expect(view.friends.map((friend) => friend.partnerId)).toEqual(['atu', 'adeng'])
      for (let y = 10; y <= 11; y++) for (let x = 12; x < 15; x++) dig(world, x, y)
      placePod(world, 12, 10)
      renderer.refreshPods()
      renderer.refreshFriends()
      // 建好床小满就来，此时大厅里有三位：阿土、阿灯、小满
      expect(view.friends.map((friend) => friend.partnerId)).toEqual(['atu', 'adeng', 'xiaoman'])
    })

    it('已点亮的存档直接站着，不重播飞出来的演出', () => {
      const world = createInitialWorld()
      world.progress = { crystalFound: true, crystalCollected: true, coreRepaired: true }
      renderer.setWorld(world)
      const adeng = view.friends[1]
      expect(adeng.hidden).toBe(false)
      expect(adeng.nameLabel?.text).toBe('阿灯')
      expect(view.podEntrance).toBeNull()
    })
  })

  describe('睡眠舱入场与休息', () => {
  function carvedWorld() {
    const next = createInitialWorld()
    next.progress = { crystalFound: true, crystalCollected: true, coreRepaired: true }
    for (let y = 10; y < 12; y++) for (let x = 12; x < 15; x++) dig(next, x, y)
    return next
  }

  it('载入带睡眠舱的存档时：老住户直接睡在床上，新来的小满站在大厅等床', () => {
    const saved = carvedWorld()
    const pod = placePod(saved, 12, 10)!
    renderer.setWorld(saved)
    const beds = bedSlots(pod)
    expect(view.podEntrance).toBeNull()
    // 阿土和阿灯睡在床上；小满闻到家的味道来了，还站着等第二张床。
    expect(view.friends).toHaveLength(3)
    const sleeping = view.friends.filter((friend) => friend.pose === 'rest')
    expect(sleeping).toHaveLength(2)
    sleeping.forEach((friend, i) => {
      expect(friend.bed).toEqual(beds[i])
      expect(friend.view.x).toBeCloseTo(beds[i].x, 5)
      expect(friend.view.y).toBeCloseTo(beds[i].y, 5)
      expect(friend.view.scale.x).toBeCloseTo(0.65, 5)
    })
    const waiting = view.friends.find((friend) => friend.pose === 'idle')
    expect(waiting?.bed).toBeNull()
    expect(waiting?.nameLabel?.text).toBe('小满')
  })

  it('建成刷新只重建舱体，伙伴仍留在避难所等待出发', () => {
    const next = carvedWorld()
    renderer.setWorld(next)
    const beforeY = view.friends[0].view.y
    placePod(next, 12, 10)
    renderer.refreshPods()
    expect(view.podEntrance).toBeNull()
    expect(view.friends[0].pose).toBe('idle')
    expect(view.friends[0].view.y).toBe(beforeY)
    expect(view.podLayer.children).toHaveLength(1)
  })

  it('建好第一间床：小满带着名字出现在大厅，等她自己的床', () => {
    const next = carvedWorld()
    renderer.setWorld(next)
    // 还没有床：阿土和阿灯站着，各自带着名字
    expect(view.friends.map((friend) => friend.nameLabel?.text)).toEqual(['阿土', '阿灯'])
    const pod = placePod(next, 12, 10)!
    renderer.refreshPods()
    renderer.refreshFriends(pod.id)
    // 入场前：新舱两位站着，小满也来了
    expect(view.friends).toHaveLength(3)
    expect(view.friends.map((friend) => friend.nameLabel?.text)).toEqual(['阿土', '阿灯', '小满'])
    renderer.playPodEntrance(pod, () => {})
    for (let i = 0; i < 240; i++) view.tick({ deltaMS: 16 } as Ticker)
    // 阿土和阿灯躺下后名字消失；小满还在等，名字留着
    expect(view.friends.map((friend) => friend.pose)).toEqual(['rest', 'rest', 'idle'])
    expect(view.friends.slice(0, 2).every((friend) => friend.nameLabel === null)).toBe(true)
    expect(view.friends[2].nameLabel?.text).toBe('小满')
  })

  it('建成后沿空洞通道走到舱门，钻进被窝才触发庆祝回调', () => {
    const next = carvedWorld()
    renderer.setWorld(next)
    const pod = placePod(next, 12, 10)!
    renderer.refreshPods()
    let posesAtSettle: string[] = []
    const settled = vi.fn(() => {
      posesAtSettle = view.friends.map((friend) => friend.pose)
    })
    renderer.playPodEntrance(pod, settled)
    expect(settled).not.toHaveBeenCalled()

    for (let i = 0; i < 40; i++) view.tick({ deltaMS: 16 } as Ticker)
    expect(view.friends[0].pose).not.toBe('rest')
    expect(settled).not.toHaveBeenCalled()

    for (let i = 0; i < 200; i++) view.tick({ deltaMS: 16 } as Ticker)
    const beds = bedSlots(pod)
    expect(settled).toHaveBeenCalledTimes(1)
    expect(posesAtSettle).toEqual(['rest', 'rest'])
    view.friends.forEach((friend, i) => {
      expect(friend.pose).toBe('rest')
      expect(friend.view.x).toBeCloseTo(beds[i].x, 5)
      // 休息时会有 ±1.2px 的呼吸起伏
      expect(Math.abs(friend.view.y - beds[i].y)).toBeLessThanOrEqual(1.5)
    })
  })

  it('路径不可达时兜底直接上床，不把伙伴留在半路', () => {
    renderer.setWorld(createInitialWorld())
    const stranded: SleepPod = { id: 7, x: 9, y: 13, door: 'right' }
    const settled = vi.fn()
    renderer.playPodEntrance(stranded, settled)
    expect(settled).toHaveBeenCalledTimes(1)
    expect(view.podEntrance).toBeNull()
    expect(view.friends.every((friend) => friend.pose === 'rest')).toBe(true)
  })

  it('水还没找到就建了第二间床：只渲染三位伙伴，空一个床位等小泉', () => {
    const next = carvedWorld()
    placePod(next, 12, 10)
    for (let y = 9; y <= 11; y++) for (let x = 5; x < 15; x++) if (next.tiles[y][x] === TILE.SOIL) dig(next, x, y)
    expect(placePod(next, 7, 10)).not.toBeNull()
    renderer.setWorld(next)
    expect(view.friends).toHaveLength(3)
    expect(view.friends.map((friend) => friend.pose)).toEqual(['rest', 'rest', 'rest'])
  })

  it('找到水之后大厅里多出两位等床的新朋友', () => {
    const next = carvedWorld()
    placePod(next, 12, 10)
    next.exploration.springFound = true
    renderer.setWorld(next)
    expect(view.friends).toHaveLength(4)
    expect(view.friends.map((friend) => friend.pose)).toEqual(['rest', 'rest', 'idle', 'idle'])
  })

  it('第二间舱的入场只搬新舱那两位，老住户继续睡在自己的床上', () => {
    const next = carvedWorld()
    placePod(next, 12, 10)
    next.exploration.springFound = true
    renderer.setWorld(next)
    for (let y = 9; y <= 11; y++) for (let x = 5; x < 15; x++) if (next.tiles[y][x] === TILE.SOIL) dig(next, x, y)
    const second = placePod(next, 7, 10)!
    renderer.refreshPods()
    renderer.refreshFriends(second.id)
    // 入场前：新舱两位站在大厅，老住户还在床上
    expect(view.friends.map((friend) => friend.pose)).toEqual(['rest', 'rest', 'idle', 'idle'])
    const firstBedX = view.friends[0].view.x

    const settled = vi.fn()
    renderer.playPodEntrance(second, settled)
    for (let i = 0; i < 240; i++) view.tick({ deltaMS: 16 } as Ticker)
    expect(settled).toHaveBeenCalledTimes(1)
    const beds = bedSlots(second)
    expect(view.friends[0].view.x).toBeCloseTo(firstBedX, 5)
    view.friends.slice(2).forEach((friend, i) => {
      expect(friend.pose).toBe('rest')
      expect(Math.abs(friend.view.x - beds[i].x)).toBeLessThanOrEqual(0.001)
    })
  })

  it('种植槽与水管：按档位画出不同外观，引水之后才出现水管', () => {
    const next = carvedWorld()
    placePod(next, 12, 10)
    next.exploration.springFound = true
    for (let y = 9; y <= 11; y++) for (let x = 5; x < 11; x++) if (next.tiles[y][x] === TILE.SOIL) dig(next, x, y)
    next.farm.planters.push(
      { id: 1, x: 6, y: 11, growth: 0 },
      { id: 2, x: 7, y: 11, growth: 1 },
      { id: 3, x: 8, y: 11, growth: 2 },
      { id: 4, x: 9, y: 11, growth: 3 },
    )
    renderer.setWorld(next)
    // 还没引水：只有四个槽，没有水管
    expect(view.farmLayer.children).toHaveLength(4)

    next.farm.waterSupplied = true
    renderer.refreshFarm()
    expect(view.farmLayer.children).toHaveLength(5)

    // 四个档位画的不是同一套图形（造型按档位变化）
    const shapes = view.farmLayer.children.slice(1).map((child) => {
      const g = child.children[0] as unknown as { context: { instructions: unknown[] } }
      return g.context.instructions.length
    })
    expect(shapes).toHaveLength(4)
    expect(new Set(shapes).size).toBeGreaterThan(1)
  })

  it('两间舱的存档重新载入：四位伙伴各自睡在自己的舱里', () => {
    const next = carvedWorld()
    placePod(next, 12, 10)
    next.exploration.springFound = true
    for (let y = 9; y <= 11; y++) for (let x = 5; x < 15; x++) if (next.tiles[y][x] === TILE.SOIL) dig(next, x, y)
    placePod(next, 7, 10)
    renderer.setWorld(next)
    expect(view.podEntrance).toBeNull()
    expect(view.podLayer.children).toHaveLength(2)
    expect(view.friends).toHaveLength(4)
    const first = bedSlots(next.pods[0])
    const second = bedSlots(next.pods[1])
    expect(view.friends.map((friend) => friend.pose)).toEqual(['rest', 'rest', 'rest', 'rest'])
    expect(view.friends[0].view.x).toBeCloseTo(first[0].x, 5)
    expect(view.friends[1].view.x).toBeCloseTo(first[1].x, 5)
    expect(view.friends[2].view.x).toBeCloseTo(second[0].x, 5)
    expect(view.friends[3].view.x).toBeCloseTo(second[1].x, 5)
  })
  })
})
