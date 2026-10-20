import { computeDropoff } from './engine.js'
import { COLLECTION_HUBS } from '../data/catalog.js'

// A realistic MONTHLY township-wide throughput so the dashboards and ROI look
// credible on first load. These totals represent everything collected across
// the month (bins are emptied repeatedly), not what sits in a bin at once —
// hub bin levels are tracked separately as a live snapshot.
//
// Rough scale: a few thousand residents recycling weekly -> several tonnes/mo.
//
// [itemId, quantity, hubId]
const SEED_PLAN = [
  // PET bottles — high count, township-wide (~0.03 kg each)
  ['pet-bottle', 42000, 'hub-a'],
  ['pet-bottle', 31000, 'hub-b'],
  ['pet-bottle', 24000, 'hub-d'],
  // Aluminium cans (~0.015 kg each) — the high-value stream
  ['aluminum-can', 28000, 'hub-a'],
  ['aluminum-can', 15000, 'hub-c'],
  ['aluminum-can', 9000, 'hub-e'],
  // Paper cartons
  ['paper-carton', 14000, 'hub-a'],
  ['paper-carton', 9000, 'hub-c'],
  // Cardboard (mall tenants + households, ~0.4 kg each)
  ['cardboard-box', 4200, 'hub-b'],
  ['cardboard-box', 5200, 'hub-f'],
  // E-waste (~0.25 kg each) — high value per kg
  ['ewaste-small', 1100, 'hub-d'],
  ['ewaste-small', 1400, 'hub-f'],
  // Appliances (bulky, ~12 kg each)
  ['appliance-microwave', 140, 'hub-f'],
]

const HUB_IDS = new Set(COLLECTION_HUBS.map((h) => h.id))

// Modest personal drop-off history so each persona looks populated on load.
// Residence = household-scale; Tenant = commercial bulk.
const RESIDENCE_HISTORY = [
  ['pet-bottle', 24],
  ['aluminum-can', 18],
  ['paper-carton', 12],
  ['cardboard-box', 3],
  ['pet-bottle', 20],
  ['aluminum-can', 25],
  ['ewaste-small', 2],
]
const TENANT_HISTORY = [
  ['cardboard-box', 120],
  ['pet-bottle', 480],
  ['aluminum-can', 650],
  ['paper-carton', 240],
  ['cardboard-box', 90],
  ['ewaste-small', 18],
]

export function buildAccountHistory(kind) {
  const plan = kind === 'tenant' ? TENANT_HISTORY : RESIDENCE_HISTORY
  return plan.map(([itemId, quantity]) => computeDropoff(itemId, quantity))
}

export function buildSeedTransactions() {
  const now = Date.now()
  return SEED_PLAN.filter(([, , hubId]) => HUB_IDS.has(hubId)).map(
    ([itemId, quantity, hubId], idx) => {
      const result = computeDropoff(itemId, quantity)
      return {
        id: `seed-${itemId}-${hubId}`,
        timestamp: now - idx * 1800_000,
        hubId,
        ...result,
      }
    }
  )
}

// ---------------------------------------------------------------------------
// Demo accounts for judging: a lived-in history (about two months of drop-offs
// across all four hubs, vouchers or fee offsets) so every screen has content.
// [itemId, quantity, hubId, daysAgo]
// ---------------------------------------------------------------------------
const USER_DEMO = [
  ['pet-bottle', 80, 'HUB-0001', 58], ['aluminum-can', 60, 'HUB-0002', 55], ['paper-carton', 40, 'HUB-0001', 52],
  ['ewaste-small', 8, 'HUB-0003', 49], ['pet-bottle', 120, 'HUB-0001', 46], ['cardboard-box', 12, 'HUB-0004', 43],
  ['aluminum-can', 90, 'HUB-0001', 40], ['appliance-microwave', 1, 'HUB-0003', 37], ['pet-bottle', 70, 'HUB-0002', 34],
  ['ewaste-small', 10, 'HUB-0001', 31], ['paper-carton', 60, 'HUB-0004', 28], ['aluminum-can', 110, 'HUB-0001', 25],
  ['cardboard-box', 16, 'HUB-0002', 22], ['appliance-microwave', 1, 'HUB-0001', 20], ['pet-bottle', 100, 'HUB-0003', 17],
  ['ewaste-small', 12, 'HUB-0004', 14], ['aluminum-can', 80, 'HUB-0002', 11], ['appliance-microwave', 2, 'HUB-0001', 9],
  ['pet-bottle', 90, 'HUB-0001', 7], ['cardboard-box', 14, 'HUB-0001', 5], ['paper-carton', 70, 'HUB-0002', 3],
  ['ewaste-small', 10, 'HUB-0001', 1],
]
const TENANT_DEMO = [
  ['cardboard-box', 120, 'HUB-0003', 58], ['pet-bottle', 600, 'HUB-0003', 54], ['aluminum-can', 500, 'HUB-0003', 50],
  ['ewaste-small', 30, 'HUB-0001', 46], ['paper-carton', 300, 'HUB-0003', 42], ['cardboard-box', 150, 'HUB-0003', 38],
  ['pet-bottle', 700, 'HUB-0002', 34], ['appliance-microwave', 2, 'HUB-0003', 30], ['aluminum-can', 600, 'HUB-0003', 26],
  ['ewaste-small', 40, 'HUB-0003', 22], ['cardboard-box', 160, 'HUB-0004', 18], ['pet-bottle', 800, 'HUB-0003', 14],
  ['aluminum-can', 700, 'HUB-0001', 10], ['ewaste-small', 40, 'HUB-0003', 7], ['appliance-microwave', 4, 'HUB-0003', 4],
  ['paper-carton', 500, 'HUB-0003', 2], ['cardboard-box', 170, 'HUB-0003', 1],
]

export function buildDemoAccount(role) {
  const tenant = role === 'tenant'
  const day = 86400000
  const now = Date.now()
  const transactions = (tenant ? TENANT_DEMO : USER_DEMO)
    .map(([itemId, quantity, hubId, ago], i) => ({
      id: `demo-${role}-${i}`,
      timestamp: now - ago * day - ((i * 7919) % 36000) * 1000,
      hubId,
      ...computeDropoff(itemId, quantity),
    }))
    .sort((a, b) => b.timestamp - a.timestamp)
  const earned = transactions.reduce((s, t) => s + t.tokensAwarded, 0)
  let redeemedVouchers = []
  let feeOffsets = []
  let spent = 0
  if (tenant) {
    feeOffsets = [
      { id: 'demo-fo-1', rm: 100, tokensUsed: 1000, timestamp: now - 25 * day },
      { id: 'demo-fo-2', rm: 80, tokensUsed: 800, timestamp: now - 6 * day },
    ]
    spent = 1800
  } else {
    redeemedVouchers = [
      { id: 'demo-rv-1', voucherId: 'cafe-10', name: 'Greenview Mall Café', value: 10, costTokens: 100, emoji: '☕', code: 'GL-DEMO-CAFE', used: true, usedAt: now - 38 * day, timestamp: now - 40 * day },
      { id: 'demo-rv-2', voucherId: 'fnb-25', name: 'Riverside F&B Credit', value: 25, costTokens: 240, emoji: '🍜', code: 'GL-DEMO-FNB5', used: false, timestamp: now - 12 * day },
    ]
    spent = 340
  }
  return {
    transactions,
    redeemedVouchers,
    feeOffsets,
    feeOffsetRm: feeOffsets.reduce((s, f) => s + f.rm, 0),
    tokenBalance: Math.max(0, earned - spent),
  }
}
