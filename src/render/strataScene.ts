import { Container, Graphics, Text, TilingSprite, type Texture } from 'pixi.js'
import { MAP_WIDTH, STRATA, TILE_SIZE as T } from '../core/world'

/** 延续已有地形 PNG，只以冷色调和天然洞轮廓区别深层。无新玩法状态。 */
export function terrainTint(y: number): number {
  if (y >= STRATA.water.top) return 0x91bcca
  if (y >= STRATA.seal.top) return 0x7d91a5
  return 0xffffff
}

export function createStrataBackdrop(texture: Texture): Container {
  const layer = new Container()
  const bg = new TilingSprite({ texture, width: MAP_WIDTH * T, height: (STRATA.water.bottom - STRATA.water.top) * T })
  bg.y = STRATA.water.top * T
  bg.tint = 0x7fa9ba
  layer.addChild(bg)
  return layer
}

/** 常驻地层标记放在黑暗遮罩之上，缩远仍能读懂上下关系。 */
export function createStrataLabels(): Container {
  const layer = new Container()
  const label = (text: string, x: number, y: number, color: number, size = 20) => {
    const view = new Text({ text, style: { fontFamily: '"Microsoft YaHei", sans-serif', fontSize: size, fontWeight: '600', fill: color } })
    view.position.set(x * T, y * T)
    layer.addChild(view)
  }
  const rock = new Graphics()
  for (const y of [STRATA.seal.top, STRATA.water.top]) {
    rock.moveTo(2 * T, y * T).lineTo((MAP_WIDTH - 2) * T, y * T).stroke({ color: 0xa5b6c3, alpha: 0.3, width: 2 })
  }
  layer.addChild(rock)
  label('第 1 层 · 暖窝层', 14, 5.1, 0xf6dfb5)
  label('厚厚的岩层 · 找找有裂纹的地方', 8, STRATA.seal.top + 0.8, 0xc4d0dc, 16)
  label('第 2 层 · 泉水层', 8, STRATA.water.top + 0.4, 0xaddbe1)
  return layer
}
