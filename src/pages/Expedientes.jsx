import { useEffect, useState, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { useToast } from '../context/ToastContext'
import {
  diasHasta, fmtFecha, urgencyColor,
  ETAPAS, TIPOS, MATERIAS, ESTADOS, PRIORIDADES, TIPOS_PROMO, JUZGADOS_JALISCO,
} from '../utils/helpers'
import StatCard from '../components/ui/StatCard'
import StatusBadge from '../components/ui/StatusBadge'
import Modal from '../components/ui/Modal'
import PageHeader from '../components/ui/PageHeader'
import EmptyState from '../components/ui/EmptyState'

const formVacio = () => ({
  num: '', materia: 'Mercantil', tipo: 'Juicio Ordinario Mercantil',
  juzgado: '', actor: '', demandado: '',
  etapa: 'Admisión', estado: 'Activo',
  tipoPromo: '', promoDesc: '',
  termino: '', prioridad: 'Normal', notas: '',
  alertas_boletin: true,
})

export default function Expedientes({ session }) {
  const [searchParams] = useSearchParams()
  const toast = useToast()
  const [expedientes, setExpedientes] = useState([])
  const [loading, setLoading] = useState(true)
  const [buscar, setBuscar] = useState(() => searchParams.get('q') || '')
  const [filtros, setFiltros] = useState({ materia: '', etapa: '', estado: '' })

  const [modal, setModal] = useState(false)
  const [editId, setEditId] = useState(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState(formVacio())

  const [detalleExp, setDetalleExp] = useState(null)
  const [tabDetalle, setTabDetalle] = useState('info')
  const [historial, setHistorial] = useState([])
  const [hForm, setHForm] = useState({ fecha: '', descripcion: '' })
  const [hSaving, setHSaving] = useState(false)
  const [archivos, setArchivos] = useState([])
  const [uploading, setUploading] = useState(false)

  const cargar = useCallback(async () => {
    if (!session) return
    setLoading(true)
    const { data } = await supabase.from('expedientes').select('*').order('termino', { ascending: true, nullsFirst: false })
    const lista = data || []
    try {
      const hoy = new Date().toISOString().slice(0, 10)
      const paraVencer = lista.filter(e => e.estado === 'Activo' && e.termino && e.termino < hoy)
      if (paraVencer.length) {
        await supabase.from('expedientes')
          .update({ estado: 'Vencido', actualizado_en: new Date().toISOString() })
          .in('id', paraVencer.map(e => e.id))
        paraVencer.forEach(e => { e.estado = 'Vencido' })
      }
    } catch { /* ignore */ }
    setExpedientes(lista)
    setLoading(false)
  }, [session])

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { cargar() }, [cargar])

  // Filtro
  const lista = expedientes.filter(e => {
    const q = buscar.toLowerCase()
    if (q && !`${e.num} ${e.actor} ${e.demandado} ${e.juzgado || ''}`.toLowerCase().includes(q)) return false
    if (filtros.materia && e.materia !== filtros.materia) return false
    if (filtros.etapa && e.etapa !== filtros.etapa) return false
    if (filtros.estado && e.estado !== filtros.estado) return false
    return true
  })

  // KPIs
  const total = expedientes.length
  const activos = expedientes.filter(e => e.estado === 'Activo').length
  const urgentes = expedientes.filter(e => { const d = diasHasta(e.termino); return d !== null && d >= 0 && d <= 3 && e.estado === 'Activo' }).length
  const vencidos = expedientes.filter(e => e.estado === 'Vencido').length

  // CRUD
  function abrirNuevo() {
    setForm(formVacio()); setEditId(null); setModal(true)
  }

  function abrirEditar(exp) {
    const actuacion = exp.actuacion || ''
    const sepIdx = actuacion.indexOf(': ')
    const tipoPromo = sepIdx > -1 ? actuacion.slice(0, sepIdx) : ''
    const promoDesc = sepIdx > -1 ? actuacion.slice(sepIdx + 2) : actuacion
    setForm({
      num: exp.num, materia: exp.materia, tipo: exp.tipo,
      juzgado: exp.juzgado || '', actor: exp.actor, demandado: exp.demandado,
      etapa: exp.etapa, estado: exp.estado,
      tipoPromo, promoDesc,
      termino: exp.termino || '', prioridad: exp.prioridad || 'Normal', notas: exp.notas || '',
      alertas_boletin: exp.alertas_boletin !== false,
    })
    setEditId(exp.id); setModal(true)
    setDetalleExp(null)
  }

  const setF = (k, v) => setForm(f => ({ ...f, [k]: v }))

  async function guardar() {
    if (!form.num.trim() || !form.actor.trim() || !form.demandado.trim()) {
      alert('Número, Actor y Demandado son obligatorios.'); return
    }
    setSaving(true)
    const { tipoPromo, promoDesc, ...rest } = form
    const actuacion = tipoPromo && promoDesc ? `${tipoPromo}: ${promoDesc}` : tipoPromo || promoDesc || ''
    const payload = { ...rest, actuacion, termino: form.termino || null, user_id: session.user.id, actualizado_en: new Date().toISOString(), alertas_boletin: form.alertas_boletin }
    let error
    if (editId) {
      ({ error } = await supabase.from('expedientes').update(payload).eq('id', editId))
    } else {
      ({ error } = await supabase.from('expedientes').insert({ ...payload, creado_en: new Date().toISOString() }))
    }
    setSaving(false)
    if (error) { toast('Error: ' + error.message, 'error'); return }
    toast(editId ? 'Expediente actualizado' : 'Expediente creado')
    setModal(false); cargar()
  }

  async function eliminar(id, num) {
    if (!window.confirm(`¿Eliminar el expediente ${num}?`)) return
    await supabase.from('expedientes').delete().eq('id', id)
    toast(`Expediente ${num} eliminado`, 'warning')
    cargar()
  }

  // Detalle, historial, archivos
  async function cargarHistorial(expId) {
    const { data } = await supabase.from('actuaciones').select('*').eq('expediente_id', expId).order('fecha', { ascending: false })
    setHistorial(data || [])
  }
  async function cargarArchivos(expId) {
    const { data } = await supabase.from('documentos').select('*').eq('expediente_id', expId).order('creado_en', { ascending: false })
    setArchivos(data || [])
  }
  function abrirDetalle(exp) {
    setDetalleExp(exp); setTabDetalle('info')
    setHForm({ fecha: new Date().toISOString().slice(0, 10), descripcion: '' })
    cargarHistorial(exp.id); cargarArchivos(exp.id)
  }
  async function guardarActuacion() {
    if (!hForm.descripcion.trim()) return
    setHSaving(true)
    await supabase.from('actuaciones').insert({
      expediente_id: detalleExp.id,
      descripcion: hForm.descripcion,
      fecha: hForm.fecha || new Date().toISOString().slice(0, 10),
      user_id: session.user.id,
      creado_en: new Date().toISOString(),
    })
    setHSaving(false)
    setHForm(f => ({ ...f, descripcion: '' }))
    cargarHistorial(detalleExp.id)
  }
  async function eliminarActuacion(id) {
    await supabase.from('actuaciones').delete().eq('id', id)
    cargarHistorial(detalleExp.id)
  }
  async function subirArchivo(file) {
    if (!file) return
    if (file.size > 20 * 1024 * 1024) { alert('Máximo 20 MB'); return }
    setUploading(true)
    const path = `${session.user.id}/${detalleExp.id}/${Date.now()}_${file.name}`
    const { error } = await supabase.storage.from('documentos').upload(path, file)
    if (error) { alert('Error: ' + error.message); setUploading(false); return }
    await supabase.from('documentos').insert({
      expediente_id: detalleExp.id,
      nombre: file.name, path,
      user_id: session.user.id, creado_en: new Date().toISOString(),
    })
    setUploading(false); cargarArchivos(detalleExp.id)
  }
  async function descargarArchivo(doc) {
    const { data, error } = await supabase.storage.from('documentos').createSignedUrl(doc.path, 120)
    if (error) return alert('No se pudo generar enlace.')
    window.open(data.signedUrl, '_blank')
  }
  async function eliminarArchivo(doc) {
    if (!confirm(`¿Eliminar "${doc.nombre}"?`)) return
    await supabase.storage.from('documentos').remove([doc.path])
    await supabase.from('documentos').delete().eq('id', doc.id)
    cargarArchivos(detalleExp.id)
  }

  // Exportar CSV
  function exportarCSV() {
    const cab = 'num,materia,tipo,juzgado,actor,demandado,etapa,estado,actuacion,termino,prioridad,notas'
    const filas = lista.map(e => [e.num, e.materia, e.tipo, e.juzgado || '', e.actor, e.demandado, e.etapa, e.estado, e.actuacion || '', e.termino || '', e.prioridad || 'Normal', (e.notas || '').replace(/[\n\r]/g, ' ')].map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob(['﻿' + cab + '\n' + filas.join('\n')], { type: 'text/csv;charset=utf-8' }))
    a.download = `expedientes_${new Date().toISOString().slice(0, 10)}.csv`; a.click()
  }

  return (
    <div>
      <PageHeader
        title="Expedientes"
        subtitle="Administra todos los casos del despacho"
        actions={
          <>
            <button onClick={exportarCSV} style={btnSec}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M7 10l5 5 5-5"/><path d="M12 15V3"/>
              </svg>
              Exportar CSV
            </button>
            <button onClick={abrirNuevo} style={btnPri}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 5v14"/><path d="M5 12h14"/>
              </svg>
              Nuevo
            </button>
          </>
        }
      />

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14, marginBottom: 20 }}>
        <StatCard title="Total" value={total} color="var(--primary)"/>
        <StatCard title="Activos" value={activos} color="var(--success)"/>
        <StatCard title="Urgentes" value={urgentes} subtitle="≤3 días" color="var(--warning)"/>
        <StatCard title="Vencidos" value={vencidos} color="var(--danger)"/>
      </div>

      {/* Toolbar */}
      <div style={{
        display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center',
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)',
        padding: 14,
        marginBottom: 14,
      }}>
        <div style={{ position: 'relative', flex: '1 1 240px', minWidth: 200 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
               style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}>
            <circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>
          </svg>
          <input
            value={buscar} onChange={e => setBuscar(e.target.value)}
            placeholder="Buscar expediente, actor, demandado..."
            style={{ ...inputStyle, paddingLeft: 36, width: '100%' }}
          />
        </div>
        <select value={filtros.materia} onChange={e => setFiltros(f => ({ ...f, materia: e.target.value }))} style={inputStyle}>
          <option value="">Todas las materias</option>
          {MATERIAS.map(m => <option key={m}>{m}</option>)}
        </select>
        <select value={filtros.etapa} onChange={e => setFiltros(f => ({ ...f, etapa: e.target.value }))} style={inputStyle}>
          <option value="">Todas las etapas</option>
          {ETAPAS.map(m => <option key={m}>{m}</option>)}
        </select>
        <select value={filtros.estado} onChange={e => setFiltros(f => ({ ...f, estado: e.target.value }))} style={inputStyle}>
          <option value="">Todos los estados</option>
          {ESTADOS.map(m => <option key={m}>{m}</option>)}
        </select>
      </div>

      {/* Tabla */}
      <div style={{ overflowX: 'auto', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)' }}>
        <table className="lx-table" style={{ border: 'none', borderRadius: 0 }}>
          <thead>
            <tr>
              <th>Expediente</th>
              <th>Partes</th>
              <th>Materia / Tipo</th>
              <th>Etapa</th>
              <th>Vencimiento</th>
              <th>Estado</th>
              <th style={{ width: 100 }}></th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={7} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>Cargando...</td></tr>
            )}
            {!loading && lista.length === 0 && (
              <tr><td colSpan={7} style={{ padding: 40 }}>
                <EmptyState
                  title="Sin expedientes"
                  subtitle={total === 0 ? 'Crea tu primer expediente para empezar.' : 'No hay resultados con esos filtros.'}
                  action={total === 0 && <button onClick={abrirNuevo} style={btnPri}>+ Crear expediente</button>}
                />
              </td></tr>
            )}
            {!loading && lista.map(e => {
              const d = diasHasta(e.termino)
              const u = urgencyColor(d)
              return (
                <tr key={e.id}>
                  <td>
                    <button onClick={() => abrirDetalle(e)} style={{
                      background: 'transparent', border: 'none', cursor: 'pointer',
                      color: 'var(--primary)', fontWeight: 700, padding: 0,
                    }}>{e.num}</button>
                  </td>
                  <td>
                    <div style={{ fontSize: 13, color: 'var(--text)' }}>{e.actor}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>vs. {e.demandado}</div>
                  </td>
                  <td>
                    <div style={{ fontSize: 13, color: 'var(--text)' }}>{e.materia}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 180 }}>{e.tipo}</div>
                  </td>
                  <td>
                    <StatusBadge tone="primary" dot={false}>{e.etapa}</StatusBadge>
                  </td>
                  <td>
                    {e.termino ? (
                      <div>
                        <div style={{ fontSize: 13, color: 'var(--text)' }}>{fmtFecha(e.termino)}</div>
                        <div style={{
                          display: 'inline-block', marginTop: 2,
                          background: u.bg, color: u.color,
                          padding: '2px 8px', borderRadius: 999,
                          fontSize: 10, fontWeight: 700,
                        }}>{u.label}</div>
                      </div>
                    ) : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                  </td>
                  <td><StatusBadge>{e.estado}</StatusBadge></td>
                  <td>
                    <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                      <button onClick={() => abrirEditar(e)} style={iconActionBtn} title="Editar">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                          <path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                        </svg>
                      </button>
                      <button onClick={() => eliminar(e.id, e.num)} style={{ ...iconActionBtn, color: 'var(--danger)' }} title="Eliminar">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                        </svg>
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Modal de edición/creación */}
      <Modal
        open={modal}
        onClose={() => setModal(false)}
        title={editId ? 'Editar expediente' : 'Nuevo expediente'}
        subtitle="Captura los datos jurídicos del caso"
        width={760}
        footer={
          <>
            <button onClick={() => setModal(false)} style={btnSec}>Cancelar</button>
            <button onClick={guardar} disabled={saving} style={btnPri}>
              {saving ? 'Guardando...' : 'Guardar expediente'}
            </button>
          </>
        }
      >
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14 }}>
          <Field label="Número *">
            <input style={inputStyle} value={form.num} onChange={e => setF('num', e.target.value)} placeholder="306/2024"/>
          </Field>
          <Field label="Materia *">
            <select style={inputStyle} value={form.materia} onChange={e => setF('materia', e.target.value)}>
              {MATERIAS.map(o => <option key={o}>{o}</option>)}
            </select>
          </Field>
          <Field label="Tipo de juicio *" full>
            <select style={inputStyle} value={form.tipo} onChange={e => setF('tipo', e.target.value)}>
              {TIPOS.map(o => <option key={o}>{o}</option>)}
            </select>
          </Field>
          <Field label="Juzgado / Órgano" full>
            <select style={inputStyle} value={form.juzgado} onChange={e => setF('juzgado', e.target.value)}>
              <option value="">— Seleccionar juzgado —</option>
              {JUZGADOS_JALISCO.map(g => (
                <optgroup key={g.grupo} label={g.grupo}>
                  {g.items.map(j => <option key={j} value={j}>{j}</option>)}
                </optgroup>
              ))}
              <option value="__otro__">Otro / Foráneo</option>
            </select>
            {form.juzgado === '__otro__' && (
              <input style={{ ...inputStyle, marginTop: 6 }} placeholder="Escribe el nombre del juzgado" onChange={e => setF('juzgado', e.target.value)}/>
            )}
          </Field>
          <Field label="Actor *" full>
            <input style={inputStyle} value={form.actor} onChange={e => setF('actor', e.target.value)}/>
          </Field>
          <Field label="Demandado *" full>
            <input style={inputStyle} value={form.demandado} onChange={e => setF('demandado', e.target.value)}/>
          </Field>
          <Field label="Etapa procesal *">
            <select style={inputStyle} value={form.etapa} onChange={e => setF('etapa', e.target.value)}>
              {ETAPAS.map(o => <option key={o}>{o}</option>)}
            </select>
          </Field>
          <Field label="Estado">
            <select style={inputStyle} value={form.estado} onChange={e => setF('estado', e.target.value)}>
              {ESTADOS.map(o => <option key={o}>{o}</option>)}
            </select>
          </Field>
          <Field label="Tipo de promoción pendiente" full>
            <select style={inputStyle} value={form.tipoPromo} onChange={e => setF('tipoPromo', e.target.value)}>
              <option value="">— Sin promoción pendiente —</option>
              {TIPOS_PROMO.map(o => <option key={o}>{o}</option>)}
            </select>
          </Field>
          <Field label="Detalle de la promoción" full>
            <input style={inputStyle} value={form.promoDesc} onChange={e => setF('promoDesc', e.target.value)} placeholder="Presentar escrito antes del 25..."/>
          </Field>
          <Field label="Fecha de término">
            <input type="date" style={inputStyle} value={form.termino} onChange={e => setF('termino', e.target.value)}/>
          </Field>
          <Field label="Prioridad">
            <select style={inputStyle} value={form.prioridad} onChange={e => setF('prioridad', e.target.value)}>
              {PRIORIDADES.map(o => <option key={o}>{o}</option>)}
            </select>
          </Field>
          <Field label="Notas" full>
            <textarea
              style={{ ...inputStyle, minHeight: 80, resize: 'vertical' }}
              value={form.notas} onChange={e => setF('notas', e.target.value)}
            />
          </Field>
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
              <div
                onClick={() => setF('alertas_boletin', !form.alertas_boletin)}
                style={{
                  width: 40, height: 22, borderRadius: 999,
                  background: form.alertas_boletin ? 'var(--primary)' : 'var(--border)',
                  position: 'relative', transition: 'background .2s', cursor: 'pointer', flexShrink: 0,
                }}
              >
                <div style={{
                  position: 'absolute', top: 3, left: form.alertas_boletin ? 21 : 3,
                  width: 16, height: 16, borderRadius: '50%', background: '#fff',
                  transition: 'left .2s', boxShadow: '0 1px 3px rgba(0,0,0,.2)',
                }}/>
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>Alertas de Boletín Judicial</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  Recibe email cuando se publique un acuerdo de este expediente en el boletín de Jalisco
                </div>
              </div>
            </label>
          </div>
        </div>
      </Modal>

      {/* Modal detalle */}
      <Modal
        open={!!detalleExp}
        onClose={() => setDetalleExp(null)}
        width={760}
        title={detalleExp ? detalleExp.num : ''}
        subtitle={detalleExp ? `${detalleExp.actor} vs. ${detalleExp.demandado}` : ''}
        footer={
          detalleExp && (
            <>
              <button onClick={() => { eliminar(detalleExp.id, detalleExp.num); setDetalleExp(null) }} style={btnDanger}>Eliminar</button>
              <button onClick={() => setDetalleExp(null)} style={btnSec}>Cerrar</button>
              <button onClick={() => abrirEditar(detalleExp)} style={btnPri}>Editar</button>
            </>
          )
        }
      >
        {detalleExp && (
          <>
            <div style={{
              display: 'flex', gap: 2, background: 'var(--surface-3)',
              borderRadius: 'var(--radius)', padding: 3, marginBottom: 16,
            }}>
              {[['info', 'Información'], ['historial', 'Historial'], ['archivos', 'Archivos']].map(([k, lbl]) => (
                <button key={k} onClick={() => setTabDetalle(k)} style={{
                  flex: 1, border: 'none', cursor: 'pointer',
                  background: tabDetalle === k ? 'var(--surface)' : 'transparent',
                  color: tabDetalle === k ? 'var(--primary)' : 'var(--text-secondary)',
                  fontWeight: tabDetalle === k ? 700 : 500,
                  padding: '8px 14px', borderRadius: 'calc(var(--radius) - 2px)',
                  fontSize: 13,
                }}>{lbl}</button>
              ))}
            </div>

            {tabDetalle === 'info' && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
                {[
                  ['Materia', detalleExp.materia],
                  ['Tipo de juicio', detalleExp.tipo],
                  ['Juzgado', detalleExp.juzgado || '—'],
                  ['Etapa', detalleExp.etapa],
                  ['Estado', detalleExp.estado],
                  ['Prioridad', detalleExp.prioridad || 'Normal'],
                  ['Término', fmtFecha(detalleExp.termino)],
                  ['Promoción', detalleExp.actuacion || '—'],
                ].map(([k, v]) => (
                  <div key={k} style={{
                    background: 'var(--surface-3)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius)',
                    padding: '10px 12px',
                  }}>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.5px', fontWeight: 700, marginBottom: 4 }}>{k}</div>
                    <div style={{ fontSize: 13, color: 'var(--text)', fontWeight: 500 }}>{v}</div>
                  </div>
                ))}
                {detalleExp.notas && (
                  <div style={{
                    gridColumn: '1 / -1',
                    background: 'var(--surface-3)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius)',
                    padding: '10px 12px',
                  }}>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.5px', fontWeight: 700, marginBottom: 4 }}>Notas</div>
                    <div style={{ fontSize: 13, color: 'var(--text)', whiteSpace: 'pre-wrap' }}>{detalleExp.notas}</div>
                  </div>
                )}
              </div>
            )}

            {tabDetalle === 'historial' && (
              <div>
                <div style={{
                  background: 'var(--surface-3)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius)',
                  padding: 12, marginBottom: 14,
                }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr auto', gap: 8, alignItems: 'end' }}>
                    <div>
                      <div style={labelStyle}>Fecha</div>
                      <input type="date" style={inputStyle} value={hForm.fecha} onChange={e => setHForm(f => ({ ...f, fecha: e.target.value }))}/>
                    </div>
                    <div>
                      <div style={labelStyle}>Descripción</div>
                      <input style={inputStyle} value={hForm.descripcion} onChange={e => setHForm(f => ({ ...f, descripcion: e.target.value }))} placeholder="Se presentó escrito..."/>
                    </div>
                    <button onClick={guardarActuacion} disabled={hSaving} style={btnPri}>
                      {hSaving ? '...' : 'Agregar'}
                    </button>
                  </div>
                </div>
                {historial.length === 0
                  ? <div style={{ textAlign: 'center', padding: 24, color: 'var(--text-muted)', fontSize: 13 }}>Sin actuaciones registradas.</div>
                  : historial.map(a => (
                    <div key={a.id} style={{
                      display: 'flex', gap: 12, padding: '10px 0',
                      borderBottom: '1px solid var(--border)', alignItems: 'center',
                    }}>
                      <span style={{ fontSize: 12, color: 'var(--text-muted)', minWidth: 88 }}>{fmtFecha(a.fecha)}</span>
                      <span style={{ flex: 1, fontSize: 13, color: 'var(--text)' }}>{a.descripcion}</span>
                      <button onClick={() => eliminarActuacion(a.id)} style={{ ...iconActionBtn, color: 'var(--danger)' }} title="Eliminar">×</button>
                    </div>
                  ))
                }
              </div>
            )}

            {tabDetalle === 'archivos' && (
              <div>
                <label style={{
                  display: 'block',
                  background: 'var(--surface-3)',
                  border: '2px dashed var(--border)',
                  borderRadius: 'var(--radius)',
                  padding: 20, textAlign: 'center', cursor: uploading ? 'not-allowed' : 'pointer',
                  marginBottom: 14,
                  color: uploading ? 'var(--text-muted)' : 'var(--primary)',
                  fontSize: 13, fontWeight: 500,
                }}>
                  {uploading ? 'Subiendo...' : '+ Clic o arrastra para subir (máx. 20 MB)'}
                  <input type="file" style={{ display: 'none' }} disabled={uploading} onChange={e => { subirArchivo(e.target.files[0]); e.target.value = '' }}/>
                </label>
                {archivos.length === 0
                  ? <div style={{ textAlign: 'center', padding: 24, color: 'var(--text-muted)', fontSize: 13 }}>Sin archivos adjuntos.</div>
                  : archivos.map(a => (
                    <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                      <span style={{ fontSize: 13, color: 'var(--text)', flex: 1, wordBreak: 'break-all' }}>{a.nombre}</span>
                      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{fmtFecha(a.creado_en?.slice(0, 10))}</span>
                      <button onClick={() => descargarArchivo(a)} style={iconActionBtn} title="Abrir">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 3h7v7"/><path d="M10 14L21 3"/><path d="M21 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5"/></svg>
                      </button>
                      <button onClick={() => eliminarArchivo(a)} style={{ ...iconActionBtn, color: 'var(--danger)' }} title="Eliminar">×</button>
                    </div>
                  ))
                }
              </div>
            )}
          </>
        )}
      </Modal>
    </div>
  )
}

