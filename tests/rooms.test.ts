import { describe, expect, it, vi } from 'vitest'
import { Container, Texture, TextureSource } from 'pixi.js'
import { createInitialWorld, TILE, WORLD_VERSION, type Room } from '../src/core/world'
import { checkRoom, removeRoom, roomFromPoint, roomSummary, saveRoom } from '../src/core/rooms'
import { createWorldHistory } from '../src/core/history'
import { canPlacePod, canRestoreDig, placePod } from '../src/core/build'
import { atuRoute } from '../src/core/atu'
import { canPlacePlanter } from '../src/core/farm'
import { deserialize, serialize } from '../src/core/persistence'
import { RoomEditor, type RoomUI } from '../src/app/roomEditor'
import { RoomScene } from '../src/render/roomScene'

function ready() {
  const w = createInitialWorld()
  w.progress = { crystalFound: true, crystalCollected: true, secondCrystalFound: true, secondCrystalCollected: true, coreLoaded: true, coreRepaired: true }
  for (let x = 2; x <= 15; x++) for (let y = 9; y <= 11; y++) w.tiles[y][x] = TILE.EMPTY
  for (let x = 26; x <= 41; x++) for (let y = 9; y <= 11; y++) w.tiles[y][x] = TILE.EMPTY
  return w
}
const room = (x: number, width = 3, kind: Room['kind'] = 'home') => roomFromPoint({ x: x + Math.floor(width / 2), y: 11 }, width, kind)

