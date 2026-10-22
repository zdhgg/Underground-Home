<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, shallowRef } from 'vue'
import { createGameSession, type BuildState, type ExplorationUI, type FarmUI, type GameSession, type Milestone, type SessionProgress } from './app/session'
import type { DepthView } from './render/camera'
import GuidePanel from './components/GuidePanel.vue'
import DepthNavigation from './components/DepthNavigation.vue'
import PartnerConversationPanel from './components/PartnerConversation.vue'
import type { PartnerConversation } from './core/partnerInteractions'
import RoomTools from './components/RoomTools.vue'
import SiteTools from './components/SiteTools.vue'
import { emptySiteUI } from './app/siteEditor'
import { freshInventory } from './core/world'
import type { RoomUI } from './app/roomEditor'
import type { WorkUI } from './app/partnerOrders'
import type { WorkerId } from './core/world'
import { createIndexedDbStore, type SaveStore } from './core/persistence'
import type { SaveStatus } from './app/saveSummary'
import StartScreen from './components/StartScreen.vue'
import InventoryDialog from './components/InventoryDialog.vue'
import type { BagItem } from './core/bag'
import { ITEM_ART } from './app/itemArt'

const stageEl = ref<HTMLElement | null>(null)
const session = shallowRef<GameSession | null>(null)
const fatalError = ref('')
const screen = ref<'title' | 'opening' | 'playing'>('title')
/** 进入页的存档摘要：没有、可继续或读不出来 */
const save = ref<SaveStatus>({ status: 'loading' })
const persistent = ref(false)
const opening = ref({ active: false, caption: '' })
const openingSound = ref(false)
const conversation = ref<PartnerConversation | null>(null)
const work = ref<WorkUI | null>(null)
const workers = ref<{ id: WorkerId; name: string; verb: string }[]>([])
const partnerMenu = ref(false)
const sites = ref(emptySiteUI())
const inventory = ref(freshInventory())
const bag = ref<BagItem[]>([])
const bagOpen = ref(false)
const bagInitialItem = ref('stone')
const rooms = ref<RoomUI>({ active: false, available: false, kind: 'home', width: 3, minWidth: 3, selectedId: null, placed: false, valid: false, dirty: false, message: '', detail: '', items: [], construction: false, completed: false, busy: false, action: '放下蓝图', left: 0 })
const message = ref('')
const messageWarning = ref(false)
const toastVisible = ref(false)
const progress = ref<SessionProgress>({
  title: '找到发光的能源石',
  speech: '外面风雪好大！先在地下安家吧。挖开左边泛蓝光的泥土，找能源石把家照亮。',
  outcome: '能源石能把家园照亮。',
  done: 0,
  total: 4,
  finished: false,
  relics: { found: 0, total: 3 },
})
const build = ref<BuildState>({ digging: false, podAvailable: false, planterAvailable: false, mode: 'none', selected: false, valid: false, message: '', podCount: 0, planterCount: 0 })
const view = ref<DepthView>({ layer: 'home', overview: false })
const farm = ref<FarmUI>({ canSupplyWater: false, supplying: false, unlocked: false, planterCount: 0, ripe: 0, food: 0, harvested: false, canSendPower: false, powering: false, powerDown: false, kitchen: false, dining: false, mealReady: false, mealActive: false })
const exploration = ref<ExplorationUI>({ wideLighting: false, lightUpgradeReady: false, clue: false, upgraded: false, connected: false, entered: false, found: false, traveling: false, downstairs: false, lampMode: false, canChain: false, chaining: false, remaining: 0 })
/** 里程碑卡片：突破岩层 / 抵达第二层 / 发现泉水时弹一次，几秒后自己收走 */
const milestone = ref<Milestone | null>(null)

