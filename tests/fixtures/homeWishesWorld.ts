import { createInitialWorld, type WorldState } from '../../src/core/world'
import { RIPE_STAGE } from '../../src/core/farm'
import { secondLayerComplete } from './deepWorld'
import { warmLampWorld } from './nestWarmLampWorld'

/** 验收夹具：经过真实规则生成的可加载存档，不直接拼字段绕过校验。 */
export function earlyHomeWorld(): WorldState {
  return createInitialWorld()
}

/** 第三层完成、第一层有一间未装灯小窝；parts=0 时验证缺料提示。 */
export function lampWishWorld(parts = 1): WorldState {
  const world = warmLampWorld()
  world.deep.parts = parts
  return world
}

/** 前两层完成但第三层未完成，第二层泉边有一槽成熟菜。 */
export function ripeWishWorld(): WorldState {
  const world = secondLayerComplete()
  world.farm.planters.push({ id: 91, x: 28, y: 21, growth: RIPE_STAGE })
  return world
}

/** 两项心愿同时存在：未装灯小窝 + 成熟菜槽。 */
export function bothWishesWorld(): WorldState {
  const world = warmLampWorld()
  world.deep.parts = 1
  world.farm.planters.push({ id: 92, x: 28, y: 21, growth: RIPE_STAGE })
  return world
}