describe('房间标记遵守洞室与设施边界', () => {
  it('左右两翼都能自由选址，三种用途不新增资源、床位或种植解锁', () => {
    const w = ready(), before = structuredClone(w)
    for (const r of [room(11), room(28, 5, 'garden'), room(34, 4, 'lounge')]) {
      expect(checkRoom(w, r).ok).toBe(true)
      expect(saveRoom(w, r)).not.toBeNull()
    }
    expect(w.rooms).toHaveLength(3)
    expect(w).toEqual({ ...before, rooms: w.rooms, nextRoomId: 4 })
    expect(canPlacePlanter(w, 30, 11)).toEqual({ ok: false, reason: 'no-water' })
    expect(roomSummary(w, w.rooms[1])).toContain('预留')
  })

  it.each([
    [{ ...room(11), x: -1 }, 'bounds'], [{ ...room(11), w: 2 }, 'bounds'], [{ ...room(11), w: 10 }, 'bounds'],
    [{ ...room(11), y: 19 }, 'layer'], [room(14), 'reserved'], [room(26), 'reserved'], [room(19), 'reserved'],
  ] as const)('拒绝非法区域：%j', (r, reason) => {
    const w = ready(), before = structuredClone(w)
    expect(checkRoom(w, r as Room)).toEqual({ ok: false, reason })
    expect(saveRoom(w, r as Room)).toBeNull()
    expect(w).toEqual(before)
  })

  it('未挖空、悬空、没接通大厅和未点亮都不能直接划房间', () => {
    const w = ready()
    w.tiles[9][12] = TILE.SOIL
    expect(checkRoom(w, room(11))).toEqual({ ok: false, reason: 'soil' })
    w.tiles[9][12] = TILE.EMPTY; w.tiles[12][12] = TILE.EMPTY
    expect(checkRoom(w, room(11))).toEqual({ ok: false, reason: 'support' })
    w.tiles[12][12] = TILE.ROCK; w.tiles[11][14] = TILE.SOIL
    expect(checkRoom(w, room(9))).toEqual({ ok: false, reason: 'access' })
    w.progress.coreRepaired = false
    expect(checkRoom(w, room(28))).toEqual({ ok: false, reason: 'power' })
  })

  it('区域之间不能重叠，自己的草稿可调整；未知用途不能保存', () => {
    const w = ready(), added = saveRoom(w, room(10))!.after!
    expect(checkRoom(w, room(11))).toEqual({ ok: false, reason: 'overlap' })
    expect(saveRoom(w, { ...added, x: 9, w: 5 })?.after).toMatchObject({ id: added.id, x: 9, w: 5 })
    const before = structuredClone(w)
    expect(saveRoom(w, { ...room(28), kind: 'future-lab' } as unknown as Room)).toBeNull()
    expect(w).toEqual(before)
  })

  it('标记可以包住原双人床，不能切开床；在房间里建床也不能跨边界', () => {
    const w = ready(), pod = placePod(w, 12, 10)!
    expect(checkRoom(w, room(11))).toEqual({ ok: false, reason: 'facility' })
    const added = saveRoom(w, room(12))!.after!
    expect(roomSummary(w, added)).toContain('2个床位')
    expect(w.pods[0]).toEqual(pod)
    saveRoom(w, room(29, 4, 'garden'))
    expect(canPlacePod(w, 31, 10)).toEqual({ ok: false, reason: 'room' })
    expect(canPlacePod(w, 29, 10).ok).toBe(true)
  })

  it('房间和门框不挡阿土；混合用途不改变原设施效果', () => {
    const w = ready(), before = atuRoute(w, { x: 18, y: 11 }, { x: 10, y: 11 })
    saveRoom(w, room(9, 5, 'garden'))
    expect(atuRoute(w, { x: 18, y: 11 }, { x: 10, y: 11 })).toEqual(before)
    expect(canPlacePod(w, 10, 10).ok).toBe(true)
    expect(w.farm.waterSupplied).toBe(false)
  })

  it('房间创建、调整、移除可逐步撤销，不删除设施、不复用已发出的编号', () => {
    const w = ready(), history = createWorldHistory(), pod = placePod(w, 12, 10)!
    const created = saveRoom(w, room(12))!; history.record({ kind: 'room', change: created })
    const updated = saveRoom(w, { ...created.after!, kind: 'garden' })!; history.record({ kind: 'room', change: updated })
    const removed = removeRoom(w, created.after!.id)!; history.record({ kind: 'room', change: removed })
    expect(w.rooms).toHaveLength(0); expect(w.pods).toEqual([pod])
    expect(history.undo(w)?.kind).toBe('room'); expect(w.rooms[0].kind).toBe('garden')
    history.undo(w); expect(w.rooms[0].kind).toBe('home')
    history.undo(w); expect(w.rooms).toHaveLength(0)
    expect(saveRoom(w, room(12))!.after!.id).toBe(2)
  })

  it('房间内旧挖掘不能被填回去；先撤房间标记后才允许恢复土', () => {
    const w = ready(), change = saveRoom(w, room(12))!
    expect(canRestoreDig(w, 12, 9)).toBe(false)
    removeRoom(w, change.after!.id)
    expect(canRestoreDig(w, 12, 9)).toBe(true)
  })
})

