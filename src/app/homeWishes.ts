import { podRect } from '../core/build'
import { ripePlanters } from '../core/farm'
import { stratumAt, type SleepPod, type WorldState } from '../core/world'

/**
 * 家园心愿：把“已经建成、还能回去做点什么”的事从真实世界状态里算出来。
 *
 * 这里不是任务系统：没有领取、提交、奖励、倒计时、完成历史，也不写入存档。
 * 心愿只是那一刻的只读快照；点击时必须重新计算目标，快照永远不能当作执行依据。
 */
export const HOME_WISH_LIMIT = 2

export type HomeWishId = 'nest-warm-lamp' | 'ripe-planter'

export type HomeWishTarget =
  | { kind: 'pod'; podId: number }
  | { kind: 'planter'; planterId: number; x: number; y: number }

export interface HomeWish {
  id: HomeWishId
  emoji: string
  title: string
  detail: string
  actionLabel: string
  target: HomeWishTarget
  /** 只在确实缺东西时出现；材料够用时保持安静，不写“材料充足”。 */
  note?: string
}

/** 第一层小窝：舱体整体落在暖窝层内，不把楼下章节的床铺混进来。 */
export function isFirstFloorPod(pod: SleepPod): boolean {
  const rect = podRect(pod)
  const lastRow = rect.y + rect.h - 1
  return stratumAt(rect.y) === 'home' && stratumAt(lastRow) === 'home'
}

export function firstFloorPods(world: WorldState): SleepPod[] {
  return world.pods.filter(isFirstFloorPod)
}

/** 仍然值得带一盏暖光灯回家的第一层小窝；稳定按建成顺序取第一间。 */
export function firstFloorPodsWithoutWarmLamp(world: WorldState): SleepPod[] {
  return firstFloorPods(world)
    .filter(pod => !pod.warmLamp)
    .sort((a, b) => a.id - b.id || a.y - b.y || a.x - b.x)
}

/** 最靠前的一槽成熟作物（蔬菜或番茄都用同一成熟判定）。 */
export function firstRipePlanter(world: WorldState) {
  return [...ripePlanters(world)].sort((a, b) => a.id - b.id || a.y - b.y || a.x - b.x)[0] ?? null
}

/**
 * 当前可用心愿。最多两条，按固定顺序：先小窝，再菜园。
 * 全部由世界状态即时推导；不需要、也不保存“已接受/进行中/已完成”。
 */
export function homeWishes(world: WorldState): HomeWish[] {
  const wishes: HomeWish[] = []

  if (world.deep.completed) {
    const pending = firstFloorPodsWithoutWarmLamp(world)[0]
    if (pending) {
      wishes.push({
        id: 'nest-warm-lamp',
        emoji: '🪔',
        title: '给小窝添盏暖光灯',
        detail: '第三层做的新部件，可以带回家啦！',
        actionLabel: '去看看小窝',
        target: { kind: 'pod', podId: pending.id },
        ...(world.deep.parts < 1 ? { note: '还差1个工坊部件，可以去第三层再做一个。' } : {}),
      })
    }
  }

  const ripe = firstRipePlanter(world)
  if (ripe) {
    wishes.push({
      id: 'ripe-planter',
      emoji: '🥕',
      title: '菜长熟啦！',
      detail: '小满照顾的菜可以收获啦！',
      actionLabel: '去看看菜园',
      target: { kind: 'planter', planterId: ripe.id, x: ripe.x, y: ripe.y },
    })
  }

  return wishes.slice(0, HOME_WISH_LIMIT)
}

/** 点击时重新解析目标；界面里的旧目标 ID / 坐标不能直接拿来执行。 */
export function homeWishTarget(world: WorldState, id: HomeWishId): HomeWishTarget | null {
  return homeWishes(world).find(wish => wish.id === id)?.target ?? null
}

/** 心愿已经不再成立时，给孩子一句简短解释。 */
export function homeWishUnavailableReason(world: WorldState, id: HomeWishId): string {
  if (id === 'nest-warm-lamp') {
    if (!world.deep.completed) return '第三层的工坊还没完成，暖光灯还做不出来。'
    if (firstFloorPods(world).length === 0) return '第一层还没有小窝，先安一间小窝吧。'
    return '第一层的小窝都装好暖光灯啦。'
  }
  if (id === 'ripe-planter') return '菜已经收好啦，等下一茬长熟再来。'
  return '这件心愿已经完成啦。'
}
