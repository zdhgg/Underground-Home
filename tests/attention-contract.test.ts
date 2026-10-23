// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createApp, nextTick, type App } from 'vue'
import Game from '../src/App.vue'
import { gameAudio, SOUND_SETTINGS_KEY } from '../src/render/gameAudio'
import type { GameSession, SessionHooks, SessionProgress } from '../src/app/session'
import type { RoomUI } from '../src/app/roomEditor'
import { emptySiteUI } from '../src/app/siteEditor'
import { emptyFacilityUI, type FacilityUI } from '../src/app/facilityPanel'
import type { PartnerConversation } from '../src/core/partnerInteractions'

// 只替换世界/渲染会话入口。测试真实 App 和真实面板，防止各组件单测通过却同时出现在舞台。
const harness = vi.hoisted(() => ({ hooks: null as SessionHooks | null, feed: vi.fn(), facilityPrimary: vi.fn() }))
vi.mock('../src/app/session', () => ({
  createGameSession: async (_host: HTMLElement, hooks: SessionHooks): Promise<Partial<GameSession>> => {
    harness.hooks = hooks
    return {
      titleSave: () => ({ status: 'none' }), startNewGame: async () => {},
      startOpening: () => hooks.onOpening?.({ active: false, caption: '' }),
      enableOpeningSound: () => {}, setInputBlocked: () => {}, destroy: () => {},
      feed: harness.feed, facilityPrimary: harness.facilityPrimary,
    }
  },
}))

let app: App | undefined
afterEach(() => { app?.unmount(); app = undefined; harness.hooks = null; document.body.innerHTML = ''; localStorage.clear() })
async function mountGame() {
  const host = document.createElement('div'); document.body.append(host)
  app = createApp(Game); app.mount(host)
  await Promise.resolve(); await nextTick()
  host.querySelector<HTMLButtonElement>('.start-button')!.click()
  await Promise.resolve(); await nextTick()
  expect(host.querySelector('.start-screen')).toBeNull()
  return { host, stage: host.querySelector<HTMLElement>('.stage')!, hooks: harness.hooks! }
}
function assertAttention(stage: HTMLElement, expected: string | null) {
  const panels = stage.querySelectorAll('[data-attention-panel]')
  expect(panels.length, '舞台只能有一个主要情境面板').toBeLessThanOrEqual(1)
  expect(panels[0]?.getAttribute('data-attention-panel') ?? null).toBe(expected)
  // 包括禁用的按钮：不能让第二个主操作以灰态继续占据主要关注区。
  const primary = stage.querySelectorAll('[data-primary-action]')
  expect(primary.length, '舞台只能有一个主要推进按钮').toBeLessThanOrEqual(1)
  if (expected === 'guide' || expected === 'conversation' || expected === 'site' || expected === 'facility') expect(primary).toHaveLength(1)
}
const room = (active: boolean): RoomUI => ({ active, available: true, kind: 'home', width: 3, minWidth: 3, selectedId: null,
  placed: false, valid: true, dirty: true, message: '当前房间', detail: '', construction: false, completed: false,
  action: '放下蓝图', left: 0, busy: false, items: [],
})
const conversation: PartnerConversation = { partnerId: 'adeng', name: '阿灯', species: '萤火虫', verb: '照',
  lines: ['我是阿灯！', '一起准备小窝吧？'], upgrade: null, action: { id: 'prepare-nest', label: '去准备小窝' },
}
const nest = () => ({ ...emptySiteUI(), active: true, selected: 'first-nest', name: '两人小窝', canBuild: true })
const facilityState = (over: Partial<FacilityUI> = {}): FacilityUI => ({
  active: true, id: 'spring-garden', title: '泉边小菜园', icon: '🌱',
  slots: [{ stage: 0 }, { stage: 3 }], summary: '熟了 1 槽 · 共 2 槽菜',
  primary: { kind: 'harvest', label: '叫小满来收菜', x: 30, y: 21 },
  hint: '点一下，小满走过去收。', canPlant: true, ...over,
})

