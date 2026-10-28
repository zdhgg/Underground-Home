import { describe, expect, it } from 'vitest'
import { nestPlacement } from '../src/render/conversationAnchor'

describe('小窝说明尽量不遮住当前小窝', () => {
  it.each([
    { x: 700, y: 250, width: 1400, height: 650, targetHalfWidth: 70, targetHeight: 100, panel: { width: 300, height: 270 } },
    { x: 100, y: 220, width: 380, height: 300, targetHalfWidth: 25, targetHeight: 50, panel: { width: 220, height: 250 } },
  ])('有侧向空间时避开小窝并保持在舞台内', ({ panel, ...anchor }) => {
    const placed = nestPlacement(anchor, panel)
    expect(placed.left >= anchor.x + anchor.targetHalfWidth || placed.left + panel.width <= anchor.x - anchor.targetHalfWidth || placed.top + panel.height <= anchor.y || placed.top >= anchor.y + anchor.targetHeight).toBe(true)
    expect(placed.left).toBeGreaterThanOrEqual(0)
    expect(placed.left + panel.width).toBeLessThanOrEqual(anchor.width)
    expect(placed.top).toBeGreaterThanOrEqual(0)
    expect(placed.top + panel.height).toBeLessThanOrEqual(anchor.height)
  })
})
