import { useState, useRef, useEffect } from 'react'
import { Search, Plus, Edit2, Trash2, BarChart2, ChevronUp, ChevronDown, Lock, Unlock, Star, Video, X, CheckCircle2, Loader, TrendingUp } from 'lucide-react'
import Modal, { ModalSection, FormGroup } from '../components/ui/Modal.jsx'
import { Toggle, StepBar, FileDropzone, ConfirmDialog } from '../components/ui/Controls.jsx'
import { useDramas } from '../services/useDramas.js'
import { episodesApi, showsApi } from '../services/api.js'

// Helper function to convert MM:SS duration string to seconds
function durationToSeconds(durationStr) {
  if (!durationStr) return 0
  const parts = durationStr.split(':')
  if (parts.length === 2) return parseInt(parts[0]) * 60 + parseInt(parts[1])
  return parseInt(durationStr) || 0
}

// Helper function to convert seconds back to MM:SS
function secondsToDuration(seconds) {
  if (!seconds) return '0:00'
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins}:${String(secs).padStart(2, '0')}`
}

function VideoDropzone({ file, onFileChange, uploadProgress }) {
  const inputRef = useRef()
  const [dragging, setDragging] = useState(false)

  const handleDrop = e => {
    e.preventDefault(); setDragging(false)
    const f = e.dataTransfer.files[0]
    if (f && f.type.startsWith('video/')) onFileChange(f)
  }

  const fmt = bytes => bytes < 1024*1024 ? `${(bytes/1024).toFixed(1)} KB` : `${(bytes/(1024*1024)).toFixed(1)} MB`

  return (
    <div>
      <div
        onClick={() => inputRef.current?.click()}
        onDragOver={e => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        style={{
          border: `2px dashed ${dragging ? 'var(--accent2)' : file ? 'var(--green)' : 'var(--border2)'}`,
          borderRadius: 'var(--radius)', padding: '18px 16px', textAlign: 'center',
          cursor: 'pointer', background: dragging ? 'rgba(99,102,241,0.06)' : 'var(--bg3)',
          transition: 'all 0.15s', position: 'relative',
        }}
      >
        <input ref={inputRef} type="file" accept="video/*" style={{ display: 'none' }}
          onChange={e => e.target.files[0] && onFileChange(e.target.files[0])} />

        {!file ? (
          <>
            <Video size={28} style={{ color: 'var(--text3)', marginBottom: 8 }} />
            <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text2)' }}>Drop video file here or click to browse</div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>MP4, MOV, MKV · Max 4 GB</div>
          </>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left' }}>
            <div style={{ width: 40, height: 40, borderRadius: 8, background: 'var(--bg4)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              {uploadProgress === 100 ? <CheckCircle2 size={20} style={{ color: 'var(--green)' }} /> : <Video size={20} style={{ color: 'var(--accent2)' }} />}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file.name}</div>
              <div style={{ fontSize: 11, color: 'var(--text3)' }}>{fmt(file.size)} · {file.type.split('/')[1]?.toUpperCase()}</div>
              {uploadProgress > 0 && uploadProgress < 100 && (
                <div style={{ marginTop: 6, height: 4, background: 'var(--bg4)', borderRadius: 2, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${uploadProgress}%`, background: 'var(--accent)', borderRadius: 2, transition: 'width 0.3s' }} />
                </div>
              )}
              {uploadProgress === 100 && <div style={{ fontSize: 10, color: 'var(--green)', marginTop: 2 }}>✓ Ready to save</div>}
              {uploadProgress > 0 && uploadProgress < 100 && <div style={{ fontSize: 10, color: 'var(--accent2)', marginTop: 2 }}>Uploading… {uploadProgress}%</div>}
            </div>
            <button onClick={e => { e.stopPropagation(); onFileChange(null) }}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', padding: 4, flexShrink: 0 }}>
              <X size={14} />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

const ALL_TAGS = ['Romance', 'CEO', 'Revenge', 'Comedy', 'School', 'Thriller', 'Trending', 'Action', 'Fantasy', 'Slice of Life', 'Strong Heroine', 'Werewolf', 'Hidden Identity', 'Billionaire', 'Family Bonds', 'Forced Love']

const tagColor = { Romance:'badge-pink', Trending:'badge-amber', CEO:'badge-blue', Revenge:'badge-red', Comedy:'badge-green', School:'badge-blue', Thriller:'badge-red', Action:'badge-amber', Billionaire:'badge-purple', 'Strong Heroine':'badge-pink', 'Hidden Identity':'badge-blue', Fantasy:'badge-purple' }
const emptyDrama = { title:'', synopsis:'', category:'', status:'Published', tags:[], episodes:[], feed_position:0, manual_view_count:0 }
const emptyEp = { title:'', duration:'', is_free:true, coin_cost:0, videoFile:null, uploadProgress:0, video_source:'UPLOAD', youtube_video_id:null, raw_youtube_url:'' }

function extractYoutubeVideoId(urlOrId) {
  if (!urlOrId) return null;
  if (/^[a-zA-Z0-9_-]{11}$/.test(urlOrId)) return urlOrId;
  const match = urlOrId.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|shorts\/|live\/))([\w-]{11})/);
  return match ? match[1] : null;
}

