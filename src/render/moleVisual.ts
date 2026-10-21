import { Assets, Container, Graphics, Rectangle, Sprite, Texture } from 'pixi.js'
import idleUrl from '../assets/art/characters/atu-idle-v1.png'
import blinkUrl from '../assets/art/characters/atu-blink-v1.png'
import digSideUrl from '../assets/art/characters/atu-dig-side-v1.png'
import digUpUrl from '../assets/art/characters/atu-dig-up-v1.png'

export interface MoleTextures { idle: Texture; blink: Texture; rest: Texture; digSide?: Texture; digUp?: Texture }
export type MolePose = 'idle' | 'walk' | 'climb' | 'rest' | 'work'
/** 单次挖土的局部时间，与世界时间、走路和挥镐分开。 */
export interface MoleDigPose { elapsed: number; raised: boolean; overhead: boolean }

/** 视觉可超出原来的 26px 身体；脚底仍在原中心下方 13px，不改任何格子和路径。 */
export const MOLE_HEIGHT = 40
export const MOLE_FOOT_Y = 13

/** 新角色素材缺失时仍能玩：大厅和探索同时退回原程序造型。 */
export async function loadMoleTextures(): Promise<MoleTextures | null> {
  try {
    const optionalPose = (url: string) => Assets.load<Texture>(url).catch(error => {
      console.warn('阿土挖土姿势未能加载，使用原造型的身体动作。', error)
      return undefined
    })
    const [idle, blink, digSide, digUp] = await Promise.all([
      Assets.load<Texture>(idleUrl), Assets.load<Texture>(blinkUrl), optionalPose(digSideUrl), optionalPose(digUpUrl),
    ])
    for (const texture of [idle, blink, digSide, digUp]) {
      if (!texture) continue
      texture.source.scaleMode = 'linear'
      texture.source.autoGenerateMipmaps = true
    }
    // 睡眠只露头部；复用闭眼图片的 GPU 纹理，不另下载图片。
    const left = Math.round(blink.width * 0.12)
    const rest = new Texture({
      source: blink.source,
      frame: new Rectangle(left, 0, blink.width - left, Math.round(blink.height * 0.53)),
    })
    return { idle, blink, rest, digSide, digUp }
  } catch (error) {
    console.warn('阿土图片未能加载，使用备用造型。', error)
    return null
  }
}

/** 大厅与探索共用的阿土。只接受姿态，不读取、修改世界或驱动任务。 */
export class MoleVisual {
  readonly view = new Container()
  private readonly shadow = new Graphics()
  private readonly figure = new Container()
  private readonly sprite: Sprite
  private readonly quilt = new Graphics()
  private facing = 1

  constructor(private readonly textures: MoleTextures) {
    this.shadow.ellipse(0, MOLE_FOOT_Y - 0.6, 11, 2).fill({ color: 0x08151a, alpha: 0.2 })
    this.sprite = new Sprite(textures.idle)
    this.sprite.label = 'atu-sprite'
    this.figure.addChild(this.sprite)
    this.quilt.roundRect(-12, -1, 24, 13, 5).fill(0xf3dfb6).stroke({ width: 1.2, color: 0xa9886b })
    this.quilt.label = 'atu-quilt'
    this.quilt.moveTo(-9, 2).lineTo(9, 2).stroke({ width: 1, color: 0xfff4d7 })
    this.view.addChild(this.shadow, this.figure, this.quilt)
    this.update(0, 'idle')
  }

  face(deltaX: number): void {
    if (Math.abs(deltaX) > 0.01) this.facing = deltaX < 0 ? -1 : 1
  }

  get direction(): number { return this.facing }

  update(time: number, pose: MolePose, light = 1): void {
    this.updatePose(time, pose, light)
  }

  dig(time: number, pose: MoleDigPose, light = 1): void {
    this.updatePose(time, 'work', light, pose)
  }

  private updatePose(time: number, pose: MolePose, light: number, dig: MoleDigPose | null = null): void {
    const resting = pose === 'rest'
    const moving = pose === 'walk' || pose === 'climb'
    const blink = !moving && pose !== 'work' && time % 4.7 > 4.54
    // 整帧替换原有双手，绝不在含双手的站姿图片上再叠加一条手臂。
    const digging = pose === 'work' ? dig : null
    const extended = digging && digging.elapsed >= .1 && digging.elapsed < .36
    const digTexture = extended ? digging.raised ? this.textures.digUp : this.textures.digSide : undefined
    this.sprite.texture = digTexture ?? (resting ? this.textures.rest : blink ? this.textures.blink : this.textures.idle)
    const height = digTexture ? MOLE_HEIGHT * 1.25 : resting ? 28 : MOLE_HEIGHT
    this.sprite.height = height
    this.sprite.scale.x = this.sprite.scale.y
    // 施工帧统一512×640画布，脚底在630px；头部/身体保持站姿的40px比例。
    this.sprite.anchor.set(0.5, digTexture ? 630 / 640 : resting ? 0.5 : 1)
    this.sprite.position.set(0, resting ? -3 : MOLE_FOOT_Y)
    // 内部容器围绕脚底呼吸，名字标签、实际落点和外部入舱缩放都不被拉伸。
    this.figure.pivot.y = MOLE_FOOT_Y
    this.figure.position.set(0, MOLE_FOOT_Y - (moving ? Math.abs(Math.sin(time * 11)) * 1.1 : 0))
    this.figure.scale.set(this.facing, 1 + Math.sin(time * (moving ? 11 : 2.2)) * (moving ? 0.025 : 0.012))
    this.figure.rotation = pose === 'work' ? -0.035 : moving ? Math.sin(time * 11) * 0.035 : 0
    if (digging) {
      const reach = extended ? Math.max(0, Math.sin(Math.PI * (digging.elapsed - .1) / .3)) : 0
      const windup = Math.sin(Math.PI * Math.min(1, digging.elapsed / .45))
      this.figure.scale.y = digging.overhead && digTexture ? 1 + .2 * reach : 1 - .035 * windup * (1 - reach)
      this.figure.rotation = this.facing * (extended
        ? digging.overhead ? 0 : digging.raised ? .075 * reach : -.14 + .06 * reach
        : -.07 * windup)
    }
    const brightness = Math.round(255 * (0.84 + 0.16 * Math.max(0, Math.min(1, light))))
    this.figure.tint = brightness * 0x010101
    this.quilt.visible = resting
    this.shadow.visible = !resting && pose !== 'climb'
  }
}
