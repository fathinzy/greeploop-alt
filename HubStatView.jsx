import { useMemo, useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, CartesianGrid } from 'recharts'
import { useStore } from '../store/StoreContext.jsx'
import { Card, CardHeader, Stat } from '../components/ui.jsx'
import { analyze, seedHistory, liveRows, ymd } from '../lib/hubstats.js'

const sel = 'rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm outline-none focus:border-green-500'
const MEDAL = ['🥇', '🥈', '🥉']

export default function HubStatView() {
  const { state } = useStore()
  const now = new Date()
  const [hubId, setHubId] = useState('all')
  const [period, setPeriod] = useState('month')
  const [day, setDay] = useState(ymd(now))
  const [month, setMonth] = useState(ymd(now).slice(0, 7))
  const [year, setYear] = useState(String(now.getFullYear()))

  const rows = useMemo(() => [...seedHistory(), ...liveRows(state.hubEvents)], [state.hubEvents])
  const anchor = period === 'day' ? day : period === 'month' ? month : year
  const r = useMemo(() => analyze(rows, { period, anchor, hubId, hubs: state.hubs }), [rows, period, anchor, hubId, state.hubs])
  const hubName = hubId === 'all' ? 'All hubs' : state.hubs.find((h) => h.id === hubId)?.name
  const top = r.ranking[0]
  const years = [now.getFullYear(), now.getFullYear() - 1].map(String)

  return (
    <div className="space-y-5">
      <Card>
        <div className="flex flex-wrap items-center gap-3 px-5 py-4">
          <select className={sel} value={hubId} onChange={(e) => setHubId(e.target.value)}>
            <option value="all">All hubs</option>
            {state.hubs.map((h) => <option key={h.id} value={h.id}>{h.id} · {h.name}</option>)}
          </select>
          <div className="inline-flex rounded-lg bg-slate-100 p-0.5 text-xs font-semibold">
            {['day', 'month', 'year'].map((p) => (
              <button key={p} onClick={() => setPeriod(p)} className={`rounded-md px-3 py-1.5 capitalize ${period === p ? 'bg-white text-green-700 shadow-sm' : 'text-slate-500'}`}>{p}</button>
            ))}
          </div>
          {period === 'day' && <input type="date" className={sel} value={day} max={ymd(now)} onChange={(e) => e.target.value && setDay(e.target.value)} />}
          {period === 'month' && <input type="month" className={sel} value={month} max={ymd(now).slice(0, 7)} onChange={(e) => e.target.value && setMonth(e.target.value)} />}
          {period === 'year' && <select className={sel} value={year} onChange={(e) => setYear(e.target.value)}>{years.map((y) => <option key={y}>{y}</option>)}</select>}
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Recycled" value={`${r.totals.kg.toLocaleString()} kg`} sub={hubName} accent="text-green-600" />
        <Stat label="Items" value={r.totals.qty.toLocaleString()} />
        <Stat label="GP awarded" value={r.totals.gp.toLocaleString()} />
        <Stat label="Top hub" value={top && top.kg > 0 ? top.id : '—'} sub={top && top.kg > 0 ? top.name : 'No data'} />
      </div>

      <Card>
        <CardHeader title="Station performance" subtitle={`${hubName} · kg recycled per ${period === 'year' ? 'month' : period === 'month' ? 'day' : 'hour'}`} />
        <div className="h-64 px-3 py-4">
          <ResponsiveContainer>
            <BarChart data={r.series}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} interval={period === 'day' ? 2 : 0} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v, n) => [n === 'kg' ? `${v} kg` : v, n]} />
              <Bar dataKey="kg" fill="#16a34a" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader title="Recycled by item type" subtitle={`${hubName} · kg`} />
          <div className="h-64 px-3 py-4">
            <ResponsiveContainer>
              <BarChart data={r.byCat}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v) => `${v} kg`} />
                <Bar dataKey="kg" radius={[4, 4, 0, 0]}>{r.byCat.map((c) => <Cell key={c.category} fill={c.color} />)}</Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card>
          <CardHeader title="Hub ranking" subtitle="Contribution to recycling in this period (all hubs)" />
          <ul className="divide-y divide-slate-100">
            {r.ranking.map((h) => (
              <li key={h.id} className="px-5 py-3 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-semibold text-slate-800"><span className="mr-2">{MEDAL[h.rank - 1] || `#${h.rank}`}</span>{h.name} <span className="font-mono text-xs font-normal text-slate-400">{h.id}</span></p>
                  <p className="tabular-nums text-slate-700">{h.kg.toLocaleString()} kg · {h.share}%</p>
                </div>
                <div className="mt-2 h-2 rounded-full bg-slate-100"><div className="h-2 rounded-full bg-green-500" style={{ width: `${h.share}%` }} /></div>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  )
}
