<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, shallowRef } from 'vue'
import { createGameSession, type BuildState, type ExplorationUI, type GameSession, type SessionProgress } from './app/session'
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
  speech: '家里又黑又冷……挖开左边泛蓝光的泥土，找一找能源石！',
  outcome: '能源石能把家园照亮。',
  done: 0,
  total: 4,
  finished: false,
})
const build = ref<BuildState>({ available: false, active: false, selected: false, valid: false, message: '', count: 0 })
const view = ref<DepthView>({ layer: 'home', overview: false })
const exploration = ref<ExplorationUI>({ clue: false, upgraded: false, connected: false, entered: false, found: false, traveling: false, downstairs: false, lampMode: false, canImport: false })

let toastTimer: number | undefined

function showMessage(text: string, warning = false): void {
  message.value = text
  messageWarning.value = warning
  toastVisible.value = true
  window.clearTimeout(toastTimer)
  toastTimer = window.setTimeout(() => {
    toastVisible.value = false
  }, 2600)
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
    })
  } catch {
    fatalError.value = '渲染初始化失败：当前浏览器可能不支持 WebGL，请换用新版浏览器打开。'
  }
})

onBeforeUnmount(() => {
  window.clearTimeout(toastTimer)
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
            <small>{{ progress.finished ? '泉水层 · 新家园的起点' : '你的地下向导' }}</small>
          </div>
          <button type="button" class="ghost" @click="session?.focusTarget()">👀 带我去看看</button>
        </div>
        <p class="mole-speech">{{ progress.speech }}</p>
        <p v-if="!progress.finished" class="mole-outcome">✨ {{ progress.outcome }}</p>
        <button v-if="exploration.clue && !exploration.upgraded" type="button" class="adventure-action" @click="session?.upgradeTool()">⛏ 换上小铁镐</button>
        <button v-if="exploration.connected" type="button" class="adventure-action" :disabled="exploration.traveling" @click="session?.travel()">{{ exploration.traveling ? '🪜 阿土正在走……' : exploration.downstairs ? '↑ 沿梯子回家' : '↓ 沿梯子下去' }}</button>
        <button v-if="exploration.found" type="button" class="ghost" :aria-pressed="exploration.lampMode" @click="session?.toggleLamp()">{{ exploration.lampMode ? '⛏ 收起壁灯，继续挖掘' : '🏮 安一盏小壁灯' }}</button>
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
        <small class="depth-hint">{{ view.overview ? '全景只看不挖 · 点楼层继续' : exploration.entered ? '看地图不等于走路 · 阿土会沿梯子往返' : '寻找岩壁裂纹，亲手挖通梯道' }}</small>
      </nav>
      <span class="prototype-note">泉水探索试玩 · 独立存档</span>
      <button v-if="exploration.canImport" class="legacy-import" type="button" @click="session?.importLegacy()">💾 复制 v0.1.0 进度 · 原档保留</button>

      <button type="button" class="undo" @click="session?.undo()">↶ 撤销</button>
      <section v-if="build.available && !view.overview && view.layer === 'home'" class="build-tools" aria-label="建设工具">
        <div class="build-buttons">
          <button type="button" :aria-pressed="!build.active" @click="session?.setBuildMode(false)">⛏ 挖掘</button>
          <button type="button" :aria-pressed="build.active" @click="session?.setBuildMode(!build.active)">🛏 睡眠舱</button>
          <template v-if="build.active">
            <button type="button" class="confirm" :disabled="!build.valid" @click="session?.confirmBuild()">✅ 确认建造</button>
            <button type="button" class="cancel" @click="session?.setBuildMode(false)">✖ 取消</button>
          </template>
          <span v-else>选“睡眠舱”开始建造</span>
        </div>
        <p v-if="build.active" role="status">{{ build.message }}</p>
        <p v-else>先挖出一块空地，再选“睡眠舱”。点一下想放小床的地面，预览会告诉你行不行。</p>
      </section>
      <div class="legend">{{ view.overview ? '一张连续剖面 · 家园会一层一层向下生长' : exploration.lampMode ? '🏮 壁灯选址中 · 点空洞安灯，再点工具收起' : exploration.upgraded ? '⛏ 小铁镐 · 裂纹岩可挖　🪨 坚硬基岩保留' : '🟫 泥土可挖　🪨 找找有裂纹的岩壁' }}</div>

      <transition name="toast">
        <div v-if="toastVisible" class="toast" :class="{ warning: messageWarning }">{{ message }}</div>
      </transition>
    </main>

    <footer class="bottom">
      <span>点泥土挖一格 · 拖动平移 · 挖错了点右下角撤销</span>
      <span class="scope">点亮家园 → 安好小床 → 听水声，向下探索</span>
    </footer>
  </div>
</template>

<style scoped>
.adventure-action { padding: 11px 14px; min-height: 44px; border-radius: 10px; background: #3c8063; color: #fff8dc; font-size: 14px; font-weight: 700; }
.adventure-action:disabled { opacity: .65; cursor: wait; }
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
  background: #fffaf1e8;
  border: 1px solid #e9d8b9;
  border-radius: 10px;
  padding: 7px 11px;
  font-size: 12px;
  font-weight: 700;
  color: #526052;
  pointer-events: none;
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
