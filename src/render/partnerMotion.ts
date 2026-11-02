import { Container, Graphics } from 'pixi.js'
import { LANDMARKS, TILE_SIZE as T, type Cell } from '../core/world'
import type { WorkPlan } from '../core/partnerWork'

export interface MovingPartner { view: Container; baseY: number; pose: 'idle' | 'walk' | 'climb' | 'rest'; inEntrance: boolean; visual: { face(dx: number): void; lean?(amount: number, direction: number): void } | null }

/** 前 .55s 俯身到位、之后 .4s 收回：收菜、浇水和接水管共用的俯身曲线。 */
const leanCurve = (t: number): number => t < .55 ? Math.sin(Math.min(1, t / .55) * Math.PI / 2) : Math.max(0, 1 - (t - .55) / .4)

/** 只负责一位伙伴的路径与短动作；规则和结算由会话回调决定。 */
export class PartnerMotion {
  readonly effects = new Graphics()
  private motion: { friend: MovingPartner; route: Cell[]; index: number; time: number; step(p: Cell): void; done(): void } | null = null
  private action: { friend: MovingPartner; plan: WorkPlan; time: number; hit: boolean; strike(): void; done(): void } | null = null
  travel(friend: MovingPartner, route: Cell[], step: (p: Cell) => void, done: () => void): void {
    this.cancel()
    friend.inEntrance = true; friend.pose = 'walk'
    this.motion = { friend, route, index: 0, time: 0, step, done }
  }
  work(friend: MovingPartner, plan: WorkPlan, strike: () => void, done: () => void): void {
    this.cancel()
    friend.inEntrance = true; friend.pose = 'idle'; friend.visual?.face(plan.target.kind === 'water' ? 18 - plan.at.x : plan.target.kind === 'nest-warm-lamp' ? (plan.facing?.x ?? plan.at.x + 1) - plan.at.x : plan.target.x - plan.at.x)
    this.action = { friend, plan, time: 0, hit: false, strike, done }
  }
  cancel(): void {
    const f = this.motion?.friend ?? this.action?.friend
    if (this.action) { this.action.friend.view.y = this.action.friend.baseY; this.action.friend.visual?.lean?.(0, 1) }
    if (f) { f.inEntrance = false; f.pose = 'idle' }
    this.motion = null; this.action = null; this.effects.clear()
  }
  update(dt: number): void {
    const m = this.motion
    if (m) {
      m.time += dt
      const duration = .14
      while (m.time >= duration && m.index < m.route.length - 1) {
        m.time -= duration; m.index++; m.step(m.route[m.index])
        if (this.motion !== m) return
      }
      const a = m.route[m.index], b = m.route[Math.min(m.index + 1, m.route.length - 1)]
      const t = Math.min(1, m.time / duration)
      m.friend.pose = a.y !== b.y ? 'climb' : 'walk'; m.friend.visual?.face(b.x - a.x)
      m.friend.view.position.set((a.x + .5 + (b.x - a.x) * t) * T, (a.y + .6 + (b.y - a.y) * t) * T)
      m.friend.baseY = m.friend.view.y
      if (m.index === m.route.length - 1) {
        this.motion = null; m.friend.inEntrance = false; m.friend.pose = 'idle'; m.done()
      }
    }
    const a = this.action
    if (a) {
      a.time += dt
      // 阿灯只在已清出三格高的安装列内短暂升起，够到洞壁上的灯位。
      const lift = a.plan.target.kind === 'lamp' || a.plan.target.kind === 'lamp-retrofit' ? 32 * Math.min(1, a.time / .4, Math.max(0, (.95 - a.time) / .2)) : 0
      a.friend.view.y = a.friend.baseY - lift
      const x = a.friend.view.x, y = a.friend.view.y
      const duration = a.plan.target.kind === 'nest-warm-lamp' ? 2.4 : .95
      const swing = Math.sin(Math.min(1, a.time / .6) * Math.PI)
      const g = this.effects.clear()
      const dx = a.plan.target.kind === 'water' ? 18 - a.plan.at.x : a.plan.target.kind === 'nest-warm-lamp' ? (a.plan.facing?.x ?? a.plan.at.x + 1) - a.plan.at.x : a.plan.target.x - a.plan.at.x
      const dir = Math.sign(dx) || 1
      // 收菜和浇水都用角色自身的俯身和回身，避免凭空长出一条手臂；浇水另画落进槽里的水珠。
      if ((a.plan.target.kind === 'harvest' || a.plan.target.kind === 'watering') && a.plan.worker === 'xiaoman') {
        a.friend.visual?.lean?.(leanCurve(a.time), dir)
        if (a.plan.target.kind === 'watering') {
          const cx = (a.plan.target.x + .5) * T, top = (a.plan.target.y - .1) * T, soil = (a.plan.target.y + .6) * T
          for (let i = 0; i < 3; i++) {
            const drop = (a.time * 1.5 + i / 3) % 1
            g.circle(cx + (i - 1) * 6, top + drop * (soil - top), 1.8).fill({ color: 0x9ed7f2, alpha: .85 })
          }
        }
      } else if (a.plan.worker === 'xiaoquan' && a.plan.target.kind === 'water') {
        // 接水管：朝泉眼俯身，水珠从泉面咕嘟咕嘟冒出来，不画手臂。
        a.friend.visual?.lean?.(leanCurve(a.time), dir)
        const sx = (LANDMARKS.spring.x + .5) * T, surface = 22 * T - 7
        for (let i = 0; i < 3; i++) {
          const up = (a.time * 1.1 + i / 3) % 1
          g.circle(sx + Math.sin((up + i * .8) * Math.PI * 2) * 5, surface - up * 15, 1.8).fill({ color: 0x9ed7f2, alpha: .2 + .65 * (1 - up) })
        }
      } else if (a.plan.worker === 'adeng' && (a.plan.target.kind === 'lamp' || a.plan.target.kind === 'lamp-retrofit' || a.plan.target.kind === 'nest-warm-lamp')) {
        // 装灯：阿灯升到灯位（或面向小窝）点亮它，火花在灯位迸出，不再画手臂。
        // 壁灯挂在 target.x 列正中（explorationScene 同款算法），火花直接锚定灯位。
        const cx = a.plan.target.kind === 'nest-warm-lamp' ? x + dir * 11 : (a.plan.target.x + .5) * T
        for (let i = 0; i < 4; i++) {
          const tw = (a.time * 2.2 + i * .37) % 1
          const angle = i * Math.PI / 2 + tw * 1.3
          const r = 2.5 + 5.5 * tw
          g.circle(cx + Math.cos(angle) * r, y - 10 + Math.sin(angle) * r * .7, 1.4).fill({ color: i % 2 ? 0xfff3c8 : 0xffdf9d, alpha: .85 * (1 - tw) })
        }
      } else if(a.plan.worker==='lingling'){
        for(let i=0;i<3;i++)g.arc(x+dir*8,y-13,8+i*6+swing*3,dir>0?-Math.PI/3:Math.PI*2/3,dir>0?Math.PI/3:Math.PI*4/3).stroke({width:1.2,color:0xc6b9d5,alpha:.55-i*.1})
      } else if (a.plan.worker === 'taitai') {
        for (let i = 0; i < 4; i++) g.moveTo(x - 12 + i * 7, y + 11).lineTo(x - 9 + i * 7, y + 7 - swing * 3).lineTo(x - 5 + i * 7, y + 11).stroke({ width: 1.5, color: 0xb1dfb5, alpha: .6 })
      } else if (a.plan.worker === 'tuantuan') {
        // 河狸用接头与闸轮做水工，区别于凿岩和普通敲打。
        const cx=x+dir*17,cy=y-8,angle=swing*Math.PI*.65
        g.moveTo(x+dir*5,y+3).lineTo(cx,cy).stroke({width:3,color:0x849e99})
        g.circle(cx,cy,8).stroke({width:2,color:0xd0b682})
        for(let i=0;i<3;i++){const a=angle+i*Math.PI*2/3;g.moveTo(cx,cy).lineTo(cx+Math.cos(a)*8,cy+Math.sin(a)*8).stroke({width:2,color:0xc5aa7c})}
        g.moveTo(x-8,y+11).lineTo(x+8,y+11).lineTo(x+8,y+5).stroke({width:3,color:0x85b8bc,alpha:.7})
      } else {
      // 深层凿岩等挥镐动作：手臂和镐头与阿土的矢量画风一致，保留。
      g.moveTo(x + dir * 7, y - 2).lineTo(x + dir * (15 + swing * 7), y - 9 - swing * 9).stroke({ width: 3, color: 0xffdf9d })
      g.roundRect(x + dir * (15 + swing * 7) - 4, y - 16 - swing * 9, 9, 10, 3).fill(0xffdf9d)
      }
      if (!a.hit && a.time >= (a.plan.target.kind === 'nest-warm-lamp' ? duration : .55)) { a.hit = true; a.strike(); if (this.action !== a) return }
      if (a.time >= duration) { this.action = null; this.effects.clear(); a.friend.view.y = a.friend.baseY; a.friend.visual?.lean?.(0, dir); a.friend.inEntrance = false; a.friend.pose = 'idle'; a.done() }
    }
  }
}
