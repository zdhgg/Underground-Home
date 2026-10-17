import { classifyGesture, type Point } from './gesture'

export interface PointerControlsHandlers {
  /** 判定为点击时触发（画布局部坐标，CSS 像素） */
  onTap(screen: Point): void
  /** 判定为拖动时触发（相对上一样本的屏幕位移） */
  onPanBy(delta: Point): void
  /** 指针悬停位置变化；离开画布时为 null */
  onHover(screen: Point | null): void
  /** 滚轮缩放；delta > 0 为放大 */
  onZoom(delta: number, anchor: Point): void
}

export interface PointerControls {
  /** 解除全部事件绑定 */
  detach(): void
  /**
   * 丢掉没结束的手势（窗口失焦、切后台、指针捕获被收回）。
   * 只复位手势状态，不改画面与世界；这样回到游戏后的第一次点击依然有效。
   */
  reset(): void
}

/**
 * 画布指针控制：把底层指针事件翻译成"点击 / 拖动 / 缩放"意图。
 * 单击与拖动严格区分（距离阈值），互不误触；
 * 本模块只处理手势，不关心世界规则与渲染。
 */
export function attachPointerControls(canvas: HTMLCanvasElement, handlers: PointerControlsHandlers): PointerControls {
  let startPoint: Point | null = null
  let lastPoint: Point | null = null
  let panning = false
  let activePointerId: number | null = null

  const toLocal = (event: { clientX: number; clientY: number }): Point => {
    const rect = canvas.getBoundingClientRect()
    return { x: event.clientX - rect.left, y: event.clientY - rect.top }
  }

  const reset = (): void => {
    if (activePointerId !== null) {
      try {
        canvas.releasePointerCapture(activePointerId)
      } catch {
        /* 捕获早就丢了就忽略 */
      }
    }
    activePointerId = null
    startPoint = null
    lastPoint = null
    panning = false
  }

  const onPointerDown = (event: PointerEvent): void => {
    // 只响应主键（左键 / 触摸 / 笔尖）；右键与中键不进入手势流程
    if (event.pointerType === 'mouse' && event.button !== 0) return
    // P0 暂不支持多指手势（缩放捏合留到后续阶段）
    if (activePointerId !== null) return
    activePointerId = event.pointerId
    startPoint = toLocal(event)
    lastPoint = startPoint
    panning = false
    try {
      canvas.setPointerCapture(event.pointerId)
    } catch {
      /* 某些环境不支持指针捕获，忽略即可 */
    }
  }

  const onPointerMove = (event: PointerEvent): void => {
    if (activePointerId !== event.pointerId || !startPoint || !lastPoint) {
      handlers.onHover(toLocal(event))
      return
    }
    const current = toLocal(event)
    if (!panning && classifyGesture(startPoint, current) === 'drag') panning = true
    if (panning) handlers.onPanBy({ x: current.x - lastPoint.x, y: current.y - lastPoint.y })
    lastPoint = current
  }

  const endPointer = (event: PointerEvent, cancelled: boolean): void => {
    if (activePointerId !== event.pointerId) return
    const current = toLocal(event)
    const wasClick = !cancelled && !panning && startPoint !== null && classifyGesture(startPoint, current) === 'click'
    reset()
    if (wasClick) handlers.onTap(current)
  }

  const onPointerUp = (event: PointerEvent): void => endPointer(event, false)
  const onPointerCancel = (event: PointerEvent): void => endPointer(event, true)
  const onPointerLeave = (): void => handlers.onHover(null)
  /** 捕获被系统收回（窗口失焦、设备被拔掉）时等不到 pointerup，直接复位。 */
  const onLostCapture = (): void => reset()

  const onWheel = (event: WheelEvent): void => {
    event.preventDefault()
    handlers.onZoom(event.deltaY < 0 ? 0.12 : -0.12, toLocal(event))
  }

  const onContextMenu = (event: MouseEvent): void => event.preventDefault()

  canvas.addEventListener('pointerdown', onPointerDown)
  canvas.addEventListener('pointermove', onPointerMove)
  canvas.addEventListener('pointerup', onPointerUp)
  canvas.addEventListener('pointercancel', onPointerCancel)
  canvas.addEventListener('pointerleave', onPointerLeave)
  canvas.addEventListener('lostpointercapture', onLostCapture)
  canvas.addEventListener('wheel', onWheel, { passive: false })
  canvas.addEventListener('contextmenu', onContextMenu)

  return {
    reset,
    detach: () => {
      canvas.removeEventListener('pointerdown', onPointerDown)
      canvas.removeEventListener('pointermove', onPointerMove)
      canvas.removeEventListener('pointerup', onPointerUp)
      canvas.removeEventListener('pointercancel', onPointerCancel)
      canvas.removeEventListener('pointerleave', onPointerLeave)
      canvas.removeEventListener('lostpointercapture', onLostCapture)
      canvas.removeEventListener('wheel', onWheel)
      canvas.removeEventListener('contextmenu', onContextMenu)
    },
  }
}
