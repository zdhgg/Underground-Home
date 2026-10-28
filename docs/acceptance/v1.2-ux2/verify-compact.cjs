// 本轮窄屏紧凑布局验收：生产构建 + 真实 Pixi/WebGL，只写临时浏览器 IndexedDB。
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
  await sleep(450)
  return { context, page }
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

async function assertFocus(page, worldX, worldY) {
  const c = await camera(page)
  const x = (worldX - c.x) * c.z, y = (worldY - c.y) * c.z
  assert(x > 24 && x < c.width - 24, `目标横向不可见：${x}`)
  assert(y > 24 && y < c.height - 24, `目标纵向不可见：${y}`)
  assert.equal(await page.locator('.notebook-sheet').isVisible(), false)
  return { x: Math.round(x), y: Math.round(y) }
}

function assertUnchanged(before, after) {
  assert.deepEqual(after.world.deep, before.world.deep)
  assert.deepEqual(after.world.pods, before.world.pods)
  assert.deepEqual(after.world.farm, before.world.farm)
}

async function shot(page, name) {
  await page.screenshot({ path: path.join(out, `${name}.jpg`), type: 'jpeg', quality: 85 })
}

async function measure(page) {
  return page.evaluate(() => {
    const rect = element => {
      const r = element.getBoundingClientRect()
      return { x: r.x, y: r.y, width: r.width, height: r.height, top: r.top, right: r.right, bottom: r.bottom, left: r.left }
    }
    const body = document.querySelector('.notebook-body')
    const bodyRect = body.getBoundingClientRect()
    const section = document.querySelector('.notebook-wishes')
    const heading = document.querySelector('#explorer-floors-heading')
    const firstFloor = document.querySelector('.depth-nav .floors > button')
    const buttons = [...document.querySelectorAll('.wish-action')]
    const items = [...document.querySelectorAll('.wish-item')]
    const buttonRects = buttons.map(rect)
    const overlap = (a, b) => !(a.right <= b.left || b.right <= a.left || a.bottom <= b.top || b.bottom <= a.top)
    let buttonsOverlap = false
    for (let i = 0; i < buttonRects.length; i++) for (let j = i + 1; j < buttonRects.length; j++) buttonsOverlap ||= overlap(buttonRects[i], buttonRects[j])
    const itemOverlaps = items.map(item => {
      const title = item.querySelector('.wish-title').getBoundingClientRect()
      const button = item.querySelector('.wish-action').getBoundingClientRect()
      return overlap(title, button)
    })
    const visible = element => {
      if (!element) return false
      const r = element.getBoundingClientRect()
      return r.bottom > bodyRect.top && r.top < bodyRect.bottom
    }
    const fullyVisible = element => {
      if (!element) return false
      const r = element.getBoundingClientRect()
      return r.top >= bodyRect.top - .5 && r.bottom <= bodyRect.bottom + .5
    }
    const detail = document.querySelector('.wish-detail')
    const shortTitle = document.querySelector('.wish-title-short')
    const fullTitle = document.querySelector('.wish-title-full')
    const shortAction = document.querySelector('.wish-action-short')
    const fullAction = document.querySelector('.wish-action-full')
    const note = document.querySelector('.wish-note')
    const shown = element => !!element && getComputedStyle(element).display !== 'none' && element.getBoundingClientRect().height > 0
    return {
      sheet: rect(document.querySelector('.notebook-sheet')),
      body: rect(body), bodyScrollHeight: body.scrollHeight, bodyClientHeight: body.clientHeight,
      wishes: section ? rect(section) : null,
      wishCount: buttons.length,
      buttons: buttonRects,
      buttonsOverlap,
      titleButtonOverlap: itemOverlaps,
      buttonTextClipped: buttons.map(button => button.scrollWidth > button.clientWidth + 1),
      floorsHeading: heading ? rect(heading) : null,
      floorsHeadingVisible: visible(heading), floorsHeadingFullyVisible: fullyVisible(heading),
      firstFloor: firstFloor ? rect(firstFloor) : null,
      firstFloorVisible: visible(firstFloor), firstFloorFullyVisible: fullyVisible(firstFloor),
      topHeight: document.querySelector('.top')?.getBoundingClientRect().height,
      horizontalOverflow: document.documentElement.scrollWidth > window.innerWidth,
      detailShown: shown(detail), shortTitleShown: shown(shortTitle), fullTitleShown: shown(fullTitle),
      shortActionShown: shown(shortAction), fullActionShown: shown(fullAction),
      noteShown: shown(note), noteText: note?.textContent?.trim() ?? null,
      visibleActions: buttons.map(button => button.getAttribute('aria-label')),
    }
  })
}

