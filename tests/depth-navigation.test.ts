// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createApp, h, nextTick, reactive, type App } from 'vue'
import DepthNavigation from '../src/components/DepthNavigation.vue'
import { cameraDepth, deepFocusCamera, lookDepth, worldToScreen, type DepthView } from '../src/render/camera'

const view = (layer: DepthView['layer'] = 'home', over: Partial<DepthView> = {}): DepthView => ({ layer, overview: false, ...over })
const baseProps = () => reactive({ view: view() })
type Listener = (...args: never[]) => void

let app: App | undefined
afterEach(() => { app?.unmount(); app = undefined; document.body.innerHTML = ''; vi.restoreAllMocks() })

async function mountNav(props = baseProps(), listeners: Record<string, Listener> = {}) {
  const host = document.createElement('div'); document.body.append(host)
  app = createApp({ render: () => h(DepthNavigation, { ...props, ...listeners }) })
  app.mount(host); await nextTick()
  return { host, props }
}

describe('显示楼层只修正界面，不改变镜头规则', () => {
  it.each([{ width: 390, height: 733 }, { width: 1280, height: 690 }])('第三层现场在任务卡与常驻导航之外：$width', viewport => {
    const camera = deepFocusCamera(30.5 * 32, 32 * 32, viewport)
    const spot = worldToScreen(camera, 30.5 * 32, 32 * 32)
    if (viewport.width <= 720) {
      expect(spot.y + 64).toBeLessThan(viewport.height * .48)
      expect(spot.x + 48).toBeLessThan(viewport.width - 72)
    } else {
      expect(spot.x - 96).toBeGreaterThan(288)
      expect(spot.x + 96).toBeLessThan(viewport.width - 124)
    }
  })
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

describe('右侧常驻楼层条', () => {
  it('只列已开放楼层与全景；未开放楼层默认收起，展开后带锁与原因提示入口', async () => {
    const { host } = await mountNav()
    const floors = host.querySelectorAll('.depth-nav .floors > button')
    expect(Array.from(floors).map(button => `${button.querySelector('.floor-name')?.textContent}${button.querySelector('.here')?.textContent ?? ''}`)).toEqual(['1层 · 暖窝正在看', '2层 · 泉水'])
    expect(host.querySelector('.depth-nav .floor-short')?.textContent).toBe('1层')
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
    const { host } = await mountNav(props as ReturnType<typeof baseProps>)
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
    const { host } = await mountNav()
    const list = host.querySelector<HTMLElement>('.depth-nav .floors')!
    const firstLocked = host.querySelector<HTMLElement>('.depth-nav .locked-floors button')!
    const rect = (top: number, height: number) => ({ top, bottom: top + height, height, left: 0, right: 100, width: 100, x: 0, y: top, toJSON: () => ({}) }) as DOMRect
    vi.spyOn(list, 'getBoundingClientRect').mockReturnValue(rect(100, 238))
    vi.spyOn(firstLocked, 'getBoundingClientRect').mockReturnValue(rect(150, 44))
    host.querySelector<HTMLButtonElement>('.depth-nav .deeper-toggle')!.click()
    await nextTick(); await nextTick()
    expect(list.scrollTop).toBe(0)
  })

  it('正在看的楼层标 aria-current；点楼层与全景沿用原有事件，点锁只发原因', async () => {
    const water = vi.fn(), overview = vi.fn(), locked = vi.fn()
    const { host } = await mountNav(baseProps(), { onWater: water, onOverview: overview, onLocked: locked })
    expect(host.querySelector('.depth-nav .home')?.getAttribute('aria-current')).toBe('location')
    host.querySelector<HTMLButtonElement>('.depth-nav .water')!.click()
    expect(water).toHaveBeenCalledTimes(1)
    host.querySelector<HTMLButtonElement>('.depth-nav .overview')!.click()
    expect(overview).toHaveBeenCalledTimes(1)
    host.querySelector<HTMLButtonElement>('.depth-nav .deeper-toggle')!.click(); await nextTick()
    host.querySelector<HTMLButtonElement>('.depth-nav .crystal')!.click()
    expect(locked).toHaveBeenCalledTimes(1)
    expect(locked.mock.calls[0][0]).toContain('去第三层')
  })

  it('常驻导航保持安静：不抢主要面板和主要推进按钮的位置', async () => {
    const { host } = await mountNav()
    expect(host.querySelectorAll('[data-attention-panel]')).toHaveLength(0)
    expect(host.querySelectorAll('[data-primary-action]')).toHaveLength(0)
  })
})
