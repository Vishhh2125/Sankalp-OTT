import { useState, useEffect } from 'react'
import { Search, Download, RefreshCw, Plus, Minus, AlertCircle, Loader } from 'lucide-react'
import Modal, { FormGroup, ModalSection } from '../components/ui/Modal.jsx'
import { coinsApi, usersApi } from '../services/api.js'

const METHODS = ['All', 'Purchase', 'Daily Checkin', 'Spend', 'Manual', 'Refund']

function ManualAdjustModal({ open, onClose, onSave }) {
  const [form, setForm] = useState({ user:'', amount:'', type:'credit', reason:'' })
  const [loading, setLoading] = useState(false)
  const upd = (k,v) => setForm(p=>({...p,[k]:v}))
  
  if(!open) return null
  
  const handle = async () => {
    if (!form.user || !form.amount) return
    setLoading(true)
    try {
      await onSave(form)
      onClose()
      setForm({ user:'', amount:'', type:'credit', reason:'' })
    } finally {
      setLoading(false)
    }
  }
  
  return (
    <Modal open={open} onClose={onClose} title="Manual Coin Adjustment" width={440}
      footer={<><button className="btn btn-ghost" onClick={onClose}>Cancel</button><button className={`btn ${form.type==='credit'?'btn-primary':'btn-danger'}`} disabled={loading} onClick={handle}>{loading?<>Saving...</>: form.type==='credit'?'Credit Coins':'Debit Coins'}</button></>}
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
  const [metrics, setMetrics] = useState({
    totalInCirculation: '0',
    purchasedToday: '0',
    contentUnlockedToday: '0',
    dailyCheckinsToday: '0',
    issuedTotal: '0',
    purchasedTotal: '0',
    spentTotal: '0',
    balanceInWallets: '0',
  })
  const [txns, setTxns] = useState([])
  const [filter, setFilter] = useState('All')
  const [q, setQ] = useState('')
  const [modal, setModal] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)

  // Fetch all data on mount
  useEffect(() => {
    loadData()
  }, [filter])

  const loadData = async () => {
    setLoading(true)
    setError(null)
    try {
      // Fetch rules
      const rulesRes = await coinsApi.getRules()
      if (rulesRes.data?.data?.rules) {
        setRules(rulesRes.data.data.rules)
      }

      // Fetch metrics
      const metricsRes = await coinsApi.getMetrics()
      if (metricsRes.data?.data?.metrics) {
        setMetrics(metricsRes.data.data.metrics)
      }

      // Fetch transactions
      const txnParams = {
        method: filter,
        search: q,
        limit: 100,
        offset: 0,
      }
      const txnRes = await coinsApi.getTransactions(txnParams)
      if (txnRes.data?.data?.transactions) {
        setTxns(txnRes.data.data.transactions)
      }
    } catch (err) {
      console.error('Error loading data:', err)
      setError(err.response?.data?.message || 'Failed to load data')
    } finally {
      setLoading(false)
    }
  }

  const handleSaveRules = async () => {
    setSaving(true)
    try {
      await coinsApi.saveRules(rules)
      // Show success (you can add a toast notification here)
      alert('Coin rules saved successfully!')
    } catch (err) {
      console.error('Error saving rules:', err)
      alert('Failed to save rules: ' + (err.response?.data?.message || err.message))
    } finally {
      setSaving(false)
    }
  }

  const handleManual = async (form) => {
    // Find user by name or ID
    try {
      const usersRes = await usersApi.getAll()
      const user = usersRes.data?.data?.users?.find(u => 
        u.name.toLowerCase().includes(form.user.toLowerCase()) || 
        u.id.toLowerCase().includes(form.user.toLowerCase())
      )
      
      if (!user) {
        alert('User not found')
        return
      }

      const amount = form.type === 'credit' ? +form.amount : -+form.amount
      await usersApi.adjustCoins(user.id, amount, form.reason || 'Manual adjustment')
      
      // Reload data
      loadData()
    } catch (err) {
      console.error('Error adjusting coins:', err)
      alert('Failed to adjust coins: ' + (err.response?.data?.message || err.message))
    }
  }

  const filteredTxns = txns.filter(t => {
    const meth = filter==='All' || t.method===filter
    const match = t.user.toLowerCase().includes(q.toLowerCase()) || t.type.toLowerCase().includes(q.toLowerCase())
    return meth && match
  })

  return (
    <div className="page-enter">
      {error && (
        <div style={{ background:'var(--red)', color:'white', padding:12, borderRadius:8, marginBottom:16, display:'flex', alignItems:'center', gap:8 }}>
          <AlertCircle size={16}/>
          {error}
        </div>
      )}

      {/* Metrics */}
      <div className="metrics-grid" style={{ gridTemplateColumns:'repeat(4,1fr)', marginBottom:20 }}>
        {[
          { label:'Total in circulation', value:metrics.totalInCirculation, sub:'across all wallets', color:'var(--amber)' },
          { label:'Purchased today', value:metrics.purchasedToday, sub:'today', color:'var(--green)' },
          { label:'Content unlocked', value:metrics.contentUnlockedToday, sub:'episodes today', color:'var(--accent2)' },
          { label:'Daily check-ins', value:metrics.dailyCheckinsToday, sub:'check-ins today', color:'var(--blue)' },
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
          <button className="btn btn-primary" style={{ marginTop:14 }} disabled={saving} onClick={handleSaveRules}>
            {saving ? <>Saving...</> : 'Save rules'}
          </button>
        </div>

        {/* Circulation */}
        <div className="card">
          <div className="card-title">Coins in circulation</div>
          {[
            { label:'Issued (daily gift)', val:metrics.issuedTotal, color:'var(--green)' },
            { label:'Purchased',           val:metrics.purchasedTotal, color:'var(--accent2)' },
            { label:'Spent (unlocks)',     val:metrics.spentTotal, color:'var(--red)' },
            { label:'Balance in wallets',  val:metrics.balanceInWallets, color:'var(--amber)' },
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
          <div style={{ display:'flex', gap:8, alignItems:'center' }}>
            <div className="search-wrap" style={{ width:200 }}>
              <Search size={13} className="search-icon"/>
              <input className="input" style={{ paddingLeft:28, padding:'5px 8px 5px 28px' }} placeholder="Search…" value={q} onChange={e=>setQ(e.target.value)}/>
            </div>
            <select className="select" value={filter} onChange={e=>setFilter(e.target.value)}>
              {METHODS.map(m=><option key={m}>{m}</option>)}
            </select>
            <button className="btn btn-ghost btn-sm" onClick={loadData}><RefreshCw size={12}/></button>
            <button className="btn btn-ghost btn-sm"><Download size={12}/> Export</button>
          </div>
        </div>
        <div className="table-wrap">
          {loading ? (
            <div style={{ padding:'40px', textAlign:'center', color:'var(--text3)' }}>
              <Loader size={24} className="spinner" style={{ marginBottom:12 }} />
              Loading transactions...
            </div>
          ) : filteredTxns.length === 0 ? (
            <div style={{ padding:'40px', textAlign:'center', color:'var(--text3)' }}>
              No transactions found
            </div>
          ) : (
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
                      {t.dir}₵ {Math.abs(t.amount).toLocaleString()}
                    </td>
                    <td style={{ color:'var(--text3)', fontSize:12 }}>{t.date}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <ManualAdjustModal open={modal==='manual'} onClose={() => setModal(null)} onSave={handleManual}/>
      <RefundModal open={modal==='refund'} onClose={() => setModal(null)}/>
    </div>
  )
}
