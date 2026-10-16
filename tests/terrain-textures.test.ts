import { afterEach, describe, expect, it, vi } from 'vitest'
import { Assets, Texture, TextureSource } from 'pixi.js'
import { loadTerrainTextures } from '../src/render/terrainTextures'

afterEach(() => vi.restoreAllMocks())

describe('地形资源加载', () => {
  it('加载本批16张PNG，配置linear过滤、mipmap与洞穴平铺采样', async () => {
    // 生产加载器逐张传入URL；断言匹配该重载（Assets.load 还支持批量字典返回）。
    const load = vi.spyOn(Assets, 'load').mockImplementation((async () => (
      new Texture({ source: new TextureSource({ width: 64, height: 64 }) })
    )) as typeof Assets.load)
    const art = await loadTerrainTextures()
    expect(load).toHaveBeenCalledTimes(16)
    expect(new Set(load.mock.calls.map(([url]) => url)).size).toBe(16)
    const all = [...art.soil, ...art.rock, art.caveBg, ...Object.values(art.soilEdges), ...Object.values(art.rockEdges), art.surfaceGrass]
    expect(new Set(all).size).toBe(16)
    for (const tex of all) {
      expect(tex.source.scaleMode).toBe('linear')
      expect(tex.source.autoGenerateMipmaps).toBe(true)
    }
    expect(art.caveBg.source.addressMode).toBe('repeat')
  })

  it('素材加载失败会抛给现有初始化错误反馈，不静默使用缺失纹理', async () => {
    vi.spyOn(Assets, 'load').mockRejectedValue(new Error('missing PNG'))
    await expect(loadTerrainTextures()).rejects.toThrow('missing PNG')
  })
})
