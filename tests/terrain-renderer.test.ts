import { completedFinale } from './fixtures/finaleWorld'
import { loadFinaleTextures } from '../src/render/finaleScene'
import { completedRuins } from './fixtures/ruinsWorld'
import { loadRuinsTextures } from '../src/render/ruinsScene'
import { completedVentilation } from './fixtures/ventilationWorld'
import { loadVentilationTextures } from '../src/render/ventilationScene'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Container, Sprite, Text, Texture, TextureSource, type Graphics, type Ticker } from 'pixi.js'
import { completedReservoir } from './fixtures/reservoirWorld'
import { loadReservoirTextures } from '../src/render/reservoirScene'
import { completedGarden } from './fixtures/gardenWorld'
import { loadGardenTextures } from '../src/render/gardenScene'
import { furnishedHall } from './fixtures/hallWorld'
import { loadHallTextures } from '../src/render/hallScene'
import { placePod } from '../src/core/build'
import { dig } from '../src/core/dig'
import { createDigHistory } from '../src/core/history'
import { collectCrystal, repairCore } from '../src/core/interact'
import { createInitialWorld, LANDMARKS, SURFACE_Y, TILE, TILE_SIZE, type SleepPod } from '../src/core/world'
import { inspectCrack, moleRoute, shaftFrontier, upgradePickaxe } from '../src/core/exploration'
import { initializeWorkers } from '../src/core/partnerWork'
import { PixiWorldRenderer } from '../src/render/PixiRenderer'
import { loadTerrainTextures, type TerrainTextures } from '../src/render/terrainTextures'
import { loadEnergyCoreTexture } from '../src/render/energyCoreTexture'
import { loadCrystalTexture } from '../src/render/crystalTexture'
import type { CrystalFeedback } from '../src/render/CrystalFeedback'
import { LAMP_LOCATIONS, loadShelterFixtureTextures } from '../src/render/shelterFixtures'
import { bedSlots } from '../src/render/sleepPods'
import { loadNestTextures } from '../src/render/nestArt'
import { loadLoungeTextures } from '../src/render/loungeArt'
import { loadCollectionTextures } from '../src/render/collectionScene'
import { loadMoleTextures, MOLE_HEIGHT, type MoleTextures } from '../src/render/moleVisual'
import type { ExplorationScene } from '../src/render/explorationScene'
import { loadCompanionTextures, type CompanionArt } from '../src/render/companionVisual'
import { loadSurfaceTextures } from '../src/render/surfaceTextures'
import type { SurfaceScene } from '../src/render/surfaceScene'
import { OPENING_DURATION } from '../src/render/openingTimeline'

vi.mock('../src/render/finaleScene',async original=>({...await original<typeof import('../src/render/finaleScene')>(),loadFinaleTextures:vi.fn()}))
vi.mock('../src/render/ruinsScene',async original=>({...await original<typeof import('../src/render/ruinsScene')>(),loadRuinsTextures:vi.fn()}))
vi.mock('../src/render/ventilationScene', async original=>({...await original<typeof import('../src/render/ventilationScene')>(),loadVentilationTextures:vi.fn()}))
vi.mock('../src/render/reservoirScene', async original => ({ ...await original<typeof import('../src/render/reservoirScene')>(), loadReservoirTextures: vi.fn() }))
vi.mock('../src/render/gardenScene', async (original) => ({ ...await original<typeof import('../src/render/gardenScene')>(), loadGardenTextures: vi.fn() }))
vi.mock('../src/render/hallScene', async (original) => ({ ...await original<typeof import('../src/render/hallScene')>(), loadHallTextures: vi.fn() }))

// 只替换 GPU/资源入口，地形使用真实 Pixi Sprite、Texture 和 Graphics。
vi.mock('pixi.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('pixi.js')>()
  return {
    ...actual,
    Application: class {
      screen = { width: 1200, height: 800 }
      stage = new actual.Container()
      canvas = { style: {} }
      ticker = { add: vi.fn(), remove: vi.fn() }
      init = vi.fn().mockResolvedValue(undefined)
      destroy = vi.fn()
    },
  }
})
vi.mock('../src/render/terrainTextures', async (importOriginal) => ({
  ...await importOriginal<typeof import('../src/render/terrainTextures')>(),
  loadTerrainTextures: vi.fn(),
}))
vi.mock('../src/render/energyCoreTexture', async (importOriginal) => ({
  ...await importOriginal<typeof import('../src/render/energyCoreTexture')>(),
  loadEnergyCoreTexture: vi.fn(),
}))
vi.mock('../src/render/crystalTexture', async (importOriginal) => ({
  ...await importOriginal<typeof import('../src/render/crystalTexture')>(),
  loadCrystalTexture: vi.fn(),
}))
vi.mock('../src/render/shelterFixtures', async (importOriginal) => ({
  ...await importOriginal<typeof import('../src/render/shelterFixtures')>(),
  loadShelterFixtureTextures: vi.fn(),
}))
vi.mock('../src/render/moleVisual', async (importOriginal) => ({
  ...await importOriginal<typeof import('../src/render/moleVisual')>(),
  loadMoleTextures: vi.fn(),
}))
vi.mock('../src/render/companionVisual', async (importOriginal) => ({
  ...await importOriginal<typeof import('../src/render/companionVisual')>(),
  loadCompanionTextures: vi.fn(),
}))
vi.mock('../src/render/surfaceTextures', async (importOriginal) => ({
  ...await importOriginal<typeof import('../src/render/surfaceTextures')>(),
  loadSurfaceTextures: vi.fn(),
}))
vi.mock('../src/render/nestArt', async (importOriginal) => ({
  ...await importOriginal<typeof import('../src/render/nestArt')>(),
  loadNestTextures: vi.fn(),
}))
vi.mock('../src/render/loungeArt', async (importOriginal) => ({
  ...await importOriginal<typeof import('../src/render/loungeArt')>(),
  loadLoungeTextures: vi.fn(),
}))
vi.mock('../src/render/collectionScene', async (importOriginal) => ({
  ...await importOriginal<typeof import('../src/render/collectionScene')>(),
  loadCollectionTextures: vi.fn(),
}))
vi.mock('../src/render/facilityArt', async (importOriginal) => ({
  ...await importOriginal<typeof import('../src/render/facilityArt')>(),
  loadFacilityTextures: vi.fn().mockResolvedValue({}),
}))

function texture(size = 64): Texture {
  return new Texture({ source: new TextureSource({ width: size, height: size }) })
}

function textures(): TerrainTextures {
  const edges = () => ({ top: texture(), right: texture(), bottom: texture(), left: texture() })
  return {
    soil: [texture(), texture(), texture()], rock: [texture(), texture(), texture()],
    caveBg: texture(512), soilEdges: edges(), rockEdges: edges(), surfaceGrass: texture(),
  }
}

interface TerrainProbe {
  surfaceScene: SurfaceScene
  camera: { x: number; y: number; zoom: number }
  viewport: { width: number; height: number }
  moleLayer: Container
  friendsLayer: Container
  explorationScene: ExplorationScene
  tileSprites: { base: Sprite; edges: Sprite[] }[][]
  terrainLayer: Container
  hover: Graphics
  landmarkLayer: Container
  glowLayer: Container
  machineGlow: Graphics
  crystal: Container | null
  crystalFeedback: CrystalFeedback
  lightLevel: number
  spinUp: number
  cameraTween: unknown
  shelterFixtures: Container
  worldLayer: Container
  darkness: Graphics
  lamps: Graphics
  powerLine: Graphics
  powerLevel: number
  drawLighting(): void
  drawPowerLine(): void
  podLayer: Container
  farmLayer: Container
  farmFlow: Graphics
  podEntrance: unknown
  friends: {
    view: Container
    body: Graphics
    bodyColor: number
    baseY: number
    phase: number
    pose: string
    bed: { x: number; y: number } | null
    inEntrance: boolean
    podId: number | null
    nameLabel: { text: string } | null
    hidden: boolean
    tailGlow: { alpha: number } | null
    partnerId: string
  }[]
  refreshPods(): void
  refreshFriends(arrivingPodId?: number | null): void
  refreshFarm(): void
  playPodEntrance(pod: SleepPod, onSettled: () => void): void
  playPodCelebration(pod: SleepPod): void
  drawLighting(): void
  tick(ticker: Ticker): void
  updateTerrainCell(x: number, y: number): void
}

