import type { WorldState } from './world'

/**
 * 客厅：第一层"安床之后、下楼之前"的那一步。
 *
 * 它早就在代码里能建（预设洞室 `home-lounge`、房间用途 `lounge`、手绘长椅茶桌），
 * 但从来没有进过主线，也没有任何回报，于是跟着阿土走的孩子会直接下第二层。
 * 这里只负责"算不算建成"这一条判定，位置与费用仍由 sites / rooms 决定。
 */
export const LOUNGE_SITE_ID = 'home-lounge'

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
