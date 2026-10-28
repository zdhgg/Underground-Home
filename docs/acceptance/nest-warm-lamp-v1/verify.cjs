// 独立 Playwright 浏览器上下文；只写临时浏览器的 IndexedDB，不接触玩家档案。
const { chromium } = require('C:/Users/ZhuanZ/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')
const fs = require('node:fs/promises')
const path = require('node:path')
const assert = require('node:assert/strict')
const url = process.env.LAMP_TEST_URL || 'http://127.0.0.1:5198/'
const fixtureUrl = process.env.LAMP_FIXTURE_URL || 'http://127.0.0.1:5197/'
const sleep = ms => new Promise(r => setTimeout(r, ms))
async function saveIO(page, value) {
  return page.evaluate(value => new Promise((resolve, reject) => {
    const req = indexedDB.open('underground-home-spring-playtest-v1', 1)
    req.onupgradeneeded = () => req.result.createObjectStore('saves')
    req.onerror = () => reject(req.error)
    req.onsuccess = () => {
      const db = req.result, tx = db.transaction('saves', value ? 'readwrite' : 'readonly'), store = tx.objectStore('saves')
      const op = value ? store.put(value, 'underground-home-save') : store.get('underground-home-save')
      tx.oncomplete = () => { db.close(); resolve(value || op.result) }; tx.onerror = () => reject(tx.error)
    }
  }), value)
}
async function waitSave(page, predicate) {
  for (let i = 0; i < 80; i++) { const s = await saveIO(page); if (predicate(s)) return s; await sleep(100) }
  throw Error('自动保存未达到预期状态')
}
async function attention(page, expected) {
  const value = await page.locator('.stage').evaluate(stage => ({ panels: [...stage.querySelectorAll('[data-attention-panel]')].map(e => e.dataset.attentionPanel), primary: stage.querySelectorAll('[data-primary-action]').length }))
  assert(value.panels.length <= 1); assert(value.primary <= 1)
  if (expected) assert.deepEqual(value.panels, [expected])
}
async function shot(page, name) { await page.screenshot({ path: path.join(__dirname, `${name}.png`) }) }
async function clearNestView(page, width) {
  if (await page.locator('.room-tools').isVisible()) await page.getByRole('button', { name: '关闭当前房间', exact: true }).click()
  if (width === 390) {
    const b = await page.locator('canvas').boundingBox()
    await page.mouse.move(b.x + b.width - 20, b.y + 340); await page.mouse.down()
    await page.mouse.move(b.x + b.width - 20, b.y + 490, { steps: 12 }); await page.mouse.up(); await sleep(100)
  }
}
async function clickCell(page, x, y) {
  const box = await page.locator('canvas').boundingBox()
  const c = await page.locator('canvas').evaluate(e => ({ x: +e.dataset.cameraX, y: +e.dataset.cameraY, z: +e.dataset.zoom }))
  await page.mouse.click(box.x + ((x + .5) * 32 - c.x) * c.z, box.y + ((y + .5) * 32 - c.y) * c.z)
}
async function main() {
  const browser = await chromium.launch({ headless: true, args: ['--enable-webgl', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
  const errors = [], results = []
  let activePage
  try {
    const setup = await browser.newPage(); await setup.goto(fixtureUrl)
    const fixtures = await setup.evaluate(async () => {
      const { warmLampWorld } = await import('/tests/fixtures/nestWarmLampWorld.ts')
      const { serialize, deserialize } = await import('/src/core/persistence.ts')
      const { planPartnerWork } = await import('/src/core/partnerWork.ts')
      return [false, true].map(room => {
        const w = warmLampWorld(room), payload = serialize(w)
        if (!deserialize(payload).ok) throw Error('验收夹具加载失败')
        const plan = planPartnerWork(w, { kind: 'nest-warm-lamp', podId: 1 })
        if (!plan.ok) throw Error(plan.message)
        return { payload, plan: plan.plan }
      })
    })
    await fs.writeFile(path.join(__dirname, 'fixture-v25.json'), JSON.stringify({ ...fixtures[1].payload, version: 25 }) + '\n')
    await setup.close()
    for (const width of (process.env.LAMP_WIDTH ? [+process.env.LAMP_WIDTH] : [1440, 390])) {
      const context = await browser.newContext({ viewport: { width, height: width === 1440 ? 900 : 844 } })
      const page = await context.newPage(); activePage = page; page.on('pageerror', e => errors.push(e.message))
      await page.goto(url)
      const seed = structuredClone(fixtures[1].payload); seed.version = 25
      await saveIO(page, seed); await page.reload()
      await page.getByRole('button', { name: /继续游戏/ }).click()
      await page.locator('.start-screen').waitFor({ state: 'hidden' }); await page.locator('canvas').waitFor()
      if (await page.locator('.depth-toggle').isVisible()) await page.locator('.depth-toggle').click()
      await page.locator('.depth-nav .home').click()
      await sleep(700)
      const webgl = await page.locator('canvas').evaluate(e => { const gl = e.getContext('webgl2') || e.getContext('webgl'); return gl ? { version: gl.getParameter(gl.VERSION), renderer: gl.getParameter(gl.RENDERER) } : null })
      assert(webgl, '必须是真实WebGL画布')
      // 点击房间本体，按稳定pod选择第一个小窝。
      await clickCell(page, 13, 11); await page.locator('.room-tools').waitFor(); await sleep(200)
      await attention(page, 'room'); await clearNestView(page, width); await shot(page, `${width}-01-before`)
      await clickCell(page, 13, 11); await page.locator('.room-tools').waitFor(); await sleep(100)
      const openLamp = async () => {
        await page.locator('.room-tools').getByRole('button', { name: /第1间小窝.*给小窝添盏灯/ }).click()
        await page.locator('[data-attention-panel="nest-warm-lamp"]').waitFor()
      }
      await openLamp(); await attention(page, 'nest-warm-lamp'); await shot(page, `${width}-02-preview`)
      console.log('preview', width)
      const parts = seed.world.deep.parts
      assert.equal((await saveIO(page)).world.deep.parts, parts)
      await page.getByRole('button', { name: '请阿灯装灯' }).click()
      await page.locator('.work-status').waitFor(); await attention(page, 'work')
      // 行走阶段取消，验证真实站位保留和没有材料结算。
      await sleep(260)
      await page.getByRole('button', { name: '停下来，换个目标' }).click()
      console.log('canceling', width)
      const canceled = await waitSave(page, s => s.version === 26 && s.world.workers.adeng.x !== seed.world.workers.adeng.x)
      assert.equal(canceled.world.deep.parts, parts); assert(!canceled.world.pods[0].warmLamp)
      await clickCell(page, 13, 11); await page.locator('.room-tools').waitFor(); await openLamp()
      await page.getByRole('button', { name: '请阿灯装灯' }).click()
      await shot(page, `${width}-03-walking`)
      await page.locator('.work-status p').filter({ hasText: '正在动手' }).waitFor()
      await shot(page, `${width}-04-working`)
      console.log('waiting-completed', width)
      const completed = await waitSave(page, s => s.world.pods[0].warmLamp)
      assert.equal(completed.world.deep.parts, parts - 1); assert(!completed.world.pods[1].warmLamp)
      assert.deepEqual(completed.world.memories, seed.world.memories); assert.equal(completed.world.pods[0].mark, 'leaf')
      assert.deepEqual(completed.world.deep, { ...seed.world.deep, parts: parts - 1 })
      await sleep(6000)
      await clickCell(page, 13, 11); await page.locator('.room-tools').waitFor()
      await page.locator('.room-tools').getByRole('button', { name: /第1间小窝.*暖光灯已经装好/ }).click()
      await shot(page, `${width}-05-completed`); await attention(page, 'nest-warm-lamp'); assert.equal(await page.locator('.nest-welcome [data-primary-action]').count(), 0)
      await page.getByRole('button', { name: '回去看看', exact: true }).click()
      await page.getByRole('button', { name: '↶ 撤销', exact: true }).click()
      const undone = await waitSave(page, s => !s.world.pods[0].warmLamp)
      assert.equal(undone.world.deep.parts, parts); await clearNestView(page, width); await shot(page, `${width}-06-undone`)
      await clickCell(page, 13, 11); await page.locator('.room-tools').waitFor(); await openLamp()
      await page.getByRole('button', { name: '请阿灯装灯' }).click()
      await waitSave(page, s => s.world.pods[0].warmLamp)
      await page.reload(); await page.getByRole('button', { name: /继续游戏/ }).click()
      await page.locator('.start-screen').waitFor({ state: 'hidden' }); await sleep(700)
      await clickCell(page, 13, 11); await page.locator('.room-tools').waitFor(); await sleep(200)
      await page.locator('.room-tools').getByRole('button', { name: /第1间小窝.*暖光灯已经装好/ }).click()
      await shot(page, `${width}-07-reloaded`)
      const reloaded = await saveIO(page); assert(reloaded.world.pods[0].warmLamp); assert.equal(reloaded.world.deep.parts, parts - 1)
      results.push({ viewport: { width, height: width === 1440 ? 900 : 844 }, webgl, partsBefore: parts, partsAfter: reloaded.world.deep.parts, route: fixtures[1].plan.route, canceledAt: canceled.world.workers.adeng, stages: ['before', 'preview', 'walking-cancel', 'working', 'inventory-during-work', 'completed', 'undo', 'reinstalled', 'reloaded'] })
      await page.getByRole('button', { name: '回去看看', exact: true }).click()
      await clickCell(page, 10, 11); await page.locator('.room-tools').waitFor()
      await page.locator('.room-tools').getByRole('button', { name: /第2间小窝.*给小窝添盏灯/ }).click()
      await page.getByRole('button', { name: '请阿灯装灯' }).click()
      await page.locator('.work-status p').filter({ hasText: '正在动手' }).waitFor()
      assert(await page.locator('.work-status').isVisible(), '物品栏必须在施工期间打开')
      await page.getByRole('button', { name: '打开物品栏', exact: true }).click()
      await page.getByRole('dialog').waitFor(); await sleep(1200)
      await page.getByRole('button', { name: '关闭物品栏', exact: true }).click()
      await page.locator('.work-status').waitFor({ state: 'hidden' })
      const both = await waitSave(page, s => s.world.pods.every(p => p.warmLamp))
      assert.equal(both.world.deep.parts, parts - 2)
      await sleep(6000)
      await clickCell(page, 10, 11); await page.locator('.room-tools').waitFor()
      await page.locator('.room-tools').getByRole('button', { name: /第2间小窝.*暖光灯已经装好/ }).click()
      await shot(page, `${width}-09-two-lamps`)
      results.at(-1).partsAfterBoth = both.world.deep.parts
      results.at(-1).doors = both.world.pods.map(p => ({ id: p.id, door: p.door, warmLamp: p.warmLamp }))
      await context.close()
    }
    // 独立舱入口在实际Vue/Pixi界面验证。
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } }), page = await context.newPage()
    page.on('pageerror', e => errors.push(e.message)); await page.goto(url)
    await saveIO(page, fixtures[0].payload); await page.reload(); await page.getByRole('button', { name: /继续游戏/ }).click()
    await page.locator('.start-screen').waitFor({ state: 'hidden' }); await sleep(600)
    await clickCell(page, 13, 11); await page.locator('.nest-welcome').waitFor()
    await page.getByRole('button', { name: '给小窝添盏灯', exact: true }).click()
    await attention(page, 'nest-warm-lamp'); await shot(page, '1440-08-standalone-preview')
    await page.getByRole('button', { name: '请阿灯装灯' }).click(); await waitSave(page, s => s.world.pods[0].warmLamp)
    results.push({ standalonePod: true, installed: true })
    await context.close()
    assert.deepEqual(errors, [])
    await fs.writeFile(path.join(__dirname, 'browser-results.json'), JSON.stringify({ productionUrl: url, errors, results }, null, 2))
    console.log(JSON.stringify({ errors, results }, null, 2))
  } catch (error) { if (activePage && !activePage.isClosed()) { await shot(activePage, 'failure'); console.error(await activePage.locator('canvas').evaluate(e => ({ ...e.dataset }))) }; throw error } finally { await browser.close() }
}
main().catch(e => { console.error(e); process.exitCode = 1 })
