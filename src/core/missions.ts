import { LANDMARKS, type Rect, type WorldState } from './world'
import { shaftConnected, springVisible, suggestedBreakthrough, waterSpan } from './exploration'
import { canBuildMorePods, waitingPartners } from './partners'

/**
 * 任务（missions）：给"问题和目标"，不规定唯一解。
 * 完成判定只依赖世界数据（进度位 + 地图），与玩家的操作顺序无关；
 * 进度位单调（撤销挖掘不会让任务回退），自由建设打乱节奏也能正确判定。
 */
export interface Mission {
  id: string
  /** 一句话目标（徽章标题） */
  title: string
  /** 小鼹鼠阿土说的话：为什么 + 现在要做什么（面向 7 岁儿童） */
  speech: string
  /** 现在做什么（短句） */
  todo: string
  /** 做完会发生什么 */
  outcome: string
  /** 完成条件：基于世界数据的纯判定 */
  isDone: (world: WorldState) => boolean
}

/** 第一夜当前主线：找到能源石 → 收好它 → 修好核心 → 安置睡眠舱 */
export const FIRST_NIGHT_MISSIONS: readonly Mission[] = [
  {
    id: 'find-energy-stone',
    title: '找到发光的能源石',
    speech: '家里又黑又冷……挖开左边泛蓝光的泥土，找一找能源石！',
    todo: '点一点泛蓝光的泥土，一格一格挖开它。',
    outcome: '能源石能把家园照亮。',
    isDone: (world) => world.progress.crystalFound,
  },
  {
    id: 'collect-energy-stone',
    title: '收好能源石',
    speech: '找到啦！点一下亮晶晶的小石头，把它收好。',
    todo: '点一下露出来的蓝色能源石。',
    outcome: '拿上它，去修大厅里的大机器。',
    isDone: (world) => world.progress.crystalCollected,
  },
  {
    id: 'repair-energy-core',
    title: '修好能源核心，点亮家园',
    speech: '把能源石放进中间的大机器，家园就能亮起来！',
    todo: '点一下大厅中间的能源核心。',
    outcome: '地下的灯会一盏一盏亮起来！',
    isDone: (world) => world.progress.coreRepaired,
  },
  {
    id: 'build-sleep-pod',
    title: '给伙伴安一个睡眠舱',
    speech: '灯亮啦！找一块能挖通的地方，挖出一块能放下小床的空地，再选“睡眠舱”。放在哪儿由你决定！',
    todo: '挖出一块空地，选位置，确认建造一间双人睡眠舱。',
    outcome: '两位伙伴就能钻进小床休息啦。',
    isDone: (world) => world.pods.length > 0,
  },
]

export interface MissionProgress {
  mission: Mission
  done: boolean
}

/** 全部任务的完成情况 */
export function getMissionProgress(world: WorldState): MissionProgress[] {
  return FIRST_NIGHT_MISSIONS.map((mission) => ({ mission, done: mission.isDone(world) }))
}

/** 当前任务：第一个尚未完成的任务；全部完成时为 null */
export function currentMission(world: WorldState): Mission | null {
  return FIRST_NIGHT_MISSIONS.find((mission) => !mission.isDone(world)) ?? null
}

/** 完成数量汇总（用于进度徽章） */
export function missionSummary(world: WorldState): { done: number; total: number } {
  const progress = getMissionProgress(world)
  return { done: progress.filter((item) => item.done).length, total: progress.length }
}

/** 当前步骤在地图上的高亮指引（线索，不是唯一挖法） */
export type GuideHighlight =
  | { kind: 'dig'; rect: Rect }
  | { kind: 'collect'; rect: Rect }
  | { kind: 'repair'; rect: Rect }
  /** 有了水之后回第一层给新朋友安床 / 种菜 */
  | { kind: 'build'; rect: Rect }
  | { kind: 'none' }

