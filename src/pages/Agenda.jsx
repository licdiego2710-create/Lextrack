import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { fmtFechaLarga } from '../utils/helpers'
import PageHeader from '../components/ui/PageHeader'
import EmptyState from '../components/ui/EmptyState'

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
const DIAS_SEM = ['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sa', 'Do']

const TIPO_COLOR = {
  vencimiento: 'var(--danger)',
  tarea: 'var(--warning)',
  audiencia: 'var(--primary)',
}

export default function Agenda({ session }) {
  const [expedientes, setExpedientes] = useState([])
  const [tareas, setTareas] = useState([])
  const [fecha, setFecha] = useState(() => new Date())
  const [seleccionado, setSeleccionado] = useState(() => new Date().toISOString().slice(0, 10))

  useEffect(() => {
    if (!session) return
    let alive = true
    ;(async () => {
      const [{ data: exps }, { data: tars }] = await Promise.all([
        supabase.from('expedientes').select('*'),
        supabase.from('tareas').select('*'),
      ])
      if (!alive) return
      setExpedientes(exps || [])
      setTareas(tars || [])
    })()
    return () => { alive = false }
  }, [session])

  const year = fecha.getFullYear()
  const month = fecha.getMonth()
  const primerDia = new Date(year, month, 1)
  const ultimoDia = new Date(year, month + 1, 0)
  const startDow = (primerDia.getDay() + 6) % 7
  const hoyStr = new Date().toISOString().slice(0, 10)

  // Compilamos eventos por día desde múltiples fuentes
  const eventosPorDia = {}
  const push = (d, evt) => {
    if (!d) return
    if (!eventosPorDia[d]) eventosPorDia[d] = []
    eventosPorDia[d].push(evt)
  }
  expedientes.forEach(e => {
    if (e.termino) push(e.termino, { tipo: 'vencimiento', titulo: `Vencimiento ${e.num}`, sub: `${e.actor} vs. ${e.demandado}` })
  })
  tareas.forEach(t => {
    if (t.fecha_limite && t.estado !== 'Completada') push(t.fecha_limite, { tipo: 'tarea', titulo: t.titulo, sub: [t.responsable, t.expediente].filter(Boolean).join(' · ') })
  })

  const celdas = []
  for (let i = 0; i < startDow; i++) celdas.push(null)
  for (let d = 1; d <= ultimoDia.getDate(); d++) celdas.push(d)

  const eventosSel = eventosPorDia[seleccionado] || []

  return (
    <div>
      <PageHeader
        title="Agenda"
        subtitle="Vencimientos, tareas y audiencias en un solo calendario"
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 320px', gap: 16 }} className="lx-agenda-grid">
        {/* Calendario */}
        <div style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
          padding: 18,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
            <button onClick={() => setFecha(new Date(year, month - 1, 1))} style={btnIcon}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6"/></svg>
            </button>
            <div style={{ flex: 1, textAlign: 'center', fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>
              {MESES[month]} {year}
            </div>
            <button onClick={() => setFecha(new Date(year, month + 1, 1))} style={btnIcon}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18l6-6-6-6"/></svg>
            </button>
            <button onClick={() => { setFecha(new Date()); setSeleccionado(new Date().toISOString().slice(0, 10)) }} style={{ ...btnIcon, fontSize: 12, padding: '6px 12px' }}>Hoy</button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6, marginBottom: 6 }}>
            {DIAS_SEM.map(d => (
              <div key={d} style={{ textAlign: 'center', fontSize: 10, color: 'var(--text-muted)', fontWeight: 700, padding: '6px 0', letterSpacing: '1px' }}>{d}</div>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6 }}>
            {celdas.map((dia, i) => {
              if (!dia) return <div key={`v${i}`}/>
              const dStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`
              const eventos = eventosPorDia[dStr] || []
              const esHoy = dStr === hoyStr
              const esSel = dStr === seleccionado
              return (
                <button
                  key={dStr}
                  onClick={() => setSeleccionado(dStr)}
                  style={{
                    background: esSel ? 'var(--primary)' : esHoy ? 'var(--primary-soft)' : 'var(--surface-3)',
                    border: `1px solid ${esSel ? 'var(--primary)' : esHoy ? 'var(--primary)' : 'var(--border)'}`,
                    borderRadius: 'var(--radius)',
                    padding: 6,
                    minHeight: 70,
                    cursor: 'pointer',
                    color: esSel ? '#fff' : 'var(--text)',
                    textAlign: 'left',
                    transition: 'background .15s ease',
                  }}
                >
                  <div style={{ fontSize: 12, fontWeight: esHoy || esSel ? 700 : 500, marginBottom: 4 }}>{dia}</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {eventos.slice(0, 2).map((ev, j) => (
                      <div key={j} style={{
                        fontSize: 9, fontWeight: 600,
                        padding: '1px 5px', borderRadius: 4,
                        background: esSel ? 'rgba(255,255,255,.25)' : TIPO_COLOR[ev.tipo] + '22',
                        color: esSel ? '#fff' : TIPO_COLOR[ev.tipo],
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>{ev.titulo}</div>
                    ))}
                    {eventos.length > 2 && (
                      <div style={{ fontSize: 9, color: esSel ? '#fff' : 'var(--text-muted)' }}>+{eventos.length - 2}</div>
                    )}
                  </div>
                </button>
              )
            })}
          </div>

          {/* Leyenda */}
          <div style={{ display: 'flex', gap: 16, marginTop: 16, paddingTop: 12, borderTop: '1px solid var(--border)', flexWrap: 'wrap' }}>
            {[['vencimiento', 'Vencimientos'], ['tarea', 'Tareas'], ['audiencia', 'Audiencias']].map(([k, l]) => (
              <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--text-muted)' }}>
                <div style={{ width: 10, height: 10, borderRadius: 3, background: TIPO_COLOR[k] }}/>{l}
              </div>
            ))}
          </div>
        </div>

        {/* Panel lateral */}
        <div style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
          padding: 18,
          alignSelf: 'flex-start',
          maxHeight: 600,
          overflowY: 'auto',
        }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 700 }}>Día seleccionado</div>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', marginTop: 4, marginBottom: 14 }}>{fmtFechaLarga(seleccionado)}</div>

          {eventosSel.length === 0 ? (
            <EmptyState title="Sin eventos" subtitle="No hay vencimientos ni tareas programadas para este día."/>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {eventosSel.map((ev, i) => (
                <div key={i} style={{
                  display: 'flex', gap: 10,
                  padding: 12, borderRadius: 'var(--radius)',
                  border: '1px solid var(--border)',
                  background: 'var(--surface-3)',
                }}>
                  <div style={{ width: 4, borderRadius: 2, background: TIPO_COLOR[ev.tipo], flexShrink: 0 }}/>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 11, color: TIPO_COLOR[ev.tipo], fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.5px' }}>{ev.tipo}</div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{ev.titulo}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{ev.sub}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <style>{`
        @media (max-width: 1024px) {
          .lx-agenda-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  )
}

const btnIcon = {
  background: 'var(--surface-3)',
  border: '1px solid var(--border)',
  color: 'var(--text-secondary)',
  borderRadius: 'var(--radius)',
  padding: 8,
  cursor: 'pointer',
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
}
