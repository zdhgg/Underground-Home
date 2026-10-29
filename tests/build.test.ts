import { describe, expect, it } from 'vitest'
import { canPlacePod, canRestoreDig, placePod, podAnchorFromPointer } from '../src/core/build'
import { dig } from '../src/core/dig'
import { createWorldHistory } from '../src/core/history'
import { deserialize, serialize } from '../src/core/persistence'
import { currentMission, missionSummary } from '../src/core/missions'
import { createInitialWorld, TILE } from '../src/core/world'

function readyWorld() {
  const world = createInitialWorld()
  world.progress = { crystalFound: true, crystalCollected: true, secondCrystalFound: true, secondCrystalCollected: true, coreLoaded: true, coreRepaired: true }
  for (let y = 10; y < 12; y++) for (let x = 12; x < 15; x++) dig(world, x, y)
  return world
}

describe('睡眠舱粗版必要规则', () => {
  it('点击地面格换算成舱体底边中心，左右两处都能直接建造', () => {
    const left = readyWorld()
    const leftAnchor = podAnchorFromPointer({ x: 13, y: 11 })
    expect(leftAnchor).toEqual({ x: 12, y: 10 })
    expect(canPlacePod(left, leftAnchor.x, leftAnchor.y)).toEqual({ ok: true, door: 'right' })

    const right = readyWorld()
    for (let y = 10; y < 12; y++) for (let x = 26; x < 29; x++) dig(right, x, y)
    const rightAnchor = podAnchorFromPointer({ x: 27, y: 11 })
    expect(rightAnchor).toEqual({ x: 26, y: 10 })
    expect(canPlacePod(right, rightAnchor.x, rightAnchor.y)).toEqual({ ok: true, door: 'left' })
  })

  it('可在自行挖出的左右两处空间建造，任务依赖真实设施', () => {
    const left = readyWorld()
    expect(placePod(left, 12, 10)?.door).toBe('right')
    expect(missionSummary(left)).toEqual({ done: 4, total: 5 })
    // 安床之后、下楼之前还有一间客厅
    expect(currentMission(left)?.id).toBe('build-lounge')
    const right = readyWorld()
    for (let y = 10; y < 12; y++) for (let x = 26; x < 29; x++) dig(right, x, y)
    expect(placePod(right, 26, 10)?.door).toBe('left')
  })

  it('拒绝泥土、悬空、重复、核心、越界和不连通的空间', () => {
    const world = readyWorld()
    expect(canPlacePod(world, 9, 7)).toEqual({ ok: false, reason: 'soil' })
    expect(canPlacePod(world, 19, 8)).toEqual({ ok: false, reason: 'reserved' })
    expect(canPlacePod(world, -1, 8).ok).toBe(false)
    world.tiles[12][12] = TILE.EMPTY
    expect(canPlacePod(world, 12, 10)).toEqual({ ok: false, reason: 'support' })
    world.tiles[12][12] = TILE.ROCK
    for (let y = 10; y < 12; y++) for (let x = 8; x < 11; x++) dig(world, x, y)
    expect(canPlacePod(world, 8, 10)).toEqual({ ok: false, reason: 'access' })
    placePod(world, 12, 10)
    expect(canPlacePod(world, 12, 10)).toEqual({ ok: false, reason: 'overlap' })
    expect(dig(world, 12, 12).reason).toBe('facility')
  })

  it('建造不可堵死原核心或已有舱门，撤销不会填埋睡眠舱或唯一通道', () => {
    const world = readyWorld()
    const pod = placePod(world, 12, 10)!
    expect(canRestoreDig(world, 12, 10)).toBe(false)
    expect(canRestoreDig(world, 15, 11)).toBe(false)
    world.tiles[8][15] = TILE.EMPTY
    world.tiles[8][16] = TILE.EMPTY
    expect(canPlacePod(world, 15, 10)).toEqual({ ok: false, reason: 'access' })
    const history = createWorldHistory()
    history.record({ kind: 'pod', id: pod.id })
    expect(history.undo(world)?.kind).toBe('pod')
    expect(world.pods).toHaveLength(0)
    expect(currentMission(world)?.id).toBe('build-sleep-pod')
    history.record({ kind: 'dig', x: 12, y: 10 })
    expect(history.undo(world)?.kind).toBe('dig')
    expect(world.tiles[10][12]).toBe(TILE.SOIL)
  })

  it('v4保存恢复设施，同蓝图旧字段格式保留挖掘和点灯，损坏设施有加载反馈', () => {
    const world = readyWorld()
    placePod(world, 12, 10)
    const save = serialize(world)
    const loaded = deserialize(save)
    expect(loaded.ok && loaded.world.pods).toEqual(world.pods)
    const legacy: { version: number; world: { pods?: unknown; [key: string]: unknown } } = { ...save, version: 2, world: { ...save.world } }
    delete legacy.world.pods
    const migrated = deserialize(legacy)
    expect(migrated.ok && migrated.world.pods).toEqual([])
    expect(migrated.ok && migrated.world.progress.coreRepaired).toBe(true)
    expect(migrated.ok && migrated.world.tiles).toEqual(world.tiles)
    const broken = structuredClone(save)
    broken.world.pods[0].x = 21
    const failure = deserialize(broken)
    expect(failure.ok).toBe(false)
    if (!failure.ok) expect(failure.error).toContain('睡眠舱')
  })
})
