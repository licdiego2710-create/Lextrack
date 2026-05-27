import { useEffect, useState, useCallback } from 'react'
import React from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { useToast } from '../context/ToastContext'
import { useOrg } from '../context/OrgContext'
import {
  diasHasta, fmtFecha, urgencyColor,
  ETAPAS, TIPOS, MATERIAS, ESTADOS, PRIORIDADES, TIPOS_PROMO, JUZGADOS_JALISCO,
  materiaDesdJuzgado, getCjjCode, consultarBoletinCJJ,
  ORGANOS_CJF_TERCER_CIRCUITO, urlAmparoFederalCJF,
  consultarAmparosFederalesGuardados, guardarAmparo,
  cargarAcuerdosAmparo, marcarAcuerdosAmparoLeidos,
  CJF_CIRCUITO_3_URL,
} from '../utils/helpers'
import StatCard from '../components/ui/StatCard'
import StatusBadge from '../components/ui/StatusBadge'
import Modal from '../components/ui/Modal'
import PageHeader from '../components/ui/PageHeader'
import EmptyState from '../components/ui/EmptyState'

/* ── Sección visual del formulario de amparo ── */
function SeccionAmparo({ titulo, children }) {
  return (
    <div>
      <div style={{
        fontSize: 11, fontWeight: 700, color: 'var(--primary)',
        textTransform: 'uppercase', letterSpacing: '1px',
        borderBottom: '1px solid var(--border)', paddingBottom: 6, marginBottom: 12,
      }}>
        {titulo}
      </div>
      {children}
    </div>
  )
}

/* ── Buscador inline de amparo por número ── */
function BuscarAmparoCJF({ onBuscar, cargando }) {
  const [num, setNum] = React.useState('')
  function handleSubmit(e) {
    e.preventDefault()
    if (num.trim()) onBuscar(num.trim())
  }
  return (
    <form onSubmit={handleSubmit} style={{ marginBottom: 10 }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 6 }}>
        Número del amparo (CJF)
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <input
          style={{ flex: 1, background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)', borderRadius: 'var(--radius)', padding: '9px 12px', fontSize: 13 }}
          value={num}
          onChange={e => setNum(e.target.value)}
          placeholder="Ej: 1234/2024"
          disabled={cargando}
        />
        <button type="submit" disabled={cargando || !num.trim()} style={{ background: 'var(--primary)', color: '#fff', border: 'none', borderRadius: 'var(--radius)', padding: '9px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6, opacity: (cargando || !num.trim()) ? 0.6 : 1, whiteSpace: 'nowrap', flexShrink: 0 }}>
          {cargando ? <span style={{ display: 'inline-block', animation: 'spin 1s linear infinite' }}>⟳</span> : '🔍 Consultar CJF'}
        </button>
      </div>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 5 }}>
        El amparo tiene su propio número distinto al expediente local.
      </div>
    </form>
  )
}

const formVacio = (email = '') => ({
  num: '', materia: 'Mercantil', tipo: 'Juicio Ordinario Mercantil',
  juzgado: '', cve_juz: '', actor: '', demandado: '',
  etapa: 'Captura inicial', estado: 'Activo',
  tipoPromo: '', promoDesc: '',
  termino: '', prioridad: 'Normal', notas: '',
  alertas_boletin: true,
  email_notificacion: email,
  cliente_id: '',
  anio: new Date().getFullYear(),
  partido_judicial: 'Primer Partido Judicial (Guadalajara)',
  abogado_responsable: '',
  fecha_inicio: new Date().toISOString().slice(0, 10),
  ultimo_acuerdo: '',
  proxima_fecha: '',
})

