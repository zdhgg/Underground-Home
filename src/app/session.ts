import { gameAudio } from '../render/gameAudio'
import { playSoilDig, playBuildComplete, playPartnerFound, playCrystalCollected, playPowerConnected, playUndo, playUnavailable } from '../render/waterSound'
import { dig, type DigResult } from '../core/dig'
import { AtuOrders } from './atuOrders'
import { RoomEditor, type RoomUI } from './roomEditor'
import { SiteEditor, type SiteUI } from './siteEditor'
import { primaryGuideAction, type GuideAction } from './guideAction'
import type { ConversationAnchor } from '../render/conversationAnchor'
import { BUILDING_SITES, siteAt, siteBlueprintVisible, siteById, siteBuilt } from '../core/sites'
import { canAfford, changeMaterials, digLoot, materialText, PLANTER_COST } from '../core/materials'
import type { Inventory } from '../core/world'
import { bagItems, COLLECTION_SHELF, type BagItem } from '../core/bag'
import { activateGardens } from '../core/roomConstruction'
import { PartnerOrders, type WorkUI } from './partnerOrders'
import { initializeWorkers, type WorkPlan, type WorkTarget } from '../core/partnerWork'
import { atuRoute, initialAtuPosition, routeBeforePod } from '../core/atu'
import { createWorldHistory } from '../core/history'
import { canPlacePod, placePod, podAnchorFromPointer, type BuildFailure } from '../core/build'
import { collectCrystal, repairCore } from '../core/interact'
import { FIRST_NIGHT_MISSIONS, currentMission, explorationGuide, guideHighlight, missionSummary } from '../core/missions'
import { canPlaceWallLamp, inspectCrack, isShaftColumn, SHAFT_LAST_Y, shaftChainReady, shaftConnected, shaftFrontier, shaftRemainingSegments, springVisible } from '../core/exploration'
import { HOME_FLOOR_Y, LANDMARKS, TILE, TILE_SIZE, createInitialWorld, type Cell, type Rect, type RoomKind, type SiteKind, type WorkerId } from '../core/world'
import { availablePartners, canBuildMorePods, partnerBed, waitingPartnerList, waitingPartners, type PartnerId } from '../core/partners'
import { SMALL_PICKAXE_ID, upgradePartner } from '../core/partnerAbilities'
import { wideLampUpgrade } from '../core/partnerAbilities'
import { canRetrofitLamp, hasWideLampAbility, retrofitLamp, WIDE_LAMP_ID } from '../core/lighting'
import { partnerConversation, type PartnerConversation } from '../core/partnerInteractions'
import { canSendPowerDown, sendPowerDown } from '../core/power'
import { relicAt, relicSummary, RELICS } from '../core/relics'
import {
  canPlacePlanter,
  canSupplyWater,
  harvestPlanter,
  isFarmUnlocked,
  advancePlanters,
  placePlanter,
  planterAt,
  ripePlanters,
  RIPE_STAGE,
  type FarmFailure,
} from '../core/farm'
import {
  deserialize,
  serialize,
  type SaveStore,
} from '../core/persistence'
import { DINING_SITE_ID, KITCHEN_SITE_ID, mealFacilities, planMealGathering, serveMeal, sharedMealReady } from '../core/meal'
import { summarizeSave, type SaveStatus } from './saveSummary'
import type { DepthView } from '../render/camera'
import { attachPointerControls } from '../input/pointerControls'
import { PixiWorldRenderer } from '../render/PixiRenderer'
import { playBreakthrough, playHarvest, playLayerArrival, playMealTime, playRockHit, playSpringFound, playWaterClue, playWaterSupplied } from '../render/waterSound'

export interface SessionHooks {
  onOpening?(state: { active: boolean; caption: string }): void
  /** 状态提示（儿童可读的短句） */
  onMessage(message: string, kind?: 'info' | 'warning'): void
  /** 任务进度与引导变化（小鼹鼠面板 + 徽章） */
  onProgress(progress: SessionProgress): void
  onBuild?(state: BuildState): void
  onView?(view: DepthView): void
  onExploration?(state: ExplorationUI): void
  /** 引水与种植（按钮与计数） */
  onFarm?(state: FarmUI): void
  /** 一次性里程碑（突破岩层 / 抵达第二层 / 发现泉水）：界面弹一张大卡片 */
  onMilestone?(card: Milestone): void
  /** 一次只与一位伙伴交流；null表示关闭，不占用建造和挖掘模式。 */
  onPartnerConversation?(conversation: PartnerConversation | null): void
  onConversationAnchor?(anchor: ConversationAnchor | null): void
  onDiscovery?(active: boolean): void
  onRooms?(state: RoomUI): void
  onSites?(state: SiteUI): void
  onInventory?(inventory: Inventory): void
  onBag?(items: BagItem[]): void
  onBagRequested?(): void
  onWork?(state: WorkUI | null): void
  onWorkers?(items: { id: WorkerId; name: string; verb: string }[]): void
}

export interface ExplorationUI {
  wideLighting: boolean; lightUpgradeReady: boolean
  clue: boolean; upgraded: boolean; connected: boolean; entered: boolean; found: boolean
  traveling: boolean; downstairs: boolean; lampMode: boolean
  /** 已经学会亲自委托：可以一次挖到洞底 */
  canChain: boolean
  /** 连续施工进行中 */
  chaining: boolean
  /** 从当前工作面到洞底还剩几段岩 */
  remaining: number
}

/** 引水与种植：水引上来之前这些按钮都不出现 */
export interface FarmUI {
  canSupplyWater: boolean
  supplying: boolean
  unlocked: boolean
  planterCount: number
  ripe: number
  food: number
  /** 已经收过至少一次（喂饭按钮、计数都靠它） */
  harvested: boolean
  /** 第一夜过完、还没把电送到第二层 */
  canSendPower: boolean
  /** 阿土正在铺电线 */
  powering: boolean
  /** 电已经送到第二层 */
  powerDown: boolean
  /** 第二层的灶台／餐桌是否已经建好（旧存档两件都没有） */
  kitchen: boolean
  dining: boolean
  /** 两件都建好：吃饭入口会播放实体围坐演出 */
  mealReady: boolean
  /** 一次共餐演出正在进行：按钮暂时收起，避免重复结算 */
  mealActive: boolean
}

/** 里程碑卡片：只用来庆祝，不承载操作 */
export interface Milestone {
  emoji: string
  title: string
  detail: string
}

/** 建造工具：同一次只会选一个（挖掘 / 睡眠舱 / 种植槽） */
export type BuildMode = 'none' | 'pod' | 'planter'

export interface BuildState {
  digging: boolean
  /** 现在能用哪些工具（界面按这个显示按钮） */
  podAvailable: boolean
  planterAvailable: boolean
  mode: BuildMode
  selected: boolean
  valid: boolean
  message: string
  podCount: number
  planterCount: number
}

const BUILD_MESSAGES: Record<BuildFailure | FarmFailure, string> = {
  room: '把小床完整放进同一个房间，或先调整房间范围。',
  power: '先修好能源核心，再安小床。', bounds: '这里太靠边啦，换个地方试试。',
  reserved: '入口、梯子和能源核心旁边要留出位置。', overlap: '这里已经放好东西啦。',
  soil: '先挖空这一格，再放东西。', support: '设施要放在地面上，不能悬空。',
  access: '小床的门要通到家里，也要给伙伴和核心留条路。',
  'locked-layer': '泉水层还没有开放，回暖窝层安小床吧。',
  'no-water': '先把水接到菜园，才能种东西。',
  layer: '种植槽要放在第二层菜园的地面上。',
}

/** 预览旁边的短提示：孩子不用低头看底部面板也能判断 */
const BUILD_SHORT_HINTS: Record<BuildFailure | FarmFailure, string> = {
  room: '小床要完整放进房间',
  power: '先修好能源核心', bounds: '太靠边了', reserved: '这里要留空',
  overlap: '这里放过了', soil: '先挖空这块', support: '要放在地面上', access: '门要通到家里',
  'locked-layer': '这一层还没开放', 'no-water': '先接水', layer: '只能放第二层菜园',
}

/** 面向界面的一次引导快照：阿土说什么 + 唯一目标的"做完会怎样" */
export interface SessionProgress {
  action?: GuideAction
  title: string
  speech: string
  outcome: string
  done: number
  total: number
  finished: boolean
  /** 暖窝层挖到的旧避难所遗物（不占设施格，也不进任务链） */
  relics: { found: number; total: number }
}

/** 组合根：把 world / rules / missions / persistence / render / input 装配成一次游戏会话 */
export interface GameSession {
  setInputBlocked(blocked: boolean): void
  focusCollection(): void
  focusRelic(id: string): void
  startOpening(): void
  skipOpening(): void
  enableOpeningSound(): void
  findPartner(id: WorkerId): void
  openRooms(): void
  prepareNest(): void
  closeRooms(): void
  roomKind(kind: RoomKind): void
  roomWidth(delta: number): void
  saveRoom(): void
  removeRoom(): void
  selectRoom(id: number): void
  newRoom(): void
  selectSite(id: string): void
  siteKind(kind: SiteKind): void
  buildSite(): void
  cancelAction(): void
  findAtu(): void
  talkToPartner(id: string): void
  closePartnerConversation(): void
  partnerAction(): void
  setBuildMode(mode: BuildMode): void
  confirmBuild(): void
  zoomBy(delta: number): void
  centerOnHome(): void
  lookDown(): void
  showOverview(): void
  /** 撤销最近一次挖掘（挖错保护；能源石被挖开后不可再被埋回去） */
  undo(): void
  /** 把当前任务目标居中（"带我去看看"，只移动画面） */
  focusTarget(): void
  upgradeTool(): void
  /** 连续施工：从当前梯段一路挖到洞底（学会两次委托之后可用） */
  digToBottom(): void
  travel(): void
  toggleLamp(): void
  /** 把水接到菜园：小泉走到泉边接水管，之后第二层才能种东西 */
  supplyWater(): void
  /** 直接把镜头带到第二层并选中种植槽工具 */
  startPlanting(): void
  /** 请伙伴吃饭：消耗一份收成，播一段吃饭演出 */
  feed(): void
  /** 把第一层的电顺着梯道送到第二层 */
  sendPower(): void
  /** 进入页读取：没有存档 / 可继续 / 读不出来 */
  titleSave(): SaveStatus
  /** 清掉旧档，从初始地图重新开始；随后由界面点击开始播放开场 */
  startNewGame(): Promise<void>
  destroy(): void
}

