// 独立 Playwright 浏览器上下文；只写临时浏览器的 IndexedDB，不接触玩家档案。
const { chromium } = require('C:/Users/ZhuanZ/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')
const fs = require('node:fs/promises')
const path = require('node:path')
const assert = require('node:assert/strict')

const url = process.env.WISH_TEST_URL || 'http://localhost:5198/'
const fixtureUrl = process.env.WISH_FIXTURE_URL || 'http://localhost:5197/'
const out = __dirname
const TILE = 32
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))

async function saveIO(page, value) {
  return page.evaluate(value => new Promise((resolve, reject) => {
    const req = indexedDB.open('underground-home-spring-playtest-v1', 1)
    req.onupgradeneeded = () => req.result.createObjectStore('saves')
    req.onerror = () => reject(req.error)
    req.onsuccess = () => {
      const db = req.result, tx = db.transaction('saves', value ? 'readwrite' : 'readonly'), store = tx.objectStore('saves')
      const op = value ? store.put(value, 'underground-home-save') : store.get('underground-home-save')
      tx.oncomplete = () => { db.close(); resolve(value || op.result) }
      tx.onerror = () => reject(tx.error)
    }
  }), value)
}

async function waitSave(page, predicate, tries = 200) {
  for (let i = 0; i < tries; i++) {
    const save = await saveIO(page)
    if (save && predicate(save)) return save
    await sleep(100)
  }
  throw new Error('自动保存未达到预期状态')
}

async function openGame(browser, width, height, payload, errors) {
  const context = await browser.newContext({ viewport: { width, height } })
  const page = await context.newPage()
  page.on('pageerror', error => errors.push(`${width}: ${error.message}`))
  await page.goto(url)
  await saveIO(page, payload)
  await page.reload()
  await page.getByRole('button', { name: /继续游戏/ }).click()
  await page.locator('.start-screen').waitFor({ state: 'hidden' })
  await page.locator('canvas').waitFor()
  await sleep(500)
  const webgl = await page.locator('canvas').evaluate(element => {
    const gl = element.getContext('webgl2') || element.getContext('webgl')
    return gl ? { version: gl.getParameter(gl.VERSION), renderer: gl.getParameter(gl.RENDERER) } : null
  })
  assert(webgl, '必须是真实 WebGL 画布')
  return { context, page, webgl }
}

async function openNotebook(page) {
  const sheet = page.locator('.notebook-sheet')
  if (!(await sheet.isVisible())) {
    await page.locator('.notebook-tab').click()
    await sheet.waitFor({ state: 'visible' })
  }
}

async function camera(page) {
  const box = await page.locator('canvas').boundingBox()
  const value = await page.locator('canvas').evaluate(element => ({
    x: +element.dataset.cameraX, y: +element.dataset.cameraY, z: +element.dataset.zoom,
    width: element.clientWidth, height: element.clientHeight,
  }))
  return { ...value, box }
}

async function clickCell(page, x, y) {
  const c = await camera(page)
  await page.mouse.click(c.box.x + ((x + .5) * TILE - c.x) * c.z, c.box.y + ((y + .5) * TILE - c.y) * c.z)
}

/** 目标在画布真实可见；小本子已经收起，不存在左侧遮挡。 */
async function assertFocusTarget(page, worldX, worldY) {
  const c = await camera(page)
  const screenX = (worldX - c.x) * c.z
  const screenY = (worldY - c.y) * c.z
  assert(screenX > 24 && screenX < c.width - 24, `目标横向不可见：${screenX.toFixed(1)} / ${c.width}`)
  assert(screenY > 24 && screenY < c.height - 24, `目标纵向不可见：${screenY.toFixed(1)} / ${c.height}`)
  assert.equal(await page.locator('.notebook-sheet').isVisible(), false, '心愿点击后小本子应收起')
  return { screenX: Math.round(screenX), screenY: Math.round(screenY), canvas: { width: c.width, height: c.height } }
}

function assertStateUnchanged(before, after) {
  assert.deepEqual(after.world.deep, before.world.deep, '点击心愿不能改变第三层资源')
  assert.deepEqual(after.world.pods, before.world.pods, '点击心愿不能安装灯具或改小窝')
  assert.deepEqual(after.world.farm, before.world.farm, '点击心愿不能收菜或改作物')
}

async function shot(page, name) {
  await page.screenshot({ path: path.join(out, `${name}.jpg`), type: 'jpeg', quality: 85 })
}

