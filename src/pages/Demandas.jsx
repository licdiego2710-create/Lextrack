import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../supabaseClient'
import { useToast } from '../context/ToastContext'
import { fmtFecha, TIPOS } from '../utils/helpers'
import StatCard from '../components/ui/StatCard'
import StatusBadge from '../components/ui/StatusBadge'
import Modal from '../components/ui/Modal'
import PageHeader from '../components/ui/PageHeader'
import EmptyState from '../components/ui/EmptyState'

const ESTADOS = ['Nueva', 'Prevención', 'Cumplimiento', 'Admitida', 'Desechada']
const ESTADO_TONE = {
  Nueva: 'info',
  Prevención: 'warning',
  Cumplimiento: 'primary',
  Admitida: 'success',
  Desechada: 'danger',
}
const ESTADO_COLOR = {
  Nueva: 'var(--primary)',
  Prevención: 'var(--warning)',
  Cumplimiento: 'var(--info)',
  Admitida: 'var(--success)',
  Desechada: 'var(--danger)',
}

const FORM_VACIO = { promovente: '', demandado: '', tipo_juicio: TIPOS[0], observaciones: '' }

export default function Demandas({ session }) {
  const [demandas, setDemandas] = useState([])
  const [loading, setLoading] = useState(true)
  const [filtros, setFiltros] = useState({ estado: '', tipo: '' })
  const [modal, setModal] = useState(false)
  const [editando, setEditando] = useState(null)
  const [form, setForm] = useState(FORM_VACIO)
  const [saving, setSaving] = useState(false)
  const toast = useToast()

  const cargar = useCallback(async () => {
    if (!session) return
    setLoading(true)
    const { data } = await supabase
      .from('demandas')
      .select('*')
      .order('creado_en', { ascending: false })
    setDemandas(data || [])
    setLoading(false)
  }, [session])

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { cargar() }, [cargar])

  const counts = ESTADOS.reduce((acc, e) => {
    acc[e] = demandas.filter(d => d.estado === e).length
    return acc
  }, {})

  const lista = demandas.filter(d => {
    if (filtros.estado && d.estado !== filtros.estado) return false
    if (filtros.tipo && d.tipo_juicio !== filtros.tipo) return false
    return true
  })

  const TIPOS_USADOS = [...new Set(demandas.map(d => d.tipo_juicio))].filter(Boolean)

  function abrirNueva() {
    setEditando(null)
    setForm(FORM_VACIO)
    setModal(true)
  }

  function abrirEditar(d) {
    setEditando(d.id)
    setForm({
      promovente: d.promovente || '',
      demandado: d.demandado || '',
      tipo_juicio: d.tipo_juicio || TIPOS[0],
      observaciones: d.observaciones || '',
    })
    setModal(true)
  }

  async function guardar() {
    if (!form.promovente.trim() || !form.demandado.trim()) {
      alert('Captura promovente y demandado.'); return
    }
    setSaving(true)
    if (editando) {
      await supabase.from('demandas').update({
        ...form,
        actualizado_en: new Date().toISOString(),
      }).eq('id', editando)
    } else {
      await supabase.from('demandas').insert({
        ...form,
        user_id: session.user.id,
        fecha_recepcion: new Date().toISOString().slice(0, 10),
        estado: 'Nueva',
      })
    }
    setSaving(false)
    toast(editando ? 'Demanda actualizada' : 'Demanda registrada')
    setModal(false)
    cargar()
  }

  async function cambiarEstado(id, nuevo) {
    const patch = { estado: nuevo, actualizado_en: new Date().toISOString() }
    if (nuevo === 'Prevención') patch.fecha_prevencion = new Date().toISOString().slice(0, 10)
    if (nuevo === 'Cumplimiento') patch.fecha_cumplimiento = new Date().toISOString().slice(0, 10)
    setDemandas(arr => arr.map(d => d.id === id ? { ...d, ...patch } : d))
    await supabase.from('demandas').update(patch).eq('id', id)
  }

  async function eliminar(id) {
    if (!window.confirm('¿Eliminar esta demanda?')) return
    await supabase.from('demandas').delete().eq('id', id)
    toast('Demanda eliminada', 'warning')
    setDemandas(arr => arr.filter(d => d.id !== id))
  }

  return (
    <div>
      <PageHeader
        title="Demandas"
        subtitle="Flujo de captura: nueva, prevención, cumplimiento, admisión o desechamiento"
        actions={
          <button onClick={abrirNueva} style={btnPri}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 5v14"/><path d="M5 12h14"/>
            </svg>
            Nueva demanda
          </button>
        }
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14, marginBottom: 20 }}>
        {ESTADOS.map(e => (
          <StatCard key={e} title={e} value={counts[e] || 0} color={ESTADO_COLOR[e]}/>
        ))}
      </div>

      <div style={{
        display: 'flex', gap: 8, flexWrap: 'wrap',
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)', padding: 14, marginBottom: 14,
      }}>
        <select value={filtros.estado} onChange={e => setFiltros(f => ({ ...f, estado: e.target.value }))} style={inputStyle}>
          <option value="">Todos los estados</option>
          {ESTADOS.map(o => <option key={o}>{o}</option>)}
        </select>
        <select value={filtros.tipo} onChange={e => setFiltros(f => ({ ...f, tipo: e.target.value }))} style={{ ...inputStyle, flex: '1 1 auto' }}>
          <option value="">Todos los tipos</option>
          {TIPOS_USADOS.map(o => <option key={o}>{o}</option>)}
        </select>
      </div>

      {loading && (
        <div style={{ textAlign: 'center', padding: 48, color: 'var(--text-muted)', fontSize: 13 }}>Cargando...</div>
      )}

      {!loading && lista.length === 0 && (
        <EmptyState
          icon={
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M14 4l6 6"/><path d="M9 9l8-8 4 4-8 8"/><path d="M11 11L4 18"/><path d="M3 21h7"/>
            </svg>
          }
          title="Sin demandas"
          description={demandas.length === 0 ? 'Registra la primera demanda para empezar.' : 'No hay resultados con esos filtros.'}
          action={demandas.length === 0 ? <button onClick={abrirNueva} style={btnPri}>Nueva demanda</button> : null}
        />
      )}

      {!loading && lista.length > 0 && (
        <div style={{ overflowX: 'auto', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)' }}>
          <table className="lx-table" style={{ border: 'none' }}>
            <thead>
              <tr>
                <th>Recepción</th>
                <th>Promovente</th>
                <th>Demandado</th>
                <th>Tipo de juicio</th>
                <th>Fechas</th>
                <th>Estado</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {lista.map(d => (
                <tr key={d.id}>
                  <td><div style={{ fontSize: 13, fontWeight: 600 }}>{fmtFecha(d.fecha_recepcion)}</div></td>
                  <td>
                    <div style={{ fontWeight: 500, cursor: 'pointer', color: 'var(--text)' }} onClick={() => abrirEditar(d)}>
                      {d.promovente}
                    </div>
                  </td>
                  <td>{d.demandado}</td>
                  <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{d.tipo_juicio}</td>
                  <td style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    {d.fecha_prevencion && <div>Prev: {fmtFecha(d.fecha_prevencion)}</div>}
                    {d.fecha_cumplimiento && <div>Cump: {fmtFecha(d.fecha_cumplimiento)}</div>}
                    {!d.fecha_prevencion && !d.fecha_cumplimiento && '—'}
                  </td>
                  <td>
                    <select
                      value={d.estado}
                      onChange={e => cambiarEstado(d.id, e.target.value)}
                      style={{
                        background: 'transparent', border: '1px solid var(--border)',
                        color: ESTADO_COLOR[d.estado], borderRadius: 999,
                        padding: '3px 12px', fontSize: 11, fontWeight: 700, cursor: 'pointer',
                      }}
                    >
                      {ESTADOS.map(o => <option key={o} value={o} style={{ color: 'var(--text)' }}>{o}</option>)}
                    </select>
                  </td>
                  <td>
                    <button onClick={() => eliminar(d.id)} style={{
                      background: 'none', border: 'none', cursor: 'pointer',
                      color: 'var(--text-muted)', padding: 4,
                    }} title="Eliminar">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
                      </svg>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        open={modal}
        onClose={() => setModal(false)}
        title={editando ? 'Editar demanda' : 'Registrar nueva demanda'}
        subtitle="Captura inicial del juicio"
        width={620}
        footer={
          <>
            <button onClick={() => setModal(false)} style={btnSec}>Cancelar</button>
            {editando && (
              <button onClick={() => { eliminar(editando); setModal(false) }} style={{ ...btnSec, color: 'var(--danger)', borderColor: 'var(--danger)' }}>
                Eliminar
              </button>
            )}
            <button onClick={guardar} disabled={saving} style={{ ...btnPri, opacity: saving ? .7 : 1 }}>
              {saving ? 'Guardando...' : editando ? 'Guardar cambios' : 'Registrar demanda'}
            </button>
          </>
        }
      >
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <Field label="Promovente *" full>
            <input style={inputStyle} value={form.promovente} onChange={e => setForm(f => ({ ...f, promovente: e.target.value }))} autoFocus/>
          </Field>
          <Field label="Demandado *" full>
            <input style={inputStyle} value={form.demandado} onChange={e => setForm(f => ({ ...f, demandado: e.target.value }))}/>
          </Field>
          <Field label="Tipo de juicio" full>
            <select style={inputStyle} value={form.tipo_juicio} onChange={e => setForm(f => ({ ...f, tipo_juicio: e.target.value }))}>
              {TIPOS.map(o => <option key={o}>{o}</option>)}
            </select>
          </Field>
          <Field label="Observaciones" full>
            <textarea
              style={{ ...inputStyle, minHeight: 80, resize: 'vertical' }}
              value={form.observaciones}
              onChange={e => setForm(f => ({ ...f, observaciones: e.target.value }))}
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
