import PageHeader from '../components/ui/PageHeader'
import EmptyState from '../components/ui/EmptyState'

export default function Bitacora() {
  return (
    <div>
      <PageHeader
        title="Bitácora de actividad"
        subtitle="Auditoría completa de movimientos en el sistema"
      />

      <EmptyState
        icon={
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
          </svg>
        }
        title="Sin actividad registrada"
        description="La bitácora registrará automáticamente los cambios que realices en expedientes, tareas y demandas."
      />
    </div>
  )
}
