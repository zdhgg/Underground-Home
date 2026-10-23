const { chromium } = require('C:/Users/ZhuanZ/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')
const fs = require('node:fs/promises'), path = require('node:path'), assert = require('node:assert/strict')
async function main() {
  const browser = await chromium.launch({ headless: true, args: ['--enable-webgl', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
  const errors = [], workers = []
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 960 } })
    page.on('pageerror', e => errors.push(e.message))
    page.on('response', r => { if (r.url().includes('backgroundWorker-')) workers.push(r.status()) })
    await page.addInitScript(() => {
      const Native = window.AudioContext
      window.audioSources = []
      window.AudioContext = class extends Native {
        createBufferSource() {
          const s = super.createBufferSource(), stop = s.stop.bind(s)
          s.stop = when => { if (when === undefined) s.stopped = true; return stop(when) }
          window.audioSources.push(s); return s
        }
      }
    })
    await page.goto(process.env.PRODUCTION_URL || 'http://127.0.0.1:5199/')
    await page.getByRole('button', { name: '开始游戏', exact: true }).click()
    await page.getByRole('button', { name: /跳过开场/ }).click()
    await page.waitForFunction(() => window.audioSources.filter(s => s.loop && s.buffer.duration === 48 && !s.stopped).length === 4)
    await page.getByRole('button', { name: '关闭声音', exact: true }).click()
    assert.equal(await page.evaluate(() => window.audioSources.filter(s => s.loop && s.buffer.duration === 48 && !s.stopped).length), 0)
    await page.reload()
    await page.getByRole('button', { name: '继续游戏', exact: true }).click()
    await page.waitForTimeout(300)
    assert.equal(await page.evaluate(() => window.audioSources.length), 0)
    await page.getByRole('button', { name: '开启声音', exact: true }).click()
    await page.waitForFunction(() => window.audioSources.filter(s => s.loop && s.buffer.duration === 48 && !s.stopped).length === 4)
    assert(workers.length >= 2 && workers.every(status => status === 200))
    assert.deepEqual(errors, [])
    const result = { checks: ['bundled worker loaded with HTTP 200', 'exactly four real 48s loops', 'mute stops loops', 'continue respects saved mute', 'enable starts music', 'no page errors'], workerResponses: workers, errors }
    await fs.writeFile(path.join(__dirname, 'production-results.json'), JSON.stringify(result, null, 2))
    console.log(JSON.stringify(result, null, 2))
  } finally { await browser.close() }
}
main().catch(e => { console.error(e); process.exitCode = 1 })
