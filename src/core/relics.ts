import { TILE, tileAt, type WorldState } from './world'

/**
 * 旧避难所的遗物：埋在暖窝层的泥土里，挖开那一格才会露出来。
 *
 * "已发现"直接由地图推导（那一格是否空了），不新增存档字段：
 * 挖掘可以撤销，所以把遗物埋回去也是允许的——再挖开就会再次发现。
 * 遗物不进任务链，玩家完全可以无视它们。
 */
export interface Relic {
  id: string
  x: number
  y: number
  emoji: string
  name: string
  /** 挖到时给孩子的一句话：它以后有什么用 */
  hint: string
}

export const RELICS: readonly Relic[] = [
  { id: 'seed-pouch', x: 4, y: 10, emoji: '🌱', name: '干种子', hint: '别丢！以后有了水，就能种出吃的。' },
  { id: 'wrench', x: 7, y: 11, emoji: '🔧', name: '旧扳手', hint: '阿土的工具箱里多了一件宝贝。' },
  { id: 'lamp-shade', x: 36, y: 10, emoji: '🏮', name: '旧灯罩', hint: '擦一擦，还能亮。' },
  { id: 'old-photo', x: 26, y: 9, emoji: '🖼️', name: '旧照片', hint: '照片里，一群小伙伴围着同一张桌子吃饭。原来很早以前，这里就是一个家。' },
  { id: 'old-key', x: 2, y: 9, emoji: '🗝️', name: '旧钥匙', hint: '一把沉甸甸的旧钥匙。它要开的那扇门，好像藏在更深的地方……' },
]

export const relicAt = (x: number, y: number): Relic | null => RELICS.find((relic) => relic.x === x && relic.y === y) ?? null

export const isRelicFound = (world: WorldState, relic: Relic): boolean => tileAt(world, relic.x, relic.y) === TILE.EMPTY

export const foundRelics = (world: WorldState): Relic[] => RELICS.filter((relic) => isRelicFound(world, relic))

export function relicSummary(world: WorldState): { found: number; total: number } {
  return { found: foundRelics(world).length, total: RELICS.length }
}
