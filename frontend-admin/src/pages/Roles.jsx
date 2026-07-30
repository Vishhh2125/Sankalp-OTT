import { useState, useEffect, useCallback } from 'react'
import { useSelector } from 'react-redux'
import { Plus, Edit2, Trash2, RefreshCw, Shield, ShieldCheck, Eye, EyeOff } from 'lucide-react'
import Modal, { FormGroup, ModalSection } from '../components/ui/Modal.jsx'
import { Toggle, ConfirmDialog, FileDropzone } from '../components/ui/Controls.jsx'
import { subAdminApi, teachersApi, mediaApi } from '../services/api.js'
import { selectIsMainAdmin } from '../store/authSlice.js'
import { SECTION_OPTIONS } from '../config/permissions.js'

function toArray(value, keys = []) {
  if (Array.isArray(value)) return value
  if (value && typeof value === 'object') {
    for (const key of keys) {
      if (Array.isArray(value[key])) return value[key]
    }
  }
  return []
}

function AdminModal({ open, onClose, onSave, initial, saving }) {
  const isEdit = !!initial?.id
  const isMainAdmin = initial?.role === 'admin'
  const [form, setForm] = useState(
    initial || { name: '', email: '', password: '', role: 'sub_admin', status: 'Active', sections: [] }
  )
  const [error, setError] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  useEffect(() => {
    if (open) {
      setForm(
        initial
          ? { ...initial, sections: Array.isArray(initial.sections) ? initial.sections : [] }
          : { name: '', email: '', password: '', role: 'sub_admin', status: 'Active', sections: [] }
      )
      setError('')
      setShowPassword(false)
    }
  }, [open, initial])

  const upd = (k, v) => setForm((p) => ({ ...p, [k]: v }))
  const toggleSection = (id) => {
    setForm((p) => ({
      ...p,
      sections: (Array.isArray(p.sections) ? p.sections : []).includes(id)
        ? (Array.isArray(p.sections) ? p.sections : []).filter((x) => x !== id)
        : [...(Array.isArray(p.sections) ? p.sections : []), id],
    }))
  }

  const selectedSections = Array.isArray(form.sections) ? form.sections : []

  const handleSave = async () => {
    setError('')
    if (!form.name?.trim() || !form.email?.trim()) {
      setError('Name and email are required')
      return
    }
    if (!isEdit && (!form.password || form.password.length < 8)) {
      setError('Password must be at least 8 characters')
      return
    }
    if (!isMainAdmin && selectedSections.length === 0) {
      setError('At least one section must be selected')
      return
    }
    try {
      await onSave(form)
      onClose()
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Save failed')
    }
  }

  if (!open) return null

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? `Edit — ${initial.name}` : 'Create Sub-Admin'}
      width={540}
      footer={
        <>
          <button className="btn btn-ghost" onClick={onClose} disabled={saving}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Sub-Admin'}
          </button>
        </>
      }
    >
      {error && (
        <div style={{ color: 'var(--red)', fontSize: 12, marginBottom: 12 }}>{error}</div>
      )}
      <ModalSection title="Identity">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <FormGroup label="Full name *">
            <input className="input" placeholder="e.g. Sarah Lee" value={form.name} onChange={(e) => upd('name', e.target.value)} />
          </FormGroup>
          <FormGroup label="Email *">
            <input
              className="input"
              type="email"
              placeholder="admin@ott.com"
              value={form.email}
              onChange={(e) => upd('email', e.target.value)}
              disabled={isMainAdmin}
            />
          </FormGroup>
        </div>
        {!isEdit && (
          <FormGroup label="Temporary password *">
            <div style={{ position: 'relative' }}>
              <input
                className="input"
                type={showPassword ? 'text' : 'password'}
                placeholder="Min 8 characters"
                value={form.password || ''}
                onChange={(e) => upd('password', e.target.value)}
                style={{ paddingRight: 36 }}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', padding: 0, display: 'flex', alignItems: 'center' }}
              >
                {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </FormGroup>
        )}
        {isEdit && !isMainAdmin && (
          <FormGroup label="New password (optional)">
            <div style={{ position: 'relative' }}>
              <input
                className="input"
                type={showPassword ? 'text' : 'password'}
                placeholder="Leave blank to keep current"
                value={form.password || ''}
                onChange={(e) => upd('password', e.target.value)}
                style={{ paddingRight: 36 }}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', padding: 0, display: 'flex', alignItems: 'center' }}
              >
                {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </FormGroup>
        )}
      </ModalSection>

      <ModalSection title="Role">
        <div style={{ background: 'var(--bg3)', padding: 12, borderRadius: 8, marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            {isMainAdmin ? (
              <ShieldCheck size={16} style={{ color: 'var(--accent2)' }} />
            ) : (
              <Shield size={16} style={{ color: 'var(--blue)' }} />
            )}
            <span style={{ fontWeight: 600, fontSize: 14 }}>
              {isMainAdmin ? 'Admin (full access)' : 'Sub-Admin (restricted access)'}
            </span>
          </div>
          <div style={{ fontSize: 12, color: 'var(--text3)' }}>
            {isMainAdmin
              ? 'Admin has full access to all sections. This cannot be changed.'
              : 'Sub-admins can only access sections you enable below. At least one section is required.'}
          </div>
        </div>
        {!isMainAdmin && (
          <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
            <Toggle on={form.status === 'Active'} onChange={(v) => upd('status', v ? 'Active' : 'Inactive')} />
            <span style={{ fontSize: 13 }}>Account active</span>
          </label>
        )}
      </ModalSection>

      {!isMainAdmin && (
        <ModalSection title="Section access">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
            {SECTION_OPTIONS.map(({ id, label }) => (
              <label
                key={id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '8px 12px',
                  borderRadius: 6,
                  cursor: 'pointer',
                  background: selectedSections.includes(id) ? 'var(--accent-bg)' : 'var(--bg3)',
                  border: `1px solid ${selectedSections.includes(id) ? 'var(--accent-border)' : 'var(--border)'}`,

                }}
              >
                <Toggle
                  on={selectedSections.includes(id)}
                  onChange={() => toggleSection(id)}

                />
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: selectedSections.includes(id) ? 500 : 400,
                    color: selectedSections.includes(id) ? 'var(--accent2)' : 'var(--text2)',
                  }}
                >
                  {label}
                </span>
              </label>
            ))}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 10 }}>
            Selected: {selectedSections.length} of {SECTION_OPTIONS.length} sections.
          </div>
        </ModalSection>
      )}
    </Modal>
  )
}

