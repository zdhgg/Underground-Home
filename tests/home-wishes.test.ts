import { describe, expect, it } from 'vitest'
import { createInitialWorld, TILE, type SleepPod, type WorldState } from '../src/core/world'
import { dig } from '../src/core/dig'
import { advancePlanters, harvestPlanter, RIPE_STAGE } from '../src/core/farm'
import { deserialize, serialize } from '../src/core/persistence'
import { warmLampWorld } from './fixtures/nestWarmLampWorld'
import {
  firstFloorPodsWithoutWarmLamp,
  homeWishes,
  homeWishTarget,
  homeWishUnavailableReason,
  type HomeWish,
} from '../src/app/homeWishes'

/** 第一层左翼挖出一带地面、水已接通、第三层章末完成：心愿的基础世界。 */
function wishWorld(): WorldState {
  const world = createInitialWorld()
  world.progress = { crystalFound: true, crystalCollected: true, coreRepaired: true }
  for (let y = 9; y <= 11; y++) for (let x = 2; x <= 14; x++) if (world.tiles[y][x] === TILE.SOIL) dig(world, x, y)
  world.exploration.entered = true
  world.farm.waterSupplied = true
  world.deep.completed = true
  world.deep.parts = 1
  return world
}

function addPod(world: WorldState, pod: Pick<SleepPod, 'id' | 'x' | 'y'> & Partial<SleepPod>): void {
  world.pods.push({ door: 'left', ...pod })
}

const lampWish = (list: HomeWish[]) => list.find(wish => wish.id === 'nest-warm-lamp')
const ripeWish = (list: HomeWish[]) => list.find(wish => wish.id === 'ripe-planter')

