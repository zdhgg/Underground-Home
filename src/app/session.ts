import { dig, type DigResult } from '../core/dig'
import { createWorldHistory } from '../core/history'
import { canPlacePod, placePod, podAnchorFromPointer, type BuildFailure } from '../core/build'
import { collectCrystal, repairCore } from '../core/interact'
import { FIRST_NIGHT_MISSIONS, currentMission, explorationGuide, guideHighlight, missionSummary } from '../core/missions'
import { canPlaceWallLamp, inspectCrack, isShaftColumn, moleRoute, SHAFT_LAST_Y, shaftChainReady, shaftConnected, shaftFrontier, shaftRemainingSegments, springVisible, upgradePickaxe, walkingRoute } from '../core/exploration'
import { HOME_FLOOR_Y, LANDMARKS, TILE, TILE_SIZE, createInitialWorld, type Cell, type Rect } from '../core/world'
import { canBuildMorePods, waitingPartners } from '../core/partners'
import { relicAt, relicSummary } from '../core/relics'
import {
  createIndexedDbStore,
  createMemoryStore,
  deserialize,
  serialize,
  loadLegacySave,
  type SaveStore,
} from '../core/persistence'
import type { DepthView } from '../render/camera'
import { attachPointerControls } from '../input/pointerControls'
import { PixiWorldRenderer } from '../render/PixiRenderer'
import { playBreakthrough, playLayerArrival, playRockHit, playSpringFound, playWaterClue } from '../render/waterSound'

export interface SessionHooks {
  /** 状态提示（儿童可读的短句） */
  onMessage(message: string, kind?: 'info' | 'warning'): void
  /** 任务进度与引导变化（小鼹鼠面板 + 徽章） */
  onProgress(progress: SessionProgress): void
  onBuild?(state: BuildState): void
  onView?(view: DepthView): void
  onExploration?(state: ExplorationUI): void
  /** 一次性里程碑（突破岩层 / 抵达第二层 / 发现泉水）：界面弹一张大卡片 */
  onMilestone?(card: Milestone): void
}

export interface ExplorationUI {
  clue: boolean; upgraded: boolean; connected: boolean; entered: boolean; found: boolean
  traveling: boolean; downstairs: boolean; lampMode: boolean; canImport: boolean
  /** 已经学会亲自委托：可以一次挖到洞底 */
  canChain: boolean
  /** 连续施工进行中 */
  chaining: boolean
  /** 从当前工作面到洞底还剩几段岩 */
  remaining: number
}

/** 里程碑卡片：只用来庆祝，不承载操作 */
export interface Milestone {
  emoji: string
  title: string
  detail: string
}

export interface BuildState {
  available: boolean
  active: boolean
  selected: boolean
  valid: boolean
  message: string
  count: number
}

const BUILD_MESSAGES: Record<BuildFailure, string> = {
  power: '先修好能源核心，再安小床。', bounds: '这里太靠边啦，换个地方试试。',
  reserved: '入口和能源核心旁边要留出位置。', overlap: '这里已经有一张小床啦。',
  soil: '先切回挖掘，挖出一块能放下小床的空地。', support: '小床下面要有泥土或岩石托住，不能悬空。',
  access: '小床的门要通到家里，也要给伙伴和核心留条路。',
  'locked-layer': '泉水层还没有开放，回暖窝层安小床吧。',
}

/** 预览旁边的短提示：孩子不用低头看底部面板也能判断 */
const BUILD_SHORT_HINTS: Record<BuildFailure, string> = {
  power: '先修好能源核心', bounds: '太靠边了', reserved: '这里要留空',
  overlap: '已经有小床', soil: '先挖空这块', support: '小床要落地', access: '门要通到家里',
  'locked-layer': '这一层还没开放',
}

