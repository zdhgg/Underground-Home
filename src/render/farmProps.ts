import { Container, Graphics, Sprite } from 'pixi.js'
import { LANDMARKS, STRATA, TILE_SIZE, type Planter, type WorldState } from '../core/world'
import { RIPE_STAGE } from '../core/farm'
import type { EnvironmentTextures } from './environmentArt'
import { siteAt } from '../core/sites'

/**
 * 第二层菜园的生产道具：种植槽（四档外观）与泉水边的水管 / 水缸。
 * 与睡眠舱、遗物同一套程序化画法，不需要新素材。
 */
const OUTLINE = 0x2c3f3a
const SOIL = 0x4a3728
const LEAF = 0x8fd38a
const LEAF_DARK = 0x63a663

/** 水缸在第二层菜园边上的位置（泉眼右侧，不挡伙伴和菜槽） */
export const WATER_BARREL_X = 23.6
export const WATER_BARREL_Y = 21
/** 旧存档的第一层菜园仍要有一条上楼的水管，避免旧家突然断水。 */
const HOME_BARREL_X = 19.4
const HOME_BARREL_Y = 11

const TOMATO = 0xe35d4f
const TOMATO_DARK = 0xb03a30

/** 设施内的两个菜槽向中间收拢，提示与收获反馈也要使用同一个位置。 */
export function planterOffset(world: WorldState, planter: { x: number; y: number }): number | undefined {
  const site = siteAt(planter)
  return site && world.builtSites.some(b => b.id === site.id && b.kind === 'garden')
    ? planter.x === site.x ? .25 : -.25 : undefined
}

export function planterPosition(planter: { x: number; y: number }, offset = 0): { x: number; y: number } {
  return { x: (planter.x + .5 + offset) * TILE_SIZE, y: (planter.y + .9) * TILE_SIZE }
}

export function drawPlanter(planter: Planter, textures: EnvironmentTextures | null = null, compactOffset?: number): Container {
  const view = new Container()
  const g = new Graphics()
  const position = planterPosition(planter, compactOffset)
  view.position.set(position.x, position.y)
  view.label = `planter-stage-${planter.growth}`
  const tomato = planter.crop === 'tomato'
  if (tomato) view.label += '-tomato'
  const image = planter.growth >= RIPE_STAGE ? textures?.planter : textures?.emptyPlanter

  if (image) {
    const sprite = new Sprite(image)
    sprite.anchor.set(.5, .88)
    sprite.width = compactOffset === undefined ? 38 : 32
    sprite.height = compactOffset === undefined ? 34 : 28
    view.addChild(sprite)
  }

  // 木槽 + 槽里的土
  if (!image) {
    g.roundRect(-13, -9, 26, 9, 3).fill(0x8a6247).stroke({ width: 2, color: 0x5b4030 })
    g.rect(-11, -8, 22, 4).fill(SOIL)
  }

  if (!image || planter.growth < RIPE_STAGE) switch (planter.growth) {
    case 0: {
      // 刚种下：土里两颗种子
      g.circle(-3, -6, 1.6).fill(0xd9c295)
      g.circle(3, -6, 1.6).fill(0xd9c295)
      break
    }
    case 1: {
      // 发芽：一根小茎两片嫩叶
      g.moveTo(0, -8).lineTo(0, -15).stroke({ width: 2, color: LEAF_DARK })
      g.ellipse(-4, -15, 4, 2.4).fill(LEAF)
      g.ellipse(4, -17, 4, 2.4).fill(LEAF)
      break
    }
    case 2: {
      // 长大：茎更长、四片叶子；番茄挂上两颗青红小果
      g.moveTo(0, -8).lineTo(0, -22).stroke({ width: 2.5, color: LEAF_DARK })
      g.ellipse(-5, -14, 5, 3).fill(LEAF)
      g.ellipse(5, -18, 5, 3).fill(LEAF)
      g.ellipse(-5, -22, 4.5, 2.8).fill(LEAF)
      g.ellipse(5, -25, 4.5, 2.8).fill(LEAF_DARK)
      if (tomato) {
        g.circle(-3, -17, 2.6).fill(TOMATO).stroke({ width: 1.5, color: TOMATO_DARK })
        g.circle(3.5, -21, 2.2).fill(TOMATO).stroke({ width: 1.5, color: TOMATO_DARK })
      }
      break
    }
    default: {
      // 熟了：叶子更密 + 果实 + 小星星，一眼看出能收
      g.moveTo(0, -8).lineTo(0, -24).stroke({ width: 2.5, color: LEAF_DARK })
      g.ellipse(-6, -13, 5, 3).fill(LEAF)
      g.ellipse(6, -17, 5, 3).fill(LEAF)
      g.ellipse(-6, -21, 5, 3).fill(LEAF_DARK)
      g.ellipse(6, -25, 5, 3).fill(LEAF)
      if (tomato) {
        // 熟透的番茄：一串红果
        g.circle(-3.5, -13, 4.4).fill(TOMATO).stroke({ width: 2, color: TOMATO_DARK })
        g.circle(3.5, -15, 4.4).fill(TOMATO).stroke({ width: 2, color: TOMATO_DARK })
        g.circle(0, -19, 4.4).fill(TOMATO).stroke({ width: 2, color: TOMATO_DARK })
      } else {
        g.circle(0, -14, 5).fill(0xf08a5d).stroke({ width: 2, color: 0xb85c39 })
      }
      g.star(0, -31, 4, 4, 2).fill(0xffe6ad)
      break
    }
  } else if (planter.growth >= RIPE_STAGE) {
    // 素材负责叶片与木槽，代码只补上可收获的果实和提示星光。
    if (tomato) {
      g.circle(-3.5, -13, 4.4).fill(TOMATO).stroke({ width: 2, color: TOMATO_DARK })
      g.circle(3.5, -15, 4.4).fill(TOMATO).stroke({ width: 2, color: TOMATO_DARK })
      g.circle(0, -19, 4.4).fill(TOMATO).stroke({ width: 2, color: TOMATO_DARK })
    } else {
      g.circle(0, -14, 5).fill(0xf08a5d).stroke({ width: 2, color: 0xb85c39 })
    }
    g.star(0, -31, 4, 4, 2).fill(0xffe6ad)
  }

  view.addChild(g)
  return view
}

