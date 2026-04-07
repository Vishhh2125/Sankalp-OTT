import { useState } from 'react'
import { Trash2, X } from 'lucide-react'
import { ConfirmDialog } from '../components/ui/Controls.jsx'

const initSent = [
  { id:1, title:'New episode alert — Secret Marriage', audience:'All users', delivered:48000, opened:28800, date:'Apr 3, 08:00', type:'drama', icon:'🎬' },
  { id:2, title:'Daily reward coins credited',          audience:'Paid members', delivered:11800, opened:9440, date:'Apr 3, 06:00', type:'reward', icon:'🎁' },
  { id:3, title:'Weekend offer — 20% off membership',  audience:'Free users', delivered:36400, opened:14560, date:'Apr 2, 10:00', type:'offer', icon:'🏷️' },
  { id:4, title:'New drama: Midnight Rivals is live!',  audience:'All users', delivered:48000, opened:31200, date:'Apr 1, 12:00', type:'drama', icon:'📢' },
]

const initScheduled = [
  { id:10, title:'Anniversary sale push', audience:'All users', sendAt:'Apr 10, 09:00', type:'offer' },
  { id:11, title:'New episode reminder — Twin Flames', audience:'Paid members', sendAt:'Apr 8, 20:00', type:'drama' },
]

const AUDIENCES = ['All users', 'Free users', 'Paid members', 'Weekly plan', 'Monthly plan', 'Annual plan']
const NOTIF_TYPES = ['New drama release', 'Membership offer', 'Reward coins', 'Reminder', 'Re-engage inactive', 'Custom']
// Removed: CAT_INTERESTS (not in ERD)

