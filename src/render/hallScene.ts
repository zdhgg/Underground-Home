import { Assets, Container, Graphics, Sprite, Text, type Texture } from 'pixi.js'
import shell from '../assets/art/hall/shell-v1.png'
import table from '../assets/art/hall/table-v2.png'
import memory from '../assets/art/hall/memory-v1.png'
import { hallBuildProblem, HALL_SPECS } from '../core/hall'
import { HALL_FOOT, HALL_TOP, MURAL_SPOT, WARM_LIGHT_SPOT, hallFrontier, hallLadderSegments, hallSpan } from '../core/hallTopology'
import { TILE, TILE_SIZE as T, type HallFacilityKind, type WorldState } from '../core/world'

export const HALL_ART_URLS = { shell, table, memory }
type HallTextures = Partial<Record<keyof typeof HALL_ART_URLS, Texture>>
export async function loadHallTextures(): Promise<HallTextures> {
  const art: HallTextures = {}
  await Promise.all(Object.entries(HALL_ART_URLS).map(async ([key, url]) => {
    try { const t = await Assets.load<Texture>(url); t.source.scaleMode = 'linear'; t.source.autoGenerateMipmaps = true; art[key as keyof HallTextures] = t }
    catch { console.warn(`大厅 ${key} 插画加载失败，保留石拱备用绘制。`) }
  }))
  return art
}
/** 后侧设施与暖光；角色始终画在这一层之前，前侧通路留空。 */
export class HallScene {
  readonly view = new Container({ label: 'warm-hall-chapter' })
  readonly preview = new Graphics()
  private art: HallTextures = {}
  setArt(art: HallTextures): void { this.art = art }
  refresh(w: WorldState): void {
    for (const child of this.view.removeChildren()) child.destroy({ children: true })
    const g = new Graphics(); this.view.addChild(g)
    const shaft = w.exploration.shaftX, h = w.hall
    if (!w.deep.completed || shaft === null) return
    const x = shaft * T
    if (!h.braced) {
      g.moveTo(x + 2, 34 * T - 2).lineTo(x + T - 2, 34 * T + 3).stroke({ width: 7, color: 0x957651 })
      g.moveTo(x + T * .52, 34 * T - 5).lineTo(x + T * .4, 34 * T + 4).stroke({ width: 2, color: 0x2e2926 })
      if (!h.entered) this.label(h.inspected ? '先托稳旧木梁' : '吱呀… 梯口下面还有旧门', shaft + .5, 32.2, 0xe7caa0)
    } else {
      for (const y of [34, 38, 42]) {
        g.rect(x - 2, y * T - 5, T + 4, 6).fill(0xc4ab7c)
        g.moveTo(x + 2, y * T + 14).lineTo(x + 16, y * T).lineTo(x + 30, y * T + 14).stroke({ width: 3, color: 0x9faeab })
      }
      for (const y of hallLadderSegments(w)) {
        g.moveTo(x + 7, y * T).lineTo(x + 7, (y + 1) * T).moveTo(x + 25, y * T).lineTo(x + 25, (y + 1) * T).stroke({ width: 3, color: 0xa28a68 })
        for (const dy of [.25, .65]) g.moveTo(x + 7, (y + dy) * T).lineTo(x + 25, (y + dy) * T).stroke({ width: 2, color: 0xd2b889 })
      }
      const f = hallFrontier(w)
      if (f) g.moveTo(x + 9, f.y * T + 3).lineTo(x + 21, f.y * T + 15).lineTo(x + 12, f.y * T + 28).stroke({ width: 2, color: 0xd6c5a4 })
    }
    if (!h.entered) return
    const span = hallSpan(w)
    if (h.powered && span) {
      // 光只覆盖实际挖通的洞；不把岩层涂亮。
      for (let col = span.left; col <= span.right; col++) for (let y = HALL_TOP; y <= HALL_FOOT; y++) if (w.tiles[y][col] === TILE.EMPTY) {
        g.rect(col * T, y * T, T, T).fill({ color: 0xf1bc73, alpha: .09 })
      }
      g.moveTo(x + 28, 33.1 * T).lineTo(x + 28, 43.2 * T).stroke({ width: 1.5, color: 0xddbb82, alpha: .65 })
      for (let col = span.left; col <= span.right; col++) if (w.tiles[43][col] === TILE.EMPTY) g.moveTo(col * T, 43.2 * T).lineTo((col + 1) * T, 43.2 * T).stroke({ width: 1.5, color: 0xddbb82, alpha: .5 })
    }
    for (const f of h.facilities) {
      const width = HALL_SPECS[f.kind].width * T, left = f.x * T
      if (f.kind === 'hall') {
        this.sprite('shell', left + width / 2, 47 * T, width, 4 * T)
        if (h.tableReady) this.sprite('table', left + width / 2, 46.85 * T, width * .82, 1.8 * T)
      } else if (f.kind === 'memory') this.sprite('memory', left + width / 2, 46.25 * T, width - 6, 2.25 * T)
      // 双人小窝由统一的睡眠舱渲染器绘制，复用真实床位与伙伴归属。
    }
    for (const p of [MURAL_SPOT, WARM_LIGHT_SPOT]) if (w.tiles[p.y][p.x] === TILE.EMPTY && !h.facilities.some(f => p.x >= f.x && p.x < f.x + HALL_SPECS[f.kind].width)) {
      if (p === MURAL_SPOT) {
        g.roundRect((p.x + .1) * T, 45.4 * T, 25, 29, 5).fill({ color: 0xc5a77c, alpha: .28 })
        for (let i = 0; i < 3; i++) g.circle((p.x + .25 + i * .22) * T, 45.75 * T, 2).fill(0xb89f7d)
      } else g.roundRect((p.x + .25) * T, 46.5 * T, 14, 8, 3).fill(0xb5a07b)
    }
  }
  private sprite(key: keyof HallTextures, x: number, bottom: number, width: number, height: number): void {
    const t = this.art[key]
    if (!t) { this.view.addChild(new Graphics().roundRect(x - width / 2, bottom - height, width, height, 20).fill(0x4b4540).stroke({ width: 5, color: 0xa18c70 })); return }
    const s = new Sprite(t); s.anchor.set(.5, 1); s.scale.set(Math.min(width / t.width, height / t.height)); s.position.set(x, bottom); this.view.addChild(s)
  }
  private label(text: string, x: number, y: number, color: number): void {
    const t = new Text({ text, style: { fontFamily: 'Microsoft YaHei,sans-serif', fontSize: 11, fill: color, stroke: { color: 0x26323a, width: 3 } } }); t.anchor.set(.5, 1); t.position.set(x * T, y * T); this.view.addChild(t)
  }
  placePreview(w: WorldState, kind: HallFacilityKind | null, x: number | null): void {
    this.preview.clear()
    if (!kind || x === null) return
    const color = hallBuildProblem(w, kind, x) ? 0xe2ad91 : 0xa6d2ad
    this.preview.roundRect(x * T + 2, HALL_TOP * T + 2, HALL_SPECS[kind].width * T - 4, 4 * T - 4, 12).fill({ color, alpha: .12 }).stroke({ color, width: 2 })
  }
}
