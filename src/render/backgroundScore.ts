/** 原创家园小曲：60 BPM、12 小节，留白和尾音也是循环的一部分。 */
export const SCORE_SECONDS = 48
export const SCORE_SAMPLE_RATE = 22050
export const SCORE_LAYERS = ['quiet', 'home', 'cave', 'water'] as const
export type ScoreLayer = typeof SCORE_LAYERS[number]

const frequency = (midi: number) => 440 * 2 ** ((midi - 69) / 12)
const melody = [
  [64, 67, 69], [67, 62], [64, 69, 72], [69, 67],
  [64, 67, 74], [71, 67], [69, 65, 64], [62, 60],
  [64, 69, 72], [69, 67], [62, 67, 71], [64, 60],
]
const chords = [[48, 55, 64], [43, 55, 62], [45, 57, 64], [41, 53, 60]]

/** 确定性 PCM 合成，不创建音频设备；环形写入让混响尾音跨循环边界自然延续。 */
export function synthesizeScore(layer: ScoreLayer, sampleRate = SCORE_SAMPLE_RATE): Float32Array {
  const samples = new Float32Array(Math.round(SCORE_SECONDS * sampleRate))
  const addNote = (at: number, midi: number, seconds: number, gain: number, soft = false) => {
    const start = Math.round(at * sampleRate), frames = Math.round(seconds * sampleRate), hz = frequency(midi)
    for (let i = 0; i < frames; i++) {
      const t = i / sampleRate, phase = 2 * Math.PI * hz * t
      const attack = Math.min(1, t / (soft ? .13 : .012))
      const release = Math.min(1, (seconds - t) / .25)
      const envelope = attack * release * Math.exp(-t * (soft ? 1.1 : 3.6))
      const wave = Math.sin(phase) + (soft ? .09 : .22) * Math.sin(phase * 2) * Math.exp(-t * 5)
      const value = wave * envelope * gain
      samples[(start + i) % samples.length]! += value
      samples[(start + i + Math.round(.19 * sampleRate)) % samples.length]! += value * .14
      samples[(start + i + Math.round(.37 * sampleRate)) % samples.length]! += value * .07
    }
  }
  if (layer === 'home' || layer === 'quiet') {
    for (const [bar, notes] of melody.entries()) {
      const chord = chords[bar % chords.length]!
      if (layer === 'home') {
        chord.forEach((note, i) => addNote(bar * 4 + .12 + i * .36, note, 2.8, .042, true))
        notes.forEach((note, i) => addNote(bar * 4 + .5 + i * .85, note, 1.8, .11))
      } else if (bar % 2 === 0) {
        addNote(bar * 4 + .5, notes[0]!, 2.6, .075, true)
        addNote(bar * 4 + 2.2, notes.at(-1)! - 12, 2.4, .045, true)
      }
    }
  } else {
    // 固定种子的柔和气流/流水，音量在循环两端平滑收拢。
    let seed = 173, low = 0, slower = 0
    for (let i = 0; i < samples.length; i++) {
      seed = (Math.imul(seed, 1664525) + 1013904223) | 0
      const white = seed / 2147483648
      low += .09 * (white - low)
      slower += .012 * (white - slower)
      const t = i / sampleRate
      const edge = Math.min(1, t / 1.5, (SCORE_SECONDS - t) / 1.5)
      const breath = .82 + .18 * Math.sin(2 * Math.PI * t / 12)
      samples[i] = (layer === 'cave' ? slower * .16 : (low - slower) * .18) * edge * breath
    }
    if (layer === 'water') {
      for (const [i, midi] of [79, 76, 81, 74, 79, 76, 83, 74].entries()) addNote(2 + i * 5.8, midi, .65, .045)
    }
  }
  return samples
}
