/**
 * 家园操作与探索音效：全部用 WebAudio 现场合成，共用 gameAudio 输出。
 * 不依赖网络、不加素材、不申请麦克风。
 * 没有音频设备或浏览器不允许播放时静默降级，文字与画面反馈照常。
 */
import { gameAudio } from './gameAudio'

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
  note.connect(volume).connect(gameAudio.output)
  note.start(at)
  note.stop(at + seconds + 0.02)
  gameAudio.track(note, () => { note.disconnect(); volume.disconnect() })
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
  source.connect(filter).connect(volume).connect(gameAudio.output)
  source.start(at)
  source.stop(at + seconds + 0.02)
  gameAudio.track(source, () => { source.disconnect(); filter.disconnect(); volume.disconnect() })
}

/** 在主动点击线索时播放很轻的滴水声。 */
export function playWaterClue(): void {
  gameAudio.play('WaterClue', 0.6, (ctx) => {
    for (let i = 0; i < 3; i++) blip(ctx, ctx.currentTime + i * 0.18, 'sine', 1400 + i * 130, 420, 0.16, 0.035)
  })
}

/** 挥镐破开一块岩：闷闷的一下 + 碎石；连续施工时能听出一镐一镐的节奏。 */
export function playRockHit(): void {
  gameAudio.play('RockHit', 0.3, (ctx) => {
    const at = ctx.currentTime
    blip(ctx, at, 'sine', 190, 68, 0.22, 0.05)
    noise(ctx, at, 0.16, 0.035, 1400, 0.8)
    blip(ctx, at + 0.07, 'triangle', 900, 320, 0.12, 0.016)
  })
}

/** 岩层打通：低沉的崩塌声，替接下来的水声让出位置。 */
export function playBreakthrough(): void {
  gameAudio.play('Breakthrough', 0.8, (ctx) => {
    const at = ctx.currentTime
    blip(ctx, at, 'sine', 122, 46, 0.5, 0.07)
    noise(ctx, at, 0.42, 0.05, 520, 0.6)
    noise(ctx, at + 0.24, 0.5, 0.04, 2600, 1.4)
  }, 'milestone')
}

/** 第一次顺着梯子下到第二层：两音上行，像"到啦"。 */
export function playLayerArrival(): void {
  gameAudio.play('LayerArrival', 0.5, (ctx) => {
    const at = ctx.currentTime
    blip(ctx, at, 'triangle', 392, 392, 0.26, 0.045)
    blip(ctx, at + 0.14, 'triangle', 587.33, 587.33, 0.34, 0.045)
  }, 'milestone')
}

/** 第一次发现泉水：向上的四音 + 一声水花。 */
export function playSpringFound(): void {
  gameAudio.play('SpringFound', 0.7, (ctx) => {
    const at = ctx.currentTime
    for (const [i, frequency] of [523.25, 659.25, 783.99, 1046.5].entries()) {
      blip(ctx, at + i * 0.11, 'triangle', frequency, frequency, 0.3, 0.05)
    }
    noise(ctx, at + 0.06, 0.32, 0.05, 1800, 0.9)
    blip(ctx, at + 0.3, 'sine', 1400, 500, 0.3, 0.03)
  }, 'milestone')
}

/** 水顺着水管爬上第一层：一路向上的滑音 + 越来越近的水流声。 */
export function playWaterSupplied(): void {
  gameAudio.play('WaterSupplied', 1.2, (ctx) => {
    const at = ctx.currentTime
    blip(ctx, at, 'sine', 220, 880, 0.9, 0.045)
    for (let i = 0; i < 4; i++) {
      noise(ctx, at + 0.12 + i * 0.16, 0.2, 0.03, 900 + i * 500, 1.1)
    }
    blip(ctx, at + 0.78, 'triangle', 784, 1046.5, 0.34, 0.045)
    noise(ctx, at + 0.8, 0.3, 0.04, 2200, 0.8)
  }, 'milestone')
}

/** 收菜：轻快的一下。 */
export function playHarvest(): void {
  gameAudio.play('Harvest', 0.3, (ctx) => {
    const at = ctx.currentTime
    blip(ctx, at, 'triangle', 660, 990, 0.16, 0.04)
    blip(ctx, at + 0.09, 'sine', 1180, 1560, 0.18, 0.03)
  })
}

/** 开饭：三音上行，热闹一点。 */
export function playMealTime(): void {
  gameAudio.play('MealTime', 0.6, (ctx) => {
    const at = ctx.currentTime
    for (const [i, frequency] of [523.25, 698.46, 880].entries()) {
      blip(ctx, at + i * 0.13, 'triangle', frequency, frequency, 0.3, 0.05)
    }
  }, 'milestone')
}


/** 软土落爪：细微音高变化，避免连续挖掘像重复按门铃。 */
export function playSoilDig(): void {
  gameAudio.play('soil', .2, ctx => {
    const at = ctx.currentTime, pitch = 1 + (Math.random() - .5) * .16
    blip(ctx, at, 'sine', 150 * pitch, 65, .13, .045)
    noise(ctx, at, .17, .028, 750 * pitch, .65)
  })
}

export function playBuildComplete(): void {
  gameAudio.play('built', .65, ctx => {
    const at = ctx.currentTime
    noise(ctx, at, .09, .025, 700)
    for (const [i, f] of [392, 493.88, 587.33].entries()) blip(ctx, at + .08 + i * .12, 'triangle', f, f, .3, .035)
  }, 'milestone')
}

export function playPartnerFound(id: 'adeng' | 'xiaoman' | 'xiaoquan'): void {
  gameAudio.play('partner', .6, ctx => {
    const notes = id === 'adeng' ? [659.25, 880] : id === 'xiaoman' ? [392, 523.25] : [523.25, 783.99]
    notes.forEach((f, i) => blip(ctx, ctx.currentTime + i * .17, 'sine', f, f, .32, .04))
  }, 'milestone')
}

export function playCrystalCollected(): void {
  gameAudio.play('crystal', .4, ctx => {
    blip(ctx, ctx.currentTime, 'sine', 784, 1046.5, .3, .035)
  })
}

/** 只在动画确认入槽后播放，不在点击安装时提前庆祝。 */
export function playCoreStarted(): void {
  gameAudio.play('core', .68, ctx => {
    const at = ctx.currentTime
    noise(ctx, at, .08, .035, 800)
    blip(ctx, at + .06, 'sine', 110, 220, .6, .035)
    for (const f of [261.63, 329.63, 392]) blip(ctx, at + .32, 'sine', f, f, .3, .022)
  }, 'milestone')
}

export function playPowerConnected(): void {
  gameAudio.play('power', 1.1, ctx => {
    blip(ctx, ctx.currentTime, 'sine', 196, 784, .75, .035)
    blip(ctx, ctx.currentTime + .72, 'triangle', 523.25, 523.25, .32, .03)
  }, 'milestone')
}

export function playUndo(): void {
  gameAudio.play('undo', .25, ctx => blip(ctx, ctx.currentTime, 'sine', 523.25, 261.63, .22, .035), 'milestone')
}

export function playUnavailable(): void {
  gameAudio.play('unavailable', .15, ctx => blip(ctx, ctx.currentTime, 'sine', 180, 140, .13, .022))
}
