import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { SUNDAYS, defaultSunday, formatSunday, money, pct } from '../lib/util'

export default function Admin() {
  // Real protection: the database only accepts writes from a signed-in Supabase user.
  const [session, setSession] = useState(undefined) // undefined = still checking
  const unlocked = Boolean(session)
  const [tab, setTab] = useState('sunday')

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => data.subscription.unsubscribe()
  }, [])
  const [members, setMembers] = useState([])
  const [error, setError] = useState('')

  const loadMembers = useCallback(async () => {
    const { data, error } = await supabase.from('member_progress').select('*').order('name')
    if (error) setError(error.message)
    else setMembers(data)
  }, [])

  useEffect(() => {
    if (unlocked) loadMembers()
  }, [unlocked, loadMembers])

  if (session === undefined) return <p className="muted">Loading…</p>
  if (!unlocked) return <Gate />

  return (
    <>
      <div className="row wrap">
        <span className="small muted">Signed in as {session.user.email}</span>
        <button onClick={() => supabase.auth.signOut()}>Sign out</button>
      </div>
      <div className="tabs">
        <button className={tab === 'sunday' ? 'active' : ''} onClick={() => setTab('sunday')}>Sunday entries</button>
        <button className={tab === 'members' ? 'active' : ''} onClick={() => setTab('members')}>Members &amp; commitments</button>
      </div>
      {error && <div className="card warn">{error}</div>}
      {tab === 'sunday' ? (
        <SundayEntries members={members} onSaved={loadMembers} />
      ) : (
        <Members members={members} reload={loadMembers} />
      )}
    </>
  )
}

function Gate() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  return (
    <form
      className="card gate"
      onSubmit={async (e) => {
        e.preventDefault()
        setBusy(true)
        setErr('')
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) setErr('Wrong email or password.')
        setBusy(false)
      }}
    >
      <label htmlFor="ad-email">Admin email</label>
      <input id="ad-email" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required />
      <label htmlFor="ad-pass">Password</label>
      <input id="ad-pass" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
      {err && <span className="err small">{err}</span>}
      <button className="primary" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
    </form>
  )
}

