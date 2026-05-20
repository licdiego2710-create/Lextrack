import { iniciales } from '../utils/helpers'
import PageHeader from '../components/ui/PageHeader'
import StatusBadge from '../components/ui/StatusBadge'
import EmptyState from '../components/ui/EmptyState'

export default function Usuarios({ session }) {
  const usuarios = session ? [{
    id: session.user.id,
    nombre: session.user.user_metadata?.full_name || session.user.email?.split('@')[0] || 'Usuario',
    correo: session.user.email,
    rol: 'Administrador',
    activo: true,
  }] : []

  return (
    <div>
      <PageHeader
        title="Usuarios"
        subtitle="Gestión de equipo y permisos"
        actions={
          <button style={btnPri} disabled title="Próximamente">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 5v14"/><path d="M5 12h14"/>
            </svg>
            Invitar usuario
          </button>
        }
      />

      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)' }}>
        <table className="lx-table" style={{ border: 'none' }}>
          <thead>
            <tr>
              <th>Usuario</th>
              <th>Correo</th>
              <th>Rol</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            {usuarios.map(u => (
              <tr key={u.id}>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{
                      width: 36, height: 36, borderRadius: '50%',
                      background: 'linear-gradient(135deg, var(--primary), var(--primary-dark))',
                      color: '#fff',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 11, fontWeight: 700,
                    }}>{iniciales(u.nombre)}</div>
                    <div>
                      <div style={{ fontSize: 13, color: 'var(--text)', fontWeight: 600 }}>{u.nombre}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Cuenta activa</div>
                    </div>
                  </div>
                </td>
                <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{u.correo}</td>
                <td><StatusBadge tone="primary" dot={false}>{u.rol}</StatusBadge></td>
                <td><StatusBadge tone="success">Activo</StatusBadge></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ marginTop: 16, padding: '12px 16px', background: 'var(--surface-3)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', fontSize: 12, color: 'var(--text-muted)' }}>
        La gestión de múltiples usuarios estará disponible próximamente.
      </div>
    </div>
  )
}

const btnPri = {
  background: 'var(--primary)', color: '#fff', border: 'none',
  borderRadius: 'var(--radius)', padding: '9px 16px', fontSize: 13, fontWeight: 600,
  cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6,
  opacity: .6,
}
