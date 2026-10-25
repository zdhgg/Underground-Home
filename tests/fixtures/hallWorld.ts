import { liftReady } from './deepWorld'
import { performDeep } from '../../src/core/deep'
import { buildHall, performHall } from '../../src/core/hall'
import { hallFrontier } from '../../src/core/hallTopology'
import { dig } from '../../src/core/dig'
import { initializeWorkers } from '../../src/core/partnerWork'
import { TILE, type WorldState } from '../../src/core/world'

export function hallAvailable(shaft = 27): WorldState {
  const w = liftReady(shaft)
  performDeep(w, 'ride-home')
  for (let i = 0; i < 4; i++) for (const action of ['collect', 'smelt', 'craft'] as const) {
    const r = performDeep(w, action); if (!r.ok) throw new Error(r.message)
  }
  return w
}
export function enterHall(w: WorldState): void {
  for (const action of ['inspect', 'brace'] as const) { const r = performHall(w, action); if (!r.ok) throw new Error(r.message) }
  let f = hallFrontier(w)
  while (f) { w.tiles[f.y][f.x] = TILE.EMPTY; w.dugCount++; f = hallFrontier(w) }
  const r = performHall(w, 'enter'); if (!r.ok) throw new Error(r.message)
  w.exploration.explorer = { x: w.exploration.shaftX!, y: 46 }
  initializeWorkers(w)
}
export function expandHall(w: WorldState): void {
  for (const direction of [-1, 1]) for (let x = w.exploration.shaftX!; x >= 8 && x <= 39; x += direction) for (const y of [46, 45, 44, 43]) if (w.tiles[y][x] === TILE.SOIL) {
    const r = dig(w, x, y); if (!r.ok) throw new Error(`大厅夹具挖掘失败 ${x},${y}: ${r.reason}`)
  }
}
export function furnishedHall(shaft = 27): WorldState {
  const w = hallAvailable(shaft); enterHall(w); expandHall(w)
  for (const action of ['extend', 'power'] as const) { const r = performHall(w, action); if (!r.ok) throw new Error(r.message) }
  for (const [kind, x] of [['hall', 28], ['memory', 24], ['nest', 10], ['nest', 19]] as const) { const r = buildHall(w, kind, x); if (!r.ok) throw new Error(r.message) }
  const r = performHall(w, 'table'); if (!r.ok) throw new Error(r.message)
  return w
}
