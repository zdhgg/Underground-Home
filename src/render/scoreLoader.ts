import type { ScoreLayer } from './backgroundScore'

export type ScoreSamples = Record<ScoreLayer, Float32Array>
export type PrepareScore = (ready: (samples: ScoreSamples) => void, failed: () => void) => () => void

/** 后台合成，界面继续响应；取消后旧线程结果不再进入音频图。 */
export const prepareScore: PrepareScore = (ready, failed) => {
  const worker = new Worker(new URL('./backgroundWorker.ts', import.meta.url), { type: 'module' })
  let active = true
  const cancel = () => { active = false; worker.terminate() }
  worker.onmessage = (event: MessageEvent<ScoreSamples>) => {
    if (!active) return
    cancel()
    ready(event.data)
  }
  worker.onerror = event => {
    event.preventDefault()
    if (!active) return
    cancel(); failed()
  }
  return cancel
}
