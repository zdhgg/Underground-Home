import { liftReady } from './deepWorld'
import { performDeep } from '../../src/core/deep'
import { dig } from '../../src/core/dig'
import { planRoom, finishRoom } from '../../src/core/roomConstruction'
import { TILE } from '../../src/core/world'

/** 真实配方、第三层章末与旧独立小窝；可选纳入一间包含两个小窝的房间。 */
export function warmLampWorld(room = false) {
  const w = liftReady()
  for (const action of ['ride-home', 'collect', 'smelt', 'craft'] as const) {
    const result = performDeep(w, action)
    if (!result.ok) throw new Error(result.message)
  }
  w.exploration.explorer = { x: 18, y: 11 }
  w.pods[0].mark = 'leaf'
  w.memories.entries.push({ id: 1, kind: 'note', title: '一起做暖光灯', body: '把工坊的成果带回家。', createdAt: '2026-10-28T04:00:00.000Z' })
  w.memories.nextId = 2
  if (room) {
    const change = planRoom(w, { id: 0, kind: 'home', x: 9, y: 9, w: 6, h: 3 })
    if (!change) throw new Error('小窝房间蓝图失败')
    for (let x = 9; x <= 14; x++) for (let y = 9; y <= 11; y++) if (w.tiles[y][x] === TILE.SOIL) dig(w, x, y)
    if (!finishRoom(w, change.after!.id)) throw new Error('小窝房间建成失败')
  }
  return w
}
