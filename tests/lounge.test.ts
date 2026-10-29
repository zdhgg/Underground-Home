import { describe, expect, it } from 'vitest'
import { placePod } from '../src/core/build'
import { dig } from '../src/core/dig'
import {
  LOUNGE_STAGE_LIMIT,
  loungeBuilt,
  loungeRoom,
  loungeSeats,
  loungeStage,
  loungeTaskDone,
  planLoungeGathering,
  restAtLounge,
  restLine,
} from '../src/core/lounge'
import { initializeWorkers } from '../src/core/partnerWork'
import { deserialize, serialize } from '../src/core/persistence'
import { TILE, WORLD_VERSION, createInitialWorld, type WorldState } from '../src/core/world'

/** 点亮、安床、右翼挖出客厅：第一层"可以坐下来"的最小世界。 */
function loungeWorld(rests = 0): WorldState {
  const w = createInitialWorld()
  w.lounge = { rests }
  w.progress = { crystalFound: true, crystalCollected: true, secondCrystalFound: true, secondCrystalCollected: true, coreLoaded: true, coreRepaired: true }
  w.tiles[9][14] = TILE.EMPTY
  for (let y = 10; y <= 11; y++) for (let x = 12; x <= 14; x++) dig(w, x, y)
  placePod(w, 12, 10)
  for (let y = 9; y <= 11; y++) for (let x = 26; x <= 32; x++) dig(w, x, y)
  w.rooms.push({ id: 1, kind: 'lounge', x: 28, y: 9, w: 5, h: 3, managed: true })
  w.nextRoomId = 2
  w.exploration.explorer = { x: 25, y: 11 }
  initializeWorkers(w)
  return w
}

describe('客厅：建成判定与座位', () => {
  it('没有客厅时什么都不能做', () => {
    const w = createInitialWorld()
    expect(loungeBuilt(w)).toBe(false)
    expect(loungeRoom(w)).toBeNull()
    expect(loungeSeats(w)).toEqual([])
    expect(planLoungeGathering(w)).toEqual([])
    expect(restAtLounge(w)).toMatchObject({ ok: false })
    expect(w.lounge.rests).toBe(0)
  })

  it('自由挖出来布置的客厅也算数，座位在长椅前的地面', () => {
    const w = loungeWorld()
    expect(loungeBuilt(w)).toBe(true)
    expect(loungeRoom(w)).toEqual({ x: 28, y: 9, w: 5, h: 3 })
    expect(loungeSeats(w)).toEqual([{ x: 29, y: 11 }, { x: 30, y: 11 }, { x: 31, y: 11 }])
  })

  it('已经下到第二层的旧档不再被要求补建客厅', () => {
    const w = createInitialWorld()
    expect(loungeTaskDone(w)).toBe(false)
    w.exploration.entered = true
    expect(loungeTaskDone(w)).toBe(true)
  })
})

describe('一起坐一会儿', () => {
  it('每坐一次计一次，客厅从空着到有地毯再到有花', () => {
    const w = loungeWorld()
    const first = restAtLounge(w)
    expect(first).toMatchObject({ ok: true, rests: 1, stage: 1, first: true, advanced: true })
    const second = restAtLounge(w)
    expect(second).toMatchObject({ rests: 2, stage: 2, first: false, advanced: true })
    const third = restAtLounge(w)
    expect(third).toMatchObject({ rests: 3, stage: LOUNGE_STAGE_LIMIT, first: false, advanced: false })
    expect(loungeStage(99)).toBe(LOUNGE_STAGE_LIMIT)
  })

  it('第一次坐下是最有分量的一句，之后按家里的处境换', () => {
    const w = loungeWorld()
    const first = restAtLounge(w)
    expect(first.rests).toBe(1)
    expect(restLine(w)).toContain('以前我一个人守着这里')
    restAtLounge(w)
    expect(restLine(w)).toContain('楼下好像还有声音')
    w.farm.harvests = 1
    expect(restLine(w)).toContain('灶台')
    w.farm.sharedMeals = 2
    expect(restLine(w)).toContain('一起吃过 2 顿')
  })

  it('伙伴会走到长椅前坐下，阿土不在座次里', () => {
    const w = loungeWorld()
    const moves = planLoungeGathering(w)
    expect(moves.length).toBeGreaterThan(0)
    expect(moves.every(move => (move.id as string) !== 'atu')).toBe(true)
    const seats = moves.map(move => `${move.seat.x},${move.seat.y}`)
    expect(new Set(seats).size).toBe(seats.length)
    for (const move of moves) expect(move.route.length).toBeGreaterThan(0)
  })
})

describe('客厅次数进存档', () => {
  it('往返保留一起坐过的次数', () => {
    const w = loungeWorld(2)
    const payload = serialize(w)
    expect(payload.version).toBe(WORLD_VERSION)
    expect(payload.world.lounge).toEqual({ rests: 2 })
    const loaded = deserialize(JSON.parse(JSON.stringify(payload)))
    expect(loaded.ok).toBe(true)
    if (loaded.ok) expect(loaded.world.lounge).toEqual({ rests: 2 })
  })

  it('v27 旧档没有客厅字段，补成 0 次', () => {
    const w = loungeWorld()
    const payload = serialize(w)
    payload.version = 27
    delete (payload.world as unknown as Record<string, unknown>).lounge
    const loaded = deserialize(JSON.parse(JSON.stringify(payload)))
    expect(loaded.ok).toBe(true)
    if (loaded.ok) expect(loaded.world.lounge).toEqual({ rests: 0 })
  })

  it('当前版本缺字段或次数非法时按损坏处理', () => {
    const w = loungeWorld()
    const missing = serialize(w)
    delete (missing.world as unknown as Record<string, unknown>).lounge
    expect(deserialize(JSON.parse(JSON.stringify(missing))).ok).toBe(false)
    const bad = serialize(w)
    ;(bad.world.lounge as { rests: number }).rests = -1
    expect(deserialize(JSON.parse(JSON.stringify(bad))).ok).toBe(false)
  })
})
