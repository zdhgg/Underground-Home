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