/** 一格育苗架：木架两层苗盘，盘里是冒芽的番茄苗，带一点淡淡的绿光。 */
export function drawNursery(nursery: { x: number; y: number }): Container {
  const view = new Container({ label: 'nursery', eventMode: 'none' })
  const g = new Graphics({ label: 'nursery-body' })
  g.eventMode = 'none'
  view.position.set((nursery.x + 0.5) * TILE_SIZE, (nursery.y + 1) * TILE_SIZE)
  // 立柱与两层苗盘
  g.rect(-11, -26, 3.5, 26).rect(7.5, -26, 3.5, 26).fill(0x8a6a42)
  g.roundRect(-13, -18, 26, 4, 2).roundRect(-13, -7, 26, 4, 2).fill(0xa5804f)
  // 苗盘里的小番茄苗：细茎 + 两片叶 + 一颗小青果
  for (const [x, y] of [[-8, -18], [0, -18], [8, -18], -4, 4].map(v => Array.isArray(v) ? v : [v, -7]) as [number, number][]) {
    g.moveTo(x, y).lineTo(x, y - 5).stroke({ width: 1.6, color: LEAF_DARK })
    g.ellipse(x - 2.4, y - 4.4, 2.4, 1.4).fill(LEAF)
    g.ellipse(x + 2.4, y - 5.4, 2.4, 1.4).fill(LEAF)
  }
  g.circle(-8, -25, 1.8).circle(8, -14, 1.8).fill(0xd97a55)
  // 淡淡的绿光：育苗的地方有一点生机
  g.ellipse(0, -14, 17, 12).fill({ color: 0xbff0d8, alpha: 0.10 })
  view.addChild(g)
  return view
}

/**
 * 水到菜园的样子：从泉眼沿第二层地面接一条短管，通到菜园边的水缸。
 * 只在 world.farm.waterSupplied 时绘制；水流动感由 PixiRenderer 每帧补。
 */
