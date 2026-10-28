import { deepReady } from '../core/deep'
import { hallReady } from '../core/hall'
import { gardenReady } from '../core/garden'
import { reservoirReady } from '../core/reservoir'
import { ventilationReady } from '../core/ventilation'
import { ruinsReady } from '../core/ruins'
import { finaleReady } from '../core/finale'
import type { WorldState } from '../core/world'

export const CHAPTER_ACCESS = {
  crystal: { ready: deepReady, reason: '先找到泉水，把电送到第二层，再和大家吃完第一顿围坐饭，就能去第三层啦。' },
  hall: { ready: hallReady, reason: '先点亮晶簇层，让工坊做出部件，再接通并乘一次三层电梯，就能去暖光大厅啦。' },
  garden: { ready: gardenReady, reason: '先在暖光大厅办完六人暖屋宴，就能去菌光花园啦。' },
  reservoir: { ready: reservoirReady, reason: '先陪苔苔和小满走完菌光花园，就能去蓄水回廊啦。' },
  ventilation: { ready: ventilationReady, reason: '先陪团团和小泉巡看新水路，就能去听风工区啦。' },
  ruins: { ready: ruinsReady, reason: '先陪铃铃和阿木听听家园的风，走完听风工区，就能去旧地脉遗迹啦。' },
  finale: { ready: finaleReady, reason: '先陪阿灯和阿木看完第八层修好的故事，就能去地心暖光啦。' },
} as const
export type ChapterLayer = keyof typeof CHAPTER_ACCESS

export function depthAccess(world: WorldState, layer: ChapterLayer): { available: boolean; reason: string } {
  const access = CHAPTER_ACCESS[layer]
  return { available: access.ready(world), reason: access.reason }
}
