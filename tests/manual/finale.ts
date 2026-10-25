/** Vite 开发服务器专用；只用内存，不接触玩家 IndexedDB。 */
import { createApp } from 'vue'
import App from '../../src/App.vue'
import '../../src/style.css'
import { createMemoryStore, serialize } from '../../src/core/persistence'
import { completedFinale, enterFinale, finaleAvailable, workingFinale,readyFinale } from '../fixtures/finaleWorld'
const phase = new URLSearchParams(location.search).get('phase')
const world = phase === 'ready' ? readyFinale() : phase === 'working' ? workingFinale() : phase === 'completed' ? completedFinale() : finaleAvailable()
if (phase === 'entered') enterFinale(world)
const store = createMemoryStore()
await store.save(serialize(world))
createApp(App, { saveStore: store }).mount('#app')
