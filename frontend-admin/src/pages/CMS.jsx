import { useState } from 'react'
import { Edit2, Eye, Plus } from 'lucide-react'
import Modal, { FormGroup, ModalSection } from '../components/ui/Modal.jsx'
import { Toggle } from '../components/ui/Controls.jsx'

const initPages = [
  { id:1, name:'Privacy Policy',     slug:'privacy-policy',     updated:'Mar 15, 2025', status:'Published', content:'Your privacy is important to us. This policy explains how we collect, use, and protect your personal information…', versioned:true, version:3 },
  { id:2, name:'Terms & Conditions', slug:'terms-conditions',   updated:'Mar 15, 2025', status:'Published', content:'By using our platform you agree to the following terms and conditions…', versioned:true, version:2 },
  { id:3, name:'Help / FAQ',         slug:'help-faq',           updated:'Feb 28, 2025', status:'Published', content:'Q: How do I subscribe?\nA: Go to Plans and choose a plan…', versioned:true, version:5 },
  { id:4, name:'About Us',           slug:'about-us',           updated:'Jan 10, 2025', status:'Published', content:'We are a premier drama streaming platform…', versioned:true, version:1 },
  { id:5, name:'Coin Policy',        slug:'coin-policy',        updated:'Apr 1, 2025',  status:'Draft',     content:'Coins are a virtual currency used on our platform…', versioned:false, version:1 },
  { id:6, name:'Referral Terms',     slug:'referral-terms',     updated:'Not set',      status:'Draft',     content:'', versioned:false, version:1 },
]

function PageEditorModal({ open, onClose, onSave, initial, onPreview }) {
  const isEdit = !!initial?.id
  const [form, setForm] = useState(initial || { name:'', slug:'', content:'', status:'Draft', versioned:true })
  const upd = (k,v) => setForm(p=>({...p,[k]:v}))
  if(!open) return null
  return (
    <Modal open={open} onClose={onClose} title={isEdit?`Edit — ${initial.name}`:'New CMS Page'} width={680}
      footer={
        <>
          <button className="btn btn-ghost" onClick={() => onPreview(form)}>Preview</button>
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-ghost" onClick={() => { onSave({...form,status:'Draft',updated:new Date().toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}),id:initial?.id||Date.now(),version:(initial?.version||0)+1}); onClose() }}>Save as draft</button>
          <button className="btn btn-primary" onClick={() => { onSave({...form,status:'Published',updated:new Date().toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}),id:initial?.id||Date.now(),version:(initial?.version||0)+1}); onClose() }}>Publish</button>
        </>
      }
    >
      <ModalSection title="Page details">
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
          <FormGroup label="Page name *"><input className="input" placeholder="e.g. Privacy Policy" value={form.name} onChange={e=>upd('name',e.target.value)}/></FormGroup>
          <FormGroup label="URL slug" hint={`/page/${form.slug||'slug'}`}><input className="input" placeholder="privacy-policy" value={form.slug} onChange={e=>upd('slug',e.target.value.toLowerCase().replace(/\s+/g,'-'))}/></FormGroup>
        </div>
        <label style={{ display:'flex', alignItems:'center', gap:10, cursor:'pointer' }}>
          <Toggle on={form.versioned} onChange={v=>upd('versioned',v)}/>
          <span style={{ fontSize:13 }}>Enable versioning (save history of edits)</span>
        </label>
      </ModalSection>

      <ModalSection title="Content (rich text editor)">
        <div style={{ border:'1px solid var(--border)', borderRadius:'var(--radius)', overflow:'hidden' }}>
          {/* Simulated toolbar */}
          <div style={{ background:'var(--bg3)', borderBottom:'1px solid var(--border)', padding:'8px 12px', display:'flex', gap:8 }}>
            {['B','I','U','H1','H2','• List','Link'].map(t => (
              <button key={t} style={{ background:'var(--bg4)', border:'none', borderRadius:4, padding:'3px 7px', fontSize:11, color:'var(--text2)', cursor:'pointer' }}>{t}</button>
            ))}
          </div>
          <textarea className="input" rows={10} style={{ width:'100%', border:'none', borderRadius:0, resize:'vertical', fontFamily:'inherit' }}
            placeholder="Write page content…" value={form.content} onChange={e=>upd('content',e.target.value)}/>
        </div>
      </ModalSection>

      {initial?.name === 'Help / FAQ' && (
        <ModalSection title="FAQ pairs (expandable sections)">
          <div style={{ fontSize:12, color:'var(--text3)', marginBottom:8 }}>Q&A pairs are automatically parsed from lines starting with Q: and A:</div>
          {(form.content||'').split('\n').reduce((acc,line,i,arr) => {
            if(line.startsWith('Q:')) acc.push({q:line.slice(2).trim(),a:arr[i+1]?.startsWith('A:')?arr[i+1].slice(2).trim():''})
            return acc
          },[]).map((qa,i) => (
            <div key={i} style={{ background:'var(--bg3)', borderRadius:6, padding:'8px 12px', marginBottom:6 }}>
              <div style={{ fontSize:12, fontWeight:600 }}>Q: {qa.q}</div>
              <div style={{ fontSize:12, color:'var(--text3)' }}>A: {qa.a}</div>
            </div>
          ))}
        </ModalSection>
      )}
    </Modal>
  )
}

