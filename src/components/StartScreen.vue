<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import horizon from '../assets/art/surface/storm-horizon-v1.png'
import woodland from '../assets/art/surface/windwood-snow-v1.png'
import entrance from '../assets/art/surface/shelter-mouth-snow-v1.png'
import { savedAtLabel, type SaveStatus } from '../app/saveSummary'
import { RELEASE_NOTES } from '../app/releaseNotes'

const props = defineProps<{ ready: boolean; error: string; save: SaveStatus; persistent: boolean }>()
const emit = defineEmits<{ start: []; continue: [] }>()
const version = __APP_VERSION__

const notesOpen = ref(false)
const askRestart = ref(false)
const notesClose = ref<HTMLButtonElement | null>(null)
const confirmCancel = ref<HTMLButtonElement | null>(null)

const savedWhen = computed(() => props.save.status === 'ready' ? savedAtLabel(props.save.savedAt) : '')
const canStart = computed(() => props.ready && !props.error)
const saveReady = computed(() => props.save.status === 'ready')

function beginNew(): void {
  if (!canStart.value) return
  if (props.save.status === 'ready' || props.save.status === 'broken') askRestart.value = true
  else emit('start')
}

function confirmNew(): void {
  askRestart.value = false
  emit('start')
}

function openNotes(): void {
  notesOpen.value = true
}

function closeNotes(): void {
  notesOpen.value = false
}

watch(notesOpen, async (open) => {
  if (open) { await nextTick(); notesClose.value?.focus() }
})
watch(askRestart, async (open) => {
  if (open) { await nextTick(); confirmCancel.value?.focus() }
})

function onKeyDown(event: KeyboardEvent): void {
  if (event.key !== 'Escape') return
  if (askRestart.value) { askRestart.value = false; return }
  if (notesOpen.value) { closeNotes(); return }
}

onMounted(() => window.addEventListener('keydown', onKeyDown))
onBeforeUnmount(() => window.removeEventListener('keydown', onKeyDown))
</script>

<template>
  <main class="start-screen" aria-label="地下小家园进入页">
    <img class="start-horizon" :src="horizon" alt="" />
    <img class="start-woodland" :src="woodland" alt="" />
    <div class="start-shade" />
    <img class="start-entrance" :src="entrance" alt="雪地里的避难所入口" />

    <section class="start-content">
      <span class="start-kicker">阿土的地下新生活</span>
      <h1>地下小家园</h1>
      <p class="start-tagline">在风雪之下，建一个温暖的小家。</p>

      <div class="start-menu">
        <template v-if="saveReady">
          <button class="start-button" type="button" :disabled="!canStart" @click="emit('continue')">
            继续游戏
            <span v-if="canStart" aria-hidden="true">→</span>
          </button>
          <div v-if="save.status === 'ready'" class="save-card">
            <span class="save-eyebrow">上次的家还在</span>
            <strong>{{ save.summary.missionTitle }}</strong>
            <small>
              {{ save.summary.phase }} {{ save.summary.done }}/{{ save.summary.total }}
              <template v-if="savedWhen"> · 上次保存 {{ savedWhen }}</template>
            </small>
          </div>
          <button class="start-secondary" type="button" :disabled="!canStart" @click="askRestart = true">重新开始</button>
          <small class="start-note">{{ persistent ? '会自动保存 · 下次接着玩' : '这个浏览器不能长期保存进度' }}</small>
        </template>

        <template v-else-if="save.status === 'broken'">
          <p class="start-error" role="alert">上次的存档打不开：{{ save.error }}。</p>
          <button class="start-button" type="button" :disabled="!canStart" @click="askRestart = true">
            重新开始
            <span v-if="canStart" aria-hidden="true">→</span>
          </button>
          <small class="start-note">重新开始会替换这份打不开的旧档。</small>
        </template>

        <template v-else>
          <button class="start-button" type="button" :disabled="!canStart" @click="beginNew">
            {{ error ? '暂时无法开始' : !ready ? '正在准备家园…' : '开始游戏' }}
            <span v-if="canStart && !error" aria-hidden="true">→</span>
          </button>
          <small v-if="!error" class="start-note">
            {{ persistent ? '会自动保存 · 下次接着玩' : '这个浏览器不能保存进度 · 关闭页面会从头开始' }}
          </small>
        </template>

        <p v-if="error" class="start-error" role="alert">{{ error }} 请刷新重试。</p>
      </div>
    </section>

    <footer class="start-footer">
      <button class="version-button" type="button" @click="openNotes">
        v{{ version }}<span class="version-link">更新记录</span>
      </button>
      <span>进入后可跳过开场</span>
    </footer>

    <div v-if="notesOpen" class="overlay" @click.self="closeNotes">
      <section class="notes" role="dialog" aria-modal="true" aria-labelledby="notes-title">
        <header class="notes-head">
          <div>
            <small>游戏更新记录</small>
            <h2 id="notes-title">地下小家园 <span>v{{ version }}</span></h2>
          </div>
          <button ref="notesClose" class="notes-close" type="button" @click="closeNotes">看完了</button>
        </header>
        <div class="notes-body">
          <article v-for="section in RELEASE_NOTES" :key="section.title">
            <h3>{{ section.title }}</h3>
            <p v-for="paragraph in section.paragraphs" :key="paragraph">{{ paragraph }}</p>
            <ul v-if="section.items.length">
              <li v-for="item in section.items" :key="item">{{ item }}</li>
            </ul>
          </article>
        </div>
      </section>
    </div>

    <div v-if="askRestart" class="overlay" @click.self="askRestart = false">
      <section class="confirm" role="alertdialog" aria-modal="true" aria-labelledby="restart-title" aria-describedby="restart-detail">
        <h2 id="restart-title">要重新开始吗？</h2>
        <p id="restart-detail">上次的家会消失，不能回来。想接着玩，就点“先不重来”。</p>
        <div class="confirm-actions">
          <button ref="confirmCancel" class="start-secondary" type="button" @click="askRestart = false">先不重来</button>
          <button class="start-button confirm-restart" type="button" @click="confirmNew">重新开始</button>
        </div>
      </section>
    </div>
  </main>
