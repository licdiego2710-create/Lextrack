import { useState } from 'react'
import { supabase } from '../supabaseClient'
import { fmtFecha } from '../utils/helpers'
import PageHeader from '../components/ui/PageHeader'

const DIAS_SEM = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
const FESTIVOS = ['01-01', '02-05', '03-21', '05-01', '09-16', '11-20', '12-25']

const PREDEFS = [
  ['Recurso de revocación', 3, 'hábiles'],
  ['Apelación — auto interlocutorio', 3, 'hábiles'],
  ['Apelación — sentencia definitiva', 9, 'hábiles'],
  ['Contestación (juicio ordinario mercantil)', 9, 'hábiles'],
  ['Contestación (juicio ejecutivo mercantil)', 5, 'hábiles'],
  ['Contestación (juicio oral mercantil)', 9, 'hábiles'],
  ['Ofrecimiento de pruebas', 10, 'hábiles'],
  ['Alegatos', 3, 'hábiles'],
  ['Amparo directo', 15, 'hábiles'],
  ['Amparo indirecto', 15, 'hábiles'],
  ['Expresión de agravios', 15, 'hábiles'],
  ['Tercería excluyente', 3, 'hábiles'],
  ['Incidente de nulidad', 3, 'hábiles'],
  ['Aclaración de sentencia', 3, 'hábiles'],
]

