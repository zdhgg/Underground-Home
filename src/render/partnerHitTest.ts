export interface PartnerHitTarget {
  id: string
  x: number
  y: number
  width: number
  height: number
}

/** 点击容错按屏幕像素计算；床位相邻时选最近的脸，不靠名单顺序抢点击。 */
export function hitPartner(point: { x: number; y: number }, targets: PartnerHitTarget[]): string | null {
  let best: string | null = null
  let nearest = Infinity
  for (const target of targets) {
    const cx = target.x + target.width / 2, cy = target.y + target.height / 2
    const halfW = Math.max(22, target.width / 2), halfH = Math.max(22, target.height / 2)
    if (Math.abs(point.x - cx) > halfW || Math.abs(point.y - cy) > halfH) continue
    const distance = (point.x - cx) ** 2 + (point.y - cy) ** 2
    if (distance < nearest) { nearest = distance; best = target.id }
  }
  return best
}
