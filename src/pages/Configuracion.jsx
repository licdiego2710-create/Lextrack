import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { useOrg } from '../context/OrgContext'
import { useToast } from '../context/ToastContext'
import PageHeader from '../components/ui/PageHeader'

const inputStyle = {
  width: '100%', padding: '9px 12px', borderRadius: 'var(--radius)',
  border: '1px solid var(--border)', background: 'var(--surface-2)',
  color: 'var(--text)', fontSize: 13, outline: 'none',
}
const labelStyle = {
  fontSize: 11, fontWeight: 700, color: 'var(--text-muted)',
  textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 5, display: 'block',
}
const sectionStyle = {
  background: 'var(--surface)', border: '1px solid var(--border)',
  borderRadius: 'var(--radius-lg)', padding: 24, marginBottom: 20,
}
const btnPri = {
  background: 'var(--primary)', color: '#fff', border: 'none',
  borderRadius: 'var(--radius)', padding: '9px 20px', fontSize: 13,
  fontWeight: 600, cursor: 'pointer',
}

export default function Configuracion() {
  const { org, miembro } = useOrg()
  const toast = useToast()
  const isAdmin = miembro?.rol === 'admin'

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [configId, setConfigId] = useState(null)
  const [form, setForm] = useState({
    nombre_completo: '',
    razon_social: '',
    rfc: '',
    direccion: '',
    telefono: '',
    email_oficial: '',
    logo_url: '',
    membrete_texto: '',
  })

  useEffect(() => {
    if (!org?.id) return
    async function cargar() {
      setLoading(true)
      const { data } = await supabase
        .from('despacho_config')
        .select('*')
        .eq('despacho_id', org.id)
        .maybeSingle()
      if (data) {
        setConfigId(data.id)
        setForm({
          nombre_completo: data.nombre_completo || '',
          razon_social:    data.razon_social    || '',
          rfc:             data.rfc             || '',
          direccion:       data.direccion       || '',
          telefono:        data.telefono        || '',
          email_oficial:   data.email_oficial   || '',
          logo_url:        data.logo_url        || '',
          membrete_texto:  data.membrete_texto  || '',
        })
      }
      setLoading(false)
    }
    cargar()
  }, [org?.id])

  function set(key, val) {
    setForm(f => ({ ...f, [key]: val }))
  }

  async function handleLogoUpload(e) {
    const file = e.target.files[0]
    if (!file) return
    if (file.size > 2 * 1024 * 1024) { toast.error('El logo no debe superar 2 MB'); return }
    setUploadingLogo(true)
    const path = `logos/${org.id}/${Date.now()}_${file.name}`
    const { error } = await supabase.storage.from('documentos').upload(path, file, { upsert: true })
    if (error) {
      toast.error('Error al subir logo: ' + error.message)
    } else {
      const { data: urlData } = supabase.storage.from('documentos').getPublicUrl(path)
      set('logo_url', urlData.publicUrl)
      toast.success('Logo subido correctamente')
    }
    setUploadingLogo(false)
  }

  async function guardar() {
    if (!isAdmin) return
    setSaving(true)
    const payload = {
      despacho_id: org.id,
      ...form,
      actualizado_en: new Date().toISOString(),
    }
    let error
    if (configId) {
      ;({ error } = await supabase.from('despacho_config').update(payload).eq('id', configId))
    } else {
      const { data, error: e } = await supabase.from('despacho_config').insert(payload).select('id').single()
      if (data) setConfigId(data.id)
      error = e
    }
    setSaving(false)
    if (error) toast.error('Error al guardar: ' + error.message)
    else toast.success('Configuración guardada correctamente')
  }

  if (loading) return (
    <div style={{ textAlign: 'center', padding: 64, color: 'var(--text-muted)' }}>Cargando configuración...</div>
  )

  return (
    <div>
      <PageHeader
        title="Configuración del Despacho"
        subtitle="Datos generales, fiscales y membrete para documentos oficiales"
        actions={
          isAdmin && (
            <button style={btnPri} disabled={saving} onClick={guardar}>
              {saving ? 'Guardando...' : '💾 Guardar cambios'}
            </button>
          )
        }
      />

      {!isAdmin && (
        <div style={{
          background: 'var(--warning-bg)', border: '1px solid var(--warning)',
          borderRadius: 'var(--radius)', padding: '12px 16px', marginBottom: 20,
          color: 'var(--warning-text)', fontSize: 13,
        }}>
          ⚠️ Solo los administradores pueden editar la configuración del despacho.
        </div>
      )}

      {/* Logo */}
      <div style={sectionStyle}>
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
          🖼️ Logo del Despacho
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
          {form.logo_url ? (
            <img
              src={form.logo_url}
              alt="Logo del despacho"
              style={{ height: 72, maxWidth: 200, objectFit: 'contain', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface-3)', padding: 8 }}
            />
          ) : (
            <div style={{
              width: 100, height: 72, borderRadius: 8, border: '2px dashed var(--border)',
              background: 'var(--surface-3)', display: 'flex', alignItems: 'center',
              justifyContent: 'center', color: 'var(--text-muted)', fontSize: 11,
            }}>Sin logo</div>
          )}
          {isAdmin && (
            <div>
              <label style={{
                display: 'inline-flex', alignItems: 'center', gap: 8,
                padding: '8px 16px', background: 'var(--surface-3)',
                border: '1px solid var(--border)', borderRadius: 'var(--radius)',
                cursor: 'pointer', fontSize: 13, fontWeight: 500, color: 'var(--text)',
              }}>
                {uploadingLogo ? '⏳ Subiendo...' : '📁 Subir logo (PNG, JPG — máx. 2MB)'}
                <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleLogoUpload} disabled={uploadingLogo} />
              </label>
              {form.logo_url && (
                <button onClick={() => set('logo_url', '')} style={{ marginLeft: 8, background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', fontSize: 12 }}>
                  Eliminar logo
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Datos Generales */}
      <div style={sectionStyle}>
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 16 }}>🏛️ Datos Generales</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
          <div>
            <label style={labelStyle}>Nombre del Despacho</label>
            <input style={inputStyle} value={form.nombre_completo} onChange={e => set('nombre_completo', e.target.value)}
              placeholder="Ej: García & Asociados Abogados S.C." disabled={!isAdmin} />
          </div>
          <div>
            <label style={labelStyle}>Razón Social</label>
            <input style={inputStyle} value={form.razon_social} onChange={e => set('razon_social', e.target.value)}
              placeholder="Razón social para facturas" disabled={!isAdmin} />
          </div>
          <div>
            <label style={labelStyle}>RFC</label>
            <input style={inputStyle} value={form.rfc} onChange={e => set('rfc', e.target.value.toUpperCase())}
              placeholder="Ej: GAA010101AAA" maxLength={13} disabled={!isAdmin} />
          </div>
          <div>
            <label style={labelStyle}>Teléfono</label>
            <input style={inputStyle} value={form.telefono} onChange={e => set('telefono', e.target.value)}
              placeholder="Ej: +52 33 1234 5678" disabled={!isAdmin} />
          </div>
          <div>
            <label style={labelStyle}>Correo Oficial</label>
            <input style={inputStyle} type="email" value={form.email_oficial} onChange={e => set('email_oficial', e.target.value)}
              placeholder="contacto@despacho.com.mx" disabled={!isAdmin} />
          </div>
          <div>
            <label style={labelStyle}>Dirección</label>
            <input style={inputStyle} value={form.direccion} onChange={e => set('direccion', e.target.value)}
              placeholder="Calle, Colonia, Ciudad, CP" disabled={!isAdmin} />
          </div>
        </div>
      </div>

      {/* Membrete */}
      <div style={sectionStyle}>
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>📄 Membrete para Documentos</div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 14 }}>
          Este texto aparecerá en el encabezado de los estados de cuenta y escritos generados. Puedes incluir slogan, lema o datos adicionales.
        </div>
        <textarea
          style={{ ...inputStyle, minHeight: 90, resize: 'vertical' }}
          value={form.membrete_texto}
          onChange={e => set('membrete_texto', e.target.value)}
          placeholder="Ej: Servicios jurídicos especializados en materia mercantil y civil. Guadalajara, Jalisco."
          disabled={!isAdmin}
        />
      </div>

      {/* Vista previa membrete */}
      {(form.nombre_completo || form.logo_url) && (
        <div style={sectionStyle}>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 16 }}>👁️ Vista Previa del Membrete</div>
          <div style={{
            border: '1px solid var(--border)', borderRadius: 'var(--radius)',
            padding: 24, background: 'var(--surface-3)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: form.membrete_texto ? 12 : 0, flexWrap: 'wrap' }}>
              {form.logo_url && (
                <img src={form.logo_url} alt="Logo" style={{ height: 52, objectFit: 'contain' }} />
              )}
              <div>
                <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text)' }}>{form.nombre_completo || org?.nombre}</div>
                {form.razon_social && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{form.razon_social}</div>}
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                  {form.rfc && <span>RFC: {form.rfc}</span>}
                  {form.telefono && <span>Tel: {form.telefono}</span>}
                  {form.email_oficial && <span>{form.email_oficial}</span>}
                </div>
                {form.direccion && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{form.direccion}</div>}
              </div>
            </div>
            {form.membrete_texto && (
              <div style={{
                borderTop: '1px solid var(--border)', paddingTop: 10, marginTop: 4,
                fontSize: 12, color: 'var(--text-secondary)', fontStyle: 'italic',
              }}>
                {form.membrete_texto}
              </div>
            )}
          </div>
        </div>
      )}

      {isAdmin && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', paddingBottom: 32 }}>
          <button style={btnPri} disabled={saving} onClick={guardar}>
            {saving ? 'Guardando...' : '💾 Guardar configuración'}
          </button>
        </div>
      )}
    </div>
  )
}
