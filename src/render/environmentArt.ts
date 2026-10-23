import { Assets, type Texture } from 'pixi.js'
import springUrl from '../assets/art/environment/spring-v1.png'
import planterUrl from '../assets/art/environment/planter-v1.png'
import barrelUrl from '../assets/art/environment/barrel-v1.png'
import emptyPlanterUrl from '../assets/art/environment/planter-empty-v1.png'

export interface EnvironmentTextures {
  spring: Texture
  planter: Texture
  barrel: Texture
  emptyPlanter?: Texture
}

/** 第二层环境主体素材；失败时由调用方继续使用程序化备用画法。 */
export async function loadEnvironmentTextures(): Promise<EnvironmentTextures | null> {
  try {
    const [spring, planter, barrel, emptyPlanter] = await Promise.all([
      Assets.load<Texture>(springUrl), Assets.load<Texture>(planterUrl),
      Assets.load<Texture>(barrelUrl),
      Assets.load<Texture>(emptyPlanterUrl).catch(() => undefined),
    ])
    for (const texture of [spring, planter, barrel]) {
      texture.source.scaleMode = 'linear'
      texture.source.autoGenerateMipmaps = true
    }
    if (emptyPlanter) { emptyPlanter.source.scaleMode = 'linear'; emptyPlanter.source.autoGenerateMipmaps = true }
    return { spring, planter, barrel, emptyPlanter }
  } catch {
    console.warn('第二层环境素材加载失败，使用备用绘制。')
    return null
  }
}
