import { LANDMARKS, type Rect, type WorldState } from './world'

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
  | { kind: 'none' }

export function guideHighlight(world: WorldState): GuideHighlight {
  const { crystalFound, crystalCollected, coreRepaired } = world.progress
  if (!crystalFound) return { kind: 'dig', rect: LANDMARKS.crystalZone }
  if (!crystalCollected) return { kind: 'collect', rect: LANDMARKS.crystalZone }
  if (!coreRepaired) return { kind: 'repair', rect: LANDMARKS.generatorZone }
  return { kind: 'none' }
}