function DramaModal({ open, onClose, onSave, initial, initialStep = 0, autoAddEp = false, categories = [] }) {
  const isEdit = !!initial?.id
  const [step, setStep] = useState(initialStep)
  const [form, setForm] = useState(() => initial || emptyDrama)
  const [episodes, setEpisodes] = useState(() => initial?.episodes || [])
  const [newEp, setNewEp] = useState(emptyEp)
  const [addingEp, setAddingEp] = useState(autoAddEp)
  const [saving, setSaving] = useState(false)
  const intervalsRef = useRef([])

  // Reset form when modal opens with new data
  useEffect(() => {
    if (open) {
      const firstCategoryName = categories?.[0]?.name || ''
      const base = initial || emptyDrama
      setForm({
        ...base,
        category: base.category || firstCategoryName,
      })
      setEpisodes(initial?.episodes || [])
      setStep(initialStep)
      setAddingEp(autoAddEp)
      setNewEp(emptyEp)
      setSaving(false)
    }
  }, [open, initial, initialStep, autoAddEp])

  // Cleanup intervals when modal closes
  useEffect(() => {
    return () => {
      intervalsRef.current.forEach(interval => clearInterval(interval))
      intervalsRef.current = []
    }
  }, [])

  const upd = (k, v) => setForm(p => ({ ...p, [k]: v }))
  const toggleTag = t => upd('tags', form.tags.includes(t) ? form.tags.filter(x => x !== t) : [...form.tags, t])

  const addEpisode = () => {
    if (!newEp.title.trim()) return
    
    // For YouTube, extract ID
    if (newEp.video_source === 'YOUTUBE') {
      const yid = extractYoutubeVideoId(newEp.raw_youtube_url);
      if (!yid) {
        alert('Invalid YouTube URL or ID');
        return;
      }
      newEp.youtube_video_id = yid;
    }

    const ep = { ...newEp, id: `E${Date.now()}`, ep: episodes.length + 1, views: 0, status: newEp.video_source === 'YOUTUBE' ? 'ready' : (newEp.videoFile ? 'processing' : 'no-video') }
    // Simulate upload progress if a video file is attached
    if (newEp.videoFile) {
      setNewEp(p => ({ ...p, uploadProgress: 0 }))
      setEpisodes(prev => [...prev, { ...ep, status: 'uploading' }])
      let pct = 0
      const iv = setInterval(() => {
        pct += Math.floor(Math.random() * 18) + 8
        if (pct >= 100) { 
          pct = 100
          clearInterval(iv)
          intervalsRef.current = intervalsRef.current.filter(i => i !== iv)
        }
        setEpisodes(prev => prev.map(e => e.id === ep.id ? { ...e, uploadProgress: pct, status: pct < 100 ? 'uploading' : 'processing' } : e))
      }, 300)
      intervalsRef.current.push(iv)
    } else {
      setEpisodes(p => [...p, ep])
    }
    setNewEp(emptyEp)
    setAddingEp(false)
  }
  const removeEp = id => setEpisodes(p => p.filter(e => e.id !== id).map((e,i) => ({ ...e, ep: i+1 })))
  const moveEp = (idx, dir) => {
    const arr = [...episodes]; const sw = idx + dir
    if (sw < 0 || sw >= arr.length) return
    ;[arr[idx], arr[sw]] = [arr[sw], arr[idx]]
    setEpisodes(arr.map((e,i) => ({ ...e, ep: i+1 })))
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await onSave({ ...form, episodes, id: initial?.id || `D${Date.now()}`, rating_avg: initial?.rating_avg||0, rating_count: initial?.rating_count||0 })
      onClose()
      setStep(initialStep)
    } catch (err) {
      const errData = err?.response?.data
      const msg = errData?.details ? errData.details.map(d => `${d.field}: ${d.message}`).join('\n') : errData?.error || err?.message || 'Save failed'
      alert(msg)
    } finally { setSaving(false) }
  }

  const STEPS = ['Basic Info', 'Tags', 'Episodes', 'Review']
  if (!open) return null

  return (
    <Modal open={open} onClose={() => { onClose(); setStep(initialStep) }} title={isEdit ? `Edit Drama — ${initial.title}` : 'Add New Drama'} width={720}
      footer={
        <>
          {step > 0 && <button className="btn btn-ghost" onClick={() => setStep(s => s-1)}>← Back</button>}
          {isEdit && step !== 2 && (
            <button className="btn btn-ghost" style={{ color: 'var(--accent2)', borderColor: 'var(--accent-border)' }}
              onClick={() => { setStep(2); setAddingEp(true) }}>
              <Plus size={13}/> Add Episode
            </button>
          )}
          {step < 3
            ? <button className="btn btn-primary" onClick={() => {
                if (step === 0 && !form.title.trim()) { alert('Title is required'); return }
                if (step === 0 && !form.category) { alert('Category is required'); return }
                setStep(s => s+1)
              }}>Next →</button>
            : <button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : isEdit ? 'Save Changes' : 'Create Drama'}</button>
          }
        </>
      }
    >
      <StepBar steps={STEPS} current={step} />

      {step === 0 && (
        <>
          <ModalSection title="Drama details">
            <FormGroup label="Title *">
              <input className="input" style={{ width:'100%' }} placeholder="e.g. Secret Marriage" value={form.title} onChange={e => upd('title', e.target.value)} />
            </FormGroup>
            <FormGroup label="Synopsis">
              <textarea className="input" rows={3} style={{ width:'100%', resize:'vertical' }} placeholder="Brief description…" value={form.synopsis} onChange={e => upd('synopsis', e.target.value)} />
            </FormGroup>
            <FormGroup label="Category (navbar section)">
              <select className="select" style={{ width:'100%' }} value={form.category} onChange={e => upd('category', e.target.value)}>
                {categories.map(c => <option key={c.id}>{c.name}</option>)}
              </select>
            </FormGroup>
          </ModalSection>
          <ModalSection title="Media uploads">
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
              <FormGroup label="Thumbnail *">
                <FileDropzone label="Upload thumbnail" accept="image/jpeg,image/png" hint="JPG/PNG · 400×600 px recommended"
                  preview={form.thumbnailPreview || null}
                  onChange={(f) => {
                    if (f && (f.type === 'image/jpeg' || f.type === 'image/png')) {
                      upd('thumbnailFile', f)
                      upd('thumbnailPreview', URL.createObjectURL(f))
                    } else if (f) { alert('Only JPG/PNG images allowed') }
                  }} />
              </FormGroup>
              <FormGroup label="Banner image">
                <FileDropzone label="Upload banner" accept="image/jpeg,image/png" hint="JPG/PNG · 1280×720 px recommended"
                  preview={form.bannerPreview || null}
                  onChange={(f) => {
                    if (f && (f.type === 'image/jpeg' || f.type === 'image/png')) {
                      upd('bannerFile', f)
                      upd('bannerPreview', URL.createObjectURL(f))
                    } else if (f) { alert('Only JPG/PNG images allowed') }
                  }} />
              </FormGroup>
            </div>
          </ModalSection>
          {/* OPTIONS SECTION — commented out pending team discussion
          <ModalSection title="Options">
            <FormGroup label="For You feed position">
              <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                <input className="input" type="number" min="0" style={{ width:80 }}
                  placeholder="0" value={form.feed_position || ''}
                  onChange={e => upd('feed_position', parseInt(e.target.value) || 0)} />
                <div style={{ fontSize:11, color:'var(--text3)' }}>
                  {form.feed_position > 0
                    ? `Position ${form.feed_position} in For You feed`
                    : 'Set 1, 2, 3… to show in For You feed. 0 = not featured.'}
                </div>
              </div>
            </FormGroup>
            <FormGroup label="Starting view count">
              <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                <input className="input" type="number" min="0" style={{ width:120 }}
                  placeholder="0" value={form.manual_view_count || ''}
                  onChange={e => upd('manual_view_count', parseInt(e.target.value) || 0)} />
                <div style={{ fontSize:11, color:'var(--text3)' }}>
                  {form.manual_view_count > 0
                    ? `Displayed count will start at ${Number(form.manual_view_count).toLocaleString()} and grow from there`
                    : 'Optional boost. Organic watches add on top. Not visible as separate to users.'}
                </div>
              </div>
            </FormGroup>
          </ModalSection>
          */}
        </>
      )}

      {step === 1 && (
        <ModalSection title="Drama tags (select all that apply)">
          <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
            {ALL_TAGS.map(t => (
              <button key={t} onClick={() => toggleTag(t)} className={`chip${form.tags.includes(t)?' chip-active':''}`}>{t}</button>
            ))}
          </div>
          {form.tags.length > 0 && (
            <div style={{ marginTop:14, fontSize:12, color:'var(--text2)' }}>
              Selected: {form.tags.join(', ')}
            </div>
          )}
        </ModalSection>
      )}

      {step === 2 && (
        <ModalSection title={`Episodes (${episodes.length})`}>
          {episodes.length === 0 && !addingEp && (
            <div style={{ textAlign:'center', padding:'32px 0', color:'var(--text3)', fontSize:13 }}>
              No episodes yet. Add your first episode.
            </div>
          )}
          {episodes.map((ep, idx) => (
            <div key={ep.id} style={{ background:'var(--bg3)', border:'1px solid var(--border)', borderRadius:8, padding:'10px 12px', marginBottom:8, display:'flex', gap:10, alignItems:'center' }}>
              <div style={{ display:'flex', flexDirection:'column', gap:1 }}>
                <button className="icon-btn" onClick={() => moveEp(idx,-1)} disabled={idx===0}><ChevronUp size={11}/></button>
                <button className="icon-btn" onClick={() => moveEp(idx,1)} disabled={idx===episodes.length-1}><ChevronDown size={11}/></button>
              </div>
              <div style={{ width:26, height:26, borderRadius:5, background:'var(--bg4)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:600, color:'var(--text3)', flexShrink:0 }}>
                {ep.ep}
              </div>
              <div style={{ flex:1 }}>
                <div style={{ fontWeight:500, fontSize:13 }}>{ep.title}</div>
                <div style={{ fontSize:11, color:'var(--text3)' }}>
                  Ep {ep.ep} · {ep.duration || '—'} · {ep.is_free ? 'Free' : `${ep.coin_cost} coins`}
                  {' · '}
                  {ep.status === 'uploading'
                    ? <span style={{ color:'var(--accent2)' }}>uploading {ep.uploadProgress}%</span>
                    : ep.status === 'processing'
                    ? <span style={{ color:'var(--amber)' }}>processing</span>
                    : ep.video_source === 'YOUTUBE' 
                    ? <span style={{ color:'var(--green)' }}>ready (YouTube)</span>
                    : <span>{ep.status}</span>
                  }
                  {ep.video_source === 'YOUTUBE' && <span style={{ color:'var(--text3)', marginLeft:6 }}>· ▶️ YouTube</span>}
                  {ep.videoFile && <span style={{ color:'var(--text3)', marginLeft:6 }}>· 📹 {ep.videoFile.name}</span>}
                </div>
                {ep.status === 'uploading' && ep.uploadProgress !== undefined && (
                  <div style={{ marginTop:5, height:3, background:'var(--bg4)', borderRadius:2, overflow:'hidden' }}>
                    <div style={{ height:'100%', width:`${ep.uploadProgress}%`, background:'var(--accent)', borderRadius:2, transition:'width 0.3s' }} />
                  </div>
                )}
              </div>
              <div style={{ display:'flex', gap:5, alignItems:'center' }}>
                <span className={`badge ${ep.is_free?'badge-green':'badge-amber'}`} style={{ fontSize:10 }}>{ep.is_free?'Free':`${ep.coin_cost}¢`}</span>
                <button onClick={() => removeEp(ep.id)} className="btn btn-danger btn-sm"><Trash2 size={12}/></button>
              </div>
            </div>
          ))}
          {addingEp ? (
            <div style={{ background:'var(--bg3)', border:'1px solid var(--accent-border)', borderRadius:8, padding:14, marginTop:8 }}>
              <div style={{ fontSize:12, fontWeight:600, color:'var(--accent2)', marginBottom:12 }}>New Episode</div>
              <div style={{ display:'grid', gridTemplateColumns:'auto 1fr 1fr', gap:10, marginBottom:10 }}>
                <FormGroup label="Ep #">
                  <input className="input" style={{ width:60 }} type="number" value={episodes.length+1} disabled/>
                </FormGroup>
                <FormGroup label="Title *">
                  <input className="input" placeholder="Episode title" value={newEp.title} onChange={e => setNewEp(p=>({...p,title:e.target.value}))}/>
                </FormGroup>
                <FormGroup label={newEp.videoFile && newEp.duration ? "Duration (auto-detected)" : "Duration (mm:ss)"}>
                  <input className="input" placeholder="12:30" value={newEp.duration} onChange={e => setNewEp(p=>({...p,duration:e.target.value}))}
                    style={newEp.videoFile && newEp.duration ? { borderColor: 'var(--green)', color: 'var(--green)' } : {}} />
                </FormGroup>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:12 }}>
                <FormGroup label="Access">
                  <div style={{ display:'flex', gap:8 }}>
                    <button className={`chip${newEp.is_free?' chip-active':''}`} onClick={() => setNewEp(p=>({...p,is_free:true,coin_cost:0}))}>Free</button>
                    <button className={`chip${!newEp.is_free?' chip-active':''}`} onClick={() => setNewEp(p=>({...p,is_free:false,coin_cost:30}))}>Paid</button>
                  </div>
                </FormGroup>
                {!newEp.is_free && (
                  <FormGroup label="Coin cost">
                    <input className="input" type="number" placeholder="30" value={newEp.coin_cost} onChange={e => setNewEp(p=>({...p,coin_cost:parseInt(e.target.value)||0}))}/>
                  </FormGroup>
                )}
              </div>
              <FormGroup label="Video Source">
                <div style={{ display:'flex', gap:8, marginBottom:16 }}>
                  <button className={`chip${newEp.video_source === 'UPLOAD' ?' chip-active':''}`} onClick={() => setNewEp(p=>({...p, video_source:'UPLOAD'}))}>📁 Upload File</button>
                  <button className={`chip${newEp.video_source === 'YOUTUBE' ?' chip-active':''}`} onClick={() => setNewEp(p=>({...p, video_source:'YOUTUBE'}))}>▶️ YouTube Link</button>
                </div>
              </FormGroup>
              
              {newEp.video_source === 'UPLOAD' ? (
                <FormGroup label="Video file">
                  <VideoDropzone
                    file={newEp.videoFile}
                    uploadProgress={newEp.uploadProgress}
                    onFileChange={f => {
                      setNewEp(p => ({ ...p, videoFile: f, uploadProgress: 0 }))
                      if (f) {
                        const video = document.createElement('video')
                        video.preload = 'metadata'
                        video.onloadedmetadata = () => {
                          const totalSec = Math.round(video.duration)
                          const mins = Math.floor(totalSec / 60)
                          const secs = totalSec % 60
                          const formatted = `${mins}:${String(secs).padStart(2, '0')}`
                          setNewEp(p => ({ ...p, duration: formatted }))
                          URL.revokeObjectURL(video.src)
                        }
                        video.src = URL.createObjectURL(f)
                      }
                    }}
                  />
                </FormGroup>
              ) : (
                <FormGroup label="YouTube URL">
                  <input className="input" style={{ width: '100%', marginBottom: 8 }} placeholder="https://www.youtube.com/watch?v=..." value={newEp.raw_youtube_url} onChange={e => setNewEp(p=>({...p, raw_youtube_url: e.target.value}))}/>
                  {newEp.raw_youtube_url && extractYoutubeVideoId(newEp.raw_youtube_url) && (
                    <div style={{ marginTop: 8 }}>
                      <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>PREVIEW</div>
                      <img src={`https://img.youtube.com/vi/${extractYoutubeVideoId(newEp.raw_youtube_url)}/hqdefault.jpg`} style={{ width: 160, height: 90, borderRadius: 6, objectFit: 'cover' }} />
                    </div>
                  )}
                </FormGroup>
              )}
              <div style={{ display:'flex', gap:8, marginTop:12 }}>
                <button className="btn btn-primary" onClick={addEpisode} disabled={!newEp.title.trim()}>
                  <Plus size={13}/> Add Episode
                </button>
                <button className="btn btn-ghost" onClick={() => { 
                  intervalsRef.current.forEach(i => clearInterval(i))
                  intervalsRef.current = []
                  setAddingEp(false)
                  setNewEp(emptyEp) 
                }}>Cancel</button>
              </div>
            </div>
          ) : (
            <button className="btn btn-ghost" style={{ width:'100%', marginTop:8, justifyContent:'center', border:'1px dashed var(--border)' }} onClick={() => setAddingEp(true)}>
              <Plus size={14}/> Add Episode
            </button>
          )}
        </ModalSection>
      )}

      {step === 3 && (
        <ModalSection title="Review">
          <div style={{ background:'var(--bg3)', borderRadius:8, padding:16, marginBottom:14 }}>
            <div style={{ fontWeight:600, fontSize:15, marginBottom:4 }}>{form.title || '(No title)'}</div>
            <div style={{ fontSize:12, color:'var(--text3)', marginBottom:10 }}>{form.synopsis || '(No synopsis)'}</div>
            <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
              <span className="badge badge-blue">{form.category}</span>
              <span className={`badge ${form.status==='Published'?'badge-green':'badge-amber'}`}>{form.status}</span>
              {form.feed_position > 0 && <span className="badge badge-pink">★ For You #{form.feed_position}</span>}
            </div>
            {(form.thumbnailPreview || form.bannerPreview) && (
              <div style={{ display:'flex', gap:10, marginTop:12 }}>
                {form.thumbnailPreview && (
                  <div>
                    <div style={{ fontSize:10, color:'var(--text3)', marginBottom:4 }}>THUMBNAIL</div>
                    <img src={form.thumbnailPreview} alt="thumb" style={{ height:80, borderRadius:6, border:'1px solid var(--border)' }}/>
                  </div>
                )}
                {form.bannerPreview && (
                  <div>
                    <div style={{ fontSize:10, color:'var(--text3)', marginBottom:4 }}>BANNER</div>
                    <img src={form.bannerPreview} alt="banner" style={{ height:80, borderRadius:6, border:'1px solid var(--border)' }}/>
                  </div>
                )}
              </div>
            )}
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
            <div style={{ background:'var(--bg3)', padding:12, borderRadius:8 }}>
              <div style={{ color:'var(--text3)', fontSize:11, marginBottom:4 }}>EPISODES</div>
              <div style={{ fontWeight:600, fontSize:16 }}>{episodes.length}</div>
              <div style={{ fontSize:11, color:'var(--text3)' }}>{episodes.filter(e=>e.is_free).length} free · {episodes.filter(e=>!e.is_free).length} paid</div>
            </div>
            <div style={{ background:'var(--bg3)', padding:12, borderRadius:8 }}>
              <div style={{ color:'var(--text3)', fontSize:11, marginBottom:4 }}>TAGS</div>
              <div style={{ fontWeight:600, fontSize:16 }}>{form.tags.length} tags</div>
              <div style={{ fontSize:11, color:'var(--text3)' }}>Category: {form.category}</div>
            </div>
          </div>
          {form.tags.length > 0 && (
            <div style={{ marginTop:12 }}>
              <div style={{ fontSize:11, color:'var(--text3)', marginBottom:6 }}>TAGS</div>
              <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
                {form.tags.map(t => <span key={t} className={`badge ${tagColor[t]||'badge-blue'}`}>{t}</span>)}
              </div>
            </div>
          )}
        </ModalSection>
      )}
    </Modal>
  )
}

