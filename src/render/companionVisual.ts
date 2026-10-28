import linglingUrl from '../assets/art/ventilation/lingling-v1.png'
import tuantuanUrl from '../assets/art/reservoir/tuantuan-v1.png'
import taitaiUrl from '../assets/art/garden/taitai-v2.png'
import { Assets, Container, Graphics, Rectangle, Sprite, Texture } from 'pixi.js'
import type { MolePose } from './moleVisual'
import adengIdleUrl from '../assets/art/characters/adeng-idle-v1.png'
import adengBlinkUrl from '../assets/art/characters/adeng-blink-v1.png'
import xiaomanIdleUrl from '../assets/art/characters/xiaoman-idle-v1.png'
import xiaomanBlinkUrl from '../assets/art/characters/xiaoman-blink-v1.png'
import xiaoquanIdleUrl from '../assets/art/characters/xiaoquan-idle-v1.png'
import xiaoquanBlinkUrl from '../assets/art/characters/xiaoquan-blink-v1.png'
import ayanUrl from '../assets/art/deep/ayan-v1.png'
import amuUrl from '../assets/art/deep/amu-v1.png'

export type CompanionId = 'adeng' | 'xiaoman' | 'xiaoquan' | 'ayan' | 'amu' | 'taitai' | 'tuantuan' | 'lingling'
export interface CompanionTextures { idle: Texture; blink: Texture; rest: Texture }
export type CompanionArt = Partial<Record<CompanionId, CompanionTextures | null>>

/** 大厅伙伴只接受画面状态，不读取世界、任务或存档。阿土也满足这个接口。 */
export interface CharacterVisual {
  readonly view: Container
  readonly nameY?: number
  face(deltaX: number): void
  harvestLean?(amount: number, direction: number): void
  update(time: number, pose: MolePose, light?: number, hidden?: boolean): void
}

/** 头部裁切比例只用于睡眠；三种不同轮廓不共用同一个圆形身体。 */
const STYLES = {
  lingling: { height:43,restHeight:29,restY:-7,head:[.22,0,.64,.64],urls:[linglingUrl,linglingUrl] },
  adeng: { height: 36, restHeight: 28, restY: -8, head: [0.42, 0, 0.58, 0.56], urls: [adengIdleUrl, adengBlinkUrl] },
  xiaoman: { height: 44, restHeight: 32, restY: -11, head: [0, 0, 1, 0.59], urls: [xiaomanIdleUrl, xiaomanBlinkUrl] },
  xiaoquan: { height: 40, restHeight: 28, restY: -3, head: [0.33, 0, 0.67, 0.45], urls: [xiaoquanIdleUrl, xiaoquanBlinkUrl] },
  ayan: { height: 43, restHeight: 29, restY: -7, head: [.4, 0, .6, .5], urls: [ayanUrl, ayanUrl] },
  tuantuan: { height: 43, restHeight: 29, restY: -6, head: [.3, 0, .7, .62], urls: [tuantuanUrl, tuantuanUrl] },
  taitai: { height: 38, restHeight: 26, restY: -5, head: [0, 0, 1, 1], urls: [taitaiUrl, taitaiUrl] },
  amu: { height: 44, restHeight: 30, restY: -7, head: [0, 0, .6, .5], urls: [amuUrl, amuUrl] },
} as const

async function loadCompanion(id: CompanionId): Promise<CompanionTextures | null> {
  try {
    const [idle, blink] = await Promise.all(STYLES[id].urls.map((url) => Assets.load<Texture>(url)))
    for (const texture of [idle, blink]) {
      texture.source.scaleMode = 'linear'
      texture.source.autoGenerateMipmaps = true
    }
    const [x, y, w, h] = STYLES[id].head
    const left = Math.round(blink.width * x), top = Math.round(blink.height * y)
    const rest = new Texture({
      source: blink.source,
      frame: new Rectangle(left, top, Math.min(blink.width - left, Math.round(blink.width * w)), Math.min(blink.height - top, Math.round(blink.height * h))),
    })
    return { idle, blink, rest }
  } catch (error) {
    console.warn(`${id}图片未能加载，使用备用造型。`, error)
    return null
  }
}

/** 按角色单独回退：一位的图片失败不会影响另两位或阻止游戏启动。 */
export async function loadCompanionTextures(): Promise<CompanionArt> {
  const [adeng, xiaoman, xiaoquan, ayan, amu, taitai, tuantuan, lingling] = await Promise.all([
    loadCompanion('adeng'), loadCompanion('xiaoman'), loadCompanion('xiaoquan'),
    loadCompanion('ayan'), loadCompanion('amu'), loadCompanion('taitai'), loadCompanion('tuantuan'), loadCompanion('lingling'),
  ])
  return { adeng, xiaoman, xiaoquan, ayan, amu, taitai, tuantuan, lingling }
}

export function createCompanionVisual(id: string, art: CompanionArt): CompanionVisual | null {
  if (id !== 'adeng' && id !== 'xiaoman' && id !== 'xiaoquan' && id !== 'ayan' && id !== 'amu' && id !== 'taitai' && id !== 'tuantuan' && id !== 'lingling') return null
  const textures = art[id]
  return textures ? new CompanionVisual(id, textures) : null
}

