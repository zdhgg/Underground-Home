import { gameAudio } from './gameAudio'
export type FinaleSound='chisel'|'build'|'discovery'|'light'|'chime'|'feast'|'page'|'chapter'
/** 轻声钟琴和纸页反馈；统一音量与暂停策略由 gameAudio 管理。 */
export function playFinaleSound(kind:FinaleSound):void{
 gameAudio.play(`finale-${kind}`,kind==='chapter'?2:.7,ctx=>{
  const notes=kind==='chisel'?[140,310]:kind==='page'?[260,220]:kind==='chime'?[784,988,1175]:kind==='feast'?[262,330,392,523]:kind==='chapter'?[262,330,392,523,659,784,1046]:kind==='light'?[220,330,440,660]:[392,523,659]
  notes.forEach((f,i)=>{const osc=ctx.createOscillator(),gain=ctx.createGain(),at=ctx.currentTime+i*.14,length=kind==='chapter'?.75:kind==='page'?.12:.35;osc.type=kind==='chisel'?'triangle':'sine';osc.frequency.setValueAtTime(f,at);osc.frequency.exponentialRampToValueAtTime(kind==='chisel'?f*.6:f,at+length);gain.gain.setValueAtTime(.0001,at);gain.gain.linearRampToValueAtTime(.022,at+.015);gain.gain.exponentialRampToValueAtTime(.0001,at+length);osc.connect(gain).connect(gameAudio.output);osc.start(at);osc.stop(at+length+.03);gameAudio.track(osc,()=>{osc.disconnect();gain.disconnect()})})
 },['chapter','discovery','feast'].includes(kind)?'milestone':'action')
}
