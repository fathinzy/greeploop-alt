import { useEffect, useRef, useState } from 'react'
import { useStore, useAccount } from '../store/StoreContext.jsx'
import { Card, CardHeader } from '../components/ui.jsx'
import { GPBalance } from './ResidentView.jsx'

const time = (ts) => new Date(ts).toLocaleTimeString('en-MY', { hour: '2-digit', minute: '2-digit', second: '2-digit' })

export default function HubScanView() {
  const { state, dispatch, session } = useStore()
  const acct = useAccount()
  const [code, setCode] = useState('')
  const [err, setErr] = useState('')
  const [cam, setCam] = useState(false)
  const videoRef = useRef()

  const entry = Object.entries(state.hubSessions).find(([, s]) => s.uid === session.id)
  const hub = entry && state.hubs.find((h) => h.id === entry[0])
  const sess = entry && entry[1]

  function connect(raw) {
    const m = String(raw).toUpperCase().match(/HUB-\d{4}/)
    const h = m && state.hubs.find((x) => x.id === m[0])
    if (!h) return setErr('That QR is not a GreenLoop hub.')
    const cur = state.hubSessions[h.id]
    if (cur && cur.uid !== session.id) return setErr(`${h.name} is being used by another resident. Try again shortly.`)
    setErr('')
    dispatch({ type: 'LINK_HUB', hubId: h.id, uid: session.id })
  }

  // Camera QR scanning (Chrome/Android via BarcodeDetector). Others use the code box.
  useEffect(() => {
    if (!cam) return
    let stream, timer, stop = false
    ;(async () => {
      try {
        if (!('BarcodeDetector' in window)) throw new Error('This browser cannot read QR codes. Type the hub code instead.')
        const det = new window.BarcodeDetector({ formats: ['qr_code'] })
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
        videoRef.current.srcObject = stream
        await videoRef.current.play()
        timer = setInterval(async () => {
          const r = await det.detect(videoRef.current).catch(() => [])
          if (!stop && r[0]) { stop = true; setCam(false); connect(r[0].rawValue) }
        }, 400)
      } catch (e) { setErr(e.message || 'Camera not available.'); setCam(false) }
    })()
    return () => { clearInterval(timer); stream?.getTracks().forEach((t) => t.stop()) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cam])

  if (hub) {
    const total = sess.items.reduce((s, i) => s + i.gp, 0)
    return (
      <div className="space-y-5">
        <GPBalance balance={acct.tokenBalance} />
        <Card>
          <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
            <div>
              <p className="flex items-center gap-2 text-sm font-semibold text-green-700"><span className="h-2 w-2 animate-pulse rounded-full bg-green-500" /> Connected</p>
              <p className="mt-1 text-base font-bold text-slate-900">{hub.name} <span className="font-mono text-xs font-normal text-slate-500">{hub.id}</span></p>
              <p className="text-sm text-slate-500">Hub address: {hub.location}</p>
            </div>
            <button onClick={() => dispatch({ type: 'UNLINK_HUB', hubId: hub.id })}
              className="rounded-lg bg-white px-3 py-2 text-xs font-semibold text-red-600 ring-1 ring-red-200 hover:bg-red-50">Disconnect</button>
          </div>
          <p className="border-t border-slate-100 px-5 py-3 text-xs text-slate-500">
            Show your items to Cam 1 at the hub. Items that Cam 2 confirms appear below and the GP is added to your balance straight away.
          </p>
        </Card>
        <Card>
          <CardHeader title="Recycled this session" subtitle="Accepted items and the GP earned" right={<span className="text-sm font-bold text-green-600">+{total} GP</span>} />
          {sess.items.length === 0 ? (
            <div className="px-5 py-10 text-center text-sm text-slate-400">Waiting for your first item…</div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {sess.items.map((i) => (
                <li key={i.id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
                  <div><p className="font-medium text-slate-800">{i.quantity}× {i.name}</p><p className="text-xs text-slate-400">{time(i.timestamp)}</p></div>
                  <span className="font-semibold text-green-600">+{i.gp} GP</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <GPBalance balance={acct.tokenBalance} />
      <Card>
        <CardHeader title="Scan the Hub QR" subtitle="Scan the QR on the hub station to connect and start recycling" />
        <div className="space-y-4 px-5 py-5">
          {cam ? (
            <div className="space-y-2">
              <video ref={videoRef} className="aspect-video w-full rounded-lg bg-black object-cover" muted playsInline />
              <button onClick={() => setCam(false)} className="text-xs font-semibold text-slate-500 underline">Cancel</button>
            </div>
          ) : (
            <button onClick={() => { setErr(''); setCam(true) }} className="w-full rounded-lg bg-green-600 px-3 py-2.5 text-sm font-semibold text-white hover:bg-green-700">📷 Scan with camera</button>
          )}
          <form onSubmit={(e) => { e.preventDefault(); connect(code) }} className="flex gap-2">
            <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="Or type the hub code, e.g. HUB-0001"
              className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-green-500" />
            <button className="rounded-lg bg-white px-3 py-2 text-sm font-semibold text-slate-700 ring-1 ring-slate-300">Connect</button>
          </form>
          {err && <p className="text-sm text-red-600">{err}</p>}
        </div>
      </Card>
      <Card>
        <CardHeader title="Demo: simulate scanning a hub QR" subtitle="For testing without a camera" />
        <ul className="divide-y divide-slate-100">
          {state.hubs.map((h) => (
            <li key={h.id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
              <div><p className="font-medium text-slate-800">{h.name}</p><p className="text-xs text-slate-500">{h.id} · {h.location}</p></div>
              <button onClick={() => connect(h.id)} className="rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-green-700 ring-1 ring-green-300 hover:bg-green-50">Scan</button>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  )
}
