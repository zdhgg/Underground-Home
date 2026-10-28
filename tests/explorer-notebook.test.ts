// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createApp, h, nextTick, reactive, type App } from 'vue'
import ExplorerNotebook from '../src/components/ExplorerNotebook.vue'
import GuidePanel from '../src/components/GuidePanel.vue'
import Game from '../src/App.vue'
import { cameraDepth, lookDepth, type DepthView } from '../src/render/camera'
import type { GameSession, SessionHooks } from '../src/app/session'
import { emptyHallUI } from '../src/app/hallChapter'

const view = (layer: DepthView['layer'] = 'home', over: Partial<DepthView> = {}): DepthView => ({ layer, overview: false, ...over })
const baseProps = () => reactive({
  open: true, guideVisible: true, docked: false, layerLabel: '第 1 层 · 暖窝', title: '找到发光的能源石',
  done: 0, total: 4, finished: false, primaryLabel: '看看能源石', primaryDisabled: false, view: view(),
})
type Listener = (...args: never[]) => void

let app: App | undefined
afterEach(() => { app?.unmount(); app = undefined; document.body.innerHTML = ''; localStorage.clear(); vi.restoreAllMocks() })

async function mountNotebook(props = baseProps(), listeners: Record<string, Listener> = {}) {
  const host = document.createElement('div'); document.body.append(host)
  app = createApp({ render: () => h(ExplorerNotebook, { ...props, ...listeners }) })
  app.mount(host); await nextTick()
  return { host, props }
}

describe('显示楼层只修正界面，不改变镜头规则', () => {
  it('窄屏把第一层小窝放在画面上方时，导航仍显示第一层', () => {
    const viewport = { width: 390, height: 750 }
    const camera = { x: 0, y: 150, zoom: 1 }
    expect(cameraDepth(camera, viewport).layer).toBe('water')
    expect(lookDepth(camera, viewport)).toMatchObject({ layer: 'water', displayLayer: 'home' })
  })

  it('镜头真正停在泉水层时显示第二层', () => {
    const viewport = { width: 390, height: 750 }
    expect(lookDepth({ x: 0, y: 315, zoom: 1 }, viewport)).toMatchObject({ layer: 'water', displayLayer: 'water' })
  })

  it('岩盖层与全景不伪造楼层', () => {
    // 视野上下都在晶纹硬岩盖里时，没有可选的“正在看”楼层。
    const seal = lookDepth({ x: 0, y: 682, zoom: 1 }, { width: 390, height: 300 })
    expect(seal.layer).toBe('deepSeal')
    expect(seal.displayLayer).toBeUndefined()
    const overview = lookDepth({ x: 0, y: 0, zoom: 0.4 }, { width: 390, height: 750 }, true)
    expect(overview.overview).toBe(true)
    expect(overview.displayLayer).toBeUndefined()
  })
})

