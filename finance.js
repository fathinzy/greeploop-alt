import { ECONOMICS, CO2_PER_KG, MALAYSIA_SEASONALITY } from '../data/catalog.js'
import { aggregate } from './engine.js'

// Small deterministic pseudo-random wobble so months look organic but stable
// across re-renders (seeded by the month offset).
function wobble(seed) {
  const x = Math.sin(seed * 12.9898) * 43758.5453
  return (x - Math.floor(x) - 0.5) * 0.06 // ±3%
}

function round(n, dp = 2) {
  const f = 10 ** dp
  return Math.round((n + Number.EPSILON) * f) / f
}

/**
 * Compute the ROI snapshot for the recycling hub from current transactions.
 * This represents the economics "to date" (the diverted volume collected so
 * far), treated as roughly one operating month for the dashboard.
 */
export function computeRoi(transactions) {
  const agg = aggregate(transactions)
  const kg = agg.totalWeight
  const tonnes = kg / 1000

  // Benefits
  const avoidedHaulage = round(tonnes * ECONOMICS.avoidedHaulageRmPerTonne)
  const commoditySales = round(agg.totalBulkValue)
  const carbonValue = round((agg.totalCo2 / 1000) * ECONOMICS.carbonRmPerTonneCo2)
  const totalBenefit = round(avoidedHaulage + commoditySales + carbonValue)

  // Costs
  const opex = ECONOMICS.hubOpexPerMonth
  // Only the GP residents actually redeem is a real cash cost.
  const gpIssuedRm = agg.tokenPayoutRm
  const gpRedeemedRm = round(gpIssuedRm * ECONOMICS.gpRedemptionRate)
  const totalCost = round(opex + gpRedeemedRm)

  const netSurplus = round(totalBenefit - totalCost)
  const roiPct = totalCost > 0 ? round((netSurplus / totalCost) * 100, 0) : 0

  // Outstanding GP liability (issued but not yet redeemed).
  const gpLiabilityRm = round(gpIssuedRm - gpRedeemedRm)

  // Payback: how many months of this surplus to cover the one-time CapEx.
  const paybackMonths = netSurplus > 0 ? round(ECONOMICS.hubCapex / netSurplus, 1) : null

  return {
    kg,
    tonnes: round(tonnes, 2),
    avoidedHaulage,
    commoditySales,
    carbonValue,
    totalBenefit,
    opex,
    gpIssuedRm,
    gpRedeemedRm,
    gpLiabilityRm,
    totalCost,
    netSurplus,
    roiPct,
    capex: ECONOMICS.hubCapex,
    paybackMonths,
  }
}

/**
 * Project monthly benefit, cost, surplus and cumulative ROI over `months`,
 * growing volume by the assumed monthly engagement growth rate.
 * Month 0 is the current snapshot; subsequent months compound.
 */
export function forecast(transactions, months = 12) {
  const base = computeRoi(transactions)
  const g = 1 + ECONOMICS.monthlyGrowthRate
  const rows = []
  let cumulativeNet = -ECONOMICS.hubCapex // start in the hole by the setup cost

  for (let m = 1; m <= months; m++) {
    const scale = g ** (m - 1)
    const benefit = round(base.totalBenefit * scale)
    // Opex is fixed; GP redemption scales with volume.
    const cost = round(base.opex + base.gpRedeemedRm * scale)
    const net = round(benefit - cost)
    cumulativeNet = round(cumulativeNet + net)
    rows.push({
      month: m,
      label: `M${m}`,
      benefit,
      cost,
      net,
      cumulative: cumulativeNet,
    })
  }

  // First month where cumulative turns positive = payback point.
  const paybackMonth = rows.find((r) => r.cumulative >= 0)?.month ?? null

  return {
    rows,
    paybackMonth,
    endCumulative: rows.length ? rows[rows.length - 1].cumulative : -ECONOMICS.hubCapex,
    totalBenefit: round(rows.reduce((s, r) => s + r.benefit, 0)),
  }
}

// Current month anchor (recomputed per call; the sim treats "today" as now).
function nowParts() {
  const d = new Date()
  return { year: d.getFullYear(), month: d.getMonth() } // month 0-11
}

// Whole-month offset from the current month to the given year/month.
function offsetTo(year, month) {
  const { year: ny, month: nm } = nowParts()
  return (year - ny) * 12 + (month - nm)
}

/**
 * The modelled diversion for one calendar month = live run-rate × growth-trend
 * (relative to now) × Malaysian seasonality × light history wobble. The current
 * month equals the live snapshot exactly.
 */
