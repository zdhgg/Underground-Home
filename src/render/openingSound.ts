import { gameAudio } from './gameAudio'
import type { OpeningFrame } from './openingTimeline'
import { OPENING_BEATS } from './openingTimeline'

/** 随画面逐帧发声，跳过立即关闭。浏览器要求手势时由声音按钮启用。 */
export class OpeningSound {
  private audio: AudioContext | null = null
  private wind: AudioBufferSourceNode | null = null
  private volume: GainNode | null = null
  private filter: BiquadFilterNode | null = null
  private enabled = false
  private beat = -1
  private chimed = false
  private warmed = false
  private welcomed = false
  enable(): void {
    this.enabled = true
    if (this.audio) { void this.audio.resume().catch(() => {}); return }
    try {
      gameAudio.unlock()
      const ctx = gameAudio.ready
      if (!ctx) return
      this.audio = ctx
      const buffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate)
      const data = buffer.getChannelData(0)
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
      const wind = ctx.createBufferSource(), filter = ctx.createBiquadFilter(), volume = ctx.createGain()
      wind.buffer = buffer; wind.loop = true
      filter.type = 'lowpass'; filter.frequency.value = 650
      volume.gain.value = 0
      wind.connect(filter).connect(volume).connect(gameAudio.output); wind.start()
      this.wind = wind; this.volume = volume; this.filter = filter
      void ctx.resume().catch(() => {})
    } catch { /* 静默时演出照常完成。 */ }
  }
  update(frame: OpeningFrame): void {
    if (this.enabled && !this.audio && gameAudio.ready) this.enable()
    const ctx = this.audio
    if (!ctx || gameAudio.ready !== ctx) {
      this.warmed ||= frame.warmBurst > .55
      this.chimed ||= frame.clue > .2
      this.welcomed ||= frame.homeReveal > .2
      return
    }
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
    if (frame.homeReveal > .2 && !this.welcomed) {
      this.welcomed = true
      this.tone(523.25, .65, .018)
      this.tone(659.25, .55, .012)
    }
  }
  private tone(frequency: number, duration: number, gain: number): void {
    const ctx = this.audio!, note = ctx.createOscillator(), volume = ctx.createGain()
    note.type = 'sine'; note.frequency.value = frequency
    volume.gain.setValueAtTime(gain, ctx.currentTime)
    volume.gain.exponentialRampToValueAtTime(.0001, ctx.currentTime + duration)
    note.connect(volume).connect(gameAudio.output); note.start(); note.stop(ctx.currentTime + duration)
    gameAudio.track(note, () => { note.disconnect(); volume.disconnect() })
  }
  stop(): void {
    this.enabled = false
    this.wind?.stop(); this.wind?.disconnect(); this.wind = null
    this.filter?.disconnect(); this.filter = null
    this.volume?.disconnect()
    gameAudio.stopEffects()
    this.audio = null; this.volume = null; this.beat = -1; this.chimed = false; this.warmed = false; this.welcomed = false
  }
}
