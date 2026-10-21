import { upgradePickaxe } from './exploration'
import { partnerById } from './partners'
import type { WorldState } from './world'
import { hasWideLampAbility, lightingOpportunity, WIDE_LAMP_ID } from './lighting'

export const SMALL_PICKAXE_ID = 'small-pickaxe'

export interface PartnerUpgrade {
  id: typeof SMALL_PICKAXE_ID | typeof WIDE_LAMP_ID
  icon: string
  lockedHint: string
  equippedLabel: string
  name: string
  state: 'locked' | 'ready' | 'equipped'
  effect: string
  boundary: string
}

/** 复用原铁镐标记，旧档无需新增等级或迁移；同一能力只有一个状态来源。 */
export function pickaxeUpgrade(world: WorldState): PartnerUpgrade {
  return {
    id: SMALL_PICKAXE_ID, name: '小铁镐',
    icon: '⛏', lockedHint: '先去裂纹旁听听水声', equippedLabel: '已装备',
    state: world.exploration.pickaxeUpgraded ? 'equipped' : world.exploration.clueFound ? 'ready' : 'locked',
    effect: '能凿开带裂纹的岩石', boundary: '坚硬基岩还挖不动',
  }
}

export function wideLampUpgrade(world: WorldState): PartnerUpgrade {
  const state = hasWideLampAbility(world) ? 'equipped' : lightingOpportunity(world) ? 'ready' : 'locked'
  const lockedHint = !world.exploration.springFound ? '先找到地下泉水'
    : !world.powerDown ? '先把电送到第二层' : !world.exploration.lamps.length ? '先请阿灯装一盏小壁灯' : '在壁灯旁挖通一片新空间试试'
  return { id: WIDE_LAMP_ID, name: '聚光灯罩', icon: '🏮', state, lockedHint, equippedLabel: '已学会',
    effect: '照明从左右各2格，扩大到各4格', boundary: '给旧灯加装，或在新地方安灯；光不穿土和岩石' }
}

/** 已批准的能力逐项接入，伙伴ID、能力ID和升级ID同时校验。 */
export function upgradePartner(world: WorldState, partnerId: string, upgradeId: string): boolean {
  const partner = partnerById(partnerId)
  if (!partner?.joins(world)) return false
  if (partner.id === 'adeng' && partner.abilityId === 'light' && upgradeId === WIDE_LAMP_ID) {
    if (wideLampUpgrade(world).state !== 'ready') return false
    world.partnerUpgrades.push(WIDE_LAMP_ID); return true
  }
  if (partner.id !== 'atu' || partner.abilityId !== 'dig' || upgradeId !== SMALL_PICKAXE_ID) return false
  if (pickaxeUpgrade(world).state !== 'ready') return false
  return upgradePickaxe(world)
}
