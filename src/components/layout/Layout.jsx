import { useEffect, useState } from 'react'
import Sidebar from './Sidebar'
import Navbar from './Navbar'
import BottomNav from './BottomNav'

// Wrapper general de páginas autenticadas. Maneja tema (data-theme),
// sidebar colapsable (desktop) y deslizante (móvil).
export default function Layout({ session, children }) {
  const [theme, setTheme] = useState(() => {
    try { return localStorage.getItem('lextrack_theme') || 'light' } catch { return 'light' }
  })
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem('lextrack_sidebar_collapsed') === '1' } catch { return false }
  })
  const [mobileOpen, setMobileOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth < 1024)

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    try { localStorage.setItem('lextrack_theme', theme) } catch { /* ignore */ }
  }, [theme])

  useEffect(() => {
    try { localStorage.setItem('lextrack_sidebar_collapsed', collapsed ? '1' : '0') } catch { /* ignore */ }
  }, [collapsed])

  useEffect(() => {
    const h = () => setIsMobile(window.innerWidth < 1024)
    window.addEventListener('resize', h)
    return () => window.removeEventListener('resize', h)
  }, [])

  const toggleTheme = () => setTheme(t => t === 'dark' ? 'light' : 'dark')

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      background: 'var(--bg)',
      color: 'var(--text)',
    }}>
      <Sidebar
        session={session}
        collapsed={collapsed}
        onToggleCollapse={() => setCollapsed(c => !c)}
        theme={theme}
        onToggleTheme={toggleTheme}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
        isMobile={isMobile}
      />

      <div style={{
        flex: 1,
        minWidth: 0,
        display: 'flex',
        flexDirection: 'column',
        marginLeft: isMobile ? 0 : 0, // sidebar is sticky in flex so no offset needed
      }}>
        <Navbar
          session={session}
          onOpenSidebar={() => setMobileOpen(true)}
        />
        <main style={{
          flex: 1,
          padding: isMobile ? '16px 12px' : '24px',
          maxWidth: '100%',
          overflow: 'hidden',
          paddingBottom: isMobile ? 'calc(var(--bottom-nav-h, 60px) + 16px)' : '24px',
        }}>
          <div style={{ maxWidth: 1400, margin: '0 auto' }}>
            {children}
          </div>
        </main>
      </div>

      {isMobile && (
        <BottomNav onOpenMenu={() => setMobileOpen(true)} />
      )}
    </div>
  )
}
