import { useState } from 'react'
import { Search, Eye, Coins, Ban, UserCheck, Download } from 'lucide-react'
import Modal, { ModalSection, FormGroup } from '../components/ui/Modal.jsx'
import { ConfirmDialog } from '../components/ui/Controls.jsx'

const initUsers = [
  { id:'U001', name:'Priya Raj',  email:'priya@gmail.com',   mobile:'+91 98765 43210', role:'member', coins:420,  joined:'Jan 12, 2025', status:'Active',
    watchHistory:[{drama:'Secret Marriage',ep:4,date:'Apr 3'},{drama:"CEO's Revenge",ep:2,date:'Apr 2'}],
    activity:[{action:'Login',device:'Android',date:'Apr 3, 10:22'},{action:'Top-up ₵500',date:'Apr 3, 12:10'},{action:'Unlock Episode',date:'Apr 3, 12:11'}],
    referrals:3, coinHistory:[{type:'Top-up',amount:'+₵500',date:'Apr 3'},{type:'Daily gift',amount:'+₵50',date:'Apr 3'},{type:'Unlock',amount:'-₵20',date:'Apr 3'}],
    subExpiry:'May 12, 2025',
  },
  { id:'U002', name:'Arjun M',    email:'arjun@outlook.com', mobile:'+91 87654 32109', role:'member',  coins:1280, joined:'Nov 3, 2024',  status:'Active',
    watchHistory:[{drama:'Twin Flames',ep:8,date:'Apr 2'},{drama:'Lost in Seoul',ep:1,date:'Apr 1'}],
    activity:[{action:'Login',device:'iOS',date:'Apr 2, 09:15'}],
    referrals:7, coinHistory:[{type:'Referral bonus',amount:'+₵100',date:'Apr 1'},{type:'Unlock',amount:'-₵20',date:'Apr 2'}],
    subExpiry:'Nov 3, 2025',
  },
  { id:'U003', name:'Sneha K',    email:'sneha@yahoo.com',   mobile:'+91 76543 21098', role:'free',    coins:50,   joined:'Mar 5, 2025',  status:'Active',
    watchHistory:[{drama:'Campus Crush',ep:1,date:'Apr 3'}],
    activity:[{action:'Login',device:'Web',date:'Apr 3, 14:00'}],
    referrals:0, coinHistory:[{type:'Daily gift',amount:'+₵10',date:'Apr 3'}],
    subExpiry:'—',
  },
  { id:'U004', name:'Ravi V',     email:'ravi@hotmail.com',  mobile:'+91 65432 10987', role:'member',  coins:80,   joined:'Feb 18, 2025', status:'Blocked',
    watchHistory:[],
    activity:[{action:'Login failed',device:'Android',date:'Mar 20, 08:00'},{action:'Blocked by admin',date:'Mar 21'}],
    referrals:1, coinHistory:[],
    subExpiry:'Expired',
  },
  { id:'U005', name:'Meena S',    email:'meena@gmail.com',   mobile:'+91 54321 09876', role:'member', coins:210,  joined:'Dec 22, 2024', status:'Active',
    watchHistory:[{drama:'Secret Marriage',ep:1,date:'Apr 2'}],
    activity:[{action:'Login',device:'iOS',date:'Apr 2, 20:30'}],
    referrals:2, coinHistory:[{type:'Top-up',amount:'+₵100',date:'Apr 1'}],
    subExpiry:'Jan 22, 2025',
  },
  { id:'U006', name:'Kiran P',    email:'kiran@outlook.com', mobile:'+91 43210 98765', role:'free',    coins:10,   joined:'Apr 1, 2025',  status:'Active',
    watchHistory:[], activity:[], referrals:0, coinHistory:[{type:'Daily gift',amount:'+₵10',date:'Apr 3'}], subExpiry:'—',
  },
  { id:'U007', name:'Divya T',    email:'divya@gmail.com',   mobile:'+91 32109 87654', role:'member',  coins:2100, joined:'Oct 14, 2024', status:'Active',
    watchHistory:[{drama:"CEO's Revenge",ep:2,date:'Apr 3'},{drama:'Twin Flames',ep:5,date:'Apr 3'}],
    activity:[{action:'Login',device:'Android',date:'Apr 3, 08:00'},{action:'Top-up ₵2000',date:'Apr 3, 09:00'}],
    referrals:12, coinHistory:[{type:'Top-up',amount:'+₵2000',date:'Apr 3'},{type:'Unlock',amount:'-₵20',date:'Apr 3'}],
    subExpiry:'Oct 14, 2025',
  },
  { id:'U008', name:'Suresh R',   email:'suresh@yahoo.com',  mobile:'+91 21098 76543', role:'member',  coins:30,   joined:'Mar 28, 2025', status:'Blocked',
    watchHistory:[], activity:[{action:'Blocked',date:'Mar 29'}], referrals:0, coinHistory:[], subExpiry:'Expired',
  },
]

