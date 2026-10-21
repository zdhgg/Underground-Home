// 隔离浏览器上下文，不读取或覆盖玩家浏览器中的存档。
const { chromium } = require('C:/Users/ZhuanZ/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')
const fs = require('node:fs/promises')
const path = require('node:path')
const assert = require('node:assert/strict')
const out = __dirname
const url = process.env.OPENING_TEST_URL || 'http://127.0.0.1:5192/'
async function readSave(page) {
  return page.evaluate(() => new Promise((resolve, reject) => {
    const request = indexedDB.open('underground-home-spring-playtest-v1', 1)
    request.onsuccess = () => {
      const db = request.result, tx = db.transaction('saves'), get = tx.objectStore('saves').get('underground-home-save')
      get.onsuccess = () => { resolve(get.result); db.close() }; get.onerror = reject
    }; request.onerror = reject
  }))
}
async function camera(page) {
  return page.locator('canvas').evaluate(c => ({ x: c.dataset.cameraX, y: c.dataset.cameraY, zoom: c.dataset.zoom }))
}
async function waitTime(page, seconds) {
  await page.waitForFunction(t => Number(document.querySelector('canvas')?.dataset.openingTime) >= t, seconds)
}
async function finished(page) {
  await page.locator('.opening-overlay').waitFor({ state: 'hidden' })
  await page.waitForFunction(() => document.querySelector('canvas')?.dataset.openingPhase === 'finished')
  await page.waitForTimeout(150)
}
async function main() {
  await fs.mkdir(out, { recursive: true })
  const browser = await chromium.launch({ headless: true, args: ['--enable-webgl', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
  const errors = [], results = []
  async function fresh(viewport = { width: 1440, height: 960 }, seed) {
    const context = await browser.newContext({ viewport })
    const page = await context.newPage()
    page.on('pageerror', e => errors.push(e.message))
    if (seed) {
      await page.route('**/__seed.html', route => route.fulfill({ contentType: 'text/html', body: '<title>isolated save fixture</title>' }))
      await page.goto(new URL('/__seed.html', url).href)
      await page.evaluate(payload => new Promise((resolve, reject) => {
        const request = indexedDB.open('underground-home-spring-playtest-v1', 1)
        request.onupgradeneeded = () => request.result.createObjectStore('saves')
        request.onsuccess = () => {
          const db = request.result, tx = db.transaction('saves', 'readwrite')
          tx.objectStore('saves').put(payload, 'underground-home-save')
          tx.oncomplete = () => { db.close(); resolve() }; tx.onerror = reject
        }; request.onerror = reject
      }), seed)
    }
    await page.goto(url)
    if (seed) { await page.locator('canvas').waitFor(); return { context, page } }
    await page.waitForFunction(() => document.querySelector('canvas')?.dataset.openingPhase === 'run')
    return { context, page }
  }
  try {
    if (!process.argv.includes('--capture-only')) {
    const { context, page } = await fresh()
    await page.getByRole('button', { name: '开启声音', exact: true }).click()
    await finished(page)
    const finalSave = await readSave(page), finalCamera = await camera(page)
    assert.equal(finalSave.world.progress.crystalFound, false)
    assert.equal(finalSave.world.dugCount, 0)
    assert.deepEqual(finalSave.world.exploration.explorer, { x: 18, y: 11 })
    await page.screenshot({ path: path.join(out, '05-mission-handoff.png') })
    results.push({ case: 'complete-playback', seconds: 7.6, camera: finalCamera, passed: true })
    await page.reload()
    await page.getByText('已恢复上次的进度', { exact: false }).waitFor()
    assert.equal(await page.locator('.opening-overlay').count(), 0)
    assert.deepEqual(await readSave(page), finalSave)
    await page.screenshot({ path: path.join(out, '06-save-restored.png') })
    results.push({ case: 'restore-untouched-save-no-replay', passed: true })
    await context.close()
    for (const seconds of [.1, 1.9, 3.1, 5.35, 6.35]) {
      const { context, page } = await fresh()
      await waitTime(page, seconds)
      if (seconds === 3.1) await page.keyboard.press('Escape')
      else await page.getByRole('button', { name: '跳过开场', exact: false }).click()
      await finished(page)
      const save = await readSave(page)
      assert.deepEqual(save.world, finalSave.world)
      assert.deepEqual(await camera(page), finalCamera)
      assert.equal(await page.getByText('找到发光的能源石', { exact: true }).count(), 1)
      results.push({ case: 'skip', at: seconds, escape: seconds === 3.1, sameWorldCameraMission: true })
      await context.close()
    }
    const narrow = await fresh({ width: 900, height: 620 })
    await waitTime(narrow.page, 3)
    await narrow.page.screenshot({ path: path.join(out, '07-narrow-ladder.png') })
    await narrow.page.getByRole('button', { name: '跳过开场', exact: false }).click()
    await finished(narrow.page)
    results.push({ case: 'narrow-900x620-skip', passed: true })
    await narrow.context.close()

    const fixture = JSON.parse(await fs.readFile(path.join(out, '../room-construction-v1/expanded-home-save.json'), 'utf8'))
    const old = await fresh(undefined, fixture)
    await old.page.getByText('已恢复上次的进度', { exact: false }).waitFor()
    assert.equal(await old.page.locator('.opening-overlay').count(), 0)
    assert.deepEqual(await readSave(old.page), fixture)
    await old.page.screenshot({ path: path.join(out, '08-progressed-save-restored.png') })
    results.push({ case: 'restore-progressed-v12-world-unchanged', passed: true })
    await old.context.close()

    const input = await fresh()
    await input.page.getByRole('button', { name: '跳过开场', exact: false }).click()
    await finished(input.page)
    const canvas = input.page.locator('canvas'), rect = await canvas.boundingBox(), cam = await camera(input.page)
    await input.page.mouse.click(rect.x + (14.5 * 32 - Number(cam.x)) * Number(cam.zoom), rect.y + (11.5 * 32 - Number(cam.y)) * Number(cam.zoom))
    for (let i = 0; i < 40 && (await readSave(input.page)).world.dugCount === 0; i++) await input.page.waitForTimeout(100)
    assert.equal((await readSave(input.page)).world.dugCount, 1)
    results.push({ case: 'skip-unlocks-real-digging', passed: true })
    await input.context.close()
    assert.deepEqual(errors, [])
    await fs.writeFile(path.join(out, 'browser-report.json'), JSON.stringify({ url, results, runtimeErrors: errors }, null, 2))
    if (process.argv.includes('--checks-only')) {
      console.log(JSON.stringify({ results, runtimeErrors: errors }, null, 2))
      return
    }
    }

    // 固定浏览器时钟采集真实GPU画面，避免截图编码耗时错过短暂的线索镜头。
    const captureContext = await browser.newContext({ viewport: { width: 1440, height: 960 } })
    const capture = await captureContext.newPage()
    await capture.clock.install({ time: new Date('2026-10-19T00:00:00Z') })
    await capture.clock.pauseAt(new Date('2026-10-19T00:00:00.100Z'))
    await capture.goto(url)
    await capture.locator('canvas').waitFor()
    await capture.waitForFunction(() => document.querySelector('canvas')?.dataset.openingPhase === 'run')
    const cdp = await captureContext.newCDPSession(capture)
    let elapsed = 0
    for (const [milliseconds, name, phase] of [[700, '01-snow-run.png', 'run'], [3150, '02-ladder-descent.png', 'climb'], [5500, '03-stopped-core.png', 'core'], [6450, '04-blue-clue.png', 'clue']]) {
      await capture.clock.runFor(milliseconds - elapsed); elapsed = milliseconds
      assert.equal(await capture.locator('canvas').getAttribute('data-opening-phase'), phase)
      const shot = await cdp.send('Page.captureScreenshot', { format: 'png', fromSurface: true })
      await fs.writeFile(path.join(out, name), Buffer.from(shot.data, 'base64'))
    }
    results.push({ case: 'four-verified-story-phase-screenshots', passed: true })
    await captureContext.close()
    assert.deepEqual(errors, [])
    if (process.argv.includes('--capture-only')) {
      console.log(JSON.stringify({ screenshots: results }, null, 2))
      return
    }
    await fs.writeFile(path.join(out, 'browser-report.json'), JSON.stringify({ url, results, runtimeErrors: errors }, null, 2))
    console.log(JSON.stringify({ results, runtimeErrors: errors }, null, 2))
  } finally { await browser.close() }
}
main().catch(e => { console.error(e); process.exitCode = 1 })
