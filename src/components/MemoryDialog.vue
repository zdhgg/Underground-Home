<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import type { MemoryEntry, MemoryKind } from '../core/world'

const props = defineProps<{ entries: MemoryEntry[] }>()
const emit = defineEmits<{ close: []; save: [entry: Omit<MemoryEntry, 'id' | 'createdAt'>] }>()

const title = ref('')
const body = ref('')
const kind = ref<MemoryKind>('note')
const photoDataUrl = ref('')
const voiceDataUrl = ref('')
const error = ref('')
const recording = ref(false)
const closeButton = ref<HTMLButtonElement | null>(null)
const fileInput = ref<HTMLInputElement | null>(null)
let recorder: MediaRecorder | null = null
let chunks: Blob[] = []
const previousFocus = typeof document !== 'undefined' ? document.activeElement as HTMLElement | null : null

function readFile(file: File, allowed: string): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith(allowed)) { reject(new Error('格式不对')); return }
    if (file.size > (allowed === 'image/' ? 1_800_000 : 2_200_000)) { reject(new Error('文件有点大')); return }
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result ?? ''))
    reader.onerror = () => reject(new Error('读取失败'))
    reader.readAsDataURL(file)
  })
}

async function onPhoto(event: Event): Promise<void> {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return
  try { photoDataUrl.value = await readFile(file, 'image/'); kind.value = 'photo'; error.value = '' }
  catch { error.value = '这张照片没读好，换一张小一点的试试。' }
}

async function toggleRecording(): Promise<void> {
  error.value = ''
  if (recording.value) { recorder?.stop(); return }
  if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') { error.value = '这个浏览器暂时不能录音，可以改用文字或照片。'; return }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    chunks = []
    recorder = new MediaRecorder(stream)
    recorder.ondataavailable = event => { if (event.data.size) chunks.push(event.data) }
    recorder.onstop = () => {
      stream.getTracks().forEach(track => track.stop())
      const blob = new Blob(chunks, { type: recorder?.mimeType || 'audio/webm' })
      if (blob.size > 2_200_000) { error.value = '录音有点长，录短短一句就好。'; return }
      const reader = new FileReader()
      reader.onload = () => { voiceDataUrl.value = String(reader.result ?? ''); kind.value = 'voice' }
      reader.readAsDataURL(blob)
      recording.value = false
    }
    recorder.start(); recording.value = true
  } catch { error.value = '没有打开麦克风，可以改用文字或照片。' }
}

function save(): void {
  const nextTitle = title.value.trim()
  const nextBody = body.value.trim()
  if (!nextTitle) { error.value = '给这段记忆起个小标题吧。'; return }
  if (!nextBody && !photoDataUrl.value && !voiceDataUrl.value) { error.value = '写一句话，或放一张照片、录一句声音吧。'; return }
  emit('save', {
    kind: voiceDataUrl.value ? 'voice' : photoDataUrl.value ? 'photo' : 'note',
    title: nextTitle, body: nextBody,
    ...(photoDataUrl.value ? { photoDataUrl: photoDataUrl.value } : {}),
    ...(voiceDataUrl.value ? { voiceDataUrl: voiceDataUrl.value } : {}),
  })
  title.value = ''; body.value = ''; photoDataUrl.value = ''; voiceDataUrl.value = ''; error.value = ''; kind.value = 'note'
}

function onKey(event: KeyboardEvent): void { if (event.key === 'Escape') { event.preventDefault(); emit('close') } }
function keepFocus(event: KeyboardEvent): void {
  if (event.key !== 'Tab') return
  const dialog = event.currentTarget as HTMLElement
  const buttons = Array.from(dialog.querySelectorAll<HTMLElement>('button, input, textarea, [tabindex]:not([tabindex="-1"])')).filter(el => !(el as HTMLButtonElement).disabled)
  const first = buttons[0], last = buttons.at(-1)
  if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
  else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
}
onMounted(async () => { window.addEventListener('keydown', onKey, true); await nextTick(); closeButton.value?.focus() })
onBeforeUnmount(() => { recorder?.stop(); window.removeEventListener('keydown', onKey, true); void nextTick(() => previousFocus?.focus()) })
</script>

