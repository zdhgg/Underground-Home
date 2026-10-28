import { MAP_HEIGHT, MAP_WIDTH, TILE_SIZE, stratumAt, type StratumId } from '../core/world'

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

/** 全景为观察模式，可低于操作缩放下限；返回楼层后恢复可点击尺寸。 */
export function overviewCamera(viewport: Viewport): Camera {
  const zoom = Math.min(viewport.width / (WORLD_PIXEL_WIDTH + 80), viewport.height / (WORLD_PIXEL_HEIGHT + 64), 0.85)
  return clampCamera({ x: (WORLD_PIXEL_WIDTH - viewport.width / zoom) / 2, y: (WORLD_PIXEL_HEIGHT - viewport.height / zoom) / 2, zoom }, viewport)
}

export interface DepthView {
  /** 镜头中心所在岩层；游戏规则仍以它为准。 */
  layer: StratumId
  overview: boolean
  /** 界面“正在看”的楼层：视野上部仍露出某一层时以它为准，见 lookDepth。 */
  displayLayer?: StratumId
}

export function cameraDepth(camera: Camera, viewport: Viewport, overview = false): DepthView {
  return { layer: stratumAt((camera.y + viewport.height / camera.zoom / 2) / TILE_SIZE), overview }
}

const FLOOR_LAYERS: ReadonlySet<StratumId> = new Set(['home', 'water', 'crystal', 'hall', 'garden', 'reservoir', 'ventilation', 'ruins', 'finale'])

/**
 * 显示用判层。窄屏选中建筑时镜头会把目标放在屏幕上方，中心可能已经落到下一层，
 * 于是孩子看着第一层小窝、导航却写着第二层。
 * 这里只看“视野上部 30% 是否仍是某一真实楼层”，只影响界面文案与选中态；
 * 镜头坐标、缩放和 cameraDepth 的规则判定都不变。
 */
export function lookDepth(camera: Camera, viewport: Viewport, overview = false): DepthView {
  const view = cameraDepth(camera, viewport, overview)
  if (overview) return view
  const upper = stratumAt((camera.y + viewport.height * 0.3 / camera.zoom) / TILE_SIZE)
  return FLOOR_LAYERS.has(upper) ? { ...view, displayLayer: upper } : view
}
