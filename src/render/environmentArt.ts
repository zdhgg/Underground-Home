import { Assets, type Texture } from 'pixi.js'
import springUrl from '../assets/art/environment/spring-v1.png'
import planterUrl from '../assets/art/environment/planter-v1.png'
import barrelUrl from '../assets/art/environment/barrel-v1.png'
import mossUrl from '../assets/art/environment/moss-v1.png'

export interface EnvironmentTextures {
  spring: Texture
  planter: Texture
  barrel: Texture
  moss: Texture
}

/** 第二层环境主体素材；失败时由调用方继续使用程序化备用画法。 */
export async function loadEnvironmentTextures(): Promise<EnvironmentTextures | null> {
  try {
    const [spring, planter, barrel, moss] = await Promise.all([
      Assets.load<Texture>(springUrl), Assets.load<Texture>(planterUrl),
      Assets.load<Texture>(barrelUrl), Assets.load<Texture>(mossUrl),
    ])
    for (const texture of [spring, planter, barrel, moss]) {
      texture.source.scaleMode = 'linear'
      texture.source.autoGenerateMipmaps = true
    }
    return { spring, planter, barrel, moss }
  } catch {
    console.warn('第二层环境素材加载失败，使用备用绘制。')
    return null
  }
}
