import { Container, Graphics, Sprite, type Texture } from 'pixi.js'
import { CRYSTAL_DISPLAY_HEIGHT } from './crystalTexture'

interface Point { x: number; y: number }
type Phase = 'collect' | 'install' | null
export const CRYSTAL_INSTALL_DURATION = 0.7

/** 短暂的晶体演出：只接收坐标和时间，不读写世界、任务或存档。 */
export class CrystalFeedback {
  readonly view = new Container()
  private readonly trail = new Graphics()
  private readonly sprite: Sprite
  private readonly baseScale: number
  private phase: Phase = null
  private age = 0
  private from: Point = { x: 0, y: 0 }
  private to: Point = { x: 0, y: 0 }

  constructor(texture: Texture) {
    this.sprite = new Sprite(texture)
    this.sprite.anchor.set(0.5)
    this.baseScale = CRYSTAL_DISPLAY_HEIGHT / texture.height
    this.view.addChild(this.trail, this.sprite)
    this.reset()
  }

  get installing(): boolean { return this.phase === 'install' }

  playCollection(at: Point): void {
    this.start('collect', at, { x: at.x, y: at.y - 28 })
  }

  playInstallation(socket: Point): void {
    this.start('install', { x: socket.x - 60, y: socket.y + 26 }, socket)
  }

  reset(): void {
    this.phase = null
    this.age = 0
    this.view.visible = false
    this.trail.clear()
  }

  /** 安装完成只返回一次true，由调用方衔接原有启动演出；不用定时器。 */
  update(dt: number): boolean {
    if (!this.phase) return false
    const installing = this.installing
    const duration = installing ? CRYSTAL_INSTALL_DURATION : 0.45
    this.age = Math.min(duration, this.age + Math.max(0, dt))
    const p = this.age / duration
    const point = this.positionAt(p)
    this.sprite.position.copyFrom(point)
    this.sprite.scale.set(this.baseScale * (1 - (installing ? 0.8 : 0.55) * p))
    this.sprite.alpha = installing ? Math.min(1, (1 - p) * 6) : 1 - p
    this.trail.clear()
    if (installing) {
      for (let i = 0; i < 6; i++) {
        const a = this.positionAt(Math.max(0, p - (6 - i) * 0.035))
        const b = this.positionAt(Math.max(0, p - (5 - i) * 0.035))
        this.trail.moveTo(a.x, a.y).lineTo(b.x, b.y).stroke({
          width: 2.5, color: 0x8dedfd, alpha: (i + 1) / 8 * this.sprite.alpha,
        })
      }
    }
    if (p < 1) return false
    this.reset()
    return installing
  }

  private start(phase: Exclude<Phase, null>, from: Point, to: Point): void {
    this.reset()
    this.phase = phase
    this.from = { ...from }
    this.to = { ...to }
    this.view.visible = true
    this.sprite.position.copyFrom(from)
    this.sprite.scale.set(this.baseScale)
    this.sprite.alpha = 1
  }

  private positionAt(p: number): Point {
    const t = p * p * (3 - 2 * p)
    return {
      x: this.from.x + (this.to.x - this.from.x) * t,
      y: this.from.y + (this.to.y - this.from.y) * t - (this.installing ? Math.sin(Math.PI * p) * 18 : 0),
    }
  }
}
