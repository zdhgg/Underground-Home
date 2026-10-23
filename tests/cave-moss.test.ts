import { describe, expect, it } from 'vitest'
import { TILE, TILE_SIZE, createInitialWorld } from '../src/core/world'
import { drawCaveMoss } from '../src/render/caveMoss'

function exploredCave() {
  const world = createInitialWorld()
  Object.assign(world.exploration, { entered: true, shaftX: 27, pickaxeUpgraded: true })
  for (let y = 11; y <= 21; y++) world.tiles[y][27] = TILE.EMPTY
  for (let x = 9; x <= 38; x++) for (const y of [20, 21]) world.tiles[y][x] = TILE.EMPTY
  return world
}
const columns = (view: ReturnType<typeof drawCaveMoss>) => view.children.map(child => Math.floor(child.x / TILE_SIZE))

describe('泉水层背景苔斑', () => {
  it('只在已探索的后壁稀疏出现，避开泉水和梯口，不改变世界', () => {
    const world = exploredCave(), before = structuredClone(world)
    const moss = drawCaveMoss(world)
    expect(columns(moss)).toEqual([12, 24, 30, 36])
    expect(moss.eventMode).toBe('none')
    expect(moss.children.every(child => child.alpha <= .25 && child.height < 8 && child.eventMode === 'none')).toBe(true)
    expect(world).toEqual(before)
    moss.destroy({ children: true })
    world.exploration.entered = false
    expect(drawCaveMoss(world).children).toHaveLength(0)
  })

  it('灶台、餐桌和其他建成洞室内不显示，撤销后可以恢复', () => {
    const world = exploredCave()
    world.builtSites.push({ id: 'spring-kitchen', kind: 'kitchen' }, { id: 'spring-table', kind: 'dining' }, { id: 'spring-garden', kind: 'garden' })
    const built = drawCaveMoss(world)
    expect(columns(built)).toEqual([24, 36])
    built.destroy({ children: true })
    world.builtSites = []
    const undone = drawCaveMoss(world)
    expect(columns(undone)).toContain(12); expect(columns(undone)).toContain(30)
    undone.destroy({ children: true })
  })

  it('自由摆放的菜槽、房间蓝图和水缸同样留出空隙，上层房间不误删下层装饰', () => {
    const world = exploredCave()
    world.farm.planters.push({ id: 1, x: 30, y: 21, growth: 0 })
    world.rooms.push({ id: 1, kind: 'lounge', x: 35, y: 19, w: 3, h: 3, status: 'blueprint' },
      { id: 2, kind: 'home', x: 12, y: 9, w: 3, h: 3 })
    world.farm.waterSupplied = true
    const moss = drawCaveMoss(world)
    expect(columns(moss)).toEqual([12])
    moss.destroy({ children: true })
  })
})
