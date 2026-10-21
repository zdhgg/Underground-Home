import { describe, expect, it, vi } from 'vitest'
import { Sprite, Texture, TextureSource } from 'pixi.js'
import { createInitialWorld, TILE_SIZE as T } from '../src/core/world'
import { ExplorationScene } from '../src/render/explorationScene'
import type { SoilPlan } from '../src/core/atu'
import type { MoleTextures } from '../src/render/moleVisual'

const texture = (width: number, height: number) => new Texture({ source: new TextureSource({ width, height }) })
const textures = (): MoleTextures => ({
  idle: texture(409, 512), blink: texture(409, 512), rest: texture(360, 271),
  digSide: texture(512, 640), digUp: texture(512, 640),
})

describe('阿土整帧双爪施工', () => {
  it.each([
    { dx: -1, dy: 0, lift: 0, overhead: undefined },
    { dx: 1, dy: 0, lift: 0, overhead: undefined },
    { dx: -1, dy: -1, lift: 0, overhead: undefined },
    { dx: 1, dy: -2, lift: 1, overhead: undefined },
    { dx: 0, dy: -2, lift: 1, overhead: true },
  ] as const)('朝向/高度 $dx,$dy：原双手换成施工帧、落爪才结算，结束落地', ({ dx, dy, lift, overhead }) => {
    const art = textures(), scene = new ExplorationScene(art)
    const world = createInitialWorld()
    world.exploration.explorer = { x: 18, y: 11 }
    scene.refresh(world)
    const sprite = scene.view.getChildByLabel('atu-sprite', true) as Sprite
    const plan: SoilPlan = { stand: { x: 18, y: 11 }, target: { x: 18 + dx, y: 11 + dy }, route: [], lift, overhead }
    const strike = vi.fn(), done = vi.fn(), ground = 12 * T - 2
    scene.soil(plan, strike, done)
    scene.update(lift ? .39 : .05)
    expect(sprite.texture).toBe(art.idle)
    expect(strike).not.toHaveBeenCalled()
    scene.update(.2)
    expect(sprite.texture).toBe(dy < 0 ? art.digUp : art.digSide)
    expect(strike).toHaveBeenCalledTimes(1)
    expect(done).not.toHaveBeenCalled()
    expect(sprite.parent!.scale.x).toBe(dx < 0 ? -1 : 1)
    // 施工图的630px脚底与身体旋转支点重合，没有因换图而悬空或移位。
    const foot = sprite.toGlobal({ x: 0, y: 0 })
    expect(foot.x).toBeCloseTo(18.5 * T)
    expect(foot.y).toBeCloseTo(ground - (lift ? overhead ? 12 : T : 0))
    scene.update(1)
    expect(sprite.texture).toBe(art.idle)
    expect(sprite.toGlobal({ x: 0, y: 0 }).y).toBeCloseTo(ground)
    expect(done).toHaveBeenCalledTimes(1)
    expect(strike).toHaveBeenCalledTimes(1)
    scene.view.destroy({ children: true })
  })

  it('落爪前取消立即恢复站姿，不保留抬手帧、踏台高度或过期结算', () => {
    const art = textures(), scene = new ExplorationScene(art), world = createInitialWorld()
    world.exploration.explorer = { x: 18, y: 11 }; scene.refresh(world)
    const sprite = scene.view.getChildByLabel('atu-sprite', true) as Sprite
    const strike = vi.fn(), done = vi.fn()
    scene.soil({ stand: { x: 18, y: 11 }, target: { x: 17, y: 9 }, route: [], lift: 1 }, strike, done)
    scene.update(.5)
    expect(sprite.texture).toBe(art.digUp)
    scene.cancel()
    expect(sprite.texture).toBe(art.idle)
    expect(sprite.toGlobal({ x: 0, y: 0 }).y).toBeCloseTo(12 * T - 2)
    scene.update(2)
    expect(strike).not.toHaveBeenCalled(); expect(done).not.toHaveBeenCalled()
    scene.view.destroy({ children: true })
  })
})
