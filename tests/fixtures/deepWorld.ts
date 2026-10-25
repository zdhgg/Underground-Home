import { createInitialWorld, TILE, type WorldState } from '../../src/core/world'
import { dig } from '../../src/core/dig'
import { placePod } from '../../src/core/build'
import { inspectCrack, upgradePickaxe } from '../../src/core/exploration'
import { initializeWorkers } from '../../src/core/partnerWork'
import { finishSite, siteById } from '../../src/core/sites'
import { DINING_SITE_ID, KITCHEN_SITE_ID, serveMeal } from '../../src/core/meal'
import { buildDeep, performDeep, type DeepAction } from '../../src/core/deep'
import { deepFrontier, DEEP_FOOT } from '../../src/core/deepTopology'

/** 测试夹具：只通过既有规则完成前两层，不碰浏览器里的玩家存档。 */
export function secondLayerComplete(shaft = 27): WorldState {
  const w = createInitialWorld()
  w.progress = { coreRepaired: true, crystalFound: true, crystalCollected: true }; w.tiles[9][14] = TILE.EMPTY
  for (let x = 12; x < 15; x++) for (const y of [10, 11]) dig(w, x, y)
  const pod = placePod(w, 12, 10)
  if (pod) pod.backWall = true
  for (const x of [26, 27]) for (const y of [11, 10]) dig(w, x, y)
  if (!inspectCrack(w, shaft, 12)) throw new Error('夹具梯口不可达')
  upgradePickaxe(w)
  for (let y = 12; y < 19; y++) if (w.tiles[y][shaft] !== TILE.EMPTY) dig(w, shaft, y)
  w.exploration.entered = true; w.exploration.explorer = { x: shaft, y: 21 }
  // 通往泉水、灶台、餐桌和阿岩侧洞的完整通路。
  for (let x = shaft; x >= 10; x--) for (const y of [21, 20, 19]) if (w.tiles[y][x] === TILE.SOIL) dig(w, x, y)
  for (let x = shaft; x <= 36; x++) for (const y of [21, 20, 19]) if (w.tiles[y][x] === TILE.SOIL) dig(w, x, y)
  w.exploration.springFound = true; w.farm.waterSupplied = true; w.powerDown = true
  w.inventory = { stone: 35, wood: 30 }; w.farm.food = 3; w.farm.harvests = 1
  for (const [id, kind] of [[KITCHEN_SITE_ID, 'kitchen'], [DINING_SITE_ID, 'dining']] as const) if (!finishSite(w, siteById(id)!, kind)) throw new Error('夹具第二层设施失败')
  if (!serveMeal(w).ok) throw new Error('夹具共餐失败')
  initializeWorkers(w)
  return w
}
export function enterDeep(w: WorldState): void {
  if (!performDeep(w, 'meet').ok) throw new Error('夹具相遇失败')
  let frontier = deepFrontier(w)
  while (frontier) { w.tiles[frontier.y][frontier.x] = TILE.EMPTY; w.dugCount++; frontier = deepFrontier(w) }
  if (!performDeep(w, 'enter').ok) throw new Error('夹具到达失败')
  w.exploration.explorer = { x: w.exploration.shaftX!, y: DEEP_FOOT }
  initializeWorkers(w)
}
export function expandDeep(w: WorldState): void {
  for (let x = w.exploration.shaftX!; x <= 39; x++) for (const y of [33, 32, 31]) if (w.tiles[y][x] === TILE.SOIL) dig(w, x, y)
  for (let x = w.exploration.shaftX!; x >= 12; x--) for (const y of [33, 32, 31]) if (w.tiles[y][x] === TILE.SOIL) dig(w, x, y)
}
export function workingDeep(shaft = 27): WorldState {
  const w = secondLayerComplete(shaft); enterDeep(w); expandDeep(w)
  performDeep(w, 'discover')
  for (const [kind, x] of [['collector', 24], ['distributor', 28], ['lamp', 36], ['workshop', 31], ['furnace', 21]] as const) {
    const r = buildDeep(w, kind, x); if (!r.ok) throw new Error(r.message)
  }
  initializeWorkers(w)
  return w
}
export function liftReady(shaft = 27): WorldState {
  const w = workingDeep(shaft)
  for (const action of ['collect', 'collect', 'smelt', 'precision', 'smelt', 'craft', 'smelt', 'craft', 'support', 'lift'] as DeepAction[]) {
    const result = performDeep(w, action); if (!result.ok) throw new Error(result.message)
  }
  return w
}
