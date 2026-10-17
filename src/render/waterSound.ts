/**
 * 探索过程的轻量提示音：全部用 WebAudio 现场合成，不依赖网络、不加素材、不申请麦克风。
 * 没有音频设备或浏览器不允许播放时静默降级，文字与画面反馈照常。
 */
let audio: AudioContext | null = null

function withAudio(run: (ctx: AudioContext) => void): void {
  try {
    audio ??= new AudioContext()
    void audio.resume().catch(() => {})
    run(audio)
  } catch {
    /* 无音频设备时仍保留文字和画面线索。 */
  }
}

/** 一段短音：起止频率 + 时长，用来做滴水、闷响和提示音。 */
function blip(ctx: AudioContext, at: number, type: OscillatorType, from: number, to: number, seconds: number, gain: number): void {
  const note = ctx.createOscillator()
  const volume = ctx.createGain()
  note.type = type
  note.frequency.setValueAtTime(from, at)
  note.frequency.exponentialRampToValueAtTime(Math.max(30, to), at + seconds * 0.8)
  volume.gain.setValueAtTime(0, at)
  volume.gain.linearRampToValueAtTime(gain, at + 0.01)
  volume.gain.exponentialRampToValueAtTime(0.0001, at + seconds)
  note.connect(volume).connect(ctx.destination)
  note.start(at)
  note.stop(at + seconds + 0.02)
  note.onended = () => { note.disconnect(); volume.disconnect() }
}

/** 一段带通白噪声：碎石声与水花声（现场生成，不需要音频文件）。 */
function noise(ctx: AudioContext, at: number, seconds: number, gain: number, frequency: number, q = 1): void {
  const frames = Math.max(1, Math.floor(ctx.sampleRate * seconds))
  const buffer = ctx.createBuffer(1, frames, ctx.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < frames; i++) data[i] = Math.random() * 2 - 1
  const source = ctx.createBufferSource()
  source.buffer = buffer
  const filter = ctx.createBiquadFilter()
  filter.type = 'bandpass'
  filter.frequency.value = frequency
  filter.Q.value = q
  const volume = ctx.createGain()
  volume.gain.setValueAtTime(0, at)
  volume.gain.linearRampToValueAtTime(gain, at + 0.012)
  volume.gain.exponentialRampToValueAtTime(0.0001, at + seconds)
  source.connect(filter).connect(volume).connect(ctx.destination)
  source.start(at)
  source.stop(at + seconds + 0.02)
  source.onended = () => { source.disconnect(); filter.disconnect(); volume.disconnect() }
}

/** 在主动点击线索时播放很轻的滴水声。 */
export function playWaterClue(): void {
  withAudio((ctx) => {
    for (let i = 0; i < 3; i++) blip(ctx, ctx.currentTime + i * 0.18, 'sine', 1400 + i * 130, 420, 0.16, 0.035)
  })
}

/** 挥镐破开一块岩：闷闷的一下 + 碎石；连续施工时能听出一镐一镐的节奏。 */
export function playRockHit(): void {
  withAudio((ctx) => {
    const at = ctx.currentTime
    blip(ctx, at, 'sine', 190, 68, 0.22, 0.05)
    noise(ctx, at, 0.16, 0.035, 1400, 0.8)
    blip(ctx, at + 0.07, 'triangle', 900, 320, 0.12, 0.016)
  })
}

/** 岩层打通：低沉的崩塌声，替接下来的水声让出位置。 */
export function playBreakthrough(): void {
  withAudio((ctx) => {
    const at = ctx.currentTime
    blip(ctx, at, 'sine', 122, 46, 0.5, 0.07)
    noise(ctx, at, 0.42, 0.05, 520, 0.6)
    noise(ctx, at + 0.24, 0.5, 0.04, 2600, 1.4)
  })
}

/** 第一次顺着梯子下到第二层：两音上行，像"到啦"。 */
export function playLayerArrival(): void {
  withAudio((ctx) => {
    const at = ctx.currentTime
    blip(ctx, at, 'triangle', 392, 392, 0.26, 0.045)
    blip(ctx, at + 0.14, 'triangle', 587.33, 587.33, 0.34, 0.045)
  })
}

/** 第一次发现泉水：向上的四音 + 一声水花。 */
export function playSpringFound(): void {
  withAudio((ctx) => {
    const at = ctx.currentTime
    for (const [i, frequency] of [523.25, 659.25, 783.99, 1046.5].entries()) {
      blip(ctx, at + i * 0.11, 'triangle', frequency, frequency, 0.3, 0.05)
    }
    noise(ctx, at + 0.06, 0.32, 0.05, 1800, 0.9)
    blip(ctx, at + 0.3, 'sine', 1400, 500, 0.3, 0.03)
  })
}
