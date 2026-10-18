import { Container, Graphics } from 'pixi.js'
import { MAP_WIDTH, SURFACE_Y, TILE_SIZE } from '../core/world'

const GROUND = SURFACE_Y * TILE_SIZE
const WIDTH = MAP_WIDTH * TILE_SIZE
const SKY_TOP = -384
export const LIGHTNING_PERIOD = 18
export const LIGHTNING_DURATION = 1.4

function seed(i: number): number {
  const n = Math.sin(i * 127.1 + 31.7) * 43758.5453
  return n - Math.floor(n)
}

/** 单次缓慢亮起再淡出的远雷，首次在4秒后；不会在卡顿后补播闪电。 */
export function stormAt(seconds: number): { gust: number; lightning: number; boltX: number } {
  const time = Math.max(0, seconds)
  const cycle = Math.floor((time + 14) / LIGHTNING_PERIOD)
  const age = (time + 14) % LIGHTNING_PERIOD
  return {
    gust: 0.7 + 0.3 * Math.sin(time * 0.8) ** 2,
    lightning: age < LIGHTNING_DURATION ? Math.sin(Math.PI * age / LIGHTNING_DURATION) ** 2 : 0,
    boltX: cycle % 2 ? 1050 : 305,
  }
}

/** 雪向右下吹，循环位置只取决于时间；全部停在地表上方。 */
export function snowflakeAt(index: number, seconds: number, left: number, width: number) {
  const near = index % 3 === 0
  const speed = near ? 170 : 100
  return {
    x: left + ((seed(index + 70) * width + seconds * (speed + seed(index) * 70)) % width),
    y: SKY_TOP + ((seed(index + 90) * (GROUND - SKY_TOP - 8) + seconds * (near ? 38 : 23)) % (GROUND - SKY_TOP - 8)),
    radius: near ? 1.5 : 0.8,
    alpha: near ? 0.8 : 0.48,
  }
}

/** 天气只负责画面，背层远雷和前层风雪都不接收输入、不写存档。 */
export class SurfaceWeather {
  readonly distant = new Graphics({ label: 'surface-distant-lightning', eventMode: 'none' })
  readonly view = new Container({ label: 'surface-weather', eventMode: 'none' })
  private readonly snow = new Graphics()
  private readonly mask = new Graphics()
  private left = -100
  private width = WIDTH + 200

  constructor() {
    this.view.addChild(this.snow, this.mask)
    this.view.mask = this.mask
    this.setExtent(this.left, this.width)
  }

  setExtent(left: number, width: number): void {
    this.left = left
    this.width = width
    // 即使镜头拖到地表边缘，雪也不会穿过岩层落入家园。
    this.mask.clear().rect(left, SKY_TOP, width, GROUND - SKY_TOP).fill(0xffffff)
  }

  update(seconds: number): number {
    const { gust, lightning, boltX } = stormAt(seconds)
    const distant = this.distant
    distant.clear()
    if (lightning > 0.001) {
      distant.ellipse(boltX, -75, 170, 105).fill({ color: 0xc5dce8, alpha: lightning * 0.11 })
      const bolt = [boltX + 18, -155, boltX - 8, -102, boltX + 9, -105, boltX - 25, -47, boltX - 11, -49, boltX - 38, -3]
      distant.poly(bolt, false).stroke({ color: 0xbad9e9, alpha: lightning * 0.18, width: 7 })
      distant.poly(bolt, false).stroke({ color: 0xe4f4f8, alpha: lightning * 0.8, width: 1.7 })
      distant.moveTo(boltX - 8, -102).lineTo(boltX - 38, -91).lineTo(boltX - 56, -65)
        .stroke({ color: 0xd5eaf2, alpha: lightning * 0.48, width: 1 })
    }
    const g = this.snow
    g.clear()
    for (let i = 0; i < 20; i++) {
      const x = this.left + ((seed(i) * this.width + seconds * (130 + seed(i + 5) * 100)) % this.width)
      const y = GROUND - 20 - seed(i + 12) * 260 + Math.sin(seconds * 0.7 + i) * 6
      g.moveTo(x, y).quadraticCurveTo(x + 25, y - 4, x + 60 + seed(i + 2) * 55, y + 3)
        .stroke({ color: 0xdce8ed, alpha: (0.12 + seed(i + 20) * 0.08) * gust, width: 1 })
    }
    for (let i = 0; i < 125; i++) {
      const flake = snowflakeAt(i, seconds, this.left, this.width)
      g.moveTo(flake.x - 5 * gust, flake.y - 1.4).lineTo(flake.x, flake.y)
        .stroke({ color: 0xe7f2f4, alpha: flake.alpha * 0.45, width: flake.radius })
      g.circle(flake.x, flake.y, flake.radius).fill({ color: 0xf0f6f6, alpha: flake.alpha })
    }
    // 贴地吹过的薄雪让风暴在不闪电的绝大多数时间也能被看见。
    for (let i = 0; i < 8; i++) {
      const x = this.left + ((seed(i + 200) * this.width + seconds * 155) % this.width)
      const y = GROUND - 5 - seed(i + 210) * 10
      g.ellipse(x, y, 30 + seed(i + 220) * 25, 1.8).fill({ color: 0xc9dfe4, alpha: 0.09 * gust })
    }
    return gust
  }
}
