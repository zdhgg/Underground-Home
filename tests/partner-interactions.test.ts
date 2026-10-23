import { describe, expect, it } from 'vitest'
import { createInitialWorld } from '../src/core/world'
import { partnerConversation } from '../src/core/partnerInteractions'
import { pickaxeUpgrade, SMALL_PICKAXE_ID, upgradePartner } from '../src/core/partnerAbilities'
import { deserialize, serialize } from '../src/core/persistence'
import { hitPartner } from '../src/render/partnerHitTest'

describe('伙伴能力与对话：不增加任务门槛', () => {
  it('聊天、查看工具和关闭前的读取都不改变世界', () => {
    const world = createInitialWorld()
    const before = serialize(world).world
    expect(partnerConversation(world, 'atu')?.upgrade).toBeNull()
    expect(pickaxeUpgrade(world).state).toBe('locked')
    expect(partnerConversation(world, 'adeng')?.lines[0]).toContain('黑')
    expect(upgradePartner(world, 'atu', SMALL_PICKAXE_ID)).toBe(false)
    expect(serialize(world).world).toEqual(before)
  })

  it('未知伙伴、尚未加入的伙伴不能冒充阿土或取得工具', () => {
    const world = createInitialWorld()
    world.exploration.clueFound = true
    expect(partnerConversation(world, 'missing')).toBeNull()
    expect(partnerConversation(world, 'xiaoman')).toBeNull()
    expect(partnerConversation(world, 'xiaoquan')).toBeNull()
    for (const id of ['missing', 'adeng', 'xiaoman', 'xiaoquan']) expect(upgradePartner(world, id, SMALL_PICKAXE_ID)).toBe(false)
    expect(upgradePartner(world, 'atu', 'future-drill')).toBe(false)
    expect(world.exploration.pickaxeUpgraded).toBe(false)
  })

  it('听到水声后可升级，只有原铁镐标记变化，反复操作无效', () => {
    const world = createInitialWorld()
    world.exploration.clueFound = true
    const before = structuredClone(world)
    expect(partnerConversation(world, 'atu')?.action?.id).toBe('upgrade-pickaxe')
    expect(upgradePartner(world, 'atu', SMALL_PICKAXE_ID)).toBe(true)
    expect(world).toEqual({ ...before, exploration: { ...before.exploration, pickaxeUpgraded: true } })
    expect(upgradePartner(world, 'atu', SMALL_PICKAXE_ID)).toBe(false)
    expect(partnerConversation(world, 'atu')?.upgrade?.state).toBe('equipped')
    expect(partnerConversation(world, 'atu')?.action?.id).toBe('look-at-clue')
  })

  it('原v7存档不新增升级状态，基础存档读取后仍显示原工具状态', () => {
    const world = createInitialWorld()
    const payload = serialize(world)
    const result = deserialize(payload)
    expect(result.ok).toBe(true)
    if (result.ok) expect(pickaxeUpgrade(result.world).state).toBe('locked')
    expect(Object.keys(payload.world)).not.toContain('partnerLevels')
  })

  it('专业伙伴只回应已有营地状态，不展示未实现升级', () => {
    const world = createInitialWorld()
    world.pods.push({ id: 1, x: 12, y: 10, door: 'right' })
    world.exploration.entered = true
    expect(partnerConversation(world, 'xiaoman')?.lines[1]).toContain('水')
    world.exploration.springFound = true
    expect(partnerConversation(world, 'xiaoquan')?.lines[0]).toContain('泉水')
    world.farm.waterSupplied = true
    expect(partnerConversation(world, 'xiaoquan')?.lines[0]).toContain('菜园')
    expect(partnerConversation(world, 'xiaoman')?.lines[0]).toContain('菜园')
    for (const id of ['adeng', 'xiaoman', 'xiaoquan']) {
      expect(partnerConversation(world, id)?.upgrade).toBeNull()
      expect(partnerConversation(world, id)?.action).toBeNull()
    }
  })

  it('第一次相遇会说明伙伴为什么留下，以及为什么需要住处', () => {
    const world = createInitialWorld()
    world.progress.coreRepaired = true
    expect(partnerConversation(world, 'adeng')?.lines.join(' ')).toContain('暖暖的床')

    world.pods.push({ id: 1, x: 12, y: 10, door: 'right' })
    world.exploration.entered = true
    expect(partnerConversation(world, 'xiaoman')?.lines.join(' ')).toContain('留一间暖暖的住处')

    world.exploration.springFound = true
    expect(partnerConversation(world, 'xiaoquan')?.lines.join(' ')).toContain('留个住处')
  })
})

describe('小角色点击容错', () => {
  const targets = [
    { id: 'atu', x: 100, y: 100, width: 16, height: 18 },
    { id: 'adeng', x: 100, y: 128, width: 16, height: 18 },
  ]
  it('小身体周围扩为44px，远处不误命中', () => {
    expect(hitPartner({ x: 90, y: 109 }, targets)).toBe('atu')
    expect(hitPartner({ x: 70, y: 109 }, targets)).toBeNull()
  })
  it('相邻床位的容错范围重叠时，选择最近的伙伴', () => {
    expect(hitPartner({ x: 108, y: 134 }, targets)).toBe('adeng')
    expect(hitPartner({ x: 108, y: 114 }, [...targets].reverse())).toBe('atu')
  })
})
