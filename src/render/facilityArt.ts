import { Assets, Container, Sprite, type Texture } from 'pixi.js'
import { FACILITY_ART, type FacilityKind } from './facilityArtSpec'

export type FacilityTextures = Partial<Record<FacilityKind, readonly Texture[]>>
/** 一类设施失败时只让该类使用备用画法，其他建筑仍可正常显示。 */
export async function loadFacilityTextures(): Promise<FacilityTextures> {
  const result: FacilityTextures = {}
  await Promise.all((Object.keys(FACILITY_ART) as FacilityKind[]).map(async kind => {
    try {
      const textures = await Promise.all(FACILITY_ART[kind].layers.map(layer => Assets.load<Texture>(layer.url)))
      for (const texture of textures) { texture.source.scaleMode = 'linear'; texture.source.autoGenerateMipmaps = true }
      result[kind] = textures
    } catch { console.warn(`${kind} 建筑图片加载失败，使用备用绘制。`) }
  }))
  return result
}

export function drawFacilityArt(textures: FacilityTextures, kind: FacilityKind, x: number, y: number, width: number, height: number): Container | null {
  const images = textures[kind], spec = FACILITY_ART[kind]
  if (!images || images.length !== spec.layers.length) return null
  const view = new Container({ label: `${kind}-art` })
  const w = Math.min(width, height * spec.aspect), h = w / spec.aspect
  view.position.set(x + (kind === 'garden' ? 0 : (width - w) / 2), y + height - h)
  spec.layers.forEach((layer, index) => {
    // 菜槽由现有种植系统按真实生长阶段绘制，不能在背景上再画一份。
    if (layer.role === 'planter') return
    const sprite = new Sprite(images[index])
    sprite.label = `${kind}-${layer.role}`
    sprite.position.set(layer.left * w, layer.top * h)
    sprite.width = layer.width * w; sprite.height = layer.height * h
    view.addChild(sprite)
  })
  return view
}