describe('PNG 世界渲染（地形与能源核心）', () => {
  let renderer: PixiWorldRenderer
  let view: TerrainProbe
  let art: TerrainTextures
  let world: ReturnType<typeof createInitialWorld>
  let moleArt: MoleTextures
  let companionArt: CompanionArt

  it('终章九层设施和九格纪念图案在人物后，窄屏目标不沉底，主动全景允许平移且不自动返回',()=>{
    const w=completedFinale();renderer.setWorld(w);const layer=view.worldLayer.getChildByLabel('finale-chapter')as Container;expect(view.worldLayer.getChildIndex(layer)).toBeLessThan(view.worldLayer.getChildIndex(view.friendsLayer));const art=layer.getChildByLabel('finale-memory')!,memories=layer.getChildByLabel('finale-nine-memories')!;expect(layer.getChildByLabel('finale-heart')).not.toBeNull();expect(layer.getChildByLabel('finale-table')).not.toBeNull();expect(layer.getChildIndex(memories)).toBeGreaterThan(layer.getChildIndex(art));expect(view.friends.filter(f=>f.view.visible)).toHaveLength(8);view.viewport={width:398,height:756};renderer.focusOn(32*TILE_SIZE,105*TILE_SIZE,'building');expect((107*TILE_SIZE-view.camera.y)*view.camera.zoom).toBeLessThan(view.viewport.height*.45);renderer.setFinalePreview('table',3);renderer.setFinalePreview(null,null);const snapshot=JSON.stringify(w);view.viewport={width:1200,height:800};renderer.showFinalePanorama();expect(renderer.isOverview).toBe(false);renderer.zoomBy(.4);const camera={...view.camera};renderer.panBy(8,9);expect(view.camera).not.toEqual(camera);const after={...view.camera};for(let i=0;i<100;i++)view.tick({deltaMS:100}as Ticker);expect(view.camera).toEqual(after);expect(JSON.stringify(w)).toBe(snapshot)
  })
  it('第八层设施、已修复图案在人物后，八层不新增伙伴；窄屏目标在面板上方',()=>{
    const w=completedRuins();renderer.setWorld(w);const layer=view.worldLayer.getChildByLabel('ruins-chapter')as Container;expect(view.worldLayer.getChildIndex(layer)).toBeLessThan(view.worldLayer.getChildIndex(view.friendsLayer));const art=layer.getChildByLabel('ruins-mosaic')!,overlay=layer.getChildByLabel('ruins-restored-stories')!;expect(art).not.toBeNull();expect(layer.getChildIndex(overlay)).toBeGreaterThan(layer.getChildIndex(art));expect(layer.getChildByLabel('ruins-desk')).not.toBeNull();expect(view.friends.filter(f=>f.view.visible)).toHaveLength(8);view.viewport={width:398,height:756};renderer.focusOn(30*TILE_SIZE,93*TILE_SIZE,'building');expect((95*TILE_SIZE-view.camera.y)*view.camera.zoom).toBeLessThan(view.viewport.height*.45);renderer.setRuinsPreview('mosaic',32);renderer.setRuinsPreview(null,null)
  })
  it('第七层设施与风机反馈均在人物后侧，铃铃独立造型、真实移动和窄屏目标不沉底',()=>{
    const w=completedVentilation();renderer.setWorld(w);const layer=view.worldLayer.getChildByLabel('ventilation-chapter')as Container;expect(view.worldLayer.getChildIndex(layer)).toBeLessThan(view.worldLayer.getChildIndex(view.friendsLayer));expect(layer.getChildByLabel('ventilation-fan')).not.toBeNull();expect(layer.getChildByLabel('ventilation-bench')).not.toBeNull();expect(layer.getChildByLabel('ventilation-motion')).not.toBeNull();const f=view.friends.find(f=>f.partnerId==='lingling')!;expect(f.view.getChildByLabel('lingling-sprite',true)).not.toBeNull();expect(view.friends.filter(f=>f.view.visible)).toHaveLength(8);let done=0;renderer.playPartnerTravel('lingling',[{x:36,y:82},{x:35,y:82}],()=>{},()=>done++);for(let i=0;i<4;i++)view.tick({deltaMS:100}as Ticker);expect(done).toBe(1);view.viewport={width:398,height:756};renderer.focusOn(30*TILE_SIZE,81*TILE_SIZE,'building');expect((83*TILE_SIZE-view.camera.y)*view.camera.zoom).toBeLessThan(view.viewport.height*.45);renderer.setVentilationPreview('bench',34);renderer.setVentilationPreview(null,null)
  })
  it('阿木沿路径移动时按行进方向翻面，不把左行和右行都画成同一朝向',()=>{
    renderer.setWorld(completedVentilation())
    const amu = view.friends.find(f => f.partnerId === 'amu')!
    const figure = amu.view.getChildByLabel('amu-figure', true) as Container
    renderer.playPartnerTravel('amu', [{ x: 30, y: 82 }, { x: 31, y: 82 }], () => {}, () => {})
    view.tick({ deltaMS: 100 } as Ticker); view.tick({ deltaMS: 20 } as Ticker)
    expect(figure.scale.x).toBe(-1)
    renderer.playPartnerTravel('amu', [{ x: 31, y: 82 }, { x: 30, y: 82 }], () => {}, () => {})
    view.tick({ deltaMS: 100 } as Ticker); view.tick({ deltaMS: 20 } as Ticker)
    expect(figure.scale.x).toBe(1)
  })
  it('第六层插画在伙伴后侧、水位在石池插画前侧，团团独立造型可走动且小屏目标不沉底',()=>{
    const w=completedReservoir();renderer.setWorld(w)
    const layer=view.worldLayer.getChildByLabel('reservoir-chapter') as Container
    expect(layer).toBeDefined();expect(view.worldLayer.getChildIndex(layer)).toBeLessThan(view.worldLayer.getChildIndex(view.friendsLayer))
    const basin=layer.getChildByLabel('reservoir-basin')!,water=layer.getChildByLabel('reservoir-water-level')!
    expect(layer.getChildIndex(water)).toBeGreaterThan(layer.getChildIndex(basin))
    expect(layer.getChildByLabel('reservoir-intake')).not.toBeNull();expect(layer.getChildByLabel('reservoir-wheel')).not.toBeNull()
    const friend=view.friends.find(f=>f.partnerId==='tuantuan')!;expect(friend.view.getChildByLabel('tuantuan-sprite',true)).not.toBeNull()
    expect(view.friends.filter(f=>f.view.visible)).toHaveLength(7)
    let done=0;renderer.playPartnerTravel('tuantuan',[{x:12,y:70},{x:13,y:70}],()=>{},()=>done++);for(let i=0;i<4;i++)view.tick({deltaMS:100} as Ticker);expect(done).toBe(1)
    view.viewport={width:398,height:756};renderer.focusOn(26*TILE_SIZE,69*TILE_SIZE,'building');expect((71*TILE_SIZE-view.camera.y)*view.camera.zoom).toBeLessThan(view.viewport.height*.45)
    renderer.playReservoirFlow('garden');for(let i=0;i<30;i++)view.tick({deltaMS:100} as Ticker);renderer.stopReservoirFlow()
    renderer.setReservoirPreview('basin',33);renderer.setReservoirPreview(null,null)
  })
  it('第五层设施在角色后侧、苔苔使用独立造型且床位有效，当前菌床光路与小屏定位可恢复',()=>{
    const w=completedGarden(); renderer.setWorld(w)
    const garden=view.worldLayer.children.find(c=>c.label==='fungal-garden') as Container
    expect(garden).toBeDefined(); expect(view.worldLayer.getChildIndex(garden)).toBeLessThan(view.worldLayer.getChildIndex(view.friendsLayer))
    expect(garden.children.filter(c=>c instanceof Sprite).length).toBeGreaterThanOrEqual(2)
    const taitai=view.friends.find(f=>f.partnerId==='taitai')!
    expect(taitai).toBeDefined(); expect(taitai.view.visible).toBe(true)
    expect(taitai.view.getChildByLabel('taitai-sprite',true)).not.toBeNull()
    let done=0; renderer.playPartnerTravel('taitai',[{x:36,y:58},{x:35,y:58}],()=>{},()=>done++)
    for(let i=0;i<4;i++) view.tick({deltaMS:100} as Ticker)
    expect(done).toBe(1)
    view.viewport={width:398,height:756}; renderer.focusOn(30*TILE_SIZE,57*TILE_SIZE,'building')
    expect((59*TILE_SIZE-view.camera.y)*view.camera.zoom).toBeLessThan(view.viewport.height*.45)
    renderer.setGardenPreview('bed',34); renderer.setGardenPreview(null,null)
  })

  it('四层大厅插画嵌在空洞后侧，餐桌和纪念墙在伙伴之前；六人演出实际包含五位伙伴和独立阿土', () => {
    const w = furnishedHall(); renderer.setWorld(w)
    const hall = view.worldLayer.children.find(c => c.label === 'warm-hall-chapter') as Container
    expect(hall).toBeDefined(); expect(view.worldLayer.getChildIndex(hall)).toBeLessThan(view.worldLayer.getChildIndex(view.friendsLayer))
    const sprites = hall.children.filter(c => c instanceof Sprite) as Sprite[]
    expect(sprites).toHaveLength(3)
    expect(sprites[0].width).toBeLessThanOrEqual(8 * TILE_SIZE)
    expect(sprites[0].y).toBe(47 * TILE_SIZE)
    expect(view.friends.filter(f => f.partnerId !== 'atu' && f.view.visible)).toHaveLength(5)
    let worked = 0; renderer.playHallWork({ x: 28, y: 46 }, () => worked++)
    for (let i = 0; i < 12; i++) view.tick({ deltaMS: 100 } as Ticker)
    expect(worked).toBe(1)
    view.viewport = { width: 398, height: 756 }
    renderer.focusOn(32 * TILE_SIZE, 45 * TILE_SIZE, 'building')
    expect((47 * TILE_SIZE - view.camera.y) * view.camera.zoom).toBeLessThan(view.viewport.height * .45)
  })

  it('最低晶簇层在窄屏定位时留在面板上方，不被地图底界挤回下半屏', () => {
    view.viewport = { width: 398, height: 756 }
    renderer.focusOn(27.5 * TILE_SIZE, 32 * TILE_SIZE, 'building')
    const footY = (34 * TILE_SIZE - view.camera.y) * view.camera.zoom
    expect(footY).toBeLessThan(view.viewport.height * .45)
    expect(footY).toBeGreaterThan(0)
    renderer.focusCrystal()
    expect((34 * TILE_SIZE - view.camera.y) * view.camera.zoom).toBeLessThan(view.viewport.height * .45)
  })

  it('第七层送礼抵达只在玩家未接管镜头时定位大厅，拖图和收起不会被抢回',()=>{
    const focus=vi.spyOn(renderer,'focusOn');renderer.beginDeepCamera();renderer.releaseDeepCamera();renderer.finishChapterArrival({x:30,y:46});expect(focus).not.toHaveBeenCalled();renderer.beginDeepCamera();renderer.panBy(10,5);renderer.finishChapterArrival({x:30,y:46});expect(focus).not.toHaveBeenCalled();renderer.beginDeepCamera();renderer.finishChapterArrival({x:30,y:46});expect(focus).toHaveBeenCalledTimes(1)
  })
  it('收起、拖图或缩放后，晶簇层抵达回调不会再次抢回镜头', () => {
    const focus = vi.spyOn(renderer, 'focusCrystal')
    renderer.beginDeepCamera(); renderer.releaseDeepCamera(); renderer.finishDeepArrival()
    expect(focus).not.toHaveBeenCalled()
    renderer.beginDeepCamera(); renderer.panBy(20, 10); renderer.finishDeepArrival()
    expect(focus).not.toHaveBeenCalled()
    renderer.beginDeepCamera(); renderer.zoomBy(.1); renderer.finishDeepArrival()
    expect(focus).not.toHaveBeenCalled()
    renderer.beginDeepCamera(); renderer.finishDeepArrival()
    expect(focus).toHaveBeenCalledTimes(1)
  })

  it('初始横屏取景同时容纳风雪地表和第一层地面，返回家园不只看到树根', () => {
    for (const [width, height] of [[1440, 800], [1024, 600], [927, 482], [760, 360]]) {
      view.viewport = { width, height }
      renderer.focusHome()
      const camera = view.camera
      expect((SURFACE_Y * TILE_SIZE - camera.y) * camera.zoom).toBeGreaterThan(145)
      expect((12 * TILE_SIZE - camera.y) * camera.zoom).toBeLessThan(height - 20)
    }
  })

  beforeEach(async () => {
    vi.stubGlobal('window', { devicePixelRatio: 1 })
    art = textures()
    vi.mocked(loadFinaleTextures).mockResolvedValue({heart:texture(1024),table:texture(1024),memory:texture(1024)})
    vi.mocked(loadRuinsTextures).mockResolvedValue({mosaic:texture(1024),desk:texture(1024),folio:texture(1024)})
    vi.mocked(loadVentilationTextures).mockResolvedValue({lingling:texture(1024),fan:texture(1024),bench:texture(1024)})
    vi.mocked(loadReservoirTextures).mockResolvedValue({ tuantuan:texture(1024), basin:texture(1024), wheel:texture(1024), intake:texture(1024) })
    vi.mocked(loadGardenTextures).mockResolvedValue({ bell: texture(1024), fan: texture(1024), rill: texture(1024), taitai: texture(1024) })
    vi.mocked(loadHallTextures).mockResolvedValue({ shell: new Texture({ source: new TextureSource({ width: 1800, height: 900 }) }), table: texture(1024), memory: texture(1024) })
    vi.mocked(loadNestTextures).mockResolvedValue({ shell: texture(1254), bunks: texture(1536) })
    vi.mocked(loadLoungeTextures).mockResolvedValue({ shell: texture(1618), furniture: texture(2172) })
    vi.mocked(loadCollectionTextures).mockResolvedValue({ shelf: texture(2172), items: { 'seed-pouch': texture(), wrench: texture(), 'lamp-shade': texture() } })
    vi.mocked(loadSurfaceTextures).mockResolvedValue({ horizon: texture(724), woodland: texture(724), entrance: texture(1024) })
    moleArt = {
      idle: new Texture({ source: new TextureSource({ width: 409, height: 512 }) }),
      blink: new Texture({ source: new TextureSource({ width: 409, height: 512 }) }),
      rest: new Texture({ source: new TextureSource({ width: 360, height: 271 }) }),
    }
    vi.mocked(loadMoleTextures).mockResolvedValue(moleArt)
    const companion = () => ({ idle: texture(512), blink: texture(512), rest: texture(256) })
    companionArt = { adeng: companion(), xiaoman: companion(), xiaoquan: companion(), ayan: companion(), amu: companion(), taitai: companion(), tuantuan: companion(),lingling:companion() }
    vi.mocked(loadCompanionTextures).mockResolvedValue(companionArt)
    vi.mocked(loadTerrainTextures).mockResolvedValue(art)
    vi.mocked(loadEnergyCoreTexture).mockResolvedValue(new Texture({
      source: new TextureSource({ width: 1536, height: 1024 }),
    }))
    vi.mocked(loadCrystalTexture).mockResolvedValue(texture(1254))
    vi.mocked(loadShelterFixtureTextures).mockResolvedValue({
      ladder: new Texture({ source: new TextureSource({ width: 1024, height: 1536 }) }),
      lamp: texture(1254),
    })
    renderer = await PixiWorldRenderer.create({ appendChild: vi.fn() } as unknown as HTMLElement)
    view = renderer as unknown as TerrainProbe
    world = createInitialWorld()
    renderer.setWorld(world)
  })
  afterEach(() => {
    renderer.destroy()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('苔斑位于家具后面；设施建成与撤销时立即更新，不必等下一次挖掘', () => {
    world.exploration.entered = true; world.exploration.shaftX = 27
    for (let y = 11; y <= 21; y++) world.tiles[y][27] = TILE.EMPTY
    for (let x = 9; x <= 38; x++) for (const y of [20, 21]) world.tiles[y][x] = TILE.EMPTY
    renderer.setWorld(world)
    const mossColumns = () => view.explorationScene.background.children[0].children.map(child => Math.floor(child.x / TILE_SIZE))
    expect(mossColumns()).toContain(12)
    expect(view.worldLayer.children.indexOf(view.explorationScene.background)).toBeLessThan(view.worldLayer.children.indexOf(view.farmLayer))
    expect(view.worldLayer.children.indexOf(view.explorationScene.background)).toBeLessThan(view.worldLayer.children.indexOf(view.friendsLayer))
    world.builtSites.push({ id: 'spring-kitchen', kind: 'kitchen' })
    renderer.refreshRooms(); expect(mossColumns()).not.toContain(12)
    world.builtSites = []
    renderer.refreshRooms(); expect(mossColumns()).toContain(12)
    world.farm.planters.push({ id: 1, x: 30, y: 21, growth: 0 })
    renderer.refreshFarm(); expect(mossColumns()).not.toContain(30)
  })

  it('开场自然结束与任意阶段跳过得到同一镜头和角色，世界始终不变', () => {
    // Node 无 Canvas 字体测量；只替换测量入口，实际气泡排版由浏览器验收。
    vi.spyOn(Text.prototype, 'width', 'get').mockImplementation(function (this: Text) { return this.text.length * 14 })
    vi.spyOn(Text.prototype, 'height', 'get').mockReturnValue(18)
    world.exploration.explorer = { x: 18, y: 11 }
    renderer.setWorld(world)
    renderer.focusHome()
    const finalCamera = { ...view.camera }, before = JSON.stringify(world)
    for (const seconds of [0, 1.8, 4, 6.3, 8.5, 10.8, 13.4, 14.7, OPENING_DURATION + .2]) {
      const done = vi.fn()
      renderer.playOpening(done, vi.fn())
      for (let t = 0; t < seconds; t += .1) view.tick({ deltaMS: 100 } as Ticker)
      if (seconds > OPENING_DURATION) expect(done).toHaveBeenCalledTimes(1)
      renderer.finishOpening(); renderer.finishOpening()
      expect(done).toHaveBeenCalledTimes(1)
      expect(view.camera).toEqual(finalCamera)
      expect(view.explorationScene.view.visible).toBe(true)
      expect(JSON.stringify(world)).toBe(before)
    }
  })

  it('专业伙伴按已保存站位待命，床位保留且不会出现床上分身；工作反馈不拉镜头', () => {
    world.progress.coreRepaired = true
    for (const x of [12, 13, 14]) for (const y of [9, 10, 11]) world.tiles[y][x] = TILE.EMPTY
    const pod = placePod(world, 12, 10)!
    initializeWorkers(world); renderer.setWorld(world)
    for (const friend of view.friends.filter(f => f.partnerId !== 'atu')) {
      const p = world.workers[friend.partnerId as 'adeng' | 'xiaoman']!
      expect(friend.pose).toBe('idle'); expect(friend.bed).toBeNull()
      expect(friend.view.x).toBe((p.x + .5) * TILE_SIZE)
      expect(view.friends.filter(f => f.partnerId === friend.partnerId)).toHaveLength(1)
    }
    const settled = vi.fn(); renderer.playPodEntrance(pod, settled)
    expect(settled).toHaveBeenCalledTimes(1)
    const camera = view.cameraTween; renderer.playSupplyWater()
    expect(view.cameraTween).toBe(camera)
    const adeng = view.friends.find(f => f.partnerId === 'adeng')!
    const route = [{ x: 24, y: 11 }, { x: 25, y: 11 }], done = vi.fn()
    renderer.playPartnerTravel('adeng', route, p => { world.workers.adeng = p }, done)
    for (let i = 0; i < 4; i++) view.tick({ deltaMS: 100 } as Ticker)
    expect(done).toHaveBeenCalledTimes(1); expect(adeng.view.x).toBe(25.5 * TILE_SIZE)
    expect(world.workers.adeng).toEqual({ x: 25, y: 11 })
  })

  it('阿土用40px图片站在原地面；夜里脸部可辨，阿灯仍在黑暗下躲藏', () => {
    const atu = view.friends[0]
    const snapshot = JSON.stringify(world)
    const sprite = atu.view.getChildByLabel('atu-sprite', true) as Sprite
    expect(sprite.texture).toBe(moleArt.idle)
    expect(sprite.height).toBe(MOLE_HEIGHT)
    expect(sprite.width).toBeCloseTo(MOLE_HEIGHT * 409 / 512)
    expect(sprite.anchor.y).toBe(1)
    expect(atu.view.y + sprite.y).toBe(12 * TILE_SIZE)
    expect(atu.body.visible).toBe(false)
    expect(atu.view.parent).toBe(view.moleLayer)
    expect(view.worldLayer.getChildIndex(view.moleLayer)).toBeGreaterThan(view.worldLayer.getChildIndex(view.darkness))
    expect(view.friends[1].view.parent).toBe(view.friendsLayer)
    expect(view.friends[1].hidden).toBe(true)
    for (let i = 0; i < 80; i++) view.tick({ deltaMS: 100 } as Ticker)
    expect(JSON.stringify(world)).toBe(snapshot)
    expect(atu.view.y + sprite.y).toBe(12 * TILE_SIZE)
  })

  it('探索使用同一个阿土；出发时隐藏大厅分身，取消未落盘的移动后恢复', () => {
    const atu = view.friends[0]
    const explorerSprite = view.explorationScene.view.getChildByLabel('atu-sprite', true) as Sprite
    expect(explorerSprite.texture).toBe(moleArt.idle)
    const snapshot = JSON.stringify(world)
    const done = vi.fn()
    renderer.playExplorationTravel([{ x: 18, y: 11 }, { x: 19, y: 11 }], done)
    expect(atu.view.visible).toBe(false)
    expect(view.explorationScene.visible).toBe(true)
    renderer.cancelExplorationAnimation()
    view.tick({ deltaMS: 16 } as Ticker)
    expect(atu.view.visible).toBe(true)
    expect(done).not.toHaveBeenCalled()
    expect(JSON.stringify(world)).toBe(snapshot)
  })

  it('阿土素材加载失败仍能进入游戏、画出备用角色并继续探索', async () => {
    vi.mocked(loadMoleTextures).mockResolvedValueOnce(null)
    const fallback = await PixiWorldRenderer.create({ appendChild: vi.fn() } as unknown as HTMLElement)
    try {
      fallback.setWorld(world)
      const probe = fallback as unknown as TerrainProbe
      expect(probe.friends[0].body.visible).toBe(true)
      expect(probe.friends[0].body.context.instructions.length).toBeGreaterThan(0)
      expect(probe.friends[0].view.getChildByLabel('atu-sprite', true)).toBeNull()
      expect(probe.explorationScene.view.getChildByLabel('atu-sprite', true)).toBeNull()
      fallback.playExplorationTravel([{ x: 18, y: 11 }, { x: 19, y: 11 }], () => {})
      probe.tick({ deltaMS: 100 } as Ticker)
      expect(fallback.explorationAnimating).toBe(true)
    } finally { fallback.destroy() }
  })

  it('64px PNG 换入空精灵后仍为32×32，锚点和网格不变', () => {
    const cell = view.tileSprites[9][14]
    for (const sprite of [cell.base, ...cell.edges.filter((edge) => edge.visible)]) {
      expect(sprite.width).toBe(TILE_SIZE)
      expect(sprite.height).toBe(TILE_SIZE)
      expect(sprite.anchor.x).toBe(0)
      expect(sprite.anchor.y).toBe(0)
      expect([sprite.x, sprite.y]).toEqual([14 * TILE_SIZE, 9 * TILE_SIZE])
    }
  })

  it.each(Array.from({ length: 16 }, (_, mask) => mask))('四方向组合 %i：叠图在实心格上，空格不留精灵', (mask) => {
    const neighbors = [[10, 9], [11, 10], [10, 11], [9, 10]]
    neighbors.forEach(([x, y], i) => { world.tiles[y][x] = mask & (1 << i) ? TILE.EMPTY : TILE.SOIL })
    renderer.refreshTerrain()
    const center = view.tileSprites[10][10]
    expect(center.base.visible).toBe(true)
    expect(center.edges.map((edge) => edge.visible)).toEqual(neighbors.map((_, i) => Boolean(mask & (1 << i))))
    const directions = ['top', 'right', 'bottom', 'left'] as const
    directions.forEach((direction, i) => {
      if (mask & (1 << i)) expect(center.edges[i].texture).toBe(art.soilEdges[direction])
    })
    neighbors.forEach(([x, y], i) => {
      if (mask & (1 << i)) {
        expect(view.tileSprites[y][x].base.visible).toBe(false)
        expect(view.tileSprites[y][x].edges.every((edge) => !edge.visible)).toBe(true)
      }
    })
  })

  it('土岩实心交界不画洞边；挖掘交界后两种材质各用自己的叠图', () => {
    expect(view.tileSprites[10][1].edges.some((edge) => edge.visible)).toBe(false)
    expect(view.tileSprites[10][2].edges.some((edge) => edge.visible)).toBe(false)
    expect(dig(world, 2, 10).ok).toBe(true)
    renderer.refreshTerrain([{ x: 2, y: 10 }])
    expect(view.tileSprites[10][1].edges[1].visible).toBe(true)
    expect(view.tileSprites[10][1].edges[1].texture).toBe(art.rockEdges.right)
    expect(view.tileSprites[10][3].edges[3].visible).toBe(true)
    expect(view.tileSprites[10][3].edges[3].texture).toBe(art.soilEdges.left)
  })

  it('挖掘、撤销恢复四周边缘与原贴图，且清除已挖格的悬停框', () => {
    const history = createDigHistory()
    const before = view.tileSprites[10][11].base.texture
    renderer.setHoverCell({ x: 11, y: 10 })
    expect(view.hover.context.instructions.length).toBeGreaterThan(0)
    dig(world, 11, 10)
    history.record(11, 10)
    renderer.refreshTerrain([{ x: 11, y: 10 }])
    expect(view.hover.context.instructions).toHaveLength(0)
    for (const [x, y, edge] of [[11, 9, 2], [12, 10, 3], [11, 11, 0], [10, 10, 1]]) {
      expect(view.tileSprites[y][x].edges[edge].visible).toBe(true)
    }
    const restored = history.undo(world)!
    renderer.refreshTerrain([restored])
    expect(view.tileSprites[10][11].base.visible).toBe(true)
    expect(view.tileSprites[10][11].base.texture).toBe(before)
    for (const [x, y] of [[11, 9], [12, 10], [11, 11], [10, 10]]) {
      expect(view.tileSprites[y][x].edges.some((edge) => edge.visible)).toBe(false)
    }
    expect(view.hover.context.instructions.length).toBeGreaterThan(0)
  })

  it('草边只覆盖地表实心格，竖井保持开口，地图外不产生洞壁', () => {
    const surface = view.tileSprites[SURFACE_Y][0]
    expect(surface.edges[0].visible).toBe(true)
    expect(surface.edges[0].texture).toBe(art.surfaceGrass)
    expect(surface.edges[3].visible).toBe(false)
    expect(view.tileSprites[SURFACE_Y][21].base.visible).toBe(false)
    expect(view.tileSprites[SURFACE_Y][21].edges.some((edge) => edge.visible)).toBe(false)
    expect(view.tileSprites[world.height - 1][0].edges[2].visible).toBe(false)
  })

  it('全图刷新、重新加载保持坐标变体一致，不改世界或存档字段', () => {
    const snapshot = JSON.stringify(world)
    const before = view.tileSprites.map((row) => row.map((cell) => cell?.base.texture))
    renderer.setWorld(world)
    expect(view.tileSprites.map((row) => row.map((cell) => cell?.base.texture))).toEqual(before)
    expect(JSON.stringify(world)).toBe(snapshot)
    const selected = new Set(view.tileSprites[10].map((cell) => cell.base.texture))
    for (const tex of [...art.soil, ...art.rock]) expect(selected.has(tex)).toBe(true)
  })

  it('单格刷新只更新5格并复用精灵；批量重叠邻域去重、地图边界安全', () => {
    const sprites = [...view.terrainLayer.children]
    const update = vi.spyOn(view, 'updateTerrainCell')
    renderer.refreshTerrain([{ x: 11, y: 10 }])
    expect(update).toHaveBeenCalledTimes(5)
    expect(update.mock.calls).toEqual(expect.arrayContaining([[11, 10], [10, 10], [12, 10], [11, 9], [11, 11]]))
    update.mockClear()
    renderer.refreshTerrain([{ x: 11, y: 10 }, { x: 12, y: 10 }])
    expect(update).toHaveBeenCalledTimes(8)
    update.mockClear()
    renderer.refreshTerrain([{ x: 0, y: world.height - 1 }])
    expect(update).toHaveBeenCalledTimes(3)
    expect(view.terrainLayer.children).toEqual(sprites)
  })

  it('能源核心三态复用同一PNG、保持比例与槽心对齐，渲染不改变任务和存档数据', () => {
    const bodyTexture = view.landmarkLayer.children.find((child) => child instanceof Sprite)!.texture
    const assertCore = (label: string, innerColor: number) => {
      const snapshot = JSON.stringify(world)
      renderer.refresh()
      const body = view.landmarkLayer.children.find((child) => child instanceof Sprite)!
      expect(body.texture).toBe(bodyTexture)
      expect(body.width).toBe(128)
      expect(body.height).toBeCloseTo(128 * 1024 / 1536)
      expect(body.scale.x).toBe(body.scale.y)
      expect([body.anchor.x, body.anchor.y]).toEqual([0.5, 0.46])
      expect([body.x, body.y]).toEqual([(LANDMARKS.generator.x + 0.5) * TILE_SIZE, (LANDMARKS.generator.y + 0.5) * TILE_SIZE])
      expect(view.glowLayer.children.some((child) => child instanceof Text && child.text === label)).toBe(true)
      expect(view.machineGlow.context.fillStyle.color).toBe(innerColor)
      expect(JSON.stringify(world)).toBe(snapshot)
    }
    assertCore('能源核心 · 待修复', 0x33474f)
    dig(world, LANDMARKS.crystal.x, LANDMARKS.crystal.y)
    expect(collectCrystal(world, LANDMARKS.crystal.x, LANDMARKS.crystal.y).ok).toBe(true)
    assertCore('能源核心 · 等待能源石', 0xfff0d0)
    expect(repairCore(world, LANDMARKS.generator.x, LANDMARKS.generator.y).ok).toBe(true)
    assertCore('能源核心 · 运行中', 0xeafff2)
  })

  it('能源石埋藏时只有微光，挖开显示PNG，收集后消失', () => {
    expect(view.crystal?.children.some((child) => child instanceof Sprite)).toBe(false)
    dig(world, LANDMARKS.crystal.x, LANDMARKS.crystal.y)
    renderer.refresh()
    const stone = view.crystal?.children.find((child) => child instanceof Sprite)
    expect(stone).toBeDefined()
    expect(stone!.height).toBe(48)
    expect(collectCrystal(world, LANDMARKS.crystal.x, LANDMARKS.crystal.y).ok).toBe(true)
    renderer.refresh()
    renderer.playCrystalCollection()
    expect(view.crystal).toBeNull()
    expect(view.crystalFeedback.view.visible).toBe(true)
    const snapshot = JSON.stringify(world)
    for (let i = 0; i < 5; i++) view.tick({ deltaMS: 100 } as Ticker)
    expect(view.crystalFeedback.view.visible).toBe(false)
    expect(JSON.stringify(world)).toBe(snapshot)
  })

  it('探索演出可以安全取消：没落镐就不改世界，重新委托才真的挖开', () => {
    const w = world
    w.progress = { crystalFound: true, crystalCollected: true, coreRepaired: true }
    for (let y = 10; y <= 11; y++) for (let x = 12; x <= 14; x++) dig(w, x, y)
    expect(placePod(w, 12, 10)).not.toBeNull()
    for (let x = 26; x <= 27; x++) dig(w, x, 11)
    expect(inspectCrack(w, 27, 12)).toBe(true)
    expect(upgradePickaxe(w)).toBe(true)
    renderer.refresh()
    const target = shaftFrontier(w, 27)!
    // 让阿土从大厅地面出发，走一段真实的长路
    w.exploration.explorer = { x: 18, y: 11 }
    const route = moleRoute(w, { x: target.x, y: target.y - 1 })!
    expect(route.length).toBe(10)
    const snapshot = JSON.stringify(w)
    const arrived = vi.fn()
    renderer.playExplorationTravel(route, arrived)
    expect(renderer.explorationAnimating).toBe(true)
    for (let i = 0; i < 2; i++) view.tick({ deltaMS: 100 } as Ticker)
    // 走到一半被切后台 / 超时：不"到达"、不改世界
    renderer.cancelExplorationAnimation()
    expect(renderer.explorationAnimating).toBe(false)
    for (let i = 0; i < 20; i++) view.tick({ deltaMS: 100 } as Ticker)
    expect(arrived).not.toHaveBeenCalled()
    expect(JSON.stringify(w)).toBe(snapshot)
    // 挥镐到一半取消：落镐回调不触发，世界保持原样
    const struck = vi.fn()
    renderer.playRockBreak(target, struck)
    for (let i = 0; i < 3; i++) view.tick({ deltaMS: 100 } as Ticker)
    renderer.cancelExplorationAnimation()
    for (let i = 0; i < 20; i++) view.tick({ deltaMS: 100 } as Ticker)
    expect(struck).not.toHaveBeenCalled()
    expect(JSON.stringify(w)).toBe(snapshot)
    // 玩家再点一次：落镐后照常挖开一格，演出自己收尾
    renderer.playRockBreak(target, struck)
    for (let i = 0; i < 8; i++) view.tick({ deltaMS: 100 } as Ticker)
    expect(struck).toHaveBeenCalledTimes(1)
    expect(renderer.explorationAnimating).toBe(false)
  })

  it('安装动画结束才启动和点灯；任务及存档立即完成，载入已完成世界不重播', () => {
    dig(world, LANDMARKS.crystal.x, LANDMARKS.crystal.y)
    collectCrystal(world, LANDMARKS.crystal.x, LANDMARKS.crystal.y)
    repairCore(world, LANDMARKS.generator.x, LANDMARKS.generator.y)
    renderer.refresh()
    renderer.playRepairCelebration()
    const snapshot = JSON.stringify(world)
    expect(view.crystalFeedback.installing).toBe(true)
    for (let i = 0; i < 5; i++) view.tick({ deltaMS: 100 } as Ticker)
    expect(view.lightLevel).toBe(0)
    expect(view.spinUp).toBe(0)
    for (let i = 0; i < 3; i++) view.tick({ deltaMS: 100 } as Ticker)
    expect(view.crystalFeedback.installing).toBe(false)
    expect(view.spinUp).toBeGreaterThan(0)
    expect(view.lightLevel).toBeGreaterThan(0)
    expect(JSON.stringify(world)).toBe(snapshot)
    renderer.playRepairCelebration()
    renderer.setWorld(world)
    expect(view.crystalFeedback.installing).toBe(false)
    expect(view.lightLevel).toBe(1)
    expect(view.spinUp).toBe(0)
    expect(view.crystal).toBeNull()
  })

  it('安装期间手动平移仍能取消自动拉远，晶体安装与启动继续完成', () => {
    dig(world, LANDMARKS.crystal.x, LANDMARKS.crystal.y)
    collectCrystal(world, LANDMARKS.crystal.x, LANDMARKS.crystal.y)
    repairCore(world, LANDMARKS.generator.x, LANDMARKS.generator.y)
    renderer.refresh()
    renderer.playRepairCelebration()
    renderer.panBy(20, 0)
    for (let i = 0; i < 10; i++) view.tick({ deltaMS: 100 } as Ticker)
    expect(view.cameraTween).toBeNull()
    expect(view.crystalFeedback.installing).toBe(false)
    expect(view.spinUp).toBeGreaterThan(0)
  })

  it('梯架和7盏未通电灯具位于原坐标、黑暗遮罩之下，刷新复用静态精灵', () => {
    const fixtures = [...view.shelterFixtures.children] as Sprite[]
    expect(fixtures).toHaveLength(9)
    const [ladder, extension, ...lamps] = fixtures
    expect(extension.x).toBe(ladder.x)
    expect(extension.y + extension.height).toBe(12 * TILE_SIZE)
    expect([ladder.x, ladder.y]).toEqual([(LANDMARKS.shaft.x + LANDMARKS.shaft.w / 2) * TILE_SIZE, LANDMARKS.shaft.y * TILE_SIZE])
    expect(ladder.height).toBe((LANDMARKS.shaft.h + 1) * TILE_SIZE)
    expect(ladder.scale.x).toBe(ladder.scale.y)
    lamps.forEach((lamp, i) => {
      expect(lamp.visible).toBe(true)
      expect(lamp.tint).toBe(0x666666)
      expect([lamp.x, lamp.y]).toEqual([LAMP_LOCATIONS[i].x, LAMP_LOCATIONS[i].y])
      expect(lamp.scale.x).toBe(lamp.scale.y)
    })
    expect(view.worldLayer.getChildIndex(view.shelterFixtures)).toBeLessThan(view.worldLayer.getChildIndex(view.darkness))
    view.drawLighting()
    expect(view.lamps.context.instructions).toHaveLength(0)
    renderer.refresh()
    expect(view.shelterFixtures.children).toEqual(fixtures)
  })

  it('顶灯仍按原顺序逐盏点亮，光晕与PNG灯芯位置一致且不重建灯具', () => {
    const fixtures = [...view.shelterFixtures.children]
    const snapshot = JSON.stringify(world)
    view.lightLevel = 0.2
    view.drawLighting()
    expect(view.lamps.context.instructions).toHaveLength(6) // 前3盏：每盏光晕+灯芯
    const lampSprites = view.shelterFixtures.children.slice(2) as Sprite[]
    expect(lampSprites[0].tint).toBeGreaterThan(lampSprites[3].tint)
    expect(lampSprites[6].tint).toBe(0x666666)
    view.lightLevel = 1
    view.drawLighting()
    expect(view.lamps.context.instructions).toHaveLength(14)
    expect(lampSprites.every((lamp) => lamp.tint === 0xffffff)).toBe(true)
    view.lightLevel = 0
    view.drawLighting()
    expect(lampSprites.every((lamp) => lamp.tint === 0x666666)).toBe(true)
    expect(view.shelterFixtures.children).toEqual(fixtures)
    expect(JSON.stringify(world)).toBe(snapshot)
  })

  it('点亮核心只解除暖窝层黑暗，第二层始终保留独立遮罩', () => {
    view.lightLevel = 1
    view.drawLighting()
    expect(view.darkness.context.instructions).toHaveLength(1)
    expect(view.darkness.context.fillStyle.alpha).toBe(0.43)
    const bounds = view.darkness.getLocalBounds()
    expect(bounds.y).toBe(12 * TILE_SIZE)
    expect(bounds.height).toBe((world.height - 12) * TILE_SIZE)
    expect(view.tileSprites[17][8].base.tint).not.toBe(view.tileSprites[10][8].base.tint)
  })

  it('电送到第二层：遮罩淡下去，电线才出现', () => {
    const next = createInitialWorld()
    next.progress = { crystalFound: true, crystalCollected: true, coreRepaired: true }
    next.exploration = {
      ...next.exploration,
      clueFound: true,
      shaftX: 27,
      explorer: { x: 27, y: 11 },
      pickaxeUpgraded: true,
      entered: true,
    }
    renderer.setWorld(next)
    view.lightLevel = 1
    // 还没送电：第二层是暗的，也没有电线
    view.powerLevel = 0
    view.drawLighting()
    expect(view.darkness.context.fillStyle.alpha).toBe(0.43)
    view.drawPowerLine()
    expect(view.powerLine.context.instructions).toHaveLength(0)
    // 送电之后：第二层只剩一点夜色，电线出现
    next.powerDown = true
    view.powerLevel = 1
    view.drawLighting()
    expect(view.darkness.context.fillStyle.alpha).toBeCloseTo(0.05, 5)
    view.drawPowerLine()
    expect(view.powerLine.context.instructions.length).toBeGreaterThan(0)
  })

  it('向下镜头可取消，返回家园恢复操作视角，全景覆盖地表到基岩', () => {
    const onView = vi.fn()
    renderer.onViewChanged = onView
    renderer.focusWater()
    for (let i = 0; i < 10; i++) view.tick({ deltaMS: 100 } as Ticker)
    expect(onView).toHaveBeenLastCalledWith(expect.objectContaining({ layer: 'water', overview: false }))
    renderer.focusOverview()
    expect(renderer.isOverview).toBe(true)
    renderer.focusHome()
    expect(renderer.isOverview).toBe(false)
    expect(view.cameraTween).toBeNull()
    expect(onView).toHaveBeenLastCalledWith(expect.objectContaining({ layer: 'home', overview: false }))
    renderer.focusWater()
    renderer.panBy(0, 20)
    expect(view.cameraTween).toBeNull()
  })

  describe('阿土行动跟随', () => {
    it('长路 / 跨层走位时镜头中心跟着阿土，楼层随镜头换', () => {
      const onView = vi.fn()
      renderer.onViewChanged = onView
      renderer.focusHome()
      const startY = view.camera.y
      const route = Array.from({ length: 11 }, (_, i) => ({ x: 27, y: 11 + i }))
      const arrived = vi.fn()
      renderer.playExplorationTravel(route, arrived)
      for (let i = 0; i < 12; i++) view.tick({ deltaMS: 100 } as Ticker)
      expect(view.camera.y).toBeGreaterThan(startY + 100)
      const anchor = view.explorationScene.speechAnchor!
      const centerY = view.camera.y + view.viewport.height / view.camera.zoom / 2
      expect(Math.abs(centerY - anchor.y)).toBeLessThan(TILE_SIZE * 2)
      for (let i = 0; i < 14; i++) view.tick({ deltaMS: 100 } as Ticker)
      expect(arrived).toHaveBeenCalledTimes(1)
      expect(onView).toHaveBeenLastCalledWith(expect.objectContaining({ layer: 'water', overview: false }))
    })

    it('跨层跟随按 60 帧平滑推进，不会一帧跳出很远', () => {
      renderer.focusHome()
      const route = Array.from({ length: 21 }, (_, i) => ({ x: 27, y: 11 + i }))
      renderer.playExplorationTravel(route, () => {})
      let last = { ...view.camera }
      let maxStep = 0
      for (let i = 0; i < 240; i++) {
        view.tick({ deltaMS: 1000 / 60 } as Ticker)
        maxStep = Math.max(maxStep, Math.abs(view.camera.y - last.y))
        last = { ...view.camera }
      }
      expect(maxStep).toBeLessThan(40)
      expect(maxStep).toBeGreaterThan(0.5)
    })

    it('同一趟行动里玩家拖图，镜头立刻让位；下一趟行动开始再恢复跟随', () => {
      renderer.playExplorationTravel(Array.from({ length: 21 }, (_, i) => ({ x: 27, y: 11 + i })), () => {})
      for (let i = 0; i < 6; i++) view.tick({ deltaMS: 100 } as Ticker)
      renderer.panBy(0, -120)
      const held = { ...view.camera }
      for (let i = 0; i < 5; i++) view.tick({ deltaMS: 100 } as Ticker)
      expect(view.camera).toEqual(held)
      // 这一趟走完，玩家保持自己拖到的位置
      for (let i = 0; i < 30; i++) view.tick({ deltaMS: 100 } as Ticker)
      expect(view.camera).toEqual(held)
      // 阿土开始新一趟：跟随权回来
      const before = view.camera.y
      renderer.playExplorationTravel([{ x: 27, y: 31 }, { x: 27, y: 32 }, { x: 27, y: 33 }, { x: 27, y: 34 }, { x: 27, y: 35 }, { x: 27, y: 36 }], () => {})
      for (let i = 0; i < 8; i++) view.tick({ deltaMS: 100 } as Ticker)
      expect(view.camera.y - before).toBeGreaterThan(80)
    })

    it('全景观察时阿土照走，镜头不被拽回', () => {
      renderer.focusOverview()
      const held = { ...view.camera }
      renderer.playExplorationTravel(Array.from({ length: 9 }, (_, i) => ({ x: 30, y: 8 + i })), () => {})
      for (let i = 0; i < 6; i++) view.tick({ deltaMS: 100 } as Ticker)
      expect(view.camera).toEqual(held)
      expect(renderer.isOverview).toBe(true)
    })

    it('两三格的短走位不硬拉镜头，角色仍留在画面里', () => {
      renderer.focusOn(20 * TILE_SIZE, 11 * TILE_SIZE)
      const held = { ...view.camera }
      renderer.playExplorationTravel([{ x: 19, y: 11 }, { x: 20, y: 11 }, { x: 21, y: 11 }], () => {})
      for (let i = 0; i < 6; i++) view.tick({ deltaMS: 100 } as Ticker)
      expect(view.camera).toEqual(held)
      const anchor = view.explorationScene.speechAnchor!
      const sx = (anchor.x - view.camera.x) * view.camera.zoom
      const sy = (anchor.y - view.camera.y) * view.camera.zoom
      expect(sx).toBeGreaterThan(0)
      expect(sx).toBeLessThan(view.viewport.width)
      expect(sy).toBeGreaterThan(0)
      expect(sy).toBeLessThan(view.viewport.height)
    })
  })

  describe('点亮与阿灯', () => {
    it('还没点亮：阿灯缩在角落，只有尾光、没有名字；阿土照常站在大厅', () => {
      renderer.setWorld(createInitialWorld())
      expect(view.friends).toHaveLength(2)
      const [atu, adeng] = view.friends
      expect(atu.hidden).toBe(false)
      expect(atu.nameLabel?.text).toBe('阿土')
      expect(adeng.hidden).toBe(true)
      expect(adeng.nameLabel).toBeNull()
      expect(adeng.tailGlow).not.toBeNull()
      expect(adeng.view.alpha).toBeLessThan(0.8)
      const sprite = adeng.view.getChildByLabel('adeng-sprite', true) as Sprite
      expect(sprite.texture).toBe(companionArt.adeng!.idle)
      const light = adeng.view.getChildByLabel('adeng-tail-light', true) as Graphics
      expect(light.context.instructions).toHaveLength(0)
      // 她躲在右边角落，和阿土分开
      expect(adeng.view.x).toBeGreaterThan(atu.view.x)
    })

    it('点亮之后：阿灯从角落飞出来，落地后有名字、不再躲着', () => {
      const world = createInitialWorld()
      world.progress = { crystalFound: true, crystalCollected: true, coreRepaired: false }
      renderer.setWorld(world)
      const adeng = view.friends[1]
      expect(adeng.hidden).toBe(true)
      const cornerX = adeng.view.x

      world.progress.coreRepaired = true
      const reveal = vi.fn()
      renderer.onPartnerReveal = reveal
      renderer.playRepairCelebration()
      // 会话会分配真实伙伴站位并刷新地图；这不能跳过阿灯的出场。
      initializeWorkers(world)
      renderer.refresh()
      expect(view.friends[1].hidden).toBe(true)
      // 安装 0.7s + 延迟 0.7s + 飞行 1.25s，留足帧数
      for (let i = 0; i < 220; i++) view.tick({ deltaMS: 16 } as Ticker)

      const arrived = view.friends[1]
      expect(reveal.mock.calls.map(call => call[0])).toEqual(['appearing', 'ready'])
      expect(arrived.hidden).toBe(false)
      expect(arrived.view.x).not.toBeCloseTo(cornerX, 0)
      expect(arrived.view.alpha).toBeCloseTo(1, 2)
      expect(arrived.nameLabel?.text).toBe('阿灯')
      expect(arrived.tailGlow).toBeNull()
      const light = arrived.view.getChildByLabel('adeng-tail-light', true) as Graphics
      expect(light.context.instructions.length).toBeGreaterThan(0)
    })

    it('每个伙伴带着自己的物种 id：画出来的不是同一个球', () => {
      const world = createInitialWorld()
      world.progress = { crystalFound: true, crystalCollected: true, coreRepaired: true }
      renderer.setWorld(world)
      expect(view.friends.map((friend) => friend.partnerId)).toEqual(['atu', 'adeng'])
      for (let y = 10; y <= 11; y++) for (let x = 12; x < 15; x++) dig(world, x, y)
      placePod(world, 12, 10)
      renderer.refreshPods()
      renderer.refreshFriends()
      // 只建好第一层的床，小满还在下面，不会有第三位。
      expect(view.friends.map((friend) => friend.partnerId)).toEqual(['atu', 'adeng'])
      world.exploration.entered = true
      renderer.refreshFriends()
      // 下到泉水层才遇见小满；她站在下面的洞穴里。
      expect(view.friends.map((friend) => friend.partnerId)).toEqual(['atu', 'adeng', 'xiaoman'])
      expect(view.friends[2].view.x).toBeCloseTo(25.4 * TILE_SIZE, 5)
    })

    it('已点亮的存档直接站着，不重播飞出来的演出', () => {
      const world = createInitialWorld()
      world.progress = { crystalFound: true, crystalCollected: true, coreRepaired: true }
      renderer.setWorld(world)
      const adeng = view.friends[1]
      expect(adeng.hidden).toBe(false)
      expect(adeng.nameLabel?.text).toBe('阿灯')
      expect(view.podEntrance).toBeNull()
    })
  })

  describe('睡眠舱入场与休息', () => {
  function carvedWorld() {
    const next = createInitialWorld()
    next.progress = { crystalFound: true, crystalCollected: true, coreRepaired: true }
    for (let y = 10; y < 12; y++) for (let x = 12; x < 15; x++) dig(next, x, y)
    return next
  }

  it('四位伙伴保留各自轮廓、原落点和名字；播放动画不改变世界', () => {
    const next = carvedWorld()
    placePod(next, 12, 10)
    next.exploration.entered = true
    next.exploration.springFound = true
    renderer.setWorld(next)
    const snapshot = JSON.stringify(next)
    for (const id of ['adeng', 'xiaoman', 'xiaoquan'] as const) {
      const friend = view.friends.find((friend) => friend.partnerId === id)!
      const sprite = friend.view.getChildByLabel(`${id}-sprite`, true) as Sprite
      expect(sprite).not.toBeNull()
      expect(friend.body.visible).toBe(false)
      expect(sprite.texture).toBe(friend.pose === 'rest' ? companionArt[id]!.rest : companionArt[id]!.idle)
      if (friend.pose !== 'rest') {
        // 小满在泉水层、小泉在大厅：两人都不该凭空出现在同一块地面。
        expect(friend.nameLabel?.text).toBe(id === 'xiaoman' ? '小满' : '小泉')
      }
    }
    const rabbit = view.friends[2].view.getChildByLabel('xiaoman-sprite', true) as Sprite
    const otter = view.friends[3].view.getChildByLabel('xiaoquan-sprite', true) as Sprite
    expect(rabbit.height).toBe(44)
    expect(otter.height).toBe(40)
    for (let i = 0; i < 70; i++) view.tick({ deltaMS: 100 } as Ticker)
    expect(JSON.stringify(next)).toBe(snapshot)
  })

  it('某一位素材失败只使用她的备用造型，其他伙伴继续使用图片', async () => {
    vi.mocked(loadCompanionTextures).mockResolvedValueOnce({ ...companionArt, adeng: null })
    const fallback = await PixiWorldRenderer.create({ appendChild: vi.fn() } as unknown as HTMLElement)
    try {
      const next = carvedWorld()
      placePod(next, 12, 10)
      next.exploration.entered = true
      next.exploration.springFound = true
      fallback.setWorld(next)
      const probe = fallback as unknown as TerrainProbe
      expect(probe.friends[1].body.visible).toBe(true)
      expect(probe.friends[1].view.getChildByLabel('adeng-sprite', true)).toBeNull()
      expect(probe.friends[2].view.getChildByLabel('xiaoman-sprite', true)).not.toBeNull()
      expect(probe.friends[3].view.getChildByLabel('xiaoquan-sprite', true)).not.toBeNull()
      expect(probe.friends[0].view.getChildByLabel('atu-sprite', true)).not.toBeNull()
    } finally { fallback.destroy() }
  })

  it('四位入住后使用各自闭眼头部，32px兔耳也装得进原床位', () => {
    const next = carvedWorld()
    placePod(next, 12, 10)
    next.exploration.entered = true
    next.exploration.springFound = true
    for (let y = 9; y <= 11; y++) for (let x = 5; x < 15; x++) if (next.tiles[y][x] === TILE.SOIL) dig(next, x, y)
    placePod(next, 7, 10)
    renderer.setWorld(next)
    for (const id of ['adeng', 'xiaoman', 'xiaoquan'] as const) {
      const friend = view.friends.find((friend) => friend.partnerId === id)!
      const sprite = friend.view.getChildByLabel(`${id}-sprite`, true) as Sprite
      expect(sprite.texture).toBe(companionArt[id]!.rest)
      expect(friend.view.getChildByLabel(`${id}-quilt`, true)?.visible).toBe(true)
      expect(sprite.height * friend.view.scale.y).toBeLessThan(24)
      expect(friend.nameLabel).toBeNull()
    }
  })

  it('载入带睡眠舱的存档时：老住户直接睡在床上，第二层的小满在洞穴里等床', () => {
    const saved = carvedWorld()
    const pod = placePod(saved, 12, 10)!
    saved.exploration.entered = true
    renderer.setWorld(saved)
    const beds = bedSlots(pod)
    expect(view.podEntrance).toBeNull()
    // 阿土和阿灯睡在床上；小满在泉水层的洞穴里，还等着自己的床。
    expect(view.friends).toHaveLength(3)
    const sleeping = view.friends.filter((friend) => friend.pose === 'rest')
    expect(sleeping).toHaveLength(2)
    sleeping.forEach((friend, i) => {
      expect(friend.bed).toEqual(beds[i])
      expect(friend.view.x).toBeCloseTo(beds[i].x, 5)
      expect(friend.view.y).toBeCloseTo(beds[i].y, 5)
      expect(friend.view.scale.x).toBeCloseTo(0.65, 5)
    })
    const waiting = view.friends.find((friend) => friend.pose === 'idle')
    expect(waiting?.bed).toBeNull()
    expect(waiting?.nameLabel?.text).toBe('小满')
    expect(waiting?.view.x).toBeCloseTo(25.4 * TILE_SIZE, 5)
    expect(waiting?.view.y).toBe(22 * TILE_SIZE - 13)
    const atu = sleeping[0]
    const sprite = atu.view.getChildByLabel('atu-sprite', true) as Sprite
    expect(sprite.texture).toBe(moleArt.rest)
    expect(atu.view.getChildByLabel('atu-quilt', true)?.visible).toBe(true)
    expect(sprite.height * atu.view.scale.y).toBeLessThan(24)
  })

  it('建成刷新只重建舱体，伙伴仍留在避难所等待出发', () => {
    const next = carvedWorld()
    renderer.setWorld(next)
    const beforeY = view.friends[0].view.y
    placePod(next, 12, 10)
    renderer.refreshPods()
    expect(view.podEntrance).toBeNull()
    expect(view.friends[0].pose).toBe('idle')
    expect(view.friends[0].view.y).toBe(beforeY)
    expect(view.podLayer.children).toHaveLength(1)
  })

  it('建好第一间床：只有老住户入住；下到第二层才遇见小满', () => {
    const next = carvedWorld()
    renderer.setWorld(next)
    // 还没有床：阿土和阿灯站着，各自带着名字
    expect(view.friends.map((friend) => friend.nameLabel?.text)).toEqual(['阿土', '阿灯'])
    const pod = placePod(next, 12, 10)!
    renderer.refreshPods()
    renderer.refreshFriends(pod.id)
    // 第一层的床只让老住户入住，不会凭空多出一只兔子。
    expect(view.friends).toHaveLength(2)
    renderer.playPodEntrance(pod, () => {})
    for (let i = 0; i < 240; i++) view.tick({ deltaMS: 16 } as Ticker)
    expect(view.friends.map((friend) => friend.pose)).toEqual(['rest', 'rest'])
    expect(view.friends.every((friend) => friend.nameLabel === null)).toBe(true)

    // 下到泉水层：小满出现在下面的洞穴里，名字牌亮着。
    next.exploration.entered = true
    renderer.refreshFriends()
    expect(view.friends).toHaveLength(3)
    const rabbit = view.friends.find((friend) => friend.partnerId === 'xiaoman')!
    expect(rabbit.pose).toBe('idle')
    expect(rabbit.nameLabel?.text).toBe('小满')
    expect(rabbit.view.x).toBeCloseTo(25.4 * TILE_SIZE, 5)
  })

  it('建成后沿空洞通道走到舱门，钻进被窝才触发庆祝回调', () => {
    const next = carvedWorld()
    renderer.setWorld(next)
    const pod = placePod(next, 12, 10)!
    renderer.refreshPods()
    let posesAtSettle: string[] = []
    const settled = vi.fn(() => {
      posesAtSettle = view.friends.map((friend) => friend.pose)
    })
    renderer.playPodEntrance(pod, settled)
    expect(settled).not.toHaveBeenCalled()

    for (let i = 0; i < 40; i++) view.tick({ deltaMS: 16 } as Ticker)
    expect(view.friends[0].pose).not.toBe('rest')
    expect(settled).not.toHaveBeenCalled()

    for (let i = 0; i < 200; i++) view.tick({ deltaMS: 16 } as Ticker)
    const beds = bedSlots(pod)
    expect(settled).toHaveBeenCalledTimes(1)
    expect(posesAtSettle).toEqual(['rest', 'rest'])
    view.friends.forEach((friend, i) => {
      expect(friend.pose).toBe('rest')
      expect(friend.view.x).toBeCloseTo(beds[i].x, 5)
      // 休息时会有 ±1.2px 的呼吸起伏
      expect(Math.abs(friend.view.y - beds[i].y)).toBeLessThanOrEqual(1.5)
    })
  })

  it('路径不可达时兜底直接上床，不把伙伴留在半路', () => {
    renderer.setWorld(createInitialWorld())
    const stranded: SleepPod = { id: 7, x: 9, y: 13, door: 'right' }
    const settled = vi.fn()
    renderer.playPodEntrance(stranded, settled)
    expect(settled).toHaveBeenCalledTimes(1)
    expect(view.podEntrance).toBeNull()
    expect(view.friends.every((friend) => friend.pose === 'rest')).toBe(true)
  })

  it('进入第二层、水还没找到就建了第二间床：只渲染三位伙伴，空一个床位等小泉', () => {
    const next = carvedWorld()
    placePod(next, 12, 10)
    next.exploration.entered = true
    for (let y = 9; y <= 11; y++) for (let x = 5; x < 15; x++) if (next.tiles[y][x] === TILE.SOIL) dig(next, x, y)
    expect(placePod(next, 7, 10)).not.toBeNull()
    renderer.setWorld(next)
    expect(view.friends).toHaveLength(3)
    expect(view.friends.map((friend) => friend.pose)).toEqual(['rest', 'rest', 'rest'])
  })

  it('找到水之后，泉水层和营地各多出一位等床的新朋友', () => {
    const next = carvedWorld()
    placePod(next, 12, 10)
    next.exploration.entered = true
    next.exploration.springFound = true
    renderer.setWorld(next)
    expect(view.friends).toHaveLength(4)
    expect(view.friends.map((friend) => friend.pose)).toEqual(['rest', 'rest', 'idle', 'idle'])
  })

  it('第二间舱的入场只搬新舱那两位，老住户继续睡在自己的床上', () => {
    const next = carvedWorld()
    placePod(next, 12, 10)
    next.exploration.entered = true
    next.exploration.springFound = true
    renderer.setWorld(next)
    for (let y = 9; y <= 11; y++) for (let x = 5; x < 15; x++) if (next.tiles[y][x] === TILE.SOIL) dig(next, x, y)
    const second = placePod(next, 7, 10)!
    renderer.refreshPods()
    renderer.refreshFriends(second.id)
    // 入场前：新舱两位站在大厅，老住户还在床上
    expect(view.friends.map((friend) => friend.pose)).toEqual(['rest', 'rest', 'idle', 'idle'])
    const firstBedX = view.friends[0].view.x

    const settled = vi.fn()
    renderer.playPodEntrance(second, settled)
    for (let i = 0; i < 240; i++) view.tick({ deltaMS: 16 } as Ticker)
    expect(settled).toHaveBeenCalledTimes(1)
    const beds = bedSlots(second)
    expect(view.friends[0].view.x).toBeCloseTo(firstBedX, 5)
    view.friends.slice(2).forEach((friend, i) => {
      expect(friend.pose).toBe('rest')
      expect(Math.abs(friend.view.x - beds[i].x)).toBeLessThanOrEqual(0.001)
    })
  })

  it('种植槽与水管：按档位画出不同外观，引水之后才出现水管', () => {
    const next = carvedWorld()
    placePod(next, 12, 10)
    next.exploration.entered = true
    next.exploration.springFound = true
    for (let y = 9; y <= 11; y++) for (let x = 5; x < 11; x++) if (next.tiles[y][x] === TILE.SOIL) dig(next, x, y)
    next.farm.planters.push(
      { id: 1, x: 6, y: 11, growth: 0 },
      { id: 2, x: 7, y: 11, growth: 1 },
      { id: 3, x: 8, y: 11, growth: 2 },
      { id: 4, x: 9, y: 11, growth: 3 },
    )
    renderer.setWorld(next)
    // 还没引水：只有四个槽，没有水管
    expect(view.farmLayer.children).toHaveLength(4)

    next.farm.waterSupplied = true
    renderer.refreshFarm()
    expect(view.farmLayer.children).toHaveLength(5)

    // 四个档位画的不是同一套图形（造型按档位变化）
    const shapes = view.farmLayer.children.slice(1).map((child) => {
      const g = child.children[0] as unknown as { context: { instructions: unknown[] } }
      return g.context.instructions.length
    })
    expect(shapes).toHaveLength(4)
    expect(new Set(shapes).size).toBeGreaterThan(1)
  })

  it('两间舱的存档重新载入：四位伙伴各自睡在自己的舱里', () => {
    const next = carvedWorld()
    placePod(next, 12, 10)
    next.exploration.entered = true
    next.exploration.springFound = true
    for (let y = 9; y <= 11; y++) for (let x = 5; x < 15; x++) if (next.tiles[y][x] === TILE.SOIL) dig(next, x, y)
    placePod(next, 7, 10)
    renderer.setWorld(next)
    expect(view.podEntrance).toBeNull()
    expect(view.podLayer.children).toHaveLength(2)
    expect(view.friends).toHaveLength(4)
    const first = bedSlots(next.pods[0])
    const second = bedSlots(next.pods[1])
    expect(view.friends.map((friend) => friend.pose)).toEqual(['rest', 'rest', 'rest', 'rest'])
    expect(view.friends[0].view.x).toBeCloseTo(first[0].x, 5)
    expect(view.friends[1].view.x).toBeCloseTo(first[1].x, 5)
    expect(view.friends[2].view.x).toBeCloseTo(second[0].x, 5)
    expect(view.friends[3].view.x).toBeCloseTo(second[1].x, 5)
  })
  })
})
