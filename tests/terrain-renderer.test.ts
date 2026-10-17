import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Container, Sprite, Text, Texture, TextureSource, type Graphics, type Ticker } from 'pixi.js'
import { placePod } from '../src/core/build'
import { dig } from '../src/core/dig'
import { createDigHistory } from '../src/core/history'
import { collectCrystal, repairCore } from '../src/core/interact'
import { createInitialWorld, LANDMARKS, SURFACE_Y, TILE, TILE_SIZE, type SleepPod } from '../src/core/world'
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
  podLayer: Container
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
  }[]
  refreshPods(): void
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
    const cell = view.tileSprites[9][16]
    for (const sprite of [cell.base, ...cell.edges.filter((edge) => edge.visible)]) {
      expect(sprite.width).toBe(TILE_SIZE)
      expect(sprite.height).toBe(TILE_SIZE)
      expect(sprite.anchor.x).toBe(0)
      expect(sprite.anchor.y).toBe(0)
      expect([sprite.x, sprite.y]).toEqual([16 * TILE_SIZE, 9 * TILE_SIZE])
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
    expect(view.tileSprites[10][7].edges.some((edge) => edge.visible)).toBe(false)
    expect(view.tileSprites[10][8].edges.some((edge) => edge.visible)).toBe(false)
    expect(dig(world, 8, 10).ok).toBe(true)
    renderer.refreshTerrain([{ x: 8, y: 10 }])
    expect(view.tileSprites[10][7].edges[1].visible).toBe(true)
    expect(view.tileSprites[10][7].edges[1].texture).toBe(art.rockEdges.right)
    expect(view.tileSprites[10][9].edges[3].visible).toBe(true)
    expect(view.tileSprites[10][9].edges[3].texture).toBe(art.soilEdges.left)
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

  describe('睡眠舱入场与休息', () => {
  function carvedWorld() {
    const next = createInitialWorld()
    next.progress = { crystalFound: true, crystalCollected: true, coreRepaired: true }
    for (let y = 8; y < 10; y++) for (let x = 12; x < 15; x++) dig(next, x, y)
    return next
  }

  it('载入带睡眠舱的存档时伙伴直接睡在床上，不重播入场', () => {
    const saved = carvedWorld()
    const pod = placePod(saved, 12, 8)!
    renderer.setWorld(saved)
    const beds = bedSlots(pod)
    expect(view.podEntrance).toBeNull()
    expect(view.friends).toHaveLength(2)
    view.friends.forEach((friend, i) => {
      expect(friend.pose).toBe('rest')
      expect(friend.bed).toEqual(beds[i])
      expect(friend.view.x).toBeCloseTo(beds[i].x, 5)
      expect(friend.view.y).toBeCloseTo(beds[i].y, 5)
      expect(friend.view.scale.x).toBeCloseTo(0.65, 5)
    })
  })

  it('建成刷新只重建舱体，伙伴仍留在避难所等待出发', () => {
    const next = carvedWorld()
    renderer.setWorld(next)
    const beforeY = view.friends[0].view.y
    placePod(next, 12, 8)
    renderer.refreshPods()
    expect(view.podEntrance).toBeNull()
    expect(view.friends[0].pose).toBe('idle')
    expect(view.friends[0].view.y).toBe(beforeY)
    expect(view.podLayer.children).toHaveLength(1)
  })

  it('建成后沿空洞通道走到舱门，钻进被窝才触发庆祝回调', () => {
    const next = carvedWorld()
    renderer.setWorld(next)
    const pod = placePod(next, 12, 8)!
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
  })
})
