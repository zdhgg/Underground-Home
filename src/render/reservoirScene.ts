import { Assets, Container, Graphics, Sprite, Text, type Texture } from 'pixi.js'
import tuantuan from '../assets/art/reservoir/tuantuan-v1.png'
import basin from '../assets/art/reservoir/basin-v1.png'
import wheel from '../assets/art/reservoir/wheel-v1.png'
import intake from '../assets/art/reservoir/intake-v1.png'
import { reservoirBuildProblem, reservoirFacility } from '../core/reservoir'
import { TUANTUAN_SPOT, reservoirClear, reservoirNetwork, reservoirWidth } from '../core/reservoirTopology'
import { TILE, TILE_SIZE as T, type ReservoirFacilityKind, type WaterRoute, type WorldState } from '../core/world'
export const RESERVOIR_ART_URLS={tuantuan,basin,wheel,intake}
type ReservoirTextures=Partial<Record<keyof typeof RESERVOIR_ART_URLS,Texture>>
export async function loadReservoirTextures():Promise<ReservoirTextures>{
  const art:ReservoirTextures={}
  await Promise.all(Object.entries(RESERVOIR_ART_URLS).map(async([key,url])=>{try{const t=await Assets.load<Texture>(url);t.source.scaleMode='linear';t.source.autoGenerateMipmaps=true;art[key as keyof ReservoirTextures]=t}catch{console.warn(`蓄水回廊 ${key} 图片未加载，保留备用绘制。`)}}))
  return art
}
export class ReservoirScene {
  readonly view=new Container({label:'reservoir-chapter'})
  readonly foreground=new Container({label:'reservoir-front'})
  readonly preview=new Graphics()
  private readonly moving=new Graphics()
  private art:ReservoirTextures={}
  private flow:{route:WaterRoute;time:number}|null=null
  constructor(){this.foreground.addChild(this.moving,this.preview)}
  setArt(art:ReservoirTextures):void{this.art=art}
  startFlow(route:WaterRoute):void{this.flow={route,time:0}}
  stopFlow():void{this.flow=null;this.moving.clear()}
  refresh(w:WorldState):void{
    for(const c of this.view.removeChildren())c.destroy({children:true})
    const g=new Graphics();this.view.addChild(g);const r=w.reservoir,shaft=w.exploration.shaftX
    if(!w.garden.completed||shaft===null)return
    const sx=(shaft+.5)*T
    if(!r.shored){g.moveTo(sx-8,59.05*T).lineTo(sx+2,59.4*T).lineTo(sx-3,59.85*T).stroke({width:2,color:0x93b7be});this.label(r.inspected?'先装止水护框':'沙沙… 岩缝在渗水',shaft+.5,57.2)}
    else{
      for(const y of [59,62,66]){g.rect(shaft*T-2,y*T-5,T+4,5).fill(0xa6a48b);g.moveTo(shaft*T+3,y*T+12).lineTo(sx,y*T-2).lineTo((shaft+1)*T-3,y*T+12).stroke({width:3,color:0xa3b5ad})}
      for(let y=59;y<=70;y++){if(w.tiles[y][shaft]!==TILE.EMPTY)break;for(const dx of [.22,.78])g.moveTo((shaft+dx)*T,y*T).lineTo((shaft+dx)*T,(y+1)*T).stroke({width:3,color:0xa68f6e});for(const dy of [.25,.65])g.moveTo((shaft+.22)*T,(y+dy)*T).lineTo((shaft+.78)*T,(y+dy)*T).stroke({width:2,color:0xc9b691})}
    }
    if(!r.entered)return
    if(!r.metTuantuan&&w.tiles[70][TUANTUAN_SPOT.x]===TILE.EMPTY){this.sprite('tuantuan',(TUANTUAN_SPOT.x+.5)*T,71*T,45,45);this.label('旧水闸旁的扁尾巴',TUANTUAN_SPOT.x+.5,68.1)}
    for(const x of r.canal)if(reservoirClear(w,x)){
      g.moveTo(x*T,67.75*T).lineTo((x+1)*T,67.75*T).stroke({width:5,color:0x697e7b})
      g.moveTo(x*T,67.71*T).lineTo((x+1)*T,67.71*T).stroke({width:1,color:0xb9c9b3,alpha:.6})
    }
    if(reservoirNetwork(w))g.moveTo((shaft+.1)*T,67.75*T).lineTo((shaft+.1)*T,46.25*T).stroke({width:3,color:0x729592,alpha:.6})
    for(const f of r.facilities){const x=f.x*T,width=reservoirWidth(f.kind)*T
      if(f.kind==='basin'){
        this.sprite('basin',x+width/2,70.95*T,width-4,3*T)
        // 三道水位明确对应 0—3。水面位于石池内部，不越过池沿。
        const waterInk=new Graphics({label:'reservoir-water-level'});this.view.addChild(waterInk)
        const waterHeight=r.water*4.8
        if(waterHeight){const base=70.43*T;waterInk.poly([x+width*.18,base-waterHeight,x+width*.91,base-waterHeight*.7,x+width*.82,base,x+width*.23,base]).fill({color:0x83c2c8,alpha:.65}).stroke({width:.7,color:0xb8e2df,alpha:.7})}
        for(let i=1;i<=3;i++)waterInk.moveTo(x+10,70.4*T-i*8).lineTo(x+17,70.4*T-i*8).stroke({width:2,color:i<=r.water?0xcce7de:0x738e8c})
      }
      if(f.kind==='intake')this.sprite('intake',x+width/2,70.9*T,width-4,2.7*T)
      if(f.kind==='wheel')this.sprite('wheel',x+width/2,70.9*T,width-4,2.8*T)
      if(f.kind==='gate'){
        g.roundRect(x+3,68.4*T,width-6,2.3*T,7).fill(0x4b6667).stroke({width:4,color:0xa3a38b})
        const cx=x+width/2,cy=69.35*T;g.circle(cx,cy,12).stroke({width:3,color:0xc6ad75})
        const a=r.valve==='closed'?Math.PI/2:r.valve==='garden'?Math.PI:0;g.moveTo(cx,cy).lineTo(cx+Math.cos(a)*16,cy+Math.sin(a)*16).stroke({width:4,color:0xd5bf8b})
        g.circle(x+12,68.85*T,3).fill(r.valve==='garden'?0xafd7a9:0x5f7c73);g.circle(x+width-12,68.85*T,3).fill(r.valve==='hall'?0xf2cd8e:0x7d7a65)
      }
    }
    if(w.tiles[70][38]===TILE.EMPTY)for(let i=0;i<4;i++)g.arc(38.5*T,70.6*T,4+i*2,Math.PI,Math.PI*2).stroke({width:1,color:0xb9c8ba,alpha:.5})
    if(w.tiles[70][10]===TILE.EMPTY)for(let i=0;i<3;i++)g.moveTo((10.2+i*.2)*T,70.85*T).lineTo((10.25+i*.2)*T,70.2*T).stroke({width:2,color:0x9aa883})
    if(r.gardenDeliveries>0){const rill=w.garden.facilities.find(f=>f.kind==='rill');if(rill){g.roundRect((rill.x+2.1)*T,58.5*T,11,13,3).fill({color:0xb6d9ce,alpha:.75});this.label(`清水照料 ${r.irrigation} 次`,rill.x+1.5,56.5)}}
    if(r.hallDeliveries>0){const hall=w.hall.facilities.find(f=>f.kind==='hall');if(hall){const bx=(hall.x+6.7)*T;g.roundRect(bx,45.65*T,10,17,3).fill({color:0xa7d1d1,alpha:.8});g.rect(bx+3,45.5*T,4,7).fill(0xb2c6b8)}}
  }
  update(w:WorldState|null,dt:number):void{
    const g=this.moving.clear(),flow=this.flow
    if(!w||!flow)return
    flow.time+=dt;if(flow.time>2.5){this.flow=null;return}
    const wheel=reservoirFacility(w,'wheel'),shaft=w.exploration.shaftX
    if(!wheel||shaft===null)return
    // 水轮轴上的真实转动标记与管内水珠同步；静态插画保留岩拱和泵体。
    const cx=(wheel.x+1.55)*T,cy=69.85*T
    for(let i=0;i<8;i++){const a=flow.time*2+i*Math.PI/4;g.moveTo(cx+Math.cos(a)*9,cy+Math.sin(a)*9).lineTo(cx+Math.cos(a)*21,cy+Math.sin(a)*21).stroke({width:3,color:0xd2b17b,alpha:.75})}
    for(const x of w.reservoir.canal){const k=(flow.time*1.5+x*.13)%1;g.circle((x+k)*T,67.75*T,2).fill({color:0xaedfe4,alpha:.7})}
    const top=flow.route==='garden'?58:46
    for(let i=0;i<7;i++){const p=(flow.time*.5+i/7)%1;g.circle((shaft+.1)*T,(67.75-(67.75-top)*p)*T,2).fill({color:0xb6e1de,alpha:.6})}
  }
  private sprite(key:keyof ReservoirTextures,x:number,bottom:number,width:number,height:number):void{const t=this.art[key];if(!t){this.view.addChild(new Graphics().roundRect(x-width/2,bottom-height,width,height,9).fill(0x70887e));return}const s=new Sprite(t);s.label=`reservoir-${key}`;s.anchor.set(.5,1);s.scale.set(Math.min(width/t.width,height/t.height));s.position.set(x,bottom);this.view.addChild(s)}
  private label(text:string,x:number,y:number):void{const t=new Text({text,style:{fontFamily:'Microsoft YaHei,sans-serif',fontSize:11,fill:0xbdd5ce,stroke:{color:0x243638,width:3}}});t.anchor.set(.5,1);t.position.set(x*T,y*T);this.view.addChild(t)}
  placePreview(w:WorldState,kind:ReservoirFacilityKind|null,x:number|null):void{this.preview.clear();if(!kind||x===null)return;const color=reservoirBuildProblem(w,kind,x)?0xe0b49b:0xa2d8cc;this.preview.roundRect(x*T+2,67*T+2,reservoirWidth(kind)*T-4,4*T-4,10).fill({color,alpha:.1}).stroke({color,width:2})}
}
