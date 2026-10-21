const { chromium } = require('C:/Users/ZhuanZ/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')
const fs = require('node:fs/promises')
const path = require('node:path')
const assert = require('node:assert/strict')

const url = process.env.SAVE_TEST_URL || 'http://127.0.0.1:5194/'
const out = __dirname
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))
const FIXTURE = path.join(out, '../room-construction-v1/expanded-home-save.json')

async function readSave(page) {
  return page.evaluate(() => new Promise((resolve, reject) => {
    const request = indexedDB.open('underground-home-spring-playtest-v1', 1)
    request.onupgradeneeded = () => request.result.createObjectStore('saves')
    request.onerror = () => reject(request.error)
    request.onsuccess = () => {
      const db = request.result
      const get = db.transaction('saves', 'readonly').objectStore('saves').get('underground-home-save')
      get.onsuccess = () => resolve(get.result)
      get.onerror = () => reject(get.error)
      db.transaction('saves', 'readonly').oncomplete = () => db.close()
    }
  }))
}

async function seedSave(page, payload) {
  await page.evaluate(value => new Promise((resolve, reject) => {
    const request = indexedDB.open('underground-home-spring-playtest-v1', 1)
    request.onupgradeneeded = () => request.result.createObjectStore('saves')
    request.onerror = () => reject(request.error)
    request.onsuccess = () => {
      const db = request.result
      const tx = db.transaction('saves', 'readwrite')
      tx.objectStore('saves').put(value, 'underground-home-save')
      tx.oncomplete = () => { db.close(); resolve() }
      tx.onerror = () => reject(tx.error)
    }
  }), payload)
}

async function screenshot(page, name) {
  await page.screenshot({ path: path.join(out, name) })
}

async function waitTitle(page, action = '开始游戏') {
  await page.locator('.start-screen').waitFor()
  await page.waitForFunction(expected => {
    const button = document.querySelector('.start-button')
    return button && !button.disabled && button.textContent?.includes(expected)
  }, action)
}

async function finishOpening(page) {
  await page.locator('.opening-overlay').waitFor()
  await page.getByRole('button', { name: /跳过开场/ }).click()
  await page.locator('.opening-overlay').waitFor({ state: 'hidden' })
  await page.locator('.guide').waitFor()
}

async function clickCell(page, x, y) {
  const box = await page.locator('canvas').boundingBox()
  const camera = await page.locator('canvas').evaluate(canvas => ({
    x: Number(canvas.dataset.cameraX),
    y: Number(canvas.dataset.cameraY),
    zoom: Number(canvas.dataset.zoom),
  }))
  assert(Number.isFinite(camera.x) && Number.isFinite(camera.y) && camera.zoom > 0, 'camera data missing')
  await page.mouse.click(
    box.x + ((x + 0.5) * 32 - camera.x) * camera.zoom,
    box.y + ((y + 0.5) * 32 - camera.y) * camera.zoom,
  )
}

async function waitForSave(page, predicate, timeout = 8000) {
  const started = Date.now()
  let latest = null
  while (Date.now() - started < timeout) {
    latest = await readSave(page)
    if (latest && predicate(latest)) return latest
    await sleep(220)
  }
  throw new Error(`save did not reach expected state: ${JSON.stringify(latest?.world?.progress ?? latest?.version)}`)
}

