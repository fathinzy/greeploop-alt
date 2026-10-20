import { computeDropoff } from '../lib/engine.js'
import { VOUCHERS, ACCOUNT_TYPES, initialHubLoads } from '../data/catalog.js'

export const STORAGE_KEY = 'greenloop-state-v3'

// Demo hubs. HUB-0001 is the manual demo bin; the other three run an automatic
// simulation of residents/tenants scanning the QR and recycling.
export const DEMO_HUBS = [
  { id: 'HUB-0001', name: 'Elmina Central Hub', location: 'Jalan Elmina Barat 1, City of Elmina', mode: 'manual' },
  { id: 'HUB-0002', name: 'Elmina Lakeside Hub', location: 'Persiaran Elmina Lakeside, City of Elmina', mode: 'auto' },
  { id: 'HUB-0003', name: 'Bandar Bukit Raja Mall Hub', location: 'Jalan Bukit Raja 4, Bandar Bukit Raja', mode: 'auto' },
  { id: 'HUB-0004', name: 'Saujana Utama Hub', location: 'Jalan Saujana 2, Saujana Utama', mode: 'auto' },
]

export const roleToAccount = (role) => (role === 'tenant' ? 'tenant' : 'residence')

function emptyAccount(accountType) {
  return {
    tokenBalance: 0,
    transactions: [],
    redeemedVouchers: [],
    maintenanceFee: ACCOUNT_TYPES[accountType].feeAmount,
    feeOffsetRm: 0,
    feeOffsets: [],
  }
}

export function initialState() {
  return {
    users: {}, // id -> { id, role, name, address, email, password, avatar }
    counters: { user: 0, tenant: 0 },
    accounts: {}, // id -> account (GP balance, history, vouchers, fee)
    hubs: DEMO_HUBS,
    hubSessions: {}, // hubId -> { uid, name, since, items: [] }
    hubEvents: [], // live drop events (feed Hub Stat)
    opsTransactions: [],
    hubLoads: initialHubLoads(),
  }
}

// Next sequential ID: USER-000000001 / TENT-000000001
export function nextId(state, role) {
  const n = (state.counters?.[role] || 0) + 1
  return (role === 'tenant' ? 'TENT-' : 'USER-') + String(n).padStart(9, '0')
}
export function nextHubId(state) {
  return 'HUB-' + String((state.hubs?.length || 0) + 1).padStart(4, '0')
}

let seq = 0
function uid(prefix) {
  seq += 1
  return `${prefix}-${Date.now()}-${seq}`
}

function makeVoucherCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const block = () => Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
  return `GL-${block()}-${block()}`
}

function updateAcct(state, id, updater) {
  const cur = state.accounts[id]
  if (!cur) return state
  return { ...state, accounts: { ...state.accounts, [id]: updater(cur) } }
}

