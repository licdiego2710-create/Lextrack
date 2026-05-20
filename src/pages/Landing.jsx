import { Link } from 'react-router-dom'

const PRIMARY = '#2563eb'
const TEXT = '#0f172a'
const MUTED = '#64748b'
const BORDER = '#e2e8f0'
const SURFACE = '#ffffff'

// Reset local: Landing siempre se ve en modo claro (es público).
const Section = ({ children, style }) => (
  <section style={{ padding: '80px 24px', ...style }}>
    <div style={{ maxWidth: 1180, margin: '0 auto' }}>{children}</div>
  </section>
)

const FEATURES = [
  ['Expedientes', 'Alta y seguimiento de cada expediente con materia, juzgado, partes, etapa y estado.', 'M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z'],
  ['Demandas', 'Captura y flujo de demandas: nueva, prevención, cumplimiento, admisión o desechamiento.', 'M14 4l6 6 M9 9l8-8 4 4-8 8 M11 11L4 18 M3 21h7'],
  ['Prevenciones', 'Control de fechas de prevención y notas para resolver antes del plazo.', 'M12 9v4 M12 17h.01 M10.3 3.86l-8.39 14a2 2 0 0 0 1.71 3h16.78a2 2 0 0 0 1.71-3l-8.39-14a2 2 0 0 0-3.42 0Z'],
  ['Cumplimientos', 'Registra cuándo se cumplimentó la prevención y mantiene un historial.', 'M9 12l2.5 2.5L16 7 M3 12a9 9 0 1 0 18 0 9 9 0 0 0-18 0Z'],
  ['Admisiones', 'Marcado claro de admisión con fecha y referencia al acuerdo.', 'M5 13l4 4L19 7'],
  ['Desechamientos', 'Registro de desechamiento de demanda y observaciones.', 'M18 6L6 18 M6 6l12 12'],
  ['Turnos', 'Reparto de expedientes y demandas por abogado responsable.', 'M3 12h18 M3 6h18 M3 18h12'],
  ['Tareas', 'Tareas vinculadas a expedientes con responsable, prioridad y plazo.', 'M3 4h18 M3 12h18 M3 20h12'],
  ['Términos judiciales', 'Calculadora de plazos en días hábiles según calendario del CJE Jalisco.', 'M12 6v6l4 2 M3 12a9 9 0 1 0 18 0 9 9 0 0 0-18 0Z'],
  ['Agenda', 'Vista mensual con vencimientos, audiencias y diligencias.', 'M3 5h18v16H3z M8 3v4 M16 3v4 M3 10h18'],
  ['Audiencias', 'Programa audiencias, conciliaciones y desahogo de pruebas.', 'M3 6l9 6 9-6 M3 6v12h18V6'],
  ['Diligencias', 'Notificaciones, emplazamientos y diligencias actuariales.', 'M21 11.5a8.4 8.4 0 0 1-9 8.4 8.5 8.5 0 0 1-7.6-4.9L3 21l1-3.7A8.5 8.5 0 0 1 12 3a8.5 8.5 0 0 1 9 8.5Z'],
  ['Documentos', 'Almacenamiento de archivos por expediente, con descarga segura.', 'M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z M14 3v5h5'],
  ['Partes procesales', 'Personas físicas o morales, actores, demandados, terceros.', 'M9 8a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z M2 20c0-3.5 3-6 7-6s7 2.5 7 6'],
  ['Abogados autorizados', 'Apoderados y autorizados por expediente con datos de contacto.', 'M16 21a4 4 0 0 0-8 0 M12 13a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z'],
  ['Historial de actuaciones', 'Bitácora cronológica de cada movimiento del expediente.', 'M12 6v6l4 2 M3 12a9 9 0 1 0 18 0 9 9 0 0 0-18 0Z'],
  ['Estadísticas', 'KPIs y gráficas mensuales por estado, tipo de juicio y abogado.', 'M3 21V8 M9 21V12 M15 21V5 M21 21V14'],
  ['Reportes mensuales', 'Generación de reportes imprimibles con membrete.', 'M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z M14 3v5h5 M9 13h6'],
  ['Usuarios y roles', 'Gestión de equipo con roles (Admin, Abogado, Pasante).', 'M16 4a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7 M8 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8 M2 21c0-4 3-7 6-7s6 3 6 7 M14 21c0-3 2-5 5-5s5 2 5 5'],
  ['Bitácora de actividad', 'Auditoría de quién hizo qué y cuándo en el sistema.', 'M12 6v6l4 2 M3 12a9 9 0 1 0 18 0 9 9 0 0 0-18 0Z'],
]

