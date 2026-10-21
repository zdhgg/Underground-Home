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

/** 基础客厅最多占5×3格；窄洞室等比缩小，旧宽房间也不把家具横向拉长。 */
export function drawLounge(textures: LoungeTextures, x: number, y: number, width: number, height: number): Container {
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
  return view
}
