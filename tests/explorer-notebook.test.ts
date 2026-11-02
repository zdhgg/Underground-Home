// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createApp, h, nextTick, reactive, type App } from 'vue'
import ExplorerNotebook from '../src/components/ExplorerNotebook.vue'
import GuidePanel from '../src/components/GuidePanel.vue'
import Game from '../src/App.vue'
import type { GameSession, SessionHooks } from '../src/app/session'
import { emptyHallUI } from '../src/app/hallChapter'
import type { HomeWish } from '../src/app/homeWishes'

const baseProps = () => reactive({
  open: true, guideVisible: true, docked: false, layerLabel: '第 1 层 · 暖窝', title: '找到发光的能源石',
  done: 0, total: 4, finished: false, primaryLabel: '看看能源石', primaryDisabled: false,
})
const wishes = (): HomeWish[] => [
  { id: 'nest-warm-lamp', emoji: '🪔', title: '给小窝添盏暖光灯', detail: '第三层做的新部件，可以带回家啦！', actionLabel: '去看看小窝', target: { kind: 'pod', podId: 1 }, note: '还差1个工坊部件，可以去第三层再做一个。' },
  { id: 'ripe-planter', emoji: '🥕', title: '菜长熟啦！', detail: '小满照顾的菜可以收获啦！', actionLabel: '去看看菜园', target: { kind: 'planter', planterId: 2, x: 28, y: 21 } },
]
type Listener = (...args: never[]) => void

let app: App | undefined
afterEach(() => { app?.unmount(); app = undefined; document.body.innerHTML = ''; localStorage.clear(); vi.restoreAllMocks() })

async function mountNotebook(props = baseProps(), listeners: Record<string, Listener> = {}) {
  const host = document.createElement('div'); document.body.append(host)
  app = createApp({ render: () => h(ExplorerNotebook, { ...props, ...listeners }) })
  app.mount(host); await nextTick()
  return { host, props }
}

