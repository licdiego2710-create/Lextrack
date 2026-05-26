import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'
import { useOrg } from '../context/OrgContext'
import { useToast } from '../context/ToastContext'
import PageHeader from '../components/ui/PageHeader'
import StatusBadge from '../components/ui/StatusBadge'

// ID de precios de Stripe - Configura tu ID de precio real de Stripe aquí o en las variables de entorno
const STRIPE_PRO_PRICE_ID = 'price_1ProPlanTestID' 

export default function Billing() {
  const { org, isAdmin } = useOrg()
  const toast = useToast()
  const [loading, setLoading] = useState(false)
  const [dbDespacho, setDbDespacho] = useState(null)

  useEffect(() => {
    if (!org?.id) return
    async function loadDespacho() {
      const { data, error } = await supabase
        .from('despachos')
        .select('*')
        .eq('id', org.id)
        .single()
      
      if (!error && data) {
        setDbDespacho(data)
      }
    }
    loadDespacho()
  }, [org?.id])

  async function handleCheckout() {
    if (!org?.id) return
    setLoading(true)
    try {
      const { data, error } = await supabase.functions.invoke('stripe-checkout', {
        body: {
          despachoId: org.id,
          priceId: STRIPE_PRO_PRICE_ID,
          returnUrl: window.location.href
        }
      })

      if (error) throw error
      if (data?.url) {
        window.location.href = data.url
      } else {
        throw new Error('No se recibió URL de redirección.')
      }
    } catch (err) {
      console.error(err)
      toast.show('Error al iniciar suscripción: ' + err.message, 'danger')
    } finally {
      setLoading(false)
    }
  }

  async function handleManageBilling() {
    if (!org?.id) return
    setLoading(true)
    try {
      const { data, error } = await supabase.functions.invoke('stripe-checkout', {
        body: {
          despachoId: org.id,
          action: 'portal',
          returnUrl: window.location.href
        }
      })

      if (error) throw error
      if (data?.url) {
        window.location.href = data.url
      } else {
        throw new Error('No se recibió URL de portal.')
      }
    } catch (err) {
      console.error(err)
      toast.show('Error al abrir facturación: ' + err.message, 'danger')
    } finally {
      setLoading(false)
    }
  }

  const plan = dbDespacho?.plan || 'free'
  const isPro = plan === 'pro'
  const status = dbDespacho?.stripe_status || 'inactive'

  let statusLabel = 'Inactivo'
  let statusTone = 'default'
  if (status === 'active') {
    statusLabel = 'Activo'
    statusTone = 'success'
  } else if (status === 'trialing') {
    statusLabel = 'Prueba'
    statusTone = 'info'
  } else if (status === 'past_due') {
    statusLabel = 'Pago Requerido'
    statusTone = 'warning'
  } else if (status === 'canceled') {
    statusLabel = 'Cancelado'
    statusTone = 'danger'
  }

  return (
    <div>
      <PageHeader
        title="Facturación y Suscripción"
        subtitle="Administra el plan de tu despacho, métodos de pago y descarga facturas"
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 20, marginBottom: 24 }}>
        
        {/* Plan Actual */}
        <div style={cardStyle}>
          <div style={labelTitle}>Estado de la cuenta</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginTop: 8 }}>
            <span style={{ fontSize: 24, fontWeight: 900, color: 'var(--text)' }}>
              {isPro ? 'Plan Mensual Pro' : 'Prueba Gratis'}
            </span>
            <StatusBadge tone={statusTone} dot={false}>{statusLabel}</StatusBadge>
          </div>
          
          <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6, marginTop: 12 }}>
            {isPro 
              ? 'Gracias por confiar en LexTrack MX. Tienes acceso completo a todas las características del sistema sin restricciones.'
              : 'Estás utilizando la versión de prueba gratis (límite de 50 expedientes activos). Si deseas tener expedientes ilimitados, invitar a tu equipo de abogados y recibir alertas automáticas diarias de plazos por correo, adquiere el Plan Mensual.'
            }
          </p>

          <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16, marginTop: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <span style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block' }}>Próximo pago</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginTop: 2 }}>
                {isPro ? '$299 MXN / mes' : 'No aplica'}
              </span>
            </div>
            {isAdmin && (
              isPro ? (
                <button style={btnSec} disabled={loading} onClick={handleManageBilling}>
                  {loading ? 'Redirigiendo...' : '💳 Administrar Suscripción'}
                </button>
              ) : (
                <button style={btnPri} disabled={loading} onClick={handleCheckout}>
                  {loading ? 'Cargando Stripe...' : '🚀 Activar Plan Mensual'}
                </button>
              )
            )}
          </div>
        </div>

        {/* Límites de uso */}
        <div style={cardStyle}>
          <div style={labelTitle}>Uso y límites del Despacho</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 16 }}>
            <LimitRow label="Miembros del equipo" value={isPro ? 'Ilimitados' : '1 abogado'} used={isPro ? 'Pro' : 'Máx 1'} isCheck={true}/>
            <LimitRow label="Expedientes Activos" value={isPro ? 'Ilimitados' : 'Hasta 50'} used={isPro ? 'Pro' : 'Máx 50'} isCheck={true}/>
            <LimitRow label="Documentos en Storage" value={isPro ? 'Ilimitados (20MB/archivo)' : 'No disponible'} used={isPro ? 'Pro' : 'Bloqueado'} isCheck={isPro}/>
            <LimitRow label="Alertas de plazos por email" value={isPro ? 'Diarias automáticas' : 'No disponible'} used={isPro ? 'Pro' : 'Bloqueado'} isCheck={isPro}/>
          </div>
        </div>

      </div>

      {/* Planes Comparativa */}
      <div style={cardStyle}>
        <div style={{ textTransform: 'uppercase', fontSize: 11, color: 'var(--text-muted)', fontWeight: 700, letterSpacing: '0.5px', marginBottom: 16, textAlign: 'center' }}>
          Planes LexTrack MX
        </div>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', justifyContent: 'center' }}>
          
          {/* Plan Free Card */}
          <div style={{ ...planCard, opacity: isPro ? 0.7 : 1, border: !isPro ? '2px solid var(--border)' : '1px solid var(--border)' }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text)' }}>Prueba Gratis</div>
            <div style={{ fontSize: 28, fontWeight: 900, color: 'var(--text)', marginTop: 8 }}>$0 <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>MXN / mes</span></div>
            <ul style={listStyle}>
              <li>✓ 1 Usuario Administrador</li>
              <li>✓ Hasta 50 expedientes activos</li>
              <li>✓ Calculadora de Plazos</li>
              <li>✗ Alertas de vencimiento por correo</li>
              <li>✗ Repositorio de Documentos</li>
            </ul>
          </div>

          {/* Plan Pro Card */}
          <div style={{ ...planCard, border: isPro ? '2px solid var(--primary)' : '1px solid var(--border)', background: 'var(--surface-2)', width: 300 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 16, fontWeight: 800, color: 'var(--primary)' }}>Plan Mensual Único</span>
              <span style={{ fontSize: 9, background: 'var(--primary)', color: '#fff', padding: '2px 8px', borderRadius: 999, fontWeight: 800 }}>RECOMENDADO</span>
            </div>
            <div style={{ fontSize: 28, fontWeight: 900, color: 'var(--text)', marginTop: 8 }}>$299 <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>MXN / mes</span></div>
            <ul style={listStyle}>
              <li>✓ Miembros de despacho ilimitados</li>
              <li>✓ Expedientes activos ilimitados</li>
              <li>✓ Repositorio de Documentos (Storage)</li>
              <li>✓ Alertas diarias automáticas de plazos</li>
              <li>✓ Historial de auditoría y bitácora completo</li>
            </ul>
          </div>

        </div>
      </div>
    </div>
  )
}

