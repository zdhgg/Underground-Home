/** 开发服务器专用验收页；只用内存存档，不读写玩家 IndexedDB。 */
import { createApp } from 'vue'
import App from '../../src/App.vue'
import '../../src/style.css'
import { createMemoryStore, serialize } from '../../src/core/persistence'
import { furnishedHall, hallAvailable, enterHall } from '../fixtures/hallWorld'
import { performHall } from '../../src/core/hall'
const phase = new URLSearchParams(location.search).get('phase')
const world = phase === 'furnished' || phase === 'celebrated' ? furnishedHall() : hallAvailable()
if (phase === 'entered') enterHall(world)
if (phase === 'celebrated') performHall(world, 'feast')
const store = createMemoryStore()
await store.save(serialize(world))
createApp(App, { saveStore: store }).mount('#app')