export function guideHighlight(world: WorldState): GuideHighlight {
  const { crystalFound, crystalCollected, coreRepaired } = world.progress
  if (!crystalFound) return { kind: 'dig', rect: LANDMARKS.crystalZone }
  if (!crystalCollected) return { kind: 'collect', rect: LANDMARKS.crystalZone }
  if (!coreRepaired) return { kind: 'repair', rect: LANDMARKS.generatorZone }
  if (world.pods.length) {
    const e = world.exploration
    const x = e.shaftX ?? suggestedBreakthrough(world)
    if (!e.clueFound) return { kind: 'dig', rect: { x, y: 11, w: 1, h: 2 } }
    if (!e.pickaxeUpgraded) return { kind: 'repair', rect: { x, y: 11, w: 1, h: 2 } }
    if (!shaftConnected(world)) {
      const y = Array.from({ length: 10 }, (_, i) => i + 12).find((row) => world.tiles[row][x] !== 0) ?? 12
      return { kind: 'dig', rect: { x, y, w: 1, h: 1 } }
    }
    if (!e.entered) return { kind: 'collect', rect: { x, y: 11, w: 1, h: 2 } }
    if (!e.springFound) {
      const span = waterSpan(world)
      const frontier = span ? span.left > LANDMARKS.spring.x - 1 ? span.left - 1 : span.right + 1 : x
      return { kind: 'collect', rect: { x: springVisible(world) ? LANDMARKS.spring.x : frontier, y: 21, w: 1, h: 1 } }
    }
    // 找到水之后先把它引上来（点面板上的「把水引到家里」）
    if (!world.farm.waterSupplied) return { kind: 'repair', rect: { ...LANDMARKS.spring, w: 1, h: 1 } }
    // 水到家了：给新朋友安床、在第一层种菜——高亮都指回暖窝层的建造建议区
    if (canBuildMorePods(world) || world.farm.harvests === 0) return { kind: 'build', rect: LANDMARKS.buildSuggestion }
  }
  return { kind: 'none' }
}

/**
 * 探索 + 引水 + 种植的主线引导（一步一步只显示当前这一步）。
 * 判定全部来自世界数据，顺序无关；进度位单调，收获过一次就不会回退。
 */
export function explorationGuide(world: WorldState): { title: string; speech: string; outcome: string; done: number; total: number; finished: boolean } {
  const e = world.exploration
  const farm = world.farm
  const connected = shaftConnected(world)
  const waiting = waitingPartners(world)
  // 在找到水之前，这两步都不算数：那时"没等床的伙伴""没收成"只是还没开始。
  const friendsSettled = e.springFound && waiting === 0
  const harvested = farm.harvests > 0
  const done = [e.clueFound, e.pickaxeUpgraded, connected, e.entered, e.springFound, farm.waterSupplied, friendsSettled, harvested].filter(Boolean).length
  const guide = !e.clueFound
    ? ['去找能让新朋友留下的水', '伙伴说：家里要是有水，还有两位朋友愿意搬来住！挖通裂纹上方的泥土，再点一下裂纹——我去听听里面有没有水声。', '有了水，新朋友才肯搬进来。']
    : !e.pickaxeUpgraded
      ? ['换上小铁镐', '裂缝里有凉凉的水汽！换上小铁镐，就能挖开这种带裂纹的岩石。', '坚硬的大岩石还要留着。']
      : !connected
        ? ['亲手挖出向下的梯道', '点带裂纹的岩石，我会走过去一镐一镐挖开、把梯子接长。练两次以后，点「一路挖到底」，我一口气挖到洞底！', '梯子连到洞底，我们才能下去。']
        : !e.entered
          ? ['沿梯子去第二层', '通啦！点“沿梯子下去”，和我一起到新地方看看！', '顺着真实的梯子，抵达泉水层。']
          : !e.springFound
            ? ['找到滴答响的泉水', springVisible(world) ? '泉水露出来啦！点一下泉水，我会沿着地面走过去看看。' : `水声从${(world.exploration.shaftX ?? 27) > LANDMARKS.spring.x ? '左' : '右'}边传来！点着泥土一格一格挖过去，挖到水边我就能走过去看看。`, '找到水源，这里也能成为家园。']
            : !farm.waterSupplied
              ? ['把水引到家里', '找到水啦！点「把水引到家里」，我把水管顺着梯子接到大厅——以后在家就能种菜。', '家里有了水，第一层就能种出吃的。']
              : waiting > 0
                ? ['安顿新朋友', `家里有水了！还有 ${waiting} 位朋友说：有水就搬来住。回暖窝层挖出一块空地，给他们安一张小床吧。`, '伙伴多了，家里更热闹。']
                : !harvested
                  ? ['种出第一份食物', '点「种植槽」，在第一层挖空的地面上摆一个。你每干一件事，它就会长大一档：长熟了再点一下就能收！', '有菜吃，伙伴才住得安心。']
                  : ['家越住越大！', '家里有水、有床、有新鲜菜啦。想继续扩建就往左右挖一挖。', '地下小家园，还会一层一层长大。']
  return { title: guide[0], speech: guide[1], outcome: guide[2], done, total: 8, finished: friendsSettled && harvested }
}
