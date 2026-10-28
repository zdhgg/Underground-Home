import { describe, expect, it } from 'vitest'
import { primaryGuideAction, resolveGlobalGuide } from '../src/app/guideAction'
import { depthAccess } from '../src/app/depthAccess'
import { explorationGuide, guideHighlight } from '../src/core/missions'
import { createInitialWorld } from '../src/core/world'
import { secondLayerComplete } from './fixtures/deepWorld'
import { completedFinale } from './fixtures/finaleWorld'
import { workingGarden } from './fixtures/gardenWorld'

describe('全局主线由世界规则按顺序交接', () => {
  it('第一层未完成时，后面的完成标记不会盖过能源石目标', () => {
    const w = completedFinale()
    w.progress.crystalFound = false
    expect(resolveGlobalGuide(w)).toMatchObject({ title: '找到发光的能源石', finished: false, action: { id: 'focus' } })
  })

  it('第二层仍有真实探索目标时，已经开放的后续章节不接管', () => {
    const w = completedFinale()
    w.farm.harvests = 0
    expect(resolveGlobalGuide(w)).toMatchObject({ title: '在泉水边种出第一份食物', action: { id: 'plant' } })
    w.farm.harvests = 1; w.pods = w.pods.slice(0, 1)
    expect(resolveGlobalGuide(w)).toMatchObject({ title: '给伙伴留床', action: { id: 'site' } })
  })

  it.each(['deep', 'hall', 'garden', 'reservoir', 'ventilation', 'ruins', 'finale'] as const)('多个章节可用时优先第一个未完成章节 %s', id => {
    const w = completedFinale()
    const chapters = ['deep', 'hall', 'garden', 'reservoir', 'ventilation', 'ruins', 'finale'] as const
    // 完整规则夹具保留真实地形、设施和已开放的后续层；撤回当前及后续完成位。
    for (const current of chapters.slice(chapters.indexOf(id))) w[current].completed = false
    const guide = resolveGlobalGuide(w)
    expect(guide.action.id).toBe(id)
    expect(guide.finished).toBe(false)
    expect(primaryGuideAction(w)).toEqual(guide.action)
  })

  it('共餐不代替安床；原四位住下后交给第三层，再做饭不抢回主线', () => {
    const w = secondLayerComplete()
    expect(resolveGlobalGuide(w).action.id).toBe('site')
    // 使用完整通路和床位的真实终章夹具，保留第一顿饭但撤回后续章节完成态。
    const home = completedFinale()
    home.deep.completed = false
    expect(home.farm.sharedMeals).toBeGreaterThan(0)
    expect(resolveGlobalGuide(home).action.id).toBe('deep')
    home.farm.sharedMeals++
    expect(resolveGlobalGuide(home).action.id).toBe('deep')
  })

  it('花园新伙伴等床由花园负责，不让第二层引导回退', () => {
    const w = workingGarden()
    expect(explorationGuide(w).finished).toBe(true)
    expect(resolveGlobalGuide(w).action.id).toBe('garden')
    expect(guideHighlight(w).kind).toBe('none')
  })

  it('九层真正完成后交接自由建设；完成计数不是完成标记', () => {
    const w = completedFinale()
    expect(resolveGlobalGuide(w)).toMatchObject({ title: '九层家园建好啦，接下来由你继续布置', finished: true, action: { id: 'overview' } })
    w.finale.completed = false
    expect(resolveGlobalGuide(w)).toMatchObject({ finished: false, action: { id: 'finale' } })
  })

  it('锁层条件与现有开放规则相同，不改世界', () => {
    const w = createInitialWorld(), before = structuredClone(w)
    expect(depthAccess(w, 'crystal')).toMatchObject({ available: false, reason: expect.stringContaining('第一顿围坐饭') })
    expect(depthAccess(w, 'hall').available).toBe(false)
    expect(w).toEqual(before)
    const home = completedFinale()
    for (const layer of ['crystal', 'hall', 'garden', 'reservoir', 'ventilation', 'ruins', 'finale'] as const) expect(depthAccess(home, layer).available).toBe(true)
  })
})
