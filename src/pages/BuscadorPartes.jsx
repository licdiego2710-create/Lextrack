import { useState, useRef } from 'react'
import { supabase } from '../supabaseClient'
import { fmtFecha } from '../utils/helpers'
import PageHeader from '../components/ui/PageHeader'
import { useOrg } from '../context/OrgContext'
import { useToast } from '../context/ToastContext'
import Modal from '../components/ui/Modal'

// ── Estilos base ─────────────────────────────────────────────────────────────
const inputStyle = {
  background: 'var(--surface)', border: '1px solid var(--border)',
  color: 'var(--text)', borderRadius: 'var(--radius)',
  padding: '10px 14px', fontSize: 14, width: '100%',
}
const selectStyle = { ...inputStyle, padding: '9px 12px', fontSize: 13 }
const btnPri = {
  background: 'var(--primary)', color: '#fff', border: 'none',
  borderRadius: 'var(--radius)', padding: '10px 20px', fontSize: 14,
  fontWeight: 600, cursor: 'pointer', display: 'inline-flex',
  alignItems: 'center', gap: 6, flexShrink: 0,
}
const btnSec = {
  background: 'var(--surface)', color: 'var(--text)',
  border: '1px solid var(--border)', borderRadius: 'var(--radius)',
  padding: '10px 20px', fontSize: 14, fontWeight: 500, cursor: 'pointer',
}
const smallLabel = {
  fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '.5px'
}
const chip = (color) => ({
  display: 'inline-flex', alignItems: 'center',
  padding: '2px 9px', borderRadius: 999,
  fontSize: 10, fontWeight: 700,
  background: `var(--${color}-bg, var(--surface-3))`,
  color: `var(--${color}-text, var(--text-muted))`,
})

const MATERIAS = ['', 'Civil', 'Mercantil', 'Familiar', 'Penal', 'Administrativo']
const PARTIDOS = [
  '', 'ZMG', 'Puerto Vallarta', 'Lagos de Moreno', 'Ciudad Guzmán',
  'Tepatitlán', 'La Barca', 'Ocotlán', 'Arandas', 'Ameca', 'Tequila',
  'Autlán', 'Colotlán', 'Encarnación', 'San Juan de los Lagos',
  'Sayula', 'Tamazula', 'Tlajomulco', 'Tonal', 'Cihuatlán',
]

const ROL_COLOR = { actor: 'info', demandado: 'warning', parte: 'neutral' }
const ROL_LABEL = { actor: 'Actor', demandado: 'Demandado', parte: 'Parte' }

