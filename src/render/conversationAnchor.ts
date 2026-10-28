/** 地图角色投影到舞台内的 CSS 坐标；不包含任务或对话规则。 */
export interface ConversationAnchor { x: number; y: number; width: number; height: number }

export function conversationPlacement(anchor: ConversationAnchor, size: { width: number; height: number }) {
  const margin = 12, gap = 22
  const width = Math.min(size.width, anchor.width - margin * 2)
  const height = Math.min(size.height, anchor.height - margin * 2)
  const below = anchor.y - height - gap < margin && anchor.y + gap + height <= anchor.height - margin
  const left = Math.max(margin, Math.min(anchor.width - width - margin, anchor.x - width / 2))
  const top = Math.max(margin, Math.min(anchor.height - height - margin, below ? anchor.y + gap : anchor.y - height - gap))
  return { left, top, below, tail: Math.max(20, Math.min(width - 20, anchor.x - left)) }
}

/** 小窝对话优先避开完整设施；空间不足时沿用普通对话的屏内兜底。 */
export function nestPlacement(anchor: ConversationAnchor & { targetHalfWidth?: number; targetHeight?: number }, size: { width: number; height: number }) {
  const { width, height } = size, gap = 22, margin = 12
  const centered = () => Math.max(margin, Math.min(anchor.width - width - margin, anchor.x - width / 2))
  const above = anchor.y - height - gap
  if (anchor.width >= 500 && above >= margin) return { left: centered(), top: above }
  const half = anchor.targetHalfWidth ?? 0
  const right = anchor.x + half + gap, left = anchor.x - half - gap - width
  const side = right + width <= anchor.width - margin ? right : left >= margin ? left : null
  if (side !== null) return { left: side, top: Math.max(margin, Math.min(anchor.height - height - margin, anchor.y - height / 2)) }
  const below = anchor.y + (anchor.targetHeight ?? 0) + gap
  if (below + height <= anchor.height - margin) return { left: centered(), top: below }
  return conversationPlacement(anchor, size)
}
