import { useEffect, useMemo, useRef, useState } from 'react'
import {
  HUBS,
  COLLECTION_HUBS,
  PICKUP_THRESHOLD,
  DISPATCH_TRIGGER,
  DISPATCH_CONFIG,
  initialHubLoads,
} from '../data/catalog.js'
import { createFleetState, schedulePickup, fmtClock, minutesIntoDay, advanceLoad } from '../lib/dispatch.js'
import { Card, CardHeader, Stat } from '../components/ui.jsx'
import LiveRouteMap from '../components/LiveRouteMap.jsx'

const C = DISPATCH_CONFIG
const SPEEDS = [
  { x: 30, label: '0.5×' },
  { x: 60, label: '1×' },
  { x: 180, label: '3×' },
  { x: 600, label: '10×' },
]
const TICK_MS = 250 // real ms per sim tick

function fillText(fill) {
  if (fill >= PICKUP_THRESHOLD) return 'text-red-600'
  if (fill >= 0.5) return 'text-amber-600'
  return 'text-green-600'
}

export default function LiveLogistics() {
  // Simulated clock: absolute minutes from day 0. Start at day start (09:00).
  const [clock, setClock] = useState(C.dayStartMin)
  const [playing, setPlaying] = useState(true)
  const [speed, setSpeed] = useState(60) // sim-minutes per real second
  // Live hub loads (kg), independent of the global store.
  const [loads, setLoads] = useState(() => initialHubLoads())
  // Scheduled itineraries + which hubs are already assigned (so we don't
  // re-dispatch a hub that a truck is already coming for).
  const [itineraries, setItineraries] = useState([])
  const assignedRef = useRef(new Set()) // hubIds currently being serviced
  const fleetRef = useRef(createFleetState()) // persistent per-truck availability
  const clockRef = useRef(clock)
  clockRef.current = clock

  // Advance the simulated clock + grow hub loads.
  useEffect(() => {
    if (!playing) return
    const id = setInterval(() => {
      const deltaMin = (speed * TICK_MS) / 1000
      setClock((c) => c + deltaMin)
      setLoads((prev) => {
        const next = { ...prev }
        for (const h of COLLECTION_HUBS) {
          // Only grow during operating hours (bins fill from daytime activity).
          const mins = minutesIntoDay(clockRef.current)
          if (mins >= C.dayStartMin && mins < C.dayEndMin) {
            next[h.id] = advanceLoad(prev[h.id] ?? 0, h, deltaMin)
          }
        }
        return next
      })
    }, TICK_MS)
    return () => clearInterval(id)
  }, [playing, speed])

  // Predicted hub view from live loads. A pickup is TRIGGERED at DISPATCH_TRIGGER
  // but the bin keeps filling while the truck is en route (so it looks genuinely
  // full on arrival, not collected the instant it hit 80%).
  const hubs = useMemo(
    () =>
      COLLECTION_HUBS.map((h) => {
        const loadKg = Math.round(loads[h.id] ?? 0)
        const fill = h.capacityKg > 0 ? Math.min(1, loadKg / h.capacityKg) : 0
        const remaining = DISPATCH_TRIGGER - fill
        const hoursToFull =
          fill >= DISPATCH_TRIGGER ? 0 : h.fillRate > 0 ? remaining / h.fillRate : null
        return { ...h, loadKg, fill, hoursToFull, needsPickup: fill >= DISPATCH_TRIGGER }
      }),
    [loads]
  )

  // Auto-dispatch: each newly-flagged hub is assigned to the soonest-free truck
  // via the persistent fleet state, so a truck is never double-booked.
  useEffect(() => {
    const flagged = hubs
      .filter((h) => h.needsPickup && !assignedRef.current.has(h.id))
      .sort((a, b) => b.loadKg - a.loadKg) // fullest first
    if (flagged.length === 0) return

    const newRuns = []
    for (const hub of flagged) {
      const run = schedulePickup(hub, clockRef.current, fleetRef.current)
      if (run) {
        assignedRef.current.add(hub.id)
        newRuns.push(run)
      }
    }
    if (newRuns.length) setItineraries((prev) => [...prev, ...newRuns])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hubs])

  // When a truck's pickup leg "arrives", empty that hub (load -> 0) and free it
  // for future dispatch once the whole itinerary completes.
  useEffect(() => {
    if (!itineraries.length) return
    let changed = false
    const now = clock
    const emptied = {}
    for (const it of itineraries) {
      for (const leg of it.legs) {
        if (leg.type === 'pickup' && !leg.done && now >= leg.arrive) {
          leg.done = true
          emptied[leg.hubId] = true
          changed = true
        }
      }
    }
    if (Object.keys(emptied).length) {
      setLoads((prev) => {
        const next = { ...prev }
        for (const id of Object.keys(emptied)) next[id] = 0
        return next
      })
    }
    // Release finished itineraries so their hubs can be re-dispatched later.
    for (const it of itineraries) {
      if (now >= it.finish && !it.released) {
        it.released = true
        it.hubIds.forEach((id) => assignedRef.current.delete(id))
        changed = true
      }
    }
    if (changed) setItineraries((its) => [...its]) // nudge re-render
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clock])

  // Active itineraries = not fully finished yet (for display + map).
  const active = itineraries.filter((it) => clock < it.finish + 1)
  const assignedHubIds = new Set(active.flatMap((it) => it.hubIds))

  function resetSim() {
    setClock(C.dayStartMin)
    setLoads(initialHubLoads())
    setItineraries([])
    assignedRef.current = new Set()
    fleetRef.current = createFleetState()
  }

  const flaggedCount = hubs.filter((h) => h.needsPickup).length

  return (
    <div className="space-y-5">
      {/* Clock + controls */}
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🕒</span>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Simulated operations clock
              </p>
              <p className="text-2xl font-bold tabular-nums text-slate-900">{fmtClock(clock)}</p>
              <p className="text-xs text-slate-400">
                Hours {Math.floor(C.dayStartMin / 60)}:00–{Math.floor(C.dayEndMin / 60)}:00 · pickup cutoff{' '}
                {Math.floor(C.cutoffMin / 60)}:00
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPlaying((p) => !p)}
              className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700"
            >
              {playing ? '⏸ Pause' : '▶ Play'}
            </button>
            <div className="inline-flex rounded-lg bg-slate-100 p-0.5 text-xs font-semibold">
              {SPEEDS.map((s) => (
                <button
                  key={s.x}
                  onClick={() => setSpeed(s.x)}
                  className={`rounded-md px-2.5 py-1 transition ${
                    speed === s.x ? 'bg-white text-green-700 shadow-sm' : 'text-slate-500'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
            <button
              onClick={resetSim}
              className="rounded-lg bg-white px-3 py-2 text-xs font-semibold text-slate-600 ring-1 ring-slate-300 hover:bg-slate-50"
            >
              Restart
            </button>
          </div>
        </div>
      </Card>

      {/* Live capacity + map side by side, matched & window-responsive height */}
      <div className="grid grid-cols-1 items-stretch gap-5 lg:grid-cols-2">
      <Card className="flex flex-col overflow-hidden lg:h-[min(60vh,560px)] lg:max-h-[560px] lg:min-h-[320px]">
        <CardHeader
          title="Live Hub Capacity"
          subtitle={`Bins fill live; at ${Math.round(PICKUP_THRESHOLD * 100)}% the AI auto-schedules a pickup`}
        />
        <div className="min-h-0 flex-1 overflow-y-auto">
          <table className="w-full table-fixed text-sm">
            <colgroup>
              <col className="w-[34%]" />
              <col className="w-[30%]" />
              <col className="w-[16%]" />
              <col className="w-[20%]" />
            </colgroup>
            <thead className="sticky top-0 z-10 bg-white">
              <tr className="border-b border-slate-100 text-left text-[11px] uppercase tracking-wide text-slate-400">
                <th className="whitespace-nowrap px-4 py-2.5 font-semibold">Hub</th>
                <th className="whitespace-nowrap px-2 py-2.5 font-semibold">Fill</th>
                <th className="whitespace-nowrap px-2 py-2.5 font-semibold">Load</th>
                <th className="whitespace-nowrap px-4 py-2.5 text-right font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {hubs.map((h) => {
                const coming = assignedHubIds.has(h.id)
                return (
                  <tr key={h.id} className="border-b border-slate-50 align-middle">
                    <td className="truncate px-4 py-2.5 font-medium text-slate-800" title={h.name}>
                      {h.name}
                    </td>
                    <td className="px-2 py-2.5">
                      <div className="flex items-center gap-1.5">
                        <div className="h-1.5 w-14 shrink-0 overflow-hidden rounded-full bg-slate-100">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{
                              width: `${Math.round(h.fill * 100)}%`,
                              backgroundColor:
                                h.fill >= PICKUP_THRESHOLD ? '#ef4444' : h.fill >= 0.5 ? '#f59e0b' : '#22c55e',
                            }}
                          />
                        </div>
                        <span className={`text-xs font-semibold tabular-nums ${fillText(h.fill)}`}>
                          {Math.round(h.fill * 100)}%
                        </span>
                      </div>
                      <span className="mt-0.5 block text-[10px] text-slate-400">
                        {h.hoursToFull === null ? '' : h.hoursToFull <= 0 ? 'full now' : `full in ~${h.hoursToFull.toFixed(1)}h`}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-2 py-2.5 text-xs tabular-nums text-slate-600">
                      {h.loadKg} kg
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      {coming ? (
                        <span className="whitespace-nowrap rounded-full bg-blue-100 px-2 py-0.5 text-[11px] font-semibold text-blue-700">
                          🚛 Scheduled
                        </span>
                      ) : h.needsPickup ? (
                        <span className="whitespace-nowrap rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
                          Needs pickup
                        </span>
                      ) : (
                        <span className="whitespace-nowrap rounded-full bg-green-100 px-2 py-0.5 text-[11px] font-semibold text-green-700">
                          Healthy
                        </span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Map */}
      <Card className="flex flex-col overflow-hidden lg:h-[min(60vh,560px)] lg:max-h-[560px] lg:min-h-[320px]">
        <CardHeader
          title="Fleet Dispatch Map — Greenview Township"
          subtitle={`${flaggedCount} at/over threshold · ${active.length} active route${active.length === 1 ? '' : 's'}`}
        />
        <div className="min-h-0 flex-1 p-3">
          <LiveRouteMap hubs={hubs} itineraries={active} assignedHubIds={assignedHubIds} clock={clock} />
        </div>
      </Card>
      </div>

      {/* Flight-board itineraries (full width below) */}
      <Card>
        <CardHeader title="Fleet Schedule" subtitle="Auto-generated departures, arrivals and depot returns" />
        <div className="space-y-4 px-5 py-4">
          {active.length === 0 ? (
            <div className="rounded-lg bg-slate-50 px-4 py-6 text-center text-sm text-slate-400 ring-1 ring-slate-100">
              No active dispatch. Let the clock run — the AI schedules trucks as hubs reach capacity.
            </div>
          ) : (
            active.map((it) => <FleetBoard key={`${it.truck.id}-${it.depart}`} it={it} clock={clock} />)
          )}
        </div>
      </Card>
    </div>
  )
}

function legIcon(type) {
  return type === 'pickup' ? '📦' : '🏭'
}

function FleetBoard({ it, clock }) {
  const inProgress = clock >= it.depart && clock < it.finish
  const done = clock >= it.finish
  return (
    <div className="rounded-xl border border-slate-200">
      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2">
        <div className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-full" style={{ backgroundColor: it.truck.color }} />
          <span className="text-sm font-semibold text-slate-800">{it.truck.name}</span>
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
              done
                ? 'bg-slate-100 text-slate-500'
                : inProgress
                ? 'bg-blue-100 text-blue-700'
                : 'bg-amber-100 text-amber-700'
            }`}
          >
            {done ? 'Completed' : inProgress ? 'En route' : 'Scheduled'}
          </span>
        </div>
        <span className="text-xs text-slate-500">
          {it.pickups.length} stop{it.pickups.length === 1 ? '' : 's'} · {it.totalLoadKg} kg
        </span>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-[11px] uppercase tracking-wide text-slate-400">
            <th className="px-4 py-1.5 font-medium">Leg</th>
            <th className="px-3 py-1.5 font-medium">Depart</th>
            <th className="px-3 py-1.5 font-medium">Arrive</th>
            <th className="px-4 py-1.5 font-medium">Load</th>
          </tr>
        </thead>
        <tbody>
          {it.legs.map((leg, i) => {
            const legDone = clock >= leg.arrive
            const legActive = clock >= leg.depart && clock < leg.arrive
            return (
              <tr key={i} className={`border-t border-slate-50 ${legActive ? 'bg-blue-50/50' : ''}`}>
                <td className="px-4 py-2">
                  <span className="mr-1">{legIcon(leg.type)}</span>
                  <span className="text-slate-700">
                    {leg.from} → <span className="font-medium">{leg.to}</span>
                  </span>
                  {leg.type === 'pickup' && leg.rolledToNextDay && (
                    <span className="ml-2 rounded bg-purple-100 px-1.5 py-0.5 text-[10px] font-semibold text-purple-700">
                      next day (after cutoff)
                    </span>
                  )}
                  {leg.type === 'pickup' && leg.delayed && !leg.rolledToNextDay && (
                    <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">
                      delayed
                    </span>
                  )}
                  {leg.type === 'return' && (
                    <span className="ml-2 text-[10px] text-slate-400">unload</span>
                  )}
                </td>
                <td className="px-3 py-2 tabular-nums text-slate-600">{fmtClock(leg.depart)}</td>
                <td className={`px-3 py-2 tabular-nums ${legDone ? 'text-green-600' : 'text-slate-600'}`}>
                  {fmtClock(leg.arrive)} {legDone ? '✓' : ''}
                </td>
                <td className="px-4 py-2 tabular-nums text-slate-500">{leg.loadKg} kg</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
