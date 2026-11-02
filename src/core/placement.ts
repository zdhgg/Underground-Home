/**
 * 各层"点中的列 → 设施左格"换算共用：
 * 点中推荐位（如果有）就用推荐位；否则让影子盖住点击列、以点击列为中心，
 * 向两侧滑到最近能放下的位置，优先不压住发现点。
 * 哪里都放不下就返回点击列本身，由上层红框说清还差什么——
 * 和前两层"点哪里就放哪里附近"的手感一致。
 */
export function snapFacilityX(tapX: number, width: number, fits: (x: number) => boolean, options: { suggested?: number | null; avoid?: readonly number[] } = {}): number {
  const { suggested = null, avoid = [] } = options
  if (suggested !== null && tapX >= suggested && tapX < suggested + width) return suggested
  if (!Number.isInteger(tapX)) return tapX
  const preferred = tapX - Math.floor((width - 1) / 2), covering: number[] = []
  for (let x = tapX - width + 1; x <= tapX; x++) covering.push(x)
  covering.sort((a, b) => Math.abs(a - preferred) - Math.abs(b - preferred))
  const blocked = (x: number): boolean => avoid.some(a => a >= x && a < x + width)
  for (const x of covering) if (!blocked(x) && fits(x)) return x
  for (const x of covering) if (fits(x)) return x
  return tapX
}
