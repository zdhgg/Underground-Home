import { Assets, Container, Graphics, Sprite, type Texture } from 'pixi.js'
import shellUrl from '../assets/art/rooms/lounge-shell-v1.png'
import furnitureUrl from '../assets/art/rooms/lounge-furniture-v1.png'

export interface LoungeTextures { shell: Texture; furniture: Texture }

export async function loadLoungeTextures(): Promise<LoungeTextures> {
  const [shell, furniture] = await Promise.all([Assets.load<Texture>(shellUrl), Assets.load<Texture>(furnitureUrl)])
  for (const texture of [shell, furniture]) {
    texture.source.scaleMode = 'linear'
    texture.source.autoGenerateMipmaps = true
  }
  return { shell, furniture }
}

/**
 * 客厅"住过"的痕迹：一起坐下过一次铺上地毯，两次之后再添一盆花。
 * 坐标相对洞室外壳（宽 w、高 h），地图与建造卡可以共用同一套位置。
 */
export function loungeComfortProps(w: number, h: number, rests: number): Container | null {
  if (rests < 1) return null
  const props = new Container()
  props.label = 'lounge-comfort'
  const rug = new Graphics()
  rug.label = 'lounge-rug'
  const left = w * .13, top = h * .845, rugW = w * .46, rugH = h * .115
  rug.roundRect(left, top, rugW, rugH, 4).fill({ color: 0xb9543f, alpha: .62 })
  rug.roundRect(left + 3, top + 3, rugW - 6, rugH - 6, 3).stroke({ width: 1, color: 0xf0c98a, alpha: .55 })
  props.addChild(rug)
  if (rests >= 2) {
    const plant = new Graphics()
    plant.label = 'lounge-plant'
    const px = w * .88, base = h * .80
    plant.roundRect(px - 5, base - 8, 10, 9, 2).fill(0x9a5f42)
    plant.moveTo(px, base - 8).lineTo(px, base - 19).stroke({ width: 1.5, color: 0x4f7a48 })
    for (const [dx, dy, r] of [[-4, -13, 4], [4, -15, 4], [0, -20, 4.5]] as const) {
      plant.circle(px + dx, base + dy, r).fill({ color: 0x5d9a56, alpha: .95 })
    }
    props.addChild(plant)
  }
  return props
}

/**
 * 基础客厅最多占5×3格；窄洞室等比缩小，旧宽房间也不把家具横向拉长。
 * `rests` 越大，客厅越"住过"：一起坐下过一次铺上地毯，两次之后再添一盆花。
 */
export function drawLounge(textures: LoungeTextures, x: number, y: number, width: number, height: number, rests = 0): Container {
  const view = new Container()
  view.label = 'lounge-art'
  const w = Math.min(width, height * 5 / 3), h = w * 3 / 5
  view.position.set(x + (width - w) / 2, y + height - h)
  const shell = new Sprite(textures.shell)
  shell.label = 'lounge-shell'; shell.width = w; shell.height = h
  const light = new Graphics()
  light.label = 'lounge-light'
  light.ellipse(w / 2, h * .24, w * .12, h * .18).fill({ color: 0xffcf79, alpha: .12 })
  const furniture = new Sprite(textures.furniture)
  furniture.label = 'lounge-furniture'
  furniture.width = w * .76; furniture.height = w * .76 / 3
  furniture.position.set(w * .12, h * .82 - furniture.height)
  view.addChild(shell, light, furniture)
  const comfort = loungeComfortProps(w, h, rests)
  if (comfort) view.addChild(comfort)
  return view
}
