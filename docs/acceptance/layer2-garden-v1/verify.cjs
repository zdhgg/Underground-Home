const { chromium } = require('C:/Users/ZhuanZ/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')
const fs = require('node:fs/promises')
const path = require('node:path')
const assert = require('node:assert/strict')

const url = process.env.GARDEN_TEST_URL || 'http://127.0.0.1:5196/'
const out = __dirname

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

async function readSave(page) {
  return page.evaluate(() => new Promise((resolve, reject) => {
    const request = indexedDB.open('underground-home-spring-playtest-v1', 1)
    request.onerror = () => reject(request.error)
    request.onsuccess = () => {
      const db = request.result
      const get = db.transaction('saves', 'readonly').objectStore('saves').get('underground-home-save')
      get.onsuccess = () => { db.close(); resolve(get.result) }
      get.onerror = () => reject(get.error)
    }
  }))
}

async function clickCell(page, x, y) {
  const box = await page.locator('canvas').boundingBox()
  const camera = await page.locator('canvas').evaluate(canvas => ({
    x: Number(canvas.dataset.cameraX), y: Number(canvas.dataset.cameraY), zoom: Number(canvas.dataset.zoom),
  }))
  await page.mouse.click(box.x + ((x + 0.5) * 32 - camera.x) * camera.zoom, box.y + ((y + 0.5) * 32 - camera.y) * camera.zoom)
}

async function main() {
  const browser = await chromium.launch({ headless: true, args: ['--enable-webgl', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
  const results = [], errors = []
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 960 } })
    const page = await context.newPage()
    page.on('pageerror', error => errors.push(error.message))

    const save = JSON.parse(await fs.readFile(path.join(out, '../room-construction-v1/garden-save.json'), 'utf8'))
    // 新菜园状态：清掉旧第一层房间和菜槽，只保留水、泉、第二层通路。
    save.world.rooms = []
    save.world.nextRoomId = 1
    save.world.farm.planters = []
    delete save.world.workers.xiaoman
    delete save.world.workers.xiaoquan

    await page.goto(url)
    await page.locator('.start-screen').waitFor()
    await seed(page, save)
    await page.reload()
    await page.getByRole('button', { name: '继续游戏', exact: true }).click()
    await page.locator('.guide').waitFor()
    await page.getByRole('button', { name: /2层/ }).click()
    await page.waitForTimeout(1600)

    const tool = page.getByRole('button', { name: '🌱 种植槽', exact: true })
    await tool.waitFor()
    await page.screenshot({ path: path.join(out, '01-layer2-garden-tool.png') })
    await tool.click()
    await page.waitForTimeout(200)
    await clickCell(page, 25, 21)
    await page.getByRole('button', { name: /确认建造/ }).waitFor()
    await page.screenshot({ path: path.join(out, '02-layer2-planter-preview.png') })
    await page.getByRole('button', { name: /确认建造/ }).click()
    await page.waitForTimeout(600)

    const saved = await readSave(page)
    assert.equal(saved.world.farm.planters.length, 1)
    assert.deepEqual({ x: saved.world.farm.planters[0].x, y: saved.world.farm.planters[0].y }, { x: 25, y: 21 })
    assert.equal(saved.world.rooms.length, 0)
    await page.screenshot({ path: path.join(out, '03-layer2-planter-planted.png') })
    results.push({ case: 'layer2-planter-tool-places-and-saves-at-spring', passed: true })

    // 主页面的家里清单仍只讲第一层，不会把菜园混进去。
    await page.getByRole('button', { name: /1层/ }).click()
    await page.waitForTimeout(500)
    await page.getByRole('button', { name: /提示与工具/ }).click()
    const goals = await page.locator('.home-goals').innerText()
    assert.match(goals, /住处/)
    assert.match(goals, /客厅/)
    assert(!goals.includes('菜园'))
    await page.screenshot({ path: path.join(out, '04-home-goals-still-layer1.png') })
    results.push({ case: 'home-goals-remain-layer1', passed: true })

    assert.deepEqual(errors, [])
    await fs.writeFile(path.join(out, 'browser-report.json'), JSON.stringify({ url, results, runtimeErrors: errors }, null, 2))
    console.log(JSON.stringify({ results, runtimeErrors: errors }, null, 2))
    await context.close()
  } finally {
    await browser.close()
  }
}

main().catch(error => { console.error(error); process.exitCode = 1 })
