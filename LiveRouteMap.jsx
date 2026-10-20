import { useEffect, useRef, useState } from 'react'
import { MapContainer, TileLayer, Marker, Popup, Polyline, CircleMarker, Tooltip } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png'
import markerIcon from 'leaflet/dist/images/marker-icon.png'
import markerShadow from 'leaflet/dist/images/marker-shadow.png'
import { HUBS, PICKUP_THRESHOLD } from '../data/catalog.js'
import { fmtClock } from '../lib/dispatch.js'
import { fetchRoad, pointAtFraction } from '../lib/routing.js'

delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
})

const depot = HUBS.find((h) => h.isDepot)
const byName = Object.fromEntries(HUBS.map((h) => [h.name, h]))

// Build a truck icon as a coloured pin with a 🚛 glyph.
function truckIcon(color) {
  return L.divIcon({
    className: '',
    html: `<div style="transform:translate(-50%,-50%);background:${color};width:26px;height:26px;border-radius:50%;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4);display:flex;align-items:center;justify-content:center;font-size:14px">🚛</div>`,
    iconSize: [26, 26],
    iconAnchor: [13, 13],
  })
}

/**
 * Resolve each itinerary's legs to road polylines (async, cached), returning a
 * map keyed by itinerary id -> { fullPath, legs:[{road, depart, arrive, from, to}] }.
 */
function useRoadRoutes(itineraries) {
  const [routes, setRoutes] = useState({})
  const reqRef = useRef(0)

  useEffect(() => {
    let cancelled = false
    const myReq = ++reqRef.current
    async function run() {
      const out = {}
      for (const it of itineraries) {
        const legs = []
        const fullPath = []
        for (const leg of it.legs) {
          const a = byName[leg.from]
          const b = byName[leg.to]
          if (!a || !b) continue
          const road = await fetchRoad([
            [a.lat, a.lng],
            [b.lat, b.lng],
          ])
          legs.push({ road, depart: leg.depart, arrive: leg.arrive, type: leg.type })
          if (fullPath.length) fullPath.push(...road.slice(1))
          else fullPath.push(...road)
        }
        out[it.truck.id + it.depart] = { fullPath, legs }
      }
      if (!cancelled && myReq === reqRef.current) setRoutes(out)
    }
    if (itineraries.length) run()
    else setRoutes({})
    return () => {
      cancelled = true
    }
  }, [itineraries])

  return routes
}

// Truck position at a given clock, along its leg roads. Returns [lat,lng] or null.
function truckPosition(route, clock) {
  if (!route || !route.legs.length) return null
  const legs = route.legs
  // Before first departure -> at the start (depot).
  if (clock <= legs[0].depart) return legs[0].road[0]
  // After last arrival -> at the final stop.
  const last = legs[legs.length - 1]
  if (clock >= last.arrive) return last.road[last.road.length - 1]
  for (const leg of legs) {
    if (clock >= leg.depart && clock <= leg.arrive) {
      const frac = (clock - leg.depart) / Math.max(1, leg.arrive - leg.depart)
      return pointAtFraction(leg.road, frac)
    }
    // In a gap between this leg's arrival and the next leg's departure
    // (servicing a hub / unloading) -> sit at this leg's end point.
    if (clock > leg.arrive) {
      const end = leg.road[leg.road.length - 1]
      // keep this as the latest known position; loop continues to find a
      // later active leg, otherwise this value stands.
      route._parked = end
    }
  }
  return route._parked || legs[0].road[0]
}

export default function LiveRouteMap({ hubs, itineraries, assignedHubIds, clock }) {
  const center = [depot.lat, depot.lng]
  const routes = useRoadRoutes(itineraries)

  const hubColor = {}
  for (const it of itineraries) {
    for (const p of it.pickups) hubColor[p.hubId] = it.truck.color
  }

  return (
    <div className="relative h-full min-h-[260px] w-full overflow-hidden rounded-xl ring-1 ring-slate-200">
      <MapContainer center={center} zoom={13} scrollWheelZoom={false} className="h-full w-full">
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {/* Road-following route per active itinerary */}
        {itineraries.map((it) => {
          const key = it.truck.id + it.depart
          const route = routes[key]
          const line = route?.fullPath?.length > 1 ? route.fullPath : it.path
          return line && line.length > 1 ? (
            <Polyline
              key={key}
              positions={line}
              pathOptions={{ color: it.truck.color, weight: 4, opacity: 0.8 }}
            />
          ) : null
        })}

        {/* Depot */}
        <Marker position={[depot.lat, depot.lng]}>
          <Popup>
            <strong>{depot.name}</strong>
            <br />
            Fleet start / end · unload point
          </Popup>
        </Marker>

        {/* Hubs */}
        {hubs.map((h) => {
          const assigned = hubColor[h.id]
          const color = assigned ? assigned : h.fill >= PICKUP_THRESHOLD ? '#f59e0b' : '#22c55e'
          return (
            <CircleMarker
              key={h.id}
              center={[h.lat, h.lng]}
              radius={10}
              pathOptions={{
                color,
                fillColor: color,
                fillOpacity: assigned ? 0.9 : h.fill >= PICKUP_THRESHOLD ? 0.8 : 0.55,
                weight: assigned ? 3 : 2,
              }}
            >
              <Tooltip direction="top" offset={[0, -8]}>
                {h.name}: {Math.round(h.fill * 100)}%
              </Tooltip>
              <Popup>
                <strong>{h.name}</strong>
                <br />
                Fill: {Math.round(h.fill * 100)}% ({h.loadKg} kg)
                <br />
                {assigned ? '🚛 Pickup scheduled' : h.fill >= PICKUP_THRESHOLD ? '⚠️ Needs pickup' : '✅ Healthy'}
              </Popup>
            </CircleMarker>
          )
        })}

        {/* Moving truck markers */}
        {itineraries.map((it) => {
          const key = it.truck.id + it.depart
          const route = routes[key]
          const pos = route ? truckPosition(route, clock) : null
          if (!pos) return null
          return (
            <Marker key={`truck-${key}`} position={pos} icon={truckIcon(it.truck.color)}>
              <Tooltip direction="top" offset={[0, -14]}>
                {it.truck.name}
              </Tooltip>
            </Marker>
          )
        })}
      </MapContainer>

      {/* Legend of active fleets */}
      {itineraries.length > 0 && (
        <div className="pointer-events-none absolute bottom-2 left-2 z-[500] space-y-1 rounded-lg bg-white/90 p-2 text-xs shadow ring-1 ring-slate-200">
          {itineraries.map((it) => (
            <div key={it.truck.id + it.depart} className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: it.truck.color }} />
              <span className="font-medium text-slate-700">{it.truck.name}</span>
              <span className="text-slate-400">
                dep {fmtClock(it.depart)} · {it.pickups.length} stop{it.pickups.length === 1 ? '' : 's'}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
