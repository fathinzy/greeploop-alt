import { HUBS, TRUCKS, PICKUP_THRESHOLD, COLLECTION_HUBS, DISPATCH_CONFIG } from '../data/catalog.js'

const C = DISPATCH_CONFIG
const depot = HUBS.find((h) => h.isDepot)

function round(n, dp = 1) {
  const f = 10 ** dp
  return Math.round(n * f) / f
}

// Haversine distance in km between two hub-like {lat,lng} points.
export function distanceKm(a, b) {
  const R = 6371
  const dLat = ((b.lat - a.lat) * Math.PI) / 180
  const dLng = ((b.lng - a.lng) * Math.PI) / 180
  const lat1 = (a.lat * Math.PI) / 180
  const lat2 = (b.lat * Math.PI) / 180
  const h =
    Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2)
  return 2 * R * Math.asin(Math.sqrt(h))
}

function travelMin(a, b) {
  return (distanceKm(a, b) / C.avgSpeedKmh) * 60
}

// Format absolute minutes-from-day-0 into "Day N HH:MM" (or just HH:MM for day 0).
export function fmtClock(absMin) {
  const day = Math.floor(absMin / 1440)
  const m = ((absMin % 1440) + 1440) % 1440
  const hh = String(Math.floor(m / 60)).padStart(2, '0')
  const mm = String(Math.round(m % 60)).padStart(2, '0')
  const t = `${hh}:${mm}`
  return day > 0 ? `+${day}d ${t}` : t
}

export function minutesIntoDay(absMin) {
  return ((absMin % 1440) + 1440) % 1440
}

// Earliest working time at or after `absMin`, honouring day start/end.
// If after the cutoff, roll to the next day's start.
function earliestWorking(absMin, { useCutoff = false } = {}) {
  const day = Math.floor(absMin / 1440)
  const mins = minutesIntoDay(absMin)
  const limit = useCutoff ? C.cutoffMin : C.dayEndMin
  if (mins < C.dayStartMin) return day * 1440 + C.dayStartMin
  if (mins >= limit) return (day + 1) * 1440 + C.dayStartMin
  return absMin
}

/**
 * Build itineraries for the flagged hubs using nearest-idle assignment with
 * capacity-aware depot returns and operating-hour rules.
 *
 * @param {Array} hubs   predicted hubs (each with loadKg, needsPickup, lat/lng)
 * @param {number} nowAbs current simulated absolute minute
 * @returns {{ itineraries, assignedHubIds }}
 */
export function buildSchedule(hubs, nowAbs) {
  // Hubs needing pickup, worst (fullest) first.
  const pending = hubs
    .filter((h) => h.needsPickup)
    .sort((a, b) => b.loadKg - a.loadKg)
    .map((h) => ({ ...h }))

  // Ops needs a little time to notice a full hub and ready a truck before it
  // can roll out — so pickups are not instantaneous.
  const readyAt = earliestWorking(nowAbs + C.dispatchNoticeMin)

  // Each truck tracks: current position, time it's free, legs, and load.
  const trucks = TRUCKS.map((t) => ({
    truck: t,
    pos: depot,
    freeAt: readyAt,
    load: 0,
    legs: [], // { type, from, to, hubId, hubName, depart, arrive, loadKg, delayed }
  }))

  const assignedHubIds = []

  while (pending.length) {
    // Pick the truck that can start its next leg earliest.
    trucks.sort((a, b) => a.freeAt - b.freeAt)
    const tk = trucks[0]

    // Choose the nearest pending hub to this truck's current position.
    let bestIdx = 0
    let bestD = Infinity
    for (let i = 0; i < pending.length; i++) {
      const d = distanceKm(tk.pos, pending[i])
      if (d < bestD) {
        bestD = d
        bestIdx = i
      }
    }
    const hub = pending[bestIdx]

    // Capacity check: if adding this hub exceeds truck capacity, go empty first.
    if (tk.load + hub.loadKg > C.truckCapacityKg && tk.load > 0) {
      const tMin = travelMin(tk.pos, depot)
      let depart = earliestWorking(tk.freeAt)
      let arrive = depart + tMin
      tk.legs.push({
        type: 'return',
        from: tk.pos.name,
        to: depot.name,
        depart,
        arrive,
        loadKg: tk.load,
      })
      tk.pos = depot
      tk.load = 0
      tk.freeAt = arrive + C.unloadMin
      continue // re-evaluate assignment after emptying
    }

    // Schedule the trip to this hub. Departure must be within working hours and
    // before the cutoff; otherwise it rolls to the next morning.
    const tMin = travelMin(tk.pos, hub)
    let depart = earliestWorking(tk.freeAt, { useCutoff: true })
    let arrive = depart + tMin
    const delayed = depart > tk.freeAt + 1 // pushed later than ready time

    tk.legs.push({
      type: 'pickup',
      from: tk.pos.name,
      to: hub.name,
      hubId: hub.id,
      hubName: hub.name,
      depart,
      arrive,
      loadKg: hub.loadKg,
      delayed,
      rolledToNextDay: Math.floor(depart / 1440) > Math.floor(nowAbs / 1440),
    })

    tk.pos = hub
    tk.load += hub.loadKg
    tk.freeAt = arrive + C.serviceMinPerHub
    assignedHubIds.push(hub.id)
    pending.splice(bestIdx, 1)
  }

  // Each truck that collected anything returns to the depot to finish.
  for (const tk of trucks) {
    if (tk.legs.length && tk.pos !== depot) {
      const tMin = travelMin(tk.pos, depot)
      const depart = tk.freeAt
      const arrive = depart + tMin
      tk.legs.push({ type: 'return', from: tk.pos.name, to: depot.name, depart, arrive, loadKg: tk.load })
      tk.pos = depot
      tk.freeAt = arrive + C.unloadMin
    }
  }

  const itineraries = trucks
    .filter((tk) => tk.legs.length)
    .map((tk) => {
      const pickups = tk.legs.filter((l) => l.type === 'pickup')
      const firstDepart = tk.legs[0].depart
      const lastArrive = tk.legs[tk.legs.length - 1].arrive + C.unloadMin
      const path = buildPath(tk.legs)
      return {
        truck: tk.truck,
        legs: tk.legs,
        pickups,
        hubIds: pickups.map((p) => p.hubId),
        totalLoadKg: round(pickups.reduce((s, p) => s + p.loadKg, 0), 0),
        depart: firstDepart,
        finish: lastArrive,
        path,
      }
    })

  return { itineraries, assignedHubIds }
}

