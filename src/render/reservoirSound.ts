import { gameAudio } from './gameAudio'
export type ReservoirSound='chisel'|'build'|'discovery'|'valve'|'fill'|'pump'|'chapter'
export function playReservoirSound(kind:ReservoirSound):void {
  gameAudio.play(`reservoir-${kind}`,kind==='chapter'?1.6:.8,ctx=>{
    const notes=kind==='chisel'?[130,330]:kind==='valve'?[196,247]:kind==='fill'?[330,392,494]:kind==='pump'?[220,330,440,587]:kind==='chapter'?[294,392,494,587,784,988]:[392,523,659]
    notes.forEach((f,i)=>{const osc=ctx.createOscillator(),gain=ctx.createGain(),at=ctx.currentTime+i*.13,length=kind==='chapter'?.6:.3;osc.type=kind==='valve'||kind==='chisel'?'triangle':'sine';osc.frequency.setValueAtTime(f,at);osc.frequency.exponentialRampToValueAtTime(kind==='chisel'?f*.6:f,at+length);gain.gain.setValueAtTime(.0001,at);gain.gain.linearRampToValueAtTime(.023,at+.02);gain.gain.exponentialRampToValueAtTime(.0001,at+length);osc.connect(gain).connect(gameAudio.output);osc.start(at);osc.stop(at+length+.03);gameAudio.track(osc,()=>{osc.disconnect();gain.disconnect()})})
  },kind==='chapter'||kind==='discovery'?'milestone':'action')
}
