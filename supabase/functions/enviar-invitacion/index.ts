import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  try {
    const { email, rol, despachoNombre, invitadoPorEmail, token, origin } = await req.json()

    if (!email || !token || !despachoNombre) {
      throw new Error('Parámetros faltantes: email, token y despachoNombre son obligatorios.')
    }

    const resendApiKey = Deno.env.get('RESEND_API_KEY')
    if (!resendApiKey) {
      throw new Error('RESEND_API_KEY no está configurada en los secrets del proyecto.')
    }

    const rolEsp = rol === 'admin' ? 'Administrador' : rol === 'abogado' ? 'Abogado' : 'Asistente'
    const linkRegistro = `${origin || 'https://lextrack-mx.netlify.app'}/auth?token=${token}`
    const fromEmail = Deno.env.get('RESEND_FROM_EMAIL') || 'LexTrack MX <onboarding@resend.dev>'

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${resendApiKey}`,
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [email],
        subject: `Te han invitado al despacho "${despachoNombre}" en LexTrack MX`,
        html: `
          <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 550px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff;">
            <div style="text-align: center; margin-bottom: 24px;">
              <h2 style="color: #2563eb; margin: 0; font-size: 24px; font-weight: 800; letter-spacing: 1px;">LEXTRACK MX</h2>
              <p style="color: #64748b; font-size: 13px; margin: 4px 0 0;">Gestión de Expedientes Jurídicos</p>
            </div>
            
            <p style="font-size: 15px; color: #334155; line-height: 1.6;">
              Hola,
            </p>
            <p style="font-size: 15px; color: #334155; line-height: 1.6;">
              <strong>${invitadoPorEmail || 'Un miembro'}</strong> te ha invitado a unirte al despacho jurídico <strong>"${despachoNombre}"</strong> en LexTrack MX con el rol de <strong>${rolEsp}</strong>.
            </p>
            
            <div style="text-align: center; margin: 32px 0;">
              <a href="${linkRegistro}" style="display: inline-block; background-color: #2563eb; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 600; font-size: 14px; box-shadow: 0 4px 6px -1px rgba(37, 99, 235, 0.2);">
                Aceptar Invitación y Registrarse
              </a>
            </div>

            <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; margin-bottom: 24px; text-align: center;">
              <span style="font-size: 12px; color: #64748b; display: block; margin-bottom: 4px; text-transform: uppercase; font-weight: 700; letter-spacing: 0.5px;">Código de invitación</span>
              <code style="font-size: 20px; font-weight: 700; color: #2563eb; font-family: monospace; letter-spacing: 4px;">${token}</code>
            </div>

            <p style="font-size: 12px; color: #64748b; line-height: 1.6; border-top: 1px solid #e2e8f0; padding-top: 16px; margin: 0;">
              Si el botón no funciona, copia y pega el siguiente enlace en tu navegador:<br>
              <a href="${linkRegistro}" style="color: #2563eb; word-break: break-all;">${linkRegistro}</a>
            </p>
          </div>
        `,
      }),
    })

    const data = await res.json()
    if (!res.ok) throw new Error(data.message || JSON.stringify(data))

    return new Response(JSON.stringify({ success: true, messageId: data.id }), {
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 400,
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }
})
