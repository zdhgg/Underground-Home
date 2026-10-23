// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createApp, h, nextTick, reactive, type App, type Component, type VNode } from 'vue'
import GuidePanel from '../src/components/GuidePanel.vue'
import SiteTools from '../src/components/SiteTools.vue'
import PartnerConversation from '../src/components/PartnerConversation.vue'
import { type SiteUI, emptySiteUI } from '../src/app/siteEditor'
import { conversationPlacement } from '../src/render/conversationAnchor'

let app: App | undefined
afterEach(() => { app?.unmount(); app = undefined; document.body.innerHTML = '' })
async function mount(component: Component, props: Record<string, unknown>, slots?: Record<string, () => VNode>) {
  const host = document.createElement('div'); document.body.append(host)
  app = createApp({ render: () => h(component, props, slots) }); app.mount(host); await nextTick()
  return host
}
describe('单一关注对象的界面', () => {
  it('建议的主动作不会因展开帮助而消失，帮助里不混入工具', async () => {
    const host = await mount(GuidePanel, { title: '给伙伴留床', done: 3, total: 4, finished: false }, {
      'quick-action': () => h('button', '看看要挖的小窝空间'), default: () => h('p', '挖空后点蓝图。'),
    })
    expect(host.querySelectorAll('button')).toHaveLength(2)
    const help = host.querySelector<HTMLButtonElement>('.help')!
    help.click(); await nextTick()
    expect(host.querySelector('.quick-action')!.textContent).toContain('看看要挖的小窝空间')
    expect(host.querySelector('.details')!.textContent).toBe('挖空后点蓝图。')
  })
  it('建筑详情隐藏其他洞室；列表单独显示；施工时收成状态条', async () => {
    const state = reactive<SiteUI>({ ...emptySiteUI(), active: true, selected: 'first-nest', name: '两人小窝', canBuild: true,
      sites: [{ id: 'first-nest', name: '两人小窝', icon: '床', layer: 'home' as const, built: false }, { id: 'home-lounge', name: '暖暖客厅', icon: '椅', layer: 'home' as const, built: false }],
    })
    const host = await mount(SiteTools, { state })
    expect(host.querySelector('nav')).toBeNull(); expect(host.textContent).not.toContain('暖暖客厅')
    state.selected = null; await nextTick()
    expect(host.querySelectorAll('nav button')).toHaveLength(2)
    state.selected = 'first-nest'; state.working = true; await nextTick()
    expect(host.querySelector('.construction-strip')).not.toBeNull()
    expect(host.querySelector('.room-picture')).toBeNull(); expect(host.textContent).not.toContain('暖暖客厅')
  })
  it('先读短句，再出现下一步按钮；关闭和主动作分别可用', async () => {
    const action = vi.fn(), close = vi.fn()
    const host = await mount(PartnerConversation, { conversation: {
      partnerId: 'adeng', name: '阿灯', species: '萤火虫', verb: '照亮', lines: ['我是阿灯！', '我想有张床。'], upgrade: null,
      action: { id: 'prepare-nest', label: '去准备小窝' },
    }, busy: false, anchor: { x: 350, y: 480, width: 800, height: 650 }, onAction: action, onClose: close })
    expect(host.textContent).toContain('我是阿灯！'); expect(host.textContent).not.toContain('去准备小窝')
    host.querySelector<HTMLButtonElement>('.primary')!.click(); await nextTick()
    expect(host.textContent).toContain('我想有张床。')
    host.querySelector<HTMLButtonElement>('.primary')!.click(); expect(action).toHaveBeenCalledOnce()
    host.querySelector<HTMLButtonElement>('.later')!.click(); expect(close).toHaveBeenCalledOnce()
  })
  it('窄屏和屏幕边缘的对话留在舞台内，角色上方有空间时不遮住角色', () => {
    for (const anchor of [{ x: 8, y: 400, width: 390, height: 600 }, { x: 382, y: 400, width: 390, height: 600 }, { x: 195, y: 30, width: 390, height: 600 }]) {
      const p = conversationPlacement(anchor, { width: 320, height: 250 })
      expect(p.left).toBeGreaterThanOrEqual(12); expect(p.left + 320).toBeLessThanOrEqual(378)
      expect(p.top).toBeGreaterThanOrEqual(12); expect(p.top + 250).toBeLessThanOrEqual(588)
      if (anchor.y === 400) expect(p.top + 250).toBeLessThan(anchor.y)
      else expect(p.below).toBe(true)
    }
  })
})
