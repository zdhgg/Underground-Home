import { Container, Graphics, Text } from 'pixi.js'
import { BREAKTHROUGHS, LANDMARKS, MAP_WIDTH, TILE, TILE_SIZE as T, type Cell, type WorldState } from '../core/world'
import { springVisible, waterSpan } from '../core/exploration'

/** 只画线索、真实梯子、探索迷雾和阿土；移动点由规则层提供。 */
export class ExplorationScene {
  readonly view = new Container()
  private readonly scenery = new Container()
  private readonly fog = new Graphics()
  private readonly explorer = new Container()
  private motion: { points: Cell[]; elapsed: number; done: () => void } | null = null
  private world: WorldState | null = null
  private reveal = Array.from({ length: MAP_WIDTH }, () => 0)

  constructor() {
    const mole = new Graphics()
    mole.ellipse(0, 0, 11, 13).fill(0xb49372).stroke({ width: 2, color: 0x514338 })
    mole.circle(-8, -9, 4).circle(8, -9, 4).fill(0xb49372)
    mole.roundRect(-12, -16, 24, 9, 5).fill(0xf4cb70).stroke({ width: 2, color: 0x765938 })
    mole.circle(0, -12, 4).fill(0xfff7c5)
    mole.circle(-4, -2, 1.5).circle(4, -2, 1.5).fill(0x403c38)
    mole.ellipse(0, 3, 3, 2).fill(0xda9590)
    mole.moveTo(-6, 12).lineTo(-10, 15).moveTo(6, 12).lineTo(10, 15).stroke({ width: 3, color: 0x514338 })
    this.explorer.addChild(mole)
    this.view.addChild(this.fog, this.scenery, this.explorer)
  }