/** 阿灯漂浮与尾光、小满轻跳、小泉轻摇；动作都在原路径的落点内部表现。 */
export class CompanionVisual implements CharacterVisual {
  readonly view = new Container()
  readonly nameY: number
  private readonly figure = new Container()
  private readonly sprite: Sprite
  private readonly shadow = new Graphics()
  private readonly quilt = new Graphics()
  private readonly tailLight = new Graphics()
  private facing = 1

  constructor(readonly id: CompanionId, private readonly textures: CompanionTextures) {
    this.nameY = 13 - STYLES[id].height - 11
    this.sprite = new Sprite(textures.idle)
    this.sprite.label = `${id}-sprite`
    this.figure.label = `${id}-figure`
    this.quilt.label = `${id}-quilt`
    this.tailLight.label = `${id}-tail-light`
    this.figure.addChild(this.sprite)
    this.shadow.ellipse(0, 12.4, 10, 1.8).fill({ color: 0x08151a, alpha: 0.18 })
    this.quilt.roundRect(-12, -1, 24, 13, 5).fill(id === 'xiaoman' ? 0xe9c3b5 : 0xf3dfb6).stroke({ width: 1.2, color: 0xa9886b })
    this.quilt.moveTo(-9, 2).lineTo(9, 2).stroke({ width: 1, color: 0xfff4d7 })
    this.view.addChild(this.shadow, this.figure, this.quilt, this.tailLight)
    this.update(0, 'idle')
  }

  face(deltaX: number): void {
    if (Math.abs(deltaX) > 0.01) this.facing = deltaX < 0 ? -1 : 1
  }

  /** 以脚边为支点轻轻俯身；每帧基础姿势先由 update 重置。 */
  harvestLean(amount: number, direction: number): void {
    if (this.id !== 'xiaoman') return
    this.figure.position.x = direction * amount * 2
    this.figure.rotation = direction * amount * .16
  }

  update(time: number, pose: MolePose, light = 1, hidden = false): void {
    const resting = pose === 'rest'
    const moving = pose === 'walk' || pose === 'climb'
    const flying = this.id === 'adeng' && !resting && !hidden
    const blink = !moving && time % 4.7 > 4.54
    this.sprite.texture = resting ? this.textures.rest : blink ? this.textures.blink : this.textures.idle
    this.sprite.height = resting ? STYLES[this.id].restHeight : STYLES[this.id].height
    this.sprite.scale.x = this.sprite.scale.y
    this.sprite.anchor.set(0.5, resting ? 0.5 : 1)
    // 触角和兔耳占据头图上半部，睡眠时分别抬高，避免眼睛被被子遮住。
    this.sprite.position.set(0, resting ? STYLES[this.id].restY : 13)
    this.figure.pivot.y = 13
    // 阿木只有一张站姿图，单纯移动外层容器会看起来像“平移”。
    // 给他一个更明确的左右换步、抬脚和身体起伏，让路径移动能被看成行走。
    const gait = moving && this.id === 'amu' ? Math.sin(time * 10.5) : 0
    const hop = moving && this.id === 'xiaoman' ? Math.abs(Math.sin(time * 10)) * 2.5
      : moving && this.id === 'amu' ? Math.abs(gait) * 2.2
      : 0
    const float = flying ? 2 + Math.sin(time * 2.5) * 1.5 : 0
    this.figure.position.set(gait * 1.35, 13 - hop - float)
    // 阿木素材本身朝左，和其他伙伴的默认朝右素材相反；这里把逻辑朝向映射到实际贴图。
    const visualFacing = this.id === 'amu' ? -this.facing : this.facing
    this.figure.scale.set(visualFacing, 1 + (moving && this.id === 'amu' ? Math.abs(gait) * 0.04 : Math.sin(time * (moving ? 10 : 2)) * (moving ? 0.02 : 0.012)))
    this.figure.rotation = resting || hidden || this.id === 'taitai' ? 0 : moving && this.id === 'amu' ? gait * 0.09 : Math.sin(time * (moving ? 10 : 2)) * (moving ? 0.035 : flying ? 0.02 : 0.006)
    this.shadow.scale.set(moving && this.id === 'amu' ? 1 - Math.abs(gait) * 0.16 : 1, moving && this.id === 'amu' ? 1 + Math.abs(gait) * 0.08 : 1)
    this.shadow.visible = !resting && !hidden && !flying && pose !== 'climb'
    this.quilt.visible = resting
    this.drawTail(time, light, resting, hidden, float)
  }

  private drawTail(time: number, light: number, resting: boolean, hidden: boolean, float: number): void {
    const g = this.tailLight
    g.clear()
    if (this.id !== 'adeng' || hidden) return
    const x = resting ? 8 : -2 * this.facing
    const y = resting ? 7 : 7.5 - float
    const pulse = 0.5 + 0.5 * Math.sin(time * 2.6)
    const strength = 0.5 + 0.5 * light
    g.circle(x, y, resting ? 4 : 7).fill({ color: 0xe4f7a6, alpha: (0.06 + 0.06 * pulse) * strength })
    g.circle(x, y, resting ? 2 : 2.5).fill({ color: 0xf5ffd0, alpha: (0.65 + 0.25 * pulse) * strength })
  }
}
