// 隔离浏览器与固定时钟，验证地面情绪节拍和交还控制；不访问玩家进度。
const { chromium } = require('C:/Users/ZhuanZ/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')
const fs = require('node:fs/promises')
const path = require('node:path')
const assert = require('node:assert/strict')
const url = process.env.OPENING_TEST_URL || 'http://127.0.0.1:5194/'
const out = __dirname
async function main() {
  await fs.mkdir(out, { recursive: true })
  const browser = await chromium.launch({ headless: true, args: ['--enable-webgl', '--use-angle=d3d11'] })
  const errors = [], results = []
  async function start(viewport = { width: 1440, height: 960 }) {
    const context = await browser.newContext({ viewport })
    const page = await context.newPage()
    page.on('pageerror', e => errors.push(e.message))
    // 按 10fps 采样，仍逐次走真实 ticker 的 100ms 上限。
    // 不改演出速度或业务状态，避免固定时钟为截图绘制上千帧。
    await page.addInitScript(() => {
      window.requestAnimationFrame = callback => setTimeout(() => callback(performance.now()), 100)
      window.cancelAnimationFrame = id => clearTimeout(id)
    })
    await page.clock.install({ time: new Date('2026-10-19T00:00:00Z') })
    await page.clock.pauseAt(new Date('2026-10-19T00:00:00.100Z'))
    await page.goto(url)
    await page.getByRole('button', { name: '开始游戏', exact: true }).click()
    await page.waitForFunction(() => document.querySelector('canvas')?.dataset.openingPhase === 'run')
    return { page, context }
  }
  const camera = page => page.locator('canvas').evaluate(c => ({ x: c.dataset.cameraX, y: c.dataset.cameraY, zoom: c.dataset.zoom }))
  async function finished(page) {
    assert.equal(await page.locator('canvas').getAttribute('data-opening-phase'), 'finished')
    assert.equal(await page.locator('.opening-overlay').count(), 0)
    assert.equal(await page.getByText('找到发光的能源石', { exact: true }).count(), 1)
    assert.equal(await page.locator('.guide .goal small span').innerText(), '0/4')
  }
  async function shot(page, name) {
    const cdp = await page.context().newCDPSession(page)
    const { data } = await cdp.send('Page.captureScreenshot', { format: 'png', fromSurface: true })
    await fs.writeFile(path.join(out, name), Buffer.from(data, 'base64'))
    await cdp.detach()
  }
  try {
    const desktop = await start()
    let elapsed = 0
    for (const [ms, phase, speech, name] of [
      [1600, 'cold', '好冷呀……', '01-cold.png'],
      [3550, 'notice', '咦？那边有个入口！', '02-discovery.png'],
      [6200, 'approach', '', '03-approach.png'],
      [8500, 'shelter', '啊，暖和一点了！', '04-shelter.png'],
      [10800, 'climb', '', '05-descent.png'],
      [13400, 'core', '', '06-core.png'],
      [14800, 'clue', '', '07-clue.png'],
      [15500, 'welcome', '心心，这里就是我们的地下小家园。', '08-home.png'],
    ]) {
      await desktop.page.clock.runFor(ms - elapsed); elapsed = ms
      assert.equal(await desktop.page.locator('canvas').getAttribute('data-opening-phase'), phase)
      if (speech) {
        // 字幕非空；Pixi 气泡与角色的实际可见性通过截图人工核验。
        assert.equal(await desktop.page.locator('.opening-caption').innerText(), speech)
      }
      await shot(desktop.page, name)
      results.push({ case: `desktop-${phase}`, at: ms / 1000, speech, passed: true })
    }
    await desktop.page.clock.runFor(3000)
    await finished(desktop.page)
    const finalCamera = await camera(desktop.page)
    await shot(desktop.page, '09-handoff.png')
    results.push({ case: 'natural-end-first-mission-0-of-4', passed: true })
    await desktop.context.close()

    for (const ms of [0, 1600, 4200, 6200, 7200, 8500, 10800, 13400, 14800]) {
      const item = await start()
      await item.page.clock.runFor(ms)
      if (ms === 8500) await item.page.keyboard.press('Escape')
      else await item.page.getByRole('button', { name: '跳过开场', exact: false }).click()
      await finished(item.page)
      assert.deepEqual(await camera(item.page), finalCamera)
      results.push({ case: 'skip-same-camera-and-first-mission', at: ms / 1000, passed: true })
      await item.context.close()
    }
    for (const viewport of [{ width: 900, height: 620 }, { width: 390, height: 844 }]) {
      const item = await start(viewport)
      let elapsed = 0
      for (const [ms, phase] of [[1600, 'cold'], [3550, 'notice'], [8500, 'shelter']]) {
        await item.page.clock.runFor(ms - elapsed); elapsed = ms
        assert.equal(await item.page.locator('canvas').getAttribute('data-opening-phase'), phase)
        assert.equal(await item.page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false)
        await shot(item.page, `${viewport.width}-${phase}.png`)
      }
      await item.page.clock.runFor(10000)
      await finished(item.page)
      results.push({ case: `full-playback-${viewport.width}x${viewport.height}`, passed: true })
      await item.context.close()
    }
    assert.deepEqual(errors, [])
    const report = { url, results, runtimeErrors: errors }
    await fs.writeFile(path.join(out, 'browser-report.json'), JSON.stringify(report, null, 2))
    console.log(JSON.stringify(report, null, 2))
  } finally { await browser.close() }
}
main().catch(e => { console.error(e); process.exitCode = 1 })
