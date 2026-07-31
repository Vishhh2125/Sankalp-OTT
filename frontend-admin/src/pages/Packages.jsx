import { useState, useEffect } from 'react'
import { Plus, Trash2, Edit2, Loader } from 'lucide-react'
import Modal, { FormGroup, ModalSection } from '../components/ui/Modal.jsx'
import { Toggle, ConfirmDialog, FileDropzone, SortableRow } from '../components/ui/Controls.jsx'
import { packagesApi, showsApi, mediaApi } from '../services/api.js'

function PackageFormModal({ open, onClose, onSave, initial, allShows }) {
  const isEdit = !!initial?.id
  const [form, setForm] = useState({
    title: '',
    synopsis: '',
    coin_price: 0,
    is_active: true,
    display_order: 0,
  })
  const [selectedShows, setSelectedShows] = useState([])
  
  // Image Upload States
  const [thumbFile, setThumbFile] = useState(null)
  const [bannerFile, setBannerFile] = useState(null)
  const [thumbPreview, setThumbPreview] = useState(null)
  const [bannerPreview, setBannerPreview] = useState(null)

  const [saving, setSaving] = useState(false)
  const upd = (k, v) => setForm((p) => ({ ...p, [k]: v }))

  useEffect(() => {
    if (open) {
      setForm(initial ? {
        title: initial.title,
        synopsis: initial.synopsis,
        coin_price: initial.coin_price,
        is_active: initial.is_active,
        display_order: initial.display_order,
      } : {
        title: '',
        synopsis: '',
        coin_price: 0,
        is_active: true,
        display_order: 0,
      })
      setSelectedShows(initial?.shows || [])
      setThumbFile(null)
      setBannerFile(null)
      setThumbPreview(initial?.thumbnail_url || null)
      setBannerPreview(initial?.banner_url || null)
    }
  }, [open, initial])

  const handleThumbChange = (file) => {
    if (!file) return
    setThumbFile(file)
    setThumbPreview(URL.createObjectURL(file))
  }

  const handleBannerChange = (file) => {
    if (!file) return
    setBannerFile(file)
    setBannerPreview(URL.createObjectURL(file))
  }

  const handleSave = async () => {
    if (!form.title.trim()) return alert('Package Title is required')
    if (!form.synopsis.trim()) return alert('Synopsis is required')
    if (selectedShows.length === 0) return alert('Please add at least one course to the package')

    setSaving(true)
    try {
      let pkgId = initial?.id
      const payload = {
        title: form.title,
        synopsis: form.synopsis,
        coin_price: parseInt(form.coin_price) || 0,
        is_active: form.is_active,
        display_order: parseInt(form.display_order) || 0,
        shows: selectedShows.map((s) => s.id),
      }

      if (isEdit) {
        await packagesApi.update(pkgId, payload)
      } else {
        const res = await packagesApi.create(payload)
        pkgId = res.data?.data?.id || res.data?.id
      }

      // Upload images if files selected
      if (thumbFile) {
        await mediaApi.uploadImageFile('package_thumbnail', pkgId, thumbFile)
      }
      if (bannerFile) {
        await mediaApi.uploadImageFile('package_banner', pkgId, bannerFile)
      }

      onSave()
      onClose()
    } catch (err) {
      console.error(err)
      alert(err.response?.data?.error || 'Failed to save package')
    } finally {
      setSaving(false)
    }
  }

  if (!open) return null

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? `Edit Package — ${initial.title}` : 'New Content Package'}
      width={720}
      footer={
        <>
          <button className="btn btn-ghost" onClick={onClose} disabled={saving}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : isEdit ? 'Save Changes' : 'Create Package'}
          </button>
        </>
      }
    >
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <ModalSection title="Package Details">
          <FormGroup label="Package Title *">
            <input
              className="input"
              style={{ width: '100%' }}
              placeholder="e.g. EdTech Math Crash Course"
              value={form.title}
              onChange={(e) => upd('title', e.target.value)}
            />
          </FormGroup>

          <FormGroup label="Coin Price *">
            <input
              className="input"
              type="number"
              style={{ width: '100%' }}
              placeholder="100"
              value={form.coin_price}
              onChange={(e) => upd('coin_price', e.target.value)}
            />
          </FormGroup>

          <FormGroup label="Display Order">
            <input
              className="input"
              type="number"
              style={{ width: '100%' }}
              placeholder="0"
              value={form.display_order}
              onChange={(e) => upd('display_order', e.target.value)}
            />
          </FormGroup>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 16 }}>
            <Toggle on={form.is_active} onChange={(v) => upd('is_active', v)} />
            <span style={{ fontSize: 13, fontWeight: 500 }}>Active status (visible to users)</span>
          </div>
        </ModalSection>

        <ModalSection title="Artwork / Media">
          <FormGroup label="Thumbnail Image (1:1 or 3:4)">
            <FileDropzone
              label="Choose thumbnail"
              accept="image/*"
              preview={thumbPreview}
              onChange={handleThumbChange}
            />
          </FormGroup>

          <FormGroup label="Banner Image (Landscape)">
            <FileDropzone
              label="Choose banner"
              accept="image/*"
              preview={bannerPreview}
              onChange={handleBannerChange}
            />
          </FormGroup>
        </ModalSection>
      </div>

      <ModalSection title="Synopsis Description" style={{ marginTop: 8 }}>
        <textarea
          className="input"
          style={{ width: '100%', minHeight: 70 }}
          placeholder="Detailed package summary..."
          value={form.synopsis}
          onChange={(e) => upd('synopsis', e.target.value)}
        />
      </ModalSection>

      <ModalSection title="Courses in this Package">
        <FormGroup label="Select Course to Add">
          <select
            className="input"
            style={{ width: '100%' }}
            onChange={(e) => {
              const showId = e.target.value
              if (!showId) return
              const matched = allShows.find((s) => s.id === showId)
              if (matched && !selectedShows.some((ss) => ss.id === showId)) {
                setSelectedShows((p) => [...p, { id: matched.id, title: matched.title, thumbnail_url: matched.thumbnail_url }])
              }
              e.target.value = ''
            }}
          >
            <option value="">-- Choose Course --</option>
            {allShows
              .filter((s) => !selectedShows.some((ss) => ss.id === s.id))
              .map((s) => (
                <option key={s.id} value={s.id}>
                  {s.title} ({s.coin_cost} coins)
                </option>
              ))}
          </select>
        </FormGroup>

        <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {selectedShows.length === 0 ? (
            <div style={{ fontSize: 12, color: 'var(--text3)', textAlign: 'center', padding: '16px 0', border: '1px dashed var(--border)', borderRadius: 'var(--radius)' }}>
              No courses added yet. Pick from list above.
            </div>
          ) : (
            selectedShows.map((s, idx) => (
              <SortableRow
                key={s.id}
                disableUp={idx === 0}
                disableDown={idx === selectedShows.length - 1}
                onMoveUp={() => {
                  setSelectedShows((prev) => {
                    const next = [...prev]
                    const temp = next[idx - 1]
                    next[idx - 1] = next[idx]
                    next[idx] = temp
                    return next
                  })
                }}
                onMoveDown={() => {
                  setSelectedShows((prev) => {
                    const next = [...prev]
                    const temp = next[idx + 1]
                    next[idx + 1] = next[idx]
                    next[idx] = temp
                    return next
                  })
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 12px',
                    background: 'var(--bg3)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    {s.thumbnail_url && (
                      <img
                        src={s.thumbnail_url}
                        alt=""
                        style={{ width: 28, height: 38, objectFit: 'cover', borderRadius: 4 }}
                      />
                    )}
                    <span style={{ fontSize: 13, fontWeight: 500 }}>{s.title}</span>
                  </div>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    style={{ color: 'var(--red)', padding: 4 }}
                    onClick={() => {
                      setSelectedShows((p) => p.filter((item) => item.id !== s.id))
                    }}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </SortableRow>
            ))
          )}
        </div>
      </ModalSection>
    </Modal>
  )
}

