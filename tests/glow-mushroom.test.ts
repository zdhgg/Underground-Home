import { describe, expect, it } from 'vitest'
import { Texture, TextureSource, type Graphics } from 'pixi.js'
import { TILE, createInitialWorld } from '../src/core/world'
import { drawGlowMushrooms } from '../src/render/glowMushrooms'
import { ExplorationScene } from '../src/render/explorationScene'
import type { EnvironmentTextures } from '../src/render/environmentArt'
import { deserialize, serialize } from '../src/core/persistence'
import { secondLayerComplete } from './fixtures/deepWorld'

function exploredCave() {
  const world = createInitialWorld()
  Object.assign(world.exploration, { entered: true, shaftX: 27, pickaxeUpgraded: true })
  for (let y = 11; y <= 21; y++) world.tiles[y][27] = TILE.EMPTY
  for (let x = 9; x <= 38; x++) for (const y of [20, 21]) world.tiles[y][x] = TILE.EMPTY
  return world
}

interface Call { shape: 'circle' | 'ellipse'; paint: 'fill' | 'stroke'; color: number }

function recorder() {
  const calls: Call[] = []
  let shape: Call['shape'] = 'circle'
  const g = {
    circle() { shape = 'circle'; return g },
    ellipse() { shape = 'ellipse'; return g },
    fill(options: { color: number }) { calls.push({ shape, paint: 'fill', color: options.color }); return g },
    stroke(options: { color: number }) { calls.push({ shape, paint: 'stroke', color: options.color }); return g },
  }
  return { g: g as unknown as Graphics, calls }
}

const CAP = 0xcdf4de
const HIGHLIGHT = 0xffffff

describe('发光蘑菇：拾取后整簇消失', () => {
  it('未拾取时有菌伞与柔光；拾取后不再留下任何图形，绘制不修改世界', () => {
    const world = exploredCave(), before = structuredClone(world)
    const fresh = recorder()
    drawGlowMushrooms(fresh.g, world, 0)
    expect(fresh.calls.filter(call => call.color === CAP).length).toBeGreaterThan(0)
    expect(fresh.calls.some(call => call.color === HIGHLIGHT)).toBe(true)

    world.exploration.foundMushroom = true
    const picked = recorder()
    drawGlowMushrooms(picked.g, world, 0)
    expect(picked.calls).toHaveLength(0)
    expect(world).toEqual({ ...before, exploration: { ...before.exploration, foundMushroom: true } })
  })

  it('已拾取的旧存档加载后，后续帧也不再出现蘑菇或残光', () => {
    const world = secondLayerComplete()
    world.exploration.foundMushroom = true
    const loaded = deserialize(serialize(world))
    if (!loaded.ok) throw new Error(loaded.error)
    const picked = recorder()
    for (const elapsed of [0, .5, 3, 30]) drawGlowMushrooms(picked.g, loaded.world, elapsed)
    expect(picked.calls).toHaveLength(0)
  })

  it.each([true, false])('拾取与刷新后均无菌根贴图，环境素材可用=%s', hasArt => {
    const texture = (width: number, height: number) => new Texture({ source: new TextureSource({ width, height }) })
    const art: EnvironmentTextures = { spring: texture(10, 10), planter: texture(10, 10), barrel: texture(10, 10) }
    const world = exploredCave(), scene = new ExplorationScene(null, hasArt ? art : null)
    scene.refresh(world)
    expect(scene.view.getChildByLabel('mushroom-roots', true)).toBeNull()

    world.exploration.foundMushroom = true
    scene.refresh(world)
    scene.update(.5)
    expect(scene.view.getChildByLabel('mushroom-roots', true)).toBeNull()
    scene.refresh(world)
    expect(scene.view.getChildByLabel('mushroom-roots', true)).toBeNull()
    scene.view.destroy({ children: true })
    scene.background.destroy({ children: true })
  })

  it('还没下到泉水层时洞壁上什么都没有', () => {
    const world = exploredCave()
    world.exploration.entered = false
    const empty = recorder()
    drawGlowMushrooms(empty.g, world, 0)
    expect(empty.calls).toHaveLength(0)
  })
})
