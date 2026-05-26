import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.8'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  try {
    const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY')
    if (!stripeSecretKey) throw new Error('STRIPE_SECRET_KEY no está configurada.')

    const { action, priceId, despachoId, returnUrl } = await req.json()

    // Inicializar cliente Supabase para verificar permisos
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) throw new Error('Falta autorización.')

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') || '',
      Deno.env.get('SUPABASE_ANON_KEY') || '',
      { global: { headers: { Authorization: authHeader } } }
    )

    // Obtener información del usuario logueado
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) throw new Error('Usuario no autenticado.')

    // Verificar que el usuario pertenece al despacho y es admin
    const { data: dm, error: dmError } = await supabase
      .from('despacho_miembros')
      .select('rol, despacho:despachos(*)')
      .eq('despacho_id', despachoId)
      .eq('user_id', user.id)
      .single()

    if (dmError || !dm || dm.rol !== 'admin') {
      throw new Error('No tienes permisos de administrador para este despacho.')
    }

    const despacho = dm.despacho

    // Si la acción es ir al portal
    if (action === 'portal') {
      if (!despacho.stripe_customer_id) throw new Error('El despacho no tiene un cliente de Stripe asociado.')

      const portalRes = await fetch('https://api.stripe.com/v1/billing_portal/sessions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${stripeSecretKey}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          customer: despacho.stripe_customer_id,
          return_url: returnUrl || 'https://lextrack-mx.netlify.app/app/usuarios',
        }),
      })

      const portalSession = await portalRes.json()
      if (!portalRes.ok) throw new Error(portalSession.error?.message || 'Error al crear portal de facturación.')

      return new Response(JSON.stringify({ url: portalSession.url }), {
        headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }

    // De lo contrario, iniciar sesión de Checkout
    if (!priceId) throw new Error('Falta priceId para iniciar checkout.')

    // 1. Verificar si ya tiene customer o crearlo
    let customerId = despacho.stripe_customer_id

    if (!customerId) {
      const customerRes = await fetch('https://api.stripe.com/v1/customers', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${stripeSecretKey}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          email: user.email || '',
          name: despacho.nombre,
          metadata: { despachoId },
        }),
      })

      const customer = await customerRes.json()
      if (!customerRes.ok) throw new Error(customer.error?.message || 'Error al crear cliente en Stripe.')
      customerId = customer.id

      // Actualizar despacho en la base de datos con el service role del ambiente
      const supabaseAdmin = createClient(
        Deno.env.get('SUPABASE_URL') || '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
      )
      await supabaseAdmin
        .from('despachos')
        .update({ stripe_customer_id: customerId })
        .eq('id', despachoId)
    }

    // 2. Crear sesión de checkout
    const checkoutRes = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${stripeSecretKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        customer: customerId,
        payment_method_types: ['card'],
        mode: 'subscription',
        line_items: JSON.stringify([{ price: priceId, quantity: 1 }]),
        success_url: `${returnUrl || 'https://lextrack-mx.netlify.app/app/usuarios'}?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: returnUrl || 'https://lextrack-mx.netlify.app/app/usuarios',
        metadata: { despachoId },
      }),
    })

    const checkoutSession = await checkoutRes.json()
    if (!checkoutRes.ok) throw new Error(checkoutSession.error?.message || 'Error al crear sesión de checkout.')

    return new Response(JSON.stringify({ url: checkoutSession.url }), {
      headers: { ...cors, 'Content-Type': 'application/json' },
    })

  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 400,
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }
})
