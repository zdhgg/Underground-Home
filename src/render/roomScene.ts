import { Container, Graphics, Text } from 'pixi.js'
import { ROOM_NAMES } from '../core/rooms'
import { TILE, TILE_SIZE as T, type Room, type RoomKind, type WorldState } from '../core/world'
import { excavationLeft } from '../core/roomConstruction'
import type { RoomPreview } from '../app/roomEditor'
import { BUILDING_SITES, siteBuilt, siteVisible } from '../core/sites'
import { nestShell, type NestTextures } from './nestArt'
import { drawLounge, type LoungeTextures } from './loungeArt'
import { siteBlueprint } from './siteBlueprint'

const COLORS: Record<RoomKind, { floor: number; wall: number; ink: number }> = {
  home: { floor: 0xbfa075, wall: 0xdac6a4, ink: 0x594d39 },
  garden: { floor: 0x83a989, wall: 0xb7d0a5, ink: 0x385b43 },
  lounge: { floor: 0x7faaaa, wall: 0xb4d1cd, ink: 0x385657 },
}

/** 岩层中的地面、角部饰条与小标牌；全部是视觉，不参与碰撞。 */
export class RoomScene {
  readonly view = new Container()
  readonly overlay = new Container()
  private zoom = 1
  private textures?: NestTextures
  setTextures(textures: NestTextures): void { this.textures = textures }
  private loungeTextures?: LoungeTextures
  setLoungeTextures(textures: LoungeTextures): void { this.loungeTextures = textures }
  refresh(world: WorldState, preview: RoomPreview | null): void {
    for (const c of this.view.removeChildren()) c.destroy({ children: true })
    for (const c of this.overlay.removeChildren()) c.destroy({ children: true })
    for (const room of world.rooms) {
      const view = this.drawRoom(room, world)
      if (preview?.room.id === room.id && room.status !== 'blueprint') view.alpha = .25
      this.view.addChild(view)
    }
    for (const site of BUILDING_SITES) {
      if (!siteVisible(world, site)) continue
      const built = world.builtSites.find(b => b.id === site.id)
      if (built && site.layer === 'water') {
        this.view.addChild(this.drawRoom({ ...site, id: -1, kind: built.kind, managed: true }, world))
        continue
      }
      if (siteBuilt(world, site)) continue
      this.overlay.addChild(siteBlueprint(site))
    }
    if (preview) {
      const r = preview.room, g = new Graphics(), color = preview.valid ? 0xa6d3ad : 0xe8ae87
      const built = world.rooms.some(room => room.status !== 'blueprint' && room.kind === r.kind && room.x === r.x && room.y === r.y && room.w === r.w && room.h === r.h)
      if (!built) {
        g.roundRect(r.x * T + 2, r.y * T + 2, r.w * T - 4, r.h * T - 4, 6).fill({ color, alpha: .12 }).stroke({ width: 2, color, alpha: .9 })
        this.overlay.addChild(g)
      } else g.destroy()
      const label = new Text({ text: preview.valid ? `${ROOM_NAMES[r.kind]} · 就在这里` : '这里还没准备好', style: {
        fontFamily: '"Microsoft YaHei", sans-serif', fontSize: 11, fill: preview.valid ? 0xe3f3dc : 0xffd6b4,
        fontWeight: '600', stroke: { color: 0x243d39, width: 3 },
      } })
      label.anchor.set(.5, 1); label.position.set((r.x + r.w / 2) * T, r.y * T - 5)
      if (!built && !world.rooms.some(room => room.id === r.id)) this.overlay.addChild(label)
      else label.destroy()
    }
    this.setZoom(this.zoom)
  }
  private drawRoom(r: Room, world: WorldState): Container {
    const view = new Container(), g = new Graphics(), c = COLORS[r.kind]
    const x = r.x * T, y = r.y * T, width = r.w * T, height = r.h * T
    if (r.status === 'blueprint') {
      for (let cy = r.y; cy < r.y + r.h; cy++) for (let cx = r.x; cx < r.x + r.w; cx++) {
        const empty = world.tiles[cy]?.[cx] === TILE.EMPTY
        g.rect(cx * T + 3, cy * T + 3, T - 6, T - 6).fill({ color: empty ? 0x90bb9f : 0x8ed4df, alpha: empty ? .06 : .12 }).stroke({ width: 1, color: empty ? 0x90bb9f : 0x8ed4df, alpha: .55 })
        if (!empty) g.moveTo(cx * T + 9, cy * T + 23).lineTo(cx * T + 23, cy * T + 9).stroke({ width: 1, color: 0xb6e5e9, alpha: .65 })
      }
      g.rect(x + 1, y + 1, width - 2, height - 2).stroke({ width: 2, color: 0x9ccfd2, alpha: .85 })
      const label = new Text({ text: `${ROOM_NAMES[r.kind]}蓝图 · 还剩${excavationLeft(world, r)}格`, style: { fontFamily: 'Microsoft YaHei, sans-serif', fontSize: 11, fill: 0xd9f1ef, stroke: { color: 0x243d39, width: 3 } } })
      label.anchor.set(.5, 1); label.position.set(x + width / 2, y - 4); label.label = 'room-name'
      view.addChild(g, label); return view
    }
    const detailedHome = this.textures && r.kind === 'home' && r.managed && r.h === 3 && r.w % 3 === 0
    if (detailedHome) {
      for (let slot = 0; slot < r.w / 3; slot++) {
        view.addChild(nestShell(this.textures!.shell, x + slot * 3 * T, y, 3 * T))
        const light = new Graphics()
        light.label = 'nest-light'
        light.ellipse(x + (slot * 3 + 1.5) * T, y + 25, 24, 18).fill({ color: 0xffcf79, alpha: .12 })
        view.addChild(light)
      }
    } else if (this.loungeTextures && r.kind === 'lounge' && r.managed) {
      view.addChild(drawLounge(this.loungeTextures, x, y, width, height))
    } else {
      g.roundRect(x + 2, y + 2, width - 4, height - 2, 5).fill({ color: c.wall, alpha: .085 })
      g.rect(x + 2, y + height - 5, width - 4, 5).fill(c.floor)
      // 前侧步道与开放门框可见，但不生成实体碰撞墙。
      g.rect(x + 2, y + height - 15, width - 4, 10).fill({ color: c.floor, alpha: .18 })
      for (const edge of [x + 3, x + width - 3]) g.moveTo(edge, y + height - 8).lineTo(edge, y + height - 50).lineTo(edge + (edge === x + 3 ? 6 : -6), y + height - 50).stroke({ width: 2, color: c.floor, alpha: .7 })
      if (r.kind === 'lounge' && r.managed) {
        for (let n = 0; n < Math.max(1, Math.floor((r.w - 2) / 2)); n++) {
          const sx = x + 28 + n * 2 * T, sy = y + height - 35
          g.roundRect(sx, sy - 14, 40, 22, 5).fill(0x658f83).stroke({ width: 2, color: 0xb5c8af })
          g.roundRect(sx - 2, sy + 3, 44, 9, 3).fill(0x9cbe9a)
          g.moveTo(sx + 4, sy + 12).lineTo(sx + 4, sy + 17).moveTo(sx + 35, sy + 12).lineTo(sx + 35, sy + 17).stroke({ width: 3, color: 0x746553 })
        }
      }
      if (r.kind === 'garden' && r.managed && !world.farm.waterSupplied) {
        const waiting = new Text({ text: '等水来，再种菜', style: { fontFamily: 'Microsoft YaHei, sans-serif', fontSize: 10, fill: 0xa9bfa8 } })
        waiting.anchor.set(.5); waiting.position.set(x + width / 2, y + height / 2); view.addChild(waiting)
      }
      for (let px = x + 12; px < x + width - 4; px += 20) g.moveTo(px, y + height - 4).lineTo(px, y + height).stroke({ width: 1, color: 0x4c4d3f, alpha: .3 })
      // 短角条贴岩壁，不形成新的墙或门槛。
      for (const edge of [x + 3, x + width - 3]) {
        const d = edge === x + 3 ? 1 : -1
        g.moveTo(edge, y + 20).lineTo(edge, y + 4).lineTo(edge + d * 14, y + 4)
          .moveTo(edge, y + height - 16).lineTo(edge, y + height - 6).stroke({ width: 2, color: c.floor, alpha: .75 })
      }
    }
    const name = ROOM_NAMES[r.kind], labelWidth = name.length * 11 + 18, mid = x + width / 2
    const badge = new Container(), plate = new Graphics()
    plate.roundRect(mid - labelWidth / 2, y - 20, labelWidth, 19, 5).fill(0xf4f2df).stroke({ width: 1, color: c.floor })
    const label = new Text({ text: name, style: { fontFamily: '"Microsoft YaHei", sans-serif', fontSize: 11, fill: c.ink, fontWeight: '600' } })
    label.anchor.set(.5); label.position.set(mid, y - 10.5)
    badge.label = 'room-name'; badge.addChild(plate, label)
    view.addChild(g, badge)
    return view
  }
  update(elapsed: number): void {
    for (const room of this.view.children) for (const child of (room as Container).children) {
      if (child.label === 'nest-light') child.alpha = .8 + Math.sin(elapsed * 1.4) * .12
      if (child.label === 'lounge-art') {
        const light = (child as Container).getChildByLabel('lounge-light')
        if (light) light.alpha = .8 + Math.sin(elapsed * 1.4) * .12
      }
    }
  }
  setZoom(zoom: number): void {
    this.zoom = zoom
    for (const room of this.view.children) {
      const label = (room as Container).getChildByLabel('room-name')
      if (label) label.visible = zoom >= .85
    }
  }
}
