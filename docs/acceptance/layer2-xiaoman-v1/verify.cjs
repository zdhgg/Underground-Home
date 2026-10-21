const { chromium } = require('C:/Users/ZhuanZ/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')
const fs = require('node:fs/promises')
const path = require('node:path')
const assert = require('node:assert/strict')

const url = process.env.LAYER_TEST_URL || 'http://127.0.0.1:5195/'
const out = __dirname
const fixtures = path.join(out, '../room-construction-v1')

async function seed(page, payload) {
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

async function loadSave(page, payload) {
  await page.goto(url)
  await page.locator('.start-screen').waitFor()
  await seed(page, payload)
  await page.reload()
  await page.getByRole('button', { name: '继续游戏', exact: true }).waitFor()
  await page.getByRole('button', { name: '继续游戏', exact: true }).click()
  await page.locator('.guide').waitFor()
  await page.waitForTimeout(500)
}

async function shot(page, name) {
  await page.screenshot({ path: path.join(out, name) })
}

async function main() {
  const browser = await chromium.launch({ headless: true, args: ['--enable-webgl', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
  const errors = [], results = []
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 960 } })
    const page = await context.newPage()
    page.on('pageerror', error => errors.push(error.message))

    const partial = JSON.parse(await fs.readFile(path.join(fixtures, 'partial-save.json'), 'utf8'))
    await loadSave(page, partial)
    assert.match(await page.locator('.guide').innerText(), /给伙伴安一个睡眠舱/)
    const cta = page.getByRole('button', { name: '🏠 去建房与扩建' })
    await cta.waitFor()
    const extra = await page.locator('.home-extra').innerText()
    assert.match(extra, /旧物 0\/3/)
    assert.match(extra, /客厅/)
    await shot(page, '01-first-layer-guidance.png')
    results.push({ case: 'layer1-bed-step-has-direct-build-cta-and-home-extra', passed: true })

    await cta.click()
    await page.locator('.room-tools').waitFor()
    assert.match(await page.locator('.room-tools').innerText(), /先选功能，再建房/)
    await shot(page, '02-build-panel-from-guide.png')
    await page.getByRole('button', { name: '结束房间规划' }).click()
    await page.locator('.room-tools').waitFor({ state: 'hidden' })
    results.push({ case: 'guide-cta-opens-room-builder', passed: true })

    await page.getByRole('button', { name: /提示与工具/ }).click()
    await page.locator('.home-goals').waitFor()
    const goals = await page.locator('.home-goals').innerText()
    assert.match(goals, /住处/)
    assert.match(goals, /旧避难所的东西/)
    assert.match(goals, /客厅/)
    await shot(page, '03-home-goals-checklist.png')
    results.push({ case: 'expanded-guide-lists-three-home-goals', passed: true })

    const expanded = JSON.parse(await fs.readFile(path.join(fixtures, 'expanded-home-save.json'), 'utf8'))
    await loadSave(page, expanded)
    assert.match(await page.locator('.guide').innerText(), /楼下有谁在喊饿/)
    assert.match(await page.locator('.home-extra').innerText(), /客厅/)
    await shot(page, '04-first-bed-still-no-rabbit.png')
    results.push({ case: 'first-bed-does-not-spawn-rabbit-and-hints-voice-below', passed: true })

    const garden = JSON.parse(await fs.readFile(path.join(fixtures, 'garden-save.json'), 'utf8'))
    delete garden.world.workers.xiaoman
    await loadSave(page, garden)
    assert.match(await page.locator('.guide').innerText(), /安顿新朋友/)
    await page.getByRole('button', { name: /2层/ }).click()
    await page.waitForTimeout(1600)
    // 把指针放到小满身上：名字牌只在悬停时出现。
    const box = await page.locator('canvas').boundingBox()
    const camera = await page.locator('canvas').evaluate(canvas => ({ x: Number(canvas.dataset.cameraX), y: Number(canvas.dataset.cameraY), zoom: Number(canvas.dataset.zoom) }))
    await page.mouse.move(box.x + (25.5 * 32 - camera.x) * camera.zoom, box.y + (21.5 * 32 - camera.y) * camera.zoom)
    await page.waitForTimeout(250)
    await shot(page, '05-xiaoman-on-layer2.png')
    await page.getByRole('button', { name: '伙伴在哪' }).click()
    const menu = page.locator('.partner-menu')
    await menu.waitFor()
    assert.match(await menu.innerText(), /小满/)
    await shot(page, '06-partner-finder-finds-xiaoman.png')
    results.push({ case: 'arrival-meets-xiaoman-in-layer2-cave', passed: true })

    assert.deepEqual(errors, [])
    await fs.writeFile(path.join(out, 'browser-report.json'), JSON.stringify({ url, results, runtimeErrors: errors }, null, 2))
    console.log(JSON.stringify({ results, runtimeErrors: errors }, null, 2))
    await context.close()
  } finally {
    await browser.close()
  }
}

main().catch(error => { console.error(error); process.exitCode = 1 })
