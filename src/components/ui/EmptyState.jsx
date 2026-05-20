// Estado vacío amigable con un SVG ligero.
export default function EmptyState({ title = 'Sin resultados', subtitle, description, icon, action }) {
  const texto = subtitle || description
  return (
    <div style={{
      padding: '48px 24px',
      textAlign: 'center',
      background: 'var(--surface)',
      border: '1px dashed var(--border)',
      borderRadius: 'var(--radius-lg)',
      color: 'var(--text-muted)',
    }}>
      <div style={{
        width: 64, height: 64, borderRadius: '50%',
        background: 'var(--surface-3)',
        margin: '0 auto 16px',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: 'var(--text-muted)',
      }}>
        {icon || (
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="4" width="18" height="16" rx="2"/>
            <path d="M3 10h18"/>
            <path d="M9 14h6"/>
          </svg>
        )}
      </div>
      <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text)', marginBottom: '4px' }}>{title}</div>
      {texto && <div style={{ fontSize: '13px', maxWidth: 380, margin: '0 auto' }}>{texto}</div>}
      {action && <div style={{ marginTop: 16 }}>{action}</div>}
    </div>
  )
}
