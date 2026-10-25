import { completedVentilation } from './ventilationWorld'
import { performDeep } from '../../src/core/deep'
import { buildRuins,performRuins } from '../../src/core/ruins'
import { ruinsFrontier } from '../../src/core/ruinsTopology'
import { initializeWorkers } from '../../src/core/partnerWork'
import { dig } from '../../src/core/dig'
import { TILE,type WorldState } from '../../src/core/world'
export function ruinsAvailable(shaft=27):WorldState{const w=completedVentilation(shaft);for(let i=0;i<5;i++)for(const a of ['collect','smelt','craft']as const){const r=performDeep(w,a);if(!r.ok)throw new Error(r.message)}return w}
export function enterRuins(w:WorldState):void{for(const a of ['inspect','brace']as const){const r=performRuins(w,a);if(!r.ok)throw new Error(r.message)}let p=ruinsFrontier(w);while(p){w.tiles[p.y][p.x]=TILE.EMPTY;w.dugCount++;p=ruinsFrontier(w)}const r=performRuins(w,'enter');if(!r.ok)throw new Error(r.message);w.exploration.explorer={x:w.exploration.shaftX!,y:94}}
export function expandRuins(w:WorldState):void{for(const d of [-1,1])for(let x=w.exploration.shaftX!;x>=8&&x<=40;x+=d)for(const y of [94,93,92,91])if(w.tiles[y][x]===TILE.SOIL){const r=dig(w,x,y);if(!r.ok)throw new Error(`挖掘夹具失败 ${x},${y}: ${r.reason}`)}}
export function workingRuins(shaft=27):WorldState{const w=ruinsAvailable(shaft);enterRuins(w);expandRuins(w);const r=performRuins(w,'extend');if(!r.ok)throw new Error(r.message);initializeWorkers(w);for(const[k,x]of [['desk',10],['light',15],['mosaic',28]]as const){const r=buildRuins(w,k,x);if(!r.ok)throw new Error(r.message)}return w}
export function completedRuins(shaft=27):WorldState{const w=workingRuins(shaft);for(const m of ['lamp','spring','tools']as const)for(const a of ['reveal','rub','mount']as const){const r=performRuins(w,a,m);if(!r.ok)throw new Error(r.message)}for(const a of ['showcase','walk']as const){const r=performRuins(w,a);if(!r.ok)throw new Error(r.message)}return w}
