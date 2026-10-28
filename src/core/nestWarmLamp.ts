import { podDoor } from './build'
import { podBlocksPassage } from './passages'
import type { Cell, WorldState } from './world'

/** 只改善已建成的小窝；蓝图不生成 pod，因此不可能提前安装。 */
export function nestWarmLampProblem(w: WorldState, podId: number): string | null {
  if (!w.deep.completed) return '先完成第三层，再把工坊的成果带回小窝吧。'
  const pod = w.pods.find(p => p.id === podId)
  if (!pod) return '这间小窝已经不在这里啦，请重新选择。'
  if (pod.warmLamp) return '暖光灯已经装好啦。'
  if (w.deep.parts < 1) return '还需要1个工坊部件，去第三层岩壁工坊做一个吧。'
  return null
}

/** 独立舱停在真实门外；后墙小窝优先停在入口端的前侧通道。 */
export function nestWarmLampWorkCells(w: WorldState, podId: number): Cell[] {
  const p = w.pods.find(p => p.id === podId)
  if (!p) return []
  if (podBlocksPassage(w, p)) return [podDoor(p)]
  const x = p.x + (p.door === 'left' ? 0 : 2), y = p.y + 1
  return [{ x: x + (p.door === 'left' ? -1 : 1), y }, { x, y }]
}

/** 到场、施工完成后原子结算。没有预扣款或持久的半完成态。 */
export function installNestWarmLamp(w: WorldState, podId: number): boolean {
  if (nestWarmLampProblem(w, podId)) return false
  w.pods.find(p => p.id === podId)!.warmLamp = true
  w.deep.parts--
  return true
}
