import type { SleepPod, WorldState } from './world'

/** 设施在后侧、角色在前侧；土与岩石的碰撞仍由地图负责。 */
export function podBlocksPassage(w: WorldState, p: SleepPod): boolean {
  return !p.backWall && !w.rooms.some(r => r.status !== 'blueprint' && p.x >= r.x && p.x + 3 <= r.x + r.w && p.y >= r.y && p.y + 2 <= r.y + r.h)
}
