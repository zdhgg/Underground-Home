import { describe, expect, it } from 'vitest'
import { Sprite, Texture, TextureSource } from 'pixi.js'
import { CrystalFeedback } from '../src/render/CrystalFeedback'

function createFeedback() {
  const feedback = new CrystalFeedback(new Texture({ source: new TextureSource({ width: 1254, height: 1254 }) }))
  const sprite = feedback.view.children[1] as Sprite
  return { feedback, sprite }
}

describe('能源石瞬时反馈', () => {
  it('收集上浮、缩小并消失，不触发安装完成', () => {
    const { feedback, sprite } = createFeedback()
    feedback.playCollection({ x: 100, y: 200 })
    expect(sprite.height).toBe(48)
    expect(feedback.update(0.2)).toBe(false)
    expect(sprite.y).toBeLessThan(200)
    expect(sprite.height).toBeLessThan(48)
    expect(sprite.alpha).toBeGreaterThan(0)
    expect(feedback.update(1)).toBe(false)
    expect(feedback.view.visible).toBe(false)
  })

  it('安装沿弧线进入槽心，完成信号只发一次', () => {
    const { feedback, sprite } = createFeedback()
    feedback.playInstallation({ x: 300, y: 200 })
    expect(sprite.x).toBe(240)
    expect(sprite.y).toBe(226)
    expect(feedback.update(0.35)).toBe(false)
    expect(sprite.x).toBeGreaterThan(240)
    expect(sprite.x).toBeLessThan(300)
    expect(sprite.y).toBeLessThan(213)
    expect(feedback.update(0.35)).toBe(true)
    expect([sprite.x, sprite.y]).toEqual([300, 200])
    expect(feedback.installing).toBe(false)
    expect(feedback.view.visible).toBe(false)
    expect(feedback.update(1)).toBe(false)
  })

  it('快速安装覆盖收集尾迹，重置取消演出，不留下回调或多份精灵', () => {
    const { feedback } = createFeedback()
    const children = [...feedback.view.children]
    feedback.playCollection({ x: 100, y: 200 })
    feedback.update(0.1)
    feedback.playInstallation({ x: 300, y: 200 })
    expect(feedback.installing).toBe(true)
    expect(feedback.view.children).toEqual(children)
    feedback.reset()
    expect(feedback.update(2)).toBe(false)
    expect(feedback.view.visible).toBe(false)
  })
})
