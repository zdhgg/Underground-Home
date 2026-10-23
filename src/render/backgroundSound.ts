import { SCORE_LAYERS, SCORE_SAMPLE_RATE, SCORE_SECONDS, type ScoreLayer } from './backgroundScore'
import { prepareScore, type PrepareScore } from './scoreLoader'

export interface SoundscapeScene { powered: boolean; water: boolean; focused: boolean }

export function soundscapeMix(scene: SoundscapeScene, milestone: boolean): Record<ScoreLayer, number> {
  const duck = milestone ? .18 : scene.focused ? .3 : 1
  return {
    quiet: scene.powered ? 0 : .22 * duck,
    home: scene.powered ? .21 * duck : 0,
    cave: .1 * duck,
    water: scene.water ? .16 * duck : 0,
  }
}

/** 固定四轨、共用乐句相位，切层只调音量；停止后复用缓冲，不堆积定时器和音符。 */
export class BackgroundSound {
  private buffers = new Map<ScoreLayer, AudioBuffer>()
  private loops: { layer: ScoreLayer; source: AudioBufferSourceNode; gain: GainNode; target: number }[] = []
  private origin: number | null = null
  private preparing = false
  private failed = false
  private cancelPreparation: (() => void) | null = null

  constructor(private readonly ctx: AudioContext, private readonly output: AudioNode, private readonly prepare: PrepareScore = prepareScore) {}

  update(scene: SoundscapeScene, milestone: boolean): void {
    if (this.failed) return
    if (!this.preparing && !this.buffers.size) {
      this.preparing = true
      this.cancelPreparation = this.prepare(samples => {
        if (this.failed) return
        try {
          for (const layer of SCORE_LAYERS) {
            const data = samples[layer]
            const buffer = this.ctx.createBuffer(1, data.length, SCORE_SAMPLE_RATE)
            buffer.getChannelData(0).set(data)
            this.buffers.set(layer, buffer)
          }
        } catch { this.failed = true; this.buffers.clear() }
      }, () => { this.failed = true })
    }
    if (this.buffers.size !== SCORE_LAYERS.length) return
    if (!this.loops.length) this.start()
    const mix = soundscapeMix(scene, milestone)
    for (const loop of this.loops) {
      const target = mix[loop.layer]
      if (loop.target === target) continue
      loop.target = target
      // 让背景迅速为当前事件让路，恢复和场景切换则慢慢淡入。
      loop.gain.gain.setTargetAtTime(target, this.ctx.currentTime, milestone || scene.focused ? .08 : .65)
    }
  }

  stop(): void {
    for (const { source, gain } of this.loops) {
      try { source.stop() } catch { /* 初始化失败时，音源可能还未开始。 */ }
      source.disconnect(); gain.disconnect()
    }
    this.loops = []
  }

  dispose(): void {
    this.failed = true
    this.cancelPreparation?.(); this.cancelPreparation = null
    this.stop(); this.buffers.clear()
  }

  private start(): void {
    try {
      const at = this.ctx.currentTime + .025
      this.origin ??= at
      const offset = Math.max(0, (at - this.origin) % SCORE_SECONDS)
      for (const layer of SCORE_LAYERS) {
        const source = this.ctx.createBufferSource(), gain = this.ctx.createGain()
        source.buffer = this.buffers.get(layer)!
        source.loop = true; gain.gain.value = 0
        source.connect(gain).connect(this.output)
        this.loops.push({ layer, source, gain, target: 0 })
        source.start(at, offset)
      }
    } catch (error) {
      this.stop()
      throw error
    }
  }
}
