export interface Point {
  x: number
  y: number
}

/** 超过该像素位移即视为拖动（10px，儿童手指的容错阈值） */
export const DRAG_THRESHOLD_PX = 10

export function distanceBetween(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

/**
 * 依据位移距离判定这次指针操作是"点击"还是"拖动"，两者互斥：
 * - 位移 ≤ 阈值 → click（执行挖掘 / 互动）
 * - 位移 > 阈值 → drag（只平移画面，绝不触发挖掘）
 */
export function classifyGesture(start: Point, current: Point, threshold = DRAG_THRESHOLD_PX): 'click' | 'drag' {
  return distanceBetween(start, current) > threshold ? 'drag' : 'click'
}
