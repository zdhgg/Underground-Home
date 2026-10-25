import { Assets, Rectangle, Texture } from 'pixi.js'
import workshop from '../assets/art/deep/workshop-v1.png'
import rig from '../assets/art/deep/crystal-rig-v1.png'
import lift from '../assets/art/deep/lift-v1.png'
import ayan from '../assets/art/deep/ayan-v1.png'
export const DEEP_ART_URLS = { workshop, rig, lift, ayan }
export type DeepTextures = Partial<Record<'workshop' | 'furnace' | 'collector' | 'distributor' | 'lift' | 'ayan', Texture>>
const crop = (t: Texture, x: number, y: number, w: number, h: number) => new Texture({ source: t.source, frame: new Rectangle(Math.round(t.width * x), Math.round(t.height * y), Math.floor(t.width * w), Math.floor(t.height * h)) })
export async function loadDeepTextures(): Promise<DeepTextures> {
  const result: DeepTextures = {}
  await Promise.all(Object.entries(DEEP_ART_URLS).map(async ([key, url]) => {
    try {
      const t = await Assets.load<Texture>(url)
      t.source.scaleMode = 'linear'; t.source.autoGenerateMipmaps = true
      if (key === 'workshop') { result.workshop = crop(t, 0, .1, .7, .89); result.furnace = crop(t, .71, 0, .28, .99) }
      if (key === 'rig') { result.collector = crop(t, 0, 0, .63, 1); result.distributor = crop(t, .69, .4, .3, .59) }
      if (key === 'lift') result.lift = t
      if (key === 'ayan') result.ayan = t
    } catch { console.warn(`晶簇层 ${key} 素材未加载，使用备用绘制。`) }
  }))
  return result
}