describe('家园心愿：只从真实世界状态生成', () => {
  it('第三层未完成时，即使第一层有小窝且没装灯，也不显示暖光灯心愿', () => {
    const world = wishWorld()
    world.deep.completed = false
    addPod(world, { id: 1, x: 5, y: 10 })
    expect(homeWishes(world)).toEqual([])
  })

  it('第三层完成且存在未装灯的第一层小窝时显示心愿，并指向那间小窝', () => {
    const world = wishWorld()
    addPod(world, { id: 3, x: 5, y: 10 })
    expect(homeWishes(world)).toEqual([{
      id: 'nest-warm-lamp', emoji: '🪔', title: '给小窝添盏暖光灯',
      detail: '第三层做的新部件，可以带回家啦！', actionLabel: '去看看小窝',
      target: { kind: 'pod', podId: 3 },
    }])
  })

  it('部件不足时心愿仍显示，并明确提示还差一个部件，不写“材料充足”', () => {
    const world = wishWorld()
    world.deep.parts = 0
    addPod(world, { id: 1, x: 5, y: 10 })
    const wish = lampWish(homeWishes(world))!
    expect(wish.note).toBe('还差1个工坊部件，可以去第三层再做一个。')
    expect(wish.note).not.toContain('充足')
  })

  it('所有第一层小窝都装好灯后心愿消失；新造一间未装灯小窝后又出现', () => {
    const world = wishWorld()
    addPod(world, { id: 1, x: 5, y: 10, warmLamp: true })
    expect(lampWish(homeWishes(world))).toBeUndefined()
    addPod(world, { id: 2, x: 9, y: 10 })
    expect(lampWish(homeWishes(world))?.target).toEqual({ kind: 'pod', podId: 2 })
  })

  it('只把第一层小窝当作待改善目标，其他楼层的床铺不会误判', () => {
    const world = wishWorld()
    addPod(world, { id: 1, x: 5, y: 10 })
    addPod(world, { id: 2, x: 25, y: 45, backWall: true })
    addPod(world, { id: 3, x: 25, y: 57, backWall: true })
    addPod(world, { id: 4, x: 25, y: 69, backWall: true })
    addPod(world, { id: 5, x: 25, y: 81, backWall: true })
    expect(firstFloorPodsWithoutWarmLamp(world).map(pod => pod.id)).toEqual([1])
    expect(lampWish(homeWishes(world))?.target).toEqual({ kind: 'pod', podId: 1 })

    world.pods.find(pod => pod.id === 1)!.warmLamp = true
    expect(lampWish(homeWishes(world))).toBeUndefined()
  })

  it('有多间待改善小窝时按稳定顺序选择一间', () => {
    const world = wishWorld()
    addPod(world, { id: 2, x: 5, y: 10 })
    addPod(world, { id: 1, x: 10, y: 10 })
    expect(lampWish(homeWishes(world))?.target).toEqual({ kind: 'pod', podId: 1 })
  })

  it('有成熟菜槽时显示收菜心愿，并复用真实成熟槽坐标', () => {
    const world = wishWorld()
    world.farm.planters.push({ id: 7, x: 28, y: 21, growth: RIPE_STAGE })
    const wish = ripeWish(homeWishes(world))!
    expect(wish).toMatchObject({
      emoji: '🥕', title: '菜长熟啦！', detail: '小满照顾的菜可以收获啦！', actionLabel: '去看看菜园',
      target: { kind: 'planter', planterId: 7, x: 28, y: 21 },
    })
  })

  it('没有成熟菜槽时不显示收菜心愿', () => {
    const world = wishWorld()
    world.farm.planters.push({ id: 7, x: 28, y: 21, growth: RIPE_STAGE - 1 })
    expect(ripeWish(homeWishes(world))).toBeUndefined()
  })

  it('收掉唯一一槽成熟菜后心愿消失；还有其他成熟菜槽时继续存在', () => {
    const world = wishWorld()
    world.farm.planters.push({ id: 1, x: 28, y: 21, growth: RIPE_STAGE }, { id: 2, x: 30, y: 21, growth: RIPE_STAGE })
    expect(harvestPlanter(world, 28, 21)).toBe(true)
    expect(ripeWish(homeWishes(world))?.target).toEqual({ kind: 'planter', planterId: 2, x: 30, y: 21 })
    expect(harvestPlanter(world, 30, 21)).toBe(true)
    expect(ripeWish(homeWishes(world))).toBeUndefined()
  })

  it('作物再次成熟后收菜心愿重新出现，不保存完成次数或奖励', () => {
    const world = wishWorld()
    world.farm.planters.push({ id: 1, x: 28, y: 21, growth: RIPE_STAGE })
    harvestPlanter(world, 28, 21)
    expect(ripeWish(homeWishes(world))).toBeUndefined()
    for (let i = 0; i < RIPE_STAGE; i++) advancePlanters(world)
    expect(ripeWish(homeWishes(world))?.target).toEqual({ kind: 'planter', planterId: 1, x: 28, y: 21 })
  })

  it('旧存档的第一层菜槽按实际坐标定位，不固定跳第二层', () => {
    const world = wishWorld()
    world.farm.planters.push({ id: 9, x: 5, y: 11, growth: RIPE_STAGE })
    expect(ripeWish(homeWishes(world))?.target).toEqual({ kind: 'planter', planterId: 9, x: 5, y: 11 })
  })

  it('两项条件同时满足时最多显示两条，主线之外不扩增类型', () => {
    const world = wishWorld()
    addPod(world, { id: 1, x: 5, y: 10 })
    world.farm.planters.push({ id: 2, x: 28, y: 21, growth: RIPE_STAGE })
    expect(homeWishes(world).map(wish => wish.id)).toEqual(['nest-warm-lamp', 'ripe-planter'])
  })

  it('计算心愿和目标不会修改资源、建筑或作物状态', () => {
    const world = wishWorld()
    addPod(world, { id: 1, x: 5, y: 10 })
    world.farm.planters.push({ id: 2, x: 28, y: 21, growth: RIPE_STAGE })
    const before = structuredClone(world)
    for (let i = 0; i < 3; i++) {
      homeWishes(world)
      homeWishTarget(world, 'nest-warm-lamp')
      homeWishTarget(world, 'ripe-planter')
    }
    expect(world).toEqual(before)
  })

  it('目标失效时重新计算得到空目标，并给出简短原因', () => {
    const world = wishWorld()
    addPod(world, { id: 1, x: 5, y: 10 })
    world.farm.planters.push({ id: 2, x: 28, y: 21, growth: RIPE_STAGE })
    expect(homeWishTarget(world, 'nest-warm-lamp')).toEqual({ kind: 'pod', podId: 1 })

    world.pods[0].warmLamp = true
    harvestPlanter(world, 28, 21)
    expect(homeWishTarget(world, 'nest-warm-lamp')).toBeNull()
    expect(homeWishTarget(world, 'ripe-planter')).toBeNull()
    expect(homeWishUnavailableReason(world, 'nest-warm-lamp')).toContain('都装好暖光灯')
    expect(homeWishUnavailableReason(world, 'ripe-planter')).toContain('已经收好')
  })

  it('存档重进后按真实状态重新生成相同心愿', () => {
    // 真实配方夹具：第三层已完成、第一层有一间未装灯小窝。
    const world = warmLampWorld()
    world.farm.planters.push({ id: 99, x: 28, y: 21, growth: RIPE_STAGE })
    const before = homeWishes(world)
    expect(before.map(wish => wish.id)).toEqual(['nest-warm-lamp', 'ripe-planter'])
    const loaded = deserialize(serialize(world))
    if (!loaded.ok) throw new Error(loaded.error)
    expect(loaded.ok).toBe(true)
    expect(loaded.world.version).toBe(26)
    expect(homeWishes(loaded.world)).toEqual(before)
    expect(serialize(loaded.world)).not.toHaveProperty('wishes')
    expect(serialize(loaded.world).world).not.toHaveProperty('wishProgress')
  })
})
