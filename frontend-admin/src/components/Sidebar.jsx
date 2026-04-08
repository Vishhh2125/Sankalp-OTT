import { useDispatch, useSelector } from 'react-redux'
import { setActivePage, selectActivePage } from '../store/navigationSlice.js'
import { NAV_CONFIG } from '../config/nav.js'

const NAV_ICONS = {
  dashboard: (
    <>
      <rect x="1" y="1" width="6" height="6" rx="1.5" fill="currentColor" opacity=".9"/>
      <rect x="9" y="1" width="6" height="6" rx="1.5" fill="currentColor" opacity=".5"/>
      <rect x="1" y="9" width="6" height="6" rx="1.5" fill="currentColor" opacity=".5"/>
      <rect x="9" y="9" width="6" height="6" rx="1.5" fill="currentColor" opacity=".3"/>
    </>
  ),
  users: (
    <>
      <circle cx="6" cy="5" r="3" fill="currentColor" opacity=".9"/>
      <path d="M1 13c0-2.761 2.239-5 5-5s5 2.239 5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity=".7"/>
      <circle cx="12" cy="5" r="2" fill="currentColor" opacity=".4"/>
      <path d="M14 13c0-1.5-.7-2.8-1.7-3.6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity=".4"/>
    </>
  ),
  dramas: (
    <>
      <rect x="1" y="3" width="14" height="10" rx="1.5" fill="currentColor" opacity=".3"/>
      <path d="M6 6l5 2.5L6 11V6z" fill="currentColor" opacity=".9"/>
    </>
  ),
  categories: (
    <>
      <rect x="1" y="1" width="4" height="4" rx="1" fill="currentColor" opacity=".9"/>
      <rect x="7" y="1" width="8" height="1.5" rx=".75" fill="currentColor" opacity=".6"/>
      <rect x="7" y="4" width="5" height="1.5" rx=".75" fill="currentColor" opacity=".4"/>
      <rect x="1" y="7" width="4" height="4" rx="1" fill="currentColor" opacity=".6"/>
      <rect x="7" y="7" width="8" height="1.5" rx=".75" fill="currentColor" opacity=".6"/>
      <rect x="7" y="10" width="5" height="1.5" rx=".75" fill="currentColor" opacity=".4"/>
    </>
  ),
  banners: (
    <>
      <rect x="1" y="3" width="14" height="7" rx="1.5" fill="currentColor" opacity=".3"/>
      <rect x="3" y="5" width="6" height="1.5" rx=".75" fill="currentColor" opacity=".7"/>
      <rect x="3" y="7.5" width="4" height="1" rx=".5" fill="currentColor" opacity=".4"/>
    </>
  ),
  membership: (
    <>
      <rect x="1" y="4" width="14" height="9" rx="1.5" fill="currentColor" opacity=".3"/>
      <rect x="1" y="6.5" width="14" height="2" fill="currentColor" opacity=".6"/>
      <circle cx="4" cy="10.5" r="1" fill="currentColor" opacity=".7"/>
    </>
  ),
  coins: (
    <>
      <circle cx="8" cy="8" r="6" fill="currentColor" opacity=".25"/>
      <circle cx="8" cy="8" r="4" fill="currentColor" opacity=".5"/>
    </>
  ),
  notifications: (
    <>
      <path d="M8 2a4 4 0 00-4 4v3l-1 1.5h10L12 9V6a4 4 0 00-4-4z" fill="currentColor" opacity=".6"/>
      <path d="M6.5 13a1.5 1.5 0 003 0" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" opacity=".9"/>
    </>
  ),
  analytics: (
    <>
      <rect x="1" y="10" width="3" height="4" rx="1" fill="currentColor" opacity=".5"/>
      <rect x="6" y="7" width="3" height="7" rx="1" fill="currentColor" opacity=".7"/>
      <rect x="11" y="3" width="3" height="11" rx="1" fill="currentColor" opacity=".9"/>
    </>
  ),
  roles: (
    <>
      <path d="M8 2L3 4v4c0 3 2.5 5 5 6 2.5-1 5-3 5-6V4L8 2z" fill="currentColor" opacity=".4"/>
      <path d="M6 8l1.5 1.5L10 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity=".9"/>
    </>
  ),
  cms: (
    <>
      <rect x="2" y="2" width="12" height="12" rx="1.5" fill="currentColor" opacity=".2"/>
      <rect x="4" y="5" width="8" height="1" rx=".5" fill="currentColor" opacity=".8"/>
      <rect x="4" y="7.5" width="6" height="1" rx=".5" fill="currentColor" opacity=".6"/>
      <rect x="4" y="10" width="4" height="1" rx=".5" fill="currentColor" opacity=".4"/>
    </>
  ),
}

function NavIcon({ id }) {
  return (
    <svg className="nav-icon" viewBox="0 0 16 16" fill="none">
      {NAV_ICONS[id] || null}
    </svg>
  )
}

export default function Sidebar() {
  const dispatch   = useDispatch()
  const active     = useSelector(selectActivePage)
  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <div className="logo-mark">OT</div>
        <div>
          <div className="logo-text">OTT Admin</div>
          <div className="logo-sub">v2.0 · phase 2</div>
        </div>
      </div>

      <nav style={{ flex: 1, paddingTop: 8 }}>
        {NAV_CONFIG.map(group => (
          <div key={group.section}>
            <div className="nav-section">{group.section}</div>
            {group.items.map(item => (
              <div
                key={item.id}
                className={`nav-item${active === item.id ? ' active' : ''}`}
                onClick={() => dispatch(setActivePage(item.id))}
              >
                <NavIcon id={item.id} />
                {item.label}
                {item.badge && <span className="nav-badge">{item.badge}</span>}
              </div>
            ))}
          </div>
        ))}
      </nav>

      <div className="sidebar-footer">
        <div className="nav-item">
          <svg className="nav-icon" viewBox="0 0 16 16" fill="none">
            <circle cx="8" cy="6" r="3" fill="currentColor" opacity=".7"/>
            <path d="M2 14c0-3.314 2.686-5 6-5s6 1.686 6 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity=".5"/>
          </svg>
          <div style={{ flex: 1, overflow: 'hidden' }}>
            <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Admin User</div>
            <div style={{ fontSize: 10, color: 'var(--text3)', fontFamily: 'var(--mono)' }}>super admin</div>
          </div>
        </div>
      </div>
    </aside>
  )
}