export function drawWaterLine(world: WorldState, textures: EnvironmentTextures | null = null): Container {
  const view = new Container()
  const g = new Graphics()
  const pipe = 0x9fb6c2
  const legacy = world.farm.planters.some((planter) => planter.y < STRATA.home.bottom)
    || world.rooms.some((room) => room.kind === 'garden' && room.status !== 'blueprint')

  if (legacy) {
    // 旧档：水从泉眼沿梯道回到第一层的水缸，原有菜园继续有水。
    const column = world.exploration.shaftX
    const pipeX = column === null ? HOME_BARREL_X * TILE_SIZE : (column + 0.5) * TILE_SIZE + 9
    const top = HOME_BARREL_Y * TILE_SIZE + 6
    const bottom = 21.9 * TILE_SIZE
    g.roundRect(pipeX - 3, top, 6, bottom - top, 3).fill(pipe).stroke({ width: 1.5, color: 0x5d7a86 })
    for (let y = top + 10; y < bottom - 6; y += 20) g.rect(pipeX - 5, y, 10, 3).fill(0x7d97a3)
    const springX = (LANDMARKS.spring.x + 0.5) * TILE_SIZE
    g.roundRect(Math.min(springX, pipeX) - 2, bottom - 5, Math.abs(pipeX - springX) + 4, 5, 2).fill(pipe).stroke({ width: 1.5, color: 0x5d7a86 })
    const bx = HOME_BARREL_X * TILE_SIZE
    const by = (HOME_BARREL_Y + 1) * TILE_SIZE - 2
    if (textures) {
      const barrel = new Sprite(textures.barrel)
      barrel.anchor.set(.5, .92); barrel.width = 42; barrel.height = 42
      barrel.position.set(bx, by); view.addChild(barrel)
    } else {
      g.roundRect(bx - 11, by - 24, 22, 24, 4).fill(0x8fb6c4).stroke({ width: 2, color: OUTLINE })
      g.rect(bx - 9, by - 21, 18, 6).fill(0xbfe6f2)
      g.roundRect(bx - 12, by - 27, 24, 5, 2).fill(0x5d7a86)
    }
    g.moveTo(pipeX - 3, top + 3).lineTo(bx, top + 3).stroke({ width: 5, color: pipe })
    g.moveTo(bx, top + 3).lineTo(bx, by - 26).stroke({ width: 5, color: pipe })
  } else {
    // 新菜园：泉眼沿第二层地面接到菜园边的水缸。
    const springX = (LANDMARKS.spring.x + 0.5) * TILE_SIZE
    const bx = WATER_BARREL_X * TILE_SIZE
    const by = (WATER_BARREL_Y + 1) * TILE_SIZE - 2
    const pipeY = by - 6
    g.roundRect(Math.min(springX, bx), pipeY, Math.abs(bx - springX), 5, 2).fill(pipe).stroke({ width: 1.5, color: 0x5d7a86 })
    for (let x = Math.min(springX, bx) + 8; x < Math.max(springX, bx) - 4; x += 18) g.rect(x, pipeY - 2, 3, 9).fill(0x7d97a3)
    if (textures) {
      const barrel = new Sprite(textures.barrel)
      barrel.anchor.set(.5, .92); barrel.width = 42; barrel.height = 42
      barrel.position.set(bx, by); view.addChild(barrel)
    } else {
      g.roundRect(bx - 11, by - 24, 22, 24, 4).fill(0x8fb6c4).stroke({ width: 2, color: OUTLINE })
      g.rect(bx - 9, by - 21, 18, 6).fill(0xbfe6f2)
      g.roundRect(bx - 12, by - 27, 24, 5, 2).fill(0x5d7a86)
    }
    g.moveTo(bx - 11, pipeY + 2).lineTo(bx - 11, by - 20).stroke({ width: 5, color: pipe })
  }

  view.addChild(g)
  return view
}

/** 熟了的槽：呼吸光圈（每帧重画，由渲染器调用） */
export function drawRipeGlow(g: Graphics, world: WorldState, elapsed: number): void {
  for (const planter of world.farm.planters) {
    if (planter.growth < RIPE_STAGE) continue
    const position = planterPosition(planter, planterOffset(world, planter))
    const cx = position.x
    const cy = position.y - .4 * TILE_SIZE
    const pulse = 0.6 + 0.4 * Math.sin(elapsed * 3)
    g.circle(cx, cy, 15 + 3 * pulse).stroke({ width: 2, color: 0xffe6ad, alpha: 0.35 + 0.35 * pulse })
    g.circle(cx, cy - 6, 3 + 1.5 * pulse).fill({ color: 0xffeccb, alpha: 0.5 + 0.4 * pulse })
  }
}
