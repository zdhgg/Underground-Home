import { Container, Graphics, Sprite } from 'pixi.js'
import { LANDMARKS, MAP_WIDTH, SURFACE_Y, TILE_SIZE as T } from '../core/world'
import type { Camera, Viewport } from './camera'
import type { SurfaceTextures } from './surfaceTextures'
import { SurfaceWeather, type SurfaceWeatherProfile } from './surfaceWeather'

const WIDTH = MAP_WIDTH * T
const GROUND = SURFACE_Y * T
const SHAFT_LEFT = LANDMARKS.shaft.x * T
const SHAFT_RIGHT = (LANDMARKS.shaft.x + LANDMARKS.shaft.w) * T
export const SURFACE_ENTRANCE = {
  x: (SHAFT_LEFT + SHAFT_RIGHT) / 2,
  y: GROUND + 3,
  width: 112,
  labelY: GROUND - 89,
} as const

function seed(i: number): number {
  const n = Math.sin(i * 127.1 + 31.7) * 43758.5453
  return n - Math.floor(n)
}

/**
 * 地表只读地图常量，不接收可变 WorldState。远景、植被、入口可独立替换；
 * 固定结构只建一次，更新只处理视差、受风摇摆和独立天气层。
 */
export class SurfaceScene {
  readonly view = new Container({ label: 'surface-scene', eventMode: 'none' })
  private readonly sky = new Container({ label: 'surface-sky' })
  private readonly weather = new SurfaceWeather()
  private readonly groundEdge = new Graphics({ label: 'surface-ground-edge' })
  private readonly entranceLight = new Graphics({ label: 'surface-entrance-light' })
  private readonly trees: { sprite: Sprite; phase: number }[] = []
  private readonly horizon: Sprite | null
  private readonly fallback = new Graphics()

  constructor(textures: SurfaceTextures) {
    this.horizon = textures.horizon ? new Sprite(textures.horizon) : null
    this.sky.addChild(this.fallback)
    if (this.horizon) this.sky.addChild(this.horizon)
    this.sky.addChild(this.weather.distant)
    this.view.addChild(this.sky)

    if (textures.woodland) {
      // 按原图比例摆三组树林，中间一组的留白正对入口。树根不随视差漂移。
      for (const [x, width, phase] of [[180, 660, 0], [SURFACE_ENTRANCE.x, 570, 1.8], [1260, 680, 3.7]]) {
        const sprite = new Sprite({ texture: textures.woodland, label: 'surface-woodland' })
        // 原图下方有透明留白，实际土边在第648行；用实测脚底对齐，避免树林悬空。
        sprite.anchor.set(0.5, 648 / 724)
        sprite.position.set(x, GROUND)
        sprite.scale.set(width / textures.woodland.width)
        this.view.addChild(sprite)
        this.trees.push({ sprite, phase })
      }
    } else {
      this.buildFallbackWoodland()
    }

    this.buildGroundEdge()
    this.view.addChild(this.groundEdge)
    const mouth = new Graphics({ label: 'surface-shaft-mouth' })
    mouth.rect(SHAFT_LEFT + 2, GROUND - 20, SHAFT_RIGHT - SHAFT_LEFT - 4, 24).fill(0x22313a)
    // 井口内的短梯接到已有地下梯架，不改变通路和点击判定。
    for (const x of [SURFACE_ENTRANCE.x - 13, SURFACE_ENTRANCE.x + 13]) {
      mouth.moveTo(x, GROUND - 19).lineTo(x, GROUND + 3).stroke({ color: 0x866334, width: 4 })
    }
    for (const y of [GROUND - 15, GROUND - 5]) {
      mouth.moveTo(SURFACE_ENTRANCE.x - 13, y).lineTo(SURFACE_ENTRANCE.x + 13, y).stroke({ color: 0xa58047, width: 3 })
    }
    this.view.addChild(mouth)
    if (textures.entrance) {
      const entrance = new Sprite({ texture: textures.entrance, label: 'surface-entrance' })
      entrance.anchor.set(0.5, 0.9)
      entrance.position.set(SURFACE_ENTRANCE.x, SURFACE_ENTRANCE.y)
      entrance.scale.set(SURFACE_ENTRANCE.width / textures.entrance.width)
      this.view.addChild(entrance)
    } else {
      const frame = new Graphics({ label: 'surface-entrance-fallback' })
      frame.roundRect(SHAFT_LEFT - 16, GROUND - 47, 16, 50, 3).fill(0x687a80)
      frame.roundRect(SHAFT_RIGHT, GROUND - 47, 16, 50, 3).fill(0x687a80)
      frame.roundRect(SHAFT_LEFT - 17, GROUND - 49, 98, 13, 3).fill(0x795e43)
      frame.roundRect(SHAFT_RIGHT + 3, GROUND - 30, 7, 10, 2).fill(0xffd28a)
      this.view.addChild(frame)
    }
    this.entranceLight.circle(SURFACE_ENTRANCE.x + 44, GROUND - 34, 15).fill({ color: 0xffcf83, alpha: 0.08 })
    this.view.addChild(this.entranceLight, this.weather.view)
    this.setCamera({ x: 0, y: 0, zoom: 1 }, { width: 1200, height: 800 })
  }

