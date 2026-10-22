import { Container, Graphics } from 'pixi.js'

/**
 * 第二层生活设施的程序化造型：灶台与餐桌。
 * 与种植槽、睡眠舱同一套简洁画法；没有正式素材时也不改变整体手绘方向。
 */
const OUTLINE = 0x3d3429
const STONE = 0x9a9184
const WOOD = 0xa97c50
const WOOD_DARK = 0x7b5638

/** 灶台：石砌台面、黑锅、火苗与一缕热气。 */
export function drawStove(x: number, y: number, w: number, h: number): Container {
  const view = new Container()
  const g = new Graphics()
  const left = x + 10, right = x + w - 10
  const floor = y + h - 8
  const top = floor - 30

  g.ellipse(x + w / 2, floor, (w - 24) / 2, 7).fill({ color: 0x1c2724, alpha: 0.35 })
  g.roundRect(left, top, right - left, 30, 4).fill(STONE).stroke({ width: 2, color: OUTLINE })
  g.rect(left + 3, top + 3, right - left - 6, 5).fill(0xb5ada0)
  // 炉口和火苗
  g.roundRect(left + 7, top + 12, 20, 13, 3).fill(0x342d27).stroke({ width: 1.5, color: OUTLINE })
  g.moveTo(left + 17, top + 22).lineTo(left + 13, top + 15).lineTo(left + 17, top + 17)
    .lineTo(left + 21, top + 13).lineTo(left + 20, top + 22).closePath().fill(0xf2a04a)
  // 锅
  g.roundRect(left + 36, top - 1, 24, 13, 4).fill(0x4c4c4b).stroke({ width: 2, color: OUTLINE })
  g.rect(left + 33, top - 2, 30, 3).fill(0x70706d)
  g.circle(left + 48, top + 1, 2).fill(0x2f2f2e)
  // 热气
  for (let i = 0; i < 3; i++) {
    const sx = left + 42 + i * 7
    g.moveTo(sx, top - 6).bezierCurveTo(sx - 4, top - 12, sx + 4, top - 18, sx, top - 24)
      .stroke({ width: 2, color: 0xf4efe1, alpha: 0.55 - i * 0.12 })
  }
  // 台面上的小罐和柴火
  g.roundRect(right - 15, top - 9, 11, 10, 3).fill(0xc9b48c).stroke({ width: 1.5, color: OUTLINE })
  g.rect(left - 2, floor - 11, 12, 5).fill(WOOD_DARK)
  g.rect(left + 1, floor - 15, 12, 5).fill(WOOD)

  view.addChild(g)
  return view
}

/** 餐桌：木桌面、四条腿、四只小盘子；围坐时伙伴会站在桌前的座位上。 */
export function drawDiningTable(x: number, y: number, w: number, h: number): Container {
  const view = new Container()
  const g = new Graphics()
  const floor = y + h - 8
  const tableTop = floor - 24
  const left = x + 14, right = x + w - 14

  g.ellipse(x + w / 2, floor, (w - 20) / 2, 7).fill({ color: 0x1c2724, alpha: 0.32 })
  // 桌腿
  for (const legX of [left + 6, right - 10]) {
    g.rect(legX, tableTop + 8, 4, 18).fill(WOOD_DARK)
  }
  // 桌面
  g.roundRect(left, tableTop, right - left, 9, 3).fill(WOOD).stroke({ width: 2, color: OUTLINE })
  g.rect(left + 2, tableTop + 2, right - left - 4, 2).fill(0xc79a6b)
  // 盘子和中间的小锅
  const plates = 4
  for (let i = 0; i < plates; i++) {
    const px = left + 10 + i * ((right - left - 20) / (plates - 1))
    g.ellipse(px, tableTop - 1, 7, 2.6).fill(0xf3ead2).stroke({ width: 1, color: 0x9d8f73 })
    g.circle(px, tableTop - 2, 2).fill(0xe2a75e)
  }
  g.roundRect(x + w / 2 - 8, tableTop - 10, 16, 9, 3).fill(0x8c5f3d).stroke({ width: 1.5, color: OUTLINE })
  // 两侧小凳，给围坐留出位置感
  for (const side of [left - 8, right + 2]) {
    g.roundRect(side, tableTop + 12, 7, 5, 2).fill(0xb08a60).stroke({ width: 1.2, color: OUTLINE })
  }

  view.addChild(g)
  return view
}
