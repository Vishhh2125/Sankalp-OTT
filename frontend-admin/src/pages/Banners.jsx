import { useState } from 'react'
import { Plus, Edit2, Trash2, Eye } from 'lucide-react'
import Modal, { FormGroup, ModalSection } from '../components/ui/Modal.jsx'
import { Toggle, ConfirmDialog } from '../components/ui/Controls.jsx'

const initBanners = [
  { id:1, title:'New Drama Launch', image_url:null, show_id:'D001', show_name:'Secret Marriage', link_type:'show', display_order:1, is_active:true, starts_at:'2025-04-01', ends_at:'2025-04-30' },
  { id:2, title:'Membership 50% Off', image_url:null, show_id:null, show_name:null, link_type:'external', display_order:2, is_active:true, starts_at:'2025-04-10', ends_at:'2025-04-20' },
  { id:3, title:'CEO Revenge Season 2', image_url:null, show_id:'D002', show_name:"CEO's Revenge", link_type:'show', display_order:3, is_active:false, starts_at:null, ends_at:null },
]

const SHOWS_LIST = [
  { id:'D001', title:'Secret Marriage' },
  { id:'D002', title:"CEO's Revenge" },
  { id:'D003', title:'Lost in Seoul' },
  { id:'D004', title:'Campus Crush' },
]

function BannerModal({ open, onClose, onSave, initial }) {
  const isEdit = !!initial?.id
  const [form, setForm] = useState(initial || { title:'', show_id:null, link_type:'show', display_order:1, is_active:true, starts_at:'', ends_at:'' })
  const upd = (k,v) => setForm(p=>({...p,[k]:v}))
  if(!open) return null
  return (
    <Modal open={open} onClose={onClose} title={isEdit?`Edit — ${initial.title}`:'Add Banner'} width={520}
      footer={<><button className="btn btn-ghost" onClick={onClose}>Cancel</button><button className="btn btn-primary" onClick={() => { onSave({...form,id:initial?.id||Date.now(), show_name: SHOWS_LIST.find(s=>s.id===form.show_id)?.title||null }); onClose() }}>{isEdit?'Save Changes':'Create'}</button></>}
    >
      <ModalSection title="Banner details">
        <FormGroup label="Title *">
          <input className="input" style={{ width:'100%' }} placeholder="e.g. New Drama Launch" value={form.title} onChange={e=>upd('title',e.target.value)}/>
        </FormGroup>
        <FormGroup label="Banner image">
          <div style={{ border:'2px dashed var(--border2)', borderRadius:'var(--radius)', padding:16, textAlign:'center', background:'var(--bg3)', cursor:'pointer', position:'relative' }}>
            <input type="file" accept="image/*" style={{ position:'absolute', inset:0, opacity:0, cursor:'pointer' }}/>
            <div style={{ fontSize:20, marginBottom:6 }}>🖼</div>
            <div style={{ fontSize:12, color:'var(--text2)' }}>Upload image</div>
            <div style={{ fontSize:11, color:'var(--text3)' }}>PNG, JPG · 1280×400 px recommended</div>
          </div>
        </FormGroup>
      </ModalSection>

      <ModalSection title="Link configuration">
        <FormGroup label="Link type">
          <div style={{ display:'flex', gap:8 }}>
            <button className={`chip${form.link_type==='show'?' chip-active':''}`} onClick={() => upd('link_type','show')}>Show / Drama</button>
            <button className={`chip${form.link_type==='external'?' chip-active':''}`} onClick={() => upd('link_type','external')}>External URL</button>
          </div>
        </FormGroup>
        {form.link_type === 'show' ? (
          <FormGroup label="Linked show">
            <select className="select" style={{ width:'100%' }} value={form.show_id||''} onChange={e=>upd('show_id',e.target.value||null)}>
              <option value="">Select a show…</option>
              {SHOWS_LIST.map(s=><option key={s.id} value={s.id}>{s.title}</option>)}
            </select>
          </FormGroup>
        ) : (
          <FormGroup label="External URL">
            <input className="input" style={{ width:'100%' }} placeholder="https://..." value={form.external_url||''} onChange={e=>upd('external_url',e.target.value)}/>
          </FormGroup>
        )}
      </ModalSection>

      <ModalSection title="Display settings">
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:12 }}>
          <FormGroup label="Display order">
            <input className="input" type="number" min={1} value={form.display_order} onChange={e=>upd('display_order',+e.target.value)}/>
          </FormGroup>
          <FormGroup label="Start date">
            <input className="input" type="date" value={form.starts_at||''} onChange={e=>upd('starts_at',e.target.value)}/>
          </FormGroup>
          <FormGroup label="End date">
            <input className="input" type="date" value={form.ends_at||''} onChange={e=>upd('ends_at',e.target.value)}/>
          </FormGroup>
        </div>
        <label style={{ display:'flex', alignItems:'center', gap:10, cursor:'pointer', marginTop:12 }}>
          <Toggle on={form.is_active} onChange={v=>upd('is_active',v)}/>
          <span style={{ fontSize:13 }}>Active (visible on the app)</span>
        </label>
      </ModalSection>
    </Modal>
  )
}