const FieldIcon = ({ d }) => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={PRIMARY} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <path d={d}/>
  </svg>
)

export default function Landing() {
  // Forzamos modo claro en landing: ignoramos data-theme global.
  return (
    <div style={{ background: '#fff', color: TEXT, fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif', minHeight: '100vh' }}>
      {/* === Navbar público === */}
      <header style={{
        position: 'sticky', top: 0, zIndex: 50,
        background: 'rgba(255,255,255,0.85)',
        backdropFilter: 'blur(12px)',
        borderBottom: `1px solid ${BORDER}`,
      }}>
        <div style={{ maxWidth: 1180, margin: '0 auto', padding: '14px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 20 }}>
          <BrandLogo/>
          <nav style={{ display: 'flex', alignItems: 'center', gap: 28 }} className="lx-nav-desktop">
            <a href="#features" style={navLink}>Funcionalidades</a>
            <a href="#mexico" style={navLink}>Para México</a>
            <a href="#comparativa" style={navLink}>Comparativa</a>
          </nav>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <Link to="/auth" style={{ ...secondaryBtn, padding: '8px 14px' }}>Iniciar sesión</Link>
            <Link to="/auth" style={{ ...primaryBtn, padding: '9px 16px' }}>Empezar gratis</Link>
          </div>
        </div>
        <style>{`
          @media (max-width: 768px) { .lx-nav-desktop { display: none !important; } }
        `}</style>
      </header>

      {/* === Hero === */}
      <Section style={{
        paddingTop: 80, paddingBottom: 60,
        background: 'linear-gradient(180deg, #f1f7ff 0%, #ffffff 70%)',
        position: 'relative', overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute', top: -120, right: -120, width: 480, height: 480,
          background: 'radial-gradient(circle, rgba(37,99,235,.18) 0%, transparent 70%)',
          filter: 'blur(40px)', pointerEvents: 'none',
        }}/>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 60, alignItems: 'center' }} className="lx-hero-grid">
          <div>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              padding: '6px 14px',
              borderRadius: 999,
              background: '#dbeafe',
              color: '#1d4ed8',
              fontSize: 12, fontWeight: 600,
              marginBottom: 24,
            }}>
              Plataforma jurídica mexicana <span>🇲🇽</span>
            </div>
            <h1 style={{
              fontSize: 'clamp(36px, 5vw, 56px)',
              lineHeight: 1.08,
              fontWeight: 800,
              letterSpacing: '-1.5px',
              color: TEXT,
              margin: 0,
              marginBottom: 18,
            }}>
              Control total de tus<br/>
              <span style={{
                background: 'linear-gradient(90deg, #2563eb, #1e3a8a)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}>expedientes jurídicos</span>
            </h1>
            <p style={{ fontSize: 17, lineHeight: 1.6, color: MUTED, maxWidth: 540, marginBottom: 32 }}>
              Administra demandas, prevenciones, admisiones, términos y estadísticas mensuales desde una sola
              plataforma diseñada para el trabajo jurídico en México.
            </p>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <Link to="/auth" style={{ ...primaryBtn, padding: '13px 24px', fontSize: 14 }}>
                Entrar al sistema →
              </Link>
              <a href="#features" style={{ ...secondaryBtn, padding: '13px 24px', fontSize: 14 }}>
                Ver funcionalidades
              </a>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 24, marginTop: 32, color: MUTED, fontSize: 13 }}>
              <Check/> Sin tarjeta
              <Check/> Setup inmediato
              <Check/> Soporte en español
            </div>
          </div>

          {/* Dashboard mockup */}
          <DashboardMockup/>
        </div>

        <style>{`
          @media (max-width: 960px) {
            .lx-hero-grid { grid-template-columns: 1fr !important; gap: 40px !important; }
          }
        `}</style>
      </Section>

      {/* === Stats === */}
      <Section style={{ padding: '40px 24px', background: SURFACE }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: 20,
          background: '#f8fafc',
          border: `1px solid ${BORDER}`,
          borderRadius: 20,
          padding: '32px 28px',
        }}>
          {[
            ['15,000+', 'Expedientes gestionados'],
            ['300+', 'Despachos jurídicos'],
            ['99.9%', 'Tiempo activo'],
            ['100%', 'México'],
          ].map(([v, l], i) => (
            <div key={i} style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 32, fontWeight: 800, color: PRIMARY, letterSpacing: '-0.5px' }}>{v}</div>
              <div style={{ fontSize: 13, color: MUTED, marginTop: 4 }}>{l}</div>
            </div>
          ))}
        </div>
      </Section>

      {/* === Features === */}
      <Section style={{ background: SURFACE }} >
        <div id="features" style={{ textAlign: 'center', marginBottom: 56 }}>
          <Tag>Funcionalidades</Tag>
          <h2 style={h2Style}>Todo lo que necesitas para llevar la práctica del despacho</h2>
          <p style={{ ...pStyle, maxWidth: 640, margin: '12px auto 0' }}>
            Desde la captura de la demanda hasta el archivo del expediente. Cubrimos todo el ciclo
            jurídico mexicano con campos, estados y reportes pensados para la realidad de los juzgados.
          </p>
        </div>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: 16,
        }}>
          {FEATURES.map(([title, desc, path], i) => (
            <div key={i} style={featureCard}>
              <div style={featureIcon}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={PRIMARY} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                  <path d={path}/>
                </svg>
              </div>
              <div style={{ fontSize: 14, fontWeight: 700, color: TEXT, marginBottom: 4 }}>{title}</div>
              <div style={{ fontSize: 12.5, color: MUTED, lineHeight: 1.5 }}>{desc}</div>
            </div>
          ))}
        </div>
      </Section>

      {/* === Hecho para México === */}
      <Section id="mexico" style={{ background: '#f8fafc' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 60, alignItems: 'center' }} className="lx-mex-grid">
          <div>
            <Tag>Hecho para México</Tag>
            <h2 style={h2Style}>Hablamos el lenguaje del sistema jurídico mexicano</h2>
            <p style={pStyle}>
              Estados procesales, términos legales y campos diseñados para reflejar la práctica real:
              juzgados de partido, materia mercantil, civil, familiar, laboral y administrativa,
              prevenciones del Consejo de la Judicatura y festivos federales.
            </p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 22 }}>
              {['Calendario CJE Jalisco', 'Festivos federales', 'Días hábiles', 'Materia federal y local'].map(t => (
                <span key={t} style={chip}>{t}</span>
              ))}
            </div>
          </div>
          <div style={{
            background: SURFACE,
            border: `1px solid ${BORDER}`,
            borderRadius: 18,
            padding: 24,
            boxShadow: '0 10px 30px rgba(15,23,42,.06)',
          }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14 }}>
              {[
                ['Núm. de expediente', '306/2024', 'M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z M14 3v5h5'],
                ['Juzgado', 'Juzgado 9° Mercantil', 'M3 21h18 M5 21V8l7-5 7 5v13'],
                ['Materia', 'Mercantil', 'M12 3v18 M6 7h12'],
                ['Tipo de juicio', 'Ordinario Mercantil', 'M14 4l6 6 M9 9l8-8 4 4-8 8 M11 11L4 18'],
                ['Parte actora', 'Construcciones Pacífico', 'M9 8a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z M2 20c0-3.5 3-6 7-6s7 2.5 7 6'],
                ['Parte demandada', 'Inversiones Hospitalarias', 'M16 4a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7'],
                ['Estado procesal', 'Etapa Probatoria', 'M12 6v6l4 2 M3 12a9 9 0 1 0 18 0 9 9 0 0 0-18 0Z'],
                ['Prevención', 'No aplica', 'M12 9v4 M12 17h.01'],
                ['Admisión', '12 nov 2024', 'M9 12l2.5 2.5L16 7'],
                ['Término', 'Vence en 4 días', 'M12 6v6l4 2 M3 12a9 9 0 1 0 18 0 9 9 0 0 0-18 0Z'],
              ].map(([label, value, d], i) => (
                <div key={i} style={{
                  background: '#f8fafc',
                  border: `1px solid ${BORDER}`,
                  borderRadius: 12,
                  padding: '12px 14px',
                  display: 'flex',
                  gap: 12,
                  alignItems: 'center',
                }}>
                  <FieldIcon d={d}/>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 10, color: MUTED, textTransform: 'uppercase', letterSpacing: '.5px', fontWeight: 700 }}>{label}</div>
                    <div style={{ fontSize: 13, color: TEXT, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{value}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
        <style>{`
          @media (max-width: 960px) {
            .lx-mex-grid { grid-template-columns: 1fr !important; gap: 36px !important; }
          }
        `}</style>
      </Section>

      {/* === Comparativa === */}
      <Section id="comparativa" style={{ background: SURFACE }}>
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <Tag>Comparativa</Tag>
          <h2 style={h2Style}>LexTrack MX vs. gestión tradicional</h2>
        </div>
        <div style={{
          maxWidth: 900, margin: '0 auto',
          background: SURFACE,
          border: `1px solid ${BORDER}`,
          borderRadius: 18,
          overflow: 'hidden',
          boxShadow: '0 10px 30px rgba(15,23,42,.04)',
        }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: '2fr 1fr 1fr',
            background: '#f8fafc',
            padding: '16px 24px',
            fontSize: 12,
            fontWeight: 700,
            color: MUTED,
            textTransform: 'uppercase',
            letterSpacing: '.5px',
            borderBottom: `1px solid ${BORDER}`,
          }}>
            <div>Característica</div>
            <div style={{ textAlign: 'center', color: PRIMARY }}>LexTrack MX</div>
            <div style={{ textAlign: 'center' }}>Tradicional</div>
          </div>
          {[
            ['Acceso desde cualquier dispositivo', true, false],
            ['Cálculo automático de plazos procesales', true, false],
            ['Alertas y recordatorios de vencimientos', true, false],
            ['Estadísticas mensuales en tiempo real', true, false],
            ['Búsqueda instantánea de expedientes', true, false],
          ].map(([label], i) => (
            <div key={i} style={{
              display: 'grid',
              gridTemplateColumns: '2fr 1fr 1fr',
              padding: '16px 24px',
              borderBottom: i < 4 ? `1px solid ${BORDER}` : 'none',
              alignItems: 'center',
              fontSize: 14,
              color: TEXT,
            }}>
              <div>{label}</div>
              <div style={{ textAlign: 'center', color: '#16a34a' }}><Check/></div>
              <div style={{ textAlign: 'center', color: '#dc2626' }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline-block', verticalAlign: 'middle' }}>
                  <circle cx="12" cy="12" r="10"/><path d="M15 9l-6 6"/><path d="M9 9l6 6"/>
                </svg>
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* === CTA === */}
      <Section style={{
        background: 'linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%)',
        color: '#fff',
        textAlign: 'center',
      }}>
        <h2 style={{ ...h2Style, color: '#fff', marginBottom: 16 }}>
          Empieza a controlar tus expedientes<br/>con precisión jurídica
        </h2>
        <p style={{ fontSize: 16, color: '#dbeafe', maxWidth: 540, margin: '0 auto 28px' }}>
          Súmate a los despachos mexicanos que ya digitalizaron su práctica con LexTrack MX.
        </p>
        <Link to="/auth" style={{
          ...primaryBtn,
          background: '#fff',
          color: PRIMARY,
          padding: '14px 28px',
          fontSize: 14,
          boxShadow: '0 12px 30px rgba(0,0,0,.25)',
        }}>
          Entrar al sistema →
        </Link>
      </Section>

      {/* === Footer === */}
      <footer style={{
        background: '#0f172a',
        color: '#94a3b8',
        padding: '40px 24px 24px',
      }}>
        <div style={{ maxWidth: 1180, margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 32 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <BrandLogoDark/>
            </div>
            <p style={{ fontSize: 13, lineHeight: 1.6 }}>
              Plataforma de gestión jurídica para despachos y áreas legales en México.
            </p>
          </div>
          <div>
            <div style={footerHead}>Producto</div>
            <a href="#features" style={footerLink}>Funcionalidades</a>
            <a href="#mexico" style={footerLink}>Para México</a>
            <a href="#comparativa" style={footerLink}>Comparativa</a>
          </div>
          <div>
            <div style={footerHead}>Empresa</div>
            <Link to="/auth" style={footerLink}>Iniciar sesión</Link>
            <Link to="/auth" style={footerLink}>Crear cuenta</Link>
          </div>
          <div>
            <div style={footerHead}>Legal</div>
            <a style={footerLink}>Términos</a>
            <a style={footerLink}>Privacidad</a>
          </div>
        </div>
        <div style={{ maxWidth: 1180, margin: '40px auto 0', borderTop: '1px solid #1e293b', paddingTop: 20, textAlign: 'center', fontSize: 12 }}>
          © {new Date().getFullYear()} LexTrack MX — Hecho con precisión jurídica desde México.
        </div>
      </footer>
    </div>
  )
}

/* ---------- componentes auxiliares ---------- */

const BrandLogo = () => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
    <div style={{
      width: 36, height: 36, borderRadius: 10,
      background: 'linear-gradient(135deg, #2563eb, #1e3a8a)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      boxShadow: '0 4px 12px rgba(37,99,235,.3)',
    }}>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 3v18"/><path d="M6 7h12"/>
        <path d="M3 11l3-4 3 4"/><path d="M15 11l3-4 3 4"/>
        <path d="M3 11c0 1.5 1.5 3 3 3s3-1.5 3-3"/><path d="M15 11c0 1.5 1.5 3 3 3s3-1.5 3-3"/>
        <path d="M8 21h8"/>
      </svg>
    </div>
    <div>
      <div style={{ fontSize: 14, fontWeight: 800, color: TEXT, letterSpacing: '1.6px' }}>LEXTRACK</div>
      <div style={{ fontSize: 9.5, fontWeight: 700, color: PRIMARY, letterSpacing: '3px', marginTop: 1 }}>MÉXICO</div>
    </div>
  </div>
)

const BrandLogoDark = () => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
    <div style={{
      width: 36, height: 36, borderRadius: 10,
      background: 'linear-gradient(135deg, #2563eb, #60a5fa)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 3v18"/><path d="M6 7h12"/>
        <path d="M3 11l3-4 3 4"/><path d="M15 11l3-4 3 4"/>
        <path d="M3 11c0 1.5 1.5 3 3 3s3-1.5 3-3"/><path d="M15 11c0 1.5 1.5 3 3 3s3-1.5 3-3"/>
        <path d="M8 21h8"/>
      </svg>
    </div>
    <div>
      <div style={{ fontSize: 14, fontWeight: 800, color: '#fff', letterSpacing: '1.6px' }}>LEXTRACK</div>
      <div style={{ fontSize: 9.5, fontWeight: 700, color: '#60a5fa', letterSpacing: '3px', marginTop: 1 }}>MÉXICO</div>
    </div>
  </div>
)

const Check = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: 'middle' }}>
    <path d="M5 13l4 4L19 7"/>
  </svg>
)

const Tag = ({ children }) => (
  <div style={{
    display: 'inline-block',
    padding: '4px 12px',
    borderRadius: 999,
    background: '#dbeafe',
    color: '#1d4ed8',
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: '1px',
    textTransform: 'uppercase',
    marginBottom: 16,
  }}>{children}</div>
)

function DashboardMockup() {
  return (
    <div style={{
      position: 'relative',
      background: 'linear-gradient(135deg, #ffffff 0%, #f0f7ff 100%)',
      border: '1px solid rgba(37,99,235,.15)',
      borderRadius: 18,
      padding: 22,
      boxShadow: '0 30px 60px rgba(37,99,235,.18), 0 12px 24px rgba(15,23,42,.06)',
      backdropFilter: 'blur(20px)',
    }}>
      {/* Top bar */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 18 }}>
        <span style={dot('#fb7185')}/><span style={dot('#fbbf24')}/><span style={dot('#34d399')}/>
        <div style={{
          marginLeft: 12, flex: 1, height: 22,
          background: '#fff', border: `1px solid ${BORDER}`,
          borderRadius: 6,
        }}/>
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginBottom: 14 }}>
        {[['42','Total','#2563eb'],['18','Activos','#16a34a'],['5','Urgentes','#d97706']].map(([n,l,c],i)=>(
          <div key={i} style={{ background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 10, padding: '10px 12px' }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: c }}>{n}</div>
            <div style={{ fontSize: 10, color: MUTED, textTransform: 'uppercase', letterSpacing: '.5px', fontWeight: 700, marginTop: 2 }}>{l}</div>
          </div>
        ))}
      </div>

      {/* Chart fake */}
      <div style={{ background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 10, padding: 14, marginBottom: 10 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 10 }}>Por estado procesal</div>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 64 }}>
          {[55, 88, 40, 70, 95, 60, 78].map((h, i) => (
            <div key={i} style={{
              flex: 1, height: `${h}%`,
              background: `linear-gradient(180deg, #2563eb, #60a5fa)`,
              borderRadius: '4px 4px 0 0', opacity: 0.6 + (i % 3) * 0.13,
            }}/>
          ))}
        </div>
      </div>

      {/* List */}
      <div style={{ background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 10, padding: 12 }}>
        {[
          ['306/2024', 'Construcciones Pacífico vs. IHO', '#dc2626', 'Vence hoy'],
          ['412/2024', 'Ruiz vs. Distribuidora Comercial', '#d97706', '2 días'],
          ['208/2024', 'Banco Mercantil vs. Aguilar', '#2563eb', '5 días'],
        ].map(([num, parte, col, lbl], i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0', borderBottom: i < 2 ? `1px solid ${BORDER}` : 'none' }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: col }}/>
            <div style={{ fontSize: 11, color: PRIMARY, fontWeight: 700, minWidth: 60 }}>{num}</div>
            <div style={{ fontSize: 11, color: TEXT, flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{parte}</div>
            <div style={{ fontSize: 10, color: col, fontWeight: 700, background: `${col}1a`, padding: '2px 8px', borderRadius: 999 }}>{lbl}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

const dot = (color) => ({ width: 10, height: 10, borderRadius: '50%', background: color })

/* ---------- estilos ---------- */
const navLink = { fontSize: 13, color: TEXT, fontWeight: 500, cursor: 'pointer' }
const primaryBtn = {
  background: PRIMARY, color: '#fff',
  border: 'none', borderRadius: 10,
  fontWeight: 600, fontSize: 13,
  cursor: 'pointer', textDecoration: 'none',
  display: 'inline-flex', alignItems: 'center', gap: 6,
  boxShadow: '0 4px 12px rgba(37,99,235,.25)',
  transition: 'transform .1s ease',
}
const secondaryBtn = {
  background: '#fff', color: TEXT,
  border: `1px solid ${BORDER}`,
  borderRadius: 10,
  fontWeight: 600, fontSize: 13,
  cursor: 'pointer', textDecoration: 'none',
  display: 'inline-flex', alignItems: 'center', gap: 6,
}
const h2Style = { fontSize: 'clamp(26px, 3.5vw, 38px)', fontWeight: 800, letterSpacing: '-1px', color: TEXT, margin: 0 }
const pStyle = { fontSize: 15, color: MUTED, lineHeight: 1.6 }
const featureCard = {
  background: '#fff',
  border: `1px solid ${BORDER}`,
  borderRadius: 14,
  padding: '18px 18px 16px',
  transition: 'transform .15s ease, box-shadow .15s ease, border-color .15s ease',
}
const featureIcon = {
  width: 40, height: 40, borderRadius: 10,
  background: '#dbeafe',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  marginBottom: 12,
}
const chip = {
  padding: '6px 12px', background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 999,
  fontSize: 12, color: TEXT, fontWeight: 500,
}
const footerHead = { color: '#fff', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 10 }
const footerLink = { display: 'block', color: '#94a3b8', fontSize: 13, padding: '4px 0', textDecoration: 'none', cursor: 'pointer' }
