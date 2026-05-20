import { useEffect, useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell, Legend } from 'recharts'
import { supabase } from '../supabaseClient'
import { MATERIAS } from '../utils/helpers'
import StatCard from '../components/ui/StatCard'
import PageHeader from '../components/ui/PageHeader'
import EmptyState from '../components/ui/EmptyState'

const ESTADO_COLORS = { Activo: '#2563eb', Vencido: '#dc2626', Suspendido: '#94a3b8', Concluido: '#16a34a' }
const MATERIA_COLORS = ['#2563eb', '#16a34a', '#d97706', '#8b5cf6', '#0891b2']
const MESES_LABELS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

export default function Estadisticas({ session }) {
  const [expedientes, setExpedientes] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!session) return
    let alive = true
    ;(async () => {
      const { data } = await supabase.from('expedientes').select('*')
      if (alive) { setExpedientes(data || []); setLoading(false) }
    })()
    return () => { alive = false }
  }, [session])

  const total = expedientes.length
  const activos = expedientes.filter(e => e.estado === 'Activo').length
  const vencidos = expedientes.filter(e => e.estado === 'Vencido').length
  const concluidos = expedientes.filter(e => e.estado === 'Concluido').length
  const suspendidos = expedientes.filter(e => e.estado === 'Suspendido').length

  const porEstado = Object.entries(ESTADO_COLORS)
    .map(([name, color]) => ({ name, value: expedientes.filter(e => e.estado === name).length, color }))
    .filter(d => d.value > 0)

  const porMateria = MATERIAS.map((m, i) => ({
    materia: m,
    total: expedientes.filter(e => e.materia === m).length,
    color: MATERIA_COLORS[i],
  })).filter(d => d.total > 0).sort((a, b) => b.total - a.total)

  // Expedientes creados por mes en el año actual
  const anioActual = new Date().getFullYear()
  const porMes = MESES_LABELS.map((mes, i) => ({
    mes,
    total: expedientes.filter(e => {
      if (!e.creado_en) return false
      const d = new Date(e.creado_en)
      return d.getFullYear() === anioActual && d.getMonth() === i
    }).length,
  }))

  function generarReporte() {
    const filasMes = porMes.map(m => `<tr><td>${m.mes}</td><td>${m.total}</td></tr>`).join('')
    const filasMateria = porMateria.map(m => `<tr><td>${m.materia}</td><td>${m.total}</td><td>${total ? Math.round(m.total / total * 100) : 0}%</td></tr>`).join('')

    const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>Reporte Estadístico</title><style>
      body{font-family:-apple-system,sans-serif;color:#0f172a;padding:40px 50px;max-width:900px;margin:0 auto}
      .head{border-bottom:3px solid #2563eb;padding-bottom:20px;margin-bottom:30px}
      h1{font-size:24px;color:#0f172a;margin:0}
      .sub{color:#64748b;font-size:13px;margin-top:4px}
      .fecha{color:#64748b;font-size:12px;margin-top:8px}
      .kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-bottom:28px}
      .kpi{background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:16px}
      .kpi-l{font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:.5px;font-weight:700}
      .kpi-v{font-size:28px;color:#2563eb;font-weight:800;margin-top:4px}
      h2{font-size:13px;color:#64748b;text-transform:uppercase;letter-spacing:1px;margin:24px 0 12px;border-bottom:2px solid #e2e8f0;padding-bottom:6px}
      table{width:100%;border-collapse:collapse;font-size:13px}
      th{background:#f8fafc;color:#64748b;text-transform:uppercase;font-size:11px;font-weight:700;padding:10px 14px;text-align:left;border-bottom:1px solid #e2e8f0}
      td{padding:10px 14px;border-bottom:1px solid #f1f5f9}
      .footer{margin-top:36px;font-size:11px;color:#94a3b8;text-align:center;border-top:1px solid #e2e8f0;padding-top:14px}
      @media print{body{padding:20px}}
    </style></head><body>
      <div class="head">
        <h1>Reporte Estadístico ${anioActual}</h1>
        <div class="sub">LexTrack MX · Sistema de Seguimiento de Expedientes</div>
        <div class="fecha">Generado el ${new Date().toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' })}</div>
      </div>
      <div class="kpis">
        <div class="kpi"><div class="kpi-l">Total expedientes</div><div class="kpi-v">${total}</div></div>
        <div class="kpi"><div class="kpi-l">Activos</div><div class="kpi-v" style="color:#2563eb">${activos}</div></div>
        <div class="kpi"><div class="kpi-l">Vencidos</div><div class="kpi-v" style="color:#dc2626">${vencidos}</div></div>
        <div class="kpi"><div class="kpi-l">Concluidos</div><div class="kpi-v" style="color:#16a34a">${concluidos}</div></div>
      </div>
      <h2>Por materia</h2>
      <table><thead><tr><th>Materia</th><th>Expedientes</th><th>%</th></tr></thead><tbody>${filasMateria}</tbody></table>
      <h2>Altas por mes (${anioActual})</h2>
      <table><thead><tr><th>Mes</th><th>Expedientes</th></tr></thead><tbody>${filasMes}</tbody></table>
      <div class="footer">LexTrack MX · Reporte generado automáticamente</div>
    </body></html>`
    const w = window.open('', '_blank')
    w.document.write(html); w.document.close()
    setTimeout(() => w.print(), 250)
  }

  if (loading) return (
    <div style={{ textAlign: 'center', padding: 64, color: 'var(--text-muted)', fontSize: 13 }}>Cargando estadísticas...</div>
  )

  if (!total) return (
    <div>
      <PageHeader title="Estadísticas" subtitle="Métricas de expedientes del despacho"/>
      <EmptyState
        icon={
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M3 3v18h18"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/>
          </svg>
        }
        title="Sin datos suficientes"
        description="Registra expedientes para ver estadísticas del despacho."
      />
    </div>
  )

  return (
    <div>
      <PageHeader
        title="Estadísticas"
        subtitle={`Métricas basadas en ${total} expediente${total !== 1 ? 's' : ''} registrado${total !== 1 ? 's' : ''}`}
        actions={
          <button onClick={generarReporte} style={btnPri}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/><path d="M9 13h6"/>
            </svg>
            Generar reporte
          </button>
        }
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 14, marginBottom: 20 }}>
        <StatCard title="Total" value={total} color="var(--primary)"/>
        <StatCard title="Activos" value={activos} subtitle={`${total ? Math.round(activos / total * 100) : 0}%`} color="var(--success)"/>
        <StatCard title="Vencidos" value={vencidos} subtitle={`${total ? Math.round(vencidos / total * 100) : 0}%`} color="var(--danger)"/>
        <StatCard title="Suspendidos" value={suspendidos} color="var(--text-muted)"/>
        <StatCard title="Concluidos" value={concluidos} subtitle={`${total ? Math.round(concluidos / total * 100) : 0}%`} color="var(--info)"/>
      </div>

      <div style={{ ...chartCard, marginBottom: 16 }}>
        <div style={chartTitle}>Altas por mes · {anioActual}</div>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={porMes}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false}/>
            <XAxis dataKey="mes" stroke="var(--text-muted)" fontSize={11}/>
            <YAxis stroke="var(--text-muted)" fontSize={11} allowDecimals={false}/>
            <Tooltip contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }}/>
            <Bar dataKey="total" name="Expedientes" fill="var(--primary)" radius={[4, 4, 0, 0]}/>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 16 }}>
        {porEstado.length > 0 && (
          <div style={chartCard}>
            <div style={chartTitle}>Por estado</div>
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={porEstado} dataKey="value" nameKey="name" outerRadius={90} innerRadius={50} paddingAngle={2}>
                  {porEstado.map((d, i) => <Cell key={i} fill={d.color}/>)}
                </Pie>
                <Tooltip contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }}/>
                <Legend wrapperStyle={{ fontSize: 12 }}/>
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}

        {porMateria.length > 0 && (
          <div style={chartCard}>
            <div style={chartTitle}>Por materia</div>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={porMateria} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false}/>
                <XAxis type="number" stroke="var(--text-muted)" fontSize={11} allowDecimals={false}/>
                <YAxis dataKey="materia" type="category" stroke="var(--text-muted)" fontSize={11} width={100}/>
                <Tooltip contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }}/>
                <Bar dataKey="total" name="Expedientes" radius={[0, 4, 4, 0]}>
                  {porMateria.map((d, i) => <Cell key={i} fill={d.color}/>)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  )
}

const chartCard = {
  background: 'var(--surface)', border: '1px solid var(--border)',
  borderRadius: 'var(--radius-lg)', padding: '18px 20px',
  boxShadow: 'var(--shadow)',
}
const chartTitle = {
  fontSize: 12, fontWeight: 700, color: 'var(--text-muted)',
  textTransform: 'uppercase', letterSpacing: '1px',
  marginBottom: 14, paddingBottom: 10, borderBottom: '1px solid var(--border)',
}
const btnPri = {
  background: 'var(--primary)', color: '#fff', border: 'none',
  borderRadius: 'var(--radius)', padding: '9px 16px', fontSize: 13, fontWeight: 600,
  cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6,
}
