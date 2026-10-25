import { gameAudio } from './gameAudio'
export type HallSound = 'creak' | 'brace' | 'build' | 'light' | 'memory' | 'feast'
/** 低音量木梁、木槌、暖光与六音庆典；沿用静音和后台停止机制。 */
export function playHallSound(kind: HallSound): void {
  gameAudio.play(`hall-${kind}`, kind === 'feast' ? 1.6 : .7, ctx => {
    const t = ctx.currentTime
    const notes = kind === 'creak' ? [170, 150] : kind === 'brace' ? [196, 262] : kind === 'feast' ? [262, 330, 392, 523, 659, 784] : kind === 'memory' ? [392, 523, 659] : [330, 440, 554]
    notes.forEach((f, i) => {
      const osc = ctx.createOscillator(), gain = ctx.createGain(), at = t + i * .14, length = kind === 'feast' ? .65 : .3
      osc.type = kind === 'creak' || kind === 'brace' ? 'triangle' : 'sine'; osc.frequency.setValueAtTime(f, at); osc.frequency.exponentialRampToValueAtTime(kind === 'creak' ? f * .8 : f, at + length)
      gain.gain.setValueAtTime(.0001, at); gain.gain.linearRampToValueAtTime(.024, at + .02); gain.gain.exponentialRampToValueAtTime(.0001, at + length)
      osc.connect(gain).connect(gameAudio.output); osc.start(at); osc.stop(at + length + .03)
      gameAudio.track(osc, () => { osc.disconnect(); gain.disconnect() })
    })
  }, kind === 'feast' || kind === 'memory' ? 'milestone' : 'action')
}