function PreviewModal({ open, onClose, page }) {
  if(!page||!open) return null
  return (
    <Modal open={open} onClose={onClose} title={`Preview — ${page.name}`} width={600}>
      <div style={{ background:'var(--bg)', borderRadius:8, padding:24, border:'1px solid var(--border)' }}>
        <h2 style={{ fontSize:20, fontWeight:700, marginBottom:12 }}>{page.name}</h2>
        <div style={{ fontSize:13, color:'var(--text2)', lineHeight:1.8, whiteSpace:'pre-wrap' }}>{page.content||'(No content yet)'}</div>
      </div>
      <div style={{ marginTop:12, fontSize:11, color:'var(--text3)', display:'flex', gap:12 }}>
        <span>Slug: /{page.slug}</span>
        <span>Last updated: {page.updated}</span>
        <span>Version: v{page.version}</span>
      </div>
    </Modal>
  )
}

export default function CMS() {
  const [pages, setPages] = useState(initPages)
  const [modal, setModal] = useState(null)
  const [selected, setSelected] = useState(null)

  const savePage = data => setPages(p => p.find(x=>x.id===data.id)?p.map(x=>x.id===data.id?data:x):[...p,data])
  const open = (m, pg=null) => { setModal(m); setSelected(pg) }

  return (
    <div className="page-enter">
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
        <div>
          <div style={{ fontWeight:600 }}>Static content pages</div>
          <div style={{ fontSize:12, color:'var(--text3)' }}>{pages.length} pages · {pages.filter(p=>p.status==='Published').length} published</div>
        </div>
        <button className="btn btn-primary" onClick={() => open('edit', null)}><Plus size={14}/> New page</button>
      </div>

      <div className="card" style={{ padding:0 }}>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Page</th><th>URL slug</th><th>Version</th><th>Last updated</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>
              {pages.map(pg => (
                <tr key={pg.id}>
                  <td style={{ fontWeight:500 }}>{pg.name}</td>
                  <td style={{ fontFamily:'var(--mono)', fontSize:11, color:'var(--text3)' }}>/{pg.slug}</td>
                  <td><span className="badge badge-blue" style={{ fontSize:10 }}>v{pg.version}</span></td>
                  <td style={{ color:'var(--text3)', fontSize:12 }}>{pg.updated}</td>
                  <td><span className={`badge ${pg.status==='Published'?'badge-green':'badge-amber'}`}>{pg.status}</span></td>
                  <td>
                    <div style={{ display:'flex', gap:5 }}>
                      <button className="btn btn-ghost btn-sm" onClick={() => open('edit', pg)}><Edit2 size={11}/> Edit</button>
                      <button className="btn btn-ghost btn-sm" onClick={() => open('preview', pg)}><Eye size={11}/> Preview</button>
                      {pg.status==='Draft' && (
                        <button className="btn btn-primary btn-sm" onClick={() => savePage({...pg,status:'Published',updated:new Date().toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})})}>Publish</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <PageEditorModal open={modal==='edit'} onClose={() => setModal(null)} onSave={savePage} initial={selected} onPreview={pg => { setSelected(pg); setModal('preview') }}/>
      <PreviewModal open={modal==='preview'} onClose={() => setModal(null)} page={selected}/>
    </div>
  )
}
