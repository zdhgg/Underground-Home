import { describe, expect, it } from 'vitest'
import { createInitialWorld, TILE, LANDMARKS, type WorldState } from '../src/core/world'
import { dig } from '../src/core/dig'
import { canRestoreDig, placePod } from '../src/core/build'
import { createWorldHistory } from '../src/core/history'
import { canPlaceWallLamp, canStand, inspectCrack, moleRoute, shaftChainReady, shaftConnected, shaftDugSegments, shaftFrontier, shaftRemainingSegments, springVisible, upgradePickaxe, walkingRoute, waterSpan } from '../src/core/exploration'
import { deserialize, serialize } from '../src/core/persistence'
import { explorationGuide, guideHighlight } from '../src/core/missions'

function readyWorld(podX = 12): WorldState {
  const w = createInitialWorld()
  w.progress = { crystalFound: true, crystalCollected: true, coreRepaired: true }
  w.tiles[9][14] = TILE.EMPTY
  for (let y = 10; y <= 11; y++) for (let x = podX; x < podX + 3; x++) dig(w, x, y)
  expect(placePod(w, podX, 10)).not.toBeNull()
  for (let x = 26; x <= 27; x++) dig(w, x, 11)
  return w
}
function openShaft(w: WorldState, x = 27): void {
  expect(inspectCrack(w, x, 12)).toBe(true)
  expect(upgradePickaxe(w)).toBe(true)
  for (let y = 12; y < 19; y++) if (w.tiles[y][x] !== TILE.EMPTY) expect(dig(w, x, y).ok).toBe(true)
  expect(shaftConnected(w)).toBe(true)
}
/** 听完水声、换上小铁镐：可以开始破岩的状态 */
function initChain(w: WorldState): void {
  expect(inspectCrack(w, 27, 12)).toBe(true)
  expect(upgradePickaxe(w)).toBe(true)
}
function enter(w: WorldState): void {
  expect(walkingRoute(w, w.exploration.explorer!, { x: w.exploration.shaftX!, y: 21 })).not.toBeNull()
  w.exploration.entered = true
  w.exploration.explorer = { x: w.exploration.shaftX!, y: 21 }
}

