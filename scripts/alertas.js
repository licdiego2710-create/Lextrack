import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'
import dotenv from 'dotenv'

dotenv.config()

let rawUrl = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://srzyzkiozqtsdzydyouk.supabase.co').trim()
if (rawUrl && !rawUrl.startsWith('http://') && !rawUrl.startsWith('https://')) {
  rawUrl = 'https://' + rawUrl
}
const SUPABASE_URL = rawUrl
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY
const RESEND_API_KEY = process.env.RESEND_API_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !RESEND_API_KEY) {
  console.error('Faltan variables de entorno necesarias: SUPABASE_URL, SUPABASE_SERVICE_KEY o SUPABASE_SERVICE_ROLE_KEY, RESEND_API_KEY')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false
  }
})

const resend = new Resend(RESEND_API_KEY)

async function run() {
  console.log('Iniciando cron de alertas de plazos procesales...')
  
  try {
    // 1. Obtener todos los expedientes con términos asignados que estén activos
    const { data: exps, error: errExps } = await supabase
      .from('expedientes')
      .select('id, num, actor, demandado, termino, actuacion, despacho_id')
      .not('termino', 'is', null)
      .in('estado', ['Activo', 'activo', 'ACTIVO'])

    if (errExps) throw errExps
    if (!exps || exps.length === 0) {
      console.log('No hay expedientes activos con términos programados.')
      return
    }

    // 2. Filtrar expedientes que venzan pronto (hoy, mañana o en 2-3 días)
    const hoyStr = new Date().toISOString().slice(0, 10)
    const limite = new Date()
    limite.setDate(limite.getDate() + 3)
    const limiteStr = limite.toISOString().slice(0, 10)

    const expsUrgentes = exps.filter(e => {
      return e.termino >= hoyStr && e.termino <= limiteStr
    })

    if (expsUrgentes.length === 0) {
      console.log('No hay términos procesales venciendo en los próximos 3 días.')
      return
    }

    console.log(`Se encontraron ${expsUrgentes.length} términos próximos a vencer.`)

    // 3. Obtener todos los despachos implicados
    const despachoIds = [...new Set(expsUrgentes.map(e => e.despacho_id))].filter(Boolean)

    // 4. Obtener todos los usuarios de la base de datos (auth.users)
    const { data: { users }, error: errUsers } = await supabase.auth.admin.listUsers()
    if (errUsers) throw errUsers

    const userEmailMap = new Map(users.map(u => [u.id, u.email]))

    // 5. Cargar miembros activos de los despachos
    const { data: miembros, error: errMbs } = await supabase
      .from('despacho_miembros')
      .select('despacho_id, user_id')
      .in('despacho_id', despachoIds)
      .eq('activo', true)

    if (errMbs) throw errMbs

    // Agrupar miembros por despacho
    const despachoEmails = {}
    for (const m of miembros) {
      const email = userEmailMap.get(m.user_id)
      if (email) {
        if (!despachoEmails[m.despacho_id]) despachoEmails[m.despacho_id] = []
        despachoEmails[m.despacho_id].push(email)
      }
    }

    // 6. Enviar emails agrupados por despacho
    for (const despId of despachoIds) {
      const correos = despachoEmails[despId]
      if (!correos || correos.length === 0) continue

      const expsDespacho = expsUrgentes.filter(e => e.despacho_id === despId)
      if (expsDespacho.length === 0) continue

      // Obtener el nombre del despacho
      const { data: desp } = await supabase
        .from('despachos')
        .select('nombre')
        .eq('id', despId)
        .single()

      const despachoNombre = desp?.nombre || 'tu despacho'

      console.log(`Enviando resumen a ${correos.length} usuarios del despacho "${despachoNombre}"...`)

      // Construir tabla de términos
      let rowsHtml = ''
      for (const e of expsDespacho) {
        const diasRestantes = Math.ceil((new Date(e.termino + 'T12:00:00') - new Date()) / (1000 * 60 * 60 * 24))
        let badgeColor = '#10b981' // verde
        let badgeText = `En ${diasRestantes} días`
        if (diasRestantes <= 0) {
          badgeColor = '#ef4444' // rojo
          badgeText = 'HOY'
        } else if (diasRestantes === 1) {
          badgeColor = '#f59e0b' // naranja
          badgeText = 'Mañana'
        }

        rowsHtml += `
          <tr>
            <td style="padding: 12px; border-bottom: 1px solid #e2e8f0; font-family: monospace; font-weight: 700; color: #2563eb; font-size: 14px;">${e.num}</td>
            <td style="padding: 12px; border-bottom: 1px solid #e2e8f0; font-size: 13px; color: #334155;">${e.actor} vs ${e.demandado}</td>
            <td style="padding: 12px; border-bottom: 1px solid #e2e8f0; font-size: 13px; color: #475569;">${e.actuacion.replace(/^\[Término Procesal\]\s*/i, '')}</td>
            <td style="padding: 12px; border-bottom: 1px solid #e2e8f0; text-align: center;">
              <span style="display: inline-block; background-color: ${badgeColor}; color: #ffffff; padding: 4px 10px; border-radius: 999px; font-size: 11px; font-weight: 700; text-transform: uppercase;">
                ${badgeText}
              </span>
            </td>
            <td style="padding: 12px; border-bottom: 1px solid #e2e8f0; font-size: 13px; font-weight: 600; color: #1e293b; text-align: right;">${e.termino.split('-').reverse().join('/')}</td>
          </tr>
        `
      }

      const emailHtml = `
        <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 650px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff;">
          <div style="text-align: center; margin-bottom: 24px; border-bottom: 1px solid #e2e8f0; padding-bottom: 16px;">
            <h2 style="color: #2563eb; margin: 0; font-size: 22px; font-weight: 800; letter-spacing: 1px;">LEXTRACK MX</h2>
            <p style="color: #64748b; font-size: 12px; margin: 4px 0 0; text-transform: uppercase; font-weight: 700; letter-spacing: 0.5px;">Resumen Diario de Vencimientos</p>
          </div>
          
          <p style="font-size: 14px; color: #334155; line-height: 1.6;">
            Estimado equipo de <strong>${despachoNombre}</strong>,
          </p>
          <p style="font-size: 14px; color: #334155; line-height: 1.6; margin-bottom: 20px;">
            A continuación se detallan los términos y plazos procesales vinculados a sus expedientes que están próximos a vencer:
          </p>

          <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
            <thead>
              <tr style="background-color: #f8fafc;">
                <th style="padding: 10px; border-bottom: 2px solid #cbd5e1; text-align: left; font-size: 11px; font-weight: 700; color: #475569; text-transform: uppercase;">Expediente</th>
                <th style="padding: 10px; border-bottom: 2px solid #cbd5e1; text-align: left; font-size: 11px; font-weight: 700; color: #475569; text-transform: uppercase;">Partes</th>
                <th style="padding: 10px; border-bottom: 2px solid #cbd5e1; text-align: left; font-size: 11px; font-weight: 700; color: #475569; text-transform: uppercase;">Término</th>
                <th style="padding: 10px; border-bottom: 2px solid #cbd5e1; text-align: center; font-size: 11px; font-weight: 700; color: #475569; text-transform: uppercase;">Estado</th>
                <th style="padding: 10px; border-bottom: 2px solid #cbd5e1; text-align: right; font-size: 11px; font-weight: 700; color: #475569; text-transform: uppercase;">Vence</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>

          <div style="text-align: center; margin-top: 32px; border-top: 1px solid #e2e8f0; padding-top: 20px;">
            <a href="https://lextrack-mx.netlify.app/app/expedientes" style="display: inline-block; background-color: #2563eb; color: #ffffff; text-decoration: none; padding: 10px 20px; border-radius: 6px; font-weight: 600; font-size: 13px;">
              Ir a mis Expedientes
            </a>
          </div>

          <p style="font-size: 11px; color: #94a3b8; text-align: center; margin-top: 24px; line-height: 1.5;">
            Este es un correo automático de recordatorio generado por LexTrack MX.<br>
            No respondas a este correo.
          </p>
        </div>
      `

      const fromEmail = process.env.RESEND_FROM_EMAIL || 'LexTrack Alertas <onboarding@resend.dev>'
      await resend.emails.send({
        from: fromEmail,
        to: correos,
        subject: `⚠️ Alerta de Plazos: Vencimientos próximos en ${despachoNombre}`,
        html: emailHtml,
      })
    }

    console.log('Cron finalizado con éxito.')

  } catch (error) {
    console.error('Error durante la ejecución del cron de alertas:', error)
    process.exit(1)
  }
}

run()
