import { Assets, Sprite, type Texture } from 'pixi.js'
import shellUrl from '../assets/art/rooms/nest-shell-v1.png'
import bunksUrl from '../assets/art/rooms/nest-bunks-v1.png'

export interface NestTextures { shell: Texture; bunks: Texture }

/** 与地形共用资源缓存；场景刷新只销毁精灵，不销毁共享纹理。 */
export async function loadNestTextures(): Promise<NestTextures> {
  const [shell, bunks] = await Promise.all([Assets.load<Texture>(shellUrl), Assets.load<Texture>(bunksUrl)])
  for (const texture of [shell, bunks]) {
    texture.source.scaleMode = 'linear'
    texture.source.autoGenerateMipmaps = true
  }
  return { shell, bunks }
}

export function nestShell(texture: Texture, x: number, y: number, size: number): Sprite {
  const sprite = new Sprite(texture)
  sprite.label = 'nest-shell'
  sprite.position.set(x, y); sprite.width = size; sprite.height = size
  return sprite
}
