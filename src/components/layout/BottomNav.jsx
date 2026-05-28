import { NavLink } from 'react-router-dom'

// Íconos SVG inline
const Icon = ({ paths }) => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor"
       strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    {paths}
  </svg>
)
const IDashboard = () => <Icon paths={<><rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/></>}/>
const IFolder    = () => <Icon paths={<><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z"/></>}/>
const IClock     = () => <Icon paths={<><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>}/>
const ICalendar  = () => <Icon paths={<><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4"/><path d="M16 3v4"/><path d="M3 10h18"/></>}/>
const IMenu      = () => <Icon paths={<><line x1="3" y1="7" x2="21" y2="7"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="17" x2="21" y2="17"/></>}/>

const ITEMS = [
  { to: '/app/dashboard',   label: 'Inicio',      Icon: IDashboard },
  { to: '/app/expedientes', label: 'Expedientes', Icon: IFolder    },
  { to: '/app/plazos',      label: 'Plazos',      Icon: IClock     },
  { to: '/app/agenda',      label: 'Agenda',      Icon: ICalendar  },
]

export default function BottomNav({ onOpenMenu }) {
  return (
    <nav style={{
      position: 'fixed',
      bottom: 0, left: 0, right: 0,
      height: 'var(--bottom-nav-h, 60px)',
      background: 'var(--surface)',
      borderTop: '1px solid var(--border)',
      display: 'flex',
      alignItems: 'stretch',
      zIndex: 95,
      paddingBottom: 'env(safe-area-inset-bottom)',
      boxShadow: '0 -4px 16px rgba(15,23,42,.06)',
    }}>
      {ITEMS.map(({ to, label, Icon: Ic }) => ( // eslint-disable-line no-unused-vars
        <NavLink
          key={to}
          to={to}
          style={({ isActive }) => ({
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 3,
            fontSize: 10,
            fontWeight: 600,
            textDecoration: 'none',
            color: isActive ? 'var(--primary)' : 'var(--text-muted)',
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            transition: 'color .15s ease',
            paddingBottom: 4,
          })}
        >
          <Ic />
          <span>{label}</span>
        </NavLink>
      ))}

      {/* Botón "Más" — abre el sidebar completo */}
      <button
        onClick={onOpenMenu}
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 3,
          fontSize: 10,
          fontWeight: 600,
          color: 'var(--text-muted)',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          paddingBottom: 4,
        }}
      >
        <IMenu />
        <span>Más</span>
      </button>
    </nav>
  )
}
