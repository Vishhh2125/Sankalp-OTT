import { useState } from 'react'
import { Plus, Edit2, Trash2, RefreshCw, Shield, ShieldCheck } from 'lucide-react'
import Modal, { FormGroup, ModalSection } from '../components/ui/Modal.jsx'
import { Toggle, ConfirmDialog } from '../components/ui/Controls.jsx'

const SECTIONS = ['Dashboard','Users','Dramas','Categories','Banners','Membership','Coins','Notifications','Analytics','Roles','CMS']

const initAdmins = [
  { id:1, name:'Super Admin',  initials:'SA', email:'super@ott.com',   role:'admin',     status:'Active', lastActive:'Apr 3, 10:22', sections: SECTIONS },
  { id:2, name:'Content Mgr',  initials:'CM', email:'content@ott.com', role:'sub_admin', status:'Active', lastActive:'Apr 3, 09:15', sections:['Dashboard','Dramas','Categories','Banners','CMS'] },
  { id:3, name:'Support Agent', initials:'SP', email:'support@ott.com', role:'sub_admin', status:'Active', lastActive:'Apr 2, 16:40', sections:['Dashboard','Users','Coins'] },
  { id:4, name:'Analyst',      initials:'AN', email:'analyst@ott.com', role:'sub_admin', status:'Inactive', lastActive:'Mar 28, 11:00', sections:['Dashboard','Analytics','Membership'] },
]

const initActivityLog = [
  { admin:'Super Admin', action:'Deleted drama "Old Series"', module:'Dramas', date:'Apr 3, 10:20' },
  { admin:'Content Mgr', action:'Published drama "Twin Flames"', module:'Dramas', date:'Apr 3, 09:10' },
  { admin:'Super Admin', action:'Blocked user Ravi V', module:'Users', date:'Mar 21, 14:00' },
  { admin:'Support Agent', action:'Credited 200 coins to Meena S', module:'Coins', date:'Apr 2, 16:38' },
  { admin:'Super Admin', action:'Created sub-admin Analyst', module:'Roles', date:'Mar 28, 11:00' },
]

