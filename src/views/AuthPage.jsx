import { useState } from 'react'
import { useStore } from '../store/StoreContext.jsx'
import { nextId } from '../store/reducer.js'

const OPS = { id: 'synkosys', pass: 'synkosys123' }
const field = 'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-green-500 focus:ring-2 focus:ring-green-100'

function Field({ label, children }) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block font-medium text-slate-700">{label}</span>
      {children}
    </label>
  )
}

export default function AuthPage() {
  const { state, dispatch, setSession } = useStore()
  const [tab, setTab] = useState('login')
  const [err, setErr] = useState('')
  const [created, setCreated] = useState(null)
  const [login, setLogin] = useState({ id: '', pass: '' })
  const [reg, setReg] = useState({ role: 'user', name: '', address: '', email: '', password: '', confirm: '' })
  const set = (k) => (e) => setReg((r) => ({ ...r, [k]: e.target.value }))

  function doLogin(e) {
    e.preventDefault()
    const key = login.id.trim()
    if (key.toLowerCase() === OPS.id && login.pass === OPS.pass) {
      setSession({ role: 'ops', id: OPS.id })
      return
    }
    const u = Object.values(state.users).find(
      (x) => x.id.toLowerCase() === key.toLowerCase() || x.email.toLowerCase() === key.toLowerCase()
    )
    if (!u || u.password !== login.pass) return setErr('Wrong ID/email or password.')
    setSession({ role: u.role, id: u.id })
  }

  // One-tap demo accounts for judging (created once, pre-filled with history).
  function demo(role) {
    const email = role === 'tenant' ? 'tenant.demo@greenloop.my' : 'user.demo@greenloop.my'
    let u = Object.values(state.users).find((x) => x.email === email)
    if (!u) {
      const id = nextId(state, role)
      const name = role === 'tenant' ? 'Demo Café (Mall Tenant)' : 'Aisyah Rahman'
      const address = role === 'tenant' ? 'Lot G-08, Greenview Mall' : 'A-12-3, Greenview Residence'
      dispatch({ type: 'REGISTER', id, role, name, address, email, password: 'demo123' })
      dispatch({ type: 'SEED_ACCOUNT', uid: id })
      u = { id, role }
    }
    setSession({ role: u.role, id: u.id })
  }

  function doRegister(e) {
    e.preventDefault()
    const { role, name, address, email, password, confirm } = reg
    if (![name, address, email, password, confirm].every((v) => v.trim())) return setErr('Please fill in every field.')
    if (!/^\S+@\S+\.\S+$/.test(email)) return setErr('Enter a valid email address.')
    if (password.length < 6) return setErr('Password must be at least 6 characters.')
    if (password !== confirm) return setErr('Passwords do not match.')
    if (Object.values(state.users).some((u) => u.email.toLowerCase() === email.trim().toLowerCase()))
      return setErr('That email is already registered.')
    const id = nextId(state, role)
    dispatch({ type: 'REGISTER', id, role, name: name.trim(), address: address.trim(), email: email.trim(), password })
    setErr('')
    setCreated({ id, role })
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-green-50 to-emerald-100 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-lg ring-1 ring-slate-200">
        <div className="mb-4 text-center">
          <div className="text-4xl">♻️</div>
          <h1 className="text-xl font-bold text-slate-900">GreenLoop</h1>
          <p className="text-xs text-slate-500">Smart Recycling Ecosystem</p>
        </div>

        {created ? (
          <div className="space-y-4 text-center">
            <p className="text-sm text-slate-600">Account created. Your {created.role === 'tenant' ? 'Tenant' : 'User'} ID is</p>
            <p className="rounded-lg bg-green-50 py-3 font-mono text-lg font-bold text-green-700">{created.id}</p>
            <p className="text-xs text-slate-500">Use this ID (or your email) and your password to sign in.</p>
            <button
              className="w-full rounded-lg bg-green-600 px-3 py-2 text-sm font-semibold text-white hover:bg-green-700"
              onClick={() => { setCreated(null); setTab('login'); setLogin({ id: created.id, pass: '' }) }}
            >
              Go to login
            </button>
          </div>
        ) : (
          <>
            <div className="mb-4 grid grid-cols-2 gap-1 rounded-lg bg-slate-100 p-1 text-sm font-semibold">
              {['login', 'register'].map((t) => (
                <button key={t} onClick={() => { setTab(t); setErr('') }}
                  className={`rounded-md py-1.5 capitalize ${tab === t ? 'bg-white text-green-700 shadow-sm' : 'text-slate-500'}`}>
                  {t}
                </button>
              ))}
            </div>

            {tab === 'login' ? (
              <form onSubmit={doLogin} className="space-y-3">
                <Field label="ID or email">
                  <input className={field} value={login.id} onChange={(e) => setLogin({ ...login, id: e.target.value })} placeholder="USER-000000001 / TENT-000000001" />
                </Field>
                <Field label="Password">
                  <input type="password" className={field} value={login.pass} onChange={(e) => setLogin({ ...login, pass: e.target.value })} />
                </Field>
                {err && <p className="text-sm text-red-600">{err}</p>}
                <button className="w-full rounded-lg bg-green-600 px-3 py-2 text-sm font-semibold text-white hover:bg-green-700">Log in</button>
              </form>
            ) : (
              <form onSubmit={doRegister} className="space-y-3">
                <div className="flex gap-4 text-sm">
                  {[['user', 'User'], ['tenant', 'Tenant']].map(([v, l]) => (
                    <label key={v} className="flex items-center gap-1.5">
                      <input type="radio" name="role" checked={reg.role === v} onChange={() => setReg({ ...reg, role: v })} /> {l}
                    </label>
                  ))}
                </div>
                <Field label="Name"><input className={field} value={reg.name} onChange={set('name')} /></Field>
                <Field label="Address"><input className={field} value={reg.address} onChange={set('address')} /></Field>
                <Field label="Email"><input type="email" className={field} value={reg.email} onChange={set('email')} /></Field>
                <Field label="Password"><input type="password" className={field} value={reg.password} onChange={set('password')} /></Field>
                <Field label="Confirm password"><input type="password" className={field} value={reg.confirm} onChange={set('confirm')} /></Field>
                {err && <p className="text-sm text-red-600">{err}</p>}
                <button className="w-full rounded-lg bg-green-600 px-3 py-2 text-sm font-semibold text-white hover:bg-green-700">Create</button>
              </form>
            )}
            <div className="mt-5 border-t border-slate-100 pt-4">
              <p className="mb-2 text-center text-xs text-slate-500">Judging demo: one tap, pre-filled with activity</p>
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => demo('user')} className="rounded-lg bg-white px-3 py-2 text-sm font-semibold text-green-700 ring-1 ring-green-300 hover:bg-green-50">🙋 Demo User</button>
                <button onClick={() => demo('tenant')} className="rounded-lg bg-white px-3 py-2 text-sm font-semibold text-green-700 ring-1 ring-green-300 hover:bg-green-50">🏬 Demo Tenant</button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
