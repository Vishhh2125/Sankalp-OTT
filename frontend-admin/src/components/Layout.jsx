import Sidebar from './Sidebar.jsx'
import Topbar  from './Topbar.jsx'
import { useSelector } from 'react-redux'
import { selectActivePage } from '../store/navigationSlice'

export default function Layout({ children }) {
  const activePage = useSelector(selectActivePage)

  return (
    <div className="app">
      <Sidebar />
      <div className="main">
        <Topbar />
        <main className="content" key={activePage}>
          {children}
        </main>
      </div>
    </div>
  )
}
