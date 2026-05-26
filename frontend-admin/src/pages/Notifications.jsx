import { useState, useEffect } from 'react'
import { Trash2, X, AlertCircle, Loader } from 'lucide-react'
import { ConfirmDialog } from '../components/ui/Controls.jsx'
import api from '../services/api.js'

const AUDIENCE_MAP = {
  'All users': 'all',
  'Free users': 'free',
  'Paid members': 'paid',
  'Weekly plan': 'weekly-plan',
  'Monthly plan': 'monthly-plan',
  'Annual plan': 'annual-plan',
}

const NOTIF_TYPES = [
  { label: 'New drama release', value: 'drama' },
  { label: 'Membership offer', value: 'membership' },
  { label: 'Reward coins', value: 'reward' },
  { label: 'Reminder', value: 'reminder' },
  { label: 'Re-engage inactive', value: 're-engage' },
  { label: 'Custom', value: 'custom' },
]

export default function Notifications() {
  const [tab, setTab] = useState('compose')
  const [audience, setAudience] = useState('All users')
  const [notifType, setNotifType] = useState('drama')
  const [title, setTitle] = useState('')
  const [msg, setMsg] = useState('')
  const [sent, setSent] = useState([])
  const [scheduled, setScheduled] = useState([])
  const [confirm, setConfirm] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [stats, setStats] = useState(null)

  const charLimit = 160

  // Fetch dramas on component mount
  useEffect(() => {
    fetchStats()
    fetchSentNotifications()
  }, [])

  const fetchStats = async () => {
    try {
      const response = await api.get('/v1/notifications/admin/stats')
      if (response.data?.success) {
        setStats(response.data.data)
      }
    } catch (err) {
      console.error('Error fetching stats:', err)
    }
  }

  const fetchSentNotifications = async () => {
    try {
      const response = await api.get('/v1/notifications/admin/sent')
      if (response.data?.success) {
        const notifications = response.data.data.notifications.map(n => ({
          id: n.id,
          title: n.title,
          sent_at: n.sent_at,
          type: n.type,
          icon: getIcon(n.type),
          recipients: n.recipients || 0,
        }))
        setSent(notifications)
      }
    } catch (err) {
      console.error('Error fetching sent notifications:', err)
    }
  }

  const sendNow = async () => {
    if (!msg.trim()) return

    setLoading(true)
    setError(null)

    try {
      const payload = {
        title: title || `${notifType} notification`,
        body: msg,
        type: notifType,
        audience: AUDIENCE_MAP[audience],
      }

      const response = await api.post('/v1/notifications/admin/send', payload)
      if (response.data?.success) {
        // Add to sent list
        const newNotif = {
          id: Date.now(),
          title: title || notifType,
          sent_at: new Date().toISOString(),
          type: notifType,
          icon: getIcon(notifType),
          recipients: response.data.data.count || 0,
        }
        setSent(p => [newNotif, ...p])
        // Clear form
        setMsg('')
        setTitle('')
        setTab('sent')
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to send notification')
      console.error('Error sending notification:', err)
    } finally {
      setLoading(false)
    }
  }

  const cancelScheduled = id => { setScheduled(p => p.filter(n => n.id !== id)); setConfirm(null) }
  const deleteSent = async id => {
    try {
      const notification = sent.find(n => n.id === id)
      if (!notification) return

      await api.delete('/v1/notifications/admin/sent', {
        data: {
          title: notification.title,
          type: notification.type,
          sent_at: notification.sent_at,
        },
      })

      setSent(p => p.filter(n => n.id !== id))
      setConfirm(null)
    } catch (err) {
      console.error('Error deleting notification:', err)
      alert(err.response?.data?.message || 'Failed to delete notification')
    }
  }

  const getIcon = (type) => {
    const icons = { drama: '🎬', membership: '👑', reward: '🎁', reminder: '⏰', 're-engage': '📞', custom: '📬' }
    return icons[type] || '📬'
  }

  const TABS = ['compose', 'sent']
  const AUDIENCES = Object.keys(AUDIENCE_MAP)

  return (
    <div className="page-enter">
      {/* Stats row */}
      <div className="metrics-grid" style={{ gridTemplateColumns: 'repeat(4,1fr)', marginBottom: 16 }}>
        {[
          { label: 'Total sent', value: stats?.totalSent || sent.length, sub: 'notifications' },
          { label: 'Avg delivery', value: '43.6K', sub: 'per notification' },
          { label: 'Avg open rate', value: stats?.openRate || '62%', sub: 'opened / delivered' },
          { label: 'Scheduled', value: scheduled.length, sub: 'pending notifications' },
        ].map(m => (
          <div className="metric-card" key={m.label}>
            <div className="metric-label">{m.label}</div>
            <div className="metric-value" style={{ fontSize: 20 }}>{m.value}</div>
            <div className="metric-sub">{m.sub}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 18, borderBottom: '1px solid var(--border)' }}>
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding: '8px 16px', background: 'none', border: 'none', cursor: 'pointer',
            fontSize: 12, fontWeight: tab === t ? 600 : 400,
            color: tab === t ? 'var(--accent2)' : 'var(--text3)',
            borderBottom: tab === t ? '2px solid var(--accent)' : '2px solid transparent',
            textTransform: 'capitalize', marginBottom: -1,
          }}>{t === 'compose' ? 'Compose & Send' : t === 'sent' ? `Sent (${sent.length})` : t}</button>
        ))}
      </div>

      {/* Error alert */}
      {error && (
        <div style={{ background: 'var(--red)', color: 'white', padding: '12px 16px', borderRadius: 8, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      {/* Compose tab */}
      {tab === 'compose' && (
        <div className="grid2">
          <div className="card">
            <div className="card-title">Send notification</div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
              <div className="form-group">
                <label className="form-label">Target audience</label>
                <select className="select" style={{ width: '100%' }} value={audience} onChange={e => setAudience(e.target.value)}>
                  {AUDIENCES.map(a => <option key={a}>{a}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Notification type</label>
                <select className="select" style={{ width: '100%' }} value={notifType} onChange={e => setNotifType(e.target.value)}>
                  {NOTIF_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
            </div>





            <div className="form-group">
              <label className="form-label">Custom title (optional)</label>
              <input className="input" style={{ width: '100%' }} placeholder="Leave blank to use type as title" value={title} onChange={e => setTitle(e.target.value)} />
            </div>

            <div className="form-group">
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <label className="form-label">Message *</label>
                <span style={{ fontSize: 11, color: msg.length > charLimit ? 'var(--red)' : 'var(--text3)' }}>{msg.length}/{charLimit}</span>
              </div>
              <textarea className="input" rows={4} style={{ width: '100%', resize: 'vertical' }}
                placeholder="Write your notification message…" value={msg} onChange={e => setMsg(e.target.value)} />
            </div>



            <button className="btn btn-primary" onClick={sendNow} disabled={!msg.trim() || loading}>
              {loading ? <Loader size={14} style={{ animation: 'spin 1s linear infinite' }} /> : 'Send now'}
            </button>
          </div>

          {/* Preview */}
          <div className="card">
            <div className="card-title">Push notification preview</div>
            <div style={{ background: 'var(--bg3)', borderRadius: 12, padding: 16, border: '1px solid var(--border)', maxWidth: 320 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>{getIcon(notifType)}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>OTT Admin</div>
                  <div style={{ fontSize: 10, color: 'var(--text3)' }}>now</div>
                </div>
              </div>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>{title || NOTIF_TYPES.find(t => t.value === notifType)?.label || 'Notification title'}</div>
              <div style={{ fontSize: 12, color: 'var(--text2)' }}>{msg || 'Your notification message will appear here…'}</div>

            </div>
            <div style={{ marginTop: 14 }}>
              <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 8 }}>Estimated reach</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {[
                  { label: 'Target', value: audience === 'All users' ? '48,291 users' : audience === 'Free users' ? '30,450 users' : '17,841 users' },
                  { label: 'Est. opens', value: audience === 'All users' ? '~29,940' : audience === 'Free users' ? '~18,879' : '~11,062' },
                ].map(r => (
                  <div key={r.label} style={{ background: 'var(--bg3)', padding: 10, borderRadius: 8, textAlign: 'center' }}>
                    <div style={{ fontSize: 10, color: 'var(--text3)', marginBottom: 3 }}>{r.label}</div>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{r.value}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Sent tab */}
      {tab === 'sent' && (
        <div className="card" style={{ padding: 0 }}>
          <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)' }}>
            <div className="card-title" style={{ marginBottom: 0 }}>Sent notifications ({sent.length})</div>
          </div>
          {sent.length === 0 && <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text3)' }}>No sent notifications yet</div>}
          {sent.length > 0 && (
            <div className="table-wrap">
              <table>
                <thead><tr><th>Notification</th><th>Recipients</th><th>Sent at</th><th></th></tr></thead>
                <tbody>
                  {sent.map(n => (
                    <tr key={n.id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: 16 }}>{n.icon}</span>
                          <span style={{ fontWeight: 500, fontSize: 13 }}>{n.title}</span>
                        </div>
                      </td>
                      <td style={{ fontFamily: 'var(--mono)' }}>{n.recipients.toLocaleString()}</td>
                      <td style={{ color: 'var(--text3)', fontSize: 12 }}>{n.sent_at ? new Date(n.sent_at).toLocaleString() : 'N/A'}</td>
                      <td>
                        <button className="btn btn-danger btn-sm" onClick={() => setConfirm({ type: 'sent', id: n.id, name: n.title })}><Trash2 size={11} /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}



      <ConfirmDialog open={!!confirm} danger
        title={confirm?.type === 'scheduled' ? 'Cancel Scheduled Notification' : 'Delete Sent Notification'}
        message={`Are you sure you want to ${confirm?.type === 'scheduled' ? 'cancel' : 'delete'} "${confirm?.name}"?`}
        onConfirm={() => confirm?.type === 'scheduled' ? cancelScheduled(confirm.id) : deleteSent(confirm.id)}
        onCancel={() => setConfirm(null)}
      />
    </div>
  )
}
