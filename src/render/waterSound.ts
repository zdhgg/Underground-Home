/** 在主动点击线索时播放很轻的滴水声；不依赖网络，不申请麦克风权限。 */
let audio: AudioContext | null = null
export function playWaterClue(): void {
  try {
    audio ??= new AudioContext()
    void audio.resume().catch(() => {})
    for (let i = 0; i < 3; i++) {
      const at = audio.currentTime + i * 0.18
      const note = audio.createOscillator(), gain = audio.createGain()
      note.type = 'sine'
      note.frequency.setValueAtTime(1400 + i * 130, at)
      note.frequency.exponentialRampToValueAtTime(420, at + 0.12)
      gain.gain.setValueAtTime(0, at)
      gain.gain.linearRampToValueAtTime(0.035, at + 0.008)
      gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.16)
      note.connect(gain); gain.connect(audio.destination)
      note.start(at); note.stop(at + 0.17)
      note.onended = () => { note.disconnect(); gain.disconnect() }
    }
  } catch { /* 无音频设备时仍保留文字和水汽线索。 */ }
}
