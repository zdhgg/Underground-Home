import { LANDMARKS, STRATA, type Cell, type WorldState } from './world'
import { shaftConnected } from './exploration'

/**
 * 电向下：第一层的能源核心是整座堡垒的总电源。
 *
 * 核心修好只说明"家里有电"；把电顺着梯道送到第二层，下面才亮得起来。
 * 这是第一章之后第一个真正的跨层机制——上面的东西开始"被下面需要"。
 */

/** 核心修好、人已经下到第二层、梯道通着，才谈得上送电 */
export function canSendPowerDown(world: WorldState): boolean {
  return world.progress.coreRepaired
    && world.exploration.entered
    && shaftConnected(world)
    && !world.powerDown
}

export function sendPowerDown(world: WorldState): boolean {
  if (!canSendPowerDown(world)) return false
  world.powerDown = true
  return true
}

/**
 * 电线的折线：核心 → 大厅地面 → 梯道 → 第二层。
 * 只给渲染层画线用，规则层不依赖它；还没选梯道时返回空数组。
 */
export function powerLinePath(world: WorldState): Cell[] {
  const x = world.exploration.shaftX
  if (x === null) return []
  const floorY = STRATA.home.bottom - 1
  const coreX = LANDMARKS.generator.x
  const path: Cell[] = []
  // 从核心机身下到大厅地面
  for (let y = LANDMARKS.generator.y; y <= floorY; y++) path.push({ x: coreX, y })
  // 沿地面走到梯道口
  const step = x > coreX ? 1 : -1
  for (let cx = coreX; cx !== x; cx += step) path.push({ x: cx, y: floorY })
  // 顺着梯道下到第二层
  for (let y = floorY; y <= 19; y++) path.push({ x, y })
  return path
}
