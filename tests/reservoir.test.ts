import {describe,expect,it} from 'vitest'
import {buildReservoir,performReservoir,reservoirBuildProblem,reservoirGoal,setWaterRoute}from '../src/core/reservoir'
import {reservoirConnected,reservoirNetwork}from '../src/core/reservoirTopology'
import {availablePartners,partnerBed}from '../src/core/partners'
import {planHallGathering}from '../src/core/hall'
import {gardenBed,performGarden}from '../src/core/garden'
import {atuRoute,soilPlan}from '../src/core/atu'
import {canDig,dig}from '../src/core/dig'
import {canRestoreDig}from '../src/core/build'
import {createWorldHistory}from '../src/core/history'
import {deserialize,serialize}from '../src/core/persistence'
import {bagItems} from '../src/core/bag'
import {freshReservoir,TILE}from '../src/core/world'
import {completedReservoir,enterReservoir,expandReservoir,reservoirAvailable,workingReservoir}from './fixtures/reservoirWorld'

describe('第六层水路与第八位伙伴',()=>{
  it('渗水先检查再护框，只有新梯道受限，旧家和旧水路保持',()=>{
    const w=reservoirAvailable(),before=structuredClone(w.tiles)
    expect(reservoirGoal(w).action).toBe('inspect');expect(performReservoir(w,'excavate').ok).toBe(false)
    expect(performReservoir(w,'inspect').ok).toBe(true);expect(performReservoir(w,'excavate').ok).toBe(false)
    const inventory={...w.inventory},parts=w.deep.parts
    expect(performReservoir(w,'shore').ok).toBe(true);expect(w.deep.parts).toBe(parts-1);expect(w.inventory.stone).toBe(inventory.stone-2)
    expect(w.tiles).toEqual(before);expect(performReservoir(w,'shore').ok).toBe(false);expect(canDig(w,27,59).ok).toBe(false)
  })
  it.each([16,27])('梯口 x%s 接入六层，前五层和床位保留，角色可走回家',shaft=>{
    const w=reservoirAvailable(shaft),old=structuredClone(w.tiles.slice(0,59)),pods=structuredClone(w.pods)
    enterReservoir(w);expandReservoir(w)
    expect(reservoirConnected(w)).toBe(true);expect(w.tiles.slice(0,59)).toEqual(old);expect(w.pods).toEqual(pods)
    expect(atuRoute(w,{x:shaft,y:70},{x:18,y:11},true)).not.toBeNull();expect(canDig(w,24,71).ok).toBe(false)
    expect(deserialize(serialize(w))).toMatchObject({ok:true})
  })
  it('团团实际相遇后加入，床位优先位7复用空床，原六人宴不扩座',()=>{
    const w=reservoirAvailable();enterReservoir(w);expandReservoir(w)
    expect(availablePartners(w)).toHaveLength(7);expect(performReservoir(w,'meet').ok).toBe(true)
    expect(availablePartners(w).map(p=>p.id)).toEqual(['atu','adeng','xiaoman','xiaoquan','ayan','amu','taitai','tuantuan'])
    expect(partnerBed(w,'tuantuan')?.slot).toBe(1);expect(planHallGathering(w)?.moves).toHaveLength(5)
  })
  it('完全换一个设施顺序与位置仍可接水，双向任意分流不要求固定蓝图',()=>{
    const w=reservoirAvailable(16);enterReservoir(w);expandReservoir(w);performReservoir(w,'meet');performReservoir(w,'extend')
    for(const [kind,x]of [['wheel',9],['gate',14],['intake',25],['basin',33]] as const)expect(buildReservoir(w,kind,x).ok).toBe(true)
    expect(performReservoir(w,'connect').ok).toBe(true);expect(w.reservoir.canal[0]).toBe(9);expect(w.reservoir.canal.at(-1)).toBe(37)
    performReservoir(w,'fill');setWaterRoute(w,'hall');performReservoir(w,'pump');setWaterRoute(w,'garden');performReservoir(w,'pump')
    expect(performReservoir(w,'tour').ok).toBe(true);expect(deserialize(serialize(w))).toMatchObject({ok:true})
  })
  it('可选贝印芦穗记进物品栏；蓄水计数到边界后拒绝增量而不生成坏档',()=>{
    const w=workingReservoir();w.reservoir.foundShell=true;w.reservoir.foundReed=true
    expect(bagItems(w).filter(i=>i.origin==='reservoir').map(i=>[i.id,i.count])).toEqual([['water-shell',1],['water-reed',1]])
    w.reservoir.fills=100000;const before=structuredClone(w.reservoir);expect(performReservoir(w,'fill').ok).toBe(false);expect(w.reservoir).toEqual(before)
    expect(deserialize(serialize(w))).toMatchObject({ok:true})
  })
  it('自由摆放与真实空洞决定管渠，岩石、缺设施、梯口、重叠和缺料阻止施工',()=>{
    const w=workingReservoir();expect(reservoirNetwork(w)).toBe(true)
    expect(buildReservoir(w,'basin',33).ok).toBe(false)
    const empty=reservoirAvailable();enterReservoir(empty);expandReservoir(empty);performReservoir(empty,'meet')
    expect(reservoirBuildProblem(empty,'basin',25)).toContain('梯口')
    empty.deep.parts=0;const before=structuredClone(empty.inventory);expect(buildReservoir(empty,'basin',18).ok).toBe(false);expect(empty.inventory).toEqual(before)
    expect(performReservoir(empty,'connect').ok).toBe(false)
    w.tiles[68][23]=TILE.ROCK;expect(reservoirNetwork(w)).toBe(false);expect(performReservoir(w,'fill').ok).toBe(false)
  })
  it('关闸蓄到三格，水满自动停止；换水路本身不送水，一次提水只少一格',()=>{
    const w=workingReservoir();expect(performReservoir(w,'pump').ok).toBe(false)
    expect(performReservoir(w,'fill').ok).toBe(true);expect(w.reservoir.water).toBe(3)
    expect(performReservoir(w,'fill').ok).toBe(false)
    expect(setWaterRoute(w,'garden').ok).toBe(true);expect(w.reservoir.water).toBe(3);expect(w.reservoir.gardenDeliveries).toBe(0)
    expect(performReservoir(w,'fill').ok).toBe(false);expect(performReservoir(w,'pump').ok).toBe(true)
    expect(w.reservoir).toMatchObject({water:2,gardenDeliveries:1,hallDeliveries:0,irrigation:2})
    setWaterRoute(w,'hall');performReservoir(w,'pump');expect(w.reservoir).toMatchObject({water:1,hallDeliveries:1,irrigation:2})
    expect(deserialize(serialize(w))).toMatchObject({ok:true})
  })
  it('送往花园的清水只消耗在真实照料，能让菌苗直接展开；撤销照料退回清水',()=>{
    const w=completedReservoir(),history=createWorldHistory(),bed=gardenBed(w,28)!
    expect(bed.growth).toBe(0);const result=performGarden(w,'care',28);expect(result.ok).toBe(true)
    if(result.ok)history.record({kind:'garden',change:result.change})
    expect(bed.growth).toBe(2);expect(w.reservoir.irrigation).toBe(1)
    expect(history.undo(w)?.kind).toBe('garden');expect(gardenBed(w,28)?.growth).toBe(0);expect(w.reservoir.irrigation).toBe(2)
    expect(deserialize(serialize(w))).toMatchObject({ok:true})
  })
  it.each([16,27])('两种布局入口均能向花园和大厅送水，八位有床，完成后继续供水（x%s）',shaft=>{
    const w=completedReservoir(shaft)
    expect(w.reservoir).toMatchObject({completed:true,tours:1,gardenDeliveries:1,hallDeliveries:1})
    expect(reservoirGoal(w).speech).toContain('九层');expect(partnerBed(w,'tuantuan')).not.toBeNull()
    expect(deserialize(serialize(w))).toMatchObject({ok:true})
    performReservoir(w,'pump');expect(w.reservoir.water).toBe(0);expect(performReservoir(w,'pump').ok).toBe(false)
    setWaterRoute(w,'closed');expect(performReservoir(w,'fill').ok).toBe(true);expect(w.reservoir.water).toBe(3)
  })
  it('四格高扩挖用双层施工架；误挖可撤销，设施、管渠与已使用梯道受保护',()=>{
    const w=reservoirAvailable();enterReservoir(w)
    for(const y of [70,69,68])dig(w,23,y)
    const p=soilPlan(w,{x:27,y:70},{x:23,y:67});expect(p.ok).toBe(true);if(p.ok)expect(p.plan.lift).toBe(2)
    const f=workingReservoir(),history=createWorldHistory();dig(f,7,70);history.record({kind:'dig',x:7,y:70});expect(history.undo(f)?.kind).toBe('dig')
    expect(canRestoreDig(f,27,64)).toBe(false);expect(canRestoreDig(f,23,67)).toBe(false)
  })
  it('送水可撤销但已经用过的花园清水不能被撤回；设施撤销退材料',()=>{
    const w=workingReservoir(),history=createWorldHistory();performReservoir(w,'fill');setWaterRoute(w,'garden')
    const pump=performReservoir(w,'pump');if(pump.ok)history.record({kind:'reservoir',change:pump.change})
    expect(history.undo(w)?.kind).toBe('reservoir');expect(w.reservoir.water).toBe(3)
    const p=performReservoir(w,'pump');if(p.ok)history.record({kind:'reservoir',change:p.change});performGarden(w,'care',28)
    expect(history.undo(w)).toBeNull();expect(w.reservoir.irrigation).toBe(1)
  })
})
describe('v20 存档与迁移',()=>{
  it('真实44×64 v19存档逐格保留，只追加第六层，不改输入与前五层成果',()=>{
    const payload=serialize(reservoirAvailable());payload.version=19;payload.world.height=64;payload.world.tiles=payload.world.tiles.slice(0,64)
    delete(payload.world as Partial<typeof payload.world>).reservoir
    const before=structuredClone(payload),result=deserialize(payload)
    expect(result.ok).toBe(true);expect(payload).toEqual(before)
    if(result.ok){expect(result.world.height).toBe(112);expect(result.world.tiles.slice(0,64)).toEqual(payload.world.tiles);expect(result.world.reservoir).toEqual(freshReservoir());expect(result.world.garden.completed).toBe(true)}
  })
  it('中间施工、水位、水路、清水次数与新伙伴站位可恢复；破坏前置和造水被拒绝',()=>{
    const w=reservoirAvailable();performReservoir(w,'inspect');performReservoir(w,'shore');w.tiles[59][27]=TILE.EMPTY;w.workers.ayan={x:27,y:59}
    expect(deserialize(serialize(w))).toMatchObject({ok:true})
    const full=completedReservoir();full.workers.tuantuan={x:11,y:70};expect(deserialize(serialize(full))).toMatchObject({ok:true})
    for(const mutate of [
      (p:ReturnType<typeof serialize>)=>{p.world.reservoir.shored=false},
      (p:ReturnType<typeof serialize>)=>{p.world.reservoir.water=4},
      (p:ReturnType<typeof serialize>)=>{p.world.reservoir.irrigation=5},
      (p:ReturnType<typeof serialize>)=>{p.world.reservoir.valve='bad' as 'closed'},
      (p:ReturnType<typeof serialize>)=>{p.world.reservoir.fills=0},
      (p:ReturnType<typeof serialize>)=>{p.world.reservoir.canal.pop()},
      (p:ReturnType<typeof serialize>)=>{p.world.reservoir.metTuantuan=false},
    ]){const p=serialize(full);mutate(p);expect(deserialize(p).ok).toBe(false)}
  })
})