const SAVE_DEBOUNCE_MS = 350
/** 施工看门狗：画面连续这么久没有新帧 = 动画真的被冻住了（切后台 / 窗口被遮挡 / 帧被冻结） */
const ORDER_CHECK_MS = 800
const ORDER_STALL_MS = 3000
/** 即使画面还在动，一趟委托也不该拖这么久；超过就说明这一趟异常了 */
const ORDER_HARD_CAP_MS = 20000
/** 同一句话在这么短时间内不重复弹，避免连点时刷屏 */
const MESSAGE_REPEAT_MS = 2500

/** 一次进行中的施工委托（走路或挥镐） */
interface Order {
  kind: 'travel' | 'swing'
  startedAt: number
}

export interface SessionOptions {
  /** 默认不读写存档；保留注入端口供规则回归测试使用。 */
  store?: SaveStore
  /** 进入页准备好场景后，等待玩家点击再播放。 */
  deferOpening?: boolean
}

function inRect(rect: Rect, cell: Cell): boolean {
  return cell.x >= rect.x && cell.x < rect.x + rect.w && cell.y >= rect.y && cell.y < rect.y + rect.h
}

function describeDigFailure(result: DigResult): string {
  switch (result.reason) {
    case 'rock':
      return '🪨 这是坚硬岩石，以后升级工具才能挖开'
    case 'locked-layer':
      return '💧 先挖通裂纹梯道，沿梯子真正走到第二层吧。'
    case 'tool': return '⛏ 先挖通裂纹上方的泥土，点裂纹听听，再换小铁镐。'
    case 'reach': return '先挖脚边能碰到的一块，再接着开路吧。'
    case 'empty':
      return '这里已经挖空啦，拖动画布看看别处吧'
    case 'sky':
      return '地面以上的地方不能挖哦'
    case 'facility':
      return '这是睡眠舱和它的地基，先保留它们吧。'
    default:
      return '这里是地图边缘，换个地方挖吧'
  }
}

