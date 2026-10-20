import { useEffect, useRef, useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { useStore } from '../store/StoreContext.jsx'
import { nextHubId } from '../store/reducer.js'
import { Card } from '../components/ui.jsx'

const inp = 'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-green-500'

function RegisterModal({ onClose }) {
  const { state, dispatch } = useStore()
  const [name, setName] = useState('')
  const [location, setLocation] = useState('')
  const id = nextHubId(state)
  function save(e) {
    e.preventDefault()
    if (!name.trim() || !location.trim()) return
    dispatch({ type: 'ADD_HUB', hub: { id, name: name.trim(), location: location.trim(), mode: 'auto' } })
    onClose()
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <form onSubmit={save} className="w-full max-w-sm space-y-3 rounded-2xl bg-white p-5 shadow-xl">
        <h3 className="text-base font-bold text-slate-900">Register hub</h3>
        <label className="block text-sm"><span className="mb-1 block font-medium text-slate-700">Hub name</span>
          <input className={inp} value={name} onChange={(e) => setName(e.target.value)} autoFocus /></label>
        <label className="block text-sm"><span className="mb-1 block font-medium text-slate-700">Hub location</span>
          <input className={inp} value={location} onChange={(e) => setLocation(e.target.value)} /></label>
        <p className="text-xs text-slate-500">The Hub ID is generated when you save. New hubs run the automatic simulation.</p>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-lg bg-white px-3 py-2 text-sm font-semibold text-slate-600 ring-1 ring-slate-300">Cancel</button>
          <button className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700">Save</button>
        </div>
      </form>
    </div>
  )
}

function HubDetail({ hub, onBack }) {
  const { state, dispatch } = useStore()
  const frame = useRef()
  const sess = state.hubSessions[hub.id]
  const sessRef = useRef(sess)
  sessRef.current = sess

  const sendLink = () => {
    const s = sessRef.current
    frame.current?.contentWindow?.postMessage(s ? { type: 'link', uid: s.uid, name: s.name } : { type: 'unlink' }, '*')
  }

  // The simulator reports approved drops; the store credits the linked user.
  useEffect(() => {
    function onMsg(e) {
      const d = e.data
      if (!d || d.src !== 'hub-sim' || d.hubId !== hub.id) return
      if (d.type === 'ready') sendLink()
      if (d.type === 'drop') dispatch({ type: 'HUB_DROP', hubId: hub.id, itemId: d.itemId, quantity: d.quantity })
      if (d.type === 'end') dispatch({ type: 'UNLINK_HUB', hubId: hub.id })
    }
    window.addEventListener('message', onMsg)
    return () => window.removeEventListener('message', onMsg)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hub.id, dispatch])

  useEffect(sendLink, [sess?.uid])

  const q = new URLSearchParams({ mode: hub.mode, hub: hub.id, name: hub.name, loc: hub.location })
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <button onClick={onBack} className="text-sm font-semibold text-green-700 hover:underline">← All hubs</button>
          <h3 className="text-lg font-bold text-slate-900">{hub.name} <span className="font-mono text-sm font-normal text-slate-500">{hub.id}</span></h3>
          <p className="text-sm text-slate-500">{hub.location}</p>
        </div>
        <div className="flex items-center gap-3 rounded-xl bg-white p-2 pr-4 ring-1 ring-slate-200">
          <QRCodeSVG value={`GREENLOOP|${hub.id}`} size={64} />
          <div className="text-xs text-slate-500"><p className="font-semibold text-slate-700">Hub QR</p><p>Users scan this in the app</p><p className="font-mono">{hub.id}</p></div>
        </div>
      </div>
      <Card className="overflow-hidden">
        <iframe ref={frame} title={hub.name} src={`/hub-sim.html?${q}`} onLoad={sendLink}
          style={{ width: '100%', height: hub.mode === 'manual' ? 1080 : 760, border: 0, background: '#0d1117' }} />
      </Card>
      <p className="text-xs text-slate-500">
        {hub.mode === 'manual'
          ? 'Manual demo: operate the bin yourself, or let a resident scan the QR from the User/Tenant app.'
          : 'Automatic simulation: residents and tenants scan the QR and recycle on their own while this page is open.'}
      </p>
    </div>
  )
}

export default function HubsView() {
  const { state } = useStore()
  const [open, setOpen] = useState(null)
  const [reg, setReg] = useState(false)
  const hub = state.hubs.find((h) => h.id === open)
  if (hub) return <HubDetail hub={hub} onBack={() => setOpen(null)} />
  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={() => setReg(true)} className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700">+ Register hub</button>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {state.hubs.map((h) => {
          const s = state.hubSessions[h.id]
          return (
            <button key={h.id} onClick={() => setOpen(h.id)} className="rounded-xl bg-white p-4 text-left shadow-sm ring-1 ring-slate-200 transition hover:ring-green-400">
              <div className="flex items-start justify-between gap-2">
                <span className="text-3xl">🗑️</span>
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${h.mode === 'manual' ? 'bg-amber-50 text-amber-700' : 'bg-sky-50 text-sky-700'}`}>
                  {h.mode === 'manual' ? 'Manual demo' : 'Auto simulation'}
                </span>
              </div>
              <p className="mt-2 text-sm font-bold text-slate-900">{h.name}</p>
              <p className="font-mono text-xs text-slate-500">{h.id}</p>
              <p className="mt-1 text-xs text-slate-500">{h.location}</p>
              <p className={`mt-3 text-xs font-semibold ${s ? 'text-green-600' : 'text-slate-400'}`}>{s ? `● Linked: ${s.name}` : '○ No user linked'}</p>
            </button>
          )
        })}
      </div>
      {reg && <RegisterModal onClose={() => setReg(false)} />}
    </div>
  )
}
