import { useState, useEffect } from 'react'
import { Plus, Edit2, Trash2, RefreshCw } from 'lucide-react'
import Modal, { FormGroup, ModalSection } from '../components/ui/Modal.jsx'
import { Toggle, ConfirmDialog } from '../components/ui/Controls.jsx'
import { topupApi } from '../services/api.js'

function TopUpPlanModal({ open, onClose, onSave, initial, loading }) {
  const isEdit = !!initial?.id
  const [form, setForm] = useState(initial || { name:'', price:'', coins_amount:'', currency:'INR', isActive:true })
  const upd = (k,v) => setForm(p=>({...p,[k]:v}))
  
  useEffect(() => {
    if (initial) {
      setForm({
        name: initial.name || '',
        price: initial.price || '',
        coins_amount: initial.coins_amount || '',
        currency: initial.currency || 'INR',
        isActive: initial.isActive !== undefined ? initial.isActive : true,
      })
    }
  }, [initial])

  if(!open) return null
  
  return (
    <Modal open={open} onClose={onClose} title={isEdit?`Edit Top-Up — ${initial.name}`:'Create Top-Up Plan'} width={480}
      footer={<><button className="btn btn-ghost" onClick={onClose} disabled={loading}>Cancel</button><button className="btn btn-primary" onClick={() => { onSave(form); }} disabled={loading}>{loading?'...':isEdit?'Save Changes':'Create Plan'}</button></>}
    >
      <ModalSection title="Plan Details">
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
          <FormGroup label="Plan name *"><input className="input" placeholder="e.g. Starter Pack" value={form.name} onChange={e=>upd('name',e.target.value)} disabled={loading}/></FormGroup>
          <FormGroup label="Price *">
            <div style={{ display:'flex', gap:4 }}>
              <select className="select" value={form.currency} onChange={e=>upd('currency',e.target.value)} style={{ width:60 }} disabled={loading}><option value="INR">₹</option><option value="USD">$</option></select>
              <input className="input" type="number" placeholder="99" value={form.price} onChange={e=>upd('price',+e.target.value)} disabled={loading}/>
            </div>
          </FormGroup>
        </div>
      </ModalSection>

      <ModalSection title="Coins Reward">
        <FormGroup label="Coins amount *">
          <input className="input" type="number" placeholder="500" value={form.coins_amount} onChange={e=>upd('coins_amount',+e.target.value)} disabled={loading}/>
          <div style={{ fontSize:11, color:'var(--text3)', marginTop:6 }}>User will receive this many coins when they purchase this plan</div>
        </FormGroup>
      </ModalSection>

      <ModalSection title="Visibility">
        <label style={{ display:'flex', alignItems:'center', gap:10, cursor:'pointer' }}>
          <Toggle on={form.isActive} onChange={v=>upd('isActive',v)} disabled={loading}/>
          <span style={{ fontSize:13 }}>Active (show to users)</span>
        </label>
      </ModalSection>
    </Modal>
  )
}

