import { useSelector } from 'react-redux'
import './index.css'

import { selectIsAuthenticated } from './store/authSlice'
import { selectActivePage }      from './store/navigationSlice'

import Layout        from './components/Layout.jsx'
import Login         from './pages/Login.jsx'

import Dashboard     from './pages/Dashboard.jsx'
import Users         from './pages/Users.jsx'
import Dramas        from './pages/Dramas.jsx'
import Categories    from './pages/Categories.jsx'
import Banners       from './pages/Banners.jsx'
import Membership    from './pages/Membership.jsx'
import Coins         from './pages/Coins.jsx'
import Notifications from './pages/Notifications.jsx'
import Analytics     from './pages/Analytics.jsx'
import Roles         from './pages/Roles.jsx'
import CMS           from './pages/CMS.jsx'

// Route map — add a new page here with one line
const ROUTES = {
  dashboard:     Dashboard,
  users:         Users,
  dramas:        Dramas,
  categories:    Categories,
  banners:       Banners,
  membership:    Membership,
  coins:         Coins,
  notifications: Notifications,
  analytics:     Analytics,
  roles:         Roles,
  cms:           CMS,
}

export default function App() {
  const isAuthenticated = useSelector(selectIsAuthenticated)
  const activePage      = useSelector(selectActivePage)
  const Page            = ROUTES[activePage] || Dashboard

  if (!isAuthenticated) {
    return <Login />
  }

  return (
    <Layout>
      <Page />
    </Layout>
  )
}
