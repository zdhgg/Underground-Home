<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, shallowRef } from 'vue'
import { createGameSession, type BuildState, type ExplorationUI, type FarmUI, type GameSession, type Milestone, type SessionProgress } from './app/session'
import { STRATA } from './core/world'
import type { DepthView } from './render/camera'

const stageEl = ref<HTMLElement | null>(null)
const session = shallowRef<GameSession | null>(null)
const fatalError = ref('')
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
const build = ref<BuildState>({ podAvailable: false, planterAvailable: false, mode: 'none', selected: false, valid: false, message: '', podCount: 0, planterCount: 0 })
const view = ref<DepthView>({ layer: 'home', overview: false })
const farm = ref<FarmUI>({ canSupplyWater: false, supplying: false, unlocked: false, planterCount: 0, ripe: 0, food: 0, harvested: false, canSendPower: false, powering: false, powerDown: false })
const exploration = ref<ExplorationUI>({ clue: false, upgraded: false, connected: false, entered: false, found: false, traveling: false, downstairs: false, lampMode: false, canImport: false, canChain: false, chaining: false, remaining: 0 })
/** 里程碑卡片：突破岩层 / 抵达第二层 / 发现泉水时弹一次，几秒后自己收走 */
const milestone = ref<Milestone | null>(null)

/** 画面左下角的一行提示：跟着当前能做的事走 */
const legendHint = computed(() => {
  if (view.value.overview) return '一张连续剖面 · 家园会一层一层向下生长'
  if (exploration.value.lampMode) return '🏮 壁灯选址中 · 点空洞安灯，再点工具收起'
  if (!exploration.value.upgraded) return '🟫 泥土可挖　🪨 找找有裂纹的岩壁'
  if (!exploration.value.entered) return '⛏ 点裂纹岩：阿土一镐一镐往下挖　🪨 坚硬基岩保留'
  if (!exploration.value.found) return '🟫 点泥土挖过去　💧 看见泉水点一下它'
  if (!farm.value.unlocked) return '🚰 泉水找到啦 · 点「把水引到家里」'
  if (farm.value.ripe > 0) return '🥕 有菜熟了 · 点它就能收'
  return '💧 水到家啦 · 种菜、收菜、请伙伴吃饭'
})

let toastTimer: number | undefined
let milestoneTimer: number | undefined

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

