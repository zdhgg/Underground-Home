import { describe, expect, it } from 'vitest'
import { createInitialWorld } from '../src/core/world'
import { AmbientLife, dustMotes, moteAt } from '../src/render/ambientLife'

function poweredWorld() {
  const world = createInitialWorld()
  world.progress = { crystalFound: true, crystalCollected: true, secondCrystalFound: true, secondCrystalCollected: true, coreLoaded: true, coreRepaired: true }
  world.exploration.entered = true
  world.exploration.springFound = true
  return world
}

describe('环境生命：灯光浮尘', () => {
  it('核心修好前没有浮尘；修好后大厅每盏顶灯周围三粒，壁灯各加三粒', () => {
    expect(dustMotes(createInitialWorld())).toHaveLength(0)
    const world = poweredWorld()
    expect(dustMotes(world)).toHaveLength(21)
    world.exploration.lamps.push({ x: 25, y: 19 }, { x: 30, y: 19 })
    expect(dustMotes(world)).toHaveLength(27)
  })

  it('浮尘是确定性轨道：同一小世界每次刷新得到同一批，位置随时间缓缓移动', () => {
    const world = poweredWorld()
    const a = dustMotes(world), b = dustMotes(world)
    expect(a).toEqual(b)
    const at0 = moteAt(a[0], 0), at1 = moteAt(a[0], 1.6)
    expect(at0).not.toEqual(at1)
    expect(at0.alpha).toBeGreaterThan(0)
  })
})

describe('环境生命：待命伙伴的微粒', () => {
  it('伙伴在场时按节奏冒出小微粒，飘一会儿就消散', () => {
    const world = poweredWorld()
    world.pods.push({ id: 1, x: 12, y: 10, door: 'left' })
    world.workers = { adeng: { x: 24, y: 11 }, xiaoman: { x: 25, y: 21 } }
    const ambient = new AmbientLife()
    ambient.refresh(world)
    ambient.update(world, 0.1, 0.1)
    expect(ambient.sparkleCount).toBe(0)
    ambient.update(world, 2.5, 2.4)
    expect(ambient.sparkleCount).toBe(1)
    // 持续推进：新的微粒继续出现（家一直是活的）。
    let seen = 0
    for (let i = 0; i < 40; i++) {
      ambient.update(world, 3 + i * 0.2, 0.2)
      seen += ambient.sparkleCount
    }
    expect(seen).toBeGreaterThan(0)
    ambient.view.destroy({ children: true })
  })

  it('没有待命伙伴时不冒微粒', () => {
    const world = poweredWorld()
    const ambient = new AmbientLife()
    ambient.refresh(world)
    for (let i = 0; i < 20; i++) ambient.update(world, i * 0.5, 0.5)
    expect(ambient.sparkleCount).toBe(0)
    ambient.view.destroy({ children: true })
  })
})
