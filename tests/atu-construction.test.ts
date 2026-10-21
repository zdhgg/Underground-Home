import { describe, expect, it, vi } from 'vitest'
import { AtuConstruction } from '../src/render/atuConstruction'
import type { SoilPlan } from '../src/core/atu'

const plan: SoilPlan = { target: { x: 14, y: 9 }, stand: { x: 15, y: 11 }, route: [{ x: 15, y: 11 }], lift: 1 }

describe('短踏台的可中断阶段', () => {
  it.each([0, .1, .3, .5, .7, .9])('在%s秒中断，旧动作不再产生效果或完成通知', time => {
    const work = new AtuConstruction(), strike = vi.fn(), done = vi.fn()
    work.start(plan, strike, done)
    work.update(time)
    const hits = strike.mock.calls.length
    expect(hits).toBe(time >= .59 ? 1 : 0)
    work.cancel(); work.update(2)
    expect(strike).toHaveBeenCalledTimes(hits)
    expect(done).not.toHaveBeenCalled()
    expect(work.active).toBe(false)
    expect(work.lift).toBe(0)
    work.view.destroy({ children: true })
  })

  it('先登台，再命中土面，收起后才完成；完整动作只结算一次', () => {
    const work = new AtuConstruction(), strike = vi.fn(), done = vi.fn()
    work.start(plan, strike, done)
    work.update(.34)
    expect(work.lift).toBeCloseTo(32)
    expect(strike).not.toHaveBeenCalled()
    work.update(.26)
    expect(strike).toHaveBeenCalledTimes(1)
    expect(done).not.toHaveBeenCalled()
    work.update(.45); work.update(1)
    expect(done).toHaveBeenCalledTimes(1)
    expect(strike).toHaveBeenCalledTimes(1)
    expect(work.lift).toBe(0)
    work.view.destroy({ children: true })
  })

  it('正上方施工只垫12px矮凳，身体不会抬进未挖的顶土', () => {
    const work = new AtuConstruction(), strike = vi.fn()
    work.start({ ...plan, target: { x: 15, y: 9 }, overhead: true }, strike, vi.fn())
    work.update(.34); expect(work.lift).toBeCloseTo(12); expect(strike).not.toHaveBeenCalled()
    work.update(.26); expect(strike).toHaveBeenCalledTimes(1)
    work.cancel(); expect(work.lift).toBe(0); work.view.destroy({ children: true })
  })
})