<template>
  <div class="memory-backdrop" @click.self="emit('close')" @pointerdown.stop @wheel.stop>
    <section class="memory-dialog" data-attention-panel="memory" role="dialog" aria-modal="true" aria-labelledby="memory-title" @keydown="keepFocus">
      <header>
        <div><span class="memory-mark" aria-hidden="true">✦</span><div><h2 id="memory-title">记忆匣</h2><p>把今天和爸爸一起做过的事，放进家里。</p></div></div>
        <button ref="closeButton" class="close" type="button" aria-label="关闭记忆匣" @click="emit('close')">×</button>
      </header>
      <div class="memory-body">
        <div class="memory-list" v-if="props.entries.length">
          <h3>已经留下的记忆 <small>{{ props.entries.length }} 条</small></h3>
          <article v-for="entry in [...props.entries].reverse()" :key="entry.id" class="memory-card">
            <div class="memory-card-top"><span>{{ entry.kind === 'photo' ? '📷' : entry.kind === 'voice' ? '🎙️' : '✍️' }}</span><strong>{{ entry.title }}</strong><time>{{ new Date(entry.createdAt).toLocaleDateString('zh-CN') }}</time></div>
            <img v-if="entry.photoDataUrl" :src="entry.photoDataUrl" alt="记忆照片" />
            <audio v-if="entry.voiceDataUrl" :src="entry.voiceDataUrl" controls preload="metadata" />
            <p v-if="entry.body">{{ entry.body }}</p>
          </article>
        </div>
        <div class="memory-form">
          <h3>留下今天的一小段</h3>
          <label>小标题<input v-model="title" maxlength="80" placeholder="例如：和爸爸一起种薄荷" /></label>
          <label>想说的话<textarea v-model="body" maxlength="2000" rows="3" placeholder="今天发生了什么？"></textarea></label>
          <div class="attachments">
            <input ref="fileInput" type="file" accept="image/*" hidden @change="onPhoto" />
            <button type="button" class="secondary" @click="fileInput?.click()">📷 放一张照片</button>
            <button type="button" class="secondary" :aria-pressed="recording" @click="toggleRecording">{{ recording ? '⏹ 停止录音' : '🎙️ 录一句声音' }}</button>
          </div>
          <p v-if="photoDataUrl" class="attachment-note">照片已放好，可以保存啦。</p>
          <p v-if="voiceDataUrl" class="attachment-note">声音已录好，可以保存啦。</p>
          <p v-if="error" class="error" role="alert">{{ error }}</p>
        </div>
      </div>
      <footer><button type="button" class="primary" data-primary-action @click="save">把这段记忆放进家里</button></footer>
    </section>
  </div>
</template>

<style scoped>
.memory-backdrop{position:fixed;z-index:110;inset:0;display:grid;place-items:center;padding:16px;background:#102d2b9c}.memory-dialog{width:min(620px,100%);max-height:calc(100dvh - 32px);display:flex;flex-direction:column;overflow:hidden;border-radius:22px;background:#f8fbf7;color:#304e41;box-shadow:0 16px 60px #11291f40}.memory-dialog header{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:20px 24px 16px;border-bottom:1px solid #dfe8df}.memory-dialog header>div:first-child{display:flex;align-items:center;gap:12px}.memory-mark{display:grid;place-items:center;width:52px;height:52px;border-radius:16px;background:#e3f0df;color:#43805b;font-size:30px}.memory-dialog h2{margin:0;font-size:22px}.memory-dialog header p{margin:5px 0 0;font-size:13px;color:#708276}.close{flex:none;width:44px;height:44px;font-size:28px;color:#4e6e5b;background:#e7eee7;border-radius:12px}.memory-body{overflow-y:auto;padding:18px 24px}.memory-body h3{margin:0 0 10px;font-size:14px}.memory-body h3 small{margin-left:6px;color:#7b8d80;font-size:12px;font-weight:400}.memory-list{display:grid;gap:9px;margin-bottom:22px}.memory-card{padding:12px 14px;border-radius:13px;background:#edf4eb}.memory-card-top{display:flex;align-items:center;gap:8px}.memory-card-top strong{flex:1;font-size:14px}.memory-card-top time{font-size:11px;color:#849287}.memory-card p{margin:8px 0 0;line-height:1.65;font-size:13px;color:#52695a}.memory-card img{display:block;max-width:100%;max-height:160px;margin-top:10px;border-radius:9px;object-fit:cover}.memory-card audio{width:100%;margin-top:10px}.memory-form{padding:15px;border:1px solid #dfe9de;border-radius:14px;background:#fbfdfb}.memory-form label{display:grid;gap:6px;margin-top:12px;font-size:12px;color:#6e8173}.memory-form input,.memory-form textarea{width:100%;box-sizing:border-box;padding:10px 12px;border:1px solid #cad9ca;border-radius:9px;background:#fff;color:#304e41;font:inherit;font-size:14px}.memory-form textarea{resize:vertical;line-height:1.6}.attachments{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px}.secondary{min-height:42px;padding:8px 12px;border-radius:9px;color:#3b6a4e;background:#e0eddd;font-size:13px}.secondary[aria-pressed=true]{background:#c8e1c9}.attachment-note{margin:8px 0 0;font-size:12px;color:#4b7b5a}.error{margin:10px 0 0;color:#a04d4d;font-size:12px}footer{border-top:1px solid #dfe8df;padding:12px 24px 18px}.primary{width:100%;min-height:50px;border-radius:11px;color:#fff;background:#3c7b5b;font-size:16px;font-weight:600}.primary:hover{background:#306749}@media(max-width:480px){.memory-backdrop{padding:10px}.memory-dialog{max-height:calc(100dvh - 20px)}.memory-dialog header{padding:14px 16px}.memory-body{padding:14px 16px}footer{padding:10px 16px 14px}}
</style>
