import { Assets,Container,Graphics,Sprite,Text,type Texture } from 'pixi.js'
import heart from '../assets/art/finale/heart-v1.png'
import table from '../assets/art/finale/table-v1.png'
import memory from '../assets/art/finale/memory-v1.png'
import { finaleBuildProblem } from '../core/finale'
import { WARMTH_SPOT,finaleWidth } from '../core/finaleTopology'
import { TILE,TILE_SIZE as T,type FinaleFacilityKind,type WorldState } from '../core/world'
export const FINALE_ART_URLS={heart,table,memory}
type FinaleTextures=Partial<Record<keyof typeof FINALE_ART_URLS,Texture>>
export async function loadFinaleTextures():Promise<FinaleTextures>{const art:FinaleTextures={};await Promise.all(Object.entries(FINALE_ART_URLS).map(async([key,url])=>{try{const t=await Assets.load<Texture>(url);t.source.scaleMode='linear';t.source.autoGenerateMipmaps=true;art[key as keyof FinaleTextures]=t}catch{console.warn(`地心暖光 ${key} 图片未加载，保留备用绘制。`)}}));return art}
/** 设施、食物和纪念壁始终在真实人物后侧；只把选址框放在前侧。 */
export class FinaleScene{
 readonly view=new Container({label:'finale-chapter'})
 readonly foreground=new Container({label:'finale-front'})
 readonly preview=new Graphics()
 private art:FinaleTextures={}
 constructor(){this.foreground.addChild(this.preview)}
 setArt(art:FinaleTextures):void{this.art=art}
 refresh(w:WorldState):void{
  for(const c of this.view.removeChildren())c.destroy({children:true})
  const r=w.finale,shaft=w.exploration.shaftX,g=new Graphics({label:'finale-stonework'});this.view.addChild(g)
  if(!w.ruins.completed||shaft===null)return
  if(!r.braced){g.moveTo((shaft+.2)*T,95*T).lineTo((shaft+.7)*T,95.3*T).stroke({width:2,color:0xd4b580});this.label('下方透出温柔的金色',shaft+.5,93.4)}
  else for(let y=95;y<=106;y++){
   if(w.tiles[y][shaft]!==TILE.EMPTY)break
   for(const dx of [.22,.78])g.moveTo((shaft+dx)*T,y*T).lineTo((shaft+dx)*T,(y+1)*T).stroke({width:3,color:0x9e8a67})
   for(const dy of [.25,.65])g.moveTo((shaft+.22)*T,(y+dy)*T).lineTo((shaft+.78)*T,(y+dy)*T).stroke({width:2,color:0xd7c6a0})
  }
  if(!r.entered)return
  if([103,104,106].every(y=>w.tiles[y][WARMTH_SPOT.x]===TILE.EMPTY)){this.sprite('heart',(WARMTH_SPOT.x+.5)*T,104.7*T,2.5*T,1.7*T);this.label(r.foundWarmth?'天然暖晶 · 留在原处':'暖光从这里来',WARMTH_SPOT.x+.5,103.05)}
  for(const f of r.facilities){const x=f.x*T,width=finaleWidth(f.kind)*T
   if(f.kind==='table'){
    this.sprite('table',x+width/2,106.95*T,width-4,3.3*T)
    const food=new Graphics({label:'finale-table-preparations'});this.view.addChild(food)
    if(r.foodReady||r.feasts)for(let i=0;i<3;i++){const px=x+(2+i*2.6)*T;food.ellipse(px,106*T,12,4).fill(0xcab994);food.ellipse(px,105.94*T,9,4).fill(i%2?0x99ad70:0xc7955f);food.circle(px+3,105.85*T,3).fill(0xb3bf89)}
    if(r.waterReady||r.feasts)for(const dx of [1.2,8.5])food.roundRect(x+dx*T,105.62*T,7,14,3).fill(0xa7c8cb).stroke({width:1,color:0xd7e4dc})
    if(r.woven)for(let i=0;i<9;i++)food.ellipse(x+(.8+i)*T,104.8*T,5,2.5).fill(r.theme==='garden'?0x9daf7e:0xa5a17d)
    if(r.decorations)for(let i=0;i<5;i++){const px=x+(1+i*1.8)*T;food.moveTo(px,104.1*T).lineTo(px,104.4*T).stroke({width:1,color:0xa89573});food.roundRect(px-3,104.4*T,6,8,2).fill(r.theme==='lantern'?0xe4c087:0xc4cca0)}
    if(r.chimePlaced){const px=x+9.4*T;food.moveTo(px,103.9*T).lineTo(px,104.35*T).stroke({width:1,color:0xbdab83});for(let i=0;i<3;i++)food.roundRect(px-6+i*5,104.2*T,3,13+i%2*4,1).fill(0xc7aa73)}
   }
   if(f.kind==='memory'){
    this.sprite('memory',x+width/2,106.95*T,width-4,3.2*T)
    if(r.storyReady){const m=new Graphics({label:'finale-nine-memories'});this.view.addChild(m);for(let i=0;i<9;i++){const px=x+(1.05+i%3*.97)*T,py=(104.9+Math.floor(i/3)*.62)*T;m.circle(px,py,3.3).fill(i<r.memoriesRead?0xe6c68e:0xb4aa8c);if(i===8&&r.completed)m.circle(px,py,6).stroke({width:1,color:0xe4c17d})}}
   }
   if(f.kind==='beacon'){
    g.roundRect(x+6,105.65*T,width-12,1.2*T,10).fill(0x8f8570).stroke({width:3,color:0xc9b895})
    g.poly([x+width*.2,105.6*T,x+width*.45,104.2*T,x+width*.7,105.6*T]).fill(r.lit?0xc9b58b:0x938d80).stroke({width:3,color:0xbaa57f})
    if(r.lit){g.ellipse(x+width*.45,105.2*T,22,27).fill({color:0xe9d29a,alpha:.18});g.circle(x+width*.45,105.2*T,5).fill(0xe9c982)}
   }
   if(f.kind==='bench'){g.roundRect(x+4,106.1*T,width-8,8,4).fill(0xb6a485).stroke({width:2,color:0x776e5b});g.roundRect(x+8,105.3*T,width-16,20,7).fill(0x9e9078);for(const dx of [14,width-14])g.rect(x+dx,106.3*T,7,.6*T).fill(0x8b806c)}
  }
  // 九层联结只沿已开通的梯道描绘，不把暖光画穿未挖的岩层。
  if(r.lit){for(let y=11;y<=106;y++)if(w.tiles[y][shaft]===TILE.EMPTY)g.rect((shaft+.06)*T,y*T,2,T+1).fill({color:0xbca073,alpha:.45});for(const y of [11,21,33,46,58,70,82,94,106])g.circle((shaft+.1)*T,(y+.4)*T,3).fill(0xddbd83);this.label(r.completed?'九层家园 · 故事由你继续':'九层相连 · 每个家都在',shaft+.5,108)}
 }
 private sprite(key:keyof FinaleTextures,x:number,bottom:number,width:number,height:number):void{const t=this.art[key];if(!t){this.view.addChild(new Graphics().roundRect(x-width/2,bottom-height,width,height,9).fill(0x8d8068));return}const s=new Sprite(t);s.label=`finale-${key}`;s.anchor.set(.5,1);s.scale.set(Math.min(width/t.width,height/t.height));s.position.set(x,bottom);this.view.addChild(s)}
 private label(text:string,x:number,y:number):void{const t=new Text({text,style:{fontFamily:'Microsoft YaHei,sans-serif',fontSize:10,fill:0xdbc8a7,stroke:{color:0x343025,width:3}}});t.anchor.set(.5,1);t.position.set(x*T,y*T);this.view.addChild(t)}
 placePreview(w:WorldState,kind:FinaleFacilityKind|null,x:number|null):void{this.preview.clear();if(!kind||x===null)return;const color=finaleBuildProblem(w,kind,x)?0xe0ae93:0xc7cba0;this.preview.roundRect(x*T+2,103*T+2,finaleWidth(kind)*T-4,4*T-4,10).fill({color,alpha:.1}).stroke({color,width:2})}
}
