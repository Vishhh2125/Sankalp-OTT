import { useState, useEffect } from 'react'
import { Plus, Trash2, Edit2, ChevronUp, ChevronDown, Loader } from 'lucide-react'
import Modal, { FormGroup, ModalSection } from '../components/ui/Modal.jsx'
import { Toggle, ConfirmDialog } from '../components/ui/Controls.jsx'
import { categoriesApi, tagsApi } from '../services/api.js'

function CategoryModal({ open, onClose, onSave, initial }) {
  const isEdit = !!initial?.id
  const [form, setForm] = useState(initial || { name:'', display_order:0 })
  const [saving, setSaving] = useState(false)
  const upd = (k,v) => setForm(p=>({...p,[k]:v}))

  useEffect(() => { if (open) setForm(initial || { name:'', display_order:0 }) }, [open, initial])

  const handle = async () => {
    setSaving(true)
    try {
      if (isEdit) {
        const { data } = await categoriesApi.update(initial.id, { name: form.name, display_order: parseInt(form.display_order) || 0 })
        onSave(data)
      } else {
        const { data } = await categoriesApi.create({ name: form.name, display_order: parseInt(form.display_order) || 0 })
        onSave(data)
      }
      onClose()
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to save category')
    } finally { setSaving(false) }
  }
  if(!open) return null
  return (
    <Modal open={open} onClose={onClose} title={isEdit?`Edit Category — ${initial.name}`:'New Category'} width={420}
      footer={<><button className="btn btn-ghost" onClick={onClose}>Cancel</button><button className="btn btn-primary" onClick={handle} disabled={saving}>{saving?'Saving...':isEdit?'Save Changes':'Create Category'}</button></>}
    >
      <FormGroup label="Category name *">
        <input className="input" style={{ width:'100%' }} placeholder="e.g. Popular, New, Rankings" value={form.name} onChange={e=>upd('name',e.target.value)}/>
      </FormGroup>
      <FormGroup label="Display order">
        <input className="input" type="number" placeholder="1" value={form.display_order} onChange={e=>upd('display_order',e.target.value)}/>
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
  const [saving, setSaving] = useState(false)

  useEffect(() => { if (open) setName(initial?.name || '') }, [open, initial])

  const handle = async () => {
    setSaving(true)
    try {
      if (isEdit) {
        const { data } = await tagsApi.update(initial.id, { name })
        onSave(data)
      } else {
        const { data } = await tagsApi.create({ name, is_trending: false })
        onSave(data)
      }
      onClose()
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to save tag')
    } finally { setSaving(false) }
  }
  if(!open) return null
  return (
    <Modal open={open} onClose={onClose} title={isEdit?'Edit Tag':'New Tag'} width={380}
      footer={<><button className="btn btn-ghost" onClick={onClose}>Cancel</button><button className="btn btn-primary" onClick={handle} disabled={saving}>{saving?'Saving...':isEdit?'Save':'Create Tag'}</button></>}
    >
      <FormGroup label="Tag name *"><input className="input" style={{ width:'100%' }} placeholder="e.g. Strong Heroine, Billionaire" value={name} onChange={e=>setName(e.target.value)}/></FormGroup>
      <div style={{ fontSize:12, color:'var(--text3)' }}>Tags are drama genre/type labels used for filtering and discovery. One drama can have multiple tags.</div>
    </Modal>
  )
}

export default function Categories() {
  const [cats, setCats] = useState([])
  const [tags, setTags] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null)
  const [selected, setSelected] = useState(null)
  const [confirm, setConfirm] = useState(null)

  // Fetch data on mount
  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const [catRes, tagRes] = await Promise.all([categoriesApi.getAll(), tagsApi.getAll()])
        setCats(catRes.data.map(c => ({ ...c, dramas: c._count?.shows || 0, active: c.is_active, displayOrder: c.display_order })))
        setTags(tagRes.data.map(t => ({ ...t, count: t._count?.show_tags || 0, trending: t.is_trending })))
      } catch (err) {
        console.error('Failed to load:', err)
      } finally { setLoading(false) }
    }
    load()
  }, [])

  const toggleActive = async (id) => {
    const cat = cats.find(c => c.id === id)
    try {
      await categoriesApi.update(id, { is_active: !cat.active })
      setCats(p => p.map(c => c.id === id ? { ...c, active: !c.active } : c))
    } catch (err) { alert('Failed to update') }
  }

  const toggleTrending = async (id) => {
    const tag = tags.find(t => t.id === id)
    try {
      await tagsApi.update(id, { is_trending: !tag.trending })
      setTags(p => p.map(t => t.id === id ? { ...t, trending: !t.trending } : t))
    } catch (err) { alert('Failed to update') }
  }

  const saveCat = (data) => {
    setCats(p => {
      const exists = p.find(c => c.id === data.id)
      if (exists) return p.map(c => c.id === data.id ? { ...data, dramas: c.dramas, active: data.is_active, displayOrder: data.display_order } : c)
      return [...p, { ...data, dramas: 0, active: data.is_active ?? true, displayOrder: data.display_order || p.length + 1 }]
    })
  }

  const saveTag = (data) => {
    setTags(p => {
      const exists = p.find(t => t.id === data.id)
      if (exists) return p.map(t => t.id === data.id ? { ...data, count: t.count, trending: data.is_trending } : t)
      return [...p, { ...data, count: 0, trending: data.is_trending ?? false }]
    })
  }

  const deleteCat = async (id) => {
    try {
      await categoriesApi.delete(id)
      setCats(p => p.filter(c => c.id !== id))
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to delete category')
    }
    setConfirm(null)
  }

  const deleteTag = async (id) => {
    try {
      await tagsApi.delete(id)
      setTags(p => p.filter(t => t.id !== id))
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to delete tag')
    }
    setConfirm(null)
  }

  const sortedCats = [...cats].sort((a,b) => (a.displayOrder||0) - (b.displayOrder||0))

  if (loading) {
    return (
      <div className="page-enter" style={{ display:'flex', justifyContent:'center', alignItems:'center', height:'50vh' }}>
        <Loader size={24} className="spin" style={{ color:'var(--accent2)' }}/>
        <span style={{ marginLeft:10, color:'var(--text3)' }}>Loading categories & tags...</span>
      </div>
    )
  }

  return (
    <div className="page-enter">
      <div className="grid2">
        <div className="card">
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
            <div>
              <div className="card-title" style={{ marginBottom:0 }}>Navbar Categories</div>
              <div style={{ fontSize:12, color:'var(--text3)', marginTop:2 }}>These appear as top navigation tabs on the home screen</div>
            </div>
            <button className="btn btn-primary btn-sm" onClick={() => { setSelected(null); setModal('cat-add') }}><Plus size={12}/> New</button>
          </div>
          {sortedCats.map((c, idx) => (
            <div key={c.id} style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 0', borderBottom:'1px solid var(--border)' }}>
              <div style={{ fontSize:10, color:'var(--text3)', fontFamily:'var(--mono)', width:20, textAlign:'center' }}>{c.displayOrder}</div>
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
                  <div className="bar-fill" style={{ width:`${tags[0]?.count ? (t.count/tags[0].count)*100 : 0}%`, background:t.trending?'var(--amber)':'var(--accent)' }}/>
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
        message={`Remove "${confirm?.name}"? ${confirm?.type==='cat'?'All dramas will be unmapped.':'Tag will be removed from all dramas.'}`}
        onConfirm={() => confirm?.type==='cat'?deleteCat(confirm.id):deleteTag(confirm.id)}
        onCancel={() => setConfirm(null)}
      />
    </div>
  )
}
