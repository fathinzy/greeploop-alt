import { CATEGORIES, STREAMS } from '../data/catalog.js'

export function Card({ children, className = '' }) {
  return (
    <div className={`rounded-xl bg-white shadow-sm ring-1 ring-slate-200 ${className}`}>
      {children}
    </div>
  )
}

export function CardHeader({ title, subtitle, right }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
      <div>
        <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
        {subtitle && <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>}
      </div>
      {right}
    </div>
  )
}

export function Stat({ label, value, sub, accent = 'text-slate-900' }) {
  return (
    <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`mt-1 text-2xl font-bold tabular-nums ${accent}`}>{value}</p>
      {sub && <p className="mt-0.5 text-xs text-slate-500">{sub}</p>}
    </div>
  )
}

export function CategoryBadge({ category }) {
  const c = CATEGORIES[category]
  if (!c) return null
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium"
      style={{ backgroundColor: `${c.color}1a`, color: c.color }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: c.color }} />
      {c.label}
    </span>
  )
}

export function StreamBadge({ stream }) {
  const s = STREAMS[stream]
  if (!s) return null
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold"
      style={{ backgroundColor: `${s.color}1a`, color: s.color }}
      title={s.description}
    >
      {s.label}
    </span>
  )
}

export function Button({ children, onClick, variant = 'primary', className = '', disabled, type = 'button' }) {
  const variants = {
    primary: 'bg-green-600 text-white hover:bg-green-700 disabled:bg-slate-300',
    secondary: 'bg-white text-slate-700 ring-1 ring-slate-300 hover:bg-slate-50 disabled:text-slate-400',
    danger: 'bg-white text-red-600 ring-1 ring-red-200 hover:bg-red-50',
  }
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed ${variants[variant]} ${className}`}
    >
      {children}
    </button>
  )
}
