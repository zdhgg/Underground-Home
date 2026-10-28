import { Container, Graphics, Sprite, Text } from 'pixi.js'
import { DEEP_SPECS, deepBuildProblem, hasDeep } from '../core/deep'
import { AYAN_SPOT, CRYSTAL_SPOT, DEEP_FOOT, DRILL_SPOT, MOSS_SPOT, deepFrontier, deepLadderSegments, deepSpan } from '../core/deepTopology'
import { TILE, TILE_SIZE as T, type DeepFacilityKind, type WorldState } from '../core/world'
import type { DeepTextures } from './deepArt'
import { deepLampCoverage } from '../core/lighting'

/** 深层的岩壁设施、光场和电梯。规则与位置只读世界数据。 */
export class DeepScene {
  readonly view = new Container({ label: 'crystal-chapter' })
  readonly foreground = new Container({ label: 'crystal-chapter-front' })
  readonly preview = new Graphics()
  /** 选址时叠在岩壁前的半透明设施影子与说明，和它一起被清空。 */
  private readonly previewGhost = new Container()
  private readonly scenery = new Container()
  private readonly light = new Graphics()
  private readonly shimmer = new Graphics()
  private readonly cabin = new Container()
  private trip: { from: number; to: number; time: number; done(): void; position(y: number): void } | null = null
  constructor(private art: DeepTextures = {}) {
    this.view.addChild(this.light, this.scenery)
    this.foreground.addChild(this.shimmer, this.cabin, this.previewGhost, this.preview)
  }
  setArt(art: DeepTextures): void { this.art = art }
  private label(text: string, x: number, y: number, size = 11, color = 0xc8ddd9): void {
    const label = new Text({ text, style: { fontFamily: 'Microsoft YaHei, sans-serif', fontSize: size, fill: color, stroke: { color: 0x1a2933, width: 3 } } })
    label.anchor.set(.5, 1); label.position.set(x * T, y * T); this.scenery.addChild(label)
  }
  refresh(w: WorldState): void {
    for (const c of this.scenery.removeChildren()) c.destroy({ children: true })
    this.light.clear()
    const g = new Graphics(); this.scenery.addChild(g)
    const x = w.exploration.shaftX
    if (w.farm.sharedMeals > 0 && !w.deep.metAyan) {
      this.sprite('ayan', (AYAN_SPOT.x + .5) * T, (AYAN_SPOT.y + 1) * T, 46, 44)
      g.ellipse((AYAN_SPOT.x + .5) * T, (AYAN_SPOT.y + .8) * T, 13, 4).fill({ color: 0xcab58b, alpha: .4 })
      this.label('沙沙… 有谁在搬石头？', AYAN_SPOT.x, 19.7, 12, 0xe2c89e)
    }
    if (w.deep.metAyan && x !== null) {
      const frontier = deepFrontier(w)
      if (frontier) g.moveTo((x + .25) * T, (frontier.y + .1) * T).lineTo((x + .6) * T, (frontier.y + .5) * T).lineTo((x + .35) * T, (frontier.y + .9) * T).stroke({ width: 2, color: 0xb7d9e0 })
      for (const y of deepLadderSegments(w)) {
        g.moveTo((x + .22) * T, y * T).lineTo((x + .22) * T, (y + 1) * T).moveTo((x + .78) * T, y * T).lineTo((x + .78) * T, (y + 1) * T).stroke({ width: 3, color: 0xa28a68 })
        for (const dy of [.25, .65]) g.moveTo((x + .22) * T, (y + dy) * T).lineTo((x + .78) * T, (y + dy) * T).stroke({ width: 2, color: 0xc4a77a })
      }
      if (w.deep.supported) for (const y of [13, 17, 24, 28]) {
        g.rect((x + .04) * T, y * T, T * .92, 5).fill(0xb59d7e)
        g.moveTo((x + .1) * T, y * T + 15).lineTo((x + .5) * T, y * T + 4).lineTo((x + .9) * T, y * T + 15).stroke({ width: 2, color: 0x958269 })
      }
    }
    if (!w.deep.entered) { this.drawCabin(w); return }
    const span = deepSpan(w)
    if (span) for (let col = span.left; col <= span.right; col++) {
      for (const y of [31, 32, 33]) {
        if (w.tiles[y][col] !== TILE.EMPTY) continue
        this.light.rect(col * T, y * T, T, T).fill({ color: 0x636f97, alpha: .08 })
      }
      // 岩壁中的细小晶纹，避开前侧通行与角色。
      if (col % 3 === 0 && w.tiles[31][col] === TILE.EMPTY) g.moveTo((col + .1) * T, 31.15 * T).lineTo((col + .4) * T, 31.45 * T).lineTo((col + .8) * T, 31.2 * T).stroke({ width: 1, color: 0x9dadcc, alpha: .38 })
    }
    if (span && CRYSTAL_SPOT.x >= span.left && CRYSTAL_SPOT.x <= span.right) {
      this.sprite('collector', (CRYSTAL_SPOT.x + .5) * T, 34 * T, 64, 70, .85)
      if (!w.deep.foundCrystal) this.label('点点岩壁上的晶光', CRYSTAL_SPOT.x + .5, 30.5, 12, 0xc4deef)
    }
    for (const f of w.deep.facilities) {
      const spec = DEEP_SPECS[f.kind], left = f.x * T, width = spec.width * T
      if (f.kind !== 'lamp') {
        // 设施嵌进洞壁，石质门框和地台不另占一格前侧通道。
        g.roundRect(left + 2, 31.1 * T, width - 4, 2.85 * T, 17).fill({ color: 0x28333f, alpha: .8 }).stroke({ width: 5, color: 0x62626d })
        g.moveTo(left + 6, 33.95 * T).lineTo(left + width - 6, 33.95 * T).stroke({ width: 5, color: 0x8d8581 })
        this.sprite(f.kind, left + width / 2, 33.92 * T, width - 12, 70)
      } else {
        g.roundRect(left + 8, 31.45 * T, 16, 22, 5).fill(0x819fae).stroke({ width: 2, color: 0x42596a })
        g.poly([left + 16, 31.5 * T, left + 21, 31.75 * T, left + 16, 32 * T, left + 11, 31.75 * T]).fill(0xd0f1ee)
        for (const p of deepLampCoverage(w, f.x)) this.light.rect(p.x * T, p.y * T, T, T).fill({ color: 0xa2d8e6, alpha: .2 * p.strength })
      }
      this.label(spec.name, f.x + spec.width / 2, 30.85, 10, 0xd3d6da)
    }
    if (hasDeep(w, 'distributor') && x !== null) {
      g.moveTo((x + .85) * T, 20.8 * T).lineTo((x + .85) * T, 30.7 * T)
      for (let col = span?.left ?? x; col <= (span?.right ?? x); col++) if (w.tiles[31]?.[col] === TILE.EMPTY) {
        g.moveTo(col * T, 31.18 * T).lineTo((col + 1) * T, 31.18 * T)
      }
      g.stroke({ width: 1.5, color: 0x98c4cb, alpha: .65 })
    }
    for (const p of [MOSS_SPOT, DRILL_SPOT]) if (w.tiles[p.y]?.[p.x] === TILE.EMPTY) {
      if (p === MOSS_SPOT) {
        for (let i = 0; i < 5; i++) g.ellipse((p.x + .15 + i * .15) * T, (p.y + .75 - i % 2 * .08) * T, 4, 2).fill({ color: 0xb7c8f0, alpha: .6 })
      } else {
        g.moveTo((p.x + .25) * T, (p.y + .8) * T).lineTo((p.x + .8) * T, (p.y + .65) * T).stroke({ width: 5, color: 0x9b8f75 })
        for (let i = 0; i < 4; i++) g.moveTo((p.x + .3 + i * .12) * T, (p.y + .65) * T).lineTo((p.x + .4 + i * .12) * T, (p.y + .85) * T).stroke({ width: 1, color: 0xd3c4a0 })
      }
    }
    this.drawCabin(w)
  }
  private sprite(key: keyof DeepTextures, x: number, bottom: number, width: number, maxHeight: number, alpha = 1, target: Container = this.scenery): void {
    const texture = this.art[key]
    if (!texture) {
      const g = new Graphics().roundRect(x - width / 2, bottom - 35, width, 35, 4).fill(0x8d9ca5).stroke({ width: 2, color: 0xb9d5db })
      g.alpha = alpha; target.addChild(g); return
    }
    const sprite = new Sprite(texture)
    const scale = Math.min(width / texture.width, maxHeight / texture.height)
    sprite.scale.set(scale); sprite.anchor.set(.5, 1); sprite.position.set(x, bottom); sprite.alpha = alpha
    target.addChild(sprite)
  }
  private drawCabin(w: WorldState): void {
    if (this.trip) return
    for (const c of this.cabin.removeChildren()) c.destroy({ children: true })
    if (!w.deep.lift || w.exploration.shaftX === null) return
    const sprite = new Sprite(this.art.lift ?? undefined)
    sprite.width = 30; sprite.height = 44; sprite.anchor.set(.5, 1)
    this.cabin.addChild(sprite)
    this.cabin.position.set((w.exploration.shaftX + .5) * T, ((w.exploration.explorer?.y ?? DEEP_FOOT) + 1) * T)
  }
  travelLift(w: WorldState, from: number, to: number, done: () => void, position: (y: number) => void): void {
    this.drawCabin(w)
    this.trip = { from, to, time: 0, done, position }
  }
  cancel(): void { this.trip = null }
  update(w: WorldState | null, time: number, dt: number): void {
    if (!w) return
    this.shimmer.clear()
    if (w.deep.entered) {
      for (let i = 0; i < 7; i++) {
        const x = 24 + (i * 1.7) % 12, y = 31.3 + (Math.sin(time * .35 + i) + 1) * .7
        if (w.tiles[Math.floor(y)]?.[Math.floor(x)] === TILE.EMPTY) this.shimmer.circle(x * T, y * T, 1).fill({ color: 0xc8d9ed, alpha: .15 + .12 * Math.sin(time * 1.2 + i) })
      }
    }
    const trip = this.trip
    if (trip) {
      trip.time += dt
      const t = Math.min(1, trip.time / 3), ease = t * t * (3 - 2 * t)
      this.cabin.y = (trip.from + (trip.to - trip.from) * ease + 1) * T
      trip.position(trip.from + (trip.to - trip.from) * ease)
      if (t === 1) { this.trip = null; trip.done() }
    }
  }
  /**
   * 选址预览：先在岩壁上放出这间设施的半透明影子，再在旁边写清能不能建。
   * 前两层放蓝图时也是这样"看到东西、看到一句话"，孩子不用低头读面板。
   */
  placePreview(w: WorldState, kind: DeepFacilityKind | null, x: number | null): void {
    this.preview.clear()
    for (const child of this.previewGhost.removeChildren()) child.destroy({ children: true })
    if (!kind || x === null) return
    const spec = DEEP_SPECS[kind], left = x * T, width = spec.width * T
    const problem = deepBuildProblem(w, kind, x), valid = problem === null
    const color = valid ? 0xa5d9cc : 0xe2b798
    this.preview.roundRect(left + 2, 31 * T + 2, width - 4, 3 * T - 4, 9).fill({ color, alpha: .2 }).stroke({ width: 3, color })
    if (kind === 'lamp') {
      const g = new Graphics()
      g.roundRect(left + 8, 31.45 * T, 16, 22, 5).fill({ color: 0x819fae, alpha: valid ? .75 : .45 }).stroke({ width: 2, color: 0x42596a })
      g.poly([left + 16, 31.5 * T, left + 21, 31.75 * T, left + 16, 32 * T, left + 11, 31.75 * T]).fill({ color: 0xd0f1ee, alpha: .8 })
      this.previewGhost.addChild(g)
    } else this.sprite(kind, left + width / 2, 33.92 * T, width - 12, 70, valid ? .62 : .34, this.previewGhost)
    this.previewHint(problem ?? '可以搭在这里', valid, left + width / 2)
  }
  private previewHint(text: string, valid: boolean, centerX: number): void {
    const label = new Text({
      text,
      style: { fontFamily: 'Microsoft YaHei, sans-serif', fontSize: 12, fontWeight: '700', fill: valid ? 0xc8f7d2 : 0xffd0c4, align: 'center', wordWrap: true, wordWrapWidth: 210 },
    })
    label.anchor.set(.5, 1)
    const bg = new Graphics()
    bg.roundRect(-label.width / 2 - 9, -label.height - 12, label.width + 18, label.height + 12, 8).fill({ color: 0x16252b, alpha: .86 })
    label.position.set(0, -5)
    const tag = new Container()
    tag.addChild(bg, label)
    tag.position.set(centerX, 30.72 * T)
    this.previewGhost.addChild(tag)
  }
}
