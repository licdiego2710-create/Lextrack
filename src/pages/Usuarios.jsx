import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../supabaseClient'
import { useOrg } from '../context/OrgContext'
import { useToast } from '../context/ToastContext'
import { iniciales } from '../utils/helpers'
import PageHeader from '../components/ui/PageHeader'
import StatusBadge from '../components/ui/StatusBadge'
import EmptyState from '../components/ui/EmptyState'
import Modal from '../components/ui/Modal'

const ROLES = ['admin', 'abogado', 'asistente', 'cliente']
const ROL_LABEL = { admin: 'Administrador', abogado: 'Abogado', asistente: 'Asistente', cliente: 'Cliente' }
const ROL_TONE  = { admin: 'primary', abogado: 'success', asistente: 'default', cliente: 'info' }

// Genera un token alfanumérico de 8 caracteres en mayúsculas.
function generarToken() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // sin 0/O/I/1 para evitar confusión
  return Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

export default function Usuarios({ session }) {
  const { org, isAdmin, refetch } = useOrg()
  const toast = useToast()

  const [miembros, setMiembros]         = useState([])
  const [invitaciones, setInvitaciones] = useState([])
  const [loading, setLoading]           = useState(true)

  // Renombrar despacho
  const [nombreDespacho, setNombreDespacho] = useState('')
  const [renombrando, setRenombrando]       = useState(false)

  // Modal invitar
  const [modalInvitar, setModalInvitar] = useState(false)
  const [invEmail, setInvEmail]         = useState('')
  const [invRol, setInvRol]             = useState('abogado')
  const [saving, setSaving]             = useState(false)
  const [tokenGenerado, setTokenGenerado] = useState(null)
  const [copiado, setCopiado]           = useState(false)

  // Sincronizar nombre del despacho cuando carga
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { if (org?.nombre) setNombreDespacho(org.nombre) }, [org])

  // Renombrar despacho
  async function handleRenombrar(e) {
    e.preventDefault()
    const n = nombreDespacho.trim()
    if (!n || n === org.nombre) return
    setRenombrando(true)
    const { error } = await supabase
      .from('despachos')
      .update({ nombre: n, actualizado_en: new Date().toISOString() })
      .eq('id', org.id)
    setRenombrando(false)
    if (error) { toast('Error al renombrar: ' + error.message, 'error'); return }
    toast('Nombre del despacho actualizado')
    refetch()
  }

  // Cargar miembros e invitaciones activas
  const cargar = useCallback(async () => {
    if (!org) return
    setLoading(true)
    const [{ data: mbs }, { data: invs }, { data: profs }] = await Promise.all([
      supabase
        .from('despacho_miembros')
        .select('id, user_id, rol, activo, creado_en')
        .eq('despacho_id', org.id)
        .order('creado_en', { ascending: true }),
      supabase
        .from('invitaciones')
        .select('id, email, rol, token, usada, expira_en, creado_en')
        .eq('despacho_id', org.id)
        .eq('usada', false)
        .gt('expira_en', new Date().toISOString())
        .order('creado_en', { ascending: false }),
      supabase
        .from('user_profiles')
        .select('id, email, nombre')
    ])

    const profMap = Object.fromEntries((profs || []).map(p => [p.id, p]))

    const lista = (mbs || []).map(m => {
      const profile = profMap[m.user_id]
      return {
        ...m,
        esYo: m.user_id === session?.user?.id,
        email: profile?.email || (m.user_id === session?.user?.id ? session.user.email : null),
        nombre: profile?.nombre || null
      }
    })
    setMiembros(lista)
    setInvitaciones(invs || [])
    setLoading(false)
  }, [org, session])

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { cargar() }, [cargar])

  // ── Crear invitación ────────────────────────────────────────
  async function handleInvitar(e) {
    e.preventDefault()
    setSaving(true)
    const emailAInvitar = invEmail.trim()
    const token = generarToken()
    const { error } = await supabase.from('invitaciones').insert({
      despacho_id: org.id,
      email:       emailAInvitar || null,
      rol:         invRol,
      token,
      creado_por:  session.user.id,
    })
    
    if (error) {
      setSaving(false)
      toast('Error al crear invitación: ' + error.message, 'error')
      return
    }

    // Si tiene email, enviar correo electrónico de invitación por Resend (Edge Function)
    if (emailAInvitar) {
      try {
        const { error: fnError } = await supabase.functions.invoke('enviar-invitacion', {
          body: {
            email: emailAInvitar,
            rol: invRol,
            despachoNombre: org.nombre,
            invitadoPorEmail: session.user.email,
            token,
            origin: window.location.origin
          }
        })
        if (fnError) {
          console.error('Error enviando email:', fnError)
          toast('Código de invitación creado, pero no se pudo enviar el correo.', 'warning')
        } else {
          toast('Correo de invitación enviado con éxito.')
        }
      } catch (err) {
        console.error('Error al invocar Edge Function:', err)
        toast('Código creado, pero falló el envío de correo.', 'warning')
      }
    }

    setSaving(false)
    setTokenGenerado(token)
    setInvEmail('')
    cargar()
  }

  function copiarToken(token) {
    navigator.clipboard.writeText(token).then(() => {
      setCopiado(true)
      setTimeout(() => setCopiado(false), 2000)
    })
  }

  function abrirInvitar() {
    setTokenGenerado(null)
    setInvEmail('')
    setInvRol('abogado')
    setModalInvitar(true)
  }

  // ── Cambiar rol ─────────────────────────────────────────────
  async function cambiarRol(miembroId, nuevoRol) {
    const { error } = await supabase
      .from('despacho_miembros')
      .update({ rol: nuevoRol })
      .eq('id', miembroId)
    if (error) { toast('Error al cambiar rol', 'error'); return }
    toast('Rol actualizado')
    cargar()
  }

  // ── Desactivar miembro ──────────────────────────────────────
  async function desactivarMiembro(m) {
    if (m.esYo) { toast('No puedes desactivarte a ti mismo', 'error'); return }
    if (!confirm(`¿Remover a este usuario del despacho?`)) return
    const { error } = await supabase
      .from('despacho_miembros')
      .update({ activo: false })
      .eq('id', m.id)
    if (error) { toast('Error al remover miembro', 'error'); return }
    toast('Miembro removido')
    cargar()
  }

  // ── Revocar invitación ──────────────────────────────────────
  async function revocarInvitacion(id) {
    await supabase.from('invitaciones').update({ usada: true }).eq('id', id)
    toast('Invitación revocada')
    cargar()
  }

  const miembrosActivos = miembros.filter(m => m.activo)

  return (
    <div>
      <PageHeader
        title="Usuarios"
        subtitle={`${miembrosActivos.length} miembro${miembrosActivos.length !== 1 ? 's' : ''} en ${org?.nombre || 'el despacho'}`}
        actions={
          isAdmin && (
            <button onClick={abrirInvitar} style={btnPri}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 5v14"/><path d="M5 12h14"/>
              </svg>
              Invitar usuario
            </button>
          )
        }
      />

      {/* ── Nombre del despacho ── */}
      {isAdmin && (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '16px 20px', marginBottom: 24 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 12 }}>Nombre del despacho</div>
          <form onSubmit={handleRenombrar} style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <input
              style={{ ...inputStyle, maxWidth: 320 }}
              value={nombreDespacho}
              onChange={e => setNombreDespacho(e.target.value)}
              placeholder="Nombre del despacho"
            />
            <button
              type="submit"
              disabled={renombrando || !nombreDespacho.trim() || nombreDespacho.trim() === org?.nombre}
              style={{ ...btnSec, opacity: (renombrando || nombreDespacho.trim() === org?.nombre) ? 0.5 : 1 }}
            >
              {renombrando ? 'Guardando...' : 'Guardar'}
            </button>
          </form>
        </div>
      )}

      {/* ── Tabla de miembros ── */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', marginBottom: 24 }}>
        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>Miembros del despacho</div>
        </div>
        <table className="lx-table" style={{ border: 'none' }}>
          <thead>
            <tr>
              <th>Usuario</th>
              <th>Rol</th>
              <th>Estado</th>
              <th>Miembro desde</th>
              {isAdmin && <th style={{ width: 80 }}></th>}
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={5} style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>Cargando...</td></tr>
            )}
            {!loading && miembrosActivos.length === 0 && (
              <tr><td colSpan={5} style={{ padding: 32 }}>
                <EmptyState title="Sin miembros" subtitle="Invita a tu equipo para empezar."/>
              </td></tr>
            )}
            {!loading && miembrosActivos.map(m => (
              <tr key={m.id}>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{
                      width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
                      background: m.esYo
                        ? 'linear-gradient(135deg, var(--primary), var(--primary-dark))'
                        : 'linear-gradient(135deg, var(--surface-3), var(--border))',
                      color: m.esYo ? '#fff' : 'var(--text-muted)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 11, fontWeight: 700,
                    }}>
                      {m.email ? iniciales(m.email) : '?'}
                    </div>
                    <div>
                      <div style={{ fontSize: 13, color: 'var(--text)', fontWeight: 600 }}>
                        {m.nombre || (m.email ? m.email.split('@')[0] : `Usuario ${m.user_id.slice(0, 6)}`)}
                        {m.esYo && <span style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 400, marginLeft: 6 }}>(tú)</span>}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                        {m.email || m.user_id.slice(0, 16) + '...'}
                      </div>
                    </div>
                  </div>
                </td>
                <td>
                  {isAdmin && !m.esYo ? (
                    <select
                      value={m.rol}
                      onChange={e => cambiarRol(m.id, e.target.value)}
                      style={{ ...selectStyle, minWidth: 130 }}
                    >
                      {ROLES.map(r => (
                        <option key={r} value={r}>{ROL_LABEL[r]}</option>
                      ))}
                    </select>
                  ) : (
                    <StatusBadge tone={ROL_TONE[m.rol]} dot={false}>{ROL_LABEL[m.rol]}</StatusBadge>
                  )}
                </td>
                <td><StatusBadge tone="success">Activo</StatusBadge></td>
                <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  {new Date(m.creado_en).toLocaleDateString('es-MX')}
                </td>
                {isAdmin && (
                  <td>
                    {!m.esYo && (
                      <button
                        onClick={() => desactivarMiembro(m)}
                        style={{ ...iconBtn, color: 'var(--danger)' }}
                        title="Remover del despacho"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                          <circle cx="9" cy="7" r="4"/>
                          <path d="M23 11l-4 4m0-4l4 4"/>
                        </svg>
                      </button>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── Invitaciones pendientes ── */}
      {isAdmin && invitaciones.length > 0 && (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)' }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>Invitaciones pendientes</div>
            <span style={{ fontSize: 11, background: 'var(--warning-bg)', color: 'var(--warning-text)', borderRadius: 999, padding: '2px 8px', fontWeight: 700 }}>
              {invitaciones.length}
            </span>
          </div>
          <table className="lx-table" style={{ border: 'none' }}>
            <thead>
              <tr>
                <th>Para</th>
                <th>Rol</th>
                <th>Token</th>
                <th>Expira</th>
                <th style={{ width: 80 }}></th>
              </tr>
            </thead>
            <tbody>
              {invitaciones.map(inv => (
                <tr key={inv.id}>
                  <td style={{ fontSize: 13, color: 'var(--text)' }}>
                    {inv.email || <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>Sin email</span>}
                  </td>
                  <td><StatusBadge tone={ROL_TONE[inv.rol]} dot={false}>{ROL_LABEL[inv.rol]}</StatusBadge></td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <code style={{
                        background: 'var(--surface-3)', border: '1px solid var(--border)',
                        borderRadius: 'var(--radius-sm)', padding: '3px 8px',
                        fontSize: 13, fontWeight: 700, letterSpacing: '2px', color: 'var(--primary)',
                      }}>{inv.token}</code>
                      <button onClick={() => copiarToken(inv.token)} style={iconBtn} title="Copiar">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                        </svg>
                      </button>
                    </div>
                  </td>
                  <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    {new Date(inv.expira_en).toLocaleDateString('es-MX')}
                  </td>
                  <td>
                    <button
                      onClick={() => revocarInvitacion(inv.id)}
                      style={{ ...iconBtn, color: 'var(--danger)' }}
                      title="Revocar invitación"
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M18 6L6 18"/><path d="M6 6l12 12"/>
                      </svg>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Nota si no es admin ── */}
      {!isAdmin && (
        <div style={{ marginTop: 16, padding: '12px 16px', background: 'var(--surface-3)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', fontSize: 12, color: 'var(--text-muted)' }}>
          Solo el administrador del despacho puede invitar o gestionar usuarios.
        </div>
      )}

      {/* ── Modal invitar ── */}
      <Modal
        open={modalInvitar}
        onClose={() => { setModalInvitar(false); setTokenGenerado(null) }}
        title="Invitar al despacho"
        subtitle="Genera un código de invitación para compartir"
        width={460}
        footer={
          tokenGenerado ? (
            <button onClick={() => { setModalInvitar(false); setTokenGenerado(null) }} style={btnSec}>
              Cerrar
            </button>
          ) : (
            <>
              <button onClick={() => setModalInvitar(false)} style={btnSec}>Cancelar</button>
              <button onClick={handleInvitar} disabled={saving} style={btnPri}>
                {saving ? 'Generando...' : 'Generar código'}
              </button>
            </>
          )
        }
      >
        {tokenGenerado ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, alignItems: 'center', padding: '8px 0' }}>
            <div style={{ fontSize: 32, fontWeight: 900, letterSpacing: '6px', color: 'var(--primary)', fontFamily: 'monospace' }}>
              {tokenGenerado}
            </div>
            <button
              onClick={() => copiarToken(tokenGenerado)}
              style={{ ...btnPri, padding: '10px 20px' }}
            >
              {copiado ? '✓ Copiado' : 'Copiar código'}
            </button>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', margin: 0 }}>
              Comparte este código con el usuario. Expira en 7 días.<br/>
              El usuario lo ingresará en la pantalla de inicio al registrarse.
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={labelStyle}>Correo del invitado (opcional)</label>
              <input
                style={inputStyle}
                type="email"
                value={invEmail}
                onChange={e => setInvEmail(e.target.value)}
                placeholder="abogado@despacho.mx"
              />
              <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '4px 0 0' }}>
                Solo para tu referencia. El usuario puede unirse con cualquier cuenta.
              </p>
            </div>
            <div>
              <label style={labelStyle}>Rol en el despacho</label>
              <select style={inputStyle} value={invRol} onChange={e => setInvRol(e.target.value)}>
                {ROLES.map(r => <option key={r} value={r}>{ROL_LABEL[r]}</option>)}
              </select>
              <RolDescripcion rol={invRol}/>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}

// ── Componente auxiliar: descripción del rol ────────────────
function RolDescripcion({ rol }) {
  const desc = {
    admin:     'Acceso total: puede gestionar expedientes, usuarios e invitaciones.',
    abogado:   'Puede crear, editar y eliminar expedientes y tareas.',
    asistente: 'Acceso de solo lectura. Puede agregar actuaciones.',
  }
  return (
    <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '4px 0 0' }}>
      {desc[rol]}
    </p>
  )
}

