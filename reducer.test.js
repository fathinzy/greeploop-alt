import { describe, it, expect } from 'vitest'
import { reducer, initialState, nextId } from './reducer.js'
import { VOUCHERS } from '../data/catalog.js'

function register(s, role, name = 'Test') {
  const id = nextId(s, role)
  return [reducer(s, { type: 'REGISTER', id, role, name, address: 'A', email: `${id}@x.com`, password: 'secret1' }), id]
}

describe('registration', () => {
  it('issues sequential USER- and TENT- IDs', () => {
    let s = initialState()
    let a, b, c
    ;[s, a] = register(s, 'user')
    ;[s, b] = register(s, 'user')
    ;[s, c] = register(s, 'tenant')
    expect([a, b, c]).toEqual(['USER-000000001', 'USER-000000002', 'TENT-000000001'])
    expect(s.accounts[a].tokenBalance).toBe(0)
  })
})

describe('hub sessions', () => {
  it('HUB_DROP credits the linked user and feeds ops + hub stats', () => {
    let [s, id] = register(initialState(), 'user')
    s = reducer(s, { type: 'LINK_HUB', hubId: 'HUB-0001', uid: id })
    s = reducer(s, { type: 'HUB_DROP', hubId: 'HUB-0001', itemId: 'pet-bottle', quantity: 10 })
    expect(s.accounts[id].tokenBalance).toBeGreaterThan(0)
    expect(s.hubSessions['HUB-0001'].items).toHaveLength(1)
    expect(s.hubEvents).toHaveLength(1)
    expect(s.opsTransactions).toHaveLength(1)
  })

  it('HUB_DROP with no linked user only feeds operations', () => {
    const s = reducer(initialState(), { type: 'HUB_DROP', hubId: 'HUB-0002', itemId: 'aluminum-can', quantity: 5 })
    expect(s.hubEvents).toHaveLength(1)
    expect(Object.keys(s.accounts)).toHaveLength(0)
  })

  it('a hub in use cannot be taken by a second user', () => {
    let [s, a] = register(initialState(), 'user')
    let b
    ;[s, b] = register(s, 'user')
    s = reducer(s, { type: 'LINK_HUB', hubId: 'HUB-0001', uid: a })
    s = reducer(s, { type: 'LINK_HUB', hubId: 'HUB-0001', uid: b })
    expect(s.hubSessions['HUB-0001'].uid).toBe(a)
  })
})

describe('redeem', () => {
  it('spends GP and cannot overspend', () => {
    let [s, id] = register(initialState(), 'user')
    const v = VOUCHERS[0]
    expect(reducer(s, { type: 'REDEEM_VOUCHER', voucherId: v.id, uid: id }).redeemedVouchers).toBeUndefined()
    s = reducer(s, { type: 'LINK_HUB', hubId: 'HUB-0001', uid: id })
    s = reducer(s, { type: 'HUB_DROP', hubId: 'HUB-0001', itemId: 'ewaste-small', quantity: 40 })
    const before = s.accounts[id].tokenBalance
    s = reducer(s, { type: 'REDEEM_VOUCHER', voucherId: v.id, uid: id })
    expect(s.accounts[id].tokenBalance).toBe(before - v.costTokens)
    expect(s.accounts[id].redeemedVouchers).toHaveLength(1)
  })
})