describe('阿土的探索小本子', () => {
  it('小本子只装当前任务：主线、心愿与主按钮在里面，楼层导航已搬到右侧楼层条', async () => {
    const { host } = await mountNotebook()
    expect(host.querySelector('.notebook-mission')?.textContent).toContain('找到发光的能源石')
    expect(host.querySelector('.notebook-wishes')).toBeNull()
    expect(host.querySelector('.notebook-primary')?.textContent).toBe('看看能源石')
    expect(host.querySelector('.notebook-floors')).toBeNull()
    expect(host.querySelector('.depth-nav')).toBeNull()
  })

  it('收起只剩紧凑入口；Esc 也能收起，入口自身没有主要推进按钮', async () => {
    const close = vi.fn()
    const { host, props } = await mountNotebook(baseProps(), { onClose: close })
    host.querySelector<HTMLButtonElement>('.notebook-close')!.click(); await nextTick()
    expect(close).toHaveBeenCalledTimes(1)
    host.querySelector('.notebook-sheet')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await nextTick()
    expect(close).toHaveBeenCalledTimes(2)
    props.open = false; await nextTick()
    expect(host.querySelector<HTMLElement>('.notebook-sheet')?.style.display).toBe('none')
    const tab = host.querySelector<HTMLButtonElement>('.notebook-tab')!
    expect(tab.getAttribute('aria-expanded')).toBe('false')
    expect(tab.querySelector('[data-primary-action]')).toBeNull()
    expect(tab.hasAttribute('data-primary-action')).toBe(false)
  })

  it('主线楼层标签与正在查看的楼层分开显示，主按钮复用原有事件', async () => {
    const props = baseProps()
    props.layerLabel = '第 4 层 · 暖光大厅'
    const primary = vi.fn()
    const { host } = await mountNotebook(props, { onPrimary: primary })
    expect(host.querySelector('.guide .layer')?.textContent).toContain('第 4 层')
    host.querySelector<HTMLButtonElement>('.notebook-primary')!.click()
    expect(primary).toHaveBeenCalledTimes(1)
  })

  it('家园心愿在主线下方；没有主要操作标记，缺料提示可见', async () => {
    const props = { ...baseProps(), wishes: wishes() }
    const { host } = await mountNotebook(props as ReturnType<typeof baseProps>)
    const order = Array.from(host.querySelectorAll('.notebook-mission, .notebook-wishes'))
    expect(order.map(section => section.className)).toEqual(['notebook-mission', 'notebook-wishes'])
    const section = host.querySelector('.notebook-wishes')!
    expect(section.textContent).toContain('我的家园心愿')
    expect(section.textContent).toContain('给小窝添盏暖光灯')
    expect(section.textContent).toContain('还差1个工坊部件')
    expect(section.textContent).toContain('菜长熟啦！')
    expect(section.querySelectorAll('[data-primary-action]')).toHaveLength(0)
    expect(host.querySelectorAll('.notebook-sheet [data-primary-action]')).toHaveLength(1)
    expect(host.querySelectorAll('.wish-action')).toHaveLength(2)
  })

  it('窄屏紧凑条目保留短标题、完整无障碍名称和缺料提示', async () => {
    const props = { ...baseProps(), wishes: wishes() }
    const { host } = await mountNotebook(props as ReturnType<typeof baseProps>)
    const buttons = host.querySelectorAll<HTMLButtonElement>('.wish-action')
    expect(buttons[0].getAttribute('aria-label')).toBe('去看看小窝')
    expect(buttons[0].querySelector('.wish-action-full')?.textContent).toBe('去看看小窝')
    expect(buttons[0].querySelector('.wish-action-short')?.textContent).toBe('去看看')
    expect(buttons[1].getAttribute('aria-label')).toBe('去看看菜园')
    expect(host.querySelector('.wish-title-full')?.textContent).toBe('给小窝添盏暖光灯')
    expect(host.querySelector('.wish-title-short')?.textContent).toBe('小窝添盏暖光灯')
    expect(host.querySelector('.wish-note')?.textContent).toContain('还差1个工坊部件')
    for (const button of buttons) expect(button.hasAttribute('data-primary-action')).toBe(false)
  })

  it('点击心愿只发出稳定ID，由会话重新验证目标', async () => {
    const wish = vi.fn()
    const props = { ...baseProps(), wishes: wishes() }
    const { host } = await mountNotebook(props as ReturnType<typeof baseProps>, { onWish: wish })
    Array.from(host.querySelectorAll<HTMLButtonElement>('.wish-action'))[1].click()
    expect(wish).toHaveBeenCalledWith('ripe-planter')
  })

  it('同时最多两条；超过两条的部分不渲染', async () => {
    const props = {
      ...baseProps(),
      wishes: [...wishes(), { ...wishes()[1], id: 'ripe-planter' as const, title: '第三条' }],
    }
    const { host } = await mountNotebook(props as ReturnType<typeof baseProps>)
    expect(host.querySelectorAll('.wish-item')).toHaveLength(2)
    expect(host.textContent).not.toContain('第三条')
  })

  it('主要面板存在时心愿跟随主线一起让位；收起后也不在紧凑入口留下内容', async () => {
    const props = reactive({ ...baseProps(), wishes: wishes() })
    const { host } = await mountNotebook(props as ReturnType<typeof baseProps>)
    props.guideVisible = false
    await nextTick()
    expect(host.querySelector('.notebook-wishes')).toBeNull()
    expect(host.querySelector('.notebook-mission')).toBeNull()
    expect(host.querySelector('.notebook-quiet')?.textContent).toContain('先专心做眼前这件事')
    expect(host.querySelector('.depth-nav')).toBeNull()
    props.open = false
    props.guideVisible = true
    await nextTick()
    expect(host.querySelector('.notebook-wishes')).toBeNull()
    expect(host.querySelector('.notebook-tab')?.textContent).not.toContain('菜长熟啦')
    expect(host.querySelector('.notebook-tab')?.textContent).not.toContain('暖光灯')
  })
})

