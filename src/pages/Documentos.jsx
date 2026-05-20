import { fmtFecha } from '../utils/helpers'
import PageHeader from '../components/ui/PageHeader'
import EmptyState from '../components/ui/EmptyState'

const TIPO_COLOR = {
  PDF: '#dc2626',
  DOCX: '#2563eb',
  XLSX: '#16a34a',
  JPG: '#a855f7',
  PNG: '#a855f7',
}

export default function Documentos() {
  const documentos = []

  return (
    <div>
      <PageHeader
        title="Documentos"
        subtitle="Repositorio centralizado de archivos por expediente"
        actions={
          <button style={btnPri} disabled title="Próximamente">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M17 8l-5-5-5 5"/><path d="M12 3v12"/>
            </svg>
            Subir archivo
          </button>
        }
      />

      {documentos.length === 0 ? (
        <EmptyState
          icon={
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/><path d="M9 13h6"/><path d="M9 17h4"/>
            </svg>
          }
          title="Sin documentos"
          description="El módulo de documentos estará disponible próximamente. Podrás subir y organizar archivos por expediente."
        />
      ) : (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)' }}>
          <table className="lx-table" style={{ border: 'none' }}>
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Expediente</th>
                <th>Subido por</th>
                <th>Tamaño</th>
                <th>Fecha</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {documentos.map(d => (
                <tr key={d.id}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{
                        width: 36, height: 36, borderRadius: 8,
                        background: `${TIPO_COLOR[d.tipo] || 'var(--muted)'}22`,
                        color: TIPO_COLOR[d.tipo] || 'var(--muted)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 10, fontWeight: 800,
                      }}>{d.tipo}</div>
                      <div style={{ fontSize: 13, color: 'var(--text)' }}>{d.nombre}</div>
                    </div>
                  </td>
                  <td style={{ fontSize: 12, color: 'var(--primary)', fontWeight: 600 }}>{d.expediente}</td>
                  <td style={{ fontSize: 12 }}>{d.subidoPor}</td>
                  <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{d.tamano}</td>
                  <td style={{ fontSize: 12 }}>{fmtFecha(d.fecha)}</td>
                  <td>
                    <button style={btnIcon}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M7 10l5 5 5-5"/><path d="M12 15V3"/>
                      </svg>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

const btnPri = {
  background: 'var(--primary)', color: '#fff', border: 'none',
  borderRadius: 'var(--radius)', padding: '9px 16px', fontSize: 13, fontWeight: 600,
  cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6,
  opacity: .6,
}
const btnIcon = {
  background: 'var(--surface-3)', border: '1px solid var(--border)', color: 'var(--text-secondary)',
  borderRadius: 'var(--radius-sm)', padding: '6px 8px', cursor: 'pointer',
}
