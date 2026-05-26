import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../supabaseClient'
import { useOrg } from '../context/OrgContext'
import { useToast } from '../context/ToastContext'
import { diasHasta, fmtFecha, urgencyColor, iniciales, exportarCSV } from '../utils/helpers'
import StatusBadge from '../components/ui/StatusBadge'
import Modal from '../components/ui/Modal'
import PageHeader from '../components/ui/PageHeader'
import EmptyState from '../components/ui/EmptyState'

const ESTADOS = ['Pendiente', 'En proceso', 'Completada', 'Vencida']
const PRIORIDADES = ['Normal', 'Alta', 'Urgente']
const ESTADO_COLOR = {
  Pendiente: 'var(--warning)',
  'En proceso': 'var(--primary)',
  Completada: 'var(--success)',
  Vencida: 'var(--danger)',
}

const FORM_VACIO = { titulo: '', descripcion: '', expediente: '', responsable: '', fecha_limite: '', prioridad: 'Normal', estado: 'Pendiente', asignado_a: '' }

export default function Tareas({ session }) {
  const { org } = useOrg()
  const [tareas, setTareas] = useState([])
  const [miembros, setMiembros] = useState([]) // miembros del despacho para asignar
  const [loading, setLoading] = useState(true)
  const [vista, setVista] = useState('lista')
  const [modal, setModal] = useState(false)
  const [editando, setEditando] = useState(null)
  const [form, setForm] = useState(FORM_VACIO)
  const [saving, setSaving] = useState(false)
  const toast = useToast()
  const [filtroEstado, setFiltroEstado] = useState('Todos')
  const [filtroAsignado, setFiltroAsignado] = useState('Todos')

  const cargar = useCallback(async () => {
    if (!session) return
    setLoading(true)
    const { data } = await supabase
      .from('tareas')
      .select('*')
      .order('fecha_limite', { ascending: true, nullsFirst: false })
    setTareas(data || [])
    setLoading(false)
  }, [session])

  // Cargar miembros del despacho para asignar tareas
  useEffect(() => {
    if (!org?.id) return
    ;(async () => {
      const { data } = await supabase
        .from('despacho_miembros')
        .select('user_id, rol, user_profiles(nombre, email)')
        .eq('despacho_id', org.id)
        .eq('activo', true)
        .in('rol', ['admin', 'abogado', 'asistente'])
      setMiembros(data || [])
    })()
  }, [org?.id])

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { cargar() }, [cargar])

  // Auto-marcar vencidas al cargar
  useEffect(() => {
    if (!tareas.length) return
    const hoy = new Date().toISOString().slice(0, 10)
    const paraVencer = tareas.filter(t => t.estado === 'Pendiente' && t.fecha_limite && t.fecha_limite < hoy)
    if (!paraVencer.length) return
    ;(async () => {
      await supabase.from('tareas')
        .update({ estado: 'Vencida', actualizado_en: new Date().toISOString() })
        .in('id', paraVencer.map(t => t.id))
      setTareas(arr => arr.map(t => paraVencer.find(p => p.id === t.id) ? { ...t, estado: 'Vencida' } : t))
    })()
  }, [tareas.length]) // eslint-disable-line

  function abrirNueva() {
    setEditando(null)
    setForm(FORM_VACIO)
    setModal(true)
  }

  function abrirEditar(t) {
    setEditando(t.id)
    setForm({
      titulo: t.titulo || '',
      descripcion: t.descripcion || '',
      expediente: t.expediente || '',
      responsable: t.responsable || '',
      fecha_limite: t.fecha_limite || '',
      prioridad: t.prioridad || 'Normal',
      estado: t.estado || 'Pendiente',
      asignado_a: t.asignado_a || '',
    })
    setModal(true)
  }

  async function guardar() {
    if (!form.titulo.trim()) { alert('Captura un título.'); return }
    setSaving(true)
    if (editando) {
      await supabase.from('tareas').update({ ...form, actualizado_en: new Date().toISOString() }).eq('id', editando)
    } else {
      await supabase.from('tareas').insert({ ...form, user_id: session.user.id })
    }
    setSaving(false)
    toast(editando ? 'Tarea actualizada' : 'Tarea creada')
    setModal(false)
    cargar()
  }

  async function cambiarEstado(id, estado) {
    setTareas(arr => arr.map(t => t.id === id ? { ...t, estado } : t))
    await supabase.from('tareas').update({ estado, actualizado_en: new Date().toISOString() }).eq('id', id)
  }

  async function eliminar(id) {
    if (!window.confirm('¿Eliminar esta tarea?')) return
    await supabase.from('tareas').delete().eq('id', id)
    toast('Tarea eliminada', 'warning')
    setTareas(arr => arr.filter(t => t.id !== id))
  }

  const lista = (() => {
    let arr = filtroEstado === 'Todos' ? tareas : tareas.filter(t => t.estado === filtroEstado)
    if (filtroAsignado !== 'Todos') arr = arr.filter(t => t.asignado_a === filtroAsignado)
    return arr
  })()

  // Helper para obtener nombre de miembro por user_id
  function nombreMiembro(uid) {
    if (!uid) return null
    const m = miembros.find(m => m.user_id === uid)
    if (!m) return null
    return m.user_profiles?.nombre || m.user_profiles?.email?.split('@')[0] || uid.slice(0, 8)
  }

  function exportarExcel() {
    const dataExportar = lista.map(t => ({
      ...t,
      asignado_nombre: nombreMiembro(t.asignado_a) || 'Sin asignar'
    }))
    exportarCSV(
      dataExportar,
      ['Título', 'Descripción', 'Expediente', 'Responsable Externo', 'Fecha Límite', 'Prioridad', 'Estado', 'Asignado Interno'],
      ['titulo', 'descripcion', 'expediente', 'responsable', 'fecha_limite', 'prioridad', 'estado', 'asignado_nombre'],
      `tareas_${new Date().toISOString().slice(0, 10)}`
    )
  }

  return (
    <div>
      <PageHeader
        title="Tareas"
        subtitle="Tareas vinculadas a expedientes, con responsable y plazo"
        actions={
          <>
            <select
              value={filtroEstado}
              onChange={e => setFiltroEstado(e.target.value)}
              style={{ ...inputStyle, width: 'auto', padding: '7px 12px', fontSize: 12 }}
            >
              <option value="Todos">Todos los estados</option>
              {ESTADOS.map(o => <option key={o}>{o}</option>)}
            </select>
            {miembros.length > 0 && (
              <select
                value={filtroAsignado}
                onChange={e => setFiltroAsignado(e.target.value)}
                style={{ ...inputStyle, width: 'auto', padding: '7px 12px', fontSize: 12 }}
              >
                <option value="Todos">Todos los miembros</option>
                {miembros.map(m => {
                  const nombre = m.user_profiles?.nombre || m.user_profiles?.email?.split('@')[0] || m.user_id.slice(0, 8)
                  return <option key={m.user_id} value={m.user_id}>{nombre}</option>
                })}
              </select>
            )}
            <div style={{
              display: 'flex', gap: 2,
              background: 'var(--surface-3)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius)',
              padding: 3,
            }}>
              {[['lista', 'Lista'], ['kanban', 'Kanban']].map(([k, l]) => (
                <button key={k} onClick={() => setVista(k)} style={{
                  border: 'none', cursor: 'pointer',
                  background: vista === k ? 'var(--surface)' : 'transparent',
                  color: vista === k ? 'var(--primary)' : 'var(--text-secondary)',
                  fontWeight: vista === k ? 700 : 500,
                  padding: '6px 14px', borderRadius: 'calc(var(--radius) - 2px)',
                  fontSize: 12,
                }}>{l}</button>
              ))}
            </div>
            <button onClick={exportarExcel} style={btnSec}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M7 10l5 5 5-5"/><path d="M12 15V3"/>
              </svg>
              Exportar CSV
            </button>
            <button onClick={abrirNueva} style={btnPri}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 5v14"/><path d="M5 12h14"/>
              </svg>
              Nueva tarea
            </button>
          </>
        }
      />

      {loading && (
        <div style={{ textAlign: 'center', padding: 48, color: 'var(--text-muted)', fontSize: 13 }}>
          Cargando tareas...
        </div>
      )}

      {!loading && lista.length === 0 && (
        <EmptyState
          icon={
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/>
            </svg>
          }
          title="Sin tareas"
          description={filtroEstado === 'Todos' ? 'Crea tu primera tarea para empezar.' : `No hay tareas con estado "${filtroEstado}".`}
          action={filtroEstado === 'Todos' ? <button onClick={abrirNueva} style={btnPri}>Nueva tarea</button> : null}
        />
      )}

      {!loading && lista.length > 0 && vista === 'lista' && (
        <div style={{ overflowX: 'auto', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)' }}>
          <table className="lx-table" style={{ border: 'none' }}>
            <thead>
              <tr>
                <th>Tarea</th>
                <th>Expediente</th>
                <th>Asignado a</th>
                <th>Vencimiento</th>
                <th>Prioridad</th>
                <th>Estado</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {lista.map(t => {
                const d = diasHasta(t.fecha_limite)
                const u = urgencyColor(d)
                return (
                  <tr key={t.id}>
                    <td>
                      <div style={{ fontWeight: 600, color: 'var(--text)', cursor: 'pointer' }} onClick={() => abrirEditar(t)}>{t.titulo}</div>
                      {t.descripcion && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{t.descripcion}</div>}
                    </td>
                    <td style={{ fontSize: 12, color: 'var(--primary)', fontWeight: 600 }}>{t.expediente || '—'}</td>
                    <td>
                      {t.asignado_a ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{
                            width: 26, height: 26, borderRadius: '50%',
                            background: 'linear-gradient(135deg, var(--primary), var(--primary-dark))',
                            color: '#fff', display: 'flex', alignItems: 'center',
                            justifyContent: 'center', fontSize: 9, fontWeight: 700, flexShrink: 0,
                          }}>
                            {iniciales(nombreMiembro(t.asignado_a) || '?')}
                          </div>
                          <span style={{ fontSize: 12, color: 'var(--text)' }}>{nombreMiembro(t.asignado_a)}</span>
                        </div>
                      ) : (
                        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Sin asignar</span>
                      )}
                    </td>
                    <td>
                      <div style={{ fontSize: 13 }}>{fmtFecha(t.fecha_limite)}</div>
                      {t.fecha_limite && <div style={{ display: 'inline-block', marginTop: 2, background: u.bg, color: u.color, padding: '2px 8px', borderRadius: 999, fontSize: 10, fontWeight: 700 }}>{u.label}</div>}
                    </td>
                    <td>
                      <StatusBadge tone={t.prioridad === 'Urgente' ? 'danger' : t.prioridad === 'Alta' ? 'warning' : 'muted'}>
                        {t.prioridad}
                      </StatusBadge>
                    </td>
                    <td>
                      <select value={t.estado} onChange={e => cambiarEstado(t.id, e.target.value)}
                        style={{
                          background: 'transparent', border: '1px solid var(--border)',
                          color: ESTADO_COLOR[t.estado], borderRadius: 999, padding: '3px 12px',
                          fontSize: 11, fontWeight: 700, cursor: 'pointer',
                        }}>
                        {ESTADOS.map(o => <option key={o} value={o} style={{ color: 'var(--text)' }}>{o}</option>)}
                      </select>
                    </td>
                    <td>
                      <button onClick={() => eliminar(t.id)} style={{
                        background: 'none', border: 'none', cursor: 'pointer',
                        color: 'var(--text-muted)', padding: 4, borderRadius: 'var(--radius-sm)',
                      }} title="Eliminar">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
                        </svg>
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {!loading && lista.length > 0 && vista === 'kanban' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 14 }}>
          {ESTADOS.map(estado => {
            const items = lista.filter(t => t.estado === estado)
            return (
              <div key={estado} style={{
                background: 'var(--surface-3)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-lg)',
                padding: 12,
                minHeight: 320,
              }}>
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  marginBottom: 12, padding: '4px 4px 10px', borderBottom: '1px solid var(--border)',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: ESTADO_COLOR[estado] }}/>
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)', textTransform: 'uppercase', letterSpacing: '.5px' }}>{estado}</div>
                  </div>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 700 }}>{items.length}</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {items.map(t => {
                    const d = diasHasta(t.fecha_limite)
                    const u = urgencyColor(d)
                    return (
                      <div key={t.id} onClick={() => abrirEditar(t)} style={{
                        background: 'var(--surface)',
                        border: '1px solid var(--border)',
                        borderRadius: 'var(--radius)',
                        padding: 12,
                        boxShadow: 'var(--shadow-sm)',
                        cursor: 'pointer',
                      }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>{t.titulo}</div>
                        {t.expediente && <div style={{ fontSize: 11, color: 'var(--primary)', fontWeight: 600, marginBottom: 6 }}>{t.expediente}</div>}
                        {t.responsable && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8 }}>{t.responsable}</div>}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ background: u.bg, color: u.color, padding: '2px 8px', borderRadius: 999, fontSize: 10, fontWeight: 700 }}>
                            {t.fecha_limite ? u.label : 'Sin fecha'}
                          </span>
                          <select
                            value={t.estado}
                            onChange={e => { e.stopPropagation(); cambiarEstado(t.id, e.target.value) }}
                            onClick={e => e.stopPropagation()}
                            style={{ background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-muted)', borderRadius: 'var(--radius-sm)', padding: '2px 6px', fontSize: 10, cursor: 'pointer' }}
                          >
                            {ESTADOS.map(o => <option key={o} value={o}>→ {o}</option>)}
                          </select>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}

      <Modal
        open={modal}
        onClose={() => setModal(false)}
        title={editando ? 'Editar tarea' : 'Nueva tarea'}
        width={580}
        footer={
          <>
            <button onClick={() => setModal(false)} style={btnSec}>Cancelar</button>
            {editando && (
              <button onClick={() => { eliminar(editando); setModal(false) }} style={{ ...btnSec, color: 'var(--danger)', borderColor: 'var(--danger)' }}>
                Eliminar
              </button>
            )}
            <button onClick={guardar} disabled={saving} style={{ ...btnPri, opacity: saving ? .7 : 1 }}>
              {saving ? 'Guardando...' : editando ? 'Guardar cambios' : 'Crear tarea'}
            </button>
          </>
        }
      >
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <Field label="Título *" full>
            <input style={inputStyle} value={form.titulo} onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))} placeholder="Redactar escrito de..." autoFocus/>
          </Field>
          <Field label="Expediente">
            <input style={inputStyle} value={form.expediente} onChange={e => setForm(f => ({ ...f, expediente: e.target.value }))} placeholder="306/2024"/>
          </Field>
          <Field label="Responsable">
            <input style={inputStyle} value={form.responsable} onChange={e => setForm(f => ({ ...f, responsable: e.target.value }))} placeholder="Nombre del responsable"/>
          </Field>
          <Field label="Fecha límite">
            <input type="date" style={inputStyle} value={form.fecha_limite} onChange={e => setForm(f => ({ ...f, fecha_limite: e.target.value }))}/>
          </Field>
          <Field label="Prioridad">
            <select style={inputStyle} value={form.prioridad} onChange={e => setForm(f => ({ ...f, prioridad: e.target.value }))}>
              {PRIORIDADES.map(o => <option key={o}>{o}</option>)}
            </select>
          </Field>
          {editando && (
            <Field label="Estado">
              <select style={inputStyle} value={form.estado} onChange={e => setForm(f => ({ ...f, estado: e.target.value }))}>
                {ESTADOS.map(o => <option key={o}>{o}</option>)}
              </select>
            </Field>
          )}
          <Field label="Asignado a">
            <select style={inputStyle} value={form.asignado_a} onChange={e => setForm(f => ({ ...f, asignado_a: e.target.value }))}>
              <option value="">— Sin asignar —</option>
              {miembros.map(m => {
                const nombre = m.user_profiles?.nombre || m.user_profiles?.email?.split('@')[0] || m.user_id.slice(0, 8)
                return <option key={m.user_id} value={m.user_id}>{nombre} ({m.rol})</option>
              })}
            </select>
          </Field>
          <Field label="Descripción" full>
            <textarea
              style={{ ...inputStyle, minHeight: 70, resize: 'vertical' }}
              value={form.descripcion}
              onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))}
              placeholder="Detalles opcionales..."
            />
          </Field>
        </div>
      </Modal>
    </div>
  )
}

const Field = ({ label, children, full }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 4, gridColumn: full ? '1 / -1' : 'auto' }}>
    <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.5px' }}>{label}</div>
    {children}
  </div>
)

const inputStyle = {
  background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)',
  borderRadius: 'var(--radius)', padding: '9px 12px', fontSize: 13, width: '100%',
}
const btnPri = {
  background: 'var(--primary)', color: '#fff', border: 'none',
  borderRadius: 'var(--radius)', padding: '9px 16px', fontSize: 13, fontWeight: 600,
  cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6,
}
const btnSec = {
  background: 'var(--surface)', color: 'var(--text)', border: '1px solid var(--border)',
  borderRadius: 'var(--radius)', padding: '8px 14px', fontSize: 13, fontWeight: 500, cursor: 'pointer',
}
