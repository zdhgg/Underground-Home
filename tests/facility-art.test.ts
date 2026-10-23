// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Assets, Sprite, Texture, TextureSource } from 'pixi.js'
import { createApp, h, nextTick } from 'vue'
import { FACILITY_ART, type FacilityKind } from '../src/render/facilityArtSpec'
import { drawFacilityArt, loadFacilityTextures, type FacilityTextures } from '../src/render/facilityArt'
import { createInitialWorld } from '../src/core/world'
import { RoomScene } from '../src/render/roomScene'
import { drawPlanter } from '../src/render/farmProps'
import SiteTools from '../src/components/SiteTools.vue'
import { emptySiteUI } from '../src/app/siteEditor'

const texture = () => new Texture({ source: new TextureSource({ width: 128, height: 128 }) })
afterEach(() => { vi.restoreAllMocks(); document.body.innerHTML = '' })
describe('第二层建筑分层美术', () => {
  it('四类建筑在地图和卡片共用图层，保留一个主操作，图片失败可继续操作', async () => {
    for (const kind of ['kitchen', 'dining', 'garden', 'lounge'] as FacilityKind[]) {
      const host = document.createElement('div'); document.body.append(host)
      const state = { ...emptySiteUI(), active: true, selected: 'selected', kind, name: kind, canBuild: true }
      const app = createApp({ render: () => h(SiteTools, { state }) }); app.mount(host); await nextTick()
      const images = [...host.querySelectorAll<HTMLImageElement>('.facility-preview img')]
      expect(images.map(img => img.getAttribute('src'))).toEqual(FACILITY_ART[kind].layers.map(layer => layer.url))
      expect(host.querySelectorAll('[data-attention-panel]')).toHaveLength(1)
      expect(host.querySelectorAll('[data-primary-action]')).toHaveLength(1)
      images[0].dispatchEvent(new Event('error')); await nextTick()
      expect(host.textContent).toContain('仍可查看材料和开工')
      expect(host.querySelector<HTMLButtonElement>('[data-primary-action]')!.disabled).toBe(false)
      app.unmount()
    }
  })
  it('保持外壳与家具的比例和底边，刷新不毁共享纹理，也不改变世界', () => {
    const w = createInitialWorld(); w.progress.coreRepaired = true; w.exploration.entered = true
    w.builtSites = [{ id: 'spring-kitchen', kind: 'kitchen' }, { id: 'spring-table', kind: 'dining' }, { id: 'spring-garden', kind: 'garden' }, { id: 'water-corner', kind: 'lounge' }]
    const before = structuredClone(w), images: FacilityTextures = {}
    for (const kind of Object.keys(FACILITY_ART) as FacilityKind[]) images[kind] = FACILITY_ART[kind].layers.map(texture)
    const scene = new RoomScene(); scene.setFacilityTextures(images)
    scene.refresh(w, null); scene.refresh(w, null)
    expect(scene.view.getChildByLabel('garden-waiting', true)).not.toBeNull()
    for (const kind of Object.keys(FACILITY_ART) as FacilityKind[]) {
      const art = scene.view.getChildByLabel(`${kind}-art`, true)!
      expect(art).not.toBeNull()
      const shell = art.getChildByLabel(`${kind}-shell`) as Sprite
      expect(shell.width / shell.height).toBeCloseTo(FACILITY_ART[kind].aspect)
      const furniture = art.getChildByLabel(`${kind}-furniture`) as Sprite | null
      if (furniture) expect(furniture.width / furniture.height).toBeCloseTo(kind === 'kitchen' ? 1.5 : 3)
      expect(images[kind]!.every(image => !image.destroyed)).toBe(true)
    }
    expect(scene.view.getChildByLabel('garden-planter', true)).toBeNull() // 种植系统绘制菜槽，背景不得重复。
    expect(w).toEqual(before)
    w.farm.waterSupplied = true; scene.refresh(w, null)
    expect(scene.view.getChildByLabel('garden-waiting', true)).toBeNull()
    scene.view.destroy({ children: true }); scene.overlay.destroy({ children: true })
    for (const imagesOfKind of Object.values(images)) for (const image of imagesOfKind!) image.destroy(true)
  })
  it('一类图片加载失败只回退该类，成功的设施仍用图片', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const image = texture()
    const loadOne = async <T>(input: unknown): Promise<T> => {
      if (input === FACILITY_ART.kitchen.layers[1].url) throw new Error('offline')
      return image as unknown as T
    }
    vi.spyOn(Assets, 'load').mockImplementation(loadOne)
    const images = await loadFacilityTextures()
    expect(drawFacilityArt(images, 'kitchen', 0, 0, 96, 96)).toBeNull()
    expect(drawFacilityArt(images, 'dining', 0, 0, 128, 96)).not.toBeNull()
    image.destroy(true)
  })
  it('空槽和成熟植株分层，四个生长阶段可区别，视觉中心仍在原可点击格内', () => {
    const empty = texture(), planted = texture(), other = texture()
    const images = { spring: other, barrel: other, planter: planted, emptyPlanter: empty }
    for (const growth of [0, 1, 2, 3] as const) {
      const p = { id: 1, x: 28, y: 21, growth }, before = structuredClone(p)
      const view = drawPlanter(p, images, .25), sprite = view.children[0] as Sprite
      expect(sprite.texture).toBe(growth < 3 ? empty : planted)
      expect(view.label).toBe(`planter-stage-${growth}`)
      expect(Math.floor(view.x / 32)).toBe(p.x); expect(Math.floor(view.y / 32)).toBe(p.y)
      expect(p).toEqual(before); view.destroy({ children: true })
    }
    empty.destroy(true); planted.destroy(true); other.destroy(true)
  })
})
