import { useState } from 'react'
import { Plus, Edit2, Trash2, RefreshCw, Download } from 'lucide-react'
import Modal, { FormGroup, ModalSection } from '../components/ui/Modal.jsx'
import { Toggle, ConfirmDialog } from '../components/ui/Controls.jsx'

const initPlans = [
  { id:1, name:'Weekly',  price:49,  currency:'₹', period:'week',   active:true,  subs:3210, color:'var(--green)' },
  { id:2, name:'Monthly', price:149, currency:'₹', period:'month',  active:true,  subs:6540, color:'var(--accent2)' },
  { id:3, name:'Annual',  price:999, currency:'₹', period:'year',  active:true,  subs:2090, color:'var(--amber)' },
]

const initHistory = [
  { id:'TX001', user:'Priya Raj',  plan:'Monthly', amount:'₹149', gateway:'Nation Link', date:'Apr 1, 2025', status:'Success', txnId:'NL-2025-001' },
  { id:'TX002', user:'Arjun M',    plan:'Annual',  amount:'₹999', gateway:'Nation Link', date:'Mar 28, 2025',status:'Success', txnId:'NL-2025-002' },
  { id:'TX003', user:'Meena S',    plan:'Weekly',  amount:'₹49',  gateway:'Nation Link', date:'Apr 2, 2025', status:'Failed',  txnId:'NL-2025-003' },
  { id:'TX004', user:'Divya T',    plan:'Annual',  amount:'₹999', gateway:'Nation Link', date:'Mar 14, 2025',status:'Success', txnId:'NL-2025-004' },
  { id:'TX005', user:'Kiran P',    plan:'Monthly', amount:'₹149', gateway:'Nation Link', date:'Apr 3, 2025', status:'Success', txnId:'NL-2025-005' },
  { id:'TX006', user:'Ravi V',     plan:'Weekly',  amount:'₹49',  gateway:'Nation Link', date:'Mar 20, 2025',status:'Refunded',txnId:'NL-2025-006' },
]

function PlanModal({ open, onClose, onSave, initial }) {
  const isEdit = !!initial?.id
  const [form, setForm] = useState(initial || { name:'', price:'', currency:'₹', period:'month', active:true, color:'var(--accent2)' })
  const upd = (k,v) => setForm(p=>({...p,[k]:v}))
  if(!open) return null
  return (
    <Modal open={open} onClose={onClose} title={isEdit?`Edit Plan — ${initial.name}`:'Create Membership Plan'} width={480}
      footer={<><button className="btn btn-ghost" onClick={onClose}>Cancel</button><button className="btn btn-primary" onClick={() => { onSave({...form,id:initial?.id||Date.now(),subs:initial?.subs||0}); onClose() }}>{isEdit?'Save Changes':'Create Plan'}</button></>}
    >
      <ModalSection title="Pricing">
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:10 }}>
          <FormGroup label="Plan name *"><input className="input" placeholder="e.g. Monthly" value={form.name} onChange={e=>upd('name',e.target.value)}/></FormGroup>
          <FormGroup label="Price">
            <div style={{ display:'flex', gap:4 }}>
              <select className="select" value={form.currency} onChange={e=>upd('currency',e.target.value)} style={{ width:60 }}><option>₹</option><option>$</option></select>
              <input className="input" type="number" placeholder="149" value={form.price} onChange={e=>upd('price',+e.target.value)}/>
            </div>
          </FormGroup>
          <FormGroup label="Period">
            <select className="select" style={{ width:'100%' }} value={form.period} onChange={e=>upd('period',e.target.value)}>
              <option value="week">Week</option><option value="month">Month</option><option value="year">Year</option>
            </select>
          </FormGroup>
        </div>
      </ModalSection>

      <ModalSection title="Visibility">
        <label style={{ display:'flex', alignItems:'center', gap:10, cursor:'pointer' }}>
          <Toggle on={form.active} onChange={v=>upd('active',v)}/>
          <span style={{ fontSize:13 }}>Active (show to users)</span>
        </label>
      </ModalSection>
    </Modal>
  )
}