/* ---------- helpers locales ---------- */
function Field({ label, children, full }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, gridColumn: full ? '1 / -1' : 'auto' }}>
      <div style={labelStyle}>{label}</div>
      {children}
    </div>
  )
}

const inputStyle = {
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  color: 'var(--text)',
  borderRadius: 'var(--radius)',
  padding: '9px 12px',
  fontSize: 13,
  width: '100%',
}
const labelStyle = {
  fontSize: 11, fontWeight: 600,
  color: 'var(--text-muted)',
  textTransform: 'uppercase', letterSpacing: '.5px',
}
const btnPri = {
  background: 'var(--primary)', color: '#fff',
  border: 'none', borderRadius: 'var(--radius)',
  padding: '9px 16px', fontSize: 13, fontWeight: 600,
  cursor: 'pointer',
  display: 'inline-flex', alignItems: 'center', gap: 6,
}
const btnSec = {
  background: 'var(--surface)', color: 'var(--text)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius)',
  padding: '8px 14px', fontSize: 13, fontWeight: 500,
  cursor: 'pointer',
  display: 'inline-flex', alignItems: 'center', gap: 6,
}
const btnDanger = {
  background: 'transparent', color: 'var(--danger)',
  border: '1px solid var(--danger)',
  borderRadius: 'var(--radius)',
  padding: '8px 14px', fontSize: 13, fontWeight: 600,
  cursor: 'pointer',
}
const iconActionBtn = {
  background: 'var(--surface-3)',
  border: '1px solid var(--border)',
  color: 'var(--text-secondary)',
  borderRadius: 'var(--radius-sm)',
  padding: '6px 8px',
  cursor: 'pointer',
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
}
