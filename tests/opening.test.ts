import { describe, expect, it } from 'vitest'
import { createInitialWorld, LANDMARKS, SURFACE_Y, TILE, TILE_SIZE as T } from '../src/core/world'
import { OPENING_BEATS as B, OPENING_DURATION, openingFrame, openingWeatherAt } from '../src/render/openingTimeline'
import { initialAtuPosition } from '../src/core/atu'

const shaftX = (LANDMARKS.shaft.x + LANDMARKS.shaft.w / 2) * T

describe('开场路线', () => {
  it('全程身体处于地表上方或现有空洞，下行始终贴住入口梯子', () => {
    const world = createInitialWorld(), destination = initialAtuPosition(world)
    for (let t = 0; t <= OPENING_DURATION; t += 1 / 120) {
      const frame = openingFrame(t, (destination.x + .5) * T)
      // 32px身体、40px身高，含整个头盔而非只检验脚底中心。
      for (const x of [frame.x - 16, frame.x + 16]) for (const y of [frame.footY - 40, frame.footY]) {
        if (y >= SURFACE_Y * T) expect(world.tiles[Math.floor(y / T)][Math.floor(x / T)], `t=${t}`).toBe(TILE.EMPTY)
      }
      if (frame.pose === 'climb' || frame.phase === 'shelter') expect(frame.x).toBe(shaftX)
    }
    const end = openingFrame(OPENING_DURATION, (destination.x + .5) * T)
    expect(end.x).toBe((destination.x + .5) * T)
    expect(end.footY).toBe((destination.y + 1) * T - 2)
    expect(end.pullback).toBe(1)
  })

  it('停顿前后不倒退、不瞬移，下梯与大厅行走连续衔接', () => {
    let previous = openingFrame(0, 18.5 * T)
    for (let t = 1 / 120; t <= OPENING_DURATION; t += 1 / 120) {
      const frame = openingFrame(t, 18.5 * T)
      if (t < B.walk) expect(frame.x).toBeGreaterThanOrEqual(previous.x)
      expect(Math.abs(frame.x - previous.x)).toBeLessThan(2)
      expect(Math.abs(frame.footY - previous.footY)).toBeLessThan(2)
      previous = frame
    }
    expect(openingFrame(-10, shaftX)).toEqual(openingFrame(0, shaftX))
    expect(openingFrame(100, shaftX)).toEqual(openingFrame(OPENING_DURATION, shaftX))
  })
})

describe('开场天气变化', () => {
  it('风暴在跑向入口时增强到峰值', () => {
    const start = openingWeatherAt(0)
    const peak = openingWeatherAt(B.enter)
    expect(peak.wind).toBeGreaterThan(start.wind)
    expect(peak.snow).toBeGreaterThan(start.snow)
    expect(peak.cloud).toBeGreaterThan(start.cloud)
    expect(peak.wind).toBeGreaterThan(1.4)
    expect(peak.snow).toBeGreaterThan(1.3)
  })

  it('进入地下后逐步减弱，结尾仍有风雪但明显低于开场', () => {
    const peak = openingWeatherAt(B.enter)
    const entering = openingWeatherAt(B.walk)
    const underground = openingWeatherAt(B.core + .2)
    const ending = openingWeatherAt(OPENING_DURATION)
    expect(entering.wind).toBeLessThan(peak.wind)
    expect(underground.wind).toBeLessThan(entering.wind)
    expect(underground.snow).toBeLessThan(entering.snow)
    expect(ending.wind).toBeGreaterThan(.9)
    expect(ending.snow).toBeGreaterThan(.85)
    expect(ending.wind).toBeLessThan(openingWeatherAt(0).wind)
    expect(ending.snow).toBeLessThan(openingWeatherAt(0).snow)
  })

  it('分段边界平滑，且所有参数在有限范围内', () => {
    for (const boundary of Object.values(B)) {
      const before = openingWeatherAt(boundary - .0001)
      const after = openingWeatherAt(boundary + .0001)
      expect(Math.abs(after.wind - before.wind)).toBeLessThan(.01)
      expect(Math.abs(after.snow - before.snow)).toBeLessThan(.01)
      expect(Math.abs(after.cloud - before.cloud)).toBeLessThan(.01)
    }
    for (let t = -1; t < OPENING_DURATION + 1; t += .05) {
      const weather = openingWeatherAt(t)
      expect(weather.wind).toBeGreaterThanOrEqual(.9)
      expect(weather.wind).toBeLessThanOrEqual(1.5)
      expect(weather.snow).toBeGreaterThanOrEqual(.85)
      expect(weather.snow).toBeLessThanOrEqual(1.45)
      expect(weather.cloud).toBeGreaterThanOrEqual(0)
      expect(weather.cloud).toBeLessThanOrEqual(1)
    }
    expect(openingWeatherAt(-10)).toEqual(openingWeatherAt(0))
    expect(openingWeatherAt(100)).toEqual(openingWeatherAt(OPENING_DURATION))
  })
})

describe('开场发现入口演出', () => {
  it('每句至少留两秒停住读；先喊冷、再发现入口、避风后才感到暖和', () => {
    const beats = [
      { start: B.cold, end: B.notice, text: '好冷', phase: 'cold' },
      { start: B.notice, end: B.approach, text: '入口', phase: 'notice' },
      { start: B.sheltered, end: B.climb, text: '暖和', phase: 'shelter' },
    ]
    for (const beat of beats) {
      expect(beat.end - beat.start).toBeGreaterThanOrEqual(2)
      const start = openingFrame(beat.start, shaftX)
      for (let t = beat.start; t < beat.end; t += .05) {
        const frame = openingFrame(t, shaftX)
        expect(frame.speech).toContain(beat.text)
        expect(frame.phase).toBe(beat.phase)
        expect(frame.pose).toBe('idle')
        expect(frame.x).toBe(start.x)
        expect(frame.footY).toBe(start.footY)
        expect(frame.cameraY).toBe(start.cameraY)
      }
    }
    expect(openingFrame(1.5, shaftX).shiver).toBeGreaterThan(.9)
    const notice = openingFrame(B.notice + .3, shaftX)
    expect(notice.notice).toBeGreaterThan(.9)
    expect(notice.warmth).toBe(0)
    const warm = openingFrame(B.sheltered + .7, shaftX)
    expect(warm.shiver).toBe(0)
    expect(warm.warmth).toBe(1)
    expect(warm.warmBurst).toBeGreaterThan(.5)
    expect(warm.footY).toBeGreaterThan(SURFACE_Y * T)
  })

  it('地面发现时亮起入口灯，靠近后才暖和；下梯后交给核心和蓝光', () => {
    expect(openingFrame(B.notice - .1, shaftX).entranceGlow).toBe(0)
    expect(openingFrame(B.approach, shaftX).entranceGlow).toBe(1)
    for (let t = 0; t <= B.enter; t += .1) expect(openingFrame(t, shaftX).warmth).toBe(0)
    for (const t of [0, B.approach + .3, B.enter + .2, B.climb + .5, B.core + .2, B.clue + .3]) {
      expect(openingFrame(t, shaftX).speech).toBe('')
    }
    expect(openingFrame(B.core + .2, shaftX).caption).toContain('能源核心')
    expect(openingFrame(B.clue + .7, shaftX).clue).toBe(1)
    expect(openingFrame(OPENING_DURATION, shaftX).pullback).toBe(1)
  })
})
