import { Assets, type Texture } from 'pixi.js'
import crystalUrl from '../assets/art/landmarks/energy-crystal-v1.png'

/** 画布显示高48px，留白内的实际晶体约46px；不改变32px世界网格。 */
export const CRYSTAL_DISPLAY_HEIGHT = 48

export async function loadCrystalTexture(): Promise<Texture> {
  const texture = await Assets.load<Texture>(crystalUrl)
  texture.source.scaleMode = 'linear'
  texture.source.autoGenerateMipmaps = true
  return texture
}
