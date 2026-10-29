import { describe, expect, it } from 'vitest'
import { createInitialWorld, LANDMARKS, TILE, type WorldState } from '../src/core/world'
import { dig } from '../src/core/dig'
import { placePod } from '../src/core/build'
import { inspectCrack, upgradePickaxe } from '../src/core/exploration'
import { canSendPowerDown, powerLinePath, sendPowerDown } from '../src/core/power'
import { explorationGuide, guideHighlight } from '../src/core/missions'
import { deserialize, serialize } from '../src/core/persistence'
import { facilityView, panelFacilityAt } from '../src/app/facilityPanel'

/** 第一夜基本做完：两间床、四位伙伴、水引上来了、收过一次菜 */
function readyForPower(): WorldState {
  const world = createInitialWorld()
  world.progress = { crystalFound: true, crystalCollected: true, secondCrystalFound: true, secondCrystalCollected: true, coreLoaded: true, coreRepaired: true }
  // 第一间床（大厅左侧）
  for (let y = 10; y <= 11; y++) for (let x = 12; x < 15; x++) dig(world, x, y)
  placePod(world, 12, 10)
  // 第二间床（左翼）
  for (let y = 9; y <= 11; y++) for (let x = 5; x <= 14; x++) if (world.tiles[y][x] === TILE.SOIL) dig(world, x, y)
  placePod(world, 7, 10)
  // 裂纹 → 换镐 → 挖通梯道 → 下到第二层
  for (let x = 26; x <= 27; x++) { dig(world, x, 11); dig(world, x, 10) }
  inspectCrack(world, 27, 12)
  upgradePickaxe(world)
  for (let y = 12; y < 19; y++) if (world.tiles[y][27] !== TILE.EMPTY) dig(world, 27, y)
  world.exploration.entered = true
  // 沿泉水层地面挖到水边，阿土才站得住
  for (let x = 23; x >= LANDMARKS.spring.x; x--) { dig(world, x, 21); dig(world, x, 20) }
  world.exploration.explorer = { x: LANDMARKS.spring.x, y: 21 }
  world.exploration.springFound = true
  world.farm.waterSupplied = true
  world.farm.harvests = 1
  return world
}

describe('电向下：第一层是总电源', () => {
  it('刚开始什么都没有，送不了电', () => {
    const world = createInitialWorld()
    expect(canSendPowerDown(world)).toBe(false)
    expect(sendPowerDown(world)).toBe(false)
    expect(world.powerDown).toBe(false)
  })

  it('人还没下到第二层，送不了电', () => {
    const world = readyForPower()
    world.exploration.entered = false
    world.exploration.explorer = null
    expect(canSendPowerDown(world)).toBe(false)
  })

  it('第一夜做完之后电可以送下去，而且只能送一次', () => {
    const world = readyForPower()
    expect(canSendPowerDown(world)).toBe(true)
    expect(sendPowerDown(world)).toBe(true)
    expect(world.powerDown).toBe(true)
    expect(canSendPowerDown(world)).toBe(false)
    expect(sendPowerDown(world)).toBe(false)
  })

  it('电线从核心出发，沿地面走到梯道，再顺着梯子下到第二层', () => {
    const world = readyForPower()
    const path = powerLinePath(world)
    expect(path.length).toBeGreaterThan(10)
    expect(path[0]).toEqual({ x: LANDMARKS.generator.x, y: LANDMARKS.generator.y })
    expect(path[path.length - 1]).toEqual({ x: 27, y: 19 })
    // 整条线都走在已经挖开的格子里，不穿过实心岩
    for (const cell of path) expect(world.tiles[cell.y][cell.x]).toBe(TILE.EMPTY)
  })

  it('第一夜做完之后，高亮从建造区回到能源核心：该送电了', () => {
    const world = readyForPower()
    const guide = guideHighlight(world)
    expect(guide.kind).toBe('repair')
    if (guide.kind !== 'none') expect(guide.rect).toEqual(LANDMARKS.generatorZone)
    expect(explorationGuide(world)).toMatchObject({ title: '把家里的电送到下面', done: 8, total: 12, finished: false })
  })

  it('送完电，引导进入第二层章末：先修灶台，再摆餐桌，最后第一顿饭', () => {
    const world = readyForPower()
    sendPowerDown(world)
    expect(explorationGuide(world)).toMatchObject({ title: '在泉边修一个灶台', done: 9, total: 12, finished: false })
    const highlight = guideHighlight(world)
    expect(highlight.kind).toBe('build')
    if (highlight.kind === 'build') expect(highlight.rect).toMatchObject({ x: 10, y: 19, w: 3, h: 3 })
    world.builtSites.push({ id: 'spring-kitchen', kind: 'kitchen' })
    expect(explorationGuide(world)).toMatchObject({ title: '再摆一张餐桌', done: 10, total: 12, finished: false })
    world.builtSites.push({ id: 'spring-table', kind: 'dining' })
    expect(explorationGuide(world)).toMatchObject({ title: '请大家吃第一顿饭', done: 11, total: 12, finished: false })
    expect(guideHighlight(world).kind).toBe('collect')
    world.farm.sharedMeals = 1
    expect(explorationGuide(world)).toMatchObject({ done: 12, total: 12, finished: true })
    expect(guideHighlight(world).kind).toBe('none')
  })

  it('能源核心可直接点击查看状态，并把送电作为唯一升级操作', () => {
    const world = readyForPower()
    expect(panelFacilityAt(world, LANDMARKS.generator.x, LANDMARKS.generator.y)).toBe('energy-core')
    expect(facilityView(world, 'energy-core')).toMatchObject({
      title: '能源核心',
      primary: { kind: 'power', label: '扩大供电范围' },
    })
    sendPowerDown(world)
    expect(facilityView(world, 'energy-core').primary).toEqual({ kind: 'none', label: '供电已覆盖第二层' })
  })
})

describe('电的存档', () => {
  it('送到第二层的状态能存能读', () => {
    const world = readyForPower()
    sendPowerDown(world)
    const loaded = deserialize(serialize(world))
    expect(loaded.ok ? 'ok' : loaded.error).toBe('ok')
    if (loaded.ok) expect(loaded.world.powerDown).toBe(true)
  })

  it('还没送电也能原样存回来', () => {
    const world = readyForPower()
    const loaded = deserialize(serialize(world))
    expect(loaded.ok).toBe(true)
    if (loaded.ok) expect(loaded.world.powerDown).toBe(false)
  })

  it('v6 旧档没有 powerDown 字段，按“还没送电”读入', () => {
    const world = readyForPower()
    const payload = serialize(world) as { version: number; savedAt: string; world: Record<string, unknown> }
    payload.version = 6
    delete payload.world.powerDown
    const loaded = deserialize(payload)
    expect(loaded.ok).toBe(true)
    if (loaded.ok) expect(loaded.world.powerDown).toBe(false)
  })
})
