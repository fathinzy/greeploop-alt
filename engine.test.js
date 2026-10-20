import { describe, it, expect } from 'vitest'
import { computeDropoff, tokensToRm, aggregate } from './engine.js'
import { getItem } from '../data/catalog.js'

describe('computeDropoff', () => {
  it('derives weight, GP, bulk value and CO2 from the material rates', () => {
    const item = getItem('pet-bottle')
    const r = computeDropoff('pet-bottle', 100)
    // GP is derived from the GP-per-kg material rate on total weight.
    expect(r.totalWeight).toBe(Math.round(item.unitWeight * 100 * 1000) / 1000)
    expect(r.tokensAwarded).toBe(Math.round(item.gpPerKg * r.totalWeight))
    expect(r.bulkValue).toBeCloseTo(r.totalWeight * item.bulkRmPerKg, 1)
    expect(r.co2Avoided).toBeCloseTo(r.totalWeight * 1.8, 1)
    expect(r.grade).toMatch(/Clean/)
    expect(r.stream).toBe('AI')
  })

  it('floors fractional quantities and rejects negatives', () => {
    expect(computeDropoff('aluminum-can', 2.9).quantity).toBe(2)
    expect(computeDropoff('aluminum-can', -5).quantity).toBe(0)
  })

  it('throws on unknown item', () => {
    expect(() => computeDropoff('nope', 1)).toThrow()
  })
})

describe('tokensToRm', () => {
  it('converts tokens to RM at the demo rate', () => {
    expect(tokensToRm(100)).toBe(10)
  })
})

describe('aggregate', () => {
  it('sums transactions by category and totals', () => {
    const t1 = computeDropoff('pet-bottle', 100)
    const t2 = computeDropoff('aluminum-can', 100)
    const a = aggregate([t1, t2])
    expect(a.totalTokens).toBe(t1.tokensAwarded + t2.tokensAwarded)
    expect(a.byCategory).toHaveLength(2)
    const petCat = a.byCategory.find((c) => c.category === 'PET')
    expect(petCat.count).toBe(100)
  })
})
