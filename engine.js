import { getItem, TOKEN_TO_RM, CO2_PER_KG } from '../data/catalog.js'

// Round to a sensible number of decimals.
function round(n, dp = 2) {
  const f = 10 ** dp
  return Math.round((n + Number.EPSILON) * f) / f
}

/**
 * Compute the result of a drop-off for a given item and quantity.
 * Pure function — no side effects — so it is easy to unit test.
 *
 * @param {string} itemId
 * @param {number} quantity
 * @returns {{
 *   itemId: string, name: string, category: string, stream: string,
 *   grade: string, quantity: number, totalWeight: number,
 *   tokensAwarded: number, bulkValue: number, co2Avoided: number
 * }}
 */
export function computeDropoff(itemId, quantity) {
  const item = getItem(itemId)
  if (!item) throw new Error(`Unknown item: ${itemId}`)
  const qty = Math.max(0, Math.floor(Number(quantity) || 0))

  const totalWeight = round(item.unitWeight * qty, 3)
  // Award GP from the GP-per-kg material rate on the total weight (not a
  // rounded per-unit value) so the economics stay exact and consistent.
  const tokensAwarded = Math.max(0, Math.round(item.gpPerKg * totalWeight))
  const bulkValue = round(totalWeight * item.bulkRmPerKg, 2)
  const co2Avoided = round(totalWeight * CO2_PER_KG, 2)

  return {
    itemId: item.id,
    name: item.name,
    category: item.category,
    stream: item.stream,
    grade: item.grade,
    quantity: qty,
    totalWeight,
    tokensAwarded,
    bulkValue,
    co2Avoided,
  }
}

// Convert a token amount to RM at the fixed demo rate.
export function tokensToRm(tokens) {
  return round(tokens * TOKEN_TO_RM, 2)
}

// Format a number as RM currency.
export function formatRm(amount) {
  return new Intl.NumberFormat('en-MY', {
    style: 'currency',
    currency: 'MYR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount || 0)
}

// Format a weight in kg (switches to tonnes above 1000 kg).
export function formatWeight(kg) {
  if (kg >= 1000) return `${round(kg / 1000, 2)} t`
  return `${round(kg, 2)} kg`
}

// Format a Green Points amount, e.g. "1,250 GP".
export function formatGP(points) {
  return `${Math.round(points || 0).toLocaleString()} GP`
}

/**
 * Aggregate a list of transactions into management-level metrics.
 * @param {Array} transactions
 */
export function aggregate(transactions) {
  const byCategory = {}
  let totalWeight = 0
  let totalBulkValue = 0
  let totalCo2 = 0
  let totalTokens = 0

  for (const t of transactions) {
    totalWeight += t.totalWeight
    totalBulkValue += t.bulkValue
    totalCo2 += t.co2Avoided
    totalTokens += t.tokensAwarded

    if (!byCategory[t.category]) {
      byCategory[t.category] = { category: t.category, weight: 0, bulkValue: 0, count: 0 }
    }
    byCategory[t.category].weight += t.totalWeight
    byCategory[t.category].bulkValue += t.bulkValue
    byCategory[t.category].count += t.quantity
  }

  return {
    totalWeight: round(totalWeight, 2),
    totalBulkValue: round(totalBulkValue, 2),
    totalCo2: round(totalCo2, 2),
    totalTokens,
    tokenPayoutRm: tokensToRm(totalTokens),
    byCategory: Object.values(byCategory).map((c) => ({
      ...c,
      weight: round(c.weight, 2),
      bulkValue: round(c.bulkValue, 2),
    })),
  }
}
