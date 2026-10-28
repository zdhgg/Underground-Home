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
import { emptyFinaleUI } from '../src/app/finaleChapter'
import { emptyRuinsUI } from '../src/app/ruinsChapter'
import { emptyVentilationUI } from '../src/app/ventilationChapter'
import { emptyReservoirUI } from '../src/app/reservoirChapter'
import { emptyGardenUI } from '../src/app/gardenChapter'
import { emptyHallUI } from '../src/app/hallChapter'
import { emptyDeepUI } from '../src/app/deepChapter'

// 只替换世界/渲染会话入口。测试真实 App 和真实面板，防止各组件单测通过却同时出现在舞台。
const harness = vi.hoisted(() => ({ hooks: null as SessionHooks | null, openDeep: vi.fn(), showOverview: vi.fn(), openHall: vi.fn(), openGarden: vi.fn(), openReservoir: vi.fn(), openVentilation: vi.fn(), openRuins: vi.fn(), openFinale: vi.fn(), cancelAction: vi.fn(), findPartner: vi.fn(), nestImprove: vi.fn(), nestInstall: vi.fn(), nestConfirm: vi.fn(), nestClose: vi.fn(), addMemory: vi.fn(), feed: vi.fn(), facilityPrimary: vi.fn(), facilityUpgrade: vi.fn(), gardenPrimary: vi.fn(), gardenVariety: vi.fn(), reservoirPrimary: vi.fn(), reservoirRoute: vi.fn(), finalePrimary:vi.fn(),finaleTheme:vi.fn(),finalePanorama:vi.fn(),ruinsPrimary:vi.fn(),ruinsMotif:vi.fn(),ruinsEdition:vi.fn(),ventilationPrimary:vi.fn(),ventilationMode:vi.fn(),ventilationVariety:vi.fn() }))
vi.mock('../src/app/session', () => ({
  createGameSession: async (_host: HTMLElement, hooks: SessionHooks): Promise<Partial<GameSession>> => {
    harness.hooks = hooks
    return {
      titleSave: () => ({ status: 'none' }), startNewGame: async () => {},
      startOpening: () => hooks.onOpening?.({ active: false, caption: '' }),
      enableOpeningSound: () => {}, setInputBlocked: () => {}, destroy: () => {},
      openNestWarmLamp: harness.nestImprove, confirmNestWarmLamp: harness.nestInstall, confirmNestMark: harness.nestConfirm, closeNestWelcome: harness.nestClose,
      addMemory: harness.addMemory, openDeep: harness.openDeep, lookCrystal: harness.openDeep, showOverview: harness.showOverview,
      openHall: harness.openHall, openGarden: harness.openGarden, openReservoir: harness.openReservoir, openVentilation: harness.openVentilation, openRuins: harness.openRuins, openFinale: harness.openFinale,
      cancelAction: harness.cancelAction, findPartner: harness.findPartner,
      finalePrimary:harness.finalePrimary,finaleTheme:harness.finaleTheme,finalePanorama:harness.finalePanorama,
      ruinsPrimary:harness.ruinsPrimary,ruinsMotif:harness.ruinsMotif,ruinsEdition:harness.ruinsEdition,
      ventilationPrimary:harness.ventilationPrimary,ventilationMode:harness.ventilationMode,ventilationVariety:harness.ventilationVariety,
      reservoirPrimary: harness.reservoirPrimary, reservoirRoute: harness.reservoirRoute, gardenPrimary: harness.gardenPrimary, gardenVariety: harness.gardenVariety,
      feed: harness.feed, facilityPrimary: harness.facilityPrimary, facilityUpgrade: harness.facilityUpgrade,
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
  it('多小窝改善入口 → 预览 → 工作 → 完成详情，仅一个主要关注对象；物品栏关闭接回工作', async () => {
    const { host, stage, hooks } = await mountGame()
    harness.nestImprove.mockClear(); harness.nestInstall.mockClear(); harness.cancelAction.mockClear()
    hooks.onRooms?.({ ...room(true), completed: true, nestImprovements: [{ id: 1, label: '第1间小窝 · 给小窝添盏灯', installed: false }, { id: 2, label: '第2间小窝 · 给小窝添盏灯', installed: false }], nestMarks: [{ id: 1, label: '小窝 · 星星' }] })
    await nextTick(); assertAttention(stage, 'room')
    Array.from(stage.querySelectorAll<HTMLButtonElement>('button')).find(b => b.textContent?.includes('第2间小窝'))!.click()
    expect(harness.nestImprove).toHaveBeenCalledWith(2)
    const state = { podId: 2, anchor: { x: 300, y: 200, width: 800, height: 600 }, speech: '', lampAvailable: true, lamp: { installed: false, problem: null } }
    hooks.onRooms?.(room(false)); hooks.onNestWelcome?.(state)
    await nextTick(); assertAttention(stage, 'nest-warm-lamp')
    expect(stage.querySelector('.lamp-preview')).not.toBeNull()
    stage.querySelector<HTMLButtonElement>('[data-primary-action]')!.click(); expect(harness.nestInstall).toHaveBeenCalled()
    hooks.onNestWelcome?.(null); hooks.onWork?.({ worker: 'adeng', name: '阿灯', title: '给小窝装暖光灯', phase: 'working', nestPodId: 2 })
    await nextTick(); assertAttention(stage, 'work')
    expect(stage.querySelector('.work-status.nest-work')).not.toBeNull()
    host.querySelector<HTMLButtonElement>('.inventory')!.click(); await nextTick()
    expect(host.querySelector('.app')?.hasAttribute('inert')).toBe(true)
    host.querySelector<HTMLButtonElement>('[aria-label="关闭物品栏"]')!.click(); await nextTick(); assertAttention(stage, 'work')
    expect(harness.cancelAction).not.toHaveBeenCalled()
    hooks.onWork?.(null); hooks.onNestWelcome?.({ ...state, lamp: { installed: true, problem: '暖光灯已经装好啦。' } })
    await nextTick(); assertAttention(stage, 'nest-warm-lamp')
    expect(stage.textContent).toContain('暖光灯已经装好啦。'); expect(stage.querySelector('[data-primary-action]')).toBeNull()
    hooks.onNestWelcome?.(null); await nextTick(); assertAttention(stage, 'guide')
  })

  it('独立睡眠舱从标记详情进入改善，缺部件保留明确原因与退出按钮', async () => {
    const { stage, hooks } = await mountGame()
    const state = { podId: 1, anchor: { x: 200, y: 200, width: 390, height: 700 }, speech: '小窝', lampAvailable: true }
    hooks.onNestWelcome?.(state); await nextTick(); assertAttention(stage, 'nest-welcome')
    Array.from(stage.querySelectorAll<HTMLButtonElement>('button')).find(b => b.textContent === '给小窝添盏灯')!.click()
    expect(harness.nestImprove).toHaveBeenCalledWith(1)
    hooks.onNestWelcome?.({ ...state, lamp: { installed: false, problem: '还需要1个工坊部件' } })
    await nextTick(); assertAttention(stage, 'nest-warm-lamp')
    expect(stage.querySelector<HTMLButtonElement>('[data-primary-action]')?.disabled).toBe(true)
    expect(stage.textContent).toContain('还需要1个工坊部件')
    expect(stage.textContent).toContain('先不装')
    hooks.onNestWelcome?.({ ...state, lampInstalled: true }); await nextTick(); assertAttention(stage, 'nest-welcome')
    expect(stage.textContent).toContain('暖光灯已经装好啦。'); expect(stage.textContent).not.toContain('给小窝添盏灯')
  })

  it.each(['home', 'water', 'crystal', 'hall', 'garden', 'reservoir', 'ventilation', 'ruins', 'finale'] as const)('%s 普通游玩统一显示主线，帮助展开不产生第二个推进动作', async layer => {
    const { host, stage, hooks } = await mountGame()
    hooks.onView?.({ layer, overview: false })
    await nextTick(); assertAttention(stage, 'guide')
    host.querySelector<HTMLButtonElement>('.guide .help')!.click()
    await nextTick(); assertAttention(stage, 'guide')
    expect(stage.querySelector('.guide .details')).not.toBeNull()
    hooks.onView?.({ layer, overview: true })
    await nextTick(); assertAttention(stage, null)
  })

  it('锁定楼层点按后显示原有提示，导航不派发；开放后沿用同一章节入口', async () => {
    const { host, stage, hooks } = await mountGame()
    harness.openDeep.mockClear()
    const crystal = host.querySelector<HTMLButtonElement>('.depth-nav .crystal')!
    expect(crystal.disabled).toBe(false)
    expect(crystal.getAttribute('aria-disabled')).toBe('true')
    crystal.click(); await nextTick()
    expect(host.querySelector('.toast')?.textContent).toContain('第一顿围坐饭')
    expect(harness.openDeep).not.toHaveBeenCalled()
    assertAttention(stage, 'guide')
    hooks.onDeep?.({ ...emptyDeepUI(), available: true })
    await nextTick(); crystal.click()
    expect(harness.openDeep).toHaveBeenCalledTimes(1)
    const toggle = host.querySelector<HTMLButtonElement>('.depth-toggle')!
    toggle.click(); await nextTick()
    expect(toggle.getAttribute('aria-expanded')).toBe('true')
    toggle.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await nextTick(); expect(toggle.getAttribute('aria-expanded')).toBe('false')
    hooks.onView?.({ layer: 'reservoirSeal', overview: false }); await nextTick()
    expect(toggle.textContent).toContain('渗水岩盖')
  })

  it('共餐演出暂时收起普通引导，演出结束后接回正确目标', async () => {
    const { stage, hooks } = await mountGame()
    hooks.onFarm?.({ canSupplyWater: false, supplying: false, unlocked: true, planterCount: 1, ripe: 0, food: 1, harvested: true, canSendPower: false, powering: false, powerDown: true, kitchen: true, dining: true, mealReady: true, mealActive: true })
    await nextTick(); assertAttention(stage, null)
    hooks.onFarm?.({ canSupplyWater: false, supplying: false, unlocked: true, planterCount: 1, ripe: 0, food: 1, harvested: true, canSendPower: false, powering: false, powerDown: true, kitchen: true, dining: true, mealReady: true, mealActive: false })
    await nextTick(); assertAttention(stage, 'guide')
  })

  it.each(['deep', 'hall', 'garden', 'reservoir', 'ventilation', 'ruins', 'finale'] as const)('%s 全局行动打开对应章节入口', async id => {
    const { stage, hooks } = await mountGame()
    const open = { deep: harness.openDeep, hall: harness.openHall, garden: harness.openGarden, reservoir: harness.openReservoir, ventilation: harness.openVentilation, ruins: harness.openRuins, finale: harness.openFinale }[id]
    open.mockClear()
    hooks.onProgress({ title: '看看下一层的新线索', speech: '伙伴在等你。', outcome: '', done: 0, total: 1, finished: false, action: { id, label: '带我去看看' }, relics: { found: 0, total: 3 } })
    await nextTick(); assertAttention(stage, 'guide')
    stage.querySelector<HTMLButtonElement>('[data-primary-action]')!.click()
    expect(open).toHaveBeenCalledTimes(1)
  })

  it('工作阶段、查看与停止交接清楚，关闭信息界面后工作卡仍在', async () => {
    const { host, stage, hooks } = await mountGame()
    for (const phase of ['walking', 'working', 'returning'] as const) {
      hooks.onWork?.({ worker: 'xiaoquan', name: '小泉', title: '接水管', phase })
      await nextTick(); assertAttention(stage, 'work')
      expect(stage.querySelector('.work-status')?.textContent).toContain('小泉 · 接水管')
    }
    stage.querySelector<HTMLButtonElement>('.work-status button')!.click()
    expect(harness.findPartner).toHaveBeenCalledWith('xiaoquan')
    host.querySelector<HTMLButtonElement>('.inventory')!.click(); await nextTick()
    host.querySelector<HTMLButtonElement>('[aria-label="关闭物品栏"]')!.click(); await nextTick()
    assertAttention(stage, 'work')
    stage.querySelectorAll<HTMLButtonElement>('.work-status button')[1].click()
    expect(harness.cancelAction).toHaveBeenCalled()
    hooks.onWork?.(null); await nextTick(); assertAttention(stage, 'guide')
  })
  it('记忆匣打开后让位给唯一的记录面板和保存动作，关闭后恢复舞台', async () => {
    const { host, stage, hooks } = await mountGame()
    host.querySelector<HTMLButtonElement>('.memory-toggle')!.click(); await nextTick()
    expect(host.querySelector('.app')?.hasAttribute('inert')).toBe(true)
    const dialog = host.querySelector<HTMLElement>('[data-attention-panel="memory"]')!
    expect(dialog).not.toBeNull()
    expect(dialog.querySelectorAll('[data-primary-action]')).toHaveLength(1)
    expect(stage.closest('[inert]')).not.toBeNull()
    dialog.querySelector<HTMLInputElement>('input[placeholder="例如：和爸爸一起种薄荷"]')!.value = '一起种薄荷'
    dialog.querySelector<HTMLInputElement>('input[placeholder="例如：和爸爸一起种薄荷"]')!.dispatchEvent(new Event('input'))
    dialog.querySelector<HTMLTextAreaElement>('textarea')!.value = '今天和爸爸一起给花盆浇水。'
    dialog.querySelector<HTMLTextAreaElement>('textarea')!.dispatchEvent(new Event('input'))
    dialog.querySelector<HTMLButtonElement>('[data-primary-action]')!.click()
    expect(harness.addMemory).toHaveBeenCalledWith(expect.objectContaining({ kind: 'note', title: '一起种薄荷', body: '今天和爸爸一起给花盆浇水。' }))
    dialog.querySelector<HTMLButtonElement>('.close')!.click(); await nextTick()
    expect(host.querySelector('[data-attention-panel="memory"]')).toBeNull()
    expect(host.querySelector('.app')?.hasAttribute('inert')).toBe(false)
    assertAttention(stage, 'guide')
    hooks.onMemories?.([{ id: 1, kind: 'note', title: '一起种薄荷', body: '今天一起浇水。', createdAt: '2026-10-27T03:00:00.000Z' }])
    hooks.onMemoryRequested?.(); await nextTick()
    expect(host.querySelector('[data-attention-panel="memory-detail"]')).not.toBeNull()
    expect(host.querySelectorAll('[data-attention-panel="memory-detail"] [data-primary-action]')).toHaveLength(1)
    host.querySelector<HTMLButtonElement>('[aria-label="关闭这段记忆"]')!.click(); await nextTick()
  })
  it('小窝入住后从建造面板交接到标记选择，确认或离开后回到当前目标', async () => {
    const { stage, hooks } = await mountGame()
    hooks.onSites?.(nest()); await nextTick(); assertAttention(stage, 'site')
    hooks.onSites?.(emptySiteUI())
    hooks.onNestWelcome?.({ podId: 1, anchor: { x: 300, y: 400, width: 800, height: 600 }, speech: '心心，你帮我们安好了小窝！' })
    await nextTick(); assertAttention(stage, 'nest-welcome')
    expect(stage.querySelectorAll('.choices button')).toHaveLength(3)
    stage.querySelector<HTMLButtonElement>('.choices button:nth-child(2)')!.click()
    await nextTick()
    expect(stage.querySelector('.choices button:nth-child(2)')?.getAttribute('aria-pressed')).toBe('true')
    stage.querySelector<HTMLButtonElement>('[data-primary-action]')!.click()
    expect(harness.nestConfirm).toHaveBeenCalledWith('leaf')
    hooks.onNestWelcome?.(null); await nextTick(); assertAttention(stage, 'guide')
    hooks.onNestWelcome?.({ podId: 1, anchor: { x: 300, y: 400, width: 800, height: 600 }, speech: '选个标记' })
    await nextTick(); stage.querySelector<HTMLButtonElement>('.later')!.click(); expect(harness.nestClose).toHaveBeenCalled()
    hooks.onNestWelcome?.(null); await nextTick(); assertAttention(stage, 'guide')
  })
  it('拾取蘑菇只给短暂反馈，随后继续当前目标，进入建设时只突出建设面板', async () => {
    const { stage, hooks } = await mountGame()
    hooks.onView?.({ layer: 'water', overview: false })
    await nextTick(); assertAttention(stage, 'guide')
    const action = stage.querySelector('[data-primary-action]')!.textContent
    hooks.onMilestone?.({ emoji: '🍄', title: '发现发光蘑菇！', detail: '已经采好 · 泉水边又空出来啦' })
    hooks.onMessage('🍄 采好发光蘑菇啦！空出的地方可以继续布置。')
    await nextTick(); assertAttention(stage, 'guide')
    expect(stage.querySelector('[data-primary-action]')!.textContent).toBe(action)
    expect(stage.querySelector('.milestone')?.getAttribute('role')).toBe('status')
    hooks.onSites?.(nest()); await nextTick(); assertAttention(stage, 'site')
    hooks.onSites?.({ ...emptySiteUI(), active: false })
    await nextTick(); assertAttention(stage, 'guide')
  })
  it('终章检查、建设、备餐、布置确认、九人赴席、九页回望和庆典只有一个当前面板',async()=>{
    const {stage,host,hooks}=await mountGame(),f={...emptyFinaleUI(),available:true,active:true,title:'岩缝里的暖光',speaker:'阿岩',label:'看看暖晶接缝'}
    hooks.onFinale?.(f);await nextTick();assertAttention(stage,'finale');hooks.onMilestone?.({emoji:'☼',title:'天然暖晶',detail:'温柔的金色'});await nextTick();expect(stage.querySelector('.milestone')).toBeNull()
    hooks.onFinale?.({...f,warmthIntro:true,title:'原来是天然暖晶',label:'把暖晶留在原处，继续建家'});await nextTick();assertAttention(stage,'finale-discovery');expect(stage.querySelectorAll('.speech')).toHaveLength(1)
    hooks.onFinale?.({...f,placing:'table',candidate:25,valid:false});await nextTick();assertAttention(stage,'finale');expect(stage.querySelector<HTMLButtonElement>('[data-primary-action]')!.disabled).toBe(true)
    hooks.onFinale?.({...f,placing:'table',candidate:28,valid:true});await nextTick();assertAttention(stage,'finale')
    hooks.onFinale?.({...f,entered:true,foodReady:true,waterReady:false,label:'请团团送来清水'});await nextTick();assertAttention(stage,'finale');expect(stage.querySelectorAll('.preparations .ready')).toHaveLength(1)
    hooks.onFinale?.({...f,entered:true,themeChoice:'lantern',label:'确认布置暖屋日'});await nextTick();assertAttention(stage,'finale');expect(stage.querySelectorAll('.edition-choices button')).toHaveLength(2);expect(stage.querySelectorAll('.edition-choices [data-primary-action]')).toHaveLength(0);stage.querySelector<HTMLButtonElement>('.edition-choices button:last-child')!.click();expect(harness.finaleTheme).toHaveBeenCalledWith('garden')
    stage.querySelector<HTMLButtonElement>('[data-primary-action]')!.click();expect(harness.finalePrimary).toHaveBeenCalled()
    hooks.onFinale?.({...f,busy:true,guests:8});await nextTick();assertAttention(stage,'finale-work');expect(stage.querySelector('[data-primary-action]')).toBeNull();expect(stage.querySelector('.guest-count')?.textContent).toContain('8 / 9')
    for(let i=0;i<9;i++){hooks.onFinale?.({...f,memoryIndex:i,label:i===8?'把这页留进相册':'看看下一层回忆'});await nextTick();assertAttention(stage,'finale-memory');expect(stage.querySelectorAll('.speech')).toHaveLength(1);expect(stage.querySelector('.memory-count')?.textContent).toContain(`${i+1} / 9`)}
    hooks.onFinale?.({...f,completed:true,celebrating:true,done:20});await nextTick();assertAttention(stage,'finale-celebration');expect(stage.querySelector('[data-primary-action]')?.textContent).toContain(f.label)
    hooks.onFinale?.({...f,entered:true,lift:true,completed:true,done:20});await nextTick();assertAttention(stage,'finale');expect(stage.querySelectorAll('.ride button')).toHaveLength(9);expect(stage.querySelectorAll('.ride [data-primary-action]')).toHaveLength(0);stage.querySelector<HTMLButtonElement>('.revisit')!.click();expect(harness.finalePanorama).toHaveBeenCalled();expect(host.querySelector('.depth-nav .finale')?.hasAttribute('data-primary-action')).toBe(false)
    hooks.onFinale?.({...emptyFinaleUI(),available:true,completed:true});hooks.onView?.({layer:'finale',overview:false});await nextTick();assertAttention(stage,'guide')
  })
  it('终章在旧层、伙伴对话与全景之间交接，回望只占当前面板',async()=>{
    const {stage,hooks}=await mountGame(),f={...emptyFinaleUI(),available:true,active:true,entered:true,label:'请小满送来食物'}
    hooks.onFinale?.(f);hooks.onRuins?.({...emptyRuinsUI(),available:true,active:true});await nextTick();assertAttention(stage,'finale')
    hooks.onPartnerConversation?.(conversation);await nextTick();assertAttention(stage,'conversation');hooks.onPartnerConversation?.(null);hooks.onFacility?.(facilityState());await nextTick();assertAttention(stage,'facility')
    hooks.onFacility?.(emptyFacilityUI());hooks.onFinale?.({...f,memoryIndex:0});await nextTick();assertAttention(stage,'finale-memory');hooks.onView?.({layer:'hall',overview:true});await nextTick();assertAttention(stage,null)
    hooks.onFinale?.({...emptyFinaleUI(),available:true});hooks.onRuins?.(emptyRuinsUI());hooks.onView?.({layer:'water',overview:false});await nextTick();assertAttention(stage,'guide')
  })

  it('第八章入口、选址、三段故事、今天一页、工作和庆典逐个交接',async()=>{
    const {stage,host,hooks}=await mountGame(),r={...emptyRuinsUI(),available:true,active:true,title:'旧拱后面的回声',speaker:'铃铃',label:'看看旧拱纹'}
    hooks.onRuins?.(r);await nextTick();assertAttention(stage,'ruins');hooks.onMilestone?.({emoji:'▥',title:'旧岩画',detail:'旧故事'});await nextTick();expect(stage.querySelector('.milestone')).toBeNull()
    hooks.onRuins?.({...r,entered:true,placing:'mosaic',candidate:25,valid:false});await nextTick();assertAttention(stage,'ruins');expect(stage.querySelector<HTMLButtonElement>('[data-primary-action]')!.disabled).toBe(true)
    hooks.onRuins?.({...r,entered:true,placing:'mosaic',candidate:28,valid:true});await nextTick();assertAttention(stage,'ruins')
    for(const motif of ['lamp','spring','tools']as const){hooks.onRuins?.({...r,entered:true,motif,label:'做这一段拓印'});await nextTick();assertAttention(stage,'ruins');expect(stage.querySelectorAll('.speech')).toHaveLength(1)}
    hooks.onRuins?.({...r,entered:true,editionChoice:'together',label:'确认添上这一页'});await nextTick();assertAttention(stage,'ruins');expect(stage.querySelectorAll('.edition-choices button')).toHaveLength(2);expect(stage.querySelectorAll('.edition-choices [data-primary-action]')).toHaveLength(0)
    stage.querySelector<HTMLButtonElement>('.edition-choices button:last-child')!.click();expect(harness.ruinsEdition).toHaveBeenCalledWith('journey');stage.querySelector<HTMLButtonElement>('[data-primary-action]')!.click();expect(harness.ruinsPrimary).toHaveBeenCalled()
    hooks.onRuins?.({...r,entered:true,lift:true,stories:[{id:'tools',name:'一起建造',revealed:true,rubbed:true,mounted:false}]});await nextTick();assertAttention(stage,'ruins');stage.querySelector<HTMLButtonElement>('.stories button')!.click();expect(harness.ruinsMotif).toHaveBeenCalledWith('tools');expect(stage.querySelectorAll('.ride button')).toHaveLength(8);expect(stage.querySelectorAll('.ride [data-primary-action]')).toHaveLength(0);expect(host.querySelector('.depth-nav .ruins')?.hasAttribute('data-primary-action')).toBe(false)
    hooks.onRuins?.({...r,busy:true});await nextTick();assertAttention(stage,'ruins-work');expect(stage.querySelector('[data-primary-action]')).toBeNull();hooks.onRuins?.({...r,completed:true,celebrating:true});await nextTick();assertAttention(stage,'ruins-celebration')
    hooks.onView?.({layer:'ruins',overview:true});await nextTick();assertAttention(stage,null);hooks.onRuins?.({...emptyRuinsUI(),available:true});hooks.onView?.({layer:'ruins',overview:false});await nextTick();assertAttention(stage,'guide')
    hooks.onFacility?.(facilityState());await nextTick();assertAttention(stage,'facility');hooks.onFacility?.(emptyFacilityUI());hooks.onPartnerConversation?.(conversation);await nextTick();assertAttention(stage,'conversation')
  })

  it('第七层入口、相遇、选址、风机确认、手作、送礼工作、庆典保持单一关注对象',async()=>{
    const {stage,hooks}=await mountGame(),v={...emptyVentilationUI(),available:true,active:true,title:'旧飘带',speaker:'阿岩',label:'看看风井'}
    hooks.onVentilation?.(v);await nextTick();assertAttention(stage,'ventilation')
    hooks.onVentilation?.({...v,entered:true,joined:true,title:'铃铃听见风啦',speaker:'铃铃',label:'一起建设'});await nextTick();assertAttention(stage,'ventilation')
    hooks.onMilestone?.({emoji:'〰',title:'新朋友',detail:'铃铃'});await nextTick();expect(stage.querySelector('.milestone')).toBeNull()
    hooks.onVentilation?.({...v,placing:'fan',candidate:25,valid:false});await nextTick();assertAttention(stage,'ventilation');expect(stage.querySelector<HTMLButtonElement>('[data-primary-action]')!.disabled).toBe(true)
    hooks.onVentilation?.({...v,placing:'fan',candidate:18,valid:true});await nextTick();assertAttention(stage,'ventilation')
    hooks.onVentilation?.({...v,joined:true,selected:'fan',connected:true,mode:'off',modeChoice:'home',label:'确认调节风机'});await nextTick();assertAttention(stage,'ventilation');expect(stage.querySelectorAll('.route-choices button')).toHaveLength(3);expect(stage.querySelectorAll('.route-choices [data-primary-action]')).toHaveLength(0)
    stage.querySelector<HTMLButtonElement>('.route-choices button:last-child')!.click();expect(harness.ventilationMode).toHaveBeenCalledWith('work')
    hooks.onVentilation?.({...v,joined:true,selected:'bench',mode:'work',label:'做一件小手作'});await nextTick();assertAttention(stage,'ventilation');stage.querySelector<HTMLButtonElement>('.quiet')!.click();expect(harness.ventilationVariety).toHaveBeenCalled()
    stage.querySelector<HTMLButtonElement>('[data-primary-action]')!.click();expect(harness.ventilationPrimary).toHaveBeenCalled()
    hooks.onVentilation?.({...v,joined:true,selected:'bench',readyCraft:'chime',label:'一起送到大厅'});await nextTick();assertAttention(stage,'ventilation');expect(stage.querySelector('.quiet')).toBeNull()
    hooks.onVentilation?.({...v,busy:true});await nextTick();assertAttention(stage,'ventilation-work');expect(stage.querySelector('[data-primary-action]')).toBeNull()
    hooks.onVentilation?.({...v,completed:true,celebrating:true});await nextTick();assertAttention(stage,'ventilation-celebration')
    hooks.onVentilation?.({...emptyVentilationUI(),available:true,entered:true});hooks.onView?.({layer:'ventilation',overview:false});await nextTick();assertAttention(stage,'guide')
  })
  it('第七层与老设施、伙伴对话、全景相互交接，七站电梯为安静辅助导航',async()=>{
    const {stage,host,hooks}=await mountGame(),v={...emptyVentilationUI(),available:true,active:true,entered:true,joined:true,lift:true,label:'一起听风'}
    hooks.onVentilation?.(v);await nextTick();assertAttention(stage,'ventilation');expect(stage.querySelectorAll('.ride button')).toHaveLength(7);expect(stage.querySelectorAll('.ride [data-primary-action]')).toHaveLength(0);expect(host.querySelector('.depth-nav .ventilation')?.hasAttribute('data-primary-action')).toBe(false)
    hooks.onPartnerConversation?.({...conversation,partnerId:'lingling',name:'铃铃',species:'蝙蝠',verb:'听风'});await nextTick();assertAttention(stage,'conversation')
    hooks.onPartnerConversation?.(null);hooks.onFacility?.(facilityState());await nextTick();assertAttention(stage,'facility')
    hooks.onFacility?.(emptyFacilityUI());hooks.onVentilation?.({...v,busy:true});await nextTick();assertAttention(stage,'ventilation-work')
    hooks.onView?.({layer:'ventilation',overview:true});await nextTick();assertAttention(stage,null)
    hooks.onVentilation?.({...emptyVentilationUI(),available:true});hooks.onView?.({layer:'water',overview:false});await nextTick();assertAttention(stage,'guide')
  })

  it('第六层检查、相遇、自由选址、水闸确认、送水施工与庆典只交接一个关注对象',async()=>{
    const {stage,hooks}=await mountGame()
    const r={...emptyReservoirUI(),available:true,active:true,title:'渗水岩缝',speaker:'阿岩',label:'检查岩缝'}
    hooks.onReservoir?.(r);await nextTick();assertAttention(stage,'reservoir')
    hooks.onReservoir?.({...r,entered:true,title:'认识团团',label:'打招呼'});await nextTick();assertAttention(stage,'reservoir')
    hooks.onMilestone?.({emoji:'💧',title:'团团加入',detail:'一起筑渠'});await nextTick();expect(stage.querySelector('.milestone')).toBeNull()
    hooks.onReservoir?.({...r,joined:true,placing:'basin',candidate:25,valid:false});await nextTick();assertAttention(stage,'reservoir');expect(stage.querySelector<HTMLButtonElement>('[data-primary-action]')!.disabled).toBe(true)
    hooks.onReservoir?.({...r,joined:true,placing:'basin',candidate:18,valid:true});await nextTick();assertAttention(stage,'reservoir')
    hooks.onReservoir?.({...r,joined:true,selected:'gate',connected:true,water:3,valve:'closed',label:'确认转动水闸'});await nextTick();assertAttention(stage,'reservoir')
    expect(stage.querySelectorAll('.water .full')).toHaveLength(3)
    expect(stage.querySelectorAll('.route-choices button')).toHaveLength(3);expect(stage.querySelectorAll('.route-choices [data-primary-action]')).toHaveLength(0)
    stage.querySelector<HTMLButtonElement>('.route-choices button:last-child')!.click();expect(harness.reservoirRoute).toHaveBeenCalledWith('hall')
    stage.querySelector<HTMLButtonElement>('[data-primary-action]')!.click();expect(harness.reservoirPrimary).toHaveBeenCalled()
    hooks.onReservoir?.({...r,busy:true});await nextTick();assertAttention(stage,'reservoir-work');expect(stage.querySelector('[data-primary-action]')).toBeNull()
    hooks.onReservoir?.({...r,completed:true,celebrating:true});await nextTick();assertAttention(stage,'reservoir-celebration')
    hooks.onReservoir?.({...emptyReservoirUI(),available:true,entered:true});hooks.onView?.({layer:'reservoir',overview:false});await nextTick();assertAttention(stage,'guide')
  })
  it('六层面板让位给旧设施和对话，六站电梯保持辅助导航，全景收起关注区',async()=>{
    const {host,stage,hooks}=await mountGame(),r={...emptyReservoirUI(),available:true,active:true,entered:true,joined:true,lift:true,label:'蓄一池清水'}
    hooks.onReservoir?.(r);await nextTick();assertAttention(stage,'reservoir')
    expect(stage.querySelectorAll('.ride button')).toHaveLength(6);expect(stage.querySelectorAll('.ride [data-primary-action]')).toHaveLength(0)
    expect(host.querySelector('.depth-nav .reservoir')?.hasAttribute('data-primary-action')).toBe(false)
    hooks.onPartnerConversation?.({...conversation,partnerId:'tuantuan',name:'团团',species:'河狸',verb:'筑渠'});await nextTick();assertAttention(stage,'conversation')
    hooks.onPartnerConversation?.(null);hooks.onFacility?.(facilityState());await nextTick();assertAttention(stage,'facility')
    hooks.onFacility?.(emptyFacilityUI());hooks.onReservoir?.({...r,busy:true});await nextTick();assertAttention(stage,'reservoir-work')
    hooks.onView?.({layer:'reservoir',overview:true});await nextTick();assertAttention(stage,null)
    hooks.onReservoir?.({...emptyReservoirUI(),available:true});hooks.onView?.({layer:'water',overview:false});await nextTick();assertAttention(stage,'guide')
  })

  it('第五层排水、苔苔相遇、选址、工作、菌床与庆典逐个交接，最多一个主面板和主操作', async () => {
    const { stage, hooks } = await mountGame()
    const garden = { ...emptyGardenUI(), available:true, active:true, title:'给小水珠一条路', speaker:'小泉', speech:'先导走入口的水。', label:'接好排水槽', done:1 }
    hooks.onGarden?.(garden); await nextTick(); assertAttention(stage,'garden')
    hooks.onGarden?.({...garden,entered:true,title:'认识蜗牛苔苔',speaker:'苔苔',label:'和苔苔打招呼'}); await nextTick(); assertAttention(stage,'garden')
    hooks.onGarden?.({...garden,entered:true,joined:true,placing:'bed',candidate:26,valid:false,label:'就在这里建造'}); await nextTick(); assertAttention(stage,'garden')
    expect(stage.querySelector<HTMLButtonElement>('[data-primary-action]')!.disabled).toBe(true)
    hooks.onGarden?.({...garden,entered:true,joined:true,placing:'bed',candidate:28,valid:true,label:'就在这里建造'}); await nextTick(); assertAttention(stage,'garden')
    hooks.onGarden?.({...garden,busy:true}); await nextTick(); assertAttention(stage,'garden-work'); expect(stage.querySelector('[data-primary-action]')).toBeNull()
    hooks.onGarden?.({...garden,entered:true,joined:true,selected:'bed',selectedX:28,growth:1,label:'请小满照料一次'}); await nextTick(); assertAttention(stage,'garden')
    expect(stage.querySelector('.growth [aria-current]')?.textContent).toContain('小芽')
    stage.querySelector<HTMLButtonElement>('[data-primary-action]')!.click(); expect(harness.gardenPrimary).toHaveBeenCalled()
    hooks.onGarden?.({...garden,entered:true,joined:true,selected:'bed',selectedX:28,canChangeVariety:true}); await nextTick(); assertAttention(stage,'garden')
    expect(stage.querySelectorAll('.quiet[data-primary-action]')).toHaveLength(0)
    hooks.onGarden?.({...garden,completed:true,celebrating:true,title:'一条菌光路，一个新朋友',label:'继续布置菌光花园'}); await nextTick(); assertAttention(stage,'garden-celebration')
    hooks.onGarden?.({...emptyGardenUI(),available:true,entered:true}); hooks.onView?.({layer:'garden',overview:false}); await nextTick(); assertAttention(stage,'guide')
  })
  it('花园与旧设施、旧对话、全景互相让位，五站电梯和楼层导航保持辅助操作', async () => {
    const { host,stage,hooks }=await mountGame()
    const garden={...emptyGardenUI(),available:true,active:true,entered:true,joined:true,lift:true,title:'菌光花园',label:'请苔苔铺菌毯'}
    hooks.onGarden?.(garden); await nextTick(); assertAttention(stage,'garden')
    expect(host.querySelector('.depth-nav .garden')?.hasAttribute('data-primary-action')).toBe(false)
    expect(stage.querySelectorAll('.ride button')).toHaveLength(5); expect(stage.querySelectorAll('.ride [data-primary-action]')).toHaveLength(0)
    hooks.onPartnerConversation?.({...conversation,partnerId:'taitai',name:'苔苔',species:'蜗牛',verb:'连菌'}); await nextTick(); assertAttention(stage,'conversation')
    hooks.onPartnerConversation?.(null); hooks.onFacility?.(facilityState()); await nextTick(); assertAttention(stage,'facility')
    hooks.onFacility?.(emptyFacilityUI()); hooks.onGarden?.({...garden,busy:true}); await nextTick(); assertAttention(stage,'garden-work')
    hooks.onView?.({layer:'garden',overview:true}); await nextTick(); assertAttention(stage,null)
    hooks.onGarden?.({...emptyGardenUI(),available:true}); hooks.onView?.({layer:'water',overview:false}); await nextTick(); assertAttention(stage,'guide')
  })

  it('第四层旧梁、选址、施工、设施相册和六人庆典逐个交接，始终只有一个主面板和推进按钮', async () => {
    const { stage, hooks } = await mountGame()
    const hall = { ...emptyHallUI(), active: true, available: true, title: '先把旧木梁托稳', speaker: '阿岩', speech: '先安装支撑，再向下挖。', label: '安装新支撑', done: 1 }
    hooks.onHall?.(hall); await nextTick(); assertAttention(stage, 'hall')
    expect(stage.querySelector('[data-primary-action]')?.textContent).toContain('安装新支撑')
    hooks.onHall?.({ ...hall, entered: true, placing: 'hall', label: '就在这里建造', candidate: 24, valid: false }); await nextTick(); assertAttention(stage, 'hall')
    expect(stage.querySelector<HTMLButtonElement>('[data-primary-action]')!.disabled).toBe(true)
    hooks.onHall?.({ ...hall, entered: true, placing: 'hall', candidate: 28, valid: true }); await nextTick(); assertAttention(stage, 'hall')
    hooks.onHall?.({ ...hall, entered: true, busy: true }); await nextTick(); assertAttention(stage, 'hall-construction')
    expect(stage.querySelector('[data-primary-action]')).toBeNull()
    hooks.onHall?.({ ...hall, entered: true, selected: 'memory', title: '家园纪念墙', label: '看看下一件事', album: [{ title: '第一盏灯', detail: '我们找到能源石。' }, { title: '泉水滴答响', detail: '我们找到泉水。' }] }); await nextTick(); assertAttention(stage, 'hall')
    expect(stage.querySelector('.album')?.textContent).toContain('第一盏灯')
    expect(stage.querySelectorAll('.album [data-primary-action]')).toHaveLength(0)
    hooks.onHall?.({ ...hall, entered: true, completed: true, celebrating: true, title: '六个人，一个暖暖的家', label: '继续建设我们的家' }); await nextTick(); assertAttention(stage, 'hall-celebration')
    hooks.onHall?.({ ...emptyHallUI(), available: true, entered: true }); hooks.onView?.({ layer: 'hall', overview: false }); await nextTick(); assertAttention(stage, 'guide')
  })
  it('第四层让位给对话、前三层设施和施工；四层导航和电梯属于辅助操作', async () => {
    const { host, stage, hooks } = await mountGame()
    const hall = { ...emptyHallUI(), active: true, available: true, entered: true, lift: true, title: '暖光大厅', label: '邀请大家来暖屋' }
    hooks.onHall?.(hall); await nextTick(); assertAttention(stage, 'hall')
    expect(host.querySelector('.depth-nav .hall')?.hasAttribute('data-primary-action')).toBe(false)
    expect(stage.querySelectorAll('.ride [data-primary-action]')).toHaveLength(0)
    hooks.onPartnerConversation?.(conversation); await nextTick(); assertAttention(stage, 'conversation')
    hooks.onPartnerConversation?.(null); hooks.onFacility?.(facilityState()); await nextTick(); assertAttention(stage, 'facility')
    hooks.onFacility?.(emptyFacilityUI()); hooks.onHall?.({ ...hall, busy: true }); await nextTick(); assertAttention(stage, 'hall-construction')
    hooks.onView?.({ layer: 'hall', overview: true }); await nextTick(); assertAttention(stage, null)
    hooks.onHall?.({ ...emptyHallUI(), available: true }); hooks.onView?.({ layer: 'water', overview: false }); await nextTick(); assertAttention(stage, 'guide')
  })

  it('晶簇层引导、选址、施工、设施与升级逐个交接，前两层面板和对话能接管', async () => {
    const { stage, hooks } = await mountGame()
    const deep = { ...emptyDeepUI(), active: true, available: true, entered: true, title: '让晶簇有个采集台', speaker: '阿岩', speech: '先搭一个晶簇采集台，位置由你决定。', label: '选择位置放置晶簇采集台', done: 4 }
    hooks.onDeep?.(deep); await nextTick(); assertAttention(stage, 'deep')
    expect(stage.querySelector('[data-primary-action]')?.textContent).toContain('选择位置放置晶簇采集台')
    expect(stage.querySelector('.facilities')).toBeNull()
    expect(stage.querySelectorAll('[data-primary-action]')).toHaveLength(1)
    hooks.onDeep?.({ ...deep, placing: 'collector', title: '摆放晶簇采集台', speech: '采集台建 1 台就够了。', hint: '石料 2 · 旧木料 2 · 本章只需 1 台', label: '就在这里建造', candidate: 31, valid: false }); await nextTick()
    assertAttention(stage, 'deep'); expect(stage.querySelector<HTMLButtonElement>('[data-primary-action]')?.disabled).toBe(true)
    hooks.onDeep?.({ ...deep, placing: 'workshop', candidate: 31, valid: true, label: '就在这里建造' }); await nextTick(); assertAttention(stage, 'deep')
    hooks.onDeep?.({ ...deep, busy: true }); await nextTick(); assertAttention(stage, 'deep-construction')
    expect(stage.querySelector('[data-primary-action]')).toBeNull()
    hooks.onDeep?.({ ...deep, selected: 'workshop', title: '岩壁工坊', label: '制作部件' }); await nextTick(); assertAttention(stage, 'deep')
    hooks.onPartnerConversation?.({ ...conversation, partnerId: 'amu', name: '阿木' }); await nextTick(); assertAttention(stage, 'conversation')
    hooks.onPartnerConversation?.(null); await nextTick(); assertAttention(stage, 'deep')
    hooks.onFacility?.(facilityState()); await nextTick(); assertAttention(stage, 'facility')
    hooks.onFacility?.(emptyFacilityUI()); hooks.onDeep?.({ ...deep, title: '精密工具', label: '确认这次改进' }); await nextTick(); assertAttention(stage, 'deep')
    hooks.onView?.({ layer: 'crystal', overview: true }); await nextTick(); assertAttention(stage, null)
    hooks.onDeep?.({ ...emptyDeepUI(), available: true }); hooks.onView?.({ layer: 'water', overview: false }); await nextTick(); assertAttention(stage, 'guide')
  })

  it('第三层收起详情后恢复全局引导，楼层导航保持辅助入口', async () => {
    const { host, stage, hooks } = await mountGame()
    hooks.onView?.({ layer: 'crystal', overview: false }); hooks.onDeep?.({ ...emptyDeepUI(), available: true, entered: true }); await nextTick()
    assertAttention(stage, 'guide')
    expect(host.querySelector('.depth-nav .crystal')?.hasAttribute('data-primary-action')).toBe(false)
    hooks.onDeep?.({ ...emptyDeepUI(), active: true, available: true, title: '乘电梯回家', label: '乘电梯回暖窝层' }); await nextTick()
    assertAttention(stage, 'deep')
  })
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

  it('能源核心面板只显示供电状态和一个升级动作', async () => {
    const { host, stage, hooks } = await mountGame()
    hooks.onFacility?.(facilityState({
      id: 'energy-core', title: '能源核心', icon: '⚡', slots: [],
      summary: '第一层已通电', primary: { kind: 'power', label: '扩大供电范围' },
      hint: '梯道已经接通，可以把电送到第二层。', canPlant: false,
    })); await nextTick()
    assertAttention(stage, 'facility')
    expect(stage.querySelector('[data-primary-action]')?.textContent).toContain('扩大供电范围')
    host.querySelector<HTMLButtonElement>('[data-primary-action]')!.click(); await nextTick()
    expect(harness.facilityPrimary).toHaveBeenCalledTimes(1)
  })

  it('直接点建筑打开房间详情时，只保留扩建这一项主要推进操作', async () => {
    const { stage, hooks } = await mountGame()
    hooks.onRooms?.({ ...room(false), active: true, completed: true, selectedId: 1, dirty: false, valid: false, nestMarks: [{ id: 1, label: '小窝 · 叶子' }] })
    await nextTick()
    assertAttention(stage, 'room')
    expect(stage.querySelector('[data-primary-action]')?.textContent).toContain('扩建房间')
    expect(stage.querySelector('.nest-marks')?.textContent).toContain('叶子')
    expect(stage.querySelectorAll('.nest-marks [data-primary-action]')).toHaveLength(0)
    expect(stage.querySelector('.room-tools .saved')).toBeNull()
    expect(stage.querySelector('.room-tools .finish')).toBeNull()
    hooks.onRooms?.({ ...room(false), active: true, completed: false, selectedId: 1, width: 4, dirty: true, valid: true, action: '放下扩建蓝图' })
    await nextTick()
    expect(stage.querySelector('.room-tools .kinds')).toBeNull()
    expect(stage.querySelector('.room-tools .width-control')).toBeNull()
    expect(stage.querySelector('.room-tools .expansion-size')?.textContent).toContain('4')
    hooks.onRooms?.(room(false)); await nextTick()
    assertAttention(stage, 'guide')
  })

  it('第一层把规划新房间收进更多工具，不与当前引导并列抢注意力', async () => {
    const { host, stage, hooks } = await mountGame()
    hooks.onRooms?.(room(false)); await nextTick()
    expect(stage.querySelector('.build-tools')).toBeNull()
    host.querySelector<HTMLButtonElement>('.tools-toggle')!.click(); await nextTick()
    expect(stage.querySelector('.build-buttons')?.textContent).not.toContain('修建洞室')
    expect(stage.querySelector('.extra-tools')?.textContent).toContain('规划新房间')
    assertAttention(stage, 'guide')
  })

  it('菜园面板的升级入口与育苗架面板各只有一个主要操作，升级是虚线次入口', async () => {
    const { host, stage, hooks } = await mountGame()
    hooks.onFacility?.(facilityState({
      primary: { kind: 'watering', label: '请小满浇浇水', x: 28, y: 21 },
      upgrade: { kind: 'build-nursery', label: '🌿 搭育苗架，种新菜' },
    })); await nextTick()
    assertAttention(stage, 'facility')
    expect(stage.querySelector('[data-primary-action]')!.textContent).toBe('请小满浇浇水')
    const upgrade = host.querySelector<HTMLButtonElement>('.upgrade')!
    expect(upgrade.hasAttribute('data-primary-action')).toBe(false)
    upgrade.click(); await nextTick()
    expect(harness.facilityUpgrade).toHaveBeenCalledTimes(1)
    hooks.onFacility?.(facilityState({
      id: 'nursery', title: '育苗架', icon: '🌿', slots: [], summary: '番茄苗在架上冒芽啦',
      primary: { kind: 'plant-tomato', label: '摆一槽番茄' }, hint: '和蔬菜一样照料。', canPlant: false,
    })); await nextTick()
    assertAttention(stage, 'facility')
    expect(stage.querySelector('[data-primary-action]')!.textContent).toBe('摆一槽番茄')
    expect(host.querySelector('.upgrade')).toBeNull()
    hooks.onFacility?.(emptyFacilityUI()); await nextTick()
    assertAttention(stage, 'guide')
  })

  it('第二层共餐后把主要操作交给第三层；九层完成后有效打开全景', async () => {
    const { host, stage, hooks } = await mountGame()
    const progress = (over: Partial<SessionProgress>): SessionProgress => ({
      title: '请大家吃第一顿饭', speech: '灶台和餐桌都好啦！', outcome: '吃完饭去看看下面的新线索。',
      done: 11, total: 12, finished: false, relics: { found: 3, total: 3 }, ...over,
    })
    hooks.onProgress(progress({ action: { id: 'meal', label: '请大家吃第一顿饭' } }))
    await nextTick(); assertAttention(stage, 'guide')
    host.querySelector<HTMLButtonElement>('[data-primary-action]')!.click()
    expect(harness.feed).toHaveBeenCalledTimes(1)
    hooks.onProgress(progress({ title: '岩壁里有抓挠声', layer: '第 3 层 · 晶簇', action: { id: 'deep', label: '看看第三层的新线索' } }))
    await nextTick(); assertAttention(stage, 'guide')
    expect(stage.querySelector('.guide')!.textContent).toContain('第 3 层')
    host.querySelector<HTMLButtonElement>('[data-primary-action]')!.click()
    expect(harness.openDeep).toHaveBeenCalledTimes(1)
    hooks.onProgress(progress({ title: '九层家园建好啦，接下来由你继续布置', finished: true, action: { id: 'overview', label: '看看九层家园全景' } }))
    await nextTick(); assertAttention(stage, 'guide')
    host.querySelector<HTMLButtonElement>('[data-primary-action]')!.click()
    expect(harness.showOverview).toHaveBeenCalledTimes(1)
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
    expect(stage.querySelector('.build-tools')).toBeNull()
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
