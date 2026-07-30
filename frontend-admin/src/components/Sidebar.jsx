import { useDispatch, useSelector } from 'react-redux'
import { setActivePage, selectActivePage } from '../store/navigationSlice.js'
import { selectUser } from '../store/authSlice.js'
import { NAV_CONFIG } from '../config/nav.js'
import { filterNavByPermissions } from '../config/permissions.js'

const NAV_ICONS = {
  dashboard: (
    <>
      <rect x="1" y="1" width="6" height="6" rx="1.5" fill="currentColor" opacity=".9" />
      <rect x="9" y="1" width="6" height="6" rx="1.5" fill="currentColor" opacity=".5" />
      <rect x="1" y="9" width="6" height="6" rx="1.5" fill="currentColor" opacity=".5" />
      <rect x="9" y="9" width="6" height="6" rx="1.5" fill="currentColor" opacity=".3" />
    </>
  ),
  users: (
    <>
      <circle cx="6" cy="5" r="3" fill="currentColor" opacity=".9" />
      <path d="M1 13c0-2.761 2.239-5 5-5s5 2.239 5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity=".7" />
      <circle cx="12" cy="5" r="2" fill="currentColor" opacity=".4" />
      <path d="M14 13c0-1.5-.7-2.8-1.7-3.6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity=".4" />
    </>
  ),
  student_onboarding: (
    <>
      <path d="M8 2L1 5l7 3 7-3-7-3z" fill="currentColor" opacity=".9" />
      <path d="M2.5 7v4.5L8 14l5.5-2.5V7" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" opacity=".6" />
      <circle cx="12" cy="12" r="3" fill="currentColor" opacity=".3" />
      <path d="M12 10.5v3M10.5 12h3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </>
  ),
  assign_courses: (
    <>
      <path d="M3 2h8a1.5 1.5 0 011.5 1.5v10.5L8 11.5 3.5 14V3.5A1.5 1.5 0 013 2z" fill="currentColor" opacity=".3" />
      <path d="M6 5h4M6 7.5h3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" opacity=".8" />
    </>
  ),
  account_deletions: (
    <>
      <path d="M3 4h10M6 4V2.5a.5.5 0 01.5-.5h3a.5.5 0 01.5.5V4M5 4v10a1 1 0 001 1h4a1 1 0 001-1V4" stroke="currentColor" strokeWidth="1.3" fill="none" opacity=".9" />
      <path d="M7 7v5M9 7v5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" opacity=".6" />
    </>
  ),
  dramas: (
    <>
      <rect x="1" y="3" width="14" height="10" rx="1.5" fill="currentColor" opacity=".3" />
      <path d="M6 6l5 2.5L6 11V6z" fill="currentColor" opacity=".9" />
    </>
  ),
  categories: (
    <>
      <rect x="1" y="1" width="4" height="4" rx="1" fill="currentColor" opacity=".9" />
      <rect x="7" y="1" width="8" height="1.5" rx=".75" fill="currentColor" opacity=".6" />
      <rect x="7" y="4" width="5" height="1.5" rx=".75" fill="currentColor" opacity=".4" />
      <rect x="1" y="7" width="4" height="4" rx="1" fill="currentColor" opacity=".6" />
      <rect x="7" y="7" width="8" height="1.5" rx=".75" fill="currentColor" opacity=".6" />
      <rect x="7" y="10" width="5" height="1.5" rx=".75" fill="currentColor" opacity=".4" />
    </>
  ),
  banners: (
    <>
      <rect x="1" y="3" width="14" height="7" rx="1.5" fill="currentColor" opacity=".3" />
      <rect x="3" y="5" width="6" height="1.5" rx=".75" fill="currentColor" opacity=".7" />
      <rect x="3" y="7.5" width="4" height="1" rx=".5" fill="currentColor" opacity=".4" />
    </>
  ),
  hero_banners: (
    <>
      <rect x="0" y="2" width="16" height="9" rx="1.5" fill="currentColor" opacity=".35" />
      <rect x="2" y="4" width="7" height="1.5" rx=".75" fill="currentColor" opacity=".8" />
      <rect x="2" y="6.5" width="5" height="1" rx=".5" fill="currentColor" opacity=".5" />
      <circle cx="13" cy="6.5" r="1.5" fill="currentColor" opacity=".6" />
    </>
  ),
  membership: (
    <>
      <rect x="1" y="4" width="14" height="9" rx="1.5" fill="currentColor" opacity=".3" />
      <rect x="1" y="6.5" width="14" height="2" fill="currentColor" opacity=".6" />
      <circle cx="4" cy="10.5" r="1" fill="currentColor" opacity=".7" />
    </>
  ),
  topup: (
    <>
      <circle cx="8" cy="6" r="4" fill="currentColor" opacity=".3" />
      <circle cx="8" cy="6" r="2" fill="currentColor" opacity=".7" />
      <path d="M8 10v3M6 12h4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" opacity=".7" />
    </>
  ),
  coins: (
    <>
      <circle cx="8" cy="8" r="6" fill="currentColor" opacity=".25" />
      <circle cx="8" cy="8" r="4" fill="currentColor" opacity=".5" />
    </>
  ),
  notifications: (
    <>
      <path d="M8 2a4 4 0 00-4 4v3l-1 1.5h10L12 9V6a4 4 0 00-4-4z" fill="currentColor" opacity=".6" />
      <path d="M6.5 13a1.5 1.5 0 003 0" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" opacity=".9" />
    </>
  ),
  analytics: (
    <>
      <rect x="1" y="10" width="3" height="4" rx="1" fill="currentColor" opacity=".5" />
      <rect x="6" y="7" width="3" height="7" rx="1" fill="currentColor" opacity=".7" />
      <rect x="11" y="3" width="3" height="11" rx="1" fill="currentColor" opacity=".9" />
    </>
  ),
  roles: (
    <>
      <path d="M8 2L3 4v4c0 3 2.5 5 5 6 2.5-1 5-3 5-6V4L8 2z" fill="currentColor" opacity=".4" />
      <path d="M6 8l1.5 1.5L10 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity=".9" />
    </>
  ),
  cms: (
    <>
      <rect x="2" y="2" width="12" height="12" rx="1.5" fill="currentColor" opacity=".2" />
      <rect x="4" y="5" width="8" height="1" rx=".5" fill="currentColor" opacity=".8" />
      <rect x="4" y="7.5" width="6" height="1" rx=".5" fill="currentColor" opacity=".6" />
      <rect x="4" y="10" width="4" height="1" rx=".5" fill="currentColor" opacity=".4" />
    </>
  ),
  live: (
    <>
      <circle cx="8" cy="8" r="5" fill="currentColor" opacity=".25" />
      <circle cx="8" cy="8" r="2.5" fill="currentColor" />
    </>
  ),
  submissions: (
    <>
      <rect x="2" y="2" width="12" height="12" rx="1.5" fill="currentColor" opacity=".25" />
      <path d="M5 6h6M5 9h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity=".8" />
      <circle cx="11" cy="9" r="1.5" fill="currentColor" opacity=".9" />
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
  const dispatch = useDispatch()
  const active = useSelector(selectActivePage)
  const user = useSelector(selectUser)
  const navItems = filterNavByPermissions(NAV_CONFIG, user)

  const isTeacher = user?.role === 'teacher'
  const logoTitle = isTeacher ? 'Alpha-Minds Teacher' : 'Alpha-Minds Admin'
  const roleLabel = user?.role === 'admin' ? 'admin' : isTeacher ? 'teacher' : user?.role === 'sub_admin' ? 'sub-admin' : 'user'

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <div className="logo-mark">{isTeacher ? 'TP' : 'AM'}</div>
        <div>
          <div className="logo-text">{logoTitle}</div>
        </div>
      </div>

      <nav style={{ flex: 1, paddingTop: 8 }}>
        {navItems.map(group => (
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
            <circle cx="8" cy="6" r="3" fill="currentColor" opacity=".7" />
            <path d="M2 14c0-3.314 2.686-5 6-5s6 1.686 6 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity=".5" />
          </svg>
          <div style={{ flex: 1, overflow: 'hidden' }}>
            <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {user?.name || 'Admin User'}
            </div>
            <div style={{ fontSize: 10, color: 'var(--text3)', fontFamily: 'var(--mono)' }}>{roleLabel}</div>
          </div>
        </div>
      </div>
    </aside>
  )
}
