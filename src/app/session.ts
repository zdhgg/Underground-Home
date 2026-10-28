import { installNestWarmLamp, nestWarmLampProblem } from '../core/nestWarmLamp'
import { FinaleChapter,type FinaleUI } from './finaleChapter'
import type { FinaleFacilityKind,FinaleTheme } from '../core/world'
import { RuinsChapter,type RuinsUI } from './ruinsChapter'
import type { RuinsFacilityKind,RuinsMotif,RuinsEdition } from '../core/world'
import { VentilationChapter, type VentilationUI } from './ventilationChapter'
import type { VentilationFacilityKind,AirMode } from '../core/world'
import { ReservoirChapter, type ReservoirUI } from './reservoirChapter'
import type { ReservoirFacilityKind, WaterRoute } from '../core/world'
import { ROOT_SPOT, SPORE_SPOT } from '../core/gardenTopology'
import { GardenChapter, type GardenUI } from './gardenChapter'
import type { GardenFacilityKind } from '../core/world'
import { HallChapter, type HallUI } from './hallChapter'
import { MURAL_SPOT, WARM_LIGHT_SPOT } from '../core/hallTopology'
import type { HallFacilityKind } from '../core/world'
import { gameAudio } from '../render/gameAudio'
import { DeepChapter, type DeepUI } from './deepChapter'
import { deepFacilityAt, type DeepAction } from '../core/deep'
import type { DeepFacilityKind } from '../core/world'
import { CRYSTAL_SPOT, MOSS_SPOT, DRILL_SPOT } from '../core/deepTopology'
import { playSoilDig, playBuildComplete, playPartnerFound, playCrystalCollected, playPowerConnected, playUndo, playUnavailable } from '../render/waterSound'
import { dig, type DigResult } from '../core/dig'
import { AtuOrders } from './atuOrders'
import { RoomEditor, type RoomUI } from './roomEditor'
import { SiteEditor, type SiteUI } from './siteEditor'
import { FacilityPanel, facilityView, panelFacilityAt, type FacilityUI } from './facilityPanel'
import { resolveGlobalGuide, primaryGuideAction, type GuideAction } from './guideAction'
import { homeWishTarget, homeWishes, homeWishUnavailableReason, isFirstFloorPod, type HomeWish, type HomeWishId } from './homeWishes'
import { depthAccess, type ChapterLayer } from './depthAccess'
import type { ConversationAnchor } from '../render/conversationAnchor'
import { BUILDING_SITES, siteAt, siteBlueprintVisible, siteById, siteBuilt } from '../core/sites'
import { roomAt } from '../core/rooms'
import { canAfford, changeMaterials, digLoot, materialText, PLANTER_COST } from '../core/materials'
import { canPlaceShelf, placeShelf, SHELF_COST, type ShelfFailure } from '../core/storage'
import { canPlaceNursery, isMushroomSpot, NURSERY_COST, placeNursery } from '../core/nursery'
import type { Inventory } from '../core/world'
import { bagItems, COLLECTION_SHELF, type BagItem } from '../core/bag'
import { activateGardens } from '../core/roomConstruction'
import { PartnerOrders, type WorkUI } from './partnerOrders'
import { initializeWorkers, type WorkPlan, type WorkTarget } from '../core/partnerWork'
import { atuRoute, initialAtuPosition, routeBeforePod } from '../core/atu'
import { createWorldHistory } from '../core/history'
import { canPlacePod, placePod, podAnchorFromPointer, podRect, type BuildFailure } from '../core/build'
import { collectCrystal, repairCore } from '../core/interact'
import { guideHighlight, missionSummary } from '../core/missions'
import { HOME_OWNER } from '../core/personal'
import { canPlaceWallLamp, inspectCrack, isShaftColumn, SHAFT_LAST_Y, shaftChainReady, shaftConnected, shaftFrontier, shaftRemainingSegments, springVisible } from '../core/exploration'
import { HOME_FLOOR_Y, LANDMARKS, TILE, TILE_SIZE, createInitialWorld, type Cell, type Rect, type RoomKind, type SiteKind, type WorkerId, type MemoryEntry } from '../core/world'
import { MEMORY_CORNER } from '../core/memories'
import { availablePartners, canBuildMorePods, partnerBed, waitingPartnerList, waitingPartners, type PartnerId } from '../core/partners'
import { SMALL_PICKAXE_ID, upgradePartner } from '../core/partnerAbilities'
import { wideLampUpgrade } from '../core/partnerAbilities'
import { canRetrofitLamp, hasWideLampAbility, retrofitLamp, WIDE_LAMP_ID } from '../core/lighting'
import { partnerConversation, type PartnerConversation } from '../core/partnerInteractions'
import { canSendPowerDown, sendPowerDown } from '../core/power'
import { isRelicFound, relicAt, relicSummary, RELICS } from '../core/relics'
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
  onNestWelcome?(state: NestWelcome | null): void
  onFinale?(state:FinaleUI):void
  onRuins?(state:RuinsUI):void
  onVentilation?(state:VentilationUI):void
  onReservoir?(state:ReservoirUI):void
  onGarden?(state: GardenUI): void
  onHall?(state: HallUI): void
  onDeep?(state: DeepUI): void
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
  /** 家园心愿快照：只读、随世界状态重算，不写入存档。 */
  onWishes?(wishes: HomeWish[]): void
  /** 一次性里程碑（突破岩层 / 抵达第二层 / 发现泉水）：界面弹一张大卡片 */
  onMilestone?(card: Milestone): void
  /** 一次只与一位伙伴交流；null表示关闭，不占用建造和挖掘模式。 */
  onPartnerConversation?(conversation: PartnerConversation | null): void
  onConversationAnchor?(anchor: ConversationAnchor | null): void
  onDiscovery?(active: boolean): void
  onRooms?(state: RoomUI): void
  onSites?(state: SiteUI): void
  /** 已建设施的面板（菜园/灶台/餐桌）：null 表示关闭 */
  onFacility?(state: FacilityUI): void
  onInventory?(inventory: Inventory): void
  onBag?(items: BagItem[]): void
  onBagRequested?(): void
  onMemories?(entries: MemoryEntry[]): void
  onMemoryRequested?(): void
  onWork?(state: WorkUI | null): void
  onWorkers?(items: { id: WorkerId; name: string; verb: string }[]): void
}

export type NestMark = 'star' | 'leaf' | 'drop'
export interface NestWelcome { podId: number; anchor: ConversationAnchor & { targetHalfWidth?: number; targetHeight?: number }; speech: string; mark?: NestMark; lampAvailable?: boolean; lampInstalled?: boolean; lamp?: { installed: boolean; problem: string | null } }

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

/** 建造工具：同一次只会选一个（挖掘 / 睡眠舱 / 种植槽 / 储物架 / 育苗架） */
export type BuildMode = 'none' | 'pod' | 'planter' | 'shelf' | 'nursery'