function AdminModal({ open, onClose, onSave, initial }) {
  const isEdit = !!initial?.id
  const isMainAdmin = initial?.role === 'admin'
  const [form, setForm] = useState(initial || { name:'', email:'', role:'sub_admin', status:'Active', sections:['Dashboard'] })
  const [resetPw, setResetPw] = useState(false)
  const upd = (k,v) => setForm(p=>({...p,[k]:v}))
  const toggleSection = s => {
    if (s === 'Dashboard') return // Dashboard always enabled
    setForm(p => ({
      ...p,
      sections: p.sections.includes(s) ? p.sections.filter(x=>x!==s) : [...p.sections, s]
    }))
  }
  if(!open) return null
  return (
    <Modal open={open} onClose={onClose} title={isEdit?`Edit — ${initial.name}`:'Create Sub-Admin'} width={540}
      footer={<><button className="btn btn-ghost" onClick={onClose}>Cancel</button><button className="btn btn-primary" onClick={() => { onSave({...form,id:initial?.id||Date.now(),initials:form.name.split(' ').map(n=>n[0]).join('').slice(0,2).toUpperCase(),lastActive:initial?.lastActive||'—'}); onClose() }}>{isEdit?'Save Changes':'Create Sub-Admin'}</button></>}
    >
      <ModalSection title="Identity">
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
          <FormGroup label="Full name *"><input className="input" placeholder="e.g. Sarah Lee" value={form.name} onChange={e=>upd('name',e.target.value)}/></FormGroup>
          <FormGroup label="Email *"><input className="input" type="email" placeholder="admin@ott.com" value={form.email} onChange={e=>upd('email',e.target.value)}/></FormGroup>
        </div>
        {!isEdit && (
          <FormGroup label="Temporary password">
            <input className="input" type="password" placeholder="Min 8 characters" onChange={e=>upd('password',e.target.value)}/>
            <div style={{ fontSize:11, color:'var(--text3)', marginTop:4 }}>Sub-admin will be asked to change on first login</div>
          </FormGroup>
        )}
      </ModalSection>

      <ModalSection title="Role">
        <div style={{ background:'var(--bg3)', padding:12, borderRadius:8, marginBottom:12 }}>
          <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6 }}>
            {isMainAdmin ? <ShieldCheck size={16} style={{ color:'var(--accent2)' }}/> : <Shield size={16} style={{ color:'var(--blue)' }}/>}
            <span style={{ fontWeight:600, fontSize:14 }}>{isMainAdmin ? 'Admin (full access)' : 'Sub-Admin (restricted access)'}</span>
          </div>
          <div style={{ fontSize:12, color:'var(--text3)' }}>
            {isMainAdmin
              ? 'Admin has full access to all sections. This cannot be changed.'
              : 'Sub-admins can only access sections you enable below.'}
          </div>
        </div>
        <label style={{ display:'flex', alignItems:'center', gap:10, cursor:'pointer' }}>
          <Toggle on={form.status==='Active'} onChange={v=>upd('status',v?'Active':'Inactive')}/>
          <span style={{ fontSize:13 }}>Account active</span>
        </label>
      </ModalSection>

      {!isMainAdmin && (
        <ModalSection title="Section access (select which admin sections this sub-admin can access)">
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6 }}>
            {SECTIONS.map(s => (
              <label key={s} style={{
                display:'flex', alignItems:'center', gap:10, padding:'8px 12px', borderRadius:6, cursor: s==='Dashboard'?'default':'pointer',
                background: form.sections.includes(s) ? 'var(--accent-bg)' : 'var(--bg3)',
                border: `1px solid ${form.sections.includes(s) ? 'var(--accent-border)' : 'var(--border)'}`,
                opacity: s==='Dashboard' ? 0.6 : 1,
              }}>
                <Toggle on={form.sections.includes(s)} onChange={() => toggleSection(s)} disabled={s==='Dashboard'}/>
                <span style={{ fontSize:12, fontWeight: form.sections.includes(s)?500:400, color: form.sections.includes(s)?'var(--accent2)':'var(--text2)' }}>{s}</span>
              </label>
            ))}
          </div>
          <div style={{ fontSize:11, color:'var(--text3)', marginTop:10 }}>
            Dashboard is always enabled. Selected: {form.sections.length} of {SECTIONS.length} sections.
          </div>
        </ModalSection>
      )}

      {isEdit && (
        <ModalSection title="Password">
          <button className="btn btn-ghost" onClick={() => setResetPw(true)}><RefreshCw size={12}/> Send password reset email</button>
          {resetPw && <div style={{ marginTop:8, fontSize:12, color:'var(--green)' }}>Reset email sent to {form.email}</div>}
        </ModalSection>
      )}
    </Modal>
  )
}

