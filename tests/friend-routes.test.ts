import { describe, expect, it } from 'vitest'
import { contains, placePod, podDoor, podRect } from '../src/core/build'
import { dig } from '../src/core/dig'
import { TILE, TILE_SIZE, createInitialWorld, LANDMARKS, type SleepPod } from '../src/core/world'
import { bedSlots } from '../src/render/sleepPods'
import { FRIEND_HOME_CELLS, findEntranceRoute } from '../src/render/friendRoutes'

function readyWorld() {
  const world = createInitialWorld()
  world.progress = { crystalFound: true, crystalCollected: true, coreRepaired: true }
  for (let y = 8; y < 10; y++) for (let x = 12; x < 15; x++) dig(world, x, y)
  return world
}

function rightPocketWorld() {
  const world = readyWorld()
  for (let y = 10; y < 12; y++) for (let x = 26; x < 29; x++) dig(world, x, y)
  return world
}

describe('伙伴入场路径', () => {
  it('左右两处睡眠舱都能从避难所地面走到舱门', () => {
    const left = readyWorld()
    const leftPod = placePod(left, 12, 8)!
    const right = rightPocketWorld()
    const rightPod = placePod(right, 26, 10)!
    for (const [world, pod] of [[left, leftPod], [right, rightPod]] as const) {
      for (const home of FRIEND_HOME_CELLS) {
        const route = findEntranceRoute(world, home, pod)
        expect(route).not.toBeNull()
        expect(route![route!.length - 1]).toEqual(podDoor(pod))
      }
    }
  })

  it('路径只走空洞格，不穿能源核心或舱体', () => {
    const world = readyWorld()
    const pod = placePod(world, 12, 8)!
    const route = findEntranceRoute(world, FRIEND_HOME_CELLS[0], pod)!
    expect(route[0]).toEqual(FRIEND_HOME_CELLS[0])
    route.forEach((cell, index) => {
      expect(world.tiles[cell.y][cell.x]).toBe(TILE.EMPTY)
      expect(contains(LANDMARKS.generatorZone, cell.x, cell.y)).toBe(false)
      expect(contains(podRect(pod), cell.x, cell.y)).toBe(false)
      if (index > 0) {
        const prev = route[index - 1]
        expect(Math.abs(prev.x - cell.x) + Math.abs(prev.y - cell.y)).toBe(1)
      }
    })
  })

  it('横向行走都落在地面上，垂直段贴着左壁爬上舱门层', () => {
    const world = readyWorld()
    const pod = placePod(world, 12, 8)!
    const route = findEntranceRoute(world, FRIEND_HOME_CELLS[0], pod)!
    const horizontal = route.filter((cell, index) => index > 0 && route[index - 1].y === cell.y)
    expect(horizontal.length).toBeGreaterThan(0)
    for (const cell of horizontal) expect(world.tiles[cell.y + 1][cell.x]).not.toBe(TILE.EMPTY)
    const vertical = route.filter((cell, index) => index > 0 && route[index - 1].y !== cell.y)
    expect(vertical.some((cell) => cell.x === 17 && cell.y === 10)).toBe(true)
  })

  it('床铺在舱内，门朝向决定床头靠哪边', () => {
    const left = bedSlots({ x: 12, y: 8, door: 'right' })
    expect(left).toHaveLength(2)
    expect(left[0].x).toBe((12 + 0.65) * TILE_SIZE)
    expect(left[1].y - left[0].y).toBe(24)
    const right = bedSlots({ x: 26, y: 10, door: 'left' })
    expect(right[0].x).toBe((26 + 2.35) * TILE_SIZE)
  })

  it('没有连通道路的舱位返回 null，交给渲染层兜底', () => {
    const world = readyWorld()
    // 绕过规则直接放一个孤立舱，验证寻路不会穿岩壁。
    const stranded: SleepPod = { id: 9, x: 9, y: 13, door: 'right' }
    world.pods.push(stranded)
    expect(findEntranceRoute(world, FRIEND_HOME_CELLS[0], stranded)).toBeNull()
  })
})