async function runViewport(browser, fixtures, width, height, results, errors, extras) {
  const record = { viewport: { width, height } }
  results.push(record)

  // 场景 A：游戏初期没有符合条件的家园心愿，栏目完全隐藏。
  {
    const { context, page, webgl } = await openGame(browser, width, height, fixtures.early, errors)
    record.webgl = webgl
    await openNotebook(page)
    assert.equal(await page.locator('.notebook-mission').count(), 1)
    assert.equal(await page.locator('.notebook-wishes').count(), 0)
    await shot(page, `${width}-A-early`)
    record.scenarioA = { wishCount: 0, missionVisible: true }
    await context.close()
  }

  // 场景 B：第三层完成 + 第一层有未装灯小窝；点击只定位，不扣料不施工。
  {
    const { context, page } = await openGame(browser, width, height, fixtures.lamp, errors)
    const before = await saveIO(page)
    await openNotebook(page)
    assert.equal(await page.locator('.wish-item').count(), 1)
    assert(await page.getByText('给小窝添盏暖光灯').isVisible())
    assert.equal(await page.locator('.wish-action[data-primary-action]').count(), 0)
    await shot(page, `${width}-B-wishes`)
    await page.getByRole('button', { name: '去看看小窝', exact: true }).click()
    await sleep(350)
    const focus = await assertFocusTarget(page, (12 + 1.5) * TILE, (10 + 1) * TILE)
    const after = await saveIO(page)
    assertStateUnchanged(before, after)
    await shot(page, `${width}-B-focus`)
    record.scenarioB = { wishCount: 1, focus, parts: after.world.deep.parts, warmLamp: !!after.world.pods[0].warmLamp }
    await context.close()
  }

  // 场景 D：成熟菜槽按真实坐标定位，不自动收获。
  {
    const { context, page } = await openGame(browser, width, height, fixtures.ripe, errors)
    const before = await saveIO(page)
    await openNotebook(page)
    assert.equal(await page.locator('.wish-item').count(), 1)
    assert(await page.getByText('菜长熟啦！').isVisible())
    await shot(page, `${width}-D-wishes`)
    await page.getByRole('button', { name: '去看看菜园', exact: true }).click()
    await sleep(350)
    const focus = await assertFocusTarget(page, (28 + .5) * TILE, (21 + .2) * TILE)
    const after = await saveIO(page)
    assertStateUnchanged(before, after)
    await shot(page, `${width}-D-ripe-focus`)
    record.scenarioD = { wishCount: 1, focus, growth: after.world.farm.planters[0].growth, food: after.world.farm.food }
    await context.close()
  }

  // 场景 F：两条心愿同时存在，面板高度受控、无横向溢出、楼层导航可达。
  {
    const { context, page } = await openGame(browser, width, height, fixtures.both, errors)
    await openNotebook(page)
    assert.equal(await page.locator('.wish-item').count(), 2)
    const metrics = await page.evaluate(() => {
      const stage = document.querySelector('.stage').getBoundingClientRect()
      const sheet = document.querySelector('.notebook-sheet').getBoundingClientRect()
      const body = document.querySelector('.notebook-body')
      return {
        stageHeight: stage.height, sheetHeight: sheet.height,
        bodyScrollHeight: body.scrollHeight, bodyClientHeight: body.clientHeight,
        horizontalOverflow: document.documentElement.scrollWidth > window.innerWidth,
      }
    })
    assert(metrics.sheetHeight <= metrics.stageHeight + 1, '小本子不能高过舞台')
    assert(!metrics.horizontalOverflow, '页面不能横向溢出')
    await shot(page, `${width}-F-two-wishes`)
    const overview = page.locator('.depth-nav .overview')
    await overview.scrollIntoViewIfNeeded()
    assert(await overview.isVisible(), '两条心愿下楼层导航仍可达')
    record.scenarioF = { wishCount: 2, ...metrics, overviewReachable: true }
    await context.close()
  }

  if (!extras) return

  // 场景 C：部件不足时仍显示心愿和明确缺料提示；点击不产生非法安装。
  {
    const { context, page } = await openGame(browser, width, height, fixtures.noParts, errors)
    const before = await saveIO(page)
    await openNotebook(page)
    assert.equal(await page.locator('.wish-item').count(), 1)
    const note = await page.locator('.wish-note').textContent()
    assert(note && note.includes('还差1个工坊部件'))
    assert(!note.includes('充足'))
    await shot(page, `${width}-C-wishes`)
    await page.getByRole('button', { name: '去看看小窝', exact: true }).click()
    await sleep(350)
    const focus = await assertFocusTarget(page, (12 + 1.5) * TILE, (10 + 1) * TILE)
    const after = await saveIO(page)
    assertStateUnchanged(before, after)
    assert.equal(after.world.pods[0].warmLamp, undefined)
    await shot(page, `${width}-C-no-parts`)
    record.scenarioC = { note, focus, parts: after.world.deep.parts, installed: !!after.world.pods[0].warmLamp }
    await context.close()
  }

  // 场景 G + E：伙伴真实收菜期间心愿让位；收获后心愿消失。
  {
    const { context, page } = await openGame(browser, width, height, fixtures.ripe, errors)
    const before = await saveIO(page)
    await openNotebook(page)
    await page.getByRole('button', { name: '去看看菜园', exact: true }).click()
    await sleep(350)
    await clickCell(page, 28, 21)
    await page.locator('.work-status').waitFor()
    await openNotebook(page)
    assert.equal(await page.locator('.notebook-wishes').count(), 0, '伙伴工作时心愿让位')
    assert.equal(await page.locator('.notebook-mission').count(), 0, '伙伴工作时主线让位')
    assert.equal(await page.locator('.stage [data-primary-action]').count(), 0, '不能出现第二个主要操作')
    assert(await page.locator('.work-status').isVisible())
    await shot(page, `${width}-G-work`)
    const after = await waitSave(page, save => save.world.farm.planters[0].growth === 0 && save.world.farm.food > before.world.farm.food)
    await page.locator('.work-status').waitFor({ state: 'hidden' })
    await sleep(300)
    await openNotebook(page)
    assert.equal(await page.locator('.notebook-wishes').count(), 0, '收完最后一槽成熟菜后心愿消失')
    assert.equal(await page.locator('.notebook-floors').count(), 1)
    await shot(page, `${width}-E-after-harvest`)
    record.scenarioE = { foodBefore: before.world.farm.food, foodAfter: after.world.farm.food, growth: after.world.farm.planters[0].growth }
    record.scenarioG = { workContinued: true, wishHiddenDuringWork: true, primaryActions: 0 }
    await context.close()
  }
}

