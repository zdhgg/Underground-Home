// 生产预览、隔离浏览器、固定时钟；仅用指针挖土，不访问玩家存档。
const { chromium } = require('C:/Users/ZhuanZ/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')
const fs = require('node:fs/promises')
const path = require('node:path')
const assert = require('node:assert/strict')
const url = process.env.ATU_DIG_TEST_URL || 'http://127.0.0.1:5195/'

async function main() {
  const browser = await chromium.launch({ headless: true, args: ['--enable-webgl', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
  const errors = [], checks = []
  async function start(viewport = { width: 1440, height: 960 }) {
    const context = await browser.newContext({ viewport }), page = await context.newPage()
    page.on('pageerror', error => errors.push(error.message))
    await page.addInitScript(() => {
      window.requestAnimationFrame = callback => setTimeout(() => callback(performance.now()), 50)
      window.cancelAnimationFrame = id => clearTimeout(id)
    })
    await page.clock.install({ time: new Date('2026-10-20T08:00:00Z') })
    await page.clock.pauseAt(new Date('2026-10-20T08:00:00.100Z'))
    await page.goto(url)
    await page.getByRole('button', { name: '开始游戏', exact: true }).click()
    await page.getByRole('button', { name: /跳过开场/ }).click()
    await page.clock.runFor(100)
    assert.equal(await page.locator('canvas').getAttribute('data-opening-phase'), 'finished')
    return { context, page }
  }
  async function clickCell(page, x, y) {
    const p = await page.locator('canvas').evaluate((canvas, cell) => {
      const b = canvas.getBoundingClientRect(), d = canvas.dataset, z = Number(d.zoom)
      return { x: b.x + ((cell.x + .5) * 32 - Number(d.cameraX)) * z, y: b.y + ((cell.y + .5) * 32 - Number(d.cameraY)) * z }
    }, { x, y })
    await page.mouse.click(p.x, p.y)
  }
  async function shot(page, name) {
    const cdp = await page.context().newCDPSession(page)
    const { data } = await cdp.send('Page.captureScreenshot', { format: 'png', fromSurface: true })
    await fs.writeFile(path.join(__dirname, name), Buffer.from(data, 'base64'))
    await cdp.detach()
  }
  async function savedWorld(page) {
    return page.evaluate(() => new Promise((resolve, reject) => {
      const request = indexedDB.open('underground-home-spring-playtest-v1', 1)
      request.onerror = () => reject(request.error)
      request.onsuccess = () => {
        const db = request.result, tx = db.transaction('saves', 'readonly')
        const get = tx.objectStore('saves').get('underground-home-save')
        get.onsuccess = () => resolve(get.result?.world)
        get.onerror = () => reject(get.error)
        tx.oncomplete = () => db.close()
      }
    }))
  }
  try {
    for (const [x, y, ms, name] of [
      [14, 11, 750, '01-left-side.png'],
      [14, 10, 750, '02-left-raised.png'],
      [14, 9, 1100, '03-left-stool.png'],
      [26, 11, 1550, '04-right-side.png'],
    ]) {
      const { context, page } = await start()
      await clickCell(page, x, y)
      await page.clock.runFor(ms)
      await shot(page, name)
      await page.clock.runFor(2000)
      assert.equal(await page.getByRole('button', { name: /停下来/ }).count(), 0)
      const world = await savedWorld(page)
      assert.equal(world.tiles[y][x], 0)
      assert.equal(world.dugCount, 1)
      checks.push({ case: name, target: { x, y }, capturedAtMs: ms, completed: true, dugCount: world.dugCount })
      await context.close()
    }
    const { context, page } = await start()
    for (const [x, y] of [[26, 11], [26, 10], [27, 11], [27, 10]]) {
      await clickCell(page, x, y); await page.clock.runFor(2200)
    }
    await clickCell(page, 27, 9)
    await page.clock.runFor(700)
    await shot(page, '05-overhead.png')
    await page.keyboard.press('Escape')
    await page.clock.runFor(100)
    await shot(page, '06-cancel-overhead.png')
    await page.clock.runFor(1200)
    assert.equal(await page.getByRole('button', { name: /停下来/ }).count(), 0)
    const canceled = await savedWorld(page)
    assert.equal(canceled.tiles[9][27], 1)
    assert.equal(canceled.dugCount, 4)
    checks.push({ case: 'overhead-and-escape', completed: true, canceledTargetRemainsSoil: true, dugCount: canceled.dugCount })
    await context.close()
    const narrow = await start({ width: 900, height: 620 })
    await clickCell(narrow.page, 14, 9); await narrow.page.clock.runFor(1100)
    await shot(narrow.page, '07-narrow-stool.png')
    await narrow.page.clock.runFor(2000)
    assert.equal((await savedWorld(narrow.page)).tiles[9][14], 0)
    checks.push({ case: '900x620-stool', completed: true })
    await narrow.context.close()
    assert.deepEqual(errors, [])
    await fs.writeFile(path.join(__dirname, 'browser-report.json'), JSON.stringify({ mode: 'production preview; isolated Chromium; pointer inputs; 50ms clock steps', checks, runtimeErrors: errors }, null, 2) + '\n')
    console.log(JSON.stringify({ checks, runtimeErrors: errors }, null, 2))
  } finally { await browser.close() }
}
main().catch(error => { console.error(error); process.exitCode = 1 })