/** 底部状态栏的一行提示：跟着当前能做的事走 */
const legendHint = computed(() => {
  if (sites.value.working) return '🔨 阿土正在修建洞室 · 拖动看地图，随时可以停下来'
  if (build.value.digging) return '⛏ 点泥土挖一块、找到材料 · 拖动看地图'
  if (work.value) return `${work.value.name}正在${work.value.title} · 可以拖图看家园，或停下来改目标`
  if (view.value.overview) return '一张连续剖面 · 家园会一层一层向下生长'
  if (exploration.value.lampMode) return exploration.value.wideLighting ? '🏮 点旧灯加装，或点空洞装聚光灯 · 左右各照4格' : '🏮 壁灯选址中 · 点空洞安灯，再点工具收起'
  if (!exploration.value.upgraded) return '🟫 泥土可挖　🪨 找找有裂纹的岩壁'
  if (!exploration.value.entered) return '⛏ 点裂纹岩：阿土一镐一镐往下挖　🪨 坚硬基岩保留'
  if (!exploration.value.found) return '🟫 点泥土挖过去　💧 看见泉水点一下它'
  if (!farm.value.unlocked) return '🚰 泉水找到啦 · 点「把水接到菜园」'
  if (farm.value.mealActive) return '🍲 大家正在吃饭 · 点地图或「停下来」可以先结束'
  if (farm.value.ripe > 0) return '🥕 有菜熟了 · 点菜槽，小满来收'
  if (farm.value.mealReady && farm.value.food > 0) return '🍲 灶台和餐桌都好了 · 做饭请大家吃饭'
  if (farm.value.mealReady) return '🍲 灶台和餐桌都好了 · 收点菜就能开饭'
  if (!farm.value.kitchen) return '🔨 点「泉边建设」修一个灶台'
  if (!farm.value.dining) return '🍽 再摆一张餐桌，大家就能围坐'
  return '🌱 点泉边小菜园就能建设 · 熟了叫小满来收'
})

/** 第一层不是一张会结束的清单：住处、旧物、客厅都可以慢慢做。 */
/** 当前引导是不是“去安床”：是的话，建房入口要排在水电按钮前面。 */
const bedStep = computed(() => progress.value.title === '给伙伴安一个睡眠舱' || progress.value.title === '安顿新朋友')
/** 当前引导是不是“去种菜”：是的话，直接切到第二层的种植槽工具。 */
const farmStep = computed(() => progress.value.title === '在泉水边种出第一份食物')

const homeGoals = computed(() => {
  const relics = progress.value.relics
  const lounge = rooms.value.items.some(item => item.kind === 'lounge' && item.built)
  return [
    { key: 'bed', label: '住处', done: build.value.podCount > 0, detail: build.value.podCount ? `${build.value.podCount}间` : '还没建' },
    { key: 'relics', label: '旧避难所的东西', done: relics.total > 0 && relics.found >= relics.total, detail: `${relics.found}/${relics.total}` },
    { key: 'lounge', label: '客厅', done: lounge, detail: lounge ? '已建好' : '还没建' },
  ]
})
const showHomeGoals = computed(() => view.value.layer === 'home' && !view.value.overview
  && (rooms.value.available || build.value.podCount > 0))
const homeExtra = computed(() => {
  if (!showHomeGoals.value) return ''
  // 当前主线就是“去建床”时，不把“住处”再列一遍“还能做”。
  const undone = homeGoals.value.filter(goal => !goal.done && !(goal.key === 'bed' && build.value.podAvailable))
  return undone.map(goal => goal.key === 'relics' ? `旧物 ${goal.detail}` : goal.label).join(' · ')
})

let toastTimer: number | undefined
let milestoneTimer: number | undefined

function openBag(item = 'stone'): void {
  if (screen.value !== 'playing' || !session.value) return
  bagInitialItem.value = item; bagOpen.value = true; partnerMenu.value = false
  session.value.setInputBlocked(true)
}
function closeBag(): void {
  bagOpen.value = false; session.value?.setInputBlocked(false)
}
function showCollection(): void { closeBag(); session.value?.focusCollection() }
function findRelic(id: string): void { closeBag(); session.value?.focusRelic(id) }

function showMessage(text: string, warning = false): void {
  message.value = text
  messageWarning.value = warning
  toastVisible.value = true
  window.clearTimeout(toastTimer)
  toastTimer = window.setTimeout(() => {
    toastVisible.value = false
  }, 2600)
}

function showMilestone(card: Milestone): void {
  milestone.value = card
  window.clearTimeout(milestoneTimer)
  milestoneTimer = window.setTimeout(() => {
    milestone.value = null
  }, 3000)
}

async function startGame(mode: 'new' | 'continue'): Promise<void> {
  if (!session.value || screen.value !== 'title') return
  if (mode === 'continue') {
    // 存档已经在后台读进场景：直接进入游戏，不重播开场。
    screen.value = 'playing'
    return
  }
  try {
    await session.value.startNewGame()
  } catch {
    showMessage('没能重新开始，请刷新页面再试。', true)
    return
  }
  screen.value = 'opening'
  openingSound.value = true
  session.value.startOpening()
  session.value.enableOpeningSound()
}

