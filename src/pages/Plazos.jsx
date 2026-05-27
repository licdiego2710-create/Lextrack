import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { fmtFecha, diasHasta, urgencyColor, MATERIAS } from '../utils/helpers'
import PageHeader from '../components/ui/PageHeader'
import { useOrg } from '../context/OrgContext'
import { useToast } from '../context/ToastContext'
import Modal from '../components/ui/Modal'
import StatCard from '../components/ui/StatCard'

const DIAS_SEM = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']

// Función para obtener festivos variables de Ley Federal del Trabajo en México (Lunes largos)
function getShiftedHolidays(year) {
  const holidays = []

  // 1. Primer lunes de febrero (Aniversario de la Constitución - 5 Feb)
  for (let d = 1; d <= 7; d++) {
    const date = new Date(year, 1, d) // 1 = Febrero
    if (date.getDay() === 1) { // 1 = Lunes
      holidays.push(`02-${String(d).padStart(2, '0')}`)
      break
    }
  }

  // 2. Tercer lunes de marzo (Natalicio de Benito Juárez - 21 Mar)
  for (let d = 15; d <= 21; d++) {
    const date = new Date(year, 2, d) // 2 = Marzo
    if (date.getDay() === 1) {
      holidays.push(`03-${String(d).padStart(2, '0')}`)
      break
    }
  }

  // 3. Tercer lunes de noviembre (Aniversario de la Revolución - 20 Nov)
  for (let d = 15; d <= 21; d++) {
    const date = new Date(year, 10, d) // 10 = Noviembre
    if (date.getDay() === 1) {
      holidays.push(`11-${String(d).padStart(2, '0')}`)
      break
    }
  }

  return holidays
}

