import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts'
import { supabase } from '../supabaseClient'
import { diasHasta, fmtFecha, urgencyColor, MATERIAS } from '../utils/helpers'
import StatCard from '../components/ui/StatCard'
import PageHeader from '../components/ui/PageHeader'
import EmptyState from '../components/ui/EmptyState'
import { useOrg } from '../context/OrgContext'

const ESTADO_COLORS = {
  Activo: '#2563eb',
  Vencido: '#dc2626',
  Suspendido: '#94a3b8',
  Concluido: '#16a34a',
}

export default function Dashboard({ session }) {
  const { miembro } = useOrg()
  const navigate = useNavigate()
  const isCliente = miembro?.rol === 'cliente'
  
  const [expedientes, setExpedientes] = useState([])
  const [boletinHoy, setBoletinHoy] = useState([])
  const [prospectos, setProspectos] = useState([])
  const [audienciasProximas, setAudienciasProximas] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    ;(async () => {
      if (!session) return
      const hoy = new Date().toISOString().slice(0, 10)
      const queries = [
        supabase.from('expedientes').select('*').order('termino', { ascending: true, nullsFirst: false }),
        supabase.from('acuerdos_boletin').select('id, expediente_id, descripcion, fecha, leido')
          .gte('creado_en', hoy + 'T00:00:00')
          .lte('creado_en', hoy + 'T23:59:59')
          .order('creado_en', { ascending: false })
          .limit(20),
        !isCliente
          ? supabase.from('prospectos').select('*')
          : Promise.resolve({ data: [] }),
        supabase.from('expediente_audiencias').select('id').gte('fecha_hora', hoy + 'T00:00:00')
      ]
      
      const [{ data: expData }, { data: actBoletin }, { data: prospsData }, { data: audsData }] = await Promise.all(queries)
      
      if (!alive) return
      
      setBoletinHoy(actBoletin || [])
      setProspectos(prospsData || [])
      setAudienciasProximas(audsData ? audsData.length : 0)
      
      const lista = expData || []
      // auto-marcar vencidos
      try {
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
    })()
    
    return () => { alive = false }
  }, [session, isCliente])

  // KPIs
  const activos = expedientes.filter(e => e.estado === 'Activo').length
  const concluidos = expedientes.filter(e => e.estado === 'Concluido' || e.etapa === 'Concluido').length
  
  // Expedientes en ejecución (etapa procesal en alguna de ejecución, embargo, avalúo, remate o adjudicación)
  const etapasEjecucion = ['Ejecución de sentencia', 'Embargo', 'Avalúo', 'Remate', 'Adjudicación']
  const enEjecucion = expedientes.filter(e => etapasEjecucion.includes(e.etapa)).length
  
  const urgentes = expedientes.filter(e => {
    const d = diasHasta(e.proxima_fecha || e.termino)
    return d !== null && d >= 0 && d <= 3 && e.estado === 'Activo'
  }).length
  
  const vencidos = expedientes.filter(e => e.estado === 'Vencido').length
  
  // Términos próximos a vencer (en los siguientes 7 días)
  const terminosProximos = expedientes.filter(e => {
    const d = diasHasta(e.termino)
    return d !== null && d >= 0 && d <= 7 && e.estado === 'Activo'
  }).length

  // Prospectos
  const prospectosNuevos = prospectos.filter(p => p.etapa === 'Nuevo contacto').length
  const prospectosSinSeguimiento = prospectos.filter(p => !p.proximo_seguimiento && !['Contratado','No contratado','Perdido'].includes(p.etapa)).length

  const expPorId = Object.fromEntries(expedientes.map(e => [e.id, e]))

  const pendUrg = expedientes.filter(e => {
    const d = diasHasta(e.proxima_fecha || e.termino)
    return e.estado === 'Activo' && d !== null && d <= 3
  }).slice(0, 5)

  const pend7 = expedientes.filter(e => {
    const d = diasHasta(e.termino)
    return e.estado === 'Activo' && d !== null && d >= 0 && d <= 7
  }).sort((a, b) => diasHasta(a.termino) - diasHasta(b.termino)).slice(0, 6)

  const porMateria = MATERIAS.map(m => ({
    materia: m,
    total: expedientes.filter(e => e.materia === m).length,
  })).filter(d => d.total > 0)

  const porEstado = ['Activo', 'Vencido', 'Suspendido', 'Concluido'].map(estado => ({
    name: estado,
    value: expedientes.filter(e => e.estado === estado).length,
    color: ESTADO_COLORS[estado],
  })).filter(d => d.value > 0)

  if (loading) {
    return <PageHeader title="Inicio" subtitle="Cargando resumen de actividad..."/>
  }

  return (
    <div>
      <PageHeader
        title="Inicio"
        subtitle="Resumen general de tu actividad jurídica y despacho"
      />

      {(vencidos > 0 || urgentes > 0) && (
        <div style={{
          background: 'var(--warning-bg)',
          border: '1px solid var(--warning)',
          borderRadius: 'var(--radius-lg)',
          padding: '14px 18px',
          marginBottom: 20,
          display: 'flex', alignItems: 'center', gap: 14,
          color: 'var(--warning-text)',
        }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10.3 3.86l-8.39 14a2 2 0 0 0 1.71 3h16.78a2 2 0 0 0 1.71-3l-8.39-14a2 2 0 0 0-3.42 0Z"/>
            <path d="M12 9v4"/><path d="M12 17h.01"/>
          </svg>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 700 }}>Atención requerida</div>
            <div style={{ fontSize: 13 }}>
              {vencidos > 0 && `${vencidos} expediente(s) con término vencido`}
              {vencidos > 0 && urgentes > 0 && ' · '}
              {urgentes > 0 && `${urgentes} con vencimiento o fecha límite en los próximos 3 días`}
            </div>
          </div>
        </div>
      )}

      {/* ⚡ Barra de Accesos Rápidos */}
      <div style={{
        background: 'var(--surface-3)', border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)', padding: '16px 20px', marginBottom: 24
      }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 12 }}>
          ⚡ Accesos Rápidos
        </div>
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10
        }}>
          <button onClick={() => navigate('/app/expedientes?action=nuevo')} style={shortcutBtn}>
            ➕ Agregar expediente
          </button>
          <button onClick={() => navigate('/app/prospectos?action=nuevo')} style={shortcutBtn}>
            👥 Agregar prospecto
          </button>
          <button onClick={() => navigate('/app/expedientes')} style={shortcutBtn}>
            ⏳ Términos próximos
          </button>
          <button onClick={() => navigate('/app/agenda')} style={shortcutBtn}>
            📅 Próximas audiencias
          </button>
          <button onClick={() => navigate('/app/expedientes')} style={shortcutBtn}>
            ⚖️ Expedientes por etapa
          </button>
          <button onClick={() => navigate('/app/prospectos?seguimiento=pendiente')} style={shortcutBtn}>
            👥 Prospectos pendientes
          </button>
        </div>
      </div>

      {/* 📊 Tarjetas de Estado / KPIs */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
        gap: 12,
        marginBottom: 24,
      }}>
        <StatCard title="Exp. Activos" value={activos} subtitle="En trámite" color="var(--primary)"/>
        <StatCard title="Vencimientos" value={terminosProximos} subtitle="Próximos 7 días" color="var(--warning)"/>
        <StatCard title="Audiencias" value={audienciasProximas} subtitle="Próximas programadas" color="var(--info)"/>
        <StatCard title="Prospectos Nuevos" value={prospectosNuevos} subtitle="Sin contactar" color="#8b5cf6"/>
        <StatCard title="Sin Seguimiento" value={prospectosSinSeguimiento} subtitle="Prospectos sin fecha" color="var(--danger)"/>
        <StatCard title="En Ejecución" value={enEjecucion} subtitle="Etapa ejecución/remate" color="#ec4899"/>
        <StatCard title="Exp. Concluidos" value={concluidos} subtitle="Historial cerrado" color="var(--success)"/>
      </div>

      {/* Gráficas */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
        gap: 16,
        marginBottom: 24,
      }}>
        <div style={chartCard}>
          <div style={chartTitle}>Por materia</div>
          {porMateria.length === 0 ? (
            <EmptyState title="Sin datos" subtitle="Aún no hay expedientes registrados."/>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={porMateria}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false}/>
                <XAxis dataKey="materia" stroke="var(--text-muted)" fontSize={11}/>
                <YAxis stroke="var(--text-muted)" fontSize={11} allowDecimals={false}/>
                <Tooltip
                  contentStyle={{
                    background: 'var(--surface)',
                    border: '1px solid var(--border)',
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
                <Bar dataKey="total" fill="var(--primary)" radius={[6, 6, 0, 0]}/>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div style={chartCard}>
          <div style={chartTitle}>Por estado</div>
          {porEstado.length === 0 ? (
            <EmptyState title="Sin datos" subtitle="No hay datos para graficar."/>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie data={porEstado} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} innerRadius={48} paddingAngle={2}>
                  {porEstado.map((d, i) => <Cell key={i} fill={d.color}/>)}
                </Pie>
                <Tooltip
                  contentStyle={{
                    background: 'var(--surface)',
                    border: '1px solid var(--border)',
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 12 }}/>
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Listas de Trabajo */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
        gap: 16,
        marginBottom: 24,
      }}>
        <div style={chartCard}>
          <div style={chartTitle}>Urgencias (Próximos 3 días)</div>
          {pendUrg.length === 0 ? (
            <EmptyState title="Todo al día" subtitle="No hay expedientes con plazos urgentes."/>
          ) : (
            <div>
              {pendUrg.map(e => {
                const d = diasHasta(e.proxima_fecha || e.termino)
                const u = urgencyColor(d)
                return (
                  <div key={e.id} style={listRow}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--primary)' }}>{e.num}</div>
                      <div style={{ fontSize: 13, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {e.actor} <span style={{ color: 'var(--text-muted)' }}>vs.</span> {e.demandado}
                      </div>
                    </div>
                    <span style={{ background: u.bg, color: u.color, fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 999, whiteSpace: 'nowrap' }}>
                      {u.label}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <div style={chartCard}>
          <div style={chartTitle}>Vencimientos (Próximos 7 días)</div>
          {pend7.length === 0 ? (
            <EmptyState title="Sin vencimientos" subtitle="No hay términos para los próximos 7 días."/>
          ) : (
            <div>
              {pend7.map(e => {
                const d = diasHasta(e.termino)
                const u = urgencyColor(d)
                return (
                  <div key={e.id} style={listRow}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: u.color, flexShrink: 0 }}/>
                    <div style={{ fontSize: 12, color: 'var(--primary)', fontWeight: 700, minWidth: 70 }}>{e.num}</div>
                    <div style={{ flex: 1, fontSize: 13, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {e.actor}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                      {fmtFecha(e.termino)}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Movimientos del Boletín Judicial */}
      <div style={{ ...chartCard, marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, paddingBottom: 10, borderBottom: '1px solid var(--border)' }}>
          <div style={{ ...chartTitle, marginBottom: 0, paddingBottom: 0, borderBottom: 'none' }}>Movimientos del Boletín Judicial — Hoy</div>
          <span style={{
            background: boletinHoy.length > 0 ? 'var(--info-bg)' : 'var(--muted-bg)',
            color: boletinHoy.length > 0 ? 'var(--info-text)' : 'var(--muted-text)',
            fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 999,
          }}>{boletinHoy.length} acuerdo{boletinHoy.length !== 1 ? 's' : ''}</span>
        </div>
        {boletinHoy.length === 0 ? (
          <EmptyState
            title="Sin movimientos hoy"
            subtitle="El scraper aún no ha procesado el boletín de hoy, o no hay acuerdos para tus expedientes."
          />
        ) : (
          <div>
            {boletinHoy.map(a => {
              const exp = expPorId[a.expediente_id]
              const desc = (a.descripcion || '').replace(/^\[Auto-detectado \/ Boletín Judicial\]\s*/i, '')
              return (
                <div key={a.id} style={{ ...listRow, alignItems: 'flex-start', gap: 14 }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: 8,
                    background: a.leido ? 'var(--muted-bg)' : 'var(--info-bg)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={a.leido ? 'var(--text-muted)' : 'var(--info-text)'} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                      <path d="M14 2v6h6"/><path d="M16 13H8"/><path d="M16 17H8"/><path d="M10 9H8"/>
                    </svg>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    {exp && (
                      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--primary)', marginBottom: 2 }}>
                        {exp.num} · {exp.actor} <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>vs.</span> {exp.demandado}
                      </div>
                    )}
                    <div style={{ fontSize: 12, color: 'var(--text)', lineHeight: 1.5, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                      {desc || 'Acuerdo publicado en el Boletín CJJ'}
                    </div>
                    {a.fecha && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>📅 {fmtFecha(a.fecha)}</div>}
                  </div>
                  <span style={{
                    background: a.leido ? 'var(--muted-bg)' : 'var(--danger-bg)',
                    color: a.leido ? 'var(--text-muted)' : 'var(--danger-text)',
                    fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 999, whiteSpace: 'nowrap', flexShrink: 0,
                  }}>{a.leido ? 'Leído' : 'Nuevo'}</span>
                </div>
              )
            })}
          </div>
        )}
      </div>

    </div>
  )
}

const chartCard = {
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-lg)',
  padding: '18px 20px',
  boxShadow: 'var(--shadow)',
}
const chartTitle = {
  fontSize: 12, fontWeight: 700, color: 'var(--text-muted)',
  textTransform: 'uppercase', letterSpacing: '1px',
  marginBottom: 14,
  paddingBottom: 10,
  borderBottom: '1px solid var(--border)',
}
const listRow = {
  display: 'flex', alignItems: 'center', gap: 10,
  padding: '10px 0',
  borderBottom: '1px solid var(--border)',
}
const shortcutBtn = {
  background: 'var(--surface)',
  color: 'var(--text)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius)',
  padding: '10px 12px',
  fontSize: 12,
  fontWeight: 600,
  cursor: 'pointer',
  textAlign: 'center',
  transition: 'all 0.15s ease',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 8,
}
