import { furnishedHall } from './hallWorld'
import { performHall } from '../../src/core/hall'
import { buildGarden, performGarden } from '../../src/core/garden'
import { gardenFrontier } from '../../src/core/gardenTopology'
import { initializeWorkers } from '../../src/core/partnerWork'
import { dig } from '../../src/core/dig'
import { TILE, type WorldState } from '../../src/core/world'

export function gardenAvailable(shaft = 27): WorldState {
  const w = furnishedHall(shaft), r = performHall(w, 'feast')
  if (!r.ok) throw new Error(r.message)
  return w
}
export function enterGarden(w: WorldState): void {
  for (const action of ['inspect', 'drain'] as const) { const r = performGarden(w, action); if (!r.ok) throw new Error(r.message) }
  let f = gardenFrontier(w)
  while (f) { w.tiles[f.y][f.x] = TILE.EMPTY; w.dugCount++; f = gardenFrontier(w) }
  const r = performGarden(w, 'enter'); if (!r.ok) throw new Error(r.message)
  w.exploration.explorer = { x: w.exploration.shaftX!, y: 58 }
}
export function expandGarden(w: WorldState): void {
  for (const direction of [-1, 1]) for (let x = w.exploration.shaftX!; x >= 8 && x <= 40; x += direction) for (const y of [58, 57, 56, 55]) if (w.tiles[y][x] === TILE.SOIL) {
    const r = dig(w, x, y); if (!r.ok) throw new Error(`花园夹具挖掘失败 ${x},${y}: ${r.reason}`)
  }
}
export function workingGarden(shaft = 27): WorldState {
  const w = gardenAvailable(shaft); enterGarden(w); expandGarden(w)
  for (const action of ['meet', 'extend'] as const) { const r = performGarden(w, action); if (!r.ok) throw new Error(r.message) }
  initializeWorkers(w)
  for (const [kind, x] of [['rill', 24], ['bed', 28], ['lamp', 32]] as const) { const r = buildGarden(w, kind, x); if (!r.ok) throw new Error(r.message) }
  const r = performGarden(w, 'weave', 28); if (!r.ok) throw new Error(r.message)
  return w
}
export function completedGarden(shaft = 27): WorldState {
  const w = workingGarden(shaft)
  for (const action of ['care', 'care', 'harvest'] as const) { const r = performGarden(w, action, 28); if (!r.ok) throw new Error(r.message) }
  const nest = buildGarden(w, 'nest', 10); if (!nest.ok) throw new Error(nest.message)
  const r = performGarden(w, 'walk'); if (!r.ok) throw new Error(r.message)
  return w
}
