import { useEffect, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import './index.css'

import { selectIsAuthenticated, selectUser, selectCanAccess, selectDefaultPage, setUser, logout } from './store/authSlice'
import { selectActivePage, setActivePage } from './store/navigationSlice'
import { canAccessPage } from './config/permissions.js'
import { authApi, refreshAccessToken } from './services/api.js'

import Layout        from './components/Layout.jsx'
import Login         from './pages/Login.jsx'

import Dashboard     from './pages/Dashboard.jsx'
import Users         from './pages/Users.jsx'
import Dramas        from './pages/Dramas.jsx'
import Profile       from './pages/Profile.jsx'
import Approvals     from './pages/Approvals.jsx'
import Categories    from './pages/Categories.jsx'
import Banners       from './pages/Banners.jsx'
import HeroBanners   from './pages/HeroBanners.jsx'
import Membership    from './pages/Membership.jsx'
import TopUp         from './pages/TopUp.jsx'
import Coins         from './pages/Coins.jsx'
import Notifications from './pages/Notifications.jsx'
import Analytics     from './pages/Analytics.jsx'
import Roles         from './pages/Roles.jsx'
import LiveStreaming from './pages/LiveStreaming.jsx'
import CMS           from './pages/CMS.jsx'
import Submissions   from './pages/Submissions.jsx'
import Packages      from './pages/Packages.jsx'
import StudentOnboarding from './pages/StudentOnboarding.jsx'
import AssignCourses     from './pages/AssignCourses.jsx'
import AccountDeletions  from './pages/AccountDeletions.jsx'

const ROUTES = {
  dashboard:          Dashboard,
  users:              Users,
  student_onboarding: StudentOnboarding,
  assign_courses:     AssignCourses,
  account_deletions:  AccountDeletions,
  dramas:             Dramas,
  categories:         Categories,
  banners:            Banners,
  hero_banners:       HeroBanners,
  membership:         Membership,
  topup:              TopUp,
  coins:              Coins,
  notifications:      Notifications,
  analytics:          Analytics,
  roles:              Roles,
  cms:                CMS,
  live:               LiveStreaming,
  submissions:        Submissions,
  packages:           Packages,
  profile:            Profile,
  approvals:          Approvals,
}

function AccessDenied() {
  return (
    <div className="card" style={{ padding: 40, textAlign: 'center' }}>
      <h2 style={{ marginBottom: 8 }}>Access denied</h2>
      <p style={{ color: 'var(--text3)', fontSize: 14 }}>
        You do not have permission to view this section. Contact your administrator.
      </p>
    </div>
  )
}

export default function App() {
  const dispatch          = useDispatch()
  const isAuthenticated   = useSelector(selectIsAuthenticated)
  const activePage        = useSelector(selectActivePage)
  const user              = useSelector(selectUser)
  const hasAccess         = useSelector(selectCanAccess(activePage))
  const defaultPage       = useSelector(selectDefaultPage)

  // authReady: false = still doing the initial silent token refresh, true = ready to render pages
  const [authReady, setAuthReady] = useState(!isAuthenticated)

  // On mount, if we have a stored session, proactively refresh the access token so it's
  // valid before any page component fires its first API call. This eliminates the 401
  // console errors that occur when the stored access token has expired but the refresh
  // cookie is still valid.
  useEffect(() => {
    if (!isAuthenticated) {
      setAuthReady(true)
      return
    }

    refreshAccessToken()
      .then(() => {
        // Also refresh the admin profile so role/sections are up to date
        return authApi.getAdminProfile()
      })
      .then((res) => {
        const profile = res.data?.data
        if (profile) {
          localStorage.setItem('admin_user', JSON.stringify(profile))
          dispatch(setUser(profile))
        }
      })
      .catch((err) => {
        // Only force-logout when the refresh token is genuinely rejected (401/403).
        // A 502/503/network error means the backend is temporarily unavailable — in that
        // case keep the existing token and let the per-request interceptor retry later.
        const status = err?.response?.status
        if (status === 401 || status === 403) {
          localStorage.removeItem('admin_token')
          localStorage.removeItem('admin_user')
          dispatch(logout())
        }
        // For any other error (502, timeout, offline) — fall through and render the app
        // with whatever token is in localStorage; the axios interceptor handles retries.
      })
      .finally(() => {
        setAuthReady(true)
      })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps — intentionally runs once on mount

  // Redirect to first allowed page if current page is not permitted
  useEffect(() => {
    if (!isAuthenticated || !user) return
    if (!canAccessPage(user, activePage)) {
      dispatch(setActivePage(defaultPage))
    }
  }, [isAuthenticated, user, activePage, defaultPage, dispatch])

  if (!isAuthenticated) {
    return <Login />
  }

  // Hold render until the initial token refresh completes — prevents pages from firing
  // API requests with a stale/expired access token
  if (!authReady) {
    return null
  }

  const Page = ROUTES[activePage] || Dashboard

  return (
    <Layout>
      {hasAccess ? <Page /> : <AccessDenied />}
    </Layout>
  )
}