export default function Notifications() {
  const [tab, setTab] = useState('compose')
  const [audience, setAudience] = useState('All users')
  const [byInterest, setByInterest] = useState('')
  const [notifType, setNotifType] = useState('New drama release')
  const [title, setTitle] = useState('')
  const [msg, setMsg] = useState('')
  const [scheduleAt, setScheduleAt] = useState('')
  const [sent, setSent] = useState(initSent)
  const [scheduled, setScheduled] = useState(initScheduled)
  const [confirm, setConfirm] = useState(null)

  const charLimit = 160

  const sendNow = () => {
    if(!msg.trim()) return
    setSent(p => [{
      id:Date.now(), title:title||notifType, audience, delivered:0, opened:0, date:'Just now', type:'custom', icon:'📬',
    }, ...p])
    setMsg(''); setTitle(''); setScheduleAt('')
    setTab('sent')
  }

  const scheduleNotif = () => {
    if(!msg.trim()||!scheduleAt) return
    setScheduled(p => [{
      id:Date.now(), title:title||notifType, audience, sendAt:scheduleAt, type:'custom',
    }, ...p])
    setMsg(''); setTitle(''); setScheduleAt('')
    setTab('scheduled')
  }

  const cancelScheduled = id => { setScheduled(p=>p.filter(n=>n.id!==id)); setConfirm(null) }
  const deleteSent = id => { setSent(p=>p.filter(n=>n.id!==id)); setConfirm(null) }

  const TABS = ['compose','sent','scheduled','analytics']

  return (
    <div className="page-enter">
      {/* Stats row */}
      <div className="metrics-grid" style={{ gridTemplateColumns:'repeat(4,1fr)', marginBottom:16 }}>
        {[
          { label:'Total sent', value:sent.length, sub:'notifications' },
          { label:'Avg delivery', value:'43.6K', sub:'per notification' },
          { label:'Avg open rate', value:'62%', sub:'opened / delivered' },
          { label:'Scheduled', value:scheduled.length, sub:'pending notifications' },
        ].map(m => (
          <div className="metric-card" key={m.label}>
            <div className="metric-label">{m.label}</div>
            <div className="metric-value" style={{ fontSize:20 }}>{m.value}</div>
            <div className="metric-sub">{m.sub}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display:'flex', gap:0, marginBottom:18, borderBottom:'1px solid var(--border)' }}>
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding:'8px 16px', background:'none', border:'none', cursor:'pointer',
            fontSize:12, fontWeight:tab===t?600:400,
            color:tab===t?'var(--accent2)':'var(--text3)',
            borderBottom:tab===t?'2px solid var(--accent)':'2px solid transparent',
            textTransform:'capitalize', marginBottom:-1,
          }}>{t==='compose'?'Compose & Send':t==='analytics'?'Delivery Analytics':t==='scheduled'?`Scheduled (${scheduled.length})`:t==='sent'?`Sent (${sent.length})`:t}</button>
        ))}
      </div>

      {/* Compose tab */}
      {tab==='compose' && (
        <div className="grid2">
          <div className="card">
            <div className="card-title">Send notification</div>

            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:14 }}>
              <div className="form-group">
                <label className="form-label">Target audience</label>
                <select className="select" style={{ width:'100%' }} value={audience} onChange={e=>setAudience(e.target.value)}>
                  {AUDIENCES.map(a=><option key={a}>{a}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Notification trigger</label>
                <select className="select" style={{ width:'100%' }} value={notifType} onChange={e=>setNotifType(e.target.value)}>
                  {NOTIF_TYPES.map(t=><option key={t}>{t}</option>)}
                </select>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Notification type</label>
              <select className="select" style={{ width:'100%' }} value={notifType} onChange={e=>setNotifType(e.target.value)}>
                {NOTIF_TYPES.map(t=><option key={t}>{t}</option>)}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Custom title (optional)</label>
              <input className="input" style={{ width:'100%' }} placeholder="Leave blank to use type as title" value={title} onChange={e=>setTitle(e.target.value)}/>
            </div>

            <div className="form-group">
              <div style={{ display:'flex', justifyContent:'space-between' }}>
                <label className="form-label">Message *</label>
                <span style={{ fontSize:11, color:msg.length>charLimit?'var(--red)':'var(--text3)' }}>{msg.length}/{charLimit}</span>
              </div>
              <textarea className="input" rows={4} style={{ width:'100%', resize:'vertical' }}
                placeholder="Write your notification message…" value={msg} onChange={e=>setMsg(e.target.value)}/>
            </div>

            <div className="form-group">
              <label className="form-label">Schedule for later (optional)</label>
              <input className="input" style={{ width:'100%' }} type="datetime-local" value={scheduleAt} onChange={e=>setScheduleAt(e.target.value)}/>
            </div>

            <div style={{ display:'flex', gap:8 }}>
              <button className="btn btn-primary" style={{ flex:1 }} onClick={sendNow} disabled={!msg.trim()}>Send now</button>
              <button className="btn btn-ghost" style={{ flex:1 }} onClick={scheduleNotif} disabled={!msg.trim()||!scheduleAt}>Schedule</button>
            </div>
          </div>

          {/* Preview */}
          <div className="card">
            <div className="card-title">Push notification preview</div>
            <div style={{ background:'var(--bg3)', borderRadius:12, padding:16, border:'1px solid var(--border)', maxWidth:320 }}>
              <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:10 }}>
                <div style={{ width:32, height:32, borderRadius:8, background:'var(--accent)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:14 }}>▶</div>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:12, fontWeight:600, color:'var(--text)' }}>OTT Admin</div>
                  <div style={{ fontSize:10, color:'var(--text3)' }}>now</div>
                </div>
              </div>
              <div style={{ fontSize:13, fontWeight:600, marginBottom:4 }}>{title||notifType||'Notification title'}</div>
              <div style={{ fontSize:12, color:'var(--text2)' }}>{msg||'Your notification message will appear here…'}</div>
            </div>
            <div style={{ marginTop:14 }}>
              <div style={{ fontSize:12, color:'var(--text3)', marginBottom:8 }}>Estimated reach</div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                {[
                  { label:'Target', value: audience==='All users'?'48,291 users':audience==='Free users'?'30,450 users':'17,841 users' },
                  { label:'Est. opens', value: audience==='All users'?'~29,940':audience==='Free users'?'~18,879':'~11,062' },
                ].map(r=>(
                  <div key={r.label} style={{ background:'var(--bg3)', padding:10, borderRadius:8, textAlign:'center' }}>
                    <div style={{ fontSize:10, color:'var(--text3)', marginBottom:3 }}>{r.label}</div>
                    <div style={{ fontWeight:600, fontSize:13 }}>{r.value}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Sent tab */}
      {tab==='sent' && (
        <div className="card" style={{ padding:0 }}>
          <div style={{ padding:'14px 18px', borderBottom:'1px solid var(--border)' }}>
            <div className="card-title" style={{ marginBottom:0 }}>Sent notifications ({sent.length})</div>
          </div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Notification</th><th>Audience</th><th>Delivered</th><th>Opened</th><th>Open rate</th><th>Sent at</th><th></th></tr></thead>
              <tbody>
                {sent.map(n => (
                  <tr key={n.id}>
                    <td>
                      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                        <span style={{ fontSize:16 }}>{n.icon}</span>
                        <span style={{ fontWeight:500, fontSize:13 }}>{n.title}</span>
                      </div>
                    </td>
                    <td style={{ color:'var(--text3)', fontSize:12 }}>{n.audience}</td>
                    <td style={{ fontFamily:'var(--mono)' }}>{n.delivered.toLocaleString()}</td>
                    <td style={{ fontFamily:'var(--mono)' }}>{n.opened.toLocaleString()}</td>
                    <td>
                      {n.delivered > 0 ? (
                        <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                          <div style={{ width:50, height:4, background:'var(--bg4)', borderRadius:2, overflow:'hidden' }}>
                            <div style={{ height:'100%', width:`${(n.opened/n.delivered)*100}%`, background:'var(--green)', borderRadius:2 }}/>
                          </div>
                          <span style={{ fontSize:11, fontFamily:'var(--mono)', color:'var(--green)' }}>{((n.opened/n.delivered)*100).toFixed(0)}%</span>
                        </div>
                      ) : '—'}
                    </td>
                    <td style={{ color:'var(--text3)', fontSize:12 }}>{n.date}</td>
                    <td>
                      <button className="btn btn-danger btn-sm" onClick={() => setConfirm({type:'sent',id:n.id,name:n.title})}><Trash2 size={11}/></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Scheduled tab */}
      {tab==='scheduled' && (
        <div className="card" style={{ padding:0 }}>
          <div style={{ padding:'14px 18px', borderBottom:'1px solid var(--border)' }}>
            <div className="card-title" style={{ marginBottom:0 }}>Scheduled ({scheduled.length})</div>
          </div>
          {scheduled.length===0 && <div style={{ textAlign:'center', padding:'40px 0', color:'var(--text3)' }}>No scheduled notifications</div>}
          <div className="table-wrap">
            {scheduled.length > 0 && (
              <table>
                <thead><tr><th>Title</th><th>Audience</th><th>Scheduled for</th><th></th></tr></thead>
                <tbody>
                  {scheduled.map(n => (
                    <tr key={n.id}>
                      <td style={{ fontWeight:500 }}>{n.title}</td>
                      <td style={{ color:'var(--text3)' }}>{n.audience}</td>
                      <td><span className="badge badge-amber">{n.sendAt}</span></td>
                      <td>
                        <button className="btn btn-danger btn-sm" onClick={() => setConfirm({type:'scheduled',id:n.id,name:n.title})}>
                          <X size={11}/> Cancel
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* Analytics tab */}
      {tab==='analytics' && (
        <div className="grid2">
          <div className="card">
            <div className="card-title">Delivery analytics</div>
            {sent.map(n => (
              <div key={n.id} style={{ marginBottom:16 }}>
                <div style={{ fontSize:12, fontWeight:500, marginBottom:6, color:'var(--text)' }}>{n.icon} {n.title}</div>
                <div style={{ display:'flex', gap:10, marginBottom:4 }}>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:10, color:'var(--text3)', marginBottom:2 }}>Delivered</div>
                    <div style={{ height:6, background:'var(--bg4)', borderRadius:3 }}>
                      <div style={{ height:'100%', width:'100%', background:'var(--accent)', borderRadius:3 }}/>
                    </div>
                    <div style={{ fontSize:10, color:'var(--text3)', marginTop:2 }}>{n.delivered.toLocaleString()}</div>
                  </div>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:10, color:'var(--text3)', marginBottom:2 }}>Opened</div>
                    <div style={{ height:6, background:'var(--bg4)', borderRadius:3 }}>
                      <div style={{ height:'100%', width:`${n.delivered>0?((n.opened/n.delivered)*100):0}%`, background:'var(--green)', borderRadius:3 }}/>
                    </div>
                    <div style={{ fontSize:10, color:'var(--green)', marginTop:2 }}>{n.opened.toLocaleString()}</div>
                  </div>
                </div>
                <div style={{ borderBottom:'1px solid var(--border)', marginTop:10 }}/>
              </div>
            ))}
          </div>
          <div className="card">
            <div className="card-title">Best performing by type</div>
            {[{ type:'Drama alerts', rate:'65%', color:'var(--accent2)' },{ type:'Reward coins', rate:'80%', color:'var(--green)' },{ type:'Membership offers', rate:'40%', color:'var(--amber)' },{ type:'Reminders', rate:'55%', color:'var(--blue)' }].map(r => (
              <div className="bar-row" key={r.type}>
                <div className="bar-lbl">{r.type}</div>
                <div className="bar-track" style={{ flex:1 }}><div className="bar-fill" style={{ width:r.rate, background:r.color }}/></div>
                <div className="bar-val">{r.rate}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <ConfirmDialog open={!!confirm} danger
        title={confirm?.type==='scheduled'?'Cancel Scheduled Notification':'Delete Sent Notification'}
        message={`Are you sure you want to ${confirm?.type==='scheduled'?'cancel':'delete'} "${confirm?.name}"?`}
        onConfirm={() => confirm?.type==='scheduled'?cancelScheduled(confirm.id):deleteSent(confirm.id)}
        onCancel={() => setConfirm(null)}
      />
    </div>
  )
}