export default function Roles() {
  const [admins, setAdmins] = useState(initAdmins)
  const [modal, setModal] = useState(null)
  const [selected, setSelected] = useState(null)
  const [confirm, setConfirm] = useState(null)
  const [tab, setTab] = useState('admins')

  const saveAdmin = data => setAdmins(p => p.find(a=>a.id===data.id)?p.map(a=>a.id===data.id?data:a):[...p,data])
  const deleteAdmin = id => { setAdmins(p=>p.filter(a=>a.id!==id)); setConfirm(null) }

  const roleBadge = { admin:'badge-red', sub_admin:'badge-blue' }
  const roleLabel = { admin:'Admin', sub_admin:'Sub-Admin' }

  const TABS = ['admins', 'activity']

  return (
    <div className="page-enter">
      <div style={{ display:'flex', gap:0, marginBottom:18, borderBottom:'1px solid var(--border)' }}>
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding:'8px 16px', background:'none', border:'none', cursor:'pointer', fontSize:12,
            fontWeight:tab===t?600:400, color:tab===t?'var(--accent2)':'var(--text3)',
            borderBottom:tab===t?'2px solid var(--accent)':'2px solid transparent',
            textTransform:'capitalize', marginBottom:-1,
          }}>{t==='admins'?'Admin & Sub-Admin Users':'Activity Logs'}</button>
        ))}
      </div>

      {tab==='admins' && (
        <>
          <div style={{ display:'flex', justifyContent:'flex-end', marginBottom:14 }}>
            <button className="btn btn-primary" onClick={() => { setSelected(null); setModal('admin-add') }}><Plus size={14}/> Create Sub-Admin</button>
          </div>
          <div className="card" style={{ padding:0 }}>
            <div className="table-wrap">
              <table>
                <thead><tr><th>User</th><th>Email</th><th>Role</th><th>Sections access</th><th>Status</th><th>Last active</th><th>Actions</th></tr></thead>
                <tbody>
                  {admins.map(a => (
                    <tr key={a.id}>
                      <td>
                        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                          <div className="avatar" style={{ background:a.role==='admin'?'var(--accent-bg)':'var(--blue-bg)' }}>{a.initials}</div>
                          <span style={{ fontWeight:500 }}>{a.name}</span>
                        </div>
                      </td>
                      <td style={{ color:'var(--text3)', fontSize:12 }}>{a.email}</td>
                      <td>
                        <span className={`badge ${roleBadge[a.role]}`}>
                          {a.role==='admin' && <ShieldCheck size={10} style={{ marginRight:3 }}/>}
                          {roleLabel[a.role]}
                        </span>
                      </td>
                      <td>
                        {a.role==='admin' ? (
                          <span style={{ fontSize:11, color:'var(--green)' }}>All sections</span>
                        ) : (
                          <div style={{ display:'flex', flexWrap:'wrap', gap:3, maxWidth:200 }}>
                            {a.sections.slice(0,3).map(s => <span key={s} className="badge badge-blue" style={{ fontSize:9 }}>{s}</span>)}
                            {a.sections.length>3 && <span className="badge badge-blue" style={{ fontSize:9 }}>+{a.sections.length-3}</span>}
                          </div>
                        )}
                      </td>
                      <td><span className={`badge ${a.status==='Active'?'badge-green':'badge-amber'}`}>{a.status}</span></td>
                      <td style={{ color:'var(--text3)', fontSize:12 }}>{a.lastActive}</td>
                      <td>
                        <div style={{ display:'flex', gap:5 }}>
                          <button className="btn btn-ghost btn-sm" onClick={() => { setSelected(a); setModal('admin-edit') }}><Edit2 size={11}/> Edit</button>
                          {a.role!=='admin' && <button className="btn btn-danger btn-sm" onClick={() => setConfirm({id:a.id,name:a.name})}><Trash2 size={11}/></button>}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {tab==='activity' && (
        <div className="card" style={{ padding:0 }}>
          <div style={{ padding:'14px 18px', borderBottom:'1px solid var(--border)' }}>
            <div className="card-title" style={{ marginBottom:0 }}>Admin activity log</div>
          </div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Admin</th><th>Action</th><th>Module</th><th>Date</th></tr></thead>
              <tbody>
                {initActivityLog.map((l,i) => (
                  <tr key={i}>
                    <td style={{ fontWeight:500 }}>{l.admin}</td>
                    <td style={{ color:'var(--text2)' }}>{l.action}</td>
                    <td><span className="badge badge-blue" style={{ fontSize:10 }}>{l.module}</span></td>
                    <td style={{ color:'var(--text3)', fontSize:12 }}>{l.date}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <AdminModal open={modal==='admin-add'} onClose={() => setModal(null)} onSave={saveAdmin} initial={null}/>
      <AdminModal open={modal==='admin-edit'} onClose={() => setModal(null)} onSave={saveAdmin} initial={selected}/>
      <ConfirmDialog open={!!confirm} danger title="Delete Sub-Admin"
        message={`Remove "${confirm?.name}"? They will lose all access.`}
        onConfirm={() => deleteAdmin(confirm.id)} onCancel={() => setConfirm(null)}
      />
    </div>
  )
}