function StatsModal({ open, onClose, drama }) {
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open || !drama?.id) return
    setStats(null)
    setLoading(true)
    showsApi.getStats(drama.id)
      .then(res => setStats(res.data.data))
      .catch(() => setStats(null))
      .finally(() => setLoading(false))
  }, [open, drama?.id])

  if (!drama || !open) return null

  return (
    <Modal open={open} onClose={onClose} title={`Stats — ${drama.title}`} width={560}>
      {loading ? (
        <div style={{ textAlign:'center', padding:'30px 0', color:'var(--text3)', fontSize:13 }}>Loading stats…</div>
      ) : !stats ? (
        <div style={{ textAlign:'center', padding:'30px 0', color:'var(--text3)', fontSize:13 }}>Could not load stats.</div>
      ) : (
        <>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr 1fr', gap:10, marginBottom:20 }}>
            {[
              { label:'Total Views',      value:(stats.totalViews||0).toLocaleString(),      color:'var(--accent2)' },
              { label:'Episode Unlocks',  value:(stats.totalUnlocks||0).toLocaleString(),     color:'var(--amber)'  },
              { label:'Coins Generated',  value:`₵ ${(stats.totalCoinsSpent||0).toLocaleString()}`, color:'var(--green)'  },
              { label:'Users Unlocked',   value:(stats.uniqueUnlockers||0).toLocaleString(),  color:'var(--blue)'   },
            ].map(m => (
              <div key={m.label} style={{ background:'var(--bg3)', borderRadius:8, padding:14, textAlign:'center' }}>
                <div style={{ fontSize:11, color:'var(--text3)', marginBottom:6 }}>{m.label}</div>
                <div style={{ fontSize:16, fontWeight:700, color:m.color, fontFamily:'var(--mono)' }}>{m.value}</div>
              </div>
            ))}
          </div>

          <ModalSection title="Episode Performance">
            {stats.episodes?.length === 0 && (
              <div style={{ color:'var(--text3)', fontSize:13 }}>No episodes yet.</div>
            )}
            {stats.episodes?.length > 0 && (
              <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
                <thead>
                  <tr style={{ borderBottom:'1px solid var(--border)' }}>
                    <th style={{ textAlign:'left', padding:'6px 8px', color:'var(--text3)', fontWeight:500 }}>Episode</th>
                    <th style={{ textAlign:'center', padding:'6px 8px', color:'var(--text3)', fontWeight:500 }}>Users Unlocked</th>
                    <th style={{ textAlign:'right', padding:'6px 8px', color:'var(--text3)', fontWeight:500 }}>Coins Spent</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.episodes.map(ep => (
                    <tr key={ep.id} style={{ borderBottom:'1px solid var(--border)' }}>
                      <td style={{ padding:'8px', color:'var(--text2)' }}>
                        Ep {ep.episode_num}{ep.title ? ` — ${ep.title}` : ''} {ep.is_free ? '' : '🔒'}
                      </td>
                      <td style={{ padding:'8px', textAlign:'center', fontFamily:'var(--mono)', color:'var(--text)' }}>
                        {ep.unlocks.toLocaleString()}
                      </td>
                      <td style={{ padding:'8px', textAlign:'right', fontFamily:'var(--mono)', color:'var(--amber)' }}>
                        ₵ {ep.coins_spent.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </ModalSection>
        </>
      )}
    </Modal>
  )
}

function EditEpisodeModal({ open, onClose, drama, onSave }) {
  const [form, setForm] = useState({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open && drama?.selectedEpisode) {
      setForm({
        id: drama.selectedEpisode.id,
        title: drama.selectedEpisode.title || '',
        duration: drama.selectedEpisode.duration || '',
        is_free: drama.selectedEpisode.is_free ?? true,
        coin_cost: drama.selectedEpisode.coin_cost || 0,
      })
    }
  }, [open, drama?.selectedEpisode])

  const upd = (k, v) => setForm(p => ({ ...p, [k]: v }))

  const handleSave = async () => {
    if (!form.title.trim()) {
      alert('Episode title is required')
      return
    }
    setSaving(true)
    try {
      await onSave({
        ...drama.selectedEpisode,
        ...form,
      })
    } catch (err) {
      alert('Failed to save episode: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={`Edit Episode - ${form.title || ''}`} width={600}>
      <ModalSection title="Episode Details">
        <FormGroup label="Title *">
          <input 
            className="input" 
            style={{ width: '100%' }} 
            placeholder="Episode title"
            value={form.title || ''}
            onChange={e => upd('title', e.target.value)}
          />
        </FormGroup>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <FormGroup label="Duration">
            <input 
              className="input" 
              placeholder="MM:SS (e.g., 42:30)"
              value={form.duration || ''}
              onChange={e => upd('duration', e.target.value)}
            />
          </FormGroup>
          <FormGroup label="Type">
            <select 
              className="select"
              value={form.is_free ? 'free' : 'paid'}
              onChange={e => upd('is_free', e.target.value === 'free')}
            >
              <option value="free">Free</option>
              <option value="paid">Paid</option>
            </select>
          </FormGroup>
        </div>
        {!form.is_free && (
          <FormGroup label="Coin Cost">
            <input 
              className="input" 
              type="number"
              placeholder="0"
              min="0"
              value={form.coin_cost || 0}
              onChange={e => upd('coin_cost', parseInt(e.target.value) || 0)}
            />
          </FormGroup>
        )}
      </ModalSection>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 20 }}>
        <button className="btn btn-ghost" onClick={onClose} disabled={saving}>Cancel</button>
        <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>
    </Modal>
  )
}


function ViewCountModal({ open, onClose, drama, onSave }) {
  const [countToAdd, setCountToAdd] = useState('')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (open) { setCountToAdd(''); setNote(''); setError(''); setSaving(false) }
  }, [open])

  const handleSubmit = async () => {
    setError('')
    const delta = parseInt(countToAdd, 10)
    if (!delta || delta <= 0) { setError('Enter a positive number'); return }
    if (!note.trim()) { setError('A reason is required'); return }
    setSaving(true)
    try {
      await onSave(drama.id, { count_to_add: delta, note: note.trim() })
      onClose()
    } catch (err) {
      setError(err?.response?.data?.error || err?.response?.data?.message || 'Failed to adjust view count')
    } finally { setSaving(false) }
  }

  if (!open || !drama) return null

  const currentDisplayed = (drama.view_count || 0)
  const preview = currentDisplayed + (parseInt(countToAdd, 10) || 0)

  return (
    <Modal open={open} onClose={onClose} title={`Adjust View Count — ${drama.title}`} width={480}
      footer={
        <>
          <button className="btn btn-ghost" onClick={onClose} disabled={saving}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSubmit} disabled={saving}>
            {saving ? 'Saving...' : 'Apply Adjustment'}
          </button>
        </>
      }
    >
      <ModalSection title="Current count">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 4 }}>
          <div style={{ background: 'var(--bg3)', borderRadius: 8, padding: 14, textAlign: 'center' }}>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>DISPLAYED NOW</div>
            <div style={{ fontSize: 22, fontWeight: 700, fontFamily: 'var(--mono)', color: 'var(--accent2)' }}>
              {currentDisplayed.toLocaleString()}
            </div>
          </div>
          <div style={{ background: 'var(--bg3)', borderRadius: 8, padding: 14, textAlign: 'center' }}>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>AFTER ADJUSTMENT</div>
            <div style={{ fontSize: 22, fontWeight: 700, fontFamily: 'var(--mono)', color: parseInt(countToAdd) > 0 ? 'var(--green)' : 'var(--text3)' }}>
              {preview.toLocaleString()}
            </div>
          </div>
        </div>
      </ModalSection>

      <ModalSection title="Adjustment">
        <FormGroup label="Count to add *">
          <input
            className="input"
            type="number"
            min="1"
            placeholder="e.g. 10000"
            value={countToAdd}
            onChange={e => setCountToAdd(e.target.value)}
            style={{ width: '100%' }}
          />
          <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>Positive integers only. Added on top of the current count.</div>
        </FormGroup>
        <FormGroup label="Reason / note *">
          <input
            className="input"
            placeholder="e.g. Launch boost for featured show"
            value={note}
            onChange={e => setNote(e.target.value)}
            style={{ width: '100%' }}
          />
          <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>Stored in audit log. Not shown to users.</div>
        </FormGroup>
        {error && (
          <div style={{ marginTop: 8, padding: '8px 12px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 6, fontSize: 12, color: 'var(--red)' }}>
            {error}
          </div>
        )}
      </ModalSection>
    </Modal>
  )
}

