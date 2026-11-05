import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { money, pct, formatSunday } from '../lib/util'

export default function Monitor() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(null)
  const [history, setHistory] = useState({})

  useEffect(() => {
    supabase
      .from('member_progress')
      .select('*')
      .order('name')
      .then(({ data, error }) => {
        if (error) setError(error.message)
        else setRows(data)
        setLoading(false)
      })
  }, [])

  async function toggle(id) {
    if (open === id) return setOpen(null)
    setOpen(id)
    if (!history[id]) {
      const { data } = await supabase
        .from('contributions')
        .select('sunday, amount')
        .eq('member_id', id)
        .gt('amount', 0)
        .order('sunday')
      setHistory((h) => ({ ...h, [id]: data || [] }))
    }
  }

  const shown = useMemo(
    () => rows.filter((r) => r.name.toLowerCase().includes(q.trim().toLowerCase())),
    [rows, q],
  )
  const totals = useMemo(
    () => rows.reduce((t, r) => ({ c: t.c + Number(r.commitment), g: t.g + Number(r.given) }), { c: 0, g: 0 }),
    [rows],
  )

  if (loading) return <p className="muted">Loading…</p>
  if (error) return <div className="card warn">{error}</div>

  return (
    <>
      <section className="stats">
        <div className="card stat"><span className="muted">Members</span><strong>{rows.length}</strong></div>
        <div className="card stat"><span className="muted">Total committed</span><strong>{money(totals.c)}</strong></div>
        <div className="card stat"><span className="muted">Total given</span><strong>{money(totals.g)}</strong></div>
        <div className="card stat">
          <span className="muted">Overall</span>
          <strong>{pct(totals.g, totals.c).toFixed(0)}%</strong>
        </div>
      </section>

      <input className="search" placeholder="Search your name…" value={q} onChange={(e) => setQ(e.target.value)} />

      {shown.length === 0 && <p className="muted">No members found.</p>}
      <ul className="members">
        {shown.map((r) => {
          const p = pct(r.given, r.commitment)
          const remaining = Math.max(0, r.commitment - r.given)
          return (
            <li key={r.id} className="card member">
              <button className="member-head" onClick={() => toggle(r.id)} aria-expanded={open === r.id}>
                <div className="row">
                  <strong>{r.name}</strong>
                  <span className={p >= 100 ? 'done' : 'muted'}>{p >= 100 ? 'Completed' : `${p.toFixed(0)}%`}</span>
                </div>
                <div className="bar"><div className={p >= 100 ? 'fill full' : 'fill'} style={{ width: `${p}%` }} /></div>
                <div className="row small muted">
                  <span>Given {money(r.given)} of {money(r.commitment)}</span>
                  <span>{remaining > 0 ? `${money(remaining)} to go` : ''}</span>
                </div>
              </button>
              {open === r.id && (
                <div className="history">
                  {!history[r.id] ? (
                    <p className="muted small">Loading…</p>
                  ) : history[r.id].length === 0 ? (
                    <p className="muted small">No entries yet.</p>
                  ) : (
                    <table>
                      <tbody>
                        {history[r.id].map((h) => (
                          <tr key={h.sunday}><td>{formatSunday(h.sunday)}</td><td className="num">{money(h.amount)}</td></tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}
            </li>
          )
        })}
      </ul>
    </>
  )
}
