import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useState } from 'react'
import { reducer, initialState, STORAGE_KEY, roleToAccount } from './reducer.js'
import { buildSeedTransactions } from '../lib/seed.js'

const StoreContext = createContext(null)
const SESSION_KEY = 'greenloop-session'

function lazyInit() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return { ...initialState(), ...JSON.parse(raw) }
  } catch {
    // ignore corrupt storage
  }
  return { ...initialState(), opsTransactions: buildSeedTransactions() }
}

export function StoreProvider({ children }) {
  const [state, rawDispatch] = useReducer(reducer, undefined, lazyInit)
  // The login session is per browser tab, so two tabs can be two different people.
  const [session, setSessionState] = useState(() => {
    try { return JSON.parse(sessionStorage.getItem(SESSION_KEY)) } catch { return null }
  })

  const setSession = useCallback((s) => {
    setSessionState(s)
    try { s ? sessionStorage.setItem(SESSION_KEY, JSON.stringify(s)) : sessionStorage.removeItem(SESSION_KEY) } catch { /* ignore */ }
  }, [])

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)) } catch { /* in-memory only */ }
  }, [state])

  // Keep other tabs in sync (e.g. the Operations tab shows a user's live drop-offs).
  useEffect(() => {
    function onStorage(e) {
      if (e.key !== STORAGE_KEY || !e.newValue) return
      try { rawDispatch({ type: 'HYDRATE', state: JSON.parse(e.newValue) }) } catch { /* ignore */ }
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  const dispatch = useCallback((a) => rawDispatch({ ...a, uid: a.uid || session?.id }), [session])
  const accountType = session ? roleToAccount(session.role) : 'residence'
  const value = useMemo(() => ({ state, dispatch, session, setSession, accountType }), [state, dispatch, session, setSession, accountType])

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

export function useStore() {
  const ctx = useContext(StoreContext)
  if (!ctx) throw new Error('useStore must be used within a StoreProvider')
  return ctx
}

const BLANK = { tokenBalance: 0, transactions: [], redeemedVouchers: [], maintenanceFee: 0, feeOffsetRm: 0, feeOffsets: [] }

// The logged-in user's / tenant's account.
export function useAccount() {
  const { state, session } = useStore()
  return (session && state.accounts[session.id]) || BLANK
}

export function useProfile() {
  const { state, session } = useStore()
  return session ? state.users[session.id] || null : null
}