  refresh(world: WorldState): void {
    this.world = world
    for (const child of this.scenery.removeChildren()) child.destroy({ children: true })
    const g = new Graphics()
    this.scenery.addChild(g)
    const label = (text: string, x: number, y: number, color = 0xbde5dd, size = 13) => {
      const t = new Text({ text, style: { fontFamily: '"Microsoft YaHei", sans-serif', fontSize: size, fill: color, fontWeight: '600' } })
      t.anchor.set(0.5)
      t.position.set(x * T, y * T)
      this.scenery.addChild(t)
    }
    for (const x of BREAKTHROUGHS) {
      // 裂纹随岩块存在；未升级也看得到环境线索。
      for (let y = 12; y < 19; y++) if (world.tiles[y][x] === TILE.WEAK_ROCK) {
        g.rect(x * T + 1, y * T + 1, T - 2, T - 2).fill({ color: 0xc9b083, alpha: 0.24 })
        g.moveTo((x + 0.6) * T, y * T + 2).lineTo((x + 0.38) * T, y * T + 12)
          .lineTo((x + 0.65) * T, y * T + 19).lineTo((x + 0.4) * T, (y + 1) * T - 1)
          .stroke({ width: 2, color: 0xd5d6ae, alpha: y === 12 ? 0.9 : 0.3 })
      }
      if (world.pods.length && !world.exploration.entered) label('滴答… 点裂纹听听', x + 0.5, 8.5, 0xaee5e0)
      if (world.tiles[12][x] !== TILE.EMPTY) continue
      let bottom = 12
      while (bottom < 22 && world.tiles[bottom][x] === TILE.EMPTY) bottom++
      const cx = (x + 0.5) * T
      // 每挖一块就向下搭一段，两根木轨和横档均在真实空格内。
      g.moveTo(cx - 10, 11 * T + 4).lineTo(cx - 10, bottom * T)
        .moveTo(cx + 10, 11 * T + 4).lineTo(cx + 10, bottom * T)
        .stroke({ width: 5, color: 0x674b36 })
      g.moveTo(cx - 9, 11 * T + 4).lineTo(cx - 9, bottom * T)
        .moveTo(cx + 9, 11 * T + 4).lineTo(cx + 9, bottom * T)
        .stroke({ width: 2, color: 0xc59b65 })
      for (let py = 11 * T + 12; py < bottom * T; py += 11) {
        g.moveTo(cx - 10, py).lineTo(cx + 10, py).stroke({ width: 4, color: 0xa67c4f })
      }
    }
    const e = world.exploration
    this.explorer.visible = e.explorer !== null
    if (e.explorer && !this.motion) this.positionExplorer(e.explorer)
    if (e.explorer) label('阿土', e.explorer.x + 0.5, e.explorer.y - 0.65, 0xffdf9b, 11)
    const span = waterSpan(world)
    if (span) {
      label(e.springFound ? '泉水层 · 新家园从这里开始' : '沿地面开路，找找水声', (span.left + span.right) / 2 + 0.5, 23.6)
      // 潮湿洞壁、苔藓与小蘑菇只出现在已探索区域。
      for (let x = span.left; x <= span.right; x++) {
        if (x % 3 === 0) {
          g.ellipse((x + 0.5) * T, 22 * T - 2, 13, 3).fill(0x537c68)
          g.moveTo((x + 0.6) * T, 22 * T - 3).lineTo((x + 0.6) * T, 22 * T - 10).stroke({ width: 2, color: 0xc7c4a1 })
          g.ellipse((x + 0.6) * T, 22 * T - 11, 6, 3).fill(0x8ebfc2)
        }
      }
    }
    if (springVisible(world)) {
      const sx = (LANDMARKS.spring.x + 0.5) * T, sy = 22 * T - 7
      const radius = Math.min(36, (LANDMARKS.spring.x - span!.left + 0.5) * T - 2, (span!.right - LANDMARKS.spring.x + 0.5) * T - 2)
      g.ellipse(sx, sy, radius, 6).fill({ color: 0x73d2d7, alpha: 0.3 })
      g.ellipse(sx, sy, radius * 0.85, 4).fill(0x4b9fb6).stroke({ width: 2, color: 0xafe7de })
      g.moveTo(sx - 8, sy - 18).quadraticCurveTo(sx - 3, sy - 26, sx + 2, sy - 4).stroke({ width: 3, color: 0x78c6d2 })
      g.circle(sx - 8, sy - 22, 5).fill(0x66838a)
      label(e.springFound ? '天然泉水 · 找到啦！' : '天然泉水 · 点这里', LANDMARKS.spring.x + 0.5, 19.4, 0xb5f3ef)
    }
    for (const lamp of e.lamps) {
      const x = (lamp.x + 0.5) * T, y = (lamp.y + 0.5) * T
      g.circle(x, y + 10, 44).fill({ color: 0xffd995, alpha: 0.13 })
      g.roundRect(x - 7, y - 6, 14, 20, 4).fill(0x796650).stroke({ width: 2, color: 0xd1ae77 })
      g.roundRect(x - 4, y - 2, 8, 12, 2).fill(0xffe7a3)
    }
    this.drawFog(0)
  }

  travel(points: Cell[], done: () => void): void {
    this.motion = { points, elapsed: 0, done }
  }

  update(dt: number): void {
    this.drawFog(dt)
    const m = this.motion
    if (!m) return
    m.elapsed += dt * 5
    const i = Math.min(Math.floor(m.elapsed), m.points.length - 1)
    const a = m.points[i], b = m.points[Math.min(i + 1, m.points.length - 1)]
    const k = m.elapsed - i
    this.positionExplorer({ x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k })
    if (i === m.points.length - 1) { this.motion = null; m.done() }
  }

  private positionExplorer(cell: Cell): void {
    this.explorer.position.set((cell.x + 0.5) * T, (cell.y + 1) * T - 15)
  }

  private drawFog(dt: number): void {
    const world = this.world
    if (!world) return
    const span = waterSpan(world)
    this.fog.clear()
    for (let x = 0; x < MAP_WIDTH; x++) {
      const target = span && x >= span.left - 1 && x <= span.right + 1 ? 1 : 0
      this.reveal[x] += (target - this.reveal[x]) * Math.min(1, dt * 5)
      this.fog.rect(x * T, 18 * T, T, 4 * T).fill({ color: 0x101f2b, alpha: 0.94 * (1 - this.reveal[x]) })
    }
  }
}