onMounted(async () => {
  const host = stageEl.value
  if (!host) return
  let store: SaveStore | undefined
  try {
    if (typeof indexedDB !== 'undefined') {
      store = createIndexedDbStore()
      persistent.value = true
    }
  } catch {
    persistent.value = false
  }
  try {
    session.value = await createGameSession(host, {
      onMessage: (text, kind) => showMessage(text, kind === 'warning'),
      onOpening: next => {
        opening.value = next
        if (!next.active && screen.value === 'opening') screen.value = 'playing'
      },
      onProgress: (next) => {
        progress.value = next
      },
      onBuild: (next) => { build.value = next },
      onView: (next) => { view.value = next },
      onExploration: (next) => { exploration.value = next },
      onFarm: (next) => { farm.value = next },
      onMilestone: showMilestone,
      onPartnerConversation: (next) => { conversation.value = next },
      onRooms: next => { rooms.value = next },
      onSites: next => { sites.value = next },
      onInventory: next => { inventory.value = next },
      onBag: next => { bag.value = next },
      onBagRequested: () => openBag(bag.value.find(i => i.kind === 'relic' && i.count)?.id ?? 'seed-pouch'),
      onWork: next => { work.value = next; partnerMenu.value = false },
      onWorkers: next => { workers.value = next },
    }, { deferOpening: true, store })
    save.value = session.value.titleSave()
  } catch {
    opening.value.active = false
    fatalError.value = '渲染初始化失败：当前浏览器可能不支持 WebGL，请换用新版浏览器打开。'
  }
})

onBeforeUnmount(() => {
  window.clearTimeout(toastTimer)
  window.clearTimeout(milestoneTimer)
  session.value?.destroy()
  session.value = null
})
</script>

