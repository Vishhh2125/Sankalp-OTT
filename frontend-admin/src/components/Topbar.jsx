import { PAGE_META } from '../config/nav.js'

export default function Topbar({ active }) {
  const meta = PAGE_META[active] || { title: active, subtitle: '' }
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
        <div className="avatar" style={{ width: 32, height: 32, fontSize: 12 }}>AD</div>
      </div>
    </header>
  )
}