export function monthValue(base, year, month) {
  const g = 1 + ECONOMICS.monthlyGrowthRate
  const { month: nm } = nowParts()
  const off = offsetTo(year, month)
  const trend = g ** off
  const seasonFactor = MALAYSIA_SEASONALITY[month] / MALAYSIA_SEASONALITY[nm]
  const noise = off < 0 ? 1 + wobble(off) : 1
  const scale = trend * seasonFactor * noise
  return {
    offset: off,
    projected: off > 0,
    scale,
    kg: round(base.kg * scale, 1),
    rm: round(base.commoditySales * scale),
    gp: Math.round(base.gpIssuedRm * scale * 10),
    co2: round(base.kg * scale * CO2_PER_KG, 1),
    tokensAwarded: Math.round(base.gpIssuedRm * scale * 10),
    totalWeight: round(base.kg * scale, 1),
    totalBulkValue: round(base.commoditySales * scale),
    totalCo2: round(base.kg * scale * CO2_PER_KG, 1),
    totalTokens: Math.round(base.gpIssuedRm * scale * 10),
    tokenPayoutRm: round(base.gpIssuedRm * scale),
  }
}

const MONTH_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/**
 * All 12 months of a given year as per-month diversion (kg), flagged
 * actual/projected relative to now. Used for the Monthly-view chart.
 */
export function monthlySeries(transactions, year) {
  const base = computeRoi(transactions)
  const rows = []
  for (let m = 0; m < 12; m++) {
    const v = monthValue(base, year, m)
    rows.push({
      key: `${year}-${m}`,
      label: `${MONTH_ABBR[m]} ${String(year).slice(2)}`,
      month: m,
      year,
      projected: v.projected,
      isNow: v.offset === 0,
      actual: v.projected ? null : v.kg,
      forecast: v.projected ? v.kg : null,
      kg: v.kg,
    })
  }
  // Bridge: let the last actual month also carry a forecast point so the solid
  // and dashed lines connect without a gap.
  const lastActual = [...rows].reverse().find((r) => !r.projected)
  if (lastActual) lastActual.forecast = lastActual.kg
  return rows
}

/** Sum a whole year's diversion. */
export function yearTotal(transactions, year) {
  const base = computeRoi(transactions)
  let kg = 0,
    rm = 0,
    gp = 0,
    co2 = 0
  let anyProjected = false
  for (let m = 0; m < 12; m++) {
    const v = monthValue(base, year, m)
    kg += v.kg
    rm += v.rm
    gp += v.gp
    co2 += v.co2
    if (v.projected) anyProjected = true
  }
  return { year, kg: round(kg, 1), rm: round(rm), gp: Math.round(gp), co2: round(co2, 1), projected: anyProjected }
}

/** Year totals across a span of years, for the Annual-view chart. */
export function annualSeries(transactions, years) {
  const { year: ny } = nowParts()
  return years.map((y) => {
    const t = yearTotal(transactions, y)
    return {
      key: String(y),
      label: String(y),
      year: y,
      actual: y <= ny ? t.kg : null,
      forecast: y >= ny ? t.kg : null,
      kg: t.kg,
      projected: y > ny,
    }
  })
}

// Figures for a single month (stat cards + material scaling in Monthly view).
export function monthFigures(transactions, year, month) {
  const base = computeRoi(transactions)
  return monthValue(base, year, month)
}

export function currentYearMonth() {
  return nowParts()
}

/**
 * Scale factor to turn the current month's figures into a given year's total.
 * Used to scale the material breakdown to a selected year/month.
 */
export function scaleForYear(transactions, year) {
  const base = computeRoi(transactions)
  if (!base.kg) return 0
  return yearTotal(transactions, year).kg / base.kg
}

export function scaleForMonth(transactions, year, month) {
  const base = computeRoi(transactions)
  if (!base.kg) return 0
  return monthValue(base, year, month).kg / base.kg
}

// Period-over-period change for a metric comparing the current month to the
// previous month (for the trend arrows on the stat cards).
export function monthTrend() {
  const g = 1 + ECONOMICS.monthlyGrowthRate
  // Each month grows by the growth rate, so MoM change is simply the rate.
  const pct = Math.round((g - 1) * 100)
  return { pct, up: pct >= 0 }
}

// Projected growth over the next N months vs now, as a signed %.
export function projectedChange(months) {
  const g = 1 + ECONOMICS.monthlyGrowthRate
  const factor = g ** months
  return Math.round((factor - 1) * 100)
}

export { round as _round }
