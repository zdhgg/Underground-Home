import type { OpeningFrame } from './openingTimeline'
import { OPENING_BEATS } from './openingTimeline'

/** 随画面逐帧发声，跳过立即关闭。浏览器要求手势时由声音按钮启用。 */
export class OpeningSound {
  private audio: AudioContext | null = null
  private wind: AudioBufferSourceNode | null = null
  private volume: GainNode | null = null
  private beat = -1
  private chimed = false
  private warmed = false
  enable(): void {
    if (this.audio) { void this.audio.resume().catch(() => {}); return }
    try {
      const ctx = new AudioContext()
      this.audio = ctx
      const buffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate)
      const data = buffer.getChannelData(0)
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
      const wind = ctx.createBufferSource(), filter = ctx.createBiquadFilter(), volume = ctx.createGain()
      wind.buffer = buffer; wind.loop = true
      filter.type = 'lowpass'; filter.frequency.value = 650
      volume.gain.value = 0
      wind.connect(filter).connect(volume).connect(ctx.destination); wind.start()
      this.wind = wind; this.volume = volume
      void ctx.resume().catch(() => {})
    } catch { /* 静默时演出照常完成。 */ }
  }
  update(frame: OpeningFrame): void {
    const ctx = this.audio
    if (!ctx || ctx.state !== 'running') return
    this.volume!.gain.setTargetAtTime(frame.t < OPENING_BEATS.climb ? .06 * (1 - frame.warmth * .85) : .008, ctx.currentTime, .18)
    const beat = Math.floor(frame.t * (frame.phase === 'approach' ? 7 : 4))
    if (frame.pose !== 'idle' && beat !== this.beat) {
      this.beat = beat; this.tone(frame.pose === 'climb' ? 280 : 130, .045, .018)
    }
    if (frame.warmBurst > .55 && !this.warmed) {
      this.warmed = true
      this.tone(392, .65, .022)
      this.tone(523.25, .5, .012)
    }
    if (frame.clue > .2 && !this.chimed) { this.chimed = true; this.tone(880, .35, .025) }
  }
  private tone(frequency: number, duration: number, gain: number): void {
    const ctx = this.audio!, note = ctx.createOscillator(), volume = ctx.createGain()
    note.type = 'sine'; note.frequency.value = frequency
    volume.gain.setValueAtTime(gain, ctx.currentTime)
    volume.gain.exponentialRampToValueAtTime(.0001, ctx.currentTime + duration)
    note.connect(volume).connect(ctx.destination); note.start(); note.stop(ctx.currentTime + duration)
    note.onended = () => { note.disconnect(); volume.disconnect() }
  }
  stop(): void {
    this.wind?.stop(); this.wind = null
    if (this.audio) void this.audio.close().catch(() => {})
    this.audio = null; this.volume = null; this.beat = -1; this.chimed = false; this.warmed = false
  }
}