const roleBadge = { free:'badge-amber', member:'badge-purple', admin:'badge-red', sub_admin:'badge-blue' }

function UserProfileModal({ open, onClose, user }) {
  const [tab, setTab] = useState('profile')
  if (!user || !open) return null
  const tabs = ['profile','subscription','watch','wallet','activity']
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
              <div style={{ fontWeight:600, fontSize:16 }}>{user.name}</div>
              <div style={{ color:'var(--text3)', fontSize:13 }}>{user.email}</div>
              <div style={{ color:'var(--text3)', fontSize:12 }}>{user.mobile}</div>
            </div>
            <div style={{ marginLeft:'auto' }}>
              <span className={`badge ${user.status==='Active'?'badge-green':'badge-red'}`}>{user.status}</span>
            </div>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
            {[
              { label:'User ID', value:user.id },
              { label:'Joined', value:user.joined },
              { label:'Role', value:user.role },
              { label:'Coin balance', value:`₵ ${user.coins.toLocaleString()}` },
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
          <div style={{ background:'var(--bg3)', padding:16, borderRadius:8, marginBottom:16 }}>
            <div style={{ fontSize:11, color:'var(--text3)', marginBottom:4 }}>CURRENT PLAN</div>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <span className={`badge ${roleBadge[user.role]}`} style={{ fontSize:14, padding:'4px 12px' }}>{user.plan}</span>
              <div style={{ textAlign:'right' }}>
                <div style={{ fontSize:12, color:'var(--text3)' }}>Expires</div>
                <div style={{ fontWeight:500 }}>{user.subExpiry}</div>
              </div>
            </div>
          </div>
          <div style={{ color:'var(--text3)', fontSize:13, textAlign:'center', padding:'20px 0' }}>Full subscription history coming soon</div>
        </div>
      )}

      {tab==='watch' && (
        <div>
          {user.watchHistory.length===0 && <div style={{ color:'var(--text3)', fontSize:13, textAlign:'center', padding:'30px 0' }}>No watch history</div>}
          {user.watchHistory.map((w,i) => (
            <div key={i} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'10px 0', borderBottom:'1px solid var(--border)' }}>
              <div>
                <div style={{ fontWeight:500, fontSize:13 }}>{w.drama}</div>
                <div style={{ fontSize:11, color:'var(--text3)' }}>Episode {w.ep}</div>
              </div>
              <span style={{ fontSize:12, color:'var(--text3)' }}>{w.date}</span>
            </div>
          ))}
        </div>
      )}

      {tab==='wallet' && (
        <div>
          <div style={{ background:'var(--bg3)', padding:14, borderRadius:8, marginBottom:14, textAlign:'center' }}>
            <div style={{ fontSize:11, color:'var(--text3)', marginBottom:4 }}>CURRENT BALANCE</div>
            <div style={{ fontSize:28, fontWeight:700, fontFamily:'var(--mono)', color:'var(--amber)' }}>₵ {user.coins.toLocaleString()}</div>
          </div>
          {user.coinHistory.map((c,i) => (
            <div key={i} style={{ display:'flex', justifyContent:'space-between', padding:'9px 0', borderBottom:'1px solid var(--border)' }}>
              <div style={{ fontSize:13 }}>{c.type}</div>
              <div style={{ display:'flex', gap:12, alignItems:'center' }}>
                <span style={{ fontSize:12, color:'var(--text3)' }}>{c.date}</span>
                <span style={{ fontFamily:'var(--mono)', fontSize:13, color:c.amount.startsWith('+')?'var(--green)':'var(--red)' }}>{c.amount}</span>
              </div>
            </div>
          ))}
        </div>
      )}



      {tab==='activity' && (
        <div>
          {user.activity.length===0 && <div style={{ color:'var(--text3)', fontSize:13, textAlign:'center', padding:'30px 0' }}>No activity logged</div>}
          {user.activity.map((a,i) => (
            <div key={i} style={{ display:'flex', justifyContent:'space-between', padding:'9px 0', borderBottom:'1px solid var(--border)' }}>
              <div style={{ fontSize:13 }}>{a.action}{a.device ? ` (${a.device})` : ''}</div>
              <span style={{ fontSize:12, color:'var(--text3)' }}>{a.date}</span>
            </div>
          ))}
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
  const [users, setUsers] = useState(initUsers)
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState('All')
  const [modal, setModal] = useState(null)
  const [selected, setSelected] = useState(null)

  const filtered = users.filter(u => {
    const m = u.name.toLowerCase().includes(q.toLowerCase()) || u.email.toLowerCase().includes(q.toLowerCase()) || u.id.toLowerCase().includes(q.toLowerCase()) || u.mobile.includes(q)
    const f = filter==='All' || (filter==='Blocked'?u.status==='Blocked':filter==='Member'?u.role==='member':filter==='Free'?u.role==='free':filter==='Admin'?(u.role==='admin'||u.role==='sub_admin'):true)
    return m && f
  })

  const toggleBlock = id => setUsers(p => p.map(u => u.id===id ? {...u, status:u.status==='Blocked'?'Active':'Blocked'} : u))
  const adjustCoins = (id, delta) => setUsers(p => p.map(u => u.id===id ? {...u, coins:Math.max(0,u.coins+delta)} : u))

  const open = (m, u=null) => { setModal(m); setSelected(u) }

  return (
    <div className="page-enter">
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
        <div>
          <div style={{ fontWeight:600 }}>{users.length} registered users</div>
          <div style={{ fontSize:12, color:'var(--text3)' }}>{users.filter(u=>u.status==='Active').length} active · {users.filter(u=>u.role==='member').length} members</div>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <button className="btn btn-ghost"><Download size={13}/> Export CSV</button>
          <button className="btn btn-primary">+ Invite user</button>
        </div>
      </div>

      <div className="search-row">
        <div className="search-wrap">
          <Search size={14} className="search-icon"/>
          <input className="input" style={{ paddingLeft:32 }} placeholder="Search by name, email, ID, mobile…" value={q} onChange={e=>setQ(e.target.value)}/>
        </div>
        {['All','Free','Member','Admin','Blocked'].map(f => (
          <button key={f} className={`btn ${filter===f?'btn-primary':'btn-ghost'} btn-sm`} onClick={() => setFilter(f)}>{f}</button>
        ))}
      </div>

      <div className="card" style={{ padding:0 }}>
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>User</th><th>Email</th><th>ID</th><th>Role</th><th>Subscription</th><th>Coins</th><th>Joined</th><th>Status</th><th>Actions</th></tr>
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
                  <td><span style={{ fontFamily:'var(--mono)', fontSize:11, color:'var(--text3)' }}>{u.id}</span></td>
                  <td><span className={`badge ${roleBadge[u.role]}`}>{u.role}</span></td>
                  <td style={{ fontSize:11, color:'var(--text3)' }}>{u.subExpiry}</td>
                  <td><span className="coin-pill">₵ {u.coins.toLocaleString()}</span></td>
                  <td style={{ color:'var(--text3)', fontSize:12 }}>{u.joined}</td>
                  <td><span className={`badge ${u.status==='Active'?'badge-green':'badge-red'}`}>{u.status}</span></td>
                  <td>
                    <div style={{ display:'flex', gap:5 }}>
                      <button className="btn btn-ghost btn-sm" onClick={() => open('profile', u)}><Eye size={11}/> View</button>
                      <button className="btn btn-ghost btn-sm" onClick={() => open('coins', u)}><Coins size={11}/> Coins</button>
                      <button className={`btn btn-sm ${u.status==='Blocked'?'btn-primary':'btn-danger'}`} onClick={() => toggleBlock(u.id)}>
                        {u.status==='Blocked'?<><UserCheck size={11}/> Unblock</>:<><Ban size={11}/> Block</>}
                      </button>
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
    </div>
  )
}
