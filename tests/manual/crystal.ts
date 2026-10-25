/** Vite 开发服务器上的手工验收入口；未列入生产构建，不接触玩家 IndexedDB。 */
import { createApp } from 'vue'
import App from '../../src/App.vue'
import '../../src/style.css'
import { createMemoryStore, serialize } from '../../src/core/persistence'
import { enterDeep, liftReady, secondLayerComplete, workingDeep } from '../fixtures/deepWorld'

const phase = new URLSearchParams(location.search).get('phase')
const world = phase === 'workshop' ? workingDeep() : phase === 'lift' ? liftReady() : secondLayerComplete()
if (phase === 'entered') enterDeep(world)
const store = createMemoryStore()
await store.save(serialize(world))
createApp(App, { saveStore: store }).mount('#app')
