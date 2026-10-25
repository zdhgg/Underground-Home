import { gameAudio } from './gameAudio'
export type RuinsSound='chisel'|'build'|'discovery'|'rubbing'|'restore'|'light'|'chapter'
export function playRuinsSound(kind:RuinsSound):void {
  gameAudio.play(`ruins-${kind}`,kind==='chapter'?1.6:.8,ctx=>{
    const notes=kind==='chisel'?[130,330]:kind==='rubbing'?[196,247]:kind==='restore'?[330,392,494]:kind==='light'?[220,330,440,587]:kind==='chapter'?[294,392,494,587,784,988]:[392,523,659]
    notes.forEach((f,i)=>{const osc=ctx.createOscillator(),gain=ctx.createGain(),at=ctx.currentTime+i*.13,length=kind==='chapter'?.6:.3;osc.type=kind==='rubbing'||kind==='chisel'?'triangle':'sine';osc.frequency.setValueAtTime(f,at);osc.frequency.exponentialRampToValueAtTime(kind==='chisel'?f*.6:f,at+length);gain.gain.setValueAtTime(.0001,at);gain.gain.linearRampToValueAtTime(.023,at+.02);gain.gain.exponentialRampToValueAtTime(.0001,at+length);osc.connect(gain).connect(gameAudio.output);osc.start(at);osc.stop(at+length+.03);gameAudio.track(osc,()=>{osc.disconnect();gain.disconnect()})})
  },kind==='chapter'||kind==='discovery'?'milestone':'action')
}