export default function Banners() {
  const [banners, setBanners] = useState(initBanners)
  const [modal, setModal] = useState(null)
  const [selected, setSelected] = useState(null)
  const [confirm, setConfirm] = useState(null)

  const saveBanner = data => setBanners(p => p.find(b=>b.id===data.id)?p.map(b=>b.id===data.id?data:b):[...p,data])
  const deleteBanner = id => { setBanners(p=>p.filter(b=>b.id!==id)); setConfirm(null) }
  const toggleActive = id => setBanners(p => p.map(b => b.id===id ? {...b, is_active:!b.is_active} : b))
  const open = (m, b=null) => { setModal(m); setSelected(b) }

  return (
    <div className="page-enter">
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
        <div>
          <div style={{ fontWeight:600 }}>Homepage banners</div>
          <div style={{ fontSize:12, color:'var(--text3)' }}>{banners.length} total · {banners.filter(b=>b.is_active).length} active</div>
        </div>
        <button className="btn btn-primary" onClick={() => open('add')}><Plus size={14}/> Add banner</button>
      </div>

      <div className="card" style={{ padding:0 }}>
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Order</th><th>Title</th><th>Link type</th><th>Linked to</th><th>Schedule</th><th>Status</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {[...banners].sort((a,b)=>a.display_order-b.display_order).map(b => (
                <tr key={b.id}>
                  <td style={{ fontFamily:'var(--mono)', fontSize:12, color:'var(--text3)' }}>{b.display_order}</td>
                  <td style={{ fontWeight:500 }}>{b.title}</td>
                  <td><span className={`badge ${b.link_type==='show'?'badge-blue':'badge-amber'}`}>{b.link_type}</span></td>
                  <td style={{ color:'var(--text2)', fontSize:12 }}>{b.show_name || '—'}</td>
                  <td style={{ fontSize:11, color:'var(--text3)' }}>
                    {b.starts_at && b.ends_at ? `${b.starts_at} → ${b.ends_at}` : 'Always'}
                  </td>
                  <td>
                    <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                      <span className={`badge ${b.is_active?'badge-green':'badge-amber'}`}>{b.is_active?'Active':'Inactive'}</span>
                      <Toggle on={b.is_active} onChange={() => toggleActive(b.id)}/>
                    </div>
                  </td>
                  <td>
                    <div style={{ display:'flex', gap:5 }}>
                      <button className="btn btn-ghost btn-sm" onClick={() => open('edit', b)}><Edit2 size={11}/> Edit</button>
                      <button className="btn btn-danger btn-sm" onClick={() => setConfirm({id:b.id,name:b.title})}><Trash2 size={11}/></button>
                    </div>
                  </td>
                </tr>
              ))}
              {banners.length===0 && <tr><td colSpan={7} style={{ textAlign:'center', color:'var(--text3)', padding:'40px 0' }}>No banners yet</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      <BannerModal open={modal==='add'} onClose={() => setModal(null)} onSave={saveBanner} initial={null}/>
      <BannerModal open={modal==='edit'} onClose={() => setModal(null)} onSave={saveBanner} initial={selected}/>
      <ConfirmDialog open={!!confirm} danger title="Delete Banner"
        message={`Remove "${confirm?.name}" permanently?`}
        onConfirm={() => deleteBanner(confirm.id)} onCancel={() => setConfirm(null)}
      />
    </div>
  )
}
