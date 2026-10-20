// Road-following routes via the public OSRM demo server, with a straight-line
// fallback so the demo never breaks if the API is unreachable/offline.
//
// OSRM wants coordinates as lng,lat and returns GeoJSON [lng,lat] pairs; we
// flip to Leaflet's [lat,lng]. Results are cached per route key.

const OSRM = 'https://router.project-osrm.org/route/v1/driving'
const cache = new Map()

// points: array of [lat, lng]. Returns a promise of [lat,lng][] following roads.
export async function fetchRoad(points) {
  if (!points || points.length < 2) return points || []
  const key = points.map((p) => `${p[0].toFixed(4)},${p[1].toFixed(4)}`).join(';')
  if (cache.has(key)) return cache.get(key)

  const coords = points.map(([lat, lng]) => `${lng},${lat}`).join(';')
  const url = `${OSRM}/${coords}?overview=full&geometries=geojson`
  try {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), 6000)
    const res = await fetch(url, { signal: ctrl.signal })
    clearTimeout(timer)
    if (!res.ok) throw new Error(`OSRM ${res.status}`)
    const data = await res.json()
    const line = data?.routes?.[0]?.geometry?.coordinates
    if (!Array.isArray(line) || line.length < 2) throw new Error('no geometry')
    const latlng = line.map(([lng, lat]) => [lat, lng])
    cache.set(key, latlng)
    return latlng
  } catch {
    // Fallback: straight segments between the given points.
    cache.set(key, points)
    return points
  }
}

// Total length (km) of a [lat,lng] polyline — used to place a moving marker by
// fraction of distance travelled.
export function polylineLengthKm(line) {
  let km = 0
  for (let i = 1; i < line.length; i++) km += haversine(line[i - 1], line[i])
  return km
}

function haversine(a, b) {
  const R = 6371
  const dLat = ((b[0] - a[0]) * Math.PI) / 180
  const dLng = ((b[1] - a[1]) * Math.PI) / 180
  const lat1 = (a[0] * Math.PI) / 180
  const lat2 = (b[0] * Math.PI) / 180
  const h = Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2)
  return 2 * R * Math.asin(Math.sqrt(h))
}

// Point at a given fraction (0..1) along a [lat,lng] polyline.
export function pointAtFraction(line, frac) {
  if (!line || line.length === 0) return null
  if (line.length === 1) return line[0]
  const total = polylineLengthKm(line)
  if (total === 0) return line[0]
  const target = Math.max(0, Math.min(1, frac)) * total
  let acc = 0
  for (let i = 1; i < line.length; i++) {
    const seg = haversine(line[i - 1], line[i])
    if (acc + seg >= target) {
      const t = seg === 0 ? 0 : (target - acc) / seg
      return [
        line[i - 1][0] + (line[i][0] - line[i - 1][0]) * t,
        line[i - 1][1] + (line[i][1] - line[i - 1][1]) * t,
      ]
    }
    acc += seg
  }
  return line[line.length - 1]
}
