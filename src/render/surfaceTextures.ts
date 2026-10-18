import { Assets, type Texture } from 'pixi.js'
import horizonUrl from '../assets/art/surface/storm-horizon-v1.png'
import woodlandUrl from '../assets/art/surface/windwood-snow-v1.png'
import entranceUrl from '../assets/art/surface/shelter-mouth-snow-v1.png'

export interface SurfaceTextures {
  horizon: Texture | null
  woodland: Texture | null
  entrance: Texture | null
}

/** 地表是装饰层；单张图失败不能阻止家园启动，也不影响其他地表素材。 */
export async function loadSurfaceTextures(): Promise<SurfaceTextures> {
  const load = async (url: string): Promise<Texture | null> => {
    try {
      const texture = await Assets.load<Texture>(url)
      texture.source.scaleMode = 'linear'
      texture.source.autoGenerateMipmaps = true
      return texture
    } catch {
      console.warn('地表装饰加载失败，使用备用景色。')
      return null
    }
  }
  const [horizon, woodland, entrance] = await Promise.all([
    load(horizonUrl), load(woodlandUrl), load(entranceUrl),
  ])
  return { horizon, woodland, entrance }
}
