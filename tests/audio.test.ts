// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { GameAudio, gameAudio, SOUND_SETTINGS_KEY } from '../src/render/gameAudio'
import { playBuildComplete, playCoreStarted, playSoilDig } from '../src/render/waterSound'
import { OpeningSound } from '../src/render/openingSound'
import { BackgroundSound, soundscapeMix } from '../src/render/backgroundSound'
import type { ScoreSamples } from '../src/render/scoreLoader'
import { SCORE_LAYERS, SCORE_SECONDS, synthesizeScore } from '../src/render/backgroundScore'
import { openingFrame } from '../src/render/openingTimeline'

vi.mock('../src/render/scoreLoader', () => ({
  prepareScore: (ready: (samples: Record<string, Float32Array>) => void) => {
    ready(Object.fromEntries(['quiet', 'home', 'cave', 'water'].map(layer => [layer, new Float32Array(100)])))
    return vi.fn()
  },
}))

const param = () => ({ value: 0, setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn(), setTargetAtTime: vi.fn() })
class AudioNodeFake {
  gain = param(); frequency = param(); Q = param()
  onended: (() => void) | null = null
  connect = vi.fn(() => this)
  disconnect = vi.fn(); start = vi.fn(); stop = vi.fn()
}
class AudioContextFake {
  static instances: AudioContextFake[] = []
  state = 'running'; currentTime = 0; sampleRate = 100
  destination = new AudioNodeFake()
  sources: AudioNodeFake[] = []
  gains: AudioNodeFake[] = []
  buffers: Float32Array[] = []
  constructor() { AudioContextFake.instances.push(this) }
  resume = vi.fn(async () => {})
  close = vi.fn(async () => {})
  createGain() { const node = new AudioNodeFake(); this.gains.push(node); return node }
  createOscillator() { const node = new AudioNodeFake(); this.sources.push(node); return node }
  createBufferSource() { return this.createOscillator() }
  createBiquadFilter() { return new AudioNodeFake() }
  createBuffer(_channels: number, frames: number) { const data = new Float32Array(frames); this.buffers.push(data); return { getChannelData: () => data } }
}
let audio: GameAudio
beforeEach(() => {
  localStorage.clear(); AudioContextFake.instances = []
  vi.stubGlobal('AudioContext', AudioContextFake)
  audio = new GameAudio(); gameAudio.setMuted(false); gameAudio.setHidden(false)
})
afterEach(() => { audio.dispose(); gameAudio.dispose(); localStorage.clear(); vi.unstubAllGlobals() })