function TeacherModal({ open, onClose, onSave, saving }) {
  const [form, setForm] = useState({ name: '', email: '', password: '' })
  const [error, setError] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  useEffect(() => {
    if (open) {
      setForm({ name: '', email: '', password: '' })
      setError('')
      setShowPassword(false)
    }
  }, [open])

  const upd = (key, value) => setForm((current) => ({ ...current, [key]: value }))

  const handleSave = async () => {
    setError('')
    if (!form.name?.trim() || !form.email?.trim()) {
      setError('Name and email are required')
      return
    }
    if (form.password && form.password.length < 8) {
      setError('Temporary password must be at least 8 characters')
      return
    }

    try {
      await onSave(form)
      onClose()
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Save failed')
    }
  }

  if (!open) return null

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Create Teacher"
      width={540}
      footer={
        <>
          <button className="btn btn-ghost" onClick={onClose} disabled={saving}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Create Teacher'}
          </button>
        </>
      }
    >
      {error && (
        <div style={{ color: 'var(--red)', fontSize: 12, marginBottom: 12 }}>{error}</div>
      )}

      <ModalSection title="Identity & login">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <FormGroup label="Full name *">
            <input
              className="input"
              placeholder="e.g. Sarah Lee"
              value={form.name}
              onChange={(e) => upd('name', e.target.value)}
            />
          </FormGroup>
          <FormGroup label="Email *">
            <input
              className="input"
              type="email"
              placeholder="teacher@ott.com"
              value={form.email}
              onChange={(e) => upd('email', e.target.value)}
            />
          </FormGroup>
        </div>

        <FormGroup label="Temporary password">
          <div style={{ position: 'relative' }}>
            <input
              className="input"
              type={showPassword ? 'text' : 'password'}
              placeholder="Leave blank to auto-generate"
              value={form.password}
              onChange={(e) => upd('password', e.target.value)}
              style={{ paddingRight: 36 }}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', padding: 0, display: 'flex', alignItems: 'center' }}
            >
              {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>
          <div style={{ marginTop: 6, fontSize: 11, color: 'var(--text3)' }}>
            Leave it blank to generate a secure password automatically and email the teacher their credentials.
          </div>
        </FormGroup>
      </ModalSection>
    </Modal>
  )
}