export default function TopUp() {
  const [plans, setPlans] = useState([])
  const [modal, setModal] = useState(null)
  const [selected, setSelected] = useState(null)
  const [confirm, setConfirm] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  // Fetch plans on component mount
  useEffect(() => {
    fetchPlans()
  }, [])

  const fetchPlans = async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await topupApi.getAll()
      if (response.data?.success) {
        setPlans(response.data.data || [])
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to fetch top-up plans')
      console.error('Fetch plans error:', err)
    } finally {
      setLoading(false)
    }
  }

  const savePlan = async (formData) => {
    try {
      setLoading(true)
      setError(null)
      
      const payload = {
        name: formData.name,
        price: formData.price,
        coins_amount: formData.coins_amount,
        currency: formData.currency,
      }

      if (selected?.id) {
        // Update existing plan
        const response = await topupApi.update(selected.id, {
          ...payload,
          isActive: formData.isActive,
        })
        if (response.data?.success) {
          setPlans(plans.map(p => p.id === selected.id ? response.data.data : p))
          setModal(null)
          setSelected(null)
        }
      } else {
        // Create new plan
        const response = await topupApi.create(payload)
        if (response.data?.success) {
          setPlans([...plans, response.data.data])
          setModal(null)
        }
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save plan')
      console.error('Save plan error:', err)
    } finally {
      setLoading(false)
    }
  }

  const deletePlan = async (planId) => {
    try {
      setLoading(true)
      setError(null)
      await topupApi.delete(planId)
      setPlans(plans.filter(p => p.id !== planId))
      setConfirm(null)
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete plan')
      console.error('Delete plan error:', err)
    } finally {
      setLoading(false)
    }
  }

  const toggleActive = async (planId) => {
    try {
      setLoading(true)
      setError(null)
      const response = await topupApi.toggle(planId)
      if (response.data?.success) {
        setPlans(plans.map(p => p.id === planId ? { ...p, isActive: response.data.data.isActive } : p))
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to toggle plan status')
      console.error('Toggle plan error:', err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="page-enter">
      {/* Error message */}
      {error && (
        <div style={{ background:'rgba(220, 38, 38, 0.1)', border:'1px solid rgb(220, 38, 38)', color:'rgb(220, 38, 38)', padding:'12px 16px', borderRadius:'6px', marginBottom:'16px', fontSize:'13px' }}>
          {error}
        </div>
      )}

      {/* Header */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:24 }}>
        <div>
          <h1 style={{ fontSize:24, fontWeight:600, marginBottom:4 }}>Top-Up Plans</h1>
          <p style={{ fontSize:13, color:'var(--text3)' }}>Manage coin packages users can purchase</p>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <button className="btn btn-ghost btn-sm" onClick={fetchPlans}><RefreshCw size={14}/></button>
          <button className="btn btn-primary" onClick={() => { setSelected(null); setModal('plan-add') }} disabled={loading}><Plus size={14}/> Create plan</button>
        </div>
      </div>

      {/* Stats */}
      <div className="metrics-grid" style={{ gridTemplateColumns:'repeat(2,1fr)', marginBottom:24 }}>
        {[
          { label:'Total Plans', value:plans.length, sub:'including inactive' },
          { label:'Active Plans', value:plans.filter(p=>p.isActive).length, sub:'visible to users' },
        ].map(m => (
          <div className="metric-card" key={m.label}>
            <div className="metric-label">{m.label}</div>
            <div className="metric-value" style={{ fontSize:20 }}>{m.value}</div>
            <div className="metric-sub">{m.sub}</div>
          </div>
        ))}
      </div>

      {/* Plans Table */}
      <div className="card" style={{ padding:0 }}>
        <div style={{ overflowX:'auto' }}>
          <table className="table" style={{ width:'100%', borderCollapse:'collapse' }}>
            <thead>
              <tr style={{ borderBottom:'1px solid var(--border)' }}>
                <th style={{ padding:'12px 16px', textAlign:'left', fontSize:12, fontWeight:600, color:'var(--text3)' }}>Plan Name</th>
                <th style={{ padding:'12px 16px', textAlign:'right', fontSize:12, fontWeight:600, color:'var(--text3)' }}>Price</th>
                <th style={{ padding:'12px 16px', textAlign:'right', fontSize:12, fontWeight:600, color:'var(--text3)' }}>Coins</th>
                <th style={{ padding:'12px 16px', textAlign:'center', fontSize:12, fontWeight:600, color:'var(--text3)' }}>Status</th>
                <th style={{ padding:'12px 16px', textAlign:'right', fontSize:12, fontWeight:600, color:'var(--text3)' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {plans.length === 0 ? (
                <tr>
                  <td colSpan="5" style={{ padding:'24px 16px', textAlign:'center', color:'var(--text3)' }}>
                    No top-up plans yet. <button className="link" onClick={() => { setSelected(null); setModal('plan-add') }}>Create one</button>
                  </td>
                </tr>
              ) : (
                plans.map(p => (
                  <tr key={p.id} style={{ borderBottom:'1px solid var(--border)', '&:hover': { background:'var(--bg2)' } }}>
                    <td style={{ padding:'12px 16px', fontSize:13, fontWeight:500 }}>{p.name}</td>
                    <td style={{ padding:'12px 16px', fontSize:13, textAlign:'right', fontFamily:'var(--mono)' }}>₹{p.price.toFixed(2)}</td>
                    <td style={{ padding:'12px 16px', fontSize:13, textAlign:'right', fontFamily:'var(--mono)', color:'var(--accent)' }}>{p.coins_amount}</td>
                    <td style={{ padding:'12px 16px', textAlign:'center' }}>
                      <span className={`badge ${p.isActive?'badge-green':'badge-red'}`} style={{ fontSize:11 }}>
                        {p.isActive?'Active':'Inactive'}
                      </span>
                    </td>
                    <td style={{ padding:'12px 16px', textAlign:'right', display:'flex', gap:8, justifyContent:'flex-end' }}>
                      <Toggle on={p.isActive} onChange={() => toggleActive(p.id)} disabled={loading}/>
                      <button className="btn btn-ghost btn-sm" onClick={() => { setSelected(p); setModal('plan-edit') }} disabled={loading}><Edit2 size={11}/></button>
                      <button className="btn btn-danger btn-sm" onClick={() => setConfirm({id:p.id,name:p.name})} disabled={loading}><Trash2 size={11}/></button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modals */}
      <TopUpPlanModal 
        open={modal === 'plan-add'} 
        onClose={() => setModal(null)} 
        onSave={savePlan} 
        loading={loading}
      />
      <TopUpPlanModal 
        open={modal === 'plan-edit'} 
        onClose={() => { setModal(null); setSelected(null); }} 
        onSave={savePlan} 
        initial={selected}
        loading={loading}
      />

      {/* Confirm Delete Dialog */}
      {confirm && (
        <ConfirmDialog
          title="Delete Top-Up Plan"
          message={`Are you sure you want to delete "${confirm.name}"?`}
          destructive
          onConfirm={() => deletePlan(confirm.id)}
          onCancel={() => setConfirm(null)}
          confirmText="Delete"
        />
      )}
    </div>
  )
}
