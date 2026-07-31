import { useState, useEffect, useCallback } from 'react'
import { Plus, Edit2, Trash2, RefreshCw, AlertCircle, ChevronUp, ChevronDown } from 'lucide-react'
import Modal, { FormGroup, ModalSection } from '../components/ui/Modal.jsx'
import { Toggle, ConfirmDialog } from '../components/ui/Controls.jsx'
import { heroBannersApi, showsApi } from '../services/api.js'

function orderLabel(order) {
  const n = Number(order)
  if (!Number.isFinite(n) || n < 1) return '—'
  const suffix = n === 1 ? 'st' : n === 2 ? 'nd' : n === 3 ? 'rd' : 'th'
  return `${n}${suffix}`
}

function HeroBannerModal({ open, onClose, onSave, initial, shows, showsLoading }) {
  const isEdit = !!initial?.id

  const emptyForm = { title: '', show_id: '', is_active: true, starts_at: '', ends_at: '' }
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

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
      setError(err?.response?.data?.message || 'Failed to save hero banner. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  if (!open) return null

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? `Edit — ${initial.title}` : 'Add Hero Banner'}
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

      <ModalSection title="Hero banner details">
        <FormGroup label="Title *">
          <input
            className="input"
            style={{ width: '100%' }}
            placeholder="e.g. Featured Drama"
            value={form.title}
            onChange={e => upd('title', e.target.value)}
          />
        </FormGroup>

        <FormGroup label="Linked course">
          {showsLoading ? (
            <div style={{ fontSize: 13, color: 'var(--text3)', padding: '8px 0' }}>Loading courses…</div>
          ) : (
            <select
              className="select"
              style={{ width: '100%' }}
              value={form.show_id}
              onChange={e => { upd('show_id', e.target.value); setError(null) }}
            >
              <option value="">Select a course…</option>
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
            This show has no banner image yet. Upload one in the Courses section first.
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
          <span style={{ fontSize: 13 }}>Active (visible in home hero slider)</span>
        </label>
      </ModalSection>
    </Modal>
  )
}

export default function HeroBanners() {
  const [banners, setBanners] = useState([])
  const [shows, setShows] = useState([])
  const [loading, setLoading] = useState(true)
  const [showsLoading, setShowsLoading] = useState(true)
  const [fetchError, setFetchError] = useState(null)
  const [reordering, setReordering] = useState(false)

  const [modal, setModal] = useState(null)
  const [selected, setSelected] = useState(null)
  const [confirm, setConfirm] = useState(null)

  const fetchBanners = useCallback(async () => {
    setLoading(true)
    setFetchError(null)
    try {
      const res = await heroBannersApi.getAll()
      setBanners(res.data?.data?.banners || [])
    } catch (err) {
      setFetchError(err?.response?.data?.message || 'Failed to load hero banners')
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchShows = useCallback(async () => {
    setShowsLoading(true)
    try {
      const res = await showsApi.getAll({ limit: 200 })
      const raw = res.data?.items || res.data?.data?.shows || res.data?.shows || []
      setShows(Array.isArray(raw) ? raw : [])
    } catch {
      setShows([])
    } finally {
      setShowsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchBanners()
    fetchShows()
  }, [fetchBanners, fetchShows])

  const handleCreate = async (payload) => {
    const res = await heroBannersApi.create(payload)
    const created = res.data?.data
    if (created) await fetchBanners()
    else await fetchBanners()
  }

  const handleUpdate = async (payload) => {
    const res = await heroBannersApi.update(selected.id, payload)
    const updated = res.data?.data
    if (updated) setBanners(p => p.map(b => b.id === updated.id ? updated : b))
    else await fetchBanners()
  }

  const handleToggle = async (id) => {
    setBanners(p => p.map(b => b.id === id ? { ...b, is_active: !b.is_active } : b))
    try {
      await heroBannersApi.toggle(id)
    } catch {
      setBanners(p => p.map(b => b.id === id ? { ...b, is_active: !b.is_active } : b))
    }
  }

  const handleDelete = async (id) => {
    try {
      await heroBannersApi.delete(id)
      setBanners(p => p.filter(b => b.id !== id))
      await fetchBanners()
    } catch (err) {
      alert(err?.response?.data?.message || 'Failed to delete hero banner')
    } finally {
      setConfirm(null)
    }
  }

  const moveBanner = async (index, direction) => {
    const targetIndex = index + direction
    if (targetIndex < 0 || targetIndex >= banners.length) return

    const reordered = [...banners]
    const temp = reordered[index]
    reordered[index] = reordered[targetIndex]
    reordered[targetIndex] = temp

    const orderedIds = reordered.map(b => b.id)
    setBanners(reordered.map((b, i) => ({ ...b, display_order: i + 1 })))
    setReordering(true)
    try {
      const res = await heroBannersApi.reorder(orderedIds)
      const updated = res.data?.data?.banners
      if (updated) setBanners(updated)
      else await fetchBanners()
    } catch {
      await fetchBanners()
    } finally {
      setReordering(false)
    }
  }

  const openAdd = () => { setSelected(null); setModal('add') }
  const openEdit = (b) => { setSelected(b); setModal('edit') }

  return (
    <div className="page-enter">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <div style={{ fontWeight: 600 }}>Hero section banners</div>
          <div style={{ fontSize: 12, color: 'var(--text3)' }}>
            {loading
              ? 'Loading…'
              : `${banners.length} total · ${banners.filter(b => b.is_active).length} active · order controls position in home slider`}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-ghost" onClick={fetchBanners} title="Refresh">
            <RefreshCw size={14} />
          </button>
          <button className="btn btn-primary" onClick={openAdd}>
            <Plus size={14} /> Add hero banner
          </button>
        </div>
      </div>

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

      <div className="card" style={{ padding: 0 }}>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Order</th>
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
                  <td colSpan={7} style={{ textAlign: 'center', color: 'var(--text3)', padding: '40px 0' }}>
                    Loading hero banners…
                  </td>
                </tr>
              )}

              {!loading && banners.length === 0 && !fetchError && (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', color: 'var(--text3)', padding: '40px 0' }}>
                    No hero banners yet — click <strong>Add hero banner</strong> to create one
                  </td>
                </tr>
              )}

              {!loading && banners.map((b, index) => (
                <tr key={b.id}>
                  <td style={{ width: 110 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span className="badge badge-blue" style={{ minWidth: 36, textAlign: 'center' }}>
                        {orderLabel(b.display_order)}
                      </span>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <button
                          className="btn btn-ghost btn-sm"
                          style={{ padding: '2px 4px', minHeight: 0 }}
                          disabled={index === 0 || reordering}
                          onClick={() => moveBanner(index, -1)}
                          title="Move up"
                        >
                          <ChevronUp size={12} />
                        </button>
                        <button
                          className="btn btn-ghost btn-sm"
                          style={{ padding: '2px 4px', minHeight: 0 }}
                          disabled={index === banners.length - 1 || reordering}
                          onClick={() => moveBanner(index, 1)}
                          title="Move down"
                        >
                          <ChevronDown size={12} />
                        </button>
                      </div>
                    </div>
                  </td>

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
                        className="btn btn-ghost btn-sm"
                        style={{ color: 'var(--danger, #ef4444)' }}
                        onClick={() => setConfirm(b)}
                      >
                        <Trash2 size={11} /> Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <HeroBannerModal
        open={modal === 'add' || modal === 'edit'}
        onClose={() => setModal(null)}
        onSave={modal === 'edit' ? handleUpdate : handleCreate}
        initial={modal === 'edit' ? selected : null}
        shows={shows}
        showsLoading={showsLoading}
      />

      <ConfirmDialog
        open={!!confirm}
        title="Delete hero banner?"
        message={confirm ? `Remove "${confirm.title}" from the hero slider?` : ''}
        confirmLabel="Delete"
        onConfirm={() => handleDelete(confirm.id)}
        onCancel={() => setConfirm(null)}
      />
    </div>
  )
}
