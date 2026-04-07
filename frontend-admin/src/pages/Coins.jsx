import { useState } from 'react'
import { Search, Download, RefreshCw, Plus, Minus } from 'lucide-react'
import Modal, { FormGroup, ModalSection } from '../components/ui/Modal.jsx'

const initTxns = [
  { id:'C001', user:'Priya Raj',  type:'Top-up',       amount:500,  dir:'+', date:'Apr 3, 12:10', method:'Purchase' },
  { id:'C002', user:'Arjun M',    type:'Unlock ep 12', amount:20,   dir:'-', date:'Apr 3, 11:55', method:'Spend' },
  { id:'C003', user:'System',     type:'Daily gift',   amount:50,   dir:'+', date:'Apr 3, 09:00', method:'Daily Checkin' },
  { id:'C004', user:'Ravi V',     type:'Refund',       amount:200,  dir:'+', date:'Apr 2, 18:30', method:'Refund' },
  { id:'C005', user:'Sneha K',    type:'Top-up',       amount:100,  dir:'+', date:'Apr 2, 15:22', method:'Purchase' },
  
  { id:'C007', user:'Kiran P',    type:'Unlock ep 3',  amount:20,   dir:'-', date:'Apr 1, 21:00', method:'Spend' },
  { id:'C008', user:'Meena S',    type:'Daily gift',   amount:10,   dir:'+', date:'Apr 1, 09:00', method:'Daily Checkin' },
]

const METHODS = ['All', 'Purchase', 'Daily Checkin', 'Spend', 'Manual']

function ManualAdjustModal({ open, onClose, onSave }) {
  const [form, setForm] = useState({ user:'', amount:'', type:'credit', reason:'' })
  const upd = (k,v) => setForm(p=>({...p,[k]:v}))
  if(!open) return null
  return (
    <Modal open={open} onClose={onClose} title="Manual Coin Adjustment" width={440}
      footer={<><button className="btn btn-ghost" onClick={onClose}>Cancel</button><button className={`btn ${form.type==='credit'?'btn-primary':'btn-danger'}`} onClick={() => { onSave(form); onClose(); setForm({ user:'', amount:'', type:'credit', reason:'' }) }}>{form.type==='credit'?'Credit Coins':'Debit Coins'}</button></>}
    >
      <FormGroup label="User (name or ID)">
        <input className="input" style={{ width:'100%' }} placeholder="e.g. Priya Raj or U001" value={form.user} onChange={e=>upd('user',e.target.value)}/>
      </FormGroup>
      <FormGroup label="Operation">
        <div style={{ display:'flex', gap:8 }}>
          <button className={`btn ${form.type==='credit'?'btn-primary':'btn-ghost'}`} style={{ flex:1 }} onClick={() => upd('type','credit')}><Plus size={13}/> Credit</button>
          <button className={`btn ${form.type==='debit'?'btn-danger':'btn-ghost'}`} style={{ flex:1 }} onClick={() => upd('type','debit')}><Minus size={13}/> Debit</button>
        </div>
      </FormGroup>
      <FormGroup label="Amount (₵)">
        <input className="input" style={{ width:'100%' }} type="number" min={1} placeholder="Enter coin amount" value={form.amount} onChange={e=>upd('amount',e.target.value)}/>
      </FormGroup>
      <FormGroup label="Reason / note">
        <input className="input" style={{ width:'100%' }} placeholder="e.g. Compensation for service issue" value={form.reason} onChange={e=>upd('reason',e.target.value)}/>
      </FormGroup>
    </Modal>
  )
}

function RefundModal({ open, onClose }) {
  if(!open) return null
  return (
    <Modal open={open} onClose={onClose} title="Refund Coin Purchase" width={400}
      footer={<><button className="btn btn-ghost" onClick={onClose}>Cancel</button><button className="btn btn-danger" onClick={onClose}>Process Refund</button></>}
    >
      <FormGroup label="Transaction ID or user">
        <input className="input" style={{ width:'100%' }} placeholder="e.g. C001 or Priya Raj"/>
      </FormGroup>
      <FormGroup label="Reason">
        <textarea className="input" rows={2} style={{ width:'100%', resize:'vertical' }} placeholder="Reason for coin refund…"/>
      </FormGroup>
    </Modal>
  )
}

