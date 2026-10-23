const { chromium } = require('C:/Users/ZhuanZ/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')
const fs = require('node:fs/promises')
const path = require('node:path')
const assert = require('node:assert/strict')
const url = process.env.MOSS_TEST_URL || 'http://127.0.0.1:5199/'
async function main() {
  const browser = await chromium.launch({ headless: true, args: ['--enable-webgl', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
  const errors = [], checks = []
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 960 } })
    const page = await context.newPage()
    page.on('pageerror', error => errors.push(error.message))
    const mainRoute = route => route.fulfill({ body: '', contentType: 'application/javascript' })
    await page.route('**/src/main.ts', mainRoute)
    await page.goto(url)
    const result = await page.evaluate(async () => {
      const { createInitialWorld, TILE, LANDMARKS } = await import('/src/core/world.ts')
      const { serialize, deserialize } = await import('/src/core/persistence.ts')
      const { initializeWorkers } = await import('/src/core/partnerWork.ts')
      const { initialAtuPosition } = await import('/src/core/atu.ts')
      const { placePod } = await import('/src/core/build.ts')
      const { finishSite, siteById } = await import('/src/core/sites.ts')
      const { drawCaveMoss } = await import('/src/render/caveMoss.ts')
      const w = createInitialWorld()
      w.progress = { crystalFound: true, crystalCollected: true, coreRepaired: true }
      w.tiles[LANDMARKS.crystal.y][LANDMARKS.crystal.x] = TILE.EMPTY
      for (let x = 12; x <= 27; x++) for (const y of [10, 11]) w.tiles[y][x] = TILE.EMPTY
      w.exploration.explorer = initialAtuPosition(w)
      if (!placePod(w, 12, 10)) throw new Error('fixture: first bed')
      Object.assign(w.exploration, { shaftX: 27, clueFound: true, pickaxeUpgraded: true, entered: true, springFound: true, metXiaoman: true, explorer: { x: 21, y: 21 } })
      for (let y = 12; y < 22; y++) w.tiles[y][27] = TILE.EMPTY
      for (let x = 9; x <= 38; x++) for (const y of [19, 20, 21]) w.tiles[y][x] = TILE.EMPTY
      w.farm.waterSupplied = true; w.powerDown = true; w.inventory = { stone: 50, wood: 50 }
      initializeWorkers(w)
      const columns = world => {
        const decor = drawCaveMoss(world), xs = decor.children.map(child => Math.floor(child.x / 32))
        decor.destroy({ children: true }); return xs
      }
      const before = columns(w)
      for (const id of ['spring-kitchen', 'spring-table', 'spring-garden']) {
        const s = siteById(id)
        if (!finishSite(w, s, s.kinds[0])) throw new Error(`fixture: ${id}`)
      }
      const after = columns(w)
      const payload = serialize(w), validation = deserialize(payload)
      if (!validation.ok) throw new Error(validation.error)
      await new Promise((resolve, reject) => {
        const open = indexedDB.open('underground-home-spring-playtest-v1', 1)
        open.onupgradeneeded = () => open.result.createObjectStore('saves')
        open.onerror = () => reject(open.error)
        open.onsuccess = () => {
          const db = open.result, tx = db.transaction('saves', 'readwrite')
          tx.objectStore('saves').put(payload, 'underground-home-save')
          tx.oncomplete = () => { db.close(); resolve() }; tx.onerror = () => reject(tx.error)
        }
      })
      return { before, after }
    })
    assert(result.before.includes(12) && result.before.includes(30))
    assert(!result.after.includes(12) && !result.after.includes(30))
    checks.push({ builtFacilitiesClearMoss: result })
    await page.unroute('**/src/main.ts', mainRoute)
    await page.reload()
    await page.waitForFunction(() => document.querySelector('.start-button:not(:disabled)') || document.querySelector('.fatal'))
    if (!(await page.getByRole('button', { name: '继续游戏', exact: true }).count())) {
      await page.screenshot({ path: path.join(__dirname, 'load-failure.png') })
      throw new Error(`Fixture load: ${await page.locator('body').innerText()}; errors: ${errors.join('; ')}`)
    }
    await page.getByRole('button', { name: '继续游戏', exact: true }).click()
    await page.getByRole('button', { name: '2层 · 泉水', exact: false }).click()
    await page.waitForTimeout(3000)
    await page.screenshot({ path: path.join(__dirname, '1440-built-facilities.png') })
    checks.push('1440x960: kitchen, table, garden and spring; no foreground moss rocks')
    await page.setViewportSize({ width: 390, height: 844 })
    await page.getByRole('button', { name: '2层 · 泉水', exact: false }).click()
    await page.waitForTimeout(800)
    await page.screenshot({ path: path.join(__dirname, '390-spring.png') })
    checks.push('390x844: decorations remain in background at narrow viewport')
    assert.deepEqual(errors, [])
    await fs.writeFile(path.join(__dirname, 'browser-report.json'), JSON.stringify({ url, checks, runtimeErrors: errors }, null, 2))
    console.log(JSON.stringify({ checks, runtimeErrors: errors }, null, 2))
    await context.close()
  } finally { await browser.close() }
}
main().catch(error => { console.error(error); process.exitCode = 1 })
