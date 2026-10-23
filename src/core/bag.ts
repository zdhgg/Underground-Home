import { foundRelics, RELICS } from './relics'
import type { WorldState } from './world'

export interface BagItem {
  id: string; kind: 'material' | 'relic'; name: string; count: number; description: string
}
const STORIES: Record<string, string> = {
  'seed-pouch': '小布袋里装着干种子。以前住在这里的伙伴，也盼着有一天能种出新鲜蔬菜。先把它好好收藏起来。',
  wrench: '扳手的边缘磨得亮亮的。它一定帮以前的伙伴修过不少东西，现在成了阿土珍藏的小宝贝。',
  'lamp-shade': '旧灯罩上还有小划痕。它曾照亮过这个家，现在和我们一起留在暖暖的地下。',
  'old-photo': '一张有点泛黄的照片：以前住在这里的伙伴们，围坐在长桌旁一起吃饭。原来这张桌子，很早以前就热闹过。',
  'old-key': '一把旧钥匙，握在手里沉甸甸的。它要开的那扇门，好像还在更深的地方等着谁。',
}

/** 背包与收藏架读取同一份地图，不额外保存旧物数量，撤销和旧档无需另做迁移。 */
export function bagItems(w: WorldState): BagItem[] {
  const found = new Set(foundRelics(w).map(r => r.id))
  return [
    { id: 'stone', kind: 'material', name: '石料', count: w.inventory.stone, description: '修建洞室和菜槽时会用到。挖开泥土或裂纹岩，就有机会找到；建造时自动使用。' },
    { id: 'wood', kind: 'material', name: '旧木料', count: w.inventory.wood, description: '可以修床、做座椅和菜槽。挖土时能找到，建造时会自动从物品栏取用。' },
    ...RELICS.map(r => ({ id: r.id, kind: 'relic' as const, name: r.name, count: found.has(r.id) ? 1 : 0,
      description: found.has(r.id) ? STORIES[r.id]! : '还藏在第一层的泥土里。挖一挖，也许会有小发现！' })),
  ]
}

/** 大厅后墙上的小收藏架，不占可建造地块，不改变通行。 */
export const COLLECTION_SHELF = { x: 17, y: 8, w: 2, h: 1 } as const
