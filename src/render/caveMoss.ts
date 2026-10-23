import { Container, Graphics } from 'pixi.js'
import { waterSpan } from '../core/exploration'
import { siteById } from '../core/sites'
import { LANDMARKS, TILE, TILE_SIZE, type Rect, type WorldState } from '../core/world'
import { WATER_BARREL_X } from './farmProps'

/** 洞道最高空格的上一行就是垂苔的实心顶；整列实心则没有洞顶可挂。 */
function mossCeiling(world: WorldState, x: number): number | null {
  for (let y = 18; y <= 21; y++) {
    if (world.tiles[y][x] === TILE.EMPTY) return y - 1
  }
  return null
}

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
  const avoided = (x: number): boolean =>
    Math.abs(x - LANDMARKS.spring.x) <= 2 || Math.abs(x - world.exploration.shaftX!) <= 1
    || (world.farm.waterSupplied && Math.abs(x + .5 - WATER_BARREL_X) < 1)
    // 连同设施边缘留出一格；检查背景苔斑所在的第二层后壁，不影响上层设施。
    || occupied.some(rect => rect.y < 22 && rect.y + rect.h > 20 && x >= rect.x - 1 && x < rect.x + rect.w + 1)
  for (let x = span.left; x <= span.right; x++) {
    if (x % 6 === 0 && !avoided(x)) {
      const moss = new Graphics({ label: 'cave-moss' })
      moss.eventMode = 'none'
      moss.alpha = .24
      moss.position.set((x + .5) * TILE_SIZE, 22 * TILE_SIZE - 10)
      moss.ellipse(-5, 0, 8, 2.4).ellipse(4, -1.3, 6, 2).fill(0x668578)
      moss.ellipse(-3, -2.5, 3, 1.5).fill({ color: 0x789184, alpha: .45 })
      view.addChild(moss)
    }
    // 洞顶垂苔：与地面苔错开三列，挂在每列最高的实心岩下沿。
    if (x % 6 === 3 && !avoided(x)) {
      const ceiling = mossCeiling(world, x)
      if (ceiling === null) continue
      const moss = new Graphics({ label: 'cave-moss-ceiling' })
      moss.eventMode = 'none'
      moss.alpha = .2
      moss.position.set((x + .5) * TILE_SIZE, (ceiling + 1) * TILE_SIZE - 6)
      moss.ellipse(-4, 0, 6, 2).ellipse(3, 1.2, 4.4, 1.8).fill(0x668578)
      moss.ellipse(0, 2.4, 2.2, 2.2).fill({ color: 0x789184, alpha: .5 })
      view.addChild(moss)
    }
  }
  return view
}
