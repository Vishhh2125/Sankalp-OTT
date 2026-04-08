import { useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { LogOut } from 'lucide-react'
import { PAGE_META } from '../config/nav.js'
import { logout, selectUser } from '../store/authSlice.js'
import { selectActivePage } from '../store/navigationSlice.js'

export default function Topbar() {
  const dispatch   = useDispatch()
  const adminUser  = useSelector(selectUser) || {}
  const active     = useSelector(selectActivePage)
  const [showMenu, setShowMenu] = useState(false)

  const userInitials = adminUser.name
    ? adminUser.name.split(' ').map(n => n[0]).join('').toUpperCase()
    : 'AD'
  const meta = PAGE_META[active] || { title: active, subtitle: '' }

  const handleLogout = () => {
    // Clear localStorage first so axios interceptor sees no token immediately
    localStorage.removeItem('admin_token')
    localStorage.removeItem('admin_user')
    dispatch(logout())
    setShowMenu(false)
  }

  return (
    <header className="topbar">
      <div className="topbar-left">
        <div>
          <div className="page-title">{meta.title}</div>
          <div className="page-sub">{meta.subtitle}</div>
        </div>
      </div>
      <div className="topbar-right">
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          background: 'var(--green-bg)', border: '1px solid rgba(34,201,135,0.2)',
          borderRadius: 20, padding: '4px 10px 4px 8px',
        }}>
          <div className="live-dot" />
          <span style={{ fontSize: 11, color: 'var(--green)', fontWeight: 500 }}>Live</span>
        </div>
        
        {/* User Menu */}
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="avatar"
            style={{
              width: 32,
              height: 32,
              fontSize: 12,
              cursor: 'pointer',
              border: '1px solid var(--border)',
              transition: 'all 0.2s'
            }}
            title={adminUser.email}
          >
            {userInitials}
          </button>

          {/* Dropdown Menu */}
          {showMenu && (
            <div style={{
              position: 'absolute',
              top: '100%',
              right: 0,
              marginTop: '8px',
              background: 'var(--bg2)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)',
              overflow: 'hidden',
              boxShadow: '0 10px 30px rgba(0,0,0,0.4)',
              zIndex: 1000,
              minWidth: '180px'
            }}>
              {/* User Info */}
              <div style={{
                padding: '10px 12px',
                borderBottom: '1px solid var(--border)',
              }}>
                <div style={{ fontSize: '12px', fontWeight: '500', color: 'var(--text)' }}>
                  {adminUser.name || 'Admin'}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text3)', marginTop: '2px' }}>
                  {adminUser.email || 'admin@example.com'}
                </div>
              </div>

              {/* Logout Button */}
              <button
                onClick={handleLogout}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text)',
                  fontSize: '12px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'var(--red-bg)'
                  e.currentTarget.style.color = 'var(--red)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent'
                  e.currentTarget.style.color = 'var(--text)'
                }}
              >
                <LogOut size={14} />
                Logout
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
