import { useState, useEffect, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { supabase } from '../../supabaseClient'
import { iniciales, diasHasta } from '../../utils/helpers'

const PAGE_TITLES = {
  '/app/dashboard': 'Dashboard',
  '/app/expedientes': 'Expedientes',
  '/app/demandas': 'Demandas',
  '/app/partes': 'Partes procesales',
  '/app/tareas': 'Tareas',
  '/app/agenda': 'Agenda',
  '/app/plazos': 'Calculadora de Plazos',
  '/app/estadisticas': 'Estadísticas',
  '/app/documentos': 'Documentos',
  '/app/bitacora': 'Bitácora',
  '/app/usuarios': 'Usuarios',
}

export default function Navbar({ session, onOpenSidebar }) {
  const location = useLocation()
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)
  const [notifOpen, setNotifOpen] = useState(false)
  const [busqueda, setBusqueda] = useState('')
  const [alertas, setAlertas] = useState([])
  const dropRef = useRef(null)

  // Cargar expedientes urgentes para notificaciones reales
  useEffect(() => {
    if (!session) return
    ;(async () => {
      const { data } = await supabase
        .from('expedientes')
        .select('id, num, actor, demandado, termino, estado')
        .eq('estado', 'Activo')
        .not('termino', 'is', null)
        .order('termino', { ascending: true })
        .limit(20)
      const lista = (data || []).map(e => ({
        ...e,
        dias: diasHasta(e.termino),
      })).filter(e => e.dias !== null && e.dias <= 7)
      setAlertas(lista)
    })()
  }, [session])

  useEffect(() => {
    const h = (e) => {
      if (dropRef.current && !dropRef.current.contains(e.target)) {
        setMenuOpen(false); setNotifOpen(false)
      }
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  const email = session?.user?.email || ''
  const title = PAGE_TITLES[location.pathname] || 'LexTrack MX'

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    navigate('/auth')
  }

  function handleSearch(e) {
    if (e.key === 'Enter' && busqueda.trim()) {
      navigate(`/app/expedientes?q=${encodeURIComponent(busqueda.trim())}`)
      setBusqueda('')
    }
  }

  const tieneAlertas = alertas.length > 0

  return (
    <header style={{
      position: 'sticky', top: 0, zIndex: 80,
      height: 'var(--navbar-h)',
      background: 'var(--surface)',
      borderBottom: '1px solid var(--border)',
      padding: '0 24px',
      display: 'flex',
      alignItems: 'center',
      gap: '16px',
      backdropFilter: 'blur(10px)',
    }}>
      {/* Burger (móvil) */}
      <button
        className="lx-burger"
        onClick={onOpenSidebar}
        aria-label="Abrir menú"
        style={{
          display: 'none',
          background: 'transparent', border: '1px solid var(--border)',
          borderRadius: 'var(--radius)', padding: '6px 8px',
          color: 'var(--text)', cursor: 'pointer',
        }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 6h18"/><path d="M3 12h18"/><path d="M3 18h18"/>
        </svg>
      </button>

      {/* Breadcrumb */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>LexTrack MX</div>
        <div style={{ color: 'var(--text-muted)' }}>/</div>
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {title}
        </div>
      </div>

      {/* Búsqueda funcional */}
      <div style={{ position: 'relative', flex: '0 1 320px', display: 'none' }} className="lx-search">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
             style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }}>
          <circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>
        </svg>
        <input
          value={busqueda}
          onChange={e => setBusqueda(e.target.value)}
          onKeyDown={handleSearch}
          placeholder="Buscar expediente... (Enter)"
          style={{
            width: '100%',
            background: 'var(--surface-3)',
            border: '1px solid var(--border)',
            color: 'var(--text)',
            borderRadius: 'var(--radius)',
            padding: '8px 12px 8px 36px',
            fontSize: 13,
          }}
        />
      </div>

      {/* Acciones */}
      <div ref={dropRef} style={{ display: 'flex', alignItems: 'center', gap: '8px', position: 'relative' }}>
        {/* Campana de notificaciones */}
        <button
          onClick={() => { setNotifOpen(v => !v); setMenuOpen(false) }}
          aria-label="Notificaciones"
          style={{
            background: 'var(--surface-3)',
            border: '1px solid var(--border)',
            color: 'var(--text)',
            borderRadius: 'var(--radius)',
            padding: '8px 10px',
            cursor: 'pointer',
            position: 'relative',
          }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/>
            <path d="M10 21a2 2 0 0 0 4 0"/>
          </svg>
          {tieneAlertas && (
            <span style={{
              position: 'absolute', top: 6, right: 8,
              width: 7, height: 7, background: 'var(--danger)',
              borderRadius: '50%', border: '2px solid var(--surface)',
            }}/>
          )}
        </button>

        {notifOpen && (
          <div style={dropdownStyle()}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>Vencimientos próximos</div>
              {tieneAlertas && <span style={{ fontSize: 11, background: 'var(--danger)', color: '#fff', borderRadius: 999, padding: '2px 8px', fontWeight: 700 }}>{alertas.length}</span>}
            </div>
            <div style={{ maxHeight: 300, overflowY: 'auto' }}>
              {alertas.length === 0 ? (
                <div style={{ padding: '20px 16px', textAlign: 'center', fontSize: 13, color: 'var(--text-muted)' }}>
                  Sin vencimientos en los próximos 7 días
                </div>
              ) : alertas.map(e => {
                const vencido = e.dias < 0
                const hoy = e.dias === 0
                const color = vencido ? 'var(--danger)' : hoy ? 'var(--warning)' : e.dias <= 3 ? 'var(--warning)' : 'var(--success)'
                const label = vencido ? `Vencido (${Math.abs(e.dias)}d)` : hoy ? 'Hoy' : `${e.dias}d`
                return (
                  <div
                    key={e.id}
                    onClick={() => { navigate('/app/expedientes'); setNotifOpen(false) }}
                    style={{
                      display: 'flex', gap: 10, padding: '10px 16px',
                      borderBottom: '1px solid var(--border)',
                      cursor: 'pointer',
                    }}
                    onMouseEnter={ev => ev.currentTarget.style.background = 'var(--surface-3)'}
                    onMouseLeave={ev => ev.currentTarget.style.background = 'transparent'}
                  >
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0, marginTop: 5 }}/>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--primary)' }}>{e.num}</div>
                      <div style={{ fontSize: 12, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {e.actor} vs. {e.demandado}
                      </div>
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 700, color, whiteSpace: 'nowrap', alignSelf: 'center' }}>{label}</span>
                  </div>
                )
              })}
            </div>
            {tieneAlertas && (
              <div style={{ padding: '10px 16px', borderTop: '1px solid var(--border)' }}>
                <button
                  onClick={() => { navigate('/app/expedientes'); setNotifOpen(false) }}
                  style={{ width: '100%', background: 'var(--primary)', color: '#fff', border: 'none', borderRadius: 'var(--radius)', padding: '8px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                >
                  Ver todos los expedientes
                </button>
              </div>
            )}
          </div>
        )}

        {/* Avatar */}
        <button
          onClick={() => { setMenuOpen(v => !v); setNotifOpen(false) }}
          style={{
            background: 'transparent', border: 'none', padding: '4px',
            display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer',
            borderRadius: 'var(--radius)',
          }}>
          <div style={{
            width: 32, height: 32, borderRadius: '50%',
            background: 'linear-gradient(135deg, var(--primary), var(--primary-dark))',
            color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 11, fontWeight: 700,
          }}>{iniciales(email)}</div>
        </button>

        {menuOpen && (
          <div style={{ ...dropdownStyle(), width: 240 }}>
            <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{email.split('@')[0]}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{email}</div>
            </div>
            <button onClick={handleSignOut} style={dropdownItem('var(--danger)')}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5"/><path d="M21 12H9"/>
              </svg>
              Cerrar sesión
            </button>
          </div>
        )}
      </div>

      <style>{`
        @media (min-width: 1024px) { .lx-search { display: block !important; } }
        @media (max-width: 1023px) { .lx-burger { display: inline-flex !important; align-items:center; } }
      `}</style>
    </header>
  )
}

const dropdownStyle = () => ({
  position: 'absolute', top: 'calc(100% + 8px)', right: 0,
  background: 'var(--surface)', border: '1px solid var(--border)',
  borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-lg)',
  width: 340, zIndex: 100, overflow: 'hidden',
})

const dropdownItem = (color) => ({
  width: '100%', display: 'flex', alignItems: 'center', gap: 10,
  padding: '10px 16px', background: 'transparent', border: 'none',
  color: color || 'var(--text)', fontSize: 13, textAlign: 'left', cursor: 'pointer',
})
