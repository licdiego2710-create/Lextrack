import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { useOrg } from '../context/OrgContext'
import { useToast } from '../context/ToastContext'
import { MATERIAS, PRIORIDADES } from '../utils/helpers'
import PageHeader from '../components/ui/PageHeader'
import Modal from '../components/ui/Modal'
import EmptyState from '../components/ui/EmptyState'

// ── Configuración del pipeline ───────────────────────────────
const ETAPAS = [
  { key: 'Nuevo',      label: 'Nuevo',      color: '#3b82f6', bg: 'rgba(59,130,246,.12)'  },
  { key: 'Contactado', label: 'Contactado', color: '#8b5cf6', bg: 'rgba(139,92,246,.12)'  },
  { key: 'Reunión',    label: 'Reunión',    color: '#f59e0b', bg: 'rgba(245,158,11,.12)'  },
  { key: 'Propuesta',  label: 'Propuesta',  color: '#06b6d4', bg: 'rgba(6,182,212,.12)'   },
  { key: 'Ganado',     label: 'Ganado',     color: '#22c55e', bg: 'rgba(34,197,94,.12)'   },
  { key: 'Perdido',    label: 'Perdido',    color: '#ef4444', bg: 'rgba(239,68,68,.12)'   },
]
const ETAPA_MAP  = Object.fromEntries(ETAPAS.map(e => [e.key, e]))
const ORIGENES   = ['Referido', 'Sitio web', 'Redes sociales', 'Llamada directa', 'Publicidad', 'Otro']

const formVacio = () => ({
  nombre: '', email: '', telefono: '', asunto: '',
  materia: 'Mercantil', etapa: 'Nuevo', prioridad: 'Normal',
  origen: '', notas: '', valor_estimado: '',
})

