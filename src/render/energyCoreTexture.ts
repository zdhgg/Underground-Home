import { Assets, type Texture } from 'pixi.js'
import energyCoreBodyUrl from '../assets/art/landmarks/energy-core-body-v1.png'

/** 保持源图比例，显示宽128px；槽心位于源图(50%, 46%)。 */
export const ENERGY_CORE_DISPLAY_WIDTH = 128
export const ENERGY_CORE_SOCKET_ANCHOR = { x: 0.5, y: 0.46 } as const

/** 只加载固定机身；状态灯、光晕与启动演出仍由原渲染逻辑绘制。 */
export async function loadEnergyCoreTexture(): Promise<Texture> {
  const texture = await Assets.load<Texture>(energyCoreBodyUrl)
  texture.source.scaleMode = 'linear'
  texture.source.autoGenerateMipmaps = true
  return texture
}