<template>
  <StartScreen
    v-if="screen === 'title'"
    :ready="!!session"
    :error="fatalError"
    :save="save"
    :persistent="persistent"
    @start="startGame('new')"
    @continue="startGame('continue')"
  />
  <div class="app" :class="{ 'is-opening': opening.active }" :inert="screen === 'title' || bagOpen" :aria-hidden="screen === 'title' || bagOpen">
    <header class="top">
      <div class="brand">
        <span class="logo">🏔️</span>
        <div class="brand-text">
          <h1>地下小家园</h1>
          <small>从风雪中出发 · 自由建设地下家园</small>
        </div>
      </div>
      <button class="inventory" type="button" aria-label="打开物品栏" aria-haspopup="dialog" :aria-expanded="bagOpen" @click="openBag()"><span class="bag-label"><img :src="ITEM_ART.bag" alt="" /><span>物品栏</span></span><span><img :src="ITEM_ART.stone" alt="" /><b>{{ inventory.stone }}</b><small>石料</small></span><span><img :src="ITEM_ART.wood" alt="" /><b>{{ inventory.wood }}</b><small>旧木料</small></span></button>
      <DepthNavigation :view="view" @home="session?.centerOnHome()" @water="session?.lookDown()" @overview="session?.showOverview()" />
    </header>

    <main class="stage">
      <div ref="stageEl" class="stage-canvas" />
      <div v-if="fatalError" class="fatal">{{ fatalError }}</div>
      <section v-if="opening.active" class="opening-overlay" aria-label="开场动画">
        <div class="opening-actions">
          <button type="button" :disabled="!session" :aria-pressed="openingSound" @click="openingSound = true; session?.enableOpeningSound()">{{ openingSound ? '声音已开启' : '开启声音' }}</button>
          <button type="button" :disabled="!session" @click="session?.skipOpening()">跳过开场 <small>Esc</small></button>
        </div>
        <p class="opening-caption" aria-live="polite">{{ opening.caption }}</p>
      </section>

      <SiteTools v-if="sites.active" :state="sites" @close="session?.closeRooms()" @select="session?.selectSite($event)" @kind="session?.siteKind($event)" @build="session?.buildSite()" @stop="session?.cancelAction()" @dig="session?.setBuildMode('none')" />
      <RoomTools v-else-if="rooms.active" :state="rooms" @close="session?.closeRooms()" @kind="session?.roomKind($event)" @resize="session?.roomWidth($event)" @save="session?.saveRoom()" @remove="session?.removeRoom()" @select="session?.selectRoom($event)" @create="session?.newRoom()" />
      <section v-else-if="work" class="work-status" aria-label="伙伴工作" role="status">
        <small>伙伴来帮忙</small>
        <strong>{{ work.name }} · {{ work.title }}</strong>
        <p>{{ work.phase === 'walking' ? '正沿通道走过去…' : work.phase === 'working' ? '到地方啦，正在动手…' : '水管接好了，正在沿梯子回家…' }}</p>
        <div><button type="button" @click="session?.findPartner(work.worker)">看看{{ work.name }}</button><button type="button" @click="session?.cancelAction()">停下来</button></div>
      </section>
      <PartnerConversationPanel
        v-else-if="conversation && !view.overview"
        :key="conversation.partnerId"
        :conversation="conversation"
        :busy="exploration.traveling"
        @close="session?.closePartnerConversation()"
        @action="session?.partnerAction()"
      />
      <GuidePanel v-else-if="!view.overview" :title="progress.title" :done="progress.done" :total="progress.total" :finished="progress.finished" @focus="session?.focusTarget()">
        <template #quick-action>
          <button v-if="exploration.lampMode" class="talk-action" type="button" @click="session?.toggleLamp()">⛏ 收起壁灯，继续挖掘</button>
          <button v-else-if="farm.canSupplyWater" class="adventure-action water" type="button" :disabled="farm.supplying || exploration.traveling" @click="session?.supplyWater()">{{ farm.supplying ? '小泉在接水管……' : '🚰 把水接到菜园' }}</button>
          <button v-else-if="bedStep && build.podAvailable && rooms.available" class="talk-action" type="button" :disabled="exploration.traveling || build.mode !== 'none'" @click="session?.openRooms()">🛏 去修小窝</button>
          <button v-else-if="farmStep && farm.unlocked" class="talk-action" type="button" :disabled="exploration.traveling" @click="session?.startPlanting()">🌱 去第二层种菜</button>
          <button v-else-if="farm.canSendPower" class="adventure-action power" type="button" :disabled="farm.powering || exploration.traveling" @click="session?.sendPower()">{{ farm.powering ? '阿土在铺电线……' : '⚡ 把电送到下面' }}</button>
          <button v-else-if="exploration.clue && !exploration.upgraded" class="talk-action" type="button" :disabled="exploration.traveling || build.mode !== 'none' || exploration.lampMode" @click="session?.talkToPartner('atu')">⛏ 和阿土聊聊新工具</button>
          <button v-else-if="exploration.lightUpgradeReady" class="talk-action" type="button" :disabled="exploration.traveling || build.mode !== 'none' || exploration.lampMode" @click="session?.talkToPartner('adeng')">🏮 阿灯有个新办法</button>
          <button v-else-if="exploration.canChain" class="adventure-action chain" type="button" :disabled="exploration.traveling" @click="session?.digToBottom()">{{ exploration.chaining ? `阿土正在挖……（还剩 ${exploration.remaining} 段）` : '⛏ 一路挖到底' }}</button>
          <button v-else-if="farm.harvested && farm.food > 0" class="adventure-action meal" type="button" :disabled="exploration.traveling || farm.mealActive" @click="session?.feed()">{{ farm.mealActive ? '🍲 大家正在吃饭……' : farm.mealReady ? `🍲 做饭并请大家吃饭（食物 ${farm.food}）` : `🍽 请大家吃饭（食物 ${farm.food}）` }}</button>
          <p v-if="homeExtra" class="home-extra">家里还能做：{{ homeExtra }}</p>
        </template>
        <p class="mole-speech">{{ progress.speech }}</p>
        <p v-if="!progress.finished" class="mole-outcome">✨ {{ progress.outcome }}</p>
        <button v-if="exploration.lightUpgradeReady" class="talk-action light-idea" type="button" :disabled="exploration.traveling || build.mode !== 'none' || exploration.lampMode" @click="session?.talkToPartner('adeng')">🏮 阿灯有个照亮新地方的办法</button>
        <button class="talk-action" type="button" :disabled="exploration.traveling || build.mode !== 'none' || exploration.lampMode" @click="session?.talkToPartner('atu')">{{ exploration.clue && !exploration.upgraded ? '⛏ 和阿土聊聊新工具' : '和阿土聊聊' }}</button>
        <button
          v-if="exploration.canChain"
          type="button"
          class="adventure-action chain"
          :disabled="exploration.traveling"
          @click="session?.digToBottom()"
        >{{ exploration.chaining ? `⛏ 阿土正在挖……（还剩 ${exploration.remaining} 段）` : `⛏ 一路挖到底（还剩 ${exploration.remaining} 段）` }}</button>
        <button v-if="exploration.connected" type="button" class="adventure-action" :disabled="exploration.traveling" @click="session?.travel()">{{ exploration.traveling ? '🪜 阿土正在走……' : exploration.downstairs ? '↑ 沿梯子回家' : '↓ 沿梯子下去' }}</button>
        <button v-if="exploration.found" type="button" class="ghost" :aria-pressed="exploration.lampMode" @click="session?.toggleLamp()">{{ exploration.lampMode ? '⛏ 收起壁灯，继续挖掘' : exploration.wideLighting ? '🏮 布置聚光灯' : '🏮 安一盏小壁灯' }}</button>
        <button v-if="farm.canSupplyWater" type="button" class="adventure-action water" :disabled="farm.supplying || exploration.traveling" @click="session?.supplyWater()">{{ farm.supplying ? '🚰 小泉在接水管……' : '🚰 把水接到菜园' }}</button>
        <button v-if="farmStep && farm.unlocked" type="button" class="talk-action" :disabled="exploration.traveling" @click="session?.startPlanting()">🌱 去第二层种菜</button>
        <button v-if="farm.canSendPower" type="button" class="adventure-action power" :disabled="farm.powering || exploration.traveling" @click="session?.sendPower()">{{ farm.powering ? '⚡ 阿土在铺电线……' : '⚡ 把电送到下面' }}</button>
        <button v-if="farm.harvested" type="button" class="adventure-action meal" :disabled="farm.food === 0 || exploration.traveling || farm.mealActive" @click="session?.feed()">{{ farm.mealActive ? '🍲 大家正在吃饭……' : farm.food > 0 ? farm.mealReady ? `🍲 做饭并请大家吃饭（食物 ${farm.food}）` : `🍽 请大家吃饭（食物 ${farm.food}）` : '🍽 先收点菜再开饭' }}</button>
        <section v-if="showHomeGoals" class="home-goals" aria-label="家里的小清单">
          <strong>家里的小清单</strong>
          <ul>
            <li v-for="goal in homeGoals" :key="goal.key" :class="{ done: goal.done }">
              <span aria-hidden="true">{{ goal.done ? '✓' : '○' }}</span>
              <span>{{ goal.label }}</span>
              <small>{{ goal.detail }}</small>
            </li>
          </ul>
        </section>
      </GuidePanel>

      <div class="zoom">
        <button type="button" aria-label="放大" @click="session?.zoomBy(0.12)">＋</button>
        <button type="button" aria-label="缩小" @click="session?.zoomBy(-0.12)">－</button>
      </div>

      <button type="button" class="undo" @click="session?.undo()">↶ 撤销</button>
      <div class="atu-controls">
        <div v-if="workers.length" class="partner-finder">
          <button type="button" :aria-expanded="partnerMenu" @click="partnerMenu = !partnerMenu">伙伴在哪</button>
          <div v-if="partnerMenu" class="partner-menu" aria-label="寻找伙伴">
            <button v-for="item in workers" :key="item.id" type="button" @click="session?.findPartner(item.id); partnerMenu = false">{{ item.name }} <small>{{ item.verb }}</small></button>
          </div>
        </div>
        <button type="button" @click="session?.findAtu()">⌖ 找到阿土</button>
        <button v-if="exploration.traveling && !work" type="button" @click="session?.cancelAction()">停下来</button>
      </div>
      <section v-if="rooms.available && !rooms.active && !sites.active && !work && !conversation && !view.overview" class="build-tools" aria-label="建设工具">
        <div class="build-buttons">
          <button type="button" :aria-pressed="build.mode === 'none' && build.digging" @click="session?.setBuildMode('none')">⛏ 挖掘找材料</button>
          <button v-if="rooms.available" type="button" :disabled="exploration.traveling" @click="session?.openRooms()">🔨 {{ view.layer === 'home' ? '修建洞室' : '泉边建设' }}</button>
          <button v-for="room in rooms.items.filter(item => !item.built)" :key="room.id" type="button" :disabled="exploration.traveling" @click="session?.selectRoom(room.id)">继续原来的{{ room.name }}</button>
          <button v-if="build.planterAvailable && view.layer === 'water'" type="button" :aria-pressed="build.mode === 'planter'" :disabled="exploration.traveling" @click="session?.setBuildMode('planter')">🌱 自己摆菜槽</button>
          <template v-if="build.mode !== 'none'">
            <button type="button" class="confirm" :disabled="!build.valid" @click="session?.confirmBuild()">✅ 确认建造</button>
            <button type="button" class="cancel" @click="session?.setBuildMode(build.mode)">✖ 取消</button>
          </template>
        </div>
        <p v-if="build.mode !== 'none'" role="status">{{ build.message }}</p>
      </section>

      <transition name="card">
        <div v-if="milestone" class="milestone" role="status">
          <span class="milestone-emoji">{{ milestone.emoji }}</span>
          <div class="milestone-text">
            <strong>{{ milestone.title }}</strong>
            <small>{{ milestone.detail }}</small>
          </div>
        </div>
      </transition>

      <transition name="toast">
        <div v-if="toastVisible" class="toast" :class="{ warning: messageWarning }">{{ message }}</div>
      </transition>
    </main>

    <footer class="bottom">
      <span class="context-hint" role="status">{{ legendHint }}</span>
      <div class="resources">
        <span v-if="progress.relics.found">🧰 遗物 {{ progress.relics.found }}/{{ progress.relics.total }}</span>
        <span v-if="farm.planterCount">🥕 熟了 {{ farm.ripe }} · 食物 {{ farm.food }}</span>
        <span class="input-hint">点一下行动 · 拖动看地图</span>
      </div>
    </footer>
  </div>
  <InventoryDialog v-if="bagOpen && screen === 'playing'" :items="bag" :initial-item="bagInitialItem" :collection-available="rooms.available" @close="closeBag" @collection="showCollection" @find="findRelic" />
