import { LANDMARKS, TILE, type WorldState } from './world'
import {
  REQUIRED_STONES,
  collectedStoneCount,
  markStoneCollected,
  stoneAt,
  stoneCollected,
  stoneRevealed,
  type EnergyStoneId,
} from './energyStones'

/**
 * 互动规则（use rules）：点按能源石 / 能源核心的判定。
 * 与挖掘规则分离；都只修改世界数据，不做任何渲染。
 */

/** 互动失败原因（界面层翻译为儿童可读提示） */
export type InteractFailure =
  /** 不在互动区域内 */
  | 'wrong-place'
  /** 能源石还埋在泥土里 */
  | 'not-revealed'
  /** 这块能源石已经收好了 */
  | 'already-collected'
  /** 手上还没有能源石 */
  | 'need-crystal'
  /** 已经装了一块，还差另一块才能点亮 */
  | 'need-more-stones'
  /** 能源核心已经在运转 */
  | 'already-repaired'

export type InteractKind = 'collect-crystal' | 'repair-core'

/** 装核心会走两个阶段：先"装上一块"，再"点亮家园"。 */
export type CoreStage = 'loaded' | 'repaired'

export interface InteractResult {
  ok: boolean
  kind: InteractKind
  x: number
  y: number
  reason?: InteractFailure
  /** 收的是哪一块石头 */
  stone?: EnergyStoneId
  /** 核心这一步走到哪一级 */
  stage?: CoreStage
}

function inRect(rect: { x: number; y: number; w: number; h: number }, x: number, y: number): boolean {
  return x >= rect.x && x < rect.x + rect.w && y >= rect.y && y < rect.y + rect.h
}

/**
 * 收集能源石：点到的格子要在某块石头的容错区里，且该格已经挖空。
 * 点泥土只是"还没露出来"，交给挖掘流程继续处理。
 */
export function collectCrystal(world: WorldState, x: number, y: number): InteractResult {
  const base = { kind: 'collect-crystal' as const, x, y }
  const stone = stoneAt(x, y)
  if (!stone) return { ...base, ok: false, reason: 'wrong-place' }
  if (stoneCollected(world, stone)) return { ...base, ok: false, reason: 'already-collected', stone: stone.id }
  if (!stoneRevealed(world, stone) || world.tiles[y]?.[x] !== TILE.EMPTY) {
    return { ...base, ok: false, reason: 'not-revealed', stone: stone.id }
  }
  markStoneCollected(world, stone)
  return { ...base, ok: true, stone: stone.id }
}

/**
 * 点能源核心：手上有一块就装上（家园只亮一点点），
 * 两块都在手上就直接点亮家园。顺序无关，也不会因为先收哪块而卡住。
 */
export function repairCore(world: WorldState, x: number, y: number): InteractResult {
  const base = { kind: 'repair-core' as const, x, y }
  if (world.progress.coreRepaired) return { ...base, ok: false, reason: 'already-repaired' }
  if (!inRect(LANDMARKS.generatorZone, x, y)) return { ...base, ok: false, reason: 'wrong-place' }
  const collected = collectedStoneCount(world)
  if (collected === 0) return { ...base, ok: false, reason: 'need-crystal' }
  if (collected >= REQUIRED_STONES) {
    world.progress.coreLoaded = true
    world.progress.coreRepaired = true
    return { ...base, ok: true, stage: 'repaired' }
  }
  if (!world.progress.coreLoaded) {
    world.progress.coreLoaded = true
    return { ...base, ok: true, stage: 'loaded' }
  }
  return { ...base, ok: false, reason: 'need-more-stones' }
}
