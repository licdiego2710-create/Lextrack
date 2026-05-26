import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { useOrg } from '../context/OrgContext'
import PageHeader from '../components/ui/PageHeader'
import EmptyState from '../components/ui/EmptyState'

const ACCION_ICON = {
  crear_expediente: '📂',
  actualizar_expediente: '✏️',
  eliminar_expediente: '🗑️',
  subir_documento: '📄',
  eliminar_documento: '🗑️',
  crear_actuacion: '📋',
  eliminar_actuacion: '🗑️',
  crear_prospecto: '👤',
  actualizar_prospecto: '✏️',
  eliminar_prospecto: '🗑️',
  convertir_prospecto: '🔄',
  actualizar_parte: '👥',
  vincular_plazo: '🔔',
  agregar_dia_inhabil: '📅',
  importar_dias_inhabiles: '📅',
  eliminar_dia_inhabil: '🗑️',
  vaciar_dias_inhabiles: '🗑️',
}

const ACCION_LABEL = {
  crear_expediente: 'Expediente Creado',
  actualizar_expediente: 'Expediente Modificado',
  eliminar_expediente: 'Expediente Eliminado',
  subir_documento: 'Documento Cargado',
  eliminar_documento: 'Documento Eliminado',
  crear_actuacion: 'Actuación Agregada',
  eliminar_actuacion: 'Actuación Eliminada',
  crear_prospecto: 'Prospecto Creado',
  actualizar_prospecto: 'Prospecto Modificado',
  eliminar_prospecto: 'Prospecto Eliminado',
  convertir_prospecto: 'Prospecto Convertido',
  actualizar_parte: 'Parte Procesal Modificada',
  vincular_plazo: 'Término Vinculado',
  agregar_dia_inhabil: 'Día Inhábil Agregado',
  importar_dias_inhabiles: 'Días Inhábiles Importados',
  eliminar_dia_inhabil: 'Día Inhábil Eliminado',
  vaciar_dias_inhabiles: 'Calendario Inhábil Vaciado',
}

export default function Bitacora() {
  const { org } = useOrg()
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!org?.id) return
    async function loadLogs() {
      setLoading(true)
      const { data, error } = await supabase
        .from('bitacora_actividad')
        .select('*')
        .eq('despacho_id', org.id)
        .order('creado_en', { ascending: false })
        .limit(200)

      if (!error && data) {
        setLogs(data)
      }
      setLoading(false)
    }
    loadLogs()
  }, [org?.id])

  return (
    <div>
      <PageHeader
        title="Bitácora de actividad"
        subtitle="Auditoría completa de movimientos en el sistema por los miembros del despacho"
      />

      {loading ? (
        <div style={{ textAlign: 'center', padding: 48, color: 'var(--text-muted)' }}>
          Cargando bitácora...
        </div>
      ) : logs.length === 0 ? (
        <EmptyState
          icon={
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
            </svg>
          }
          title="Sin actividad registrada"
          description="La bitácora registrará automáticamente las acciones del equipo en expedientes, prospectos, plazos y documentos."
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {logs.map((log) => {
            const icon = ACCION_ICON[log.accion] || '⚙️'
            const label = ACCION_LABEL[log.accion] || log.accion
            const fecha = new Date(log.creado_en).toLocaleString('es-MX', {
              day: '2-digit', month: '2-digit', year: 'numeric',
              hour: '2-digit', minute: '2-digit', second: '2-digit'
            })

            return (
              <div key={log.id} style={{
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-lg)',
                padding: '16px 20px',
                display: 'flex',
                gap: 16,
                alignItems: 'center',
                boxShadow: 'var(--shadow-sm)'
              }}>
                <div style={{
                  fontSize: 22,
                  width: 44, height: 44,
                  borderRadius: 12,
                  background: 'var(--surface-3)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0
                }}>{icon}</div>
                
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{label}</span>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{fecha}</span>
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>
                    {log.detalles}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--primary)', fontWeight: 600, marginTop: 4 }}>
                    👤 {log.user_email}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
