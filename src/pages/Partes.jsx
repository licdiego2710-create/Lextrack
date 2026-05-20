import { useState } from 'react'
import { iniciales } from '../utils/helpers'
import PageHeader from '../components/ui/PageHeader'
import StatusBadge from '../components/ui/StatusBadge'
import EmptyState from '../components/ui/EmptyState'

export default function Partes() {
  const [buscar, setBuscar] = useState('')
  const partes = []

  const lista = partes.filter(p =>
    !buscar || `${p.nombre} ${p.expediente} ${p.tipo}`.toLowerCase().includes(buscar.toLowerCase())
  )

  return (
    <div>
      <PageHeader
        title="Partes procesales"
        subtitle="Personas físicas y morales involucradas en los juicios"
      />

      {partes.length === 0 ? (
        <EmptyState
          icon={
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
            </svg>
          }
          title="Sin partes registradas"
          description="Las partes procesales aparecerán aquí una vez que estén vinculadas a expedientes."
        />
      ) : (
        <>
          <div style={{
            background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: 'var(--radius-lg)', padding: 14, marginBottom: 14,
          }}>
            <input
              value={buscar}
              onChange={e => setBuscar(e.target.value)}
              placeholder="Buscar parte, expediente o tipo..."
              style={{
                background: 'var(--surface)', border: '1px solid var(--border)',
                color: 'var(--text)', borderRadius: 'var(--radius)',
                padding: '9px 12px', fontSize: 13, width: '100%',
              }}
            />
          </div>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)' }}>
            <table className="lx-table" style={{ border: 'none' }}>
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Tipo</th>
                  <th>Expediente</th>
                  <th>Teléfono</th>
                  <th>Correo</th>
                </tr>
              </thead>
              <tbody>
                {lista.map(p => (
                  <tr key={p.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{
                          width: 32, height: 32, borderRadius: '50%',
                          background: 'var(--primary-soft)', color: 'var(--primary)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 11, fontWeight: 700,
                        }}>{iniciales(p.nombre)}</div>
                        <span style={{ fontSize: 13, color: 'var(--text)', fontWeight: 500 }}>{p.nombre}</span>
                      </div>
                    </td>
                    <td><StatusBadge tone={p.tipo.startsWith('Actor') ? 'success' : p.tipo.startsWith('Demand') ? 'danger' : 'info'} dot={false}>{p.tipo}</StatusBadge></td>
                    <td style={{ fontSize: 12, color: 'var(--primary)', fontWeight: 600 }}>{p.expediente}</td>
                    <td style={{ fontSize: 12 }}>{p.telefono}</td>
                    <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{p.correo}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