function esFestivoNacional(d) {
  const year = d.getFullYear()
  const mmdd = `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  
  // Festivos fijos en México
  const fijos = ['01-01', '05-01', '09-16', '12-25']
  
  // Transmisión del Poder Ejecutivo Federal (cada 6 años a partir del 2024, el 1 de Octubre)
  if ((year - 2024) % 6 === 0) {
    fijos.push('10-01')
  }

  const movibles = getShiftedHolidays(year)
  return fijos.includes(mmdd) || movibles.includes(mmdd)
}

const PREDEFS = [
  ['Recurso de revocación', 3, 'hábiles'],
  ['Apelación — auto interlocutorio', 3, 'hábiles'],
  ['Apelación — sentencia definitiva', 9, 'hábiles'],
  ['Contestación (juicio ordinario mercantil)', 9, 'hábiles'],
  ['Contestación (juicio ejecutivo mercantil)', 5, 'hábiles'],
  ['Contestación (juicio oral mercantil)', 9, 'hábiles'],
  ['Ofrecimiento de pruebas', 10, 'hábiles'],
  ['Alegatos', 3, 'hábiles'],
  ['Amparo directo', 15, 'hábiles'],
  ['Amparo indirecto', 15, 'hábiles'],
  ['Expresión de agravios', 15, 'hábiles'],
  ['Tercería excluyente', 3, 'hábiles'],
  ['Incidente de nulidad', 3, 'hábiles'],
  ['Aclaración de sentencia', 3, 'hábiles'],
]

export default function Plazos() {
  const { org } = useOrg()
  const toast = useToast()
  const navigate = useNavigate()

  // ── Vista activa ────────────────────────────────────────────────────
  const [vistaActiva, setVistaActiva] = useState('panel') // 'panel' | 'calculadora'

  // ── Estado panel de términos ───────────────────────────────────────
  const [panelExps, setPanelExps] = useState([])
  const [panelAuds, setPanelAuds] = useState([])
  const [panelLoading, setPanelLoading] = useState(true)
  const [panelFiltros, setPanelFiltros] = useState({ materia: '', responsable: '', urgencia: '' })
  const [panelBuscar, setPanelBuscar] = useState('')

  useEffect(() => {
    if (!org?.id) return
    let alive = true
    ;(async () => {
      setPanelLoading(true)
      const hoyStr = new Date().toISOString().slice(0, 10)
      const en30   = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10)
      const [{ data: exps }, { data: auds }] = await Promise.all([
        supabase.from('expedientes')
          .select('id, num, actor, demandado, juzgado, materia, etapa, termino, proxima_fecha, abogado_responsable, estado')
          .eq('despacho_id', org.id)
          .neq('estado', 'Concluido')
          .or(`termino.lte.${en30},proxima_fecha.lte.${en30}`)
          .order('termino', { ascending: true, nullsFirst: false }),
        supabase.from('expediente_audiencias')
          .select('id, titulo, fecha_hora, lugar, expediente_id, expedientes(num, actor, demandado)')
          .gte('fecha_hora', hoyStr + 'T00:00:00')
          .lte('fecha_hora', en30 + 'T23:59:59')
          .order('fecha_hora', { ascending: true })
          .limit(30),
      ])
      if (!alive) return
      setPanelExps(exps || [])
      setPanelAuds(auds || [])
      setPanelLoading(false)
    })()
    return () => { alive = false }
  }, [org?.id])

  // ── Estado calculadora ─────────────────────────────────────────────
  const [fecha, setFecha] = useState('')
  const [custom, setCustom] = useState([])
  const [inhabiles, setInhabiles] = useState([])
  const [nuevoInh, setNuevoInh] = useState({ fecha: '', nota: '' })
  const [mostrarInh, setMostrarInh] = useState(false)
  const [mostrarImport, setMostrarImport] = useState(false)
  const [textoCalendario, setTextoCalendario] = useState('')
  const [previewInh, setPreviewInh] = useState([])
  const [procesandoImagen, setProcesandoImagen] = useState(false)
  const [imagenPreview, setImagenPreview] = useState(null)

  // Estados para vincular términos a expedientes
  const [expedientes, setExpedientes] = useState([])
  const [expSeleccionado, setExpSeleccionado] = useState('')
  const [vinculandoPlazo, setVinculandoPlazo] = useState(null)

  useEffect(() => {
    if (!org?.id) return
    async function loadInhabiles() {
      const { data, error } = await supabase
        .from('dias_inhabiles')
        .select('fecha, nota')
        .eq('despacho_id', org.id)
        .order('fecha', { ascending: true })

      if (!error && data) {
        setInhabiles(data)
      }
    }
    async function loadExpedientes() {
      const { data, error } = await supabase
        .from('expedientes')
        .select('id, num, actor, demandado')
        .eq('despacho_id', org.id)
        .in('estado', ['Activo', 'activo', 'ACTIVO'])
        .order('num', { ascending: true })

      if (!error && data) {
        setExpedientes(data)
      }
    }
    loadInhabiles()
    loadExpedientes()
  }, [org?.id])

  async function registrarLog(accion, detalles) {
    if (!org?.id) return
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user) {
        await supabase.from('bitacora_actividad').insert({
          despacho_id: org.id,
          user_id: session.user.id,
          user_email: session.user.email,
          accion,
          detalles
        })
      }
    } catch (err) {
      console.error('Error al registrar log:', err)
    }
  }

  async function confirmarVinculacion() {
    if (!org?.id || !expSeleccionado || !vinculandoPlazo) return

    const { error } = await supabase
      .from('expedientes')
      .update({
        termino: vinculandoPlazo.fecha,
        actuacion: `[Término Procesal] ${vinculandoPlazo.label}`,
        actualizado_en: new Date().toISOString()
      })
      .eq('id', expSeleccionado)

    if (error) {
      toast.show('Error al vincular término: ' + error.message, 'danger')
    } else {
      toast.show('Término vinculado exitosamente', 'success')
      
      // Registrar actuación en el historial
      await supabase
        .from('actuaciones')
        .insert({
          expediente_id: expSeleccionado,
          descripcion: `Se fijó el término: ${vinculandoPlazo.label} con fecha de vencimiento al ${fmtFecha(vinculandoPlazo.fecha)}`,
          fecha: new Date().toISOString().slice(0, 10),
          user_id: (await supabase.auth.getUser()).data.user?.id || org.owner_id,
          despacho_id: org.id
        })

      // Registrar log de actividad
      const exp = expedientes.find(e => e.id === expSeleccionado)
      const expNum = exp ? exp.num : 'Desconocido'
      await registrarLog('vincular_plazo', `Vinculó el término "${vinculandoPlazo.label}" (${fmtFecha(vinculandoPlazo.fecha)}) al expediente ${expNum}`)

      setVinculandoPlazo(null)
      setExpSeleccionado('')
    }
  }

  async function agregarInhabil() {
    if (!nuevoInh.fecha || !org?.id) return
    if (inhabiles.some(i => i.fecha === nuevoInh.fecha)) { alert('Esa fecha ya está registrada.'); return }

    const { data, error } = await supabase
      .from('dias_inhabiles')
      .insert({
        despacho_id: org.id,
        fecha: nuevoInh.fecha,
        nota: nuevoInh.nota || null
      })
      .select('fecha, nota')
      .single()

    if (error) {
      alert('Error al agregar fecha: ' + error.message)
    } else if (data) {
      setInhabiles(prev => [...prev, data].sort((a, b) => a.fecha.localeCompare(b.fecha)))
      
      // Registrar log de actividad
      await registrarLog('agregar_dia_inhabil', `Agregó el día inhábil ${fmtFecha(data.fecha)}${data.nota ? ` (${data.nota})` : ''}`)
      
      setNuevoInh({ fecha: '', nota: '' })
    }
  }
  function parsearLineas(texto) {
    return texto.split(/[\n]+/).map(l => l.trim()).filter(Boolean).reduce((acc, linea) => {
      let m = linea.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})\s*[,-]?\s*(.*)$/)
      if (m) { acc.push({ fecha: `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`, nota: m[4].trim() }); return acc }
      m = linea.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})\s*[,-]?\s*(.*)$/)
      if (m) { acc.push({ fecha: `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`, nota: m[4].trim() }); return acc }
      return acc
    }, [])
  }
  function procesarTexto(texto) {
    setTextoCalendario(texto)
    setPreviewInh(parsearLineas(texto))
  }
  function leerArchivoCalendario(file) {
    if (!file) return
    const reader = new FileReader()
    reader.onload = e => procesarTexto(e.target.result)
    reader.readAsText(file, 'UTF-8')
  }
  async function extraerDesdeImagen(file) {
    if (!file) return
    if (file.size > 5 * 1024 * 1024) { alert('La imagen no debe superar 5 MB.'); return }
    setProcesandoImagen(true)
    setPreviewInh([])
    try {
      const base64 = await new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = e => resolve(e.target.result.split(',')[1])
        reader.onerror = reject
        reader.readAsDataURL(file)
      })
      setImagenPreview(URL.createObjectURL(file))
      const { data, error } = await supabase.functions.invoke('extraer-inhabiles', {
        body: { imagen: base64, tipo: file.type || 'image/jpeg' },
      })
      if (error) throw new Error(error.message)
      if (data.error) throw new Error(data.error)
      if (!data.fechas?.length) { alert('No se encontraron fechas en la imagen.'); return }
      setPreviewInh(data.fechas)
    } catch (e) {
      alert('Error al procesar la imagen: ' + e.message)
    }
    setProcesandoImagen(false)
  }
  async function confirmarImportCalendario() {
    if (!org?.id) return
    const nuevas = previewInh.filter(p => p.fecha && !inhabiles.some(i => i.fecha === p.fecha))
    const omitidas = previewInh.length - nuevas.length
    if (!nuevas.length) {
      setTextoCalendario(''); setPreviewInh([]); setMostrarImport(false)
      alert(`No hay fechas nuevas que importar.${omitidas ? ` ${omitidas} ya existían.` : ''}`)
      return
    }

    const payload = nuevas.map(p => ({
      despacho_id: org.id,
      fecha: p.fecha,
      nota: p.nota || null
    }))

    const { data, error } = await supabase
      .from('dias_inhabiles')
      .insert(payload)
      .select('fecha, nota')

    if (error) {
      alert('Error al importar fechas: ' + error.message)
    } else if (data) {
      setInhabiles(prev => [...prev, ...data].sort((a, b) => a.fecha.localeCompare(b.fecha)))
      
      // Registrar log de actividad
      await registrarLog('importar_dias_inhabiles', `Importó ${data.length} días inhábiles al calendario`)

      setTextoCalendario(''); setPreviewInh([]); setMostrarImport(false)
      alert(`${nuevas.length} fecha(s) importada(s).${omitidas ? ` ${omitidas} ya existían.` : ''}`)
    }
  }

  async function eliminarInhabil(fechaVal) {
    if (!org?.id) return
    const { error } = await supabase
      .from('dias_inhabiles')
      .delete()
      .eq('despacho_id', org.id)
      .eq('fecha', fechaVal)

    if (error) {
      alert('Error al eliminar fecha: ' + error.message)
    } else {
      setInhabiles(prev => prev.filter(x => x.fecha !== fechaVal))
      
      // Registrar log de actividad
      await registrarLog('eliminar_dia_inhabil', `Eliminó el día inhábil ${fmtFecha(fechaVal)}`)
    }
  }

  async function eliminarTodos() {
    if (!org?.id) return
    if (!confirm(`¿Eliminar los ${inhabiles.length} días?`)) return
    const { error } = await supabase
      .from('dias_inhabiles')
      .delete()
      .eq('despacho_id', org.id)

    if (error) {
      alert('Error al vaciar fechas: ' + error.message)
    } else {
      setInhabiles([])
      
      // Registrar log de actividad
      await registrarLog('vaciar_dias_inhabiles', `Eliminó todos los días inhábiles`)
    }
  }

  function esHabil(d) {
    const dow = d.getDay()
    const fStr = d.toISOString().slice(0, 10)
    return dow !== 0 && dow !== 6 && !esFestivoNacional(d) && !inhabiles.some(i => i.fecha === fStr)
  }
  function calcular(base, dias, tipo) {
    if (!base || !dias) return null
    const d = new Date(base + 'T00:00:00')
    if (tipo === 'naturales') { d.setDate(d.getDate() + Number(dias)) }
    else { let n = 0; while (n < Number(dias)) { d.setDate(d.getDate() + 1); if (esHabil(d)) n++ } }
    return d
  }

  function ResultCard({ label, dias, tipo, onRemove }) {
    const res = calcular(fecha, dias, tipo)
    if (!res) return null
    const resStr = res.toISOString().slice(0, 10)
    const dow = res.getDay()
    const inhReg = inhabiles.find(i => i.fecha === resStr)
    const esFest = esFestivoNacional(res)
    const esFinSem = dow === 0 || dow === 6
    const warn = esFinSem || esFest || !!inhReg
    const warnLbl = esFest ? 'Festivo federal LFT' : esFinSem ? 'Fin de semana' : inhReg ? `Inhábil CJE${inhReg.nota ? ` · ${inhReg.nota}` : ''}` : ''
    return (
      <div style={{
        background: 'var(--surface)',
        border: `1px solid ${warn ? 'var(--warning)' : 'var(--border)'}`,
        borderRadius: 'var(--radius)',
        padding: '12px 14px',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8,
      }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, color: 'var(--text)', fontWeight: 600, marginBottom: 2 }}>{label}</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{dias} días {tipo}</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: warn ? 'var(--warning)' : 'var(--primary)' }}>{fmtFecha(resStr)}</div>
            <div style={{ fontSize: 11, color: warn ? 'var(--warning)' : 'var(--text-muted)' }}>{DIAS_SEM[dow]}{warn ? ` · ${warnLbl}` : ''}</div>
          </div>
          <button
            onClick={() => setVinculandoPlazo({ label, fecha: resStr })}
            style={{
              background: 'none', border: 'none', color: 'var(--primary)',
              fontSize: 11, fontWeight: 600, cursor: 'pointer', padding: 0,
              textDecoration: 'none'
            }}
            onMouseEnter={e => e.currentTarget.style.textDecoration = 'underline'}
            onMouseLeave={e => e.currentTarget.style.textDecoration = 'none'}
          >
            🔗 Vincular
          </button>
        </div>
        {onRemove && <button onClick={onRemove} style={btnDanger}>×</button>}
      </div>
    )
  }

  // ── Datos panel filtrados ──────────────────────────────────────────
  const expsFiltrados = panelExps.filter(e => {
    const q = panelBuscar.toLowerCase()
    if (q && !`${e.num} ${e.actor} ${e.demandado} ${e.juzgado || ''}`.toLowerCase().includes(q)) return false
    if (panelFiltros.materia && e.materia !== panelFiltros.materia) return false
    if (panelFiltros.responsable && e.abogado_responsable !== panelFiltros.responsable) return false
    if (panelFiltros.urgencia) {
      const d = diasHasta(e.termino || e.proxima_fecha)
      if (panelFiltros.urgencia === 'vencido' && !(d !== null && d < 0)) return false
      if (panelFiltros.urgencia === 'hoy' && d !== 0) return false
      if (panelFiltros.urgencia === '3dias' && !(d !== null && d >= 0 && d <= 3)) return false
      if (panelFiltros.urgencia === '7dias' && !(d !== null && d >= 0 && d <= 7)) return false
    }
    return true
  })

  const kpiVencidos = panelExps.filter(e => { const d = diasHasta(e.termino || e.proxima_fecha); return d !== null && d < 0 }).length
  const kpiHoy     = panelExps.filter(e => diasHasta(e.termino || e.proxima_fecha) === 0).length
  const kpiSemana  = panelExps.filter(e => { const d = diasHasta(e.termino || e.proxima_fecha); return d !== null && d >= 0 && d <= 7 }).length
  const kpiMes     = panelExps.filter(e => { const d = diasHasta(e.termino || e.proxima_fecha); return d !== null && d >= 0 && d <= 30 }).length

  const responsablesDisp = [...new Set(panelExps.map(e => e.abogado_responsable).filter(Boolean))].sort()

  return (
    <div>
      <PageHeader
        title="Plazos y Términos"
        subtitle="Panel de vencimientos activos y calculadora de días hábiles"
      />

      {/* ── Tabs ── */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: 4, width: 'fit-content' }}>
        {[
          { key: 'panel',       label: '📋 Panel de Términos' },
          { key: 'calculadora', label: '🧮 Calculadora' },
        ].map(t => (
          <button key={t.key} onClick={() => setVistaActiva(t.key)} style={{
            background: vistaActiva === t.key ? 'var(--primary)' : 'transparent',
            color: vistaActiva === t.key ? '#fff' : 'var(--text-muted)',
            border: 'none', borderRadius: 'var(--radius)', padding: '8px 18px',
            fontSize: 13, fontWeight: 600, cursor: 'pointer', transition: 'all .15s',
          }}>{t.label}</button>
        ))}
      </div>

      {/* ══════════════════════════════════════════════════════════
          PANEL DE TÉRMINOS
      ══════════════════════════════════════════════════════════ */}
      {vistaActiva === 'panel' && (
        <div>
          {/* KPIs */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginBottom: 20 }}>
            <StatCard title="Vencidos"    value={kpiVencidos} subtitle="Ya pasaron"           color="var(--danger)"  icon={<span style={{fontSize:16}}>⚠️</span>}/>
            <StatCard title="Vencen hoy"  value={kpiHoy}      subtitle="Fecha límite hoy"      color="var(--warning)" icon={<span style={{fontSize:16}}>🔔</span>}/>
            <StatCard title="Esta semana" value={kpiSemana}    subtitle="Próximos 7 días"       color="var(--info)"    icon={<span style={{fontSize:16}}>📅</span>}/>
            <StatCard title="Este mes"    value={kpiMes}       subtitle="Próximos 30 días"      color="var(--primary)" icon={<span style={{fontSize:16}}>📆</span>}/>
            <StatCard title="Audiencias"  value={panelAuds.length} subtitle="Próximas 30 días" color="#8b5cf6"        icon={<span style={{fontSize:16}}>⚖️</span>}/>
          </div>

          {/* Filtros */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14, alignItems: 'center' }}>
            <input
              placeholder="Buscar expediente, actor, demandado..."
              value={panelBuscar}
              onChange={e => setPanelBuscar(e.target.value)}
              style={{ ...inputStyle, flex: 1, minWidth: 220 }}
            />
            <select value={panelFiltros.urgencia} onChange={e => setPanelFiltros(f => ({ ...f, urgencia: e.target.value }))} style={{ ...inputStyle, minWidth: 140 }}>
              <option value="">Todos</option>
              <option value="vencido">Vencidos</option>
              <option value="hoy">Hoy</option>
              <option value="3dias">Próximos 3 días</option>
              <option value="7dias">Próximos 7 días</option>
            </select>
            <select value={panelFiltros.materia} onChange={e => setPanelFiltros(f => ({ ...f, materia: e.target.value }))} style={{ ...inputStyle, minWidth: 130 }}>
              <option value="">Todas las materias</option>
              {MATERIAS.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
            {responsablesDisp.length > 0 && (
              <select value={panelFiltros.responsable} onChange={e => setPanelFiltros(f => ({ ...f, responsable: e.target.value }))} style={{ ...inputStyle, minWidth: 150 }}>
                <option value="">Todos los responsables</option>
                {responsablesDisp.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            )}
          </div>

          {/* Tabla de términos */}
          {panelLoading ? (
            <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 40 }}>Cargando términos...</div>
          ) : expsFiltrados.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 48, color: 'var(--text-muted)', fontSize: 14 }}>
              {panelExps.length === 0 ? 'No hay expedientes con términos próximos en los siguientes 30 días.' : 'Sin resultados para los filtros aplicados.'}
            </div>
          ) : (
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden', marginBottom: 20 }}>
              {expsFiltrados.map((e, idx) => {
                const fechaRef = e.termino || e.proxima_fecha
                const d = diasHasta(fechaRef)
                const u = urgencyColor(d)
                return (
                  <div
                    key={e.id}
                    onClick={() => navigate(`/app/expedientes?q=${encodeURIComponent(e.num)}`)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 12, padding: '14px 18px',
                      borderTop: idx > 0 ? '1px solid var(--border)' : 'none',
                      cursor: 'pointer', transition: 'background .12s',
                      background: d !== null && d < 0 ? 'rgba(220,38,38,.04)' : 'transparent',
                    }}
                    onMouseEnter={el => el.currentTarget.style.background = 'var(--surface-3)'}
                    onMouseLeave={el => {
                      el.currentTarget.style.background = d !== null && d < 0 ? 'rgba(220,38,38,.04)' : 'transparent'
                    }}
                  >
                    {/* Badge urgencia */}
                    <span style={{ background: u.bg, color: u.color, fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 999, whiteSpace: 'nowrap', minWidth: 60, textAlign: 'center' }}>
                      {u.label}
                    </span>
                    {/* Datos expediente */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--primary)' }}>{e.num}</span>
                        {e.materia && <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 999, background: 'var(--surface-3)', color: 'var(--text-muted)' }}>{e.materia}</span>}
                        {e.etapa && <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{e.etapa}</span>}
                      </div>
                      <div style={{ fontSize: 13, color: 'var(--text)', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {e.actor} <span style={{ color: 'var(--text-muted)' }}>vs.</span> {e.demandado}
                      </div>
                      {e.juzgado && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>{e.juzgado}</div>}
                    </div>
                    {/* Fecha */}
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: u.color }}>{fmtFecha(fechaRef)}</div>
                      {e.termino && e.proxima_fecha && e.termino !== e.proxima_fecha && (
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Próx: {fmtFecha(e.proxima_fecha)}</div>
                      )}
                      {e.abogado_responsable && (
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{e.abogado_responsable}</div>
                      )}
                    </div>
                    {/* Flecha */}
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2"><path d="M9 18l6-6-6-6"/></svg>
                  </div>
                )
              })}
            </div>
          )}

          {/* Audiencias próximas */}
          {panelAuds.length > 0 && (
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden', marginBottom: 20 }}>
              <div style={{ padding: '12px 18px', borderBottom: '1px solid var(--border)', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px' }}>
                ⚖️ Audiencias próximas (30 días)
              </div>
              {panelAuds.map((a, idx) => {
                const fechaAud = a.fecha_hora?.slice(0, 10)
                const horaAud = a.fecha_hora?.slice(11, 16)
                const d = diasHasta(fechaAud)
                const u = urgencyColor(d)
                const exp = a.expedientes
                return (
                  <div
                    key={a.id}
                    onClick={() => exp && navigate(`/app/expedientes?q=${encodeURIComponent(exp.num)}`)}
                    style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 18px', borderTop: idx > 0 ? '1px solid var(--border)' : 'none', cursor: exp ? 'pointer' : 'default' }}
                    onMouseEnter={el => { if (exp) el.currentTarget.style.background = 'var(--surface-3)' }}
                    onMouseLeave={el => { el.currentTarget.style.background = 'transparent' }}
                  >
                    <span style={{ background: u.bg, color: u.color, fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 999, whiteSpace: 'nowrap', minWidth: 60, textAlign: 'center' }}>{u.label}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{a.titulo}</div>
                      {exp && <div style={{ fontSize: 12, color: 'var(--primary)', fontWeight: 700 }}>{exp.num} · {exp.actor} vs. {exp.demandado}</div>}
                      {a.lugar && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{a.lugar}</div>}
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: u.color }}>{fmtFecha(fechaAud)}</div>
                      {horaAud && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{horaAud} hrs</div>}
                    </div>
                    {exp && <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2"><path d="M9 18l6-6-6-6"/></svg>}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════
          CALCULADORA (código existente)
      ══════════════════════════════════════════════════════════ */}
      {vistaActiva === 'calculadora' && (
        <div>

      <div style={cardStyle}>
        <div style={labelTitle}>Fecha de notificación / fecha del auto</div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <input style={{ ...inputStyle, maxWidth: 200 }} type="date" value={fecha} onChange={e => setFecha(e.target.value)}/>
          {fecha && <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{new Date(fecha + 'T00:00:00').toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</span>}
          {fecha && <button style={btnSec} onClick={() => setFecha('')}>Limpiar</button>}
        </div>
      </div>

      {/* Bloque de días inhábiles */}
      <div style={{ ...cardStyle, padding: 0, overflow: 'hidden' }}>
        <button onClick={() => setMostrarInh(v => !v)} style={{
          width: '100%', background: 'none', border: 'none',
          padding: '14px 18px',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          cursor: 'pointer', color: 'var(--text)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.5px', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Días inhábiles — Consejo de la Judicatura</span>
            {inhabiles.length > 0 && <span style={{ background: 'var(--primary)', color: '#fff', borderRadius: 999, fontSize: 11, fontWeight: 700, padding: '1px 9px' }}>{inhabiles.length}</span>}
          </div>
          <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>{mostrarInh ? '▲' : '▼'}</span>
        </button>
        {mostrarInh && (
          <div style={{ borderTop: '1px solid var(--border)', padding: '16px 18px' }}>
            <div style={labelTitle}>Agregar fecha individual</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16, alignItems: 'flex-end' }}>
              <div>
                <div style={smallLabel}>Fecha</div>
                <input style={{ ...inputStyle, width: 160 }} type="date" value={nuevoInh.fecha}
                  onChange={e => setNuevoInh(v => ({ ...v, fecha: e.target.value }))}
                  onKeyDown={e => e.key === 'Enter' && agregarInhabil()}/>
              </div>
              <div style={{ flex: 1, minWidth: 200 }}>
                <div style={smallLabel}>Motivo (opcional)</div>
                <input style={inputStyle} placeholder="Ej: Acuerdo 12/2025" value={nuevoInh.nota}
                  onChange={e => setNuevoInh(v => ({ ...v, nota: e.target.value }))}
                  onKeyDown={e => e.key === 'Enter' && agregarInhabil()}/>
              </div>
              <button style={btnPri} onClick={agregarInhabil}>Agregar</button>
            </div>

            <div style={{ background: 'var(--surface-3)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden', marginBottom: 16 }}>
              <button onClick={() => setMostrarImport(v => !v)} style={{
                width: '100%', background: 'none', border: 'none', padding: '10px 14px',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer',
              }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--primary)' }}>Importar calendario oficial del CJE Jalisco</span>
                <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>{mostrarImport ? '▲' : '▼'}</span>
              </button>
              {mostrarImport && (
                <div style={{ borderTop: '1px solid var(--border)', padding: 14 }}>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 14, lineHeight: 1.6 }}>
                    Sube una foto, pega texto o carga un CSV.
                  </div>
                  <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: 12, marginBottom: 12 }}>
                    <div style={{ ...smallLabel, color: 'var(--primary)', marginBottom: 8 }}>Subir imagen (IA)</div>
                    <label style={{
                      display: 'inline-flex', alignItems: 'center', gap: 8,
                      background: procesandoImagen ? 'var(--surface-3)' : 'var(--primary)',
                      border: 'none', borderRadius: 'var(--radius)', padding: '9px 16px',
                      cursor: procesandoImagen ? 'not-allowed' : 'pointer', fontSize: 12,
                      color: '#fff', fontWeight: 600,
                    }}>
                      {procesandoImagen ? 'Analizando imagen...' : 'Seleccionar imagen'}
                      <input type="file" accept="image/*" style={{ display: 'none' }} disabled={procesandoImagen}
                        onChange={e => { extraerDesdeImagen(e.target.files[0]); e.target.value = '' }}/>
                    </label>
                    {imagenPreview && !procesandoImagen && (
                      <img src={imagenPreview} alt="Calendario" style={{ display: 'block', marginTop: 10, maxWidth: '100%', maxHeight: 180, objectFit: 'contain', borderRadius: 6, border: '1px solid var(--border)' }}/>
                    )}
                  </div>

                  <div style={smallLabel}>O pegar fechas en texto</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>
                    Formatos: DD/MM/AAAA o AAAA-MM-DD, nota opcional separada por coma.
                  </div>
                  <textarea
                    style={{ ...inputStyle, minHeight: 90, resize: 'vertical', fontFamily: 'monospace', fontSize: 12, marginBottom: 10 }}
                    placeholder={'10/02/2025, Periodo vacacional\n17/03/2025\n18/03/2025'}
                    value={textoCalendario}
                    onChange={e => procesarTexto(e.target.value)}
                  />

                  <div style={smallLabel}>O subir CSV/TXT</div>
                  <label style={{
                    display: 'inline-block', background: 'var(--surface)', border: '1px dashed var(--border)',
                    borderRadius: 'var(--radius)', padding: '8px 16px', cursor: 'pointer',
                    fontSize: 12, color: 'var(--primary)', fontWeight: 500, marginBottom: 12,
                  }}>
                    Seleccionar archivo (.csv o .txt)
                    <input type="file" accept=".csv,.txt" style={{ display: 'none' }}
                      onChange={e => { leerArchivoCalendario(e.target.files[0]); e.target.value = '' }}/>
                  </label>
                  {previewInh.length > 0 && (
                    <>
                      <div style={{ ...smallLabel, marginBottom: 6 }}>Vista previa — {previewInh.length} fecha(s)</div>
                      <div style={{ maxHeight: 160, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 'var(--radius)', marginBottom: 10 }}>
                        {previewInh.map((p, i) => (
                          <div key={i} style={{ display: 'flex', gap: 10, padding: '5px 10px', borderBottom: '1px solid var(--border)', fontSize: 12 }}>
                            <span style={{ color: 'var(--primary)', fontWeight: 600, minWidth: 80 }}>{fmtFecha(p.fecha)}</span>
                            <span style={{ color: inhabiles.some(x => x.fecha === p.fecha) ? 'var(--warning)' : 'var(--text-muted)' }}>
                              {inhabiles.some(x => x.fecha === p.fecha) ? 'Ya registrada' : p.nota || new Date(p.fecha + 'T00:00:00').toLocaleDateString('es-MX', { weekday: 'long' })}
                            </span>
                          </div>
                        ))}
                      </div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button style={btnPri} onClick={confirmarImportCalendario}>
                          Importar {previewInh.filter(p => !inhabiles.some(x => x.fecha === p.fecha)).length} fecha(s) nueva(s)
                        </button>
                        <button style={btnSec} onClick={() => { setTextoCalendario(''); setPreviewInh([]) }}>Limpiar</button>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>

            {inhabiles.length === 0
              ? <div style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', padding: 10 }}>Sin días inhábiles registrados.</div>
              : (
                <>
                  <div style={smallLabel}>Días registrados ({inhabiles.length})</div>
                  <div style={{ maxHeight: 220, overflowY: 'auto' }}>
                    {inhabiles.map(i => (
                      <div key={i.fecha} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 0', borderTop: '1px solid var(--border)' }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--primary)', minWidth: 92 }}>{fmtFecha(i.fecha)}</span>
                        <span style={{ fontSize: 12, color: 'var(--text-muted)', flex: 1 }}>
                          {new Date(i.fecha + 'T00:00:00').toLocaleDateString('es-MX', { weekday: 'long' })}
                          {i.nota && <span style={{ color: 'var(--text)' }}> · {i.nota}</span>}
                        </span>
                        <button style={btnDanger} onClick={() => eliminarInhabil(i.fecha)}>×</button>
                      </div>
                    ))}
                  </div>
                  <button style={{ ...btnDanger, marginTop: 10, fontSize: 11 }} onClick={eliminarTodos}>Borrar todos</button>
                </>
              )}
          </div>
        )}
      </div>

      {!fecha && (
        <div style={{ textAlign: 'center', padding: 48, color: 'var(--text-muted)', fontSize: 14 }}>
          Selecciona la fecha de notificación para calcular los plazos.
        </div>
      )}

      {fecha && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 8, marginBottom: 12 }}>
            {PREDEFS.map(([l, d, t]) => <ResultCard key={l} label={l} dias={d} tipo={t}/>)}
          </div>
          {custom.map((c, i) => (
            <div key={i} style={{
              background: 'var(--surface)', border: '1px solid var(--border)',
              borderRadius: 'var(--radius)', padding: '12px 14px',
              marginBottom: 8, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap',
            }}>
              <input style={{ ...inputStyle, flex: 2, minWidth: 140 }} placeholder="Descripción del término" value={c.label}
                onChange={e => setCustom(a => a.map((x, j) => j === i ? { ...x, label: e.target.value } : x))}/>
              <input style={{ ...inputStyle, width: 72 }} type="number" min="1" value={c.dias}
                onChange={e => setCustom(a => a.map((x, j) => j === i ? { ...x, dias: e.target.value } : x))}/>
              <select style={inputStyle} value={c.tipo}
                onChange={e => setCustom(a => a.map((x, j) => j === i ? { ...x, tipo: e.target.value } : x))}>
                <option value="hábiles">Días hábiles</option>
                <option value="naturales">Días naturales</option>
              </select>
              {calcular(fecha, c.dias, c.tipo) && (() => {
                const r = calcular(fecha, c.dias, c.tipo)
                const rs = r.toISOString().slice(0, 10)
                const dw = r.getDay()
                return (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginLeft: 'auto', flexShrink: 0 }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--primary)', whiteSpace: 'nowrap' }}>
                      {fmtFecha(rs)} <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{DIAS_SEM[dw]}</span>
                    </span>
                    <button
                      onClick={() => setVinculandoPlazo({ label: c.label || 'Término Personalizado', fecha: rs })}
                      style={{
                        background: 'none', border: 'none', color: 'var(--primary)',
                        fontSize: 12, fontWeight: 600, cursor: 'pointer', padding: 0,
                      }}
                      onMouseEnter={e => e.currentTarget.style.textDecoration = 'underline'}
                      onMouseLeave={e => e.currentTarget.style.textDecoration = 'none'}
                    >
                      🔗 Vincular
                    </button>
                  </div>
                )
              })()}
              <button style={btnDanger} onClick={() => setCustom(a => a.filter((_, j) => j !== i))}>×</button>
            </div>
          ))}
          <button style={btnSec} onClick={() => setCustom(c => [...c, { label: '', dias: 5, tipo: 'hábiles' }])}>+ Término personalizado</button>
          <div style={{
            marginTop: 16, fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.7,
            background: 'var(--surface-3)', border: '1px solid var(--border)',
            borderRadius: 'var(--radius)', padding: '10px 14px',
          }}>
            Los plazos en amarillo caen en fin de semana, festivo federal o día inhábil registrado.<br/>
            Festivos federales y de descanso obligatorio (LFT): Año Nuevo, Primero de Mayo, Independencia, Navidad, Transmisión Presidencial (1 Oct cada 6 años) y los fines de semana largos conmemorativos (Constitución, Benito Juárez y Revolución Mexicana) aplicados al día lunes correspondiente.
          </div>
        </>
      )}
      </div>
      )}

      {vinculandoPlazo && (
        <Modal
          open={!!vinculandoPlazo}
          title="Vincular término a expediente"
          subtitle={`Se asignará el término "${vinculandoPlazo.label}" con vencimiento el ${fmtFecha(vinculandoPlazo.fecha)}.`}
          onClose={() => { setVinculandoPlazo(null); setExpSeleccionado('') }}
          footer={
            <div style={{ display: 'flex', gap: 8 }}>
              <button style={btnSec} onClick={() => { setVinculandoPlazo(null); setExpSeleccionado('') }}>Cancelar</button>
              <button style={btnPri} disabled={!expSeleccionado} onClick={confirmarVinculacion}>Vincular</button>
            </div>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <div style={smallLabel}>Seleccionar Expediente Activo</div>
              {expedientes.length === 0 ? (
                <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>No tienes expedientes activos registrados.</div>
              ) : (
                <select
                  style={{ ...inputStyle, width: '100%', marginTop: 4 }}
                  value={expSeleccionado}
                  onChange={e => setExpSeleccionado(e.target.value)}
                >
                  <option value="">-- Selecciona un expediente --</option>
                  {expedientes.map(e => (
                    <option key={e.id} value={e.id}>
                      {e.num} {e.actor ? `(Actor: ${e.actor})` : ''} {e.demandado ? `vs ${e.demandado}` : ''}
                    </option>
                  ))}
                </select>
              )}
            </div>
            <div>
              <div style={smallLabel}>Descripción del término</div>
              <input
                style={{ ...inputStyle, width: '100%', marginTop: 4 }}
                value={vinculandoPlazo.label}
                onChange={e => setVinculandoPlazo(prev => ({ ...prev, label: e.target.value }))}
              />
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}

const cardStyle = {
  background: 'var(--surface)', border: '1px solid var(--border)',
  borderRadius: 'var(--radius-lg)', padding: 18, marginBottom: 14,
}
const labelTitle = { fontSize: 11, color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 8 }
const smallLabel = { fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '.5px' }
const inputStyle = {
  background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)',
  borderRadius: 'var(--radius)', padding: '9px 12px', fontSize: 13,
}
const btnPri = {
  background: 'var(--primary)', color: '#fff', border: 'none',
  borderRadius: 'var(--radius)', padding: '9px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
}
const btnSec = {
  background: 'var(--surface)', color: 'var(--text)', border: '1px solid var(--border)',
  borderRadius: 'var(--radius)', padding: '8px 14px', fontSize: 13, fontWeight: 500, cursor: 'pointer',
}
const btnDanger = {
  background: 'transparent', color: 'var(--danger)', border: '1px solid var(--danger)',
  borderRadius: 'var(--radius-sm)', padding: '4px 10px', fontSize: 11, cursor: 'pointer',
}
