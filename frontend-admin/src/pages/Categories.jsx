import { useState } from 'react'
import { Plus, Trash2, Edit2, ChevronUp, ChevronDown } from 'lucide-react'
import Modal, { FormGroup, ModalSection } from '../components/ui/Modal.jsx'
import { Toggle, ConfirmDialog } from '../components/ui/Controls.jsx'

const initCategories = [
  { id:1, name:'Popular',    displayOrder:1, dramas:42, active:true },
  { id:2, name:'New',        displayOrder:2, dramas:18, active:true },
  { id:3, name:'Rankings',   displayOrder:3, dramas:95, active:true },
  { id:4, name:'Anime',      displayOrder:4, dramas:31, active:true },
  { id:5, name:'VIP',        displayOrder:5, dramas:20, active:true },
]

const initTags = [
  { id:1, name:'Romance',         count:88, trending:true },
  { id:2, name:'CEO',             count:72, trending:true },
  { id:3, name:'Revenge',         count:60, trending:false },
  { id:4, name:'Comedy',          count:50, trending:false },
  { id:5, name:'School',          count:44, trending:false },
  { id:6, name:'Thriller',        count:36, trending:true },
  { id:7, name:'Strong Heroine',  count:34, trending:false },
  { id:8, name:'Werewolf',        count:28, trending:false },
  { id:9, name:'Hidden Identity', count:22, trending:false },
  { id:10, name:'Billionaire',    count:18, trending:true },
  { id:11, name:'Action',         count:14, trending:false },
  { id:12, name:'Fantasy',        count:10, trending:false },
  { id:13, name:'Family Bonds',   count:8,  trending:false },
  { id:14, name:'Forced Love',    count:6,  trending:false },
]

function CategoryModal({ open, onClose, onSave, initial }) {
  const isEdit = !!initial?.id
  const [form, setForm] = useState(initial || { name:'', displayOrder:'' })
  const upd = (k,v) => setForm(p=>({...p,[k]:v}))
  const handle = () => { onSave({...form, id:initial?.id||Date.now(), dramas:initial?.dramas||0, active:initial?.active??true}); onClose() }
  if(!open) return null
  return (
    <Modal open={open} onClose={onClose} title={isEdit?`Edit Category — ${initial.name}`:'New Category'} width={420}
      footer={<><button className="btn btn-ghost" onClick={onClose}>Cancel</button><button className="btn btn-primary" onClick={handle}>{isEdit?'Save Changes':'Create Category'}</button></>}
    >
      <FormGroup label="Category name *">
        <input className="input" style={{ width:'100%' }} placeholder="e.g. Popular, New, Rankings" value={form.name} onChange={e=>upd('name',e.target.value)}/>
      </FormGroup>
      <FormGroup label="Display order">
        <input className="input" type="number" placeholder="1" value={form.displayOrder} onChange={e=>upd('displayOrder',e.target.value)}/>
      </FormGroup>
      <div style={{ fontSize:12, color:'var(--text3)', marginTop:8 }}>
        Categories appear as navbar tabs on the home screen (e.g. Popular, New, Rankings, Anime, VIP). Shows are assigned to one category.
      </div>
    </Modal>
  )
}

function TagModal({ open, onClose, onSave, initial }) {
  const isEdit = !!initial?.id
  const [name, setName] = useState(initial?.name||'')
  if(!open) return null
  return (
    <Modal open={open} onClose={onClose} title={isEdit?'Edit Tag':'New Tag'} width={380}
      footer={<><button className="btn btn-ghost" onClick={onClose}>Cancel</button><button className="btn btn-primary" onClick={() => { onSave({...initial, id:initial?.id||Date.now(), name, count:initial?.count||0, trending:initial?.trending||false}); onClose() }}>{isEdit?'Save':'Create Tag'}</button></>}
    >
      <FormGroup label="Tag name *"><input className="input" style={{ width:'100%' }} placeholder="e.g. Strong Heroine, Billionaire" value={name} onChange={e=>setName(e.target.value)}/></FormGroup>
      <div style={{ fontSize:12, color:'var(--text3)' }}>Tags are drama genre/type labels used for filtering and discovery on the Categories screen. One drama can have multiple tags.</div>
    </Modal>
  )
}

