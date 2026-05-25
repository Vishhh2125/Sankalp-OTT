import { useState, useEffect } from 'react'
import { Search, Eye, Coins, Download, AlertCircle } from 'lucide-react'
import Modal, { ModalSection, FormGroup } from '../components/ui/Modal.jsx'
import { ConfirmDialog } from '../components/ui/Controls.jsx'
import { usersApi } from '../services/api.js'
import * as XLSX from 'xlsx'

const roleBadge = { free:'badge-amber', member:'badge-purple', admin:'badge-red', sub_admin:'badge-blue', user:'badge-gray' }

function UserProfileModal({ open, onClose, user }) {
  const [tab, setTab] = useState('profile')
  const [profileData, setProfileData] = useState(null)
  const [loading, setLoading] = useState(false)
  
  useEffect(() => {
    if (open && user?.id) {
      fetchUserProfile(user.id)
    }
  }, [open, user?.id])

  const fetchUserProfile = async (userId) => {
    try {
      setLoading(true)
      const response = await usersApi.getProfile(userId)
      setProfileData(response.data.data)
    } catch (err) {
      console.error('Failed to fetch user profile:', err)
    } finally {
      setLoading(false)
    }
  }

  if (!user || !open) return null
  const tabs = ['profile','subscription','watch','wallet']
  const displayUser = profileData || user
  
  return (
    <Modal open={open} onClose={onClose} title={`User Profile — ${user.name}`} width={640}>
      <div style={{ display:'flex', gap:0, marginBottom:20, borderBottom:'1px solid var(--border)' }}>
        {tabs.map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding:'8px 14px', background:'none', border:'none', cursor:'pointer',
            fontSize:12, fontWeight:tab===t?600:400,
            color:tab===t?'var(--accent2)':'var(--text3)',
            borderBottom:tab===t?'2px solid var(--accent)':'2px solid transparent',
            textTransform:'capitalize', marginBottom:-1,
          }}>{t}</button>
        ))}
      </div>

      {tab==='profile' && (
        <>
          <div style={{ display:'flex', alignItems:'center', gap:16, marginBottom:20 }}>
            <div className="avatar" style={{ width:52, height:52, fontSize:18 }}>{user.name.split(' ').map(n=>n[0]).join('')}</div>
            <div>
              <div style={{ fontWeight:600, fontSize:16 }}>{displayUser.name}</div>
              <div style={{ color:'var(--text3)', fontSize:13 }}>{displayUser.email}</div>
            </div>
            <div style={{ marginLeft:'auto' }}>
              <span className={`badge ${user.status==='Active'?'badge-green':'badge-red'}`}>{user.status}</span>
            </div>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
            {[
              { label:'Joined', value:user.joined },
              { label:'Role', value:displayUser.role },
              { label:'Coin balance', value:`₵ ${(displayUser.coins || 0).toLocaleString()}` },
            ].map(r => (
              <div key={r.label} style={{ background:'var(--bg3)', padding:'10px 14px', borderRadius:8 }}>
                <div style={{ fontSize:11, color:'var(--text3)', marginBottom:3 }}>{r.label}</div>
                <div style={{ fontWeight:500, fontSize:13 }}>{r.value}</div>
              </div>
            ))}
          </div>
        </>
      )}

      {tab==='subscription' && (
        <div>
          {loading ? (
            <div style={{ textAlign:'center', padding:'30px', color:'var(--text3)' }}>Loading...</div>
          ) : profileData?.memberships && profileData.memberships.length > 0 ? (
            <>
              <div style={{ background:'var(--bg3)', padding:16, borderRadius:8, marginBottom:16 }}>
                <div style={{ fontSize:11, color:'var(--text3)', marginBottom:4 }}>CURRENT PLAN</div>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                  <span className={`badge ${roleBadge[profileData.plan]}`} style={{ fontSize:14, padding:'4px 12px' }}>{profileData.plan === 'MEMBER' ? 'member' : 'free'}</span>
                  <div style={{ textAlign:'right' }}>
                    <div style={{ fontSize:12, color:'var(--text3)' }}>Expires</div>
                    <div style={{ fontWeight:500 }}>{new Date(profileData.memberships[0].end_date).toLocaleDateString('en-US', { year:'numeric', month:'short', day:'numeric' })}</div>
                  </div>
                </div>
              </div>
              <div>
                <div style={{ fontSize:11, color:'var(--text3)', marginBottom:12, fontWeight:600 }}>SUBSCRIPTION HISTORY</div>
                {profileData.memberships.map((m,i) => (
                  <div key={i} style={{ padding:'10px 0', borderBottom:'1px solid var(--border)' }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                      <div>
                        <div style={{ fontSize:13, fontWeight:500 }}>{m.plan?.name || 'Premium'}</div>
                        <div style={{ fontSize:11, color:'var(--text3)' }}>
                          {new Date(m.start_date).toLocaleDateString('en-US', { year:'numeric', month:'short', day:'numeric' })} - {new Date(m.end_date).toLocaleDateString('en-US', { year:'numeric', month:'short', day:'numeric' })}
                        </div>
                      </div>
                      <span className={`badge ${m.status === 'ACTIVE' ? 'badge-green' : 'badge-gray'}`} style={{ fontSize:10 }}>{m.status}</span>
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div style={{ color:'var(--text3)', fontSize:13, textAlign:'center', padding:'20px 0' }}>No subscription data available</div>
          )}
        </div>
      )}

      {tab==='watch' && (
        <div>
          {loading ? (
            <div style={{ textAlign:'center', padding:'30px', color:'var(--text3)' }}>Loading...</div>
          ) : profileData?.watch_history && profileData.watch_history.length > 0 ? (
            profileData.watch_history.map((w,i) => (
              <div key={i} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'10px 0', borderBottom:'1px solid var(--border)' }}>
                <div>
                  <div style={{ fontWeight:500, fontSize:13 }}>{w.episode?.show?.title || 'Unknown Show'}</div>
                  <div style={{ fontSize:11, color:'var(--text3)' }}>Episode {w.episode?.episode_num || 1}</div>
                </div>
                <span style={{ fontSize:12, color:'var(--text3)' }}>{new Date(w.last_watched).toLocaleDateString('en-US', { year:'numeric', month:'short', day:'numeric' })}</span>
              </div>
            ))
          ) : (
            <div style={{ color:'var(--text3)', fontSize:13, textAlign:'center', padding:'30px 0' }}>No watch history</div>
          )}
        </div>
      )}

      {tab==='wallet' && (
        <div>
          {loading ? (
            <div style={{ textAlign:'center', padding:'30px', color:'var(--text3)' }}>Loading...</div>
          ) : (
            <>
              <div style={{ background:'var(--bg3)', padding:14, borderRadius:8, marginBottom:14, textAlign:'center' }}>
                <div style={{ fontSize:11, color:'var(--text3)', marginBottom:4 }}>CURRENT BALANCE</div>
                <div style={{ fontSize:28, fontWeight:700, fontFamily:'var(--mono)', color:'var(--amber)' }}>₵ {(displayUser.coins || 0).toLocaleString()}</div>
              </div>
              {profileData?.coin_transactions && profileData.coin_transactions.length > 0 ? (
                profileData.coin_transactions.map((c,i) => (
                  <div key={i} style={{ display:'flex', justifyContent:'space-between', padding:'9px 0', borderBottom:'1px solid var(--border)' }}>
                    <div style={{ fontSize:13 }}>{c.title || c.reason || 'Transaction'}</div>
                    <div style={{ display:'flex', gap:12, alignItems:'center' }}>
                      <span style={{ fontSize:12, color:'var(--text3)' }}>{new Date(c.created_at).toLocaleDateString('en-US', { year:'numeric', month:'short', day:'numeric' })}</span>
                      <span style={{ fontFamily:'var(--mono)', fontSize:13, color:c.type === 'credit' ? 'var(--green)' : 'var(--red)' }}>
                        {c.type === 'credit' ? '+' : '-'}₵ {Math.abs(c.amount).toLocaleString()}
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                <div style={{ color:'var(--text3)', fontSize:13, textAlign:'center', padding:'20px 0' }}>No transactions</div>
              )}
            </>
          )}
        </div>
      )}


    </Modal>
  )
}

function CoinsModal({ open, onClose, user, onUpdate }) {
  const [amount, setAmount] = useState('')
  const [mode, setMode] = useState('credit')
  const [reason, setReason] = useState('')
  if (!user || !open) return null
  const handle = () => {
    if (!amount || isNaN(+amount)) return
    onUpdate(user.id, mode==='credit' ? +amount : -+amount)
    onClose(); setAmount(''); setReason('')
  }
  return (
    <Modal open={open} onClose={onClose} title={`Manage Coins — ${user.name}`} width={440}
      footer={<><button className="btn btn-ghost" onClick={onClose}>Cancel</button><button className={`btn ${mode==='credit'?'btn-primary':'btn-danger'}`} onClick={handle}>{mode==='credit'?'Credit Coins':'Debit Coins'}</button></>}
    >
      <div style={{ background:'var(--bg3)', padding:14, borderRadius:8, marginBottom:16, textAlign:'center' }}>
        <div style={{ fontSize:11, color:'var(--text3)', marginBottom:4 }}>CURRENT BALANCE</div>
        <div style={{ fontSize:26, fontWeight:700, fontFamily:'var(--mono)', color:'var(--amber)' }}>₵ {user.coins.toLocaleString()}</div>
      </div>
      <FormGroup label="Action">
        <div style={{ display:'flex', gap:8 }}>
          <button className={`btn ${mode==='credit'?'btn-primary':'btn-ghost'}`} style={{ flex:1 }} onClick={() => setMode('credit')}>+ Credit</button>
          <button className={`btn ${mode==='debit'?'btn-danger':'btn-ghost'}`} style={{ flex:1 }} onClick={() => setMode('debit')}>– Debit</button>
        </div>
      </FormGroup>
      <FormGroup label="Amount (₵)">
        <input className="input" style={{ width:'100%' }} type="number" min={1} placeholder="Enter coin amount" value={amount} onChange={e => setAmount(e.target.value)}/>
      </FormGroup>
      <FormGroup label="Reason / note">
        <input className="input" style={{ width:'100%' }} placeholder="e.g. Refund for failed unlock" value={reason} onChange={e => setReason(e.target.value)}/>
      </FormGroup>
    </Modal>
  )
}

export default function Users() {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState('All')
  const [modal, setModal] = useState(null)
  const [selected, setSelected] = useState(null)

  // Fetch users on mount
  useEffect(() => {
    loadUsers()
  }, [])

  const loadUsers = async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await usersApi.getAll()
      console.log('API Response:', response)
      setUsers(response.data.data.users || response.data.users || [])
    } catch (err) {
      console.error('Failed to load users:', err)
      setError(err.response?.data?.message || 'Failed to load users')
    } finally {
      setLoading(false)
    }
  }

  const filtered = users.filter(u => {
    const m = u.name.toLowerCase().includes(q.toLowerCase()) || u.email.toLowerCase().includes(q.toLowerCase()) || u.id.toLowerCase().includes(q.toLowerCase())
    const f = filter==='All' || (filter==='Member'?u.plan==='MEMBER':filter==='Free'?u.plan!=='MEMBER':filter==='Admin'?(u.role==='admin'||u.role==='sub_admin'):true)
    return m && f
  })

  const adjustCoins = async (id, delta) => {
    try {
      console.log('Adjusting coins for user', id, 'by', delta)
      const response = await usersApi.adjustCoins(id, delta, 'Admin adjustment')
      console.log('Adjust coins response:', response)
      // Update local state
      setUsers(p => p.map(u => u.id===id ? {...u, coins:Math.max(0,u.coins+delta)} : u))
    } catch (err) {
      console.error('Failed to adjust coins:', err)
      alert('Failed to adjust coins: ' + (err.response?.data?.message || err.message))
    }
  }

  const open = (m, u=null) => { setModal(m); setSelected(u) }

  const exportToExcel = () => {
    if (filtered.length === 0) {
      alert('No users to export')
      return
    }

    // Prepare data for export
    const exportData = filtered.map(u => ({
      'User ID': u.id,
      'Name': u.name,
      'Email': u.email,
      'Role': u.role,
      'User Type': u.plan === 'MEMBER' ? 'Member' : 'Free',
      'Subscription': u.subscription || '—',
      'Coins': u.coins,
      'Joined': u.joined,
      'Status': u.status,
    }))

    // Create workbook and worksheet
    const worksheet = XLSX.utils.json_to_sheet(exportData)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Users')

    // Generate filename with timestamp
    const filename = `users_export_${new Date().toISOString().split('T')[0]}.xlsx`

    // Write the file
    XLSX.writeFile(workbook, filename)
  }

  return (
    <div className="page-enter">
      {error && (
        <div style={{ background:'rgba(239, 68, 68, 0.1)', border:'1px solid #ef4444', borderRadius:8, padding:12, marginBottom:16, display:'flex', gap:8, alignItems:'center', color:'#ef4444', fontSize:13 }}>
          <AlertCircle size={16}/>
          <span>{error}</span>
          <button onClick={loadUsers} style={{ marginLeft:'auto', background:'none', border:'none', color:'#ef4444', cursor:'pointer', textDecoration:'underline' }}>Retry</button>
        </div>
      )}

      {loading ? (
        <div style={{ textAlign:'center', padding:'60px 20px', color:'var(--text3)' }}>
          <div style={{ marginBottom:16 }}>Loading users...</div>
          <div style={{ display:'inline-block', width:32, height:32, border:'3px solid var(--border)', borderTopColor:'var(--accent)', borderRadius:'50%', animation:'spin 1s linear infinite' }}></div>
        </div>
      ) : (
        <>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
        <div>
          <div style={{ fontWeight:600 }}>{users.length} registered users</div>
          <div style={{ fontSize:12, color:'var(--text3)' }}>{users.filter(u=>u.status==='Active').length} active · {users.filter(u=>u.plan==='MEMBER').length} members</div>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <button className="btn btn-ghost" onClick={exportToExcel}><Download size={13}/> Export Excel</button>
        </div>
      </div>

      <div className="search-row">
        <div className="search-wrap">
          <Search size={14} className="search-icon"/>
          <input className="input" style={{ paddingLeft:32 }} placeholder="Search by name" value={q} onChange={e=>setQ(e.target.value)}/>
        </div>
        {['All','Free','Member','Admin'].map(f => (
          <button key={f} className={`btn ${filter===f?'btn-primary':'btn-ghost'} btn-sm`} onClick={() => setFilter(f)}>{f}</button>
        ))}
      </div>

      <div className="card" style={{ padding:0 }}>
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>User</th><th>Email</th><th>Role</th><th>User Type</th><th>Subscription</th><th>Coins</th><th>Joined</th><th>Status</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {filtered.map(u => (
                <tr key={u.id}>
                  <td>
                    <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                      <div className="avatar">{u.name.split(' ').map(n=>n[0]).join('')}</div>
                      <span style={{ fontWeight:500 }}>{u.name}</span>
                    </div>
                  </td>
                  <td style={{ color:'var(--text2)' }}>{u.email}</td>
                  <td><span className={`badge ${roleBadge[u.role]}`}>{u.role}</span></td>
                  <td><span className={`badge ${u.plan==='MEMBER'?'badge-purple':'badge-amber'}`}>{u.plan==='MEMBER'?'Member':'Free'}</span></td>
                  <td style={{ fontSize:11, color:'var(--text3)' }}>{u.subscription}</td>
                  <td><span className="coin-pill">₵ {u.coins.toLocaleString()}</span></td>
                  <td style={{ color:'var(--text3)', fontSize:12 }}>{u.joined}</td>
                  <td><span className={`badge ${u.status==='Active'?'badge-green':'badge-red'}`}>{u.status}</span></td>
                  <td>
                    <div style={{ display:'flex', gap:5 }}>
                      <button className="btn btn-ghost btn-sm" onClick={() => open('profile', u)}><Eye size={11}/> View</button>
                      <button className="btn btn-ghost btn-sm" onClick={() => open('coins', u)}><Coins size={11}/> Coins</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <UserProfileModal open={modal==='profile'} onClose={() => setModal(null)} user={selected}/>
      <CoinsModal open={modal==='coins'} onClose={() => setModal(null)} user={selected} onUpdate={adjustCoins}/>
        </>
      )}
    </div>
  )
}
