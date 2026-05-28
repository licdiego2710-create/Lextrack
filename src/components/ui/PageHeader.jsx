// Encabezado de página: título, subtítulo y slot de acciones.
export default function PageHeader({ title, subtitle, actions }) {
  return (
    <>
      <style>{`
        @media (max-width: 1023px) {
          .lx-page-header { margin-bottom: 14px !important; padding-bottom: 12px !important; }
          .lx-page-header h1 { font-size: 18px !important; }
          .lx-page-header p { font-size: 12px !important; }
        }
      `}</style>
      <div className="lx-page-header" style={{
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'space-between',
        gap: '16px',
        flexWrap: 'wrap',
        marginBottom: '20px',
        paddingBottom: '16px',
        borderBottom: '1px solid var(--border)',
      }}>
        <div>
          <h1 style={{
            fontSize: '22px',
            fontWeight: 700,
            color: 'var(--text)',
            margin: 0,
            letterSpacing: '-0.2px',
          }}>{title}</h1>
          {subtitle && (
            <p style={{
              fontSize: '13px',
              color: 'var(--text-muted)',
              marginTop: '4px',
            }}>{subtitle}</p>
          )}
        </div>
        {actions && (
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>{actions}</div>
        )}
      </div>
    </>
  )
}
