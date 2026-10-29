import { describe, expect, it } from 'vitest'
import { collectCrystal, repairCore } from '../src/core/interact'
import { createInitialWorld, LANDMARKS } from '../src/core/world'
import { dig } from '../src/core/dig'
import { savedAtLabel, summarizeSave } from '../src/app/saveSummary'
import { completedFinale,readyFinale } from './fixtures/finaleWorld'

describe('进入页存档摘要', () => {
  it('终章未完成与后日谈在继续游戏入口明确区分，读档不退回旧章',()=>{
    expect(summarizeSave(readyFinale())).toMatchObject({phase:'地心暖光 · 终章',done:16,total:20,finished:false})
    expect(summarizeSave(completedFinale())).toMatchObject({phase:'九层家园 · 终章已完成',done:20,total:20,finished:true})
  })
  it('刚开始的第一夜显示第一个任务和 0/4', () => {
    const summary = summarizeSave(createInitialWorld())
    expect(summary).toEqual({
      phase: '第一夜',
      missionTitle: '找到发光的能源石',
      done: 0,
      total: 4,
      finished: false,
    })
  })

  it('点灯之后显示下一步“给伙伴留床”和 3/4', () => {
    const world = createInitialWorld()
    dig(world, LANDMARKS.crystal.x, LANDMARKS.crystal.y)
    collectCrystal(world, LANDMARKS.crystal.x, LANDMARKS.crystal.y)
    dig(world, LANDMARKS.secondCrystal.x, LANDMARKS.secondCrystal.y)
    collectCrystal(world, LANDMARKS.secondCrystal.x, LANDMARKS.secondCrystal.y)
    repairCore(world, LANDMARKS.generator.x, LANDMARKS.generator.y)

    const summary = summarizeSave(world)
    expect(summary.phase).toBe('第一夜')
    expect(summary.missionTitle).toBe('给伙伴留床')
    expect(summary.done).toBe(3)
    expect(summary.total).toBe(4)
  })

  it('第一夜完成后摘要切到泉水与家园，不会一直停在 4/4', () => {
    const world = createInitialWorld()
    world.progress = { crystalFound: true, crystalCollected: true, secondCrystalFound: true, secondCrystalCollected: true, coreLoaded: true, coreRepaired: true }
    world.pods.push({ id: 1, x: 12, y: 10, door: 'left' })

    const summary = summarizeSave(world)
    expect(summary.phase).toBe('泉水与家园')
    expect(summary.missionTitle).toBe('楼下有谁在喊饿')
    expect(summary.total).toBe(12)
    expect(summary.finished).toBe(false)
  })
})

describe('存档时间', () => {
  const now = new Date(2026, 9, 19, 23, 57)

  it('今天和昨天用相对时间', () => {
    expect(savedAtLabel(new Date(2026, 9, 19, 8, 5).toISOString(), now)).toBe('今天 08:05')
    expect(savedAtLabel(new Date(2026, 9, 18, 19, 30).toISOString(), now)).toBe('昨天 19:30')
  })

  it('更早的存档显示月日，跨年显示年份', () => {
    expect(savedAtLabel(new Date(2026, 9, 17, 21, 40).toISOString(), now)).toBe('10月17日 21:40')
    expect(savedAtLabel(new Date(2025, 11, 31, 23, 0).toISOString(), now)).toBe('2025年12月31日')
  })

  it('无效或空时间不显示半截文字', () => {
    expect(savedAtLabel('', now)).toBe('')
    expect(savedAtLabel('not-a-date', now)).toBe('')
  })
})