describe('首次突破岩层闭环', () => {
  it('建好家园也不会自动发现线索、升级工具或解锁第二层', () => {
    const w = readyWorld()
    expect(w.exploration.clueFound).toBe(false)
    expect(upgradePickaxe(w)).toBe(false)
    expect(dig(w, 27, 12).reason).toBe('tool')
    expect(dig(w, 23, 21).reason).toBe('locked-layer')
    expect(springVisible(w)).toBe(false)
  })
  it('裂纹必须能从大厅地面走到；右舱占位时可以从左侧突破', () => {
    const w = readyWorld(26)
    expect(inspectCrack(w, 27, 12)).toBe(false)
    expect(inspectCrack(w, 16, 12)).toBe(true)
    expect(w.exploration.shaftX).toBe(16)
    expect(upgradePickaxe(w)).toBe(true)
    for (let y = 12; y <= 18; y++) expect(dig(w, 16, y).ok).toBe(true)
    expect(shaftConnected(w)).toBe(true)
    enter(w)
    expect(dig(w, 17, 21).ok).toBe(true)
    expect(dig(w, 18, 21).ok).toBe(true)
    expect(dig(w, 19, 21).ok).toBe(true)
    expect(springVisible(w)).toBe(true)
  })
  it('旧舱虽不压住裂纹但挡住右翼地面时，引导仍选择可达的左侧', () => {
    const w = readyWorld(24)
    expect(guideHighlight(w)).toMatchObject({ rect: { x: 16 } })
    expect(inspectCrack(w, 27, 12)).toBe(false)
    expect(inspectCrack(w, 16, 12)).toBe(true)
  })
  it('先探索再升级；不能跳挖下方岩块，坚硬基岩永远不能挖', () => {
    const w = readyWorld()
    expect(inspectCrack(w, 27, 12)).toBe(true)
    expect(inspectCrack(w, 16, 12)).toBe(false)
    expect(w.exploration.explorer).toEqual({ x: 27, y: 11 })
    expect(w.exploration.pickaxeUpgraded).toBe(false)
    expect(dig(w, 27, 12).ok).toBe(false)
    upgradePickaxe(w)
    expect(dig(w, 27, 13).reason).toBe('reach')
    expect(dig(w, 26, 12).reason).toBe('rock')
    expect(dig(w, 27, 12).ok).toBe(true)
    expect(w.tiles[13][27]).toBe(TILE.WEAK_ROCK)
  })
  it('误挖弱岩可以撤销回原材质，未使用梯道随之断开', () => {
    const w = readyWorld()
    inspectCrack(w, 27, 12); upgradePickaxe(w)
    const history = createWorldHistory()
    const result = dig(w, 27, 12)
    history.record({ kind: 'dig', x: 27, y: 12, tile: result.tile! })
    expect(history.undo(w)?.kind).toBe('dig')
    expect(w.tiles[12][27]).toBe(TILE.WEAK_ROCK)
    expect(shaftConnected(w)).toBe(false)
  })
  it('挖通不等于抵达；移动路线逐格经过梯道，不能浮空穿墙', () => {
    const w = readyWorld()
    openShaft(w)
    expect(w.exploration.entered).toBe(false)
    expect(dig(w, 23, 21).ok).toBe(false)
    const route = walkingRoute(w, { x: 27, y: 11 }, { x: 27, y: 21 })!
    expect(route).toHaveLength(11)
    route.forEach((cell, i) => {
      expect(canStand(w, cell.x, cell.y)).toBe(true)
      expect(w.tiles[cell.y][cell.x]).toBe(TILE.EMPTY)
      if (i) expect(Math.abs(cell.x - route[i - 1].x) + Math.abs(cell.y - route[i - 1].y)).toBe(1)
    })
    w.tiles[15][27] = TILE.WEAK_ROCK
    expect(walkingRoute(w, { x: 27, y: 11 }, { x: 27, y: 21 })).toBeNull()
  })
  it('逐步开地面到泉水，再自由拓宽；不能远程挖穿另一侧', () => {
    const w = readyWorld()
    openShaft(w); enter(w)
    expect(waterSpan(w)).toEqual({ left: 24, right: 36 })
    expect(springVisible(w)).toBe(false)
    expect(dig(w, 4, 21).reason).toBe('reach')
    expect(dig(w, 23, 19).reason).toBe('reach')
    for (let x = 23; x >= 17; x--) expect(dig(w, x, 21).ok).toBe(true)
    expect(springVisible(w)).toBe(true)
    expect(w.exploration.springFound).toBe(false)
    for (const y of [20, 19]) expect(dig(w, 22, y).ok).toBe(true)
    expect(dig(w, 22, 22).reason).toBe('rock')
    const route = walkingRoute(w, { x: 27, y: 21 }, LANDMARKS.spring)!
    expect(route).toHaveLength(10)
    expect(route.every((cell) => cell.y === 21)).toBe(true)
  })
  it('已使用的梯道及脚下受保护，普通探索挖掘仍可撤销', () => {
    const w = readyWorld()
    openShaft(w); enter(w)
    const history = createWorldHistory()
    history.record({ kind: 'dig', x: 27, y: 12, tile: TILE.WEAK_ROCK })
    expect(history.undo(w)).toBeNull()
    dig(w, 23, 21)
    history.record({ kind: 'dig', x: 23, y: 21 })
    expect(history.undo(w)?.kind).toBe('dig')
    expect(w.tiles[21][23]).toBe(TILE.SOIL)
  })
  it('回家后也不能填埋泉水通路或梯口到大厅的地面通路', () => {
    const w = readyWorld()
    openShaft(w); enter(w)
    for (let x = 23; x >= 18; x--) dig(w, x, 21)
    w.exploration.springFound = true
    w.exploration.explorer = { x: 27, y: 11 }
    expect(canRestoreDig(w, 22, 21)).toBe(false)
    expect(canRestoreDig(w, 26, 11)).toBe(false)
    expect(deserialize(serialize(w)).ok).toBe(true)
  })
  it('泉水发现后小壁灯允许多个自由选址，不能压泉水或梯道', () => {
    const w = readyWorld()
    openShaft(w); enter(w)
    expect(canPlaceWallLamp(w, 30)).toBe(false)
    for (let x = 23; x >= 17; x--) dig(w, x, 21)
    w.exploration.springFound = true
    expect(canPlaceWallLamp(w, 30)).toBe(true)
    expect(canPlaceWallLamp(w, 25)).toBe(true)
    expect(canPlaceWallLamp(w, 27)).toBe(false)
    expect(canPlaceWallLamp(w, 18)).toBe(false)
    w.exploration.lamps.push({ x: 30, y: 19 })
    expect(canPlaceWallLamp(w, 30)).toBe(false)
    expect(deserialize(serialize(w)).ok).toBe(true)
  })
  it('半挖梯道、抵达、泉水和灯具存档往返均一致', () => {
    const w = readyWorld()
    inspectCrack(w, 27, 12); upgradePickaxe(w); dig(w, 27, 12)
    let loaded = deserialize(serialize(w))
    expect(loaded.ok && loaded.world).toEqual(w)
    for (let y = 13; y <= 17; y++) dig(w, 27, y)
    enter(w)
    for (let x = 23; x >= 17; x--) dig(w, x, 21)
    w.exploration.explorer = { ...LANDMARKS.spring }; w.exploration.springFound = true
    w.exploration.lamps.push({ x: 30, y: 19 })
    loaded = deserialize(serialize(w))
    expect(loaded.ok && loaded.world).toEqual(w)
    expect(explorationGuide(w)).toMatchObject({ done: 5, total: 5, finished: true })
  })
  it('拒绝伪造解锁、断开的已使用梯道、未知字段和非法站位', () => {
    const w = readyWorld()
    openShaft(w); enter(w)
    for (const mutate of [
      (copy: WorldState) => { copy.tiles[15][27] = TILE.WEAK_ROCK },
      (copy: WorldState) => { copy.exploration.explorer = { x: 2, y: 18 } },
      (copy: WorldState) => { copy.exploration.shaftX = 999 },
      (copy: WorldState) => { copy.tiles[22][27] = TILE.EMPTY },
      (copy: WorldState) => { copy.exploration.pickaxeUpgraded = false },
    ]) {
      const copy = structuredClone(w); mutate(copy)
      expect(deserialize(serialize(copy)).ok).toBe(false)
    }
  })
  it('复制真实v4地图仅替换不可玩下部，保留首层、舱位和输入原件', () => {
    const w = readyWorld(26)
    const payload = serialize(w)
    payload.version = 4
    // v4第二层的实际形状，与v5不同。
    for (let y = 17; y <= 22; y++) for (let x = 3; x <= 40; x++) payload.world.tiles[y][x] = TILE.SOIL
    for (let y = 18; y <= 21; y++) for (let x = 11; x <= 31; x++) payload.world.tiles[y][x] = TILE.EMPTY
    const before = structuredClone(payload)
    const result = deserialize(payload)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.world.tiles.slice(0, 12)).toEqual(w.tiles.slice(0, 12))
      expect(result.world.pods).toEqual(w.pods)
      expect(result.world.progress).toEqual(w.progress)
      expect(result.world.exploration.clueFound).toBe(false)
    }
    expect(payload).toEqual(before)
  })
})

