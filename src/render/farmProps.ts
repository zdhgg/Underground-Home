import { Container, Graphics } from 'pixi.js'
import { LANDMARKS, TILE_SIZE, type Planter, type WorldState } from '../core/world'
import { RIPE_STAGE } from '../core/farm'

/**
 * 第一层的生产道具：种植槽（四档外观）与"水到家"的水管 / 水缸。
 * 与睡眠舱、遗物同一套程序化画法，不需要新素材。
 */
const OUTLINE = 0x2c3f3a
const SOIL = 0x4a3728
const LEAF = 0x8fd38a
const LEAF_DARK = 0x63a663

/** 水桶在暖窝层大厅里的位置（贴着能源核心左边，不挡伙伴的落脚点） */
export const WATER_BARREL_X = 19.4
export const WATER_BARREL_Y = 11

export function drawPlanter(planter: Planter): Container {
  const view = new Container()
  const g = new Graphics()
  view.position.set((planter.x + 0.5) * TILE_SIZE, (planter.y + 0.9) * TILE_SIZE)

  // 木槽 + 槽里的土
  g.roundRect(-13, -9, 26, 9, 3).fill(0x8a6247).stroke({ width: 2, color: 0x5b4030 })
  g.rect(-11, -8, 22, 4).fill(SOIL)

  switch (planter.growth) {
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
      // 长大：茎更长、四片叶子
      g.moveTo(0, -8).lineTo(0, -22).stroke({ width: 2.5, color: LEAF_DARK })
      g.ellipse(-5, -14, 5, 3).fill(LEAF)
      g.ellipse(5, -18, 5, 3).fill(LEAF)
      g.ellipse(-5, -22, 4.5, 2.8).fill(LEAF)
      g.ellipse(5, -25, 4.5, 2.8).fill(LEAF_DARK)
      break
    }
    default: {
      // 熟了：叶子更密 + 一颗果实 + 小星星，一眼看出能收
      g.moveTo(0, -8).lineTo(0, -24).stroke({ width: 2.5, color: LEAF_DARK })
      g.ellipse(-6, -13, 5, 3).fill(LEAF)
      g.ellipse(6, -17, 5, 3).fill(LEAF)
      g.ellipse(-6, -21, 5, 3).fill(LEAF_DARK)
      g.ellipse(6, -25, 5, 3).fill(LEAF)
      g.circle(0, -14, 5).fill(0xf08a5d).stroke({ width: 2, color: 0xb85c39 })
      g.star(0, -31, 4, 4, 2).fill(0xffe6ad)
      break
    }
  }

  view.addChild(g)
  return view
}

/**
 * 水到家的样子：水管从泉水沿梯道爬上来，接到大厅里的水缸。
 * 只在 world.farm.waterSupplied 时绘制；水流动感由 PixiRenderer 每帧补。
 */
export function drawWaterLine(world: WorldState): Container {
  const view = new Container()
  const g = new Graphics()
  const column = world.exploration.shaftX
  const pipeX = column === null ? WATER_BARREL_X * TILE_SIZE : (column + 0.5) * TILE_SIZE + 9
  const top = WATER_BARREL_Y * TILE_SIZE + 6
  const bottom = 21.9 * TILE_SIZE
  const pipe = 0x9fb6c2

  // 竖管：贴着木梯旁边，一眼能看出水是从下面来的
  g.roundRect(pipeX - 3, top, 6, bottom - top, 3).fill(pipe).stroke({ width: 1.5, color: 0x5d7a86 })
  for (let y = top + 10; y < bottom - 6; y += 20) g.rect(pipeX - 5, y, 10, 3).fill(0x7d97a3)

  // 横管：从泉水旁边一路铺到梯脚
  const springX = (LANDMARKS.spring.x + 0.5) * TILE_SIZE
  const left = Math.min(springX, pipeX) - 2
  g.roundRect(left, bottom - 5, Math.abs(pipeX - springX) + 4, 5, 2).fill(pipe).stroke({ width: 1.5, color: 0x5d7a86 })

  // 大厅里的水缸
  const bx = WATER_BARREL_X * TILE_SIZE
  const by = (WATER_BARREL_Y + 1) * TILE_SIZE - 2
  g.roundRect(bx - 11, by - 24, 22, 24, 4).fill(0x8fb6c4).stroke({ width: 2, color: OUTLINE })
  g.rect(bx - 9, by - 21, 18, 6).fill(0xbfe6f2)
  g.roundRect(bx - 12, by - 27, 24, 5, 2).fill(0x5d7a86)
  g.moveTo(pipeX - 3, top + 3).lineTo(bx, top + 3).stroke({ width: 5, color: pipe })
  g.moveTo(bx, top + 3).lineTo(bx, by - 26).stroke({ width: 5, color: pipe })

  view.addChild(g)
  return view
}

/** 熟了的槽：呼吸光圈（每帧重画，由渲染器调用） */
export function drawRipeGlow(g: Graphics, world: WorldState, elapsed: number): void {
  for (const planter of world.farm.planters) {
    if (planter.growth < RIPE_STAGE) continue
    const cx = (planter.x + 0.5) * TILE_SIZE
    const cy = (planter.y + 0.5) * TILE_SIZE
    const pulse = 0.6 + 0.4 * Math.sin(elapsed * 3)
    g.circle(cx, cy, 15 + 3 * pulse).stroke({ width: 2, color: 0xffe6ad, alpha: 0.35 + 0.35 * pulse })
    g.circle(cx, cy - 6, 3 + 1.5 * pulse).fill({ color: 0xffeccb, alpha: 0.5 + 0.4 * pulse })
  }
}
