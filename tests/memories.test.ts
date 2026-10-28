import { describe, expect, it } from 'vitest'
import { createInitialWorld, type MemoryEntry } from '../src/core/world'
import { deserialize, serialize } from '../src/core/persistence'

describe('生活记录', () => {
  it('记录随带版本号存档往返保留', () => {
    const world = createInitialWorld()
    const entry: MemoryEntry = { id: 1, kind: 'note', title: '一起种薄荷', body: '和爸爸给花盆浇了水。', createdAt: '2026-10-27T03:00:00.000Z' }
    world.memories = { entries: [entry], nextId: 2 }
    const loaded = deserialize(serialize(world))
    expect(loaded.ok).toBe(true)
    if (loaded.ok) expect(loaded.world.memories).toEqual(world.memories)
  })

  it('旧版存档自动补成空记忆匣，损坏的媒体记录会被拒绝', () => {
    const raw = serialize(createInitialWorld()) as any
    raw.version = 24
    delete raw.world.memories
    const migrated = deserialize(raw)
    expect(migrated.ok && migrated.world.memories).toEqual({ entries: [], nextId: 1 })

    const bad = serialize(createInitialWorld()) as any
    bad.world.memories.entries.push({ id: 1, kind: 'photo', title: '坏照片', body: '', createdAt: '2026-10-27T03:00:00.000Z' })
    bad.world.memories.nextId = 2
    expect(deserialize(bad)).toMatchObject({ ok: false, error: '存档生活记录数据无效' })
  })
})