describe('施工委托：阿土自动前往', () => {
  it('梯道目标永远是最上面那块没挖开的岩段，挖完指向下一块', () => {
    const w = readyWorld()
    inspectCrack(w, 27, 12); upgradePickaxe(w)
    expect(shaftFrontier(w, 27)).toEqual({ x: 27, y: 12 })
    dig(w, 27, 12)
    expect(shaftFrontier(w, 27)).toEqual({ x: 27, y: 13 })
    for (let y = 13; y < 19; y++) if (w.tiles[y][27] !== TILE.EMPTY) dig(w, 27, y)
    expect(shaftFrontier(w, 27)).toBeNull()
    expect(shaftConnected(w)).toBe(true)
  })

  it('还没进场时从大厅地面出发，进场后从自己的站位出发，路线只走真实通道', () => {
    const w = readyWorld()
    const home = moleRoute(w, { x: 27, y: 11 })!
    expect(home[0]).toEqual({ x: 18, y: 11 })
    expect(home.at(-1)).toEqual({ x: 27, y: 11 })
    expect(home.every((cell) => canStand(w, cell.x, cell.y))).toBe(true)
    inspectCrack(w, 27, 12); upgradePickaxe(w)
    for (let y = 12; y <= 13; y++) dig(w, 27, y)
    w.exploration.explorer = { x: 27, y: 12 }
    const route = moleRoute(w, { x: 27, y: 13 })!
    expect(route[0]).toEqual({ x: 27, y: 12 })
    expect(route.at(-1)).toEqual({ x: 27, y: 13 })
    expect(route.every((cell) => canStand(w, cell.x, cell.y))).toBe(true)
    // 洞还没挖到的地方不能直达
    expect(moleRoute(w, { x: 27, y: 17 })).toBeNull()
  })

  it('挖到一半的梯道：阿土站在梯段里存档往返一致，不能提前站进泉水层洞穴', () => {
    const w = readyWorld()
    inspectCrack(w, 27, 12); upgradePickaxe(w)
    for (let y = 12; y <= 14; y++) dig(w, 27, y)
    w.exploration.explorer = { x: 27, y: 13 }
    const loaded = deserialize(serialize(w))
    expect(loaded.ok).toBe(true)
    if (loaded.ok) expect(loaded.world.exploration.explorer).toEqual({ x: 27, y: 13 })
    const inCave = structuredClone(w)
    for (let y = 12; y < 19; y++) if (inCave.tiles[y][27] !== TILE.EMPTY) dig(inCave, 27, y)
    inCave.exploration.explorer = { x: 27, y: 21 } // 还没抵达就想站到泉水层
    expect(deserialize(serialize(inCave)).ok).toBe(false)
    const offShaft = structuredClone(w)
    offShaft.exploration.explorer = { x: 26, y: 13 }
    expect(deserialize(serialize(offShaft)).ok).toBe(false)
  })
})

