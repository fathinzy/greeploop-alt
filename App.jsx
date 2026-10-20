import { useEffect, useMemo, useState } from 'react'
import { useStore, useProfile } from './store/StoreContext.jsx'
import { buildSeedTransactions } from './lib/seed.js'
import AuthPage from './views/AuthPage.jsx'
import ProfileView, { Avatar } from './views/ProfileView.jsx'
import HubScanView from './views/HubScanView.jsx'
import ResidentView from './views/ResidentView.jsx'
import ManagementView from './views/ManagementView.jsx'
import HubsView from './views/HubsView.jsx'
import HubStatView from './views/HubStatView.jsx'
import MobileShell from './views/MobileShell.jsx'

const COMMON = (third) => [
  { id: 'profile', label: 'Profile', icon: '👤' },
  { id: 'scan', label: 'Scan', icon: '📷' },
  third,
  { id: 'activity', label: 'Activity', icon: '📜' },
]
const MENUS = {
  user: COMMON({ id: 'redeem', label: 'Redeem', icon: '🎟️' }),
  tenant: COMMON({ id: 'offset', label: 'Offset Maintenance Fee', icon: '🏠' }),
  ops: [
    { id: 'metrics', label: 'Diversion Metrics', icon: '📊' },
    { id: 'ledger', label: 'Financial Ledger', icon: '💰' },
    { id: 'logistics', label: 'Logistics & Dispatch', icon: '🚛' },
    { id: 'hubs', label: 'Recycle Hub', icon: '🗑️' },
    { id: 'hubstat', label: 'Hub Stat', icon: '📈' },
  ],
}
const ROLE_LABEL = { user: 'User', tenant: 'Tenant', ops: 'Operations' }

const TITLES = {
  profile: ['Profile', 'Your account details and Green Points balance.'],
  scan: ['Scan', 'Scan a hub QR to connect, then recycle.'],
  redeem: ['Redeem', 'Spend your Green Points like cash at township mall tenants.'],
  offset: ['Offset Maintenance Fee', 'Apply Green Points to this month’s mall service charge.'],
  activity: ['Activity', 'Everything you have recycled, redeemed and offset.'],
  metrics: ['Diversion Metrics', 'Live landfill diversion across the township, by material.'],
  ledger: ['Financial Ledger', 'Operating ROI, payback and revenue forecast for the hubs.'],
  logistics: ['Logistics & Dispatch', 'Predicted hub capacity and AI dispatch of the collection fleet.'],
  hubs: ['Recycle Hub', 'Registered hubs and their smart recycle bins.'],
  hubstat: ['Hub Stat', 'Station performance, recycled item types and hub ranking.'],
}

