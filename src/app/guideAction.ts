import { currentMission, explorationGuide } from '../core/missions'
import { siteBlueprintVisible, siteById, siteBuilt } from '../core/sites'
import type { WorldState } from '../core/world'

export interface GuideAction {
  id: 'focus' | 'site' | 'water' | 'plant' | 'power' | 'pickaxe' | 'chain' | 'travel'
  label: string
  siteId?: string
}

/** 建议只选择当前主线的一步；蓝图尚未出现时只带路，不替玩家挖土。 */
export function primaryGuideAction(world: WorldState): GuideAction {
  const mission = currentMission(world)
  if (mission && mission.id !== 'build-sleep-pod') return {
    id: 'focus', label: mission.id === 'repair-energy-core' ? '找到能源核心' : '看看能源石',
  }
  const title = mission?.title ?? explorationGuide(world).title
  if (title === '给伙伴留床') {
    const siteId = world.pods.length ? 'friends-nest' : 'first-nest'
    const site = siteById(siteId)!
    if (!siteBuilt(world, site)) return {
      id: 'site', siteId,
      label: siteBlueprintVisible(world, site) ? `修建${site.name}` : '看看要挖的小窝空间',
    }
  }
  if (title === '换上小铁镐') return { id: 'pickaxe', label: '和阿土换上小铁镐' }
  if (title === '沿梯子去第二层') return { id: 'travel', label: '沿梯子下去看看' }
  if (title === '把水接到菜园') return { id: 'water', label: '请小泉接好水管' }
  if (title === '在泉水边种出第一份食物') return { id: 'plant', label: '去泉水边种菜' }
  if (title === '把家里的电送到下面') return { id: 'power', label: '把电送到下面' }
  return { id: 'focus', label: title === '亲手挖出向下的梯道' ? '看看能挖的裂纹' : title === '楼下有谁在喊饿' ? '找找声音从哪来' : title === '找到滴答响的泉水' ? '找找泉水在哪里' : '回到家园看看' }
}
