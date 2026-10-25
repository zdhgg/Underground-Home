import { completedGarden } from './gardenWorld'
import { performDeep } from '../../src/core/deep'
import { buildReservoir, performReservoir, setWaterRoute } from '../../src/core/reservoir'
import { reservoirFrontier } from '../../src/core/reservoirTopology'
import { initializeWorkers } from '../../src/core/partnerWork'
import { dig } from '../../src/core/dig'
import { TILE, type WorldState } from '../../src/core/world'
export function reservoirAvailable(shaft=27):WorldState{
  const w=completedGarden(shaft)
  for(let i=0;i<3;i++)for(const action of ['collect','smelt','craft'] as const){const r=performDeep(w,action);if(!r.ok)throw new Error(r.message)}
  return w
}
export function enterReservoir(w:WorldState):void{
  for(const action of ['inspect','shore'] as const){const r=performReservoir(w,action);if(!r.ok)throw new Error(r.message)}
  let p=reservoirFrontier(w);while(p){w.tiles[p.y][p.x]=TILE.EMPTY;w.dugCount++;p=reservoirFrontier(w)}
  const r=performReservoir(w,'enter');if(!r.ok)throw new Error(r.message)
  w.exploration.explorer={x:w.exploration.shaftX!,y:70}
}
export function expandReservoir(w:WorldState):void{
  for(const direction of [-1,1])for(let x=w.exploration.shaftX!;x>=8&&x<=40;x+=direction)for(const y of [70,69,68,67])if(w.tiles[y][x]===TILE.SOIL){const r=dig(w,x,y);if(!r.ok)throw new Error(`回廊夹具挖掘失败 ${x},${y}: ${r.reason}`)}
}
export function workingReservoir(shaft=27):WorldState{
  const w=reservoirAvailable(shaft);enterReservoir(w);expandReservoir(w)
  for(const action of ['meet','extend'] as const){const r=performReservoir(w,action);if(!r.ok)throw new Error(r.message)}
  initializeWorkers(w)
  for(const [kind,x]of [['intake',10],['basin',18],['gate',24],['wheel',28]] as const){const r=buildReservoir(w,kind,x);if(!r.ok)throw new Error(r.message)}
  const r=performReservoir(w,'connect');if(!r.ok)throw new Error(r.message)
  return w
}
export function completedReservoir(shaft=27):WorldState{
  const w=workingReservoir(shaft)
  performReservoir(w,'fill');setWaterRoute(w,'garden');performReservoir(w,'pump');setWaterRoute(w,'hall');performReservoir(w,'pump')
  const r=performReservoir(w,'tour');if(!r.ok)throw new Error(r.message)
  return w
}
