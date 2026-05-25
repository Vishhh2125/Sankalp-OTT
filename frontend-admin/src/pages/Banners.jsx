import { useState, useEffect, useCallback } from 'react'
import { Plus, Edit2, Trash2, RefreshCw, AlertCircle } from 'lucide-react'
import Modal, { FormGroup, ModalSection } from '../components/ui/Modal.jsx'
import { Toggle, ConfirmDialog } from '../components/ui/Controls.jsx'
import { bannersApi, showsApi } from '../services/api.js'

// ─── Banner Modal ──────────────────────────────────────────────────────────────
function BannerModal({ open, onClose, onSave, initial, shows, showsLoading }) {
  const isEdit = !!initial?.id

  const emptyForm = { title: '', show_id: '', is_active: true, starts_at: '', ends_at: '' }
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  // Sync form when modal opens/initial changes
  useEffect(() => {
    if (open) {
      setError(null)
      if (isEdit && initial) {
        setForm({
          title: initial.title || '',
          show_id: initial.show_id || '',
          is_active: initial.is_active ?? true,
          starts_at: initial.starts_at || '',
          ends_at: initial.ends_at || '',
        })
      } else {
        setForm(emptyForm)
      }
    }
  }, [open, initial?.id]) // eslint-disable-line

  const upd = (k, v) => setForm(p => ({ ...p, [k]: v }))

  // Derive preview from the selected show's banner_url
  const selectedShow = shows.find(s => s.id === form.show_id)
  const previewUrl = selectedShow?.banner_url || null

  const handleSave = async () => {
    if (!form.title.trim()) { setError('Title is required'); return }
    if (!form.show_id) { setError('Please select a linked show'); return }
    if (!selectedShow?.banner_url) {
      setError('The selected show has no banner image uploaded yet. Upload a banner image for that show first.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const payload = {
        title: form.title.trim(),
        show_id: form.show_id,
        is_active: form.is_active,
        starts_at: form.starts_at || null,
        ends_at: form.ends_at || null,
      }
      await onSave(payload)
      onClose()
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to save banner. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  if (!open) return null

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? `Edit — ${initial.title}` : 'Add Banner'}
      width={520}
      footer={
        <>
          <button className="btn btn-ghost" onClick={onClose} disabled={saving}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Create'}
          </button>
        </>
      }
    >
      {error && (
        <div style={{
          display: 'flex', alignItems: 'flex-start', gap: 8,
          background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.35)',
          borderRadius: 8, padding: '10px 12px', marginBottom: 16, fontSize: 13,
          color: 'var(--danger, #ef4444)',
        }}>
          <AlertCircle size={15} style={{ flexShrink: 0, marginTop: 1 }} />
          <span>{error}</span>
        </div>
      )}

      <ModalSection title="Banner details">
        <FormGroup label="Title *">
          <input
            className="input"
            style={{ width: '100%' }}
            placeholder="e.g. New Drama Launch"
            value={form.title}
            onChange={e => upd('title', e.target.value)}
          />
        </FormGroup>

        <FormGroup label="Linked show">
          {showsLoading ? (
            <div style={{ fontSize: 13, color: 'var(--text3)', padding: '8px 0' }}>Loading shows…</div>
          ) : (
            <select
              className="select"
              style={{ width: '100%' }}
              value={form.show_id}
              onChange={e => { upd('show_id', e.target.value); setError(null) }}
            >
              <option value="">Select a show…</option>
              {shows.map(s => (
                <option key={s.id} value={s.id}>{s.title}</option>
              ))}
            </select>
          )}
        </FormGroup>

        {form.show_id && !previewUrl && (
          <div style={{
            fontSize: 12, color: 'var(--warning, #f59e0b)',
            background: 'rgba(245,158,11,0.1)', borderRadius: 6,
            padding: '8px 10px', marginTop: 4,
          }}>
            ⚠️ This show has no banner image yet. Upload one in the Dramas section first.
          </div>
        )}

        {previewUrl && (
          <FormGroup label="Banner preview">
            <div style={{ borderRadius: 8, overflow: 'hidden', border: '1px solid var(--border)' }}>
              <img
                src={previewUrl}
                alt="banner preview"
                style={{ width: '100%', height: 'auto', display: 'block', maxHeight: 200, objectFit: 'cover' }}
              />
            </div>
          </FormGroup>
        )}
      </ModalSection>

      <ModalSection title="Display settings">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <FormGroup label="Start date">
            <input
              className="input"
              type="date"
              value={form.starts_at || ''}
              onChange={e => upd('starts_at', e.target.value)}
            />
          </FormGroup>
          <FormGroup label="End date">
            <input
              className="input"
              type="date"
              value={form.ends_at || ''}
              onChange={e => upd('ends_at', e.target.value)}
            />
          </FormGroup>
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', marginTop: 12 }}>
          <Toggle on={form.is_active} onChange={v => upd('is_active', v)} />
          <span style={{ fontSize: 13 }}>Active (visible on the app)</span>
        </label>
      </ModalSection>
    </Modal>
  )
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function Banners() {
  const [banners, setBanners] = useState([])
  const [shows, setShows] = useState([])
  const [loading, setBannerLoading] = useState(true)
  const [showsLoading, setShowsLoading] = useState(true)
  const [fetchError, setFetchError] = useState(null)

  const [modal, setModal] = useState(null)   // 'add' | 'edit' | null
  const [selected, setSelected] = useState(null)
  const [confirm, setConfirm] = useState(null)

  // ── Fetch all banners ──
  const fetchBanners = useCallback(async () => {
    setBannerLoading(true)
    setFetchError(null)
    try {
      const res = await bannersApi.getAll()
      setBanners(res.data?.data?.banners || [])
    } catch (err) {
      setFetchError(err?.response?.data?.message || 'Failed to load banners')
    } finally {
      setBannerLoading(false)
    }
  }, [])

  // ── Fetch shows list for dropdown ──
  const fetchShows = useCallback(async () => {
    setShowsLoading(true)
    try {
      const res = await showsApi.getAll({ limit: 200 })
      // API returns { data: { shows: [...] } } or similar — handle both shapes
      // content service returns { items, total, page, limit } directly (no data wrapper)
      const raw = res.data?.items || res.data?.data?.shows || res.data?.shows || []
      setShows(Array.isArray(raw) ? raw : [])
    } catch {
      // non-fatal — dropdown will be empty but user sees a warning
      setShows([])
    } finally {
      setShowsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchBanners()
    fetchShows()
  }, [fetchBanners, fetchShows])

  // ── CRUD handlers ──
  const handleCreate = async (payload) => {
    const res = await bannersApi.create(payload)
    const created = res.data?.data
    if (created) setBanners(p => [created, ...p])
    else await fetchBanners()
  }

  const handleUpdate = async (payload) => {
    const res = await bannersApi.update(selected.id, payload)
    const updated = res.data?.data
    if (updated) setBanners(p => p.map(b => b.id === updated.id ? updated : b))
    else await fetchBanners()
  }

  const handleToggle = async (id) => {
    // Optimistic update
    setBanners(p => p.map(b => b.id === id ? { ...b, is_active: !b.is_active } : b))
    try {
      await bannersApi.toggle(id)
    } catch {
      // Revert on failure
      setBanners(p => p.map(b => b.id === id ? { ...b, is_active: !b.is_active } : b))
    }
  }

  const handleDelete = async (id) => {
    try {
      await bannersApi.delete(id)
      setBanners(p => p.filter(b => b.id !== id))
    } catch (err) {
      alert(err?.response?.data?.message || 'Failed to delete banner')
    } finally {
      setConfirm(null)
    }
  }

  const openAdd = () => { setSelected(null); setModal('add') }
  const openEdit = (b) => { setSelected(b); setModal('edit') }

  return (
    <div className="page-enter">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <div style={{ fontWeight: 600 }}>Homepage banners</div>
          <div style={{ fontSize: 12, color: 'var(--text3)' }}>
            {loading
              ? 'Loading…'
              : `${banners.length} total · ${banners.filter(b => b.is_active).length} active`}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-ghost" onClick={fetchBanners} title="Refresh">
            <RefreshCw size={14} />
          </button>
          <button className="btn btn-primary" onClick={openAdd}>
            <Plus size={14} /> Add banner
          </button>
        </div>
      </div>

      {/* Error state */}
      {fetchError && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
          borderRadius: 8, padding: '12px 16px', marginBottom: 16, fontSize: 13,
          color: 'var(--danger, #ef4444)',
        }}>
          <AlertCircle size={15} />
          {fetchError}
          <button className="btn btn-ghost btn-sm" onClick={fetchBanners} style={{ marginLeft: 'auto' }}>
            Retry
          </button>
        </div>
      )}

      {/* Table */}
      <div className="card" style={{ padding: 0 }}>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Preview</th>
                <th>Title</th>
                <th>Linked to</th>
                <th>Schedule</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', color: 'var(--text3)', padding: '40px 0' }}>
                    Loading banners…
                  </td>
                </tr>
              )}

              {!loading && banners.length === 0 && !fetchError && (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', color: 'var(--text3)', padding: '40px 0' }}>
                    No banners yet — click <strong>Add banner</strong> to create one
                  </td>
                </tr>
              )}

              {!loading && banners.map(b => (
                <tr key={b.id}>
                  {/* Thumbnail */}
                  <td style={{ width: 80 }}>
                    {b.image_url ? (
                      <img
                        src={b.image_url}
                        alt={b.title}
                        style={{ width: 72, height: 40, objectFit: 'cover', borderRadius: 4, display: 'block' }}
                        onError={e => { e.target.style.display = 'none' }}
                      />
                    ) : (
                      <div style={{
                        width: 72, height: 40, borderRadius: 4,
                        background: 'var(--surface2)', display: 'flex',
                        alignItems: 'center', justifyContent: 'center',
                        fontSize: 10, color: 'var(--text3)',
                      }}>
                        No img
                      </div>
                    )}
                  </td>

                  <td style={{ fontWeight: 500 }}>{b.title}</td>

                  <td style={{ color: 'var(--text2)', fontSize: 12 }}>
                    {b.show_name || <span style={{ color: 'var(--text3)' }}>—</span>}
                  </td>

                  <td style={{ fontSize: 11, color: 'var(--text3)' }}>
                    {b.starts_at && b.ends_at
                      ? `${b.starts_at} → ${b.ends_at}`
                      : 'Always'}
                  </td>

                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span className={`badge ${b.is_active ? 'badge-green' : 'badge-amber'}`}>
                        {b.is_active ? 'Active' : 'Inactive'}
                      </span>
                      <Toggle on={b.is_active} onChange={() => handleToggle(b.id)} />
                    </div>
                  </td>

                  <td>
                    <div style={{ display: 'flex', gap: 5 }}>
                      <button className="btn btn-ghost btn-sm" onClick={() => openEdit(b)}>
                        <Edit2 size={11} /> Edit
                      </button>
                      <button
                        className="btn btn-danger btn-sm"
                        onClick={() => setConfirm({ id: b.id, name: b.title })}
                      >
                        <Trash2 size={11} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modals */}
      <BannerModal
        open={modal === 'add'}
        onClose={() => setModal(null)}
        onSave={handleCreate}
        initial={null}
        shows={shows}
        showsLoading={showsLoading}
      />
      <BannerModal
        open={modal === 'edit'}
        onClose={() => setModal(null)}
        onSave={handleUpdate}
        initial={selected}
        shows={shows}
        showsLoading={showsLoading}
      />
      <ConfirmDialog
        open={!!confirm}
        danger
        title="Delete Banner"
        message={`Remove "${confirm?.name}" permanently? This cannot be undone.`}
        onConfirm={() => handleDelete(confirm.id)}
        onCancel={() => setConfirm(null)}
      />
    </div>
  )
}
