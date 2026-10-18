import { afterEach, describe, expect, it, vi } from 'vitest'
import { Assets, Sprite, Texture, TextureSource } from 'pixi.js'
import { LANDMARKS, MAP_WIDTH, SURFACE_Y, TILE_SIZE } from '../src/core/world'
import { SurfaceScene, SURFACE_ENTRANCE } from '../src/render/surfaceScene'
import { loadSurfaceTextures } from '../src/render/surfaceTextures'
import { LIGHTNING_DURATION, LIGHTNING_PERIOD, snowflakeAt, stormAt } from '../src/render/surfaceWeather'

function texture(width: number, height: number): Texture {
  return new Texture({ source: new TextureSource({ width, height }) })
}

function scene() {
  return new SurfaceScene({ horizon: texture(2172, 724), woodland: texture(2172, 724), entrance: texture(1536, 1024) })
}

afterEach(() => vi.restoreAllMocks())

describe('风雪地表只负责渲染', () => {
  it('拖动、缩放与超宽全景时天空覆盖可见范围，入口与树根始终贴住原地图', () => {
    const surface = scene()
    const entrance = surface.view.getChildByLabel('surface-entrance') as Sprite
    const trees = surface.view.children.filter((child) => child.label === 'surface-woodland') as Sprite[]
    const fixed = [entrance, ...trees].map((child) => ({ x: child.x, y: child.y, width: child.width, height: child.height }))
    const horizon = surface.view.getChildByLabel('surface-sky')!.children.find((child) => child instanceof Sprite) as Sprite
    for (const [x, zoom, width] of [[-120, 2.2, 1200], [500, 2.2, 1200], [-300, 0.6, 1440], [-1000, 0.5, 1800]]) {
      surface.setCamera({ x, y: -120, zoom }, { width, height: 900 })
      expect(horizon.x).toBeLessThanOrEqual(x)
      expect(horizon.x + horizon.width).toBeGreaterThanOrEqual(x + width / zoom)
      expect(horizon.y + horizon.height).toBeCloseTo(SURFACE_Y * TILE_SIZE)
      surface.update(4.7)
      expect([entrance, ...trees].map((child) => ({ x: child.x, y: child.y, width: child.width, height: child.height }))).toEqual(fixed)
    }
    expect(entrance.x).toBe((LANDMARKS.shaft.x + LANDMARKS.shaft.w / 2) * TILE_SIZE)
    expect(entrance.width).toBe(SURFACE_ENTRANCE.width)
    // 生成入口55%的开口与现有两格竖井一致，图像保持原比例。
    expect(Math.abs(entrance.width * 0.55 - LANDMARKS.shaft.w * TILE_SIZE)).toBeLessThan(3)
    expect(entrance.width / entrance.height).toBe(1.5)
    surface.view.destroy({ children: true })
  })

  it('长期播放风雪与远雷不重建固定结构，前景雪有独立地表裁剪', () => {
    const surface = scene()
    const structures = [...surface.view.children]
    for (const t of [0, 4.7, 22.7, 40.7, 10000]) surface.update(t)
    expect(surface.view.children).toEqual(structures)
    const weather = surface.view.getChildByLabel('surface-weather')!
    expect(weather.mask).toBeTruthy()
    expect(weather.eventMode).toBe('none')
    expect(surface.view.eventMode).toBe('none')
    surface.view.destroy({ children: true })
  })

  it('全部地表图片缺失时仍能创建天空、树林与可辨认的入口', () => {
    const surface = new SurfaceScene({ horizon: null, woodland: null, entrance: null })
    surface.setCamera({ x: -120, y: -120, zoom: 0.6 }, { width: 1440, height: 900 })
    surface.update(4.7)
    expect(surface.view.getChildByLabel('surface-entrance-fallback')).not.toBeNull()
    expect(surface.view.getChildByLabel('surface-woodland-fallback')).not.toBeNull()
    expect(surface.view.getLocalBounds().width).toBeGreaterThan(MAP_WIDTH * TILE_SIZE)
    surface.view.destroy({ children: true })
  })
})

describe('表面风暴约束', () => {
  it('雪向右下移动且始终停在地表上方，长时间播放仍保持有限坐标', () => {
    for (const seconds of [0, 4.7, 100, 1e6]) {
      for (let i = 0; i < 125; i++) {
        const flake = snowflakeAt(i, seconds, -200, 2400)
        expect(flake.x).toBeGreaterThanOrEqual(-200)
        expect(flake.x).toBeLessThan(2200)
        expect(flake.y + flake.radius).toBeLessThan(SURFACE_Y * TILE_SIZE)
      }
    }
    const before = snowflakeAt(0, 0, 0, 100000)
    const after = snowflakeAt(0, 0.01, 0, 100000)
    expect(after.x).toBeGreaterThan(before.x)
    expect(after.y).toBeGreaterThan(before.y)
  })

  it('远雷18秒才出现一次，单次平滑淡入淡出，绝大多数时间无闪光', () => {
    expect(stormAt(0).lightning).toBe(0)
    expect(stormAt(4).lightning).toBe(0)
    expect(stormAt(4 + LIGHTNING_DURATION / 2).lightning).toBeCloseTo(1)
    expect(stormAt(4 + LIGHTNING_DURATION).lightning).toBeCloseTo(0)
    expect(stormAt(4.01).lightning).toBeLessThan(0.01)
    expect(stormAt(4 + LIGHTNING_PERIOD + LIGHTNING_DURATION / 2).boltX).not.toBe(stormAt(4.7).boltX)
    for (let seconds = 6; seconds < 22; seconds++) expect(stormAt(seconds).lightning).toBe(0)
  })
})

describe('地表素材降级', () => {
  it('一张素材加载失败不会拒绝初始化，其他图片仍保留线性过滤与mipmap', async () => {
    const horizon = texture(2172, 724)
    const entrance = texture(1536, 1024)
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const loader = Assets as { load: (url: string) => Promise<Texture> }
    vi.spyOn(loader, 'load').mockResolvedValueOnce(horizon).mockRejectedValueOnce(new Error('missing')).mockResolvedValueOnce(entrance)
    const art = await loadSurfaceTextures()
    expect(art).toEqual({ horizon, woodland: null, entrance })
    expect(horizon.source.scaleMode).toBe('linear')
    expect(entrance.source.autoGenerateMipmaps).toBe(true)
    expect(warn).toHaveBeenCalledTimes(1)
  })
})