export default function Dramas() {
  const { dramas, categories, loading, createDrama, updateDrama, deleteDrama: apiDeleteDrama, togglePublish: apiTogglePublish, reload } = useDramas()
  const ALL_CATEGORIES = categories.map(c => c.name)
  const [q, setQ] = useState('')
  const [catF, setCatF] = useState('All')
  const [statusF, setStatusF] = useState('All')
  const [modal, setModal] = useState(null)
  const [selected, setSelected] = useState(null)
  const [expandedDramaId, setExpandedDramaId] = useState(null)
  const [vcModal, setVcModal] = useState(false)
  const [vcDrama, setVcDrama] = useState(null)

  const filtered = dramas.filter(d => {
    const m = d.title.toLowerCase().includes(q.toLowerCase()) || (d.tags||[]).some(t => t.toLowerCase().includes(q.toLowerCase()))
    const c = catF==='All' || d.category===catF
    const s = statusF==='All' || d.status===statusF
    return m && c && s
  })

  const saveDrama = async (data) => {
    try {
      if (data.id && dramas.find(d => d.id === data.id)) {
        await updateDrama(data.id, data)
      } else {
        await createDrama(data)
      }
    } catch (err) {
      const errData = err.response?.data
      const msg = errData?.details ? errData.details.map(d => `${d.field}: ${d.message}`).join('\n') : errData?.error || err.message || 'Failed to save drama'
      alert(msg)
    }
  }
  const handleDelete = async (id) => {
    try { await apiDeleteDrama(id) } catch { alert('Failed to delete') }
    setModal(null)
  }
  const adjustViewCount = async (showId, data) => {
    await showsApi.adjustViewCount(showId, data)
    await reload()
  }

  const togglePublish = async (id) => {
    try { await apiTogglePublish(id) } catch { alert('Failed to toggle') }
  }

  const open = (m, d=null) => { setModal(m); setSelected(d) }

  if (loading) {
    return (
      <div className="page-enter" style={{ display:'flex', justifyContent:'center', alignItems:'center', height:'50vh' }}>
        <Loader size={24} className="spin" style={{ color:'var(--accent2)' }}/>
        <span style={{ marginLeft:10, color:'var(--text3)' }}>Loading dramas...</span>
      </div>
    )
  }

  return (
    <div className="page-enter">
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
        <div>
          <div style={{ fontWeight:600 }}>{dramas.length} dramas total</div>
          <div style={{ fontSize:12, color:'var(--text3)' }}>{dramas.filter(d=>d.status==='Published').length} published · {dramas.filter(d=>d.status==='Draft').length} drafts</div>
        </div>
        <button className="btn btn-primary" onClick={() => open('add')}><Plus size={14}/> Add Drama</button>
      </div>

      <div className="metrics-grid" style={{ gridTemplateColumns:'repeat(4,1fr)', marginBottom:16 }}>
        {[
          { label:'Total Dramas', value:dramas.length, sub:`${dramas.filter(d=>d.episodes.some(e=>!e.is_free)).length} with paid episodes`, color:'var(--accent2)' },
          { label:'Total Episodes', value:dramas.reduce((a,d)=>a+d.episodes.length,0), sub:'across all dramas', color:'var(--text)' },
          { label:'Total Views', value: (() => { const t = dramas.reduce((a,d)=>a+(d.views||0),0); return t >= 1_000_000 ? `${(t/1_000_000).toFixed(1)}M` : t >= 1_000 ? `${(t/1_000).toFixed(1)}K` : t.toString() })(), sub:'all-time combined', color:'var(--green)' },
          { label:'Coin Unlocks', value:dramas.reduce((a,d)=>a+(d.unlocks||0),0).toLocaleString(), sub:'episodes unlocked', color:'var(--amber)' },
        ].map(m => (
          <div className="metric-card" key={m.label}>
            <div className="metric-label">{m.label}</div>
            <div className="metric-value" style={{ fontSize:22, color:m.color }}>{m.value}</div>
            <div className="metric-sub">{m.sub}</div>
          </div>
        ))}
      </div>

      <div className="search-row">
        <div className="search-wrap">
          <Search size={14} className="search-icon"/>
          <input className="input" style={{ paddingLeft:32 }} placeholder="Search dramas, tags…" value={q} onChange={e=>setQ(e.target.value)}/>
        </div>
        <select className="select" value={catF} onChange={e=>setCatF(e.target.value)}>
          <option>All</option>{ALL_CATEGORIES.map(c=><option key={c}>{c}</option>)}
        </select>
        <select className="select" value={statusF} onChange={e=>setStatusF(e.target.value)}>
          <option>All</option><option>Published</option><option>Draft</option>
        </select>
      </div>

      <div className="card" style={{ padding:0 }}>
        <div style={{ display:'flex', flexDirection:'column', gap:0 }}>
          {filtered.length === 0 ? (
            <div style={{ textAlign:'center', color:'var(--text3)', padding:'40px 20px' }}>No dramas found</div>
          ) : (
            filtered.map(d => {
              const isExpanded = expandedDramaId === d.id
              return (
                <div key={d.id}>
                  {/* Drama Row */}
                  <div
                    onClick={() => setExpandedDramaId(isExpanded ? null : d.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 16,
                      padding: '16px 20px',
                      borderBottom: '1px solid var(--border)',
                      cursor: 'pointer',
                      background: 'var(--bg)',
                      transition: 'background 0.2s',
                      ':hover': { background: 'var(--bg2)' }
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--bg2)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'var(--bg)'}
                  >
                    {/* Expand/Collapse Chevron */}
                    <div style={{ flexShrink: 0, color: 'var(--text3)', display: 'flex', alignItems: 'center' }}>
                      {isExpanded ? <ChevronDown size={18} /> : <ChevronUp size={18} style={{ transform: 'rotate(180deg)' }} />}
                    </div>

                    {/* Drama Info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                        <div style={{ fontWeight: 500, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '300px' }}>{d.title}</div>
                        {d.feed_position > 0 && <div style={{ fontSize: 10, color: 'var(--accent2)', whiteSpace: 'nowrap', flexShrink: 0 }}>★ For You #{d.feed_position}</div>}
                      </div>
                      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', fontSize: 11 }}>
                        <span className="badge badge-blue" style={{ fontSize: 10, overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '120px' }}>{d.category}</span>
                        <div style={{ color: 'var(--text3)' }}>{d.episodes.length} episodes {d.episodes.filter(e=>!e.is_free).length > 0 && `· ${d.episodes.filter(e=>!e.is_free).length} paid`}</div>
                        {d.tags.slice(0, 2).map(t => <span key={t} className={`badge ${tagColor[t]||'badge-blue'}`} style={{ fontSize: 10, overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100px' }}>{t}</span>)}
                        {d.tags.length > 2 && <span className="badge badge-blue" style={{ fontSize: 10, flexShrink: 0 }}>+{d.tags.length-2}</span>}
                      </div>
                    </div>

                    {/* Summary Stats */}
                    <div style={{ display: 'flex', gap: 24, alignItems: 'center', minWidth: 'fit-content', flexShrink: 0 }}>
                      {d.rating_avg > 0 ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, minWidth: 'fit-content' }}>
                          <Star size={12} fill="var(--amber)" color="var(--amber)"/>
                          <span style={{ fontFamily: 'var(--mono)', fontSize: 12 }}>{d.rating_avg}</span>
                          <span style={{ fontSize: 10, color: 'var(--text3)' }}>({d.rating_count})</span>
                        </div>
                      ) : <span style={{ color: 'var(--text3)', fontSize: 11 }}>—</span>}
                      <div style={{ textAlign: 'right', minWidth: 50 }}>
                        <div style={{ fontFamily: 'var(--mono)', fontSize: 12 }}>{(() => { const v = d.views||0; return v >= 1_000_000 ? `${(v/1_000_000).toFixed(1)}M` : v >= 1_000 ? `${(v/1_000).toFixed(1)}K` : v.toString() })()}</div>
                        <div style={{ fontSize: 10, color: 'var(--text3)' }}>views</div>
                      </div>
                      <span className={`badge ${d.status==='Published'?'badge-green':'badge-amber'}`} style={{ minWidth: 'fit-content' }}>{d.status}</span>
                    </div>

                    {/* Drama Action Buttons */}
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0, marginLeft: 16 }}>
                      <button className="btn btn-ghost btn-sm" onClick={() => open('edit', d)} title="Edit drama details"><Edit2 size={11}/></button>
                      <button className="btn btn-ghost btn-sm" onClick={() => open('add-ep', d)} style={{ color: 'var(--accent2)' }} title="Add new episode"><Plus size={11}/></button>
                      <button className="btn btn-ghost btn-sm" onClick={() => open('stats', d)} title="View analytics"><BarChart2 size={11}/></button>
                      <button className="btn btn-ghost btn-sm" onClick={e => { e.stopPropagation(); setVcDrama(d); setVcModal(true) }} title="Adjust view count" style={{ color: 'var(--green)' }}><TrendingUp size={11}/></button>
                      <button className={`btn btn-sm ${d.status==='Published'?'btn-danger':'btn-primary'}`} onClick={() => togglePublish(d.id)} style={{ fontSize: 10, whiteSpace: 'nowrap' }} title={d.status==='Published' ? 'Unpublish drama' : 'Publish drama'}>
                        {d.status==='Published'?'Unpublish':'Publish'}
                      </button>
                      <button className="btn btn-danger btn-sm" onClick={() => open('delete', d)} title="Delete drama"><Trash2 size={11}/></button>
                    </div>
                  </div>

                  {/* Episodes List - Expanded View */}
                  {isExpanded && (
                    <div style={{ background: 'var(--bg3)', padding: '0 20px', borderBottom: '1px solid var(--border)' }}>
                      {d.episodes.length === 0 ? (
                        <div style={{ padding: '20px', color: 'var(--text3)', textAlign: 'center', fontSize: 12 }}>No episodes yet</div>
                      ) : (
                        <div style={{ 
                          display: 'flex', 
                          flexDirection: 'column', 
                          gap: 0,
                          maxHeight: '400px',
                          overflowY: 'auto',
                          paddingRight: '4px',
                          scrollBehavior: 'smooth'
                        }}>
                          {d.episodes.map((ep, idx) => (
                            <div
                              key={ep.id}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 16,
                                padding: '12px 0',
                                borderTop: idx === 0 ? 'none' : '1px solid var(--border)',
                              }}
                            >
                              {/* Episode Number */}
                              <div style={{ minWidth: 40, flexShrink: 0, color: 'var(--text3)', fontSize: 11, fontWeight: 500, fontFamily: 'var(--mono)' }}>
                                EP {ep.ep}
                              </div>

                              {/* Episode Info */}
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontWeight: 500, fontSize: 13, marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ep.title}</div>
                                <div style={{ display: 'flex', gap: 12, fontSize: 11, color: 'var(--text3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  <span>{ep.duration || '—'}</span>
                                  {ep.is_free ? <span style={{ color: 'var(--green)', flexShrink: 0 }}>Free</span> : <span style={{ color: 'var(--amber)', flexShrink: 0 }}>₹{ep.coin_cost}</span>}
                                </div>
                              </div>

                              {/* Episode Status */}
                              <div style={{ minWidth: 80, flexShrink: 0 }}>
                                <span className={`badge ${
                                  ep.status === 'published' ? 'badge-green' : 
                                  ep.status === 'draft' ? 'badge-amber' :
                                  ep.status === 'processing' ? 'badge-blue' :
                                  ep.status === 'uploading' ? 'badge-blue' :
                                  'badge-red'
                                }`} style={{ fontSize: 10, textTransform: 'capitalize' }}>
                                  {ep.status}
                                </span>
                              </div>

                              {/* Views */}
                              <div style={{ minWidth: 60, textAlign: 'right', flexShrink: 0 }}>
                                <div style={{ fontFamily: 'var(--mono)', fontSize: 12 }}>{ep.views ? (ep.views/1000).toFixed(0) : '0'}K</div>
                                <div style={{ fontSize: 10, color: 'var(--text3)' }}>views</div>
                              </div>

                              {/* Episode Actions */}
                              <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                                <button className="btn btn-ghost btn-sm" onClick={() => open('edit-ep', { ...d, selectedEpisode: ep })} title="Edit episode">
                                  <Edit2 size={11}/>
                                </button>
                                <button className="btn btn-danger btn-sm" onClick={() => open('delete-ep', { ...d, selectedEpisode: ep })} title="Delete episode">
                                  <Trash2 size={11}/>
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>
      </div>

      <DramaModal open={modal==='add'} onClose={() => setModal(null)} onSave={saveDrama} initial={null} categories={categories}/>
      <DramaModal open={modal==='edit'} onClose={() => setModal(null)} onSave={saveDrama} initial={selected} categories={categories}/>
      <DramaModal open={modal==='add-ep'} onClose={() => setModal(null)} onSave={async (data) => {
        try {
          await updateDrama(selected.id, data)
          alert('Episode(s) added successfully!')
          await reload()
        } catch (err) {
          const errData = err.response?.data
          const msg = errData?.details ? errData.details.map(d => `${d.field}: ${d.message}`).join('\n') : errData?.error || err.message
          alert('Failed: ' + msg)
        }
      }} initial={selected} initialStep={2} autoAddEp={true} categories={categories}/>
      <StatsModal open={modal==='stats'} onClose={() => setModal(null)} drama={selected}/>
      <ConfirmDialog open={modal==='delete'} title="Delete Drama" danger
        message={`Permanently delete "${selected?.title}"? This will remove all episodes. This cannot be undone.`}
        onConfirm={() => handleDelete(selected?.id)} onCancel={() => setModal(null)}
      />
      
      {/* Edit Episode Modal */}
      <EditEpisodeModal open={modal==='edit-ep'} onClose={() => setModal(null)} drama={selected} onSave={async (episodeData) => {
        try {
          // Call episodesApi.update directly with the correct data structure
          await episodesApi.update(episodeData.id, {
            title: episodeData.title,
            episode_num: episodeData.ep,
            is_free: episodeData.is_free,
            coin_cost: episodeData.coin_cost,
            duration_sec: durationToSeconds(episodeData.duration),
          })
          alert('Episode updated successfully!')
          await reload()
          setModal(null)
        } catch (err) {
          alert('Failed to update episode: ' + (err.response?.data?.error || err.message))
        }
      }} />

      <ViewCountModal open={vcModal} onClose={() => { setVcModal(false); setVcDrama(null) }} drama={vcDrama} onSave={adjustViewCount} />

      {/* Delete Episode Confirmation */}
      <ConfirmDialog 
        open={modal==='delete-ep'} 
        title="Delete Episode" 
        danger
        message={`Permanently delete episode "${selected?.selectedEpisode?.title}"? This cannot be undone.`}
        onConfirm={async () => {
          try {
            await episodesApi.delete(selected?.selectedEpisode?.id)
            alert('Episode deleted successfully!')
            await reload()
            setModal(null)
          } catch (err) {
            alert('Failed to delete episode: ' + (err.response?.data?.error || err.message))
          }
        }}
        onCancel={() => setModal(null)}
      />
    </div>
  )
}