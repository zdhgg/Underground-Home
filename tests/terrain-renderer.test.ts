import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Container, Sprite, Text, Texture, TextureSource, type Graphics } from 'pixi.js'
import { dig } from '../src/core/dig'
import { createDigHistory } from '../src/core/history'
import { collectCrystal, repairCore } from '../src/core/interact'
import { createInitialWorld, LANDMARKS, SURFACE_Y, TILE, TILE_SIZE } from '../src/core/world'
import { PixiWorldRenderer } from '../src/render/PixiRenderer'
import { loadTerrainTextures, type TerrainTextures } from '../src/render/terrainTextures'
import { loadEnergyCoreTexture } from '../src/render/energyCoreTexture'

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
})
