import { Container, Graphics, Sprite, Text } from 'pixi.js'
import { BREAKTHROUGHS, HOME_FLOOR_Y, LANDMARKS, MAP_WIDTH, TILE, TILE_SIZE as T, type Cell, type WorldState } from '../core/world'
import { SHAFT_LAST_Y, shaftChainReady, shaftConnected, shaftFrontier, shaftRemainingSegments, springVisible, waterSpan } from '../core/exploration'
import { MoleVisual, type MoleTextures } from './moleVisual'
import { AtuConstruction } from './atuConstruction'
import type { SoilPlan } from '../core/atu'
import type { EnvironmentTextures } from './environmentArt'
import { drawCaveMoss } from './caveMoss'

/** 破岩演出：抬手到落镐的时间；落镐那一刻世界才改变，孩子看到的是"挖开"。 */
const SWING_TIME = 0.42
const SWING_RECOVER = 0.26
/** 阿土喊一声 / 跳一下的时长（纯画面，不锁定操作） */
const REACTION_TIME = 2.4

interface WorkState {
  target: Cell
  elapsed: number
  struck: boolean
  onStrike: () => void
}

/** 阿土的一次情绪反馈：嘴边的短句 + 跳一下，不改变世界。 */
interface Reaction {
  elapsed: number
}

/** 只画线索、真实梯子、探索迷雾和阿土；移动点由规则层提供。 */
export class ExplorationScene {
  readonly view = new Container()
  /** 单独放到家具、角色和光照后面；不再把环境装饰压在可交互物上。 */
  readonly background = new Container()
  private readonly scenery = new Container()
  /** 逐帧的施工提示：裂纹呼吸、下一块目标环、水汽水珠 */
  private readonly cues = new Graphics()
  private readonly fog = new Graphics()
  private readonly explorer = new Container()
  private readonly mole: MoleVisual | null
  private readonly tool = new Graphics()
  private readonly construction = new AtuConstruction()
  private readonly selection = new Graphics()
  private readonly targetLabel = new Text({ text: '', style: { fontFamily: '"Microsoft YaHei", sans-serif', fontSize: 11, fontWeight: '600', fill: 0xfff4d7 } })
  /** 阿土嘴边的短句（"通啦！"），只在有反应时可见 */
  private readonly bubble = new Container()
  private readonly bubbleText = new Text({
    text: '',
    style: { fontFamily: '"Microsoft YaHei", sans-serif', fontSize: 12, fontWeight: '700', fill: 0x2f4a3d },
  })
  private readonly bubbleBg = new Graphics()
  private motion: { points: Cell[]; elapsed: number; done: () => void; step?: (cell: Cell) => void; reported: number } | null = null
  private workAnim: WorkState | null = null
  private reaction: Reaction | null = null
  private world: WorldState | null = null
  private elapsed = 0
  private reveal = Array.from({ length: MAP_WIDTH }, () => 0)
  /** 阿土脚下的世界坐标与跳跃偏移分开存，避免每帧互相覆盖 */
  private standAt = { x: 0, y: 0 }
  private hop = 0
  private readonly environmentTextures: EnvironmentTextures | null

