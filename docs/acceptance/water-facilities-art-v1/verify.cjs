const { chromium } = require('C:/Users/ZhuanZ/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')
const fs = require('node:fs/promises')
const path = require('node:path')
const assert = require('node:assert/strict')
const url = process.env.FACILITY_TEST_URL || 'http://127.0.0.1:5212/'
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
      const { placePlanter } = await import('/src/core/farm.ts')
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
      for (const id of ['spring-kitchen', 'spring-table', 'spring-garden', 'water-corner']) {
        const s = siteById(id)
        if (!finishSite(w, s, id === 'water-corner' ? 'lounge' : s.kinds[0])) throw new Error(`fixture: ${id}`)
      }
      if (!placePlanter(w, 36, 21) || !placePlanter(w, 38, 21)) throw new Error('fixture: free planters')
      w.farm.planters.forEach((planter, i) => { planter.growth = i })
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
    checks.push('fixture built via current rules; serialization validated')
    await page.unroute('**/src/main.ts', mainRoute)
    await page.reload()
    await page.getByRole('button', { name: '继续游戏', exact: true }).click()
    await page.getByRole('button', { name: '2层 · 泉水', exact: false }).click()
    await page.waitForTimeout(3000)
    await page.screenshot({ path: path.join(__dirname, '01-water-layer.png') })
    for (let i = 0; i < 5; i++) await page.getByRole('button', { name: '放大', exact: true }).click()
    for (const [name, kind] of [['泉边灶台', 'kitchen'], ['围坐餐桌', 'dining'], ['泉边小菜园', 'garden'], ['泉边小洞室', 'lounge']]) {
      await page.getByRole('button', { name: '泉边建设', exact: false }).click()
      await page.locator('.site-tools nav').getByRole('button', { name: new RegExp(name) }).click()
      await page.waitForTimeout(500)
      const preview = page.locator(`.facility-preview[data-facility="${kind}"]`)
      assert.equal(await preview.count(), 1)
      assert(await preview.locator('img').evaluateAll(imgs => imgs.every(img => img.complete && img.naturalWidth > 0)))
      assert.equal(await page.locator('.stage [data-attention-panel]').count(), 1)
      assert.equal(await page.locator('.stage [data-primary-action]').count(), 1)
      await page.screenshot({ path: path.join(__dirname, `02-${kind}-detail.png`) })
      await page.getByRole('button', { name: '看看新房间', exact: true }).click()
      checks.push(`${kind}: shared layered preview, actual built art and one primary action`)
    }
    await page.screenshot({ path: path.join(__dirname, '04-crop-stages.png') })
    const point = await page.locator('canvas').evaluate(c => {
      const r = c.getBoundingClientRect(), z = +c.dataset.zoom
      return { x: r.left + (38.5 * 32 - +c.dataset.cameraX) * z, y: r.top + (21.5 * 32 - +c.dataset.cameraY) * z }
    })
    await page.mouse.click(point.x, point.y)
    await page.waitForFunction(() => /食物\s*1/.test(document.querySelector('.resources')?.textContent || ''), null, { timeout: 20000 })
    checks.push('four crop stages; click mature crop -> actual partner harvest -> food +1')
    await page.setViewportSize({ width: 390, height: 844 })
    await page.getByRole('button', { name: '2层 · 泉水', exact: false }).click()
    await page.getByRole('button', { name: '泉边建设', exact: false }).click()
    await page.locator('.site-tools nav').getByRole('button', { name: /泉边灶台/ }).click()
    await page.screenshot({ path: path.join(__dirname, '03-narrow-kitchen.png') })
    const box = await page.locator('.site-tools').boundingBox()
    assert(box.x >= 0 && box.x + box.width <= 390)
    checks.push('390x844: current building visible above compact controls')
    await page.setViewportSize({ width: 1440, height: 960 })
    await page.route('**/*stove-furniture-v1.png*', route => route.request().url().includes('import') ? route.continue() : route.abort())
    await page.reload()
    await page.getByRole('button', { name: '继续游戏', exact: true }).click()
    await page.getByRole('button', { name: '2层 · 泉水', exact: false }).click()
    await page.getByRole('button', { name: '泉边建设', exact: false }).click()
    await page.locator('.site-tools nav').getByRole('button', { name: /泉边灶台/ }).click()
    await page.getByText('图片暂时没显示', { exact: false }).waitFor()
    await page.screenshot({ path: path.join(__dirname, '05-missing-stove-fallback.png') })
    assert.equal(await page.locator('.stage [data-primary-action]').count(), 1)
    checks.push('block stove PNG: map fallback and preview feedback keep game usable')
    assert.deepEqual(errors, [])
    await fs.writeFile(path.join(__dirname, 'browser-report.json'), JSON.stringify({ url, checks, runtimeErrors: errors }, null, 2))
    console.log(JSON.stringify({ checks, runtimeErrors: errors }, null, 2))
    await context.close()
  } finally { await browser.close() }
}
main().catch(error => { console.error(error); process.exitCode = 1 })