describe('连续施工：剩余段数与可用时机', () => {
  it('剩余段数只数真正还要挥镐的岩段', () => {
    const w = readyWorld()
    inspectCrack(w, 27, 12); upgradePickaxe(w)
    expect(shaftDugSegments(w, 27)).toBe(0)
    // 右侧梯道下方 y=18 已是天然洞穴，所以是 6 段；左侧到 y=18 全是裂纹岩，是 7 段。
    expect(shaftRemainingSegments(w, 27)).toBe(6)
    expect(shaftRemainingSegments(w, 16)).toBe(7)
    dig(w, 27, 12); dig(w, 27, 13)
    expect(shaftDugSegments(w, 27)).toBe(2)
    expect(shaftRemainingSegments(w, 27)).toBe(4)
  })

  it('前两段手动，第三段起一次委托就能挖到底；挖通后不再提示', () => {
    const w = readyWorld()
    initChain(w)
    expect(shaftChainReady(w)).toBe(false)
    dig(w, 27, 12)
    expect(shaftChainReady(w)).toBe(false)
    dig(w, 27, 13)
    expect(shaftChainReady(w)).toBe(true)
    for (let y = 14; y < 19; y++) if (w.tiles[y][27] !== TILE.EMPTY) dig(w, 27, y)
    expect(shaftConnected(w)).toBe(true)
    expect(shaftChainReady(w)).toBe(false)
    expect(shaftRemainingSegments(w, 27)).toBe(0)
  })

  it('半挖梯道存档往返后，段数与连续施工的解锁时机一致', () => {
    const w = readyWorld()
    initChain(w)
    for (let y = 12; y <= 13; y++) dig(w, 27, y)
    const loaded = deserialize(serialize(w))
    expect(loaded.ok).toBe(true)
    if (loaded.ok) {
      expect(shaftDugSegments(loaded.world, 27)).toBe(2)
      expect(shaftChainReady(loaded.world)).toBe(true)
      expect(shaftConnected(loaded.world)).toBe(false)
    }
  })
})
