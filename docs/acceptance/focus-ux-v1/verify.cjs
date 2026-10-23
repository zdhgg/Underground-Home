// 在独立 Chromium 上下文里使用当前版本序列化夹具，不接触玩家浏览器的进度。
const { chromium } = require('C:/Users/ZhuanZ/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')
const fs = require('node:fs/promises')
const path = require('node:path')
const assert = require('node:assert/strict')
const url = process.env.FOCUS_TEST_URL || 'http://127.0.0.1:5198/'
const errors = [], checks = []
async function seed(page, mode) {
  // 种夹具的空页不初始化 GPU，避免一次用例导航创建两套 WebGL 资源。
  const mainRoute = route => route.fulfill({ body: '', contentType: 'application/javascript' })
  await page.route('**/src/main.ts', mainRoute)
  await page.goto(url)
  await page.evaluate(async mode => {
    const { createInitialWorld, TILE, LANDMARKS } = await import('/src/core/world.ts')
    const { serialize, deserialize } = await import('/src/core/persistence.ts')
    const { initializeWorkers } = await import('/src/core/partnerWork.ts')
    const { initialAtuPosition } = await import('/src/core/atu.ts')
    const { siteById, siteWorkCells } = await import('/src/core/sites.ts')
    const w = createInitialWorld()
    w.progress = { crystalFound: true, crystalCollected: true, coreRepaired: mode !== 'intro' }
    w.tiles[LANDMARKS.crystal.y][LANDMARKS.crystal.x] = TILE.EMPTY
    w.exploration.explorer = initialAtuPosition(w)
    if (mode === 'ready') {
      for (const id of ['first-nest', 'home-lounge']) for (const p of siteWorkCells(w, siteById(id))) w.tiles[p.y][p.x] = TILE.EMPTY
    }
    initializeWorkers(w)
    const payload = serialize(w), result = deserialize(payload)
    if (!result.ok) throw new Error(result.error)
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
  }, mode)
  await page.unroute('**/src/main.ts', mainRoute)
  await page.reload()
  await page.waitForFunction(() => document.querySelector('.start-button:not(:disabled)'))
  if (!(await page.getByRole('button', { name: '继续游戏', exact: true }).count())) {
    await shot(page, 'seed-failure.png')
    throw new Error(`Fixture could not load: ${await page.locator('body').innerText()}`)
  }
  await page.getByRole('button', { name: '继续游戏', exact: true }).click()
  await page.locator('canvas').waitFor()
}
async function tapTile(page, x, y) {
  const point = await page.locator('canvas').evaluate((c, p) => {
    const r = c.getBoundingClientRect(), z = +c.dataset.zoom
    return { x: r.left + ((p.x + .5) * 32 - +c.dataset.cameraX) * z, y: r.top + ((p.y + .5) * 32 - +c.dataset.cameraY) * z }
  }, { x, y })
  await page.mouse.click(point.x, point.y)
}
async function bounds(page) {
  const card = await page.locator('.conversation').boundingBox(), stage = await page.locator('.stage').boundingBox()
  assert(card.x >= stage.x && card.y >= stage.y)
  assert(card.x + card.width <= stage.x + stage.width + 1)
  assert(card.y + card.height <= stage.y + stage.height + 1)
  assert.equal(await page.locator('.guide').count(), 0)
  assert.equal(await page.locator('.build-tools').count(), 0)
}
async function shot(page, name) { await page.screenshot({ path: path.join(__dirname, name) }) }
async function main() {
  const browser = await chromium.launch({ headless: true, args: ['--enable-webgl', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
  try {
    for (const viewport of [{ width: 1440, height: 960 }, { width: 390, height: 844 }]) {
      const context = await browser.newContext({ viewport }), page = await context.newPage()
      page.on('pageerror', e => errors.push(e.message))
      await seed(page, 'intro')
      const generator = await page.evaluate(async () => (await import('/src/core/world.ts')).LANDMARKS.generator)
      await tapTile(page, generator.x, generator.y)
      await page.locator('.discovery-status').waitFor()
      assert.equal(await page.locator('.conversation').count(), 0)
      await page.locator('.conversation').waitFor()
      await page.waitForTimeout(700)
      assert.match(await page.locator('.speech').innerText(), /我是阿灯/)
      await bounds(page)
      await shot(page, `${viewport.width}-adeng.png`)
      await page.getByRole('button', { name: '继续听阿灯说' }).click()
      await page.getByRole('button', { name: '去准备小窝', exact: true }).click()
      await page.waitForTimeout(650)
      assert.equal(await page.locator('.conversation').count(), 0)
      assert.equal(await page.locator('.site-tools').count(), 0)
      assert.equal(await page.locator('.guide-primary').innerText(), '看看要挖的小窝空间')
      await page.getByRole('button', { name: '需要帮忙？' }).click()
      assert.equal(await page.locator('.guide .details button').count(), 0)
      await shot(page, `${viewport.width}-nest-guide.png`)
      await page.reload()
      await page.getByRole('button', { name: '继续游戏', exact: true }).click()
      assert.equal(await page.locator('.conversation').count(), 0)
      assert.equal(await page.locator('.discovery-status').count(), 0)
      checks.push(`${viewport.width}: core -> reveal -> anchored dialogue -> nest digging guide; help; reload without replay`)
      if (viewport.width === 390) {
        await seed(page, 'ready')
        await page.locator('.guide-primary').click()
        const card = await page.locator('.site-tools').boundingBox()
        const target = await page.locator('canvas').evaluate(c => {
          const r = c.getBoundingClientRect()
          return { x: r.left + (13.5 * 32 - +c.dataset.cameraX) * +c.dataset.zoom, y: r.top + (10.5 * 32 - +c.dataset.cameraY) * +c.dataset.zoom }
        })
        assert(target.y < card.y, 'narrow building preview stays above its controls')
        assert(target.x >= 0 && target.x <= 390)
        assert.match(await page.locator('.depth-nav button[aria-current]').innerText(), /1层/)
        await shot(page, '390-nest-detail.png')
        await page.getByRole('button', { name: '返回洞室列表', exact: false }).click()
        assert.equal(await page.locator('.site-tools nav button').count(), 2)
        checks.push('390: current building remains visible above compact controls')
      }
      await context.close()
    }
    const context = await browser.newContext({ viewport: { width: 1440, height: 960 } }), page = await context.newPage()
    page.on('pageerror', e => errors.push(e.message))
    await seed(page, 'ready')
    assert.equal(await page.locator('.guide-primary').innerText(), '修建两人小窝')
    await page.locator('.guide-primary').click()
    assert.equal(await page.locator('.site-tools nav').count(), 0)
    assert(!/暖暖客厅/.test(await page.locator('.site-tools').innerText()))
    await shot(page, '1440-nest-detail.png')
    await page.getByRole('button', { name: '返回洞室列表', exact: false }).click()
    assert.equal(await page.locator('.site-tools nav button').count(), 2)
    await page.getByRole('button', { name: /两人小窝.*1层/ }).click()
    await page.getByRole('button', { name: '开工！', exact: false }).click()
    await page.locator('.construction-strip').waitFor()
    await shot(page, '1440-construction.png')
    await page.getByText('已经建好啦', { exact: false }).waitFor({ timeout: 15000 })
    await shot(page, '1440-built.png')
    await page.getByRole('button', { name: '看看新房间', exact: true }).click()
    assert.equal(await page.locator('.site-tools').count(), 0)
    checks.push('direct nest detail excludes lounge; browse/select; actual construction; completed room; close')
    await context.close()
    assert.deepEqual(errors, [])
    await fs.writeFile(path.join(__dirname, 'browser-report.json'), JSON.stringify({ url, checks, runtimeErrors: errors }, null, 2))
    console.log(JSON.stringify({ checks, runtimeErrors: errors }, null, 2))
  } finally { await browser.close() }
}
main().catch(e => { console.error(e); process.exitCode = 1 })