async function runChapterHandoff(browser, fixtures, results, errors) {
  const { context, page } = await openGame(browser, 1440, 900, fixtures.lamp, errors)
  await openNotebook(page)
  await page.locator('.depth-nav .crystal').click()
  await page.locator('.deep-panel').waitFor()
  assert.equal(await page.locator('.notebook-sheet').isVisible(), false)
  await openNotebook(page)
  assert.equal(await page.locator('.notebook-wishes').count(), 0)
  assert.equal(await page.locator('.notebook-mission').count(), 0)
  assert.equal(await page.locator('.notebook-quiet').count(), 1)
  assert.equal(await page.locator('.stage [data-primary-action]').count(), 1)
  await shot(page, '1440-G-chapter')
  results.at(-1).scenarioGChapter = { wishHidden: true, primaryActions: 1, deepPanelOpen: true }
  await context.close()
}

async function main() {
  const browser = await chromium.launch({
    headless: true,
    args: ['--enable-webgl', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
  })
  const errors = [], results = []
  let activePage
  try {
    const setup = await browser.newPage()
    await setup.goto(fixtureUrl)
    const fixtures = await setup.evaluate(async () => {
      const { earlyHomeWorld, lampWishWorld, ripeWishWorld, bothWishesWorld } = await import('/tests/fixtures/homeWishesWorld.ts')
      const { serialize, deserialize } = await import('/src/core/persistence.ts')
      const build = world => {
        const payload = serialize(world)
        const loaded = deserialize(payload)
        if (!loaded.ok) throw new Error(loaded.error)
        return payload
      }
      return {
        early: build(earlyHomeWorld()),
        lamp: build(lampWishWorld(1)),
        noParts: build(lampWishWorld(0)),
        ripe: build(ripeWishWorld()),
        both: build(bothWishesWorld()),
      }
    })
    await setup.close()

    const viewports = [[1440, 900], [1280, 720], [390, 844], [360, 800]]
    for (const [width, height] of viewports) {
      const extras = width === 1440 || width === 390
      const before = results.length
      await runViewport(browser, fixtures, width, height, results, errors, extras)
      assert.equal(results.length, before + 1)
    }
    await runChapterHandoff(browser, fixtures, results, errors)
    assert.deepEqual(errors, [])
    const report = { productionUrl: url, viewports, errors, results }
    await fs.writeFile(path.join(out, 'browser-results.json'), JSON.stringify(report, null, 2))
    console.log(JSON.stringify(report, null, 2))
  } catch (error) {
    if (activePage && !activePage.isClosed()) {
      await shot(activePage, 'failure')
      console.error(await activePage.locator('canvas').evaluate(element => ({ ...element.dataset })).catch(() => ({})))
    }
    throw error
  } finally {
    await browser.close()
  }
}

main().catch(error => { console.error(error); process.exitCode = 1 })
