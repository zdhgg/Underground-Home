import { Assets,Container,Graphics,Sprite,Text,type Texture } from 'pixi.js'
import mosaic from '../assets/art/ruins/mosaic-v1.png'
import desk from '../assets/art/ruins/desk-v1.png'
import folio from '../assets/art/ruins/folio-v1.png'
import { ruinsBuildProblem,ruinsFacility,RUINS_STORIES } from '../core/ruins'
import { RUINS_MOTIF_SPOTS,ruinsWidth } from '../core/ruinsTopology'
import { TILE,TILE_SIZE as T,type RuinsFacilityKind,type RuinsMotif,type WorldState } from '../core/world'
export const RUINS_ART_URLS={mosaic,desk,folio}
type RuinsTextures=Partial<Record<keyof typeof RUINS_ART_URLS,Texture>>
export async function loadRuinsTextures():Promise<RuinsTextures>{const art:RuinsTextures={};await Promise.all(Object.entries(RUINS_ART_URLS).map(async([key,url])=>{try{const t=await Assets.load<Texture>(url);t.source.scaleMode='linear';t.source.autoGenerateMipmaps=true;art[key as keyof RuinsTextures]=t}catch{console.warn(`旧地脉遗迹 ${key} 图片未加载，保留备用绘制。`)}}));return art}
/** 三段故事在原岩壁上方；设施与人物通行带错开。所有装饰均在人物后面。 */
export class RuinsScene{
 readonly view=new Container({label:'ruins-chapter'})
 readonly foreground=new Container({label:'ruins-front'})
 readonly preview=new Graphics()
 private art:RuinsTextures={}
 constructor(){this.foreground.addChild(this.preview)}
 setArt(art:RuinsTextures):void{this.art=art}
 refresh(w:WorldState):void{
  for(const c of this.view.removeChildren())c.destroy({children:true})
  const r=w.ruins,shaft=w.exploration.shaftX,g=new Graphics({label:'ruins-stonework'});this.view.addChild(g)
  if(!w.ventilation.completed||shaft===null)return
  const sx=(shaft+.5)*T
  if(!r.braced){g.arc(sx,83*T,16,Math.PI,Math.PI*2).stroke({width:3,color:0xb39d77});this.label('旧拱纹留下了什么？',shaft+.5,81.4)}
  else for(let y=83;y<=94;y++){
   if(w.tiles[y][shaft]!==TILE.EMPTY)break
   for(const dx of [.22,.78])g.moveTo((shaft+dx)*T,y*T).lineTo((shaft+dx)*T,(y+1)*T).stroke({width:3,color:0x9e8a67})
   for(const dy of [.25,.65])g.moveTo((shaft+.22)*T,(y+dy)*T).lineTo((shaft+.78)*T,(y+dy)*T).stroke({width:2,color:0xd7c6a0})
  }
  if(!r.entered)return
  for(const m of ['lamp','spring','tools']as const){const at=RUINS_MOTIF_SPOTS[m];if(![91,92,94].every(y=>w.tiles[y][at.x]===TILE.EMPTY))continue
   const known=r.revealed.includes(m),x=(at.x+.5)*T,y=91.7*T
   g.roundRect(x-22,y-16,44,31,7).fill({color:0x7d715b,alpha:.6}).stroke({width:1,color:known?0xd8c39a:0x9d9074})
   this.glyph(g,m,x,y,known?0xe3cba0:0x9e927b,.8);this.label(known?RUINS_STORIES[m].name:'旧岩纹',at.x+.5,91.05)
  }
  for(const f of r.facilities){const x=f.x*T,width=ruinsWidth(f.kind)*T
   if(f.kind==='desk')this.sprite('desk',x+width/2,94.95*T,width-4,2.6*T)
   if(f.kind==='mosaic'){
    this.sprite('mosaic',x+width/2,94.95*T,width-4,2.6*T)
    const overlay=new Graphics({label:'ruins-restored-stories'});this.view.addChild(overlay)
    for(const [i,m]of (['lamp','spring','tools']as const).entries())if(r.mounted.includes(m))this.glyph(overlay,m,x+(1.05+i*1.95)*T,93.6*T,0xeacb8e,1.2)
    if(r.todayReady){const y=94.45*T;for(let i=0;i<9;i++){const px=x+(.55+i*.61)*T,py=y+(r.edition==='together'?Math.sin(i/8*Math.PI)*-9:0);overlay.circle(px,py,2.4).fill(0xe2bd7c);overlay.circle(px-3,py-4,1).circle(px,py-5,1).circle(px+3,py-4,1).fill(0xe2bd7c);if(r.edition==='journey'&&i<8)overlay.moveTo(px+3,py).lineTo(px+.61*T-3,py).stroke({width:1,color:0xc9a86e})}}
   }
   if(f.kind==='light'){g.ellipse(x+T/2,93.2*T,T*1.5,1.8*T).fill({color:0xe8d5a7,alpha:.09});g.moveTo(x+T/2,94.7*T).lineTo(x+T/2,93*T).stroke({width:4,color:0x9c8e77});g.roundRect(x+T*.2,92.8*T,T*.6,T*.5,6).fill(0xe1c790).stroke({width:2,color:0x9e8962})}
   if(f.kind==='bench'){g.roundRect(x+4,94.1*T,width-8,8,4).fill(0xb6a485).stroke({width:2,color:0x776e5b});g.roundRect(x+8,93.3*T,width-16,20,7).fill(0x9e9078);for(const dx of [14,width-14])g.rect(x+dx,94.3*T,7,.6*T).fill(0x8b806c)}
  }
  for(const [x,found]of [[10,r.foundSeal],[36,r.foundFootprint]]as const)if(w.tiles[94][x]===TILE.EMPTY){g.circle((x+.5)*T,94.65*T,found?4:3).stroke({width:1.5,color:found?0xe3c594:0xa89676});if(x===36)g.circle((x+.65)*T,94.55*T,2).fill(0xb6a180)}
  if(r.rubbings.length){const d=ruinsFacility(w,'desk');if(d)this.label(`拓印 ${r.rubbings.length} / 3`,d.x+2,92.4)}
 }
 private glyph(g:Graphics,m:RuinsMotif,x:number,y:number,color:number,scale:number):void{const s=scale
  if(m==='lamp'){g.roundRect(x-8*s,y-8*s,16*s,15*s,3*s).stroke({width:2,color});g.moveTo(x,y-12*s).lineTo(x,y-8*s).moveTo(x-11*s,y+9*s).lineTo(x+11*s,y+9*s).stroke({width:2,color});g.circle(x,y,3*s).fill(color)}
  if(m==='spring')for(let i=0;i<3;i++)g.moveTo(x-14*s,y+(i-1)*7*s).bezierCurveTo(x-5*s,y+(i-1)*7*s-6*s,x+4*s,y+(i-1)*7*s+6*s,x+14*s,y+(i-1)*7*s).stroke({width:2,color})
  if(m==='tools'){g.moveTo(x-10*s,y-10*s).lineTo(x+10*s,y+10*s).moveTo(x+10*s,y-10*s).lineTo(x-10*s,y+10*s).stroke({width:3,color});g.moveTo(x-15*s,y-5*s).lineTo(x-5*s,y-15*s).moveTo(x+5*s,y-15*s).lineTo(x+15*s,y-5*s).stroke({width:4,color})}
 }
 private sprite(key:keyof RuinsTextures,x:number,bottom:number,width:number,height:number):void{const t=this.art[key];if(!t){this.view.addChild(new Graphics().roundRect(x-width/2,bottom-height,width,height,9).fill(0x8d8068));return}const s=new Sprite(t);s.label=`ruins-${key}`;s.anchor.set(.5,1);s.scale.set(Math.min(width/t.width,height/t.height));s.position.set(x,bottom);this.view.addChild(s)}
 private label(text:string,x:number,y:number):void{const t=new Text({text,style:{fontFamily:'Microsoft YaHei,sans-serif',fontSize:10,fill:0xdbc8a7,stroke:{color:0x343025,width:3}}});t.anchor.set(.5,1);t.position.set(x*T,y*T);this.view.addChild(t)}
 placePreview(w:WorldState,kind:RuinsFacilityKind|null,x:number|null):void{this.preview.clear();if(!kind||x===null)return;const color=ruinsBuildProblem(w,kind,x)?0xe0ae93:0xc7cba0;this.preview.roundRect(x*T+2,91*T+2,ruinsWidth(kind)*T-4,4*T-4,10).fill({color,alpha:.1}).stroke({color,width:2})}
}