export default function Expedientes({ session }) {
  const [searchParams] = useSearchParams()
  const toast = useToast()
  const { org, canWrite } = useOrg()
  const [expedientes, setExpedientes] = useState([])
  const [loading, setLoading] = useState(true)
  const [buscar, setBuscar] = useState(() => searchParams.get('q') || '')
  
  // Filtros extendidos
  const [filtros, setFiltros] = useState({
    materia: '',
    juzgado: '',
    tipo: '',
    etapa: '',
    responsable: '',
    estado: '',
  })
  
  const [clientes, setClientes] = useState([])
  const [abogados, setAbogados] = useState([]) // Miembros del equipo

  // Cargar clientes
  useEffect(() => {
    async function cargarClientes() {
      if (!org?.id) return
      const { data: miembros } = await supabase
        .from('despacho_miembros')
        .select('user_id')
        .eq('despacho_id', org.id)
        .eq('rol', 'cliente')
        .eq('activo', true)

      if (miembros && miembros.length > 0) {
        const uids = miembros.map(m => m.user_id)
        const { data: perfiles } = await supabase
          .from('user_profiles')
          .select('id, email, nombre')
          .in('id', uids)
        setClientes(perfiles || [])
      } else {
        setClientes([])
      }
    }
    cargarClientes()
  }, [org?.id])

  // Cargar team members (abogados, admins, asistentes)
  useEffect(() => {
    if (!org?.id) return
    ;(async () => {
      const { data } = await supabase
        .from('despacho_miembros')
        .select('user_id, rol, user_profiles(nombre, email)')
        .eq('despacho_id', org.id)
        .eq('activo', true)
        .in('rol', ['admin', 'abogado', 'asistente'])
      setAbogados(data || [])
    })()
  }, [org?.id])

  const [despachoConfig, setDespachoConfig] = useState(null)

  useEffect(() => {
    if (!org?.id) return
    async function loadConfig() {
      const { data } = await supabase
        .from('despacho_config')
        .select('*')
        .eq('despacho_id', org.id)
        .maybeSingle()
      if (data) {
        setDespachoConfig(data)
      }
    }
    loadConfig()
  }, [org?.id])

  const [modal, setModal] = useState(() => new URLSearchParams(window.location.search).get('action') === 'nuevo')
  const [editId, setEditId] = useState(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState(() => formVacio(session?.user?.email || ''))

  const [detalleExp, setDetalleExp] = useState(null)
  const [tabDetalle, setTabDetalle] = useState('info')
  
  // Tab Partes
  const [partes, setPartes] = useState([])
  const [cargandoPartes, setCargandoPartes] = useState(false)
  const [pForm, setPForm] = useState({ nombre: '', rol: 'Actor', domicilio: '', correo: '', telefono: '', observaciones: '' })
  const [pSaving, setPSaving] = useState(false)

  // Tab Actuaciones (Historial)
  const [historial, setHistorial] = useState([])
  const [hForm, setHForm] = useState({
    fecha: new Date().toISOString().slice(0, 10),
    descripcion: '',
    tipo_actuacion: 'Acuerdo',
    genera_termino: false,
    fecha_vencimiento: '',
    responsable: '',
    estatus_cumplimiento: 'Pendiente',
  })
  const [hSaving, setHSaving] = useState(false)
  
  // Tab Audiencias
  const [audiencias, setAudiencias] = useState([])
  const [cargandoAudiencias, setCargandoAudiencias] = useState(false)
  const [audForm, setAudForm] = useState({ titulo: '', fecha_hora: '', lugar: '', observaciones: '' })
  const [audSaving, setAudSaving] = useState(false)

  // Tab Documentos (Archivos)
  const [archivos, setArchivos] = useState([])
  const [uploading, setUploading] = useState(false)
  
  // Tab Fuentes Externas
  const [fuentes, setFuentes] = useState([])
  const [cargandoFuentes, setCargandoFuentes] = useState(false)
  const [fExtForm, setFExtForm] = useState({ nombre: 'Boletín Judicial Jalisco', tipo: 'Boletín', url: '', num_externo: '', organo: '', ultima_consulta: new Date().toISOString().slice(0, 10), observaciones: '' })
  const [fExtSaving, setFExtSaving] = useState(false)

  // Tab Observaciones
  const [obsText, setObsText] = useState('')
  const [obsSaving, setObsSaving] = useState(false)

  const [cargandoActuaciones, setCargandoActuaciones] = useState(false)
  const [cargandoArchivos, setCargandoArchivos] = useState(false)
  const [cargandoAcuerdos, setCargandoAcuerdos] = useState(false)

  // Boletín judicial
  const [acuerdos, setAcuerdos] = useState([])
  const [acuerdosCJJ, setAcuerdosCJJ] = useState(null)
  const [acuerdosSaving, setAcuerdosSaving] = useState(false)
  const [consultandoCJJ, setConsultandoCJJ] = useState(false)
  const [errorCJJ, setErrorCJJ] = useState(null)

  // Consulta MASIVA
  const [consultaMasiva, setConsultaMasiva] = useState(false)
  const [masivaProg, setMasivaProg] = useState({ total: 0, actual: 0, nuevos: 0, texto: '' })

  // Amparos Federales (CJF Tercer Circuito)
  const [amparos, setAmparos]               = useState([])
  const [cargandoAmparos, setCargandoAmparos] = useState(false)
  const [errorAmparos, setErrorAmparos]     = useState(null)
  const [ampForm, setAmpForm]               = useState({
    numAmparo: '', tipoAsunto: 'Amparo Indirecto', materia: '',
    organo: '', ponente: '',
    quejoso: '', terceroInteresado: '', ministerioPublico: '',
    autoridadResponsable: '', actoReclamado: '',
    estado: '', fechaRadicacion: '', fechaAcuerdo: '',
    descripcionAcuerdo: '', observaciones: '',
  })
  const [savingAmparo, setSavingAmparo]     = useState(false)
  const [amparoExpandido, setAmparoExpandido] = useState(null)
  const [acuerdosAmparo, setAcuerdosAmparo]   = useState({})
  const [cargandoHistorial, setCargandoHistorial] = useState(null)

  // Generador de Reportes de Clientes (WhatsApp)
  const [modalReporte, setModalReporte] = useState(false)
  const [repFecha, setRepFecha] = useState('')
  const [repDescripcion, setRepDescripcion] = useState('')
  const [repResumen, setRepResumen] = useState('')
  const [repContactoNombre, setRepContactoNombre] = useState('')
  const [repContactoTelefono, setRepContactoTelefono] = useState('')
  const [cargandoContactoReporte, setCargandoContactoReporte] = useState(false)
  const [contactosDisponibles, setContactosDisponibles] = useState([])
  const [guardarEnHistorial, setGuardarEnHistorial] = useState(false)
  const [copiado, setCopiado] = useState(false)

  // Cobranza y Facturación a Clientes
  const [horas, setHoras] = useState([])
  const [gastos, setGastos] = useState([])
  const [cargandoCobranza, setCargandoCobranza] = useState(false)
  const [cobranzaSaving, setCobranzaSaving] = useState(false)
  const [horasForm, setHorasForm] = useState({
    fecha: new Date().toISOString().slice(0, 10),
    descripcion: '',
    horas: '',
    tarifa_hora: '1500',
  })
  const [gastosForm, setGastosForm] = useState({
    fecha: new Date().toISOString().slice(0, 10),
    concepto: '',
    monto: '',
  })
  const [modalFactura, setModalFactura] = useState(false)

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

  useEffect(() => { cargar() }, [cargar])


  // Filtrado de expedientes
  const lista = expedientes.filter(e => {
    const q = buscar.toLowerCase()
    if (q && !`${e.num} ${e.actor} ${e.demandado} ${e.juzgado || ''} ${e.abogado_responsable || ''}`.toLowerCase().includes(q)) return false
    
    if (filtros.materia && e.materia !== filtros.materia) return false
    if (filtros.juzgado && e.juzgado !== filtros.juzgado) return false
    if (filtros.tipo && e.tipo !== filtros.tipo) return false
    if (filtros.etapa && e.etapa !== filtros.etapa) return false
    if (filtros.responsable && e.abogado_responsable !== filtros.responsable) return false
    
    if (filtros.estado) {
      if (filtros.estado === 'Activo' && e.estado !== 'Activo') return false
      if (filtros.estado === 'Concluido' && e.estado !== 'Concluido') return false
      if (filtros.estado === 'Suspendido' && e.estado !== 'Suspendido') return false
    }
    return true
  })

  // Listas de filtros dinámicas
  const juzgadosExistentes = Array.from(new Set(expedientes.map(e => e.juzgado).filter(Boolean))).sort()
  const tiposJuicioExistentes = Array.from(new Set(expedientes.map(e => e.tipo).filter(Boolean))).sort()
  const responsablesExistentes = Array.from(new Set(expedientes.map(e => e.abogado_responsable).filter(Boolean))).sort()

  // KPIs
  const total = expedientes.length
  const activos = expedientes.filter(e => e.estado === 'Activo').length
  const urgentes = expedientes.filter(e => { const d = diasHasta(e.termino); return d !== null && d >= 0 && d <= 3 && e.estado === 'Activo' }).length
  const vencidos = expedientes.filter(e => e.estado === 'Vencido').length

  // CRUD
  function abrirNuevo() {
    setForm(formVacio(session?.user?.email || ''))
    setEditId(null); setModal(true)
  }

  function abrirEditar(exp) {
    const actuacion = exp.actuacion || ''
    const sepIdx = actuacion.indexOf(': ')
    const tipoPromo = sepIdx > -1 ? actuacion.slice(0, sepIdx) : ''
    const promoDesc = sepIdx > -1 ? actuacion.slice(sepIdx + 2) : actuacion
    setForm({
      num: exp.num, materia: exp.materia, tipo: exp.tipo,
      juzgado: exp.juzgado || '', cve_juz: exp.cve_juz || getCjjCode(exp.juzgado) || '',
      actor: exp.actor, demandado: exp.demandado,
      etapa: exp.etapa, estado: exp.estado,
      tipoPromo, promoDesc,
      termino: exp.termino || '', prioridad: exp.prioridad || 'Normal', notas: exp.notes || exp.notas || '',
      alertas_boletin: exp.alertas_boletin !== false,
      email_notificacion: exp.email_notificacion || exp.user_email || session?.user?.email || '',
      cliente_id: exp.cliente_id || '',
      anio: exp.anio || new Date().getFullYear(),
      partido_judicial: exp.partido_judicial || 'Primer Partido Judicial (Guadalajara)',
      abogado_responsable: exp.abogado_responsable || '',
      fecha_inicio: exp.fecha_inicio || '',
      ultimo_acuerdo: exp.ultimo_acuerdo || '',
      proxima_fecha: exp.proxima_fecha || '',
    })
    setEditId(exp.id); setModal(true)
    setDetalleExp(null)
  }

  const setF = (k, v) => setForm(f => ({ ...f, [k]: v }))

  function handleJuzgadoChange(val) {
    setF('juzgado', val)
    const materiaInferida = materiaDesdJuzgado(val)
    if (materiaInferida) setF('materia', materiaInferida)
    const code = getCjjCode(val)
    setF('cve_juz', code || '')
  }

  async function guardar() {
    if (!form.num.trim() || !form.actor.trim() || !form.demandado.trim()) {
      alert('Número, Actor y Demandado son obligatorios.'); return
    }
    setSaving(true)
    const { tipoPromo, promoDesc, ...rest } = form
    const actuacion = tipoPromo && promoDesc ? `${tipoPromo}: ${promoDesc}` : tipoPromo || promoDesc || ''
    const cveJuz = form.cve_juz || getCjjCode(form.juzgado) || null
    
    const payload = {
      ...rest,
      cliente_id: form.cliente_id || null,
      actuacion,
      termino: form.termino || null,
      user_id: session.user.id,
      despacho_id: org?.id || null,
      actualizado_en: new Date().toISOString(),
      alertas_boletin: form.alertas_boletin,
      email_notificacion: form.alertas_boletin ? (form.email_notificacion || session.user.email) : null,
      cve_juz: cveJuz,
      anio: form.anio ? parseInt(form.anio) : null,
      partido_judicial: form.partido_judicial || null,
      abogado_responsable: form.abogado_responsable || null,
      fecha_inicio: form.fecha_inicio || null,
      ultimo_acuerdo: form.ultimo_acuerdo || null,
      proxima_fecha: form.proxima_fecha || null,
    }
    
    let error, data
    if (editId) {
      ;({ error } = await supabase.from('expedientes').update(payload).eq('id', editId))
    } else {
      ;({ error, data } = await supabase.from('expedientes').insert({ ...payload, creado_en: new Date().toISOString() }).select().single())
    }
    setSaving(false)
    if (error) { toast('Error: ' + error.message, 'error'); return }
    
    // Registrar en bitácora de actividad
    if (org?.id) {
      await supabase.from('bitacora_actividad').insert({
        despacho_id: org.id,
        user_id: session.user.id,
        user_email: session.user.email,
        accion: editId ? 'actualizar_expediente' : 'crear_expediente',
        detalles: editId
          ? `Actualizó el expediente "${form.num}" (${form.actor} vs ${form.demandado})`
          : `Creó el expediente "${form.num}" (${form.actor} vs ${form.demandado})`
      })
    }

    toast(editId ? 'Expediente actualizado' : '✅ Expediente creado')
    setModal(false)
    await cargar()
    
    // Auto-scraping CJJ al crear
    if (!editId && data && cveJuz) {
      toast('🔍 Consultando boletín del CJJ automáticamente...')
      try {
        const acuerdosApi = await consultarBoletinCJJ(payload.num, cveJuz)
        if (acuerdosApi.length > 0) {
          await supabase.from('acuerdos_boletin').insert(
            acuerdosApi.map(a => ({
              expediente_id: data.id,
              fecha: a.fecha,
              descripcion: a.descripcion,
              leido: false,
              auto_detectado: true,
              creado_en: new Date().toISOString(),
            }))
          )
          const ultimaFecha = acuerdosApi.map(a => a.fecha).filter(Boolean).sort().reverse()[0]
          await supabase.from('expedientes').update({
            nuevo_acuerdo: true,
            ultimo_movimiento: ultimaFecha,
          }).eq('id', data.id)
          await cargar()
          toast(`📋 ${acuerdosApi.length} acuerdo(s) del boletín CJJ cargados automáticamente`)
        } else {
          toast('Sin acuerdos en el boletín aún — se revisará automáticamente')
        }
      } catch { /* si falla no bloqueamos */ }
    }
  }

  async function eliminar(id, num) {
    if (!window.confirm(`¿Eliminar el expediente ${num}?`)) return
    await supabase.from('expedientes').delete().eq('id', id)
    toast(`Expediente ${num} eliminado`, 'warning')
    if (detalleExp?.id === id) setDetalleExp(null)
    
    // Registrar en bitácora
    if (org?.id) {
      await supabase.from('bitacora_actividad').insert({
        despacho_id: org.id,
        user_id: session.user.id,
        user_email: session.user.email,
        accion: 'eliminar_expediente',
        detalles: `Eliminó el expediente "${num}"`
      })
    }

    cargar()
  }

  // Detalle, partes, historial, audiencias, archivos, fuentes
  async function cargarPartes(expId) {
    setCargandoPartes(true)
    const { data } = await supabase.from('expediente_partes').select('*').eq('expediente_id', expId).order('creado_en', { ascending: true })
    setPartes(data || [])
    setCargandoPartes(false)
  }

  async function guardarParte() {
    if (!pForm.nombre.trim()) { toast('El nombre es obligatorio', 'error'); return }
    setPSaving(true)
    const { error } = await supabase.from('expediente_partes').insert({
      ...pForm,
      expediente_id: detalleExp.id,
      despacho_id: org.id
    })
    setPSaving(false)
    if (error) {
      toast('Error al guardar parte: ' + error.message, 'error')
    } else {
      toast('✅ Parte procesal agregada')
      setPForm({ nombre: '', rol: 'Actor', domicilio: '', correo: '', telefono: '', observaciones: '' })
      cargarPartes(detalleExp.id)
    }
  }

  async function eliminarParte(id) {
    if (!confirm('¿Eliminar esta parte?')) return
    const { error } = await supabase.from('expediente_partes').delete().eq('id', id)
    if (error) {
      toast('Error al eliminar: ' + error.message, 'error')
    } else {
      toast('Parte eliminada', 'warning')
      cargarPartes(detalleExp.id)
    }
  }

  async function cargarHistorial(expId) {
    setCargandoActuaciones(true)
    const { data } = await supabase.from('actuaciones').select('*').eq('expediente_id', expId).order('fecha', { ascending: false })
    setHistorial(data || [])
    setCargandoActuaciones(false)
  }

  async function cargarArchivos(expId) {
    setCargandoArchivos(true)
    const { data } = await supabase.from('documentos').select('*').eq('expediente_id', expId).order('creado_en', { ascending: false })
    setArchivos(data || [])
    setCargandoArchivos(false)
  }

  async function cargarAcuerdos(expId) {
    setCargandoAcuerdos(true)
    const { data } = await supabase.from('acuerdos_boletin').select('*').eq('expediente_id', expId).order('fecha', { ascending: false })
    setAcuerdos(data || [])
    setCargandoAcuerdos(false)
  }

  async function cargarAudiencias(expId) {
    setCargandoAudiencias(true)
    const { data } = await supabase.from('expediente_audiencias').select('*').eq('expediente_id', expId).order('fecha_hora', { ascending: true })
    setAudiencias(data || [])
    setCargandoAudiencias(false)
  }

  async function guardarAudiencia() {
    if (!audForm.titulo.trim() || !audForm.fecha_hora) { toast('Título y Fecha/Hora son obligatorios', 'error'); return }
    setAudSaving(true)
    const { error } = await supabase.from('expediente_audiencias').insert({
      ...audForm,
      expediente_id: detalleExp.id,
      despacho_id: org.id
    })
    setAudSaving(false)
    if (error) {
      toast('Error al programar audiencia: ' + error.message, 'error')
    } else {
      toast('✅ Audiencia programada')
      setAudForm({ titulo: '', fecha_hora: '', lugar: '', observaciones: '' })
      cargarAudiencias(detalleExp.id)
    }
  }

  async function eliminarAudiencia(id) {
    if (!confirm('¿Eliminar esta audiencia?')) return
    const { error } = await supabase.from('expediente_audiencias').delete().eq('id', id)
    if (error) {
      toast('Error: ' + error.message, 'error')
    } else {
      toast('Audiencia eliminada', 'warning')
      cargarAudiencias(detalleExp.id)
    }
  }

  async function cargarFuentes(expId) {
    setCargandoFuentes(true)
    const { data } = await supabase.from('expediente_fuentes').select('*').eq('expediente_id', expId).order('creado_en', { ascending: true })
    setFuentes(data || [])
    setCargandoFuentes(false)
  }

  async function guardarFuente() {
    if (!fExtForm.nombre.trim() || !fExtForm.url.trim()) { toast('Nombre y URL son obligatorios', 'error'); return }
    setFExtSaving(true)
    const { error } = await supabase.from('expediente_fuentes').insert({
      ...fExtForm,
      expediente_id: detalleExp.id,
      despacho_id: org.id
    })
    setFExtSaving(false)
    if (error) {
      toast('Error al guardar fuente: ' + error.message, 'error')
    } else {
      toast('✅ Fuente registrada')
      setFExtForm({ nombre: 'Boletín Judicial Jalisco', tipo: 'Boletín', url: '', num_externo: '', organo: '', ultima_consulta: new Date().toISOString().slice(0, 10), observaciones: '' })
      cargarFuentes(detalleExp.id)
    }
  }

  async function eliminarFuente(id) {
    if (!confirm('¿Eliminar esta fuente?')) return
    const { error } = await supabase.from('expediente_fuentes').delete().eq('id', id)
    if (error) {
      toast('Error: ' + error.message, 'error')
    } else {
      toast('Fuente eliminada', 'warning')
      cargarFuentes(detalleExp.id)
    }
  }

  async function guardarObservaciones() {
    obsSaving ? null : setObsSaving(true)
    const { error } = await supabase.from('expedientes')
      .update({ notas: obsText, actualizado_en: new Date().toISOString() })
      .eq('id', detalleExp.id)
    setObsSaving(false)
    if (error) {
      toast('Error al guardar: ' + error.message, 'error')
    } else {
      toast('✅ Observaciones actualizadas')
      setDetalleExp(prev => ({ ...prev, notas: obsText }))
      setExpedientes(prev => prev.map(e => e.id === detalleExp.id ? { ...e, notas: obsText } : e))
    }
  }

  // Cobranza y Facturación
  async function cargarCobranza(expId) {
    setCargandoCobranza(true)
    const { data: dataHoras } = await supabase.from('registro_horas').select('*').eq('expediente_id', expId).order('fecha', { ascending: false })
    const { data: dataGastos } = await supabase.from('registro_gastos').select('*').eq('expediente_id', expId).order('fecha', { ascending: false })
    setHoras(dataHoras || [])
    setGastos(dataGastos || [])
    setCargandoCobranza(false)
  }

  async function guardarHora() {
    if (!horasForm.descripcion.trim()) { toast('La descripción es obligatoria', 'error'); return }
    if (!horasForm.horas || parseFloat(horasForm.horas) <= 0) { toast('Las horas deben ser mayores a 0', 'error'); return }
    if (!horasForm.tarifa_hora || parseFloat(horasForm.tarifa_hora) < 0) { toast('La tarifa debe ser mayor o igual a 0', 'error'); return }
    
    setCobranzaSaving(true)
    const { error } = await supabase.from('registro_horas').insert({
      despacho_id: org.id,
      expediente_id: detalleExp.id,
      user_id: session.user.id,
      descripcion: horasForm.descripcion.trim(),
      horas: parseFloat(horasForm.horas),
      tarifa_hora: parseFloat(horasForm.tarifa_hora),
      fecha: horasForm.fecha,
    })
    setCobranzaSaving(false)
    if (error) {
      toast('Error al guardar horas: ' + error.message, 'error')
    } else {
      toast('✅ Horas registradas')
      setHorasForm(prev => ({ ...prev, descripcion: '', horas: '' }))
      cargarCobranza(detalleExp.id)
    }
  }

  async function guardarGasto() {
    if (!gastosForm.concepto.trim()) { toast('El concepto es obligatorio', 'error'); return }
    if (!gastosForm.monto || parseFloat(gastosForm.monto) <= 0) { toast('El monto debe ser mayor a 0', 'error'); return }
    
    setCobranzaSaving(true)
    const { error } = await supabase.from('registro_gastos').insert({
      despacho_id: org.id,
      expediente_id: detalleExp.id,
      concepto: gastosForm.concepto.trim(),
      monto: parseFloat(gastosForm.monto),
      fecha: gastosForm.fecha,
    })
    setCobranzaSaving(false)
    if (error) {
      toast('Error al guardar gasto: ' + error.message, 'error')
    } else {
      toast('✅ Gasto registrado')
      setGastosForm(prev => ({ ...prev, concepto: '', monto: '' }))
      cargarCobranza(detalleExp.id)
    }
  }

  async function eliminarHora(id) {
    if (!confirm('¿Eliminar este registro de horas?')) return
    const { error } = await supabase.from('registro_horas').delete().eq('id', id)
    if (error) {
      toast('Error al eliminar: ' + error.message, 'error')
    } else {
      toast('Registro eliminado', 'warning')
      cargarCobranza(detalleExp.id)
    }
  }

  async function eliminarGasto(id) {
    if (!confirm('¿Eliminar este registro de gastos?')) return
    const { error } = await supabase.from('registro_gastos').delete().eq('id', id)
    if (error) {
      toast('Error al eliminar: ' + error.message, 'error')
    } else {
      toast('Gasto eliminado', 'warning')
      cargarCobranza(detalleExp.id)
    }
  }

  async function facturarTodo() {
    if (horas.filter(h => !h.facturado).length === 0 && gastos.filter(g => !g.facturado).length === 0) {
      toast('No hay conceptos pendientes de facturar', 'info')
      return
    }
    if (!confirm('¿Marcar todos los conceptos pendientes como facturados? Esto los consolidará en el estado de cuenta.')) return
    
    setCobranzaSaving(true)
    const { error: errHoras } = await supabase.from('registro_horas').update({ facturado: true }).eq('expediente_id', detalleExp.id).eq('facturado', false)
    const { error: errGastos } = await supabase.from('registro_gastos').update({ facturado: true }).eq('expediente_id', detalleExp.id).eq('facturado', false)
    setCobranzaSaving(false)

    if (errHoras || errGastos) {
      toast('Error al facturar: ' + (errHoras?.message || errGastos?.message), 'error')
    } else {
      toast('✅ Conceptos marcados como facturados')
      cargarCobranza(detalleExp.id)
    }
  }

  function imprimirRecibo() {
    const printWindow = window.open('', '_blank')
    const totalH = horas.filter(h => !h.facturado).reduce((sum, h) => sum + (h.horas * h.tarifa_hora), 0)
    const totalG = gastos.filter(g => !g.facturado).reduce((sum, g) => sum + g.monto, 0)
    const totalP = totalH + totalG

    const logoHtml = despachoConfig?.logo_url
      ? `<img src="${despachoConfig.logo_url}" style="height: 60px; max-width: 200px; object-fit: contain; margin-bottom: 8px;" />`
      : `<div class="logo">${despachoConfig?.nombre_completo || org?.nombre || 'LEXTRACK MX'}</div>`

    const html = `
      <html>
        <head>
          <title>Estado de Cuenta - ${detalleExp.num}</title>
          <style>
            body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; padding: 40px; color: #333; }
            .header { display: flex; justify-content: space-between; border-bottom: 2px solid #2563eb; padding-bottom: 20px; margin-bottom: 30px; }
            .logo { font-size: 24px; font-weight: 800; color: #2563eb; }
            .meta { margin-bottom: 30px; }
            .meta table { width: 100%; }
            .meta td { padding: 4px 0; font-size: 14px; }
            .meta td.label { font-weight: bold; color: #666; width: 150px; }
            table.items { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
            table.items th { background: #f8fafc; border-bottom: 2px solid #cbd5e1; padding: 10px; text-align: left; font-size: 12px; text-transform: uppercase; color: #475569; }
            table.items td { padding: 10px; border-bottom: 1px solid #e2e8f0; font-size: 13px; }
            .total-box { display: flex; justify-content: flex-end; font-size: 16px; font-weight: bold; margin-top: 20px; }
            .total-val { color: #2563eb; margin-left: 10px; }
            .footer { margin-top: 50px; text-align: center; font-size: 11px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 20px; }
          </style>
        </head>
        <body>
          <div class="header">
            <div>
              ${logoHtml}
              <div style="font-size: 15px; font-weight: 700; color: #1e293b; margin-top: 4px;">
                ${despachoConfig?.nombre_completo || org?.nombre || 'LEXTRACK MX'}
              </div>
              <div style="font-size: 11px; color: #64748b; margin-top: 2px; line-height: 1.4; max-width: 400px;">
                ${despachoConfig?.razon_social ? `<div>Razón Social: ${despachoConfig.razon_social}</div>` : ''}
                ${despachoConfig?.rfc ? `<div>RFC: ${despachoConfig.rfc}</div>` : ''}
                ${despachoConfig?.direccion ? `<div>${despachoConfig.direccion}</div>` : ''}
                ${despachoConfig?.telefono || despachoConfig?.email_oficial ? `<div>${[despachoConfig.telefono, despachoConfig.email_oficial].filter(Boolean).join(' | ')}</div>` : ''}
              </div>
            </div>
            <div style="text-align: right;">
              <div style="font-size: 18px; font-weight: bold;">ESTADO DE CUENTA</div>
              <div style="font-size: 13px; color: #64748b; margin-top: 4px;">Fecha: ${new Date().toLocaleDateString('es-MX')}</div>
            </div>
          </div>

          ${despachoConfig?.membrete_texto ? `
            <div style="background: #f8fafc; border: 1px dashed #e2e8f0; border-radius: 6px; padding: 12px; margin-bottom: 24px; font-size: 12px; color: #475569; line-height: 1.5; font-style: italic;">
              ${despachoConfig.membrete_texto}
            </div>
          ` : ''}

          <div class="meta">
            <table>
              <tr>
                <td class="label">Expediente:</td>
                <td>${detalleExp.num}</td>
                <td class="label">Materia:</td>
                <td>${detalleExp.materia}</td>
              </tr>
              <tr>
                <td class="label">Partes:</td>
                <td colspan="3">${detalleExp.actor} vs. ${detalleExp.demandado}</td>
              </tr>
              <tr>
                <td class="label">Juzgado:</td>
                <td colspan="3">${detalleExp.juzgado || '—'}</td>
              </tr>
            </table>
          </div>

          <h3>Conceptos Facturables</h3>
          <table class="items">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Concepto / Descripción</th>
                <th style="text-align: right;">Cantidad / Horas</th>
                <th style="text-align: right;">Precio / Tarifa</th>
                <th style="text-align: right;">Subtotal</th>
              </tr>
            </thead>
            <tbody>
              ${horas.filter(h => !h.facturado).map(h => `
                <tr>
                  <td>${new Date(h.fecha + 'T12:00:00').toLocaleDateString('es-MX')}</td>
                  <td>${h.descripcion}</td>
                  <td style="text-align: right;">${h.horas} hrs</td>
                  <td style="text-align: right;">$${h.tarifa_hora.toLocaleString('es-MX')}</td>
                  <td style="text-align: right;">$${(h.horas * h.tarifa_hora).toLocaleString('es-MX')}</td>
                </tr>
              `).join('')}
              ${gastos.filter(g => !g.facturado).map(g => `
                <tr>
                  <td>${new Date(g.fecha + 'T12:00:00').toLocaleDateString('es-MX')}</td>
                  <td>[GASTO] ${g.concepto}</td>
                  <td style="text-align: right;">1</td>
                  <td style="text-align: right;">$${g.monto.toLocaleString('es-MX')}</td>
                  <td style="text-align: right;">$${g.monto.toLocaleString('es-MX')}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>

          <div class="total-box">
            <span>Total a Pagar (MXN):</span>
            <span class="total-val">$${totalP.toLocaleString('es-MX')}</span>
          </div>

          <div class="footer">
            Este es un estado de cuenta de servicios profesionales emitido por ${despachoConfig?.nombre_completo || org?.nombre || 'LexTrack MX'}.<br>
            Gracias por su confianza.
          </div>

          <script>
            window.onload = function() {
              window.print();
            }
          </script>
        </body>
      </html>
    `
    printWindow.document.write(html)
    printWindow.document.close()
  }

  function exportarCobranzaExcel() {
    const dataHoras = horas.map(h => ({
      tipo: 'Horas',
      fecha: h.fecha,
      concepto: h.descripcion,
      detalle: `${h.horas} horas a $${h.tarifa_hora}/hr`,
      monto: h.horas * h.tarifa_hora,
      estado: h.facturado ? 'Facturado' : 'Pendiente'
    }))
    
    const dataGastos = gastos.map(g => ({
      tipo: 'Gasto',
      fecha: g.fecha,
      concepto: g.concepto,
      detalle: '',
      monto: g.monto,
      estado: g.facturado ? 'Facturado' : 'Pendiente'
    }))

    const combinado = [...dataHoras, ...dataGastos].sort((a, b) => new Date(a.fecha) - new Date(b.fecha))

    const cab = 'Tipo,Fecha,Concepto/Actividad,Detalle,Monto (MXN),Estado'
    const filas = combinado.map(item => [
      item.tipo,
      item.fecha,
      item.concepto,
      item.detalle,
      item.monto,
      item.estado
    ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))

    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob(['\uFEFF' + cab + '\n' + filas.join('\n')], { type: 'text/csv;charset=utf-8' }))
    a.download = `cobranza_exp_${detalleExp.num}_${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
  }

  function abrirDetalle(exp) {
    setDetalleExp(exp)
    setTabDetalle(exp.nuevo_acuerdo ? 'boletin' : 'info')
    setHForm({
      fecha: new Date().toISOString().slice(0, 10),
      descripcion: '',
      tipo_actuacion: 'Acuerdo',
      genera_termino: false,
      fecha_vencimiento: '',
      responsable: '',
      estatus_cumplimiento: 'Pendiente',
    })
    setAcuerdosCJJ(null); setErrorCJJ(null)
    setAmparos([]); setErrorAmparos(null)
    setObsText(exp.notas || exp.notes || '')
    
    cargarHistorial(exp.id)
    cargarArchivos(exp.id)
    cargarAcuerdos(exp.id)
    cargarAmparosFederales(exp.id)
    cargarCobranza(exp.id)
    
    // Nuevas relaciones
    cargarPartes(exp.id)
    cargarAudiencias(exp.id)
    cargarFuentes(exp.id)
  }

  async function buscarContactoParaReporte(actorNombre, demandadoNombre) {
    if (!org?.id) return
    setCargandoContactoReporte(true)
    setContactosDisponibles([])
    try {
      const nombres = [actorNombre, demandadoNombre].filter(Boolean)
      if (nombres.length === 0) return
      
      const { data, error } = await supabase
        .from('partes_datos')
        .select('nombre, telefono, correo')
        .eq('despacho_id', org.id)
        .in('nombre', nombres)
      
      if (!error && data) {
        setContactosDisponibles(data)
        const actorContact = data.find(c => c.nombre === actorNombre)
        if (actorContact && actorContact.telefono) {
          setRepContactoTelefono(actorContact.telefono)
        } else if (data[0] && data[0].telefono) {
          setRepContactoTelefono(data[0].telefono)
        }
      }
    } catch (e) {
      console.error('Error al buscar contacto:', e)
    } finally {
      setCargandoContactoReporte(false)
    }
  }

  function abrirReporteModal(fecha, desc) {
    setRepFecha(fecha || new Date().toISOString().slice(0, 10))
    const cleanDesc = desc ? desc.replace(/^\[Auto-detectado \/ Boletín Judicial\]\s*/i, '') : ''
    setRepDescripcion(cleanDesc)
    setRepResumen('')
    setGuardarEnHistorial(false)
    setCopiado(false)
    
    if (detalleExp) {
      setRepContactoNombre(detalleExp.actor || '')
      setRepContactoTelefono('')
      buscarContactoParaReporte(detalleExp.actor, detalleExp.demandado)
    }
    
    setModalReporte(true)
  }

  function generarMensajeWhatsApp() {
    if (!detalleExp) return ''
    const despachoNombre = despachoConfig?.nombre_comercial || org?.nombre || 'LexTrack MX'
    const textoActualizacion = repResumen.trim() 
      ? repResumen.trim() 
      : repDescripcion.trim()

    return `*Actualización de Asunto Judicial* ⚖️\n\n` +
      `Estimado(a) ${repContactoNombre || 'cliente'},\n` +
      `Le comparto la última actualización de su asunto en tribunales:\n\n` +
      `*Expediente:* ${detalleExp.num || '—'}\n` +
      `*Partes:* ${detalleExp.actor || '—'} vs ${detalleExp.demandado || '—'}\n` +
      `*Juzgado:* ${detalleExp.juzgado ? detalleExp.juzgado.replace(/^Juzgado /i, '') : '—'}\n` +
      `*Fecha:* ${fmtFecha(repFecha)}\n\n` +
      `*Estado actual / Resumen:* \n${textoActualizacion}\n\n` +
      `Quedo a sus órdenes para cualquier duda.\n` +
      `Saludos cordiales,\n` +
      `*${despachoNombre}*`
  }

  function copiarMensaje() {
    navigator.clipboard.writeText(generarMensajeWhatsApp())
    setCopiado(true)
    setTimeout(() => setCopiado(false), 2000)
    toast('Mensaje copiado al portapapeles')
  }

  async function enviarWhatsApp() {
    if (guardarEnHistorial && repResumen.trim() && detalleExp) {
      try {
        const { data: { session: s } } = await supabase.auth.getSession()
        await supabase.from('actuaciones').insert({
          expediente_id: detalleExp.id,
          descripcion: `[Reportado al Cliente] ${repResumen.trim()}`,
          fecha: new Date().toISOString().slice(0, 10),
          user_id: s?.user?.id || org.owner_id,
          despacho_id: org.id
        })
        cargarHistorial(detalleExp.id)
      } catch (err) {
        console.error('Error al guardar resumen en actuaciones:', err)
      }
    }

    let finalPhone = repContactoTelefono.replace(/\D/g, '')
    if (finalPhone.length === 10) {
      finalPhone = '52' + finalPhone
    }
    
    const encoded = encodeURIComponent(generarMensajeWhatsApp())
    window.open(`https://api.whatsapp.com/send?phone=${finalPhone}&text=${encoded}`, '_blank')
    setModalReporte(false)
  }

  // Amparos Federales
  async function cargarAmparosFederales(expId) {
    setCargandoAmparos(true); setErrorAmparos(null)
    try {
      const data = await consultarAmparosFederalesGuardados(supabase, expId)
      setAmparos(data)
    } catch (e) {
      setErrorAmparos(e.message)
    } finally {
      setCargandoAmparos(false)
    }
  }

  async function consultarCJFAhora(exp, numAmparo) {
    if (!numAmparo?.trim()) {
      toast('Ingresa el número del amparo', 'error'); return
    }
    setCargandoAmparos(true); setErrorAmparos(null)
    try {
      const { data: { session: s } } = await supabase.auth.getSession()
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/consultar-amparo-cjf`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${s?.access_token}`,
            'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
          },
          body: JSON.stringify({
            num_amparo:    numAmparo.trim(),
            expediente_id: exp.id,
            despacho_id:   org?.id || null,
          }),
        }
      )
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || `Error ${res.status}`)
      if (!json.encontrado) {
        toast(json.mensaje || 'No encontrado en el portal CJF', 'error')
      } else {
        toast(`✅ ${json.total} amparo(s) encontrado(s) y guardado(s)`)
        cargarAmparosFederales(exp.id)
      }
    } catch (e) {
      setErrorAmparos('Error consultando CJF: ' + e.message)
    } finally {
      setCargandoAmparos(false)
    }
  }

  async function handleGuardarAmparo(e) {
    e.preventDefault()
    if (!ampForm.numAmparo.trim()) { toast('Ingresa el número de amparo', 'error'); return }
    if (!ampForm.organo) { toast('Selecciona el órgano jurisdiccional', 'error'); return }
    setSavingAmparo(true)
    try {
      await guardarAmparo(supabase, {
        numAmparo:   ampForm.numAmparo.trim(),
        tipoAsunto:  ampForm.tipoAsunto,
        organo:      ampForm.organo,
        actor:       ampForm.quejoso,
        autoridad:   ampForm.autoridadResponsable,
        ponente:     ampForm.ponente,
        fechaPresent: ampForm.fechaRadicacion || null,
        fechaAcuerdo: ampForm.fechaAcuerdo || null,
        descripcion: [
          ampForm.actoReclamado ? `Acto reclamado: ${ampForm.actoReclamado}` : '',
          ampForm.descripcionAcuerdo,
          ampForm.observaciones ? `Observaciones: ${ampForm.observaciones}` : '',
        ].filter(Boolean).join('\n\n'),
        estado:      ampForm.estado,
        urlFuente:   urlAmparoFederalCJF(ampForm.numAmparo.trim()),
      }, {
        expedienteId: detalleExp.id,
        despachoId:   org?.id,
        userId:       session.user.id,
      })
      toast('Amparo federal guardado')
      setAmpForm({ numAmparo: '', tipoAsunto: 'Amparo Indirecto', materia: '', organo: '', ponente: '', quejoso: '', terceroInteresado: '', ministerioPublico: '', autoridadResponsable: '', actoReclamado: '', estado: '', fechaRadicacion: '', fechaAcuerdo: '', descripcionAcuerdo: '', observaciones: '' })
      cargarAmparosFederales(detalleExp.id)
    } catch (er) {
      toast('Error: ' + er.message, 'error')
    } finally {
      setSavingAmparo(false)
    }
  }

  async function marcarAmparoLeido(id) {
    await supabase.from('amparos_federales').update({ leido: true }).eq('id', id)
    setAmparos(prev => prev.map(a => a.id === id ? { ...a, leido: true } : a))
  }

  async function toggleHistorialAmparo(amparoId) {
    if (amparoExpandido === amparoId) {
      setAmparoExpandido(null)
      return
    }
    setAmparoExpandido(amparoId)
    if (acuerdosAmparo[amparoId]) return
    setCargandoHistorial(amparoId)
    try {
      const data = await cargarAcuerdosAmparo(supabase, amparoId)
      setAcuerdosAmparo(prev => ({ ...prev, [amparoId]: data }))
      if (data.some(a => !a.leido)) {
        await marcarAcuerdosAmparoLeidos(supabase, amparoId)
        setAcuerdosAmparo(prev => ({
          ...prev,
          [amparoId]: (prev[amparoId] || []).map(a => ({ ...a, leido: true }))
        }))
      }
    } catch (e) {
      toast('Error cargando historial: ' + e.message, 'error')
    } finally {
      setCargandoHistorial(null)
    }
  }

  // Consulta masiva y manual CJJ
  async function consultarMasivoCJJ() {
    const conCodigo = expedientes.filter(e => e.estado === 'Activo' && (e.cve_juz || getCjjCode(e.juzgado)))
    if (conCodigo.length === 0) { toast('No hay expedientes activos con código CJJ registrado', 'warning'); return }
    setConsultaMasiva(true)
    setMasivaProg({ total: conCodigo.length, actual: 0, nuevos: 0, texto: 'Iniciando...' })
    let totalNuevos = 0
    for (let i = 0; i < conCodigo.length; i++) {
      const exp = conCodigo[i]
      const cveJuz = exp.cve_juz || getCjjCode(exp.juzgado)
      setMasivaProg(p => ({ ...p, actual: i + 1, texto: `${exp.num} (${exp.juzgado || cveJuz})` }))
      try {
        const dataApi = await consultarBoletinCJJ(exp.num, cveJuz)
        if (dataApi.length > 0) {
          const { data: existentes } = await supabase.from('acuerdos_boletin').select('fecha, descripcion').eq('expediente_id', exp.id)
          const existSet = new Set((existentes || []).map(a => `${a.fecha}|${a.descripcion}`))
          const nuevos = dataApi.filter(a => !existSet.has(`${a.fecha}|${a.descripcion}`))
          if (nuevos.length > 0) {
            await supabase.from('acuerdos_boletin').insert(nuevos.map(a => ({
              expediente_id: exp.id, fecha: a.fecha, descripcion: a.descripcion,
              leido: false, auto_detectado: true, creado_en: new Date().toISOString(),
            })))
            const ultimaFecha = nuevos.map(a => a.fecha).filter(Boolean).sort().reverse()[0]
            await supabase.from('expedientes').update({ nuevo_acuerdo: true, ultimo_movimiento: ultimaFecha }).eq('id', exp.id)
            totalNuevos += nuevos.length
            setMasivaProg(p => ({ ...p, nuevos: p.nuevos + nuevos.length }))
          }
        }
      } catch { /* ignore */ }
    }
    setConsultaMasiva(false)
    await cargar()
    toast(`... Consulta masiva completada — ${totalNuevos} acuerdo(s) nuevo(s) en ${conCodigo.length} expedientes`)
  }

  async function consultarCJJ(exp) {
    const cveJuz = exp.cve_juz || getCjjCode(exp.juzgado)
    if (!cveJuz) {
      setErrorCJJ('Este juzgado no tiene código CJJ registrado. Edita el expediente y selecciona el juzgado de la lista.')
      return
    }
    if (!exp.num) { setErrorCJJ('El expediente no tiene número registrado.'); return }
    setConsultandoCJJ(true); setErrorCJJ(null); setAcuerdosCJJ(null)
    try {
      const data = await consultarBoletinCJJ(exp.num, cveJuz)
      setAcuerdosCJJ(data)
      if (data.length > 0) await guardarAcuerdosCJJ(exp, data)
    } catch (e) {
      setErrorCJJ('Error al consultar el CJJ: ' + e.message)
    } finally {
      setConsultandoCJJ(false)
    }
  }

  async function guardarAcuerdosCJJ(exp, dataApi) {
    const { data: existentes } = await supabase
      .from('acuerdos_boletin').select('fecha, descripcion').eq('expediente_id', exp.id)
    const existSet = new Set((existentes || []).map(a => `${a.fecha}|${a.descripcion}`))
    const nuevos = dataApi.filter(a => !existSet.has(`${a.fecha}|${a.descripcion}`))
    if (nuevos.length === 0) { toast('Sin acuerdos nuevos — todo al día'); return }
    await supabase.from('acuerdos_boletin').insert(
      nuevos.map(a => ({
        expediente_id: exp.id,
        fecha: a.fecha,
        descripcion: a.descripcion,
        leido: false,
        auto_detectado: true,
        creado_en: new Date().toISOString(),
      }))
    )
    const ultimaFecha = nuevos.map(a => a.fecha).sort().reverse()[0]
    await supabase.from('expedientes').update({
      nuevo_acuerdo: true,
      ultimo_movimiento: ultimaFecha,
      actualizado_en: new Date().toISOString(),
    }).eq('id', exp.id)
    setDetalleExp(prev => ({ ...prev, nuevo_acuerdo: true, ultimo_movimiento: ultimaFecha }))
    setExpedientes(prev => prev.map(e =>
      e.id === exp.id ? { ...e, nuevo_acuerdo: true, ultimo_movimiento: ultimaFecha } : e
    ))
    cargarAcuerdos(exp.id)
    toast(`✅ ${nuevos.length} acuerdo(s) nuevo(s) guardados del boletín CJJ`)
  }

  async function guardarActuacion() {
    if (!hForm.descripcion.trim()) return
    setHSaving(true)
    
    const { error } = await supabase.from('actuaciones').insert({
      expediente_id: detalleExp.id,
      descripcion: hForm.descripcion,
      fecha: hForm.fecha || new Date().toISOString().slice(0, 10),
      tipo_actuacion: hForm.tipo_actuacion,
      genera_termino: hForm.genera_termino,
      fecha_vencimiento: hForm.genera_termino ? (hForm.fecha_vencimiento || null) : null,
      responsable: hForm.responsable || null,
      estatus_cumplimiento: hForm.estatus_cumplimiento,
      user_id: session.user.id,
      despacho_id: org?.id || null,
      creado_en: new Date().toISOString(),
    })
    
    setHSaving(false)
    if (error) {
      toast('Error al guardar actuación: ' + error.message, 'error')
      return
    }
    
    // Registrar en bitácora
    if (org?.id) {
      await supabase.from('bitacora_actividad').insert({
        despacho_id: org.id,
        user_id: session.user.id,
        user_email: session.user.email,
        accion: 'crear_actuacion',
        detalles: `Agregó la actuación "${hForm.descripcion}" al expediente ${detalleExp.num}`
      })
    }

    setHForm({
      fecha: new Date().toISOString().slice(0, 10),
      descripcion: '',
      tipo_actuacion: 'Acuerdo',
      genera_termino: false,
      fecha_vencimiento: '',
      responsable: '',
      estatus_cumplimiento: 'Pendiente',
    })
    
    cargarHistorial(detalleExp.id)
  }

  async function toggleCumplimientoActuacion(act) {
    const nuevoEstado = act.estatus_cumplimiento === 'Completada' ? 'Pendiente' : 'Completada'
    const { error } = await supabase.from('actuaciones').update({ estatus_cumplimiento: nuevoEstado }).eq('id', act.id)
    if (error) {
      toast('Error: ' + error.message, 'error')
    } else {
      setHistorial(prev => prev.map(a => a.id === act.id ? { ...a, estatus_cumplimiento: nuevoEstado } : a))
      toast(`Actuación marcada como ${nuevoEstado}`)
    }
  }

  async function eliminarActuacion(id) {
    await supabase.from('actuaciones').delete().eq('id', id)
    
    // Registrar en bitácora
    if (org?.id) {
      await supabase.from('bitacora_actividad').insert({
        despacho_id: org.id,
        user_id: session.user.id,
        user_email: session.user.email,
        accion: 'eliminar_actuacion',
        detalles: `Eliminó una actuación del expediente ${detalleExp.num}`
      })
    }

    cargarHistorial(detalleExp.id)
  }

  async function subirArchivo(file) {
    if (!file) return
    if (file.size > 20 * 1024 * 1024) { alert('Máximo 20 MB'); return }
    setUploading(true)
    const storagePrefix = org?.id || session.user.id
    const path = `${storagePrefix}/${detalleExp.id}/${Date.now()}_${file.name}`
    const { error } = await supabase.storage.from('documentos').upload(path, file)
    if (error) { alert('Error: ' + error.message); setUploading(false); return }
    await supabase.from('documentos').insert({
      expediente_id: detalleExp.id,
      nombre: file.name, path,
      user_id: session.user.id,
      despacho_id: org?.id || null,
      creado_en: new Date().toISOString(),
    })
    
    // Registrar en bitácora
    if (org?.id) {
      await supabase.from('bitacora_actividad').insert({
        despacho_id: org.id,
        user_id: session.user.id,
        user_email: session.user.email,
        accion: 'subir_documento',
        detalles: `Subió el documento "${file.name}" al expediente ${detalleExp.num}`
      })
    }

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
    
    // Registrar en bitácora
    if (org?.id) {
      await supabase.from('bitacora_actividad').insert({
        despacho_id: org.id,
        user_id: session.user.id,
        user_email: session.user.email,
        accion: 'eliminar_documento',
        detalles: `Eliminó el documento "${doc.nombre}" del expediente ${detalleExp.num}`
      })
    }

    cargarArchivos(detalleExp.id)
  }

  async function marcarLeido(acuerdo) {
    setAcuerdosSaving(true)
    await supabase.from('acuerdos_boletin').update({ leido: true }).eq('id', acuerdo.id)
    const sinLeer = acuerdos.filter(a => !a.leido && a.id !== acuerdo.id)
    if (sinLeer.length === 0) {
      await supabase.from('expedientes').update({ nuevo_acuerdo: false }).eq('id', detalleExp.id)
      setDetalleExp(prev => ({ ...prev, nuevo_acuerdo: false }))
      setExpedientes(prev => prev.map(e => e.id === detalleExp.id ? { ...e, nuevo_acuerdo: false } : e))
    }
    setAcuerdos(prev => prev.map(a => a.id === acuerdo.id ? { ...a, leido: true } : a))
    setAcuerdosSaving(false)
  }

  async function toggleAlertaDetalle() {
    const nuevaAlerta = !detalleExp.alertas_boletin
    await supabase.from('expedientes')
      .update({ alertas_boletin: nuevaAlerta, actualizado_en: new Date().toISOString() })
      .eq('id', detalleExp.id)
    setDetalleExp(prev => ({ ...prev, alertas_boletin: nuevaAlerta }))
    setExpedientes(prev => prev.map(e => e.id === detalleExp.id ? { ...e, alertas_boletin: nuevaAlerta } : e))
    toast(nuevaAlerta ? '🔔 Alertas activadas' : '🔕 Alertas desactivadas')
  }

  function exportarCSV() {
    const cab = 'num,anio,partido_judicial,materia,tipo,juzgado,actor,demandado,etapa,estado,abogado_responsable,fecha_inicio,ultimo_acuerdo,notas'
    const filas = lista.map(e => [e.num, e.anio || '', e.partido_judicial || '', e.materia, e.tipo, e.juzgado || '', e.actor, e.demandado, e.etapa, e.estado, e.abogado_responsable || '', e.fecha_inicio || '', (e.ultimo_acuerdo || '').replace(/[\n\r]/g, ' '), (e.notas || '').replace(/[\n\r]/g, ' ')].map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob(['\uFEFF' + cab + '\n' + filas.join('\n')], { type: 'text/csv;charset=utf-8' }))
    a.download = `expedientes_${new Date().toISOString().slice(0, 10)}.csv`; a.click()
  }

  function boletinIndicador(e) {
    const cveJuz = e.cve_juz || getCjjCode(e.juzgado)
    if (!cveJuz) return { icon: '⚫', tip: 'Juzgado foráneo o sin código CJJ' }
    if (e.nuevo_acuerdo) return { icon: '🔴', tip: 'Nuevo acuerdo sin leer — clic para ver' }
    if (e.ultimo_movimiento) {
      const hoy = new Date().toISOString().slice(0, 10)
      if (e.ultimo_movimiento === hoy) return { icon: '🟢', tip: 'Consultado hoy — al día' }
      return { icon: '🟡', tip: `Último cotejo: ${fmtFecha(e.ultimo_movimiento)}` }
    }
    return { icon: '🔵', tip: 'Código CJJ registrado — pendiente primera consulta' }
  }

  return (
    <div style={{ position: 'relative' }}>
      <style>{`
        @keyframes slideInRight {
          from { opacity: 0; transform: translateX(32px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        .filters-row { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 12px; align-items: center; }
        .sub-form { background: var(--surface-3); border: 1px solid var(--border); border-radius: var(--radius); padding: 12px; margin-bottom: 14px; }
      `}</style>

      <PageHeader
        title="Expedientes"
        subtitle="Módulo de gestión de expedientes judiciales del despacho"
        actions={
          <>
            <button onClick={exportarCSV} style={btnSec}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M7 10l5 5 5-5"/><path d="M12 15V3"/>
              </svg>
              Exportar CSV
            </button>
            <button
              onClick={consultarMasivoCJJ}
              disabled={consultaMasiva}
              style={{ ...btnSec, opacity: consultaMasiva ? 0.6 : 1 }}
              title="Consultar el Boletín CJJ de todos los expedientes activos"
            >
              {consultaMasiva
                ? <><span style={{ display: 'inline-block', animation: 'spin 1s linear infinite' }}>⟳</span> Consultando ({masivaProg.actual}/{masivaProg.total})</>
                : <>🔍 Consultar todos CJJ</>}
            </button>
            {canWrite && (
              <button onClick={abrirNuevo} style={btnPri}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 5v14"/><path d="M5 12h14"/>
                </svg>
                Agregar expediente
              </button>
            )}
          </>
        }
      />

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginBottom: 16 }}>
        <StatCard title="Total" value={total} color="var(--primary)"/>
        <StatCard title="Activos" value={activos} color="var(--success)"/>
        <StatCard title="Urgentes" value={urgentes} subtitle="≤3 días" color="var(--warning)"/>
        <StatCard title="Vencidos" value={vencidos} color="var(--danger)"/>
      </div>

      {/* Layout principal: tabla + drawer lateral */}
      <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>

        {/* Columna izquierda: filtros + tabla */}
        <div style={{ flex: 1, minWidth: 0 }}>

          {/* Fila de Filtros Avanzados */}
          <div className="filters-row" style={{
            background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: 'var(--radius-lg)', padding: 10,
          }}>
            <div style={{ position: 'relative', minWidth: 160, flex: 1 }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                   style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}>
                <circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>
              </svg>
              <input
                value={buscar} onChange={e => setBuscar(e.target.value)}
                placeholder="Buscar por num, actor, demandado, abogado..."
                style={{ ...inputStyle, paddingLeft: 30, width: '100%' }}
              />
            </div>
            
            <select value={filtros.materia} onChange={e => setFiltros(f => ({ ...f, materia: e.target.value }))} style={{ ...inputStyle, width: 'auto' }}>
              <option value="">Todas las materias</option>
              {MATERIAS.map(m => <option key={m} value={m}>{m}</option>)}
            </select>

            <select value={filtros.juzgado} onChange={e => setFiltros(f => ({ ...f, juzgado: e.target.value }))} style={{ ...inputStyle, width: 'auto' }}>
              <option value="">Todos los juzgados</option>
              {juzgadosExistentes.map(j => <option key={j} value={j}>{j}</option>)}
            </select>

            <select value={filtros.tipo} onChange={e => setFiltros(f => ({ ...f, tipo: e.target.value }))} style={{ ...inputStyle, width: 'auto' }}>
              <option value="">Todos los juicios</option>
              {tiposJuicioExistentes.map(t => <option key={t} value={t}>{t}</option>)}
            </select>

            <select value={filtros.etapa} onChange={e => setFiltros(f => ({ ...f, etapa: e.target.value }))} style={{ ...inputStyle, width: 'auto' }}>
              <option value="">Todas las etapas</option>
              {ETAPAS.map(et => <option key={et} value={et}>{et}</option>)}
            </select>

            <select value={filtros.responsable} onChange={e => setFiltros(f => ({ ...f, responsable: e.target.value }))} style={{ ...inputStyle, width: 'auto' }}>
              <option value="">Todos los responsables</option>
              {responsablesExistentes.map(r => <option key={r} value={r}>{r}</option>)}
            </select>

            <select value={filtros.estado} onChange={e => setFiltros(f => ({ ...f, estado: e.target.value }))} style={{ ...inputStyle, width: 'auto' }}>
              <option value="">Todos los estatus</option>
              <option value="Activo">Activos</option>
              <option value="Concluido">Concluidos</option>
              <option value="Suspendido">Suspendidos</option>
            </select>

            {(filtros.materia || filtros.juzgado || filtros.tipo || filtros.etapa || filtros.responsable || filtros.estado) && (
              <button
                onClick={() => setFiltros({ materia: '', juzgado: '', tipo: '', etapa: '', responsable: '', estado: '' })}
                style={{ ...btnSec, color: 'var(--danger)', borderColor: 'var(--danger)', fontSize: 11, padding: '8px 10px' }}
              >
                Limpiar
              </button>
            )}
          </div>

          {/* Tabla de Expedientes */}
          <div style={{ overflowX: 'auto', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', marginTop: 10 }}>
            <table className="lx-table" style={{ border: 'none', borderRadius: 0 }}>
              <thead>
                <tr>
                  <th style={{ width: 24, padding: '10px 8px' }}></th>
                  <th>Expediente</th>
                  <th>Partes</th>
                  {!detalleExp && <th>Juzgado / Partido</th>}
                  {!detalleExp && <th>Tipo de juicio</th>}
                  {!detalleExp && <th>Etapa actual</th>}
                  {!detalleExp && <th>Último movimiento</th>}
                  <th>Próxima fecha</th>
                  {!detalleExp && <th>Responsable</th>}
                  <th>Estatus</th>
                  <th style={{ width: 70 }}></th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr><td colSpan={detalleExp ? 6 : 11} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>Cargando...</td></tr>
                )}
                {!loading && lista.length === 0 && (
                  <tr><td colSpan={detalleExp ? 6 : 11} style={{ padding: 40 }}>
                    <EmptyState
                      title="Sin expedientes"
                      subtitle={total === 0 ? 'Crea tu primer expediente para empezar.' : 'No hay resultados con esos filtros.'}
                      action={total === 0 && <button onClick={abrirNuevo} style={btnPri}>+ Agregar expediente</button>}
                    />
                  </td></tr>
                )}
                {!loading && lista.map(e => {
                  const d = diasHasta(e.proxima_fecha || e.termino)
                  const u = urgencyColor(d)
                  const bol = boletinIndicador(e)
                  const isSelected = detalleExp?.id === e.id
                  return (
                    <tr
                      key={e.id}
                      onClick={() => abrirDetalle(e)}
                      style={{
                        cursor: 'pointer',
                        background: isSelected ? 'color-mix(in srgb, var(--primary) 8%, var(--surface))' : undefined,
                        borderLeft: isSelected ? '3px solid var(--primary)' : '3px solid transparent',
                        transition: 'background .15s',
                      }}
                    >
                      <td style={{ textAlign: 'center', padding: '8px 6px', fontSize: 13 }} title={bol.tip}>
                        {bol.icon}
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ color: 'var(--primary)', fontWeight: 700, fontSize: 13 }}>{e.num}</span>
                          {e.nuevo_acuerdo && (
                            <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 999, background: 'var(--danger)', color: '#fff' }}>NUEVO</span>
                          )}
                        </div>
                        <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Año: {e.anio || '—'}</div>
                      </td>
                      <td>
                        <div style={{ fontSize: 13, color: 'var(--text)', fontWeight: 500 }}>{e.actor}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>vs. {e.demandado}</div>
                      </td>
                      {!detalleExp && <td>
                        <div style={{ fontSize: 12, color: 'var(--text)', fontWeight: 500, maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={e.juzgado}>
                          {e.juzgado ? e.juzgado.replace(/^Juzgado /i, '') : '—'}
                        </div>
                        <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{e.partido_judicial || '—'}</div>
                      </td>}
                      {!detalleExp && <td style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{e.tipo || '—'}</td>}
                      {!detalleExp && <td><StatusBadge tone="primary" dot={false}>{e.etapa}</StatusBadge></td>}
                      
                      {!detalleExp && <td style={{ fontSize: 12, color: 'var(--text-secondary)', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {e.ultimo_acuerdo ? (
                          <div>
                            <div style={{ fontWeight: 500 }} title={e.ultimo_acuerdo}>{e.ultimo_acuerdo}</div>
                            {e.ultimo_movimiento && <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{fmtFecha(e.ultimo_movimiento)}</div>}
                          </div>
                        ) : e.ultimo_movimiento ? (
                          <div style={{ fontStyle: 'italic' }}>Acuerdo: {fmtFecha(e.ultimo_movimiento)}</div>
                        ) : '—'}
                      </td>}

                      <td>
                        {(e.proxima_fecha || e.termino) ? (
                          <div>
                            <div style={{ fontSize: 12, color: 'var(--text)', fontWeight: 600 }}>{fmtFecha(e.proxima_fecha || e.termino)}</div>
                            <div style={{ display: 'inline-block', marginTop: 2, background: u.bg, color: u.color, padding: '1px 7px', borderRadius: 999, fontSize: 10, fontWeight: 700 }}>{u.label}</div>
                          </div>
                        ) : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                      </td>
                      {!detalleExp && <td style={{ fontSize: 12, color: 'var(--text)' }}>{e.abogado_responsable || '—'}</td>}
                      <td><StatusBadge>{e.estado}</StatusBadge></td>
                      <td onClick={ev => ev.stopPropagation()}>
                        {canWrite && (
                          <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                            <button onClick={() => abrirEditar(e)} style={iconActionBtn} title="Editar">
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                                <path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                              </svg>
                            </button>
                            <button onClick={() => eliminar(e.id, e.num)} style={{ ...iconActionBtn, color: 'var(--danger)' }} title="Eliminar">
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                              </svg>
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── Drawer lateral: detalle del expediente ── */}
        {detalleExp && (
          <div style={{
            width: 520, minWidth: 320, flexShrink: 0,
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-lg)',
            display: 'flex', flexDirection: 'column',
            height: 'calc(100vh - 180px)',
            position: 'sticky', top: 16,
            overflow: 'hidden',
            animation: 'slideInRight .2s cubic-bezier(.4,0,.2,1)',
          }}>
            {/* Header del drawer */}
            <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 17, fontWeight: 800, color: 'var(--primary)' }}>{detalleExp.num}</span>
                    {detalleExp.nuevo_acuerdo && (
                      <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 999, background: 'var(--danger)', color: '#fff' }}>NUEVO ACUERDO</span>
                    )}
                    <StatusBadge>{detalleExp.estado}</StatusBadge>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {detalleExp.actor} <span style={{ opacity: .5 }}>vs.</span> {detalleExp.demandado}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                    {detalleExp.juzgado || '—'} · {detalleExp.materia}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                  {canWrite && (
                    <button onClick={() => abrirEditar(detalleExp)} style={{ ...btnSec, padding: '5px 10px', fontSize: 12 }}>✏️ Editar</button>
                  )}
                  <button onClick={() => setDetalleExp(null)} style={{ ...iconActionBtn, padding: '5px 8px', fontSize: 14 }}>✕</button>
                </div>
              </div>

              {/* Pestañas del Drawer scrollables */}
              <div style={{ display: 'flex', gap: 2, marginTop: 12, background: 'var(--surface-3)', borderRadius: 'var(--radius)', padding: 3, overflowX: 'auto' }}>
                {[
                  ['info', '📋 Info'],
                  ['partes', '👥 Partes'],
                  ['historial', '📝 Actuaciones'],
                  ['terminos', '⏳ Términos'],
                  ['audiencias', '📅 Audiencias'],
                  ['archivos', '📎 Docs'],
                  ['boletin', '🔔 Boletín'],
                  ['fuentes', '🔗 Fuentes Ext.'],
                  ['observaciones', '👁️ Obs.'],
                  ['amparo', '⚖️ Amparos'],
                  ['cobranza', '💰 Cobranza']
                ].map(([k, lbl]) => (
                  <button key={k} onClick={() => setTabDetalle(k)} style={{
                    border: 'none', cursor: 'pointer', flexShrink: 0,
                    background: tabDetalle === k ? 'var(--surface)' : 'transparent',
                    color: tabDetalle === k ? 'var(--primary)' : 'var(--text-secondary)',
                    fontWeight: tabDetalle === k ? 700 : 500,
                    padding: '6px 10px', borderRadius: 'calc(var(--radius) - 2px)',
                    fontSize: 11, boxShadow: tabDetalle === k ? '0 1px 3px rgba(0,0,0,.1)' : 'none',
                    whiteSpace: 'nowrap',
                  }}>{lbl}</button>
                ))}
              </div>
            </div>

            {/* Contenido de la pestaña */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '14px 18px' }}>

              {/* 1. Tab Info */}
              {tabDetalle === 'info' && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
                  {[
                    ['Número Expediente', detalleExp.num],
                    ['Año', detalleExp.anio || '—'],
                    ['Materia', detalleExp.materia],
                    ['Tipo de juicio', detalleExp.tipo],
                    ['Juzgado', detalleExp.juzgado || '—'],
                    ['Partido Judicial', detalleExp.partido_judicial || '—'],
                    ['Parte Actora', detalleExp.actor],
                    ['Parte Demandada', detalleExp.demandado],
                    ['Abogado Responsable', detalleExp.abogado_responsable || '—'],
                    ['Etapa procesal', detalleExp.etapa],
                    ['Estado de trámite', detalleExp.estado],
                    ['Fecha Inicio', fmtFecha(detalleExp.fecha_inicio)],
                    ['Código CJJ', detalleExp.cve_juz || getCjjCode(detalleExp.juzgado) || '—'],
                    ['Último cotejo boletín', fmtFecha(detalleExp.ultimo_movimiento)],
                    ['Próxima Fecha Importante', fmtFecha(detalleExp.proxima_fecha)],
                    ['Término / Plazo Alerta', fmtFecha(detalleExp.termino)],
                  ].map(([k, v]) => (
                    <div key={k} style={{ background: 'var(--surface-3)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '9px 12px' }}>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.5px', fontWeight: 700, marginBottom: 3 }}>{k}</div>
                      <div style={{ fontSize: 13, color: 'var(--text)', fontWeight: 500 }}>{v}</div>
                    </div>
                  ))}
                  {detalleExp.ultimo_acuerdo && (
                    <div style={{ gridColumn: '1 / -1', background: 'var(--surface-3)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '9px 12px' }}>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.5px', fontWeight: 700, marginBottom: 3 }}>Último Acuerdo Dictado</div>
                      <div style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.5 }}>{detalleExp.ultimo_acuerdo}</div>
                    </div>
                  )}
                </div>
              )}

              {/* 2. Tab Partes Procesales (Nuevo) */}
              {tabDetalle === 'partes' && (
                <div>
                  {canWrite && (
                    <div className="sub-form">
                      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text)', textTransform: 'uppercase', letterSpacing: '.4px', marginBottom: 8 }}>👥 Agregar parte del caso</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 8 }}>
                          <input style={inputStyle} value={pForm.nombre} onChange={e => setPForm({ ...pForm, nombre: e.target.value })} placeholder="Nombre completo o Razón Social *"/>
                          <select style={inputStyle} value={pForm.rol} onChange={e => setPForm({ ...pForm, rol: e.target.value })}>
                            <option value="Actor">Actor</option>
                            <option value="Demandado">Demandado</option>
                            <option value="Tercero">Tercero</option>
                            <option value="Apoderado">Apoderado</option>
                            <option value="Autorizado">Autorizado</option>
                          </select>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                          <input style={inputStyle} value={pForm.telefono} onChange={e => setPForm({ ...pForm, telefono: e.target.value })} placeholder="Teléfono"/>
                          <input style={inputStyle} type="email" value={pForm.correo} onChange={e => setPForm({ ...pForm, correo: e.target.value })} placeholder="Correo electrónico"/>
                        </div>
                        <input style={inputStyle} value={pForm.domicilio} onChange={e => setPForm({ ...pForm, domicilio: e.target.value })} placeholder="Domicilio procesal o particular"/>
                        <input style={inputStyle} value={pForm.observaciones} onChange={e => setPForm({ ...pForm, observaciones: e.target.value })} placeholder="Observaciones (ej. representante legal de...)"/>
                        <button onClick={guardarParte} disabled={pSaving} style={{ ...btnPri, padding: '7px', justifyContent: 'center', fontSize: 12 }}>
                          {pSaving ? 'Agregando...' : '+ Guardar parte'}
                        </button>
                      </div>
                    </div>
                  )}

                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 8 }}>Partes registradas ({partes.length})</div>
                  {cargandoPartes ? (
                    <DrawerSkeleton rows={2} />
                  ) : partes.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: 20, color: 'var(--text-muted)', fontSize: 12, fontStyle: 'italic' }}>Sin partes adicionales registradas.</div>
                  ) : (
                    partes.map(p => (
                      <div key={p.id} style={{ background: 'var(--surface-3)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '10px 12px', marginBottom: 6 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <strong style={{ fontSize: 13, color: 'var(--text)' }}>{p.nombre}</strong>
                          <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 999, background: p.rol === 'Actor' ? 'rgba(34,197,94,.12)' : p.rol === 'Demandado' ? 'rgba(239,68,68,.12)' : 'var(--surface-2)', color: p.rol === 'Actor' ? 'var(--success)' : p.rol === 'Demandado' ? 'var(--danger)' : 'var(--text-secondary)' }}>{p.rol}</span>
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                          {p.telefono && <span>📞 {p.telefono}  </span>}
                          {p.correo && <span>✉️ {p.correo}</span>}
                        </div>
                        {p.domicilio && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>📍 {p.domicilio}</div>}
                        {p.observaciones && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3, fontStyle: 'italic' }}>⚠️ {p.observaciones}</div>}
                        
                        {canWrite && (
                          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 6 }}>
                            <button onClick={() => eliminarParte(p.id)} style={{ background: 'none', border: 'none', color: 'var(--danger)', fontSize: 11, cursor: 'pointer', fontWeight: 600 }}>Eliminar</button>
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* 3. Tab Actuaciones */}
              {tabDetalle === 'historial' && (
                <div>
                  {canWrite && (
                    <div className="sub-form">
                      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text)', textTransform: 'uppercase', letterSpacing: '.4px', marginBottom: 8 }}>📝 Registrar actuación manualmente</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: 8 }}>
                          <input type="date" style={inputStyle} value={hForm.fecha} onChange={e => setHForm({ ...hForm, fecha: e.target.value })}/>
                          <select style={inputStyle} value={hForm.tipo_actuacion} onChange={e => setHForm({ ...hForm, tipo_actuacion: e.target.value })}>
                            <option value="Acuerdo">Acuerdo del tribunal</option>
                            <option value="Resolución">Resolución judicial</option>
                            <option value="Notificación">Notificación</option>
                            <option value="Diligencia">Diligencia / Actuario</option>
                            <option value="Escrito">Presentación de escrito</option>
                            <option value="Otro">Otro</option>
                          </select>
                        </div>
                        
                        <input style={inputStyle} value={hForm.descripcion} onChange={e => setHForm({ ...hForm, descripcion: e.target.value })} placeholder="Descripción (ej. se admiten pruebas de la actora) *" required/>
                        
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, margin: '4px 0' }}>
                          <input type="checkbox" id="gen_term" checked={hForm.genera_termino} onChange={e => setHForm({ ...hForm, genera_termino: e.target.checked })} style={{ cursor: 'pointer' }}/>
                          <label htmlFor="gen_term" style={{ fontSize: 12, color: 'var(--text)', cursor: 'pointer', fontWeight: 600 }}>¿Genera término / plazo límite?</label>
                        </div>

                        {hForm.genera_termino && (
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, background: 'var(--surface-2)', padding: 8, borderRadius: 4 }}>
                            <div>
                              <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)' }}>Fecha vencimiento</div>
                              <input type="date" style={{ ...inputStyle, marginTop: 4 }} value={hForm.fecha_vencimiento} onChange={e => setHForm({ ...hForm, fecha_vencimiento: e.target.value })}/>
                            </div>
                            <div>
                              <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)' }}>Estatus de término</div>
                              <select style={{ ...inputStyle, marginTop: 4 }} value={hForm.estatus_cumplimiento} onChange={e => setHForm({ ...hForm, estatus_cumplimiento: e.target.value })}>
                                <option value="Pendiente">Pendiente</option>
                                <option value="Completada">Completada</option>
                              </select>
                            </div>
                          </div>
                        )}

                        <Field label="Responsable asignado">
                          <select style={inputStyle} value={hForm.responsable} onChange={e => setHForm({ ...hForm, responsable: e.target.value })}>
                            <option value="">— Sin asignar —</option>
                            {abogados.map(m => (
                              <option key={m.user_id} value={m.user_profiles?.nombre || m.user_id}>
                                {m.user_profiles?.nombre || m.user_profiles?.email}
                              </option>
                            ))}
                          </select>
                        </Field>

                        <button onClick={guardarActuacion} disabled={hSaving} style={{ ...btnPri, padding: '8px', justifyContent: 'center', fontSize: 12 }}>
                          {hSaving ? 'Guardando...' : '+ Guardar actuación'}
                        </button>
                      </div>
                    </div>
                  )}

                  {cargandoActuaciones ? (
                    <DrawerSkeleton rows={3} />
                  ) : historial.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: 24, color: 'var(--text-muted)', fontSize: 13 }}>Sin actuaciones registradas.</div>
                  ) : (
                    historial.map(a => (
                      <div key={a.id} style={{ padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                          <span style={{ fontSize: 11, color: 'var(--text-muted)', minWidth: 80, fontWeight: 600, marginTop: 2 }}>{fmtFecha(a.fecha)}</span>
                          
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 13, color: 'var(--text)', fontWeight: 500 }}>{a.descripcion}</div>
                            
                            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
                              <span style={{ fontSize: 9, background: 'var(--surface-3)', border: '1px solid var(--border)', borderRadius: 4, padding: '1px 5px', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 700 }}>
                                {a.tipo_actuacion || 'Actuación'}
                              </span>
                              
                              {a.genera_termino && (
                                <button
                                  onClick={() => toggleCumplimientoActuacion(a)}
                                  style={{
                                    border: 'none', borderRadius: 4, padding: '1px 7px', fontSize: 10, fontWeight: 700, cursor: 'pointer',
                                    background: a.estatus_cumplimiento === 'Completada' ? 'rgba(34,197,94,.12)' : 'rgba(239,68,68,.12)',
                                    color: a.estatus_cumplimiento === 'Completada' ? 'var(--success)' : 'var(--danger)',
                                  }}
                                  title="Haz clic para cambiar estatus"
                                >
                                  ⏳ Término: {fmtFecha(a.fecha_vencimiento)} ({a.estatus_cumplimiento === 'Completada' ? 'COMPLETO ✓' : 'PENDIENTE ⚡'})
                                </button>
                              )}
                              
                              {a.responsable && (
                                <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>👤 Resp: {a.responsable}</span>
                              )}
                            </div>
                          </div>

                          <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                            {canWrite && (
                              <button
                                onClick={() => abrirReporteModal(a.fecha, a.descripcion)}
                                style={{ background: 'var(--surface-3)', border: '1px solid var(--border)', color: 'var(--text-secondary)', borderRadius: 'var(--radius-sm)', padding: '4px 6px', cursor: 'pointer', fontSize: 11 }}
                                title="Reportar al cliente por WhatsApp"
                              >
                                📱
                              </button>
                            )}
                            {canWrite && (
                              <button onClick={() => eliminarActuacion(a.id)} style={{ ...iconActionBtn, color: 'var(--danger)', padding: '4px 6px' }}>×</button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* 4. Tab Términos / Vencimientos (Nuevo) */}
              {tabDetalle === 'terminos' && (
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 10 }}>Plazos procesales pendientes</div>
                  {historial.filter(a => a.genera_termino).length === 0 ? (
                    <div style={{ textAlign: 'center', padding: 24, color: 'var(--text-muted)', fontSize: 12, fontStyle: 'italic' }}>No hay plazos o términos configurados para este expediente.</div>
                  ) : (
                    historial.filter(a => a.genera_termino).map(a => {
                      const d = diasHasta(a.fecha_vencimiento)
                      const u = urgencyColor(d)
                      return (
                        <div key={a.id} style={{
                          background: 'var(--surface-3)', border: '1px solid var(--border)',
                          borderRadius: 'var(--radius)', padding: '12px 14px', marginBottom: 8,
                          borderLeft: `4px solid ${a.estatus_cumplimiento === 'Completada' ? 'var(--success)' : u.color}`
                        }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <strong style={{ fontSize: 13, color: 'var(--text)' }}>{a.descripcion}</strong>
                            <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 999, background: a.estatus_cumplimiento === 'Completada' ? 'rgba(34,197,94,.12)' : u.bg, color: a.estatus_cumplimiento === 'Completada' ? 'var(--success)' : u.color }}>
                              {a.estatus_cumplimiento === 'Completada' ? 'Completado' : u.label}
                            </span>
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6, display: 'flex', justifyContent: 'space-between' }}>
                            <span>📅 Límite: {fmtFecha(a.fecha_vencimiento)}</span>
                            {a.responsable && <span>👤 Responsable: {a.responsable}</span>}
                          </div>
                          {canWrite && a.estatus_cumplimiento !== 'Completada' && (
                            <button
                              onClick={() => toggleCumplimientoActuacion(a)}
                              style={{ ...btnPri, padding: '4px 10px', fontSize: 11, marginTop: 8, background: 'var(--success)', color: '#fff', width: '100%', justifyContent: 'center' }}
                            >
                              ✓ Marcar como cumplido
                            </button>
                          )}
                        </div>
                      )
                    })
                  )}
                </div>
              )}

              {/* 5. Tab Audiencias (Nuevo) */}
              {tabDetalle === 'audiencias' && (
                <div>
                  {canWrite && (
                    <div className="sub-form">
                      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text)', textTransform: 'uppercase', letterSpacing: '.4px', marginBottom: 8 }}>📅 Programar nueva audiencia</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        <input style={inputStyle} value={audForm.titulo} onChange={e => setAudForm({ ...audForm, titulo: e.target.value })} placeholder="Título (ej. Audiencia Constitucional, Incidental, etc.) *" required/>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 8 }}>
                          <div>
                            <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 3 }}>Fecha y Hora *</div>
                            <input type="datetime-local" style={inputStyle} value={audForm.fecha_hora} onChange={e => setAudForm({ ...audForm, fecha_hora: e.target.value })} required/>
                          </div>
                        </div>
                        <input style={inputStyle} value={audForm.lugar} onChange={e => setAudForm({ ...audForm, lugar: e.target.value })} placeholder="Lugar (ej. Sala 3 del Juzgado Mercantil)"/>
                        <textarea style={{ ...inputStyle, minHeight: 40, resize: 'vertical' }} value={audForm.observaciones} onChange={e => setAudForm({ ...audForm, observaciones: e.target.value })} placeholder="Observaciones preliminares..."/>
                        
                        <button onClick={guardarAudiencia} disabled={audSaving} style={{ ...btnPri, padding: '8px', justifyContent: 'center', fontSize: 12 }}>
                          {audSaving ? 'Guardando...' : '+ Guardar audiencia'}
                        </button>
                      </div>
                    </div>
                  )}

                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 8 }}>Audiencias programadas ({audiencias.length})</div>
                  {cargandoAudiencias ? (
                    <DrawerSkeleton rows={2} />
                  ) : audiencias.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: 20, color: 'var(--text-muted)', fontSize: 12, fontStyle: 'italic' }}>Sin audiencias próximas o registradas.</div>
                  ) : (
                    audiencias.map(a => {
                      const fecLimpia = new Date(a.fecha_hora)
                      const pas = fecLimpia < new Date()
                      return (
                        <div key={a.id} style={{
                          background: 'var(--surface-3)', border: '1px solid var(--border)',
                          borderRadius: 'var(--radius)', padding: '10px 12px', marginBottom: 6,
                          borderLeft: `4px solid ${pas ? 'var(--text-muted)' : 'var(--primary)'}`
                        }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <strong style={{ fontSize: 13, color: 'var(--text)' }}>{a.titulo}</strong>
                            <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 999, background: pas ? 'var(--surface-2)' : 'rgba(37,99,235,.12)', color: pas ? 'var(--text-muted)' : 'var(--primary)' }}>
                              {pas ? 'Pasada' : 'Próxima'}
                            </span>
                          </div>
                          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4, fontWeight: 600 }}>
                            📅 {fecLimpia.toLocaleDateString('es-MX')} a las {fecLimpia.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })} hrs
                          </div>
                          {a.lugar && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>📍 Lugar: {a.lugar}</div>}
                          {a.observaciones && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3, fontStyle: 'italic' }}>📝 {a.observaciones}</div>}
                          
                          {canWrite && (
                            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 6 }}>
                              <button onClick={() => eliminarAudiencia(a.id)} style={{ background: 'none', border: 'none', color: 'var(--danger)', fontSize: 11, cursor: 'pointer', fontWeight: 600 }}>Eliminar</button>
                            </div>
                          )}
                        </div>
                      )
                    })
                  )}
                </div>
              )}

              {/* 6. Tab Archivos */}
              {tabDetalle === 'archivos' && (
                <div>
                  {canWrite && (
                    <label style={{
                      display: 'block', background: 'var(--surface-3)', border: '2px dashed var(--border)',
                      borderRadius: 'var(--radius)', padding: 18, textAlign: 'center',
                      cursor: uploading ? 'not-allowed' : 'pointer', marginBottom: 12,
                      color: uploading ? 'var(--text-muted)' : 'var(--primary)', fontSize: 13, fontWeight: 500,
                    }}>
                      {uploading ? 'Subiendo...' : '+ Clic o arrastra para subir (máx. 20 MB)'}
                      <input type="file" style={{ display: 'none' }} disabled={uploading} onChange={e => { subirArchivo(e.target.files[0]); e.target.value = '' }}/>
                    </label>
                  )}
                  {cargandoArchivos ? (
                    <DrawerSkeleton rows={3} />
                  ) : archivos.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: 20, color: 'var(--text-muted)', fontSize: 13 }}>Sin archivos adjuntos.</div>
                  ) : (
                    archivos.map(a => (
                      <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 0', borderBottom: '1px solid var(--border)' }}>
                        <span style={{ fontSize: 13, color: 'var(--text)', flex: 1, wordBreak: 'break-all' }}>{a.nombre}</span>
                        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{fmtFecha(a.creado_en?.slice(0, 10))}</span>
                        <button onClick={() => descargarArchivo(a)} style={iconActionBtn} title="Abrir">
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 3h7v7"/><path d="M10 14L21 3"/><path d="M21 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5"/></svg>
                        </button>
                        {canWrite && (
                          <button onClick={() => eliminarArchivo(a)} style={{ ...iconActionBtn, color: 'var(--danger)', padding: '3px 7px' }}>×</button>
                        )}
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* 7. Tab Boletín CJJ */}
              {tabDetalle === 'boletin' && (
                <div>
                  <div style={{
                    background: 'var(--surface-3)', border: '1px solid var(--border)',
                    borderRadius: 'var(--radius)', padding: '11px 14px', marginBottom: 12,
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
                  }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>Alertas de Boletín Judicial</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                        {detalleExp.alertas_boletin
                          ? `Activas → ${detalleExp.email_notificacion || 'email del usuario'}`
                          : 'Alertas desactivadas para este expediente'}
                      </div>
                      {(detalleExp.cve_juz || getCjjCode(detalleExp.juzgado)) && (
                        <div style={{ fontSize: 10, color: 'var(--primary)', marginTop: 4, fontWeight: 600 }}>
                          🔑 Código CJJ: {detalleExp.cve_juz || getCjjCode(detalleExp.juzgado)}
                          {' · '}
                          <a href="https://cjj.gob.mx/bulletin" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary)' }}>
                            Ver boletín oficial ↗
                          </a>
                        </div>
                      )}
                    </div>
                    {canWrite && (
                      <div
                        onClick={toggleAlertaDetalle}
                        style={{
                          width: 38, height: 21, borderRadius: 999, flexShrink: 0,
                          background: detalleExp.alertas_boletin ? 'var(--primary)' : 'var(--border)',
                          position: 'relative', transition: 'background .2s', cursor: 'pointer',
                        }}
                      >
                        <div style={{
                          position: 'absolute', top: 3, left: detalleExp.alertas_boletin ? 19 : 3,
                          width: 15, height: 15, borderRadius: '50%', background: '#fff',
                          transition: 'left .2s', boxShadow: '0 1px 3px rgba(0,0,0,.2)',
                        }}/>
                      </div>
                    )}
                  </div>

                  <div style={{ marginBottom: 14 }}>
                    {canWrite && (
                      <button
                        onClick={() => consultarCJJ(detalleExp)}
                        disabled={consultandoCJJ}
                        style={{ ...btnPri, width: '100%', justifyContent: 'center', opacity: consultandoCJJ ? 0.7 : 1 }}
                      >
                        {consultandoCJJ
                          ? <><span style={{ display: 'inline-block', animation: 'spin 1s linear infinite' }}>⟳</span> Consultando CJJ Jalisco...</>
                          : <>🔍 Consultar Boletín CJJ Jalisco ahora</>
                        }
                      </button>
                    )}
                    {errorCJJ && (
                      <div style={{ marginTop: 8, padding: '8px 12px', background: 'var(--danger-bg)', color: 'var(--danger-text)', borderRadius: 'var(--radius)', fontSize: 12 }}>
                        ⚠️ {errorCJJ}
                      </div>
                    )}
                    {acuerdosCJJ !== null && (
                      <div style={{ marginTop: 8, padding: '6px 12px', background: 'var(--success-bg)', color: 'var(--success-text)', borderRadius: 'var(--radius)', fontSize: 12, fontWeight: 600 }}>
                        ✅ {acuerdosCJJ.length} acuerdo(s) encontrado(s) en el boletín CJJ
                      </div>
                    )}
                  </div>

                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 8 }}>
                    Acuerdos guardados ({acuerdos.length})
                  </div>

                  {cargandoAcuerdos ? (
                    <DrawerSkeleton rows={3} />
                  ) : acuerdos.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '24px 14px', color: 'var(--text-muted)', fontSize: 13, background: 'var(--surface-3)', border: '1px dashed var(--border)', borderRadius: 'var(--radius)' }}>
                      <div style={{ fontSize: 26, marginBottom: 8 }}>📭</div>
                      <div style={{ fontWeight: 600 }}>Sin acuerdos guardados</div>
                      <div style={{ fontSize: 11, marginTop: 4 }}>Presiona "Consultar CJJ" para cargar el historial completo.</div>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {acuerdos.map(a => (
                        <div key={a.id} style={{
                          background: a.leido ? 'var(--surface-3)' : 'var(--surface)',
                          border: `1px solid ${a.leido ? 'var(--border)' : 'var(--primary)'}`,
                          borderRadius: 'var(--radius)', padding: '10px 12px',
                        }}>
                          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                            <div style={{ flex: 1 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap', marginBottom: 5 }}>
                                <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)' }}>📅 {fmtFecha(a.fecha)}</span>
                                {a.auto_detectado && (
                                  <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 999, background: 'var(--primary)', color: '#fff' }}>🤖 Auto</span>
                                )}
                                {a.leido
                                  ? <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>✓ Leído</span>
                                  : <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 999, background: 'var(--warning-bg)', color: 'var(--warning-text)' }}>● Nuevo</span>
                                }
                              </div>
                              <div style={{ fontSize: 12, color: 'var(--text)', lineHeight: 1.6 }}>{a.descripcion}</div>
                            </div>
                            <div style={{ display: 'flex', gap: 6, flexShrink: 0, marginTop: 4 }}>
                              {canWrite && (
                                <button
                                  onClick={() => abrirReporteModal(a.fecha, a.descripcion)}
                                  style={{
                                    ...btnSec,
                                    fontSize: 11,
                                    padding: '4px 9px',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 4
                                  }}
                                  title="Reportar al cliente por WhatsApp"
                                >
                                  📱 Reportar
                                </button>
                              )}
                              {canWrite && !a.leido && (
                                <button
                                  onClick={() => marcarLeido(a)}
                                  disabled={acuerdosSaving}
                                  style={{ ...btnSec, fontSize: 11, padding: '4px 9px', whiteSpace: 'nowrap' }}
                                >
                                  ✓ Leído
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* 8. Tab Fuentes Externas / Enlaces Oficiales (Nuevo) */}
              {tabDetalle === 'fuentes' && (
                <div>
                  {canWrite && (
                    <div className="sub-form">
                      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text)', textTransform: 'uppercase', letterSpacing: '.4px', marginBottom: 8 }}>🔗 Registrar Consulta Judicial Externa</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                          <select style={inputStyle} value={fExtForm.nombre} onChange={e => setFExtForm({ ...fExtForm, nombre: e.target.value })}>
                            <option value="Boletín Judicial Jalisco">Boletín Judicial Jalisco</option>
                            <option value="Consulta de Expedientes del Poder Judicial de Jalisco">Poder Judicial de Jalisco</option>
                            <option value="CJF / Amparos Tercer Circuito">CJF / Amparos Tercer Circuito</option>
                            <option value="Lista de acuerdos CJF">Lista de acuerdos CJF</option>
                            <option value="Expediente CJF">Expediente CJF</option>
                            <option value="Otro enlace oficial">Otro portal oficial</option>
                          </select>
                          <select style={inputStyle} value={fExtForm.tipo} onChange={e => setFExtForm({ ...fExtForm, tipo: e.target.value })}>
                            <option value="Boletín">Boletín Oficial</option>
                            <option value="Poder Judicial">Poder Judicial</option>
                            <option value="CJF">CJF / Amparo</option>
                            <option value="Otro">Otro</option>
                          </select>
                        </div>
                        
                        <input style={inputStyle} value={fExtForm.url} onChange={e => setFExtForm({ ...fExtForm, url: e.target.value })} placeholder="URL oficial (ej: https://cjj.gob.mx/...) *" required/>
                        
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                          <input style={inputStyle} value={fExtForm.num_externo} onChange={e => setFExtForm({ ...fExtForm, num_externo: e.target.value })} placeholder="Expediente externo / amparo"/>
                          <input style={inputStyle} value={fExtForm.organo} onChange={e => setFExtForm({ ...fExtForm, organo: e.target.value })} placeholder="Órgano jurisdiccional"/>
                        </div>
                        
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                          <div>
                            <div style={{ fontSize: 9, fontWeight: 600, color: 'var(--text-muted)' }}>Última consulta</div>
                            <input type="date" style={inputStyle} value={fExtForm.ultima_consulta} onChange={e => setFExtForm({ ...fExtForm, ultima_consulta: e.target.value })}/>
                          </div>
                          <input style={{ ...inputStyle, marginTop: 14 }} value={fExtForm.observaciones} onChange={e => setFExtForm({ ...fExtForm, observaciones: e.target.value })} placeholder="Claves de acceso, notas..."/>
                        </div>

                        <button onClick={guardarFuente} disabled={fExtSaving} style={{ ...btnPri, padding: '8px', justifyContent: 'center', fontSize: 12 }}>
                          {fExtSaving ? 'Guardando...' : '+ Registrar portal'}
                        </button>
                      </div>
                    </div>
                  )}

                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 8 }}>Enlaces oficiales registrados ({fuentes.length})</div>
                  {cargandoFuentes ? (
                    <DrawerSkeleton rows={2} />
                  ) : fuentes.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: 20, color: 'var(--text-muted)', fontSize: 12, fontStyle: 'italic' }}>Sin fuentes o portales externos registrados.</div>
                  ) : (
                    fuentes.map(f => (
                      <div key={f.id} style={{ background: 'var(--surface-3)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '10px 12px', marginBottom: 6 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <div>
                            <strong style={{ fontSize: 13, color: 'var(--text)' }}>{f.nombre}</strong>
                            <div style={{ fontSize: 10, color: 'var(--primary)', fontWeight: 600, marginTop: 2 }}>{f.tipo}</div>
                          </div>
                          <a
                            href={f.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              background: 'var(--primary)', color: '#fff', textDecoration: 'none',
                              borderRadius: 'var(--radius)', padding: '5px 12px', fontSize: 11, fontWeight: 700,
                              display: 'inline-block'
                            }}
                          >
                            Abrir fuente oficial ↗
                          </a>
                        </div>
                        
                        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                          {f.num_externo && <span>📁 Ext: {f.num_externo}</span>}
                          {f.organo && <span>🏛️ Juzgado: {f.organo}</span>}
                          <span>📅 Consulta: {fmtFecha(f.ultima_consulta)}</span>
                        </div>
                        {f.observaciones && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4, fontStyle: 'italic' }}>📝 {f.observaciones}</div>}
                        
                        {canWrite && (
                          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 6, borderTop: '1px solid var(--border)', paddingTop: 6 }}>
                            <button onClick={() => eliminarFuente(f.id)} style={{ background: 'none', border: 'none', color: 'var(--danger)', fontSize: 11, cursor: 'pointer', fontWeight: 600 }}>Eliminar</button>
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* 9. Tab Observaciones (Nuevo) */}
              {tabDetalle === 'observaciones' && (
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 8 }}>Observaciones internas del expediente</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <textarea
                      style={{ ...inputStyle, minHeight: 280, resize: 'vertical', fontSize: 13, lineHeight: 1.5 }}
                      value={obsText}
                      onChange={e => setObsText(e.target.value)}
                      placeholder="Escribe comentarios generales, estrategias del litigio, convenios y acuerdos con el cliente..."
                    />
                    {canWrite && (
                      <button onClick={guardarObservaciones} disabled={obsSaving} style={btnPri}>
                        {obsSaving ? 'Guardando...' : '💾 Guardar observaciones'}
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* 10. Tab Amparo Federal CJF */}
              {tabDetalle === 'amparo' && (
                <div>
                  <div style={{
                    background: 'var(--surface-3)', border: '1px solid var(--border)',
                    borderRadius: 'var(--radius)', padding: '11px 14px', marginBottom: 14,
                  }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 2 }}>
                      Amparos Federales — CJF Tercer Circuito (Jalisco)
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.5 }}>
                      Registra amparos del Tercer Circuito vinculados a este expediente.
                    </div>
                    <div style={{ display: 'flex', gap: 16, marginTop: 6, flexWrap: 'wrap' }}>
                      <a
                        href={CJF_CIRCUITO_3_URL}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ fontSize: 11, color: 'var(--primary)', fontWeight: 600, display: 'inline-block' }}
                      >
                        🔗 Portal DGEJ-CJF Tercer Circuito ↗
                      </a>
                      <a
                        href="https://www.oaj.gob.mx/micrositios/dggj/paginas/serviciosTramites.htm?pageName=servicios%2FsesionExpediente.htm"
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ fontSize: 11, color: 'var(--primary)', fontWeight: 600, display: 'inline-block' }}
                      >
                        📅 Consultar Sesión en DGGJ-OAJ ↗
                      </a>
                    </div>
                  </div>

                  {canWrite && (
                    <BuscarAmparoCJF
                      onBuscar={(numAmparo) => consultarCJFAhora(detalleExp, numAmparo)}
                      cargando={cargandoAmparos}
                    />
                  )}

                  {errorAmparos && (
                    <div style={{ padding: '8px 12px', background: 'var(--danger-bg)', color: 'var(--danger-text)', borderRadius: 'var(--radius)', fontSize: 12, marginBottom: 10 }}>
                      ⚠️ {errorAmparos}
                    </div>
                  )}

                  {canWrite && (
                    <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden', marginBottom: 16 }}>
                      <div style={{ background: 'var(--surface-3)', padding: '9px 14px', borderBottom: '1px solid var(--border)', fontSize: 12, fontWeight: 700, color: 'var(--text)', textTransform: 'uppercase', letterSpacing: '.4px' }}>
                        ✏️ Registrar amparo manualmente
                      </div>
                      <div style={{ padding: '14px', display: 'flex', flexDirection: 'column', gap: 16 }}>

                        <SeccionAmparo titulo="Identificación del amparo">
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                            <Field label="Número de amparo *">
                              <input style={inputStyle} value={ampForm.numAmparo}
                                onChange={e => setAmpForm(f => ({ ...f, numAmparo: e.target.value }))}
                                placeholder="Ej: 1234/2024"/>
                            </Field>
                            <Field label="Tipo de amparo *">
                              <select style={inputStyle} value={ampForm.tipoAsunto}
                                onChange={e => setAmpForm(f => ({ ...f, tipoAsunto: e.target.value }))}>
                                <optgroup label="Amparos">
                                  <option value="Amparo Directo">Amparo Directo</option>
                                  <option value="Amparo Indirecto">Amparo Indirecto</option>
                                </optgroup>
                                <optgroup label="Recursos">
                                  <option value="Recurso de Revisión">Recurso de Revisión</option>
                                  <option value="Recurso de Queja">Recurso de Queja</option>
                                  <option value="Recurso de Reclamación">Recurso de Reclamación</option>
                                </optgroup>
                                <optgroup label="Otros">
                                  <option value="Conflicto de Competencia">Conflicto de Competencia</option>
                                  <option value="Impedimento">Impedimento</option>
                                  <option value="Excitativa de Justicia">Excitativa de Justicia</option>
                                  <option value="Reconocimiento de Inocencia">Reconocimiento de Inocencia</option>
                                  <option value="Otro">Otro</option>
                                </optgroup>
                              </select>
                            </Field>
                            <Field label="Materia">
                              <select style={inputStyle} value={ampForm.materia}
                                onChange={e => setAmpForm(f => ({ ...f, materia: e.target.value }))}>
                                <option value="">— Selecciona —</option>
                                <option value="Civil">Civil</option>
                                <option value="Mercantil">Mercantil</option>
                                <option value="Penal">Penal</option>
                                <option value="Administrativa">Administrativa</option>
                                <option value="Laboral">Laboral</option>
                                <option value="Mixta">Mixta (Civil y Trabajo)</option>
                              </select>
                            </Field>
                            <Field label="Estado del asunto">
                              <select style={inputStyle} value={ampForm.estado}
                                onChange={e => setAmpForm(f => ({ ...f, estado: e.target.value }))}>
                                <option value="">— Selecciona —</option>
                                <option value="En trámite">En trámite</option>
                                <option value="Pendiente de resolución">Pendiente de resolución</option>
                                <option value="Concluido">Concluido</option>
                                <option value="Sobreseído">Sobreseído</option>
                                <option value="Enviado al superior">Enviado al superior</option>
                                <option value="Suspendido">Suspendido</option>
                                <option value="Archivado">Archivado</option>
                              </select>
                            </Field>
                          </div>
                        </SeccionAmparo>

                        <SeccionAmparo titulo="Órgano jurisdiccional — Tercer Circuito (Jalisco)">
                          <Field label="Tribunal / Juzgado *">
                            <select style={inputStyle} value={ampForm.organo}
                              onChange={e => setAmpForm(f => ({ ...f, organo: e.target.value }))}>
                              <option value="">— Selecciona el órgano —</option>
                              {ORGANOS_CJF_TERCER_CIRCUITO.map(grupo => (
                                <optgroup key={grupo.grupo} label={`── ${grupo.grupo} ──`}>
                                  {grupo.items.map(item => (
                                    <option key={item} value={item}>{item}</option>
                                  ))}
                                </optgroup>
                              ))}
                            </select>
                          </Field>
                          <div style={{ marginTop: 10 }}>
                            <Field label="Magistrado / Juez ponente">
                              <input style={inputStyle} value={ampForm.ponente}
                                onChange={e => setAmpForm(f => ({ ...f, ponente: e.target.value }))}
                                placeholder="Nombre del magistrado o juez ponente"/>
                            </Field>
                          </div>
                        </SeccionAmparo>

                        <SeccionAmparo titulo="Partes">
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                            <Field label="Quejoso (parte promovente)">
                              <input style={inputStyle} value={ampForm.quejoso}
                                onChange={e => setAmpForm(f => ({ ...f, quejoso: e.target.value }))}
                                placeholder="Nombre completo del quejoso"/>
                            </Field>
                            <Field label="Autoridad responsable">
                              <input style={inputStyle} value={ampForm.autoridadResponsable}
                                onChange={e => setAmpForm(f => ({ ...f, autoridadResponsable: e.target.value }))}
                                placeholder="Ej: Juzgado Noveno de lo Mercantil del Primer Partido Judicial"/>
                            </Field>
                            <Field label="Tercero interesado">
                              <input style={inputStyle} value={ampForm.terceroInteresado}
                                onChange={e => setAmpForm(f => ({ ...f, terceroInteresado: e.target.value }))}
                                placeholder="Si aplica"/>
                            </Field>
                            <Field label="Ministerio Público">
                              <input style={inputStyle} value={ampForm.ministerioPublico}
                                onChange={e => setAmpForm(f => ({ ...f, ministerioPublico: e.target.value }))}
                                placeholder="Agencia del MP federal (si aplica)"/>
                            </Field>
                          </div>
                        </SeccionAmparo>

                        <SeccionAmparo titulo="Acto reclamado y fechas">
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                            <Field label="Acto reclamado">
                              <textarea style={{ ...inputStyle, minHeight: 70, resize: 'vertical' }}
                                value={ampForm.actoReclamado}
                                onChange={e => setAmpForm(f => ({ ...f, actoReclamado: e.target.value }))}
                                placeholder="Descripción del acto reclamado a la autoridad responsable..."/>
                            </Field>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                              <Field label="Fecha de radicación / presentación">
                                <input type="date" style={inputStyle} value={ampForm.fechaRadicacion}
                                  onChange={e => setAmpForm(f => ({ ...f, fechaRadicacion: e.target.value }))}/>
                              </Field>
                              <Field label="Fecha del último acuerdo">
                                <input type="date" style={inputStyle} value={ampForm.fechaAcuerdo}
                                  onChange={e => setAmpForm(f => ({ ...f, fechaAcuerdo: e.target.value }))}/>
                              </Field>
                            </div>
                          </div>
                        </SeccionAmparo>

                        <SeccionAmparo titulo="Último acuerdo / actuación">
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                            <Field label="Descripción del acuerdo">
                              <textarea style={{ ...inputStyle, minHeight: 70, resize: 'vertical' }}
                                value={ampForm.descripcionAcuerdo}
                                onChange={e => setAmpForm(f => ({ ...f, descripcionAcuerdo: e.target.value }))}
                                placeholder="Texto del último acuerdo publicado en el portal CJF..."/>
                            </Field>
                            <Field label="Observaciones internas">
                              <textarea style={{ ...inputStyle, minHeight: 55, resize: 'vertical' }}
                                value={ampForm.observaciones}
                                onChange={e => setAmpForm(f => ({ ...f, observaciones: e.target.value }))}
                                placeholder="Notas internas del despacho sobre este amparo..."/>
                            </Field>
                          </div>
                        </SeccionAmparo>

                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                            📌{' '}
                            <a href={ampForm.numAmparo ? urlAmparoFederalCJF(ampForm.numAmparo) : CJF_CIRCUITO_3_URL}
                              target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary)', fontWeight: 600 }}>
                              Ver en portal DGEJ-CJF ↗
                            </a>
                          </div>
                          <button onClick={handleGuardarAmparo} disabled={savingAmparo} style={btnPri}>
                            {savingAmparo ? 'Guardando...' : '💾 Guardar amparo'}
                          </button>
                        </div>

                      </div>
                    </div>
                  )}

                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 8 }}>
                    Amparos vinculados ({cargandoAmparos ? '…' : amparos.length})
                  </div>

                  {cargandoAmparos ? (
                    <div style={{ textAlign: 'center', padding: 24, color: 'var(--text-muted)', fontSize: 13 }}>Cargando...</div>
                  ) : amparos.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '24px 14px', color: 'var(--text-muted)', fontSize: 13, background: 'var(--surface-3)', border: '1px dashed var(--border)', borderRadius: 'var(--radius)' }}>
                      <div style={{ fontSize: 26, marginBottom: 8 }}>⚖️</div>
                      <div style={{ fontWeight: 600 }}>Sin amparos registrados</div>
                      <div style={{ fontSize: 11, marginTop: 4 }}>
                        Usa "Registrar amparo federal" para vincular un amparo del CJF a este expediente.
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {amparos.map(a => (
                        <div key={a.id} style={{
                          background: a.leido ? 'var(--surface-3)' : 'var(--surface)',
                          border: `1px solid ${a.leido ? 'var(--border)' : 'var(--primary)'}`,
                          borderRadius: 'var(--radius)', padding: '10px 12px',
                        }}>
                          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 4 }}>
                                <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--primary)', fontFamily: 'monospace' }}>
                                  {a.num_amparo}
                                </span>
                                {a.tipo_asunto && (
                                  <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 999, background: 'var(--info-bg)', color: 'var(--info-text)', fontWeight: 700 }}>
                                    {a.tipo_asunto}
                                  </span>
                                )}
                                {!a.leido && (
                                  <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 999, background: 'var(--warning-bg)', color: 'var(--warning-text)' }}>● Nuevo</span>
                                )}
                              </div>
                              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 3 }}>
                                🏛️ {a.organo}
                              </div>
                              {a.actor && (
                                <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 3 }}>
                                  👤 Quejoso: {a.actor}
                                </div>
                              )}
                              {a.autoridad_responsable && (
                                <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 3 }}>
                                  ⚖️ Autoridad: {a.autoridad_responsable}
                                </div>
                              )}
                              <div style={{ display: 'flex', gap: 12, fontSize: 11, color: 'var(--text-muted)', marginBottom: 4, flexWrap: 'wrap' }}>
                                {a.fecha_presentacion && <span>📅 Presentación: {fmtFecha(a.fecha_presentacion)}</span>}
                                {a.fecha_acuerdo && <span>📋 Acuerdo: {fmtFecha(a.fecha_acuerdo)}</span>}
                              </div>
                              {a.descripcion_acuerdo && (
                                <div style={{ fontSize: 12, color: 'var(--text)', lineHeight: 1.6, marginBottom: 4 }}>
                                  {a.descripcion_acuerdo}
                                </div>
                              )}
                              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                                {a.estado_asunto && (
                                  <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>Estado: {a.estado_asunto}</span>
                                )}
                                <a href={a.url_fuente} target="_blank" rel="noopener noreferrer" style={{ fontSize: 10, color: 'var(--primary)', fontWeight: 600 }}>
                                  Ver en CJF ↗
                                </a>
                                <a
                                  href="https://www.oaj.gob.mx/micrositios/dggj/paginas/serviciosTramites.htm?pageName=servicios%2FsesionExpediente.htm"
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  style={{ fontSize: 10, color: 'var(--primary)', fontWeight: 600 }}
                                  title="Consultar programación de sesión para resolver este amparo en DGGJ-OAJ"
                                >
                                  📅 Consultar Sesión DGGJ-OAJ ↗
                                </a>
                              </div>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end', flexShrink: 0 }}>
                              {canWrite && !a.leido && (
                                <button onClick={() => marcarAmparoLeido(a.id)} style={{ ...btnSec, fontSize: 11, padding: '4px 9px' }}>
                                  ✓ Leído
                                </button>
                              )}
                              <button
                                onClick={() => toggleHistorialAmparo(a.id)}
                                style={{ ...btnSec, fontSize: 11, padding: '4px 9px', whiteSpace: 'nowrap' }}
                              >
                                {amparoExpandido === a.id ? '▲ Ocultar' : '📋 Historial'}
                              </button>
                            </div>
                          </div>

                          {amparoExpandido === a.id && (
                            <div style={{ marginTop: 10, borderTop: '1px solid var(--border)', paddingTop: 10 }}>
                              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.4px', marginBottom: 8 }}>
                                Historial de acuerdos (auto-detectados)
                              </div>
                              {cargandoHistorial === a.id ? (
                                <div style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', padding: 12 }}>Cargando...</div>
                              ) : (acuerdosAmparo[a.id] || []).length === 0 ? (
                                <div style={{ fontSize: 12, color: 'var(--text-muted)', padding: '10px 0', textAlign: 'center' }}>
                                  Sin acuerdos en historial todavía.
                                </div>
                              ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                  {(acuerdosAmparo[a.id] || []).map(ac => (
                                    <div key={ac.id} style={{
                                      background: 'var(--surface-3)', borderRadius: 'var(--radius)',
                                      padding: '8px 10px', border: '1px solid var(--border)',
                                    }}>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                                        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)' }}>
                                          📅 {fmtFecha(ac.fecha)}
                                        </span>
                                        {ac.auto_detectado && (
                                          <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 999, background: 'var(--primary)', color: '#fff' }}>
                                            🤖 Auto
                                          </span>
                                        )}
                                        {ac.estado_asunto && (
                                          <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{ac.estado_asunto}</span>
                                        )}
                                        <a href={ac.url_fuente} target="_blank" rel="noopener noreferrer" style={{ fontSize: 10, color: 'var(--primary)', marginLeft: 'auto' }}>
                                          CJF ↗
                                        </a>
                                      </div>
                                      {ac.descripcion && (
                                        <div style={{ fontSize: 12, color: 'var(--text)', lineHeight: 1.6 }}>
                                          {ac.descripcion}
                                        </div>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* 11. Tab Cobranza */}
              {tabDetalle === 'cobranza' && (
                <div>
                  <div style={{
                    display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16
                  }}>
                    <div style={{
                      background: 'rgba(245,158,11,.08)', border: '1px solid rgba(245,158,11,.2)',
                      borderRadius: 'var(--radius)', padding: '12px 14px', textAlign: 'center'
                    }}>
                      <div style={{ fontSize: 10, color: 'var(--warning-text)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.5px' }}>Pendiente de Cobro</div>
                      <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--warning-text)', marginTop: 4 }}>
                        ${(horas.filter(h => !h.facturado).reduce((sum, h) => sum + (h.horas * h.tarifa_hora), 0) + 
                           gastos.filter(g => !g.facturado).reduce((sum, g) => sum + g.monto, 0)).toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                      </div>
                    </div>
                    <div style={{
                      background: 'rgba(34,197,94,.08)', border: '1px solid rgba(34,197,94,.2)',
                      borderRadius: 'var(--radius)', padding: '12px 14px', textAlign: 'center'
                    }}>
                      <div style={{ fontSize: 10, color: 'var(--success-text)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.5px' }}>Facturado (Histórico)</div>
                      <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--success-text)', marginTop: 4 }}>
                        ${(horas.filter(h => h.facturado).reduce((sum, h) => sum + (h.horas * h.tarifa_hora), 0) + 
                           gastos.filter(g => g.facturado).reduce((sum, g) => sum + g.monto, 0)).toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                    <button
                      onClick={() => setModalFactura(true)}
                      style={{ ...btnPri, flex: 1, justifyContent: 'center', fontSize: 12, padding: '8px' }}
                    >
                      📄 Generar Estado de Cuenta
                    </button>
                    <button
                      onClick={exportarCobranzaExcel}
                      style={{ ...btnSec, flex: 1, justifyContent: 'center', fontSize: 12, padding: '8px', display: 'inline-flex', alignItems: 'center', gap: 6 }}
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M7 10l5 5 5-5"/><path d="M12 15V3"/>
                      </svg>
                      Exportar Excel
                    </button>
                  </div>

                  <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden', marginBottom: 16 }}>
                    <div style={{ background: 'var(--surface-3)', padding: '8px 12px', borderBottom: '1px solid var(--border)', fontSize: 11, fontWeight: 700, color: 'var(--text)', textTransform: 'uppercase', letterSpacing: '.4px' }}>
                      ⏱️ Registro de Horas
                    </div>
                    
                    {canWrite && (
                      <div style={{ padding: 10, background: 'var(--surface-2)', borderBottom: '1px solid var(--border)' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
                          <div>
                            <div style={smallLabel}>Fecha</div>
                            <input type="date" style={inputStyle} value={horasForm.fecha} onChange={e => setHorasForm({ ...horasForm, fecha: e.target.value })}/>
                          </div>
                          <div>
                            <div style={smallLabel}>Horas</div>
                            <input type="number" step="0.1" style={inputStyle} placeholder="1.5" value={horasForm.horas} onChange={e => setHorasForm({ ...horasForm, horas: e.target.value })}/>
                          </div>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px', gap: 8, alignItems: 'end' }}>
                          <div>
                            <div style={smallLabel}>Descripción de Actividad</div>
                            <input style={inputStyle} placeholder="Estudio de amparo..." value={horasForm.descripcion} onChange={e => setHorasForm({ ...horasForm, descripcion: e.target.value })}/>
                          </div>
                          <div>
                            <div style={smallLabel}>Tarifa/Hora</div>
                            <input type="number" style={inputStyle} value={horasForm.tarifa_hora} onChange={e => setHorasForm({ ...horasForm, tarifa_hora: e.target.value })}/>
                          </div>
                        </div>
                        <button onClick={guardarHora} disabled={cobranzaSaving} style={{ ...btnPri, width: '100%', marginTop: 10, padding: '7px', justifyContent: 'center', fontSize: 12 }}>
                          {cobranzaSaving ? 'Guardando...' : '+ Registrar Horas'}
                        </button>
                      </div>
                    )}

                    <div style={{ padding: '4px 10px', maxHeight: 200, overflowY: 'auto' }}>
                      {cargandoCobranza ? (
                        <div style={{ fontSize: 12, color: 'var(--text-muted)', padding: 12, textAlign: 'center' }}>Cargando...</div>
                      ) : horas.length === 0 ? (
                        <div style={{ fontSize: 12, color: 'var(--text-muted)', padding: 16, textAlign: 'center', fontStyle: 'italic' }}>Sin horas registradas</div>
                      ) : (
                        horas.map(h => (
                          <div key={h.id} style={{ display: 'flex', gap: 8, padding: '8px 0', borderBottom: '1px solid var(--border)', alignItems: 'center' }}>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 12, color: 'var(--text)', fontWeight: 600 }}>{h.descripcion}</div>
                              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                                {fmtFecha(h.fecha)} · {h.horas} hrs a ${h.tarifa_hora.toLocaleString('es-MX')}/hr
                              </div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <span style={{
                                fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 999,
                                background: h.facturado ? 'rgba(34,197,94,.12)' : 'rgba(245,158,11,.12)',
                                color: h.facturado ? 'var(--success)' : 'var(--warning-text)'
                              }}>
                                {h.facturado ? 'Facturado' : 'Pendiente'}
                              </span>
                              {canWrite && (
                                <button onClick={() => eliminarHora(h.id)} style={{ ...iconActionBtn, color: 'var(--danger)', padding: '2px 6px' }}>×</button>
                              )}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
                    <div style={{ background: 'var(--surface-3)', padding: '8px 12px', borderBottom: '1px solid var(--border)', fontSize: 11, fontWeight: 700, color: 'var(--text)', textTransform: 'uppercase', letterSpacing: '.4px' }}>
                      💸 Registro de Gastos
                    </div>
                    
                    {canWrite && (
                      <div style={{ padding: 10, background: 'var(--surface-2)', borderBottom: '1px solid var(--border)' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
                          <div>
                            <div style={smallLabel}>Fecha</div>
                            <input type="date" style={inputStyle} value={gastosForm.fecha} onChange={e => setGastosForm({ ...gastosForm, fecha: e.target.value })}/>
                          </div>
                          <div>
                            <div style={smallLabel}>Monto (MXN)</div>
                            <input type="number" style={inputStyle} placeholder="500" value={gastosForm.monto} onChange={e => setGastosForm({ ...gastosForm, monto: e.target.value })}/>
                          </div>
                        </div>
                        <div>
                          <div style={smallLabel}>Concepto</div>
                          <input style={inputStyle} placeholder="Copias certificadas..." value={gastosForm.concepto} onChange={e => setGastosForm({ ...gastosForm, concepto: e.target.value })}/>
                        </div>
                        <button onClick={guardarGasto} disabled={cobranzaSaving} style={{ ...btnPri, width: '100%', marginTop: 10, padding: '7px', justifyContent: 'center', fontSize: 12 }}>
                          {cobranzaSaving ? 'Guardando...' : '+ Registrar Gasto'}
                        </button>
                      </div>
                    )}

                    <div style={{ padding: '4px 10px', maxHeight: 200, overflowY: 'auto' }}>
                      {cargandoCobranza ? (
                        <div style={{ fontSize: 12, color: 'var(--text-muted)', padding: 12, textAlign: 'center' }}>Cargando...</div>
                      ) : gastos.length === 0 ? (
                        <div style={{ fontSize: 12, color: 'var(--text-muted)', padding: 16, textAlign: 'center', fontStyle: 'italic' }}>Sin gastos registrados</div>
                      ) : (
                        gastos.map(g => (
                          <div key={g.id} style={{ display: 'flex', gap: 8, padding: '8px 0', borderBottom: '1px solid var(--border)', alignItems: 'center' }}>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 12, color: 'var(--text)', fontWeight: 600 }}>{g.concepto}</div>
                              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                                {fmtFecha(g.fecha)} · Monto: ${g.monto.toLocaleString('es-MX')}
                              </div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <span style={{
                                fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 999,
                                background: g.facturado ? 'rgba(34,197,94,.12)' : 'rgba(245,158,11,.12)',
                                color: g.facturado ? 'var(--success)' : 'var(--warning-text)'
                              }}>
                                {g.facturado ? 'Facturado' : 'Pendiente'}
                              </span>
                              {canWrite && (
                                <button onClick={() => eliminarGasto(g.id)} style={{ ...iconActionBtn, color: 'var(--danger)', padding: '2px 6px' }}>×</button>
                              )}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              )}

            </div>

            {/* Pie del drawer */}
            <div style={{ padding: '10px 18px', borderTop: '1px solid var(--border)', display: 'flex', gap: 8, justifyContent: 'flex-end', flexShrink: 0 }}>
              {canWrite && (
                <button onClick={() => { eliminar(detalleExp.id, detalleExp.num) }} style={{ ...btnDanger, fontSize: 12, padding: '6px 12px' }}>Eliminar</button>
              )}
              <button onClick={() => setDetalleExp(null)} style={{ ...btnSec, fontSize: 12, padding: '6px 12px' }}>Cerrar</button>
            </div>
          </div>
        )}

      </div>

      {/* Modal de creación/edición de expediente */}
      <Modal
        open={modal}
        onClose={() => setModal(false)}
        title={editId ? 'Editar expediente' : 'Agregar expediente'}
        subtitle="Captura detalladamente los datos de control del expediente"
        width={800}
        footer={
          <>
            <button onClick={() => setModal(false)} style={btnSec}>Cancelar</button>
            <button onClick={guardar} disabled={saving} style={btnPri}>
              {saving ? 'Guardando...' : '💾 Guardar expediente'}
            </button>
          </>
        }
      >
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14 }}>
          <Field label="Número de expediente *">
            <input style={inputStyle} value={form.num} onChange={e => setF('num', e.target.value)} placeholder="Ej: 1234/2026"/>
          </Field>
          
          <Field label="Año de inicio *">
            <input style={inputStyle} type="number" value={form.anio} onChange={e => setF('anio', e.target.value)} placeholder="2026"/>
          </Field>

          <Field label="Juzgado / Órgano Jurisdiccional *">
            <select style={inputStyle} value={form.juzgado} onChange={e => handleJuzgadoChange(e.target.value)}>
              <option value="">— Seleccionar juzgado del CJJ —</option>
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
            {form.cve_juz && (
              <div style={{ fontSize: 11, color: 'var(--primary)', marginTop: 5, fontWeight: 600 }}>
                🔑 Código de Boletín CJJ Jalisco: {form.cve_juz}
              </div>
            )}
          </Field>

          <Field label="Partido Judicial">
            <input style={inputStyle} value={form.partido_judicial} onChange={e => setF('partido_judicial', e.target.value)} placeholder="Ej: Primer Partido Judicial - Guadalajara"/>
          </Field>

          <Field label="Materia *">
            <select style={inputStyle} value={form.materia} onChange={e => setF('materia', e.target.value)}>
              <option value="Mercantil">Mercantil</option>
              <option value="Civil">Civil</option>
              <option value="Familiar">Familiar</option>
              <option value="Laboral">Laboral</option>
              <option value="Administrativa">Administrativa</option>
              <option value="Penal">Penal</option>
              <option value="Otra">Otra materia</option>
            </select>
          </Field>

          <Field label="Tipo de juicio *">
            <select style={inputStyle} value={form.tipo} onChange={e => setF('tipo', e.target.value)}>
              {TIPOS.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          </Field>

          <Field label="Parte Actora *">
            <input style={inputStyle} value={form.actor} onChange={e => setF('actor', e.target.value)} placeholder="Persona promotora o demandante"/>
          </Field>

          <Field label="Parte Demandada *">
            <input style={inputStyle} value={form.demandado} onChange={e => setF('demandado', e.target.value)} placeholder="Contraparte o demandado"/>
          </Field>

          <Field label="Abogado Responsable">
            <select style={inputStyle} value={form.abogado_responsable} onChange={e => setF('abogado_responsable', e.target.value)}>
              <option value="">— Seleccionar Responsable —</option>
              {abogados.map(m => (
                <option key={m.user_id} value={m.user_profiles?.nombre || m.user_id}>
                  {m.user_profiles?.nombre || m.user_profiles?.email}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Cliente asignado (Portal de clientes)">
            <select style={inputStyle} value={form.cliente_id || ''} onChange={e => setF('cliente_id', e.target.value)}>
              <option value="">— Sin vinculación a portal de clientes —</option>
              {clientes.map(c => (
                <option key={c.id} value={c.id}>
                  {c.nombre ? `${c.nombre} (${c.email})` : c.email}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Etapa procesal actual *">
            <select style={inputStyle} value={form.etapa} onChange={e => setF('etapa', e.target.value)}>
              {ETAPAS.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          </Field>

          <Field label="Estado procesal">
            <select style={inputStyle} value={form.estado} onChange={e => setF('estado', e.target.value)}>
              <option value="Activo">Activo</option>
              <option value="Suspendido">Suspendido</option>
              <option value="Concluido">Concluido</option>
            </select>
          </Field>

          <Field label="Fecha de inicio (Radicación)">
            <input type="date" style={inputStyle} value={form.fecha_inicio} onChange={e => setF('fecha_inicio', e.target.value)}/>
          </Field>

          <Field label="Próxima fecha importante / Audiencia">
            <input type="date" style={inputStyle} value={form.proxima_fecha} onChange={e => setF('proxima_fecha', e.target.value)}/>
          </Field>

          <Field label="Último acuerdo dictado (Resumen)">
            <input style={inputStyle} value={form.ultimo_acuerdo} onChange={e => setF('ultimo_acuerdo', e.target.value)} placeholder="Auto del día..."/>
          </Field>

          <Field label="Fecha de plazo / Alerta (Detona vencimiento)">
            <input type="date" style={inputStyle} value={form.termino} onChange={e => setF('termino', e.target.value)}/>
          </Field>

          <Field label="Prioridad interna">
            <select style={inputStyle} value={form.prioridad} onChange={e => setF('prioridad', e.target.value)}>
              {PRIORIDADES.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          </Field>

          <Field label="Observaciones y notas internas" full>
            <textarea style={{ ...inputStyle, minHeight: 60, resize: 'vertical' }} value={form.notas} onChange={e => setF('notas', e.target.value)} placeholder="Detalles de la radicación, claves, etc."/>
          </Field>

          {/* Alertas de Boletín */}
          <div style={{ gridColumn: '1 / -1', marginTop: 6 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
              <div
                onClick={() => setF('alertas_boletin', !form.alertas_boletin)}
                style={{ width: 40, height: 22, borderRadius: 999, background: form.alertas_boletin ? 'var(--primary)' : 'var(--border)', position: 'relative', transition: 'background .2s', cursor: 'pointer', flexShrink: 0 }}
              >
                <div style={{ position: 'absolute', top: 3, left: form.alertas_boletin ? 21 : 3, width: 16, height: 16, borderRadius: '50%', background: '#fff', transition: 'left .2s', boxShadow: '0 1px 3px rgba(0,0,0,.2)' }}/>
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>Alertas de Boletín Judicial (CJJ Jalisco)</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  Recibirás un email cuando haya un nuevo acuerdo publicado en el boletín judicial oficial.
                </div>
              </div>
            </label>
          </div>

          {form.alertas_boletin && (
            <Field label="Email de notificación de alertas" full>
              <input
                type="email" style={inputStyle}
                value={form.email_notificacion}
                onChange={e => setF('email_notificacion', e.target.value)}
                placeholder={session?.user?.email || 'correo@ejemplo.com'}
              />
            </Field>
          )}
        </div>
      </Modal>

      {/* Modal Factura / Recibo / Estado de Cuenta */}
      <Modal
        open={modalFactura}
        onClose={() => setModalFactura(false)}
        title="Generar Estado de Cuenta"
        subtitle={`Cobros acumulados para el expediente ${detalleExp?.num}`}
        width={600}
        footer={
          <>
            <button onClick={() => setModalFactura(false)} style={btnSec}>Cerrar</button>
            {detalleExp && (horas.filter(h => !h.facturado).length > 0 || gastos.filter(g => !g.facturado).length > 0) && (
              <>
                <button onClick={imprimirRecibo} style={btnPri}>🖨️ Imprimir / PDF</button>
                {canWrite && (
                  <button onClick={async () => { await facturarTodo(); setModalFactura(false) }} style={btnPri}>
                    Confirmar y Marcar Cobrado
                  </button>
                )}
              </>
            )}
          </>
        }
      >
        {detalleExp && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ padding: 12, background: 'var(--surface-3)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', fontSize: 13 }}>
              <div style={{ fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>Información de Pago:</div>
              <div><strong>Cliente / Actor:</strong> {detalleExp.actor}</div>
              <div><strong>Demandado:</strong> {detalleExp.demandado}</div>
              <div><strong>Juzgado:</strong> {detalleExp.juzgado || '—'}</div>
            </div>

            <div style={{ maxHeight: 300, overflowY: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: 'var(--surface-3)', borderBottom: '2px solid var(--border)' }}>
                    <th style={{ padding: 8, textAlign: 'left' }}>Fecha</th>
                    <th style={{ padding: 8, textAlign: 'left' }}>Concepto</th>
                    <th style={{ padding: 8, textAlign: 'right' }}>Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  {horas.filter(h => !h.facturado).length === 0 && gastos.filter(g => !g.facturado).length === 0 ? (
                    <tr>
                      <td colSpan={3} style={{ padding: 16, textAlign: 'center', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                        No hay conceptos pendientes de cobro/facturación.
                      </td>
                    </tr>
                  ) : (
                    <>
                      {horas.filter(h => !h.facturado).map(h => (
                        <tr key={h.id} style={{ borderBottom: '1px solid var(--border)' }}>
                          <td style={{ padding: 8 }}>{fmtFecha(h.fecha)}</td>
                          <td style={{ padding: 8 }}>{h.descripcion} <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>({h.horas} hrs a ${h.tarifa_hora}/hr)</span></td>
                          <td style={{ padding: 8, textAlign: 'right' }}>${(h.horas * h.tarifa_hora).toLocaleString('es-MX')}</td>
                        </tr>
                      ))}
                      {gastos.filter(g => !g.facturado).map(g => (
                        <tr key={g.id} style={{ borderBottom: '1px solid var(--border)' }}>
                          <td style={{ padding: 8 }}>{fmtFecha(g.fecha)}</td>
                          <td style={{ padding: 8 }}>[GASTO] {g.concepto}</td>
                          <td style={{ padding: 8, textAlign: 'right' }}>${g.monto.toLocaleString('es-MX')}</td>
                        </tr>
                      ))}
                    </>
                  )}
                </tbody>
              </table>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', borderTop: '2px solid var(--border)', paddingTop: 12, fontSize: 16 }}>
              <strong>Total Pendiente (MXN):</strong>
              <span style={{ fontWeight: 800, color: 'var(--primary)', marginLeft: 10 }}>
                ${(
                  horas.filter(h => !h.facturado).reduce((sum, h) => sum + (h.horas * h.tarifa_hora), 0) +
                  gastos.filter(g => !g.facturado).reduce((sum, g) => sum + g.monto, 0)
                ).toLocaleString('es-MX', { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>
        )}
      </Modal>

      {/* Modal Reporte de Clientes por WhatsApp */}
      <Modal
        open={modalReporte}
        onClose={() => setModalReporte(false)}
        title="Reportar Actualización al Cliente"
        subtitle="Genera un mensaje de WhatsApp premium en lenguaje claro"
        width={650}
        footer={
          <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
            <button onClick={() => setModalReporte(false)} style={btnSec}>Cancelar</button>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={copiarMensaje}
                style={{
                  ...btnSec,
                  borderColor: copiado ? 'var(--success)' : 'var(--border)',
                  color: copiado ? 'var(--success)' : 'var(--text)',
                  display: 'flex', alignItems: 'center', gap: 6
                }}
              >
                {copiado ? '✓ Copiado' : '📋 Copiar Mensaje'}
              </button>
              <button onClick={enviarWhatsApp} style={{ ...btnPri, display: 'flex', alignItems: 'center', gap: 6 }}>
                📱 Enviar por WhatsApp
              </button>
            </div>
          </div>
        }
      >
        {detalleExp && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <div style={labelStyle}>Destinatario (Nombre)</div>
                <input
                  type="text"
                  style={inputStyle}
                  value={repContactoNombre}
                  onChange={e => setRepContactoNombre(e.target.value)}
                  placeholder="Nombre del cliente"
                />
              </div>
              <div>
                <div style={labelStyle}>Teléfono de WhatsApp (10 dígitos)</div>
                <input
                  type="text"
                  style={inputStyle}
                  value={repContactoTelefono}
                  onChange={e => setRepContactoTelefono(e.target.value)}
                  placeholder="Ej: 3312345678"
                />
              </div>
            </div>

            {cargandoContactoReporte ? (
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Buscando teléfono del cliente...</div>
            ) : contactosDisponibles.length > 0 ? (
              <div style={{ background: 'var(--surface-3)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: 10 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.4px' }}>
                  📞 Teléfonos detectados en el expediente (Haz clic para seleccionar):
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {contactosDisponibles.map(c => (
                    <button
                      key={c.nombre}
                      onClick={() => {
                        setRepContactoNombre(c.nombre)
                        setRepContactoTelefono(c.telefono || '')
                      }}
                      type="button"
                      style={{
                        background: 'var(--surface)', border: '1px solid var(--border)',
                        borderRadius: 999, padding: '4px 12px', fontSize: 11, cursor: 'pointer',
                        color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 5
                      }}
                    >
                      👤 {c.nombre}: <strong>{c.telefono || 'sin tel'}</strong>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div style={{ fontSize: 11, color: 'var(--text-muted)', fontStyle: 'italic' }}>
                💡 Tip: Si registras los datos de contacto del cliente en el directorio de "Partes", su teléfono aparecerá aquí automáticamente.
              </div>
            )}

            <div>
              <div style={labelStyle}>Acuerdo original (Referencia legal)</div>
              <div style={{
                maxHeight: 90, overflowY: 'auto', background: 'var(--surface-3)',
                border: '1px solid var(--border)', borderRadius: 'var(--radius)',
                padding: '8px 12px', fontSize: 12, color: 'var(--text-muted)',
                lineHeight: 1.5, fontFamily: 'system-ui, sans-serif'
              }}>
                {repDescripcion || 'Sin descripción original.'}
              </div>
            </div>

            <div>
              <div style={labelStyle}>Explicación en lenguaje sencillo (Traducción para el cliente)</div>
              <textarea
                style={{ ...inputStyle, minHeight: 90, resize: 'vertical', fontFamily: 'inherit', fontSize: 13, lineHeight: 1.5 }}
                value={repResumen}
                onChange={e => setRepResumen(e.target.value)}
                placeholder="Escribe aquí el resumen en palabras simples para tu cliente..."
              />
            </div>

            <div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 12, color: 'var(--text-secondary)' }}>
                <input
                  type="checkbox"
                  checked={guardarEnHistorial}
                  onChange={e => setGuardarEnHistorial(e.target.checked)}
                  disabled={!repResumen.trim()}
                  style={{ cursor: 'pointer' }}
                />
                <span>Guardar este resumen explicativo en el historial del expediente</span>
              </label>
            </div>

            <div>
              <div style={labelStyle}>Vista previa del mensaje de WhatsApp</div>
              <pre style={{
                background: 'var(--surface-3)', border: '1px solid var(--border)',
                borderRadius: 'var(--radius)', padding: '12px 14px', fontSize: 12,
                color: 'var(--text)', whiteSpace: 'pre-wrap', fontFamily: 'monospace',
                maxHeight: 180, overflowY: 'auto', lineHeight: 1.5
              }}>
                {generarMensajeWhatsApp()}
              </pre>
            </div>
          </div>
        )}
      </Modal>

    </div>
  )
}

/* ── helpers locales ── */
function Field({ label, children, full }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, gridColumn: full ? '1 / -1' : 'auto' }}>
      <div style={labelStyle}>{label}</div>
      {children}
    </div>
  )
}

function DrawerSkeleton({ rows = 3 }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: '8px 0' }}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="pulse" style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 4 }}>
          <div style={{ height: 12, width: '25%', background: 'var(--border-strong)', borderRadius: 'var(--radius-sm)' }} />
          <div style={{ height: 16, width: '100%', background: 'var(--border)', borderRadius: 'var(--radius-sm)' }} />
        </div>
      ))}
    </div>
  )
}

const inputStyle = {
  background: 'var(--surface)', border: '1px solid var(--border)',
  color: 'var(--text)', borderRadius: 'var(--radius)',
  padding: '9px 12px', fontSize: 13, width: '100%', boxSizing: 'border-box'
}
const labelStyle = {
  fontSize: 11, fontWeight: 600, color: 'var(--text-muted)',
  textTransform: 'uppercase', letterSpacing: '.5px',
}
const smallLabel = {
  fontSize: 10, fontWeight: 600, color: 'var(--text-muted)',
  textTransform: 'uppercase', letterSpacing: '.4px', marginBottom: 4,
}
const btnPri = {
  background: 'var(--primary)', color: '#fff',
  border: 'none', borderRadius: 'var(--radius)',
  padding: '9px 16px', fontSize: 13, fontWeight: 600,
  cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6,
}
const btnSec = {
  background: 'var(--surface)', color: 'var(--text)',
  border: '1px solid var(--border)', borderRadius: 'var(--radius)',
  padding: '8px 14px', fontSize: 13, fontWeight: 500,
  cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6,
}
const btnDanger = {
  background: 'transparent', color: 'var(--danger)',
  border: '1px solid var(--danger)', borderRadius: 'var(--radius)',
  padding: '8px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
}
const iconActionBtn = {
  background: 'var(--surface-3)', border: '1px solid var(--border)',
  color: 'var(--text-secondary)', borderRadius: 'var(--radius-sm)',
  padding: '6px 8px', cursor: 'pointer',
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
}
