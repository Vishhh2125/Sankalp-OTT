import { useState } from 'react'
import { useDispatch } from 'react-redux'
import { LogIn, AlertCircle } from 'lucide-react'
import { authApi } from '../services/api.js'
import { loginSuccess } from '../store/authSlice.js'

export default function Login() {
  const dispatch = useDispatch()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      if (!email || !password) {
        setError('Please enter both email and password')
        setLoading(false)
        return
      }

      const response = await authApi.login(email, password)
      const { data } = response.data

      // Write to localStorage FIRST so axios interceptor picks it up immediately
      localStorage.setItem('admin_token', data.accessToken)
      localStorage.setItem('admin_user', JSON.stringify(data.user))
      // Then update Redux state
      dispatch(loginSuccess({ token: data.accessToken, user: data.user }))
    } catch (err) {
      const message = err.response?.data?.message || 'Login failed. Please check credentials.'
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-container" style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100vh',
      background: 'var(--bg)',
      padding: '20px'
    }}>
      <div className="login-card" style={{
        width: '100%',
        maxWidth: '400px',
        padding: '40px',
        background: 'var(--bg2)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)',
        boxShadow: '0 20px 60px rgba(0,0,0,0.3)'
      }}>
        {/* Logo and Title */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          marginBottom: '30px',
          justifyContent: 'center'
        }}>
          <div style={{
            width: '40px',
            height: '40px',
            background: 'var(--accent)',
            borderRadius: '10px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '18px',
            fontWeight: '700',
            color: '#fff'
          }}>
            S
          </div>
          <div>
            <div style={{ fontSize: '18px', fontWeight: '700', color: 'var(--text)' }}>Sankalp OTT</div>
            <div style={{ fontSize: '11px', color: 'var(--text3)', letterSpacing: '0.3px' }}>ADMIN PANEL</div>
          </div>
        </div>

        {/* Heading */}
        <h1 style={{
          fontSize: '24px',
          fontWeight: '600',
          color: 'var(--text)',
          marginBottom: '8px',
          textAlign: 'center'
        }}>
          Admin Login
        </h1>
        <p style={{
          fontSize: '13px',
          color: 'var(--text2)',
          textAlign: 'center',
          marginBottom: '30px'
        }}>
          Sign in to access the dashboard
        </p>

        {/* Error Alert */}
        {error && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: '12px 14px',
            marginBottom: '20px',
            background: 'var(--red-bg)',
            border: '1px solid var(--red)',
            borderRadius: 'var(--radius)',
            color: 'var(--red)',
            fontSize: '12px'
          }}>
            <AlertCircle size={14} />
            {error}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Email Input */}
          <div>
            <label style={{
              display: 'block',
              fontSize: '12px',
              fontWeight: '500',
              color: 'var(--text2)',
              marginBottom: '6px'
            }}>
              Email Address
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@example.com"
              style={{
                width: '100%',
                padding: '10px 12px',
                background: 'var(--bg3)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)',
                color: 'var(--text)',
                fontSize: '13px',
                fontFamily: 'var(--font)',
                transition: 'all 0.2s',
                outline: 'none'
              }}
              onFocus={(e) => {
                e.target.style.borderColor = 'var(--accent)'
                e.target.style.background = 'var(--bg4)'
              }}
              onBlur={(e) => {
                e.target.style.borderColor = 'var(--border)'
                e.target.style.background = 'var(--bg3)'
              }}
            />
          </div>

          {/* Password Input */}
          <div>
            <label style={{
              display: 'block',
              fontSize: '12px',
              fontWeight: '500',
              color: 'var(--text2)',
              marginBottom: '6px'
            }}>
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              style={{
                width: '100%',
                padding: '10px 12px',
                background: 'var(--bg3)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)',
                color: 'var(--text)',
                fontSize: '13px',
                fontFamily: 'var(--font)',
                transition: 'all 0.2s',
                outline: 'none'
              }}
              onFocus={(e) => {
                e.target.style.borderColor = 'var(--accent)'
                e.target.style.background = 'var(--bg4)'
              }}
              onBlur={(e) => {
                e.target.style.borderColor = 'var(--border)'
                e.target.style.background = 'var(--bg3)'
              }}
            />
          </div>

          {/* Login Button */}
          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: '11px 12px',
              marginTop: '8px',
              background: loading ? 'var(--border)' : 'var(--accent)',
              color: '#fff',
              border: 'none',
              borderRadius: 'var(--radius-sm)',
              fontWeight: '600',
              fontSize: '13px',
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              opacity: loading ? 0.6 : 1
            }}
            onMouseEnter={(e) => {
              if (!loading) {
                e.target.style.background = 'var(--accent2)'
              }
            }}
            onMouseLeave={(e) => {
              if (!loading) {
                e.target.style.background = 'var(--accent)'
              }
            }}
          >
            <LogIn size={14} />
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        {/* Footer */}
        <div style={{
          marginTop: '24px',
          paddingTop: '20px',
          borderTop: '1px solid var(--border)',
          textAlign: 'center'
        }}>
          <p style={{
            fontSize: '11px',
            color: 'var(--text3)',
            lineHeight: '1.6'
          }}>
            For admin/subadmin access only.<br />
            Contact support for access credentials.
          </p>
        </div>
      </div>
    </div>
  )
}