export default function Plazos() {
  const [fecha, setFecha] = useState('')
  const [custom, setCustom] = useState([])
  const [inhabiles, setInhabiles] = useState(() => {
    try { return JSON.parse(localStorage.getItem('lextrack_inhabiles') || '[]') } catch { return [] }
  })
  const [nuevoInh, setNuevoInh] = useState({ fecha: '', nota: '' })
  const [mostrarInh, setMostrarInh] = useState(false)
  const [mostrarImport, setMostrarImport] = useState(false)
  const [textoCalendario, setTextoCalendario] = useState('')
  const [previewInh, setPreviewInh] = useState([])
  const [procesandoImagen, setProcesandoImagen] = useState(false)
  const [imagenPreview, setImagenPreview] = useState(null)

  function saveInhabiles(lista) {
    setInhabiles(lista)
    localStorage.setItem('lextrack_inhabiles', JSON.stringify(lista))
  }
  function agregarInhabil() {
    if (!nuevoInh.fecha) return
    if (inhabiles.some(i => i.fecha === nuevoInh.fecha)) { alert('Esa fecha ya está registrada.'); return }
    saveInhabiles([...inhabiles, { fecha: nuevoInh.fecha, nota: nuevoInh.nota }].sort((a, b) => a.fecha.localeCompare(b.fecha)))
    setNuevoInh({ fecha: '', nota: '' })
  }
  function parsearLineas(texto) {
    return texto.split(/[\n]+/).map(l => l.trim()).filter(Boolean).reduce((acc, linea) => {
      let m = linea.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})\s*[,-]?\s*(.*)$/)
      if (m) { acc.push({ fecha: `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`, nota: m[4].trim() }); return acc }
      m = linea.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})\s*[,-]?\s*(.*)$/)
      if (m) { acc.push({ fecha: `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`, nota: m[4].trim() }); return acc }
      return acc
    }, [])
  }
  function procesarTexto(texto) {
    setTextoCalendario(texto)
    setPreviewInh(parsearLineas(texto))
  }
  function leerArchivoCalendario(file) {
    if (!file) return
    const reader = new FileReader()
    reader.onload = e => procesarTexto(e.target.result)
    reader.readAsText(file, 'UTF-8')
  }
  async function extraerDesdeImagen(file) {
    if (!file) return
    if (file.size > 5 * 1024 * 1024) { alert('La imagen no debe superar 5 MB.'); return }
    setProcesandoImagen(true)
    setPreviewInh([])
    try {
      const base64 = await new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = e => resolve(e.target.result.split(',')[1])
        reader.onerror = reject
        reader.readAsDataURL(file)
      })
      setImagenPreview(URL.createObjectURL(file))
      const { data, error } = await supabase.functions.invoke('extraer-inhabiles', {
        body: { imagen: base64, tipo: file.type || 'image/jpeg' },
      })
      if (error) throw new Error(error.message)
      if (data.error) throw new Error(data.error)
      if (!data.fechas?.length) { alert('No se encontraron fechas en la imagen.'); return }
      setPreviewInh(data.fechas)
    } catch (e) {
      alert('Error al procesar la imagen: ' + e.message)
    }
    setProcesandoImagen(false)
  }
  function confirmarImportCalendario() {
    const nuevas = previewInh.filter(p => p.fecha && !inhabiles.some(i => i.fecha === p.fecha))
    const omitidas = previewInh.length - nuevas.length
    saveInhabiles([...inhabiles, ...nuevas].sort((a, b) => a.fecha.localeCompare(b.fecha)))
    setTextoCalendario(''); setPreviewInh([]); setMostrarImport(false)
    alert(`${nuevas.length} fecha(s) importada(s).${omitidas ? ` ${omitidas} ya existían.` : ''}`)
  }
  function esHabil(d) {
    const dow = d.getDay()
    const mmdd = `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    const fStr = d.toISOString().slice(0, 10)
    return dow !== 0 && dow !== 6 && !FESTIVOS.includes(mmdd) && !inhabiles.some(i => i.fecha === fStr)
  }
  function calcular(base, dias, tipo) {
    if (!base || !dias) return null
    const d = new Date(base + 'T00:00:00')
    if (tipo === 'naturales') { d.setDate(d.getDate() + Number(dias)) }
    else { let n = 0; while (n < Number(dias)) { d.setDate(d.getDate() + 1); if (esHabil(d)) n++ } }
    return d
  }

  function ResultCard({ label, dias, tipo, onRemove }) {
    const res = calcular(fecha, dias, tipo)
    if (!res) return null
    const resStr = res.toISOString().slice(0, 10)
    const dow = res.getDay()
    const mmdd = `${String(res.getMonth() + 1).padStart(2, '0')}-${String(res.getDate()).padStart(2, '0')}`
    const inhReg = inhabiles.find(i => i.fecha === resStr)
    const esFest = FESTIVOS.includes(mmdd)
    const esFinSem = dow === 0 || dow === 6
    const warn = esFinSem || esFest || !!inhReg
    const warnLbl = esFest ? 'Festivo federal' : esFinSem ? 'Fin de semana' : inhReg ? `Inhábil CJE${inhReg.nota ? ` · ${inhReg.nota}` : ''}` : ''
    return (
      <div style={{
        background: 'var(--surface)',
        border: `1px solid ${warn ? 'var(--warning)' : 'var(--border)'}`,
        borderRadius: 'var(--radius)',
        padding: '12px 14px',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8,
      }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, color: 'var(--text)', fontWeight: 600, marginBottom: 2 }}>{label}</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{dias} días {tipo}</div>
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: warn ? 'var(--warning)' : 'var(--primary)' }}>{fmtFecha(resStr)}</div>
          <div style={{ fontSize: 11, color: warn ? 'var(--warning)' : 'var(--text-muted)' }}>{DIAS_SEM[dow]}{warn ? ` · ${warnLbl}` : ''}</div>
        </div>
        {onRemove && <button onClick={onRemove} style={btnDanger}>×</button>}
      </div>
    )
  }

  return (
    <div>
      <PageHeader
        title="Calculadora de Plazos"
        subtitle="Días hábiles según festivos federales y calendario del CJE Jalisco"
      />

      <div style={cardStyle}>
        <div style={labelTitle}>Fecha de notificación / fecha del auto</div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <input style={{ ...inputStyle, maxWidth: 200 }} type="date" value={fecha} onChange={e => setFecha(e.target.value)}/>
          {fecha && <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{new Date(fecha + 'T00:00:00').toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</span>}
          {fecha && <button style={btnSec} onClick={() => setFecha('')}>Limpiar</button>}
        </div>
      </div>

      {/* Bloque de días inhábiles */}
      <div style={{ ...cardStyle, padding: 0, overflow: 'hidden' }}>
        <button onClick={() => setMostrarInh(v => !v)} style={{
          width: '100%', background: 'none', border: 'none',
          padding: '14px 18px',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          cursor: 'pointer', color: 'var(--text)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.5px', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Días inhábiles — Consejo de la Judicatura</span>
            {inhabiles.length > 0 && <span style={{ background: 'var(--primary)', color: '#fff', borderRadius: 999, fontSize: 11, fontWeight: 700, padding: '1px 9px' }}>{inhabiles.length}</span>}
          </div>
          <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>{mostrarInh ? '▲' : '▼'}</span>
        </button>
        {mostrarInh && (
          <div style={{ borderTop: '1px solid var(--border)', padding: '16px 18px' }}>
            <div style={labelTitle}>Agregar fecha individual</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16, alignItems: 'flex-end' }}>
              <div>
                <div style={smallLabel}>Fecha</div>
                <input style={{ ...inputStyle, width: 160 }} type="date" value={nuevoInh.fecha}
                  onChange={e => setNuevoInh(v => ({ ...v, fecha: e.target.value }))}
                  onKeyDown={e => e.key === 'Enter' && agregarInhabil()}/>
              </div>
              <div style={{ flex: 1, minWidth: 200 }}>
                <div style={smallLabel}>Motivo (opcional)</div>
                <input style={inputStyle} placeholder="Ej: Acuerdo 12/2025" value={nuevoInh.nota}
                  onChange={e => setNuevoInh(v => ({ ...v, nota: e.target.value }))}
                  onKeyDown={e => e.key === 'Enter' && agregarInhabil()}/>
              </div>
              <button style={btnPri} onClick={agregarInhabil}>Agregar</button>
            </div>

            <div style={{ background: 'var(--surface-3)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden', marginBottom: 16 }}>
              <button onClick={() => setMostrarImport(v => !v)} style={{
                width: '100%', background: 'none', border: 'none', padding: '10px 14px',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer',
              }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--primary)' }}>Importar calendario oficial del CJE Jalisco</span>
                <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>{mostrarImport ? '▲' : '▼'}</span>
              </button>
              {mostrarImport && (
                <div style={{ borderTop: '1px solid var(--border)', padding: 14 }}>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 14, lineHeight: 1.6 }}>
                    Sube una foto, pega texto o carga un CSV.
                  </div>
                  <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: 12, marginBottom: 12 }}>
                    <div style={{ ...smallLabel, color: 'var(--primary)', marginBottom: 8 }}>Subir imagen (IA)</div>
                    <label style={{
                      display: 'inline-flex', alignItems: 'center', gap: 8,
                      background: procesandoImagen ? 'var(--surface-3)' : 'var(--primary)',
                      border: 'none', borderRadius: 'var(--radius)', padding: '9px 16px',
                      cursor: procesandoImagen ? 'not-allowed' : 'pointer', fontSize: 12,
                      color: '#fff', fontWeight: 600,
                    }}>
                      {procesandoImagen ? 'Analizando imagen...' : 'Seleccionar imagen'}
                      <input type="file" accept="image/*" style={{ display: 'none' }} disabled={procesandoImagen}
                        onChange={e => { extraerDesdeImagen(e.target.files[0]); e.target.value = '' }}/>
                    </label>
                    {imagenPreview && !procesandoImagen && (
                      <img src={imagenPreview} alt="Calendario" style={{ display: 'block', marginTop: 10, maxWidth: '100%', maxHeight: 180, objectFit: 'contain', borderRadius: 6, border: '1px solid var(--border)' }}/>
                    )}
                  </div>

                  <div style={smallLabel}>O pegar fechas en texto</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>
                    Formatos: DD/MM/AAAA o AAAA-MM-DD, nota opcional separada por coma.
                  </div>
                  <textarea
                    style={{ ...inputStyle, minHeight: 90, resize: 'vertical', fontFamily: 'monospace', fontSize: 12, marginBottom: 10 }}
                    placeholder={'10/02/2025, Periodo vacacional\n17/03/2025\n18/03/2025'}
                    value={textoCalendario}
                    onChange={e => procesarTexto(e.target.value)}
                  />

                  <div style={smallLabel}>O subir CSV/TXT</div>
                  <label style={{
                    display: 'inline-block', background: 'var(--surface)', border: '1px dashed var(--border)',
                    borderRadius: 'var(--radius)', padding: '8px 16px', cursor: 'pointer',
                    fontSize: 12, color: 'var(--primary)', fontWeight: 500, marginBottom: 12,
                  }}>
                    Seleccionar archivo (.csv o .txt)
                    <input type="file" accept=".csv,.txt" style={{ display: 'none' }}
                      onChange={e => { leerArchivoCalendario(e.target.files[0]); e.target.value = '' }}/>
                  </label>
                  {previewInh.length > 0 && (
                    <>
                      <div style={{ ...smallLabel, marginBottom: 6 }}>Vista previa — {previewInh.length} fecha(s)</div>
                      <div style={{ maxHeight: 160, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 'var(--radius)', marginBottom: 10 }}>
                        {previewInh.map((p, i) => (
                          <div key={i} style={{ display: 'flex', gap: 10, padding: '5px 10px', borderBottom: '1px solid var(--border)', fontSize: 12 }}>
                            <span style={{ color: 'var(--primary)', fontWeight: 600, minWidth: 80 }}>{fmtFecha(p.fecha)}</span>
                            <span style={{ color: inhabiles.some(x => x.fecha === p.fecha) ? 'var(--warning)' : 'var(--text-muted)' }}>
                              {inhabiles.some(x => x.fecha === p.fecha) ? 'Ya registrada' : p.nota || new Date(p.fecha + 'T00:00:00').toLocaleDateString('es-MX', { weekday: 'long' })}
                            </span>
                          </div>
                        ))}
                      </div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button style={btnPri} onClick={confirmarImportCalendario}>
                          Importar {previewInh.filter(p => !inhabiles.some(x => x.fecha === p.fecha)).length} fecha(s) nueva(s)
                        </button>
                        <button style={btnSec} onClick={() => { setTextoCalendario(''); setPreviewInh([]) }}>Limpiar</button>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>

            {inhabiles.length === 0
              ? <div style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', padding: 10 }}>Sin días inhábiles registrados.</div>
              : (
                <>
                  <div style={smallLabel}>Días registrados ({inhabiles.length})</div>
                  <div style={{ maxHeight: 220, overflowY: 'auto' }}>
                    {inhabiles.map(i => (
                      <div key={i.fecha} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 0', borderTop: '1px solid var(--border)' }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--primary)', minWidth: 92 }}>{fmtFecha(i.fecha)}</span>
                        <span style={{ fontSize: 12, color: 'var(--text-muted)', flex: 1 }}>
                          {new Date(i.fecha + 'T00:00:00').toLocaleDateString('es-MX', { weekday: 'long' })}
                          {i.nota && <span style={{ color: 'var(--text)' }}> · {i.nota}</span>}
                        </span>
                        <button style={btnDanger} onClick={() => saveInhabiles(inhabiles.filter(x => x.fecha !== i.fecha))}>×</button>
                      </div>
                    ))}
                  </div>
                  <button style={{ ...btnDanger, marginTop: 10, fontSize: 11 }} onClick={() => { if (confirm(`¿Eliminar los ${inhabiles.length} días?`)) saveInhabiles([]) }}>Borrar todos</button>
                </>
              )}
          </div>
        )}
      </div>

      {!fecha && (
        <div style={{ textAlign: 'center', padding: 48, color: 'var(--text-muted)', fontSize: 14 }}>
          Selecciona la fecha de notificación para calcular los plazos.
        </div>
      )}

      {fecha && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 8, marginBottom: 12 }}>
            {PREDEFS.map(([l, d, t]) => <ResultCard key={l} label={l} dias={d} tipo={t}/>)}
          </div>
          {custom.map((c, i) => (
            <div key={i} style={{
              background: 'var(--surface)', border: '1px solid var(--border)',
              borderRadius: 'var(--radius)', padding: '12px 14px',
              marginBottom: 8, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap',
            }}>
              <input style={{ ...inputStyle, flex: 2, minWidth: 140 }} placeholder="Descripción del término" value={c.label}
                onChange={e => setCustom(a => a.map((x, j) => j === i ? { ...x, label: e.target.value } : x))}/>
              <input style={{ ...inputStyle, width: 72 }} type="number" min="1" value={c.dias}
                onChange={e => setCustom(a => a.map((x, j) => j === i ? { ...x, dias: e.target.value } : x))}/>
              <select style={inputStyle} value={c.tipo}
                onChange={e => setCustom(a => a.map((x, j) => j === i ? { ...x, tipo: e.target.value } : x))}>
                <option value="hábiles">Días hábiles</option>
                <option value="naturales">Días naturales</option>
              </select>
              {calcular(fecha, c.dias, c.tipo) && (() => {
                const r = calcular(fecha, c.dias, c.tipo)
                const rs = r.toISOString().slice(0, 10)
                const dw = r.getDay()
                return <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--primary)', whiteSpace: 'nowrap' }}>{fmtFecha(rs)} <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{DIAS_SEM[dw]}</span></span>
              })()}
              <button style={btnDanger} onClick={() => setCustom(a => a.filter((_, j) => j !== i))}>×</button>
            </div>
          ))}
          <button style={btnSec} onClick={() => setCustom(c => [...c, { label: '', dias: 5, tipo: 'hábiles' }])}>+ Término personalizado</button>
          <div style={{
            marginTop: 16, fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.7,
            background: 'var(--surface-3)', border: '1px solid var(--border)',
            borderRadius: 'var(--radius)', padding: '10px 14px',
          }}>
            Los plazos en amarillo caen en fin de semana, festivo federal o día inhábil registrado.<br/>
            Festivos federales fijos: 1 Ene · 5 Feb · 21 Mar · 1 May · 16 Sep · 20 Nov · 25 Dic
          </div>
        </>
      )}
    </div>
  )
}

const cardStyle = {
  background: 'var(--surface)', border: '1px solid var(--border)',
  borderRadius: 'var(--radius-lg)', padding: 18, marginBottom: 14,
}
const labelTitle = { fontSize: 11, color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 8 }
const smallLabel = { fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '.5px' }
const inputStyle = {
  background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)',
  borderRadius: 'var(--radius)', padding: '9px 12px', fontSize: 13,
}
const btnPri = {
  background: 'var(--primary)', color: '#fff', border: 'none',
  borderRadius: 'var(--radius)', padding: '9px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
}
const btnSec = {
  background: 'var(--surface)', color: 'var(--text)', border: '1px solid var(--border)',
  borderRadius: 'var(--radius)', padding: '8px 14px', fontSize: 13, fontWeight: 500, cursor: 'pointer',
}
const btnDanger = {
  background: 'transparent', color: 'var(--danger)', border: '1px solid var(--danger)',
  borderRadius: 'var(--radius-sm)', padding: '4px 10px', fontSize: 11, cursor: 'pointer',
}