export interface BuildState {
  digging: boolean
  /** 现在能用哪些工具（界面按这个显示按钮） */
  podAvailable: boolean
  planterAvailable: boolean
  shelfAvailable: boolean
  nurseryAvailable: boolean
  mode: BuildMode
  selected: boolean
  valid: boolean
  message: string
  podCount: number
  planterCount: number
  shelfCount: number
  nurseryCount: number
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

/** 储物架的短提示与完整说明（与菜槽共用失败原因键，但文案面向第一层）。 */
const SHELF_MESSAGES: Record<ShelfFailure, string> = {
  power: '先修好能源核心，再摆储物架。',
  bounds: '这里太靠边啦，换个地方试试。',
  layer: '储物架要放在第一层暖窝层的地面上。',
  soil: '先挖空这一格，再放储物架。',
  support: '储物架要放在地面上，不能悬空。',
  reserved: '入口、梯子、能源核心和蓝图旁边要留出位置。',
  overlap: '这里已经放好东西啦。',
}
const SHELF_SHORT_HINTS: Record<ShelfFailure, string> = {
  power: '先修好能源核心', bounds: '太靠边了', layer: '只能放第一层', soil: '先挖空这块',
  support: '要放在地面上', reserved: '这里要留空', overlap: '这里放过了',
}

/** 育苗架的说明（失败原因与菜槽共用，文案面向育苗架）。 */
const NURSERY_MESSAGES: Record<FarmFailure, string> = {
  'no-water': '先把水接到菜园，再搭育苗架。',
  bounds: '这里太靠边啦，换个地方试试。',
  layer: '育苗架要放在第二层泉水边的地面上。',
  soil: '先挖空这一格，再搭育苗架。',
  support: '育苗架要放在地面上，不能悬空。',
  reserved: '泉水、梯子和水缸旁边要留出位置。',
  overlap: '这里已经放好东西啦。',
}

/** 面向界面的一次引导快照：阿土说什么 + 唯一目标的"做完会怎样" */
export interface SessionProgress {
  action?: GuideAction
  /** 当前全局目标所属楼层，帮助玩家在切层后仍知道目标在哪里。 */
  layer?: string
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
  closeNestWelcome(): void
  openNestMark(podId: number): void
  openNestWarmLamp(podId: number): void
  confirmNestWarmLamp(): void
  confirmNestMark(mark: NestMark): void
  openFinale():void
  closeFinale():void
  finalePrimary():void
  finaleSelect(kind:FinaleFacilityKind):void
  finaleTheme(theme:FinaleTheme):void
  finalePanorama():void
  openRuins():void
  closeRuins():void
  ruinsPrimary():void
  ruinsSelect(kind:RuinsFacilityKind):void
  ruinsMotif(motif:RuinsMotif):void
  ruinsEdition(edition:RuinsEdition):void
  openVentilation():void
  closeVentilation():void
  ventilationPrimary():void
  ventilationSelect(kind:VentilationFacilityKind):void
  ventilationMode(mode:AirMode):void
  ventilationVariety():void
  openReservoir():void
  closeReservoir():void
  reservoirPrimary():void
  reservoirSelect(kind:ReservoirFacilityKind):void
  reservoirRoute(route:WaterRoute):void
  openGarden(): void
  closeGarden(): void
  gardenPrimary(): void
  gardenSelect(kind: GardenFacilityKind): void
  gardenAdd(kind: GardenFacilityKind): void
  gardenVariety(): void
  openHall(): void
  closeHall(): void
  hallPrimary(): void
  hallSelect(kind: HallFacilityKind): void
  hallAlbumPage(delta: number): void
  openDeep(): void
  closeDeep(): void
  deepPrimary(): void
  deepSelect(kind: DeepFacilityKind): void
  deepPlaceLamp(): void
  deepUpgrade(action: DeepAction, label: string): void
  deepRide(action: DeepAction): void
  lookCrystal(): void
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
  /** 设施面板的主要推进操作（收菜/浇水/开饭/去种菜等），由对应伙伴或既有结算执行 */
  facilityPrimary(): void
  facilityPlant(): void
  facilityLook(): void
  closeFacility(): void
  /** 设施面板的升级入口（一次一项；S5：菜园的育苗架） */
  facilityUpgrade(): void
  /** 育苗架解锁的新菜种：进入番茄槽摆放模式 */
  startTomatoPlanting(): void
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
  /** 家园心愿：重新验证后把镜头带到真实目标，不改变世界状态。 */
  focusHomeWish(id: HomeWishId): void
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
  addMemory(entry: Omit<MemoryEntry, 'id' | 'createdAt'>): void
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
    const focused = siteEditor?.focusedLayer
    cameraView = { ...view, layer: focused ?? view.layer, displayLayer: focused ?? view.displayLayer }
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
  /** 种植槽模式当前用的菜种：蔬菜（默认）或育苗架解锁的番茄。 */
  let planterCrop: 'veg' | 'tomato' = 'veg'
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
  let facilityPanel: FacilityPanel | null = null
  let partnerOrders: PartnerOrders | null = null
  let finaleChapter:FinaleChapter|undefined
  let ruinsChapter:RuinsChapter|undefined
  let ventilationChapter:VentilationChapter|undefined
  let reservoirChapter:ReservoirChapter|undefined
  let gardenChapter: GardenChapter | undefined
  let hallChapter: HallChapter | undefined
  let deepChapter: DeepChapter | null = null
  let currentWork: WorkUI | null = null
  /** 一次共餐演出：结算已完成，演出期间不再重复扣食物。 */
  let mealing = false
  let mealTimer: number | undefined
  let nestWelcome: NestWelcome | null = null
  let nestLampFollowup = false
  let nestInteraction = 0
  const dismissNestWelcome = (): void => { if (nestWelcome) { nestWelcome = null; hooks.onNestWelcome?.(null); renderer.setNestLampPreview(null); pushHighlight() } }
  const noteNestInteraction = (): void => { nestInteraction++ }

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
    renderer.setHighlight(nestWelcome || finaleChapter?.active || finaleChapter?.busy || ruinsChapter?.active || ruinsChapter?.busy || ventilationChapter?.active || ventilationChapter?.busy || reservoirChapter?.active || reservoirChapter?.busy || gardenChapter?.active || gardenChapter?.busy || hallChapter?.active || hallChapter?.busy || deepChapter?.active || deepChapter?.busy || talkingPartnerId || discovering || siteEditor?.active || roomEditor?.active || facilityPanel?.active || currentWork || buildMode !== 'none' || lampMode || !rect ? null : {
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

  const showNestWelcome = (pod: import('../core/world').SleepPod, lamp = false): void => {
    if (traveling || partnerOrders?.active) return
    const anchor = renderer.nestAnchor(pod)
    if (anchor.x < 0 || anchor.x > anchor.width || anchor.y < 0 || anchor.y > anchor.height || renderer.isOverview) return
    const residents = availablePartners(world).filter(p => partnerBed(world, p.id)?.pod.id === pod.id).map(p => p.name).join('和')
    siteEditor?.close(); roomEditor?.close()
    nestWelcome = { podId: pod.id, anchor, mark: pod.mark, lampAvailable: world.deep.completed, lampInstalled: pod.warmLamp === true, ...(lamp ? { lamp: { installed: pod.warmLamp === true, problem: nestWarmLampProblem(world, pod.id) } } : {}), speech: residents
      ? `${HOME_OWNER}，你帮${residents}安好了小窝！选一个喜欢的标记，留在小窝上吧。`
      : `${HOME_OWNER}，这是我们的小窝。选一个喜欢的标记，留在小窝上吧。` }
    renderer.setNestLampPreview(lamp && !pod.warmLamp ? pod.id : null)
    hooks.onNestWelcome?.(nestWelcome); pushHighlight()
  }

  const welcomeAfterEntrance = (pod: import('../core/world').SleepPod, settled: () => void): void => {
    const stamp = nestInteraction
    renderer.playPodEntrance(pod, () => {
      settled()
      if (stamp !== nestInteraction || !world.pods.some(p => p.id === pod.id) || !availablePartners(world).some(p => partnerBed(world, p.id)?.pod.id === pod.id)) return
      showNestWelcome(pod)
    })
  }

  const pushBuild = (): void => {
    // 睡眠舱：由已加入伙伴的稳定床位优先位决定容量。
    // 种植槽：水接到菜园之后才能种。储物架：点亮家园后就能摆。育苗架：水到菜园后可搭。
    const podAvailable = world.progress.coreRepaired && canBuildMorePods(world)
    const planterAvailable = isFarmUnlocked(world)
    const shelfAvailable = world.progress.coreRepaired
    const nurseryAvailable = isFarmUnlocked(world)
    // 工具不可用时自动收起，别让孩子停在一个点了没反应的模式里
    if ((buildMode === 'pod' && !podAvailable) || (buildMode === 'planter' && !planterAvailable) || (buildMode === 'shelf' && !shelfAvailable) || (buildMode === 'nursery' && !nurseryAvailable)) {
      buildMode = 'none'
      candidate = null
      hoverBuild = null
    }
    const anchor = buildMode === 'pod' && hoverBuild ? podAnchorFromPointer(hoverBuild) : hoverBuild
    const point = buildMode === 'none' ? null : candidate ?? anchor
    const podCheck = buildMode === 'pod' && point ? canPlacePod(world, point.x, point.y) : null
    const planterCheck = buildMode === 'planter' && point ? canPlacePlanter(world, point.x, point.y) : null
    const shelfCheck = buildMode === 'shelf' && point ? canPlaceShelf(world, point.x, point.y) : null
    const nurseryCheck = buildMode === 'nursery' && point ? canPlaceNursery(world, point.x, point.y) : null
    const check = podCheck ?? planterCheck ?? shelfCheck ?? nurseryCheck
    const valid = check?.ok === true
    const previewHint = check ? (valid ? '可以放 ✓' : buildMode === 'shelf' ? SHELF_SHORT_HINTS[(check as { reason: ShelfFailure }).reason]
      : buildMode === 'nursery' ? BUILD_SHORT_HINTS[(check as { reason: FarmFailure }).reason] : BUILD_SHORT_HINTS[check.reason]) : ''
    renderer.setBuildPreview(
      podCheck?.ok ? point : null,
      valid,
      podCheck?.ok ? podCheck.door : 'left',
      buildMode === 'none' ? '' : previewHint,
      buildMode,
      buildMode === 'planter' ? point : null,
      buildMode === 'shelf' ? point : null,
    )

    let message = '选一个工具开始建造。'
    if (buildMode === 'none') {
      message = planterAvailable
        ? '去第二层泉水边，选“种植槽”，点在挖空的地面种菜。'
        : '先挖出一块空地，再选“睡眠舱”。'
    } else if (candidate && check) {
      message = check.ok
        ? '这里可以放！点“确认建造”。想换位置，再点别处。'
        : `${buildMode === 'shelf' ? SHELF_MESSAGES[(check as { reason: ShelfFailure }).reason] : buildMode === 'nursery' ? NURSERY_MESSAGES[(check as { reason: FarmFailure }).reason] : BUILD_MESSAGES[check.reason]} 再点别处换位置。`
    } else if (point && check) {
      message = check.ok
        ? '这里可以放！点一下这里把位置定下来。'
        : `${buildMode === 'shelf' ? SHELF_MESSAGES[(check as { reason: ShelfFailure }).reason] : buildMode === 'nursery' ? NURSERY_MESSAGES[(check as { reason: FarmFailure }).reason] : BUILD_MESSAGES[check.reason]} 换个地方，或先清理这里。`
    } else if (buildMode === 'planter') {
      message = '在第二层点一块有地面的空地，放下种植槽。'
    } else if (buildMode === 'shelf') {
      message = '在第一层点一块有地面的空地，放下储物架。'
    } else if (buildMode === 'nursery') {
      message = '在第二层点一块有地面的空地，搭起育苗架。'
    } else if (buildMode === 'pod') {
      message = '点一块有地面的空地，放下睡眠舱。'
    }

    hooks.onBuild?.({
      digging: diggingSites,
      podAvailable, planterAvailable, shelfAvailable, nurseryAvailable, mode: buildMode, selected: candidate !== null,
      valid: candidate !== null && valid, message,
      podCount: world.pods.length, planterCount: world.farm.planters.length, shelfCount: world.shelves.length, nurseryCount: world.nurseries.length,
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
    if(finaleChapter?.busy){finaleChapter.cancel();notify('先停下来啦，已完成的部分保留。');return}
    if(ruinsChapter?.busy){ruinsChapter.cancel();notify('先停下来啦，已完成的部分保留。');return}
    if(ventilationChapter?.busy){ventilationChapter.cancel();notify('先停下来啦，已完成的部分保留。');return}
    if(reservoirChapter?.busy){reservoirChapter.cancel();notify('先停下来啦，已完成的部分保留。');return}
    if (gardenChapter?.busy) { gardenChapter.cancel(); notify('先停下来啦，完成的部分已经保留。'); return }
    if (hallChapter?.busy) { hallChapter.cancel(); notify('先停下来啦，完成的施工已经保留。'); return }
    if(finaleChapter?.active){finaleChapter.close();return}
    if(ruinsChapter?.active){ruinsChapter.close();return}
    if(ventilationChapter?.active){ventilationChapter.close();return}
    if(reservoirChapter?.active){reservoirChapter.close();return}
    if (gardenChapter?.active) { gardenChapter.close(); return }
    if (hallChapter?.active) { hallChapter.close(); return }
    if (deepChapter?.busy) { deepChapter.cancel(); if (message) notify(message); return }
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
    // 每次仅提交一份完整快照；章节详情仍由各自 refresh 维护。
    hooks.onProgress({ ...resolveGlobalGuide(world, resting), relics: relicSummary(world) })
    finaleChapter?.refresh()
    ruinsChapter?.refresh()
    ventilationChapter?.refresh()
    reservoirChapter?.refresh()
    gardenChapter?.refresh()
    hallChapter?.refresh()
    deepChapter?.refresh()
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
    hooks.onWishes?.(homeWishes(world))
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
    facilityPanel?.refresh()
    hooks.onInventory?.({ ...world.inventory })
    hooks.onBag?.(bagItems(world))
    hooks.onMemories?.(world.memories.entries.map(entry => ({ ...entry })))
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
    if (deepChapter?.busy) return
    finaleChapter?.close(); ruinsChapter?.close(); ventilationChapter?.close(); reservoirChapter?.close(); gardenChapter?.close(); hallChapter?.close(); deepChapter?.close()
    if (mealBusy()) return
    if (traveling || buildMode !== 'none' || lampMode || renderer.isOverview || roomEditor?.active) return
    const conversation = partnerConversation(world, id)
    if (!conversation) return
    facilityPanel?.close()
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
    closeConversation(); roomEditor?.close(); siteEditor?.close(); facilityPanel?.close()
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
    if (world.progress.coreRepaired && buildMode === 'none' && !lampMode && world.memories.entries.length > 0 && inRect(MEMORY_CORNER, cell)) return 'pointer'
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
    if (buildMode === 'none' && !lampMode && panelFacilityAt(world, cell.x, cell.y)) return 'pointer'
    if (world.exploration.entered && buildMode === 'none' && !lampMode && isMushroomSpot(world, cell.x, cell.y) && world.tiles[cell.y][cell.x] === TILE.EMPTY) return 'pointer'
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
    // 点到别处：设施面板让位（拖动看地图不收起，点别的目标才收起）。
    if (facilityPanel?.active) facilityPanel.close()
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
    if (buildMode === 'shelf') {
      candidate = cell
      pushBuild()
      return
    }
    if (buildMode === 'nursery') {
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
        notify(`🎉 ${HOME_OWNER}，小泉从水里冒出来啦！他说：这水真甜，我帮你引上去。`)
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

    // 2.5) 一次性拾取：整簇消失，只保留短暂反馈；之后原地按普通空地处理。
    if (isMushroomSpot(world, cell.x, cell.y) && world.tiles[cell.y][cell.x] === TILE.EMPTY) {
      world.exploration.foundMushroom = true
      renderer.refreshExploration()
      renderer.playBurst((cell.x + 0.5) * TILE_SIZE, (cell.y + 0.3) * TILE_SIZE, { color: 0xbff0d8, count: 10, speed: 42, ring: true, ringRadius: 18 })
      scheduleSave()
      pushProgress()
      hooks.onMilestone?.({ emoji: '🍄', title: '发现发光蘑菇！', detail: '已经采好 · 泉水边又空出来啦' })
      notify('🍄 采好发光蘑菇啦！空出的地方可以继续布置。')
      return
    }

    // 3) 种植槽：熟了就叫小满收，没熟就请她浇一次水（照料也是玩家行动）
    const planter = planterAt(world, cell.x, cell.y)
    if (planter) {
      if (planter.growth < RIPE_STAGE) {
        requestPartnerWork({ kind: 'watering', x: cell.x, y: cell.y })
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
    } else if (result.tile === TILE.SOIL && result.ok && digLoot(cell.x, cell.y, result.tile).clay && !world.exploration.foundClay) {
      // 第一块红黏土：和旧物一样，是一次小发现（单调）。
      world.exploration.foundClay = true
      renderer.refreshExploration()
      hooks.onMilestone?.({ emoji: '🧱', title: '发现红黏土！', detail: '泉边的红土层 · 以后能做陶罐和装饰' })
      notify('🧱 挖到红黏土！收进物品栏了，以后能做陶罐和装饰。')
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
        welcomeAfterEntrance(pod, () => { resting = true; renderer.playPodCelebration(pod); pushProgress() })
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
        welcomeAfterEntrance(pod, () => { resting = true; renderer.playPodCelebration(pod); pushProgress() })
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

  facilityPanel = new FacilityPanel({ world: () => world, emit: state => hooks.onFacility?.(state) })
  facilityPanel.refresh()

  const completePartnerWork = (plan: WorkPlan): boolean => {
    const target = plan.target
    if (target.kind === 'nest-warm-lamp') {
      if (!installNestWarmLamp(world, target.podId)) return false
      history.record({ kind: 'nest-warm-lamp', podId: target.podId })
      renderer.playNestLampLight(target.podId); playBuildComplete()
      notify('暖光灯装好啦！第三层的工坊成果，留在喜欢的小窝里了。可以撤销。')
    } else if (target.kind === 'harvest') {
      const tomato = world.farm.planters.find(p => p.x === target.x && p.y === target.y)?.crop === 'tomato'
      if (!harvestPlanter(world, target.x, target.y)) return false
      renderer.refreshFarm(); playHarvest(); renderer.playHarvest(target)
      renderer.playPartnerReaction('xiaoman', tomato ? '收好啦！红红的番茄！' : '收好啦！新苗也种下了。')
      notify(tomato ? `🍅 小满收了一份番茄！家里有 ${world.farm.food} 份吃的。` : `🥕 小满收了一份菜！家里有 ${world.farm.food} 份吃的。`)
      if (world.farm.harvests === 1) hooks.onMilestone?.({ emoji: '🥕', title: '第一份收成！', detail: `${HOME_OWNER}，小满收好菜啦 · 可以请大家吃饭` })
    } else if (target.kind === 'watering') {
      // 浇水是一次照料：所有未熟的菜各长一档；与"干活长大"共用同一推进函数，不叠加。
      const grown = advancePlanters(world)
      if (grown.length === 0) return false
      renderer.refreshFarm()
      playWaterClue()
      renderer.playBurst((target.x + .5) * TILE_SIZE, (target.y + .2) * TILE_SIZE, { color: 0x9ed7f2, count: 8, speed: 40 })
      renderer.playPartnerReaction('xiaoman', '浇好啦，小芽喝饱了水！')
      notify('💧 小满浇了水，菜又长了一截！接着干活，菜也会自己长大。')
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
      const finishedNest = !state && nestLampFollowup ? currentWork?.nestPodId : undefined
      currentWork = state
      traveling = state !== null; supplying = state?.worker === 'xiaoquan'
      if (state) beginOrder('travel')
      else { endOrder(); renderer.refreshFriends(); scheduleSave() }
      hooks.onWork?.(state); pushProgress()
      if (!state) {
        nestLampFollowup = false
        const pod = world.pods.find(p => p.id === finishedNest && p.warmLamp)
        if (pod) showNestWelcome(pod, true)
      }
    },
    complete: completePartnerWork, changed: scheduleSave, notify,
  })
  const requestPartnerWork = (target: WorkTarget): void => {
    if (traveling || partnerOrders?.active) return
    dismissNestWelcome()
    siteEditor?.close()
    facilityPanel?.close()
    closeConversation(); roomEditor?.close(); buildMode = 'none'; lampMode = false; candidate = null; hoverBuild = null
    renderer.setHoverCell(null); renderer.setAtuTarget(null)
    nestLampFollowup = target.kind === 'nest-warm-lamp'
    partnerOrders?.request(target)
    pushProgress()
  }
  const toggleLamp = (): void => {
    if (mealBusy() || !world.exploration.springFound || traveling) return
    siteEditor?.close()
    facilityPanel?.close()
    roomEditor?.close(); closeConversation()
    lampMode = !lampMode; buildMode = 'none'; candidate = null; pushProgress()
    notify(lampMode ? hasWideLampAbility(world) ? '🏮 点旧灯加装，或点挖空的洞壁装聚光灯，左右各照4格。' : '🏮 点挖空的泉水层洞壁，安一盏小灯。再点工具可以收起。' : '⛏ 继续自由挖掘吧。')
  }

  /** 从引导直接去种菜：打开泉边的预设菜园。 */
  const startPlanting = (): void => {
    if (mealBusy() || traveling || !isFarmUnlocked(world)) return
    diggingSites = false
    roomEditor?.close(); closeConversation(); facilityPanel?.close()
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
  deepChapter = new DeepChapter({
    world: () => world, view: renderer, emit: state => hooks.onDeep?.(state),
    prepare: () => {
      finaleChapter?.close(); ruinsChapter?.close(); ventilationChapter?.close(); reservoirChapter?.close(); gardenChapter?.close(); hallChapter?.close()
      if (order) abortOrder()
      if (atuOrders?.active) atuOrders.cancel()
      partnerOrders?.cancel(false)
      if (mealing) cancelMeal()
      siteEditor?.cancel(); siteEditor?.close(); roomEditor?.close(); facilityPanel?.close(); closeConversation()
      buildMode = 'none'; lampMode = false; diggingSites = false; candidate = null; hoverBuild = null
      renderer.setLampPreview(null); renderer.setHoverCell(null); renderer.setAtuTarget(null); renderer.setHighlight(null)
      pushBuild()
    },
    changed: () => { renderer.refreshExploration(); scheduleSave(); pushProgress() },
    record: change => history.record({ kind: 'deep', change }),
    dig: (cell, tile) => { history.record({ kind: 'dig', ...cell, tile }); renderer.refreshTerrain([cell]); renderer.playDigEffect(cell) },
    notify, milestone: (title, detail) => hooks.onMilestone?.({ emoji: '💎', title, detail }),
  })
  deepChapter.refresh()
  hallChapter = new HallChapter({
    world: () => world, view: renderer, emit: state => hooks.onHall?.(state),
    prepare: () => {
      finaleChapter?.close(); ruinsChapter?.close(); ventilationChapter?.close(); reservoirChapter?.close(); gardenChapter?.close()
      if (order) abortOrder()
      if (atuOrders?.active) atuOrders.cancel()
      partnerOrders?.cancel(false)
      if (mealing) cancelMeal()
      deepChapter?.close(); siteEditor?.cancel(); siteEditor?.close(); roomEditor?.close(); facilityPanel?.close(); closeConversation()
      buildMode = 'none'; lampMode = false; diggingSites = false; candidate = null; hoverBuild = null
      renderer.setLampPreview(null); renderer.setHoverCell(null); renderer.setAtuTarget(null); renderer.setHighlight(null); pushBuild()
    },
    changed: () => { renderer.refreshExploration(); scheduleSave(); pushProgress() },
    record: change => history.record({ kind: 'hall', change }),
    dig: cell => { history.record({ kind: 'dig', ...cell, tile: TILE.ROCK }); renderer.refreshTerrain([cell]); renderer.playDigEffect(cell) },
    notify, milestone: (title, detail) => hooks.onMilestone?.({ emoji: '🏮', title, detail }),
  })
  hallChapter.refresh()
  gardenChapter = new GardenChapter({
    world: () => world, view: renderer, emit: state => hooks.onGarden?.(state),
    prepare: () => {
      finaleChapter?.close(); ruinsChapter?.close(); ventilationChapter?.close(); reservoirChapter?.close()
      if (order) abortOrder()
      if (atuOrders?.active) atuOrders.cancel()
      partnerOrders?.cancel(false)
      if (mealing) cancelMeal()
      if (deepChapter?.busy) deepChapter.cancel()
      hallChapter?.close(); deepChapter?.close(); siteEditor?.cancel(); siteEditor?.close(); roomEditor?.close(); facilityPanel?.close(); closeConversation()
      buildMode = 'none'; lampMode = false; diggingSites = false; candidate = null; hoverBuild = null
      renderer.setLampPreview(null); renderer.setHoverCell(null); renderer.setAtuTarget(null); renderer.setHighlight(null); pushBuild()
    },
    changed: () => { renderer.refreshExploration(); scheduleSave(); pushProgress() },
    record: change => history.record({ kind: 'garden', change }),
    dig: cell => { history.record({ kind: 'dig', ...cell, tile: TILE.ROCK }); renderer.refreshTerrain([cell]); renderer.playDigEffect(cell) },
    notify, milestone: (title, detail) => hooks.onMilestone?.({ emoji: '🌿', title, detail }),
  })
  gardenChapter.refresh()
  reservoirChapter=new ReservoirChapter({
    world:()=>world,view:renderer,emit:state=>hooks.onReservoir?.(state),
    prepare:()=>{
      finaleChapter?.close(); ruinsChapter?.close(); ventilationChapter?.close()
      if(order)abortOrder()
      if(atuOrders?.active)atuOrders.cancel()
      partnerOrders?.cancel(false)
      if(mealing)cancelMeal()
      if(deepChapter?.busy)deepChapter.cancel()
      gardenChapter?.close();hallChapter?.close();deepChapter?.close();siteEditor?.cancel();siteEditor?.close();roomEditor?.close();facilityPanel?.close();closeConversation()
      buildMode='none';lampMode=false;diggingSites=false;candidate=null;hoverBuild=null
      renderer.setLampPreview(null);renderer.setHoverCell(null);renderer.setAtuTarget(null);renderer.setHighlight(null);pushBuild()
    },
    changed:()=>{renderer.refreshExploration();scheduleSave();pushProgress()},
    record:change=>history.record({kind:'reservoir',change}),
    dig:cell=>{history.record({kind:'dig',...cell,tile:TILE.ROCK});renderer.refreshTerrain([cell]);renderer.playDigEffect(cell)},
    notify,milestone:(title,detail)=>hooks.onMilestone?.({emoji:'💧',title,detail}),
  })
  reservoirChapter.refresh()
  ventilationChapter=new VentilationChapter({
    world:()=>world,view:renderer,emit:state=>hooks.onVentilation?.(state),
    prepare:()=>{
      if(order)abortOrder()
      if(atuOrders?.active)atuOrders.cancel()
      partnerOrders?.cancel(false);if(mealing)cancelMeal()
      if(deepChapter?.busy)deepChapter.cancel()
      finaleChapter?.close(); ruinsChapter?.close();reservoirChapter?.close();gardenChapter?.close();hallChapter?.close();deepChapter?.close();siteEditor?.cancel();siteEditor?.close();roomEditor?.close();facilityPanel?.close();closeConversation()
      buildMode='none';lampMode=false;diggingSites=false;candidate=null;hoverBuild=null
      renderer.setLampPreview(null);renderer.setHoverCell(null);renderer.setAtuTarget(null);renderer.setHighlight(null);pushBuild()
    },
    changed:()=>{renderer.refreshExploration();scheduleSave();pushProgress()},
    record:change=>history.record({kind:'ventilation',change}),
    dig:cell=>{history.record({kind:'dig',...cell,tile:TILE.ROCK});renderer.refreshTerrain([cell]);renderer.playDigEffect(cell)},notify,
  })
  ventilationChapter.refresh()
  ruinsChapter=new RuinsChapter({
    world:()=>world,view:renderer,emit:state=>hooks.onRuins?.(state),
    prepare:()=>{
      if(order)abortOrder()
      if(atuOrders?.active)atuOrders.cancel()
      partnerOrders?.cancel(false);if(mealing)cancelMeal()
      if(deepChapter?.busy)deepChapter.cancel()
      finaleChapter?.close();ventilationChapter?.close();reservoirChapter?.close();gardenChapter?.close();hallChapter?.close();deepChapter?.close();siteEditor?.cancel();siteEditor?.close();roomEditor?.close();facilityPanel?.close();closeConversation()
      buildMode='none';lampMode=false;diggingSites=false;candidate=null;hoverBuild=null
      renderer.setLampPreview(null);renderer.setHoverCell(null);renderer.setAtuTarget(null);renderer.setHighlight(null);pushBuild()
    },
    changed:()=>{renderer.refreshExploration();scheduleSave();pushProgress()},
    record:change=>history.record({kind:'ruins',change}),
    dig:cell=>{history.record({kind:'dig',...cell,tile:TILE.ROCK});renderer.refreshTerrain([cell]);renderer.playDigEffect(cell)},notify,
  })
  ruinsChapter.refresh()
  finaleChapter=new FinaleChapter({
    world:()=>world,view:renderer,emit:state=>hooks.onFinale?.(state),
    prepare:()=>{
      if(order)abortOrder()
      if(atuOrders?.active)atuOrders.cancel()
      partnerOrders?.cancel(false);if(mealing)cancelMeal()
      if(deepChapter?.busy)deepChapter.cancel()
      ruinsChapter?.close();ventilationChapter?.close();reservoirChapter?.close();gardenChapter?.close();hallChapter?.close();deepChapter?.close();siteEditor?.cancel();siteEditor?.close();roomEditor?.close();facilityPanel?.close();closeConversation()
      buildMode='none';lampMode=false;diggingSites=false;candidate=null;hoverBuild=null
      renderer.setLampPreview(null);renderer.setHoverCell(null);renderer.setAtuTarget(null);renderer.setHighlight(null);pushBuild()
    },
    changed:()=>{renderer.refreshExploration();scheduleSave();pushProgress()},
    record:change=>history.record({kind:'finale',change}),
    dig:cell=>{history.record({kind:'dig',...cell,tile:TILE.ROCK});renderer.refreshTerrain([cell]);renderer.playDigEffect(cell)},notify,
  })
  finaleChapter.refresh()
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
      // 在章节/设施命中前保护正在执行的单项工作；读取入口仍可使用。
      if (partnerOrders?.active) {
        if (cell && inRect(COLLECTION_SHELF, cell)) { hooks.onBagRequested?.(); return }
        if (cell && world.memories.entries.length > 0 && inRect(MEMORY_CORNER, cell)) { hooks.onMemoryRequested?.(); return }
        partnerOrders.explainBusy(); return
      }
      if(finaleChapter?.busy)return
      if(cell&&buildMode==='none'&&!lampMode&&!traveling&&finaleChapter?.tap(cell))return
      if(ruinsChapter?.busy)return
      if(cell&&buildMode==='none'&&!lampMode&&!traveling&&ruinsChapter?.tap(cell))return
      if(ventilationChapter?.busy)return
      if(cell&&buildMode==='none'&&!lampMode&&!traveling&&ventilationChapter?.tap(cell))return
      if(reservoirChapter?.busy)return
      if(cell && buildMode==='none' && !lampMode && !traveling && reservoirChapter?.tap(cell))return
      if (gardenChapter?.busy) return
      if (cell && buildMode === 'none' && !lampMode && !traveling && gardenChapter?.tap(cell)) return
      if (hallChapter?.busy) return
      if (cell && buildMode === 'none' && !lampMode && !traveling && hallChapter?.tap(cell)) return
      if (deepChapter?.busy) return
      if (cell && buildMode === 'none' && !lampMode && !traveling && deepChapter?.tap(cell)) return
      if (cell && world.progress.coreRepaired && !traveling && buildMode === 'none' && !lampMode && inRect(COLLECTION_SHELF, cell)) {
        hooks.onBagRequested?.(); return
      }
      if (cell && world.progress.coreRepaired && !traveling && buildMode === 'none' && !lampMode && world.memories.entries.length > 0 && inRect(MEMORY_CORNER, cell)) {
        hooks.onMemoryRequested?.(); return
      }
      if (cell && !traveling && buildMode === 'none' && !lampMode) {
        const site = siteAt(cell)
        if (site && siteBlueprintVisible(world, site) && !siteBuilt(world, site) && !planterAt(world, cell.x, cell.y)) {
          diggingSites = false
          renderer.setHoverCell(null)
          closeConversation(); siteEditor?.select(site.id); pushBuild(); pushHighlight(); return
        }
        // 已建好的设施（菜园/灶台/餐桌）：点本体打开它的面板；菜槽本身仍走直点。
        const facility = panelFacilityAt(world, cell.x, cell.y)
        if (facility) {
          finaleChapter?.close(); ruinsChapter?.close(); ventilationChapter?.close(); reservoirChapter?.close(); gardenChapter?.close(); hallChapter?.close(); deepChapter?.close()
          closeConversation(); siteEditor?.close(); roomEditor?.close()
          diggingSites = false
          renderer.setHoverCell(null)
          facilityPanel?.toggle(facility)
          pushBuild(); pushHighlight()
          return
        }
        // 已建成的住处/客厅也是建筑本体：点床或房间内部，直接打开房间详情与扩建入口。
        const room = roomAt(world, cell)
        if (room && room.status !== 'blueprint' && roomEditor) {
          closeConversation(); siteEditor?.close(); facilityPanel?.close()
          diggingSites = false
          renderer.setHoverCell(null)
          roomEditor.active = true
          roomEditor.select(room.id)
          renderer.focusOn((room.x + room.w / 2) * TILE_SIZE, (room.y + room.h / 2) * TILE_SIZE, 'building')
          pushBuild(); pushHighlight()
          return
        }
        // 旧存档里可能有独立睡眠舱而没有房间，点舱体也能重新选择标记。
        const pod = !room && world.pods.find(p => inRect(podRect(p), cell))
        if (pod) { closeConversation(); siteEditor?.close(); roomEditor?.close(); facilityPanel?.close(); showNestWelcome(pod); return }
      }
      if (roomEditor?.active && (!cell || roomEditor.tap(cell))) return
      // 实心地形始终保留挖掘/施工命中，不让角色的触屏容错抢走旁边岩块。
      const facility = cell && (planterAt(world, cell.x, cell.y) || (world.exploration.springFound && cell.y >= 19 && cell.y <= 21 && Math.abs(cell.x - LANDMARKS.spring.x) <= 1))
      if (!facility && !traveling && buildMode === 'none' && !lampMode && cell && world.tiles[cell.y][cell.x] === TILE.EMPTY) {
        const partner = renderer.partnerAtScreen(screen)
        if (partner) { talkToPartner(partner); return }
      }
      closeConversation()
      if (cell) handleTap(cell)
    },
    onPanBy: (delta) => { if (openingActive || inputBlocked) return; nestLampFollowup = false; closeConversation(); renderer.panBy(delta.x, delta.y) },
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
      // 晶簇层选址：指针换成"可放置"，点一下就把设施影子放到那处岩壁上。
      const deepBuild = deepChapter?.placingKind ?? deepChapter?.nextBuild
      if (cell && deepBuild && cell.y >= 30 && cell.y <= 34 && world.tiles[cell.y][cell.x] === TILE.EMPTY && !deepFacilityAt(world, cell)) {
        renderer.hoverPartner(null); renderer.setHoverCell(null); renderer.setCursor('copy'); return
      }
      if (roomEditor?.active) { renderer.hoverPartner(null); renderer.setHoverCell(null); renderer.setCursor('copy'); return }
      const site = cell && siteAt(cell)
      if (!traveling && buildMode === 'none' && site && siteBlueprintVisible(world, site) && !siteBuilt(world, site) && !planterAt(world, cell!.x, cell!.y)) {
        renderer.hoverPartner(null); renderer.setHoverCell(null); renderer.setCursor('pointer'); return
      }
      if (!traveling && buildMode === 'none' && !lampMode && cell && panelFacilityAt(world, cell.x, cell.y)) {
        renderer.hoverPartner(null); renderer.setHoverCell(null); renderer.setCursor('pointer'); return
      }
      const room = cell && roomAt(world, cell)
      if (!traveling && buildMode === 'none' && !lampMode && room && room.status !== 'blueprint') {
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
    onZoom: (delta, anchor) => { if (!openingActive && !inputBlocked) { nestLampFollowup = false; closeConversation(); renderer.zoomBy(delta, anchor) } },
  })

  /**
   * 切后台 / 回到前台：
   * - 切成后台时先把没播完的委托安全取消（世界不变、输入解锁），再落盘一份一致的存档；
   * - 回到前台时补一句提示，并立刻检查有没有超时卡住的演出。
   */
  const onVisibilityChange = (): void => {
    gameAudio.setHidden(document.visibilityState === 'hidden')
    if (document.visibilityState === 'hidden') {
      noteNestInteraction(); dismissNestWelcome()
      if(finaleChapter?.busy)finaleChapter.cancel(); if(ruinsChapter?.busy)ruinsChapter.cancel(); if(ventilationChapter?.busy)ventilationChapter.cancel(); if(reservoirChapter?.busy)reservoirChapter.cancel()
      if (gardenChapter?.busy) gardenChapter.cancel()
      if (hallChapter?.busy) hallChapter.cancel()
      if (deepChapter?.busy) deepChapter.cancel()
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
  const onPageHide = (): void => { if(finaleChapter?.busy)finaleChapter.cancel(); if(ruinsChapter?.busy)ruinsChapter.cancel(); if(ventilationChapter?.busy)ventilationChapter.cancel(); if(reservoirChapter?.busy)reservoirChapter.cancel(); if (gardenChapter?.busy) gardenChapter.cancel(); hallChapter?.cancel(); gameAudio.setHidden(true); if (deepChapter?.busy) deepChapter.cancel(); if (openingActive) renderer.finishOpening(); partnerOrders?.cancel(false); if (mealing) cancelMeal(); void persist() }
  /** 窗口失焦不会停帧，只把指针手势复位，避免拖到一半的拖动卡住下一次点击。 */
  const onWindowBlur = (): void => { pointer.reset() }
  const undoLast = (): void => {
    dismissNestWelcome()
    const restored = history.undo(world)
    if (!restored) { playUnavailable(); notify('这里有伙伴、设施或回家的路，先留着这片空地。'); return }
    playUndo()
    if (restored.kind === 'finale' || restored.kind === 'ruins' || restored.kind === 'ventilation' || restored.kind === 'deep' || restored.kind === 'hall' || restored.kind === 'garden' || restored.kind === 'reservoir') { renderer.refresh(); deepChapter?.refresh() }
    else if (restored.kind === 'pod') { resting = world.pods.length > 0; renderer.refresh() }
    else if (restored.kind === 'nest-warm-lamp') renderer.refreshPods()
    else if (restored.kind === 'planter') renderer.refreshFarm()
    else if (restored.kind === 'shelf') renderer.refreshShelves()
    else if (restored.kind === 'nursery') renderer.refreshFarm()
    else if (restored.kind === 'lamp' || restored.kind === 'lamp-retrofit') renderer.refreshExploration()
    else if (restored.kind === 'room' || restored.kind === 'site') { resting = world.pods.length > 0; renderer.refreshRooms(); renderer.refreshPods(); renderer.refreshFarm(); renderer.refreshFriends() }
    else { renderer.refreshTerrain([restored]); renderer.playDigEffect(restored); renderer.refreshRelics() }
    renderer.refreshExploration(); scheduleSave(); pushProgress(); hooks.onMessage('↶ 已撤销上一步')
  }
  const cancelAction = (): void => {
    nestLampFollowup = false
    if(finaleChapter?.busy){finaleChapter.cancel();notify('先停下来啦，已完成的部分保留。');return}
    if(ruinsChapter?.busy){ruinsChapter.cancel();notify('先停下来啦，已完成的部分保留。');return}
    if(ventilationChapter?.busy){ventilationChapter.cancel();notify('先停下来啦，已完成的部分保留。');return}
    if(reservoirChapter?.busy){reservoirChapter.cancel();notify('先停下来啦，已完成的部分保留。');return}
    if (gardenChapter?.busy) { gardenChapter.cancel(); notify('先停下来啦，完成的部分已经保留。'); return }
    if (hallChapter?.busy) { hallChapter.cancel(); notify('先停下来啦。已完成的施工和材料都保留。'); return }
    if(finaleChapter?.active){finaleChapter.close();return}
    if(ruinsChapter?.active){ruinsChapter.close();return}
    if(ventilationChapter?.active){ventilationChapter.close();return}
    if(reservoirChapter?.active){reservoirChapter.close();return}
    if (gardenChapter?.active) { gardenChapter.close(); return }
    if (hallChapter?.active) { hallChapter.close(); return }
    if (deepChapter?.busy) { deepChapter.cancel(); notify('先停下来啦。已完成的施工和材料都保留。'); return }
    if (deepChapter?.active) { deepChapter.close(); return }
    gameAudio.stopEffects()
    if (cancelMeal('🍽 大家先停一下，再点一次就好。')) return
    if (siteEditor?.working) { siteEditor.cancel(); notify('阿土停下来啦，已挖的地方和找到的材料都保留。'); return }
    if (siteEditor?.active) { siteEditor.close(); return }
    if (partnerOrders?.active) { partnerOrders.cancel(); return }
    if (roomEditor?.active) { if (atuOrders?.active) abortOrder('阿土停下来啦。'); else roomEditor.close(); return }
    if (facilityPanel?.active) { facilityPanel.close(); return }
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
      hooks.onMessage(`🛏️ ${HOME_OWNER}，${movedIn}的小床安好啦！伙伴有住处，也能来帮忙。`)
      welcomeAfterEntrance(pod, () => {
        resting = true
        renderer.playPodCelebration(pod)
        pushProgress()
        renderer.refreshExploration()
        hooks.onMessage(stillWaiting ? `🛏️ 床位安好啦！${stillWaiting}也想住下。伙伴随时能来帮忙。` : '🛏️ 床位安好啦！伙伴睡下啦，楼下好像有声音……')
      })
  }

  const onKeyDown = (event: KeyboardEvent): void => {
    if (inputBlocked) return
    noteNestInteraction()
    if (openingActive) { if (event.key === 'Escape') { event.preventDefault(); renderer.finishOpening() }; return }
    if (event.key === 'Escape') { event.preventDefault(); if (nestWelcome) dismissNestWelcome(); else cancelAction() }
  }
  document.addEventListener('visibilitychange', onVisibilityChange)
  window.addEventListener('pointerdown', noteNestInteraction, true)
  window.addEventListener('wheel', noteNestInteraction, true)
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
    if (deepChapter?.busy) deepChapter.cancel()
    finaleChapter?.close(); ruinsChapter?.close(); ventilationChapter?.close(); reservoirChapter?.close(); gardenChapter?.close(); hallChapter?.close(); deepChapter?.close()
    gameAudio.stopEffects()
    partnerOrders?.cancel(false)
    if (atuOrders?.active) atuOrders.cancel()
    roomEditor?.close()
    siteEditor?.cancel(); siteEditor?.close()
    facilityPanel?.close()
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
    planterCrop = 'veg'
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

  /** 开饭：引导按钮、抽屉按钮与设施面板共用这一条唯一结算路径（serveMeal）。 */
  const startMeal = (): void => {
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
    notify(`🍲 ${HOME_OWNER}，灶台热起来啦！大家去餐桌坐好。`)
    pushProgress()
    // 保底收尾：即使画面被冻住，也不会把输入锁在演出里。
    mealTimer = window.setTimeout(() => finishMeal(), 9000)
    // 第一次围坐共餐（存档里累计的第 1 次）= 第二层章末完成态。
    const firstShared = world.farm.sharedMeals === 1
    renderer.playMealGather(planMealGathering(world), () => {
      if (!mealing) return
      renderer.playMealCelebration()
      renderer.playPartnerReaction('xiaoman', '一起吃，饭更香！')
      notify(`🍲 ${HOME_OWNER}，大家坐下来吃饭啦！还剩 ${world.farm.food} 份。`)
      if (firstShared) {
        hooks.onMilestone?.({ emoji: '🏡', title: '第 2 层 · 完成啦！', detail: '第一顿饭大家一起吃 · 有水、有菜、有饭，两层都亮了' })
        // 回望：拉出整个家的剖面看一眼，再回到餐桌这边；拖动/缩放随时打断。
        renderer.playChapterGlance()
      }
      window.clearTimeout(mealTimer)
      mealTimer = window.setTimeout(() => finishMeal(), 2600)
    })
  }

  /** 引导或面板里“找旧物”：把镜头带到第一件还没挖到的旧物旁。 */
  const focusRelicById = (id: string): void => {
    if(id==='earth-warmth'){finaleChapter?.close();ruinsChapter?.close();ventilationChapter?.close();reservoirChapter?.close();gardenChapter?.close();hallChapter?.close();deepChapter?.close();renderer.focusOn(36.5*TILE_SIZE,105*TILE_SIZE,'building');return}
    const ruinsSpot=id==='ruins-seal'?{x:10,y:94}:id==='ruins-footprint'?{x:36,y:94}:id==='ruins-lamp'?{x:12,y:94}:id==='ruins-spring'?{x:30,y:94}:id==='ruins-tools'?{x:38,y:94}:null
    if(ruinsSpot){finaleChapter?.close(); ruinsChapter?.close();ventilationChapter?.close();reservoirChapter?.close();gardenChapter?.close();hallChapter?.close();deepChapter?.close();renderer.focusOn((ruinsSpot.x+.5)*TILE_SIZE,(ruinsSpot.y-1)*TILE_SIZE,'building');return}
    const windSpot=id==='wind-echo'?{x:38,y:82}:id==='wind-vane'?{x:10,y:82}:null
    if(windSpot){finaleChapter?.close(); ruinsChapter?.close(); ventilationChapter?.close();reservoirChapter?.close();gardenChapter?.close();hallChapter?.close();deepChapter?.close();renderer.focusOn((windSpot.x+.5)*TILE_SIZE,(windSpot.y-1)*TILE_SIZE,'building');return}
    const reservoirSpot = id === 'water-shell' ? {x:38,y:70} : id === 'water-reed' ? {x:10,y:70} : null
    if (reservoirSpot) { finaleChapter?.close(); ruinsChapter?.close(); ventilationChapter?.close(); reservoirChapter?.close(); gardenChapter?.close(); hallChapter?.close(); deepChapter?.close(); renderer.focusOn((reservoirSpot.x+.5)*TILE_SIZE, (reservoirSpot.y-1)*TILE_SIZE, 'building'); return }
    const gardenSpot = id === 'garden-spores' ? SPORE_SPOT : id === 'garden-root' ? ROOT_SPOT : null
    if (gardenSpot) { finaleChapter?.close(); ruinsChapter?.close(); ventilationChapter?.close(); reservoirChapter?.close(); gardenChapter?.close(); hallChapter?.close(); deepChapter?.close(); renderer.focusOn((gardenSpot.x + .5) * TILE_SIZE, (gardenSpot.y - 1) * TILE_SIZE, 'building'); return }
    const hallSpot = id === 'hall-mural' ? MURAL_SPOT : id === 'warm-wick' ? WARM_LIGHT_SPOT : null
    if (hallSpot) { finaleChapter?.close(); ruinsChapter?.close(); ventilationChapter?.close(); reservoirChapter?.close(); gardenChapter?.close(); hallChapter?.close(); deepChapter?.close(); renderer.focusOn((hallSpot.x + .5) * TILE_SIZE, (hallSpot.y - 1) * TILE_SIZE, 'building'); return }
    const deepSpot = id === 'crystal-cluster' ? CRYSTAL_SPOT : id === 'crystal-moss' ? MOSS_SPOT : id === 'old-drill' ? DRILL_SPOT : null
    if (deepSpot) { finaleChapter?.close(); ruinsChapter?.close(); ventilationChapter?.close(); reservoirChapter?.close(); gardenChapter?.close(); hallChapter?.close(); deepChapter?.close(); renderer.focusOn((deepSpot.x + .5) * TILE_SIZE, (deepSpot.y - 1) * TILE_SIZE); return }
    const relic = RELICS.find(r => r.id === id)
    if (!relic) return
    facilityPanel?.close()
    if (!traveling) {
      siteEditor?.close(); roomEditor?.close(); buildMode = 'none'; lampMode = false; diggingSites = true
      candidate = null; hoverBuild = null; pushProgress()
    }
    renderer.focusOn((relic.x + .5) * TILE_SIZE, (relic.y + .5) * TILE_SIZE)
    notify('这一带的泥土里有件旧物。沿着通路慢慢挖过去吧！')
  }

  /** 设施面板 →「自己摆菜槽」：进入种植槽摆放模式并把镜头带到泉边。 */
  const facilityPlantNow = (): void => {
    facilityPanel?.close()
    if (traveling || !isFarmUnlocked(world)) return
    closeConversation(); siteEditor?.close(); roomEditor?.close()
    diggingSites = false
    lampMode = false; buildMode = 'planter'; candidate = null; hoverBuild = null
    renderer.setLampPreview(null); renderer.setAtuTarget(null); renderer.setHoverCell(null)
    renderer.focusWater()
    pushBuild(); pushProgress()
  }

  /** 设施面板 →「摆一槽番茄」：育苗架解锁的新菜种，摆放方式与蔬菜相同。 */
  const startTomatoPlanting = (): void => {
    facilityPanel?.close()
    if (traveling || !isFarmUnlocked(world) || world.nurseries.length === 0) return
    closeConversation(); siteEditor?.close(); roomEditor?.close()
    diggingSites = false
    lampMode = false; buildMode = 'planter'; planterCrop = 'tomato'; candidate = null; hoverBuild = null
    renderer.setLampPreview(null); renderer.setAtuTarget(null); renderer.setHoverCell(null)
    renderer.focusWater()
    pushBuild(); pushProgress()
  }

  /** 设施面板 → 升级入口（一次一项）：菜园的育苗架。 */
  const facilityUpgrade = (): void => {
    const id = facilityPanel?.id
    if (!id) return
    const view = facilityView(world, id)
    if (view.upgrade?.kind !== 'build-nursery') return
    facilityPanel?.close()
    if (traveling || !isFarmUnlocked(world)) return
    closeConversation(); siteEditor?.close(); roomEditor?.close()
    diggingSites = false
    lampMode = false; buildMode = 'nursery'; candidate = null; hoverBuild = null
    renderer.setLampPreview(null); renderer.setAtuTarget(null); renderer.setHoverCell(null)
    renderer.focusWater()
    notify('🌿 点第二层有地面的空地，搭起育苗架（石料 2 · 旧木料 2）。')
    pushBuild(); pushProgress()
  }

  /** 能源核心面板 → 把已经接通的电送到第二层。 */
  const sendPowerNow = (): void => {
    if (mealBusy() || traveling || supplying || powering || !canSendPowerDown(world)) return
    const from = world.exploration.explorer
    const shaftX = world.exploration.shaftX
    if (!from || shaftX === null) return
    const route = atuRoute(world, from, { x: shaftX, y: 19 })
    if (!route) { notify('先让阿土走回梯子那边，再送电。'); return }
    facilityPanel?.close()
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
  }

  /** 把现实中的一小段生活放进家园；记录只保存在当前存档，不上传。 */
  const addMemory = (entry: Omit<MemoryEntry, 'id' | 'createdAt'>): void => {
    if (!entry.title.trim() || world.memories.entries.length >= 100) return
    const createdAt = new Date().toISOString()
    const saved: MemoryEntry = { ...entry, id: world.memories.nextId, createdAt }
    world.memories.entries.push(saved)
    world.memories.nextId += 1
    scheduleSave()
    renderer.refreshMemories()
    hooks.onMemories?.(world.memories.entries.map(item => ({ ...item })))
    notify('✦ 这段记忆放进家里啦，随时可以回来看看。')
  }

  /** 导航只查看。专业工作期间不进入会取消工作的章节 prepare，也不更改角色站位。 */
  const navigateChapter = (layer: ChapterLayer, show: () => void): void => {
    const access = depthAccess(world, layer)
    if (!access.available) { notify(access.reason); return }
    if (partnerOrders?.active) {
      const floorY = { crystal: 32, hall: 45, garden: 57, reservoir: 69, ventilation: 81, ruins: 93, finale: 105 }[layer]
      renderer.stopAtuFollow()
      renderer.focusOn(22 * TILE_SIZE, floorY * TILE_SIZE, 'building')
      partnerOrders.explainBusy()
      return
    }
    show()
  }

  /**
   * 家园心愿只是“带我去看看”：重新读取当前世界状态、验证目标，
   * 然后复用现有镜头。不扣材料、不装灯、不收菜、不推进主线，也不取消伙伴工作。
   */
  const wishFocusBlocked = (): boolean => Boolean(
    openingActive || inputBlocked || traveling || mealing || discovering || talkingPartnerId || nestWelcome
    || partnerOrders?.active || atuOrders?.active || siteEditor?.working
    || roomEditor?.active || siteEditor?.active || facilityPanel?.active
    || buildMode !== 'none' || lampMode
    || finaleChapter?.active || finaleChapter?.busy
    || ruinsChapter?.active || ruinsChapter?.busy
    || ventilationChapter?.active || ventilationChapter?.busy
    || reservoirChapter?.active || reservoirChapter?.busy
    || gardenChapter?.active || gardenChapter?.busy
    || hallChapter?.active || hallChapter?.busy
    || deepChapter?.active || deepChapter?.busy,
  )

  const focusHomeWish = (id: HomeWishId): void => {
    if (wishFocusBlocked()) {
      notify('先做完眼前这件事，再去看家园心愿。')
      return
    }
    const stale = (): void => {
      notify(`家园有变化：${homeWishUnavailableReason(world, id)}`)
      pushProgress()
    }
    // 界面上的心愿可能已经过时：只信当前世界状态重新算出来的目标。
    const target = homeWishTarget(world, id)
    if (!target) { stale(); return }
    if (target.kind === 'pod') {
      const pod = world.pods.find(p => p.id === target.podId && isFirstFloorPod(p) && !p.warmLamp)
      if (!pod) { stale(); return }
      renderer.focusOn((pod.x + 1.5) * TILE_SIZE, (pod.y + 1) * TILE_SIZE, 'building')
      notify('小窝在这里。点小窝看看，要不要给它添一盏暖光灯。')
    } else {
      const planter = world.farm.planters.find(p =>
        p.id === target.planterId && p.x === target.x && p.y === target.y && p.growth >= RIPE_STAGE)
      if (!planter) { stale(); return }
      renderer.focusOn((planter.x + .5) * TILE_SIZE, (planter.y + .2) * TILE_SIZE, 'building')
      notify('成熟的菜在这里。点菜槽，小满来收。')
    }
    pushProgress()
  }

  return {
    closeNestWelcome: dismissNestWelcome,
    openNestWarmLamp: id => {
      const pod = world.pods.find(p => p.id === id)
      if (pod && world.deep.completed) showNestWelcome(pod, true)
      else notify(nestWarmLampProblem(world, id) ?? '请先选择小窝。')
    },
    confirmNestWarmLamp: () => {
      if (!nestWelcome?.lamp || traveling || partnerOrders?.active) return
      const id = nestWelcome.podId, problem = nestWarmLampProblem(world, id)
      if (problem) { notify(problem); return }
      requestPartnerWork({ kind: 'nest-warm-lamp', podId: id })
    },
    openNestMark: id => { const pod = world.pods.find(p => p.id === id); if (pod && roomEditor?.active) showNestWelcome(pod) },
    confirmNestMark: mark => {
      const pod = world.pods.find(p => p.id === nestWelcome?.podId)
      if (!pod || !['star', 'leaf', 'drop'].includes(mark)) { dismissNestWelcome(); return }
      pod.mark = mark; dismissNestWelcome(); renderer.refreshPods(); scheduleSave()
      hooks.onMessage(`${HOME_OWNER}选的${{ star: '星星', leaf: '叶子', drop: '水滴' }[mark]}挂到小窝上啦！`)
    },
    openFinale:()=>navigateChapter('finale', () => finaleChapter?.show(true)),
    closeFinale:()=>finaleChapter?.close(),
    finalePrimary:()=>{if(!traveling)finaleChapter?.primary()},
    finaleSelect:kind=>finaleChapter?.select(kind),
    finaleTheme:theme=>finaleChapter?.chooseTheme(theme),
    finalePanorama:()=>finaleChapter?.panorama(),
    openRuins:()=>navigateChapter('ruins', () => ruinsChapter?.show(true)),
    closeRuins:()=>{finaleChapter?.close(); ruinsChapter?.close()},
    ruinsPrimary:()=>{if(!traveling)ruinsChapter?.primary()},
    ruinsSelect:kind=>ruinsChapter?.select(kind),
    ruinsMotif:motif=>ruinsChapter?.chooseMotif(motif),
    ruinsEdition:edition=>ruinsChapter?.chooseEdition(edition),
    openVentilation:()=>navigateChapter('ventilation', () => ventilationChapter?.show(true)),
    closeVentilation:()=>{finaleChapter?.close(); ruinsChapter?.close(); ventilationChapter?.close()},
    ventilationPrimary:()=>{if(!traveling)ventilationChapter?.primary()},
    ventilationSelect:kind=>ventilationChapter?.select(kind),
    ventilationMode:mode=>ventilationChapter?.chooseMode(mode),
    ventilationVariety:()=>ventilationChapter?.changeVariety(),
    openReservoir:()=>navigateChapter('reservoir', () => reservoirChapter?.show(true)),
    closeReservoir:()=>{finaleChapter?.close(); ruinsChapter?.close(); ventilationChapter?.close(); reservoirChapter?.close()},
    reservoirPrimary:()=>{if(!traveling)reservoirChapter?.primary()},
    reservoirSelect:kind=>reservoirChapter?.select(kind),
    reservoirRoute:route=>reservoirChapter?.chooseRoute(route),
    openGarden: () => navigateChapter('garden', () => gardenChapter?.show(true)),
    closeGarden: () => {finaleChapter?.close(); ruinsChapter?.close(); ventilationChapter?.close(); reservoirChapter?.close();gardenChapter?.close()},
    gardenPrimary: () => { if (!traveling) gardenChapter?.primary() },
    gardenSelect: kind => gardenChapter?.select(kind),
    gardenAdd: kind => gardenChapter?.select(kind, undefined, true),
    gardenVariety: () => gardenChapter?.changeVariety(),
    openHall: () => navigateChapter('hall', () => hallChapter?.show(true)),
    closeHall: () => { finaleChapter?.close(); ruinsChapter?.close(); ventilationChapter?.close(); reservoirChapter?.close(); gardenChapter?.close(); hallChapter?.close() },
    hallPrimary: () => { if (!traveling) hallChapter?.primary() },
    hallSelect: kind => hallChapter?.select(kind),
    hallAlbumPage: delta => hallChapter?.albumPage(delta),
    openDeep: () => navigateChapter('crystal', () => deepChapter?.show(true)),
    closeDeep: () => { if (deepChapter?.busy) deepChapter.cancel(); finaleChapter?.close(); ruinsChapter?.close(); ventilationChapter?.close(); reservoirChapter?.close(); gardenChapter?.close(); hallChapter?.close(); deepChapter?.close() },
    deepPrimary: () => { if (!traveling) deepChapter?.primary(); else notify('等阿土走稳，再来做这件事。') },
    deepSelect: kind => deepChapter?.select(kind),
    deepPlaceLamp: () => deepChapter?.select('lamp', true),
    deepUpgrade: (action, label) => deepChapter?.selectUpgrade(action, label),
    deepRide: action => { if (!traveling && !hallChapter?.busy && !gardenChapter?.busy && !reservoirChapter?.busy && !ventilationChapter?.busy && !ruinsChapter?.busy && !finaleChapter?.busy) { deepChapter?.show(); deepChapter?.perform(action) } },
    lookCrystal: () => navigateChapter('crystal', () => deepChapter?.show(true)),
    setInputBlocked: blocked => {
      inputBlocked = blocked; pointer.reset()
      if (blocked) { renderer.setHoverCell(null); renderer.hoverPartner(null) }
    },
    focusCollection: () => {
      renderer.focusOn((COLLECTION_SHELF.x + COLLECTION_SHELF.w / 2) * TILE_SIZE, (COLLECTION_SHELF.y + .5) * TILE_SIZE)
      notify('收藏架在这里。挖到的旧物会自动摆上去，点它能翻看小故事。')
    },
    focusRelic: focusRelicById,
    startOpening,
    titleSave: (): SaveStatus => loadedFromSave
      ? { status: 'ready', summary: summarizeSave(world), savedAt }
      : loadError
        ? { status: 'broken', error: loadError }
        : { status: 'none' },
    startNewGame,
    addMemory,
    skipOpening: () => renderer.finishOpening(),
    enableOpeningSound: () => renderer.enableOpeningSound(),
    findPartner: id => {
      const p = world.workers[id]
      if (!p) return
      renderer.stopAtuFollow()
      renderer.focusOn((p.x + .5) * TILE_SIZE, (p.y + .3) * TILE_SIZE)
      renderer.playPartnerReaction(id, currentWork?.worker === id ? '我在这里忙着呢！' : '我在这里！点设施，我来帮忙。')
    },
    openRooms: () => {
      if(finaleChapter?.busy)finaleChapter.cancel(); if(ruinsChapter?.busy)ruinsChapter.cancel(); if(ventilationChapter?.busy)ventilationChapter.cancel(); if(reservoirChapter?.busy)reservoirChapter.cancel()
      if (gardenChapter?.busy) gardenChapter.cancel()
      if (hallChapter?.busy) hallChapter.cancel()
      if (deepChapter?.busy) deepChapter.cancel()
      finaleChapter?.close(); ruinsChapter?.close(); ventilationChapter?.close(); reservoirChapter?.close(); gardenChapter?.close(); hallChapter?.close(); deepChapter?.close()
      if (mealBusy() || !world.progress.coreRepaired || traveling) return
      closeConversation(); facilityPanel?.close(); buildMode = 'none'; lampMode = false; candidate = null; hoverBuild = null; pushBuild()
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
      else if(conversation?.action?.id==='open-finale'){closeConversation();finaleChapter?.show(true)}
      else if(conversation?.action?.id==='open-ruins'){closeConversation();ruinsChapter?.show(true)}
      else if(conversation?.action?.id==='open-ventilation'){closeConversation();ventilationChapter?.show(true)}
      else if (conversation?.action?.id === 'open-reservoir') { closeConversation(); reservoirChapter?.show(true) }
      else if (conversation?.action?.id === 'open-garden') { closeConversation(); gardenChapter?.show(true) }
      else if (conversation?.action?.id === 'look-at-clue') { closeConversation(); focusCurrentClue() }
    },
    setBuildMode: (mode) => {
      if(finaleChapter?.busy)finaleChapter.cancel(); if(ruinsChapter?.busy)ruinsChapter.cancel(); if(ventilationChapter?.busy)ventilationChapter.cancel(); if(reservoirChapter?.busy)reservoirChapter.cancel()
      if (gardenChapter?.busy) gardenChapter.cancel()
      if (hallChapter?.busy) hallChapter.cancel()
      if (deepChapter?.busy) deepChapter.cancel()
      finaleChapter?.close(); ruinsChapter?.close(); ventilationChapter?.close(); reservoirChapter?.close(); gardenChapter?.close(); hallChapter?.close(); deepChapter?.close()
      if (mealBusy()) return
      if (siteEditor?.working) siteEditor.cancel()
      siteEditor?.close()
      facilityPanel?.close()
      roomEditor?.close()
      if (atuOrders?.active) atuOrders.cancel()
      if (traveling) return
      diggingSites = mode === 'none'
      closeConversation()
      lampMode = false
      renderer.setLampPreview(null)
      if (mode === 'pod' && (!world.progress.coreRepaired || !canBuildMorePods(world))) return
      if (mode === 'planter' && !isFarmUnlocked(world)) return
      if (mode === 'shelf' && !world.progress.coreRepaired) return
      if (mode === 'nursery' && !isFarmUnlocked(world)) return
      if (mode === 'planter') planterCrop = 'veg'
      buildMode = buildMode === mode ? 'none' : mode
      candidate = null
      hoverBuild = null
      renderer.setHoverCell(null)
      pushBuild()
    },
    confirmBuild: () => {
      if (mealBusy() || traveling) return
      if (buildMode === 'nursery') {
        if (!candidate) return
        const check = canPlaceNursery(world, candidate.x, candidate.y)
        if (!check.ok) { playUnavailable(); hooks.onMessage(NURSERY_MESSAGES[check.reason], 'warning'); return }
        if (!canAfford(world, NURSERY_COST)) { playUnavailable(); notify(`需要${materialText(NURSERY_COST)}，挖泥土找找吧。`); return }
        const nursery = placeNursery(world, candidate.x, candidate.y)
        if (!nursery) return
        changeMaterials(world, NURSERY_COST, -1)
        history.record({ kind: 'nursery', id: nursery.id, cost: { ...NURSERY_COST } })
        candidate = null
        pushBuild()
        renderer.refreshFarm()
        playBuildComplete()
        renderer.playBurst((nursery.x + 0.5) * TILE_SIZE, (nursery.y + 0.5) * TILE_SIZE, { color: 0xa8e6b8, count: 12 })
        scheduleSave()
        pushProgress()
        notify('🌿 育苗架搭好啦！现在能种番茄了——点育苗架，或用「摆番茄槽」。')
        return
      }
      if (buildMode === 'shelf') {
        if (!candidate) return
        const check = canPlaceShelf(world, candidate.x, candidate.y)
        if (!check.ok) { playUnavailable(); hooks.onMessage(SHELF_MESSAGES[check.reason], 'warning'); return }
        if (!canAfford(world, SHELF_COST)) { playUnavailable(); notify(`需要${materialText(SHELF_COST)}，挖泥土找找吧。`); return }
        const shelf = placeShelf(world, candidate.x, candidate.y)
        if (!shelf) return
        changeMaterials(world, SHELF_COST, -1)
        history.record({ kind: 'shelf', id: shelf.id, cost: { ...SHELF_COST } })
        candidate = null
        pushBuild()
        renderer.refreshShelves()
        playBuildComplete()
        renderer.playBurst((shelf.x + 0.5) * TILE_SIZE, (shelf.y + 0.5) * TILE_SIZE, { color: 0xd9b47f, count: 10 })
        scheduleSave()
        pushProgress()
        notify('📦 储物架摆好啦！点它就能看材料和旧物。')
        return
      }
      if (buildMode === 'planter') {
        if (!candidate) return
        if (candidate.y !== 21) { notify('新菜槽放在第二层泉水边的地面上吧。'); return }
        const check = canPlacePlanter(world, candidate.x, candidate.y)
        if (!check.ok) { playUnavailable(); hooks.onMessage(BUILD_MESSAGES[check.reason], 'warning'); return }
        if (!canAfford(world, PLANTER_COST)) { playUnavailable(); notify(`需要${materialText(PLANTER_COST)}，挖泥土找找吧。`); return }
        const planter = placePlanter(world, candidate.x, candidate.y)
        if (!planter) return
        if (planterCrop === 'tomato') planter.crop = 'tomato'
        changeMaterials(world, PLANTER_COST, -1)
        history.record({ kind: 'planter', id: planter.id, cost: { ...PLANTER_COST } })
        candidate = null
        pushBuild()
        renderer.refreshFarm()
        playBuildComplete()
        renderer.playBurst((planter.x + 0.5) * TILE_SIZE, (planter.y + 0.5) * TILE_SIZE, { color: 0x9ed7a4, count: 10 })
        scheduleSave()
        pushProgress()
        notify(planterCrop === 'tomato' ? '🍅 种下一槽番茄！照料方法和蔬菜一样。' : '🌱 在菜园种下一槽菜啦！你每干一件事，它就长高一档。')
        return
      }
      confirmPod()
    },
    zoomBy: (delta) => { nestLampFollowup = false; closeConversation(); renderer.zoomBy(delta) },
    centerOnHome: () => {
      finaleChapter?.close(); ruinsChapter?.close(); ventilationChapter?.close(); reservoirChapter?.close(); gardenChapter?.close(); hallChapter?.close(); deepChapter?.close()
      closeConversation()
      siteEditor?.close()
      facilityPanel?.close()
      // 种植槽属于第二层；回第一层时收起，避免留下一个点不动的工具。
      if (buildMode === 'planter') { buildMode = 'none'; candidate = null; hoverBuild = null; pushBuild() }
      renderer.focusHome()
    },
    lookDown: () => {
      finaleChapter?.close(); ruinsChapter?.close(); ventilationChapter?.close(); reservoirChapter?.close(); gardenChapter?.close(); hallChapter?.close(); deepChapter?.close()
      siteEditor?.close()
      roomEditor?.close()
      facilityPanel?.close()
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
      finaleChapter?.close(); ruinsChapter?.close(); ventilationChapter?.close(); reservoirChapter?.close(); gardenChapter?.close(); hallChapter?.close(); deepChapter?.close()
      siteEditor?.close()
      roomEditor?.close()
      facilityPanel?.close()
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
      if(finaleChapter?.busy){finaleChapter.cancel();notify('先停下来啦，已完成的部分保留。');return}
    if(ruinsChapter?.busy){ruinsChapter.cancel();notify('先停下来啦，已完成的部分保留。');return}
    if(ventilationChapter?.busy){ventilationChapter.cancel();notify('先停下来啦，已完成的部分保留。');return}
    if(reservoirChapter?.busy){reservoirChapter.cancel();notify('先停下来啦，已完成的部分保留。');return}
    if (gardenChapter?.busy) { gardenChapter.cancel(); notify('先停下来啦，完成的部分已经保留。'); return }
      if (hallChapter?.busy) { hallChapter.cancel(); notify('先停下来，再点一次撤销。'); return }
      if (deepChapter?.busy) { deepChapter.cancel(); notify('先停下来，再点一次撤销。'); return }
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
    focusHomeWish,
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
    sendPower: sendPowerNow,
    feed: () => {
      facilityPanel?.close()
      startMeal()
    },
    facilityPrimary: () => {
      const id = facilityPanel?.id
      if (!id) return
      const primary = facilityView(world, id).primary
      if (primary.kind === 'power') { sendPowerNow(); return }
      if (primary.kind === 'harvest' || primary.kind === 'watering') {
        // 面板只派发目标：小满沿真实通路过去收/浇，结算与直点完全同一套。
        requestPartnerWork({ kind: primary.kind, x: primary.x, y: primary.y })
        return
      }
      if (primary.kind === 'meal') { facilityPanel?.close(); startMeal(); return }
      if (primary.kind === 'find-relic') {
        const target = RELICS.find(relic => !isRelicFound(world, relic))
        if (target) focusRelicById(target.id)
        return
      }
      if (primary.kind === 'browse-relics') {
        facilityPanel?.close()
        hooks.onBagRequested?.()
        return
      }
      if (primary.kind === 'plant') facilityPlantNow()
      if (primary.kind === 'plant-tomato') startTomatoPlanting()
    },
    facilityPlant: facilityPlantNow,
    facilityUpgrade,
    startTomatoPlanting,
    facilityLook: () => {
      const site = facilityPanel?.id ? siteById(facilityPanel.id) : undefined
      if (site) renderer.focusOn((site.x + site.w / 2) * TILE_SIZE, (site.y + site.h / 2) * TILE_SIZE, 'building')
    },
    closeFacility: () => facilityPanel?.close(),
    toggleLamp,
    destroy: () => {
      if(finaleChapter?.busy)finaleChapter.cancel(); if(ruinsChapter?.busy)ruinsChapter.cancel(); if(ventilationChapter?.busy)ventilationChapter.cancel(); if(reservoirChapter?.busy)reservoirChapter.cancel()
      if (gardenChapter?.busy) gardenChapter.cancel()
      if (hallChapter?.busy) hallChapter.cancel()
      if (deepChapter?.busy) deepChapter.cancel()
      finaleChapter?.close(); ruinsChapter?.close(); ventilationChapter?.close(); reservoirChapter?.close(); gardenChapter?.close(); hallChapter?.close(); deepChapter?.close()
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
      window.removeEventListener('pointerdown', noteNestInteraction, true)
      window.removeEventListener('wheel', noteNestInteraction, true)
      window.removeEventListener('pagehide', onPageHide)
      window.removeEventListener('blur', onWindowBlur)
      window.removeEventListener('keydown', onKeyDown)
      pointer.detach()
      renderer.destroy()
    },
  }
}
