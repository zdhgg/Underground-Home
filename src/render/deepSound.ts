import { gameAudio } from './gameAudio'
export type DeepSound = 'chisel' | 'discovery' | 'smelt' | 'craft' | 'build' | 'lift' | 'chapter'
/** 柔和的石凿、晶铃、炉火、工坊敲击与电梯；沿用总音量/静音/后台管理。 */
export function playDeepSound(kind: DeepSound): void {
  gameAudio.play(`deep-${kind}`, kind === 'chapter' ? 1.2 : .7, ctx => {
    const note = (f: number, end: number, at: number, length: number, gain: number, type: OscillatorType = 'sine') => {
      const oscillator = ctx.createOscillator(), volume = ctx.createGain()
      oscillator.type = type; oscillator.frequency.setValueAtTime(f, at); oscillator.frequency.exponentialRampToValueAtTime(end, at + length)
      volume.gain.setValueAtTime(0, at); volume.gain.linearRampToValueAtTime(gain, at + .012); volume.gain.exponentialRampToValueAtTime(.0001, at + length)
      oscillator.connect(volume).connect(gameAudio.output); oscillator.start(at); oscillator.stop(at + length + .02)
      gameAudio.track(oscillator, () => { oscillator.disconnect(); volume.disconnect() })
    }
    const t = ctx.currentTime
    if (kind === 'chisel') { note(160, 56, t, .18, .04); note(960, 350, t + .05, .13, .018, 'triangle') }
    else if (kind === 'lift') { note(96, 150, t, .6, .025, 'triangle'); note(660, 660, t + .45, .3, .024) }
    else if (kind === 'smelt') { note(130, 220, t, .45, .025, 'triangle'); note(784, 784, t + .4, .25, .025) }
    else if (kind === 'craft') [440, 554, 660].forEach((f, i) => note(f, f * .97, t + i * .12, .18, .03, 'triangle'))
    else if (kind === 'chapter') [392, 493.88, 587.33, 783.99, 987.77].forEach((f, i) => note(f, f, t + i * .15, .45, .03))
    else [523.25, 783.99, 1046.5].forEach((f, i) => note(f, f, t + i * .14, .35, .025))
  }, kind === 'chapter' || kind === 'discovery' ? 'milestone' : 'action')
}
