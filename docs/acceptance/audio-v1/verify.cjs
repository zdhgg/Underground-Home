// 独立浏览器上下文：不接触玩家存档。检查真实音频节点、事件时间与界面布局。
const { chromium } = require('C:/Users/ZhuanZ/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')
const fs = require('node:fs/promises')
const path = require('node:path')
const assert = require('node:assert/strict')
const url = process.env.AUDIO_TEST_URL || 'http://127.0.0.1:5198/'
const checks = [], errors = []
async function shot(page, name) { await page.screenshot({ path: path.join(__dirname, name) }) }
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

async function probe(page) {
  await page.evaluate(async () => {
    const { gameAudio } = await import('/src/render/gameAudio.ts')
    window.soundEvents = []
    const play = gameAudio.play.bind(gameAudio)
    gameAudio.play = (...args) => { window.soundEvents.push({ id: args[0], at: performance.now(), ready: !!gameAudio.ready }); return play(...args) }
  })
}
async function main() {
  const browser = await chromium.launch({ headless: true, args: ['--enable-webgl', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
  try {
    for (const viewport of [{ width: 1440, height: 960 }, { width: 390, height: 844 }]) {
      const context = await browser.newContext({ viewport })
      await context.addInitScript(() => {
        const Native = window.AudioContext
        window.audioProbe = { contexts: [], sources: [] }
        window.AudioContext = class extends Native {
          constructor(...args) { super(...args); window.audioProbe.contexts.push(this) }
          createOscillator() { const s = super.createOscillator(); window.audioProbe.sources.push(s); return s }
          createBufferSource() { const s = super.createBufferSource(); window.audioProbe.sources.push(s); return s }
        }
      })
      const page = await context.newPage()
      page.on('pageerror', e => errors.push(e.message))
      await page.goto(url)
      await page.getByRole('button', { name: '开始游戏', exact: true }).click()
      await page.getByRole('button', { name: '关闭声音', exact: true }).click()
      await page.getByRole('button', { name: '开启声音', exact: true }).click()
      await page.getByRole('button', { name: /跳过开场/ }).click()
      await page.waitForTimeout(100)
      assert.equal(await page.evaluate(() => window.audioProbe.contexts.length), 1)
      assert.equal(await page.evaluate(() => window.audioProbe.contexts[0].state), 'running')
      await probe(page)
      if (viewport.width === 1440) {
        await tapTile(page, 14, 11)
        await page.waitForFunction(() => window.soundEvents.some(e => e.id === 'soil'))
        assert.equal(await page.evaluate(() => window.soundEvents.filter(e => e.id === 'soil' && e.ready).length), 1)
        await page.waitForTimeout(800)
        await page.getByRole('button', { name: '撤销', exact: false }).click()
        await page.waitForFunction(() => window.soundEvents.some(e => e.id === 'undo'))
        checks.push('actual soil impact and undo events, one soil cue')
      }
      await page.getByRole('button', { name: '关闭声音', exact: true }).click()
      const count = await page.evaluate(() => window.audioProbe.sources.length)
      await page.evaluate(async () => {
        const s = await import('/src/render/waterSound.ts'); s.playSoilDig(); s.playBuildComplete()
      })
      assert.equal(await page.evaluate(() => window.audioProbe.sources.length), count)
      await page.reload()
      await page.getByRole('button', { name: '继续游戏', exact: true }).click()
      await page.getByRole('button', { name: '开启声音', exact: true }).waitFor()
      assert.equal(await page.evaluate(() => window.audioProbe.contexts.length), 0)
      await page.getByRole('button', { name: '开启声音', exact: true }).click()
      await page.waitForTimeout(50)
      // 第二批背景音乐允许恢复持续循环，但仍不能补播旧的一次性事件。
      assert.equal(await page.evaluate(() => window.audioProbe.sources.filter(s => !s.loop).length), 0)
      checks.push(`${viewport.width}: gesture unlock, opening mute/unmute/skip, saved mute on continue, no replay`)
      await seed(page, 'intro')
      await probe(page)
      await tapTile(page, 21, 9)
      await page.locator('.conversation').waitFor()
      const events = await page.evaluate(() => window.soundEvents)
      assert.deepEqual(events.filter(e => e.ready).map(e => e.id), ['core', 'partner'])
      assert(events[1].at - events[0].at >= 600)
      const button = await page.locator('.sound-toggle').boundingBox()
      assert(button.x >= 0 && button.x + button.width <= viewport.width)
      assert(button.height >= 44)
      assert.equal(await page.locator('[data-attention-panel]').count(), 1)
      assert.equal(await page.locator('[data-primary-action]').count(), 1)
      await page.getByRole('button', { name: '关闭声音', exact: true }).click()
      assert.equal(await page.locator('.conversation').count(), 1)
      await shot(page, `${viewport.width}-muted-conversation.png`)
      checks.push(`${viewport.width}: core before partner >=600ms, sound control reachable without covering dialogue`)
      if (viewport.width === 1440) {
        await page.getByRole('button', { name: '开启声音', exact: true }).click()
        await seed(page, 'ready')
        await probe(page)
        await page.locator('.guide-primary').click()
        await page.getByRole('button', { name: '开工！', exact: false }).click()
        assert.equal(await page.evaluate(() => window.soundEvents.filter(e => e.id === 'built').length), 0)
        await page.getByText('已经建好啦', { exact: false }).waitFor({ timeout: 15000 })
        assert.equal(await page.evaluate(() => window.soundEvents.filter(e => e.id === 'built' && e.ready).length), 1)
        await shot(page, '1440-building-complete.png')
        checks.push('actual building construction: no early celebration, one completed cue')
      }
      await context.close()
    }
    assert.deepEqual(errors, [])
    await fs.writeFile(path.join(__dirname, 'results.json'), JSON.stringify({ checks, errors }, null, 2))
    console.log(JSON.stringify({ checks, errors }, null, 2))
  } finally { await browser.close() }
}
main().catch(e => { console.error(e); process.exitCode = 1 })