export default function Prospectos({ session }) {
  const { org, canWrite } = useOrg()
  const toast  = useToast()
  const navigate = useNavigate()

  const [prospectos, setProspectos] = useState([])
  const [loading, setLoading]       = useState(true)
  const [vista, setVista]           = useState('kanban') // 'kanban' | 'lista'
  const [buscar, setBuscar]         = useState('')

  // Modal crear/editar
  const [modal, setModal]   = useState(false)
  const [editId, setEditId] = useState(null)
  const [form, setForm]     = useState(formVacio)
  const [saving, setSaving] = useState(false)

  // Drawer detalle
  const [detalle, setDetalle] = useState(null)

  // Modal convertir a expediente
  const [modalConvertir, setModalConvertir] = useState(false)
  const [convForm, setConvForm]             = useState({})
  const [convSaving, setConvSaving]         = useState(false)

  // ── Cargar ───────────────────────────────────────────────────
  const cargar = useCallback(async () => {
    if (!org) return
    setLoading(true)
    const { data } = await supabase
      .from('prospectos')
      .select('*')
      .eq('despacho_id', org.id)
      .order('creado_en', { ascending: false })
    setProspectos(data || [])
    setLoading(false)
  }, [org])

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { cargar() }, [cargar])

  // ── CRUD ─────────────────────────────────────────────────────
  function abrirNuevo() {
    setForm(formVacio())
    setEditId(null)
    setModal(true)
  }

  function abrirEditar(p) {
    setForm({
      nombre: p.nombre, email: p.email || '', telefono: p.telefono || '',
      asunto: p.asunto || '', materia: p.materia || 'Mercantil',
      etapa: p.etapa, prioridad: p.prioridad || 'Normal',
      origen: p.origen || '', notas: p.notas || '',
      valor_estimado: p.valor_estimado || '',
    })
    setEditId(p.id)
    setModal(true)
    setDetalle(null)
  }

  const setF = (k, v) => setForm(f => ({ ...f, [k]: v }))

  async function guardar() {
    if (!form.nombre.trim()) { toast('El nombre es obligatorio', 'error'); return }
    setSaving(true)
    const payload = {
      ...form,
      valor_estimado: form.valor_estimado ? parseFloat(form.valor_estimado) : null,
      despacho_id: org.id,
      user_id: session.user.id,
      actualizado_en: new Date().toISOString(),
    }
    let error
    if (editId) {
      ;({ error } = await supabase.from('prospectos').update(payload).eq('id', editId))
    } else {
      ;({ error } = await supabase.from('prospectos').insert({ ...payload, creado_en: new Date().toISOString() }))
    }
    setSaving(false)
    if (error) { toast('Error: ' + error.message, 'error'); return }
    
    // Log bitacora
    if (org?.id) {
      await supabase.from('bitacora_actividad').insert({
        despacho_id: org.id,
        user_id: session.user.id,
        user_email: session.user.email,
        accion: editId ? 'actualizar_prospecto' : 'crear_prospecto',
        detalles: editId
          ? `Actualizó el prospecto "${form.nombre}"`
          : `Creó el prospecto "${form.nombre}"`
      })
    }

    toast(editId ? 'Prospecto actualizado' : '✅ Prospecto creado')
    setModal(false)
    cargar()
  }

  async function eliminar(id, nombre) {
    if (!confirm(`¿Eliminar prospecto "${nombre}"?`)) return
    await supabase.from('prospectos').delete().eq('id', id)
    
    // Log bitacora
    if (org?.id) {
      await supabase.from('bitacora_actividad').insert({
        despacho_id: org.id,
        user_id: session.user.id,
        user_email: session.user.email,
        accion: 'eliminar_expediente',
        detalles: `Eliminó el prospecto "${nombre}"`
      })
    }

    toast('Prospecto eliminado', 'warning')
    setDetalle(null)
    cargar()
  }

  async function moverEtapa(id, nuevaEtapa) {
    await supabase.from('prospectos')
      .update({ etapa: nuevaEtapa, actualizado_en: new Date().toISOString() })
      .eq('id', id)
    
    const p = prospectos.find(x => x.id === id)
    if (org?.id && p) {
      await supabase.from('bitacora_actividad').insert({
        despacho_id: org.id,
        user_id: session.user.id,
        user_email: session.user.email,
        accion: 'actualizar_prospecto',
        detalles: `Movió el prospecto "${p.nombre}" a la etapa ${nuevaEtapa}`
      })
    }

    setProspectos(prev => prev.map(p => p.id === id ? { ...p, etapa: nuevaEtapa } : p))
    if (detalle?.id === id) setDetalle(d => ({ ...d, etapa: nuevaEtapa }))
    toast(`Movido a ${nuevaEtapa}`)
  }

  // ── Convertir a expediente ───────────────────────────────────
  function abrirConvertir(p) {
    setConvForm({
      num: '', actor: p.nombre, demandado: '',
      materia: p.materia || 'Mercantil',
      tipo: 'Juicio Ordinario Mercantil',
      juzgado: '', etapa: 'Admisión', estado: 'Activo',
      notas: p.asunto || '',
    })
    setDetalle(p)
    setModalConvertir(true)
  }

  async function handleConvertir() {
    if (!convForm.num.trim()) { toast('El número de expediente es obligatorio', 'error'); return }
    setConvSaving(true)
    const { data: exp, error } = await supabase
      .from('expedientes')
      .insert({
        ...convForm,
        termino: null, prioridad: 'Normal',
        despacho_id: org.id,
        user_id: session.user.id,
        creado_en: new Date().toISOString(),
        actualizado_en: new Date().toISOString(),
      })
      .select()
      .single()

    if (error) { toast('Error al crear expediente: ' + error.message, 'error'); setConvSaving(false); return }

    // Marcar prospecto como Ganado y enlazar expediente
    await supabase.from('prospectos')
      .update({ etapa: 'Ganado', expediente_id: exp.id, actualizado_en: new Date().toISOString() })
      .eq('id', detalle.id)

    // Log bitacora
    if (org?.id) {
      await supabase.from('bitacora_actividad').insert({
        despacho_id: org.id,
        user_id: session.user.id,
        user_email: session.user.email,
        accion: 'convertir_prospecto',
        detalles: `Convirtió al prospecto "${detalle.nombre}" en el expediente ${convForm.num}`
      })
    }

    setConvSaving(false)
    setModalConvertir(false)
    toast('✅ Convertido a expediente exitosamente')
    cargar()
    // Navegar al expediente creado
    navigate(`/app/expedientes?q=${encodeURIComponent(convForm.num)}`)
  }

  // ── Filtro ───────────────────────────────────────────────────
  const lista = prospectos.filter(p => {
    if (!buscar.trim()) return true
    const q = buscar.toLowerCase()
    return `${p.nombre} ${p.email || ''} ${p.asunto || ''} ${p.telefono || ''}`.toLowerCase().includes(q)
  })

  // KPIs
  const total   = prospectos.length
  const activos = prospectos.filter(p => !['Ganado','Perdido'].includes(p.etapa)).length
  const ganados = prospectos.filter(p => p.etapa === 'Ganado').length
  const tasa    = total > 0 ? Math.round((ganados / total) * 100) : 0

  return (
    <div style={{ position: 'relative' }}>
      <style>{`
        @keyframes slideIn { from { opacity:0; transform:translateX(24px) } to { opacity:1; transform:translateX(0) } }
        .prosp-card:hover { background: color-mix(in srgb, var(--primary) 5%, var(--surface)) !important; }
      `}</style>

      <PageHeader
        title="CRM — Prospectos"
        subtitle="Seguimiento de clientes potenciales"
        actions={
          <div style={{ display:'flex', gap:8 }}>
            {/* Toggle vista */}
            <div style={{ display:'flex', background:'var(--surface-3)', border:'1px solid var(--border)', borderRadius:'var(--radius)', overflow:'hidden' }}>
              {[['kanban','⊞'], ['lista','☰']].map(([v, ico]) => (
                <button key={v} onClick={() => setVista(v)} style={{
                  border:'none', padding:'7px 12px', cursor:'pointer', fontSize:14,
                  background: vista === v ? 'var(--primary)' : 'transparent',
                  color: vista === v ? '#fff' : 'var(--text-secondary)',
                  transition:'all .15s',
                }}>{ico}</button>
              ))}
            </div>
            {canWrite && (
              <button onClick={abrirNuevo} style={btnPri}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 5v14"/><path d="M5 12h14"/>
                </svg>
                Nuevo prospecto
              </button>
            )}
          </div>
        }
      />

      {/* KPIs */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(130px,1fr))', gap:12, marginBottom:16 }}>
        {[
          { label:'Total', value:total, color:'var(--primary)' },
          { label:'En pipeline', value:activos, color:'var(--warning)' },
          { label:'Ganados', value:ganados, color:'var(--success)' },
          { label:'Tasa de cierre', value:`${tasa}%`, color:'var(--info)' },
        ].map(k => (
          <div key={k.label} style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'var(--radius-lg)', padding:'14px 16px' }}>
            <div style={{ fontSize:11, color:'var(--text-muted)', fontWeight:600, textTransform:'uppercase', letterSpacing:'.5px' }}>{k.label}</div>
            <div style={{ fontSize:24, fontWeight:800, color:k.color, marginTop:4 }}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* Buscador */}
      <div style={{ position:'relative', marginBottom:16, maxWidth:320 }}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
          style={{ position:'absolute', left:10, top:'50%', transform:'translateY(-50%)', color:'var(--text-muted)' }}>
          <circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>
        </svg>
        <input
          value={buscar} onChange={e => setBuscar(e.target.value)}
          placeholder="Buscar prospecto..."
          style={{ ...inputStyle, paddingLeft:30, width:'100%' }}
        />
      </div>

      {/* ── Vista Kanban ── */}
      {vista === 'kanban' && (
        <div style={{ display:'flex', gap:12, overflowX:'auto', paddingBottom:12, alignItems:'flex-start' }}>
          {ETAPAS.map(etapa => {
            const cards = lista.filter(p => p.etapa === etapa.key)
            return (
              <div key={etapa.key} style={{
                minWidth:220, maxWidth:260, flex:'0 0 220px',
                background:'var(--surface-3)', border:'1px solid var(--border)',
                borderRadius:'var(--radius-lg)', overflow:'hidden',
              }}>
                {/* Header columna */}
                <div style={{
                  padding:'10px 14px', display:'flex', alignItems:'center', justifyContent:'space-between',
                  borderBottom:'1px solid var(--border)',
                  borderTop:`3px solid ${etapa.color}`,
                }}>
                  <span style={{ fontSize:12, fontWeight:700, color:'var(--text)' }}>{etapa.label}</span>
                  <span style={{
                    fontSize:11, fontWeight:700, padding:'2px 8px', borderRadius:999,
                    background: etapa.bg, color: etapa.color,
                  }}>{cards.length}</span>
                </div>

                {/* Cards */}
                <div style={{ padding:8, display:'flex', flexDirection:'column', gap:6, minHeight:80 }}>
                  {loading && <div style={{ fontSize:12, color:'var(--text-muted)', padding:'12px 4px', textAlign:'center' }}>Cargando...</div>}
                  {!loading && cards.length === 0 && (
                    <div style={{ fontSize:11, color:'var(--text-muted)', padding:'16px 4px', textAlign:'center', fontStyle:'italic' }}>Sin prospectos</div>
                  )}
                  {cards.map(p => (
                    <div
                      key={p.id}
                      className="prosp-card"
                      onClick={() => setDetalle(p)}
                      style={{
                        background:'var(--surface)', border:'1px solid var(--border)',
                        borderRadius:'var(--radius)', padding:'10px 12px',
                        cursor:'pointer', transition:'background .15s',
                        borderLeft: `3px solid ${etapa.color}`,
                      }}
                    >
                      <div style={{ fontSize:13, fontWeight:700, color:'var(--text)', marginBottom:3 }}>{p.nombre}</div>
                      {p.asunto && <div style={{ fontSize:11, color:'var(--text-muted)', marginBottom:4, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{p.asunto}</div>}
                      <div style={{ display:'flex', gap:4, flexWrap:'wrap', marginTop:4 }}>
                        <span style={{ fontSize:10, padding:'2px 6px', borderRadius:999, background:'var(--surface-3)', color:'var(--text-muted)', border:'1px solid var(--border)' }}>{p.materia}</span>
                        {p.valor_estimado && (
                          <span style={{ fontSize:10, padding:'2px 6px', borderRadius:999, background:'rgba(34,197,94,.1)', color:'var(--success)', border:'1px solid rgba(34,197,94,.2)' }}>
                            ${Number(p.valor_estimado).toLocaleString('es-MX')}
                          </span>
                        )}
                        {p.expediente_id && (
                          <span style={{ fontSize:10, padding:'2px 6px', borderRadius:999, background:'rgba(34,197,94,.15)', color:'var(--success)', fontWeight:700 }}>✓ Exp.</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ── Vista Lista ── */}
      {vista === 'lista' && (
        <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'var(--radius-lg)', overflowX:'auto' }}>
          <table className="lx-table" style={{ border:'none', borderRadius:0 }}>
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Asunto</th>
                <th>Materia</th>
                <th>Etapa</th>
                <th>Valor est.</th>
                <th>Origen</th>
                <th style={{ width:60 }}></th>
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={7} style={{ textAlign:'center', padding:32, color:'var(--text-muted)' }}>Cargando...</td></tr>}
              {!loading && lista.length === 0 && (
                <tr><td colSpan={7} style={{ padding:32 }}>
                  <EmptyState title="Sin prospectos" subtitle="Agrega tu primer prospecto para empezar." action={canWrite && <button onClick={abrirNuevo} style={btnPri}>+ Nuevo prospecto</button>}/>
                </td></tr>
              )}
              {lista.map(p => {
                const et = ETAPA_MAP[p.etapa]
                return (
                  <tr key={p.id} onClick={() => setDetalle(p)} style={{ cursor:'pointer' }}>
                    <td>
                      <div style={{ fontSize:13, fontWeight:700, color:'var(--text)' }}>{p.nombre}</div>
                      {p.email && <div style={{ fontSize:11, color:'var(--text-muted)' }}>{p.email}</div>}
                    </td>
                    <td style={{ fontSize:12, color:'var(--text-muted)', maxWidth:200, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{p.asunto || '—'}</td>
                    <td style={{ fontSize:12 }}>{p.materia}</td>
                    <td>
                      <span style={{ fontSize:11, fontWeight:700, padding:'3px 9px', borderRadius:999, background: et?.bg, color: et?.color }}>
                        {p.etapa}
                      </span>
                    </td>
                    <td style={{ fontSize:12, color:'var(--text)' }}>
                      {p.valor_estimado ? `$${Number(p.valor_estimado).toLocaleString('es-MX')}` : '—'}
                    </td>
                    <td style={{ fontSize:12, color:'var(--text-muted)' }}>{p.origen || '—'}</td>
                    <td onClick={e => e.stopPropagation()}>
                      <div style={{ display:'flex', gap:4, justifyContent:'flex-end' }}>
                        {canWrite && (
                          <button onClick={() => abrirEditar(p)} style={iconBtn} title="Editar">
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                              <path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
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

      {/* ── Drawer detalle ── */}
      {detalle && (
        <div style={{
          position:'fixed', top:0, right:0, bottom:0, width:400,
          background:'var(--surface)', borderLeft:'1px solid var(--border)',
          boxShadow:'-8px 0 32px rgba(0,0,0,.15)',
          display:'flex', flexDirection:'column', zIndex:200,
          animation:'slideIn .2s cubic-bezier(.4,0,.2,1)',
        }}>
          {/* Header */}
          <div style={{ padding:'16px 20px', borderBottom:'1px solid var(--border)', flexShrink:0 }}>
            <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:10 }}>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:17, fontWeight:800, color:'var(--text)' }}>{detalle.nombre}</div>
                {detalle.email && <div style={{ fontSize:12, color:'var(--text-muted)', marginTop:2 }}>{detalle.email}</div>}
                {detalle.telefono && <div style={{ fontSize:12, color:'var(--text-muted)' }}>{detalle.telefono}</div>}
              </div>
              <button onClick={() => setDetalle(null)} style={{ ...iconBtn, padding:'5px 8px', fontSize:14 }}>✕</button>
            </div>

            {/* Badge etapa */}
            <div style={{ marginTop:10 }}>
              <span style={{
                fontSize:12, fontWeight:700, padding:'4px 12px', borderRadius:999,
                background: ETAPA_MAP[detalle.etapa]?.bg,
                color: ETAPA_MAP[detalle.etapa]?.color,
              }}>{detalle.etapa}</span>
            </div>
          </div>

          {/* Cuerpo scrolleable */}
          <div style={{ flex:1, overflowY:'auto', padding:'16px 20px', display:'flex', flexDirection:'column', gap:12 }}>
            {/* Info */}
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
              {[
                ['Materia', detalle.materia],
                ['Prioridad', detalle.prioridad],
                ['Origen', detalle.origen || '—'],
                ['Valor est.', detalle.valor_estimado ? `$${Number(detalle.valor_estimado).toLocaleString('es-MX')}` : '—'],
                ['Creado', new Date(detalle.creado_en).toLocaleDateString('es-MX')],
              ].map(([k,v]) => (
                <div key={k} style={{ background:'var(--surface-3)', border:'1px solid var(--border)', borderRadius:'var(--radius)', padding:'8px 12px' }}>
                  <div style={{ fontSize:10, color:'var(--text-muted)', fontWeight:700, textTransform:'uppercase', letterSpacing:'.5px', marginBottom:2 }}>{k}</div>
                  <div style={{ fontSize:13, color:'var(--text)', fontWeight:500 }}>{v}</div>
                </div>
              ))}
            </div>

            {detalle.asunto && (
              <div style={{ background:'var(--surface-3)', border:'1px solid var(--border)', borderRadius:'var(--radius)', padding:'10px 14px' }}>
                <div style={{ fontSize:10, color:'var(--text-muted)', fontWeight:700, textTransform:'uppercase', letterSpacing:'.5px', marginBottom:4 }}>Asunto</div>
                <div style={{ fontSize:13, color:'var(--text)', lineHeight:1.6 }}>{detalle.asunto}</div>
              </div>
            )}
            {detalle.notas && (
              <div style={{ background:'var(--surface-3)', border:'1px solid var(--border)', borderRadius:'var(--radius)', padding:'10px 14px' }}>
                <div style={{ fontSize:10, color:'var(--text-muted)', fontWeight:700, textTransform:'uppercase', letterSpacing:'.5px', marginBottom:4 }}>Notas</div>
                <div style={{ fontSize:13, color:'var(--text)', lineHeight:1.6, whiteSpace:'pre-wrap' }}>{detalle.notas}</div>
              </div>
            )}

            {/* Mover etapa */}
            {canWrite && !['Ganado','Perdido'].includes(detalle.etapa) && (
              <div>
                <div style={{ fontSize:11, color:'var(--text-muted)', fontWeight:700, textTransform:'uppercase', letterSpacing:'.5px', marginBottom:8 }}>Mover a</div>
                <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                  {ETAPAS.filter(e => e.key !== detalle.etapa).map(e => (
                    <button key={e.key} onClick={() => moverEtapa(detalle.id, e.key)} style={{
                      fontSize:11, fontWeight:700, padding:'5px 12px', borderRadius:999,
                      border:`1px solid ${e.color}`, background: e.bg, color: e.color, cursor:'pointer',
                    }}>{e.label}</button>
                  ))}
                </div>
              </div>
            )}

            {/* Expediente vinculado */}
            {detalle.expediente_id && (
              <div style={{ padding:'10px 14px', background:'rgba(34,197,94,.08)', border:'1px solid rgba(34,197,94,.25)', borderRadius:'var(--radius)' }}>
                <div style={{ fontSize:12, fontWeight:700, color:'var(--success)' }}>✓ Convertido a expediente</div>
                <button
                  onClick={() => navigate(`/app/expedientes`)}
                  style={{ fontSize:11, color:'var(--primary)', background:'none', border:'none', cursor:'pointer', padding:0, marginTop:4 }}
                >
                  Ver expediente →
                </button>
              </div>
            )}
          </div>

          {/* Pie */}
          {canWrite && (
            <div style={{ padding:'12px 20px', borderTop:'1px solid var(--border)', display:'flex', gap:8, flexShrink:0 }}>
              {!detalle.expediente_id && detalle.etapa !== 'Perdido' && (
                <button onClick={() => abrirConvertir(detalle)} style={{ ...btnPri, flex:1, justifyContent:'center', fontSize:12 }}>
                  ⚡ Convertir a expediente
                </button>
              )}
              <button onClick={() => abrirEditar(detalle)} style={{ ...btnSec, fontSize:12 }}>Editar</button>
              <button onClick={() => eliminar(detalle.id, detalle.nombre)} style={{ ...btnDanger, fontSize:12 }}>Eliminar</button>
            </div>
          )}
        </div>
      )}

      {/* Overlay drawer */}
      {detalle && (
        <div
          onClick={() => setDetalle(null)}
          style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.25)', zIndex:199 }}
        />
      )}

      {/* ── Modal crear/editar ── */}
      <Modal
        open={modal}
        onClose={() => setModal(false)}
        title={editId ? 'Editar prospecto' : 'Nuevo prospecto'}
        subtitle="Captura los datos del cliente potencial"
        width={640}
        footer={
          <>
            <button onClick={() => setModal(false)} style={btnSec}>Cancelar</button>
            <button onClick={guardar} disabled={saving} style={btnPri}>
              {saving ? 'Guardando...' : 'Guardar'}
            </button>
          </>
        }
      >
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
          <Field label="Nombre completo / Empresa *" full>
            <input style={inputStyle} value={form.nombre} onChange={e => setF('nombre', e.target.value)} placeholder="Juan Pérez / Empresa SA"/>
          </Field>
          <Field label="Correo electrónico">
            <input style={inputStyle} type="email" value={form.email} onChange={e => setF('email', e.target.value)} placeholder="correo@ejemplo.com"/>
          </Field>
          <Field label="Teléfono">
            <input style={inputStyle} value={form.telefono} onChange={e => setF('telefono', e.target.value)} placeholder="33 1234 5678"/>
          </Field>
          <Field label="Materia">
            <select style={inputStyle} value={form.materia} onChange={e => setF('materia', e.target.value)}>
              {MATERIAS.map(m => <option key={m}>{m}</option>)}
            </select>
          </Field>
          <Field label="Etapa del pipeline">
            <select style={inputStyle} value={form.etapa} onChange={e => setF('etapa', e.target.value)}>
              {ETAPAS.map(e => <option key={e.key}>{e.key}</option>)}
            </select>
          </Field>
          <Field label="Prioridad">
            <select style={inputStyle} value={form.prioridad} onChange={e => setF('prioridad', e.target.value)}>
              {PRIORIDADES.map(p => <option key={p}>{p}</option>)}
            </select>
          </Field>
          <Field label="Origen">
            <select style={inputStyle} value={form.origen} onChange={e => setF('origen', e.target.value)}>
              <option value="">— Sin especificar —</option>
              {ORIGENES.map(o => <option key={o}>{o}</option>)}
            </select>
          </Field>
          <Field label="Valor estimado del caso (MXN)">
            <input style={inputStyle} type="number" min="0" value={form.valor_estimado} onChange={e => setF('valor_estimado', e.target.value)} placeholder="0.00"/>
          </Field>
          <Field label="Asunto / Descripción del caso" full>
            <textarea style={{ ...inputStyle, minHeight:70, resize:'vertical' }} value={form.asunto} onChange={e => setF('asunto', e.target.value)} placeholder="Breve descripción del asunto legal..."/>
          </Field>
          <Field label="Notas internas" full>
            <textarea style={{ ...inputStyle, minHeight:60, resize:'vertical' }} value={form.notas} onChange={e => setF('notas', e.target.value)} placeholder="Notas del equipo, recordatorios..."/>
          </Field>
        </div>
      </Modal>

      {/* ── Modal convertir a expediente ── */}
      <Modal
        open={modalConvertir}
        onClose={() => setModalConvertir(false)}
        title="Convertir a expediente"
        subtitle={`Crear expediente para: ${detalle?.nombre}`}
        width={560}
        footer={
          <>
            <button onClick={() => setModalConvertir(false)} style={btnSec}>Cancelar</button>
            <button onClick={handleConvertir} disabled={convSaving} style={btnPri}>
              {convSaving ? 'Creando...' : '⚡ Crear expediente'}
            </button>
          </>
        }
      >
        <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
          <div style={{ padding:'10px 14px', background:'var(--surface-3)', border:'1px solid var(--border)', borderRadius:'var(--radius)', fontSize:12, color:'var(--text-muted)' }}>
            El prospecto quedará marcado como <strong style={{ color:'var(--success)' }}>Ganado</strong> y se vinculará al expediente.
          </div>
          <Field label="Número de expediente *">
            <input style={inputStyle} value={convForm.num || ''} onChange={e => setConvForm(f => ({ ...f, num: e.target.value }))} placeholder="1234/2025"/>
          </Field>
          <Field label="Actor (parte actora)">
            <input style={inputStyle} value={convForm.actor || ''} onChange={e => setConvForm(f => ({ ...f, actor: e.target.value }))}/>
          </Field>
          <Field label="Demandado">
            <input style={inputStyle} value={convForm.demandado || ''} onChange={e => setConvForm(f => ({ ...f, demandado: e.target.value }))} placeholder="Contraparte"/>
          </Field>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
            <Field label="Materia">
              <select style={inputStyle} value={convForm.materia || 'Mercantil'} onChange={e => setConvForm(f => ({ ...f, materia: e.target.value }))}>
                {MATERIAS.map(m => <option key={m}>{m}</option>)}
              </select>
            </Field>
            <Field label="Tipo">
              <input style={inputStyle} value={convForm.tipo || ''} onChange={e => setConvForm(f => ({ ...f, tipo: e.target.value }))} placeholder="Juicio Ordinario..."/>
            </Field>
          </div>
        </div>
      </Modal>
    </div>
  )
}

// ── Helpers locales ──────────────────────────────────────────
function Field({ label, children, full }) {
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:4, gridColumn: full ? '1 / -1' : 'auto' }}>
      <div style={labelStyle}>{label}</div>
      {children}
    </div>
  )
}

const inputStyle = {
  background:'var(--surface)', border:'1px solid var(--border)',
  color:'var(--text)', borderRadius:'var(--radius)',
  padding:'9px 12px', fontSize:13, width:'100%', boxSizing:'border-box',
}
const labelStyle = {
  fontSize:11, fontWeight:600, color:'var(--text-muted)',
  textTransform:'uppercase', letterSpacing:'.5px',
}
const btnPri = {
  background:'var(--primary)', color:'#fff', border:'none',
  borderRadius:'var(--radius)', padding:'9px 16px', fontSize:13, fontWeight:600,
  cursor:'pointer', display:'inline-flex', alignItems:'center', gap:6,
}
const btnSec = {
  background:'var(--surface)', color:'var(--text)',
  border:'1px solid var(--border)', borderRadius:'var(--radius)',
  padding:'8px 14px', fontSize:13, fontWeight:500, cursor:'pointer',
}
const btnDanger = {
  background:'transparent', color:'var(--danger)',
  border:'1px solid var(--danger)', borderRadius:'var(--radius)',
  padding:'8px 14px', fontSize:13, fontWeight:600, cursor:'pointer',
}
const iconBtn = {
  background:'var(--surface-3)', border:'1px solid var(--border)',
  color:'var(--text-secondary)', borderRadius:'var(--radius-sm)',
  padding:'6px 8px', cursor:'pointer',
  display:'inline-flex', alignItems:'center', justifyContent:'center',
}