function Sidebar({ role, items, active, setActive, onCollapse, onLogout, onSeed, onReset }) {
  return (
    <aside className="flex h-full w-60 shrink-0 flex-col border-r border-slate-200 bg-white">
      <div className="flex items-center justify-between gap-2 px-5 py-4">
        <div className="flex items-center gap-2">
          <span className="text-2xl">♻️</span>
          <div>
            <h1 className="text-base font-bold leading-tight text-slate-900">GreenLoop</h1>
            <p className="text-[11px] text-slate-500">{ROLE_LABEL[role]} view</p>
          </div>
        </div>
        <button onClick={onCollapse} className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600" title="Hide menu" aria-label="Hide menu">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
        </button>
      </div>
      <nav className="flex-1 overflow-y-auto px-3 pb-4">
        <ul className="space-y-0.5">
          {items.map((item) => (
            <li key={item.id}>
              <button onClick={() => setActive(item.id)}
                className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition ${active === item.id ? 'bg-green-50 text-green-700 ring-1 ring-green-200' : 'text-slate-600 hover:bg-slate-50'}`}>
                <span className="text-base">{item.icon}</span><span className="truncate">{item.label}</span>
              </button>
            </li>
          ))}
        </ul>
      </nav>
      <div className="space-y-2 border-t border-slate-200 p-3">
        {(
          <>
            <button onClick={onSeed} className="w-full rounded-lg bg-white px-3 py-2 text-xs font-semibold text-slate-700 ring-1 ring-slate-300 hover:bg-slate-50">Load Demo Data</button>
            <button onClick={onReset} className="w-full rounded-lg bg-white px-3 py-2 text-xs font-semibold text-red-600 ring-1 ring-red-200 hover:bg-red-50">{role === 'ops' ? 'Reset ops data' : 'Reset my data'}</button>
          </>
        )}
        <button onClick={onLogout} className="w-full rounded-lg bg-slate-800 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-900">Log out</button>
      </div>
    </aside>
  )
}

function useNarrow() {
  const q = '(max-width: 767px)'
  const [n, setN] = useState(() => window.matchMedia(q).matches)
  useEffect(() => {
    const m = window.matchMedia(q)
    const f = () => setN(m.matches)
    m.addEventListener('change', f)
    return () => m.removeEventListener('change', f)
  }, [])
  return n
}

export default function App() {
  const { session, setSession, dispatch } = useStore()
  const profile = useProfile()
  const [active, setActive] = useState('profile')
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [phone, setPhone] = useState(false) // desktop preview of the mobile app
  const narrow = useNarrow()
  const role = session?.role
  const items = useMemo(() => MENUS[role] || [], [role])

  useEffect(() => {
    if (role && !items.some((i) => i.id === active)) setActive(items[0].id)
  }, [role, items, active])

  // A user who logs out should not stay linked to a hub.
  const { state } = useStore()
  function logout() {
    const e = Object.entries(state.hubSessions).find(([, s]) => s.uid === session?.id)
    if (e) dispatch({ type: 'UNLINK_HUB', hubId: e[0] })
    setSession(null)
    setActive('profile')
  }

  if (!session || (role !== 'ops' && !profile)) return <AuthPage />

  // User / Tenant get the mobile app layout on phones, or in the phone preview on desktop.
  if (role !== 'ops' && (narrow || phone)) {
    const shell = <MobileShell role={role} onLogout={logout} framed={!narrow} onExit={narrow ? null : () => setPhone(false)} />
    return narrow ? shell : (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-green-50 to-emerald-100 p-4">{shell}</div>
    )
  }

  let content
  if (role === 'ops') {
    content = active === 'hubs' ? <HubsView /> : active === 'hubstat' ? <HubStatView /> : <ManagementView page={active} />
  } else if (active === 'profile') content = <ProfileView />
  else if (active === 'scan') content = <HubScanView />
  else content = <ResidentView page={active} />

  const [title, sub] = TITLES[active] || ['', '']
  return (
    <div className="flex h-screen overflow-hidden">
      {sidebarOpen && (
        <Sidebar role={role} items={items} active={active} setActive={setActive} onCollapse={() => setSidebarOpen(false)} onLogout={logout}
          onSeed={() => dispatch(role === 'ops' ? { type: 'SEED', transactions: buildSeedTransactions() } : { type: 'SEED_ACCOUNT' })}
          onReset={() => role === 'ops'
            ? confirm('Reset township operations data (metrics, ledger, hub stats)? Accounts and hubs are kept.') && dispatch({ type: 'RESET' })
            : confirm('Clear all Green Points, activity, vouchers and fee offsets for this account?') && dispatch({ type: 'RESET_ACCOUNT' })} />
      )}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-3 border-b border-slate-200 bg-white/90 px-6 py-4 backdrop-blur">
          <button onClick={() => setSidebarOpen((o) => !o)} className="rounded-md p-2 text-slate-500 ring-1 ring-slate-200 hover:bg-slate-100 hover:text-slate-700" aria-label="Toggle menu">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M3 12h18M3 18h18" /></svg>
          </button>
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-bold text-slate-900">{title}</h2>
            <p className="truncate text-sm text-slate-500">{sub}</p>
          </div>
          {role !== 'ops' && (
            <button onClick={() => setPhone(true)} className="rounded-lg bg-white px-3 py-2 text-xs font-semibold text-green-700 ring-1 ring-green-300 hover:bg-green-50">📱 Mobile view</button>
          )}
          {profile && (
            <button onClick={() => setActive('profile')} className="flex items-center gap-2" title="Profile">
              <span className="hidden text-right text-xs sm:block"><span className="block font-semibold text-slate-800">{profile.name}</span><span className="block font-mono text-slate-500">{profile.id}</span></span>
              <Avatar user={profile} size={38} />
            </button>
          )}
        </header>
        <main className="flex-1 overflow-y-auto p-6">
          <div className={`mx-auto ${active === 'hubs' ? 'max-w-6xl' : 'max-w-5xl'}`}>{content}</div>
        </main>
      </div>
    </div>
  )
}