/** 面向界面的一次引导快照：阿土说什么 + 唯一目标的"做完会怎样" */
export interface SessionProgress {
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
  setBuildMode(active: boolean): void
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
  importLegacy(): Promise<void>
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

/** 按环境挑选存储：浏览器用 IndexedDB，失败时降级为内存（不会白屏） */
function pickStore(): SaveStore {
  try {
    if (typeof indexedDB !== 'undefined') return createIndexedDbStore()
  } catch {
    /* 降级到内存 */
  }
  return createMemoryStore()
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

export async function createGameSession(host: HTMLElement, hooks: SessionHooks): Promise<GameSession> {
  const renderer = await PixiWorldRenderer.create(host)
  renderer.onViewChanged = (view) => hooks.onView?.(view)
  const store = pickStore()
  const history = createWorldHistory()

  let world = createInitialWorld()
  let saveTimer: number | undefined
  let building = false
  let candidate: Cell | null = null
  let hoverBuild: Cell | null = null
  /** 伙伴是否已经在床上休息；不写入存档，重新载入时由第一间睡眠舱推导 */
  let resting = false
  let saveBlocked = false
  let traveling = false
  let lampMode = false
  let canImport = true
  let importing = false
  /** 进行中的施工委托；切后台或超时用它安全收尾（不重复挖、不锁死操作） */
  let order: Order | null = null
  let orderTimer: number | undefined
  /** 连续施工：一次委托从当前梯段一路挖到洞底 */
  let chaining = false
  let lastMessage = ''
  let lastMessageAt = 0
  /** 切后台打断委托后，回到前台补一句提示 */
  let resumeHint = ''
  /** 看门狗判据：画面最近一次出新帧的时刻与帧数 */
  let lastFrameCount = 0
  let lastFrameAt = 0
  /** 有改动还没落盘（回到前台时补写一次，避免后台定时器被节流） */
  let savePending = false

  const pushBuild = (): void => {
    // 床位数量由"愿意搬进来的伙伴"决定：一开始两位老住户=1 间舱；
    // 找到水之后另外两位朋友才肯来，于是多出第 2 间舱——永远不出现没人住的空舱。
    const available = world.progress.coreRepaired && canBuildMorePods(world)
    if (!available && building) {
      building = false
      candidate = null
      hoverBuild = null
    }
    const hoverAnchor = hoverBuild ? podAnchorFromPointer(hoverBuild) : null
    const previewPoint = building ? candidate ?? hoverAnchor : null
    const previewResult = previewPoint ? canPlacePod(world, previewPoint.x, previewPoint.y) : null
    const selectedResult = candidate ? previewResult : null
    const previewHint = previewResult
      ? previewResult.ok ? '可以建 ✓' : BUILD_SHORT_HINTS[previewResult.reason]
      : ''
    renderer.setBuildPreview(
      previewPoint,
      previewResult?.ok ?? false,
      previewResult?.ok ? previewResult.door : 'left',
      building ? previewHint : '',
    )

    let message = '点一下想放小床的地面，看看预览。'
    if (!available) {
      message = world.progress.coreRepaired
        ? '小床都安好啦。找到水，才会有新朋友愿意搬来。'
        : '先修好能源核心，再安小床。'
    } else if (!building) {
      message = '先挖出一块空地，再选“睡眠舱”。点一下想放小床的地面。'
    } else if (candidate && selectedResult) {
      message = selectedResult.ok
        ? '这里可以建！点“确认建造”。想换位置，再点别处。'
        : `${BUILD_MESSAGES[selectedResult.reason]} 再点别处换位置。`
    } else if (hoverAnchor && previewResult) {
      message = previewResult.ok
        ? '这里可以建！点一下这里把位置定下来。'
        : `${BUILD_MESSAGES[previewResult.reason]} 换个地方，或先挖空这里。`
    }

    hooks.onBuild?.({
      available, active: building, selected: candidate !== null,
      valid: candidate !== null && selectedResult?.ok === true, count: world.pods.length,
      message,
    })
  }

  // 只恢复独立原型存档；失败时保留原数据，禁止本次会话覆盖。
  try {
    const raw = await store.load()
    if (raw !== null && raw !== undefined) {
      const result = deserialize(raw)
      if (result.ok) {
        world = result.world
        canImport = world.dugCount === 0 && world.pods.length === 0 && !world.progress.crystalFound
        resting = world.pods.length > 0
        hooks.onMessage('💾 已恢复上次的进度')
      } else {
        canImport = false
        saveBlocked = true
        hooks.onMessage(`原型存档读取失败（${result.error}），本次临时试玩，不覆盖原档`, 'warning')
      }
    }
  } catch {
    canImport = false
    saveBlocked = true
    hooks.onMessage('原型存档无法读取，本次临时试玩，刷新后可能不保留', 'warning')
  }

  renderer.setWorld(world)
  renderer.focusHome()

  const persist = async (): Promise<void> => {
    if (saveBlocked || importing) return
    savePending = false
    try {
      await store.save(serialize(world))
    } catch {
      hooks.onMessage('存档失败：这次进度可能不会保留', 'warning')
    }
  }

  const scheduleSave = (): void => {
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
    if (!order) return
    const interruptedChain = chaining
    chaining = false
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
    abortOrder('⏸ 阿土停下来了，再点一次就好。')
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
    const summary = missionSummary(world)
    const chainDone = summary.done >= summary.total
    // 第一间舱建成后到伙伴真正躺下之前，仍显示“睡眠舱”这一步；
    // 第二间舱（找到水之后）不再让计数回退，直接走探索引导的最后一步。
    const pendingRest = !chainDone && world.pods.length > 0 && !resting
    const mission = pendingRest
      ? FIRST_NIGHT_MISSIONS[FIRST_NIGHT_MISSIONS.length - 1]
      : currentMission(world)
    hooks.onProgress({
      title: mission ? mission.title : '有灯、有床的小家园',
      speech: pendingRest
        ? '小床安好啦！伙伴准备钻进被窝……'
        : mission
          ? mission.speech
          : '伙伴说：有水真好！我们想一直住在这儿。',
      outcome: mission ? mission.outcome : '',
      done: pendingRest ? Math.max(0, summary.done - 1) : summary.done,
      total: summary.total,
      finished: !pendingRest && chainDone,
      relics: relicSummary(world),
    })
    if (chainDone && !pendingRest) hooks.onProgress({ ...explorationGuide(world), relics: relicSummary(world) })
    hooks.onExploration?.({
      clue: world.exploration.clueFound, upgraded: world.exploration.pickaxeUpgraded,
      connected: shaftConnected(world), entered: world.exploration.entered, found: world.exploration.springFound,
      traveling, downstairs: world.exploration.explorer?.y === 21, lampMode, canImport: canImport && !saveBlocked,
      canChain: shaftChainReady(world), chaining, remaining: remainingSegments(),
    })
    pushBuild()

    const guide = guideHighlight(world)
    if (guide.kind === 'none') {
      renderer.setHighlight(null)
    } else {
      renderer.setHighlight({
        x: guide.rect.x * TILE_SIZE,
        y: guide.rect.y * TILE_SIZE,
        width: guide.rect.w * TILE_SIZE,
        height: guide.rect.h * TILE_SIZE,
        tone: guide.kind === 'dig' || guide.kind === 'collect' ? 'cyan' : 'amber',
      })
    }
  }
  pushProgress()

  /** 悬停时的指针形状：可互动区域用 pointer，可挖泥土用 crosshair */
  const pickCursor = (cell: Cell | null): string => {
    if (!cell) return 'default'
    const tile = world.tiles[cell.y][cell.x]
    // 裂纹岩（和它下面已经挖开的梯段）= 阿土的施工目标
    if (isShaftColumn(cell.x) && cell.y >= HOME_FLOOR_Y && cell.y <= SHAFT_LAST_Y && (tile === TILE.WEAK_ROCK || tile === TILE.EMPTY)) {
      const e = world.exploration
      if (!e.pickaxeUpgraded) return tile === TILE.WEAK_ROCK ? 'pointer' : 'default'
      return !e.clueFound || e.shaftX === cell.x ? 'pointer' : 'not-allowed'
    }
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
   * 普通泥土不经过这里——点一下就直接挖开。
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
      const route = moleRoute(world, { x: cell.x, y: HOME_FLOOR_Y - 1 })
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
    const route = moleRoute(world, { x: target.x, y: target.y - 1 })
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
    const route = moleRoute(world, { x: target.x, y: target.y - 1 })
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
    canImport = false
    history.record({ kind: 'dig', x: target.x, y: target.y, tile: result.tile ?? TILE.WEAK_ROCK })
    renderer.refreshTerrain([target])
    renderer.refreshExploration()
    scheduleSave()
    pushProgress()
    const x = world.exploration.shaftX ?? target.x
    if (shaftConnected(world)) {
      // 突破反馈：水声更近、洞口冒凉风、镜头一次拉出整条梯子，并弹出里程碑卡片
      playBreakthrough()
      playWaterClue()
      renderer.playBreakthrough(x)
      renderer.playMoleReaction('通啦！下面有水！')
      notify('💧 哗啦——水声就在下面！梯道通到洞底啦，点“沿梯子下去”。')
      hooks.onMilestone?.({ emoji: '⛏', title: '岩层打通啦！', detail: '梯道一直通到洞底 · 点「沿梯子下去」' })
    } else {
      playRockHit()
      notify(`⛏ 岩壁破开一块，小梯子又接好一节（还剩 ${remainingSegments()} 段）。`)
    }
  }

  const handleTap = (cell: Cell): void => {
    if (traveling) {
      notify(chaining ? '阿土正在一口气往下挖，马上就好！' : '阿土正在沿通道赶过去，马上就好！')
      return
    }
    if (lampMode) {
      if (cell.y < 19 || cell.y > 21 || !canPlaceWallLamp(world, cell.x)) {
        notify('先挖出三格高的空地，避开泉水和梯子，再点这里安壁灯。'); return
      }
      world.exploration.lamps.push({ x: cell.x, y: 19 })
      history.record({ kind: 'lamp', x: cell.x, y: 19 })
      renderer.refreshExploration(); scheduleSave(); pushProgress()
      notify('🏮 新地方亮起一盏小壁灯！还能继续选位置。')
      return
    }
    if (building) {
      // 点击格 = 舱体底边中间格；孩子只需点“想放床的地面”。
      candidate = podAnchorFromPointer(cell)
      pushBuild()
      return
    }
    const beforeDone = missionSummary(world).done
    // 1) 裂纹岩 = 施工委托；普通泥土不经过这里
    if (orderBreakthrough(cell)) return

    // 2) 露面的泉水 = 出动目标：阿土自己沿挖通的通道走到水边
    if (isSpringTarget(cell) && springVisible(world)) {
      const route = moleRoute(world, { x: LANDMARKS.spring.x, y: 21 })
      if (!route) { notify('先挖开脚边的泥土，让阿土能走到水声那边。'); return }
      moveExplorer(route, () => {
        world.exploration.springFound = true
        // 第一次发现泉水：水花 + 光环 + 蹦一下 + 上升的四音，并弹里程碑卡片
        playSpringFound()
        renderer.playSpringDiscovery()
        renderer.playMoleReaction('找到水啦！')
        // 有了水，另外两位朋友才肯搬来——他们先在大厅等着，安好新床就会住进去。
        renderer.refreshFriends()
        notify(`🎉 找到天然泉水啦！还有 ${waitingPartners(world)} 位朋友说：有水就搬来住！`)
        hooks.onMilestone?.({ emoji: '💧', title: '发现地下泉水！', detail: '两位新朋友愿意搬来 · 回暖窝层给他们安新床' })
      })
      return
    }
    if (world.exploration.entered && world.exploration.springFound
      && cell.y >= 19 && cell.y <= 21 && Math.abs(cell.x - LANDMARKS.spring.x) <= 1 && world.tiles[cell.y][cell.x] === TILE.EMPTY) {
      // 找到之后再点泉水：给一点点小水花，不再重复提示
      renderer.playBurst((LANDMARKS.spring.x + 0.5) * TILE_SIZE, 21.5 * TILE_SIZE, { color: 0x8dedfd, count: 6, speed: 50 })
      return
    }

    // 3) 能源石区域：收集（还埋在土里则自然落入挖掘流程）
    if (inRect(LANDMARKS.crystalZone, cell)) {
      if (!world.progress.crystalCollected) {
        const result = collectCrystal(world, cell.x, cell.y)
        if (result.ok) {
          renderer.refresh()
          renderer.playCrystalCollection()
          scheduleSave()
          pushProgress()
          hooks.onMessage('💎 能源石收好啦！')
          return
        }
        // not-revealed：泥土还盖着，继续按挖掘处理
      } else if (world.tiles[cell.y][cell.x] !== TILE.SOIL) {
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

    // 4) 能源核心区域：修复 / 提示 / 已在运转时给个小火花
    if (inRect(LANDMARKS.generatorZone, cell)) {
      const result = repairCore(world, cell.x, cell.y)
      if (result.ok) {
        renderer.refresh()
        renderer.playRepairCelebration()
        scheduleSave()
        pushProgress()
        hooks.onMessage('💡 轰隆隆——家园亮起来啦！🎉')
        return
      }
      if (result.reason === 'need-crystal') {
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

    // 5) 普通挖掘（严格单格）：尘土即反馈，不再逐次弹文字
    const result = dig(world, cell.x, cell.y)
    if (!result.ok) {
      hooks.onMessage(describeDigFailure(result))
      return
    }
    canImport = false
    history.record({ kind: 'dig', x: cell.x, y: cell.y, tile: result.tile ?? TILE.SOIL })
    const revealedNow = missionSummary(world).done > beforeDone
    // 能源石露出来时需要重建地标；普通挖掘只刷新本格与四邻的边缘
    if (revealedNow) renderer.refresh()
    else renderer.refreshTerrain([cell])
    renderer.playDigEffect(cell)
    renderer.refreshExploration()
    scheduleSave()
    pushProgress()
    const relic = relicAt(cell.x, cell.y)
    if (relic) {
      // 埋着的旧避难所遗物：挖开就有发现，摆在这一格上，不进任务链。
      renderer.refreshRelics()
      renderer.playBurst((cell.x + 0.5) * TILE_SIZE, (cell.y + 0.5) * TILE_SIZE, { color: 0xffe6ad, count: 14, speed: 66, ring: true, ringRadius: 26 })
      hooks.onMessage(`${relic.emoji} 挖到「${relic.name}」！${relic.hint}`)
    } else if (revealedNow) {
      hooks.onMessage('💎 能源石露出来了！')
    } else if (result.tile === TILE.WEAK_ROCK) {
      hooks.onMessage(shaftConnected(world) ? '🪜 梯道接到洞底啦！点“沿梯子下去”。' : '⛏ 裂纹岩挖开啦！小梯子也接好了一段。')
    }
  }

  const moveExplorer = (route: Cell[], onArrived?: () => void): void => {
    traveling = true
    pushProgress()
    renderer.focusOn((route[Math.floor(route.length / 2)].x + 0.5) * TILE_SIZE, (route[Math.floor(route.length / 2)].y + 0.5) * TILE_SIZE)
    beginOrder('travel')
    renderer.playExplorationTravel(route, () => {
      // 已经被中断（切后台 / 超时 / 看门狗）：这一趟不算数，世界保持原样。
      if (!order) return
      endOrder()
      world.exploration.explorer = { ...route[route.length - 1] }
      traveling = false
      onArrived?.()
      renderer.refreshExploration(); scheduleSave(); pushProgress()
    })
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
    renderer.playExplorationTravel(route, () => {
      if (!order) return
      endOrder()
      world.exploration.explorer = { ...route[route.length - 1] }
      beginOrder('swing')
      renderer.playRockBreak(target, () => {
        if (!order) return
        endOrder()
        breakSegment(target)
        if (next) next()
        else { traveling = false; pushProgress() }
      })
    })
  }

  const pointer = attachPointerControls(renderer.canvasElement, {
    onTap: (screen) => {
      if (renderer.isOverview) {
        hooks.onMessage('这是家园全景，点“回到家园”就能继续挖掘和建造。')
        return
      }
      const cell = renderer.tileAtScreen(screen)
      if (cell) handleTap(cell)
    },
    onPanBy: (delta) => renderer.panBy(delta.x, delta.y),
    onHover: (screen) => {
      if (renderer.isOverview) {
        renderer.setHoverCell(null)
        renderer.setCursor('default')
        return
      }
      const cell = screen ? renderer.tileAtScreen(screen) : null
      renderer.setHoverCell(building ? null : cell)
      renderer.setCursor(building ? 'copy' : pickCursor(cell))
      if (building) {
        if (hoverBuild?.x === cell?.x && hoverBuild?.y === cell?.y) return
        hoverBuild = cell
        pushBuild()
      }
    },
    onZoom: (delta, anchor) => renderer.zoomBy(delta, anchor),
  })

  /**
   * 切后台 / 回到前台：
   * - 切成后台时先把没播完的委托安全取消（世界不变、输入解锁），再落盘一份一致的存档；
   * - 回到前台时补一句提示，并立刻检查有没有超时卡住的演出。
   */
  const onVisibilityChange = (): void => {
    if (document.visibilityState === 'hidden') {
      pointer.reset()
      if (order) {
        resumeHint = chaining
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
  const onPageHide = (): void => { void persist() }
  /** 窗口失焦不会停帧，只把指针手势复位，避免拖到一半的拖动卡住下一次点击。 */
  const onWindowBlur = (): void => { pointer.reset() }
  document.addEventListener('visibilitychange', onVisibilityChange)
  window.addEventListener('pagehide', onPageHide)
  window.addEventListener('blur', onWindowBlur)

  return {
    setBuildMode: (active) => {
      if (traveling) return
      lampMode = false
      if (active && (!world.progress.coreRepaired || world.pods.length > 0)) return
      building = active
      candidate = null
      hoverBuild = null
      renderer.setHoverCell(null)
      pushBuild()
    },
    confirmBuild: () => {
      if (traveling) return
      if (!building || !candidate) return
      const check = canPlacePod(world, candidate.x, candidate.y)
      if (!check.ok) { hooks.onMessage(BUILD_MESSAGES[check.reason], 'warning'); return }
      const pod = placePod(world, candidate.x, candidate.y)
      if (!pod) return
      history.record({ kind: 'pod', id: pod.id })
      building = false
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
      hooks.onMessage(world.pods.length > 1 ? '🛏️ 新朋友的小床安好啦！' : '🛏️ 小床安好啦！伙伴准备钻进被窝……')
      renderer.playPodEntrance(pod, () => {
        resting = true
        renderer.playPodCelebration(pod)
        pushProgress()
        renderer.refreshExploration()
        hooks.onMessage('💤 伙伴钻进被窝，睡着啦！')
      })
    },
    zoomBy: (delta) => renderer.zoomBy(delta),
    centerOnHome: () => { renderer.focusHome() },
    lookDown: () => {
      building = false
      candidate = null
      hoverBuild = null
      pushBuild()
      renderer.setHoverCell(null)
      renderer.focusWater()
    },
    showOverview: () => {
      building = false
      candidate = null
      hoverBuild = null
      pushBuild()
      renderer.setHoverCell(null)
      renderer.focusOverview()
    },
    undo: () => {
      if (traveling) { hooks.onMessage('等阿土站稳，再撤销吧。'); return }
      // LIFO：优先撤销最近建设 / 挖掘，保护能源石、设施及唯一通路。
      const restored = history.undo(world)
      if (!restored) {
        hooks.onMessage(world.exploration.clueFound ? '已经使用的梯子、脚下和回家的路要留着；新挖的空地仍能撤销。' : '还没有可以撤销的操作')
        return
      }
      // 撤销只影响瓦片：增量刷新本格与邻域边缘
      if (restored.kind === 'pod') { resting = world.pods.length > 0; renderer.refresh() }
      else if (restored.kind === 'lamp') renderer.refreshExploration()
      else {
        renderer.refreshTerrain([restored])
        renderer.playDigEffect(restored)
        // 撤销到遗物那一格时，道具跟着埋回土里。
        renderer.refreshRelics()
      }
      renderer.refreshExploration()
      scheduleSave()
      pushProgress()
      hooks.onMessage('↶ 已撤销上一步')
    },
    focusTarget: () => {
      const guide = guideHighlight(world)
      const rect = guide.kind === 'none' && world.progress.coreRepaired && world.pods.length === 0
        ? LANDMARKS.buildSuggestion : guide.kind === 'none' ? LANDMARKS.shelter : guide.rect
      renderer.focusOn((rect.x + rect.w / 2) * TILE_SIZE, (rect.y + rect.h / 2) * TILE_SIZE)
    },
    upgradeTool: () => {
      if (traveling || !upgradePickaxe(world)) return
      renderer.refreshExploration(); scheduleSave(); pushProgress()
      notify('⛏ 小铁镐准备好啦！点带裂纹的岩石：前两块你来指挥，之后可以点「一路挖到底」。')
    },
    digToBottom: () => {
      if (traveling || !shaftChainReady(world)) return
      startChain()
    },
    travel: () => {
      if (traveling || !shaftConnected(world) || !world.exploration.explorer) return
      lampMode = false
      const down = world.exploration.explorer.y !== 21
      const route = walkingRoute(world, world.exploration.explorer, { x: world.exploration.shaftX!, y: down ? 21 : 11 })
      if (!route) { notify('通道还没连好，先检查梯子和地面。'); return }
      moveExplorer(route, () => {
        if (down) {
          world.exploration.entered = true
          renderer.focusWater()
          renderer.playMoleReaction('到啦！水就在那边。')
          playLayerArrival()
          notify('🪜 到第二层啦！水声从土壁那边传来……')
          hooks.onMilestone?.({ emoji: '🪜', title: '抵达第 2 层 · 泉水层', detail: '冷色的洞壁和苔藓 · 挖到水边就能安家' })
        } else { renderer.focusHome(); notify('⌂ 顺着梯子回到家啦！') }
      })
    },
    toggleLamp: () => {
      if (!world.exploration.springFound || traveling) return
      lampMode = !lampMode; building = false; candidate = null; pushProgress()
      notify(lampMode ? '🏮 点挖空的泉水层洞壁，安一盏小灯。再点工具可以收起。' : '⛏ 继续自由挖掘吧。')
    },
    importLegacy: async () => {
      if (!canImport || saveBlocked || traveling || importing) return
      importing = true; traveling = true; canImport = false
      window.clearTimeout(saveTimer)
      pushProgress()
      try {
        const raw = await loadLegacySave()
        if (!raw) { hooks.onMessage('这个浏览器还没有 v0.1.0 进度，可以直接开始新冒险。'); return }
        if ((raw as { version?: unknown }).version !== 4) { hooks.onMessage('旧进度版本不符合 v0.1.0，原档保持原样。', 'warning'); return }
        const result = deserialize(raw)
        if (!result.ok) { hooks.onMessage(`旧进度无法复制（${result.error}），原档保持原样。`, 'warning'); return }
        await store.save(serialize(result.world))
        world = result.world; resting = world.pods.length > 0
        renderer.setWorld(world); renderer.focusHome(); pushProgress()
        hooks.onMessage('💾 已复制 v0.1.0 的家园！新冒险另存，旧进度仍在。')
      } catch { hooks.onMessage('旧进度复制失败，原档保持原样。', 'warning') }
      finally { importing = false; traveling = false; pushProgress() }
    },
    destroy: () => {
      window.clearTimeout(saveTimer)
      endOrder()
      void persist()
      document.removeEventListener('visibilitychange', onVisibilityChange)
      window.removeEventListener('pagehide', onPageHide)
      window.removeEventListener('blur', onWindowBlur)
      pointer.detach()
      renderer.destroy()
    },
  }
}
