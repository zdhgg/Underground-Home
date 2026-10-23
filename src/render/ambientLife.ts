import { Container, Graphics } from 'pixi.js'
import { availablePartners } from '../core/partners'
import { LAMP_LOCATIONS } from './shelterFixtures'
import { TILE_SIZE, type WorldState } from '../core/world'

/**
 * 环境生命（S3）：灯光里的浮尘 + 待命伙伴身边的小微粒。
 * 全部由世界数据与时间推导的纯视觉层——不写世界、不进存档、不参与交互；
 * 浮尘用确定性轨道（无逐帧状态），微粒是少量短命粒子。
 */

interface Mote { x: number; y: number; radius: number; phase: number; speed: number; color: number }

/** 一粒浮尘在 t 秒时的位置：绕基点慢慢打转，偶尔明一点。 */
export function moteAt(mote: Mote, t: number): { x: number; y: number; alpha: number } {
  const a = t * mote.speed + mote.phase
  return {
    x: mote.x + Math.sin(a) * 7 + Math.sin(a * 0.37 + 1.2) * 4,
    y: mote.y + Math.cos(a * 0.8) * 5,
    alpha: 0.16 + 0.14 * (0.5 + 0.5 * Math.sin(a * 1.7)),
  }
}

/** 从世界推导浮尘群：大厅顶灯（修好核心后亮）与第二层壁灯各配几粒。 */
export function dustMotes(world: WorldState): Mote[] {
  const motes: Mote[] = []
  if (!world.progress.coreRepaired) return motes
  const lamps: { x: number; y: number }[] = [
    ...LAMP_LOCATIONS.map(lamp => ({ x: lamp.x, y: lamp.y })),
    ...world.exploration.lamps.map(lamp => ({ x: (lamp.x + 0.5) * TILE_SIZE, y: 20 * TILE_SIZE })),
  ]
  lamps.forEach((lamp, index) => {
    for (let i = 0; i < 3; i++) {
      // 确定性散布：同一个小世界每次刷新得到同一批浮尘。
      const seed = (index * 3 + i) * 0.618
      motes.push({
        x: lamp.x + (((seed * 37) % 1) - 0.5) * 66,
        y: lamp.y + 14 + ((seed * 53) % 1) * 46,
        radius: 1.1 + ((seed * 71) % 1) * 0.9,
        phase: seed * Math.PI * 2,
        speed: 0.5 + ((seed * 29) % 1) * 0.5,
        color: 0xfff2cf,
      })
    }
  })
  return motes
}

/** 待命伙伴身边偶尔冒一颗小微粒：小满=叶子、小泉=水珠、阿灯=暖光。 */
const SPARKLE_COLORS: Record<string, number> = { xiaoman: 0xa8d59a, xiaoquan: 0xa2dce0, adeng: 0xffe9b0 }
const SPARKLE_INTERVAL = 2.4

export class AmbientLife {
  readonly view = new Container({ label: 'ambient-life', eventMode: 'none' })
  private readonly dust = new Graphics({ label: 'ambient-dust' })
  private motes: Mote[] = []
  private sparkles: { x: number; y: number; t: number; color: number }[] = []
  private spawnClock = 0

  constructor() {
    this.view.addChild(this.dust)
  }

  /** 世界或灯具变化后重算浮尘（确定性：同世界同一批）。 */
  refresh(world: WorldState | null): void {
    this.motes = world ? dustMotes(world) : []
  }

  /** 测试与调试用：当前飘着的伙伴微粒数。 */
  get sparkleCount(): number { return this.sparkles.length }

  update(world: WorldState | null, elapsed: number, dt: number): void {
    const g = this.dust
    g.clear()
    for (const mote of this.motes) {
      const at = moteAt(mote, elapsed)
      g.circle(at.x, at.y, mote.radius).fill({ color: mote.color, alpha: at.alpha })
    }
    // 先让已有的微粒长大、飘走；新微粒出生的这一帧不计年龄。
    for (const sparkle of this.sparkles) {
      sparkle.t += dt
      const k = Math.min(1, sparkle.t / 1.1)
      g.circle(sparkle.x + Math.sin(k * 5) * 3, sparkle.y - k * 22, 1.6 * (1 - k * 0.5))
        .fill({ color: sparkle.color, alpha: 0.6 * (1 - k) })
    }
    this.sparkles = this.sparkles.filter(s => s.t < 1.1)
    // 待命伙伴的微粒：每 2.4 秒轮到一位，从他身边轻轻飘起。
    if (world) {
      this.spawnClock += dt
      const workers = Object.entries(world.workers)
        .filter(([id]) => SPARKLE_COLORS[id] && availablePartners(world).some(p => p.id === id))
      if (this.spawnClock >= SPARKLE_INTERVAL && workers.length > 0) {
        this.spawnClock = 0
        const [id, at] = workers[Math.floor((elapsed / SPARKLE_INTERVAL) % workers.length)]
        this.sparkles.push({ x: (at.x + 0.5) * TILE_SIZE, y: at.y * TILE_SIZE + 6, t: 0, color: SPARKLE_COLORS[id] })
      }
    }
  }
}
