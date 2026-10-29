import { currentMission, explorationGuide, FIRST_NIGHT_MISSIONS, missionSummary } from '../core/missions'
import { siteBlueprintVisible, siteById, siteBuilt } from '../core/sites'
import { DINING_SITE_ID, KITCHEN_SITE_ID } from '../core/meal'
import { LOUNGE_SITE_ID } from '../core/lounge'
import { deepGoal, deepReady } from '../core/deep'
import { hallGoal, hallReady } from '../core/hall'
import { gardenGoal, gardenReady } from '../core/garden'
import { reservoirGoal, reservoirReady } from '../core/reservoir'
import { ventilationGoal, ventilationReady } from '../core/ventilation'
import { ruinsGoal, ruinsReady } from '../core/ruins'
import { finaleGoal, finaleReady } from '../core/finale'
import type { WorldState } from '../core/world'

export interface GuideAction {
  id: 'focus' | 'site' | 'water' | 'plant' | 'power' | 'pickaxe' | 'chain' | 'travel' | 'meal' | 'deep' | 'hall' | 'garden' | 'reservoir' | 'ventilation' | 'ruins' | 'finale' | 'overview'
  label: string
  siteId?: string
}

/** 前两层保留原有直接操作；蓝图尚未出现时只带路，不替玩家挖土。 */
function earlyGuideAction(world: WorldState): GuideAction {
  const mission = currentMission(world)
  if (mission?.id === 'build-lounge') {
    const site = siteById(LOUNGE_SITE_ID)!
    return {
      id: 'site', siteId: LOUNGE_SITE_ID,
      label: siteBlueprintVisible(world, site) ? `修建${site.name}` : '看看要挖的客厅空间',
    }
  }
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
  if (title === '在泉边修一个灶台' || title === '再摆一张餐桌') {
    const siteId = title === '在泉边修一个灶台' ? KITCHEN_SITE_ID : DINING_SITE_ID
    const site = siteById(siteId)!
    return { id: 'site', siteId, label: siteBlueprintVisible(world, site) ? `修建${site.name}` : `看看${site.name}那边` }
  }
  if (title === '请大家吃第一顿饭') return { id: 'meal', label: '请大家吃第一顿饭' }
  return { id: 'focus', label: title === '亲手挖出向下的梯道' ? '看看能挖的裂纹' : title === '楼下有谁在喊饿' ? '找找声音从哪来' : title === '找到滴答响的泉水' ? '找找泉水在哪里' : '回到家园看看' }
}

export interface GlobalGuide {
  layer: string
  title: string
  speech: string
  outcome: string
  done: number
  total: number
  finished: boolean
  action: GuideAction
}

/** 由真实规则解析唯一主线快照；不保存另一份任务状态，不依赖当前镜头楼层。 */
export function resolveGlobalGuide(world: WorldState, resting = true): GlobalGuide {
  const mission = currentMission(world), summary = missionSummary(world)
  const pendingRest = mission !== null && world.pods.length > 0 && !resting
  if (mission || pendingRest) {
    // 刚安好床的那一句永远是"小床安好啦"，不会因为后面多了客厅就改口。
    const podMission = FIRST_NIGHT_MISSIONS.find(item => item.id === 'build-sleep-pod')!
    const current = pendingRest ? podMission : mission!
    return { title: current.title, outcome: current.outcome, layer: '第 1 层 · 暖窝', speech: pendingRest ? '小床安好啦！伙伴有住处，也能来帮忙。' : current.speech,
      done: pendingRest ? Math.max(0, summary.done - 1) : summary.done, total: summary.total, finished: false, action: earlyGuideAction(world) }
  }
  const exploration = explorationGuide(world)
  if (!exploration.finished) {
    const action = earlyGuideAction(world)
    const atHome = action.id === 'pickaxe' || action.id === 'power' || (action.id === 'site' && ['first-nest', 'friends-nest', LOUNGE_SITE_ID].includes(action.siteId ?? ''))
      || (!world.exploration.entered && action.id === 'focus')
    return { ...exploration, layer: atHome ? '第 1 层 · 暖窝' : '第 2 层 · 泉水', action }
  }
  // 开放只是前置条件，完成标记才决定是否交接；顺序扫描到第一个未完成章节即返回。
  const chapters = [
    { id: 'deep', ready: deepReady, state: world.deep, goal: deepGoal, layer: '第 3 层 · 晶簇', label: '看看第三层的新线索', total: 13, outcome: '把晶光、工坊和电梯连成新一层家园。' },
    { id: 'hall', ready: hallReady, state: world.hall, goal: hallGoal, layer: '第 4 层 · 暖光大厅', label: '看看暖光大厅', total: 11, outcome: '把旧岩洞建成六位伙伴相聚的暖光大厅。' },
    { id: 'garden', ready: gardenReady, state: world.garden, goal: gardenGoal, layer: '第 5 层 · 菌光花园', label: '看看菌光花园', total: 14, outcome: '让水、菌丝和灯光连成新朋友的花园。' },
    { id: 'reservoir', ready: reservoirReady, state: world.reservoir, goal: reservoirGoal, layer: '第 6 层 · 蓄水回廊', label: '看看蓄水回廊', total: 18, outcome: '让清水沿新回廊送回花园与大厅。' },
    { id: 'ventilation', ready: ventilationReady, state: world.ventilation, goal: ventilationGoal, layer: '第 7 层 · 听风工区', label: '看看听风工区', total: 19, outcome: '连起风路，把手作送回九位伙伴的家。' },
    { id: 'ruins', ready: ruinsReady, state: world.ruins, goal: ruinsGoal, layer: '第 8 层 · 旧地脉遗迹', label: '看看旧地脉遗迹', total: 19, outcome: '修复三段旧故事，添上今天的家。' },
    { id: 'finale', ready: finaleReady, state: world.finale, goal: finaleGoal, layer: '第 9 层 · 地心暖光', label: '看看地心暖光', total: 20, outcome: '把九位伙伴和九层成果聚成一次暖屋日。' },
  ] as const
  for (const chapter of chapters) {
    if (chapter.state.completed) continue
    if (!chapter.ready(world)) break
    const goal = chapter.goal(world)
    return { layer: chapter.layer, title: goal.title, speech: `${goal.speaker}：${goal.speech}`, outcome: chapter.outcome,
      done: goal.done, total: chapter.total, finished: false, action: { id: chapter.id, label: chapter.label } }
  }
  if (chapters.every(chapter => chapter.state.completed)) return {
    layer: '自由建设', title: '九层家园建好啦，接下来由你继续布置', speech: '继续挖土、摆设施、翻相册，或和朋友们再聚一桌吧。',
    outcome: '每一层都能继续布置。', done: 1, total: 1, finished: true, action: { id: 'overview', label: '看看九层家园全景' },
  }
  // 正常存档不会到这里；前置缺失时仍提供有效的查看动作，不误报终章完成。
  return { ...exploration, layer: '第 2 层 · 泉水', finished: false, title: '回泉水层看看', speech: '先找到泉水，把电送下来，再和大家围坐吃第一顿饭。', action: { id: 'focus', label: '看看家园的下一步' } }
}

export function primaryGuideAction(world: WorldState): GuideAction {
  return resolveGlobalGuide(world).action
}
