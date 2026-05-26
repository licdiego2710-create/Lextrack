import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { useOrg } from '../context/OrgContext'
import { fmtFecha } from '../utils/helpers'
import PageHeader from '../components/ui/PageHeader'
import EmptyState from '../components/ui/EmptyState'
import Modal from '../components/ui/Modal'

const TIPO_COLOR = {
  pdf: '#dc2626',
  docx: '#2563eb',
  doc: '#2563eb',
  xlsx: '#16a34a',
  xls: '#16a34a',
  jpg: '#a855f7',
  jpeg: '#a855f7',
  png: '#a855f7',
  md: '#64748b',
  txt: '#64748b',
}

const MATERIAS = ['Mercantil', 'Civil', 'Familiar', 'Penal', 'Laboral', 'Amparo', 'Administrativo']

export default function Documentos() {
  const { org, canWrite } = useOrg()
  
  // Tabs: 'archivos' | 'plantillas'
  const [tab, setTab] = useState('archivos')
  
  // State Repositorio Archivos
  const [documentos, setDocumentos] = useState([])
  const [expedientes, setExpedientes] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [expSeleccionado, setExpSeleccionado] = useState('')
  const [fileToUpload, setFileToUpload] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [buscar, setBuscar] = useState('')
  
  // State Plantillas
  const [plantillas, setPlantillas] = useState([])
  const [prospectos, setProspectos] = useState([])
  const [buscarPlantilla, setBuscarPlantilla] = useState('')
  const [modalPlantilla, setModalPlantilla] = useState(false)
  const [editPlantillaId, setEditPlantillaId] = useState(null)
  const [savingPlantilla, setSavingPlantilla] = useState(false)
  const [formPlantilla, setFormPlantilla] = useState({
    nombre: '', descripcion: '', contenido: '', materia: 'Mercantil'
  })

  // State Generación Documentos
  const [modalGenerar, setModalGenerar] = useState(false)
  const [tempSeleccionada, setTempSeleccionada] = useState(null)
  const [origenTipo, setOrigenTipo] = useState('expediente') // 'expediente' | 'prospecto'
  const [origenId, setOrigenId] = useState('')
  const [docGeneradoText, setDocGeneradoText] = useState('')
  const [modoPreview, setModoPreview] = useState(false)
  const [guardandoEnExp, setGuardandoEnExp] = useState(false)

  useEffect(() => {
    if (!org?.id) return
    async function loadData() {
      setLoading(true)
      // 1. Cargar documentos
      const { data: docs, error: errDocs } = await supabase
        .from('documentos')
        .select('id, nombre, path, creado_en, user_id, expediente:expedientes(id, num, actor, demandado)')
        .eq('despacho_id', org.id)
        .order('creado_en', { ascending: false })

      if (!errDocs && docs) {
        setDocumentos(docs)
      }

      // 2. Cargar expedientes activos (para el dropdown de subir y generar)
      const { data: exps, error: errExps } = await supabase
        .from('expedientes')
        .select('id, num, actor, demandado, materia, juzgado, etapa')
        .eq('despacho_id', org.id)
        .in('estado', ['Activo', 'activo', 'ACTIVO', 'Vencido', 'vencido'])
        .order('num', { ascending: true })

      if (!errExps && exps) {
        setExpedientes(exps)
      }

      // 3. Cargar plantillas
      const { data: plats } = await supabase
        .from('plantillas_documentos')
        .select('*')
        .eq('despacho_id', org.id)
        .order('nombre', { ascending: true })
      setPlantillas(plats || [])

      // 4. Cargar prospectos
      const { data: prosps } = await supabase
        .from('prospectos')
        .select('id, nombre, email, telefono, asunto, materia')
        .eq('despacho_id', org.id)
        .order('nombre', { ascending: true })
      setProspectos(prosps || [])

      setLoading(false)
    }
    loadData()
  }, [org?.id])

  // --- CRUD ARCHIVOS ---
  async function descargarArchivo(doc) {
    const { data, error } = await supabase.storage.from('documentos').createSignedUrl(doc.path, 120)
    if (error) return alert('No se pudo generar enlace.')
    window.open(data.signedUrl, '_blank')
  }

  async function eliminarArchivo(doc) {
    if (!confirm(`¿Eliminar "${doc.nombre}"?`)) return
    
    // 1. Borrar de Storage
    await supabase.storage.from('documentos').remove([doc.path])
    
    // 2. Borrar de Base de Datos
    const { error } = await supabase.from('documentos').delete().eq('id', doc.id)
    
    if (error) {
      alert('Error al eliminar registro: ' + error.message)
    } else {
      setDocumentos(prev => prev.filter(d => d.id !== doc.id))
      
      // Registrar log de actividad
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user) {
        await supabase.from('bitacora_actividad').insert({
          despacho_id: org.id,
          user_id: session.user.id,
          user_email: session.user.email,
          accion: 'eliminar_documento',
          detalles: `Eliminó el documento "${doc.nombre}"`
        })
      }
    }
  }

  async function handleUpload() {
    if (!fileToUpload || !expSeleccionado || !org?.id) return
    if (fileToUpload.size > 20 * 1024 * 1024) { alert('El archivo no debe superar 20 MB.'); return }
    
    setUploading(true)
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.user) { setUploading(false); return }

    const path = `${org.id}/${expSeleccionado}/${Date.now()}_${fileToUpload.name}`
    
    // 1. Subir a Storage
    const { error: errUpload } = await supabase.storage.from('documentos').upload(path, fileToUpload)
    if (errUpload) {
      alert('Error al subir a storage: ' + errUpload.message)
      setUploading(false)
      return
    }

    // 2. Insertar en DB
    const { data: newDoc, error: errInsert } = await supabase
      .from('documentos')
      .insert({
        expediente_id: expSeleccionado,
        nombre: fileToUpload.name,
        path,
        user_id: session.user.id,
        despacho_id: org.id
      })
      .select('id, nombre, path, creado_en, user_id, expediente:expedientes(id, num, actor, demandado)')
      .single()

    if (errInsert) {
      alert('Error al guardar en base de datos: ' + errInsert.message)
    } else if (newDoc) {
      setDocumentos(prev => [newDoc, ...prev])
      
      // Registrar log de actividad
      const exp = expedientes.find(e => e.id === expSeleccionado)
      await supabase.from('bitacora_actividad').insert({
        despacho_id: org.id,
        user_id: session.user.id,
        user_email: session.user.email,
        accion: 'subir_documento',
        detalles: `Subió el documento "${fileToUpload.name}" para el expediente ${exp?.num || ''}`
      })

      setModal(false)
      setFileToUpload(null)
      setExpSeleccionado('')
    }
    setUploading(false)
  }

  // --- CRUD PLANTILLAS ---
  async function guardarPlantilla() {
    if (!formPlantilla.nombre.trim() || !formPlantilla.contenido.trim()) {
      alert('Nombre y Contenido de la plantilla son obligatorios.'); return
    }
    setSavingPlantilla(true)
    const payload = {
      nombre: formPlantilla.nombre.trim(),
      descripcion: formPlantilla.descripcion.trim(),
      contenido: formPlantilla.contenido,
      materia: formPlantilla.materia,
      despacho_id: org.id,
      actualizado_en: new Date().toISOString()
    }

    let error
    if (editPlantillaId) {
      ;({ error } = await supabase.from('plantillas_documentos').update(payload).eq('id', editPlantillaId))
    } else {
      ;({ error } = await supabase.from('plantillas_documentos').insert({ ...payload, creado_en: new Date().toISOString() }))
    }

    setSavingPlantilla(false)
    if (error) {
      alert('Error al guardar la plantilla: ' + error.message)
    } else {
      setModalPlantilla(false)
      setFormPlantilla({ nombre: '', descripcion: '', contenido: '', materia: 'Mercantil' })
      setEditPlantillaId(null)
      
      // Recargar la lista
      const { data } = await supabase
        .from('plantillas_documentos')
        .select('*')
        .eq('despacho_id', org.id)
        .order('nombre', { ascending: true })
      setPlantillas(data || [])
    }
  }

  async function eliminarPlantilla(id) {
    if (!confirm('¿Eliminar esta plantilla definitivamente?')) return
    const { error } = await supabase.from('plantillas_documentos').delete().eq('id', id)
    if (error) {
      alert('Error al eliminar: ' + error.message)
    } else {
      setPlantillas(prev => prev.filter(p => p.id !== id))
    }
  }

  function abrirEditarPlantilla(p, e) {
    e.stopPropagation()
    setFormPlantilla({
      nombre: p.nombre,
      descripcion: p.descripcion || '',
      contenido: p.contenido,
      materia: p.materia || 'Mercantil'
    })
    setEditPlantillaId(p.id)
    setModalPlantilla(true)
  }

  function abrirNuevaPlantilla() {
    setFormPlantilla({ nombre: '', descripcion: '', contenido: '', materia: 'Mercantil' })
    setEditPlantillaId(null)
    setModalPlantilla(true)
  }

  // --- FLUJO DE GENERACIÓN ---
  function abrirGenerar(p) {
    setTempSeleccionada(p)
    setOrigenTipo('expediente')
    setOrigenId('')
    setModoPreview(false)
    setDocGeneradoText('')
    setModalGenerar(true)
  }

  function procesarPlantilla() {
    if (!tempSeleccionada || !origenId) return
    let texto = tempSeleccionada.contenido
    const fechaHoy = new Date().toLocaleDateString('es-MX', {
      year: 'numeric', month: 'long', day: 'numeric'
    })

    if (origenTipo === 'expediente') {
      const exp = expedientes.find(e => e.id === origenId)
      if (exp) {
        texto = texto
          .replace(/\{\{num\}\}/g, exp.num || '')
          .replace(/\{\{actor\}\}/g, exp.actor || '')
          .replace(/\{\{demandado\}\}/g, exp.demandado || '')
          .replace(/\{\{juzgado\}\}/g, exp.juzgado || '')
          .replace(/\{\{materia\}\}/g, exp.materia || '')
          .replace(/\{\{etapa\}\}/g, exp.etapa || '')
          .replace(/\{\{fecha_hoy\}\}/g, fechaHoy)
          .replace(/\{\{despacho_nombre\}\}/g, org?.nombre || 'LexTrack MX')
      }
    } else {
      const prosp = prospectos.find(p => p.id === origenId)
      if (prosp) {
        texto = texto
          .replace(/\{\{nombre\}\}/g, prosp.nombre || '')
          .replace(/\{\{email\}\}/g, prosp.email || '')
          .replace(/\{\{telefono\}\}/g, prosp.telefono || '')
          .replace(/\{\{asunto\}\}/g, prosp.asunto || '')
          .replace(/\{\{materia\}\}/g, prosp.materia || '')
          .replace(/\{\{fecha_hoy\}\}/g, fechaHoy)
          .replace(/\{\{despacho_nombre\}\}/g, org?.nombre || 'LexTrack MX')
      }
    }

    setDocGeneradoText(texto)
    setModoPreview(true)
  }

  function descargarTXT() {
    const blob = new Blob([docGeneradoText], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${tempSeleccionada.nombre.replace(/[^a-zA-Z0-9]/g, '_')}_generado.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  function descargarMD() {
    const blob = new Blob([docGeneradoText], { type: 'text/markdown;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${tempSeleccionada.nombre.replace(/[^a-zA-Z0-9]/g, '_')}_generado.md`
    a.click()
    URL.revokeObjectURL(url)
  }

  function descargarDoc() {
    // Wrapper HTML para Word con namespaces oficiales para que sea editable nativamente
    const header = "<html xmlns:o='urn:schemas-microsoft-com:office:office' "+
          "xmlns:w='urn:schemas-microsoft-com:office:word' "+
          "xmlns='http://www.w3.org/TR/REC-html40'>"+
          "<head><title>Documento Generado</title><!--[if gte mso 9]><xml>"+
          "<w:WordDocument><w:View>Print</w:View><w:Zoom>100</w:Zoom></xml>"+
          "<![endif]--><style>body { font-family: Arial, sans-serif; padding: 2cm; line-height: 1.5; }</style></head><body>";
    const footer = "</body></html>";
    
    // Convertir saltos de línea a etiquetas <p> para mejor formateo en Word
    const htmlFormatted = docGeneradoText.split('\n').map(line => `<p>${line}</p>`).join('');
    const sourceHTML = header + htmlFormatted + footer;
    
    const blob = new Blob(['\ufeff' + sourceHTML], { type: 'application/msword' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${tempSeleccionada.nombre.replace(/[^a-zA-Z0-9]/g, '_')}_generado.doc`
    a.click()
    URL.revokeObjectURL(url)
  }

  async function handleGuardarGeneradoEnExp() {
    let targetExpId = null
    if (origenTipo === 'expediente') {
      targetExpId = origenId
    } else {
      // Si proviene de un prospecto, pedimos al usuario elegir un expediente
      const input = prompt('Para archivar este escrito, ingresa el número de expediente exacto (o el ID):')
      if (!input) return
      const found = expedientes.find(e => e.num === input || e.id === input)
      if (found) {
        targetExpId = found.id
      } else {
        alert('Expediente no encontrado. Por favor crea primero el expediente o introduce el número correcto.')
        return
      }
    }

    const expObj = expedientes.find(e => e.id === targetExpId)
    if (!expObj) { alert('Expediente de destino no válido.'); return }

    setGuardandoEnExp(true)
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.user) { setGuardandoEnExp(false); return }

    const filename = `${tempSeleccionada.nombre.replace(/[^a-zA-Z0-9]/g, '_')}_generado.md`
    const blob = new Blob([docGeneradoText], { type: 'text/markdown;charset=utf-8' })
    const file = new File([blob], filename, { type: 'text/markdown' })
    const path = `${org.id}/${targetExpId}/${Date.now()}_${filename}`

    const { error: uploadErr } = await supabase.storage.from('documentos').upload(path, file)
    if (uploadErr) {
      alert('Error al subir a storage: ' + uploadErr.message)
      setGuardandoEnExp(false)
      return
    }

    const { data: newDoc, error: dbErr } = await supabase
      .from('documentos')
      .insert({
        expediente_id: targetExpId,
        nombre: filename,
        path,
        user_id: session.user.id,
        despacho_id: org.id
      })
      .select('id, nombre, path, creado_en, user_id, expediente:expedientes(id, num, actor, demandado)')
      .single()

    setGuardandoEnExp(false)
    if (dbErr) {
      alert('Error al vincular en base de datos: ' + dbErr.message)
    } else {
      alert(`✅ Archivo archivado con éxito en el expediente "${expObj.num}"`)
      if (newDoc) setDocumentos(prev => [newDoc, ...prev])
      setModalGenerar(false)
      setModoPreview(false)
      setOrigenId('')
    }
  }

  // --- FILTROS ---
  const filteredDocs = documentos.filter(doc => 
    !buscar || 
    doc.nombre.toLowerCase().includes(buscar.toLowerCase()) ||
    (doc.expediente?.num && doc.expediente.num.toLowerCase().includes(buscar.toLowerCase()))
  )

  const filteredPlantillas = plantillas.filter(p =>
    !buscarPlantilla ||
    p.nombre.toLowerCase().includes(buscarPlantilla.toLowerCase()) ||
    (p.descripcion && p.descripcion.toLowerCase().includes(buscarPlantilla.toLowerCase())) ||
    (p.materia && p.materia.toLowerCase().includes(buscarPlantilla.toLowerCase()))
  )

  return (
    <div>
      <PageHeader
        title="Documentos"
        subtitle="Repositorio central de archivos y plantillas del despacho"
        actions={
          canWrite && (
            tab === 'archivos' ? (
              <button style={btnPri} onClick={() => setModal(true)}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M17 8l-5-5-5 5"/><path d="M12 3v12"/>
                </svg>
                Subir archivo
              </button>
            ) : (
              <button style={btnPri} onClick={abrirNuevaPlantilla}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 5v14"/><path d="M5 12h14"/>
                </svg>
                Nueva plantilla
              </button>
            )
          )
        }
      />

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <button
          onClick={() => setTab('archivos')}
          style={{
            ...btnSec,
            background: tab === 'archivos' ? 'var(--primary)' : 'var(--surface)',
            color: tab === 'archivos' ? '#fff' : 'var(--text)',
            borderColor: tab === 'archivos' ? 'var(--primary)' : 'var(--border)',
          }}
        >
          📁 Repositorio de Archivos
        </button>
        {canWrite && (
          <button
            onClick={() => setTab('plantillas')}
            style={{
              ...btnSec,
              background: tab === 'plantillas' ? 'var(--primary)' : 'var(--surface)',
              color: tab === 'plantillas' ? '#fff' : 'var(--text)',
              borderColor: tab === 'plantillas' ? 'var(--primary)' : 'var(--border)',
            }}
          >
            📝 Plantillas de Escritos
          </button>
        )}
      </div>

      {tab === 'archivos' ? (
        <>
          <div style={{
            background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: 'var(--radius-lg)', padding: 14, marginBottom: 14,
          }}>
            <input
              value={buscar}
              onChange={e => setBuscar(e.target.value)}
              placeholder="Buscar por nombre de archivo o número de expediente..."
              style={inputStyle}
            />
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: 48, color: 'var(--text-muted)' }}>
              Cargando documentos...
            </div>
          ) : filteredDocs.length === 0 ? (
            <EmptyState
              icon={
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/><path d="M9 13h6"/><path d="M9 17h4"/>
                </svg>
              }
              title="Sin documentos"
              description={buscar ? "No se encontraron documentos que coincidan con tu búsqueda." : "Aún no hay documentos guardados. Sube uno nuevo para empezar."}
            />
          ) : (
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
              <table className="lx-table" style={{ border: 'none' }}>
                <thead>
                  <tr>
                    <th>Nombre</th>
                    <th>Expediente</th>
                    <th>Fecha de subida</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredDocs.map(d => {
                    const ext = d.nombre.split('.').pop().toLowerCase()
                    const color = TIPO_COLOR[ext] || 'var(--muted)'
                    return (
                      <tr key={d.id}>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <div style={{
                              width: 38, height: 38, borderRadius: 8,
                              background: `${color}22`,
                              color: color,
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontSize: 10, fontWeight: 800, textTransform: 'uppercase',
                              flexShrink: 0
                            }}>{ext.slice(0, 4)}</div>
                            <div style={{ fontSize: 13, color: 'var(--text)', fontWeight: 500, wordBreak: 'break-all' }}>{d.nombre}</div>
                          </div>
                        </td>
                        <td>
                          {d.expediente ? (
                            <div>
                              <div style={{ fontSize: 13, color: 'var(--primary)', fontWeight: 700 }}>{d.expediente.num}</div>
                              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{d.expediente.actor} vs {d.expediente.demandado}</div>
                            </div>
                          ) : '—'}
                        </td>
                        <td style={{ fontSize: 12 }}>{fmtFecha(d.creado_en?.slice(0, 10))}</td>
                        <td>
                          <div style={{ display: 'flex', gap: 8 }}>
                            <button onClick={() => descargarArchivo(d)} style={btnIcon} title="Descargar / Abrir">
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M7 10l5 5 5-5"/><path d="M12 15V3"/>
                              </svg>
                            </button>
                            {canWrite && (
                              <button onClick={() => eliminarArchivo(d)} style={{ ...btnIcon, color: 'var(--danger)' }} title="Eliminar">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
                                </svg>
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      ) : (
        <>
          {/* PESTAÑA PLANTILLAS */}
          <div style={{
            background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: 'var(--radius-lg)', padding: 14, marginBottom: 14,
          }}>
            <input
              value={buscarPlantilla}
              onChange={e => setBuscarPlantilla(e.target.value)}
              placeholder="Buscar por nombre, descripción o materia..."
              style={inputStyle}
            />
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: 48, color: 'var(--text-muted)' }}>
              Cargando plantillas...
            </div>
          ) : filteredPlantillas.length === 0 ? (
            <EmptyState
              icon={
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <rect x="3" y="3" width="18" height="18" rx="2" strokeWidth="1.8"/><line x1="9" y1="9" x2="15" y2="9"/><line x1="9" y1="13" x2="15" y2="13"/><line x1="9" y1="17" x2="13" y2="17"/>
                </svg>
              }
              title="Sin plantillas"
              description={buscarPlantilla ? "No se encontraron plantillas que coincidan con tu búsqueda." : "Aún no hay plantillas. Crea una nueva para empezar a automatizar documentos."}
            />
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
              {filteredPlantillas.map(p => (
                <div
                  key={p.id}
                  onClick={() => abrirGenerar(p)}
                  style={{
                    background: 'var(--surface)', border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-lg)', padding: 16, cursor: 'pointer',
                    transition: 'border-color .15s, transform .15s',
                    position: 'relative', display: 'flex', flexDirection: 'column',
                    justifyContent: 'space-between'
                  }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--primary)' }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)' }}
                >
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8, gap: 10 }}>
                      <span style={{
                        fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 999,
                        background: 'var(--primary-bg)', color: 'var(--primary)'
                      }}>{p.materia || 'Mercantil'}</span>
                      
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button onClick={(e) => abrirEditarPlantilla(p, e)} style={iconSmallBtn} title="Editar">✏️</button>
                        <button onClick={(e) => { e.stopPropagation(); eliminarPlantilla(p.id) }} style={{ ...iconSmallBtn, color: 'var(--danger)' }} title="Eliminar">✕</button>
                      </div>
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>{p.nombre}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.4 }}>{p.descripcion || 'Sin descripción'}</div>
                  </div>

                  <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', color: 'var(--primary)', fontWeight: 600, fontSize: 12, gap: 4 }}>
                    ⚡ Generar Escrito
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Modal para subir documento */}
      <Modal
        open={modal}
        title="Subir archivo al expediente"
        onClose={() => { setModal(false); setFileToUpload(null); setExpSeleccionado('') }}
        footer={
          <div style={{ display: 'flex', gap: 8 }}>
            <button style={btnSec} onClick={() => { setModal(false); setFileToUpload(null); setExpSeleccionado('') }}>Cancelar</button>
            <button style={btnPri} disabled={!fileToUpload || !expSeleccionado || uploading} onClick={handleUpload}>
              {uploading ? 'Subiendo...' : 'Subir'}
            </button>
          </div>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <div style={smallLabel}>Seleccionar Expediente *</div>
            {expedientes.length === 0 ? (
              <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>No hay expedientes activos para vincular.</div>
            ) : (
              <select
                style={selectStyle}
                value={expSeleccionado}
                onChange={e => setExpSeleccionado(e.target.value)}
              >
                <option value="">-- Selecciona un expediente --</option>
                {expedientes.map(e => (
                  <option key={e.id} value={e.id}>
                    {e.num} - {e.actor} vs {e.demandado}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div>
            <div style={smallLabel}>Archivo *</div>
            <label style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              border: '2px dashed var(--border)', borderRadius: 'var(--radius)', padding: '24px 12px',
              background: 'var(--surface-2)', cursor: 'pointer', textAlign: 'center', gap: 8
            }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
              </svg>
              <span style={{ fontSize: 13, fontWeight: 600 }}>
                {fileToUpload ? fileToUpload.name : 'Haz clic para seleccionar un archivo'}
              </span>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                {fileToUpload ? `${(fileToUpload.size / (1024*1024)).toFixed(2)} MB` : 'Máximo 20 MB'}
              </span>
              <input
                type="file" style={{ display: 'none' }}
                onChange={e => setFileToUpload(e.target.files[0])}
              />
            </label>
          </div>
        </div>
      </Modal>

      {/* Modal CRUD Plantilla */}
      <Modal
        open={modalPlantilla}
        title={editPlantillaId ? 'Editar plantilla' : 'Nueva plantilla de escrito'}
        onClose={() => setModalPlantilla(false)}
        width={700}
        footer={
          <div style={{ display: 'flex', gap: 8 }}>
            <button style={btnSec} onClick={() => setModalPlantilla(false)}>Cancelar</button>
            <button style={btnPri} disabled={savingPlantilla} onClick={guardarPlantilla}>
              {savingPlantilla ? 'Guardando...' : 'Guardar plantilla'}
            </button>
          </div>
        }
      >
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14 }}>
          <div style={{ gridColumn: '1 / -1' }}>
            <div style={smallLabel}>Nombre de la plantilla *</div>
            <input
              style={inputStyle}
              value={formPlantilla.nombre}
              onChange={e => setFormPlantilla(f => ({ ...f, nombre: e.target.value }))}
              placeholder="Ej: Contrato de Prestación de Servicios o Demanda Inicial"
            />
          </div>

          <div>
            <div style={smallLabel}>Materia</div>
            <select
              style={selectStyle}
              value={formPlantilla.materia}
              onChange={e => setFormPlantilla(f => ({ ...f, materia: e.target.value }))}
            >
              {MATERIAS.map(m => <option key={m}>{m}</option>)}
            </select>
          </div>

          <div>
            <div style={smallLabel}>Descripción rápida</div>
            <input
              style={inputStyle}
              value={formPlantilla.descripcion}
              onChange={e => setFormPlantilla(f => ({ ...f, descripcion: e.target.value }))}
              placeholder="Ej: Escrito inicial para juzgados locales"
            />
          </div>

          <div style={{ gridColumn: '1 / -1' }}>
            <div style={{ ...smallLabel, display: 'flex', justifyContent: 'space-between' }}>
              <span>Contenido de la plantilla *</span>
              <span style={{ color: 'var(--primary)', textTransform: 'none' }}>Variables: {"{{actor}}"}, {"{{demandado}}"}, {"{{num}}"}, {"{{juzgado}}"}, {"{{fecha_hoy}}"}</span>
            </div>
            <textarea
              style={textareaStyle}
              value={formPlantilla.contenido}
              onChange={e => setFormPlantilla(f => ({ ...f, contenido: e.target.value }))}
              placeholder={`Escribe el texto de tu escrito aquí.\n\nUsa {{actor}} para insertar el nombre del actor/cliente,\n{{demandado}} para el demandado,\n{{num}} para el expediente,\n{{juzgado}} para el órgano jurisdiccional,\n{{fecha_hoy}} para la fecha actual.`}
            />
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 5 }}>
              * Si usas prospectos, también puedes incluir <strong>{"{{nombre}}"}</strong>, <strong>{"{{email}}"}</strong> y <strong>{"{{telefono}}"}</strong>.
            </div>
          </div>
        </div>
      </Modal>

      {/* Modal Generar Documento */}
      <Modal
        open={modalGenerar}
        title={`Generar Escrito: ${tempSeleccionada?.nombre}`}
        onClose={() => { setModalGenerar(false); setModoPreview(false); setOrigenId('') }}
        width={750}
        footer={
          <div style={{ display: 'flex', gap: 8, width: '100%', justifyContent: 'space-between' }}>
            {!modoPreview ? (
              <>
                <button style={btnSec} onClick={() => setModalGenerar(false)}>Cancelar</button>
                <button style={btnPri} disabled={!origenId} onClick={procesarPlantilla}>Siguiente: Previsualizar ⚡</button>
              </>
            ) : (
              <>
                <button style={btnSec} onClick={() => setModoPreview(false)}>⬅ Regresar</button>
                
                <div style={{ display: 'flex', gap: 6 }}>
                  <div style={{ position: 'relative', display: 'inline-block' }}>
                    <button style={btnSec} onClick={descargarTXT}>💾 TXT</button>
                  </div>
                  <button style={btnSec} onClick={descargarMD}>💾 Markdown</button>
                  <button style={btnSec} onClick={descargarDoc}>💾 Word (.doc)</button>
                  
                  <button style={btnPri} disabled={guardandoEnExp} onClick={handleGuardarGeneradoEnExp}>
                    {guardandoEnExp ? 'Guardando...' : '📁 Archivar en Expediente'}
                  </button>
                </div>
              </>
            )}
          </div>
        }
      >
        {!modoPreview ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
              Selecciona el origen de los datos para rellenar de forma automática los campos de la plantilla.
            </div>

            <div style={{ display: 'flex', gap: 12, margin: '6px 0' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
                <input
                  type="radio"
                  name="origenTipo"
                  checked={origenTipo === 'expediente'}
                  onChange={() => { setOrigenTipo('expediente'); setOrigenId('') }}
                />
                📁 Expediente Activo
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
                <input
                  type="radio"
                  name="origenTipo"
                  checked={origenTipo === 'prospecto'}
                  onChange={() => { setOrigenTipo('prospecto'); setOrigenId('') }}
                />
                👤 Prospecto (CRM)
              </label>
            </div>

            <div>
              <div style={smallLabel}>Seleccionar {origenTipo === 'expediente' ? 'Expediente' : 'Prospecto'} *</div>
              {origenTipo === 'expediente' ? (
                expedientes.length === 0 ? (
                  <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>No hay expedientes registrados.</div>
                ) : (
                  <select
                    style={selectStyle}
                    value={origenId}
                    onChange={e => setOrigenId(e.target.value)}
                  >
                    <option value="">-- Selecciona un expediente --</option>
                    {expedientes.map(e => (
                      <option key={e.id} value={e.id}>
                        {e.num} - {e.actor} vs {e.demandado} ({e.materia})
                      </option>
                    ))}
                  </select>
                )
              ) : (
                prospectos.length === 0 ? (
                  <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>No hay prospectos en el CRM.</div>
                ) : (
                  <select
                    style={selectStyle}
                    value={origenId}
                    onChange={e => setOrigenId(e.target.value)}
                  >
                    <option value="">-- Selecciona un prospecto --</option>
                    {prospectos.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.nombre} - {p.asunto || 'Sin asunto'} ({p.materia})
                      </option>
                    ))}
                  </select>
                )
              )}
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={smallLabel}>Previsualización del escrito generado (Puedes editar libremente antes de guardar)</div>
            <textarea
              style={{ ...textareaStyle, minHeight: 300, background: 'var(--surface-2)' }}
              value={docGeneradoText}
              onChange={e => setDocGeneradoText(e.target.value)}
            />
          </div>
        )}
      </Modal>
    </div>
  )
}

const btnPri = {
  background: 'var(--primary)', color: '#fff', border: 'none',
  borderRadius: 'var(--radius)', padding: '9px 16px', fontSize: 13, fontWeight: 600,
  cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6,
}
const btnSec = {
  background: 'var(--surface)', color: 'var(--text)', border: '1px solid var(--border)',
  borderRadius: 'var(--radius)', padding: '8px 14px', fontSize: 13, fontWeight: 500, cursor: 'pointer',
  display: 'inline-flex', alignItems: 'center', gap: 6
}
const btnIcon = {
  background: 'var(--surface-3)', border: '1px solid var(--border)', color: 'var(--text-secondary)',
  borderRadius: 'var(--radius-sm)', padding: '6px 8px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center'
}
const iconSmallBtn = {
  background: 'var(--surface-3)', border: '1px solid var(--border)',
  color: 'var(--text)', borderRadius: 'var(--radius-sm)', width: 26, height: 26,
  cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 11
}
const inputStyle = {
  background: 'var(--surface)', border: '1px solid var(--border)',
  color: 'var(--text)', borderRadius: 'var(--radius)',
  padding: '9px 12px', fontSize: 13, width: '100%',
}
const textareaStyle = {
  ...inputStyle,
  minHeight: 180,
  resize: 'vertical',
  fontFamily: 'monospace',
  lineHeight: '1.5',
}
const selectStyle = { ...inputStyle, padding: '9px 12px', fontSize: 13 }
const smallLabel = { fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '.5px' }
