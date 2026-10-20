import { CATEGORIES, MATERIAL_RATES, CO2_PER_KG } from '../data/catalog.js'

export const CATS = Object.keys(CATEGORIES)
const UNIT_KG = { PET: 0.03, Aluminum: 0.015, Paper: 0.05, Cardboard: 0.4, EWaste: 0.25, Appliance: 12 }
// kg per day per category at hub multiplier 1 (demo history)
const BASE = { PET: 46, Aluminum: 22, Paper: 30, Cardboard: 38, EWaste: 7, Appliance: 30 }
const MULT = { 'HUB-0001': 1, 'HUB-0002': 0.8, 'HUB-0003': 1.25, 'HUB-0004': 0.6 }
// share of a day's volume by hour (peaks morning and evening)
export const HOURLY = [1,0.5,0.4,0.3,0.4,1,3,6,7,6,5,5,6,5,4,4,5,7,8,7,5,3,2,1].map((v, _, a) => v / a.reduce((x, y) => x + y, 0))

export const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

function rng(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const hash = (s) => [...s].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7)

let cache = null
// Deterministic daily history for the four demo hubs (two years back).
export function seedHistory() {
  if (cache) return cache
  const rows = []
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  for (let d = 0; d < 730; d++) {
    const date = new Date(today.getTime() - d * 86400000)
    const key = ymd(date)
    const dow = date.getDay()
    const growth = 0.7 + 0.3 * (1 - d / 730)
    const part = d === 0 ? Math.max(0.05, now.getHours() / 24) : 1
    for (const hubId of Object.keys(MULT)) {
      const r = rng(hash(hubId + key))
      for (const cat of CATS) {
        const kg = BASE[cat] * MULT[hubId] * (dow === 0 || dow === 6 ? 1.25 : 1) * (0.75 + r() * 0.5) * growth * part
        rows.push({
          day: key, hubId, category: cat, seed: true,
          kg: Math.round(kg * 10) / 10,
          qty: Math.round(kg / UNIT_KG[cat]),
          gp: Math.round(kg * MATERIAL_RATES[cat].gpPerKg),
        })
      }
    }
  }
  cache = rows
  return rows
}

// Live drop events (from the hubs) -> same row shape.
export function liveRows(events) {
  return events.map((t) => {
    const d = new Date(t.timestamp)
    return { day: ymd(d), hour: d.getHours(), hubId: t.hubId, category: t.category, kg: t.totalWeight, qty: t.quantity, gp: t.tokensAwarded }
  })
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/**
 * period: 'day' (anchor YYYY-MM-DD) | 'month' (YYYY-MM) | 'year' (YYYY)
 * hubId: 'all' or a hub id (affects series + category totals; ranking always covers all hubs)
 */
export function analyze(rows, { period, anchor, hubId, hubs }) {
  const inRange = rows.filter((r) => r.day.startsWith(anchor))
  const sel = hubId === 'all' ? inRange : inRange.filter((r) => r.hubId === hubId)

  let buckets
  if (period === 'year') buckets = MONTHS.map((m) => ({ label: m, kg: 0, gp: 0, qty: 0 }))
  else if (period === 'month') {
    const [y, m] = anchor.split('-').map(Number)
    buckets = Array.from({ length: new Date(y, m, 0).getDate() }, (_, i) => ({ label: String(i + 1), kg: 0, gp: 0, qty: 0 }))
  } else buckets = Array.from({ length: 24 }, (_, h) => ({ label: `${String(h).padStart(2, '0')}:00`, kg: 0, gp: 0, qty: 0 }))

  const add = (b, kg, gp, qty) => { b.kg += kg; b.gp += gp; b.qty += qty }
  for (const r of sel) {
    if (period === 'year') add(buckets[Number(r.day.slice(5, 7)) - 1], r.kg, r.gp, r.qty)
    else if (period === 'month') add(buckets[Number(r.day.slice(8, 10)) - 1], r.kg, r.gp, r.qty)
    else if (r.seed) HOURLY.forEach((w, h) => add(buckets[h], r.kg * w, r.gp * w, r.qty * w))
    else add(buckets[r.hour], r.kg, r.gp, r.qty)
  }
  buckets.forEach((b) => { b.kg = Math.round(b.kg * 10) / 10; b.gp = Math.round(b.gp); b.qty = Math.round(b.qty) })

  const byCat = CATS.map((c) => {
    const x = sel.filter((r) => r.category === c)
    return { category: c, label: CATEGORIES[c].label, color: CATEGORIES[c].color, kg: Math.round(x.reduce((s, r) => s + r.kg, 0) * 10) / 10 }
  })
  const ids = hubs.map((h) => h.id)
  const ranking = ids
    .map((id) => {
      const x = inRange.filter((r) => r.hubId === id)
      const kg = x.reduce((s, r) => s + r.kg, 0)
      return { id, name: hubs.find((h) => h.id === id).name, kg: Math.round(kg * 10) / 10, gp: Math.round(x.reduce((s, r) => s + r.gp, 0)) }
    })
    .sort((a, b) => b.kg - a.kg)
  const all = ranking.reduce((s, r) => s + r.kg, 0) || 1
  ranking.forEach((r, i) => { r.rank = i + 1; r.share = Math.round((r.kg / all) * 1000) / 10 })

  const totalKg = Math.round(sel.reduce((s, r) => s + r.kg, 0) * 10) / 10
  return {
    series: buckets, byCat, ranking,
    totals: { kg: totalKg, qty: Math.round(sel.reduce((s, r) => s + r.qty, 0)), gp: Math.round(sel.reduce((s, r) => s + r.gp, 0)), co2: Math.round(totalKg * CO2_PER_KG) },
  }
}
