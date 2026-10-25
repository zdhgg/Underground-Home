import { finaleGoal,finaleReady } from '../core/finale'
import { ruinsGoal,ruinsReady } from '../core/ruins'
import { ventilationGoal,ventilationReady } from '../core/ventilation'
import { reservoirGoal, reservoirReady } from '../core/reservoir'
import { gardenGoal, gardenReady } from '../core/garden'
import { currentMission, explorationGuide, missionSummary } from '../core/missions'
import type { WorldState } from '../core/world'
import { hallGoal, hallReady } from '../core/hall'
import { deepGoal, deepReady } from '../core/deep'

/**
 * 进入页只需要一点点存档信息：上次玩到哪、第一阶段走到第几步、什么时候存的。
 * 全部从世界数据推导，不额外写入存档字段，旧档也能直接得到摘要。
 */
export interface SaveSummary {
  /** 面向孩子的阶段名：第一夜 / 泉水与家园 */
  phase: string
  missionTitle: string
  done: number
  total: number
  finished: boolean
}

export type SaveStatus =
  | { status: 'loading' }
  | { status: 'none' }
  | { status: 'ready'; summary: SaveSummary; savedAt: string }
  | { status: 'broken'; error: string }

export function summarizeSave(world: WorldState): SaveSummary {
  if(finaleReady(world)){const g=finaleGoal(world);return{phase:world.finale.completed?'九层家园 · 终章已完成':'地心暖光 · 终章',missionTitle:g.title,done:g.done,total:20,finished:world.finale.completed}}
  if(ruinsReady(world)){const g=ruinsGoal(world);return{phase:'旧地脉遗迹',missionTitle:g.title,done:world.ruins.completed?19:g.done,total:19,finished:world.ruins.completed}}
  if(ventilationReady(world)){const g=ventilationGoal(world);return{phase:'听风工区',missionTitle:g.title,done:world.ventilation.completed?19:g.done,total:19,finished:world.ventilation.completed}}
  if(reservoirReady(world)){const goal=reservoirGoal(world);return{phase:'蓄水回廊',missionTitle:goal.title,done:world.reservoir.completed?18:goal.done,total:18,finished:world.reservoir.completed}}
  if (gardenReady(world)) {
    const goal = gardenGoal(world)
    return { phase: '菌光花园', missionTitle: goal.title, done: goal.done, total: 14, finished: world.garden.completed }
  }
  if (hallReady(world)) {
    const goal = hallGoal(world)
    return { phase: '暖光大厅', missionTitle: goal.title, done: goal.done, total: 11, finished: world.hall.completed }
  }
  if (deepReady(world)) {
    const goal = deepGoal(world)
    return { phase: '晶簇与工坊', missionTitle: goal.title, done: goal.done, total: 13, finished: world.deep.completed }
  }
  const firstNight = missionSummary(world)
  if (firstNight.done < firstNight.total) {
    const mission = currentMission(world)
    return {
      phase: '第一夜',
      missionTitle: mission?.title ?? '回到地下小家',
      done: firstNight.done,
      total: firstNight.total,
      finished: false,
    }
  }
  const guide = explorationGuide(world)
  return {
    phase: '泉水与家园',
    missionTitle: guide.title,
    done: guide.done,
    total: guide.total,
    finished: guide.finished,
  }
}

/** 把 ISO 时间变成孩子看得懂的“今天 20:35 / 昨天 09:12 / 10月17日 21:40”。 */
export function savedAtLabel(savedAt: string, now: Date = new Date()): string {
  const date = new Date(savedAt)
  if (!savedAt || Number.isNaN(date.getTime())) return ''
  const pad = (value: number): string => String(value).padStart(2, '0')
  const time = `${pad(date.getHours())}:${pad(date.getMinutes())}`
  const startOfDay = (value: Date): number => new Date(value.getFullYear(), value.getMonth(), value.getDate()).getTime()
  const days = Math.round((startOfDay(now) - startOfDay(date)) / 86_400_000)
  if (days === 0) return `今天 ${time}`
  if (days === 1) return `昨天 ${time}`
  if (date.getFullYear() === now.getFullYear()) return `${date.getMonth() + 1}月${date.getDate()}日 ${time}`
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`
}
