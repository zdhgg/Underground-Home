import { LANDMARKS, TILE, tileAt, type WorldState } from './world'

/**
 * 任务（missions）：给"问题和目标"，不规定唯一解。
 * 每个任务的 isDone 只依赖世界数据本身（而不是玩家经过了哪些操作），
 * 因此自由建设、打乱顺序也能被正确判定。
 * P0 只实现第一夜真实目标的第一个；睡眠舱 / 泉水 / 温室在后续阶段追加。
 */
export interface Mission {
  id: string
  /** 一句话目标（面板标题） */
  title: string
  /** 为什么做 */
  why: string
  /** 现在该做什么 */
  todo: string
  /** 做完会发生什么 */
  outcome: string
  /** 完成条件：基于世界数据的纯判定 */
  isDone: (world: WorldState) => boolean
}

const isCrystalRevealed = (world: WorldState): boolean =>
  tileAt(world, LANDMARKS.crystal.x, LANDMARKS.crystal.y) === TILE.EMPTY

/** 第一夜任务表 */
export const FIRST_NIGHT_MISSIONS: readonly Mission[] = [
  {
    id: 'find-energy-stone',
    title: '找到发光的能源石',
    why: '避难所又黑又冷，要点亮灯光，先得找到能量。',
    todo: '挖开左边泛着蓝光的松软泥土，把能源石露出来。',
    outcome: '露出能源石后，就能修复能源核心，让地下亮起来。',
    isDone: isCrystalRevealed,
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
