import { MAP_HEIGHT, MAP_WIDTH, TILE_SIZE } from '../core/world'

/** 相机：记录视口左上角对应的世界坐标（像素）与缩放 */
export interface Camera {
  x: number
  y: number
  zoom: number
}

/** 视口尺寸（CSS 像素） */
export interface Viewport {
  width: number
  height: number
}

export const MIN_ZOOM = 0.6
export const MAX_ZOOM = 2.2

/** 世界边缘允许拉出视口的留白（世界像素） */
const EDGE_PADDING = 120

export const WORLD_PIXEL_WIDTH = MAP_WIDTH * TILE_SIZE
export const WORLD_PIXEL_HEIGHT = MAP_HEIGHT * TILE_SIZE

export function clampZoom(zoom: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom))
}

/** 屏幕坐标（CSS 像素）→ 世界坐标（像素，可含小数） */
export function screenToWorld(camera: Camera, screenX: number, screenY: number): { x: number; y: number } {
  return { x: screenX / camera.zoom + camera.x, y: screenY / camera.zoom + camera.y }
}

/** 世界坐标 → 屏幕坐标 */
export function worldToScreen(camera: Camera, worldX: number, worldY: number): { x: number; y: number } {
  return { x: (worldX - camera.x) * camera.zoom, y: (worldY - camera.y) * camera.zoom }
}

/** 把相机约束在合理的世界范围内：世界比视口小时该轴居中 */
export function clampCamera(camera: Camera, viewport: Viewport): Camera {
  return {
    x: clampAxis(camera.x, viewport.width / camera.zoom, WORLD_PIXEL_WIDTH),
    y: clampAxis(camera.y, viewport.height / camera.zoom, WORLD_PIXEL_HEIGHT),
    zoom: camera.zoom,
  }
}

function clampAxis(position: number, visible: number, world: number): number {
  if (world <= visible) return (world - visible) / 2
  const min = -EDGE_PADDING
  const max = world - visible + EDGE_PADDING
  return Math.min(max, Math.max(min, position))
}

/** 以某个屏幕点为锚点缩放：保证锚点下的世界内容保持不动 */
export function zoomAt(
  camera: Camera,
  deltaZoom: number,
  anchor: { x: number; y: number },
  viewport: Viewport,
): Camera {
  const zoom = clampZoom(camera.zoom + deltaZoom)
  if (zoom === camera.zoom) return camera
  const before = screenToWorld(camera, anchor.x, anchor.y)
  const next: Camera = { x: before.x - anchor.x / zoom, y: before.y - anchor.y / zoom, zoom }
  return clampCamera(next, viewport)
}

/** 平移相机：dx/dy 为屏幕像素位移（例如拖动的位移量） */
export function panCamera(camera: Camera, dxScreen: number, dyScreen: number, viewport: Viewport): Camera {
  return clampCamera(
    { x: camera.x - dxScreen / camera.zoom, y: camera.y - dyScreen / camera.zoom, zoom: camera.zoom },
    viewport,
  )
}

/** 让某个世界坐标点居中 */
export function centerOn(
  worldX: number,
  worldY: number,
  viewport: Viewport,
  zoom = 1,
): Camera {
  const z = clampZoom(zoom)
  return clampCamera({ x: worldX - viewport.width / z / 2, y: worldY - viewport.height / z / 2, zoom: z }, viewport)
}
