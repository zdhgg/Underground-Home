/** Vite 开发服务器专用；只用内存，不接触玩家 IndexedDB。 */
import { createApp } from 'vue'
import App from '../../src/App.vue'
import '../../src/style.css'
import { createMemoryStore, serialize } from '../../src/core/persistence'
import { completedVentilation, enterVentilation, ventilationAvailable, workingVentilation } from '../fixtures/ventilationWorld'
const phase = new URLSearchParams(location.search).get('phase')
const world = phase === 'working' ? workingVentilation() : phase === 'completed' ? completedVentilation() : ventilationAvailable()
if (phase === 'entered') enterVentilation(world)
const store = createMemoryStore()
await store.save(serialize(world))
createApp(App, { saveStore: store }).mount('#app')
