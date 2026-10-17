import { describe, expect, it } from 'vitest'
import { placePod } from '../src/core/build'
import { dig } from '../src/core/dig'
import { inspectCrack, upgradePickaxe } from '../src/core/exploration'
import { createDigHistory } from '../src/core/history'
import { collectCrystal, repairCore } from '../src/core/interact'
import {
  FIRST_NIGHT_MISSIONS,
  currentMission,
  getMissionProgress,
  guideHighlight,
  missionSummary,
} from '../src/core/missions'
import { LANDMARKS, TILE, createInitialWorld, tileAt } from '../src/core/world'

describe('第一夜任务链', () => {
  it('初始：0/4，当前任务是找到能源石，高亮指向能源石区域', () => {
    const world = createInitialWorld()
    expect(missionSummary(world)).toEqual({ done: 0, total: 4 })
    expect(currentMission(world)?.id).toBe('find-energy-stone')
    expect(currentMission(world)?.title).toBe('找到发光的能源石')

    const guide = guideHighlight(world)
    expect(guide.kind).toBe('dig')
    if (guide.kind !== 'none') expect(guide.rect).toEqual(LANDMARKS.crystalZone)
  })

  it('挖开 → 收集 → 修复，任务逐级推进，高亮跟随切换', () => {
    const world = createInitialWorld()

    dig(world, LANDMARKS.crystal.x, LANDMARKS.crystal.y)
    expect(missionSummary(world).done).toBe(1)
    expect(currentMission(world)?.id).toBe('collect-energy-stone')
    expect(guideHighlight(world).kind).toBe('collect')

    collectCrystal(world, LANDMARKS.crystal.x, LANDMARKS.crystal.y)
    expect(missionSummary(world).done).toBe(2)
    expect(currentMission(world)?.id).toBe('repair-energy-core')
    const guide = guideHighlight(world)
    expect(guide.kind).toBe('repair')
    if (guide.kind !== 'none') expect(guide.rect).toEqual(LANDMARKS.generatorZone)

    repairCore(world, LANDMARKS.generator.x, LANDMARKS.generator.y)
    expect(missionSummary(world).done).toBe(3)
    expect(currentMission(world)?.id).toBe('build-sleep-pod')
    expect(guideHighlight(world).kind).toBe('none')
  })

  it('挖别处的泥土不会完成任何任务', () => {
    const world = createInitialWorld()
    dig(world, 9, 8)
    dig(world, 10, 9)
    expect(missionSummary(world).done).toBe(0)
    expect(currentMission(world)?.id).toBe('find-energy-stone')
  })

  it('跳过步骤不算完成：没收集能源石就修不了核心，任务也不推进', () => {
    const world = createInitialWorld()
    dig(world, LANDMARKS.crystal.x, LANDMARKS.crystal.y)
    const attempt = repairCore(world, LANDMARKS.generator.x, LANDMARKS.generator.y)
    expect(attempt.ok).toBe(false)
    expect(missionSummary(world).done).toBe(1)
  })

  it('进度单调：撤销挖开能源石的泥土，任务不回退', () => {
    const world = createInitialWorld()
    const history = createDigHistory()
    dig(world, LANDMARKS.crystal.x, LANDMARKS.crystal.y)
    history.record(LANDMARKS.crystal.x, LANDMARKS.crystal.y)
    expect(missionSummary(world).done).toBe(1)

    history.undo(world)
    expect(tileAt(world, LANDMARKS.crystal.x, LANDMARKS.crystal.y)).toBe(TILE.SOIL)
    expect(missionSummary(world).done).toBe(1) // 但任务保持完成
    expect(world.progress.crystalFound).toBe(true)
  })

  it('找到水之后高亮回到暖窝层：新朋友要床位（而不是指向第二层）', () => {
    const world = reachedSpringWorld()
    const guide = guideHighlight(world)
    expect(guide.kind).toBe('build')
    if (guide.kind !== 'none') expect(guide.rect).toEqual(LANDMARKS.buildSuggestion)
  })

  it('每个任务都带有儿童可读的引导文案（说什么 / 做什么 / 会怎样）', () => {
    for (const mission of FIRST_NIGHT_MISSIONS) {
      expect(mission.speech.length).toBeGreaterThan(0)
      expect(mission.todo.length).toBeGreaterThan(0)
      expect(mission.outcome.length).toBeGreaterThan(0)
    }
    expect(getMissionProgress(createInitialWorld())).toHaveLength(4)
  })
})

/** 已经点亮家园、安好小床、挖通梯道、抵达第二层并找到泉水 */
function reachedSpringWorld() {
  const world = createInitialWorld()
  world.progress = { crystalFound: true, crystalCollected: true, coreRepaired: true }
  for (let y = 10; y <= 11; y++) for (let x = 12; x < 15; x++) dig(world, x, y)
  placePod(world, 12, 10)
  for (let x = 26; x <= 27; x++) dig(world, x, 11)
  inspectCrack(world, 27, 12)
  upgradePickaxe(world)
  for (let y = 12; y < 19; y++) if (world.tiles[y][27] !== TILE.EMPTY) dig(world, 27, y)
  world.exploration.entered = true
  for (let x = 23; x >= 18; x--) dig(world, x, 21)
  world.exploration.explorer = { x: LANDMARKS.spring.x, y: 21 }
  world.exploration.springFound = true
  return world
}
