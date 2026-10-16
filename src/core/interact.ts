import { LANDMARKS, TILE, type Rect, type WorldState } from './world'

/** 互动失败原因（界面层翻译为儿童可读提示） */
export type InteractFailure =
  /** 不在互动区域内 */
  | 'wrong-place'
  /** 能源石还埋在泥土里 */
  | 'not-revealed'
  /** 能源石已经收好了 */
  | 'already-collected'
  /** 需要先收集能源石 */
  | 'need-crystal'
  /** 能源核心已经在运转 */
  | 'already-repaired'

export type InteractKind = 'collect-crystal' | 'repair-core'

export interface InteractResult {
  ok: boolean
  kind: InteractKind
  x: number
  y: number
  reason?: InteractFailure
}

function inRect(rect: Rect, x: number, y: number): boolean {
  return x >= rect.x && x < rect.x + rect.w && y >= rect.y && y < rect.y + rect.h
}

/**
 * 互动规则（use rules）：点按能源石 / 能源核心的判定。
 * 与挖掘规则分离；都只修改世界数据，不做任何渲染。
 */
export function collectCrystal(world: WorldState, x: number, y: number): InteractResult {
  const base = { kind: 'collect-crystal' as const, x, y }
  if (world.progress.crystalCollected) return { ...base, ok: false, reason: 'already-collected' }
  if (!inRect(LANDMARKS.crystalZone, x, y)) return { ...base, ok: false, reason: 'wrong-place' }
  if (world.tiles[y][x] !== TILE.EMPTY) return { ...base, ok: false, reason: 'not-revealed' }
  world.progress.crystalCollected = true
  return { ...base, ok: true }
}

export function repairCore(world: WorldState, x: number, y: number): InteractResult {
  const base = { kind: 'repair-core' as const, x, y }
  if (world.progress.coreRepaired) return { ...base, ok: false, reason: 'already-repaired' }
  if (!inRect(LANDMARKS.generatorZone, x, y)) return { ...base, ok: false, reason: 'wrong-place' }
  if (!world.progress.crystalCollected) return { ...base, ok: false, reason: 'need-crystal' }
  world.progress.coreRepaired = true
  return { ...base, ok: true }
}
