import { Container, Graphics, Text } from 'pixi.js'
import type { BuildingSite } from '../core/sites'
import { TILE_SIZE as T } from '../core/world'

/** A cutaway plan drawn inside the actual excavation footprint. Visuals only. */
export function siteBlueprint(site: BuildingSite): Container {
  const view = new Container()
  view.label = `site-blueprint:${site.id}`
  view.position.set(site.x * T, site.y * T)
  const w = site.w * T, h = site.h * T, ink = 0xc6e5db
  const g = new Graphics()
  // Recessed rock opening, inset construction lines and a continuous floor.
  g.roundRect(3, 4, w - 6, h - 7, 13).fill({ color: 0x102e38, alpha: .83 })
    .stroke({ color: 0x85b7af, width: 1.4, alpha: .85 })
  g.roundRect(8, 9, w - 16, h - 17, 9).stroke({ color: ink, width: .6, alpha: .22 })
  for (let x = 16; x < w - 12; x += 16) {
    g.moveTo(x, 31).lineTo(x, h - 22).stroke({ color: ink, width: .5, alpha: .07 })
  }
  g.moveTo(12, h - 22).lineTo(w - 12, h - 22).stroke({ color: ink, width: 1.5, alpha: .7 })
  const art = new Graphics()
  art.position.set((w - 72) / 2, 34)
  const line = { color: ink, width: 1.2, alpha: .9 }
  if (site.kinds[0] === 'home') {
    // Two distinct sleeping places, pillows, folded blankets and bedside lamp.
    for (const x of [2, 40]) {
      art.roundRect(x, 9, 30, 23, 3).fill({ color: 0x78a99f, alpha: .2 }).stroke(line)
      art.roundRect(x + 3, 11, 10, 7, 2).fill({ color: ink, alpha: .4 }).stroke(line)
      art.rect(x + 16, 11, 12, 19).fill({ color: 0x9bc9bc, alpha: .26 })
      art.moveTo(x + 16, 11).lineTo(x + 16, 31).moveTo(x, 5).lineTo(x, 37)
        .moveTo(x + 30, 27).lineTo(x + 30, 37).stroke(line)
    }
    art.moveTo(36, 8).lineTo(36, 1).moveTo(31, 1).lineTo(41, 1).stroke(line)
  } else if (site.kinds[0] === 'lounge') {
    art.roundRect(2, 5, 43, 23, 5).fill({ color: 0x78a99f, alpha: .25 }).stroke(line)
    art.roundRect(0, 19, 47, 11, 3).stroke(line)
    art.moveTo(23, 8).lineTo(23, 19).moveTo(5, 30).lineTo(5, 36)
      .moveTo(41, 30).lineTo(41, 36).stroke(line)
    art.ellipse(60, 23, 12, 4).fill({ color: ink, alpha: .16 }).stroke(line)
    art.moveTo(60, 27).lineTo(60, 36).stroke(line)
    art.roundRect(56, 13, 7, 7, 2).stroke(line)
    art.moveTo(64, 14).lineTo(67, 14).lineTo(67, 18).lineTo(64, 18).stroke(line)
  } else {
    for (const x of [2, 40]) {
      art.moveTo(x + 2, 26).lineTo(x + 5, 36).lineTo(x + 27, 36).lineTo(x + 30, 26)
        .closePath().fill({ color: 0x78a99f, alpha: .25 }).stroke(line)
      art.ellipse(x + 16, 26, 14, 3).stroke(line)
      for (const dx of [10, 23]) {
        art.moveTo(x + dx, 25).lineTo(x + dx, 10).stroke(line)
        art.ellipse(x + dx - 4, 14, 5, 2.5).fill({ color: ink, alpha: .45 })
        art.ellipse(x + dx + 4, 19, 5, 2.5).fill({ color: ink, alpha: .45 })
      }
    }
  }
  const title = new Text({ text: site.name, style: {
    fontFamily: 'Microsoft YaHei, sans-serif', fontSize: Math.min(11, (w - 20) / site.name.length), fontWeight: '600', fill: 0xe0f0e5,
  } })
  title.anchor.set(.5); title.position.set(w / 2, 20)
  const action = new Text({ text: '＋ 点我建造', style: {
    fontFamily: 'Microsoft YaHei, sans-serif', fontSize: 9, fill: 0xc6e5db,
  } })
  action.anchor.set(.5); action.position.set(w / 2, h - 12)
  view.addChild(g, art, title, action)
  return view
}
