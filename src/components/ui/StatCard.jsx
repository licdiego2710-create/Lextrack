// KPI card. Acepta color tema y tendencia.
export default function StatCard({ title, value, subtitle, color = 'var(--primary)', trend, trendUp, icon }) {
  return (
    <div style={{
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-lg)',
      padding: '18px 20px',
      boxShadow: 'var(--shadow)',
      position: 'relative',
      overflow: 'hidden',
    }}>
      <div style={{
        position: 'absolute', top: 0, left: 0, width: '4px', height: '100%',
        background: color,
      }}/>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
        <div style={{
          fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)',
          textTransform: 'uppercase', letterSpacing: '0.6px',
        }}>{title}</div>
        {icon && (
          <div style={{
            width: 32, height: 32, borderRadius: '8px',
            background: 'color-mix(in srgb, ' + color + ' 12%, transparent)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: color,
          }}>{icon}</div>
        )}
      </div>
      <div style={{ fontSize: '26px', fontWeight: 800, color: 'var(--text)', lineHeight: 1.1 }}>{value}</div>
      {subtitle && (
        <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '6px' }}>{subtitle}</div>
      )}
      {trend !== undefined && trend !== null && (
        <div style={{
          marginTop: '8px',
          display: 'inline-flex', alignItems: 'center', gap: '4px',
          fontSize: '11px', fontWeight: 700,
          color: trendUp ? 'var(--success)' : 'var(--danger)',
        }}>
          <span>{trendUp ? '↑' : '↓'}</span>
          <span>{trend}</span>
        </div>
      )}
    </div>
  )
}
