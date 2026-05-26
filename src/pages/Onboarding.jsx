import { useState } from 'react'
import { supabase } from '../supabaseClient'

/**
 * Onboarding — se muestra cuando el usuario autenticado no pertenece
 * a ningún despacho todavía.
 *
 * Opciones:
 *   1. Crear un despacho nuevo  →  el usuario queda como admin.
 *   2. Unirse con token         →  el usuario adopta el rol de la invitación.
 *
 * Después de cualquiera de las dos, llama a onComplete() para que App.jsx
 * re-evalúe el contexto de organización.
 */
export default function Onboarding({ session, onComplete }) {
  const [tab, setTab]       = useState('crear')   // 'crear' | 'unirse'
  const [nombre, setNombre] = useState('')
  const [token, setToken]   = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError]   = useState(null)

  // ── Crear despacho ──────────────────────────────────────────
  async function handleCrear(e) {
    e.preventDefault()
    const n = nombre.trim()
    if (!n) { setError('El nombre del despacho es obligatorio.'); return }
    setLoading(true); setError(null)

    try {
      // 1. Insertar el despacho
      const { data: desp, error: e1 } = await supabase
        .from('despachos')
        .insert({ nombre: n, owner_id: session.user.id, slug: generarSlug(n) })
        .select()
        .single()
      if (e1) throw e1

      // 2. Crear membresía como admin
      const { error: e2 } = await supabase
        .from('despacho_miembros')
        .insert({ despacho_id: desp.id, user_id: session.user.id, rol: 'admin' })
      if (e2) throw e2

      // 3. Migrar datos existentes del usuario al despacho (función PG)
      await supabase.rpc('migrar_datos_a_despacho', { p_despacho_id: desp.id })

      onComplete()
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  // ── Unirse con token ────────────────────────────────────────
  async function handleUnirse(e) {
    e.preventDefault()
    const t = token.trim().toUpperCase()
    if (t.length < 6) { setError('Ingresa el código de invitación completo.'); return }
    setLoading(true); setError(null)

    try {
      // 1. Buscar invitación válida
      const { data: inv, error: e1 } = await supabase
        .from('invitaciones')
        .select('id, despacho_id, rol, usada, expira_en, despacho:despachos(nombre)')
        .eq('token', t)
        .maybeSingle()

      if (e1 || !inv)           throw new Error('Código de invitación no encontrado.')
      if (inv.usada)            throw new Error('Este código ya fue utilizado.')
      if (new Date(inv.expira_en) < new Date()) throw new Error('El código ha expirado.')

      // 2. Crear membresía
      const { error: e2 } = await supabase
        .from('despacho_miembros')
        .insert({
          despacho_id: inv.despacho_id,
          user_id:     session.user.id,
          rol:         inv.rol,
          invitado_por: null,
        })
      if (e2) throw e2

      // 3. Marcar invitación como usada
      await supabase
        .from('invitaciones')
        .update({ usada: true })
        .eq('id', inv.id)

      // 4. Migrar datos existentes
      await supabase.rpc('migrar_datos_a_despacho', { p_despacho_id: inv.despacho_id })

      onComplete()
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'radial-gradient(ellipse at top, #1e3a5f 0%, #0f172a 70%)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 20, position: 'relative', overflow: 'hidden',
    }}>
      {/* Glow decorativo */}
      <div style={{
        position: 'absolute', top: '20%', left: '50%', width: 500, height: 500,
        transform: 'translateX(-50%)',
        background: 'radial-gradient(circle, rgba(96,165,250,.15) 0%, transparent 70%)',
        filter: 'blur(60px)', pointerEvents: 'none',
      }}/>

      <div style={{
        background: 'rgba(15,23,42,.55)',
        border: '1px solid rgba(96,165,250,.18)',
        borderRadius: 22, padding: '40px 36px',
        width: '100%', maxWidth: 460,
        boxShadow: '0 30px 80px rgba(0,0,0,.55)',
        backdropFilter: 'blur(20px)',
        position: 'relative', zIndex: 2,
      }}>
        {/* Logo + header */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <LogoMark/>
          <div style={{ color: '#fff', fontSize: 20, fontWeight: 800, letterSpacing: '2px', marginTop: 14 }}>
            Bienvenido a LexTrack
          </div>
          <div style={{ color: 'rgba(255,255,255,.55)', fontSize: 13, marginTop: 6 }}>
            Para continuar, crea tu despacho o únete a uno existente.
          </div>
        </div>

        {/* Tabs */}
        <div style={{
          display: 'flex', marginBottom: 24, borderRadius: 10,
          background: 'rgba(15,23,42,.7)',
          border: '1px solid rgba(96,165,250,.15)',
          overflow: 'hidden', padding: 3,
        }}>
          {[['crear', 'Crear despacho'], ['unirse', 'Unirme con código']].map(([k, lbl]) => (
            <button key={k} onClick={() => { setTab(k); setError(null) }} style={{
              flex: 1, padding: '9px', border: 'none',
              background: tab === k ? 'rgba(96,165,250,.2)' : 'transparent',
              color: tab === k ? '#60a5fa' : 'rgba(255,255,255,.55)',
              fontWeight: tab === k ? 700 : 500,
              cursor: 'pointer', fontSize: 13, borderRadius: 7,
              transition: 'all .15s ease',
            }}>{lbl}</button>
          ))}
        </div>

        {/* Crear despacho */}
        {tab === 'crear' && (
          <form onSubmit={handleCrear} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={labelStyle}>Nombre del despacho</label>
              <input
                style={inputStyle}
                value={nombre}
                onChange={e => setNombre(e.target.value)}
                placeholder="Ej. Sánchez & Asociados"
                autoFocus
                required
              />
            </div>

            {error && <ErrorMsg>{error}</ErrorMsg>}

            <button type="submit" disabled={loading} style={btnPri}>
              {loading ? 'Creando...' : 'Crear mi despacho'}
            </button>

            <p style={{ fontSize: 11, color: 'rgba(255,255,255,.4)', textAlign: 'center', margin: 0 }}>
              Quedas como administrador. Podrás invitar a tu equipo desde Configuración → Usuarios.
            </p>
          </form>
        )}

        {/* Unirse con código */}
        {tab === 'unirse' && (
          <form onSubmit={handleUnirse} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={labelStyle}>Código de invitación</label>
              <input
                style={{ ...inputStyle, textTransform: 'uppercase', letterSpacing: '4px', fontSize: 18, textAlign: 'center', fontWeight: 700 }}
                value={token}
                onChange={e => setToken(e.target.value.toUpperCase())}
                placeholder="XXXXXXXX"
                maxLength={8}
                autoFocus
                required
              />
              <p style={{ fontSize: 11, color: 'rgba(255,255,255,.4)', marginTop: 6 }}>
                El administrador de tu despacho genera este código desde Usuarios → Invitar.
              </p>
            </div>

            {error && <ErrorMsg>{error}</ErrorMsg>}

            <button type="submit" disabled={loading} style={btnPri}>
              {loading ? 'Verificando...' : 'Unirme al despacho'}
            </button>
          </form>
        )}

        {/* Cerrar sesión */}
        <div style={{ marginTop: 24, paddingTop: 18, borderTop: '1px solid rgba(255,255,255,.08)', textAlign: 'center' }}>
          <button
            onClick={() => supabase.auth.signOut()}
            style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,.35)', fontSize: 12, cursor: 'pointer', textDecoration: 'underline' }}
          >
            Cerrar sesión
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Helpers ──────────────────────────────────────────────────
function generarSlug(nombre) {
  return nombre.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48)
}

function ErrorMsg({ children }) {
  return (
    <div style={{
      background: 'rgba(248,113,113,.12)',
      border: '1px solid rgba(248,113,113,.3)',
      color: '#fca5a5', padding: '10px 14px',
      borderRadius: 10, fontSize: 13,
    }}>{children}</div>
  )
}

function LogoMark() {
  return (
    <div style={{
      width: 56, height: 56, borderRadius: 14, margin: '0 auto',
      background: 'linear-gradient(135deg, #60a5fa, #1e3a8a)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      boxShadow: '0 12px 32px rgba(96,165,250,.4)',
    }}>
      <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 3v18"/><path d="M6 7h12"/>
        <path d="M3 11l3-4 3 4"/><path d="M15 11l3-4 3 4"/>
        <path d="M3 11c0 1.5 1.5 3 3 3s3-1.5 3-3"/>
        <path d="M15 11c0 1.5 1.5 3 3 3s3-1.5 3-3"/>
        <path d="M8 21h8"/>
      </svg>
    </div>
  )
}

const labelStyle = {
  display: 'block', fontSize: 11, color: 'rgba(255,255,255,.65)',
  letterSpacing: '.8px', textTransform: 'uppercase', fontWeight: 700, marginBottom: 6,
}
const inputStyle = {
  width: '100%', background: 'rgba(15,23,42,.6)',
  border: '1px solid rgba(96,165,250,.18)', color: '#fff',
  padding: '11px 14px', borderRadius: 10, fontSize: 14, outline: 'none',
  boxSizing: 'border-box',
}
const btnPri = {
  padding: '12px', background: 'linear-gradient(135deg, #2563eb, #1e3a8a)',
  border: 'none', color: '#fff', borderRadius: 10,
  fontSize: 14, fontWeight: 700, letterSpacing: '.4px',
  cursor: 'pointer', boxShadow: '0 12px 28px rgba(37,99,235,.4)',
}
