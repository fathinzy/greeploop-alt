// Generated example "photos" of each scannable item, drawn as inline SVG so
// the simulated scan looks like it is analysing a real image (no asset files).
// Each returns a 160x160 scene on a soft background.

function Frame({ bg = '#e2e8f0', children }) {
  return (
    <svg viewBox="0 0 160 160" className="h-full w-full" xmlns="http://www.w3.org/2000/svg">
      <rect width="160" height="160" rx="10" fill={bg} />
      {children}
    </svg>
  )
}

const art = {
  'scan-pet': (
    <Frame bg="#dbeafe">
      <rect x="68" y="20" width="24" height="12" rx="3" fill="#60a5fa" />
      <rect x="72" y="30" width="16" height="8" fill="#93c5fd" />
      <path d="M66 40 q-6 10 -6 24 v56 q0 10 10 10 h20 q10 0 10 -10 v-56 q0 -14 -6 -24 z" fill="#bfdbfe" stroke="#3b82f6" strokeWidth="2" />
      <rect x="66" y="74" width="28" height="20" fill="#eff6ff" opacity="0.7" />
    </Frame>
  ),
  'scan-can': (
    <Frame bg="#f1f5f9">
      <rect x="58" y="34" width="44" height="92" rx="8" fill="#cbd5e1" stroke="#64748b" strokeWidth="2" />
      <rect x="58" y="34" width="44" height="12" rx="6" fill="#94a3b8" />
      <ellipse cx="80" cy="40" rx="18" ry="4" fill="#e2e8f0" />
      <rect x="66" y="60" width="28" height="40" rx="4" fill="#ef4444" opacity="0.75" />
    </Frame>
  ),
  'scan-carton': (
    <Frame bg="#fef3c7">
      <path d="M60 44 h40 v76 h-40 z" fill="#fde68a" stroke="#f59e0b" strokeWidth="2" />
      <path d="M60 44 l20 -14 l20 14 z" fill="#fcd34d" stroke="#f59e0b" strokeWidth="2" />
      <rect x="88" y="30" width="6" height="16" fill="#f59e0b" />
      <rect x="68" y="70" width="24" height="30" fill="#fffbeb" opacity="0.8" />
    </Frame>
  ),
  'scan-cardboard': (
    <Frame bg="#fde9d2">
      <path d="M40 60 h80 v54 h-80 z" fill="#d9a066" stroke="#b45309" strokeWidth="2" />
      <path d="M40 60 l20 -14 h80 l-20 14 z" fill="#e8b887" stroke="#b45309" strokeWidth="2" />
      <path d="M120 60 l20 -14 v54 l-20 14 z" fill="#c98a4b" stroke="#b45309" strokeWidth="2" />
      <line x1="80" y1="46" x2="80" y2="114" stroke="#b45309" strokeWidth="1.5" opacity="0.6" />
    </Frame>
  ),
  'scan-ewaste': (
    <Frame bg="#ede9fe">
      <rect x="58" y="28" width="44" height="104" rx="8" fill="#4c1d95" stroke="#8b5cf6" strokeWidth="2" />
      <rect x="63" y="38" width="34" height="74" rx="2" fill="#a78bfa" />
      <circle cx="80" cy="122" r="4" fill="#c4b5fd" />
    </Frame>
  ),
  'scan-greasy': (
    <Frame bg="#fee2e2">
      <rect x="42" y="58" width="76" height="40" rx="6" fill="#f8fafc" stroke="#f87171" strokeWidth="2" />
      <ellipse cx="70" cy="72" rx="10" ry="5" fill="#fbbf24" opacity="0.7" />
      <ellipse cx="92" cy="82" rx="7" ry="4" fill="#f59e0b" opacity="0.6" />
      <path d="M50 50 h60 v10 h-60 z" fill="#fecaca" />
    </Frame>
  ),
  'scan-styro': (
    <Frame bg="#fee2e2">
      <rect x="46" y="54" width="68" height="48" rx="6" fill="#f8fafc" stroke="#cbd5e1" strokeWidth="2" />
      <circle cx="60" cy="70" r="4" fill="#e2e8f0" />
      <circle cx="76" cy="66" r="4" fill="#e2e8f0" />
      <circle cx="92" cy="72" r="4" fill="#e2e8f0" />
      <circle cx="70" cy="84" r="4" fill="#e2e8f0" />
      <circle cx="90" cy="88" r="4" fill="#e2e8f0" />
    </Frame>
  ),
  'scan-bag': (
    <Frame bg="#fee2e2">
      <path d="M54 46 q26 -10 52 0 l-6 76 q-20 8 -40 0 z" fill="#e2e8f0" stroke="#94a3b8" strokeWidth="2" opacity="0.9" />
      <path d="M64 40 q16 -8 32 0" fill="none" stroke="#94a3b8" strokeWidth="3" />
    </Frame>
  ),
  'scan-mixed': (
    <Frame bg="#fee2e2">
      <path d="M58 40 h44 v88 h-44 z" fill="#fca5a5" stroke="#ef4444" strokeWidth="2" />
      <rect x="58" y="64" width="44" height="10" fill="#f59e0b" />
      <rect x="58" y="86" width="44" height="10" fill="#60a5fa" />
      <rect x="58" y="40" width="44" height="12" fill="#cbd5e1" />
    </Frame>
  ),
}

export default function ItemImage({ id, className = '' }) {
  return <div className={className}>{art[id] || <Frame />}</div>
}