function LimitRow({ label, value, used, isCheck }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-light, #f1f5f910)', paddingBottom: 8 }}>
      <div>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', display: 'block' }}>{label}</span>
        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{value}</span>
      </div>
      <span style={{
        fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 6,
        background: isCheck ? 'var(--success-bg, #10b98115)' : 'var(--danger-bg, #ef444415)',
        color: isCheck ? 'var(--success-text, #10b981)' : 'var(--danger-text, #ef4444)',
      }}>
        {used}
      </span>
    </div>
  )
}

const cardStyle = {
  background: 'var(--surface)', border: '1px solid var(--border)',
  borderRadius: 'var(--radius-lg)', padding: 20, flex: 1,
}
const labelTitle = { fontSize: 11, color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.5px' }
const btnPri = {
  background: 'var(--primary)', color: '#fff', border: 'none',
  borderRadius: 'var(--radius)', padding: '10px 20px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
}
const btnSec = {
  background: 'var(--surface-3)', color: 'var(--text)', border: '1px solid var(--border)',
  borderRadius: 'var(--radius)', padding: '9px 18px', fontSize: 13, fontWeight: 500, cursor: 'pointer',
}
const planCard = {
  background: 'var(--surface)', border: '1px solid var(--border)',
  borderRadius: 'var(--radius-lg)', padding: 24, width: 280, display: 'flex', flexDirection: 'column',
}
const listStyle = {
  listStyle: 'none', padding: 0, margin: '16px 0 0', display: 'flex', flexDirection: 'column', gap: 10, fontSize: 12, color: 'var(--text-secondary)'
}
