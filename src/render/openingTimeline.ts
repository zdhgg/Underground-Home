import { HOME_OWNER } from '../core/personal'
import { HOME_FLOOR_Y, LANDMARKS, SURFACE_Y, TILE_SIZE as T } from '../core/world'
import type { SurfaceWeatherProfile } from './surfaceWeather'

/** 留出读短句和看动作的停顿；镜头、声音和天气共用这些节拍。 */
export const OPENING_BEATS = {
  cold: .7,
  notice: 3.2,
  approach: 5.6,
  enter: 7,
  sheltered: 7.6,
  climb: 9.8,
  walk: 12,
  core: 12.85,
  clue: 14.05,
  /** 蓝光找到后，给玩家一段只属于自己家园的停留。 */
  home: 14.8,
  pullback: 16.55,
  end: 18.1,
} as const
export const OPENING_DURATION = OPENING_BEATS.end
const B = OPENING_BEATS
const shaftX = (LANDMARKS.shaft.x + LANDMARKS.shaft.w / 2) * T
const ground = SURFACE_Y * T
const floor = HOME_FLOOR_Y * T - 2
const clamp = (k: number) => Math.max(0, Math.min(1, k))
const mix = (a: number, b: number, k: number) => a + (b - a) * clamp(k)
const smooth = (k: number) => { const t = clamp(k); return t * t * (3 - 2 * t) }
const progress = (t: number, start: number, end: number) => smooth((t - start) / (end - start))

/** 地上始终有风雪；避风后的安全感来自入口和阿土的反应。 */
export function openingWeatherAt(seconds: number): SurfaceWeatherProfile {
  const t = Math.max(0, Math.min(OPENING_DURATION, seconds))
  const keys = [
    [0, 1.18, 1.15, .68],
    [B.approach, 1.36, 1.32, .82],
    [B.enter, 1.5, 1.45, .9],
    [B.walk, 1.16, 1.08, .78],
    [B.core, 1.03, .98, .68],
    [B.clue, .94, .86, .58],
    [B.end, .98, .92, .28],
  ] as const
  for (let i = 1; i < keys.length; i++) {
    const [end, wind, snow, cloud] = keys[i]!
    if (t <= end) {
      const [start, prevWind, prevSnow, prevCloud] = keys[i - 1]!
      const k = progress(t, start, end)
      return { wind: mix(prevWind, wind, k), snow: mix(prevSnow, snow, k), cloud: mix(prevCloud, cloud, k) }
    }
  }
  return { wind: .98, snow: .92, cloud: .28 }
}

/** 只采样演出坐标，不读写世界；脚底沿地表、井口和已有大厅移动。 */
export function openingFrame(seconds: number, destinationX: number) {
  const t = Math.max(0, Math.min(OPENING_DURATION, seconds))
  const phase = t < B.cold ? 'run' : t < B.notice ? 'cold' : t < B.approach ? 'notice'
    : t < B.enter ? 'approach' : t < B.sheltered ? 'enter' : t < B.climb ? 'shelter'
      : t < B.walk ? 'climb' : t < B.core ? 'walk' : t < B.clue ? 'core'
        : t < B.home ? 'clue' : t < B.pullback ? 'welcome' : 'handoff'
  const stoppedX = shaftX - 155
  const x = t < B.cold ? mix(shaftX - 210, stoppedX, progress(t, 0, B.cold))
    : t < B.approach ? stoppedX : t < B.enter ? mix(stoppedX, shaftX, progress(t, B.approach, B.enter))
      : t < B.walk ? shaftX : mix(shaftX, destinationX, progress(t, B.walk, B.core))
  const footY = t < B.enter ? ground - 2
    : t < B.sheltered ? mix(ground - 2, ground + 6, progress(t, B.enter, B.sheltered))
      : mix(ground + 6, floor, progress(t, B.climb, B.walk))
  const shiver = progress(t, .35, B.cold + .25) * (1 - progress(t, B.notice, B.notice + .5))
  const notice = progress(t, B.notice, B.notice + .18) * (1 - progress(t, B.notice + .75, B.notice + 1.1))
  const warmth = progress(t, B.enter + .2, B.sheltered + .45)
  const warmBurst = t < B.sheltered || t > B.climb ? 0 : Math.sin(Math.PI * clamp((t - B.sheltered) / (B.climb - B.sheltered)))
  const entranceGlow = progress(t, B.notice + .15, B.notice + .9)
  const homeReveal = progress(t, B.home, B.home + .55)
  const speech = phase === 'cold' ? '好冷呀……' : phase === 'notice' ? '咦？那边有个入口！'
    : phase === 'shelter' ? '啊，暖和一点了！'
      : phase === 'welcome' ? `${HOME_OWNER}，这里就是我们的地下小家园。` : ''
  return {
    t, phase, x, footY,
    pose: phase === 'run' || phase === 'approach' || phase === 'walk' ? 'walk' as const
      : phase === 'enter' || phase === 'climb' ? 'climb' as const : 'idle' as const,
    facing: t < B.walk || phase === 'core' ? 1 : -1,
    shiver, notice, warmth, warmBurst, entranceGlow, homeReveal, speech,
    clue: progress(t, B.clue, B.clue + .65),
    pullback: progress(t, B.pullback, B.end),
    // 感到暖和时先留在入口，读完台词后再随阿土下移。
    cameraY: mix(ground - 85, 9.2 * T, progress(t, B.climb, B.core)),
    caption: phase === 'cold' ? '风好大，先找个地方避一避。'
      : phase === 'notice' ? '雪堆后面，露出一个入口。'
        : phase === 'shelter' ? '这里挡住了风，身上暖和一点了。'
          : phase === 'core' ? '能源核心停了……' : phase === 'clue' ? '左边的泥土里，有一点蓝光。'
            : phase === 'welcome' ? `${HOME_OWNER}，欢迎来到你的地下小家园。` : '',
  }
}

export type OpeningFrame = ReturnType<typeof openingFrame>
