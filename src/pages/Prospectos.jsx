import { useEffect, useState, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { useOrg } from '../context/OrgContext'
import { useToast } from '../context/ToastContext'
import { MATERIAS, JUZGADOS_JALISCO, TIPOS, ETAPAS as ETAPAS_EXPEDIENTE, diasHasta, fmtFecha } from '../utils/helpers'
import PageHeader from '../components/ui/PageHeader'
import Modal from '../components/ui/Modal'
import EmptyState from '../components/ui/EmptyState'
import StatusBadge from '../components/ui/StatusBadge'

// ── Configuración del pipeline de prospectos ───────────────────────────────
const ETAPAS = [
  { key: 'Nuevo contacto',        label: 'Nuevo contacto',        color: '#3b82f6', bg: 'rgba(59,130,246,.12)'  },
  { key: 'Contactado',            label: 'Contactado',            color: '#8b5cf6', bg: 'rgba(139,92,246,.12)'  },
  { key: 'Información solicitada', label: 'Información solicitada', color: '#06b6d4', bg: 'rgba(6,182,212,.12)'   },
  { key: 'En análisis',           label: 'En análisis',           color: '#f59e0b', bg: 'rgba(245,158,11,.12)'  },
  { key: 'Cotización enviada',    label: 'Cotización enviada',    color: '#10b981', bg: 'rgba(16,185,129,.12)'  },
  { key: 'En negociación',        label: 'En negociación',        color: '#ec4899', bg: 'rgba(236,72,153,.12)'  },
  { key: 'Cita agendada',         label: 'Cita agendada',         color: '#6366f1', bg: 'rgba(99,102,241,.12)'  },
  { key: 'Contratado',            label: 'Contratado',            color: '#22c55e', bg: 'rgba(34,197,94,.12)'   },
  { key: 'No contratado',         label: 'No contratado',         color: '#6b7280', bg: 'rgba(107,114,128,.12)' },
  { key: 'Perdido',               label: 'Perdido',               color: '#ef4444', bg: 'rgba(239,68,68,.12)'   },
  { key: 'Recontactar después',   label: 'Recontactar después',   color: '#a855f7', bg: 'rgba(168,85,247,.12)'  },
]
const ETAPA_MAP  = Object.fromEntries(ETAPAS.map(e => [e.key, e]))

const FUENTES = ['Facebook', 'WhatsApp', 'recomendación', 'página web', 'llamada', 'visita', 'otro']
const TIPOS_ASUNTO = ['mercantil', 'civil', 'familiar', 'laboral', 'administrativo', 'penal', 'corporativo', 'cobranza', 'contrato', 'otro']
const URGENCIAS = ['baja', 'media', 'alta']

const formVacio = () => ({
  nombre: '', email: '', telefono: '', asunto: '',
  materia: 'Mercantil', etapa: 'Nuevo contacto', prioridad: 'Normal',
  origen: '', notas: '', valor_estimado: '',
  fuente_contacto: 'WhatsApp',
  tipo_asunto: 'mercantil',
  descripcion_caso: '',
  urgencia: 'media',
  responsable: '',
  fecha_contacto: new Date().toISOString().slice(0, 10),
  proximo_seguimiento: '',
  observaciones: '',
})

export default function Prospectos({ session }) {
  const { org, canWrite } = useOrg()
  const toast  = useToast()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  const [prospectos, setProspectos] = useState([])
  const [loading, setLoading]       = useState(true)
  const [vista, setVista]           = useState('kanban') // 'kanban' | 'lista'
  const [buscar, setBuscar]         = useState('')
  const [miembros, setMiembros]     = useState([])

  // Filtros
  const [filtros, setFiltros] = useState({
    etapa: '',
    fuente_contacto: '',
    tipo_asunto: '',
    responsable: '',
    urgencia: '',
    proximo_seguimiento: '',
  })

  // Modal crear/editar
  const [modal, setModal]   = useState(false)
  const [editId, setEditId] = useState(null)
  const [form, setForm]     = useState(formVacio)
  const [saving, setSaving] = useState(false)

  // Drawer detalle
  const [detalle, setDetalle] = useState(null)

  // Modal convertir a expediente
  const [modalConvertir, setModalConvertir] = useState(false)
  const [convForm, setConvForm]             = useState({})
  const [convSaving, setConvSaving]         = useState(false)

  // ── Cargar Prospectos ──────────────────────────────────────────
  const cargar = useCallback(async () => {
    if (!org) return
    setLoading(true)
    const { data } = await supabase
      .from('prospectos')
      .select('*')
      .eq('despacho_id', org.id)
      .order('creado_en', { ascending: false })
    setProspectos(data || [])
    setLoading(false)
  }, [org])

  // Cargar miembros del equipo para asignar responsables
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

  useEffect(() => {
    const t = setTimeout(() => {
      cargar()
    }, 0)
    return () => clearTimeout(t)
  }, [cargar])

  // Auto-abrir modal desde URL action=nuevo (p.ej. desde Dashboard)
  useEffect(() => {
    if (searchParams.get('action') === 'nuevo' && canWrite) {
      setForm(formVacio())
      setEditId(null)
      setModal(true)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── CRUD ─────────────────────────────────────────────────────
  function abrirNuevo() {
    setForm(formVacio())
    setEditId(null)
    setModal(true)
  }

  function abrirEditar(p) {
    setForm({
      nombre: p.nombre,
      email: p.email || '',
      telefono: p.telefono || '',
      asunto: p.asunto || '',
      materia: p.materia || 'Mercantil',
      etapa: p.etapa || 'Nuevo contacto',
      prioridad: p.prioridad || 'Normal',
      origen: p.origen || '',
      notas: p.notas || '',
      valor_estimado: p.valor_estimado || '',
      fuente_contacto: p.fuente_contacto || p.origen || 'WhatsApp',
      tipo_asunto: p.tipo_asunto || p.materia?.toLowerCase() || 'mercantil',
      descripcion_caso: p.descripcion_caso || p.asunto || '',
      urgencia: p.urgencia || (p.prioridad ? p.prioridad.toLowerCase() : 'media'),
      responsable: p.responsable || '',
      fecha_contacto: p.fecha_contacto || (p.creado_en ? p.creado_en.slice(0, 10) : new Date().toISOString().slice(0, 10)),
      proximo_seguimiento: p.proximo_seguimiento || '',
      observaciones: p.observaciones || p.notas || '',
    })
    setEditId(p.id)
    setModal(true)
    setDetalle(null)
  }

  const setF = (k, v) => setForm(f => ({ ...f, [k]: v }))

  async function guardar() {
    if (!form.nombre.trim()) { toast('El nombre es obligatorio', 'error'); return }
    setSaving(true)
    
    // Mapear campos para compatibilidad bidireccional
    const payload = {
      ...form,
      valor_estimado: form.valor_estimado ? parseFloat(form.valor_estimado) : null,
      asunto: form.descripcion_caso || form.asunto,
      notas: form.observaciones || form.notas,
      materia: form.tipo_asunto ? (form.tipo_asunto.charAt(0).toUpperCase() + form.tipo_asunto.slice(1)) : form.materia,
      prioridad: form.urgencia ? (form.urgencia.charAt(0).toUpperCase() + form.urgencia.slice(1)) : form.prioridad,
      origen: form.fuente_contacto || form.origen,
      despacho_id: org.id,
      user_id: session.user.id,
      actualizado_en: new Date().toISOString(),
    }
    
    let error
    if (editId) {
      ;({ error } = await supabase.from('prospectos').update(payload).eq('id', editId))
    } else {
      ;({ error } = await supabase.from('prospectos').insert({ ...payload, creado_en: new Date().toISOString() }))
    }
    setSaving(false)
    if (error) { toast('Error: ' + error.message, 'error'); return }
    
    // Log bitacora
    if (org?.id) {
      await supabase.from('bitacora_actividad').insert({
        despacho_id: org.id,
        user_id: session.user.id,
        user_email: session.user.email,
        accion: editId ? 'actualizar_prospecto' : 'crear_prospecto',
        detalles: editId
          ? `Actualizó el prospecto "${form.nombre}"`
          : `Creó el prospecto "${form.nombre}"`
      })
    }

    toast(editId ? 'Prospecto actualizado' : '✅ Prospecto creado')
    setModal(false)
    cargar()
  }

  async function eliminar(id, nombre) {
    if (!confirm(`¿Eliminar prospecto "${nombre}"?`)) return
    await supabase.from('prospectos').delete().eq('id', id)
    
    // Log bitacora
    if (org?.id) {
      await supabase.from('bitacora_actividad').insert({
        despacho_id: org.id,
        user_id: session.user.id,
        user_email: session.user.email,
        accion: 'eliminar_prospecto',
        detalles: `Eliminó el prospecto "${nombre}"`
      })
    }

    toast('Prospecto eliminado', 'warning')
    setDetalle(null)
    cargar()
  }

  async function moverEtapa(id, nuevaEtapa) {
    await supabase.from('prospectos')
      .update({ etapa: nuevaEtapa, actualizado_en: new Date().toISOString() })
      .eq('id', id)
    
    const p = prospectos.find(x => x.id === id)
    if (org?.id && p) {
      await supabase.from('bitacora_actividad').insert({
        despacho_id: org.id,
        user_id: session.user.id,
        user_email: session.user.email,
        accion: 'actualizar_prospecto',
        detalles: `Movió el prospecto "${p.nombre}" a la etapa ${nuevaEtapa}`
      })
    }

    setProspectos(prev => prev.map(p => p.id === id ? { ...p, etapa: nuevaEtapa } : p))
    if (detalle?.id === id) setDetalle(d => ({ ...d, etapa: nuevaEtapa }))
    toast(`Movido a ${nuevaEtapa}`)
  }

  // ── Convertir a expediente ───────────────────────────────────
  function abrirConvertir(p) {
    const materiaInferida = p.tipo_asunto ? (p.tipo_asunto.charAt(0).toUpperCase() + p.tipo_asunto.slice(1)) : (p.materia || 'Mercantil')
    setConvForm({
      num: '',
      anio: new Date().getFullYear(),
      juzgado: '',
      tipo: 'Juicio Ordinario ' + (materiaInferida === 'Mercantil' ? 'Mercantil' : 'Civil'),
      actor: p.nombre,
      demandado: '',
      etapa: 'Captura inicial',
      abogado_responsable: p.responsable || '',
      materia: materiaInferida,
      fecha_inicio: new Date().toISOString().slice(0, 10),
      notas: p.descripcion_caso || p.asunto || '',
    })
    setDetalle(p)
    setModalConvertir(true)
  }

  async function handleConvertir() {
    if (!convForm.num.trim()) { toast('El número de expediente es obligatorio', 'error'); return }
    setConvSaving(true)
    
    const { data: exp, error } = await supabase
      .from('expedientes')
      .insert({
        num: convForm.num,
        anio: convForm.anio ? parseInt(convForm.anio) : null,
        juzgado: convForm.juzgado || null,
        tipo: convForm.tipo || null,
        actor: convForm.actor || '',
        demandado: convForm.demandado || '',
        etapa: convForm.etapa || 'Captura inicial',
        materia: convForm.materia || 'Mercantil',
        estado: 'Activo',
        abogado_responsable: convForm.abogado_responsable || null,
        fecha_inicio: convForm.fecha_inicio || null,
        notas: convForm.notas || '',
        termino: null,
        prioridad: 'Normal',
        despacho_id: org.id,
        user_id: session.user.id,
        creado_en: new Date().toISOString(),
        actualizado_en: new Date().toISOString(),
      })
      .select()
      .single()

    if (error) { toast('Error al crear expediente: ' + error.message, 'error'); setConvSaving(false); return }

    // Marcar prospecto como Contratado y enlazar expediente_id
    await supabase.from('prospectos')
      .update({
        etapa: 'Contratado',
        expediente_id: exp.id,
        actualizado_en: new Date().toISOString()
      })
      .eq('id', detalle.id)

    // Agregar la parte actora en la tabla expediente_partes automáticamente
    await supabase.from('expediente_partes').insert({
      expediente_id: exp.id,
      despacho_id: org.id,
      nombre: detalle.nombre,
      rol: 'Actor',
      domicilio: '',
      correo: detalle.email || '',
      telefono: detalle.telefono || '',
      observaciones: 'Convertido desde prospecto'
    })

    // Log bitacora
    if (org?.id) {
      await supabase.from('bitacora_actividad').insert({
        despacho_id: org.id,
        user_id: session.user.id,
        user_email: session.user.email,
        accion: 'convertir_prospecto',
        detalles: `Convirtió al prospecto "${detalle.nombre}" en el expediente ${convForm.num}`
      })
    }

    setConvSaving(false)
    setModalConvertir(false)
    toast('✅ Convertido a expediente exitosamente')
    cargar()
    
    // Navegar al expediente creado
    navigate(`/app/expedientes?q=${encodeURIComponent(convForm.num)}`)
  }

  // ── Filtro de la lista ───────────────────────────────────────────
  const lista = prospectos.filter(p => {
    if (buscar.trim()) {
      const q = buscar.toLowerCase()
      if (!`${p.nombre} ${p.email || ''} ${p.telefono || ''} ${p.asunto || ''} ${p.descripcion_caso || ''}`.toLowerCase().includes(q)) return false
    }
    
    if (filtros.etapa && p.etapa !== filtros.etapa) return false
    if (filtros.fuente_contacto && p.fuente_contacto !== filtros.fuente_contacto) return false
    if (filtros.tipo_asunto && p.tipo_asunto !== filtros.tipo_asunto) return false
    if (filtros.responsable && p.responsable !== filtros.responsable) return false
    if (filtros.urgencia && p.urgencia !== filtros.urgencia) return false
    
    if (filtros.proximo_seguimiento) {
      if (!p.proximo_seguimiento) return false
      const hoyStr = new Date().toISOString().slice(0, 10)
      if (filtros.proximo_seguimiento === 'hoy') {
        if (p.proximo_seguimiento !== hoyStr) return false
      } else if (filtros.proximo_seguimiento === 'vencido') {
        if (p.proximo_seguimiento >= hoyStr) return false
      } else if (filtros.proximo_seguimiento === 'esta_semana') {
        const diff = diasHasta(p.proximo_seguimiento)
        if (diff === null || diff < 0 || diff > 7) return false
      }
    }
    return true
  })

  // KPIs
  const total   = prospectos.length
  const activos = prospectos.filter(p => !['Contratado','No contratado','Perdido'].includes(p.etapa)).length
  const ganados = prospectos.filter(p => p.etapa === 'Contratado').length
  const tasa    = total > 0 ? Math.round((ganados / total) * 100) : 0

  return (
    <div style={{ position: 'relative' }}>
      <style>{`
        @keyframes slideIn { from { opacity:0; transform:translateX(24px) } to { opacity:1; transform:translateX(0) } }
        .prosp-card:hover { background: color-mix(in srgb, var(--primary) 5%, var(--surface)) !important; }
        .filters-row { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 16px; align-items: center; }
      `}</style>

      <PageHeader
        title="CRM — Prospectos"
        subtitle="Seguimiento de clientes potenciales y prospectos"
        actions={
          <div style={{ display:'flex', gap:8 }}>
            <div style={{ display:'flex', background:'var(--surface-3)', border:'1px solid var(--border)', borderRadius:'var(--radius)', overflow:'hidden' }}>
              {[['kanban','⊞'], ['lista','☰']].map(([v, ico]) => (
                <button key={v} onClick={() => setVista(v)} style={{
                  border:'none', padding:'7px 12px', cursor:'pointer', fontSize:14,
                  background: vista === v ? 'var(--primary)' : 'transparent',
                  color: vista === v ? '#fff' : 'var(--text-secondary)',
                  transition:'all .15s',
                }}>{ico}</button>
              ))}
            </div>
            {canWrite && (
              <button onClick={abrirNuevo} style={btnPri}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 5v14"/><path d="M5 12h14"/>
                </svg>
                Agregar prospecto
              </button>
            )}
          </div>
        }
      />

      {/* KPIs */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(130px,1fr))', gap:12, marginBottom:16 }}>
        {[
          { label:'Total prospectos', value:total, color:'var(--primary)' },
          { label:'En pipeline', value:activos, color:'var(--warning)' },
          { label:'Contratados', value:ganados, color:'var(--success)' },
          { label:'Tasa de cierre', value:`${tasa}%`, color:'var(--info)' },
        ].map(k => (
          <div key={k.label} style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'var(--radius-lg)', padding:'14px 16px' }}>
            <div style={{ fontSize:11, color:'var(--text-muted)', fontWeight:600, textTransform:'uppercase', letterSpacing:'.5px' }}>{k.label}</div>
            <div style={{ fontSize:24, fontWeight:800, color:k.color, marginTop:4 }}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* Barra de Filtros */}
      <div className="filters-row">
        <div style={{ position:'relative', minWidth:220, flex: 1 }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
            style={{ position:'absolute', left:10, top:'50%', transform:'translateY(-50%)', color:'var(--text-muted)' }}>
            <circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>
          </svg>
          <input
            value={buscar} onChange={e => setBuscar(e.target.value)}
            placeholder="Buscar por nombre, teléfono, asunto..."
            style={{ ...inputStyle, paddingLeft:30, width:'100%' }}
          />
        </div>
        
        <select
          value={filtros.etapa}
          onChange={e => setFiltros(f => ({ ...f, etapa: e.target.value }))}
          style={{ ...inputStyle, width: 'auto' }}
        >
          <option value="">Todas las etapas</option>
          {ETAPAS.map(e => <option key={e.key} value={e.key}>{e.label}</option>)}
        </select>

        <select
          value={filtros.fuente_contacto}
          onChange={e => setFiltros(f => ({ ...f, fuente_contacto: e.target.value }))}
          style={{ ...inputStyle, width: 'auto' }}
        >
          <option value="">Todas las fuentes</option>
          {FUENTES.map(f => <option key={f} value={f}>{f}</option>)}
        </select>

        <select
          value={filtros.tipo_asunto}
          onChange={e => setFiltros(f => ({ ...f, tipo_asunto: e.target.value }))}
          style={{ ...inputStyle, width: 'auto' }}
        >
          <option value="">Todos los asuntos</option>
          {TIPOS_ASUNTO.map(t => <option key={t} value={t}>{t}</option>)}
        </select>

        <select
          value={filtros.responsable}
          onChange={e => setFiltros(f => ({ ...f, responsable: e.target.value }))}
          style={{ ...inputStyle, width: 'auto' }}
        >
          <option value="">Todos los responsables</option>
          {miembros.map(m => (
            <option key={m.user_id} value={m.user_profiles?.nombre || m.user_id}>
              {m.user_profiles?.nombre || m.user_profiles?.email}
            </option>
          ))}
        </select>

        <select
          value={filtros.urgencia}
          onChange={e => setFiltros(f => ({ ...f, urgencia: e.target.value }))}
          style={{ ...inputStyle, width: 'auto' }}
        >
          <option value="">Todas las urgencias</option>
          {URGENCIAS.map(u => <option key={u} value={u}>{u}</option>)}
        </select>

        <select
          value={filtros.proximo_seguimiento}
          onChange={e => setFiltros(f => ({ ...f, proximo_seguimiento: e.target.value }))}
          style={{ ...inputStyle, width: 'auto' }}
        >
          <option value="">Cualquier fecha de seg.</option>
          <option value="hoy">Seguimiento Hoy</option>
          <option value="esta_semana">Seguimiento esta semana (7d)</option>
          <option value="vencido">Seguimiento atrasado / vencido</option>
        </select>

        {(filtros.etapa || filtros.fuente_contacto || filtros.tipo_asunto || filtros.responsable || filtros.urgencia || filtros.proximo_seguimiento) && (
          <button
            onClick={() => setFiltros({ etapa: '', fuente_contacto: '', tipo_asunto: '', responsable: '', urgencia: '', proximo_seguimiento: '' })}
            style={{ ...btnSec, color: 'var(--danger)', borderColor: 'var(--danger)', padding: '8px 12px', fontSize: 11 }}
          >
            Limpiar filtros
          </button>
        )}
      </div>

      {/* ── Vista Kanban ── */}
      {vista === 'kanban' && (
        <div style={{ display:'flex', gap:12, overflowX:'auto', paddingBottom:12, alignItems:'flex-start' }}>
          {ETAPAS.map(etapa => {
            const cards = lista.filter(p => p.etapa === etapa.key)
            return (
              <div key={etapa.key} style={{
                minWidth:230, maxWidth:260, flex:'0 0 230px',
                background:'var(--surface-3)', border:'1px solid var(--border)',
                borderRadius:'var(--radius-lg)', overflow:'hidden',
              }}>
                {/* Header columna */}
                <div style={{
                  padding:'10px 14px', display:'flex', alignItems:'center', justifyContent:'space-between',
                  borderBottom:'1px solid var(--border)',
                  borderTop:`3px solid ${etapa.color}`,
                }}>
                  <span style={{ fontSize:12, fontWeight:700, color:'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 150 }} title={etapa.label}>{etapa.label}</span>
                  <span style={{
                    fontSize:11, fontWeight:700, padding:'2px 8px', borderRadius:999,
                    background: etapa.bg, color: etapa.color,
                  }}>{cards.length}</span>
                </div>

                {/* Cards */}
                <div style={{ padding:8, display:'flex', flexDirection:'column', gap:6, minHeight:100, maxHeight: 600, overflowY: 'auto' }}>
                  {loading && <div style={{ fontSize:12, color:'var(--text-muted)', padding:'12px 4px', textAlign:'center' }}>Cargando...</div>}
                  {!loading && cards.length === 0 && (
                    <div style={{ fontSize:11, color:'var(--text-muted)', padding:'16px 4px', textAlign:'center', fontStyle:'italic' }}>Sin prospectos</div>
                  )}
                  {cards.map(p => (
                    <div
                      key={p.id}
                      className="prosp-card"
                      onClick={() => setDetalle(p)}
                      style={{
                        background:'var(--surface)', border:'1px solid var(--border)',
                        borderRadius:'var(--radius)', padding:'10px 12px',
                        cursor:'pointer', transition:'background .15s',
                        borderLeft: `3px solid ${etapa.color}`,
                      }}
                    >
                      <div style={{ fontSize:13, fontWeight:700, color:'var(--text)', marginBottom:3 }}>{p.nombre}</div>
                      {(p.descripcion_caso || p.asunto) && (
                        <div style={{ fontSize:11, color:'var(--text-muted)', marginBottom:4, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                          {p.descripcion_caso || p.asunto}
                        </div>
                      )}
                      
                      {p.telefono && (
                        <div style={{ fontSize:11, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
                          📞 <span style={{ fontSize: 11 }}>{p.telefono}</span>
                        </div>
                      )}

                      {p.proximo_seguimiento && (
                        <div style={{
                          fontSize: 10,
                          fontWeight: 600,
                          color: diasHasta(p.proximo_seguimiento) < 0 ? 'var(--danger)' : 'var(--text-secondary)',
                          marginBottom: 4
                        }}>
                          📅 Seg: {fmtFecha(p.proximo_seguimiento)}
                        </div>
                      )}

                      <div style={{ display:'flex', gap:4, flexWrap:'wrap', marginTop:4 }}>
                        <span style={{ fontSize:10, padding:'2px 6px', borderRadius:999, background:'var(--surface-3)', color:'var(--text-muted)', border:'1px solid var(--border)', textTransform: 'capitalize' }}>
                          {p.tipo_asunto || p.materia}
                        </span>
                        
                        {p.urgencia && (
                          <span style={{
                            fontSize:9, padding:'1px 5px', borderRadius:999,
                            background: p.urgencia === 'alta' ? 'rgba(239,68,68,.1)' : p.urgencia === 'media' ? 'rgba(245,158,11,.1)' : 'rgba(107,114,128,.1)',
                            color: p.urgencia === 'alta' ? 'var(--danger)' : p.urgencia === 'media' ? 'var(--warning)' : 'var(--text-muted)',
                            border: '1px solid currentColor', textTransform: 'uppercase', fontWeight: 700
                          }}>
                            {p.urgencia}
                          </span>
                        )}

                        {p.expediente_id && (
                          <span style={{ fontSize:10, padding:'2px 6px', borderRadius:999, background:'rgba(34,197,94,.15)', color:'var(--success)', fontWeight:700 }}>✓ Exp.</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ── Vista Lista ── */}
      {vista === 'lista' && (
        <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'var(--radius-lg)', overflowX:'auto' }}>
          <table className="lx-table" style={{ border:'none', borderRadius:0 }}>
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Teléfono</th>
                <th>Tipo de asunto</th>
                <th>Fuente</th>
                <th>Etapa</th>
                <th>Responsable</th>
                <th>Próximo seguimiento</th>
                <th>Estatus</th>
                <th style={{ width:60 }}></th>
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={9} style={{ textAlign:'center', padding:32, color:'var(--text-muted)' }}>Cargando...</td></tr>}
              {!loading && lista.length === 0 && (
                <tr><td colSpan={9} style={{ padding:32 }}>
                  <EmptyState title="Sin prospectos" subtitle="Agrega tu primer prospecto para empezar." action={canWrite && <button onClick={abrirNuevo} style={btnPri}>+ Agregar prospecto</button>}/>
                </td></tr>
              )}
              {lista.map(p => {
                const et = ETAPA_MAP[p.etapa]
                return (
                  <tr key={p.id} onClick={() => setDetalle(p)} style={{ cursor:'pointer' }}>
                    <td>
                      <div style={{ fontSize:13, fontWeight:700, color:'var(--text)' }}>{p.nombre}</div>
                      {p.email && <div style={{ fontSize:11, color:'var(--text-muted)' }}>{p.email}</div>}
                    </td>
                    <td style={{ fontSize:12, color:'var(--text)' }}>{p.telefono || '—'}</td>
                    <td style={{ fontSize:12, textTransform: 'capitalize' }}>{p.tipo_asunto || p.materia || '—'}</td>
                    <td style={{ fontSize:12, color:'var(--text-muted)' }}>{p.fuente_contacto || p.origen || '—'}</td>
                    <td>
                      <span style={{ fontSize:11, fontWeight:700, padding:'3px 9px', borderRadius:999, background: et?.bg || 'var(--surface-3)', color: et?.color || 'var(--text)' }}>
                        {p.etapa}
                      </span>
                    </td>
                    <td style={{ fontSize:12, color:'var(--text)' }}>{p.responsable || '—'}</td>
                    <td style={{ fontSize:12, color: diasHasta(p.proximo_seguimiento) < 0 ? 'var(--danger)' : 'var(--text)', fontWeight: diasHasta(p.proximo_seguimiento) < 0 ? 600 : 400 }}>
                      {p.proximo_seguimiento ? fmtFecha(p.proximo_seguimiento) : '—'}
                    </td>
                    <td>
                      {p.expediente_id ? (
                        <StatusBadge tone="success">Contratado</StatusBadge>
                      ) : (
                        <StatusBadge tone="warning">Pendiente</StatusBadge>
                      )}
                    </td>
                    <td onClick={e => e.stopPropagation()}>
                      <div style={{ display:'flex', gap:4, justifyContent:'flex-end' }}>
                        {canWrite && (
                          <button onClick={() => abrirEditar(p)} style={iconBtn} title="Editar">
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                              <path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                            </svg>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Drawer detalle ── */}
      {detalle && (
        <div style={{
          position:'fixed', top:0, right:0, bottom:0, width:440,
          background:'var(--surface)', borderLeft:'1px solid var(--border)',
          boxShadow:'-8px 0 32px rgba(0,0,0,.15)',
          display:'flex', flexDirection:'column', zIndex:200,
          animation:'slideIn .2s cubic-bezier(.4,0,.2,1)',
        }}>
          {/* Header */}
          <div style={{ padding:'16px 20px', borderBottom:'1px solid var(--border)', flexShrink:0 }}>
            <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:10 }}>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:17, fontWeight:800, color:'var(--text)' }}>{detalle.nombre}</div>
                {detalle.email && <div style={{ fontSize:12, color:'var(--text-muted)', marginTop:2 }}>✉️ {detalle.email}</div>}
                {detalle.telefono && <div style={{ fontSize:12, color:'var(--text-muted)' }}>📞 {detalle.telefono}</div>}
              </div>
              <button onClick={() => setDetalle(null)} style={{ ...iconBtn, padding:'5px 8px', fontSize:14 }}>✕</button>
            </div>

            {/* Badge etapa */}
            <div style={{ marginTop:10 }}>
              <span style={{
                fontSize:12, fontWeight:700, padding:'4px 12px', borderRadius:999,
                background: ETAPA_MAP[detalle.etapa]?.bg || 'var(--surface-3)',
                color: ETAPA_MAP[detalle.etapa]?.color || 'var(--text)',
              }}>{detalle.etapa}</span>
            </div>
          </div>

          {/* Cuerpo scrolleable */}
          <div style={{ flex:1, overflowY:'auto', padding:'16px 20px', display:'flex', flexDirection:'column', gap:12 }}>
            {/* Info */}
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
              {[
                ['Tipo de asunto', detalle.tipo_asunto || detalle.materia || '—'],
                ['Fuente de contacto', detalle.fuente_contacto || detalle.origen || '—'],
                ['Urgencia', detalle.urgencia || detalle.prioridad || 'media'],
                ['Responsable', detalle.responsable || '—'],
                ['Monto aproximado', detalle.valor_estimado ? `$${Number(detalle.valor_estimado).toLocaleString('es-MX')}` : '—'],
                ['Primer Contacto', detalle.fecha_contacto ? fmtFecha(detalle.fecha_contacto) : '—'],
                ['Próximo Seguimiento', detalle.proximo_seguimiento ? fmtFecha(detalle.proximo_seguimiento) : '—'],
                ['Fecha Registro', new Date(detalle.creado_en).toLocaleDateString('es-MX')],
              ].map(([k,v]) => (
                <div key={k} style={{ background:'var(--surface-3)', border:'1px solid var(--border)', borderRadius:'var(--radius)', padding:'8px 12px' }}>
                  <div style={{ fontSize:10, color:'var(--text-muted)', fontWeight:700, textTransform:'uppercase', letterSpacing:'.5px', marginBottom:2 }}>{k}</div>
                  <div style={{ fontSize:13, color:'var(--text)', fontWeight:500, textTransform: k === 'Tipo de asunto' ? 'capitalize' : 'none' }}>{v}</div>
                </div>
              ))}
            </div>

            {(detalle.descripcion_caso || detalle.asunto) && (
              <div style={{ background:'var(--surface-3)', border:'1px solid var(--border)', borderRadius:'var(--radius)', padding:'10px 14px' }}>
                <div style={{ fontSize:10, color:'var(--text-muted)', fontWeight:700, textTransform:'uppercase', letterSpacing:'.5px', marginBottom:4 }}>Descripción del caso</div>
                <div style={{ fontSize:13, color:'var(--text)', lineHeight:1.6 }}>{detalle.descripcion_caso || detalle.asunto}</div>
              </div>
            )}
            
            {(detalle.observaciones || detalle.notas) && (
              <div style={{ background:'var(--surface-3)', border:'1px solid var(--border)', borderRadius:'var(--radius)', padding:'10px 14px' }}>
                <div style={{ fontSize:10, color:'var(--text-muted)', fontWeight:700, textTransform:'uppercase', letterSpacing:'.5px', marginBottom:4 }}>Observaciones</div>
                <div style={{ fontSize:13, color:'var(--text)', lineHeight:1.6, whiteSpace:'pre-wrap' }}>{detalle.observaciones || detalle.notas}</div>
              </div>
            )}

            {/* Mover etapa */}
            {canWrite && detalle.etapa !== 'Contratado' && (
              <div>
                <div style={{ fontSize:11, color:'var(--text-muted)', fontWeight:700, textTransform:'uppercase', letterSpacing:'.5px', marginBottom:8 }}>Mover etapa a</div>
                <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                  {ETAPAS.filter(e => e.key !== detalle.etapa).map(e => (
                    <button key={e.key} onClick={() => moverEtapa(detalle.id, e.key)} style={{
                      fontSize:10, fontWeight:700, padding:'4px 10px', borderRadius:999,
                      border:`1px solid ${e.color}`, background: e.bg, color: e.color, cursor:'pointer',
                    }}>{e.label}</button>
                  ))}
                </div>
              </div>
            )}

            {/* Expediente vinculado */}
            {detalle.expediente_id && (
              <div style={{ padding:'10px 14px', background:'rgba(34,197,94,.08)', border:'1px solid rgba(34,197,94,.25)', borderRadius:'var(--radius)' }}>
                <div style={{ fontSize:12, fontWeight:700, color:'var(--success)' }}>✓ Convertido en expediente</div>
                <button
                  onClick={() => navigate(`/app/expedientes?q=${encodeURIComponent(detalle.nombre)}`)}
                  style={{ fontSize:11, color:'var(--primary)', background:'none', border:'none', cursor:'pointer', padding:0, marginTop:4, fontWeight: 600 }}
                >
                  Ir a Expediente →
                </button>
              </div>
            )}
          </div>

          {/* Pie */}
          {canWrite && (
            <div style={{ padding:'12px 20px', borderTop:'1px solid var(--border)', display:'flex', gap:8, flexShrink:0 }}>
              {!detalle.expediente_id && (
                <button onClick={() => abrirConvertir(detalle)} style={{ ...btnPri, flex:1, justifyContent:'center', fontSize:12 }}>
                  ⚡ Convertir en expediente
                </button>
              )}
              <button onClick={() => abrirEditar(detalle)} style={{ ...btnSec, fontSize:12 }}>Editar</button>
              <button onClick={() => eliminar(detalle.id, detalle.nombre)} style={{ ...btnDanger, fontSize:12 }}>Eliminar</button>
            </div>
          )}
        </div>
      )}

      {/* Overlay drawer */}
      {detalle && (
        <div
          onClick={() => setDetalle(null)}
          style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.25)', zIndex:199 }}
        />
      )}

      {/* ── Modal crear/editar prospecto ── */}
      <Modal
        open={modal}
        onClose={() => setModal(false)}
        title={editId ? 'Editar prospecto' : 'Agregar prospecto'}
        subtitle="Captura los datos detallados del prospecto o cliente potencial"
        width={720}
        footer={
          <>
            <button onClick={() => setModal(false)} style={btnSec}>Cancelar</button>
            <button onClick={guardar} disabled={saving} style={btnPri}>
              {saving ? 'Guardando...' : 'Guardar'}
            </button>
          </>
        }
      >
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
          <Field label="Nombre completo / Razón Social *" full>
            <input style={inputStyle} value={form.nombre} onChange={e => setF('nombre', e.target.value)} placeholder="Juan Pérez / Empresa SA"/>
          </Field>
          
          <Field label="Teléfono de contacto">
            <input style={inputStyle} value={form.telefono} onChange={e => setF('telefono', e.target.value)} placeholder="33 1234 5678"/>
          </Field>
          
          <Field label="Correo electrónico">
            <input style={inputStyle} type="email" value={form.email} onChange={e => setF('email', e.target.value)} placeholder="correo@ejemplo.com"/>
          </Field>

          <Field label="Fuente de contacto">
            <select style={inputStyle} value={form.fuente_contacto} onChange={e => setF('fuente_contacto', e.target.value)}>
              {FUENTES.map(f => <option key={f} value={f}>{f}</option>)}
            </select>
          </Field>

          <Field label="Tipo de asunto (Materia)">
            <select style={inputStyle} value={form.tipo_asunto} onChange={e => setF('tipo_asunto', e.target.value)}>
              {TIPOS_ASUNTO.map(t => <option key={t} value={t}>{t.toUpperCase()}</option>)}
            </select>
          </Field>

          <Field label="Urgencia">
            <select style={inputStyle} value={form.urgencia} onChange={e => setF('urgencia', e.target.value)}>
              {URGENCIAS.map(u => <option key={u} value={u}>{u.toUpperCase()}</option>)}
            </select>
          </Field>

          <Field label="Etapa del prospecto">
            <select style={inputStyle} value={form.etapa} onChange={e => setF('etapa', e.target.value)}>
              {ETAPAS.map(e => <option key={e.key} value={e.key}>{e.label}</option>)}
            </select>
          </Field>

          <Field label="Abogado Responsable">
            <select style={inputStyle} value={form.responsable} onChange={e => setF('responsable', e.target.value)}>
              <option value="">— Sin asignar —</option>
              {miembros.map(m => (
                <option key={m.user_id} value={m.user_profiles?.nombre || m.user_id}>
                  {m.user_profiles?.nombre || m.user_profiles?.email} ({m.rol})
                </option>
              ))}
            </select>
          </Field>

          <Field label="Fecha de primer contacto">
            <input style={inputStyle} type="date" value={form.fecha_contacto} onChange={e => setF('fecha_contacto', e.target.value)}/>
          </Field>

          <Field label="Fecha de próximo seguimiento">
            <input style={inputStyle} type="date" value={form.proximo_seguimiento} onChange={e => setF('proximo_seguimiento', e.target.value)}/>
          </Field>

          <Field label="Monto aproximado del asunto (MXN)">
            <input style={inputStyle} type="number" min="0" value={form.valor_estimado} onChange={e => setF('valor_estimado', e.target.value)} placeholder="0.00"/>
          </Field>

          <Field label="Descripción breve del caso" full>
            <textarea style={{ ...inputStyle, minHeight:70, resize:'vertical' }} value={form.descripcion_caso} onChange={e => setF('descripcion_caso', e.target.value)} placeholder="¿De qué trata el caso? Detalla brevemente la problemática legal..."/>
          </Field>

          <Field label="Observaciones y notas internas" full>
            <textarea style={{ ...inputStyle, minHeight:60, resize:'vertical' }} value={form.observaciones} onChange={e => setF('observaciones', e.target.value)} placeholder="Comentarios del seguimiento, acuerdos preliminares, etc."/>
          </Field>
        </div>
      </Modal>

      {/* ── Modal convertir a expediente ── */}
      <Modal
        open={modalConvertir}
        onClose={() => setModalConvertir(false)}
        title="Convertir prospecto en expediente"
        subtitle={`Completa los datos judiciales para abrir el expediente del cliente: ${detalle?.nombre}`}
        width={600}
        footer={
          <>
            <button onClick={() => setModalConvertir(false)} style={btnSec}>Cancelar</button>
            <button onClick={handleConvertir} disabled={convSaving} style={btnPri}>
              {convSaving ? 'Creando expediente...' : '⚡ Confirmar y crear expediente'}
            </button>
          </>
        }
      >
        <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
          <div style={{ padding:'10px 14px', background:'var(--surface-3)', border:'1px solid var(--border)', borderRadius:'var(--radius)', fontSize:12, color:'var(--text-muted)' }}>
            Se creará el expediente en base de datos. El prospecto se marcará como <strong style={{ color:'var(--success)' }}>Contratado</strong> y se vinculará.
          </div>
          
          <div style={{ display:'grid', gridTemplateColumns:'2fr 1fr', gap:12 }}>
            <Field label="Número de expediente *">
              <input style={inputStyle} value={convForm.num || ''} onChange={e => setConvForm(f => ({ ...f, num: e.target.value }))} placeholder="Ej: 1234/2026"/>
            </Field>
            
            <Field label="Año *">
              <input style={inputStyle} type="number" value={convForm.anio || ''} onChange={e => setConvForm(f => ({ ...f, anio: e.target.value }))} placeholder="2026"/>
            </Field>
          </div>

          <Field label="Juzgado *">
            <select
              style={inputStyle}
              value={convForm.juzgado || ''}
              onChange={e => setConvForm(f => ({ ...f, juzgado: e.target.value }))}
            >
              <option value="">— Seleccionar Juzgado —</option>
              {JUZGADOS_JALISCO.map(g => (
                <optgroup key={g.grupo} label={g.grupo}>
                  {g.items.map(j => <option key={j} value={j}>{j}</option>)}
                </optgroup>
              ))}
            </select>
          </Field>

          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
            <Field label="Materia">
              <select
                style={inputStyle}
                value={convForm.materia || 'Mercantil'}
                onChange={e => setConvForm(f => ({ ...f, materia: e.target.value }))}
              >
                {MATERIAS.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </Field>

            <Field label="Tipo de juicio *">
              <select
                style={inputStyle}
                value={convForm.tipo || ''}
                onChange={e => setConvForm(f => ({ ...f, tipo: e.target.value }))}
              >
                <option value="">— Seleccionar Tipo de Juicio —</option>
                {TIPOS.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </Field>
          </div>

          <Field label="Parte Actora (pre-llenada)">
            <input style={inputStyle} value={convForm.actor || ''} onChange={e => setConvForm(f => ({ ...f, actor: e.target.value }))}/>
          </Field>

          <Field label="Parte Demandada *">
            <input style={inputStyle} value={convForm.demandado || ''} onChange={e => setConvForm(f => ({ ...f, demandado: e.target.value }))} placeholder="Nombre de la contraparte"/>
          </Field>

          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
            <Field label="Etapa procesal inicial">
              <select
                style={inputStyle}
                value={convForm.etapa || 'Captura inicial'}
                onChange={e => setConvForm(f => ({ ...f, etapa: e.target.value }))}
              >
                {ETAPAS_EXPEDIENTE.map(e => <option key={e} value={e}>{e}</option>)}
              </select>
            </Field>

            <Field label="Abogado Responsable">
              <select
                style={inputStyle}
                value={convForm.abogado_responsable || ''}
                onChange={e => setConvForm(f => ({ ...f, abogado_responsable: e.target.value }))}
              >
                <option value="">— Seleccionar Responsable —</option>
                {miembros.map(m => (
                  <option key={m.user_id} value={m.user_profiles?.nombre || m.user_id}>
                    {m.user_profiles?.nombre || m.user_profiles?.email}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <Field label="Fecha de inicio">
            <input style={inputStyle} type="date" value={convForm.fecha_inicio || ''} onChange={e => setConvForm(f => ({ ...f, fecha_inicio: e.target.value }))}/>
          </Field>

          <Field label="Observaciones iniciales">
            <textarea style={{ ...inputStyle, minHeight:50, resize:'vertical' }} value={convForm.notes || convForm.notas || ''} onChange={e => setConvForm(f => ({ ...f, notes: e.target.value }))}/>
          </Field>
        </div>
      </Modal>
    </div>
  )
}

// Helper local para campos del formulario
function Field({ label, children, full }) {
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:4, gridColumn: full ? '1 / -1' : 'auto' }}>
      <div style={labelStyle}>{label}</div>
      {children}
    </div>
  )
}

const inputStyle = {
  background:'var(--surface)', border:'1px solid var(--border)',
  color:'var(--text)', borderRadius:'var(--radius)',
  padding:'9px 12px', fontSize:13, width:'100%', boxSizing:'border-box',
}
const labelStyle = {
  fontSize:11, fontWeight:600, color:'var(--text-muted)',
  textTransform:'uppercase', letterSpacing:'.5px',
}
const btnPri = {
  background:'var(--primary)', color:'#fff', border:'none',
  borderRadius:'var(--radius)', padding:'9px 16px', fontSize:13, fontWeight:600,
  cursor:'pointer', display:'inline-flex', alignItems:'center', gap:6,
}
const btnSec = {
  background:'var(--surface)', color:'var(--text)',
  border:'1px solid var(--border)', borderRadius:'var(--radius)',
  padding:'8px 14px', fontSize:13, fontWeight:500, cursor:'pointer',
}
const btnDanger = {
  background:'transparent', color:'var(--danger)',
  border:'1px solid var(--danger)', borderRadius:'var(--radius)',
  padding:'8px 14px', fontSize:13, fontWeight:600, cursor:'pointer',
}
const iconBtn = {
  background:'var(--surface-3)', border:'1px solid var(--border)',
  color:'var(--text-secondary)', borderRadius:'var(--radius-sm)',
  padding:'6px 8px', cursor:'pointer',
  display:'inline-flex', alignItems:'center', justifyContent:'center',
}
