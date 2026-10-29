import { atuRoute } from './atu'
import { availablePartners } from './partners'
import type { Cell, WorkerId, WorldState } from './world'

/**
 * 客厅：第一层"安床之后、下楼之前"的那一步，也是第一层唯一一处"坐下来"的地方。
 *
 * 它早就在代码里能建（预设洞室 `home-lounge`、房间用途 `lounge`、手绘长椅茶桌），
 * 但从来没有进过主线，建成之后也没有任何用途。这里给它两件事：
 *   1. 判定"算不算建成"（`loungeBuilt` / `loungeTaskDone`），供主线使用；
 *   2. 一条可以反复做的活动「一起坐一会儿」：伙伴真的走过来坐下、说一句家里的近况，
 *      每坐一次客厅暖一点（地毯 → 盆栽）。
 *
 * 规则只读写世界与路线，不碰画面；演出由会话层用既有的围坐动画播放。
 */
export const LOUNGE_SITE_ID = 'home-lounge'

/** 预设客厅的占地；房间记录缺失时兜底用。 */
const LOUNGE_LAYOUT = { x: 28, y: 9, w: 5, h: 3 }

/** 一起坐过几次之后，客厅就不再添东西了。 */
export const LOUNGE_STAGE_LIMIT = 2

/** 预设洞室里建好的客厅，或自己挖出来布置的客厅，都算。不限制选址。 */
export function loungeBuilt(world: WorldState): boolean {
  return world.builtSites.some(site => site.id === LOUNGE_SITE_ID)
    || world.rooms.some(room => room.status !== 'blueprint' && room.kind === 'lounge')
}

/**
 * 客厅这一步是否已经过去了。
 * 已经下到第二层的存档不再补课——旧档从来没被引导过这件事，
 * 不应该在某次更新之后被要求回头建一间房子。
 */
export function loungeTaskDone(world: WorldState): boolean {
  return loungeBuilt(world) || world.exploration.entered
}

/** 第一间建成的客厅；扩建中的蓝图不算。 */
export function loungeRoom(world: WorldState): { x: number; y: number; w: number; h: number } | null {
  const room = world.rooms
    .filter(item => item.status !== 'blueprint' && item.kind === 'lounge')
    .sort((a, b) => a.id - b.id)[0]
  if (room) return { x: room.x, y: room.y, w: room.w, h: room.h }
  return world.builtSites.some(item => item.id === LOUNGE_SITE_ID) ? { ...LOUNGE_LAYOUT } : null
}

/**
 * 长椅前的地面座位：从左到右，最多三位伙伴。
 * 刻意避开房间左右两个角——那是伙伴平时待命的位置，
 * 坐下时应该看得出"走过来"，而不是本来就站在那里。
 */
export function loungeSeats(world: WorldState): Cell[] {
  const room = loungeRoom(world)
  if (!room) return []
  const room_left = room.x + 1
  return Array.from({ length: Math.min(3, room.w - 2) }, (_, index) => ({ x: room_left + index, y: room.y + room.h - 1 }))
}

/** 一次「一起坐一会儿」的走位；与共餐走位同形，可以直接交给围坐动画。 */
export interface LoungeMove { id: WorkerId; route: Cell[]; seat: Cell }

/**
 * 伙伴从记录站位走到长椅前的空位。走不到的那位就不勉强，
 * 演出由其余人完成——不会因为没有走位而卡住活动。
 */
export function planLoungeGathering(world: WorldState): LoungeMove[] {
  const seats = loungeSeats(world)
  if (seats.length === 0) return []
  const moves: LoungeMove[] = []
  for (const partner of availablePartners(world)) {
    if (partner.id === 'atu') continue
    const start = world.workers[partner.id]
    if (!start) continue
    const used = new Set(moves.map(move => `${move.seat.x},${move.seat.y}`))
    const seat = seats.find(cell => !used.has(`${cell.x},${cell.y}`))
    if (!seat) break
    const route = atuRoute(world, start, seat, true)
    if (route) moves.push({ id: partner.id, route, seat })
  }
  return moves
}

/** 客厅随坐过的次数变暖：0 空着 → 1 有地毯 → 2 还多一盆花。 */
export const loungeStage = (rests: number): number => Math.max(0, Math.min(LOUNGE_STAGE_LIMIT, rests))

export interface RestResult {
  ok: boolean
  rests: number
  stage: number
  /** 第一次一起坐下 */
  first: boolean
  /** 这一次刚好跨过一档，客厅添了新东西 */
  advanced: boolean
}

/** 唯一结算入口：记一次"一起坐过"，返回客厅的新档位。 */
export function restAtLounge(world: WorldState): RestResult {
  if (!loungeRoom(world)) {
    return { ok: false, rests: world.lounge.rests, stage: loungeStage(world.lounge.rests), first: false, advanced: false }
  }
  const before = loungeStage(world.lounge.rests)
  world.lounge.rests += 1
  const after = loungeStage(world.lounge.rests)
  return { ok: true, rests: world.lounge.rests, stage: after, first: world.lounge.rests === 1, advanced: after > before }
}

/**
 * 坐下来时伙伴说的话：按家里现在的处境挑一句，不抢主线的提示。
 * 第一次坐下永远是最有分量的一句——"以前一个人守着这里"。
 */
export function restLine(world: WorldState): string {
  if (world.lounge.rests <= 1) return '阿灯：以前我一个人守着这里，现在有人一起坐了。'
  if (world.farm.sharedMeals > 0) return `阿土：一起吃过 ${world.farm.sharedMeals} 顿了，这个家越来越像家。`
  if (world.farm.harvests > 0) return '小满：菜都收好啦，就差一张灶台了。'
  if (world.exploration.springFound) return '小泉：水管接好了，家里随时都有水。'
  return '阿土：再坐一会儿，楼下好像还有声音……'
}