  constructor(textures: MoleTextures | null = null, environmentTextures: EnvironmentTextures | null = null) {
    this.environmentTextures = environmentTextures
    this.mole = textures ? new MoleVisual(textures) : null
    const mole = new Graphics()
    mole.ellipse(0, 0, 11, 13).fill(0xb49372).stroke({ width: 2, color: 0x514338 })
    mole.circle(-8, -9, 4).circle(8, -9, 4).fill(0xb49372)
    mole.roundRect(-12, -16, 24, 9, 5).fill(0xf4cb70).stroke({ width: 2, color: 0x765938 })
    mole.circle(0, -12, 4).fill(0xfff7c5)
    mole.circle(-4, -2, 1.5).circle(4, -2, 1.5).fill(0x403c38)
    mole.ellipse(0, 3, 3, 2).fill(0xda9590)
    mole.moveTo(-6, 12).lineTo(-10, 15).moveTo(6, 12).lineTo(10, 15).stroke({ width: 3, color: 0x514338 })
    // 小铁镐：握点在原点；升级后平时也拿着，施工时挥动。
    this.tool.moveTo(0, 0).lineTo(9, -10).stroke({ width: 3, color: 0x8d6a48 })
    this.tool.moveTo(4, -14).quadraticCurveTo(11, -12, 16, -6).stroke({ width: 4, color: 0xb9c3cc })
    this.tool.position.set(6, 4)
    this.tool.visible = false
    this.bubbleText.anchor.set(0.5)
    this.bubble.addChild(this.bubbleBg, this.bubbleText)
    this.bubble.visible = false
    const marker = new Graphics().ellipse(0, 13, 12, 3).stroke({ width: 1.3, color: 0xb5dfba, alpha: .8 })
    this.explorer.addChild(marker, this.mole?.view ?? mole, this.tool)
    if (this.mole) mole.destroy()
    this.targetLabel.anchor.set(.5)
    this.view.addChild(this.fog, this.scenery, this.cues, this.selection, this.explorer, this.construction.view, this.targetLabel, this.bubble)
  }

  /** 是否有正在播出的施工演出：会话层用它决定要不要锁输入。 */
  get animating(): boolean {
    return this.motion !== null || this.workAnim !== null || this.construction.active
  }

  get visible(): boolean { return this.explorer.visible }

  get speechAnchor(): { x: number; y: number } | null {
    return this.visible ? { x: this.explorer.x, y: this.explorer.y - 40 } : null
  }

  get hitBounds(): { x: number; y: number; width: number; height: number } | null {
    if (!this.visible) return null
    const b = this.explorer.getBounds()
    return { x: b.minX, y: b.minY, width: b.maxX - b.minX, height: b.maxY - b.minY }
  }

