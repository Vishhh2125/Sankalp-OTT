import { useState, useEffect } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import { selectUser, setUser } from '../store/authSlice'
import { authApi, mediaApi } from '../services/api'
import { FileDropzone } from '../components/ui/Controls.jsx'

export default function Profile() {
  const dispatch = useDispatch()
  const user = useSelector(selectUser)
  const [form, setForm] = useState({
    profile_photo_url: user?.teacher_profile?.profile_photo_url || '',
    full_name: user?.teacher_profile?.full_name || user?.name || '',
    professional_headline: user?.teacher_profile?.professional_headline || '',
    bio: user?.teacher_profile?.bio || '',
    experience_years: user?.teacher_profile?.experience_years || 0,
    qualification: user?.teacher_profile?.qualification || '',
  })
  const [saving, setSaving] = useState(false)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const [photoPreview, setPhotoPreview] = useState(user?.teacher_profile?.profile_photo_url || '')

  useEffect(() => {
    if (user?.teacher_profile) {
      setForm(prev => ({
        profile_photo_url: prev.profile_photo_url || user.teacher_profile.profile_photo_url || '',
        full_name: prev.full_name || user.teacher_profile.full_name || user?.name || '',
        professional_headline: prev.professional_headline || user.teacher_profile.professional_headline || '',
        bio: prev.bio || user.teacher_profile.bio || '',
        experience_years: prev.experience_years || user.teacher_profile.experience_years || 0,
        qualification: prev.qualification || user.teacher_profile.qualification || '',
      }))
      if (!photoPreview && user.teacher_profile.profile_photo_url) {
        setPhotoPreview(user.teacher_profile.profile_photo_url)
      }
    }
  }, [user])

  const upd = (k, v) => setForm(p => ({ ...p, [k]: v }))

  const handlePhotoChange = async (file) => {
    if (!file) return
    const localUrl = URL.createObjectURL(file)
    setPhotoPreview(localUrl)
    setUploadingPhoto(true)
    const userId = user?.id || user?.user_id || user?._id
    if (!userId) {
      alert('User ID missing. Please log in again.')
      setUploadingPhoto(false)
      return
    }
    try {
      const res = await mediaApi.uploadImageFile('teacher_profile', userId, file)
      const dataPayload = res.data?.data || res.data
      const publicUrl = dataPayload?.public_url
      if (publicUrl) {
        upd('profile_photo_url', publicUrl)
        setPhotoPreview(`${publicUrl}?t=${Date.now()}`)
      } else {
        alert('Upload succeeded but no public URL was returned.')
      }
    } catch (err) {
      alert('Failed to upload profile photo: ' + (err.response?.data?.message || err.message))
    } finally {
      setUploadingPhoto(false)
    }
  }

  const save = async () => {
    if (!form.profile_photo_url) {
      alert('Please upload a profile photo.')
      return
    }
    if (!form.full_name?.trim()) {
      alert('Please enter your full name.')
      return
    }
    if (!form.professional_headline?.trim()) {
      alert('Please enter your professional headline.')
      return
    }
    if (!form.bio?.trim()) {
      alert('Please enter your bio.')
      return
    }
    if (!form.experience_years) {
      alert('Please enter your years of experience.')
      return
    }
    if (!form.qualification?.trim()) {
      alert('Please enter your qualification.')
      return
    }

    setSaving(true)
    try {
      await authApi.updateTeacherProfile(form)
      try {
        const me = await authApi.getAdminProfile()
        if (me.data?.data) {
          localStorage.setItem('admin_user', JSON.stringify(me.data.data))
          dispatch(setUser(me.data.data))
        }
      } catch { /* fallback */ }
      alert('Profile saved successfully.')
    } catch (err) {
      alert('Failed to save profile: ' + (err.response?.data?.message || err.message))
    } finally { setSaving(false) }
  }

  return (
    <div className="page-enter" style={{ maxWidth: 640, margin: '20px auto' }}>
      <div className="card" style={{ padding: '24px 30px' }}>
        <h2 style={{ marginBottom: 20, fontWeight: 600 }}>Complete your Teacher Profile</h2>
        <div style={{ display:'grid', gap:16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '150px 1fr', gap: 16, alignItems: 'center' }}>
            <div style={{ width: 150, height: 150, borderRadius: '50%', overflow: 'hidden', border: '2px solid var(--border2)', background: 'var(--bg2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {photoPreview ? (
                <img src={photoPreview} alt="Profile" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <span style={{ color: 'var(--text3)', fontSize: 13 }}>No Photo</span>
              )}
            </div>
            <div>
              <FileDropzone 
                label={uploadingPhoto ? 'Uploading...' : 'Upload Profile Photo *'} 
                accept="image/jpeg,image/png" 
                hint="JPG or PNG. Square aspect ratio recommended."
                onChange={handlePhotoChange}
                disabled={uploadingPhoto}
              />
            </div>
          </div>

          <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontWeight: 500, fontSize: 13 }}>
            Full name *
            <input className="input" placeholder="e.g. Sarah Lee" value={form.full_name} onChange={e=>upd('full_name', e.target.value)} />
          </label>

          <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontWeight: 500, fontSize: 13 }}>
            Professional headline *
            <input className="input" placeholder="e.g. Associate Professor of Film and Acting" value={form.professional_headline} onChange={e=>upd('professional_headline', e.target.value)} />
          </label>

          <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontWeight: 500, fontSize: 13 }}>
            Bio *
            <textarea className="input" rows={4} placeholder="Tell your students about your career, background, and teaching philosophy..." value={form.bio} onChange={e=>upd('bio', e.target.value)} />
          </label>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontWeight: 500, fontSize: 13 }}>
              Years of experience *
              <input className="input" type="number" min={0} value={form.experience_years} onChange={e=>upd('experience_years', parseInt(e.target.value)||0)} />
            </label>

            <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontWeight: 500, fontSize: 13 }}>
              Qualification *
              <input className="input" placeholder="e.g. Master of Fine Arts (MFA)" value={form.qualification} onChange={e=>upd('qualification', e.target.value)} />
            </label>
          </div>

          <div style={{ display:'flex', justifyContent:'flex-end', gap:8, marginTop: 10 }}>
            <button className="btn btn-primary" onClick={save} disabled={saving || uploadingPhoto}>
              {saving ? 'Saving...' : 'Complete Profile'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