export default function Packages() {
  const [packages, setPackages] = useState([])
  const [allShows, setAllShows] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null)
  const [selected, setSelected] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(null)

  const loadData = async () => {
    setLoading(true)
    try {
      const [pkgRes, showRes] = await Promise.all([
        packagesApi.list(),
        showsApi.getAll({ limit: 100 }),
      ])
      setPackages(pkgRes.data.data)
      setAllShows(showRes.data?.items || showRes.data?.data?.shows || showRes.data?.shows || [])
    } catch (err) {
      console.error('Failed to load packages UI details:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const handleDelete = async () => {
    if (!confirmDelete) return
    try {
      await packagesApi.delete(confirmDelete)
      loadData()
      setConfirmDelete(null)
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to delete package')
    }
  }

  const openForm = async (pkg = null) => {
    if (pkg) {
      try {
        const { data } = await packagesApi.getById(pkg.id)
        setSelected(data.data)
        setModal('edit')
      } catch (err) {
        alert('Failed to retrieve package details')
      }
    } else {
      setSelected(null)
      setModal('edit')
    }
  }

  if (loading && packages.length === 0) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '100px 0' }}>
        <Loader className="animate-spin" size={24} style={{ marginRight: 8 }} />
        <span>Loading Packages...</span>
      </div>
    )
  }

  return (
    <div className="page-enter">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <div style={{ fontWeight: 600, fontSize: 16 }}>Bundled Content Packages</div>
          <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 4 }}>
            {packages.length} packages · {packages.filter((p) => p.is_active).length} active rows
          </div>
        </div>
        <button className="btn btn-primary" onClick={() => openForm(null)}>
          <Plus size={14} style={{ marginRight: 4 }} /> New Package
        </button>
      </div>

      <div className="card" style={{ padding: 0 }}>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Thumbnail</th>
                <th>Package Title</th>
                <th>Courses Inside</th>
                <th>Display Order</th>
                <th>Coin Price</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {packages.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '30px 0', color: 'var(--text3)' }}>
                    No packages created yet.
                  </td>
                </tr>
              ) : (
                packages.map((pkg) => (
                  <tr key={pkg.id}>
                    <td>
                      {pkg.thumbnail_url ? (
                        <img
                          src={pkg.thumbnail_url}
                          alt=""
                          style={{ width: 36, height: 48, objectFit: 'cover', borderRadius: 4, border: '1px solid var(--border)' }}
                        />
                      ) : (
                        <div style={{ width: 36, height: 48, borderRadius: 4, background: 'var(--bg4)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: 'var(--text3)' }}>
                          No image
                        </div>
                      )}
                    </td>
                    <td style={{ fontWeight: 600 }}>
                      <div>{pkg.title}</div>
                      <div style={{ fontSize: 11, fontWeight: 400, color: 'var(--text3)', marginTop: 4, maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {pkg.synopsis}
                      </div>
                    </td>
                    <td>
                      <span className="badge badge-blue">{pkg.shows_count} courses</span>
                    </td>
                    <td style={{ fontFamily: 'var(--mono)', fontSize: 12 }}>{pkg.display_order}</td>
                    <td style={{ fontWeight: 600, color: 'var(--accent)' }}>💰 {pkg.coin_price}</td>
                    <td>
                      <span className={`badge ${pkg.is_active ? 'badge-green' : 'badge-amber'}`}>
                        {pkg.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button className="btn btn-ghost btn-sm" onClick={() => openForm(pkg)}>
                          <Edit2 size={11} style={{ marginRight: 2 }} /> Edit
                        </button>
                        <button
                          className="btn btn-ghost btn-sm"
                          style={{ color: 'var(--red)' }}
                          onClick={() => setConfirmDelete(pkg.id)}
                        >
                          <Trash2 size={11} style={{ marginRight: 2 }} /> Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <PackageFormModal
        open={modal === 'edit'}
        onClose={() => setModal(null)}
        onSave={loadData}
        initial={selected}
        allShows={allShows}
      />

      <ConfirmDialog
        open={!!confirmDelete}
        title="Delete Package"
        message="Are you sure you want to delete this package? Existing buyers will not lose their course accesses, but this bundle will be permanently removed from selection."
        danger
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(null)}
      />
    </div>
  )
}
