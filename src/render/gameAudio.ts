import { BackgroundSound, type SoundscapeScene } from './backgroundSound'

export const SOUND_SETTINGS_KEY = 'underground-home.sound.v1'
type Priority = 'action' | 'milestone'

/** 全部声音共用一个输出；只有开始/继续/声音按钮的手势才能解锁，不补播旧事件。 */
export class GameAudio {
  private context: AudioContext | null = null
  private master: GainNode | null = null
  private hidden = false
  private unlocked = false
  private muted = false
  private foregroundUntil = 0
  private last = new Map<string, number>()
  private voices = new Set<() => void>()
  private playing = false
  private scene: SoundscapeScene = { powered: false, water: false, focused: false }
  private background: BackgroundSound | null = null
  private backgroundFailed = false

  loadMuted(): boolean {
    try {
      const settings = JSON.parse(localStorage.getItem(SOUND_SETTINGS_KEY) ?? 'null')
      this.muted = settings?.version === 1 && settings.muted === true
    } catch { this.muted = false }
    this.updateVolume()
    this.syncBackground()
    return this.muted
  }

  setMuted(muted: boolean): void {
    this.muted = muted
    if (muted) this.stopEffects()
    this.updateVolume()
    this.syncBackground()
    try { localStorage.setItem(SOUND_SETTINGS_KEY, JSON.stringify({ version: 1, muted })) } catch { /* 设置不可存时，本次仍有效。 */ }
  }

  unlock(): void {
    if (this.muted || this.hidden) return
    try {
      if (!this.context) {
        this.context = new AudioContext()
        this.master = this.context.createGain()
        this.master.connect(this.context.destination)
        this.updateVolume()
      }
      this.unlocked = true
      void this.context.resume().then(() => this.syncBackground()).catch(() => {})
    } catch { /* 音频不可用时，保留全部视觉反馈。 */ }
  }

  get ready(): AudioContext | null {
    return this.unlocked && !this.muted && !this.hidden && this.context?.state === 'running' ? this.context : null
  }
  get output(): GainNode { return this.master! }

  setHidden(hidden: boolean): void {
    this.hidden = hidden
    if (hidden) this.stopEffects()
    this.updateVolume()
    this.syncBackground()
  }

  setPlaying(playing: boolean): void {
    this.playing = playing
    this.syncBackground()
  }

  /** 渲染层只传入可见现场；声音模块不修改任务、地图或镜头。 */
  updateScene(scene: SoundscapeScene): void {
    this.scene = scene
    this.syncBackground()
  }

  play(id: string, duration: number, run: (ctx: AudioContext) => void, priority: Priority = 'action'): void {
    const ctx = this.ready
    if (!ctx) return
    const now = ctx.currentTime
    if (now - (this.last.get(id) ?? -Infinity) < .085) return
    if (priority === 'action' && (now < this.foregroundUntil || this.voices.size >= 16)) return
    if (priority === 'milestone') { this.stopEffects(); this.foregroundUntil = now + duration }
    this.syncBackground()
    this.last.set(id, now)
    try { run(ctx) } catch { /* 声音失败不能中断游戏事件。 */ }
  }

  track(source: AudioScheduledSourceNode, cleanup: () => void): void {
    if (this.voices.size >= 16) this.voices.values().next().value?.()
    const stop = () => { try { source.stop() } catch { /* 已结束。 */ } finish() }
    const finish = () => { this.voices.delete(stop); source.onended = null; cleanup() }
    source.onended = finish
    this.voices.add(stop)
  }

  stopEffects(): void {
    for (const stop of [...this.voices]) stop()
    this.foregroundUntil = 0
    this.last.clear()
  }

  dispose(): void {
    this.playing = false
    this.background?.dispose(); this.background = null; this.backgroundFailed = false
    this.scene = { powered: false, water: false, focused: false }
    this.stopEffects()
    if (this.context) void this.context.close().catch(() => {})
    this.context = null; this.master = null; this.unlocked = false; this.hidden = false
  }

  private updateVolume(): void {
    if (this.master && this.context) this.master.gain.setValueAtTime(this.muted || this.hidden ? 0 : .7, this.context.currentTime)
  }

  private syncBackground(): void {
    const ctx = this.ready
    if (!this.playing || !ctx) { this.background?.stop(); return }
    if (this.backgroundFailed) return
    try {
      this.background ??= new BackgroundSound(ctx, this.output)
      this.background.update(this.scene, ctx.currentTime < this.foregroundUntil)
    } catch {
      this.backgroundFailed = true
      this.background?.stop()
    }
  }
}

export const gameAudio = new GameAudio()
