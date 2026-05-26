import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { useOrg } from '../context/OrgContext'
import { iniciales } from '../utils/helpers'
import PageHeader from '../components/ui/PageHeader'
import StatusBadge from '../components/ui/StatusBadge'
import EmptyState from '../components/ui/EmptyState'
import Modal from '../components/ui/Modal'

export default function Partes() {
  const { org } = useOrg()
  const [expedientes, setExpedientes] = useState([])
  const [partesDatos, setPartesDatos] = useState([])
  const [loading, setLoading] = useState(true)
  const [buscar, setBuscar] = useState('')
  
  // Modal de edición
  const [modal, setModal] = useState(false)
  const [selectedParte, setSelectedParte] = useState(null) // { nombre, tipo }
  const [form, setForm] = useState({ telefono: '', correo: '', notas: '' })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!org?.id) return
    async function loadData() {
      setLoading(true)
      // 1. Cargar expedientes
      const { data: exps } = await supabase
        .from('expedientes')
        .select('id, num, actor, demandado')
        .eq('despacho_id', org.id)
      
      if (exps) setExpedientes(exps)

      // 2. Cargar datos de contacto de partes
      const { data: datos } = await supabase
        .from('partes_datos')
        .select('*')
        .eq('despacho_id', org.id)
      
      if (datos) setPartesDatos(datos)
      setLoading(false)
    }
    loadData()
  }, [org?.id])

  // Extraer partes procesales únicas de los expedientes
  const partesMap = new Map()

  expedientes.forEach(e => {
    if (e.actor && e.actor.trim()) {
      const nom = e.actor.trim()
      const key = `actor-${nom.toLowerCase()}`
      if (!partesMap.has(key)) {
        const contactInfo = partesDatos.find(d => d.nombre.toLowerCase() === nom.toLowerCase())
        partesMap.set(key, {
          nombre: nom,
          tipo: 'Actor',
          expediente: e.num,
          expediente_id: e.id,
          telefono: contactInfo?.telefono || '—',
          correo: contactInfo?.correo || '—',
          notas: contactInfo?.notas || ''
        })
      }
    }
    if (e.demandado && e.demandado.trim()) {
      const nom = e.demandado.trim()
      const key = `demandado-${nom.toLowerCase()}`
      if (!partesMap.has(key)) {
        const contactInfo = partesDatos.find(d => d.nombre.toLowerCase() === nom.toLowerCase())
        partesMap.set(key, {
          nombre: nom,
          tipo: 'Demandado',
          expediente: e.num,
          expediente_id: e.id,
          telefono: contactInfo?.telefono || '—',
          correo: contactInfo?.correo || '—',
          notas: contactInfo?.notas || ''
        })
      }
    }
  })

  const partesLista = Array.from(partesMap.values())
  
  const filteredPartes = partesLista.filter(p =>
    !buscar || 
    `${p.nombre} ${p.expediente} ${p.tipo} ${p.correo} ${p.telefono}`.toLowerCase().includes(buscar.toLowerCase())
  )

  function abrirEditar(parte) {
    setSelectedParte(parte)
    setForm({
      telefono: parte.telefono === '—' ? '' : parte.telefono,
      correo: parte.correo === '—' ? '' : parte.correo,
      notas: parte.notas || ''
    })
    setModal(true)
  }

  async function guardarContacto() {
    if (!org?.id || !selectedParte) return
    setSaving(true)

    const payload = {
      despacho_id: org.id,
      nombre: selectedParte.nombre,
      telefono: form.telefono || null,
      correo: form.correo || null,
      notas: form.notas || null
    }

    const { error } = await supabase
      .from('partes_datos')
      .upsert(payload, { onConflict: 'despacho_id,nombre' })

    if (error) {
      alert('Error al guardar contacto: ' + error.message)
    } else {
      // Actualizar localmente partesDatos
      const extIndex = partesDatos.findIndex(d => d.nombre.toLowerCase() === selectedParte.nombre.toLowerCase())
      if (extIndex > -1) {
        setPartesDatos(prev => prev.map((d, i) => i === extIndex ? { ...d, ...payload } : d))
      } else {
        setPartesDatos(prev => [...prev, payload])
      }

      // Registrar log de actividad
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user) {
        await supabase.from('bitacora_actividad').insert({
          despacho_id: org.id,
          user_id: session.user.id,
          user_email: session.user.email,
          accion: 'actualizar_parte',
          detalles: `Actualizó datos de contacto de la parte procesal "${selectedParte.nombre}"`
        })
      }

      setModal(false)
      setSelectedParte(null)
    }
    setSaving(false)
  }

  return (
    <div>
      <PageHeader
        title="Partes procesales"
        subtitle="Directorio inteligente y datos de contacto de las partes involucradas en tus expedientes"
      />

      <div style={{
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)', padding: 14, marginBottom: 14,
      }}>
        <input
          value={buscar}
          onChange={e => setBuscar(e.target.value)}
          placeholder="Buscar por nombre, expediente, tipo, correo o teléfono..."
          style={inputStyle}
        />
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 48, color: 'var(--text-muted)' }}>
          Cargando directorio de partes...
        </div>
      ) : filteredPartes.length === 0 ? (
        <EmptyState
          icon={
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
            </svg>
          }
          title="Sin partes registradas"
          description={buscar ? "No se encontraron partes procesales que coincidan con tu búsqueda." : "Las partes procesales aparecerán aquí automáticamente una vez que crees expedientes con actores y demandados."}
        />
      ) : (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
          <table className="lx-table" style={{ border: 'none' }}>
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Rol</th>
                <th>Expediente</th>
                <th>Teléfono</th>
                <th>Correo electrónico</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filteredPartes.map((p, index) => (
                <tr key={index}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{
                        width: 34, height: 34, borderRadius: '50%',
                        background: p.tipo === 'Actor' ? 'var(--info-bg)' : 'var(--warning-bg)',
                        color: p.tipo === 'Actor' ? 'var(--info-text)' : 'var(--warning-text)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 11, fontWeight: 700, flexShrink: 0
                      }}>{iniciales(p.nombre)}</div>
                      <span style={{ fontSize: 13, color: 'var(--text)', fontWeight: 600 }}>{p.nombre}</span>
                    </div>
                  </td>
                  <td>
                    <StatusBadge tone={p.tipo === 'Actor' ? 'info' : 'warning'} dot={false}>
                      {p.tipo}
                    </StatusBadge>
                  </td>
                  <td style={{ fontSize: 13, color: 'var(--primary)', fontWeight: 700 }}>{p.expediente}</td>
                  <td style={{ fontSize: 12 }}>{p.telefono}</td>
                  <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{p.correo}</td>
                  <td>
                    <button onClick={() => abrirEditar(p)} style={btnIcon} title="Editar Datos de Contacto">
                      ✏️ Editar Datos
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal para editar contacto */}
      {selectedParte && (
        <Modal
          open={modal}
          title={`Editar Datos de Contacto: ${selectedParte.nombre}`}
          subtitle={`Rol: ${selectedParte.tipo} · Expediente: ${selectedParte.expediente}`}
          onClose={() => { setModal(false); setSelectedParte(null) }}
          footer={
            <div style={{ display: 'flex', gap: 8 }}>
              <button style={btnSec} onClick={() => { setModal(false); setSelectedParte(null) }}>Cancelar</button>
              <button style={btnPri} disabled={saving} onClick={guardarContacto}>
                {saving ? 'Guardando...' : 'Guardar Contacto'}
              </button>
            </div>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <div style={smallLabel}>Teléfono</div>
              <input
                style={inputStyle}
                placeholder="Ej: 3312345678"
                value={form.telefono}
                onChange={e => setForm(prev => ({ ...prev, telefono: e.target.value }))}
              />
            </div>
            
            <div>
              <div style={smallLabel}>Correo electrónico</div>
              <input
                type="email"
                style={inputStyle}
                placeholder="Ej: contacto@correo.com"
                value={form.correo}
                onChange={e => setForm(prev => ({ ...prev, correo: e.target.value }))}
              />
            </div>

            <div>
              <div style={smallLabel}>Notas de la parte</div>
              <textarea
                style={{ ...inputStyle, minHeight: 80, resize: 'vertical' }}
                placeholder="Dirección, representante legal, observaciones, etc..."
                value={form.notas}
                onChange={e => setForm(prev => ({ ...prev, notas: e.target.value }))}
              />
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}

const btnPri = {
  background: 'var(--primary)', color: '#fff', border: 'none',
  borderRadius: 'var(--radius)', padding: '9px 16px', fontSize: 13, fontWeight: 600,
  cursor: 'pointer',
}
const btnSec = {
  background: 'var(--surface)', color: 'var(--text)', border: '1px solid var(--border)',
  borderRadius: 'var(--radius)', padding: '8px 14px', fontSize: 13, fontWeight: 500, cursor: 'pointer',
}
const btnIcon = {
  background: 'var(--surface-3)', border: '1px solid var(--border)', color: 'var(--text)',
  borderRadius: 'var(--radius-sm)', padding: '6px 10px', cursor: 'pointer', fontSize: 11, fontWeight: 600
}
const inputStyle = {
  background: 'var(--surface)', border: '1px solid var(--border)',
  color: 'var(--text)', borderRadius: 'var(--radius)',
  padding: '9px 12px', fontSize: 13, width: '100%',
}
const smallLabel = { fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '.5px' }
