<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, shallowRef } from 'vue'
import { createGameSession, type GameSession, type SessionProgress } from './app/session'

const stageEl = ref<HTMLElement | null>(null)
const session = shallowRef<GameSession | null>(null)
const fatalError = ref('')
const message = ref('')
const messageWarning = ref(false)
const toastVisible = ref(false)
const progress = ref<SessionProgress>({
  title: '找到发光的能源石',
  speech: '外面风好大，家里黑漆漆的……左边那几块泥土里透着蓝光，那里一定藏着能量！',
  todo: '点一点发蓝光的泥土，一格一格挖开它。挖错了可以撤销。',
  outcome: '把能源石露出来，就能把它收好带走。',
  done: 0,
  total: 3,
  finished: false,
})

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

      <section class="mole" :class="{ 'mole-done': progress.finished }">
        <div class="mole-head">
          <span class="mole-face">🐹</span>
          <div class="mole-name">
            <strong>小鼹鼠 阿土</strong>
            <small>你的地下向导</small>
          </div>
        </div>
        <p class="mole-speech">{{ progress.speech }}</p>
        <div v-if="!progress.finished" class="mole-lines">
          <p><span class="tag">👉 现在做</span>{{ progress.todo }}</p>
          <p><span class="tag">✨ 做完后</span>{{ progress.outcome }}</p>
        </div>
        <button type="button" class="ghost" @click="session?.focusTarget()">👀 带我去看看</button>
      </section>

      <div class="zoom">
        <button type="button" aria-label="放大" @click="session?.zoomBy(0.12)">＋</button>
        <button type="button" aria-label="缩小" @click="session?.zoomBy(-0.12)">－</button>
        <button type="button" aria-label="回到家园" @click="session?.centerOnHome()">⌂</button>
      </div>

      <button type="button" class="undo" @click="session?.undo()">↶ 撤销</button>
      <div class="legend">🟫 泥土可挖　🪨 灰色岩石暂不可挖</div>

      <transition name="toast">
        <div v-if="toastVisible" class="toast" :class="{ warning: messageWarning }">{{ message }}</div>
      </transition>
    </main>

    <footer class="bottom">
      <span>点泥土挖一格 · 拖动画面平移 · 滚轮或 ＋/－ 缩放 · 挖错了点右下角撤销</span>
      <span class="scope">P1 · 第一夜：找到能源石，点亮避难所</span>
    </footer>
  </div>
</template>

<style scoped>
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
  width: min(320px, calc(100% - 96px));
  background: #fffdf7f0;
  border-radius: 16px;
  padding: 12px 14px 10px;
  box-shadow: 0 6px 20px #213d3026;
  display: flex;
  flex-direction: column;
  gap: 8px;
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
  font-size: 24px;
  background: #e4f1d8;
  border-radius: 50%;
  width: 40px;
  height: 40px;
  display: grid;
  place-items: center;
  flex: none;
}

.mole-name {
  display: flex;
  flex-direction: column;
  line-height: 1.25;
}

.mole-name strong {
  font-size: 14px;
  color: #3d7253;
}

.mole-name small {
  color: var(--muted);
  font-size: 11px;
}

.mole-speech {
  margin: 0;
  font-size: 13px;
  line-height: 1.65;
  color: #536b58;
}

.mole-lines {
  display: flex;
  flex-direction: column;
  gap: 5px;
  border-top: 1px dashed var(--line);
  padding-top: 8px;
}

.mole-lines p {
  margin: 0;
  font-size: 12px;
  line-height: 1.55;
  color: #5c6f60;
}

.tag {
  display: inline-block;
  background: var(--green-soft);
  color: var(--green);
  border-radius: 7px;
  font-weight: 700;
  padding: 1px 6px;
  margin-right: 6px;
  font-size: 11px;
}

.ghost {
  align-self: flex-start;
  background: #eef5e9;
  color: #3d7253;
  border-radius: 10px;
  padding: 7px 11px;
  font-size: 12px;
  font-weight: 700;
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
    width: min(280px, calc(100% - 80px));
    padding: 10px 12px 8px;
  }

  .mole-lines {
    display: none;
  }
}
</style>
