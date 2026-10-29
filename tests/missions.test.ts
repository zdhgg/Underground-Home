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
  it('初始：0/5，当前任务是找到能源石，高亮指向能源石区域', () => {
    const world = createInitialWorld()
    expect(missionSummary(world)).toEqual({ done: 0, total: 5 })
    expect(currentMission(world)?.id).toBe('find-energy-stone')
    expect(currentMission(world)?.title).toBe('找到发光的能源石')

    const guide = guideHighlight(world)
    expect(guide.kind).toBe('dig')
    if (guide.kind !== 'none') expect(guide.rect).toEqual(LANDMARKS.crystalZone)
  })

  it('挖开 → 收集 → 装第一块 → 找第二块 → 点亮，高亮跟随切换', () => {
    const world = createInitialWorld()

    dig(world, LANDMARKS.crystal.x, LANDMARKS.crystal.y)
    expect(missionSummary(world).done).toBe(1)
    expect(currentMission(world)?.id).toBe('collect-energy-stone')
    expect(guideHighlight(world).kind).toBe('collect')

    collectCrystal(world, LANDMARKS.crystal.x, LANDMARKS.crystal.y)
    expect(missionSummary(world).done).toBe(2)
    expect(currentMission(world)?.id).toBe('repair-energy-core')
    expect(guideHighlight(world).kind).toBe('repair')

    // 第一块先送进核心：家园还没点亮，高亮转去右翼的第二块石头
    const first = repairCore(world, LANDMARKS.generator.x, LANDMARKS.generator.y)
    expect(first.stage).toBe('loaded')
    expect(missionSummary(world).done).toBe(2)
    const second = guideHighlight(world)
    expect(second.kind).toBe('dig')
    if (second.kind !== 'none') expect(second.rect).toEqual(LANDMARKS.secondCrystalZone)

    dig(world, LANDMARKS.secondCrystal.x, LANDMARKS.secondCrystal.y)
    expect(guideHighlight(world).kind).toBe('collect')
    collectCrystal(world, LANDMARKS.secondCrystal.x, LANDMARKS.secondCrystal.y)
    const lastGuide = guideHighlight(world)
    expect(lastGuide.kind).toBe('repair')
    if (lastGuide.kind !== 'none') expect(lastGuide.rect).toEqual(LANDMARKS.generatorZone)

    repairCore(world, LANDMARKS.generator.x, LANDMARKS.generator.y)
    expect(missionSummary(world).done).toBe(3)
    expect(currentMission(world)?.id).toBe('build-sleep-pod')
    expect(guideHighlight(world).kind).toBe('none')
  })

  it('点亮之前高亮不会指向核心以外的地方：只装一块时高亮离开核心去找第二块', () => {
    const world = createInitialWorld()
    dig(world, LANDMARKS.crystal.x, LANDMARKS.crystal.y)
    collectCrystal(world, LANDMARKS.crystal.x, LANDMARKS.crystal.y)
    repairCore(world, LANDMARKS.generator.x, LANDMARKS.generator.y)
    const guide = guideHighlight(world)
    expect(guide.kind === 'none' ? null : guide.rect).not.toEqual(LANDMARKS.generatorZone)
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

  it('安床之后、下楼之前：主线先要一间一起坐的地方', () => {
    const world = createInitialWorld()
    world.progress = { crystalFound: true, crystalCollected: true, secondCrystalFound: true, secondCrystalCollected: true, coreLoaded: true, coreRepaired: true }
    for (let y = 10; y <= 11; y++) for (let x = 12; x <= 14; x++) dig(world, x, y)
    placePod(world, 12, 10)

    expect(missionSummary(world)).toEqual({ done: 4, total: 5 })
    expect(currentMission(world)?.id).toBe('build-lounge')
    const lounge = guideHighlight(world)
    expect(lounge.kind).toBe('build')
    if (lounge.kind !== 'none') expect(lounge.rect).toMatchObject({ x: 28, y: 9, w: 5, h: 3 })

    // 建好客厅，主线才交给"楼下有谁在喊饿"
    world.rooms.push({ id: 1, kind: 'lounge', x: 28, y: 9, w: 5, h: 3, managed: true })
    expect(missionSummary(world)).toEqual({ done: 5, total: 5 })
    expect(currentMission(world)).toBeNull()
    expect(guideHighlight(world).kind).toBe('dig')
  })

  it('客厅不限定选址：自己挖出来的客厅也算数', () => {
    const world = createInitialWorld()
    world.progress = { crystalFound: true, crystalCollected: true, secondCrystalFound: true, secondCrystalCollected: true, coreLoaded: true, coreRepaired: true }
    for (let y = 10; y <= 11; y++) for (let x = 12; x <= 14; x++) dig(world, x, y)
    placePod(world, 12, 10)
    for (let y = 9; y <= 11; y++) for (let x = 4; x <= 8; x++) dig(world, x, y)
    world.rooms.push({ id: 2, kind: 'lounge', x: 4, y: 9, w: 5, h: 3, managed: true })
    expect(missionSummary(world)).toEqual({ done: 5, total: 5 })
  })

  it('已经下到第二层的旧档不补课：不会突然被要求回头建客厅', () => {
    const world = createInitialWorld()
    world.progress = { crystalFound: true, crystalCollected: true, secondCrystalFound: true, secondCrystalCollected: true, coreLoaded: true, coreRepaired: true }
    for (let y = 10; y <= 11; y++) for (let x = 12; x <= 14; x++) dig(world, x, y)
    placePod(world, 12, 10)
    world.exploration.entered = true
    expect(currentMission(world)).toBeNull()
    expect(missionSummary(world)).toEqual({ done: 5, total: 5 })
  })

  it('找到水之后先引水，再回暖窝层给新朋友安床', () => {
    const world = reachedSpringWorld()
    // 还没引水：高亮留泉水那一格，提示先把水接回家
    const water = guideHighlight(world)
    expect(water.kind).toBe('repair')
    if (water.kind !== 'none') expect(water.rect).toMatchObject({ x: LANDMARKS.spring.x, y: LANDMARKS.spring.y })

    world.farm.waterSupplied = true
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
    expect(getMissionProgress(createInitialWorld())).toHaveLength(5)
  })
})

/** 已经点亮家园、安好小床、挖通梯道、抵达第二层并找到泉水 */
function reachedSpringWorld() {
  const world = createInitialWorld()
  world.progress = { crystalFound: true, crystalCollected: true, secondCrystalFound: true, secondCrystalCollected: true, coreLoaded: true, coreRepaired: true }
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