</template>

<style scoped>
.start-screen { position: fixed; z-index: 50; inset: 0; overflow: hidden; color: #f3f6f7; background: #344c5c; }
.start-horizon { position: absolute; width: 100%; height: 100%; object-fit: cover; object-position: center 44%; }
.start-woodland { position: absolute; width: 100%; height: 76%; bottom: -5%; object-fit: cover; object-position: center bottom; }
.start-shade { position: absolute; inset: 0; background: linear-gradient(90deg, #132b3ee8 0%, #183348ae 30%, #233c4b38 65%), linear-gradient(0deg, #102535b8, transparent 20%); }
.start-entrance { position: absolute; width: clamp(210px, 30vw, 450px); right: 10%; bottom: 6%; }
.start-content { position: absolute; left: 9%; top: 24%; max-width: 600px; max-height: calc(100% - 96px); overflow-y: auto; padding-right: 8px; scrollbar-width: thin; }
.start-kicker { display: block; color: #c5dae3; font-size: 16px; letter-spacing: 4px; margin-bottom: 18px; }
h1 { font-size: clamp(42px, 5.4vw, 78px); line-height: 1.15; letter-spacing: 3px; margin: 0; font-weight: 800; text-shadow: 0 3px 16px #152a3c66; }
.start-tagline { margin: 20px 0 30px; font-size: clamp(16px, 1.6vw, 21px); line-height: 1.7; color: #d9e5e9; }
.start-menu { display: flex; flex-direction: column; align-items: flex-start; gap: 12px; }
.start-button { display: flex; align-items: center; justify-content: space-between; gap: 54px; min-width: 246px; min-height: 64px; padding: 16px 24px; border-radius: 12px; color: #40331d; background: #f1cd85; font-size: 23px; font-weight: 700; box-shadow: 0 4px 0 #aa8247; transition: background .15s, transform .15s; }
.start-button:hover:not(:disabled) { background: #ffdda0; }
.start-button:active:not(:disabled) { transform: translateY(2px); box-shadow: 0 2px 0 #aa8247; }
.start-button:disabled { color: #ced8de; background: #536a78; box-shadow: 0 4px 0 #2e4655; cursor: default; font-size: 19px; }
.start-button:focus-visible, .start-secondary:focus-visible, .version-button:focus-visible, .notes-close:focus-visible { outline: 3px solid #f5e5bd; outline-offset: 4px; }
.start-secondary { min-height: 44px; padding: 8px 18px; border-radius: 10px; color: #e8f1f4; background: #ffffff10; border: 1px solid #ffffff4a; font-size: 14px; font-weight: 600; }
.start-secondary:hover:not(:disabled) { background: #ffffff1f; }
.start-secondary:disabled { opacity: .5; cursor: default; }
.save-card { display: grid; gap: 3px; width: min(420px, 100%); padding: 12px 16px; border-radius: 12px; background: #102a3bcc; border: 1px solid #f1cd8540; }
.save-eyebrow { color: #f1cd85; font-size: 11px; letter-spacing: 2px; }
.save-card strong { font-size: 17px; line-height: 1.45; color: #fff8e8; }
.save-card small { font-size: 12.5px; line-height: 1.55; color: #c7d8df; }
.start-note { display: block; margin: 0; font-size: 12.5px; color: #c1d1da; line-height: 1.6; }
.start-error { margin: 0; max-width: 460px; font-size: 14px; line-height: 1.65; color: #ffddd2; }
.start-footer { position: absolute; bottom: 28px; left: 4%; right: 4%; display: flex; align-items: center; justify-content: space-between; gap: 16px; font-size: 12px; color: #d0dce2; }
.version-button { margin: -6px -8px; padding: 6px 8px; border-radius: 8px; background: transparent; color: inherit; font-size: inherit; text-align: left; }
.version-button:hover { background: #ffffff14; }
.version-link { margin-left: 8px; color: #f1cd85; border-bottom: 1px solid #f1cd8566; }

.overlay { position: fixed; z-index: 70; inset: 0; display: grid; place-items: center; padding: 20px; background: #081723bd; backdrop-filter: blur(3px); }
.notes { display: flex; flex-direction: column; width: min(620px, 100%); max-height: min(82vh, 760px); overflow: hidden; border-radius: 18px; background: #faf6e9; color: #334742; box-shadow: 0 18px 60px #04121c70; }
.notes-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; padding: 18px 20px; background: #f1e7cf; border-bottom: 1px solid #dcd0b5; }
.notes-head small { display: block; color: #7d6c4d; font-size: 11px; letter-spacing: 2px; }
.notes-head h2 { margin: 3px 0 0; font-size: 21px; color: #2f4f45; }
.notes-head h2 span { margin-left: 6px; font-size: 14px; font-weight: 600; color: #7d6c4d; }
.notes-close { flex: none; min-height: 44px; padding: 8px 16px; border-radius: 10px; background: #3c8063; color: #fff; font-size: 14px; font-weight: 700; }
.notes-close:hover { background: #326f55; }
.notes-body { overflow-y: auto; padding: 4px 22px 18px; }
.notes-body article { padding: 14px 0; border-bottom: 1px dashed #d8ceb6; }
.notes-body article:last-child { border-bottom: 0; }
.notes-body h3 { margin: 0 0 8px; font-size: 16px; line-height: 1.5; color: #2f5a4a; }
.notes-body p { margin: 6px 0; font-size: 13.5px; line-height: 1.7; color: #5a6b62; }
.notes-body ul { margin: 8px 0 2px; padding-left: 20px; }
.notes-body li { margin: 5px 0; font-size: 13.5px; line-height: 1.72; }
.confirm { width: min(430px, 100%); padding: 24px; border-radius: 18px; background: #faf6e9; color: #334742; box-shadow: 0 18px 60px #04121c70; }
.confirm h2 { margin: 0; font-size: 22px; color: #2f4f45; }
.confirm p { margin: 12px 0 20px; font-size: 14px; line-height: 1.7; color: #5a6b62; }
.confirm-actions { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 10px; }
.confirm .start-secondary { color: #476759; background: #e7ece2; border-color: #c8d2c6; }
.confirm .start-button { min-width: 0; min-height: 46px; gap: 12px; padding: 10px 18px; font-size: 16px; }
.confirm-restart { background: #c98a55; color: #fff; box-shadow: 0 3px 0 #9a6439; }
.confirm-restart:hover:not(:disabled) { background: #d89a64; }

@media (max-width: 720px) {
  .start-content { top: 13%; left: 8%; right: 8%; max-height: calc(100% - 84px); padding-right: 0; }
  .start-kicker { font-size: 13px; margin-bottom: 13px; }
  .start-tagline { margin: 16px 0 24px; }
  .start-button { min-width: 220px; min-height: 60px; font-size: 22px; gap: 32px; }
  .save-card { width: 100%; padding: 11px 13px; }
  .save-card strong { font-size: 16px; }
  .start-entrance { width: clamp(170px, 47vw, 280px); right: 2%; bottom: 7%; }
  .start-woodland { width: 160%; max-width: none; left: -30%; height: 65%; }
  .start-footer { bottom: 18px; left: 8%; right: 8%; font-size: 10.5px; gap: 8px; }
  .version-link { margin-left: 6px; }
  .overlay { padding: 12px; }
  .notes { max-height: 86vh; }
  .notes-head { padding: 14px 16px; }
  .notes-head h2 { font-size: 18px; }
  .notes-body { padding: 2px 16px 14px; }
  .confirm { padding: 20px; }
}
@media (max-height: 700px) and (min-width: 721px) {
  .start-content { top: 14%; }
  .start-kicker { margin-bottom: 12px; }
  .start-tagline { margin: 14px 0 20px; }
  .start-menu { gap: 9px; }
  .start-button { min-height: 58px; font-size: 21px; }
  .save-card { padding: 10px 14px; }
}
@media (prefers-reduced-motion: reduce) {
  .start-button { transition: none; }
}
</style>