function RefundModal({ open, onClose, txn }) {
  const [reason, setReason] = useState('')
  if(!txn||!open) return null
  return (
    <Modal open={open} onClose={onClose} title="Process Refund" width={400}
      footer={<><button className="btn btn-ghost" onClick={onClose}>Cancel</button><button className="btn btn-danger" onClick={onClose}>Initiate Refund</button></>}
    >
      <div style={{ background:'var(--bg3)', padding:12, borderRadius:8, marginBottom:14 }}>
        <div style={{ fontSize:12, color:'var(--text3)' }}>Transaction</div>
        <div style={{ fontWeight:600 }}>{txn.txnId} · {txn.amount}</div>
        <div style={{ fontSize:12, color:'var(--text3)' }}>{txn.user} · {txn.date}</div>
      </div>
      <FormGroup label="Refund reason">
        <textarea className="input" rows={3} style={{ width:'100%', resize:'vertical' }} placeholder="Reason for refund…" value={reason} onChange={e=>setReason(e.target.value)}/>
      </FormGroup>
    </Modal>
  )
}

export default function Membership() {
  const [plans, setPlans] = useState(initPlans)
  const [history] = useState(initHistory)
  const [tab, setTab] = useState('plans')
  const [modal, setModal] = useState(null)
  const [selected, setSelected] = useState(null)
  const [confirm, setConfirm] = useState(null)

  const savePlan = data => setPlans(p => p.find(x=>x.id===data.id)?p.map(x=>x.id===data.id?data:x):[...p,data])
  const deletePlan = id => { setPlans(p=>p.filter(x=>x.id!==id)); setConfirm(null) }
  const toggleActive = id => setPlans(p=>p.map(x=>x.id===id?{...x,active:!x.active}:x))

  return (
    <div className="page-enter">
      {/* Stats */}
      <div className="metrics-grid" style={{ gridTemplateColumns:'repeat(3,1fr)', marginBottom:16 }}>
        {[
          { label:'Total Subscribers', value:plans.reduce((a,p)=>a+p.subs,0).toLocaleString(), sub:'across all plans' },
          { label:'Monthly Revenue', value:'₹4,21,380', sub:'this month' },
          { label:'Active Plans', value:plans.filter(p=>p.active).length, sub:`of ${plans.length} plans` },
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
        {['plans','history','gateway'].map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding:'8px 16px', background:'none', border:'none', cursor:'pointer',
            fontSize:12, fontWeight:tab===t?600:400,
            color:tab===t?'var(--accent2)':'var(--text3)',
            borderBottom:tab===t?'2px solid var(--accent)':'2px solid transparent',
            textTransform:'capitalize', marginBottom:-1,
          }}>{t==='history'?'Subscription history':t==='gateway'?'Gateway logs':t}</button>
        ))}
      </div>

      {/* Plans tab */}
      {tab==='plans' && (
        <>
          <div style={{ display:'flex', justifyContent:'flex-end', marginBottom:14 }}>
            <button className="btn btn-primary" onClick={() => { setSelected(null); setModal('plan-add') }}><Plus size={14}/> Create plan</button>
          </div>
          <div className="grid3">
            {plans.map(p => (
              <div key={p.id} className="plan-card">
                <div className="plan-name">{p.name} plan</div>
                <div className="plan-price">{p.currency}{p.price}<span>/{p.period}</span></div>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
                  <span className={`badge ${p.active?'badge-green':'badge-red'}`}>{p.active?'Active':'Inactive'}</span>
                  <Toggle on={p.active} onChange={() => toggleActive(p.id)}/>
                </div>
                <div style={{ fontSize:12, color:'var(--text3)', fontFamily:'var(--mono)', marginBottom:12 }}>{p.subs.toLocaleString()} subscribers</div>
                <div style={{ display:'flex', gap:6 }}>
                  <button className="btn btn-ghost btn-sm" style={{ flex:1 }} onClick={() => { setSelected(p); setModal('plan-edit') }}><Edit2 size={11}/> Edit</button>
                  <button className="btn btn-danger btn-sm" onClick={() => setConfirm({id:p.id,name:p.name})}><Trash2 size={11}/></button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* History tab */}
      {tab==='history' && (
        <div className="card" style={{ padding:0 }}>
          <div style={{ padding:'12px 18px', display:'flex', justifyContent:'space-between', borderBottom:'1px solid var(--border)' }}>
            <div className="card-title" style={{ marginBottom:0 }}>All subscription purchases</div>
            <button className="btn btn-ghost btn-sm"><Download size={12}/> Export CSV</button>
          </div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Transaction ID</th><th>User</th><th>Plan</th><th>Amount</th><th>Gateway</th><th>Date</th><th>Status</th><th>Actions</th></tr></thead>
              <tbody>
                {history.map(h => (
                  <tr key={h.id}>
                    <td style={{ fontFamily:'var(--mono)', fontSize:11, color:'var(--text3)' }}>{h.txnId}</td>
                    <td style={{ fontWeight:500 }}>{h.user}</td>
                    <td><span className={`badge ${h.plan==='Annual'?'badge-blue':h.plan==='Monthly'?'badge-purple':'badge-green'}`}>{h.plan}</span></td>
                    <td style={{ fontFamily:'var(--mono)' }}>{h.amount}</td>
                    <td style={{ color:'var(--text3)' }}>{h.gateway}</td>
                    <td style={{ color:'var(--text3)', fontSize:12 }}>{h.date}</td>
                    <td><span className={`badge ${h.status==='Success'?'badge-green':h.status==='Refunded'?'badge-amber':'badge-red'}`}>{h.status}</span></td>
                    <td>
                      <div style={{ display:'flex', gap:5 }}>
                        {h.status==='Failed' && <button className="btn btn-ghost btn-sm"><RefreshCw size={11}/> Retry</button>}
                        {h.status==='Success' && <button className="btn btn-ghost btn-sm" onClick={() => { setSelected(h); setModal('refund') }}>Refund</button>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Gateway logs tab */}
      {tab==='gateway' && (
        <div className="card">
          <div className="card-title">Nation Link payment gateway logs</div>
          {initHistory.map(h => (
            <div key={h.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'10px 0', borderBottom:'1px solid var(--border)' }}>
              <div>
                <div style={{ fontFamily:'var(--mono)', fontSize:11, color:'var(--accent2)' }}>{h.txnId}</div>
                <div style={{ fontSize:12, color:'var(--text2)', marginTop:2 }}>{h.user} · {h.plan} · {h.gateway}</div>
              </div>
              <div style={{ textAlign:'right' }}>
                <div style={{ fontFamily:'var(--mono)', fontWeight:500 }}>{h.amount}</div>
                <span className={`badge ${h.status==='Success'?'badge-green':h.status==='Refunded'?'badge-amber':'badge-red'}`} style={{ fontSize:10 }}>{h.status}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      <PlanModal open={modal==='plan-add'} onClose={() => setModal(null)} onSave={savePlan} initial={null}/>
      <PlanModal open={modal==='plan-edit'} onClose={() => setModal(null)} onSave={savePlan} initial={selected}/>
      <RefundModal open={modal==='refund'} onClose={() => setModal(null)} txn={selected}/>
      <ConfirmDialog open={!!confirm} danger title="Delete Plan"
        message={`Delete plan "${confirm?.name}"? All ${plans.find(p=>p.id===confirm?.id)?.subs||0} subscribers will be affected.`}
        onConfirm={() => deletePlan(confirm.id)} onCancel={() => setConfirm(null)}
      />
    </div>
  )
}