describe('房间草稿与存档兼容', () => {
  it('旧床顶部没清空时自动适配两格洞室，选择和取消均不改世界', () => {
    const w = ready(); for (const x of [12, 13]) w.tiles[9][x] = TILE.SOIL
    placePod(w, 12, 10)
    const before = structuredClone(w), states: RoomUI[] = []
    const editor = new RoomEditor({ world: () => w, emit: s => states.push(s), preview: vi.fn(), commit: vi.fn(), notify: vi.fn() })
    editor.open(); editor.tap({ x: 13, y: 11 })
    expect(states.at(-1)).toMatchObject({ valid: true, width: 3, dirty: true })
    expect(w).toEqual(before)
    editor.save()
    expect(w.rooms[0]).toMatchObject({ x: 12, y: 10, h: 2 })
    const saved = structuredClone(w)
    editor.resize(2); editor.chooseKind('garden'); editor.close()
    expect(w).toEqual(saved)
    editor.open(); editor.select(w.rooms[0].id)
    expect(states.at(-1)).toMatchObject({ construction: true, dirty: true, action: '确认建成' })
  })

  it('草稿宽度调整不自动保存，点水层不误创建首层房间', () => {
    const w = ready(), states: RoomUI[] = []
    const editor = new RoomEditor({ world: () => w, emit: s => states.push(s), preview: vi.fn(), commit: vi.fn(), notify: vi.fn() })
    editor.open(); editor.tap({ x: 13, y: 11 }); editor.resize(2)
    expect(states.at(-1)).toMatchObject({ width: 5, valid: true })
    expect(w.rooms).toHaveLength(0)
    editor.tap({ x: 30, y: 21 }); editor.save()
    expect(w.rooms).toHaveLength(0)
    expect(states.at(-1)?.valid).toBe(false)
  })

  it('v8迁移不挪地形或设施，也不自动圈房间；v9保存实际区域', () => {
    const w = ready(); placePod(w, 12, 10)
    const v8 = serialize(w); v8.version = 8
    const migrated = deserialize(v8)
    expect(migrated.ok).toBe(true)
    if (!migrated.ok) return
    expect(migrated.world.rooms).toEqual([])
    expect(migrated.world.pods).toEqual(w.pods)
    expect(migrated.world.tiles).toEqual(w.tiles)
    saveRoom(migrated.world, room(12))
    const payload = serialize(migrated.world), loaded = deserialize(payload)
    expect(payload.version).toBe(WORLD_VERSION)
    expect(loaded.ok && loaded.world).toEqual(migrated.world)
  })

  it('重复编号、未知用途、越界范围与非法下一编号都给出加载失败', () => {
    const w = ready(); saveRoom(w, room(12))
    const payload = serialize(w)
    for (const mutate of [
      (p: typeof payload) => { p.world.rooms.push({ ...p.world.rooms[0] }) },
      (p: typeof payload) => { p.world.rooms[0].kind = 'lab' as Room['kind'] },
      (p: typeof payload) => { p.world.rooms[0].x = 19 },
      (p: typeof payload) => { p.world.nextRoomId = 1 },
    ]) {
      const changed = structuredClone(payload); mutate(changed)
      const loaded = deserialize(changed)
      expect(loaded.ok).toBe(false)
      if (!loaded.ok) expect(loaded.error).toContain('房间')
    }
  })

  it('房间表现不修改世界，全景隐藏标牌以免挤成一团', () => {
    const w = ready(); saveRoom(w, room(12))
    const before = structuredClone(w), scene = new RoomScene()
    scene.refresh(w, null)
    expect(scene.view.children).toHaveLength(1)
    const badge = (scene.view.children[0] as import('pixi.js').Container).getChildByLabel('room-name')!
    scene.setZoom(.7); expect(badge.visible).toBe(false)
    scene.setZoom(1); expect(badge.visible).toBe(true)
    expect(w).toEqual(before)
    scene.view.destroy({ children: true }); scene.overlay.destroy({ children: true })
  })

  it('客厅图片适配旧窄房间，保持比例且刷新不修改世界或销毁共享素材', () => {
    const w = ready()
    const change = saveRoom(w, room(28, 4, 'lounge'))!
    w.rooms.find(r => r.id === change.after!.id)!.managed = true
    const before = structuredClone(w), scene = new RoomScene()
    const textures = {
      shell: new Texture({ source: new TextureSource({ width: 1600, height: 960 }) }),
      furniture: new Texture({ source: new TextureSource({ width: 2100, height: 700 }) }),
    }
    scene.setLoungeTextures(textures)
    for (let i = 0; i < 2; i++) {
      scene.refresh(w, null); scene.update(i)
      const art = (scene.view.children[0] as Container).getChildByLabel('lounge-art') as Container
      expect(art).not.toBeNull()
      const shell = art.getChildByLabel('lounge-shell')!, furniture = art.getChildByLabel('lounge-furniture')!
      expect(shell.width / shell.height).toBeCloseTo(5 / 3)
      expect(furniture.width / furniture.height).toBeCloseTo(3)
      expect(art.y + shell.height).toBeCloseTo(12 * 32)
      expect(furniture.y + furniture.height).toBeLessThan(shell.height)
      expect(w).toEqual(before)
      expect(textures.shell.destroyed).toBe(false)
    }
    scene.view.destroy({ children: true }); scene.overlay.destroy({ children: true })
    textures.shell.destroy(true); textures.furniture.destroy(true)
  })
})