describe('阿土的探索小本子', () => {
  it('同一个小本子里先显示主线，再显示已开放楼层；未开放楼层默认收起', async () => {
    const { host } = await mountNotebook()
    expect(host.querySelector('.notebook-mission')?.textContent).toContain('找到发光的能源石')
    expect(host.querySelector('.notebook-primary')?.textContent).toBe('看看能源石')
    const floors = host.querySelectorAll('.depth-nav .floors > button')
    expect(Array.from(floors).map(button => button.textContent?.trim())).toEqual(['1层 · 暖窝正在看', '2层 · 泉水'])
    expect(host.querySelector('.depth-nav .deeper-toggle')?.textContent).toContain('看看更深的地方')
    expect(host.querySelector('.depth-nav .floors .deeper-toggle')).toBeNull()
    expect(host.querySelector<HTMLElement>('.depth-nav .locked-floors')?.style.display).toBe('none')
    host.querySelector<HTMLButtonElement>('.depth-nav .deeper-toggle')!.click(); await nextTick()
    expect(host.querySelector<HTMLElement>('.depth-nav .locked-floors')?.style.display).not.toBe('none')
    expect(host.querySelector('.depth-nav .crystal')?.getAttribute('aria-disabled')).toBe('true')
    expect(host.querySelector('.depth-nav .overview')).not.toBeNull()
  })

  it('展开未开放楼层时只滚动楼层列表，把第一条锁定楼层带进可视区', async () => {
    const props = { ...baseProps(), crystalAvailable: true, hallAvailable: true, gardenAvailable: true, reservoirAvailable: true, ventilationAvailable: true }
    const { host } = await mountNotebook(props as ReturnType<typeof baseProps>)
    const list = host.querySelector<HTMLElement>('.depth-nav .floors')!
    const firstLocked = host.querySelector<HTMLElement>('.depth-nav .locked-floors button')!
    const rect = (top: number, height: number) => ({ top, bottom: top + height, height, left: 0, right: 100, width: 100, x: 0, y: top, toJSON: () => ({}) }) as DOMRect
    vi.spyOn(list, 'getBoundingClientRect').mockReturnValue(rect(100, 238))
    vi.spyOn(firstLocked, 'getBoundingClientRect').mockReturnValue(rect(500, 44))
    const intoView = vi.spyOn(Element.prototype, 'scrollIntoView')
    host.querySelector<HTMLButtonElement>('.depth-nav .deeper-toggle')!.click()
    await nextTick(); await nextTick()
    // 500 - 100 - 6：把第一条锁定楼层放到列表上方 6px 处
    expect(list.scrollTop).toBe(394)
    expect(500 - list.scrollTop).toBeGreaterThanOrEqual(106)
    expect(500 - list.scrollTop + 44).toBeLessThanOrEqual(338)
    expect(intoView).not.toHaveBeenCalled()
    expect(host.querySelector('.depth-nav .deeper-toggle')?.textContent).toContain('收起没开放的楼层')
    host.querySelector<HTMLButtonElement>('.depth-nav .deeper-toggle')!.click()
    await nextTick(); await nextTick()
    expect(list.scrollTop).toBe(0)
  })

  it('第一条锁定楼层已经完整可见时不额外滚动', async () => {
    const { host } = await mountNotebook()
    const list = host.querySelector<HTMLElement>('.depth-nav .floors')!
    const firstLocked = host.querySelector<HTMLElement>('.depth-nav .locked-floors button')!
    const rect = (top: number, height: number) => ({ top, bottom: top + height, height, left: 0, right: 100, width: 100, x: 0, y: top, toJSON: () => ({}) }) as DOMRect
    vi.spyOn(list, 'getBoundingClientRect').mockReturnValue(rect(100, 238))
    vi.spyOn(firstLocked, 'getBoundingClientRect').mockReturnValue(rect(150, 44))
    host.querySelector<HTMLButtonElement>('.depth-nav .deeper-toggle')!.click()
    await nextTick(); await nextTick()
    expect(list.scrollTop).toBe(0)
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

  it('主线楼层与正在查看的楼层分开显示，切换楼层复用原有事件', async () => {
    const props = baseProps()
    props.view = view('water', { displayLayer: 'water' })
    props.layerLabel = '第 4 层 · 暖光大厅'
    const water = vi.fn(), overview = vi.fn(), primary = vi.fn()
    const { host } = await mountNotebook(props, { onWater: water, onOverview: overview, onPrimary: primary })
    expect(host.querySelector('.guide .layer')?.textContent).toContain('第 4 层')
    expect(host.querySelector('.depth-nav .water')?.getAttribute('aria-current')).toBe('location')
    host.querySelector<HTMLButtonElement>('.depth-nav .water')!.click()
    expect(water).toHaveBeenCalledTimes(1)
    host.querySelector<HTMLButtonElement>('.depth-nav .overview')!.click()
    expect(overview).toHaveBeenCalledTimes(1)
    host.querySelector<HTMLButtonElement>('.notebook-primary')!.click()
    expect(primary).toHaveBeenCalledTimes(1)
  })
})

const harness = vi.hoisted(() => ({
  hooks: null as SessionHooks | null,
  lookDown: vi.fn(), centerOnHome: vi.fn(), showOverview: vi.fn(), openHall: vi.fn(), cancelAction: vi.fn(), findAtu: vi.fn(),
}))
vi.mock('../src/app/session', () => ({
  createGameSession: async (_host: HTMLElement, hooks: SessionHooks): Promise<Partial<GameSession>> => {
    harness.hooks = hooks
    return {
      titleSave: () => ({ status: 'none' }), startNewGame: async () => {},
      startOpening: () => hooks.onOpening?.({ active: false, caption: '' }),
      enableOpeningSound: () => {}, setInputBlocked: () => {}, destroy: () => {},
      lookDown: harness.lookDown, centerOnHome: harness.centerOnHome, showOverview: harness.showOverview,
      openHall: harness.openHall, cancelAction: harness.cancelAction, findAtu: harness.findAtu,
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
  it('九层导航不再占用顶部；主线与楼层都在同一个小本子里', async () => {
    const { host } = await mountGame()
    expect(host.querySelector('.top .depth-nav')).toBeNull()
    expect(host.querySelector('.top .depth-toggle')).toBeNull()
    expect(host.querySelector('.notebook .depth-nav')).not.toBeNull()
    expect(host.querySelector('.notebook-mission')?.textContent).toContain('找到发光的能源石')
  })

  it('章节面板打开时自动让位；仍可从小本子换楼层，且只有一个主要操作', async () => {
    const { host, hooks } = await mountGame()
    harness.openHall.mockClear(); harness.lookDown.mockClear(); harness.cancelAction.mockClear()
    hooks.onHall?.({ ...emptyHallUI(), available: true, active: true, title: '先把旧木梁托稳', label: '安装新支撑' })
    await nextTick()
    expect(host.querySelector('.hall-panel')).not.toBeNull()
    expect(host.querySelector('.notebook-mission')).toBeNull()
    expect(host.querySelector<HTMLElement>('.notebook-sheet')?.style.display).toBe('none')
    const primaryCount = () => host.querySelectorAll('.stage [data-primary-action]').length
    expect(primaryCount()).toBe(1)
    host.querySelector<HTMLButtonElement>('.notebook-tab')!.click(); await nextTick()
    expect(host.querySelector<HTMLElement>('.notebook-sheet')?.style.display).not.toBe('none')
    expect(host.querySelector('.notebook-mission')).toBeNull()
    expect(host.querySelector('.notebook-quiet')?.textContent).toContain('先专心做眼前这件事')
    expect(primaryCount()).toBe(1)
    host.querySelector<HTMLButtonElement>('.depth-nav .water')!.click(); await nextTick()
    expect(harness.lookDown).toHaveBeenCalledTimes(1)
    expect(harness.openHall).not.toHaveBeenCalled()
    expect(host.querySelector('.hall-panel')).not.toBeNull()
    // 选好楼层后小本子让出画面。
    expect(host.querySelector<HTMLElement>('.notebook-sheet')?.style.display).toBe('none')
    host.querySelector<HTMLButtonElement>('.notebook-tab')!.click(); await nextTick()
    host.querySelector('.notebook-sheet')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await nextTick()
    expect(host.querySelector<HTMLElement>('.notebook-sheet')?.style.display).toBe('none')
  })

  it('伙伴工作时查看楼层不会取消工作，也不会多出主操作', async () => {
    const { host, hooks } = await mountGame()
    harness.lookDown.mockClear(); harness.cancelAction.mockClear()
    hooks.onWork?.({ worker: 'xiaoquan', name: '小泉', title: '接水管', phase: 'working' })
    await nextTick()
    expect(host.querySelector('.work-status')).not.toBeNull()
    expect(host.querySelector<HTMLElement>('.notebook-sheet')?.style.display).toBe('none')
    host.querySelector<HTMLButtonElement>('.notebook-tab')!.click(); await nextTick()
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

  it('帮助未展开时，焦点在楼层按钮上按 Esc 也直接收起小本子', async () => {
    const { host } = await mountGame()
    const water = host.querySelector<HTMLButtonElement>('.depth-nav .water')!
    water.focus()
    water.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await nextTick(); await nextTick(); await nextTick()
    expect(host.querySelector<HTMLElement>('.notebook-sheet')?.style.display).toBe('none')
    expect(document.activeElement).toBe(host.querySelector('.notebook-tab'))
    expect(host.querySelectorAll('.stage [data-primary-action]')).toHaveLength(0)
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
