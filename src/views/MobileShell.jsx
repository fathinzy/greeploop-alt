import { useEffect, useRef, useState } from 'react'
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts'
import { useStore, useAccount, useProfile } from '../store/StoreContext.jsx'
import { CATEGORIES, VOUCHERS } from '../data/catalog.js'
import { formatGP, formatWeight, formatRm, tokensToRm } from '../lib/engine.js'
import ProfileView, { Avatar } from './ProfileView.jsx'
import HubScanView from './HubScanView.jsx'
import ResidentView from './ResidentView.jsx'

function useCountUp(target) {
  const [v, setV] = useState(target)
  const from = useRef(target)
  useEffect(() => {
    const start = from.current, t0 = performance.now(), dur = 700
    let raf
    const tick = (t) => {
      const k = Math.min(1, (t - t0) / dur)
      setV(Math.round(start + (target - start) * (1 - Math.pow(1 - k, 3))))
      if (k < 1) raf = requestAnimationFrame(tick)
      else from.current = target
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target])
  return v
}

const ago = (ts) => {
  const d = Math.floor((Date.now() - ts) / 86400000)
  return d <= 0 ? 'Today' : d === 1 ? 'Yesterday' : `${d} days ago`
}

function events(acct) {
  return [
    ...acct.transactions.map((t) => ({ id: t.id, ts: t.timestamp, icon: '♻️', title: `${t.quantity}× ${t.name}`, sub: formatWeight(t.totalWeight), amt: `+${t.tokensAwarded}`, plus: true })),
    ...acct.redeemedVouchers.map((r) => ({ id: r.id, ts: r.timestamp, icon: r.emoji || '🎟️', title: r.name, sub: `${formatRm(r.value)} voucher`, amt: `−${r.costTokens}`, plus: false })),
    ...acct.feeOffsets.map((f) => ({ id: f.id, ts: f.timestamp, icon: '🏠', title: 'Fee offset', sub: `${formatRm(f.rm)} applied`, amt: `−${f.tokensUsed}`, plus: false })),
  ].sort((a, b) => b.ts - a.ts)
}

function Home({ go, tenant }) {
  const acct = useAccount()
  const me = useProfile()
  const bal = useCountUp(acct.tokenBalance)
  const evs = events(acct)

  const byCat = {}
  acct.transactions.forEach((t) => { byCat[t.category] = (byCat[t.category] || 0) + t.totalWeight })
  const pie = Object.entries(byCat).map(([k, v]) => ({ key: k, name: CATEGORIES[k]?.label || k, value: Math.round(v * 10) / 10, color: CATEGORIES[k]?.color || '#94a3b8' })).sort((a, b) => b.value - a.value)
  const totalKg = pie.reduce((s, p) => s + p.value, 0)
  const affordable = VOUCHERS.filter((v) => v.costTokens <= acct.tokenBalance).length

  return (
    <div className="space-y-4">
      {/* GP balance + profile */}
      <div className="flex items-stretch gap-3">
        <div className="relative flex-1 overflow-hidden rounded-3xl bg-gradient-to-br from-green-600 via-emerald-500 to-teal-400 p-4 text-white shadow-lg shadow-green-200">
          <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-white/15" />
          <div className="absolute -bottom-8 right-8 h-20 w-20 rounded-full bg-white/10" />
          <p className="text-[11px] font-semibold uppercase tracking-wider text-green-50">GP point balance</p>
          <p className="mt-1 text-4xl font-extrabold tabular-nums leading-none">{bal.toLocaleString()}<span className="ml-1.5 text-sm font-semibold text-green-50">GP</span></p>
          <p className="mt-1.5 text-xs text-green-50">≈ {formatRm(tokensToRm(acct.tokenBalance))} spendable</p>
        </div>
        <button onClick={() => go('profile')} className="flex w-20 shrink-0 flex-col items-center justify-center gap-1 rounded-3xl bg-white p-2 shadow-sm ring-1 ring-slate-200 active:scale-95">
          <Avatar user={me} size={46} />
          <span className="text-[10px] font-semibold text-slate-500">Profile</span>
        </button>
      </div>

      {/* Scan QR + pie */}
      <div className="grid grid-cols-2 gap-3">
        <button onClick={() => go('scan')} className="group relative flex aspect-square flex-col items-center justify-center overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-600 to-green-500 p-3 text-white shadow-lg shadow-green-200 active:scale-95">
          <span className="absolute h-24 w-24 animate-ping rounded-full bg-white/20" />
          <span className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-white/20 text-4xl backdrop-blur">▦</span>
          <span className="relative mt-2 text-lg font-extrabold">Scan QR</span>
          <span className="relative text-[11px] text-green-50">Connect to a hub</span>
        </button>
        <div className="flex aspect-square flex-col rounded-3xl bg-white p-3 shadow-sm ring-1 ring-slate-200">
          <p className="text-[11px] font-semibold leading-tight text-slate-600">What you have recycled</p>
          {pie.length === 0 ? (
            <div className="flex flex-1 items-center justify-center text-center text-xs text-slate-400">Nothing yet.<br />Scan a hub to start.</div>
          ) : (
            <>
              <div className="relative min-h-0 flex-1">
                <ResponsiveContainer>
                  <PieChart>
                    <Pie data={pie} dataKey="value" innerRadius="58%" outerRadius="92%" paddingAngle={2} stroke="none">
                      {pie.map((p) => <Cell key={p.key} fill={p.color} />)}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-sm font-extrabold text-slate-800">{totalKg >= 1000 ? `${(totalKg / 1000).toFixed(1)}t` : `${Math.round(totalKg)}kg`}</span>
                </div>
              </div>
              <div className="mt-1 flex flex-wrap gap-x-2 gap-y-0.5">
                {pie.slice(0, 4).map((p) => (
                  <span key={p.key} className="flex items-center gap-1 text-[9px] text-slate-500"><i className="h-1.5 w-1.5 rounded-full" style={{ background: p.color }} />{p.name.split(' ')[0]}</span>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Redeem / offset */}
      <button onClick={() => go(tenant ? 'offset' : 'redeem')} className="flex w-full items-center justify-between rounded-3xl bg-gradient-to-r from-amber-400 to-orange-400 px-5 py-4 text-left text-white shadow-lg shadow-amber-100 active:scale-[0.98]">
        <div>
          <p className="text-lg font-extrabold">{tenant ? 'Offset Maintenance Fee' : 'Redeem'}</p>
          <p className="text-xs text-amber-50">{tenant ? 'Use GP to reduce your mall service charge' : affordable ? `${affordable} voucher${affordable > 1 ? 's' : ''} you can claim now` : 'Spend GP at mall tenants'}</p>
        </div>
        <span className="text-3xl">{tenant ? '🏠' : '🎟️'}</span>
      </button>

      {/* Activity */}
      <div className="rounded-3xl bg-white shadow-sm ring-1 ring-slate-200">
        <div className="flex items-center justify-between px-4 pt-4">
          <p className="text-sm font-bold text-slate-800">Activity</p>
          <button onClick={() => go('activity')} className="text-xs font-semibold text-green-700">See all</button>
        </div>
        {evs.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-slate-400">No activity yet.</p>
        ) : (
          <ul className="px-2 pb-2 pt-1">
            {evs.slice(0, 5).map((e) => (
              <li key={e.id} className="flex items-center gap-3 rounded-2xl px-2 py-2.5">
                <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-100 text-lg">{e.icon}</span>
                <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-slate-800">{e.title}</p><p className="truncate text-xs text-slate-400">{e.sub} · {ago(e.ts)}</p></div>
                <span className={`text-sm font-bold ${e.plus ? 'text-green-600' : 'text-slate-400'}`}>{e.amt}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

const TITLES = { scan: 'Scan', redeem: 'Redeem', offset: 'Offset Maintenance Fee', activity: 'Activity', profile: 'Profile' }

export default function MobileShell({ role, onLogout, framed, onExit }) {
  const [tab, setTab] = useState('home')
  const me = useProfile()
  const { state, session, dispatch } = useStore()
  const tenant = role === 'tenant'
  const third = tenant ? { id: 'offset', icon: '🏠', label: 'Offset' } : { id: 'redeem', icon: '🎟️', label: 'Redeem' }
  const nav = [
    { id: 'home', icon: '🏡', label: 'Home' },
    third,
    { id: 'scan', icon: '▦', label: 'Scan', fab: true },
    { id: 'activity', icon: '📜', label: 'Activity' },
    { id: 'profile', icon: '👤', label: 'Profile' },
  ]

  function logout() {
    const e = Object.entries(state.hubSessions).find(([, s]) => s.uid === session?.id)
    if (e) dispatch({ type: 'UNLINK_HUB', hubId: e[0] })
    onLogout()
  }

  let body
  if (tab === 'home') body = <Home go={setTab} tenant={tenant} />
  else if (tab === 'scan') body = <HubScanView />
  else if (tab === 'profile') body = (<><ProfileView /><button onClick={logout} className="mt-4 w-full rounded-2xl bg-slate-800 py-3 text-sm font-semibold text-white">Log out</button></>)
  else body = <ResidentView page={tab} />

  return (
    <div className={`relative flex flex-col overflow-hidden bg-slate-100 ${framed ? 'h-[780px] w-[390px] rounded-[2.5rem] border-[10px] border-slate-900 shadow-2xl' : 'h-[100dvh] w-full'}`}>
      {framed && <div className="absolute left-1/2 top-0 z-20 h-5 w-28 -translate-x-1/2 rounded-b-2xl bg-slate-900" />}
      {tab === 'home' ? (
        <div className={`flex items-center justify-between px-5 pb-1 ${framed ? 'pt-8' : 'pt-4'}`}>
          <div className="flex items-center gap-2"><span className="text-2xl">♻️</span><div><p className="text-sm font-extrabold leading-tight text-slate-900">GreenLoop</p><p className="text-[10px] text-slate-500">Hi, {me?.name?.split(' ')[0]}</p></div></div>
          {onExit && <button onClick={onExit} className="rounded-full bg-white px-3 py-1 text-[11px] font-semibold text-slate-500 ring-1 ring-slate-200">Desktop</button>}
        </div>
      ) : (
        <div className={`flex items-center gap-3 px-5 pb-1 ${framed ? 'pt-8' : 'pt-4'}`}>
          <button onClick={() => setTab('home')} className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-slate-600 ring-1 ring-slate-200" aria-label="Back">←</button>
          <h2 className="text-lg font-extrabold text-slate-900">{TITLES[tab]}</h2>
        </div>
      )}
      <main className="flex-1 overflow-y-auto px-4 pb-28 pt-3">{body}</main>
      <nav className="absolute inset-x-3 bottom-3 z-10 flex items-end justify-between rounded-3xl bg-white/95 px-2 pb-2 pt-1.5 shadow-xl ring-1 ring-slate-200 backdrop-blur">
        {nav.map((n) => n.fab ? (
          <button key={n.id} onClick={() => setTab(n.id)} className="-mt-7 flex flex-col items-center" aria-label={n.label}>
            <span className={`flex h-14 w-14 items-center justify-center rounded-full text-2xl text-white shadow-lg shadow-green-300 ring-4 ring-white ${tab === n.id ? 'bg-green-700' : 'bg-gradient-to-br from-green-500 to-emerald-500'}`}>{n.icon}</span>
            <span className="mt-0.5 text-[10px] font-semibold text-green-700">{n.label}</span>
          </button>
        ) : (
          <button key={n.id} onClick={() => setTab(n.id)} className={`flex w-14 flex-col items-center rounded-2xl py-1.5 ${tab === n.id ? 'bg-green-50 text-green-700' : 'text-slate-400'}`}>
            <span className="text-xl leading-none">{n.icon}</span>
            <span className="mt-0.5 text-[10px] font-semibold">{n.label}</span>
          </button>
        ))}
      </nav>
    </div>
  )
}