// Build a polyline path (list of [lat,lng]) following the leg sequence.
function buildPath(legs) {
  const byName = Object.fromEntries(HUBS.map((h) => [h.name, h]))
  const pts = []
  if (legs.length) {
    const first = byName[legs[0].from]
    if (first) pts.push([first.lat, first.lng])
  }
  for (const l of legs) {
    const to = byName[l.to]
    if (to) pts.push([to.lat, to.lng])
  }
  return pts
}

// Live fill helper: advance a hub's load by its fill rate over `deltaMin`.
export function advanceLoad(loadKg, hub, deltaMin) {
  const perMin = (hub.fillRate * hub.capacityKg) / 60 // fillRate is per hour
  return Math.min(hub.capacityKg, loadKg + perMin * deltaMin)
}

// ---------------------------------------------------------------------------
// Fleet-aware incremental dispatch.
//
// The live sim flags hubs one at a time, so we must NOT re-plan the whole
// fleet from scratch each time (that always re-picks Alpha). Instead we keep a
// persistent per-truck "free at" time and assign each new pickup to the truck
// that becomes available soonest — so a truck is never double-booked, and work
// alternates across the fleet.
// ---------------------------------------------------------------------------

// Create the persistent fleet state (one entry per truck).
export function createFleetState() {
  return TRUCKS.map((t) => ({ truck: t, freeAt: 0, pos: depot }))
}

/**
 * Schedule a single hub pickup against the live fleet state (mutates it).
 * Returns the itinerary for this run, or null if the hub is empty.
 *
 * @param {object} hub      the flagged hub (loadKg, lat/lng, id, name)
 * @param {number} nowAbs   current simulated absolute minute
 * @param {Array}  fleet    persistent fleet state from createFleetState()
 */
export function schedulePickup(hub, nowAbs, fleet) {
  if (!hub || hub.loadKg <= 0) return null

  // Ops notice delay before a truck can roll out.
  const readyFloor = earliestWorking(nowAbs + C.dispatchNoticeMin)

  // Pick the truck that can begin this run soonest (respecting its current
  // commitments). Each truck must first be free AND within working hours.
  let best = null
  for (const f of fleet) {
    const canStart = earliestWorking(Math.max(f.freeAt, readyFloor), { useCutoff: true })
    if (!best || canStart < best.start) best = { f, start: canStart }
  }
  const { f, start } = best

  // Trip: depot -> hub (pickup) -> depot (unload).
  const toHub = travelMin(depot, hub)
  const depart = start
  const arrive = depart + toHub
  const serviceEnd = arrive + C.serviceMinPerHub
  const backMin = travelMin(hub, depot)
  const retDepart = serviceEnd
  const retArrive = retDepart + backMin
  const finish = retArrive + C.unloadMin

  const legs = [
    {
      type: 'pickup',
      from: depot.name,
      to: hub.name,
      hubId: hub.id,
      hubName: hub.name,
      depart,
      arrive,
      loadKg: hub.loadKg,
      delayed: depart > readyFloor + 1,
      rolledToNextDay: Math.floor(depart / 1440) > Math.floor(nowAbs / 1440),
    },
    { type: 'return', from: hub.name, to: depot.name, depart: retDepart, arrive: retArrive, loadKg: hub.loadKg },
  ]

  // Commit this truck until it finishes and is back at the depot.
  f.freeAt = finish
  f.pos = depot

  return {
    truck: f.truck,
    legs,
    pickups: [legs[0]],
    hubIds: [hub.id],
    totalLoadKg: round(hub.loadKg, 0),
    depart,
    finish,
    path: buildPath(legs),
  }
}

export { PICKUP_THRESHOLD, COLLECTION_HUBS, C as DISPATCH_CONFIG }
