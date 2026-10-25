import { completedRuins } from './ruinsWorld'
import { performDeep } from '../../src/core/deep'
import { buildFinale,performFinale } from '../../src/core/finale'
import { finaleFrontier } from '../../src/core/finaleTopology'
import { initializeWorkers } from '../../src/core/partnerWork'
import { dig } from '../../src/core/dig'
import { TILE,type WorldState } from '../../src/core/world'
export function finaleAvailable(shaft=27):WorldState{const w=completedRuins(shaft);for(let i=0;i<5;i++)for(const a of ['collect','smelt','craft']as const){const r=performDeep(w,a);if(!r.ok)throw new Error(r.message)}return w}
export function enterFinale(w:WorldState):void{for(const a of ['inspect','brace']as const){const r=performFinale(w,a);if(!r.ok)throw new Error(r.message)}let p=finaleFrontier(w);while(p){w.tiles[p.y][p.x]=TILE.EMPTY;w.dugCount++;p=finaleFrontier(w)}const r=performFinale(w,'enter');if(!r.ok)throw new Error(r.message);w.exploration.explorer={x:w.exploration.shaftX!,y:106}}
export function expandFinale(w:WorldState):void{for(const d of [-1,1])for(let x=w.exploration.shaftX!;x>=3&&x<=40;x+=d)for(const y of [106,105,104,103])if(w.tiles[y][x]===TILE.SOIL){const r=dig(w,x,y);if(!r.ok)throw new Error(`挖掘夹具失败 ${x},${y}: ${r.reason}`)}}
export function workingFinale(shaft=27):WorldState{const w=finaleAvailable(shaft);enterFinale(w);expandFinale(w);for(const a of ['discover','extend']as const){const r=performFinale(w,a);if(!r.ok)throw new Error(r.message)}initializeWorkers(w);for(const[k,x]of [['beacon',18],['table',28],['memory',8]]as const){const r=buildFinale(w,k,x);if(!r.ok)throw new Error(r.message)}const r=performFinale(w,'light');if(!r.ok)throw new Error(r.message);return w}
export function readyFinale(shaft=27):WorldState{const w=workingFinale(shaft);for(const a of ['food','water','chime','weave','story','decorate']as const){const r=performFinale(w,a);if(!r.ok)throw new Error(r.message)}return w}
export function completedFinale(shaft=27):WorldState{const w=readyFinale(shaft);for(const a of ['feast','review']as const){const r=performFinale(w,a);if(!r.ok)throw new Error(r.message)}for(let i=0;i<9;i++)performFinale(w,'remember');const r=performFinale(w,'finish');if(!r.ok)throw new Error(r.message);return w}