  setCamera(camera: Camera, viewport: Viewport): void {
    const visibleWidth = viewport.width / camera.zoom
    const width = Math.max(WIDTH + 512, visibleWidth + 512)
    const cameraCenter = camera.x + visibleWidth / 2
    const left = (WIDTH - width) / 2 + (cameraCenter - WIDTH / 2) * 0.14
    const top = Math.min(-512, camera.y - 128)
    this.weather.setExtent(camera.x - 100, visibleWidth + 200)
    // 延展天空到相机留白区；全景和宽屏下也不出现原来的深色空条。
    this.fallback.clear()
    this.fallback.rect(left - 256, top, width + 512, GROUND - top).fill(0x465d70)
    if (this.horizon) {
      this.horizon.width = width
      this.horizon.height = width * this.horizon.texture.height / this.horizon.texture.width
      this.horizon.position.set(left, GROUND - this.horizon.height)
    } else {
      this.fallback.poly([left, GROUND, left, 48, left + width * 0.2, 15, left + width * 0.46, 68, left + width * 0.7, 25, left + width, 72, left + width, GROUND]).fill(0x526b77)
    }
  }

  update(seconds: number, weather?: SurfaceWeatherProfile): void {
    const gust = this.weather.update(seconds, weather)
    for (const { sprite, phase } of this.trees) {
      sprite.skew.x = -0.012 - Math.sin(seconds * 1.5 + phase) * 0.009 * gust
    }
    this.entranceLight.alpha = 0.86 + Math.sin(seconds * 2.1) * 0.1
  }

  private buildGroundEdge(): void {
    const g = this.groundEdge
    // 草皮下的薄土层与细根贴住现有岩石；井口始终留空。
    for (const [left, right] of [[0, SHAFT_LEFT], [SHAFT_RIGHT, WIDTH]]) {
      const earth = [left, GROUND - 2, right, GROUND - 2, right, GROUND + 8]
      for (let x = right - 8; x > left; x -= 12) earth.push(x, GROUND + 6 + seed(x) * 5)
      earth.push(left, GROUND + 8)
      g.poly(earth).fill(0x66523c)
      g.moveTo(left, GROUND).lineTo(right, GROUND).stroke({ color: 0xa9c3ca, width: 3 })
      for (let x = left + 6; x < right - 12; x += 29) {
        if (seed(x + 9) > 0.28) {
          g.ellipse(x + 5, GROUND - 1, 10 + seed(x) * 8, 2.4).fill({ color: 0xe0edef, alpha: 0.95 })
        }
      }
      for (let x = left + 8; x < right - 5; x += 17) {
        const height = 2 + seed(x + 1) * 4
        g.moveTo(x - 2, GROUND).lineTo(x + 1, GROUND - height).lineTo(x + 2, GROUND)
          .stroke({ color: 0xaebfc1, width: 1, alpha: 0.8 })
        if (seed(x + 4) > 0.55) {
          const y = GROUND + 9 + seed(x + 2) * 7
          g.moveTo(x, GROUND + 3).lineTo(x - 2, y).lineTo(x + 1, y + 3)
            .stroke({ color: 0x8a7555, width: 1, alpha: 0.65 })
        }
      }
    }
  }

  private buildFallbackWoodland(): void {
    const g = new Graphics({ label: 'surface-woodland-fallback' })
    for (const x of [60, 105, 330, 398, 970, 1030, 1290, 1360]) {
      const height = 35 + seed(x) * 40
      g.rect(x - 2, GROUND - height, 4, height).fill(0x655a47)
      g.poly([x - 24, GROUND - 14, x + 6, GROUND - height - 18, x + 25, GROUND - 12]).fill(0x345b55)
      g.poly([x - 7, GROUND - height + 12, x + 6, GROUND - height - 18, x + 15, GROUND - height + 12, x + 5, GROUND - height + 7]).fill(0xcadfe5)
    }
    this.view.addChild(g)
  }
}