export async function createGameSession(host: HTMLElement, hooks: SessionHooks, options: SessionOptions = {}): Promise<GameSession> {
  const renderer = await PixiWorldRenderer.create(host)
  let cameraView: DepthView = { layer: 'home', overview: false }
  renderer.onViewChanged = (view) => {
    cameraView = { ...view, layer: siteEditor?.focusedLayer ?? view.layer }
    hooks.onView?.(cameraView)
  }
  const store = options.store
  const history = createWorldHistory()

  let world = createInitialWorld()
  let newGame = false
  let openingActive = false
  let saveTimer: number | undefined
  /** 进入页摘要：读到的存档时间与失败原因 */
  let savedAt = ''
  let loadError = ''
  let loadedFromSave = false
  /** 有没有真正需要落盘的改动：只在进入页打开、没玩过时，不凭空写一份新档 */
  let dirty = false
  let buildMode: BuildMode = 'none'
  let diggingSites = false
  let candidate: Cell | null = null
  let hoverBuild: Cell | null = null
  /** 伙伴是否已经在床上休息；不写入存档，重新载入时由第一间睡眠舱推导 */
  let resting = false
  let saveBlocked = false
  let traveling = false
  let lampMode = false
  /** 进行中的施工委托；切后台或超时用它安全收尾（不重复挖、不锁死操作） */
  let order: Order | null = null
  let orderTimer: number | undefined
  /** 连续施工：一次委托从当前梯段一路挖到洞底 */
  let chaining = false
  /** 引水演出进行中（按钮显示"正在接水管……"） */
  let supplying = false
  let powering = false
  let lastMessage = ''
  let lastMessageAt = 0
  /** 切后台打断委托后，回到前台补一句提示 */
  let resumeHint = ''
  /** 看门狗判据：画面最近一次出新帧的时刻与帧数 */
  let lastFrameCount = 0
  let lastFrameAt = 0
  /** 有改动还没落盘（回到前台时补写一次，避免后台定时器被节流） */
  let savePending = false
  let talkingPartnerId: PartnerId | null = null
  let discovering = false
  let atuOrders: AtuOrders | null = null
  let roomEditor: RoomEditor | null = null
  let siteEditor: SiteEditor | null = null
  let partnerOrders: PartnerOrders | null = null
  let currentWork: WorkUI | null = null
  /** 一次共餐演出：结算已完成，演出期间不再重复扣食物。 */
  let mealing = false
  let mealTimer: number | undefined

  const pushConversation = (): void => {
    const conversation = talkingPartnerId ? partnerConversation(world, talkingPartnerId) : null
    if (!conversation) talkingPartnerId = null
    renderer.setConversationPartner(talkingPartnerId)
    hooks.onPartnerConversation?.(conversation)
  }
  const pushHighlight = (): void => {
    const guide = guideHighlight(world)
    const action = primaryGuideAction(world)
    const site = action.siteId ? siteById(action.siteId) : undefined
    const rect = site ?? (guide.kind !== 'none' ? guide.rect : null)
    renderer.setHighlight(talkingPartnerId || discovering || siteEditor?.active || roomEditor?.active || currentWork || buildMode !== 'none' || lampMode || !rect ? null : {
      x: rect.x * TILE_SIZE, y: rect.y * TILE_SIZE,
      width: rect.w * TILE_SIZE, height: rect.h * TILE_SIZE,
      tone: guide.kind === 'dig' || guide.kind === 'collect' ? 'cyan' : 'amber',
    })
  }
  const closeConversation = (): void => {
    if (discovering || talkingPartnerId) gameAudio.stopEffects()
    discovering = false
    hooks.onDiscovery?.(false)
    talkingPartnerId = null
    pushConversation()
    pushHighlight()
  }

  /**
   * 一间住处建成后的庆祝卡片。
   * 第一间是“第一夜的家”；之后的住处只有在所有等床的伙伴都安顿好时才报“新伙伴住下啦”，
   * 避免随口建一间空床就重复庆祝。预设洞室、睡眠舱和房间扩建共用这一套判定。
   */
  const lodgingMilestone = (podId: number, first: Milestone): Milestone | null => {
    if (world.pods.length === 1) return first
    const movedIn = availablePartners(world)
      .filter((partner) => partner.id !== 'atu' && partnerBed(world, partner.id)?.pod.id === podId)
      .map((partner) => partner.name)
      .join('和')
    if (!movedIn || waitingPartnerList(world).length > 0) return null
    return { emoji: '🏠', title: '新伙伴住下啦！', detail: `${movedIn}有自己的床了 · 家里又热闹了一点` }
  }

  const pushBuild = (): void => {
    // 睡眠舱：由已加入伙伴的稳定床位优先位决定容量。
    // 种植槽：水接到菜园之后才能种。
    const podAvailable = world.progress.coreRepaired && canBuildMorePods(world)
    const planterAvailable = isFarmUnlocked(world)
    // 工具不可用时自动收起，别让孩子停在一个点了没反应的模式里
    if ((buildMode === 'pod' && !podAvailable) || (buildMode === 'planter' && !planterAvailable)) {
      buildMode = 'none'
      candidate = null
      hoverBuild = null
    }
    const anchor = buildMode === 'pod' && hoverBuild ? podAnchorFromPointer(hoverBuild) : hoverBuild
    const point = buildMode === 'none' ? null : candidate ?? anchor
    const podCheck = buildMode === 'pod' && point ? canPlacePod(world, point.x, point.y) : null
    const planterCheck = buildMode === 'planter' && point ? canPlacePlanter(world, point.x, point.y) : null
    const check = podCheck ?? planterCheck
    const valid = check?.ok === true
    const previewHint = check ? (valid ? '可以建 ✓' : BUILD_SHORT_HINTS[check.reason]) : ''
    renderer.setBuildPreview(
      podCheck?.ok ? point : null,
      valid,
      podCheck?.ok ? podCheck.door : 'left',
      buildMode === 'none' ? '' : previewHint,
      buildMode,
      buildMode === 'planter' ? point : null,
    )

    let message = '选一个工具开始建造。'
    if (buildMode === 'none') {
      message = planterAvailable
        ? '去第二层泉水边，选“种植槽”，点在挖空的地面种菜。'
        : '先挖出一块空地，再选“睡眠舱”。'
    } else if (candidate && check) {
      message = check.ok
        ? '这里可以建！点“确认建造”。想换位置，再点别处。'
        : `${BUILD_MESSAGES[check.reason]} 再点别处换位置。`
    } else if (point && check) {
      message = check.ok
        ? '这里可以建！点一下这里把位置定下来。'
        : `${BUILD_MESSAGES[check.reason]} 换个地方，或先清理这里。`
    } else if (buildMode === 'planter') {
      message = '在第二层点一块有地面的空地，放下种植槽。'
    } else if (buildMode === 'pod') {
      message = '点一块有地面的空地，放下睡眠舱。'
    }

    hooks.onBuild?.({
      digging: diggingSites,
      podAvailable, planterAvailable, mode: buildMode, selected: candidate !== null,
      valid: candidate !== null && valid, message,
      podCount: world.pods.length, planterCount: world.farm.planters.length,
    })
  }

  // 当前试玩不提供存档。显式注入适配器时才读取（规则回归场景）。
  try {
    const raw = await store?.load()
    if (raw !== null && raw !== undefined) {
      const result = deserialize(raw)
      if (result.ok) {
        world = result.world
        savedAt = result.savedAt
        loadedFromSave = true
        resting = world.pods.length > 0
        hooks.onMessage(result.notice ? `💾 ${result.notice}` : '💾 已恢复上次的进度')
      } else {
        loadError = result.error
        saveBlocked = true
        hooks.onMessage(`存档读取失败（${result.error}），可以重新开始，本次不覆盖原档`, 'warning')
      }
    } else { newGame = true }
  } catch {
    loadError = '浏览器暂时读不出存档'
    saveBlocked = true
    hooks.onMessage('存档无法读取，可以重新开始；刷新后可能不保留', 'warning')
  }

  world.exploration.explorer ??= initialAtuPosition(world)
  initializeWorkers(world)
  const routeTo = (to: Cell): Cell[] | null => world.exploration.explorer ? atuRoute(world, world.exploration.explorer, to) : null
  renderer.setWorld(world)
  renderer.focusHome()

  const persist = async (): Promise<void> => {
    // 进入页只读不写：没有改动时绝不凭空生成一份“从未玩过”的存档。
    if (!store || saveBlocked || !dirty) return
    savePending = false
    dirty = false
    try {
      await store.save(serialize(world))
    } catch {
      dirty = true
      hooks.onMessage('存档失败：这次进度可能不会保留', 'warning')
    }
  }

  const scheduleSave = (): void => {
    if (!store) return
    dirty = true
    savePending = true
    window.clearTimeout(saveTimer)
    saveTimer = window.setTimeout(() => {
      void persist()
    }, SAVE_DEBOUNCE_MS)
  }

  /** 同一句话短时间内不重复弹：连点同一个目标只提示一次。 */
  const notify = (message: string, kind?: 'info' | 'warning'): void => {
    const now = Date.now()
    if (message === lastMessage && now - lastMessageAt < MESSAGE_REPEAT_MS) return
    lastMessage = message
    lastMessageAt = now
    hooks.onMessage(message, kind)
  }

  /** 玩家亲自做完一件事：所有作物长一档；刚长熟的提醒一下。 */
  const growAfterWork = (): void => {
    if (world.farm.planters.length === 0) return
    const ripeBefore = ripePlanters(world).length
    if (advancePlanters(world).length === 0) return
    renderer.refreshFarm()
    if (ripePlanters(world).length > ripeBefore) notify('🌱 有菜长熟啦！点菜槽，小满来收。')
  }

  const remainingSegments = (): number => {
    const x = world.exploration.shaftX
    return x === null ? 0 : shaftRemainingSegments(world, x)
  }

  const endOrder = (): void => {
    window.clearTimeout(orderTimer)
    orderTimer = undefined
    order = null
  }

  /**
   * 安全取消进行中的委托：世界保持原样，阿土回到记录的位置，输入立即解锁。
   * 用于切后台、画面被冻住、这一趟异常拖太久——绝不重复挖，也不会永久锁定操作。
   */
  const abortOrder = (message?: string): void => {
    if (siteEditor?.working) { siteEditor.cancel(); if (message) notify(message); return }
    if (partnerOrders?.active) { partnerOrders.cancel(); return }
    if (atuOrders?.active) {
      atuOrders.cancel()
      if (message) notify(message)
      return
    }
    if (!order) return
    const interruptedChain = chaining
    chaining = false
    // 引水、送电也是一次委托：被中断时要放开按钮，否则会一直卡在"阿土在接水管……"。
    supplying = false
    powering = false
    endOrder()
    traveling = false
    renderer.cancelExplorationAnimation()
    renderer.refreshExploration()
    pushProgress()
    if (message) notify(interruptedChain ? `${message}（还剩 ${remainingSegments()} 段）` : message)
  }

  /**
   * 演出看门狗：只要画面还在出新帧就继续等（慢一点没关系），
   * 连续 3 秒没有新帧才判定"卡住了"，立刻安全收尾。
   */
  const watchdogTick = (): void => {
    if (!order) return
    const now = Date.now()
    if (renderer.frames !== lastFrameCount) {
      lastFrameCount = renderer.frames
      lastFrameAt = now
    }
    const stalled = now - lastFrameAt >= ORDER_STALL_MS
    const tooLong = now - order.startedAt >= ORDER_HARD_CAP_MS
    if (!stalled && !tooLong) {
      orderTimer = window.setTimeout(watchdogTick, ORDER_CHECK_MS)
      return
    }
    abortOrder('⏸ 动作停下来了，再点一次就好。')
  }

  /** 演出开始：记下起点与当前帧数，看门狗随后判断画面有没有真的卡住。 */
  const beginOrder = (kind: Order['kind']): void => {
    endOrder()
    const now = Date.now()
    order = { kind, startedAt: now }
    lastFrameCount = renderer.frames
    lastFrameAt = now
    orderTimer = window.setTimeout(watchdogTick, ORDER_CHECK_MS)
  }

  const pushProgress = (): void => {
    if (initializeWorkers(world)) { renderer.refreshFriends(); scheduleSave() }
    hooks.onWorkers?.(availablePartners(world).filter(p => p.id !== 'atu' && world.workers[p.id]).map(p => ({ id: p.id as WorkerId, name: p.name, verb: p.verb })))
    const summary = missionSummary(world)
    const chainDone = summary.done >= summary.total
    // 第一间舱建成后到伙伴真正躺下之前，仍显示“睡眠舱”这一步；
    // 第二间舱（找到水之后）不再让计数回退，直接走探索引导的最后一步。
    const pendingRest = !chainDone && world.pods.length > 0 && !resting
    const mission = pendingRest
      ? FIRST_NIGHT_MISSIONS[FIRST_NIGHT_MISSIONS.length - 1]
      : currentMission(world)
    hooks.onProgress({
      action: primaryGuideAction(world),
      title: mission ? mission.title : '有灯、有床的小家园',
      speech: pendingRest
        ? '小床安好啦！伙伴有住处，也能来帮忙。'
        : mission
          ? mission.speech
          : '伙伴说：有水真好！我们想一直住在这儿。',
      outcome: mission ? mission.outcome : '',
      done: pendingRest ? Math.max(0, summary.done - 1) : summary.done,
      total: summary.total,
      finished: !pendingRest && chainDone,
      relics: relicSummary(world),
    })
    if (chainDone && !pendingRest) hooks.onProgress({ ...explorationGuide(world), action: primaryGuideAction(world), relics: relicSummary(world) })
    const facilities = mealFacilities(world)
    hooks.onFarm?.({
      canSupplyWater: canSupplyWater(world), supplying,
      unlocked: isFarmUnlocked(world),
      planterCount: world.farm.planters.length,
      ripe: ripePlanters(world).length,
      food: world.farm.food,
      harvested: world.farm.harvests > 0,
      canSendPower: canSendPowerDown(world),
      powering,
      powerDown: world.powerDown,
      kitchen: world.builtSites.some(site => site.id === KITCHEN_SITE_ID),
      dining: world.builtSites.some(site => site.id === DINING_SITE_ID),
      mealReady: facilities !== null,
      mealActive: mealing,
    })
    hooks.onExploration?.({
      wideLighting: hasWideLampAbility(world), lightUpgradeReady: wideLampUpgrade(world).state === 'ready',
      clue: world.exploration.clueFound, upgraded: world.exploration.pickaxeUpgraded,
      connected: shaftConnected(world), entered: world.exploration.entered, found: world.exploration.springFound,
      traveling, downstairs: world.exploration.explorer?.y === 21, lampMode,
      canChain: shaftChainReady(world), chaining, remaining: remainingSegments(),
    })
    pushBuild()
    roomEditor?.refresh()
    siteEditor?.refresh()
    hooks.onInventory?.({ ...world.inventory })
    hooks.onBag?.(bagItems(world))
    if (!lampMode) renderer.setLampPreview(null)

    pushConversation()

    pushHighlight()
  }
  pushProgress()

  /** 演出收尾：只解锁输入和刷新状态，不碰已经结算过的食物。 */
  const finishMeal = (): void => {
    if (!mealing) return
    window.clearTimeout(mealTimer)
    mealTimer = undefined
    mealing = false
    renderer.finishMealGather()
    pushProgress()
  }

  /** 其他操作开始前先结束共餐演出，保证任何入口都不会被演出锁住。 */
  const mealBusy = (): boolean => {
    if (!mealing) return false
    cancelMeal('🍽 大家先停一下，再做别的。')
    return true
  }

  /** 玩家中途停下来 / 切后台：演出安全结束，伙伴回到自己的站位，食物不重复扣。 */
  const cancelMeal = (message?: string): boolean => {
    if (!mealing) return false
    window.clearTimeout(mealTimer)
    mealTimer = undefined
    mealing = false
    renderer.cancelMealGather()
    pushProgress()
    if (message) notify(message)
    return true
  }

  const talkToPartner = (id: string, focus = true): void => {
    if (mealBusy()) return
    if (traveling || buildMode !== 'none' || lampMode || renderer.isOverview || roomEditor?.active) return
    const conversation = partnerConversation(world, id)
    if (!conversation) return
    // 主动聊天也算打过照面，之后下楼不再自动重播相遇对话。
    if (conversation.partnerId === 'xiaoman') world.exploration.metXiaoman = true
    talkingPartnerId = conversation.partnerId
    discovering = false; hooks.onDiscovery?.(false)
    if (focus) renderer.focusPartner(conversation.partnerId)
    pushConversation()
    pushHighlight()
  }

  renderer.onConversationAnchor = anchor => hooks.onConversationAnchor?.(anchor)
  renderer.onPartnerReveal = phase => {
    if (!discovering) return
    if (phase === 'appearing') { playPartnerFound('adeng'); renderer.focusPartner('adeng') }
    else talkToPartner('adeng', false)
  }

  const prepareNest = (): void => {
    if (traveling || mealBusy()) return
    const action = primaryGuideAction(world)
    const site = siteById(action.siteId ?? 'first-nest')!
    closeConversation(); roomEditor?.close(); siteEditor?.close()
    buildMode = 'none'; lampMode = false; candidate = null; hoverBuild = null
    renderer.setHoverCell(null); renderer.setLampPreview(null)
    if (siteBlueprintVisible(world, site) && !siteBuilt(world, site)) {
      diggingSites = false; siteEditor?.select(site.id)
    } else {
      diggingSites = true
      renderer.focusOn((site.x + site.w / 2) * TILE_SIZE, (site.y + site.h / 2) * TILE_SIZE)
      notify(`先沿着通路挖出${site.name}的空间。挖空后，点出现的蓝图修建；也可以继续自由探索。`)
    }
    pushProgress()
  }

  const focusCurrentClue = (): void => {
    const guide = guideHighlight(world)
    const rect = guide.kind === 'none' && world.progress.coreRepaired && world.pods.length === 0
      ? LANDMARKS.buildSuggestion : guide.kind === 'none' ? LANDMARKS.shelter : guide.rect
    renderer.focusOn((rect.x + rect.w / 2) * TILE_SIZE, (rect.y + rect.h / 2) * TILE_SIZE)
  }

  const upgradeTool = (): void => {
    if (mealBusy() || traveling || !upgradePartner(world, 'atu', SMALL_PICKAXE_ID)) return
    renderer.refreshExploration()
    renderer.playPartnerReaction('atu', '换好啦！你来选地方。')
    scheduleSave()
    pushProgress()
    notify('⛏ 小铁镐准备好啦！点带裂纹的岩石：前两块你来指挥，之后可以点「一路挖到底」。')
  }

  /** 悬停时的指针形状：可互动区域用 pointer，可挖泥土用 crosshair */
  const pickCursor = (cell: Cell | null): string => {
    if (!cell) return 'default'
    if (world.progress.coreRepaired && buildMode === 'none' && !lampMode && inRect(COLLECTION_SHELF, cell)) return 'pointer'
    const tile = world.tiles[cell.y][cell.x]
    // 裂纹岩（和它下面已经挖开的梯段）= 阿土的施工目标
    if (isShaftColumn(cell.x) && cell.y >= HOME_FLOOR_Y && cell.y <= SHAFT_LAST_Y && (tile === TILE.WEAK_ROCK || tile === TILE.EMPTY)) {
      const e = world.exploration
      if (!e.pickaxeUpgraded) return tile === TILE.WEAK_ROCK ? 'pointer' : 'default'
      return !e.clueFound || e.shaftX === cell.x ? 'pointer' : 'not-allowed'
    }
    const site = siteAt(cell)
    if (site && siteBlueprintVisible(world, site) && !siteBuilt(world, site)) return 'pointer'
    if (cell.y >= 15) {
      if (!world.exploration.entered) return 'not-allowed'
      return isSpringTarget(cell) ? 'pointer' : 'crosshair'
    }
    if (inRect(LANDMARKS.generatorZone, cell)) return 'pointer'
    if (inRect(LANDMARKS.crystalZone, cell) && !world.progress.crystalCollected) return 'pointer'
    return tile === TILE.SOIL ? 'crosshair' : 'default'
  }

  /** 已经露面、值得让阿土走过去看的泉水（点击容错 ±1 格）。 */
  const isSpringTarget = (cell: Cell): boolean =>
    world.exploration.entered && !world.exploration.springFound
    && cell.y >= 19 && cell.y <= 21 && Math.abs(cell.x - LANDMARKS.spring.x) <= 1
    && world.tiles[cell.y][cell.x] === TILE.EMPTY && springVisible(world)

  /**
   * 裂纹岩施工委托：玩家指定目标，阿土自己沿真实通道走过去（走完才动手）。
   * 普通泥土由独立的阿土施工模块处理。
   */
  const orderBreakthrough = (cell: Cell): boolean => {
    if (!isShaftColumn(cell.x) || cell.y < HOME_FLOOR_Y || cell.y > SHAFT_LAST_Y) return false
    const tile = world.tiles[cell.y][cell.x]
    if (tile !== TILE.WEAK_ROCK && tile !== TILE.EMPTY) return false
    const e = world.exploration
    if (!e.pickaxeUpgraded) {
      if (tile !== TILE.WEAK_ROCK) return false
      if (!world.pods.length) { notify('先给伙伴安好小床，再来听岩壁里的水声。'); return true }
      if (e.clueFound) {
        if (e.shaftX !== cell.x) { notify('先顺着刚才发现水汽的裂纹探索吧，换上小铁镐就能挖了。'); return true }
        playWaterClue()
        notify('💧 滴答！裂纹里透出凉凉的水汽。换小铁镐试试！')
        return true
      }
      const route = routeTo({ x: cell.x, y: HOME_FLOOR_Y - 1 })
      if (!route) { notify('先挖通裂纹上方的泥土，让阿土能走到这里。'); return true }
      moveExplorer(route, () => {
        if (!inspectCrack(world, cell.x, HOME_FLOOR_Y)) return
        playWaterClue()
        renderer.playBurst((cell.x + 0.5) * TILE_SIZE, (HOME_FLOOR_Y - 0.5) * TILE_SIZE, { color: 0xaee5e0, count: 10, speed: 42, ring: true, ringRadius: 26 })
        renderer.playMoleReaction('滴答…水在下面！')
        notify('💧 滴答！裂纹里透出凉凉的水汽。换小铁镐试试！')
      })
      return true
    }
    if (!e.clueFound || e.shaftX !== cell.x) {
      notify('这一轮先挖通刚才那条裂纹吧，另一条以后再探索。')
      return true
    }
    if (shaftConnected(world)) {
      notify('梯道已经通到洞底啦，点“沿梯子下去”吧。')
      return true
    }
    if (shaftFrontier(world, cell.x) === null) {
      notify('先挖通裂纹上方的泥土，让阿土能走到梯口。')
      return true
    }
    // 学会了两次委托之后，一次点击就一口气挖到洞底（按钮和点击都通）。
    if (shaftChainReady(world)) { startChain(); return true }
    const target = shaftFrontier(world, cell.x)!
    const route = routeTo({ x: target.x, y: target.y - 1 })
    if (!route) { notify('先挖通上面的泥土，阿土才有路走近裂纹。'); return true }
    orderBreak(route, target, true)
    return true
  }

  /**
   * 连续施工：一次委托从当前梯段一路挖到洞底。
   * 每一段仍然是真实走位 + 挥镐 + 梯子接长，只是不再需要一段一点；
   * 演出中任何一次中断（切后台 / 超时）都会安全取消，回来再点一次接着挖。
   */
  const startChain = (): void => {
    const x = world.exploration.shaftX
    if (chaining || x === null || shaftConnected(world)) return
    chaining = true
    renderer.followShaft(x)
    notify(`⛏ 阿土开工！一口气挖到洞底（还剩 ${remainingSegments()} 段）`)
    chainStep()
  }

  const chainStep = (): void => {
    const x = world.exploration.shaftX
    if (!chaining || x === null) return
    const target = shaftConnected(world) ? null : shaftFrontier(world, x)
    if (!target) { chaining = false; traveling = false; pushProgress(); return }
    const route = routeTo({ x: target.x, y: target.y - 1 })
    if (!route) { chaining = false; traveling = false; notify('先挖通上面的泥土，阿土才有路走近裂纹。'); pushProgress(); return }
    orderBreak(route, target, false, chainStep)
  }

  /** 落镐：世界真正改变的那一下（挖开一格、梯子接长一段、记录撤销）。 */
  const breakSegment = (target: Cell): void => {
    const result = dig(world, target.x, target.y)
    if (!result.ok) {
      notify(describeDigFailure(result))
      renderer.refreshExploration()
      return
    }
    history.record({ kind: 'dig', x: target.x, y: target.y, tile: result.tile ?? TILE.WEAK_ROCK })
    renderer.playDigLoot(target, result.tile!)
    renderer.refreshTerrain([target])
    renderer.refreshExploration()
    renderer.refreshRooms()
    scheduleSave()
    growAfterWork()
    pushProgress()
    const x = world.exploration.shaftX ?? target.x
    if (shaftConnected(world)) {
      // 突破反馈：水声更近、洞口冒凉风、镜头一次拉出整条梯子，并弹出里程碑卡片
      playBreakthrough()
      renderer.playBreakthrough(x)
      renderer.playMoleReaction('通啦！下面有水！')
      notify('💧 哗啦——水声就在下面！梯道通到洞底啦，点“沿梯子下去”。')
      hooks.onMilestone?.({ emoji: '⛏', title: '岩层打通啦！', detail: '梯道一直通到洞底 · 点「沿梯子下去」' })
    } else {
      playRockHit()
      renderer.playPartnerReaction('atu', '凿开一块啦！')
      notify(`⛏ 岩壁破开一块，小梯子又接好一节（还剩 ${remainingSegments()} 段）。`)
    }
  }

  const handleTap = (cell: Cell): void => {
    if (mealing) { cancelMeal('🍽 大家先停一下，再点一次就好。'); return }
    if (siteEditor?.working) { notify('阿土正在修建洞室，可以拖图看看，或点“停下来”。'); return }
    if (partnerOrders?.active) { notify('伙伴正在工作，可以看地图，或点“停下来”再选新目标。'); return }
    if (atuOrders?.active) {
      if (atuOrders.matches(cell)) return
      atuOrders.cancel()
    }
    if (traveling) {
      notify(chaining ? '阿土正在一口气往下挖，马上就好！' : '阿土正在沿通道赶过去，马上就好！')
      return
    }
    if (lampMode) {
      const oldLamp = world.exploration.lamps.find(l => l.x === cell.x)
      if (cell.y >= 19 && cell.y <= 21 && oldLamp) {
        if (canRetrofitLamp(world, cell.x)) requestPartnerWork({ kind: 'lamp-retrofit', x: cell.x })
        else notify(oldLamp.wide ? '这盏已经有聚光灯罩啦，试试别的灯位。' : '这盏小灯已经装好啦。阿灯学会做聚光灯罩后，还能改进它。')
        return
      }
      if (cell.y < 19 || cell.y > 21 || !canPlaceWallLamp(world, cell.x)) {
        notify('先挖出三格高的空地，避开泉水和梯子，再点这里安壁灯。'); return
      }
      lampMode = false
      requestPartnerWork({ kind: 'lamp', x: cell.x })
      return
    }
    if (buildMode === 'pod') {
      // 点击格 = 舱体底边中间格；孩子只需点“想放床的地面”。
      candidate = podAnchorFromPointer(cell)
      pushBuild()
      return
    }
    if (buildMode === 'planter') {
      candidate = cell
      pushBuild()
      return
    }
    // 1) 裂纹岩 = 施工委托；普通泥土不经过这里
    if (orderBreakthrough(cell)) return

    // 2) 露面的泉水 = 出动目标：阿土自己沿挖通的通道走到水边
    if (isSpringTarget(cell) && springVisible(world) && !world.exploration.springFound) {
      const route = routeTo({ x: LANDMARKS.spring.x, y: 21 })
      if (!route) { notify('先挖开脚边的泥土，让阿土能走到水声那边。'); return }
      moveExplorer(route, () => {
        world.exploration.springFound = true
        // 第一次发现泉水：水花 + 光环 + 蹦一下 + 上升的四音，并弹里程碑卡片
        playSpringFound()
        renderer.playSpringDiscovery()
        renderer.playMoleReaction('找到水啦！')
        // 找到水：小泉从水里冒出来；小满如果还在等床，也在这一刻被看见。
        renderer.refreshFriends()
        talkingPartnerId = 'xiaoquan'
        notify('🎉 小泉从水里冒出来啦！他说：这水真甜，我帮你引上去。')
        // 第二间住处若是提前建好，小泉一出现就有床：把“入住”并进这一刻，
        // 在他的舱边放庆祝，而不是等下一间空床建成才有反馈。
        const xiaoquanBed = partnerBed(world, 'xiaoquan')
        if (xiaoquanBed) {
          renderer.playPodCelebration(xiaoquanBed.pod)
          hooks.onMilestone?.({ emoji: '🏠', title: '小泉住下啦！', detail: '发现地下泉水 · 他游上来，住处里已经留好他的床' })
        } else {
          hooks.onMilestone?.({ emoji: '💧', title: '发现地下泉水！', detail: `小泉来了 · 还有 ${waitingPartners(world)} 位朋友在等床` })
        }
      })
      return
    }
    if (world.exploration.entered && world.exploration.springFound
      && cell.y >= 19 && cell.y <= 21 && Math.abs(cell.x - LANDMARKS.spring.x) <= 1 && world.tiles[cell.y][cell.x] === TILE.EMPTY) {
      if (canSupplyWater(world)) { requestPartnerWork({ kind: 'water' }); return }
      renderer.playBurst((LANDMARKS.spring.x + 0.5) * TILE_SIZE, 21.5 * TILE_SIZE, { color: 0x8dedfd, count: 6, speed: 50 })
      return
    }

    // 3) 种植槽：熟了就能收，没熟只给一句提示
    const planter = planterAt(world, cell.x, cell.y)
    if (planter) {
      if (planter.growth < RIPE_STAGE) {
        notify(`🌱 还没长熟：你每干一件事，它就长高一档（现在 ${planter.growth}/${RIPE_STAGE}）。`)
        return
      }
      requestPartnerWork({ kind: 'harvest', ...cell })
      return
    }

    // 4) 能源石区域：收集（还埋在土里则自然落入挖掘流程）
    if (inRect(LANDMARKS.crystalZone, cell)) {
      if (!world.progress.crystalCollected) {
        const result = collectCrystal(world, cell.x, cell.y)
        if (result.ok) {
          renderer.refresh()
          renderer.playCrystalCollection()
          playCrystalCollected()
          scheduleSave()
          pushProgress()
          hooks.onMessage('💎 能源石收好啦！')
          return
        }
        // not-revealed：泥土还盖着，继续按挖掘处理
      } else if (cell.x === LANDMARKS.crystal.x && cell.y === LANDMARKS.crystal.y && world.tiles[cell.y][cell.x] !== TILE.SOIL) {
        // 已收集：给一点点小星光，不再重复提示
        renderer.playBurst((LANDMARKS.crystal.x + 0.5) * TILE_SIZE, (LANDMARKS.crystal.y + 0.5) * TILE_SIZE, {
          color: 0x8dedfd,
          count: 6,
          speed: 50,
        })
        return
      }
      // 已收集 + 点的是泥土 → 保持自由挖掘
    }

    // 5) 能源核心区域：修复 / 提示 / 已在运转时给个小火花
    if (inRect(LANDMARKS.generatorZone, cell)) {
      const result = repairCore(world, cell.x, cell.y)
      if (result.ok) {
        discovering = true
        hooks.onDiscovery?.(true)
        renderer.playRepairCelebration()
        renderer.refresh()
        scheduleSave()
        pushProgress()
        return
      }
      if (result.reason === 'need-crystal') {
        playUnavailable()
        hooks.onMessage('机器还没有能量：先找到能源石吧')
      } else {
        renderer.playBurst((LANDMARKS.generator.x + 0.5) * TILE_SIZE, (LANDMARKS.generator.y + 0.5) * TILE_SIZE, {
          color: 0xffd9a0,
          count: 6,
          speed: 50,
        })
      }
      return
    }

    // 6) 空地移动、普通泥土施工：规划和单次行动从会话层分离。
    if (world.tiles[cell.y][cell.x] === TILE.EMPTY) { atuOrders?.request(cell, 'move'); return }
    atuOrders?.request(cell, 'soil')
  }

  const completeSoilDig = (cell: Cell): void => {
    const beforeDone = missionSummary(world).done
    const readyBefore = new Set(BUILDING_SITES.filter(site => siteBlueprintVisible(world, site)).map(site => site.id))
    const result = dig(world, cell.x, cell.y)
    if (!result.ok) {
      playUnavailable()
      hooks.onMessage(describeDigFailure(result))
      return
    }
    history.record({ kind: 'dig', x: cell.x, y: cell.y, tile: result.tile ?? TILE.SOIL })
    playSoilDig()
    renderer.playDigLoot(cell, result.tile!)
    const revealedNow = missionSummary(world).done > beforeDone
    const revealedSite = BUILDING_SITES.find(site => !readyBefore.has(site.id) && siteBlueprintVisible(world, site))
    // 能源石露出来时需要重建地标；普通挖掘只刷新本格与四邻的边缘
    if (revealedNow) renderer.refresh()
    else renderer.refreshTerrain([cell])
    renderer.playDigEffect(cell)
    renderer.refreshExploration()
    scheduleSave()
    growAfterWork()
    pushProgress()
    const relic = relicAt(cell.x, cell.y)
    if (relic) {
      // 旧物自动进入背包与大厅收藏架，不增加必做任务或重复物品。
      renderer.refreshRelics()
      renderer.playBurst((cell.x + 0.5) * TILE_SIZE, (cell.y + 0.5) * TILE_SIZE, { color: 0xffe6ad, count: 14, speed: 66, ring: true, ringRadius: 26 })
      hooks.onMessage(`挖到「${relic.name}」！已收进物品栏，回家还能在收藏架上看到它。`)
    } else if (revealedNow) {
      hooks.onMessage('💎 能源石露出来了！')
    } else if (result.tile === TILE.WEAK_ROCK) {
      hooks.onMessage(shaftConnected(world) ? '🪜 梯道接到洞底啦！点“沿梯子下去”。' : '⛏ 裂纹岩挖开啦！小梯子也接好了一段。')
    } else if (revealedSite) {
      // 房间本体清空后先让“发现旧住处”成为剧情反馈，再把蓝图放回地图。
      // 连接走道仍留给开工后的阿土施工，避免蓝图像凭空贴上去。
      renderer.refreshRooms()
      renderer.playBurst((revealedSite.x + revealedSite.w / 2) * TILE_SIZE, (revealedSite.y + revealedSite.h - 1) * TILE_SIZE, {
        color: 0xa9d9c2, count: 12, speed: 36, ring: true, ringRadius: 22,
      })
      renderer.playMoleReaction('咦？这里有旧住处的痕迹！')
      notify(`🔨 阿土发现了${revealedSite.name}的旧痕迹。蓝图出现了，点它看看能不能修好。`)
    } else if (!siteEditor?.working) {
      notify(`🎒 找到${materialText(digLoot(cell.x, cell.y, result.tile!))}，放进物品栏啦！`)
    }
  }

  atuOrders = new AtuOrders({
    world: () => world,
    view: {
      travel: (route, done, step) => renderer.playExplorationTravel(route, done, step),
      soil: (plan, strike, done) => renderer.playSoilWork(plan, strike, done),
      cancel: () => { renderer.cancelExplorationAnimation(); renderer.refreshExploration() },
      preview: (target, stand, lift, text) => renderer.setAtuTarget(target, stand, lift, text),
    },
    busy: value => {
      traveling = value
      if (value) beginOrder('travel')
      else { endOrder(); renderer.refreshExploration() }
      pushProgress()
    },
    changed: () => { scheduleSave() },
    dig: completeSoilDig,
    notify,
    failure: result => { playUnavailable(); return describeDigFailure(result) },
  })

  roomEditor = new RoomEditor({
    world: () => world,
    busy: () => traveling,
    emit: state => hooks.onRooms?.(state),
    preview: value => renderer.setRoomPreview(value),
    commit: change => {
      if (change.after && change.after.status !== 'blueprint') playBuildComplete()
      history.record({ kind: 'room', change }); renderer.refreshRooms(); renderer.refreshPods(); renderer.refreshFarm(); renderer.refreshFriends()
      const pod = change.addedPods?.[0]
      if (pod) {
        // 扩建住处新增床位时，和预设洞室、睡眠舱走同一套入住演出与里程碑。
        resting = false
        renderer.playPodEntrance(pod, () => { resting = true; renderer.playPodCelebration(pod); pushProgress() })
        const card = lodgingMilestone(pod.id, { emoji: '🛏️', title: '第一夜的家', detail: '灯亮着，床也铺好了 · 楼下好像有声音' })
        if (card) hooks.onMilestone?.(card)
      }
      scheduleSave(); pushProgress()
    },
    notify,
  })
  roomEditor.refresh()

  siteEditor = new SiteEditor({
    world: () => world, busy: () => traveling,
    emit: state => hooks.onSites?.(state), preview: value => renderer.setRoomPreview(value),
    focus: site => renderer.focusOn((site.x + site.w / 2) * TILE_SIZE, (site.y + site.h / 2) * TILE_SIZE, 'building'),
    request: (cell, kind, done) => { atuOrders!.request(cell, kind, done); return atuOrders!.active },
    cancel: () => atuOrders?.cancel(),
    commit: change => {
      playBuildComplete()
      history.record({ kind: 'site', change })
      renderer.refreshRooms(); renderer.refreshPods(); renderer.refreshFarm(); renderer.refreshFriends()
      const pod = change.room?.addedPods?.[0]
      if (pod) {
        resting = false
        renderer.playPodEntrance(pod, () => { resting = true; renderer.playPodCelebration(pod); pushProgress() })
        const card = lodgingMilestone(pod.id, { emoji: '🛏', title: '我们的小窝建好啦！', detail: '灯亮了，伙伴有床睡了' })
        if (card) hooks.onMilestone?.(card)
      }
      const built = siteById(change.site.id)
      if (built) renderer.playBurst((built.x + built.w / 2) * TILE_SIZE, (built.y + built.h - 1) * TILE_SIZE, { color: 0xffdc95, count: 10 })
      if (change.site.id === KITCHEN_SITE_ID || change.site.id === DINING_SITE_ID) {
        const ready = sharedMealReady(world)
        hooks.onMilestone?.({
          emoji: ready ? '🍲' : built?.icon ?? '🔨',
          title: ready ? '小厨房开张啦！' : `${built?.name ?? '设施'}建好啦`,
          detail: ready ? '灶台和餐桌都好了 · 可以一起吃饭啦' : '再配上另一件，就能围坐吃饭。',
        })
        notify(ready ? '🍲 灶台和餐桌都好了！收一份菜，就能做饭请大家吃。' : `${built?.name ?? '设施'}修好啦！`)
      }
      growAfterWork(); scheduleSave(); pushProgress()
    },
    notify,
  })
  siteEditor.refresh()

  const completePartnerWork = (plan: WorkPlan): boolean => {
    const target = plan.target
    if (target.kind === 'harvest') {
      if (!harvestPlanter(world, target.x, target.y)) return false
      renderer.refreshFarm(); playHarvest(); renderer.playHarvest(target)
      renderer.playPartnerReaction('xiaoman', '收好啦！新苗也种下了。')
      notify(`🥕 小满收了一份菜！家里有 ${world.farm.food} 份吃的。`)
      if (world.farm.harvests === 1) hooks.onMilestone?.({ emoji: '🥕', title: '第一份收成！', detail: '小满收好菜啦 · 可以请大家吃饭' })
    } else if (target.kind === 'water') {
      if (!canSupplyWater(world)) return false
      world.farm.waterSupplied = true
      activateGardens(world); renderer.refreshRooms()
      renderer.refreshFarm(); playWaterSupplied(); renderer.playSupplyWater()
      renderer.playPartnerReaction('xiaoquan', '接好啦！水能流回家了。')
      notify('🚰 小泉把水管接好啦！第一层可以种菜了。')
      hooks.onMilestone?.({ emoji: '🚰', title: '水到菜园啦！', detail: '小泉接通了水管 · 泉水边可以种菜了' })
    } else if (target.kind === 'lamp-retrofit') {
      if (!retrofitLamp(world, target.x)) return false
      history.record({ kind: 'lamp-retrofit', x: target.x })
      renderer.refreshExploration(); growAfterWork()
      playBuildComplete()
      renderer.playPartnerReaction('adeng', '灯罩装好啦，照得更远了！')
      notify('🏮 聚光灯罩装好啦！左右各能照4格，可以撤销加装。')
    } else {
      if (!canPlaceWallLamp(world, target.x)) return false
      world.exploration.lamps.push({ x: target.x, y: 19, ...(hasWideLampAbility(world) ? { wide: true as const } : {}) }); history.record({ kind: 'lamp', x: target.x, y: 19 })
      renderer.refreshExploration(); growAfterWork()
      playBuildComplete()
      renderer.playPartnerReaction('adeng', '这段路也亮啦！')
      notify(hasWideLampAbility(world) ? '🏮 阿灯装好了聚光灯！左右各能照4格。' : '🏮 阿灯装好了小壁灯！继续挖，或再选一处安灯。')
    }
    scheduleSave(); pushProgress(); return true
  }
  partnerOrders = new PartnerOrders({
    world: () => world,
    view: {
      travel: (id, route, step, done) => renderer.playPartnerTravel(id, route, step, done),
      act: (plan, hit, done) => renderer.playPartnerWork(plan, hit, done),
      cancel: () => renderer.cancelPartnerWork(),
    },
    state: state => {
      currentWork = state
      traveling = state !== null; supplying = state?.worker === 'xiaoquan'
      if (state) beginOrder('travel')
      else { endOrder(); renderer.refreshFriends(); scheduleSave() }
      hooks.onWork?.(state); pushProgress()
    },
    complete: completePartnerWork, changed: scheduleSave, notify,
  })
  const requestPartnerWork = (target: WorkTarget): void => {
    if (traveling || partnerOrders?.active) return
    siteEditor?.close()
    closeConversation(); roomEditor?.close(); buildMode = 'none'; lampMode = false; candidate = null; hoverBuild = null
    renderer.setHoverCell(null); renderer.setAtuTarget(null)
    partnerOrders?.request(target)
    pushProgress()
  }
  const toggleLamp = (): void => {
    if (mealBusy() || !world.exploration.springFound || traveling) return
    siteEditor?.close()
    roomEditor?.close(); closeConversation()
    lampMode = !lampMode; buildMode = 'none'; candidate = null; pushProgress()
    notify(lampMode ? hasWideLampAbility(world) ? '🏮 点旧灯加装，或点挖空的洞壁装聚光灯，左右各照4格。' : '🏮 点挖空的泉水层洞壁，安一盏小灯。再点工具可以收起。' : '⛏ 继续自由挖掘吧。')
  }

  /** 从引导直接去种菜：打开泉边的预设菜园。 */
  const startPlanting = (): void => {
    if (mealBusy() || traveling || !isFarmUnlocked(world)) return
    diggingSites = false
    roomEditor?.close(); closeConversation()
    lampMode = false; buildMode = 'none'; candidate = null; hoverBuild = null
    renderer.setHoverCell(null); renderer.setLampPreview(null); renderer.setAtuTarget(null)
    renderer.focusWater()
    siteEditor?.open('water')
    pushBuild(); pushProgress()
  }

  const moveExplorer = (route: Cell[], onArrived?: () => void): void => {
    traveling = true
    pushProgress()
    beginOrder('travel')
    const token = order
    renderer.playExplorationTravel(route, () => {
      // 已经被中断（切后台 / 超时 / 看门狗）：这一趟不算数，世界保持原样。
      if (order !== token) return
      endOrder()
      world.exploration.explorer = { ...route[route.length - 1] }
      traveling = false
      onArrived?.()
      renderer.refreshExploration(); scheduleSave(); pushProgress()
    }, cell => { if (order === token) { world.exploration.explorer = { ...cell }; scheduleSave() } })
  }

  /**
   * 一次破岩委托：阿土沿真实通道走到梯段上方，挥镐，落镐那一刻才改世界。
   * 走路和挥镐期间都收紧输入，避免隔空多挖或演出中改地图；
   * next 只在连续施工时给出——那一段挖完立刻接着委托下一段。
   */
  const orderBreak = (route: Cell[], target: Cell, follow: boolean, next?: () => void): void => {
    traveling = true
    pushProgress()
    if (follow) renderer.followShaft(target.x)
    beginOrder('travel')
    const travelToken = order
    renderer.playExplorationTravel(route, () => {
      if (order !== travelToken) return
      endOrder()
      world.exploration.explorer = { ...route[route.length - 1] }
      beginOrder('swing')
      const swingToken = order
      renderer.playRockBreak(target, () => {
        if (order !== swingToken) return
        endOrder()
        breakSegment(target)
        if (next) next()
        else { traveling = false; pushProgress() }
      })
    }, cell => { if (order === travelToken) { world.exploration.explorer = { ...cell }; scheduleSave() } })
  }

  let inputBlocked = false
  const pointer = attachPointerControls(renderer.canvasElement, {
    onTap: (screen) => {
      if (openingActive || inputBlocked) return
      // 收起对话的这次点击不传给地形，避免孩子读完话顺手误挖。
      if (discovering || talkingPartnerId) { closeConversation(); return }
      if (mealing) { cancelMeal('🍽 大家先停一下，再点一次就好。'); return }
      if (renderer.isOverview) {
        hooks.onMessage('这是家园全景，点“回到家园”就能继续挖掘和建造。')
        return
      }
      const cell = renderer.tileAtScreen(screen)
      if (cell && world.progress.coreRepaired && !traveling && buildMode === 'none' && !lampMode && inRect(COLLECTION_SHELF, cell)) {
        hooks.onBagRequested?.(); return
      }
      if (cell && !traveling && buildMode === 'none' && !lampMode) {
        const site = siteAt(cell)
        if (site && siteBlueprintVisible(world, site) && !siteBuilt(world, site) && !planterAt(world, cell.x, cell.y)) {
          diggingSites = false
          renderer.setHoverCell(null)
          closeConversation(); siteEditor?.select(site.id); pushBuild(); pushHighlight(); return
        }
      }
      if (roomEditor?.active && (!cell || roomEditor.tap(cell))) return
      // 实心地形始终保留挖掘/施工命中，不让角色的触屏容错抢走旁边岩块。
      const facility = cell && (planterAt(world, cell.x, cell.y) || (world.exploration.springFound && cell.y >= 19 && Math.abs(cell.x - LANDMARKS.spring.x) <= 1))
      if (!facility && !traveling && buildMode === 'none' && !lampMode && cell && world.tiles[cell.y][cell.x] === TILE.EMPTY) {
        const partner = renderer.partnerAtScreen(screen)
        if (partner) { talkToPartner(partner); return }
      }
      closeConversation()
      if (cell) handleTap(cell)
    },
    onPanBy: (delta) => { if (openingActive || inputBlocked) return; closeConversation(); renderer.panBy(delta.x, delta.y) },
    onHover: (screen) => {
      if (openingActive || inputBlocked) return
      if (discovering || talkingPartnerId) { renderer.setHoverCell(null); renderer.hoverPartner(null); renderer.setCursor('default'); return }
      if (renderer.isOverview) {
        renderer.setHoverCell(null)
        renderer.setCursor('default')
        return
      }
      const cell = screen ? renderer.tileAtScreen(screen) : null
      if (lampMode) { renderer.setLampPreview(cell); renderer.setHoverCell(null); renderer.hoverPartner(null); renderer.setCursor('copy'); return }
      if (roomEditor?.active) { renderer.hoverPartner(null); renderer.setHoverCell(null); renderer.setCursor('copy'); return }
      const site = cell && siteAt(cell)
      if (!traveling && buildMode === 'none' && site && siteBlueprintVisible(world, site) && !siteBuilt(world, site) && !planterAt(world, cell!.x, cell!.y)) {
        renderer.hoverPartner(null); renderer.setHoverCell(null); renderer.setCursor('pointer'); return
      }
      renderer.hoverPartner(screen && !traveling ? renderer.partnerAtScreen(screen) : null)
      if (screen && cell && !traveling && buildMode === 'none' && !lampMode && world.tiles[cell.y][cell.x] === TILE.EMPTY && renderer.partnerAtScreen(screen)) {
        renderer.setHoverCell(null)
        renderer.setCursor('pointer')
        return
      }
      renderer.setHoverCell(buildMode === 'none' ? cell : null)
      renderer.setCursor(buildMode === 'none' ? pickCursor(cell) : 'copy')
      if (buildMode !== 'none') {
        if (hoverBuild?.x === cell?.x && hoverBuild?.y === cell?.y) return
        hoverBuild = cell
        pushBuild()
      }
    },
    onZoom: (delta, anchor) => { if (!openingActive && !inputBlocked) { closeConversation(); renderer.zoomBy(delta, anchor) } },
  })

  /**
   * 切后台 / 回到前台：
   * - 切成后台时先把没播完的委托安全取消（世界不变、输入解锁），再落盘一份一致的存档；
   * - 回到前台时补一句提示，并立刻检查有没有超时卡住的演出。
   */
  const onVisibilityChange = (): void => {
    gameAudio.setHidden(document.visibilityState === 'hidden')
    if (document.visibilityState === 'hidden') {
      if (discovering) closeConversation()
      if (openingActive) renderer.finishOpening()
      pointer.reset()
      if (mealing) cancelMeal()
      if (order) {
        resumeHint = currentWork ? `⏸ ${currentWork.name}停下来等你，再点设施继续。` : chaining
          ? `⏸ 阿土停在梯道里等你 · 点「一路挖到底」接着挖（还剩 ${remainingSegments()} 段）`
          : '⏸ 阿土停下来等你，回来再点一次就好。'
      }
      abortOrder()
      void persist()
      return
    }
    // 回到前台：立刻检查有没有卡住的演出，并把后台期间没落盘的改动补写一次。
    watchdogTick()
    if (savePending) void persist()
    if (resumeHint) {
      const hint = resumeHint
      resumeHint = ''
      notify(hint)
    }
  }
  const onPageHide = (): void => { gameAudio.setHidden(true); if (openingActive) renderer.finishOpening(); partnerOrders?.cancel(false); if (mealing) cancelMeal(); void persist() }
  /** 窗口失焦不会停帧，只把指针手势复位，避免拖到一半的拖动卡住下一次点击。 */
  const onWindowBlur = (): void => { pointer.reset() }
  const undoLast = (): void => {
    const restored = history.undo(world)
    if (!restored) { playUnavailable(); notify('这里有伙伴、设施或回家的路，先留着这片空地。'); return }
    playUndo()
    if (restored.kind === 'pod') { resting = world.pods.length > 0; renderer.refresh() }
    else if (restored.kind === 'planter') renderer.refreshFarm()
    else if (restored.kind === 'lamp' || restored.kind === 'lamp-retrofit') renderer.refreshExploration()
    else if (restored.kind === 'room' || restored.kind === 'site') { resting = world.pods.length > 0; renderer.refreshRooms(); renderer.refreshPods(); renderer.refreshFarm(); renderer.refreshFriends() }
    else { renderer.refreshTerrain([restored]); renderer.playDigEffect(restored); renderer.refreshRelics() }
    renderer.refreshExploration(); scheduleSave(); pushProgress(); hooks.onMessage('↶ 已撤销上一步')
  }
  const cancelAction = (): void => {
    gameAudio.stopEffects()
    if (cancelMeal('🍽 大家先停一下，再点一次就好。')) return
    if (siteEditor?.working) { siteEditor.cancel(); notify('阿土停下来啦，已挖的地方和找到的材料都保留。'); return }
    if (siteEditor?.active) { siteEditor.close(); return }
    if (partnerOrders?.active) { partnerOrders.cancel(); return }
    if (roomEditor?.active) { if (atuOrders?.active) abortOrder('阿土停下来啦。'); else roomEditor.close(); return }
    if (talkingPartnerId || discovering) { closeConversation(); return }
    if (buildMode !== 'none' || lampMode) {
      buildMode = 'none'; lampMode = false; candidate = null; hoverBuild = null; pushProgress()
    }
    abortOrder('阿土停下来啦，点新的目标继续。')
    renderer.setAtuTarget(null)
  }
  const confirmPod = (): void => {
      if (buildMode !== 'pod' || !candidate) return
      const check = canPlacePod(world, candidate.x, candidate.y)
      if (!check.ok) { playUnavailable(); hooks.onMessage(BUILD_MESSAGES[check.reason], 'warning'); return }
      for (const [id, p] of Object.entries(world.workers)) {
        const route = routeBeforePod(world, p, candidate)
        if (!route) { notify('先给伙伴留出退路，再在这里安床。'); return }
        if (route.length > 1) { partnerOrders?.clearBed(id as WorkerId, route, confirmPod); return }
      }
      const actor = world.exploration.explorer
      if (actor) {
        const route = routeBeforePod(world, actor, candidate)
        if (!route) { notify('阿土要先让开，也要留条回家的路。'); return }
        if (route.length > 1) { moveExplorer(route, confirmPod); return }
      }
      const pod = placePod(world, candidate.x, candidate.y)
      if (!pod) return
      playBuildComplete()
      history.record({ kind: 'pod', id: pod.id })
      buildMode = 'none'
      candidate = null
      hoverBuild = null
      resting = false
      // 只刷新舱体：保留伙伴当前站位，随后沿真实通道播放入场。
      // 新舱的两位（找到水之后搬来的朋友）先在大厅等着，再由入场演出带进被窝。
      renderer.refreshPods()
      renderer.refreshFriends(pod.id)
      renderer.playBurst((pod.x + 1.5) * TILE_SIZE, (pod.y + 1) * TILE_SIZE, { color: 0xffdc95, count: 10 })
      scheduleSave()
      pushProgress()
      // 这次搬进来的是谁：按床位顺序取名单，孩子听到的是名字而不是"两位伙伴"。
      const movedIn = availablePartners(world)
        .filter((partner) => partnerBed(world, partner.id)?.pod.id === pod.id)
        .filter((partner) => partner.id !== 'atu')
        .map((partner) => partner.name)
        .join('和')
      // 第一层只住阿土和阿灯；小满要等到第一次下到泉水层才遇见，她在下面的洞穴里等床。
      const stillWaiting = waitingPartnerList(world).map((partner) => partner.name).join('和')
      hooks.onMessage(`🛏️ ${movedIn}的小床安好啦！伙伴有住处，也能来帮忙。`)
      renderer.playPodEntrance(pod, () => {
        resting = true
        renderer.playPodCelebration(pod)
        const card = lodgingMilestone(pod.id, { emoji: '🛏️', title: '第一夜的家', detail: '灯亮着，床也铺好了 · 楼下好像有声音' })
        if (card) hooks.onMilestone?.(card)
        pushProgress()
        renderer.refreshExploration()
        hooks.onMessage(stillWaiting ? `🛏️ 床位安好啦！${stillWaiting}也想住下。伙伴随时能来帮忙。` : '🛏️ 床位安好啦！伙伴睡下啦，楼下好像有声音……')
      })
  }

  const onKeyDown = (event: KeyboardEvent): void => {
    if (inputBlocked) return
    if (openingActive) { if (event.key === 'Escape') { event.preventDefault(); renderer.finishOpening() }; return }
    if (event.key === 'Escape') { event.preventDefault(); cancelAction() }
  }
  document.addEventListener('visibilitychange', onVisibilityChange)
  window.addEventListener('pagehide', onPageHide)
  window.addEventListener('blur', onWindowBlur)
  window.addEventListener('keydown', onKeyDown)

  let openingStarted = false
  const startOpening = (): void => {
    if (!newGame || openingStarted) return
    openingStarted = true
    openingActive = true
    hooks.onOpening?.({ active: true, caption: '' })
    renderer.playOpening(() => {
      if (!openingActive) return
      openingActive = false
      pointer.reset()
      hooks.onOpening?.({ active: false, caption: '' })
      pushProgress()
      // 新的一局从开场结束起就该有一份存档；中途关掉也不至于下次又从头。
      dirty = true
      void persist()
    }, caption => hooks.onOpening?.({ active: true, caption }))
  }
  if (!newGame) hooks.onOpening?.({ active: false, caption: '' })
  else if (!options.deferOpening) startOpening()

  /** 明确选择“重新开始”：清掉旧档，世界和会话状态都回到初始值。 */
  const resetToNewGame = (): void => {
    gameAudio.stopEffects()
    partnerOrders?.cancel(false)
    if (atuOrders?.active) atuOrders.cancel()
    roomEditor?.close()
    siteEditor?.cancel(); siteEditor?.close()
    endOrder()
    pointer.reset()
    closeConversation()
    world = createInitialWorld()
    world.exploration.explorer = initialAtuPosition(world)
    initializeWorkers(world)
    history.clear()
    savedAt = ''
    loadError = ''
    loadedFromSave = false
    saveBlocked = false
    savePending = false
    dirty = false
    newGame = true
    openingStarted = false
    openingActive = false
    inputBlocked = false
    resting = false
    traveling = false
    chaining = false
    supplying = false
    powering = false
    lampMode = false
    buildMode = 'none'
    diggingSites = false
    candidate = null
    hoverBuild = null
    currentWork = null
    window.clearTimeout(mealTimer)
    mealTimer = undefined
    mealing = false
    lastMessage = ''
    lastMessageAt = 0
    resumeHint = ''
    renderer.setWorld(world)
    renderer.focusHome()
    renderer.setAtuTarget(null)
    renderer.setHighlight(null)
    renderer.setHoverCell(null)
    hooks.onWork?.(null)
    hooks.onOpening?.({ active: false, caption: '' })
    pushProgress()
  }
  const startNewGame = async (): Promise<void> => {
    // 先停掉可能在排队的旧档落盘，否则清掉后又被写回去。
    window.clearTimeout(saveTimer)
    saveTimer = undefined
    savePending = false
    dirty = false
    if (store) {
      try {
        await store.clear()
      } catch {
        hooks.onMessage('旧存档没能清掉，新的进度会覆盖它。', 'warning')
      }
    }
    resetToNewGame()
  }

  return {
    setInputBlocked: blocked => {
      inputBlocked = blocked; pointer.reset()
      if (blocked) { renderer.setHoverCell(null); renderer.hoverPartner(null) }
    },
    focusCollection: () => {
      renderer.focusOn((COLLECTION_SHELF.x + COLLECTION_SHELF.w / 2) * TILE_SIZE, (COLLECTION_SHELF.y + .5) * TILE_SIZE)
      notify('收藏架在这里。挖到的旧物会自动摆上去，点它能翻看小故事。')
    },
    focusRelic: id => {
      const relic = RELICS.find(r => r.id === id)
      if (!relic) return
      if (!traveling) {
        siteEditor?.close(); roomEditor?.close(); buildMode = 'none'; lampMode = false; diggingSites = true
        candidate = null; hoverBuild = null; pushProgress()
      }
      renderer.focusOn((relic.x + .5) * TILE_SIZE, (relic.y + .5) * TILE_SIZE)
      notify('这一带的泥土里有件旧物。沿着通路慢慢挖过去吧！')
    },
    startOpening,
    titleSave: (): SaveStatus => loadedFromSave
      ? { status: 'ready', summary: summarizeSave(world), savedAt }
      : loadError
        ? { status: 'broken', error: loadError }
        : { status: 'none' },
    startNewGame,
    skipOpening: () => renderer.finishOpening(),
    enableOpeningSound: () => renderer.enableOpeningSound(),
    findPartner: id => {
      const p = world.workers[id]
      if (!p) return
      renderer.focusOn((p.x + .5) * TILE_SIZE, (p.y + .3) * TILE_SIZE)
      renderer.playPartnerReaction(id, currentWork?.worker === id ? '我在这里忙着呢！' : '我在这里！点设施，我来帮忙。')
    },
    openRooms: () => {
      if (mealBusy() || !world.progress.coreRepaired || traveling) return
      closeConversation(); buildMode = 'none'; lampMode = false; candidate = null; hoverBuild = null; pushBuild()
      diggingSites = false
      renderer.setHoverCell(null); renderer.setLampPreview(null); renderer.setAtuTarget(null)
      siteEditor?.open(cameraView.layer === 'water' ? 'water' : 'home', true)
      pushHighlight()
    },
    prepareNest,
    closeRooms: () => { siteEditor?.close(); roomEditor?.close(); pushHighlight() },
    selectSite: id => { closeConversation(); diggingSites = false; siteEditor?.select(id); pushBuild(); pushHighlight() },
    siteKind: kind => siteEditor?.choose(kind),
    buildSite: () => siteEditor?.build(),
    roomKind: kind => roomEditor?.chooseKind(kind),
    roomWidth: delta => roomEditor?.resize(delta),
    saveRoom: () => roomEditor?.save(),
    removeRoom: () => roomEditor?.remove(),
    selectRoom: id => {
      if (traveling || siteEditor?.working || !roomEditor) return
      siteEditor?.close()
      roomEditor.active = true
      const r = roomEditor?.select(id)
      if (r) renderer.focusOn((r.x + r.w / 2) * TILE_SIZE, (r.y + r.h / 2) * TILE_SIZE)
    },
    newRoom: () => roomEditor?.newRoom(),
    cancelAction,
    findAtu: () => { closeConversation(); renderer.findAtu() },
    talkToPartner,
    closePartnerConversation: closeConversation,
    partnerAction: () => {
      if (!talkingPartnerId || traveling || buildMode !== 'none' || lampMode) return
      const conversation = partnerConversation(world, talkingPartnerId)
      if (conversation?.action?.id === 'prepare-nest') prepareNest()
      else if (conversation?.action?.id === 'upgrade-pickaxe') upgradeTool()
      else if (conversation?.action?.id === 'learn-wide-lamp' && upgradePartner(world, 'adeng', WIDE_LAMP_ID)) {
        renderer.playPartnerReaction('adeng', '学会啦！选一盏灯，我来加装。')
        scheduleSave(); pushProgress(); notify('🏮 阿灯学会做聚光灯罩啦！选“去布置聚光灯”，点旧灯加装，或安装新灯。')
      }
      else if (conversation?.action?.id === 'place-wide-lamp') {
        toggleLamp()
        if (cameraView.layer !== 'water' || cameraView.overview) {
          const lamp = world.exploration.lamps.find(l => !l.wide) ?? world.exploration.lamps[0]
          if (lamp) renderer.focusOn((lamp.x + .5) * TILE_SIZE, 20.5 * TILE_SIZE)
          else renderer.focusWater()
        }
      }
      else if (conversation?.action?.id === 'look-at-clue') { closeConversation(); focusCurrentClue() }
    },
    setBuildMode: (mode) => {
      if (mealBusy()) return
      if (siteEditor?.working) siteEditor.cancel()
      siteEditor?.close()
      roomEditor?.close()
      if (atuOrders?.active) atuOrders.cancel()
      if (traveling) return
      diggingSites = mode === 'none'
      closeConversation()
      lampMode = false
      renderer.setLampPreview(null)
      if (mode === 'pod' && (!world.progress.coreRepaired || !canBuildMorePods(world))) return
      if (mode === 'planter' && !isFarmUnlocked(world)) return
      buildMode = buildMode === mode ? 'none' : mode
      candidate = null
      hoverBuild = null
      renderer.setHoverCell(null)
      pushBuild()
    },
    confirmBuild: () => {
      if (mealBusy() || traveling) return
      if (buildMode === 'planter') {
        if (!candidate) return
        if (candidate.y !== 21) { notify('新菜槽放在第二层泉水边的地面上吧。'); return }
        const check = canPlacePlanter(world, candidate.x, candidate.y)
        if (!check.ok) { playUnavailable(); hooks.onMessage(BUILD_MESSAGES[check.reason], 'warning'); return }
        if (!canAfford(world, PLANTER_COST)) { playUnavailable(); notify(`需要${materialText(PLANTER_COST)}，挖泥土找找吧。`); return }
        const planter = placePlanter(world, candidate.x, candidate.y)
        if (!planter) return
        changeMaterials(world, PLANTER_COST, -1)
        history.record({ kind: 'planter', id: planter.id, cost: { ...PLANTER_COST } })
        candidate = null
        pushBuild()
        renderer.refreshFarm()
        playBuildComplete()
        renderer.playBurst((planter.x + 0.5) * TILE_SIZE, (planter.y + 0.5) * TILE_SIZE, { color: 0x9ed7a4, count: 10 })
        scheduleSave()
        pushProgress()
        notify('🌱 在菜园种下一槽菜啦！你每干一件事，它就长高一档。')
        return
      }
      confirmPod()
    },
    zoomBy: (delta) => { closeConversation(); renderer.zoomBy(delta) },
    centerOnHome: () => {
      closeConversation()
      siteEditor?.close()
      // 种植槽属于第二层；回第一层时收起，避免留下一个点不动的工具。
      if (buildMode === 'planter') { buildMode = 'none'; candidate = null; hoverBuild = null; pushBuild() }
      renderer.focusHome()
    },
    lookDown: () => {
      siteEditor?.close()
      roomEditor?.close()
      closeConversation()
      lampMode = false; renderer.setLampPreview(null)
      buildMode = 'none'
      candidate = null
      hoverBuild = null
      pushBuild()
      renderer.setHoverCell(null)
      renderer.focusWater()
    },
    showOverview: () => {
      siteEditor?.close()
      roomEditor?.close()
      closeConversation()
      lampMode = false; renderer.setLampPreview(null)
      buildMode = 'none'
      candidate = null
      hoverBuild = null
      pushBuild()
      renderer.setHoverCell(null)
      renderer.focusOverview()
    },
    undo: () => {
      if (mealBusy()) return
      if (siteEditor?.working) { siteEditor.cancel(); notify('先停下施工了，再点一次撤销。'); return }
      siteEditor?.close()
      if (partnerOrders?.active) { partnerOrders.cancel(); notify('先停下这项工作了，再点一次撤销。'); return }
      roomEditor?.close()
      if (atuOrders?.active) atuOrders.cancel()
      if (traveling) { hooks.onMessage('等阿土站稳，再撤销吧。'); return }
      const pending = history.peek(), actor = world.exploration.explorer
      if (pending?.kind === 'dig' && actor && pending.x === actor.x && (pending.y === actor.y || pending.y === actor.y - 1)) {
        const retreat = [-1, 1, -2, 2].map(dx => ({ x: actor.x + dx, y: actor.y }))
          .map(to => atuRoute(world, actor, to)).find(route => route !== null)
        if (!retreat) { notify('阿土还没地方退开，先挖出旁边的通道，再撤销。'); return }
        moveExplorer(retreat, () => { undoLast() })
        return
      }
      undoLast()
    },
    focusTarget: focusCurrentClue,
    upgradeTool,
    digToBottom: () => {
      if (traveling || !shaftChainReady(world)) return
      startChain()
    },
    travel: () => {
      if (mealBusy() || traveling || !shaftConnected(world) || !world.exploration.explorer) return
      lampMode = false
      const down = world.exploration.explorer.y !== 21
      const route = atuRoute(world, world.exploration.explorer, { x: world.exploration.shaftX!, y: down ? 21 : 11 }, true)
      if (!route) { notify('通道还没连好，先检查梯子和地面。'); return }
      moveExplorer(route, () => {
        if (down) {
          world.exploration.entered = true
          renderer.focusWater()
          renderer.playMoleReaction('有只小兔子！')
          if (world.exploration.metXiaoman) playLayerArrival()
          // 第一次下楼才自动开口；之后小满仍在洞穴里，点她随时能聊。
          if (!world.exploration.metXiaoman) {
            playPartnerFound('xiaoman')
            world.exploration.metXiaoman = true
            talkingPartnerId = 'xiaoman'
          }
          notify('🪜 到第二层啦！洞里有一只小兔子，她好像饿了……')
          hooks.onMilestone?.({ emoji: '🪜', title: '抵达第 2 层 · 泉水层', detail: '冷色的洞壁和苔藓 · 小满在这里等你' })
        } else { renderer.focusHome(); notify('⌂ 顺着梯子回到家啦！') }
      })
    },
    supplyWater: () => {
      if (mealBusy() || !canSupplyWater(world)) return
      requestPartnerWork({ kind: 'water' })
    },
    startPlanting,
    sendPower: () => {
      if (mealBusy() || traveling || supplying || powering || !canSendPowerDown(world)) return
      const from = world.exploration.explorer
      const shaftX = world.exploration.shaftX
      if (!from || shaftX === null) return
      const route = atuRoute(world, from, { x: shaftX, y: 19 })
      if (!route) { notify('先让阿土走回梯子那边，再送电。'); return }
      powering = true
      pushProgress()
      moveExplorer(route, () => {
        sendPowerDown(world)
        powering = false
        renderer.playPowerDown()
        playPowerConnected()
        renderer.refreshExploration()
        renderer.playMoleReaction('电到下面啦！')
        notify('⚡ 电流顺着梯子下去了，第二层亮起来了！')
        hooks.onMilestone?.({ emoji: '⚡', title: '第二层通电！', detail: '家里的电送下来了 · 这儿不再是黑的了' })
        scheduleSave()
        pushProgress()
      })
    },
    feed: () => {
      if (mealing || traveling) return
      const result = serveMeal(world)
      if (!result.ok) {
        notify(result.reason === 'no-food' ? '🍽 先收点菜再开饭。' : '🛏 先给伙伴安好小床，再请大家吃饭。')
        return
      }
      mealing = true
      scheduleSave()
      if (!result.shared) {
        // 旧存档 / 还没建灶台餐桌：保留原来的吃饭方式，仍然只结算一次。
        renderer.focusWater()
        playMealTime()
        renderer.playMealCelebration()
        renderer.playMoleReaction('开饭啦！')
        notify(world.farm.food > 0
          ? `🍽 伙伴们吃得好开心！还剩 ${world.farm.food} 份。`
          : '🍽 伙伴们吃得好开心！再去收点菜吧。')
        pushProgress()
        mealTimer = window.setTimeout(() => finishMeal(), 1200)
        return
      }
      const facilities = mealFacilities(world)!
      const dining = facilities.dining
      renderer.focusOn((dining.x + dining.w / 2) * TILE_SIZE, (dining.y + dining.h / 2) * TILE_SIZE)
      playMealTime()
      renderer.playKitchenCooking(facilities.kitchen)
      notify('🍲 灶台热起来啦！大家去餐桌坐好。')
      pushProgress()
      // 保底收尾：即使画面被冻住，也不会把输入锁在演出里。
      mealTimer = window.setTimeout(() => finishMeal(), 9000)
      // 第一次围坐共餐（存档里累计的第 1 次）= 第二层章末完成态。
      const firstShared = world.farm.sharedMeals === 1
      renderer.playMealGather(planMealGathering(world), () => {
        if (!mealing) return
        renderer.playMealCelebration()
        renderer.playPartnerReaction('xiaoman', '一起吃，饭更香！')
        notify(`🍲 大家坐下来吃饭啦！还剩 ${world.farm.food} 份。`)
        if (firstShared) {
          hooks.onMilestone?.({ emoji: '🏡', title: '第 2 层 · 完成啦！', detail: '第一顿饭大家一起吃 · 有水、有菜、有饭，两层都亮了' })
          // 回望：拉出整个家的剖面看一眼，再回到餐桌这边；拖动/缩放随时打断。
          renderer.playChapterGlance()
        }
        window.clearTimeout(mealTimer)
        mealTimer = window.setTimeout(() => finishMeal(), 2600)
      })
    },
    toggleLamp,
    destroy: () => {
      gameAudio.setPlaying(false)
      gameAudio.stopEffects()
      siteEditor?.cancel()
      window.clearTimeout(saveTimer)
      window.clearTimeout(mealTimer)
      cancelMeal()
      partnerOrders?.cancel(false)
      if (atuOrders?.active) atuOrders.cancel()
      endOrder()
      void persist()
      document.removeEventListener('visibilitychange', onVisibilityChange)
      window.removeEventListener('pagehide', onPageHide)
      window.removeEventListener('blur', onWindowBlur)
      window.removeEventListener('keydown', onKeyDown)
      pointer.detach()
      renderer.destroy()
    },
  }
}