</template>

<style scoped>
.app { height: 100%; display: flex; flex-direction: column; gap: 8px; padding: 10px; }
.opening-overlay { position: absolute; z-index: 20; inset: 0; background: linear-gradient(#0b1a251c, transparent 20%, transparent 73%, #0b1a2570); }
.opening-actions { position: absolute; top: 18px; right: 18px; display: flex; gap: 10px; }
.opening-actions button { min-height: 44px; padding: 0 17px; border-radius: 22px; color: #edf5f2; background: #162b38d9; border: 1px solid #abc6cc55; font-size: 14px; }
.opening-actions small { margin-left: 8px; opacity: .6; }
.opening-caption { position: absolute; bottom: 25px; left: 20px; right: 20px; text-align: center; color: #f5f4e8; font-size: clamp(16px, 2vw, 21px); font-weight: 600; letter-spacing: 1px; text-shadow: 0 2px 10px #10202f; }
.is-opening .stage > :not(.stage-canvas):not(.opening-overlay):not(.fatal) { visibility: hidden; }
.is-opening .top :deep(nav), .is-opening .bottom { visibility: hidden; }
.is-opening .top { pointer-events: none; }
.top { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 6px 12px; border-radius: 14px; background: #f8fbf8; flex: none; }
.brand { display: flex; align-items: center; gap: 10px; }
.logo { font-size: 24px; line-height: 1; }
.brand-text h1 { font-size: 17px; margin: 0; white-space: nowrap; }
.brand-text small { font-size: 11px; color: #62756b; }
.inventory { display: flex; align-items: center; justify-content: center; gap: 12px; min-height: 44px; padding: 6px 10px; border-radius: 12px; background: #edf3eb; color: #476759; font-size: 15px; cursor: pointer; }
.inventory img { width: 26px; height: 26px; object-fit: contain; }.inventory:hover { background: #e0eddf; }.inventory:focus-visible { outline: 3px solid #548c70; outline-offset: 2px; }
.inventory > span { display: flex; align-items: center; gap: 5px; white-space: nowrap; }.inventory small { font-size: 11px; color: #62756b; }.inventory b { font-size: 17px; font-variant-numeric: tabular-nums; }.bag-label { font-size: 12px; color: #62756b; }
.stage { position: relative; flex: 1; min-height: 0; border-radius: 16px; overflow: hidden; background: #22313a; }
.stage-canvas { position: absolute; inset: 0; }
.stage-canvas :deep(canvas) { display: block; touch-action: none; user-select: none; -webkit-user-select: none; }
.fatal { position: absolute; z-index: 10; inset: 0; display: grid; place-items: center; padding: 24px; text-align: center; color: #ffd9c4; background: #22313aee; font-size: 14px; }

.work-status { position: absolute; z-index: 4; top: 12px; left: 12px; width: min(288px, calc(100% - 84px)); max-height: calc(100% - 88px); overflow-y: auto; padding: 14px; border-radius: 14px; background: #f9fcf9f5; color: #365447; box-shadow: 0 3px 12px #142c2420; }
.work-status > small { display: block; color: #62756b; font-size: 12px; margin-bottom: 6px; }
.work-status strong { font-size: 17px; }
.work-status p { font-size: 14px; line-height: 1.6; margin: 10px 0 12px; }
.work-status > div { display: flex; gap: 8px; }
.work-status button { flex: 1; min-height: 44px; border-radius: 9px; color: #476759; background: #e3ede2; font-size: 14px; }
.work-status button:last-child { background: #edf1ed; }
.mole-speech { margin: 0; font-size: 14px; line-height: 1.65; color: #44584c; }
.mole-outcome { margin: 0 0 2px; font-size: 13px; line-height: 1.5; color: #62756b; }
.home-extra { margin: 7px 2px 0; color: #62756b; font-size: 12px; line-height: 1.5; }
.home-goals { margin-top: 10px; padding-top: 10px; border-top: 1px dashed #d3dfd2; }
.home-goals strong { display: block; margin-bottom: 6px; color: #4a6759; font-size: 12px; font-weight: 700; }
.home-goals ul { display: grid; gap: 5px; margin: 0; padding: 0; list-style: none; }
.home-goals li { display: flex; align-items: center; gap: 7px; color: #4e665a; font-size: 12px; line-height: 1.5; }
.home-goals li > span:first-child { width: 13px; color: #c08d4a; text-align: center; }
.home-goals li.done { color: #83968a; }
.home-goals li.done > span:first-child { color: #5d9273; }
.home-goals li small { margin-left: auto; color: #83968a; font-size: 11px; }
.talk-action, .adventure-action, .ghost { min-height: 44px; padding: 10px 12px; border-radius: 9px; background: #e4eee5; color: #3c6154; font-size: 14px; font-weight: 600; }
.talk-action:hover, .ghost:hover { background: #d8e7da; }
.adventure-action { background: #3c8063; color: white; }
.adventure-action.chain { background: #916326; }
.adventure-action.water { background: #3f7f9a; }
.adventure-action.power { background: #586ca0; }
.adventure-action.meal { background: #a05d3c; }
.adventure-action:hover { filter: brightness(.94); }
.talk-action:disabled, .adventure-action:disabled, .build-buttons button:disabled { opacity: .5; cursor: default; }

.zoom { position: absolute; top: 12px; right: 12px; display: flex; flex-direction: column; padding: 4px; border-radius: 12px; background: #f9fcf9f0; }
.zoom button { width: 44px; height: 44px; border-radius: 8px; background: transparent; color: #3c6154; font-size: 22px; font-weight: 700; }
.zoom button:hover { background: #e1ebe3; }
.undo { position: absolute; right: 12px; bottom: 12px; min-height: 44px; padding: 0 16px; border-radius: 10px; background: #f9fcf9f5; color: #3c6154; font-size: 14px; font-weight: 700; }
.undo:hover { background: #e1ebe3; }
.atu-controls { position: absolute; z-index: 3; right: 108px; bottom: 12px; display: flex; gap: 6px; max-width: calc(100% - 120px); flex-wrap: wrap; justify-content: flex-end; }
.atu-controls button { min-height: 44px; padding: 8px 12px; border-radius: 10px; color: #3c6154; background: #f9fcf9f5; font-size: 13px; }
.atu-controls button:hover { background: #e1ebe3; }
.partner-finder { position: relative; }
.partner-menu { position: absolute; bottom: 52px; right: 0; width: 166px; display: grid; gap: 5px; padding: 8px; background: #f9fcf9; border-radius: 12px; box-shadow: 0 4px 18px #142c2426; }
.partner-menu button { display: flex; justify-content: space-between; align-items: center; gap: 8px; width: 100%; }
.partner-menu small { color: #62756b; }

.build-tools { position: absolute; bottom: 72px; left: 12px; max-width: calc(100% - 24px); border-radius: 12px; padding: 6px; background: #f9fcf9f5; color: #44584c; }
.build-buttons { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.build-buttons button { min-height: 44px; border-radius: 9px; padding: 10px 12px; background: #e9eee4; color: #3c6154; font-size: 14px; font-weight: 600; }
.build-buttons button[aria-pressed="true"], .build-buttons button:not([aria-pressed]) { background: #3c8063; color: white; }
.build-buttons button.cancel { background: #edf1ed; color: #50675c; }
.build-tools p { margin: 7px 6px 4px; font-size: 13px; line-height: 1.5; }

.bottom { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 0 4px; color: #5c7065; font-size: 12px; line-height: 1.5; flex: none; }
.context-hint { min-width: 0; }
.resources { display: flex; align-items: center; justify-content: flex-end; gap: 16px; flex-wrap: wrap; }
.resources > span { white-space: nowrap; }
.input-hint { color: #63786d; }
.milestone { position: absolute; z-index: 5; top: 16%; left: 50%; transform: translateX(-50%); display: flex; align-items: center; gap: 12px; max-width: calc(100% - 24px); padding: 12px 20px; border-radius: 14px; background: #f9fcf9f5; border: 2px solid #e9c57d; box-shadow: 0 6px 20px #142c2426; pointer-events: none; }
.milestone-emoji { font-size: 30px; }
.milestone-text { display: flex; flex-direction: column; line-height: 1.4; }
.milestone-text strong { font-size: 18px; color: #37624a; }
.milestone-text small { font-size: 12px; color: #62756b; }
.card-enter-active, .card-leave-active { transition: opacity .18s ease; }
.card-enter-from, .card-leave-to { opacity: 0; }
.toast { position: absolute; z-index: 6; left: 50%; bottom: 140px; transform: translateX(-50%); background: #f9fcf9f5; color: var(--ink); border-radius: 10px; padding: 10px 16px; font-size: 14px; font-weight: 600; box-shadow: 0 3px 12px #142c2426; max-width: 82%; pointer-events: none; }
.toast.warning { background: #fff3e2f5; color: #8a5a2b; }
.toast-enter-active, .toast-leave-active { transition: opacity .18s ease; }
.toast-enter-from, .toast-leave-to { opacity: 0; }

@media (max-width: 720px) {
  .inventory { gap: 8px; margin-left: auto; }.inventory .bag-label > span { display: none; }.inventory small { font-size: 10px; }
  .app { padding: 6px; gap: 6px; }
  .top { flex-wrap: wrap; gap: 4px; padding: 6px; border-radius: 12px; }
  .brand { padding: 2px 6px; gap: 8px; }
  .brand-text h1 { font-size: 16px; }
  .brand-text small { display: none; }
  .logo { font-size: 20px; }
  .stage { border-radius: 12px; }
  .zoom { top: 8px; right: 8px; }
  .undo { right: 8px; bottom: 8px; }
  .atu-controls { right: 104px; bottom: 8px; max-width: calc(100% - 112px); }
  .atu-controls button { padding: 8px 10px; font-size: 12px; }
  .build-tools { left: 8px; bottom: 112px; max-width: calc(100% - 16px); }
  .work-status { top: 8px; left: 8px; width: 264px; padding: 12px; }
  .bottom { align-items: flex-start; flex-direction: column; gap: 2px; font-size: 11px; }
  .resources { justify-content: flex-start; gap: 12px; }
  .input-hint { display: none; }
  .resources:empty { display: none; }
  .milestone { top: 30%; padding: 10px 14px; gap: 8px; }
  .milestone-emoji { font-size: 22px; }
  .milestone-text strong { font-size: 15px; }
}
@media (max-height: 500px) and (min-width: 721px) { .brand-text small, .bottom { display: none; }.top { padding-top: 2px; padding-bottom: 2px; } }
@media (prefers-reduced-motion: reduce) { .card-enter-active, .card-leave-active, .toast-enter-active, .toast-leave-active { transition: none; } }
</style>