async function main() {
  const browser = await chromium.launch({
    headless: true,
    args: ['--enable-webgl', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
  })
  const errors = [], after = [], functional = {}
  let activePage
  try {
    const setup = await browser.newPage()
    await setup.goto(fixtureUrl)
    const fixtures = await setup.evaluate(async () => {
      const { earlyHomeWorld, lampWishWorld, bothWishesWorld } = await import('/tests/fixtures/homeWishesWorld.ts')
      const { serialize, deserialize } = await import('/src/core/persistence.ts')
      const build = world => {
        const payload = serialize(world)
        const loaded = deserialize(payload)
        if (!loaded.ok) throw new Error(loaded.error)
        return payload
      }
      return { early: build(earlyHomeWorld()), noParts: build(lampWishWorld(0)), both: build(bothWishesWorld()) }
    })
    await setup.close()

    for (const [width, height] of [[1440, 900], [1280, 720], [390, 844], [360, 800]]) {
      const { context, page } = await openGame(browser, width, height, fixtures.both, errors)
      activePage = page
      await openNotebook(page)
      const metrics = await measure(page)
      assert.equal(metrics.wishCount, 2)
      assert.equal(metrics.buttonsOverlap, false, '心愿按钮不能重叠')
      assert.deepEqual(metrics.titleButtonOverlap, [false, false], '标题与按钮不能重叠')
      assert.deepEqual(metrics.buttonTextClipped, [false, false], '按钮文字不能被截断')
      assert.equal(metrics.horizontalOverflow, false)
      if (width > 720) {
        assert.equal(metrics.detailShown, true, '桌面端仍显示完整说明')
        assert.equal(metrics.fullTitleShown, true)
        assert.equal(metrics.fullActionShown, true)
        assert.equal(metrics.shortTitleShown, false)
        assert.equal(metrics.shortActionShown, false)
      } else {
        assert.equal(metrics.detailShown, false, '窄屏收起普通说明')
        assert.equal(metrics.shortTitleShown, true)
        assert.equal(metrics.fullTitleShown, false)
        assert.equal(metrics.shortActionShown, true)
        assert.equal(metrics.fullActionShown, false)
        assert.equal(metrics.floorsHeadingVisible, true, '窄屏“去哪里？”标题应可见')
        assert.equal(metrics.firstFloorVisible, true, '窄屏第一条楼层入口应可见')
      }
      for (const button of metrics.buttons) assert(button.height >= 44, `按钮高度不足 44px：${button.height}`)
      await shot(page, `${width}-F-two-wishes-compact-fixed`)
      after.push({ viewport: { width, height }, ...metrics })
      await context.close()
      activePage = undefined
    }

    {
      const { context, page } = await openGame(browser, 390, 844, fixtures.noParts, errors)
      activePage = page
      await openNotebook(page)
      const metrics = await measure(page)
      assert.equal(metrics.wishCount, 1)
      assert.equal(metrics.detailShown, false)
      assert.equal(metrics.noteShown, true, '缺料提示不能隐藏')
      assert(metrics.noteText.includes('还差1个工坊部件'))
      assert(metrics.buttons[0].height >= 44)
      assert.equal(metrics.horizontalOverflow, false)
      await shot(page, '390-C-no-parts-compact-fixed')
      after.push({ viewport: { width: 390, height: 844 }, scenario: 'no-parts', ...metrics })
      await context.close()
      activePage = undefined
    }

    {
      const { context, page } = await openGame(browser, 390, 844, fixtures.early, errors)
      activePage = page
      await openNotebook(page)
      assert.equal(await page.locator('.notebook-wishes').count(), 0)
      assert.equal(await page.locator('.notebook-mission').count(), 1)
      await shot(page, '390-A-no-wishes-compact-fixed')
      await context.close()
      activePage = undefined
    }

    {
      const { context, page } = await openGame(browser, 390, 844, fixtures.both, errors)
      activePage = page
      const before = await saveIO(page)
      await openNotebook(page)
      await page.getByRole('button', { name: '去看看小窝', exact: true }).click()
      await sleep(300)
      functional.lampFocus = await assertFocus(page, (12 + 1.5) * TILE, (10 + 1) * TILE)
      const afterLamp = await saveIO(page)
      assertUnchanged(before, afterLamp)
      await shot(page, '390-B-focus-compact-fixed')
      await context.close()
      activePage = undefined

      const ripe = await openGame(browser, 390, 844, fixtures.both, errors)
      activePage = ripe.page
      const beforeRipe = await saveIO(ripe.page)
      await openNotebook(ripe.page)
      await ripe.page.getByRole('button', { name: '去看看菜园', exact: true }).click()
      await sleep(300)
      functional.ripeFocus = await assertFocus(ripe.page, (28 + .5) * TILE, (21 + .2) * TILE)
      const afterRipe = await saveIO(ripe.page)
      assertUnchanged(beforeRipe, afterRipe)
      await shot(ripe.page, '390-D-ripe-focus-compact-fixed')
      await ripe.context.close()
      activePage = undefined
    }

    assert.deepEqual(errors, [])
    const before = JSON.parse(await fs.readFile(path.join(out, 'compact-fixed-before.json'), 'utf8'))
    const report = {
      productionUrl: url,
      note: 'before 为 d58e621 基线；after 为本轮窄屏紧凑修订。均来自真实生产构建。',
      before,
      after,
      functional,
      errors,
    }
    await fs.writeFile(path.join(out, 'compact-fixed-results.json'), JSON.stringify(report, null, 2))
    console.log(JSON.stringify(report, null, 2))
  } catch (error) {
    if (activePage && !activePage.isClosed()) {
      await shot(activePage, 'compact-failure')
      console.error(await activePage.locator('canvas').evaluate(element => ({ ...element.dataset })).catch(() => ({})))
    }
    throw error
  } finally {
    await browser.close()
  }
}

main().catch(error => { console.error(error); process.exitCode = 1 })
