const { chromium } = require('C:/Users/ZhuanZ/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')
const fs = require('node:fs/promises')
const path = require('node:path')
const assert = require('node:assert/strict')
const url = process.env.START_TEST_URL || 'http://127.0.0.1:5193/'
const out = __dirname
async function main() {
  const browser = await chromium.launch({ headless: true, args: ['--enable-webgl', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
  const results = [], errors = []
  async function create(viewport = { width: 1440, height: 960 }) {
    const context = await browser.newContext({ viewport })
    const page = await context.newPage()
    page.on('pageerror', e => errors.push(e.message))
    await page.addInitScript(() => {
      window.__qaDbAccesses = 0
      const original = indexedDB.open.bind(indexedDB)
      window.__qaOpenDb = original
      indexedDB.open = (...args) => { window.__qaDbAccesses++; return original(...args) }
    })
    return { context, page }
  }
  async function ready(page) {
    await page.getByRole('button', { name: '开始游戏', exact: true }).waitFor()
    assert.equal(await page.locator('.start-screen').count(), 1)
    assert.equal(await page.locator('canvas').getAttribute('data-opening-phase'), null)
    assert.equal(await page.evaluate(() => window.__qaDbAccesses), 0)
    assert.equal(await page.locator('.start-footer').innerText(), '开发试玩版 · v0.1.0\n进入后可跳过开场')
  }
  async function finished(page) {
    await page.waitForFunction(() => document.querySelector('canvas')?.dataset.openingPhase === 'finished')
    await page.locator('.opening-overlay').waitFor({ state: 'hidden' })
    assert.equal(await page.locator('.start-screen').count(), 0)
    assert.equal(await page.getByText('找到发光的能源石', { exact: true }).count(), 1)
    assert.equal(await page.evaluate(() => window.__qaDbAccesses), 0)
  }
  async function screenshot(page, name) {
    const cdp = await page.context().newCDPSession(page)
    const { data } = await cdp.send('Page.captureScreenshot', { format: 'png', fromSurface: true })
    await fs.writeFile(path.join(out, name), Buffer.from(data, 'base64'))
    await cdp.detach()
  }
  const camera = page => page.locator('canvas').evaluate(c => ({ x: c.dataset.cameraX, y: c.dataset.cameraY, zoom: c.dataset.zoom }))
  try {
    const desktop = await create()
    await desktop.page.goto(url); await ready(desktop.page)
    await desktop.page.waitForTimeout(250)
    assert.equal(await desktop.page.locator('.opening-overlay').count(), 0)
    await screenshot(desktop.page, '01-title-desktop.png')
    results.push({ case: 'title-waits-for-start-and-shows-version', passed: true })
    await desktop.page.getByRole('button', { name: '开始游戏', exact: true }).click()
    await desktop.page.waitForFunction(() => document.querySelector('canvas')?.dataset.openingPhase === 'run')
    assert.equal(await desktop.page.getByRole('button', { name: '声音已开启', exact: true }).count(), 1)
    await screenshot(desktop.page, '02-click-start-opening.png')
    await finished(desktop.page)
    const finalCamera = await camera(desktop.page)
    await screenshot(desktop.page, '03-natural-handoff.png')
    results.push({ case: 'start-unlocks-sound-and-full-opening-hands-off-to-first-mission', passed: true })
    await desktop.page.reload(); await ready(desktop.page)
    await desktop.page.getByRole('button', { name: '开始游戏', exact: true }).press('Enter')
    await desktop.page.waitForFunction(() => !!document.querySelector('canvas')?.dataset.openingPhase)
    await desktop.page.keyboard.press('Escape')
    await finished(desktop.page)
    assert.deepEqual(await camera(desktop.page), finalCamera)
    results.push({ case: 'refresh-returns-to-title-keyboard-start-and-escape-same-camera', passed: true })
    await desktop.context.close()

    const old = await create()
    const fixture = JSON.parse(await fs.readFile(path.join(out, '../room-construction-v1/expanded-home-save.json'), 'utf8'))
    await old.page.route('**/__seed.html', route => route.fulfill({ contentType: 'text/html', body: '<title>save fixture</title>' }))
    await old.page.goto(new URL('/__seed.html', url).href)
    await old.page.evaluate(payload => new Promise((resolve, reject) => {
      const request = window.__qaOpenDb('underground-home-spring-playtest-v1', 1)
      request.onupgradeneeded = () => request.result.createObjectStore('saves')
      request.onsuccess = () => {
        const db = request.result, tx = db.transaction('saves', 'readwrite')
        tx.objectStore('saves').put(payload, 'underground-home-save')
        tx.oncomplete = () => { db.close(); resolve() }; tx.onerror = reject
      }
    }), fixture)
    await old.page.goto(url); await ready(old.page)
    assert.equal(await old.page.getByRole('button', { name: /继续游戏|复制.*进度|游戏存档/ }).count(), 0)
    await old.page.getByRole('button', { name: '开始游戏', exact: true }).click()
    await old.page.getByRole('button', { name: '跳过开场', exact: false }).click()
    await finished(old.page)
    const stored = await old.page.evaluate(() => new Promise(resolve => {
      const request = window.__qaOpenDb('underground-home-spring-playtest-v1', 1)
      request.onsuccess = () => { const db = request.result, get = db.transaction('saves').objectStore('saves').get('underground-home-save'); get.onsuccess = () => { db.close(); resolve(get.result) } }
    }))
    assert.deepEqual(stored, fixture)
    assert.equal(await old.page.locator('.guide .goal small span').innerText(), '0/4')
    await screenshot(old.page, '04-old-save-fresh-start.png')
    results.push({ case: 'existing-v12-save-ignored-and-untouched-button-skip-works', passed: true })
    await old.context.close()

    for (const viewport of [{ width: 900, height: 620 }, { width: 390, height: 844 }]) {
      const item = await create(viewport)
      await item.page.goto(url); await ready(item.page)
      const button = item.page.getByRole('button', { name: '开始游戏', exact: true }), bounds = await button.boundingBox()
      assert(bounds.x >= 0 && bounds.y >= 0 && bounds.x + bounds.width <= viewport.width && bounds.y + bounds.height <= viewport.height)
      assert.equal(await item.page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false)
      await screenshot(item.page, viewport.width === 390 ? '06-title-phone.png' : '05-title-narrow.png')
      await button.click()
      await item.page.getByRole('button', { name: '跳过开场', exact: false }).click(); await finished(item.page)
      results.push({ case: `title-and-start-skip-${viewport.width}x${viewport.height}`, passed: true })
      await item.context.close()
    }
    assert.deepEqual(errors, [])
    await fs.writeFile(path.join(out, 'browser-report.json'), JSON.stringify({ url, results, runtimeErrors: errors }, null, 2))
    console.log(JSON.stringify({ results, runtimeErrors: errors }, null, 2))
  } finally { await browser.close() }
}
main().catch(e => { console.error(e); process.exitCode = 1 })
