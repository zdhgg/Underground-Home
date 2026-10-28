/** 真实 App 的九层验收入口，仅用内存存档，不接触玩家 IndexedDB。 */
import { createApp } from 'vue'
import App from '../../src/App.vue'
import '../../src/style.css'
import { createInitialWorld } from '../../src/core/world'
import { createMemoryStore, serialize } from '../../src/core/persistence'
import { dig } from '../../src/core/dig'
import { placePod } from '../../src/core/build'
import { workingDeep } from '../fixtures/deepWorld'
import { furnishedHall } from '../fixtures/hallWorld'
import { workingGarden } from '../fixtures/gardenWorld'
import { workingReservoir } from '../fixtures/reservoirWorld'
import { workingVentilation } from '../fixtures/ventilationWorld'
import { workingRuins } from '../fixtures/ruinsWorld'
import { workingFinale, completedFinale } from '../fixtures/finaleWorld'

const phase = new URLSearchParams(location.search).get('phase') ?? 'early'
const factories = { early: createInitialWorld, deep: workingDeep, hall: furnishedHall, garden: workingGarden,
  reservoir: workingReservoir, ventilation: workingVentilation, ruins: workingRuins, finale: workingFinale, completed: completedFinale, work: completedFinale }
const world = (factories[phase as keyof typeof factories] ?? createInitialWorld)()
if (phase === 'deep') {
  // 原夹具允许先共餐；验收第三层主线时先为第二层原四位伙伴安好床。
  for (let x = 11; x >= 3; x--) for (const y of [11, 10, 9]) dig(world, x, y)
  if (!placePod(world, 6, 10)) throw new Error('验收夹具安床失败')
}
if (phase === 'completed' || phase === 'work') world.farm.planters.push({ id: 1, x: 30, y: 21, growth: 3 })
if (phase === 'work') world.workers.xiaoman = { x: 17, y: 11 }
const store = createMemoryStore()
await store.save(serialize(world))
createApp(App, { saveStore: store }).mount('#app')
