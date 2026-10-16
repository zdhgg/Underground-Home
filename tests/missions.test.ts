import { describe, expect, it } from 'vitest'
import { dig } from '../src/core/dig'
import { currentMission, getMissionProgress, missionSummary } from '../src/core/missions'
import { LANDMARKS, createInitialWorld } from '../src/core/world'

describe('任务系统', () => {
  it('初始状态：0/1，当前任务为找到能源石', () => {
    const world = createInitialWorld()
    expect(missionSummary(world)).toEqual({ done: 0, total: 1 })
    expect(currentMission(world)?.id).toBe('find-energy-stone')
    expect(currentMission(world)?.title).toBe('找到发光的能源石')
  })

  it('挖开能源石所在泥土后任务完成', () => {
    const world = createInitialWorld()
    dig(world, LANDMARKS.crystal.x, LANDMARKS.crystal.y)
    expect(missionSummary(world).done).toBe(1)
    expect(getMissionProgress(world)[0].done).toBe(true)
    expect(currentMission(world)).toBeNull()
  })

  it('挖别处的泥土不会误判完成', () => {
    const world = createInitialWorld()
    dig(world, 9, 8)
    dig(world, 10, 9)
    expect(missionSummary(world).done).toBe(0)
    expect(currentMission(world)?.id).toBe('find-energy-stone')
  })

  it('任务判定只看世界状态，不依赖操作顺序（撤销后再挖同样成立）', () => {
    const world = createInitialWorld()
    dig(world, 12, 9)
    dig(world, 13, 9)
    expect(missionSummary(world).done).toBe(0)
    dig(world, LANDMARKS.crystal.x, LANDMARKS.crystal.y)
    expect(missionSummary(world).done).toBe(1)
  })
})