describe('统一声音输出与生命周期', () => {
  it('只有手势解锁才创建上下文；加载/未解锁时不排队播放', () => {
    const cue = vi.fn()
    audio.play('dig', .2, cue)
    expect(AudioContextFake.instances).toHaveLength(0)
    audio.unlock(); audio.unlock()
    expect(AudioContextFake.instances).toHaveLength(1)
    expect(cue).not.toHaveBeenCalled()
    audio.play('dig', .2, cue)
    expect(cue).toHaveBeenCalledTimes(1)
  })

  it('静音立即停止包括尚未开始的音符，保存版本设置；重新打开不补播', () => {
    audio.unlock()
    const source = new AudioNodeFake(), cleanup = vi.fn(), cue = vi.fn()
    audio.track(source as unknown as OscillatorNode, cleanup)
    audio.setMuted(true)
    expect(source.stop).toHaveBeenCalledWith()
    expect(cleanup).toHaveBeenCalledTimes(1)
    expect(JSON.parse(localStorage.getItem(SOUND_SETTINGS_KEY)!)).toEqual({ version: 1, muted: true })
    audio.play('built', .6, cue)
    audio.setMuted(false)
    expect(cue).not.toHaveBeenCalled()
    expect(audio.ready).not.toBeNull()
  })

  it('刷新保留静音；坏设置/未知版本安全回退；无设备和存储不可用不影响操作', () => {
    audio.setMuted(true)
    const restored = new GameAudio()
    expect(restored.loadMuted()).toBe(true)
    restored.unlock(); expect(AudioContextFake.instances).toHaveLength(0)
    localStorage.setItem(SOUND_SETTINGS_KEY, '{bad')
    expect(restored.loadMuted()).toBe(false)
    localStorage.setItem(SOUND_SETTINGS_KEY, '{"version":2,"muted":true}')
    expect(restored.loadMuted()).toBe(false)
    vi.stubGlobal('AudioContext', class { constructor() { throw new Error('unavailable') } })
    expect(() => restored.unlock()).not.toThrow()
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('denied') })
    expect(() => restored.setMuted(true)).not.toThrow()
    vi.restoreAllMocks(); restored.dispose()
  })

  it('切后台停止音效且总输出静音；回来与浏览器暂停恢复后都不补播', () => {
    audio.unlock()
    const ctx = AudioContextFake.instances[0]!, cue = vi.fn(), source = new AudioNodeFake()
    audio.track(source as unknown as OscillatorNode, vi.fn())
    audio.setHidden(true)
    expect(source.stop).toHaveBeenCalled()
    expect(ctx.gains[0]!.gain.setValueAtTime).toHaveBeenLastCalledWith(0, 0)
    audio.play('dig', .2, cue); audio.setHidden(false)
    ctx.state = 'suspended'; audio.play('built', .6, cue); ctx.state = 'running'
    expect(cue).not.toHaveBeenCalled()
  })

  it('庆祝接管普通音效；短时间重复触发被抑制，同时存活音源有上限', () => {
    audio.unlock()
    const ctx = AudioContextFake.instances[0]!, cue = vi.fn(), source = new AudioNodeFake()
    audio.track(source as unknown as OscillatorNode, vi.fn())
    audio.play('built', .6, cue, 'milestone')
    expect(source.stop).toHaveBeenCalled()
    audio.play('built', .6, cue, 'milestone'); audio.play('dig', .2, cue)
    expect(cue).toHaveBeenCalledTimes(1)
    ctx.currentTime = 1; audio.play('dig', .2, cue)
    expect(cue).toHaveBeenCalledTimes(2)
    const sources = Array.from({ length: 17 }, () => new AudioNodeFake())
    sources.forEach(s => audio.track(s as unknown as OscillatorNode, vi.fn()))
    expect(sources[0]!.stop).toHaveBeenCalledTimes(1)
    audio.stopEffects()
    expect(sources.every(s => s.stop.mock.calls.length === 1)).toBe(true)
  })

  it('开场和游戏复用同一个输出；跳过开场停止尾音，之后仍能挖掘和庆祝', () => {
    gameAudio.unlock()
    const opening = new OpeningSound()
    opening.enable(); opening.update(openingFrame(2, 600))
    const ctx = AudioContextFake.instances[0]!, before = [...ctx.sources]
    opening.stop()
    expect(before.every(s => s.stop.mock.calls.some(args => args.length === 0))).toBe(true)
    expect(ctx.close).not.toHaveBeenCalled()
    playSoilDig(); playBuildComplete()
    expect(ctx.sources.length).toBeGreaterThan(before.length)
    expect(AudioContextFake.instances).toHaveLength(1)
    ctx.currentTime = 2
    expect(() => playCoreStarted()).not.toThrow()
  })
})


