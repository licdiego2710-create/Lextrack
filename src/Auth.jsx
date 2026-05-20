import { useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from './supabaseClient'

export default function Auth() {
  const [mode, setMode] = useState('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState(null)
  const [err, setErr] = useState(null)

  const handle = async e => {
    e.preventDefault()
    setLoading(true); setErr(null); setMsg(null)
    try {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
      } else if (mode === 'register') {
        const { error } = await supabase.auth.signUp({ email, password })
        if (error) throw error
        setMsg('Registro exitoso. Revisa tu correo para confirmar tu cuenta.')
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin })
        if (error) throw error
        setMsg('Se envió un enlace de recuperación a tu correo.')
      }
    } catch (e) {
      setErr(e.message)
    }
    setLoading(false)
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'radial-gradient(ellipse at top, #1e3a5f 0%, #0f172a 70%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 20,
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Glow decorativo */}
      <div style={{
        position: 'absolute', top: '20%', left: '50%',
        width: 500, height: 500, transform: 'translateX(-50%)',
        background: 'radial-gradient(circle, rgba(96,165,250,.15) 0%, transparent 70%)',
        filter: 'blur(60px)', pointerEvents: 'none',
      }}/>

      <Link to="/" style={{
        position: 'absolute', top: 24, left: 24,
        color: 'rgba(255,255,255,.6)', fontSize: 13, textDecoration: 'none',
        display: 'flex', alignItems: 'center', gap: 6, zIndex: 2,
      }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M15 18l-6-6 6-6"/>
        </svg>
        Volver
      </Link>

      <div style={{
        background: 'rgba(15,23,42,.55)',
        border: '1px solid rgba(96,165,250,.18)',
        borderRadius: 22,
        padding: '40px 36px',
        width: '100%',
        maxWidth: 420,
        boxShadow: '0 30px 80px rgba(0,0,0,.55)',
        backdropFilter: 'blur(20px)',
        position: 'relative',
        zIndex: 2,
      }}>
        {/* Logo */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 28 }}>
          <div style={{
            width: 56, height: 56, borderRadius: 14,
            background: 'linear-gradient(135deg, #60a5fa, #1e3a8a)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 12px 32px rgba(96,165,250,.4)',
            marginBottom: 14,
          }}>
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 3v18"/><path d="M6 7h12"/>
              <path d="M3 11l3-4 3 4"/><path d="M15 11l3-4 3 4"/>
              <path d="M3 11c0 1.5 1.5 3 3 3s3-1.5 3-3"/><path d="M15 11c0 1.5 1.5 3 3 3s3-1.5 3-3"/>
              <path d="M8 21h8"/>
            </svg>
          </div>
          <div style={{ color: '#fff', fontSize: 18, letterSpacing: '3px', fontWeight: 800 }}>LEXTRACK</div>
          <div style={{ color: '#60a5fa', fontSize: 10, letterSpacing: '4px', fontWeight: 700, marginTop: 2 }}>MÉXICO</div>
        </div>

        {mode !== 'forgot' && (
          <div style={{
            display: 'flex',
            marginBottom: 24,
            borderRadius: 10,
            background: 'rgba(15,23,42,.7)',
            border: '1px solid rgba(96,165,250,.15)',
            overflow: 'hidden',
            padding: 3,
          }}>
            {['login', 'register'].map(m => (
              <button key={m}
                onClick={() => { setMode(m); setErr(null); setMsg(null) }}
                style={{
                  flex: 1, padding: '9px',
                  border: 'none',
                  background: mode === m ? 'rgba(96,165,250,.2)' : 'transparent',
                  color: mode === m ? '#60a5fa' : 'rgba(255,255,255,.55)',
                  fontWeight: mode === m ? 700 : 500,
                  cursor: 'pointer', fontSize: 13,
                  borderRadius: 7,
                  transition: 'all .15s ease',
                }}>
                {m === 'login' ? 'Iniciar sesión' : 'Registrarse'}
              </button>
            ))}
          </div>
        )}

        <form onSubmit={handle} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label style={labelStyle}>Correo electrónico</label>
            <input
              style={inputStyle}
              type="email" required
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="abogado@despacho.mx"
            />
          </div>
          {mode !== 'forgot' && (
            <div>
              <label style={labelStyle}>Contraseña</label>
              <input
                style={inputStyle}
                type="password" required
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder={mode === 'register' ? 'Mínimo 8 caracteres' : '••••••••'}
                minLength={mode === 'register' ? 8 : undefined}
              />
            </div>
          )}

          {err && (
            <div style={{
              background: 'rgba(248,113,113,.12)',
              border: '1px solid rgba(248,113,113,.3)',
              color: '#fca5a5',
              padding: '10px 14px',
              borderRadius: 10, fontSize: 13,
            }}>{err}</div>
          )}
          {msg && (
            <div style={{
              background: 'rgba(74,222,128,.12)',
              border: '1px solid rgba(74,222,128,.3)',
              color: '#86efac',
              padding: '10px 14px',
              borderRadius: 10, fontSize: 13,
            }}>{msg}</div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              marginTop: 6,
              padding: '12px',
              background: 'linear-gradient(135deg, #2563eb, #1e3a8a)',
              border: 'none',
              color: '#fff',
              borderRadius: 10,
              fontSize: 14, fontWeight: 700, letterSpacing: '.4px',
              cursor: loading ? 'wait' : 'pointer',
              boxShadow: '0 12px 28px rgba(37,99,235,.4)',
              transition: 'transform .1s ease',
            }}
          >
            {loading ? 'Procesando...' : mode === 'login' ? 'Entrar al sistema' : mode === 'register' ? 'Crear cuenta' : 'Enviar enlace'}
          </button>

          {mode === 'login' && (
            <button type="button"
              onClick={() => { setMode('forgot'); setErr(null); setMsg(null) }}
              style={linkStyle}>
              ¿Olvidaste tu contraseña?
            </button>
          )}
          {mode === 'forgot' && (
            <button type="button"
              onClick={() => { setMode('login'); setErr(null); setMsg(null) }}
              style={linkStyle}>
              ← Volver al inicio de sesión
            </button>
          )}
        </form>

        <div style={{
          marginTop: 24, paddingTop: 18,
          borderTop: '1px solid rgba(255,255,255,.08)',
          textAlign: 'center',
          fontSize: 11, color: 'rgba(255,255,255,.4)', letterSpacing: '.5px',
        }}>
          Sistema de Seguimiento de Expedientes
        </div>
      </div>
    </div>
  )
}

const labelStyle = {
  display: 'block',
  fontSize: 11,
  color: 'rgba(255,255,255,.65)',
  letterSpacing: '.8px',
  textTransform: 'uppercase',
  fontWeight: 700,
  marginBottom: 6,
}
const inputStyle = {
  width: '100%',
  background: 'rgba(15,23,42,.6)',
  border: '1px solid rgba(96,165,250,.18)',
  color: '#fff',
  padding: '11px 14px',
  borderRadius: 10,
  fontSize: 14,
  outline: 'none',
  transition: 'border-color .15s ease, box-shadow .15s ease',
}
const linkStyle = {
  background: 'none', border: 'none',
  color: 'rgba(96,165,250,.85)',
  fontSize: 12, cursor: 'pointer',
  marginTop: 4, padding: 4,
  textDecoration: 'underline',
}
