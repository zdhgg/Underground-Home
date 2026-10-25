import { Assets, Container, Graphics, Sprite, Text, type Texture } from 'pixi.js'
import bell from '../assets/art/garden/bell-v1.png'
import fan from '../assets/art/garden/fan-v1.png'
import rill from '../assets/art/garden/rill-v1.png'
import taitai from '../assets/art/garden/taitai-v2.png'
import { gardenBuildProblem } from '../core/garden'
import { GARDEN_FOOT, GARDEN_TOP, TAITAI_SPOT, gardenClearColumn, gardenLight, gardenSpan, gardenWidth } from '../core/gardenTopology'
import { TILE, TILE_SIZE as T, type GardenFacilityKind, type WorldState } from '../core/world'
export const GARDEN_ART_URLS = { bell, fan, rill, taitai }
type GardenTextures = Partial<Record<keyof typeof GARDEN_ART_URLS, Texture>>
export async function loadGardenTextures(): Promise<GardenTextures> {
  const art: GardenTextures = {}
  await Promise.all(Object.entries(GARDEN_ART_URLS).map(async ([key, url]) => {
    try { const t = await Assets.load<Texture>(url); t.source.scaleMode = 'linear'; t.source.autoGenerateMipmaps = true; art[key as keyof GardenTextures] = t }
    catch { console.warn(`菌光花园 ${key} 图片未加载，保留简洁备用绘制。`) }
  }))
  return art
}
/** 设施、管槽、菌毯和柔光留在后侧；角色与主要提示在前侧。 */
export class GardenScene {
  readonly view = new Container({ label: 'fungal-garden' })
  readonly foreground = new Container({ label: 'fungal-garden-front' })
  readonly preview = new Graphics()
  private readonly motes = new Graphics()
  private art: GardenTextures = {}
  constructor() { this.foreground.addChild(this.motes, this.preview) }
  setArt(art: GardenTextures): void { this.art = art }
  refresh(w: WorldState): void {
    for (const child of this.view.removeChildren()) child.destroy({ children: true })
    const g = new Graphics(); this.view.addChild(g)
    const state = w.garden, shaft = w.exploration.shaftX
    if (!w.hall.completed || shaft === null) return
    if (!state.drained) {
      g.ellipse((shaft + .5) * T, 46.92 * T, 12, 3).fill({ color: 0x82b9c0, alpha: .65 })
      this.label(state.inspected ? '先把水导到侧槽' : '滴答… 下面有一小片光', shaft + .5, 45.1)
    } else {
      g.moveTo((shaft - .1) * T, 46.75 * T).lineTo((shaft - .1) * T, 47.1 * T).lineTo((shaft - .55) * T, 47.1 * T).stroke({ width: 4, color: 0x7b9a9a })
      for (let y = 47; y <= GARDEN_FOOT; y++) {
        if (w.tiles[y][shaft] !== TILE.EMPTY) break
        for (const dx of [.22, .78]) g.moveTo((shaft + dx) * T, y * T).lineTo((shaft + dx) * T, (y + 1) * T).stroke({ width: 3, color: 0xa38c69 })
        for (const dy of [.25, .65]) g.moveTo((shaft + .22) * T, (y + dy) * T).lineTo((shaft + .78) * T, (y + dy) * T).stroke({ width: 2, color: 0xc7b38c })
      }
    }
    if (!state.entered) return
    const span = gardenSpan(w), light = gardenLight(w)
    if (span) for (let x = span.left; x <= span.right; x++) {
      if (gardenClearColumn(w, x)) {
        g.ellipse((x + .5) * T, 58.92 * T, 15, 2).fill({ color: 0x779279, alpha: .2 })
        if (x % 3 === 0) g.moveTo(x * T, 55.15 * T).lineTo((x + .25) * T, 55.4 * T).lineTo((x + .3) * T, 55.1 * T).stroke({ width: 2, color: 0x71948a, alpha: .35 })
      }
      if (light.has(x)) for (let y = 55; y <= 58; y++) if (w.tiles[y][x] === TILE.EMPTY) g.rect(x * T, y * T, T, T).fill({ color: 0x8ddacb, alpha: .12 })
    }
    if (w.tiles[58][TAITAI_SPOT.x] === TILE.EMPTY && !state.facilities.some(f => TAITAI_SPOT.x >= f.x && TAITAI_SPOT.x < f.x + gardenWidth(f.kind))) {
      this.sprite('bell', (TAITAI_SPOT.x + 1) * T, 58.85 * T, 54, 35)
      if (!state.metTaitai) { this.sprite('taitai', (TAITAI_SPOT.x + .5) * T, 59 * T, 42, 42); this.label('菌丛旁的螺旋小壳', TAITAI_SPOT.x + .5, 56.7) }
    }
    const source = state.facilities.find(f => f.kind === 'rill')
    if (source && span) {
      for (let x = Math.min(source.x, shaft); x <= Math.max(source.x + 2, shaft); x++) if (gardenClearColumn(w, x)) g.moveTo(x * T, 58.25 * T).lineTo((x + 1) * T, 58.25 * T).stroke({ width: 2, color: 0x83b4bc, alpha: .6 })
      for (const bed of state.facilities.filter(f => f.kind === 'bed')) for (let x = Math.min(bed.x, source.x); x <= Math.max(bed.x + 3, source.x + 2); x++) if (gardenClearColumn(w, x)) g.moveTo(x * T, 58.25 * T).lineTo((x + 1) * T, 58.25 * T).stroke({ width: 1.5, color: 0x83b4bc, alpha: .45 })
    }
    for (const x of state.trail) if (gardenClearColumn(w, x)) {
      const color = light.has(x) ? 0xb1e6c6 : 0x7c9e88
      g.moveTo(x * T, 58.84 * T).lineTo((x + .4) * T, 58.7 * T).lineTo((x + .7) * T, 58.9 * T).lineTo((x + 1) * T, 58.77 * T).stroke({ width: 2, color, alpha: .7 })
    }
    for (const f of state.facilities) {
      const x = f.x * T, width = gardenWidth(f.kind) * T
      if (f.kind === 'rill') this.sprite('rill', x + width / 2, 58.9 * T, width - 4, 62)
      if (f.kind === 'bed') {
        g.roundRect(x + 3, 58.4 * T, width - 6, .55 * T, 5).fill(0x515f54).stroke({ width: 3, color: 0x8d9380 })
        if (f.growth) this.sprite(f.variety === 'fan' ? 'fan' : 'bell', x + width / 2, 58.85 * T, width - 6, f.growth === 2 ? 68 : 37)
        else for (let dx = 0; dx < 4; dx++) g.circle((f.x + dx + .5) * T, 58.48 * T, 2.5).fill(0x9cae86)
      }
      if (f.kind === 'lamp') {
        g.roundRect(x + 9, 56.1 * T, 14, 24, 5).fill(0x688a82).stroke({ width: 2, color: 0xb7c6ad })
        g.ellipse(x + 16, 56.38 * T, 4, 7).fill(0xd5efbd)
      }
      if (f.kind === 'bench') {
        g.roundRect(x + 3, 58.25 * T, width - 6, 9, 5).fill(0x9aa18a)
        g.roundRect(x + 8, 58.25 * T + 9, 8, 14, 3).fill(0x6c7969); g.roundRect(x + width - 16, 58.25 * T + 9, 8, 14, 3).fill(0x6c7969)
      }
    }
    if (w.tiles[58][11] === TILE.EMPTY) for (let i = 0; i < 4; i++) g.circle((11.15 + i * .17) * T, (58.7 - i % 2 * .15) * T, 1.5).fill(0xc1d9b6)
    if (w.tiles[58][38] === TILE.EMPTY) g.moveTo(38.1 * T, 57.5 * T).lineTo(38.5 * T, 57.8 * T).lineTo(38.2 * T, 58.2 * T).lineTo(38.8 * T, 58.5 * T).stroke({ width: 2, color: 0xa5aa8b, alpha: .6 })
  }
  private sprite(key: keyof GardenTextures, x: number, bottom: number, width: number, height: number): void {
    const texture = this.art[key]
    if (!texture) { this.view.addChild(new Graphics().roundRect(x - width / 2, bottom - height, width, height, 8).fill(0x687f6d)); return }
    const s = new Sprite(texture); s.label = `garden-${key}`; s.anchor.set(.5, 1); s.scale.set(Math.min(width / texture.width, height / texture.height)); s.position.set(x, bottom); this.view.addChild(s)
  }
  private label(text: string, x: number, y: number): void {
    const t = new Text({ text, style: { fontFamily: 'Microsoft YaHei,sans-serif', fontSize: 11, fill: 0xc0d9cc, stroke: { color: 0x253432, width: 3 } } }); t.anchor.set(.5, 1); t.position.set(x * T, y * T); this.view.addChild(t)
  }
  update(w: WorldState | null, time: number): void {
    const g = this.motes.clear()
    if (!w?.garden.entered) return
    for (const x of gardenLight(w)) if (x % 2 === 0) g.circle((x + .4 + Math.sin(time * .3 + x) * .1) * T, (57.1 + Math.sin(time * .5 + x) * .25) * T, 1).fill({ color: 0xbadcc4, alpha: .18 })
    const rill = w.garden.facilities.find(f => f.kind === 'rill')
    if (rill) g.circle((rill.x + 1.4) * T, (57.8 + (time * .3 % .8)) * T, 1.2).fill({ color: 0xbadbe1, alpha: .5 })
  }
  placePreview(w: WorldState, kind: GardenFacilityKind | null, x: number | null): void {
    this.preview.clear(); if (!kind || x === null) return
    const color = gardenBuildProblem(w, kind, x) ? 0xe1b49d : 0xa6d8be
    this.preview.roundRect(x * T + 2, GARDEN_TOP * T + 2, gardenWidth(kind) * T - 4, 4 * T - 4, 10).fill({ color, alpha: .1 }).stroke({ color, width: 2 })
  }
}