export default function BuscadorPartes({ session }) {
  const { org } = useOrg()
  const toast = useToast()

  const [nombre,      setNombre]      = useState('')
  const [materia,     setMateria]     = useState('')
  const [partido,     setPartido]     = useState('')
  const [fechaDesde,  setFechaDesde]  = useState('')
  const [fechaHasta,  setFechaHasta]  = useState('')

  const [resultados,  setResultados]  = useState(null)   // null = sin búsqueda aún
  const [cargando,    setCargando]    = useState(false)
  const [error,       setError]       = useState(null)

  // Estados de importación
  const [modalImportar, setModalImportar] = useState(false)
  const [formImportar, setFormImportar] = useState({ num: '', juzgado: '', materia: '', actor: '', demandado: '', etapa: 'Instrucción' })
  const [guardandoImport, setGuardandoImport] = useState(false)

  const inputRef = useRef(null)

  function abrirImportar(exp) {
    const actors = exp.partes.filter(p => p.rol === 'actor').map(p => p.nombre).join(', ')
    const demandados = exp.partes.filter(p => p.rol === 'demandado').map(p => p.nombre).join(', ')
    
    setFormImportar({
      num: exp.expediente_num || '',
      juzgado: exp.juzgado || '',
      materia: exp.materia || '',
      actor: actors || '',
      demandado: demandados || '',
      etapa: 'Instrucción'
    })
    setModalImportar(true)
  }

  async function confirmarImportar() {
    if (!org?.id) return
    setGuardandoImport(true)
    
    const { error: errInsert } = await supabase
      .from('expedientes')
      .insert({
        despacho_id: org.id,
        user_id: session.user.id,
        num: formImportar.num,
        juzgado: formImportar.juzgado,
        materia: formImportar.materia,
        actor: formImportar.actor,
        demandado: formImportar.demandado,
        etapa: formImportar.etapa,
        estado: 'Activo',
        creado_en: new Date().toISOString(),
        actualizado_en: new Date().toISOString()
      })

    if (errInsert) {
      toast.show('Error al importar expediente: ' + errInsert.message, 'danger')
    } else {
      toast.show('Expediente importado y creado exitosamente', 'success')
      
      // Registrar log de actividad
      await supabase.from('bitacora_actividad').insert({
        despacho_id: org.id,
        user_id: session.user.id,
        user_email: session.user.email,
        accion: 'crear_expediente',
        detalles: `Importó el expediente "${formImportar.num}" desde el buscador de partes (${formImportar.actor} vs ${formImportar.demandado})`
      })

      setModalImportar(false)
    }
    setGuardandoImport(false)
  }

  // ── Búsqueda ────────────────────────────────────────────────────────────────
  async function buscar(e) {
    e?.preventDefault()
    const normalizar = (str) => str.toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim()
    const term = normalizar(nombre)
    if (term.length < 3) { inputRef.current?.focus(); return }

    setCargando(true); setError(null); setResultados(null)

    try {
      // Búsqueda por trigrama en partes_judiciales
      let q = supabase
        .from('partes_judiciales')
        .select('expediente_num, nombre_raw, rol, juzgado, materia, partido_judicial, fecha, url_fuente, acuerdo_id')
        .ilike('nombre', `%${term}%`)
        .order('fecha', { ascending: false })
        .limit(200)

      if (materia)    q = q.eq('materia', materia)
      if (partido)    q = q.ilike('partido_judicial', `%${partido}%`)
      if (fechaDesde) q = q.gte('fecha', fechaDesde)
      if (fechaHasta) q = q.lte('fecha', fechaHasta)

      const { data, error: err } = await q
      if (err) throw err

      // Agrupar por expediente_num
      const porExp = {}
      for (const r of (data || [])) {
        const k = r.expediente_num
        if (!porExp[k]) {
          porExp[k] = {
            expediente_num:  k,
            juzgado:         r.juzgado,
            materia:         r.materia,
            partido_judicial: r.partido_judicial,
            fecha:           r.fecha,
            url_fuente:      r.url_fuente,
            partes:          [],
          }
        }
        porExp[k].partes.push({ nombre: r.nombre_raw, rol: r.rol })
        // Fecha más reciente
        if (r.fecha > porExp[k].fecha) porExp[k].fecha = r.fecha
      }

      setResultados(Object.values(porExp))
    } catch (e) {
      setError(e.message)
    } finally {
      setCargando(false)
    }
  }

  // ── Estadísticas ─────────────────────────────────────────────────────────
  const stats = resultados ? calcStats(resultados) : null

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', padding: '0 0 40px' }}>
      <PageHeader
        title="Buscador de Partes"
        subtitle="Busca personas o empresas en los boletines judiciales de Jalisco"
      />

      <div style={{ maxWidth: 900, margin: '0 auto', padding: '0 20px' }}>

        {/* ── Formulario de búsqueda ── */}
        <form onSubmit={buscar} style={{
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)', padding: 20, marginBottom: 24,
          display: 'flex', flexDirection: 'column', gap: 14,
        }}>
          {/* Nombre */}
          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 6 }}>
                Nombre o razón social *
              </div>
              <input
                ref={inputRef}
                style={inputStyle}
                value={nombre}
                onChange={e => setNombre(e.target.value)}
                placeholder="Ej: Juan Pérez López o Empresa SA de CV"
                minLength={3}
                autoFocus
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end' }}>
              <button type="submit" disabled={cargando || nombre.trim().length < 3} style={{ ...btnPri, opacity: (cargando || nombre.trim().length < 3) ? 0.6 : 1 }}>
                {cargando
                  ? <><span style={{ display: 'inline-block', animation: 'spin 1s linear infinite' }}>⟳</span> Buscando...</>
                  : '🔍 Buscar'
                }
              </button>
            </div>
          </div>

          {/* Filtros */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '.4px' }}>Materia</div>
              <select style={selectStyle} value={materia} onChange={e => setMateria(e.target.value)}>
                <option value="">Todas</option>
                {MATERIAS.filter(Boolean).map(m => <option key={m}>{m}</option>)}
              </select>
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '.4px' }}>Partido judicial</div>
              <select style={selectStyle} value={partido} onChange={e => setPartido(e.target.value)}>
                <option value="">Todos</option>
                {PARTIDOS.filter(Boolean).map(p => <option key={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '.4px' }}>Desde</div>
              <input type="date" style={selectStyle} value={fechaDesde} onChange={e => setFechaDesde(e.target.value)}/>
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '.4px' }}>Hasta</div>
              <input type="date" style={selectStyle} value={fechaHasta} onChange={e => setFechaHasta(e.target.value)}/>
            </div>
          </div>

          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            🔎 Busca en los boletines judiciales scrapeados. Los datos se actualizan cada noche.
          </div>
        </form>

        {/* ── Error ── */}
        {error && (
          <div style={{ padding: '12px 16px', background: 'var(--danger-bg)', color: 'var(--danger-text)', borderRadius: 'var(--radius)', marginBottom: 20, fontSize: 13 }}>
            ⚠️ {error}
          </div>
        )}

        {/* ── Estadísticas ── */}
        {stats && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginBottom: 20 }}>
            <StatBox label="Expedientes encontrados" value={stats.total} />
            <StatBox label="Como actor" value={stats.comoActor} color="var(--info-text)" />
            <StatBox label="Como demandado" value={stats.comoDemandado} color="var(--warning-text)" />
            {Object.entries(stats.porMateria).sort((a,b) => b[1]-a[1]).slice(0,3).map(([m, n]) => (
              <StatBox key={m} label={m} value={n} />
            ))}
          </div>
        )}

        {/* ── Sin resultados ── */}
        {resultados !== null && resultados.length === 0 && (
          <div style={{ textAlign: 'center', padding: '48px 24px', color: 'var(--text-muted)' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🔍</div>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 6 }}>Sin resultados</div>
            <div style={{ fontSize: 13 }}>
              No encontramos "{nombre}" en los boletines judiciales indexados.
            </div>
            <div style={{ fontSize: 12, marginTop: 8 }}>
              Los datos se actualizan cada noche. Si el caso es reciente puede que aún no esté indexado.
            </div>
          </div>
        )}

        {/* ── Resultados ── */}
        {resultados && resultados.length > 0 && (
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 12 }}>
              {resultados.length} expediente(s) encontrado(s)
            </div>

            {/* Agrupado por materia */}
            {Object.entries(agruparPorMateria(resultados)).map(([mat, exps]) => (
              <div key={mat} style={{ marginBottom: 24 }}>
                <div style={{
                  fontSize: 12, fontWeight: 700, color: 'var(--primary)',
                  textTransform: 'uppercase', letterSpacing: '.6px',
                  borderBottom: '2px solid var(--primary)', paddingBottom: 6, marginBottom: 10,
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                }}>
                  <span>⚖️ {mat || 'Sin materia'}</span>
                  <span style={{ fontWeight: 400, fontSize: 11, color: 'var(--text-muted)' }}>{exps.length} expediente(s)</span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {exps.map(exp => (
                    <div key={exp.expediente_num} style={{
                      background: 'var(--surface)', border: '1px solid var(--border)',
                      borderRadius: 'var(--radius)', padding: '12px 14px',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          {/* Número + juzgado */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 5 }}>
                            <span style={{ fontFamily: 'monospace', fontSize: 14, fontWeight: 800, color: 'var(--primary)' }}>
                              {exp.expediente_num}
                            </span>
                            {exp.partido_judicial && exp.partido_judicial !== 'ZMG' && (
                              <span style={chip('neutral')}>{exp.partido_judicial}</span>
                            )}
                          </div>
                          {/* Juzgado */}
                          {exp.juzgado && (
                            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>
                              🏛️ {exp.juzgado}
                            </div>
                          )}
                          {/* Partes encontradas */}
                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
                            {exp.partes.map((p, i) => (
                              <span key={i} style={chip(ROL_COLOR[p.rol] || 'neutral')}>
                                {ROL_LABEL[p.rol] || p.rol}: {p.nombre}
                              </span>
                            ))}
                          </div>
                        </div>
                        {/* Fecha y Acciones */}
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8, flexShrink: 0 }}>
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Último acuerdo</div>
                            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>{fmtFecha(exp.fecha)}</div>
                          </div>
                          {org?.id && (
                            <button
                              onClick={() => abrirImportar(exp)}
                              style={{
                                background: 'var(--primary-bg, #2563eb10)', color: 'var(--primary)', border: '1px solid var(--primary)',
                                borderRadius: 'var(--radius)', padding: '5px 10px', fontSize: 11, fontWeight: 700,
                                cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4
                              }}
                            >
                              ✨ Importar
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── Estado inicial ── */}
        {resultados === null && !cargando && (
          <div style={{ textAlign: 'center', padding: '48px 24px', color: 'var(--text-muted)' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🏛️</div>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 6 }}>
              Buscador de Partes en Boletín Judicial Jalisco
            </div>
            <div style={{ fontSize: 13, maxWidth: 420, margin: '0 auto', lineHeight: 1.7 }}>
              Escribe el nombre de una persona o empresa para ver en qué expedientes aparece,
              en qué juzgados y como qué parte procesal.
            </div>
          </div>
        )}

      </div>

      {/* Modal para confirmar importación */}
      {modalImportar && (
        <Modal
          open={modalImportar}
          title="Importar expediente desde Boletín"
          subtitle={`Se creará un nuevo expediente activo con el número ${formImportar.num}.`}
          onClose={() => setModalImportar(false)}
          footer={
            <div style={{ display: 'flex', gap: 8 }}>
              <button style={btnSec} onClick={() => setModalImportar(false)}>Cancelar</button>
              <button style={btnPri} disabled={guardandoImport} onClick={confirmarImportar}>
                {guardandoImport ? 'Importando...' : 'Confirmar e Importar'}
              </button>
            </div>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <div style={smallLabel}>Número de Expediente</div>
              <input
                style={inputStyle}
                value={formImportar.num}
                onChange={e => setFormImportar(prev => ({ ...prev, num: e.target.value }))}
              />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <div style={smallLabel}>Materia</div>
                <input
                  style={inputStyle}
                  value={formImportar.materia}
                  onChange={e => setFormImportar(prev => ({ ...prev, materia: e.target.value }))}
                />
              </div>
              <div>
                <div style={smallLabel}>Etapa Procesal</div>
                <input
                  style={inputStyle}
                  value={formImportar.etapa}
                  onChange={e => setFormImportar(prev => ({ ...prev, etapa: e.target.value }))}
                />
              </div>
            </div>
            <div>
              <div style={smallLabel}>Juzgado</div>
              <input
                style={inputStyle}
                value={formImportar.juzgado}
                onChange={e => setFormImportar(prev => ({ ...prev, juzgado: e.target.value }))}
              />
            </div>
            <div>
              <div style={smallLabel}>Actor / Solicitante</div>
              <input
                style={inputStyle}
                value={formImportar.actor}
                onChange={e => setFormImportar(prev => ({ ...prev, actor: e.target.value }))}
                placeholder="Nombre del Actor"
              />
            </div>
            <div>
              <div style={smallLabel}>Demandado / Requerido</div>
              <input
                style={inputStyle}
                value={formImportar.demandado}
                onChange={e => setFormImportar(prev => ({ ...prev, demandado: e.target.value }))}
                placeholder="Nombre del Demandado"
              />
            </div>
          </div>
        </Modal>
      )}

    </div>
  )
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function calcStats(resultados) {
  let comoActor = 0, comoDemandado = 0
  const porMateria = {}

  for (const exp of resultados) {
    const roles = exp.partes.map(p => p.rol)
    if (roles.includes('actor'))    comoActor++
    if (roles.includes('demandado')) comoDemandado++
    const mat = exp.materia || 'Sin materia'
    porMateria[mat] = (porMateria[mat] || 0) + 1
  }

  return { total: resultados.length, comoActor, comoDemandado, porMateria }
}

function agruparPorMateria(resultados) {
  const grupos = {}
  for (const exp of resultados) {
    const k = exp.materia || 'Sin materia'
    if (!grupos[k]) grupos[k] = []
    grupos[k].push(exp)
  }
  // Ordenar grupos por cantidad desc
  return Object.fromEntries(
    Object.entries(grupos).sort((a, b) => b[1].length - a[1].length)
  )
}

function StatBox({ label, value, color }) {
  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid var(--border)',
      borderRadius: 'var(--radius)', padding: '12px 16px', textAlign: 'center',
    }}>
      <div style={{ fontSize: 24, fontWeight: 800, color: color || 'var(--text)' }}>{value}</div>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>{label}</div>
    </div>
  )
}