export default function Roles() {
  const isMainAdmin = useSelector(selectIsMainAdmin)
  const [admins, setAdmins] = useState([])
  const [teachers, setTeachers] = useState([])
  const [activityLog, setActivityLog] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [modal, setModal] = useState(null)
  const [selected, setSelected] = useState(null)
  const [confirm, setConfirm] = useState(null)
  const [tab, setTab] = useState('admins')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [editingTeacher, setEditingTeacher] = useState(null)

  const safeAdmins = Array.isArray(admins) ? admins : []
  const safeTeachers = Array.isArray(teachers) ? teachers : []
  const safeActivityLog = Array.isArray(activityLog) ? activityLog : []

  const loadAdmins = useCallback(async () => {
    const res = await subAdminApi.list()
    const payload = res.data.data
    setAdmins(toArray(payload, ['admins', 'subAdmins', 'users']))
  }, [])

  const loadTeachers = useCallback(async () => {
    const res = await teachersApi.list()
    const payload = res.data.data
    setTeachers(toArray(payload, ['teachers', 'data']))
  }, [])

  const loadActivity = useCallback(async () => {
    const res = await subAdminApi.activityLogs()
    const payload = res.data.data
    setActivityLog(toArray(payload, ['logs', 'activityLogs', 'activity_logs']))
  }, [])

  useEffect(() => {
    if (!isMainAdmin) return
    setLoading(true)
    Promise.all([loadAdmins(), loadTeachers(), loadActivity()])
      .catch((err) => setError(err.response?.data?.message || 'Failed to load admins'))
      .finally(() => setLoading(false))
  }, [isMainAdmin, loadAdmins, loadTeachers, loadActivity])

  const saveAdmin = async (form) => {
    setSaving(true)
    setError('')
    setSuccess('')
    try {
      if (form.id && admins.find((a) => a.id === form.id)) {
        const payload = { name: form.name, email: form.email, sections: form.sections, status: form.status }
        if (form.password) payload.password = form.password
        await subAdminApi.update(form.id, payload)
        setSuccess(`Updated ${form.name}`)
      } else {
        await subAdminApi.create({
          name: form.name,
          email: form.email,
          password: form.password,
          sections: form.sections,
        })
        setSuccess(`Created sub-admin ${form.name}`)
      }
      await loadAdmins()
      await loadActivity()
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Failed to save sub-admin'
      setError(msg)
      throw err
    } finally {
      setSaving(false)
    }
  }

  const saveTeacher = async (form) => {
    setSaving(true)
    setError('')
    setSuccess('')
    try {
      const response = await teachersApi.create({
        name: form.name,
        email: form.email,
        password: form.password,
      })
      const teacher = response.data?.data || {}
      const temporaryPassword = teacher.temporaryPassword
      setSuccess(
        temporaryPassword
          ? `Created teacher ${form.name}. Temporary password: ${temporaryPassword}`
          : `Created teacher ${form.name}`
      )
      await loadTeachers()
      await loadActivity()
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Failed to save teacher'
      setError(msg)
      throw err
    } finally {
      setSaving(false)
    }
  }

  const toggleTeacherStatus = async (teacher) => {
    setSaving(true)
    setError('')
    try {
      await teachersApi.toggleStatus(teacher.id)
      await loadTeachers()
      setSuccess(`${teacher.name} status updated`)
    } catch (err) {
      setError(err.response?.data?.message || 'Status update failed')
    } finally {
      setSaving(false)
    }
  }

  const updateTeacherProfile = async (teacherId, data) => {
    setSaving(true)
    setError('')
    try {
      await teachersApi.saveProfile(teacherId, data)
      setSuccess('Teacher profile updated successfully')
      await loadTeachers()
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to update teacher profile')
      throw err
    } finally {
      setSaving(false)
    }
  }

  const deleteAdmin = async (id) => {
    setSaving(true)
    try {
      await subAdminApi.delete(id)
      await loadAdmins()
      await loadActivity()
      setConfirm(null)
    } catch (err) {
      setError(err.response?.data?.message || 'Delete failed')
    } finally {
      setSaving(false)
    }
  }

  const roleBadge = { admin: 'badge-red', sub_admin: 'badge-blue' }
  const roleLabel = { admin: 'Admin', sub_admin: 'Sub-Admin' }

  if (!isMainAdmin) {
    return (
      <div className="card" style={{ padding: 40, textAlign: 'center' }}>
        <h2 style={{ marginBottom: 8 }}>Main admin only</h2>
        <p style={{ color: 'var(--text3)', fontSize: 14 }}>
          Only the main administrator can manage sub-admins and permissions.
        </p>
      </div>
    )
  }

  const TABS = ['admins', 'teachers', 'activity']

  return (
    <div className="page-enter">
      {error && (
        <div style={{ color: 'var(--red)', fontSize: 13, marginBottom: 12 }}>{error}</div>
      )}
      {success && (
        <div style={{ color: 'var(--green)', fontSize: 13, marginBottom: 12 }}>{success}</div>
      )}

      <div style={{ display: 'flex', gap: 0, marginBottom: 18, borderBottom: '1px solid var(--border)' }}>
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              padding: '8px 16px',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontSize: 12,
              fontWeight: tab === t ? 600 : 400,
              color: tab === t ? 'var(--accent2)' : 'var(--text3)',
              borderBottom: tab === t ? '2px solid var(--accent)' : '2px solid transparent',
              textTransform: 'capitalize',
              marginBottom: -1,
            }}
          >
            {t === 'admins' ? 'Admin & Sub-Admin Users' : t === 'teachers' ? 'Teachers' : 'Activity Logs'}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--text3)' }}>Loading…</div>
      ) : (
        <>
          {tab === 'admins' && (
            <>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 14 }}>
                <button
                  className="btn btn-primary"
                  onClick={() => {
                    setSelected(null)
                    setModal('admin-add')
                  }}
                >
                  <Plus size={14} /> Create Sub-Admin
                </button>
              </div>
              <div className="card" style={{ padding: 0 }}>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>User</th>
                        <th>Email</th>
                        <th>Role</th>
                        <th>Sections access</th>
                        <th>Status</th>
                        <th>Last active</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {safeAdmins.map((a) => {
                        const sections = Array.isArray(a.sections) ? a.sections : []
                        return (
                        <tr key={a.id}>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <div
                                className="avatar"
                                style={{ background: a.role === 'admin' ? 'var(--accent-bg)' : 'var(--blue-bg)' }}
                              >
                                {a.initials}
                              </div>
                              <span style={{ fontWeight: 500 }}>{a.name}</span>
                            </div>
                          </td>
                          <td style={{ color: 'var(--text3)', fontSize: 12 }}>{a.email}</td>
                          <td>
                            <span className={`badge ${roleBadge[a.role]}`}>
                              {a.role === 'admin' && <ShieldCheck size={10} style={{ marginRight: 3 }} />}
                              {roleLabel[a.role]}
                            </span>
                          </td>
                          <td>
                            {a.role === 'admin' ? (
                              <span style={{ fontSize: 11, color: 'var(--green)' }}>All sections</span>
                            ) : (
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, maxWidth: 200 }}>
                                {sections.slice(0, 3).map((s) => (
                                  <span key={s} className="badge badge-blue" style={{ fontSize: 9 }}>
                                    {s}
                                  </span>
                                ))}
                                {sections.length > 3 && (
                                  <span className="badge badge-blue" style={{ fontSize: 9 }}>
                                    +{sections.length - 3}
                                  </span>
                                )}
                              </div>
                            )}
                          </td>
                          <td>
                            <span className={`badge ${a.status === 'Active' ? 'badge-green' : 'badge-amber'}`}>
                              {a.status}
                            </span>
                          </td>
                          <td style={{ color: 'var(--text3)', fontSize: 12 }}>{a.lastActive}</td>
                          <td>
                            <div style={{ display: 'flex', gap: 5 }}>
                              {a.role !== 'admin' && (
                                <button
                                  className="btn btn-ghost btn-sm"
                                  onClick={() => {
                                    setSelected(a)
                                    setModal('admin-edit')
                                  }}
                                >
                                  <Edit2 size={11} /> Edit
                                </button>
                              )}
                              {a.role !== 'admin' && (
                                <button
                                  className="btn btn-danger btn-sm"
                                  onClick={() => setConfirm({ id: a.id, name: a.name })}
                                >
                                  <Trash2 size={11} />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      )})}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

          {tab === 'teachers' && (
            <>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 14 }}>
                <button
                  className="btn btn-primary"
                  onClick={() => {
                    setModal('teacher-add')
                  }}
                >
                  <Plus size={14} /> Create Teacher
                </button>
              </div>
              <div className="card" style={{ padding: 0 }}>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Teacher</th>
                        <th>Email</th>
                        <th>Profile</th>
                        <th>Status</th>
                        <th>Joined</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {safeTeachers.length === 0 ? (
                        <tr>
                          <td colSpan={6} style={{ textAlign: 'center', color: 'var(--text3)', padding: 24 }}>
                            No teachers yet
                          </td>
                        </tr>
                      ) : (
                        safeTeachers.map((teacher) => (
                          <tr key={teacher.id}>
                            <td>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <div className="avatar" style={{ background: 'var(--blue-bg)' }}>
                                  {teacher.initials || teacher.name?.slice(0, 2)?.toUpperCase()}
                                </div>
                                <span style={{ fontWeight: 500 }}>{teacher.name}</span>
                              </div>
                            </td>
                            <td style={{ color: 'var(--text3)', fontSize: 12 }}>{teacher.email}</td>
                            <td>
                              <span className={`badge ${teacher.teacherProfile?.is_completed ? 'badge-green' : 'badge-amber'}`}>
                                {teacher.teacherProfile?.is_completed ? 'Completed' : 'Pending'}
                              </span>
                            </td>
                            <td>
                              <span className={`badge ${teacher.isBlocked ? 'badge-amber' : 'badge-green'}`}>
                                {teacher.isBlocked ? 'Inactive' : 'Active'}
                              </span>
                            </td>
                            <td style={{ color: 'var(--text3)', fontSize: 12 }}>
                              {teacher.createdAt ? new Date(teacher.createdAt).toLocaleDateString('en-US', {
                                year: 'numeric',
                                month: 'short',
                                day: 'numeric',
                              }) : '—'}
                            </td>
                            <td>
                              <div style={{ display: 'flex', gap: 5 }}>
                                <button
                                  className="btn btn-ghost btn-sm"
                                  onClick={() => { setEditingTeacher(teacher); setModal('teacher-profile-edit') }}
                                  disabled={saving}
                                >
                                  Edit Profile
                                </button>
                                <button
                                  className="btn btn-ghost btn-sm"
                                  onClick={() => toggleTeacherStatus(teacher)}
                                  disabled={saving}
                                >
                                  {teacher.isBlocked ? 'Activate' : 'Deactivate'}
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
            </>
          )}

          {tab === 'activity' && (
            <div className="card" style={{ padding: 0 }}>
              <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)' }}>
                <div className="card-title" style={{ marginBottom: 0 }}>Admin activity log</div>
              </div>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Admin</th>
                      <th>Action</th>
                      <th>Module</th>
                      <th>Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {safeActivityLog.length === 0 ? (
                      <tr>
                        <td colSpan={4} style={{ textAlign: 'center', color: 'var(--text3)', padding: 24 }}>
                          No activity yet
                        </td>
                      </tr>
                    ) : (
                      safeActivityLog.map((l, i) => (
                        <tr key={i}>
                          <td style={{ fontWeight: 500 }}>{l.admin}</td>
                          <td style={{ color: 'var(--text2)' }}>{l.action}</td>
                          <td>
                            <span className="badge badge-blue" style={{ fontSize: 10 }}>
                              {l.module}
                            </span>
                          </td>
                          <td style={{ color: 'var(--text3)', fontSize: 12 }}>{l.date}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      <AdminModal
        open={modal === 'admin-add'}
        onClose={() => setModal(null)}
        onSave={saveAdmin}
        initial={null}
        saving={saving}
      />
      <AdminModal
        open={modal === 'admin-edit'}
        onClose={() => setModal(null)}
        onSave={saveAdmin}
        initial={selected}
        saving={saving}
      />
      <TeacherModal
        open={modal === 'teacher-add'}
        onClose={() => setModal(null)}
        onSave={saveTeacher}
        saving={saving}
      />
      <TeacherProfileEditModal
        open={modal === 'teacher-profile-edit'}
        onClose={() => setModal(null)}
        teacher={editingTeacher}
        onSave={updateTeacherProfile}
        saving={saving}
      />
      <ConfirmDialog
        open={!!confirm}
        danger
        title="Delete Sub-Admin"
        message={`Remove "${confirm?.name}"? They will lose all access.`}
        onConfirm={() => deleteAdmin(confirm.id)}
        onCancel={() => setConfirm(null)}
      />
    </div>
  )
}

function TeacherProfileEditModal({ open, onClose, teacher, onSave, saving }) {
  const [form, setForm] = useState({
    profile_photo_url: '',
    full_name: '',
    professional_headline: '',
    bio: '',
    experience_years: 0,
    qualification: ''
  })
  const [error, setError] = useState('')
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const [photoPreview, setPhotoPreview] = useState('')

  useEffect(() => {
    if (open && teacher) {
      setError('')
      setUploadingPhoto(false)
      teachersApi.getProfile(teacher.id)
        .then(res => {
          const profile = res.data?.data || res.data || {}
          setForm({
            profile_photo_url: profile.profile_photo_url || '',
            full_name: profile.full_name || teacher.name || '',
            professional_headline: profile.professional_headline || '',
            bio: profile.bio || '',
            experience_years: profile.experience_years || 0,
            qualification: profile.qualification || ''
          })
          setPhotoPreview(profile.profile_photo_url || '')
        })
        .catch(err => {
          setError('Failed to load profile details: ' + (err.response?.data?.message || err.message))
        })
    }
  }, [open, teacher])

  const upd = (key, value) => setForm((current) => ({ ...current, [key]: value }))

  const handlePhotoChange = async (file) => {
    if (!file) return
    const localUrl = URL.createObjectURL(file)
    setPhotoPreview(localUrl)
    setUploadingPhoto(true)
    setError('')
    try {
      const res = await mediaApi.uploadImageFile('teacher_profile', teacher.id, file)
      const dataPayload = res.data?.data || res.data
      const publicUrl = dataPayload?.public_url
      if (publicUrl) {
        upd('profile_photo_url', publicUrl)
        setPhotoPreview(`${publicUrl}?t=${Date.now()}`)
      } else {
        setError('Upload succeeded but no public URL was returned.')
      }
    } catch (err) {
      setError('Failed to upload photo: ' + (err.response?.data?.message || err.message))
    } finally {
      setUploadingPhoto(false)
    }
  }

  const handleSave = async () => {
    setError('')
    if (!form.profile_photo_url) {
      setError('Profile photo is required')
      return
    }
    if (!form.full_name?.trim()) {
      setError('Full name is required')
      return
    }
    if (!form.professional_headline?.trim()) {
      setError('Professional headline is required')
      return
    }
    if (!form.bio?.trim()) {
      setError('Bio is required')
      return
    }
    if (!form.experience_years) {
      setError('Years of experience is required')
      return
    }
    if (!form.qualification?.trim()) {
      setError('Qualification is required')
      return
    }

    try {
      await onSave(teacher.id, form)
      onClose()
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Save failed')
    }
  }

  if (!open) return null

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Edit Profile — ${teacher?.name}`}
      width={540}
      footer={
        <>
          <button className="btn btn-ghost" onClick={onClose} disabled={saving || uploadingPhoto}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving || uploadingPhoto}>
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </>
      }
    >
      {error && (
        <div style={{ color: 'var(--red)', fontSize: 12, marginBottom: 12 }}>{error}</div>
      )}
      <ModalSection title="Profile Picture">
        <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: 12, alignItems: 'center' }}>
          <div style={{ width: 120, height: 120, borderRadius: '50%', overflow: 'hidden', border: '2px solid var(--border2)', background: 'var(--bg2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {photoPreview ? (
              <img src={photoPreview} alt="Profile" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <span style={{ color: 'var(--text3)', fontSize: 12 }}>No Photo</span>
            )}
          </div>
          <div>
            <FileDropzone 
              label={uploadingPhoto ? 'Uploading...' : 'Upload Photo *'} 
              accept="image/jpeg,image/png" 
              hint="Square aspect ratio recommended"
              onChange={handlePhotoChange}
              disabled={uploadingPhoto}
            />
          </div>
        </div>
      </ModalSection>
      <ModalSection title="Professional Details">
        <div style={{ display: 'grid', gap: 12 }}>
          <FormGroup label="Full Name *">
            <input className="input" placeholder="e.g. Sarah Lee" value={form.full_name} onChange={e => upd('full_name', e.target.value)} />
          </FormGroup>
          <FormGroup label="Professional Headline *">
            <input className="input" placeholder="e.g. Associate Professor of Film" value={form.professional_headline} onChange={e => upd('professional_headline', e.target.value)} />
          </FormGroup>
          <FormGroup label="Bio *">
            <textarea className="input" rows={4} placeholder="About the teacher..." value={form.bio} onChange={e => upd('bio', e.target.value)} />
          </FormGroup>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <FormGroup label="Years of Experience *">
              <input className="input" type="number" min={0} value={form.experience_years} onChange={e => upd('experience_years', parseInt(e.target.value)||0)} />
            </FormGroup>
            <FormGroup label="Qualification *">
              <input className="input" placeholder="e.g. MFA" value={form.qualification} onChange={e => upd('qualification', e.target.value)} />
            </FormGroup>
          </div>
        </div>
      </ModalSection>
    </Modal>
  )
}