export function reducer(state, action) {
  if (!state.accounts || !state.users) state = { ...initialState(), ...state }
  const who = action.uid

  switch (action.type) {
    case 'REGISTER': {
      if (state.users[action.id]) return state
      const role = action.role === 'tenant' ? 'tenant' : 'user'
      const user = {
        id: action.id, role, name: action.name, address: action.address,
        email: action.email, password: action.password, avatar: null,
      }
      return {
        ...state,
        users: { ...state.users, [action.id]: user },
        counters: { ...state.counters, [role]: (state.counters[role] || 0) + 1 },
        accounts: { ...state.accounts, [action.id]: emptyAccount(roleToAccount(role)) },
      }
    }

    case 'UPDATE_PROFILE': {
      const u = state.users[who]
      if (!u) return state
      const next = { ...u }
      if (action.avatar !== undefined) next.avatar = action.avatar
      if (action.password) next.password = action.password
      return { ...state, users: { ...state.users, [who]: next } }
    }

    case 'LINK_HUB': {
      const u = state.users[action.uid]
      const cur = state.hubSessions[action.hubId]
      if (!u || (cur && cur.uid !== action.uid)) return state
      // one hub at a time per user
      const sessions = Object.fromEntries(Object.entries(state.hubSessions).filter(([, s]) => s.uid !== action.uid))
      sessions[action.hubId] = cur || { uid: u.id, name: u.name, since: Date.now(), items: [] }
      return { ...state, hubSessions: sessions }
    }

    case 'UNLINK_HUB': {
      if (!state.hubSessions[action.hubId]) return state
      const { [action.hubId]: _gone, ...rest } = state.hubSessions
      return { ...state, hubSessions: rest }
    }

    // A drop approved by the hub's Cam 2. Credits the linked user (if any),
    // feeds township operations and the Hub Stat events.
    case 'HUB_DROP': {
      const result = computeDropoff(action.itemId, action.quantity)
      if (result.quantity <= 0) return state
      const session = state.hubSessions[action.hubId]
      const ts = action.timestamp || Date.now()
      const tx = { id: uid('tx'), timestamp: ts, hubId: action.hubId, userId: session?.uid || null, ...result }
      let next = {
        ...state,
        opsTransactions: [tx, ...state.opsTransactions],
        hubEvents: [tx, ...state.hubEvents].slice(0, 3000),
        hubLoads: { ...state.hubLoads, [action.hubId]: (state.hubLoads[action.hubId] || 0) + result.totalWeight },
      }
      if (session) {
        next = updateAcct(next, session.uid, (a) => ({
          ...a,
          tokenBalance: a.tokenBalance + result.tokensAwarded,
          transactions: [tx, ...a.transactions],
        }))
        next.hubSessions = {
          ...next.hubSessions,
          [action.hubId]: {
            ...session,
            items: [{ id: tx.id, name: result.name, quantity: result.quantity, gp: result.tokensAwarded, timestamp: ts }, ...session.items].slice(0, 50),
          },
        }
      }
      return next
    }

    case 'ADD_HUB':
      return { ...state, hubs: [...state.hubs, action.hub] }

    case 'REDEEM_VOUCHER': {
      const voucher = VOUCHERS.find((v) => v.id === action.voucherId)
      const a = state.accounts[who]
      if (!voucher || !a || a.tokenBalance < voucher.costTokens) return state
      return updateAcct(state, who, (acc) => ({
        ...acc,
        tokenBalance: acc.tokenBalance - voucher.costTokens,
        redeemedVouchers: [
          {
            id: uid('rv'), voucherId: voucher.id, name: voucher.name, value: voucher.value,
            costTokens: voucher.costTokens, emoji: voucher.emoji,
            code: action.code || makeVoucherCode(), used: false, timestamp: action.timestamp || Date.now(),
          },
          ...acc.redeemedVouchers,
        ],
      }))
    }

    case 'MARK_VOUCHER_USED':
      return updateAcct(state, who, (a) => ({
        ...a,
        redeemedVouchers: a.redeemedVouchers.map((r) =>
          r.id === action.id ? { ...r, used: true, usedAt: action.timestamp || Date.now() } : r
        ),
      }))

    case 'OFFSET_FEE': {
      const a = state.accounts[who]
      if (!a) return state
      const tokens = Math.min(action.tokens, a.tokenBalance)
      if (tokens <= 0) return state
      const rm = tokens * action.rmPerToken
      const applied = Math.min(rm, a.maintenanceFee - a.feeOffsetRm)
      if (applied <= 0) return state
      const tokensUsed = Math.ceil(applied / action.rmPerToken)
      return updateAcct(state, who, (acc) => ({
        ...acc,
        tokenBalance: acc.tokenBalance - tokensUsed,
        feeOffsetRm: Math.min(acc.maintenanceFee, acc.feeOffsetRm + applied),
        feeOffsets: [
          { id: uid('fo'), rm: Math.round(applied * 100) / 100, tokensUsed, timestamp: action.timestamp || Date.now() },
          ...acc.feeOffsets,
        ],
      }))
    }

    case 'SEED':
      return { ...state, opsTransactions: action.transactions }

    // Resets township operations data only; accounts and hubs are kept.
    case 'RESET':
      return { ...state, opsTransactions: [], hubEvents: [], hubSessions: {}, hubLoads: initialHubLoads() }

    case 'HYDRATE':
      return { ...initialState(), ...action.state }

    default:
      return state
  }
}
