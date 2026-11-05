import { Routes, Route, NavLink, Navigate } from 'react-router-dom'
import { configured } from './lib/supabase'
import { YEAR } from './lib/util'
import Monitor from './pages/Monitor'
import Admin from './pages/Admin'

// Set VITE_APP_MODE at build time to ship each page as its own site:
//   progress -> public progress page only (admin code is not in the bundle)
//   admin    -> admin page only
//   (unset)  -> both pages with a nav, as in local dev
const MODE = import.meta.env.VITE_APP_MODE || 'both'
const SHOW_PROGRESS = MODE !== 'admin'
const SHOW_ADMIN = MODE !== 'progress'

export default function App() {
  const title = MODE === 'admin' ? 'Firstfruit Admin' : `Firstfruit Commitments ${YEAR}`
  return (
    <div className="shell">
      <header className="brand">
        <img src="/logo.png" alt="Bible Baptist Church - Rosario logo" width="72" height="72" />
        <div>
          <h1>BIBLE BAPTIST CHURCH - ROSARIO</h1>
          <p className="muted">P-4, Poblacion, Rosario, Agusan del Sur</p>
        </div>
      </header>
      <div className="top">
        <div>
          <h2>{title}</h2>
          <p className="muted">Every Sunday, January to December {YEAR}</p>
        </div>
        {MODE === 'both' && (
          <nav>
            <NavLink to="/" end>Progress</NavLink>
            <NavLink to="/admin">Admin</NavLink>
          </nav>
        )}
      </div>
      {!configured ? (
        <div className="card warn">
          Supabase is not configured. Copy <code>.env.example</code> to <code>.env</code> and set
          <code> VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_PUBLISHABLE_KEY</code> (or <code>VITE_SUPABASE_ANON_KEY</code>), then restart <code>npm run dev</code>.
        </div>
      ) : (
        <Routes>
          {SHOW_PROGRESS && <Route path="/" element={<Monitor />} />}
          {SHOW_ADMIN && <Route path={MODE === 'admin' ? '/' : '/admin'} element={<Admin />} />}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      )}
    </div>
  )
}
