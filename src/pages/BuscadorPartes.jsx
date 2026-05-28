import { useState, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
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
  boxSizing: 'border-box',
}
const selectStyle = { ...inputStyle, padding: '9px 12px', fontSize: 13 }
const btnPri = {
  background: 'var(--primary)', color: '#fff', border: 'none',
  borderRadius: 'var(--radius)', padding: '10px 20px', fontSize: 14,
  fontWeight: 600, cursor: 'pointer', display: 'inline-flex',
  alignItems: 'center', gap: 6, flexShrink: 0, whiteSpace: 'nowrap',
}
const btnSec = {
  background: 'var(--surface)', color: 'var(--text)',
  border: '1px solid var(--border)', borderRadius: 'var(--radius)',
  padding: '10px 20px', fontSize: 14, fontWeight: 500, cursor: 'pointer',
}
const smallLabel = {
  fontSize: 11, color: 'var(--text-muted)', fontWeight: 600,
  marginBottom: 4, textTransform: 'uppercase', letterSpacing: '.5px',
}

const MATERIAS = ['Civil', 'Mercantil', 'Familiar', 'Penal', 'Administrativo']

// Normalizar texto: mayúsculas sin acentos
function normalizar(str) {
  return str.toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim()
}

// ── Componente principal ──────────────────────────────────────────────────────
export default function BuscadorPartes({ session }) {
  const { org } = useOrg()
  const toast    = useToast()
  const navigate = useNavigate()

  const [nombre,      setNombre]      = useState('')
  const [materia,     setMateria]     = useState('')
  const [rolFiltro,   setRolFiltro]   = useState('todos') // todos | actor | demandado

  const [resultados,  setResultados]  = useState(null)
  const [cargando,    setCargando]    = useState(false)
  const [error,       setError]       = useState(null)

  // Modal importar
  const [modalImportar, setModalImportar]     = useState(false)
  const [formImportar,  setFormImportar]      = useState({})
  const [guardandoImport, setGuardandoImport] = useState(false)

  const inputRef = useRef(null)

  // ── Búsqueda ────────────────────────────────────────────────────────────────
  async function buscar(e) {
    e?.preventDefault()
    const term = nombre.trim()
    if (term.length < 3) { inputRef.current?.focus(); return }

    setCargando(true); setError(null); setResultados(null)

    try {
      const termLike = `%${term}%`

      // ── 1. Buscar en expedientes del despacho (actor / demandado) ──────────
      let qExp = supabase
        .from('expedientes')
        .select('id, num, actor, demandado, juzgado, materia, partido_judicial, estado, creado_en')
        .or(`actor.ilike.${termLike},demandado.ilike.${termLike}`)
        .limit(100)

      if (org?.id) qExp = qExp.eq('despacho_id', org.id)
      if (materia)  qExp = qExp.eq('materia', materia)

      // ── 2. Buscar en acuerdos del boletín (actor / demandado / descripcion) ─
      let qBol = supabase
        .from('acuerdos_boletin')
        .select('expediente_num, juzgado, materia, actor, demandado, descripcion, fecha, partido_judicial')
        .or(`actor.ilike.${termLike},demandado.ilike.${termLike},descripcion.ilike.${termLike}`)
        .order('fecha', { ascending: false })
        .limit(200)

      if (materia) qBol = qBol.eq('materia', materia)

      const [resExp, resBol] = await Promise.all([qExp, qBol])

      if (resExp.error) throw resExp.error
      if (resBol.error) throw resBol.error

      // ── Consolidar resultados ─────────────────────────────────────────────
      // Clave: expediente_num para boletín, num para expedientes propios
      const mapa = {}

      // Procesar expedientes del despacho
      for (const e of (resExp.data || [])) {
        const key = e.num
        if (!mapa[key]) {
          mapa[key] = {
            expediente_num: key,
            juzgado:        e.juzgado || '',
            materia:        e.materia || '',
            partido_judicial: e.partido_judicial || '',
            actor:          e.actor || '',
            demandado:      e.demandado || '',
            fecha:          e.creado_en?.slice(0, 10) || '',
            fuentes:        ['mis_expedientes'],
            expediente_id:  e.id,
            estado:         e.estado,
          }
        } else {
          mapa[key].fuentes.push('mis_expedientes')
          mapa[key].expediente_id = e.id
          mapa[key].estado = e.estado
        }
      }

      // Procesar acuerdos del boletín
      for (const a of (resBol.data || [])) {
        const key = a.expediente_num
        if (!key) continue
        if (!mapa[key]) {
          mapa[key] = {
            expediente_num: key,
            juzgado:        a.juzgado || '',
            materia:        a.materia || '',
            partido_judicial: a.partido_judicial || '',
            actor:          a.actor || '',
            demandado:      a.demandado || '',
            fecha:          a.fecha || '',
            fuentes:        ['boletin'],
            expediente_id:  null,
            estado:         null,
          }
        } else {
          if (!mapa[key].fuentes.includes('boletin')) mapa[key].fuentes.push('boletin')
          // Completar datos faltantes desde boletín
          if (!mapa[key].actor    && a.actor)    mapa[key].actor    = a.actor
          if (!mapa[key].demandado && a.demandado) mapa[key].demandado = a.demandado
          if (!mapa[key].juzgado  && a.juzgado)  mapa[key].juzgado  = a.juzgado
          if (!mapa[key].materia  && a.materia)  mapa[key].materia  = a.materia
          // Fecha más reciente del boletín
          if (a.fecha && a.fecha > (mapa[key].fecha || '')) mapa[key].fecha = a.fecha
        }
      }

      let lista = Object.values(mapa)

      // ── Filtrar por rol ───────────────────────────────────────────────────
      if (rolFiltro !== 'todos') {
        const termU = normalizar(term)
        lista = lista.filter(r => {
          if (rolFiltro === 'actor')     return normalizar(r.actor || '').includes(termU)
          if (rolFiltro === 'demandado') return normalizar(r.demandado || '').includes(termU)
          return true
        })
      }

      // Ordenar: mis expedientes primero, luego por fecha desc
      lista.sort((a, b) => {
        const aEsMio = a.fuentes.includes('mis_expedientes')
        const bEsMio = b.fuentes.includes('mis_expedientes')
        if (aEsMio !== bEsMio) return aEsMio ? -1 : 1
        return (b.fecha || '') > (a.fecha || '') ? 1 : -1
      })

      setResultados(lista)
    } catch (err) {
      setError(err.message)
    } finally {
      setCargando(false)
    }
  }

  // ── Importar ─────────────────────────────────────────────────────────────
  function abrirImportar(exp) {
    setFormImportar({
      num:       exp.expediente_num || '',
      juzgado:   exp.juzgado       || '',
      materia:   exp.materia       || '',
      actor:     exp.actor         || '',
      demandado: exp.demandado     || '',
      etapa:     'Instrucción',
    })
    setModalImportar(true)
  }

  async function confirmarImportar() {
    if (!org?.id) return
    setGuardandoImport(true)
    const { error: errInsert } = await supabase.from('expedientes').insert({
      despacho_id:     org.id,
      user_id:         session.user.id,
      num:             formImportar.num,
      juzgado:         formImportar.juzgado,
      materia:         formImportar.materia,
      actor:           formImportar.actor,
      demandado:       formImportar.demandado,
      etapa:           formImportar.etapa,
      estado:          'Activo',
      creado_en:       new Date().toISOString(),
      actualizado_en:  new Date().toISOString(),
    })

    if (errInsert) {
      toast.show('Error al importar: ' + errInsert.message, 'danger')
    } else {
      toast.show('Expediente importado exitosamente', 'success')
      await supabase.from('bitacora_actividad').insert({
        despacho_id: org.id,
        user_id:     session.user.id,
        user_email:  session.user.email,
        accion:      'crear_expediente',
        detalles:    `Importó el expediente "${formImportar.num}" desde Buscador de Partes`,
      })
      setModalImportar(false)
      // Re-buscar para actualizar estado
      await buscar()
    }
    setGuardandoImport(false)
  }

  // ── Stats ─────────────────────────────────────────────────────────────────
  const total         = resultados?.length ?? 0
  const enSistema     = resultados?.filter(r => r.fuentes.includes('mis_expedientes')).length ?? 0
  const soloBoletín   = resultados?.filter(r => !r.fuentes.includes('mis_expedientes')).length ?? 0

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', padding: '0 0 40px' }}>
      <PageHeader
        title="Buscador de Partes"
        subtitle="Busca personas o empresas en el boletín judicial y tus expedientes"
      />

      <div style={{ maxWidth: 900, margin: '0 auto', padding: '0 20px' }}>

        {/* ── Formulario ── */}
        <form onSubmit={buscar} style={{
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)', padding: 20, marginBottom: 20,
          display: 'flex', flexDirection: 'column', gap: 14,
        }}>
          {/* Nombre + botón */}
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
                placeholder="Ej: Juan Pérez López o Comercializadora SA"
                autoFocus
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end' }}>
              <button
                type="submit"
                disabled={cargando || nombre.trim().length < 3}
                style={{ ...btnPri, opacity: (cargando || nombre.trim().length < 3) ? 0.6 : 1 }}
              >
                {cargando
                  ? <><SpinIcon /> Buscando...</>
                  : '🔍 Buscar'
                }
              </button>
            </div>
          </div>

          {/* Filtros */}
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div style={{ minWidth: 150 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '.4px' }}>Materia</div>
              <select style={selectStyle} value={materia} onChange={e => setMateria(e.target.value)}>
                <option value="">Todas</option>
                {MATERIAS.map(m => <option key={m}>{m}</option>)}
              </select>
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '.4px' }}>Rol procesal</div>
              <div style={{ display: 'flex', gap: 6 }}>
                {[['todos', 'Todos'], ['actor', 'Actor'], ['demandado', 'Demandado']].map(([v, l]) => (
                  <button
                    key={v} type="button"
                    onClick={() => setRolFiltro(v)}
                    style={{
                      padding: '7px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                      borderRadius: 'var(--radius)', border: '1px solid var(--border)',
                      background: rolFiltro === v ? 'var(--primary)' : 'var(--surface)',
                      color: rolFiltro === v ? '#fff' : 'var(--text)',
                    }}
                  >{l}</button>
                ))}
              </div>
            </div>
          </div>

          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            🔎 Busca simultáneamente en el boletín judicial y en tus expedientes registrados.
          </div>
        </form>

        {/* ── Error ── */}
        {error && (
          <div style={{ padding: '12px 16px', background: 'var(--danger-bg)', color: 'var(--danger-text)', borderRadius: 'var(--radius)', marginBottom: 20, fontSize: 13 }}>
            ⚠️ {error}
          </div>
        )}

        {/* ── Stats rápidas ── */}
        {resultados !== null && resultados.length > 0 && (
          <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
            <StatPill label="Total encontrados" value={total} color="var(--primary)" />
            <StatPill label="En tu sistema" value={enSistema} color="var(--success, #10b981)" />
            <StatPill label="Solo en boletín" value={soloBoletín} color="var(--text-muted)" />
          </div>
        )}

        {/* ── Sin resultados ── */}
        {resultados !== null && resultados.length === 0 && (
          <div style={{ textAlign: 'center', padding: '48px 24px', color: 'var(--text-muted)' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🔍</div>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 6 }}>Sin resultados</div>
            <div style={{ fontSize: 13 }}>
              No encontramos "{nombre}" en el boletín judicial ni en tus expedientes.
            </div>
            <div style={{ fontSize: 12, marginTop: 8 }}>
              El boletín se actualiza cada noche de lunes a viernes.
            </div>
          </div>
        )}

        {/* ── Resultados ── */}
        {resultados && resultados.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {resultados.map(exp => (
              <TarjetaExpediente
                key={exp.expediente_num}
                exp={exp}
                termBuscado={nombre.trim()}
                onImportar={() => abrirImportar(exp)}
                onVerExpediente={() => navigate(`/app/expedientes?id=${exp.expediente_id}`)}
              />
            ))}
          </div>
        )}

        {/* ── Estado inicial ── */}
        {resultados === null && !cargando && (
          <div style={{ textAlign: 'center', padding: '48px 24px', color: 'var(--text-muted)' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🏛️</div>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 6 }}>
              Buscador de Partes — Jalisco
            </div>
            <div style={{ fontSize: 13, maxWidth: 440, margin: '0 auto', lineHeight: 1.7 }}>
              Escribe el nombre de una persona física o empresa para ver en qué
              expedientes aparece, en qué juzgados y su rol procesal.
            </div>
          </div>
        )}
      </div>

      {/* ── Modal importar ── */}
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
              <input style={inputStyle} value={formImportar.num}
                onChange={e => setFormImportar(p => ({ ...p, num: e.target.value }))} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <div style={smallLabel}>Materia</div>
                <input style={inputStyle} value={formImportar.materia}
                  onChange={e => setFormImportar(p => ({ ...p, materia: e.target.value }))} />
              </div>
              <div>
                <div style={smallLabel}>Etapa Procesal</div>
                <input style={inputStyle} value={formImportar.etapa}
                  onChange={e => setFormImportar(p => ({ ...p, etapa: e.target.value }))} />
              </div>
            </div>
            <div>
              <div style={smallLabel}>Juzgado</div>
              <input style={inputStyle} value={formImportar.juzgado}
                onChange={e => setFormImportar(p => ({ ...p, juzgado: e.target.value }))} />
            </div>
            <div>
              <div style={smallLabel}>Actor / Solicitante</div>
              <input style={inputStyle} value={formImportar.actor} placeholder="Nombre del Actor"
                onChange={e => setFormImportar(p => ({ ...p, actor: e.target.value }))} />
            </div>
            <div>
              <div style={smallLabel}>Demandado / Requerido</div>
              <input style={inputStyle} value={formImportar.demandado} placeholder="Nombre del Demandado"
                onChange={e => setFormImportar(p => ({ ...p, demandado: e.target.value }))} />
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}