  refresh(world: WorldState): void {
    this.world = world
    this.refreshBackground(world)
    for (const child of this.scenery.removeChildren()) child.destroy({ children: true })
    const g = new Graphics()
    this.scenery.addChild(g)
    const label = (text: string, x: number, y: number, color = 0xbde5dd, size = 13) => {
      const t = new Text({ text, style: { fontFamily: '"Microsoft YaHei", sans-serif', fontSize: size, fill: color, fontWeight: '600' } })
      t.anchor.set(0.5)
      t.position.set(x * T, y * T)
      this.scenery.addChild(t)
    }
    const e = world.exploration
    const connected = shaftConnected(world)
    for (const x of BREAKTHROUGHS) {
      // 裂纹随岩块存在；未升级也看得到环境线索。呼吸脉冲在 drawCues 里逐帧叠加。
      for (let y = HOME_FLOOR_Y; y <= SHAFT_LAST_Y; y++) if (world.tiles[y][x] === TILE.WEAK_ROCK) {
        g.rect(x * T + 1, y * T + 1, T - 2, T - 2).fill({ color: 0xc9b083, alpha: 0.26 })
        g.moveTo((x + 0.6) * T, y * T + 2).lineTo((x + 0.38) * T, y * T + 12)
          .lineTo((x + 0.65) * T, y * T + 19).lineTo((x + 0.4) * T, (y + 1) * T - 1)
          .stroke({ width: 2, color: 0xe4e0b4, alpha: y === HOME_FLOOR_Y ? 0.95 : 0.45 })
      }
      // 阶段性提示只出现在还没走完的那条梯道上，避免两条裂纹互相抢话。
      // 提示往大厅内侧让一点：右翼的裂纹不至于被右下角的楼层面板压住。
      const active = e.shaftX === x
      const hintX = x > 22 ? x - 2.6 : x + 1.6
      if (world.pods.length && !e.entered) {
        if (!e.clueFound) label('滴答… 点裂纹听听', hintX, 8.5, 0xaee5e0)
        else if (active && !e.pickaxeUpgraded) label('换上小铁镐，点裂纹挖下去', hintX, 8.5, 0xffdf9b)
        else if (active && !connected) {
          // 剩下的段数一直摆在眼前：孩子能看到自己离洞底越来越近。
          const left = shaftRemainingSegments(world, x)
          const chain = shaftChainReady(world)
          label(`${chain ? '点一下 · 一路挖到洞底' : '点这里 · 阿土去挖'}（还剩 ${left} 段）`, hintX, 8.5, chain ? 0xffdf9b : 0xaee5e0)
        }
      }
      if (world.tiles[HOME_FLOOR_Y][x] !== TILE.EMPTY) continue
      let bottom = HOME_FLOOR_Y
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
    this.explorer.visible = e.explorer !== null || this.motion !== null || this.workAnim !== null
    if (e.explorer && !this.animating) this.positionExplorer(e.explorer)
    const span = waterSpan(world)
    if (span) {
      label(e.springFound ? '泉水层 · 新家园从这里开始' : '沿地面开路，找找水声', (span.left + span.right) / 2 + 0.5, 23.6)
    }
    if (springVisible(world)) {
      const sx = (LANDMARKS.spring.x + 0.5) * T, sy = 22 * T - 7
      const radius = Math.min(36, (LANDMARKS.spring.x - span!.left + 0.5) * T - 2, (span!.right - LANDMARKS.spring.x + 0.5) * T - 2)
      if (this.environmentTextures) {
        const spring = new Sprite(this.environmentTextures.spring)
        spring.anchor.set(.5, 1)
        spring.width = Math.max(94, radius * 2.45)
        spring.height = spring.width * 0.72
        spring.position.set(sx, sy + 8)
        this.scenery.addChild(spring)
      } else {
        g.ellipse(sx, sy, radius, 6).fill({ color: 0x73d2d7, alpha: 0.3 })
        g.ellipse(sx, sy, radius * 0.85, 4).fill(0x4b9fb6).stroke({ width: 2, color: 0xafe7de })
        g.moveTo(sx - 8, sy - 18).quadraticCurveTo(sx - 3, sy - 26, sx + 2, sy - 4).stroke({ width: 3, color: 0x78c6d2 })
        g.circle(sx - 8, sy - 22, 5).fill(0x66838a)
      }
      if (e.springFound) {
        // 找到以后泉水常亮：一圈冷色柔光，让新地方看起来"活着"。
        g.ellipse(sx, sy - 4, radius * 1.4, 14).fill({ color: 0xa5efdd, alpha: 0.14 })
        g.ellipse(sx, sy, radius * 1.12, 8).fill({ color: 0x9fe6e6, alpha: 0.2 })
      }
      label(e.springFound ? '天然泉水 · 找到啦！' : '天然泉水 · 点一下，阿土去看看', LANDMARKS.spring.x + 0.5, 19.4, 0xb5f3ef)
    }
    for (const lamp of e.lamps) {
      const x = (lamp.x + 0.5) * T, y = (lamp.y + 0.5) * T
      // 通电前只有一点余光；电从第一层送到之后才真正亮起来。
      g.circle(x, y + 10, world.powerDown ? 62 : 44).fill({ color: 0xffd995, alpha: world.powerDown ? 0.22 : 0.13 })
      g.roundRect(x - 7, y - 6, 14, 20, 4).fill(0x796650).stroke({ width: 2, color: 0xd1ae77 })
      g.roundRect(x - 4, y - 2, 8, 12, 2).fill(world.powerDown ? 0xfff3c8 : 0xffe7a3)
      if (lamp.wide) {
        g.poly([x - 12, y - 5, x + 12, y - 5, x + 8, y - 13, x - 8, y - 13]).fill(0xffe0a1).stroke({ width: 1.5, color: 0xb99054 })
      }
    }
    this.drawFog(0)
    this.drawCues()
  }

  travel(points: Cell[], done: () => void, step?: (cell: Cell) => void): void {
    this.workAnim = null
    this.explorer.scale.y = 1
    // 阿土可能还没进过场：出发时先让他出现在起点，别凭空出现在终点。
    this.explorer.visible = true
    if (points.length) this.positionExplorer(points[0])
    this.motion = { points, elapsed: 0, done, step, reported: 0 }
  }

  refreshBackground(world: WorldState): void {
    for (const child of this.background.removeChildren()) child.destroy({ children: true })
    this.background.addChild(drawCaveMoss(world))
  }

  soil(plan: SoilPlan, strike: () => void, done: () => void): void {
    this.motion = null
    this.positionExplorer(plan.stand)
    this.construction.start(plan, strike, done)
    this.mole?.face(plan.target.x - plan.stand.x)
  }

  preview(target: Cell | null, stand?: Cell, lift = 0, text = ''): void {
    const g = this.selection.clear()
    this.targetLabel.visible = target !== null
    if (!target) return
    g.roundRect(target.x * T + 2, target.y * T + 2, T - 4, T - 4, 5).stroke({ width: 2, color: 0xffd795 })
    if (stand) g.ellipse((stand.x + .5) * T, (stand.y + 1 - lift) * T - 2, 11, 3).stroke({ width: 1.5, color: 0xb5e1bc })
    this.targetLabel.text = text
    this.targetLabel.position.set((target.x + .5) * T, target.y * T - 10)
  }

  /** 施工：阿土站在梯段上挥镐；落镐瞬间回调，收招后归位。 */
  work(target: Cell, onStrike: () => void): void {
    this.motion = null
    this.explorer.visible = true
    this.positionExplorer({ x: target.x, y: target.y - 1 })
    this.workAnim = { target, elapsed: 0, struck: false, onStrike }
  }

  /**
   * 中断没播完的演出（切后台、窗口失焦久了、看门狗超时）：
   * 只清动作并把阿土放回世界记录的位置，不回调、不改世界，等玩家再点一次。
   */
  cancel(): void {
    this.motion = null
    this.workAnim = null
    this.construction.cancel()
    this.preview(null)
    this.tool.visible = false
    this.tool.rotation = 0
    this.explorer.scale.y = 1
    this.reaction = null
    this.hop = 0
    this.bubble.visible = false
    const explorer = this.world?.exploration.explorer ?? null
    this.explorer.visible = explorer !== null
    if (explorer) this.positionExplorer(explorer)
    this.mole?.update(this.elapsed, 'idle')
  }

  /** 阿土喊一句、蹦两下：纯画面反馈，不锁输入也不改世界。 */
  react(text: string): void {
    if (!this.explorer.visible) return
    this.bubbleText.text = text
    const width = this.bubbleText.width + 20
    const height = this.bubbleText.height + 12
    const bg = this.bubbleBg
    bg.clear()
    bg.roundRect(-width / 2, -height / 2, width, height, 9).fill({ color: 0xfffbee, alpha: 0.95 }).stroke({ width: 2, color: 0x765938 })
    bg.moveTo(-5, height / 2 - 1).lineTo(0, height / 2 + 7).lineTo(5, height / 2 - 1).fill({ color: 0xfffbee }).stroke({ width: 2, color: 0x765938 })
    this.bubble.visible = true
    this.bubble.alpha = 0
    this.reaction = { elapsed: 0 }
    this.updateReaction(0)
  }

  update(dt: number): void {
    this.elapsed += dt
    this.drawFog(dt)
    this.drawCues()
    const m = this.motion
    if (m) {
      m.elapsed += dt * 5
      const i = Math.min(Math.floor(m.elapsed), m.points.length - 1)
      const a = m.points[i], b = m.points[Math.min(i + 1, m.points.length - 1)]
      this.mole?.face(b.x - a.x)
      const k = m.elapsed - i
      this.positionExplorer({ x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k })
      while (m.reported < i) { m.reported++; m.step?.(m.points[m.reported]) }
      if (i === m.points.length - 1) { this.motion = null; m.done() }
    }
    const w = this.workAnim
    if (w) {
      w.elapsed += dt
      const k = Math.min(1, w.elapsed / SWING_TIME)
      this.tool.visible = true
      const direction = this.mole?.direction ?? 1
      this.tool.position.set(6 * direction, 4)
      this.tool.scale.set(direction, 1)
      this.tool.rotation = direction * (-1.25 + 1.8 * k)
      this.explorer.scale.y = 1 - 0.07 * Math.sin(Math.PI * k)
      if (!w.struck && w.elapsed >= SWING_TIME) {
        w.struck = true
        w.onStrike()
      }
      if (w.elapsed >= SWING_TIME + SWING_RECOVER) {
        this.workAnim = null
        this.tool.visible = false
        this.tool.rotation = 0
        this.explorer.scale.y = 1
        this.positionExplorer({ x: w.target.x, y: w.target.y - 1 })
      }
    }
    const direction = this.construction.update(dt)
    if (this.construction.active) this.mole?.face(direction)
    // 完成/取消同帧也移除踏台高度，不能留到下一次世界刷新。
    this.applyExplorer()
    if (!this.workAnim) {
      const direction = this.mole?.direction ?? 1
      this.tool.visible = !this.construction.active && (this.world?.exploration.pickaxeUpgraded ?? false)
      this.tool.position.set(7 * direction, 3)
      this.tool.scale.set(0.75 * direction, 0.75)
      this.tool.rotation = 0.3 * direction
    }
    const light = this.standAt.y >= HOME_FLOOR_Y * T
      ? this.world?.powerDown ? 1 : 0.4
      : this.world?.progress.coreRepaired ? 1 : 0
    const digging = this.construction.digging
    if (digging) this.mole?.dig(this.elapsed, digging, light)
    else this.mole?.update(this.elapsed, w || this.construction.active ? 'work' : m ? 'walk' : 'idle', light)
    this.updateReaction(dt)
  }

  /** 反应的逐帧部分：跳一下 + 让嘴边的话淡入淡出；结束就恢复站立。 */
  private updateReaction(dt: number): void {
    const reaction = this.reaction
    if (!reaction) {
      this.hop = 0
      this.bubble.visible = false
      return
    }
    reaction.elapsed += dt
    if (reaction.elapsed >= REACTION_TIME) {
      this.reaction = null
      this.hop = 0
      this.bubble.visible = false
      this.applyExplorer()
      return
    }
    this.hop = reaction.elapsed < 0.9 ? Math.abs(Math.sin(reaction.elapsed * 7)) * 7 : 0
    this.applyExplorer()
    this.bubble.visible = this.explorer.visible
    this.bubble.alpha = Math.min(1, reaction.elapsed / 0.16) * Math.min(1, (REACTION_TIME - reaction.elapsed) / 0.4)
    this.bubble.position.set(this.standAt.x, this.standAt.y - 42 - this.hop)
  }

  private positionExplorer(cell: Cell): void {
    this.standAt = { x: (cell.x + 0.5) * T, y: (cell.y + 1) * T - 15 }
    this.applyExplorer()
  }

  private applyExplorer(): void {
    this.explorer.position.set(this.standAt.x, this.standAt.y - this.hop - this.construction.lift)
  }

  /** 施工提示：还没挖开的裂纹轻轻呼吸；下一次要挖的那块套一个目标环。 */
  private drawCues(): void {
    const g = this.cues
    g.clear()
    const world = this.world
    if (!world) return
    const e = world.exploration
    const pulse = 0.5 + 0.5 * Math.sin(this.elapsed * 3.2)
    for (const x of BREAKTHROUGHS) {
      const frontier = e.clueFound && e.pickaxeUpgraded && e.shaftX === x ? shaftFrontier(world, x) : null
      for (let y = HOME_FLOOR_Y; y <= SHAFT_LAST_Y; y++) {
        if (world.tiles[y][x] !== TILE.WEAK_ROCK) continue
        const isTarget = frontier?.y === y
        g.rect(x * T + 1, y * T + 1, T - 2, T - 2).fill({
          color: isTarget ? 0xffdf9b : 0xd8c08b,
          alpha: (isTarget ? 0.2 : 0.07) * (0.55 + 0.45 * pulse),
        })
        if (!isTarget) continue
        const r = 13 + 2.5 * pulse
        g.roundRect((x + 0.5) * T - r, (y + 0.5) * T - r, r * 2, r * 2, 7).stroke({
          width: 3, color: 0xffd98a, alpha: 0.5 + 0.3 * pulse,
        })
      }
      // 还没听到水声：裂纹口上滴水珠，提示"这里能听、能挖"。
      if (!e.clueFound && world.pods.length && world.tiles[HOME_FLOOR_Y][x] === TILE.WEAK_ROCK) {
        const cx = (x + 0.5) * T
        const cy = HOME_FLOOR_Y * T - 6 - pulse * 3
        g.circle(cx, cy, 3.4).fill({ color: 0xbfeef0, alpha: 0.85 })
        g.circle(cx, cy + 1, 5 + 9 * pulse).stroke({ width: 2, color: 0x9fdfe6, alpha: 0.55 * (1 - pulse) })
      }
    }
    // 找到泉水后水面一直轻轻闪动：新家园是活的。
    if (e.springFound && waterSpan(world)) {
      const sx = (LANDMARKS.spring.x + 0.5) * T
      const sy = 22 * T - 7
      const shimmer = 0.5 + 0.5 * Math.sin(this.elapsed * 2.4)
      g.ellipse(sx, sy, 16 + 10 * shimmer, 3 + 1.6 * shimmer).stroke({ width: 2, color: 0xc9fbf2, alpha: 0.3 + 0.35 * shimmer })
      for (let i = 0; i < 3; i++) {
        const k = (this.elapsed * 0.55 + i / 3) % 1
        g.circle(sx - 13 + i * 13, sy - 6 - k * 17, 2.2 * (1 - k)).fill({ color: 0xd9fdf6, alpha: 0.55 * (1 - k) })
      }
      // 洞顶的水珠断续滴进泉面：从泉水上方第一块实心岩落下，砸出一圈圈涟漪。
      let ceiling = 18
      while (ceiling < 21 && world.tiles[ceiling][LANDMARKS.spring.x] === TILE.EMPTY) ceiling++
      const dropTop = ceiling * T + 4
      const dropBottom = 21.7 * T
      for (let i = 0; i < 2; i++) {
        const k = (this.elapsed * 0.3 + i * 0.5) % 1
        g.circle(sx - 8 + i * 14, dropTop + k * (dropBottom - dropTop), 1.8).fill({ color: 0xd9fdf6, alpha: 0.75 * (1 - k * 0.25) })
      }
      for (let i = 0; i < 2; i++) {
        const k = (this.elapsed * 0.42 + i * 0.5) % 1
        g.ellipse(sx, sy, 3 + 15 * k, 1 + 3.2 * k).stroke({ width: 1.5, color: 0xc9fbf2, alpha: 0.5 * (1 - k) })
      }
    }
  }

  private drawFog(dt: number): void {
    const world = this.world
    if (!world) return
    const span = waterSpan(world)
    const shaftX = world.exploration.shaftX
    // 梯道刚接通、人还没下去：先在洞口透出一线微光——下面真的有地方。
    const peek = !span && shaftX !== null && shaftConnected(world)
    this.fog.clear()
    for (let x = 0; x < MAP_WIDTH; x++) {
      const target = span && x >= span.left - 1 && x <= span.right + 1 ? 1
        : peek && Math.abs(x - shaftX!) <= 1 ? 0.45 : 0
      this.reveal[x] += (target - this.reveal[x]) * Math.min(1, dt * 5)
      this.fog.rect(x * T, 18 * T, T, 4 * T).fill({ color: 0x101f2b, alpha: 0.94 * (1 - this.reveal[x]) })
    }
  }
}