describe('后续内容必须遵守的单一主要关注对象契约', () => {
  it('声音开关是安静的常驻辅助操作；切换不会打断发现、对话或施工，也不会增加主面板', async () => {
    const { host, stage, hooks } = await mountGame()
    const button = host.querySelector<HTMLButtonElement>('.sound-toggle')!
    expect(button.hasAttribute('data-primary-action')).toBe(false)
    hooks.onDiscovery?.(true); await nextTick()
    button.click(); await nextTick()
    expect(button.getAttribute('aria-pressed')).toBe('false')
    expect(button.getAttribute('aria-label')).toBe('开启声音')
    assertAttention(stage, 'discovery')
    hooks.onDiscovery?.(false); hooks.onPartnerConversation?.(conversation); await nextTick()
    button.click(); await nextTick(); assertAttention(stage, 'conversation')
    hooks.onPartnerConversation?.(null); hooks.onSites?.({ ...nest(), working: true }); await nextTick()
    button.click(); await nextTick(); assertAttention(stage, 'construction')
    expect(JSON.parse(localStorage.getItem(SOUND_SETTINGS_KEY)!)).toEqual({ version: 1, muted: true })
  })

  it('已保存静音时进入游戏仍静音，且当前引导与主操作完整保留', async () => {
    gameAudio.setMuted(true)
    const { host, stage } = await mountGame()
    expect(host.querySelector('.sound-toggle')?.getAttribute('aria-pressed')).toBe('false')
    assertAttention(stage, 'guide')
  })

  it('设施面板只显示当前设施和一个主要操作；让位与回位和引导面板一致', async () => {
    const { host, stage, hooks } = await mountGame()
    hooks.onFacility?.(facilityState()); await nextTick()
    assertAttention(stage, 'facility')
    expect(stage.querySelectorAll('.facility-tools .slots span')).toHaveLength(2)
    expect(stage.querySelector('[data-primary-action]')!.textContent).toBe('叫小满来收菜')
    expect(stage.querySelector('.build-tools')).toBeNull()
    host.querySelector<HTMLButtonElement>('[data-primary-action]')!.click(); await nextTick()
    expect(harness.facilityPrimary).toHaveBeenCalledTimes(1)
    // 对话打开时设施面板让位；对话关闭后回到设施面板，最后关面板回到引导。
    hooks.onPartnerConversation?.(conversation); await nextTick()
    assertAttention(stage, 'conversation')
    hooks.onPartnerConversation?.(null); await nextTick()
    assertAttention(stage, 'facility')
    hooks.onFacility?.(emptyFacilityUI()); await nextTick()
    assertAttention(stage, 'guide')
  })

  it('储物架面板同样只占一个主面板和一个主要操作', async () => {
    const { host, stage, hooks } = await mountGame()
    hooks.onFacility?.(facilityState({
      id: 'storage-shelf', title: '储物架', icon: '📦', slots: [],
      summary: '石料 3 · 旧木料 2 · 旧物 1/5',
      primary: { kind: 'find-relic', label: '找找没挖到的旧物' },
      hint: '架子上摆着旧住户留下的东西。', canPlant: false,
    })); await nextTick()
    assertAttention(stage, 'facility')
    expect(stage.querySelector('[data-primary-action]')!.textContent).toBe('找找没挖到的旧物')
    host.querySelector<HTMLButtonElement>('[data-primary-action]')!.click(); await nextTick()
    expect(harness.facilityPrimary).toHaveBeenCalledTimes(1)
    hooks.onFacility?.(emptyFacilityUI()); await nextTick()
    assertAttention(stage, 'guide')
  })

  it('第二层章末：第一顿饭是引导主操作；章末后主操作轮换为做一顿饭，不新增面板', async () => {    const { host, stage, hooks } = await mountGame()
    const progress = (over: Partial<SessionProgress>): SessionProgress => ({
      title: '请大家吃第一顿饭', speech: '灶台和餐桌都好啦！', outcome: '第一顿饭吃完，第二层就完整啦。',
      done: 11, total: 12, finished: false, relics: { found: 3, total: 3 }, ...over,
    })
    hooks.onProgress?.(progress({ action: { id: 'meal', label: '请大家吃第一顿饭' } }))
    await nextTick(); assertAttention(stage, 'guide')
    expect(stage.querySelector('[data-primary-action]')!.textContent).toBe('请大家吃第一顿饭')
    host.querySelector<HTMLButtonElement>('[data-primary-action]')!.click(); await nextTick()
    expect(harness.feed).toHaveBeenCalledTimes(1)
    // 章末完成后：只要灶台餐桌还在，主操作轮换为「做一顿饭」，仍是唯一的引导面板。
    hooks.onProgress?.(progress({
      title: '家越住越大！', speech: '家里有水、有床、有新鲜菜，第一顿饭也吃上啦。', outcome: '',
      done: 12, total: 12, finished: true, action: { id: 'meal', label: '做一顿饭' },
    }))
    await nextTick(); assertAttention(stage, 'guide')
    expect(stage.querySelector('[data-primary-action]')!.textContent).toBe('做一顿饭')
    host.querySelector<HTMLButtonElement>('[data-primary-action]')!.click(); await nextTick()
    expect(harness.feed).toHaveBeenCalledTimes(2)
  })

  it('背景音乐随游戏状态启停，切层和伙伴对话不增加面板或推进操作', async () => {
    const { host, stage, hooks } = await mountGame()
    hooks.onView?.({ layer: 'water', overview: false }); await nextTick()
    assertAttention(stage, 'guide')
    hooks.onPartnerConversation?.(conversation); await nextTick()
    assertAttention(stage, 'conversation')
    hooks.onPartnerConversation?.(null); hooks.onView?.({ layer: 'home', overview: true }); await nextTick()
    assertAttention(stage, null)
    host.querySelector<HTMLButtonElement>('.sound-toggle')!.click(); await nextTick()
    assertAttention(stage, null)
    hooks.onView?.({ layer: 'home', overview: false }); await nextTick()
    assertAttention(stage, 'guide')
  })

  it.each(['kitchen', 'dining', 'garden', 'lounge'] as const)('%s 美术详情仅显示当前设施和一个主要操作', async kind => {
    const { stage, hooks } = await mountGame()
    hooks.onRooms?.(room(false))
    hooks.onSites?.({ ...nest(), kind })
    await nextTick(); assertAttention(stage, 'site')
    expect(stage.querySelectorAll('.facility-preview')).toHaveLength(1)
    expect(stage.querySelector('.facility-preview')?.getAttribute('data-facility')).toBe(kind)
    expect(stage.querySelector('.guide')).toBeNull()
    expect(stage.querySelector('.site-tools nav')).toBeNull()
  })
  it('多个状态同时到达也只渲染一个主要面板；状态退出后逐个交接，不叠加', async () => {
    const { stage, hooks } = await mountGame()
    hooks.onRooms?.(room(true)); hooks.onSites?.(nest())
    hooks.onWork?.({ worker: 'adeng', name: '阿灯', title: '安灯', phase: 'walking' })
    hooks.onPartnerConversation?.(conversation); hooks.onDiscovery?.(true)
    await nextTick(); assertAttention(stage, 'site')
    expect(stage.querySelector('.build-tools')).toBeNull()
    hooks.onSites?.({ ...emptySiteUI(), active: false }); await nextTick(); assertAttention(stage, 'room')
    hooks.onRooms?.(room(false)); await nextTick(); assertAttention(stage, 'work')
    hooks.onWork?.(null); await nextTick(); assertAttention(stage, 'discovery')
    hooks.onDiscovery?.(false); await nextTick(); assertAttention(stage, 'conversation')
    expect(stage.querySelector('.build-tools')).toBeNull()
    hooks.onPartnerConversation?.(null); await nextTick(); assertAttention(stage, 'guide')
    expect(stage.querySelector('.build-tools')).not.toBeNull() // 辅助入口可以存在，不算第二个主操作。
  })

  it('发现、逐句对话、单间详情、施工、完工的主要操作不会同时出现', async () => {
    const { stage, hooks } = await mountGame()
    assertAttention(stage, 'guide')
    hooks.onDiscovery?.(true); await nextTick(); assertAttention(stage, 'discovery')
    hooks.onDiscovery?.(false); hooks.onPartnerConversation?.(conversation)
    await nextTick(); assertAttention(stage, 'conversation')
    stage.querySelector<HTMLButtonElement>('[data-primary-action]')!.click()
    await nextTick(); assertAttention(stage, 'conversation')
    expect(stage.querySelector('[data-primary-action]')!.textContent).toBe('去准备小窝')
    hooks.onPartnerConversation?.(null); hooks.onSites?.(nest())
    await nextTick(); assertAttention(stage, 'site')
    expect(stage.querySelector('.site-tools nav')).toBeNull()
    hooks.onSites?.({ ...nest(), working: true }); await nextTick(); assertAttention(stage, 'construction')
    hooks.onSites?.({ ...nest(), active: false, working: true }); await nextTick(); assertAttention(stage, null)
    hooks.onSites?.({ ...nest(), built: true, canBuild: false }); await nextTick(); assertAttention(stage, 'site')
    hooks.onSites?.({ ...emptySiteUI(), active: false }); await nextTick(); assertAttention(stage, 'guide')
  })

  it('物品栏打开后背景舞台不可交互，辅助导航不会形成第二个可交互主层', async () => {
    const { host, stage, hooks } = await mountGame()
    hooks.onRooms?.(room(false)); await nextTick()
    host.querySelector<HTMLButtonElement>('.inventory')!.click(); await nextTick()
    expect(host.querySelector('[role="dialog"][aria-modal="true"]')).not.toBeNull()
    expect(stage.closest('[inert]')).not.toBeNull()
    host.querySelector<HTMLButtonElement>('[aria-label="关闭物品栏"]')!.click(); await nextTick()
    expect(stage.closest('[inert]')).toBeNull()
    assertAttention(stage, 'guide')
  })
})