// ── Sub-componentes ───────────────────────────────────────────────────────────

function TarjetaExpediente({ exp, termBuscado, onImportar, onVerExpediente }) {
  const esMio    = exp.fuentes.includes('mis_expedientes')
  const termU    = normalizar(termBuscado)
  const actorMatch    = exp.actor    && normalizar(exp.actor).includes(termU)
  const demandadoMatch = exp.demandado && normalizar(exp.demandado).includes(termU)

  return (
    <div style={{
      background: 'var(--surface)', borderRadius: 'var(--radius)',
      border: esMio ? '1px solid var(--primary)' : '1px solid var(--border)',
      padding: '14px 16px',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Número + badges fuente */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
            <span style={{ fontFamily: 'monospace', fontSize: 15, fontWeight: 800, color: 'var(--primary)' }}>
              {exp.expediente_num}
            </span>
            {esMio && (
              <span style={{
                fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 999,
                background: 'var(--primary)', color: '#fff',
              }}>
                En tu sistema
              </span>
            )}
            {exp.fuentes.includes('boletin') && (
              <span style={{
                fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 999,
                background: 'var(--surface-3, #f1f5f9)', color: 'var(--text-muted)',
              }}>
                Boletín Judicial
              </span>
            )}
            {exp.estado && (
              <span style={{
                fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 999,
                background: exp.estado === 'Activo' ? '#dcfce7' : '#f1f5f9',
                color: exp.estado === 'Activo' ? '#16a34a' : '#64748b',
              }}>
                {exp.estado}
              </span>
            )}
          </div>

          {/* Juzgado + materia */}
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>
            {exp.juzgado && <span>🏛️ {exp.juzgado}</span>}
            {exp.juzgado && exp.materia && <span style={{ margin: '0 6px', opacity: .4 }}>·</span>}
            {exp.materia && <span style={{ fontWeight: 600 }}>{exp.materia}</span>}
            {exp.partido_judicial && exp.partido_judicial !== 'ZMG' && (
              <span style={{ marginLeft: 6, opacity: .7 }}>— {exp.partido_judicial}</span>
            )}
          </div>

          {/* Partes */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {exp.actor && (
              <span style={{
                fontSize: 12, padding: '3px 10px', borderRadius: 999,
                background: actorMatch ? '#dbeafe' : 'var(--surface-3, #f8fafc)',
                color: actorMatch ? '#1d4ed8' : 'var(--text-muted)',
                fontWeight: actorMatch ? 700 : 500,
                border: actorMatch ? '1px solid #93c5fd' : '1px solid transparent',
              }}>
                Actor: {exp.actor}
              </span>
            )}
            {exp.demandado && (
              <span style={{
                fontSize: 12, padding: '3px 10px', borderRadius: 999,
                background: demandadoMatch ? '#fef3c7' : 'var(--surface-3, #f8fafc)',
                color: demandadoMatch ? '#92400e' : 'var(--text-muted)',
                fontWeight: demandadoMatch ? 700 : 500,
                border: demandadoMatch ? '1px solid #fcd34d' : '1px solid transparent',
              }}>
                Demandado: {exp.demandado}
              </span>
            )}
          </div>
        </div>

        {/* Acciones */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8, flexShrink: 0 }}>
          {exp.fecha && (
            <div style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'right' }}>
              <div>Último acuerdo</div>
              <div style={{ fontWeight: 600, color: 'var(--text)' }}>{fmtFecha(exp.fecha)}</div>
            </div>
          )}
          {esMio ? (
            <button
              onClick={onVerExpediente}
              style={{
                background: 'var(--primary)', color: '#fff', border: 'none',
                borderRadius: 'var(--radius)', padding: '6px 12px',
                fontSize: 11, fontWeight: 700, cursor: 'pointer',
              }}
            >
              Ver expediente →
            </button>
          ) : (
            <button
              onClick={onImportar}
              style={{
                background: 'transparent', color: 'var(--primary)',
                border: '1px solid var(--primary)',
                borderRadius: 'var(--radius)', padding: '6px 12px',
                fontSize: 11, fontWeight: 700, cursor: 'pointer',
              }}
            >
              ✨ Importar
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function StatPill({ label, value, color }) {
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 8,
      background: 'var(--surface)', border: '1px solid var(--border)',
      borderRadius: 'var(--radius)', padding: '6px 14px',
    }}>
      <span style={{ fontSize: 18, fontWeight: 800, color }}>{value}</span>
      <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{label}</span>
    </div>
  )
}

function SpinIcon() {
  return (
    <span style={{ display: 'inline-block', animation: 'spin 1s linear infinite' }}>⟳</span>
  )
}