export default function Coins() {
  const [rules, setRules] = useState({ day1:10, day2:10, day3:20, day4:20, day5:25, day6:30, day7:50, defaultCoinCost:30 })
  const [txns, setTxns] = useState(initTxns)
  const [filter, setFilter] = useState('All')
  const [q, setQ] = useState('')
  const [modal, setModal] = useState(null)

  const filteredTxns = txns.filter(t => {
    const meth = filter==='All' || t.method===filter
    const match = t.user.toLowerCase().includes(q.toLowerCase()) || t.type.toLowerCase().includes(q.toLowerCase())
    return meth && match
  })

  const handleManual = form => {
    setTxns(p => [{
      id:`C${Date.now()}`, user:form.user, type:`Manual ${form.type}`, method:'Manual',
      amount:+form.amount, dir:form.type==='credit'?'+':'-', date:'Just now',
    }, ...p])
  }

  return (
    <div className="page-enter">
      {/* Metrics */}
      <div className="metrics-grid" style={{ gridTemplateColumns:'repeat(4,1fr)', marginBottom:20 }}>
        {[
          { label:'Total in circulation', value:'8.4M', sub:'across all wallets', color:'var(--amber)' },
          { label:'Purchased today', value:'42,300', sub:'₹12,600 revenue', color:'var(--green)' },
          { label:'Content unlocked', value:'4,210', sub:'episodes today', color:'var(--accent2)' },
          { label:'Daily check-ins', value:'2,840', sub:'check-ins today', color:'var(--blue)' },
        ].map(m => (
          <div className="metric-card" key={m.label}>
            <div className="metric-label">{m.label}</div>
            <div className="metric-value" style={{ fontSize:20, color:m.color }}>{m.value}</div>
            <div className="metric-sub">{m.sub}</div>
          </div>
        ))}
      </div>

      <div className="grid2" style={{ marginBottom:20 }}>
        {/* Coin rules */}
        <div className="card">
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
            <div className="card-title" style={{ marginBottom:0 }}>Coin rule configuration</div>
          </div>
          {[
            { label:'Day 1 check-in', key:'day1', hint:'Coins on day 1 of streak' },
            { label:'Day 2 check-in', key:'day2', hint:'Coins on day 2' },
            { label:'Day 3 check-in', key:'day3', hint:'Coins on day 3' },
            { label:'Day 4 check-in', key:'day4', hint:'Coins on day 4' },
            { label:'Day 5 check-in', key:'day5', hint:'Coins on day 5' },
            { label:'Day 6 check-in', key:'day6', hint:'Coins on day 6' },
            { label:'Day 7 check-in (bonus)', key:'day7', hint:'Coins on day 7 (streak reset after)' },
            { label:'Default episode coin cost', key:'defaultCoinCost', hint:'Default cost to unlock a paid episode' },
          ].map(r => (
            <div key={r.key} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'12px 0', borderBottom:'1px solid var(--border)' }}>
              <div>
                <div style={{ fontSize:13, color:'var(--text)' }}>{r.label}</div>
                <div style={{ fontSize:11, color:'var(--text3)' }}>{r.hint}</div>
              </div>
              <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                <input type="number" value={rules[r.key]}
                  onChange={e=>setRules(p=>({...p,[r.key]:+e.target.value}))}
                  className="input" style={{ width:80, textAlign:'right', padding:'4px 8px', fontFamily:'var(--mono)' }}/>
                <span style={{ fontSize:11, color:'var(--text3)' }}>₵</span>
              </div>
            </div>
          ))}
          <button className="btn btn-primary" style={{ marginTop:14 }}>Save rules</button>
        </div>

        {/* Circulation */}
        <div className="card">
          <div className="card-title">Coins in circulation</div>
          {[
            { label:'Issued (daily gift)', val:'3,82,000', color:'var(--green)' },
            { label:'Purchased',           val:'1,24,500', color:'var(--accent2)' },
            { label:'Spent (unlocks)',     val:'2,10,400', color:'var(--red)' },
        
            { label:'Balance in wallets',  val:'2,96,100', color:'var(--amber)' },
          ].map(r => (
            <div className="stat-row" key={r.label}>
              <span className="stat-lbl">{r.label}</span>
              <span className="coin-pill" style={{ color:r.color }}>₵ {r.val}</span>
            </div>
          ))}
          <div style={{ display:'flex', gap:8, marginTop:16 }}>
            <button className="btn btn-primary btn-sm" style={{ flex:1 }} onClick={() => setModal('manual')}><Plus size={12}/> Manual credit/debit</button>
            <button className="btn btn-ghost btn-sm" style={{ flex:1 }} onClick={() => setModal('refund')}><RefreshCw size={12}/> Refund purchase</button>
          </div>
        </div>
      </div>

      {/* Transactions */}
      <div className="card" style={{ padding:0 }}>
        <div style={{ padding:'14px 18px', display:'flex', justifyContent:'space-between', alignItems:'center', borderBottom:'1px solid var(--border)' }}>
          <div className="card-title" style={{ marginBottom:0 }}>All coin transactions</div>
          <div style={{ display:'flex', gap:8 }}>
            <div className="search-wrap" style={{ width:200 }}>
              <Search size={13} className="search-icon"/>
              <input className="input" style={{ paddingLeft:28, padding:'5px 8px 5px 28px' }} placeholder="Search…" value={q} onChange={e=>setQ(e.target.value)}/>
            </div>
            <select className="select" value={filter} onChange={e=>setFilter(e.target.value)}>
              {METHODS.map(m=><option key={m}>{m}</option>)}
            </select>
            <button className="btn btn-ghost btn-sm"><Download size={12}/> Export</button>
          </div>
        </div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>ID</th><th>User</th><th>Type</th><th>Method</th><th>Amount</th><th>Date</th></tr></thead>
            <tbody>
              {filteredTxns.map(t => (
                <tr key={t.id}>
                  <td style={{ fontFamily:'var(--mono)', fontSize:11, color:'var(--text3)' }}>{t.id}</td>
                  <td style={{ fontWeight:500 }}>{t.user}</td>
                  <td style={{ color:'var(--text2)' }}>{t.type}</td>
                  <td><span className="badge badge-blue" style={{ fontSize:10 }}>{t.method}</span></td>
                  <td style={{ fontFamily:'var(--mono)', fontSize:13, color:t.dir==='+'?'var(--green)':'var(--red)' }}>
                    {t.dir}₵ {t.amount.toLocaleString()}
                  </td>
                  <td style={{ color:'var(--text3)', fontSize:12 }}>{t.date}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <ManualAdjustModal open={modal==='manual'} onClose={() => setModal(null)} onSave={handleManual}/>
      <RefundModal open={modal==='refund'} onClose={() => setModal(null)}/>
    </div>
  )
}
