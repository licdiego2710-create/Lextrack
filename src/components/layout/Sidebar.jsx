import { NavLink, useNavigate } from 'react-router-dom'
import { supabase } from '../../supabaseClient'
import { iniciales } from '../../utils/helpers'
import { useOrg } from '../../context/OrgContext'

// Conjunto de iconos SVG inline (24x24, stroke 1.8).
const Icon = ({ d, paths }) => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
       strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
    {d ? <path d={d}/> : paths}
  </svg>
)
const IDashboard = () => <Icon paths={<><rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/></>}/>
const IFolder    = () => <Icon paths={<><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z"/></>}/>

const IUsers     = () => <Icon paths={<><circle cx="9" cy="8" r="3.5"/><path d="M2 20c0-3.5 3-6 7-6s7 2.5 7 6"/><circle cx="17" cy="7" r="2.5"/><path d="M14 14c2.5 0 6 1.5 6 4.5"/></>}/>
const ITasks     = () => <Icon paths={<><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M8 10l2.5 2.5L16 7"/><path d="M8 16h8"/></>}/>
const ICalendar  = () => <Icon paths={<><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4"/><path d="M16 3v4"/><path d="M3 10h18"/></>}/>
const IClock     = () => <Icon paths={<><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>}/>

const IDoc       = () => <Icon paths={<><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/><path d="M9 13h6"/><path d="M9 17h6"/></>}/>
const ICrm       = () => <Icon paths={<><circle cx="9" cy="7" r="3"/><path d="M3 20c0-3 2.5-5 6-5"/><path d="M16 11h6"/><path d="M16 16h6"/><path d="M19 8v11"/></>}/>
const IUser      = () => <Icon paths={<><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-7 8-7s8 3 8 7"/></>}/>
const ICard      = () => <Icon paths={<><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></>}/>

const ISearch    = () => <Icon paths={<><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.35-4.35"/></>}/>
const ISettings  = () => <Icon paths={<><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></>}/>
const ISignOut   = () => <Icon paths={<><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5"/><path d="M21 12H9"/></>}/>
const ISun       = () => <Icon paths={<><circle cx="12" cy="12" r="4"/><path d="M12 3v2"/><path d="M12 19v2"/><path d="M3 12h2"/><path d="M19 12h2"/><path d="M5.5 5.5l1.5 1.5"/><path d="M17 17l1.5 1.5"/><path d="M5.5 18.5l1.5-1.5"/><path d="M17 7l1.5-1.5"/></>}/>
const IMoon      = () => <Icon paths={<><path d="M21 13.5A9 9 0 1 1 10.5 3a7 7 0 0 0 10.5 10.5z"/></>}/>
const IChevron   = ({ open }) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
       strokeWidth="2" style={{ transform: open ? 'rotate(0deg)' : 'rotate(-90deg)', transition: 'transform .2s' }}>
    <path d="M6 9l6 6 6-6"/>
  </svg>
)

const NAV_GROUPS = [
  {
    title: 'Principal',
    items: [
      { to: '/app/dashboard',   label: 'Inicio',     icon: IDashboard },
      { to: '/app/prospectos',  label: 'Prospectos', icon: ICrm       },
      { to: '/app/expedientes',  label: 'Expedientes', icon: IFolder  },
    ],
  },
  {
    title: 'Herramientas',
    items: [
      { to: '/app/buscador-partes',  label: 'Buscador Judicial',  icon: ISearch  },
      { to: '/app/plazos',           label: 'Calculadora de Plazos', icon: IClock },
      { to: '/app/documentos',       label: 'Plantillas y Archivos', icon: IDoc   },
    ],
  },
  {
    title: 'Control',
    items: [
      { to: '/app/agenda',           label: 'Agenda y Audiencias', icon: ICalendar },
      { to: '/app/tareas',           label: 'Tareas del Equipo',   icon: ITasks    },
      { to: '/app/partes',           label: 'Contactos (Partes)',  icon: IUsers   },
    ],
  },
  {
    title: 'Administración',
    items: [
      { to: '/app/usuarios',      label: 'Equipo / Usuarios',      icon: IUser     },
      { to: '/app/facturacion',   label: 'Suscripción',    icon: ICard     },
      { to: '/app/configuracion', label: 'Configuración',  icon: ISettings },
    ],
  },
]


const ROL_LABEL = { admin: 'Administrador', abogado: 'Abogado', asistente: 'Asistente', cliente: 'Cliente' }
const ROL_COLOR = { admin: 'var(--primary)', abogado: 'var(--success)', asistente: 'var(--text-muted)', cliente: 'var(--info)' }

export default function Sidebar({ collapsed, onToggleCollapse, session, theme, onToggleTheme, mobileOpen, onCloseMobile, isMobile }) {
  const navigate = useNavigate()
  const { org, miembro } = useOrg()
  const w = collapsed ? 'var(--sidebar-w-collapsed)' : 'var(--sidebar-w)'
  const email = session?.user?.email || ''

  const signOut = async () => {
    await supabase.auth.signOut()
    navigate('/auth')
  }

  return (
    <>
      {isMobile && mobileOpen && (
        <div
          onClick={onCloseMobile}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(15,23,42,.55)',
            backdropFilter: 'blur(2px)', zIndex: 90,
          }}
        />
      )}
      <aside style={{
        position: isMobile ? 'fixed' : 'sticky',
        top: 0,
        left: 0,
        height: '100vh',
        width: w,
        background: 'var(--surface)',
        borderRight: '1px solid var(--border)',
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0,
        transition: 'width .2s ease, transform .25s ease',
        transform: isMobile ? (mobileOpen ? 'translateX(0)' : 'translateX(-100%)') : 'none',
        zIndex: 100,
        boxShadow: isMobile ? 'var(--shadow-lg)' : 'none',
      }}>
        {/* Logo */}
        <div style={{
          padding: collapsed ? '18px 12px' : '18px 20px',
          display: 'flex', alignItems: 'center', gap: '10px',
          borderBottom: '1px solid var(--border)',
          minHeight: 'var(--navbar-h)',
        }}>
          <LogoMark/>
          {!collapsed && (
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text)', letterSpacing: '1.6px' }}>LEXTRACK</div>
              {org ? (
                <div style={{
                  fontSize: 10, fontWeight: 600, color: 'var(--text-muted)',
                  marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  maxWidth: 140,
                }} title={org.nombre}>{org.nombre}</div>
              ) : (
                <div style={{ fontSize: 9.5, fontWeight: 700, color: 'var(--primary)', letterSpacing: '3px', marginTop: 1 }}>MÉXICO</div>
              )}
            </div>
          )}
        </div>

        {/* Nav */}
        <nav style={{
          flex: 1, overflowY: 'auto',
          padding: '12px 8px',
          display: 'flex', flexDirection: 'column', gap: '4px',
        }}>
          {(() => {
            const isCliente = miembro?.rol === 'cliente'
            const displayedGroups = NAV_GROUPS.map(group => {
              if (isCliente) {
                const items = group.items.filter(item =>
                  item.to === '/app/dashboard' ||
                  item.to === '/app/expedientes' ||
                  item.to === '/app/documentos'
                )
                return { ...group, items }
              }
              return group
            }).filter(group => group.items.length > 0)

            return displayedGroups.map(group => (
              <div key={group.title} style={{ marginBottom: '10px' }}>
              {!collapsed && (
                <div style={{
                  fontSize: 10, fontWeight: 700, color: 'var(--text-muted)',
                  textTransform: 'uppercase', letterSpacing: '1.2px',
                  padding: '8px 12px 4px',
                }}>{group.title}</div>
              )}
              {group.items.map(item => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  onClick={onCloseMobile}
                  style={({ isActive }) => ({
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: collapsed ? '10px' : '9px 12px',
                    margin: '1px 4px',
                    borderRadius: 'var(--radius)',
                    fontSize: '13px',
                    fontWeight: 500,
                    color: isActive ? '#fff' : 'var(--text-secondary)',
                    background: isActive ? 'var(--primary)' : 'transparent',
                    textDecoration: 'none',
                    transition: 'background .15s ease, color .15s ease',
                    justifyContent: collapsed ? 'center' : 'flex-start',
                  })}
                  title={collapsed ? item.label : undefined}
                >
                  <item.icon/>
                  {!collapsed && <span>{item.label}</span>}
                </NavLink>
              ))}
            </div>
          ))
          })()}
        </nav>

        {/* Footer */}
        <div style={{
          borderTop: '1px solid var(--border)',
          padding: '12px',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
        }}>
          {!collapsed && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: '10px',
              padding: '8px', borderRadius: 'var(--radius)',
              background: 'var(--surface-3)',
            }}>
              <div style={{
                width: 32, height: 32, borderRadius: '50%',
                background: 'var(--primary)', color: '#fff',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 11, fontWeight: 700, flexShrink: 0,
              }}>{iniciales(email)}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {email.split('@')[0]}
                </div>
                {miembro?.rol ? (
                  <div style={{ fontSize: 10, fontWeight: 700, color: ROL_COLOR[miembro.rol] }}>
                    {ROL_LABEL[miembro.rol]}
                  </div>
                ) : (
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {email}
                  </div>
                )}
              </div>
            </div>
          )}
          <div style={{ display: 'flex', gap: '6px', flexDirection: collapsed ? 'column' : 'row' }}>
            <button
              onClick={onToggleTheme}
              title={theme === 'dark' ? 'Modo claro' : 'Modo oscuro'}
              style={iconBtn()}
            >
              {theme === 'dark' ? <ISun/> : <IMoon/>}
            </button>
            <button
              onClick={onToggleCollapse}
              title={collapsed ? 'Expandir' : 'Colapsar'}
              style={iconBtn()}
            >
              <IChevron open={!collapsed}/>
            </button>
            <button
              onClick={signOut}
              title="Cerrar sesión"
              style={{ ...iconBtn(), color: 'var(--danger)' }}
            >
              <ISignOut/>
            </button>
          </div>
        </div>
      </aside>
    </>
  )
}

const iconBtn = () => ({
  flex: 1,
  background: 'var(--surface-3)',
  border: '1px solid var(--border)',
  color: 'var(--text-secondary)',
  borderRadius: 'var(--radius)',
  padding: '8px',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  transition: 'background .15s ease, color .15s ease',
})

function LogoMark() {
  return (
    <div style={{
      width: 36, height: 36, borderRadius: 10,
      background: 'linear-gradient(135deg, var(--primary), var(--primary-dark))',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      boxShadow: '0 4px 12px rgba(37,99,235,.3)',
      flexShrink: 0,
    }}>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 3v18"/>
        <path d="M6 7h12"/>
        <path d="M3 11l3-4 3 4"/>
        <path d="M15 11l3-4 3 4"/>
        <path d="M3 11c0 1.5 1.5 3 3 3s3-1.5 3-3"/>
        <path d="M15 11c0 1.5 1.5 3 3 3s3-1.5 3-3"/>
        <path d="M8 21h8"/>
      </svg>
    </div>
  )
}
