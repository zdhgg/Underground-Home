import { Container, Graphics } from 'pixi.js'
import { waterSpan } from '../core/exploration'
import { siteById } from '../core/sites'
import { LANDMARKS, TILE_SIZE, type Rect, type WorldState } from '../core/world'
import { WATER_BARREL_X } from './farmProps'

/** 只做背景取景：不生成物品、碰撞或交互，不写入世界与存档。 */
export function drawCaveMoss(world: WorldState): Container {
  const view = new Container({ label: 'cave-moss-background' })
  view.eventMode = 'none'
  const span = waterSpan(world)
  if (!span) return view
  const occupied: Rect[] = [
    ...world.builtSites.flatMap(built => { const site = siteById(built.id); return site ? [site] : [] }),
    ...world.rooms, // 规划中的房间也让位，避免背景斑块与蓝图混在一起。
    ...world.pods.map(pod => ({ ...pod, w: 3, h: 2 })),
    ...world.farm.planters.map(planter => ({ ...planter, w: 1, h: 1 })),
  ]
  for (let x = span.left; x <= span.right; x++) {
    if (x % 6 !== 0 || Math.abs(x - LANDMARKS.spring.x) <= 2 || Math.abs(x - world.exploration.shaftX!) <= 1) continue
    if (world.farm.waterSupplied && Math.abs(x + .5 - WATER_BARREL_X) < 1) continue
    // 连同设施边缘留出一格；检查背景苔斑所在的第二层后壁，不影响上层设施。
    if (occupied.some(rect => rect.y < 22 && rect.y + rect.h > 20 && x >= rect.x - 1 && x < rect.x + rect.w + 1)) continue
    const moss = new Graphics({ label: 'cave-moss' })
    moss.eventMode = 'none'
    moss.alpha = .24
    moss.position.set((x + .5) * TILE_SIZE, 22 * TILE_SIZE - 10)
    moss.ellipse(-5, 0, 8, 2.4).ellipse(4, -1.3, 6, 2).fill(0x668578)
    moss.ellipse(-3, -2.5, 3, 1.5).fill({ color: 0x789184, alpha: .45 })
    view.addChild(moss)
  }
  return view
}
