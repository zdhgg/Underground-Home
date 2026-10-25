import { gameAudio } from './gameAudio'
export type GardenSound = 'chisel' | 'discovery' | 'build' | 'weave' | 'sprout' | 'harvest' | 'chapter'
export function playGardenSound(kind: GardenSound): void {
  gameAudio.play(`garden-${kind}`, kind === 'chapter' ? 1.6 : .8, ctx => {
    const notes = kind === 'chisel' ? [150, 380] : kind === 'weave' ? [330, 392, 440, 523] : kind === 'sprout' ? [523, 659] : kind === 'chapter' ? [294, 370, 440, 587, 740, 880] : kind === 'harvest' ? [392, 523, 659] : [440, 587, 740]
    notes.forEach((f, i) => {
      const osc = ctx.createOscillator(), gain = ctx.createGain(), at = ctx.currentTime + i * .12, length = kind === 'chapter' ? .6 : .28
      osc.type = kind === 'chisel' || kind === 'build' ? 'triangle' : 'sine'; osc.frequency.setValueAtTime(f, at); osc.frequency.exponentialRampToValueAtTime(kind === 'chisel' ? f * .65 : f, at + length)
      gain.gain.setValueAtTime(.0001, at); gain.gain.linearRampToValueAtTime(.022, at + .02); gain.gain.exponentialRampToValueAtTime(.0001, at + length)
      osc.connect(gain).connect(gameAudio.output); osc.start(at); osc.stop(at + length + .02); gameAudio.track(osc, () => { osc.disconnect(); gain.disconnect() })
    })
  }, kind === 'chapter' || kind === 'discovery' ? 'milestone' : 'action')
}
