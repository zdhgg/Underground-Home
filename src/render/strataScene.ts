import { Container, Graphics, Text, TilingSprite, type Texture } from 'pixi.js'
import { MAP_WIDTH, STRATA, TILE_SIZE as T } from '../core/world'

/** 延续已有地形 PNG，只以冷色调和天然洞轮廓区别深层。无新玩法状态。 */
export function terrainTint(y: number): number {
  if(y>=STRATA.finale.top)return 0xd2bb8b
  if(y>=STRATA.finaleSeal.top)return 0xaaa087
  if(y>=STRATA.ruins.top)return 0xc7b18a
  if(y>=STRATA.ruinsSeal.top)return 0x9e927c
  if(y>=STRATA.ventilation.top)return 0xb4acc4
  if(y>=STRATA.ventilationSeal.top)return 0x898399
  if(y>=STRATA.reservoir.top)return 0xa2bcc5
  if(y>=STRATA.reservoirSeal.top)return 0x7b8d96
  if (y >= STRATA.garden.top) return 0x9dbdae
  if (y >= STRATA.gardenSeal.top) return 0x818f88
  if (y >= STRATA.hall.top) return 0xc4b294
  if (y >= STRATA.hallSeal.top) return 0x958a87
  if (y >= STRATA.crystal.top) return 0xaaa9ce
  if (y >= STRATA.deepSeal.top) return 0x8585a0
  if (y >= STRATA.water.top) return 0x91bcca
  if (y >= STRATA.seal.top) return 0x7d91a5
  return 0xffffff
}

export function createStrataBackdrop(texture: Texture): Container {
  const layer = new Container()
  const bg = new TilingSprite({ texture, width: MAP_WIDTH * T, height: (STRATA.finale.bottom - STRATA.water.top) * T })
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
  label('晶纹硬岩盖层 · 阿岩知道怎样凿', 8, 25, 0xaeb4ce, 15)
  label('第 3 层 · 晶簇层', 8, 29.3, 0xc1c9e3)
  label('旧大厅岩盖 · 先装牢新支撑', 8, 38, 0xc9b59a, 15)
  label('第 4 层 · 暖光大厅', 8, 42.2, 0xe7cba0)
  label('潮湿岩盖 · 先导走台阶的水', 8, 51, 0xa6c8be, 15)
  label('第 5 层 · 菌光花园', 8, 55.1, 0xb3d7bf)
  label('渗水岩盖 · 先装牢止水护框',8,63,0xaac6d0,15)
  label('第 6 层 · 蓄水回廊',8,67.1,0xb6d7df)
  label('旧风井岩盖 · 护框装好再施工',8,75,0xbeb3ce,15)
  label('第 7 层 · 听风工区',8,79.1,0xccc1d8)
  label('旧地脉岩盖 · 托稳旧拱再向下',8,87,0xc9b89a,15)
  label('第 8 层 · 旧地脉遗迹',8,90.2,0xdec7a2)
  label('暖晶岩盖 · 托稳最后一段新路',8,99,0xcab98e,15)
  label('第 9 层 · 地心暖光',8,102.2,0xe3ca96)
  return layer
}