describe('家园背景音乐与环境声', () => {
  const home = { powered: true, water: false, focused: false }
  it('标题/开场不创建背景声；进入游戏后固定四轨，重复更新和切层不重建音源', () => {
    audio.unlock(); audio.updateScene(home)
    const ctx = AudioContextFake.instances[0]!
    expect(ctx.sources).toHaveLength(0)
    audio.setPlaying(true)
    expect(ctx.sources).toHaveLength(4)
    expect(ctx.buffers).toHaveLength(4)
    for (let i = 0; i < 100; i++) audio.updateScene({ ...home, water: i % 2 === 0 })
    expect(ctx.sources).toHaveLength(4)
    expect(ctx.buffers).toHaveLength(4)
    audio.setPlaying(false)
    expect(ctx.sources.every(s => s.stop.mock.calls.length === 1)).toBe(true)
  })

  it('通电前后交接同一主题，水声只在明确的泉水场景响；对话与庆祝让出音量', () => {
    const quiet = soundscapeMix({ powered: false, water: false, focused: false }, false)
    const normal = soundscapeMix(home, false)
    expect(quiet.quiet).toBeGreaterThan(0); expect(quiet.home).toBe(0)
    expect(normal.quiet).toBe(0); expect(normal.home).toBeGreaterThan(0)
    expect(normal.water).toBe(0)
    expect(soundscapeMix({ ...home, water: true }, false).water).toBeGreaterThan(0)
    expect(soundscapeMix({ ...home, focused: true }, false).home).toBeLessThan(normal.home / 2)
    expect(soundscapeMix(home, true).home).toBeLessThan(normal.home / 2)
    audio.unlock(); audio.updateScene(home); audio.setPlaying(true)
    const ctx = AudioContextFake.instances[0]!, gain = ctx.gains[2]!.gain
    audio.play('built', .6, () => {}, 'milestone')
    expect(gain.setTargetAtTime).toHaveBeenLastCalledWith(normal.home * .18, 0, .08)
    ctx.currentTime = 1; audio.updateScene(home)
    expect(gain.setTargetAtTime).toHaveBeenLastCalledWith(normal.home, 1, .65)
  })

  it('静音/后台停止所有循环；恢复复用缓存并接续乐句，不堆积或从头重播', () => {
    audio.unlock(); audio.updateScene(home); audio.setPlaying(true)
    const ctx = AudioContextFake.instances[0]!, initial = [...ctx.sources]
    audio.setMuted(true)
    expect(initial.every(s => s.stop.mock.calls.length === 1)).toBe(true)
    ctx.currentTime = 10; audio.setMuted(false)
    expect(ctx.buffers).toHaveLength(4)
    expect(ctx.sources).toHaveLength(8)
    expect(ctx.sources[4]!.start).toHaveBeenCalledWith(10.025, 10)
    audio.setHidden(true); audio.setHidden(false)
    expect(ctx.sources).toHaveLength(12)
    expect(ctx.buffers).toHaveLength(4)
    expect(ctx.sources.slice(0, 8).every(s => s.stop.mock.calls.length === 1)).toBe(true)
    audio.dispose()
    expect(ctx.sources.every(s => s.stop.mock.calls.length === 1)).toBe(true)
  })

  it('循环合成失败只停背景声，音效和操作仍能继续；不每帧重复分配', () => {
    audio.unlock()
    const ctx = AudioContextFake.instances[0]!, allocate = vi.spyOn(ctx, 'createBuffer').mockImplementation(() => { throw new Error('no memory') })
    audio.setPlaying(true); audio.updateScene(home); audio.updateScene(home)
    expect(allocate).toHaveBeenCalledTimes(1)
    const effect = vi.fn(); audio.play('dig', .2, effect)
    expect(effect).toHaveBeenCalledTimes(1)
  })

  it('后台准备期间不启动循环，完成后使用最新场景；销毁后忽略旧线程回调', () => {
    const ctx = new AudioContextFake(), cancel = vi.fn()
    let ready = (_samples: ScoreSamples) => {}
    const score = new BackgroundSound(ctx as unknown as AudioContext, ctx.destination as unknown as AudioNode, done => { ready = done; return cancel })
    score.update(home, false)
    expect(ctx.sources).toHaveLength(0)
    ready(Object.fromEntries(SCORE_LAYERS.map(layer => [layer, new Float32Array(100)])) as ScoreSamples)
    score.update({ ...home, water: true }, false)
    expect(ctx.sources).toHaveLength(4)
    expect(ctx.gains[3]!.gain.setTargetAtTime).toHaveBeenLastCalledWith(.16, 0, .65)
    score.dispose()
    const allocated = ctx.buffers.length
    ready(Object.fromEntries(SCORE_LAYERS.map(layer => [layer, new Float32Array(100)])) as ScoreSamples)
    expect(ctx.buffers).toHaveLength(allocated)
    expect(cancel).toHaveBeenCalledTimes(1)
  })

  it.each(SCORE_LAYERS)('%s 为非空有限波形，首尾无跳变，预留混音余量', layer => {
    const samples = synthesizeScore(layer, 2000)
    let peak = 0, energy = 0, finite = true
    for (const sample of samples) {
      finite &&= Number.isFinite(sample)
      peak = Math.max(peak, Math.abs(sample)); energy += sample * sample
    }
    expect(finite).toBe(true)
    expect(samples).toHaveLength(SCORE_SECONDS * 2000)
    expect(peak).toBeGreaterThan(.001); expect(peak).toBeLessThan(.4)
    expect(Math.sqrt(energy / samples.length)).toBeGreaterThan(.0001)
    expect(Math.abs(samples[0]! - samples.at(-1)!)).toBeLessThan(.001)
  })
})