async function main() {
  const browser = await chromium.launch({ headless: true, args: ['--enable-webgl', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
  const results = []
  const errors = []
  async function create(viewport = { width: 1440, height: 960 }) {
    const context = await browser.newContext({ viewport })
    const page = await context.newPage()
    page.on('pageerror', error => errors.push(error.message))
    return { context, page }
  }

  try {
    // 1. 新玩家：进入页只读、不凭空写档；更新记录能打开。
    const fresh = await create()
    await fresh.page.goto(url)
    await waitTitle(fresh.page)
    assert.match(await fresh.page.locator('.start-note').innerText(), /会自动保存/)
    assert.equal(await readSave(fresh.page), undefined, '进入页不应生成存档')
    await screenshot(fresh.page, '01-title-fresh.png')
    results.push({ case: 'fresh-title-does-not-write-save', passed: true })

    await fresh.page.locator('.version-button').click()
    await fresh.page.locator('.notes').waitFor()
    const notesText = await fresh.page.locator('.notes').innerText()
    assert.match(notesText, /更新记录|游戏更新记录/)
    assert.match(notesText, /未发布/)
    assert(!notesText.includes('**') && !notesText.includes(']('), 'markdown markers leaked into notes')
    await screenshot(fresh.page, '02-update-notes.png')
    await fresh.page.getByRole('button', { name: '看完了' }).click()
    await fresh.page.locator('.notes').waitFor({ state: 'hidden' })
    results.push({ case: 'update-notes-open-and-readable', passed: true })

    // 2. 真正挖一格，等自动保存；刷新后进入页应出现“继续游戏”。
    await fresh.page.getByRole('button', { name: '开始游戏', exact: true }).click()
    await finishOpening(fresh.page)
    assert.match(await fresh.page.locator('.guide').innerText(), /找到发光的能源石/)
    await sleep(350)
    await clickCell(fresh.page, 14, 9)
    const saved = await waitForSave(fresh.page, data => data?.world?.tiles?.[9]?.[14] === 0)
    assert.equal(saved.version, 12)
    assert(saved.world.progress.crystalFound)
    await sleep(300)
    await screenshot(fresh.page, '03-play-and-autosave.png')
    results.push({ case: 'dig-is-autosaved-to-indexeddb', passed: true })

    await fresh.page.reload()
    await waitTitle(fresh.page, '继续游戏')
    const card = await fresh.page.locator('.save-card').innerText()
    assert.match(card, /收好能源石/)
    assert.match(card, /第一夜 1\/4/)
    assert.match(card, /上次保存/)
    await screenshot(fresh.page, '04-title-continue.png')
    results.push({ case: 'reload-shows-continue-with-progress-and-time', passed: true })

    // 3. 继续游戏不重播开场，任务接着上次。
    const cameraBefore = await fresh.page.locator('canvas').evaluate(canvas => canvas.dataset.cameraX)
    await fresh.page.getByRole('button', { name: '继续游戏', exact: true }).click()
    await fresh.page.locator('.start-screen').waitFor({ state: 'hidden' })
    assert.equal(await fresh.page.locator('.opening-overlay').count(), 0, 'continue must not replay opening')
    await fresh.page.locator('.guide').waitFor()
    assert.match(await fresh.page.locator('.guide').innerText(), /收好能源石/)
    assert.equal(await fresh.page.locator('canvas').evaluate(canvas => canvas.dataset.cameraX), cameraBefore)
    await screenshot(fresh.page, '05-continued-save.png')
    results.push({ case: 'continue-skips-opening-and-keeps-progress', passed: true })

    // 4. 重新开始有二次确认；取消保留旧档，确认后清档并播开场。
    await fresh.page.reload()
    await waitTitle(fresh.page, '继续游戏')
    await fresh.page.getByRole('button', { name: '重新开始', exact: true }).click()
    await fresh.page.locator('.confirm').waitFor()
    await screenshot(fresh.page, '06-restart-confirm.png')
    await fresh.page.getByRole('button', { name: '先不重来', exact: true }).click()
    await fresh.page.locator('.confirm').waitFor({ state: 'hidden' })
    assert.equal(await fresh.page.locator('.save-card').count(), 1)
    await fresh.page.getByRole('button', { name: '重新开始', exact: true }).click()
    await fresh.page.locator('.confirm .confirm-restart').click()
    await finishOpening(fresh.page)
    assert.match(await fresh.page.locator('.guide').innerText(), /找到发光的能源石/)
    const cleared = await waitForSave(fresh.page, data => data?.world?.progress?.crystalFound === false)
    assert.equal(cleared.world.dugCount, 0)
    await screenshot(fresh.page, '07-restarted-fresh.png')
    results.push({ case: 'restart-confirm-cancel-and-clear-save', passed: true })
    await fresh.context.close()

    // 5. 有旧档的窄屏与手机：继续按钮、摘要和版本入口都可达。
    const fixture = JSON.parse(await fs.readFile(FIXTURE, 'utf8'))
    for (const viewport of [{ width: 900, height: 620 }, { width: 390, height: 844 }]) {
      const item = await create(viewport)
      await item.page.goto(url)
      await waitTitle(item.page)
      await seedSave(item.page, fixture)
      await item.page.reload()
      await waitTitle(item.page, '继续游戏')
      const summary = await item.page.locator('.save-card').innerText()
      assert.match(summary, /楼下有谁在喊饿/)
      assert.match(summary, /泉水与家园 0\/9/)
      for (const selector of ['.start-button', '.start-secondary', '.version-button']) {
        const bounds = await item.page.locator(selector).boundingBox()
        assert(bounds && bounds.x >= 0 && bounds.y >= 0 && bounds.x + bounds.width <= viewport.width && bounds.y + bounds.height <= viewport.height, `${selector} out of viewport ${viewport.width}x${viewport.height}`)
      }
      assert.equal(await item.page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false)
      await screenshot(item.page, viewport.width === 390 ? '09-title-phone.png' : '08-title-narrow.png')
      if (viewport.width === 390) {
        await item.page.locator('.version-button').click()
        await item.page.locator('.notes').waitFor()
        await screenshot(item.page, '10-notes-phone.png')
        await item.page.getByRole('button', { name: '看完了' }).click()
      }
      results.push({ case: `title-with-save-${viewport.width}x${viewport.height}`, passed: true })
      await item.context.close()
    }

    assert.deepEqual(errors, [])
    await fs.writeFile(path.join(out, 'browser-report.json'), JSON.stringify({ url, results, runtimeErrors: errors }, null, 2))
    console.log(JSON.stringify({ results, runtimeErrors: errors }, null, 2))
  } finally {
    await browser.close()
  }
}

main().catch(error => { console.error(error); process.exitCode = 1 })