/* ---------- Enter amounts for every member on one Sunday ---------- */
function SundayEntries({ members, onSaved }) {
  const [sunday, setSunday] = useState(defaultSunday)
  const [values, setValues] = useState({})
  const [existing, setExisting] = useState({})
  const [status, setStatus] = useState('')
  const [busy, setBusy] = useState(false)
  const [unlocked, setUnlocked] = useState({}) // member ids deliberately opened for correction

  async function fetchDay(day) {
    const { data } = await supabase.from('contributions').select('member_id, amount').eq('sunday', day)
    return Object.fromEntries((data || []).map((r) => [r.member_id, String(Number(r.amount))]))
  }

  useEffect(() => {
    let cancel = false
    setStatus('')
    setUnlocked({})
    fetchDay(sunday).then((m) => {
      if (cancel) return
      setExisting(m)
      setValues(m)
    })
    return () => { cancel = true }
  }, [sunday])

  const idx = SUNDAYS.indexOf(sunday)
  const dayTotal = Object.values(values).reduce((s, v) => s + (Number(v) || 0), 0)

  async function save() {
    setBusy(true)
    setStatus('')
    const inserts = [] // members with no entry yet for this Sunday
    const updates = [] // unlocked corrections to an existing entry
    const deletes = []
    for (const m of members) {
      const n = Number(values[m.id])
      const has = existing[m.id] !== undefined
      if (values[m.id] && n > 0) {
        if (!has) inserts.push({ member_id: m.id, sunday, amount: n })
        else if (unlocked[m.id] && String(n) !== existing[m.id]) updates.push({ member_id: m.id, sunday, amount: n })
      } else if (has && unlocked[m.id]) deletes.push(m.id)
    }
    try {
      let skipped = 0
      if (inserts.length) {
        // ignoreDuplicates: never overwrite an entry someone else saved in the meantime
        const { data, error } = await supabase
          .from('contributions')
          .upsert(inserts, { onConflict: 'member_id,sunday', ignoreDuplicates: true })
          .select('member_id')
        if (error) throw error
        skipped = inserts.length - (data?.length ?? 0)
      }
      if (updates.length) {
        const { error } = await supabase.from('contributions').upsert(updates, { onConflict: 'member_id,sunday' })
        if (error) throw error
      }
      if (deletes.length) {
        const { error } = await supabase.from('contributions').delete().eq('sunday', sunday).in('member_id', deletes)
        if (error) throw error
      }
      const fresh = await fetchDay(sunday)
      setExisting(fresh)
      setValues(fresh)
      setUnlocked({})
      const saved = inserts.length - skipped + updates.length + deletes.length
      setStatus(
        (saved ? `Saved ${saved} change(s).` : 'No changes.') +
          (skipped ? ` ${skipped} already had an entry and was left unchanged.` : ''),
      )
      onSaved()
    } catch (e) {
      setStatus('Error: ' + e.message)
    }
    setBusy(false)
  }

  return (
    <section className="card">
      <div className="row wrap">
        <div className="sunday-pick">
          <button disabled={idx <= 0} onClick={() => setSunday(SUNDAYS[idx - 1])} aria-label="Previous Sunday">‹</button>
          <select value={sunday} onChange={(e) => setSunday(e.target.value)}>
            {SUNDAYS.map((s, i) => (
              <option key={s} value={s}>Week {i + 1} · {formatSunday(s)}</option>
            ))}
          </select>
          <button disabled={idx >= SUNDAYS.length - 1} onClick={() => setSunday(SUNDAYS[idx + 1])} aria-label="Next Sunday">›</button>
        </div>
        <span className="muted">Total this Sunday: <strong>{money(dayTotal)}</strong></span>
      </div>

      {members.length === 0 ? (
        <p className="muted">Add members first in “Members &amp; commitments”.</p>
      ) : (
        <table className="entry">
          <thead>
            <tr><th>Member</th><th className="num">Progress</th><th className="num">Amount</th></tr>
          </thead>
          <tbody>
            {members.map((m) => {
              const locked = existing[m.id] !== undefined && !unlocked[m.id]
              return (
                <tr key={m.id}>
                  <td>{m.name}{existing[m.id] !== undefined && <span className="badge">{locked ? 'Entered' : 'Editing'}</span>}</td>
                  <td className="num small muted">{money(m.given)} / {money(m.commitment)} ({pct(m.given, m.commitment).toFixed(0)}%)</td>
                  <td className="num">
                    <div className="amt">
                      <input
                        type="number" min="0" step="0.01" inputMode="decimal" placeholder="0"
                        value={values[m.id] ?? ''}
                        disabled={locked}
                        onChange={(e) => setValues((v) => ({ ...v, [m.id]: e.target.value }))}
                      />
                      {locked && (
                        <button type="button" className="editbtn" onClick={() => setUnlocked((u) => ({ ...u, [m.id]: true }))}>
                          Edit
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
      <div className="row">
        <span className="small">{status}</span>
        <button className="primary" onClick={save} disabled={busy || !members.length}>{busy ? 'Saving…' : 'Save Sunday'}</button>
      </div>
    </section>
  )
}

/* ---------- Add / edit / delete members and their commitment ---------- */
function Members({ members, reload }) {
  const [name, setName] = useState('')
  const [amount, setAmount] = useState('')
  const [editing, setEditing] = useState(null)
  const [msg, setMsg] = useState('')

  async function add(e) {
    e.preventDefault()
    if (!name.trim()) return
    const { error } = await supabase.from('members').insert({ name: name.trim(), commitment: Number(amount) || 0 })
    if (error) return setMsg('Error: ' + error.message)
    setName(''); setAmount(''); setMsg(`Added ${name.trim()}.`)
    reload()
  }

  async function saveEdit() {
    const { error } = await supabase
      .from('members')
      .update({ name: editing.name.trim(), commitment: Number(editing.commitment) || 0 })
      .eq('id', editing.id)
    if (error) return setMsg('Error: ' + error.message)
    setEditing(null); setMsg('Saved.')
    reload()
  }

  async function remove(m) {
    if (!confirm(`Delete ${m.name} and all of their Sunday entries?`)) return
    const { error } = await supabase.from('members').delete().eq('id', m.id)
    if (error) return setMsg('Error: ' + error.message)
    setMsg(`Deleted ${m.name}.`)
    reload()
  }

  return (
    <>
      <form className="card add" onSubmit={add}>
        <input placeholder="Member name" value={name} onChange={(e) => setName(e.target.value)} required />
        <input type="number" min="0" step="0.01" placeholder="Committed amount (₱)" value={amount} onChange={(e) => setAmount(e.target.value)} />
        <button className="primary">Add member</button>
      </form>
      {msg && <p className="small">{msg}</p>}
      <section className="card">
        <table className="manage">
          <thead><tr><th>Name</th><th className="num">Commitment</th><th className="num">Given</th><th></th></tr></thead>
          <tbody>
            {members.map((m) =>
              editing?.id === m.id ? (
                <tr key={m.id}>
                  <td><input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} /></td>
                  <td className="num" data-label="Commitment"><input type="number" min="0" step="0.01" inputMode="decimal" value={editing.commitment} onChange={(e) => setEditing({ ...editing, commitment: e.target.value })} /></td>
                  <td className="num" data-label="Given">{money(m.given)}</td>
                  <td className="actions"><button className="primary" onClick={saveEdit}>Save</button><button onClick={() => setEditing(null)}>Cancel</button></td>
                </tr>
              ) : (
                <tr key={m.id}>
                  <td>{m.name}</td>
                  <td className="num" data-label="Commitment">{money(m.commitment)}</td>
                  <td className="num" data-label="Given">{money(m.given)}</td>
                  <td className="actions">
                    <button onClick={() => setEditing({ id: m.id, name: m.name, commitment: String(Number(m.commitment)) })}>Edit</button>
                    <button className="danger" onClick={() => remove(m)}>Delete</button>
                  </td>
                </tr>
              ),
            )}
          </tbody>
        </table>
        {members.length === 0 && <p className="muted">No members yet.</p>}
      </section>
    </>
  )
}