// ── Estilos ─────────────────────────────────────────────────
const inputStyle = {
  width: '100%', background: 'var(--surface)', border: '1px solid var(--border)',
  color: 'var(--text)', borderRadius: 'var(--radius)',
  padding: '9px 12px', fontSize: 13, boxSizing: 'border-box',
}
const selectStyle = {
  background: 'var(--surface)', border: '1px solid var(--border)',
  color: 'var(--text)', borderRadius: 'var(--radius)',
  padding: '6px 10px', fontSize: 12, cursor: 'pointer',
}
const labelStyle = {
  display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)',
  textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 6,
}
const btnPri = {
  background: 'var(--primary)', color: '#fff', border: 'none',
  borderRadius: 'var(--radius)', padding: '9px 16px', fontSize: 13, fontWeight: 600,
  cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6,
}
const btnSec = {
  background: 'var(--surface)', color: 'var(--text)',
  border: '1px solid var(--border)', borderRadius: 'var(--radius)',
  padding: '8px 14px', fontSize: 13, fontWeight: 500, cursor: 'pointer',
}
const iconBtn = {
  background: 'var(--surface-3)', border: '1px solid var(--border)',
  color: 'var(--text-secondary)', borderRadius: 'var(--radius-sm)',
  padding: '6px 8px', cursor: 'pointer',
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
}