export default function Categories() {
  const [cats, setCats] = useState(initCategories)
  const [tags, setTags] = useState(initTags)
  const [modal, setModal] = useState(null)
  const [selected, setSelected] = useState(null)
  const [confirm, setConfirm] = useState(null)

  const toggleActive = id => setCats(p=>p.map(c=>c.id===id?{...c,active:!c.active}:c))
  const toggleTrending = id => setTags(p=>p.map(t=>t.id===id?{...t,trending:!t.trending}:t))
  const moveCategory = (idx,dir) => {
    const arr=[...cats].sort((a,b)=>a.displayOrder-b.displayOrder)
    const sw=idx+dir
    if(sw<0||sw>=arr.length) return
    ;[arr[idx].displayOrder,arr[sw].displayOrder]=[arr[sw].displayOrder,arr[idx].displayOrder]
    setCats([...arr])
  }
  const saveCat = data => setCats(p=>p.find(c=>c.id===data.id)?p.map(c=>c.id===data.id?data:c):[...p,data])
  const saveTag = data => setTags(p=>p.find(t=>t.id===data.id)?p.map(t=>t.id===data.id?data:t):[...p,data])
  const deleteCat = id => { setCats(p=>p.filter(c=>c.id!==id)); setConfirm(null) }
  const deleteTag = id => { setTags(p=>p.filter(t=>t.id!==id)); setConfirm(null) }

  const sortedCats = [...cats].sort((a,b)=>a.displayOrder-b.displayOrder)

  return (
    <div className="page-enter">
      <div className="grid2">
        {/* Categories (Navbar tabs) */}
        <div className="card">
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
            <div>
              <div className="card-title" style={{ marginBottom:0 }}>Navbar Categories</div>
              <div style={{ fontSize:12, color:'var(--text3)', marginTop:2 }}>These appear as top navigation tabs on the home screen</div>
            </div>
            <button className="btn btn-primary btn-sm" onClick={() => { setSelected(null); setModal('cat-add') }}><Plus size={12}/> New</button>
          </div>
          {sortedCats.map((c,idx) => (
            <div key={c.id} style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 0', borderBottom:'1px solid var(--border)' }}>
              <div style={{ display:'flex', flexDirection:'column', gap:1 }}>
                <button className="icon-btn" onClick={() => moveCategory(idx,-1)} disabled={idx===0}><ChevronUp size={10}/></button>
                <button className="icon-btn" onClick={() => moveCategory(idx,1)} disabled={idx===sortedCats.length-1}><ChevronDown size={10}/></button>
              </div>
              <div style={{ fontSize:10, color:'var(--text3)', fontFamily:'var(--mono)', width:16, textAlign:'center' }}>{c.displayOrder}</div>
              <div style={{ flex:1 }}>
                <div style={{ fontWeight:500, fontSize:13 }}>{c.name}</div>
                <div style={{ fontSize:11, color:'var(--text3)' }}>{c.dramas} dramas</div>
              </div>
              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:1 }}>
                  <div style={{ fontSize:9, color:'var(--text3)' }}>Active</div>
                  <Toggle on={c.active} onChange={() => toggleActive(c.id)}/>
                </div>
                <button className="btn btn-ghost btn-sm" onClick={() => { setSelected(c); setModal('cat-edit') }}><Edit2 size={11}/></button>
                <button className="btn btn-danger btn-sm" onClick={() => setConfirm({type:'cat',id:c.id,name:c.name})}><Trash2 size={11}/></button>
              </div>
            </div>
          ))}
        </div>

        {/* Tags (Drama genre/type labels) */}
        <div>
          <div className="card" style={{ marginBottom:14 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
              <div>
                <div className="card-title" style={{ marginBottom:0 }}>Drama Tags</div>
                <div style={{ fontSize:12, color:'var(--text3)', marginTop:2 }}>Genre/type labels for filtering (Romance, Werewolf, etc.)</div>
              </div>
              <button className="btn btn-primary btn-sm" onClick={() => { setSelected(null); setModal('tag-add') }}><Plus size={12}/> New tag</button>
            </div>
            <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
              {tags.map(t => (
                <div key={t.id} style={{ display:'flex', alignItems:'center', gap:4, background:t.trending?'var(--amber-bg)':'var(--bg4)', borderRadius:20, padding:'4px 8px 4px 10px', border:`1px solid ${t.trending?'rgba(245,166,35,0.3)':'var(--border)'}` }}>
                  <span style={{ fontSize:12, fontWeight:500, color:t.trending?'var(--amber)':'var(--text2)' }}>{t.name}</span>
                  <span style={{ fontSize:10, color:'var(--text3)', fontFamily:'var(--mono)', marginLeft:2 }}>{t.count}</span>
                  <button className="icon-btn" title={t.trending?'Unpin from trending':'Pin to trending'} onClick={() => toggleTrending(t.id)} style={{ marginLeft:2, color:t.trending?'var(--amber)':'var(--text3)' }}>★</button>
                  <button className="icon-btn" onClick={() => { setSelected(t); setModal('tag-edit') }}><Edit2 size={9}/></button>
                  <button className="icon-btn" style={{ color:'var(--red)' }} onClick={() => setConfirm({type:'tag',id:t.id,name:t.name})}><Trash2 size={9}/></button>
                </div>
              ))}
            </div>
          </div>

          <div className="card">
            <div className="card-title">Tag usage</div>
            {[...tags].sort((a,b)=>b.count-a.count).slice(0,8).map(t => (
              <div className="bar-row" key={t.id}>
                <div className="bar-lbl">{t.name}</div>
                <div className="bar-track">
                  <div className="bar-fill" style={{ width:`${(t.count/tags[0].count)*100}%`, background:t.trending?'var(--amber)':'var(--accent)' }}/>
                </div>
                <div className="bar-val">{t.count}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <CategoryModal open={modal==='cat-add'} onClose={() => setModal(null)} onSave={saveCat} initial={null}/>
      <CategoryModal open={modal==='cat-edit'} onClose={() => setModal(null)} onSave={saveCat} initial={selected}/>
      <TagModal open={modal==='tag-add'} onClose={() => setModal(null)} onSave={saveTag} initial={null}/>
      <TagModal open={modal==='tag-edit'} onClose={() => setModal(null)} onSave={saveTag} initial={selected}/>
      <ConfirmDialog open={!!confirm} danger title={`Delete ${confirm?.type==='cat'?'Category':'Tag'}`}
        message={`Remove "${confirm?.name}"? ${confirm?.type==='cat'?'All dramas will be unmapped from this category.':'Tag will be removed from all dramas.'}`}
        onConfirm={() => confirm?.type==='cat'?deleteCat(confirm.id):deleteTag(confirm.id)}
        onCancel={() => setConfirm(null)}
      />
    </div>
  )
}
