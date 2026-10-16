import { describe, expect, it } from 'vitest'
import { DRAG_THRESHOLD_PX, classifyGesture, distanceBetween } from '../src/input/gesture'
import {
  MAX_ZOOM,
  MIN_ZOOM,
  WORLD_PIXEL_HEIGHT,
  WORLD_PIXEL_WIDTH,
  clampZoom,
  panCamera,
  screenToWorld,
  worldToScreen,
  zoomAt,
  type Camera,
  type Viewport,
} from '../src/render/camera'

const viewport: Viewport = { width: 800, height: 600 }

describe('点击与拖动判定（输入行为互不误触）', () => {
  it('位移很小是点击', () => {
    expect(classifyGesture({ x: 100, y: 100 }, { x: 104, y: 103 })).toBe('click')
  })

  it('位移超过阈值是拖动', () => {
    expect(classifyGesture({ x: 100, y: 100 }, { x: 130, y: 100 })).toBe('drag')
  })

  it('恰好等于阈值仍视为点击（必须大于阈值才算拖动）', () => {
    expect(classifyGesture({ x: 0, y: 0 }, { x: 0, y: DRAG_THRESHOLD_PX })).toBe('click')
  })

  it('斜向位移按直线距离计算', () => {
    expect(distanceBetween({ x: 0, y: 0 }, { x: 8, y: 8 })).toBeGreaterThan(DRAG_THRESHOLD_PX)
    expect(classifyGesture({ x: 0, y: 0 }, { x: 8, y: 8 })).toBe('drag')
  })
})

describe('相机换算与约束', () => {
  it('屏幕坐标与世界坐标互为逆变换', () => {
    const camera: Camera = { x: 120, y: 80, zoom: 1.5 }
    const world = screenToWorld(camera, 320, 240)
    const screen = worldToScreen(camera, world.x, world.y)
    expect(screen.x).toBeCloseTo(320)
    expect(screen.y).toBeCloseTo(240)
  })

  it('缩放时锚点下的世界内容保持不动', () => {
    const camera: Camera = { x: 200, y: 150, zoom: 1 }
    const anchor = { x: 400, y: 300 }
    const before = screenToWorld(camera, anchor.x, anchor.y)
    const next = zoomAt(camera, 0.4, anchor, viewport)
    const after = screenToWorld(next, anchor.x, anchor.y)
    expect(after.x).toBeCloseTo(before.x)
    expect(after.y).toBeCloseTo(before.y)
  })

  it('缩放被限制在上下限内', () => {
    const camera: Camera = { x: 200, y: 150, zoom: 1 }
    expect(zoomAt(camera, 99, { x: 0, y: 0 }, viewport).zoom).toBe(MAX_ZOOM)
    expect(zoomAt(camera, -99, { x: 0, y: 0 }, viewport).zoom).toBe(MIN_ZOOM)
    expect(clampZoom(0.01)).toBe(MIN_ZOOM)
  })

  it('拖动相机不会把地图拖出视野太远', () => {
    const camera: Camera = { x: 0, y: 0, zoom: 1 }
    const toFarRight = panCamera(camera, -99999, -99999, viewport)
    expect(toFarRight.x).toBeLessThanOrEqual(WORLD_PIXEL_WIDTH)
    expect(toFarRight.y).toBeLessThanOrEqual(WORLD_PIXEL_HEIGHT)

    const toFarLeft = panCamera(camera, 99999, 99999, viewport)
    expect(toFarLeft.x).toBeGreaterThanOrEqual(-200)
    expect(toFarLeft.y).toBeGreaterThanOrEqual(-200)
  })
})