const harness = vi.hoisted(() => ({
  hooks: null as SessionHooks | null,
  lookDown: vi.fn(), centerOnHome: vi.fn(), showOverview: vi.fn(), openHall: vi.fn(), closeHall: vi.fn(), cancelAction: vi.fn(), findAtu: vi.fn(), focusHomeWish: vi.fn(),
}))
vi.mock('../src/app/session', () => ({
  createGameSession: async (_host: HTMLElement, hooks: SessionHooks): Promise<Partial<GameSession>> => {
    harness.hooks = hooks
    return {
      titleSave: () => ({ status: 'none' }), startNewGame: async () => {},
      startOpening: () => hooks.onOpening?.({ active: false, caption: '' }),
      enableOpeningSound: () => {}, setInputBlocked: () => {}, destroy: () => {},
      lookDown: harness.lookDown, centerOnHome: harness.centerOnHome, showOverview: harness.showOverview,
      openHall: harness.openHall, closeHall: harness.closeHall, cancelAction: harness.cancelAction, findAtu: harness.findAtu,
      focusHomeWish: harness.focusHomeWish,
    }
  },
}))

async function mountGame() {
  const host = document.createElement('div'); document.body.append(host)
  app = createApp(Game); app.mount(host)
  await Promise.resolve(); await nextTick()
  host.querySelector<HTMLButtonElement>('.start-button')!.click()
  await Promise.resolve(); await nextTick()
  return { host, hooks: harness.hooks! }
}

