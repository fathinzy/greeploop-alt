import { useRef, useState } from 'react'
import { useStore, useAccount, useProfile } from '../store/StoreContext.jsx'
import { Card, CardHeader } from '../components/ui.jsx'
import { GPBalance } from './ResidentView.jsx'

export function Avatar({ user, size = 40 }) {
  const initials = (user?.name || '?').split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase()
  return user?.avatar ? (
    <img src={user.avatar} alt="" style={{ width: size, height: size }} className="rounded-full object-cover ring-2 ring-green-200" />
  ) : (
    <div style={{ width: size, height: size, fontSize: size / 2.6 }}
      className="flex items-center justify-center rounded-full bg-green-100 font-bold text-green-700 ring-2 ring-green-200">
      {initials}
    </div>
  )
}

// Shrink the chosen picture so it fits comfortably in browser storage.
function toAvatar(file) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const s = 160, c = document.createElement('canvas')
      c.width = c.height = s
      const m = Math.min(img.width, img.height)
      c.getContext('2d').drawImage(img, (img.width - m) / 2, (img.height - m) / 2, m, m, 0, 0, s, s)
      resolve(c.toDataURL('image/jpeg', 0.8))
    }
    img.onerror = reject
    img.src = URL.createObjectURL(file)
  })
}

const input = 'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-green-500'

export default function ProfileView() {
  const { dispatch } = useStore()
  const user = useProfile()
  const acct = useAccount()
  const [edit, setEdit] = useState(false)
  const [avatar, setAvatar] = useState(undefined)
  const [f, setF] = useState({ cur: '', pw: '', pw2: '' })
  const [msg, setMsg] = useState('')
  const fileRef = useRef()
  if (!user) return null
  const isTenant = user.role === 'tenant'

  async function pick(e) {
    const file = e.target.files?.[0]
    if (file) setAvatar(await toAvatar(file))
  }

  function save() {
    if (f.pw || f.pw2 || f.cur) {
      if (f.cur !== user.password) return setMsg('Current password is wrong.')
      if (f.pw.length < 6) return setMsg('New password must be at least 6 characters.')
      if (f.pw !== f.pw2) return setMsg('New passwords do not match.')
    }
    dispatch({ type: 'UPDATE_PROFILE', avatar, password: f.pw || undefined })
    setEdit(false); setAvatar(undefined); setF({ cur: '', pw: '', pw2: '' }); setMsg('')
  }

  const rows = [
    [isTenant ? 'Tenant ID' : 'User ID', user.id],
    ['Name', user.name],
    ['Email', user.email],
    ['Address', user.address],
    ['Password', '••••••••'],
  ]

  return (
    <div className="space-y-5">
      <Card>
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">{isTenant ? 'Tenant' : 'User'} profile</h3>
            <button onClick={() => setEdit(!edit)} className="mt-2 rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 ring-1 ring-slate-300 hover:bg-slate-50">
              {edit ? 'Cancel' : 'Edit profile'}
            </button>
          </div>
          <Avatar user={edit && avatar ? { ...user, avatar } : user} size={72} />
        </div>
        <dl className="divide-y divide-slate-100">
          {rows.map(([k, v]) => (
            <div key={k} className="flex gap-4 px-5 py-3 text-sm">
              <dt className="w-28 shrink-0 text-slate-500">{k}</dt>
              <dd className="min-w-0 break-words font-medium text-slate-800">{v}</dd>
            </div>
          ))}
        </dl>
        {edit && (
          <div className="space-y-3 border-t border-slate-100 px-5 py-4">
            <div>
              <input ref={fileRef} type="file" accept="image/*" hidden onChange={pick} />
              <button onClick={() => fileRef.current.click()} className="rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 ring-1 ring-slate-300">
                Choose profile picture
              </button>
            </div>
            <input type="password" className={input} placeholder="Current password" value={f.cur} onChange={(e) => setF({ ...f, cur: e.target.value })} />
            <input type="password" className={input} placeholder="New password" value={f.pw} onChange={(e) => setF({ ...f, pw: e.target.value })} />
            <input type="password" className={input} placeholder="Confirm new password" value={f.pw2} onChange={(e) => setF({ ...f, pw2: e.target.value })} />
            {msg && <p className="text-sm text-red-600">{msg}</p>}
            <button onClick={save} className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700">Save changes</button>
          </div>
        )}
      </Card>
      <GPBalance balance={acct.tokenBalance} />
    </div>
  )
}
