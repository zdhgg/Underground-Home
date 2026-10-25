import { Assets,Container,Graphics,Sprite,Text,type Texture } from 'pixi.js'
import lingling from '../assets/art/ventilation/lingling-v1.png'
import fan from '../assets/art/ventilation/fan-v1.png'
import bench from '../assets/art/ventilation/bench-v1.png'
import { ventilationBuildProblem,ventilationFacility } from '../core/ventilation'
import { LINGLING_SPOT,ventilationClear,ventilationNetwork,ventilationWidth } from '../core/ventilationTopology'
import { TILE,TILE_SIZE as T,type VentilationFacilityKind,type WorldState } from '../core/world'
export const VENTILATION_ART_URLS={lingling,fan,bench}
type VentilationTextures=Partial<Record<keyof typeof VENTILATION_ART_URLS,Texture>>
export async function loadVentilationTextures():Promise<VentilationTextures>{
  const art:VentilationTextures={};await Promise.all(Object.entries(VENTILATION_ART_URLS).map(async([key,url])=>{try{const t=await Assets.load<Texture>(url);t.source.scaleMode='linear';t.source.autoGenerateMipmaps=true;art[key as keyof VentilationTextures]=t}catch{console.warn(`听风工区 ${key} 图片未加载，保留备用绘制。`)}}));return art
}
/** 岩壁设施和工作反馈始终在人物后侧；预览框单独在前侧。 */
export class VentilationScene {
  readonly view=new Container({label:'ventilation-chapter'})
  readonly foreground=new Container({label:'ventilation-front'})
  readonly preview=new Graphics()
  private readonly moving=new Graphics({label:'ventilation-motion'})
  private art:VentilationTextures={}
  private time=0
  constructor(){this.foreground.addChild(this.preview)}
  setArt(art:VentilationTextures):void{this.art=art}
  refresh(w:WorldState):void {
    this.view.removeChild(this.moving)
    for(const c of this.view.removeChildren())c.destroy({children:true})
    const g=new Graphics(),v=w.ventilation,shaft=w.exploration.shaftX;this.view.addChild(g)
    if(!w.reservoir.completed||shaft===null)return
    const sx=(shaft+.5)*T
    if(!v.braced){g.moveTo(sx,71*T).lineTo(sx-7,71.5*T).lineTo(sx+6,71.7*T).stroke({width:2,color:0xb8adbb});this.label('旧飘带静静垂着',shaft+.5,69.2)}
    else for(let y=71;y<=82;y++){
      if(w.tiles[y][shaft]!==TILE.EMPTY)break
      for(const dx of [.22,.78])g.moveTo((shaft+dx)*T,y*T).lineTo((shaft+dx)*T,(y+1)*T).stroke({width:3,color:0xa28f79})
      for(const dy of [.25,.65])g.moveTo((shaft+.22)*T,(y+dy)*T).lineTo((shaft+.78)*T,(y+dy)*T).stroke({width:2,color:0xd0bca0})
      if(y%3===2)g.rect(shaft*T-3,y*T-4,T+6,5).fill(0xaaa4b1)
    }
    if(!v.entered)return
    if(!v.metLingling){this.sprite('lingling',(LINGLING_SPOT.x+.5)*T,83*T,43,43);this.label('有谁在听风？',LINGLING_SPOT.x+.5,80.2)}
    for(const x of v.duct)if(ventilationClear(w,x))g.roundRect(x*T,79.6*T,T+1,7,2).fill(0x727480).stroke({width:1,color:0xa9a3b3})
    if(ventilationNetwork(w))g.moveTo((shaft+.82)*T,79.7*T).lineTo((shaft+.82)*T,11*T).stroke({width:3,color:0x9394a1,alpha:.5})
    for(const f of v.facilities){const x=f.x*T,width=ventilationWidth(f.kind)*T
      if(f.kind==='fan')this.sprite('fan',x+width/2,82.9*T,width-4,3.3*T)
      if(f.kind==='bench')this.sprite('bench',x+width/2,82.95*T,width-4,3.1*T)
      if(f.kind==='inlet'){g.roundRect(x+3,80.1*T,width-6,2.6*T,14).fill(0x45515a).stroke({width:5,color:0xa5a29a});for(let i=0;i<4;i++)g.moveTo(x+14+i*17,80.4*T).lineTo(x+14+i*17,82.4*T).stroke({width:3,color:0x8b9297})}
      if(f.kind==='baffle'){g.roundRect(x+4,80.2*T,width-8,2.4*T,8).fill(0x5c5b69).stroke({width:3,color:0xb6a789});for(let i=0;i<4;i++)g.moveTo(x+10,(80.65+i*.45)*T).lineTo(x+width-10,(80.45+i*.45)*T).stroke({width:4,color:0xc0ae8e})}
    }
    if(w.tiles[82][38]===TILE.EMPTY)for(let i=0;i<3;i++)g.arc(38.6*T,82.5*T,4+i*3,Math.PI*.6,Math.PI*1.4).stroke({width:1,color:0xbaafc5,alpha:.65})
    if(w.tiles[82][10]===TILE.EMPTY){g.moveTo(10.5*T,81.6*T).lineTo(10.5*T,82.8*T).stroke({width:2,color:0xa39d8e});g.poly([10.5*T,81.6*T,10.9*T,81.8*T,10.5*T,82*T]).fill(0xa5bdb1)}
    this.view.addChild(this.moving)
    this.update(w,0)
  }
  update(w:WorldState|null,dt:number):void {
    const g=this.moving.clear();if(!w||!w.ventilation.entered)return
    const v=w.ventilation,on=v.mode!=='off'&&ventilationNetwork(w);if(on)this.time+=dt*(v.mode==='work'?2.7:1)
    const fan=ventilationFacility(w,'fan')
    if(fan){const width=ventilationWidth('fan')*T-4,h=width*2/3,cx=(fan.x+2)*T-width*.025,cy=82.9*T-h*.51
      for(let i=0;i<4;i++){const a=this.time+i*Math.PI/2;g.moveTo(cx+Math.cos(a)*4,cy+Math.sin(a)*4).lineTo(cx+Math.cos(a+.28)*22,cy+Math.sin(a+.28)*22).lineTo(cx+Math.cos(a-.18)*19,cy+Math.sin(a-.18)*19).closePath().fill(0xbaa27e).stroke({width:.7,color:0xd4c3a2})}g.circle(cx,cy,4).fill(0xc5a578)
    }
    const baffle=ventilationFacility(w,'baffle');if(baffle){const x=(baffle.x+1)*T,y=81.6*T,k=on?Math.sin(this.time*2)*6:0;g.moveTo(x,y).bezierCurveTo(x+7,y+8,x+k+10,y+13,x+k+(on?20:0),y+(on?15:28)).stroke({width:3,color:0xb6c9bc})}
    if(on)for(const x of v.duct){const k=(this.time*.7+x*.14)%1;g.moveTo((x+k)*T,79.7*T).lineTo((x+k+.18)*T,79.7*T).stroke({width:1.5,color:0xd0d5c9,alpha:.65})}
    const bench=ventilationFacility(w,'bench')
    if(bench){const px=(bench.x+3.5)*T,py=81.55*T,a=on&&v.mode==='work'?this.time*1.8:0
      g.moveTo(px,py).lineTo(px,py+17).stroke({width:1.5,color:0xa89171})
      for(let i=0;i<4;i++){const t=a+i*Math.PI/2;g.moveTo(px,py).lineTo(px+Math.cos(t)*9,py+Math.sin(t)*9).lineTo(px+Math.cos(t+.5)*6,py+Math.sin(t+.5)*6).closePath().fill(i%2?0xbdbca1:0xa0b7aa)}g.circle(px,py,2).fill(0xd6b883)
    }
    if(bench&&v.readyCraft)this.craft(g,(bench.x+3.7)*T,81.3*T,v.readyCraft,false)
    const hall=w.hall.facilities.find(f=>f.kind==='hall')
    if(hall&&v.hallArt)this.craft(g,(hall.x+6.4)*T,43.6*T,v.hallArt,on&&v.mode==='home')
  }
  private craft(g:Graphics,x:number,y:number,kind:'chime'|'mobile',moving:boolean):void {
    const k=moving?Math.sin(this.time*1.4)*3:0
    g.moveTo(x,y).lineTo(x+k,y+12).stroke({width:1,color:0xb9b2a5});g.moveTo(x-13+k,y+12).lineTo(x+13+k,y+12).stroke({width:2,color:0xbda482})
    for(let i=0;i<3;i++){const px=x+k-9+i*9,dy=7+i%2*5;g.moveTo(px,y+12).lineTo(px+k*.4,y+12+dy).stroke({width:1,color:0xb9b2a5});if(kind==='chime')g.roundRect(px-2+k*.4,y+12+dy,4,13-i*2,2).fill(0xc6aa7e);else g.ellipse(px+k*.4,y+17+dy,5,3).fill(i%2?0xb8a680:0x9cb6a3)}
  }
  private sprite(key:keyof VentilationTextures,x:number,bottom:number,width:number,height:number):void{const t=this.art[key];if(!t){this.view.addChild(new Graphics().roundRect(x-width/2,bottom-height,width,height,9).fill(0x7f7c88));return}const s=new Sprite(t);s.label=`ventilation-${key}`;s.anchor.set(.5,1);s.scale.set(Math.min(width/t.width,height/t.height));s.position.set(x,bottom);this.view.addChild(s)}
  private label(text:string,x:number,y:number):void{const t=new Text({text,style:{fontFamily:'Microsoft YaHei,sans-serif',fontSize:11,fill:0xc9c4d0,stroke:{color:0x2b2934,width:3}}});t.anchor.set(.5,1);t.position.set(x*T,y*T);this.view.addChild(t)}
  placePreview(w:WorldState,kind:VentilationFacilityKind|null,x:number|null):void{this.preview.clear();if(!kind||x===null)return;const color=ventilationBuildProblem(w,kind,x)?0xe0b49b:0xb6c7c2;this.preview.roundRect(x*T+2,79*T+2,ventilationWidth(kind)*T-4,4*T-4,10).fill({color,alpha:.1}).stroke({color,width:2})}
}
