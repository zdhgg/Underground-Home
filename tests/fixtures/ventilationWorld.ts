import { completedReservoir } from './reservoirWorld'
import { performDeep } from '../../src/core/deep'
import { buildVentilation,performVentilation,setAirMode } from '../../src/core/ventilation'
import { ventilationFrontier } from '../../src/core/ventilationTopology'
import { initializeWorkers } from '../../src/core/partnerWork'
import { dig } from '../../src/core/dig'
import { TILE,type WorldState } from '../../src/core/world'
export function ventilationAvailable(shaft=27):WorldState{const w=completedReservoir(shaft);for(let i=0;i<5;i++)for(const a of ['collect','smelt','craft']as const){const r=performDeep(w,a);if(!r.ok)throw new Error(r.message)}return w}
export function enterVentilation(w:WorldState):void{for(const a of ['inspect','brace']as const){const r=performVentilation(w,a);if(!r.ok)throw new Error(r.message)}let p=ventilationFrontier(w);while(p){w.tiles[p.y][p.x]=TILE.EMPTY;w.dugCount++;p=ventilationFrontier(w)}const r=performVentilation(w,'enter');if(!r.ok)throw new Error(r.message);w.exploration.explorer={x:w.exploration.shaftX!,y:82}}
export function expandVentilation(w:WorldState):void{for(const d of [-1,1])for(let x=w.exploration.shaftX!;x>=8&&x<=40;x+=d)for(const y of [82,81,80,79])if(w.tiles[y][x]===TILE.SOIL){const r=dig(w,x,y);if(!r.ok)throw new Error(`挖掘夹具失败 ${x},${y}: ${r.reason}`)}}
export function workingVentilation(shaft=27):WorldState{const w=ventilationAvailable(shaft);enterVentilation(w);expandVentilation(w);for(const a of ['meet','extend']as const){const r=performVentilation(w,a);if(!r.ok)throw new Error(r.message)}initializeWorkers(w);for(const[k,x]of [['inlet',10],['fan',18],['baffle',24],['bench',28]]as const){const r=buildVentilation(w,k,x);if(!r.ok)throw new Error(r.message)}const r=performVentilation(w,'trace');if(!r.ok)throw new Error(r.message);return w}
export function completedVentilation(shaft=27):WorldState{const w=workingVentilation(shaft);setAirMode(w,'home');performVentilation(w,'test');setAirMode(w,'work');performVentilation(w,'craft');setAirMode(w,'home');performVentilation(w,'gift');const r=buildVentilation(w,'nest',34);if(!r.ok)throw new Error(r.message);const t=performVentilation(w,'tour');if(!t.ok)throw new Error(t.message);return w}
