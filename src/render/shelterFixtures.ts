import { Assets, Container, Sprite, type Texture } from 'pixi.js'
import { HOME_FLOOR_Y, LANDMARKS, TILE_SIZE } from '../core/world'
import ladderUrl from '../assets/art/landmarks/shaft-ladder-v1.png'
import lampUrl from '../assets/art/landmarks/ceiling-lamp-v1.png'

export interface ShelterFixtureTextures {
  ladder: Texture
  lamp: Texture
}

/** 沿用原7盏顶灯的坐标；灯具与程序化光晕共用，避免错位。 */
export const LAMP_LOCATIONS = Array.from({ length: 7 }, (_, i) => ({
  x: (17.1 + i * 1.15) * TILE_SIZE,
  y: 7.35 * TILE_SIZE,
}))
export const LAMP_DISPLAY_WIDTH = 32
export const LAMP_LENS_ANCHOR = { x: 0.5, y: 0.59 } as const

export async function loadShelterFixtureTextures(): Promise<ShelterFixtureTextures> {
  const [ladder, lamp] = await Promise.all([
    Assets.load<Texture>(ladderUrl), Assets.load<Texture>(lampUrl),
  ])
  for (const texture of [ladder, lamp]) {
    texture.source.scaleMode = 'linear'
    texture.source.autoGenerateMipmaps = true
  }
  return { ladder, lamp }
}

/** 静态结构仅创建一次，位于黑暗遮罩之下；逐帧点灯不重建这些精灵。 */
export function createShelterFixtures(textures: ShelterFixtureTextures): { view: Container; lamps: Sprite[] } {
  const view = new Container()
  const lamps: Sprite[] = []
  const ladder = new Sprite(textures.ladder)
  ladder.anchor.set(0.5, 0)
  ladder.position.set(
    (LANDMARKS.shaft.x + LANDMARKS.shaft.w / 2) * TILE_SIZE,
    LANDMARKS.shaft.y * TILE_SIZE,
  )
  ladder.scale.set((LANDMARKS.shaft.h + 1) * TILE_SIZE / textures.ladder.height)
  view.addChild(ladder)
  // 同一梯架接到已有大厅地面：原梯架只到大厅上部，开场下梯不能凭空落地。
  const extension = new Sprite(textures.ladder)
  extension.label = 'entrance-ladder-extension'
  extension.anchor.set(.5, 0)
  extension.position.set(ladder.x, (LANDMARKS.shaft.y + LANDMARKS.shaft.h + 1) * TILE_SIZE - 4)
  extension.width = ladder.width
  extension.height = HOME_FLOOR_Y * TILE_SIZE - extension.y
  view.addChild(extension)

  for (const point of LAMP_LOCATIONS) {
    const lamp = new Sprite(textures.lamp)
    lamp.anchor.copyFrom(LAMP_LENS_ANCHOR)
    lamp.position.copyFrom(point)
    lamp.scale.set(LAMP_DISPLAY_WIDTH / textures.lamp.width)
    lamp.tint = 0x666666
    view.addChild(lamp)
    lamps.push(lamp)
  }
  return { view, lamps }
}