onMounted(async () => {
  const host = stageEl.value
  if (!host) return
  try {
    session.value = await createGameSession(host, {
      onMessage: (text, kind) => showMessage(text, kind === 'warning'),
      onProgress: (next) => {
        progress.value = next
      },
      onBuild: (next) => { build.value = next },
      onView: (next) => { view.value = next },
      onExploration: (next) => { exploration.value = next },
      onFarm: (next) => { farm.value = next },
      onMilestone: showMilestone,
    })
  } catch {
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
  <div class="app">
    <header class="top">
      <div class="brand">
        <span class="logo">🏔️</span>
        <div class="brand-text">
          <h1>地下小家园</h1>
          <small>把黑暗的避难所，变成温暖的家</small>
        </div>
      </div>
      <div class="mission" :class="{ 'mission-done': progress.finished }">
        <span class="mission-badge">{{ progress.finished ? '☑' : '🌙' }}</span>
        <span class="mission-title">{{ progress.title }}</span>
        <span class="mission-count">{{ progress.done }}/{{ progress.total }}</span>
      </div>
    </header>

    <main class="stage">
      <div ref="stageEl" class="stage-canvas" />
      <div v-if="fatalError" class="fatal">{{ fatalError }}</div>

      <section v-if="!view.overview" class="mole" :class="{ 'mole-done': progress.finished }">
        <div class="mole-head">
          <span class="mole-face">🐹</span>
          <div class="mole-name">
            <strong>小鼹鼠 阿土</strong>
            <small>{{ progress.finished ? '家越来越大啦' : '你的地下向导' }}</small>
          </div>
          <button type="button" class="ghost" @click="session?.focusTarget()">👀 带我去看看</button>
        </div>
        <p class="mole-speech">{{ progress.speech }}</p>
        <p v-if="!progress.finished" class="mole-outcome">✨ {{ progress.outcome }}</p>
        <button v-if="exploration.clue && !exploration.upgraded" type="button" class="adventure-action" @click="session?.upgradeTool()">⛏ 换上小铁镐</button>
        <button
          v-if="exploration.canChain"
          type="button"
          class="adventure-action chain"
          :disabled="exploration.traveling"
          @click="session?.digToBottom()"
        >{{ exploration.chaining ? `⛏ 阿土正在挖……（还剩 ${exploration.remaining} 段）` : `⛏ 一路挖到底（还剩 ${exploration.remaining} 段）` }}</button>
        <button v-if="exploration.connected" type="button" class="adventure-action" :disabled="exploration.traveling" @click="session?.travel()">{{ exploration.traveling ? '🪜 阿土正在走……' : exploration.downstairs ? '↑ 沿梯子回家' : '↓ 沿梯子下去' }}</button>
        <button v-if="exploration.found" type="button" class="ghost" :aria-pressed="exploration.lampMode" @click="session?.toggleLamp()">{{ exploration.lampMode ? '⛏ 收起壁灯，继续挖掘' : '🏮 安一盏小壁灯' }}</button>
        <button v-if="farm.canSupplyWater" type="button" class="adventure-action water" :disabled="farm.supplying || exploration.traveling" @click="session?.supplyWater()">{{ farm.supplying ? '🚰 阿土在接水管……' : '🚰 把水引到家里' }}</button>
        <button v-if="farm.canSendPower" type="button" class="adventure-action power" :disabled="farm.powering || exploration.traveling" @click="session?.sendPower()">{{ farm.powering ? '⚡ 阿土在铺电线……' : '⚡ 把电送到下面' }}</button>
        <button v-if="farm.harvested" type="button" class="adventure-action meal" :disabled="farm.food === 0 || exploration.traveling" @click="session?.feed()">{{ farm.food > 0 ? `🍽 请大家吃饭（食物 ${farm.food}）` : '🍽 先收点菜再开饭' }}</button>
      </section>

      <div class="zoom">
        <button type="button" aria-label="放大" @click="session?.zoomBy(0.12)">＋</button>
        <button type="button" aria-label="缩小" @click="session?.zoomBy(-0.12)">－</button>
      </div>

      <nav class="depth-nav" aria-label="地下楼层">
        <p class="depth-location" role="status">{{ view.overview ? '正在看 · 整体剖面' : `正在看 · ${STRATA[view.layer].name}` }}</p>
        <button type="button" :aria-current="!view.overview && view.layer === 'home' ? 'location' : undefined" @click="session?.centerOnHome()">
          <span>⌂ 回到家园</span><small>第 1 层 · 暖窝层</small>
        </button>
        <div class="depth-seal">▥ 坚硬岩层</div>
        <button type="button" class="water-destination" :aria-current="!view.overview && view.layer === 'water' ? 'location' : undefined" @click="session?.lookDown()">
          <span>↓ 向下看看</span><small>第 2 层 · {{ exploration.entered ? '已抵达' : '水声从这里传来' }}</small>
        </button>
        <button type="button" class="overview-button" :aria-pressed="view.overview" @click="session?.showOverview()">⊞ 家园全景</button>
        <small class="depth-hint">{{ view.overview ? '全景只看不挖 · 点楼层继续' : exploration.entered ? '点泥土或泉水就行 · 阿土会自己走过去' : '点裂纹岩：阿土会走过去听、去挖通' }}</small>
      </nav>
      <span class="prototype-note">泉水探索试玩 · 独立存档</span>
      <button v-if="exploration.canImport" class="legacy-import" type="button" @click="session?.importLegacy()">💾 复制 v0.1.0 进度 · 原档保留</button>

      <button type="button" class="undo" @click="session?.undo()">↶ 撤销</button>
      <section v-if="(build.podAvailable || build.planterAvailable) && !view.overview && view.layer === 'home'" class="build-tools" aria-label="建设工具">
        <div class="build-buttons">
          <button type="button" :aria-pressed="build.mode === 'none'" @click="session?.setBuildMode('none')">⛏ 挖掘</button>
          <button v-if="build.podAvailable" type="button" :aria-pressed="build.mode === 'pod'" @click="session?.setBuildMode('pod')">🛏 睡眠舱</button>
          <button v-if="build.planterAvailable" type="button" :aria-pressed="build.mode === 'planter'" @click="session?.setBuildMode('planter')">🌱 种植槽</button>
          <template v-if="build.mode !== 'none'">
            <button type="button" class="confirm" :disabled="!build.valid" @click="session?.confirmBuild()">✅ 确认建造</button>
            <button type="button" class="cancel" @click="session?.setBuildMode(build.mode)">✖ 取消</button>
          </template>
          <span v-else>选一个工具开始建造</span>
        </div>
        <p v-if="build.mode !== 'none'" role="status">{{ build.message }}</p>
        <p v-else>睡眠舱给伙伴睡觉，种植槽种出吃的。点一下地面看预览，预览会告诉你行不行。</p>
      </section>
      <div class="legend">
        <span>{{ legendHint }}</span>
        <span v-if="progress.relics.found" class="relic-count">🧰 遗物 {{ progress.relics.found }}/{{ progress.relics.total }}</span>
        <span v-if="farm.planterCount" class="farm-count">🥕 种植槽 {{ farm.planterCount }} · 熟了 {{ farm.ripe }} · 食物 {{ farm.food }}</span>
      </div>

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
      <span>点泥土挖一格 · 点裂纹岩让阿土去挖 · 拖动平移 · 挖错点右下角撤销</span>
      <span class="scope">点亮家园 → 安床（小满来）→ 找水（小泉来）→ 种菜吃饭</span>
    </footer>
  </div>
</template>

<style scoped>
.adventure-action { padding: 11px 14px; min-height: 44px; border-radius: 10px; background: #3c8063; color: #fff8dc; font-size: 14px; font-weight: 700; }
.adventure-action:disabled { opacity: .65; cursor: wait; }
.adventure-action.chain { background: #a9702c; box-shadow: 0 3px 0 #7d5119; }
.adventure-action.water { background: #3f7f9a; box-shadow: 0 3px 0 #2c5c72; }
.adventure-action.power { background: #5a6fa8; box-shadow: 0 3px 0 #3f4f7a; }
.adventure-action.meal { background: #a9532c; box-shadow: 0 3px 0 #7d3a19; }
.adventure-action.chain:active { transform: translateY(2px); box-shadow: 0 1px 0 #7d5119; }
.milestone {
  position: absolute;
  top: 16%;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 22px;
  border-radius: 16px;
  background: #fffdf7f5;
  border: 2px solid #ffd98a;
  box-shadow: 0 10px 28px #213d302e;
  pointer-events: none;
}
.milestone-emoji { font-size: 30px; }
.milestone-text { display: flex; flex-direction: column; line-height: 1.35; }
.milestone-text strong { font-size: 18px; color: #37624a; }
.milestone-text small { font-size: 12px; color: #6f8478; }
.card-enter-active, .card-leave-active { transition: opacity 0.3s ease, transform 0.3s ease; }
.card-enter-from, .card-leave-to { opacity: 0; transform: translateX(-50%) translateY(-12px) scale(0.94); }
.legacy-import { position: absolute; bottom: 60px; left: 12px; padding: 10px 12px; border-radius: 10px; background: #edf4e9; color: #3c6154; font-size: 12px; }
.depth-nav { position: absolute; right: 12px; top: 124px; width: 182px; padding: 12px; border-radius: 14px; background: #fffdf7f2; color: #44584c; box-shadow: 0 4px 16px #213d3026; }
.depth-location { margin: 0 0 10px; font-size: 11px; font-weight: 700; color: #61756b; }
.depth-nav button { display: flex; width: 100%; flex-direction: column; align-items: flex-start; gap: 4px; padding: 10px; min-height: 48px; border-radius: 9px; background: #edf0e9; color: #3c6154; text-align: left; }
.depth-nav button[aria-current], .depth-nav button[aria-pressed="true"] { background: #d9ebd9; box-shadow: inset 3px 0 #4a8b65; }
.depth-nav button span { font-size: 14px; font-weight: 700; }
.depth-nav small { font-size: 10px; }
.depth-nav .water-destination { background: #e5edf0; color: #3f6576; }
.depth-nav .water-destination[aria-current] { box-shadow: inset 3px 0 #56889a; background: #d7e8ee; }
.depth-seal { padding: 8px 10px; margin-left: 9px; border-left: 2px dotted #9dabb0; font-size: 11px; color: #76858b; }
.depth-nav .overview-button { margin-top: 8px; min-height: 36px; font-size: 12px; background: transparent; border: 1px solid #d3ddcf; }
.depth-hint { display: block; margin-top: 10px; line-height: 1.5; color: #76858b; }
.prototype-note { position: absolute; top: 13px; left: 50%; transform: translateX(-50%); color: #dce6dd; font-size: 11px; background: #1c2a32b3; padding: 5px 10px; border-radius: 8px; pointer-events: none; }
.build-tools {
  position: absolute;
  bottom: 72px;
  left: 50%;
  transform: translateX(-50%);
  width: min(550px, calc(100% - 24px));
  border-radius: 14px;
  padding: 10px 12px;
  background: #fffdf7f5;
  color: #44584c;
  box-shadow: 0 4px 16px #213d3026;
}
.build-buttons { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.build-buttons button { border-radius: 9px; padding: 10px 12px; background: #e9eee4; color: #3c6154; font-weight: 700; }
.build-buttons button[aria-pressed="true"], .build-buttons button:not([aria-pressed]) { background: #3c8063; color: white; }
.build-buttons button.cancel { background: #efe9dd; color: #6d5a47; }
.build-buttons button:disabled { opacity: 0.4; cursor: default; }
.build-buttons span { font-size: 12px; }
.build-tools p { margin: 7px 0 0; font-size: 12px; line-height: 1.5; }
.app {
  height: 100%;
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 12px;
  max-width: 1800px;
  margin: 0 auto;
}

.top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  background: var(--cream);
  border-radius: 18px;
  padding: 10px 16px;
  box-shadow: 0 5px 20px #35534112;
}

.brand {
  display: flex;
  align-items: center;
  gap: 10px;
}

.logo {
  font-size: 26px;
  line-height: 1;
  background: #e4f1d8;
  border-radius: 12px;
  padding: 9px 10px;
}

.brand-text h1 {
  font-size: 18px;
  margin: 0;
}

.brand-text small {
  color: var(--muted);
}

.mission {
  display: flex;
  align-items: center;
  gap: 8px;
  background: var(--green-soft);
  border-radius: 999px;
  padding: 8px 14px;
  font-weight: 700;
  font-size: 13px;
  white-space: nowrap;
}

.mission-count {
  background: #fff;
  border-radius: 999px;
  padding: 2px 9px;
  color: var(--green);
}

.mission-done {
  background: #dff3e6;
}

.stage {
  position: relative;
  flex: 1;
  min-height: 320px;
  border-radius: 20px;
  overflow: hidden;
  box-shadow: 0 8px 24px #35534114;
  background: #22313a;
}

.stage-canvas {
  position: absolute;
  inset: 0;
}

.stage-canvas :deep(canvas) {
  display: block;
  touch-action: none;
  user-select: none;
  -webkit-user-select: none;
}

.fatal {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  padding: 24px;
  text-align: center;
  color: #ffd9c4;
  background: #22313acc;
  font-size: 14px;
}

.mole {
  position: absolute;
  top: 12px;
  left: 12px;
  width: min(340px, calc(100% - 96px));
  background: #fffdf7f0;
  border-radius: 16px;
  padding: 11px 14px 10px;
  box-shadow: 0 6px 20px #213d3026;
  display: flex;
  flex-direction: column;
  gap: 7px;
}

.mole-done {
  background: #f2fbeff0;
}

.mole-head {
  display: flex;
  align-items: center;
  gap: 9px;
}

.mole-face {
  font-size: 22px;
  background: #e4f1d8;
  border-radius: 50%;
  width: 36px;
  height: 36px;
  display: grid;
  place-items: center;
  flex: none;
}

.mole-name {
  display: flex;
  flex-direction: column;
  line-height: 1.25;
  flex: 1;
}

.mole-name strong {
  font-size: 13px;
  color: #3d7253;
}

.mole-name small {
  color: var(--muted);
  font-size: 11px;
}

.mole-speech {
  margin: 0;
  font-size: 13px;
  line-height: 1.6;
  color: #44584c;
}

.mole-outcome {
  margin: 0;
  font-size: 12px;
  line-height: 1.5;
  color: #77907f;
}

.ghost {
  background: #eef5e9;
  color: #3d7253;
  border-radius: 10px;
  padding: 6px 10px;
  font-size: 12px;
  font-weight: 700;
  white-space: nowrap;
}

.ghost:active {
  transform: scale(0.96);
}

.zoom {
  position: absolute;
  top: 12px;
  right: 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.zoom button {
  width: 44px;
  height: 44px;
  border-radius: 13px;
  background: #fffaf1e8;
  color: #3c6154;
  font-size: 20px;
  font-weight: 800;
  box-shadow: 0 4px 12px #213d3022;
}

.zoom button:active {
  transform: scale(0.94);
}

.undo {
  position: absolute;
  right: 12px;
  bottom: 12px;
  min-height: 48px;
  padding: 0 18px;
  border-radius: 14px;
  background: #fffaf1f2;
  color: #3c6154;
  font-size: 15px;
  font-weight: 800;
  box-shadow: 0 4px 14px #213d3026;
}

.undo:active {
  transform: scale(0.95);
}

.legend {
  position: absolute;
  left: 12px;
  bottom: 12px;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
  background: #fffaf1e8;
  border: 1px solid #e9d8b9;
  border-radius: 10px;
  padding: 7px 11px;
  font-size: 12px;
  font-weight: 700;
  color: #526052;
  pointer-events: none;
}

.relic-count {
  color: #8a6a33;
}

.farm-count {
  color: #4f7b45;
}

.toast {
  position: absolute;
  left: 50%;
  bottom: 74px;
  transform: translateX(-50%);
  background: #fffdf7f2;
  color: var(--ink);
  border-radius: 12px;
  padding: 9px 16px;
  font-size: 13px;
  font-weight: 700;
  box-shadow: 0 6px 18px #213d3026;
  max-width: 82%;
  pointer-events: none;
}

.toast.warning {
  background: #fff3e2f2;
  color: #8a5a2b;
}

.toast-enter-active,
.toast-leave-active {
  transition: opacity 0.18s ease, transform 0.18s ease;
}

.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(6px);
}

.bottom {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 0 6px;
  color: var(--muted);
  font-size: 12px;
}

.scope {
  opacity: 0.85;
}

@media (max-width: 720px) {
  .app { padding: 8px; gap: 8px; }
  .milestone { top: 24%; padding: 10px 14px; gap: 8px; max-width: calc(100% - 24px); }
  .milestone-emoji { font-size: 22px; }
  .milestone-text strong { font-size: 15px; }
  .top { padding: 8px; gap: 6px; }
  .brand { gap: 6px; flex: none; }
  .brand-text h1 { font-size: 16px; white-space: nowrap; }
  .brand-text small, .logo, .scope { display: none; }
  .mission { padding: 7px; gap: 4px; font-size: 11px; min-width: 0; }
  .mission-count { padding: 2px 5px; }
  .depth-nav { top: auto; right: 12px; bottom: 72px; width: calc(100% - 24px); padding: 7px; display: grid; grid-template-columns: repeat(3, 1fr); gap: 5px; }
  .depth-nav button { padding: 7px; min-height: 48px; }
  .depth-nav button span { font-size: 12px; }
  .depth-nav small { font-size: 9px; }
  .depth-nav .overview-button { margin: 0; }
  .depth-location { font-size: 10px; grid-column: 1 / -1; margin: 0 0 3px; }
  .depth-seal, .depth-hint, .prototype-note { display: none; }
  .build-tools { bottom: 174px; }
  .legend { max-width: calc(100% - 120px); font-size: 10px; }
  .bottom {
    flex-direction: column;
    align-items: flex-start;
    gap: 2px;
  }

  .mission-title {
    max-width: 34vw;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .mole {
    width: min(300px, calc(100% - 80px));
    padding: 10px 12px 8px;
  }

  .mole-outcome {
    display: none;
  }
}
</style>
