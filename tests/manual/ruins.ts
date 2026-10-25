/** Vite 开发服务器专用；只用内存，不接触玩家 IndexedDB。 */
import { createApp } from 'vue'
import App from '../../src/App.vue'
import '../../src/style.css'
import { createMemoryStore, serialize } from '../../src/core/persistence'
import { completedRuins, enterRuins, ruinsAvailable, workingRuins } from '../fixtures/ruinsWorld'
const phase = new URLSearchParams(location.search).get('phase')
const world = phase === 'working' ? workingRuins() : phase === 'completed' ? completedRuins() : ruinsAvailable()
if (phase === 'entered') enterRuins(world)
const store = createMemoryStore()
await store.save(serialize(world))
createApp(App, { saveStore: store }).mount('#app')