describe('顶部工具栏与探索小本子的交接', () => {
  it('主线留在小本子里，楼层导航常驻舞台右侧', async () => {
    const { host } = await mountGame()
    expect(host.querySelector('.top .depth-nav')).toBeNull()
    expect(host.querySelector('.top .depth-toggle')).toBeNull()
    expect(host.querySelector('.notebook .depth-nav')).toBeNull()
    expect(host.querySelector('.stage > .depth-nav')).not.toBeNull()
    expect(host.querySelector('.notebook-mission')?.textContent).toContain('找到发光的能源石')
  })

  it('心愿随会话快照进入小本子；点击后收起并交给会话重新验证', async () => {
    const { host, hooks } = await mountGame()
    harness.focusHomeWish.mockClear()
    hooks.onWishes?.(wishes())
    await nextTick()
    const sections = Array.from(host.querySelectorAll('.notebook-mission, .notebook-wishes'))
    expect(sections.map(section => section.className)).toEqual(['notebook-mission', 'notebook-wishes'])
    expect(host.querySelectorAll('.stage [data-primary-action]')).toHaveLength(1)
    expect(host.querySelectorAll('.wish-action[data-primary-action]')).toHaveLength(0)
    host.querySelectorAll<HTMLButtonElement>('.wish-action')[0].click()
    await nextTick()
    expect(harness.focusHomeWish).toHaveBeenCalledWith('nest-warm-lamp')
    expect(host.querySelector<HTMLElement>('.notebook-sheet')?.style.display).toBe('none')
  })

  it('章节页翻进小本子：本子保持展开、主线与心愿让位，仍只有一个主要操作', async () => {
    const { host, hooks } = await mountGame()
    harness.openHall.mockClear(); harness.lookDown.mockClear(); harness.cancelAction.mockClear()
    hooks.onWishes?.(wishes())
    hooks.onHall?.({ ...emptyHallUI(), available: true, active: true, title: '先把旧木梁托稳', label: '安装新支撑' })
    await nextTick()
    // 第四章不再另起面板，而是小本子顶部的“现场页”。
    expect(host.querySelector('.notebook-sheet .hall-panel')).not.toBeNull()
    expect(host.querySelector<HTMLElement>('.notebook-sheet')?.style.display).not.toBe('none')
    expect(host.querySelector('.notebook-mission')).toBeNull()
    expect(host.querySelector('.notebook-wishes')).toBeNull()
    expect(host.querySelector('.notebook-quiet')).toBeNull()
    const primaryCount = () => host.querySelectorAll('.stage [data-primary-action]').length
    expect(primaryCount()).toBe(1)
    // 楼层条在本子外常驻；点楼层只把导航交给会话，本子与章节页的收尾仍走会话导航方法。
    host.querySelector<HTMLButtonElement>('.depth-nav .water')!.click(); await nextTick()
    expect(harness.lookDown).toHaveBeenCalledTimes(1)
    expect(harness.openHall).not.toHaveBeenCalled()
    expect(harness.closeHall).not.toHaveBeenCalled()
    expect(host.querySelector<HTMLElement>('.notebook-sheet')?.style.display).not.toBe('none')
    // 会话仍报告章节开着时，小本子保持翻开、还是第四章那一页，主操作仍只有一个。
    expect(host.querySelector('.notebook-sheet .hall-panel')).not.toBeNull()
    expect(host.querySelector('.notebook-mission')).toBeNull()
    expect(primaryCount()).toBe(1)
    host.querySelector('.notebook-sheet')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await nextTick()
    expect(host.querySelector<HTMLElement>('.notebook-sheet')?.style.display).toBe('none')
    expect(harness.closeHall).toHaveBeenCalledTimes(1)
    // 章节收走后，重新翻开就回到主线那一页。
    hooks.onHall?.({ ...emptyHallUI(), available: true })
    await nextTick()
    expect(host.querySelector('.hall-panel')).toBeNull()
    host.querySelector<HTMLButtonElement>('.notebook-tab')!.click(); await nextTick()
    expect(host.querySelector('.notebook-mission')).not.toBeNull()
  })

  it('伙伴工作时查看楼层不会取消工作，也不会多出主操作', async () => {
    const { host, hooks } = await mountGame()
    harness.lookDown.mockClear(); harness.cancelAction.mockClear()
    hooks.onWork?.({ worker: 'xiaoquan', name: '小泉', title: '接水管', phase: 'working' })
    await nextTick()
    expect(host.querySelector('.work-status')).not.toBeNull()
    expect(host.querySelector<HTMLElement>('.notebook-sheet')?.style.display).toBe('none')
    // 楼层条常驻右侧，工作时不用翻开本子就能换层。
    host.querySelector<HTMLButtonElement>('.depth-nav .water')!.click(); await nextTick()
    expect(harness.lookDown).toHaveBeenCalledTimes(1)
    expect(harness.cancelAction).not.toHaveBeenCalled()
    expect(host.querySelector<HTMLElement>('.notebook-sheet')?.style.display).toBe('none')
    expect(host.querySelector('.work-status')).not.toBeNull()
    expect(host.querySelectorAll('.stage [data-primary-action]')).toHaveLength(0)
  })

  it('未开放楼层点按给原有原因提示，不进入章节；开放后同一入口生效', async () => {
    const { host, hooks } = await mountGame()
    harness.openHall.mockClear()
    host.querySelector<HTMLButtonElement>('.depth-nav .deeper-toggle')!.click(); await nextTick()
    host.querySelector<HTMLButtonElement>('.depth-nav .hall')!.click(); await nextTick()
    expect(host.querySelector('.toast')?.textContent).toContain('三层电梯')
    expect(harness.openHall).not.toHaveBeenCalled()
    hooks.onHall?.({ ...emptyHallUI(), available: true, active: false }); await nextTick()
    host.querySelector<HTMLButtonElement>('.depth-nav .hall')!.click()
    expect(harness.openHall).toHaveBeenCalledTimes(1)
  })

  it('收合小本子不调用任何世界/镜头操作；重新展开后主线随世界状态更新', async () => {
    const { host, hooks } = await mountGame()
    harness.lookDown.mockClear(); harness.centerOnHome.mockClear(); harness.showOverview.mockClear(); harness.cancelAction.mockClear()
    host.querySelector<HTMLButtonElement>('.notebook-close')!.click(); await nextTick()
    expect(harness.lookDown).not.toHaveBeenCalled(); expect(harness.centerOnHome).not.toHaveBeenCalled()
    expect(harness.cancelAction).not.toHaveBeenCalled(); expect(harness.showOverview).not.toHaveBeenCalled()
    host.querySelector<HTMLButtonElement>('.notebook-tab')!.click(); await nextTick()
    expect(host.querySelector('.notebook-mission')).not.toBeNull()
    hooks.onProgress({ title: '收好能源石', speech: '点一下石头。', outcome: '拿上它。', done: 1, total: 4, finished: false,
      action: { id: 'focus', label: '看看能源石' }, relics: { found: 0, total: 3 } })
    await nextTick()
    expect(host.querySelector('.notebook-mission')?.textContent).toContain('收好能源石')
    expect(host.querySelector('.notebook-primary')?.textContent).toBe('看看能源石')
  })

  it('帮助展开时第一次 Esc 只收帮助，第二次 Esc 收小本子并把焦点还给入口', async () => {
    const { host } = await mountGame()
    const help = host.querySelector<HTMLButtonElement>('.guide .help')!
    help.click(); await nextTick()
    expect(host.querySelector('.guide .details')).not.toBeNull()
    help.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await nextTick(); await nextTick()
    expect(host.querySelector('.guide .details')).toBeNull()
    expect(host.querySelector<HTMLElement>('.notebook-sheet')?.style.display).not.toBe('none')
    expect(document.activeElement).toBe(host.querySelector('.guide .help'))
    host.querySelector<HTMLButtonElement>('.guide .help')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await nextTick(); await nextTick(); await nextTick()
    expect(host.querySelector<HTMLElement>('.notebook-sheet')?.style.display).toBe('none')
    expect(document.activeElement).toBe(host.querySelector('.notebook-tab'))
  })

  it('帮助未展开时，焦点在主按钮上按 Esc 直接收起小本子', async () => {
    const { host } = await mountGame()
    const primary = host.querySelector<HTMLButtonElement>('.notebook-primary')!
    primary.focus()
    primary.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await nextTick(); await nextTick(); await nextTick()
    expect(host.querySelector<HTMLElement>('.notebook-sheet')?.style.display).toBe('none')
    expect(document.activeElement).toBe(host.querySelector('.notebook-tab'))
  })

  it('楼层条在小本子外，按 Esc 不会收起小本子', async () => {
    const { host } = await mountGame()
    const water = host.querySelector<HTMLButtonElement>('.depth-nav .water')!
    water.focus()
    water.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await nextTick(); await nextTick(); await nextTick()
    expect(host.querySelector<HTMLElement>('.notebook-sheet')?.style.display).not.toBe('none')
    expect(host.querySelectorAll('.stage [data-primary-action]')).toHaveLength(1)
  })

  it('独立使用的帮助面板保留原 Esc 行为，并停止继续冒泡', async () => {
    const outer = vi.fn()
    const host = document.createElement('div'); document.body.append(host)
    app = createApp({ render: () => h('div', { onKeydown: outer }, [h(GuidePanel, { title: '给伙伴留床', done: 3, total: 4, finished: false })]) })
    app.mount(host); await nextTick()
    const help = host.querySelector<HTMLButtonElement>('.help')!
    help.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await nextTick()
    expect(host.querySelector('.details')).toBeNull()
    expect(document.activeElement).toBe(help)
    expect(outer).not.toHaveBeenCalled()
    help.click(); await nextTick()
    expect(host.querySelector('.details')).not.toBeNull()
    help.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await nextTick()
    expect(host.querySelector('.details')).toBeNull()
    expect(outer).not.toHaveBeenCalled()
  })

  it('窄屏默认收起小本子，入口仍然可打开', async () => {
    const original = window.innerWidth
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 390 })
    try {
      const { host } = await mountGame()
      expect(host.querySelector<HTMLElement>('.notebook-sheet')?.style.display).toBe('none')
      host.querySelector<HTMLButtonElement>('.notebook-tab')!.click(); await nextTick()
      expect(host.querySelector<HTMLElement>('.notebook-sheet')?.style.display).not.toBe('none')
    } finally {
      Object.defineProperty(window, 'innerWidth', { configurable: true, value: original })
    }
  })
})
