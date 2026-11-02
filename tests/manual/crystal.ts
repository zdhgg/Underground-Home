/** Vite 开发服务器上的手工验收入口；未列入生产构建，不接触玩家 IndexedDB。 */
import { createApp } from 'vue'
import App from '../../src/App.vue'
import '../../src/style.css'
import { createMemoryStore, serialize } from '../../src/core/persistence'
import { enterDeep, liftReady, secondLayerComplete, workingDeep } from '../fixtures/deepWorld'
import { performDeep } from '../../src/core/deep'
import { dig } from '../../src/core/dig'
import { placePod } from '../../src/core/build'
import { initializeWorkers } from '../../src/core/partnerWork'
import { TILE } from '../../src/core/world'

const phase = new URLSearchParams(location.search).get('phase')
const liftPhases = ['lift', 'lift-part', 'lift-empty', 'home-lamp', 'next']
const world = phase === 'workshop' ? workingDeep() : liftPhases.includes(phase ?? '') ? liftReady() : secondLayerComplete()
if (phase === 'entered') enterDeep(world)
if (phase === 'next') performDeep(world, 'ride-home')
if (phase === 'lift-part' || phase === 'home-lamp') world.deep.parts = 1
if (phase === 'lift-empty') Object.assign(world.deep, { crystals: 0, ore: 0, ingots: 0, parts: 0 })
if (phase === 'home-lamp') {
  performDeep(world, 'ride-home')
  world.exploration.explorer = { x: world.exploration.shaftX!, y: 11 }
  world.workers.amu = { x: world.exploration.shaftX! - 1, y: 11 }
}
// 前两层四位伙伴都有床，隔离验收不会被旧夹具的“给伙伴留床”插队。
for (const x of [9, 10, 11]) for (const y of [11, 10, 9]) if (world.tiles[y][x] === TILE.SOIL) dig(world, x, y)
placePod(world, 9, 10)
initializeWorkers(world)
const store = createMemoryStore()
await store.save(serialize(world))
createApp(App, { saveStore: store }).mount('#app')
