// 独立浏览器上下文，不接触玩家存档。真实节点与离线渲染验证。
const { chromium } = require('C:/Users/ZhuanZ/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')
const fs = require('node:fs/promises'), path = require('node:path'), assert = require('node:assert/strict')
const url = process.env.AUDIO_TEST_URL || 'http://127.0.0.1:5198/'
const checks = [], errors = []
async function shot(page, name) { await page.screenshot({ path: path.join(__dirname, name) }) }
async function seed(page, mode) {
  const blank = route => route.fulfill({ body: '', contentType: 'application/javascript' })
  await page.route('**/src/main.ts', blank); await page.goto(url)
  await page.evaluate(async mode => {
    const { createInitialWorld, TILE, LANDMARKS } = await import('/src/core/world.ts')
    const { serialize, deserialize } = await import('/src/core/persistence.ts')
    const { initializeWorkers } = await import('/src/core/partnerWork.ts')
    const { initialAtuPosition } = await import('/src/core/atu.ts')
    const w = createInitialWorld()
    w.progress = { crystalFound: true, crystalCollected: true, coreRepaired: mode !== 'intro' }
    w.tiles[LANDMARKS.crystal.y][LANDMARKS.crystal.x] = TILE.EMPTY
    w.exploration.explorer = initialAtuPosition(w)
    if (mode === 'water' || mode === 'unknown-water') {
      const { dig } = await import('/src/core/dig.ts')
      const { placePod } = await import('/src/core/build.ts')
      const { inspectCrack, upgradePickaxe } = await import('/src/core/exploration.ts')
      for (let y = 10; y <= 11; y++) for (let x = 12; x <= 14; x++) dig(w, x, y)
      placePod(w, 12, 10)
      for (const x of [26, 27]) { dig(w, x, 11); dig(w, x, 10) }
      inspectCrack(w, 27, 12); upgradePickaxe(w)
      for (let y = 12; y < 19; y++) if (w.tiles[y][27] !== TILE.EMPTY) dig(w, 27, y)
      w.exploration.entered = true
      for (let x = 23; x >= 18; x--) { dig(w, x, 21); dig(w, x, 20) }
      w.exploration.explorer = { x: LANDMARKS.spring.x, y: 21 }
      w.exploration.springFound = mode === 'water'
    }
    initializeWorkers(w)
    const payload = serialize(w), checked = deserialize(payload)
    if (!checked.ok) throw new Error(checked.error)
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
  await page.unroute('**/src/main.ts', blank); await page.reload()
  await page.getByRole('button', { name: '继续游戏', exact: true }).click()
}
async function tapTile(page, x, y) {
  const point = await page.locator('canvas').evaluate((c, p) => {
    const r = c.getBoundingClientRect(), z = +c.dataset.zoom
    return { x: r.left + ((p.x + .5) * 32 - +c.dataset.cameraX) * z, y: r.top + ((p.y + .5) * 32 - +c.dataset.cameraY) * z }
  }, { x, y })
  await page.mouse.click(point.x, point.y)
}
async function snapshot(page) {
  // 只读诊断：游戏驱动均通过真实界面，不用内部字段修改世界。
  return page.evaluate(async () => {
    const { gameAudio: a } = await import('/src/render/gameAudio.ts')
    return { scene: a.scene, playing: a.playing, ready: !!a.ready, loops: a.background?.loops.map(l => ({ layer: l.layer, target: l.target, value: l.gain.gain.value, duration: l.source.buffer.duration })) ?? [], buffers: a.background?.buffers.size ?? 0 }
  })
}
async function waitScene(page, predicate) {
  for (let i = 0; i < 120; i++) {
    const s = await snapshot(page)
    if (predicate(s)) return s
    await page.waitForTimeout(50)
  }
  throw new Error(`Unexpected soundscape: ${JSON.stringify(await snapshot(page))}`)
}
function target(s, layer) { return s.loops.find(l => l.layer === layer)?.target ?? 0 }
async function renderPreview(page, name, scene) {
  const result = await page.evaluate(async scene => {
    const { BackgroundSound } = await import('/src/render/backgroundSound.ts')
    const { synthesizeScore, SCORE_LAYERS } = await import('/src/render/backgroundScore.ts')
    const ctx = new OfflineAudioContext(1, 22050 * 50, 22050)
    const output = ctx.createGain(); output.gain.value = .7; output.connect(ctx.destination)
    const score = new BackgroundSound(ctx, output, ready => { ready(Object.fromEntries(SCORE_LAYERS.map(layer => [layer, synthesizeScore(layer)]))); return () => {} })
    const start = performance.now(); score.update(scene, false)
    const offlineSynthMs = performance.now() - start
    const pcm = (await ctx.startRendering()).getChannelData(0)
    let peak = 0, energy = 0
    const bytes = new Uint8Array(pcm.length * 2), view = new DataView(bytes.buffer)
    for (let i = 0; i < pcm.length; i++) {
      peak = Math.max(peak, Math.abs(pcm[i])); energy += pcm[i] * pcm[i]
      view.setInt16(i * 2, Math.round(Math.max(-1, Math.min(1, pcm[i])) * 32767), true)
    }
    const loopAt = Math.round(48.025 * 22050)
    const seam = Math.abs(pcm[loopAt] - pcm[loopAt - 1])
    let binary = ''
    for (let i = 0; i < bytes.length; i += 16384) binary += String.fromCharCode(...bytes.subarray(i, i + 16384))
    return { base64: btoa(binary), peak, rms: Math.sqrt(energy / pcm.length), seam, offlineSynthMs }
  }, scene)
  const pcm = Buffer.from(result.base64, 'base64'), header = Buffer.alloc(44)
  header.write('RIFF', 0); header.writeUInt32LE(pcm.length + 36, 4); header.write('WAVEfmt ', 8)
  header.writeUInt32LE(16, 16); header.writeUInt16LE(1, 20); header.writeUInt16LE(1, 22)
  header.writeUInt32LE(22050, 24); header.writeUInt32LE(44100, 28); header.writeUInt16LE(2, 32); header.writeUInt16LE(16, 34)
  header.write('data', 36); header.writeUInt32LE(pcm.length, 40)
  await fs.writeFile(path.join(__dirname, name), Buffer.concat([header, pcm]))
  delete result.base64
  assert(result.peak > .001 && result.peak < .2)
  assert(result.seam < .001)
  return { file: name, ...result }
}
async function main() {
  const browser = await chromium.launch({ headless: true, args: ['--enable-webgl', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
  try {
    for (const viewport of [{ width: 1440, height: 960 }, { width: 390, height: 844 }]) {
      const context = await browser.newContext({ viewport }), page = await context.newPage()
      page.on('pageerror', e => errors.push(e.message))
      await page.goto(url)
      await page.getByRole('button', { name: '开始游戏', exact: true }).waitFor()
      assert.equal((await snapshot(page)).loops.length, 0)
      await page.getByRole('button', { name: '开始游戏', exact: true }).click()
      assert.equal((await snapshot(page)).loops.length, 0)
      await page.evaluate(async () => {
        const { gameAudio } = await import('/src/render/gameAudio.ts')
        const original = gameAudio.setPlaying.bind(gameAudio)
        gameAudio.setPlaying = playing => {
          const start = performance.now(); original(playing)
          if (playing) window.musicStartMs = performance.now() - start
        }
      })
      await page.getByRole('button', { name: /跳过开场/ }).click()
      let s = await waitScene(page, s => s.loops.length === 4)
      const startMs = await page.evaluate(() => window.musicStartMs)
      assert(startMs < 200, `music setup blocked UI for ${startMs}ms`)
      assert(target(s, 'quiet') > 0); assert.equal(target(s, 'home'), 0)
      await page.getByRole('button', { name: '关闭声音', exact: true }).click()
      assert.equal((await snapshot(page)).loops.length, 0)
      await page.getByRole('button', { name: '开启声音', exact: true }).click()
      assert.equal((await snapshot(page)).loops.length, 4)
      checks.push(`${viewport.width}: no title/opening music; worker setup ${startMs.toFixed(1)}ms; quiet theme after skip; unified mute stops all four loops`)
      await seed(page, 'intro')
      assert.equal(target(await snapshot(page), 'home'), 0)
      await tapTile(page, 21, 9)
      s = await snapshot(page)
      assert.equal(s.scene.powered, false, 'installation must finish before warm music')
      await page.locator('.conversation').waitFor()
      s = await waitScene(page, s => s.scene.powered && s.scene.focused)
      assert.equal(target(s, 'quiet'), 0); assert(target(s, 'home') > 0 && target(s, 'home') < .1)
      assert.equal(await page.locator('[data-attention-panel]').count(), 1)
      assert.equal(await page.locator('[data-primary-action]').count(), 1)
      await shot(page, `${viewport.width}-conversation.png`)
      await page.getByRole('button', { name: '等会儿，先去探索', exact: true }).click()
      s = await waitScene(page, s => target(s, 'home') === .21)
      assert.equal(s.loops.length, 4); assert.equal(s.buffers, 4)
      checks.push(`${viewport.width}: installation -> warm theme; dialogue ducks music; exit restores without replay or new panels`)
      if (viewport.width === 1440) {
        await seed(page, 'unknown-water')
        await page.locator('.depth-nav button').nth(1).click()
        await page.waitForTimeout(700)
        assert.equal(target(await snapshot(page), 'water'), 0)
        await seed(page, 'water')
        await page.locator('.depth-nav button').nth(1).click()
        s = await waitScene(page, s => target(s, 'water') > 0)
        await shot(page, '1440-spring.png')
        await page.locator('.depth-nav button').nth(2).click()
        await waitScene(page, s => target(s, 'water') === 0)
        await page.locator('.depth-nav button').nth(1).click()
        await waitScene(page, s => target(s, 'water') > 0)
        await page.evaluate(() => { Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true }); document.dispatchEvent(new Event('visibilitychange')) })
        assert.equal((await snapshot(page)).loops.length, 0)
        await page.evaluate(() => { Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true }); document.dispatchEvent(new Event('visibilitychange')) })
        await waitScene(page, s => s.loops.length === 4)
        assert.equal((await snapshot(page)).buffers, 4)
        checks.push('known spring only: water ambience on current floor, off in overview; hidden stops, visible resumes four cached loops')
        const previews = []
        previews.push(await renderPreview(page, 'home-theme.wav', { powered: true, water: false, focused: false }))
        previews.push(await renderPreview(page, 'spring-theme.wav', { powered: true, water: true, focused: false }))
        previews.push(await renderPreview(page, 'quiet-theme.wav', { powered: false, water: false, focused: false }))
        await fs.writeFile(path.join(__dirname, 'waveforms.json'), JSON.stringify(previews, null, 2))
        checks.push('three real offline audio renders: 50 seconds including loop seam, non-silent and unclipped')
      }
      await page.getByRole('button', { name: '关闭声音', exact: true }).click()
      await page.reload()
      await page.getByRole('button', { name: '继续游戏', exact: true }).click()
      await page.waitForTimeout(400)
      assert.equal((await snapshot(page)).loops.length, 0)
      await page.getByRole('button', { name: '开启声音', exact: true }).click()
      await waitScene(page, s => s.loops.length === 4)
      checks.push(`${viewport.width}: saved mute on continue; enable starts exactly four loops`)
      await context.close()
    }
    assert.deepEqual(errors, [])
    await fs.writeFile(path.join(__dirname, 'results.json'), JSON.stringify({ checks, errors }, null, 2))
    console.log(JSON.stringify({ checks, errors }, null, 2))
  } finally { await browser.close() }
}
main().catch(e => { console.error(e); process.exitCode = 1 })
