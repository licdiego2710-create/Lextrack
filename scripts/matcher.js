/**
 * Matcher y sistema de alertas por email
 * Compara acuerdos_boletin contra expedientes activos y envía notificaciones
 */

import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'

// ─── CONFIG ──────────────────────────────────────────────────────────────────
let rawUrl = (process.env.SUPABASE_URL || '').trim()
const isPlaceholder = !rawUrl || rawUrl.includes('YOUR_') || rawUrl.includes('PLACEHOLDER') || rawUrl.includes('***') || rawUrl.length < 10
if (isPlaceholder) {
  rawUrl = 'https://srzyzkiozqtsdzydyouk.supabase.co'
} else if (!rawUrl.startsWith('http://') && !rawUrl.startsWith('https://')) {
  rawUrl = 'https://' + rawUrl
}
const SUPABASE_URL    = rawUrl
// Sanitizar todas las claves: solo caracteres ASCII imprimibles (32-126)
const SUPABASE_KEY    = (process.env.SUPABASE_SERVICE_KEY || '').replace(/[^\x20-\x7E]/g, '').trim()
const rawResendKey = (process.env.RESEND_API_KEY || '').replace(/[^\x20-\x7E]/g, '').trim()
const RESEND_API_KEY  = rawResendKey.startsWith('re_') ? rawResendKey : null
const FROM_EMAIL      = (process.env.FROM_EMAIL || 'alertas@lextrackmx.com').replace(/[^\x20-\x7E]/g, '').trim()
const APP_URL         = (process.env.APP_URL || 'https://lextrackmx2710.netlify.app').replace(/[^\x20-\x7E]/g, '').trim()
const HOY             = new Date().toISOString().slice(0, 10)

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)
const resend   = RESEND_API_KEY ? new Resend(RESEND_API_KEY) : null

function log(msg) { console.log(`[${new Date().toISOString()}] ${msg}`) }
function err(msg) { console.error(`[${new Date().toISOString()}] ERROR: ${msg}`) }

// ─── NORMALIZACIÓN (igual que en scraper) ────────────────────────────────────
function norm(s) {
  return String(s || '').trim().replace(/\s+/g, '').toUpperCase()
}
function normJuzgado(s) {
  return String(s || '').trim().replace(/\s+/g, ' ').replace(/[^\w\s]/g, '').toUpperCase()
}

function parseExpedienteParts(numStr) {
  const clean = String(numStr || '').trim().toUpperCase().replace(/\s+/g, '')
  // Buscar el primer bloque de números (el número del expediente, quitando ceros a la izquierda)
  const numMatch = clean.match(/^0*(\d+)/)
  if (!numMatch) return null
  const baseNum = numMatch[1]

  // Buscar año de 2 o 4 dígitos (ej: /24, /2024, -24, -2024)
  const yearMatch = clean.match(/[\/-](20\d{2}|19\d{2}|\d{2})\b/)
  if (!yearMatch) return null
  let year = yearMatch[1]
  if (year.length === 2) {
    const y = parseInt(year, 10)
    year = y > 50 ? `19${year}` : `20${year}`
  }

  return { baseNum, year }
}

// ─── MATCHING ────────────────────────────────────────────────────────────────
/**
 * Compara dos números de expediente con flexibilidad:
 * "306/2024" coincide con "0306/24", "306/CIVIL/2024", etc.
 */
function expedientesCoinciden(numBoletin, numExpediente) {
  const a = norm(numBoletin)
  const b = norm(numExpediente)
  if (a === b) return true

  // Comparación inteligente por número base y año conmemorativo
  const partsA = parseExpedienteParts(a)
  const partsB = parseExpedienteParts(b)
  if (partsA && partsB) {
    if (partsA.baseNum === partsB.baseNum && partsA.year === partsB.year) {
      return true
    }
  }

  // Fallback a coincidencia parcial
  return a.includes(b) || b.includes(a)
}

/**
 * Compara dos nombres de juzgado con tolerancia:
 * "PRIMERO CIVIL" coincide con "JUZGADO PRIMERO CIVIL DE GUADALAJARA"
 */
function juzgadosCoinciden(juzgadoBoletin, juzgadoExpediente) {
  if (!juzgadoBoletin || !juzgadoExpediente) return false
  const a = normJuzgado(juzgadoBoletin)
  const b = normJuzgado(juzgadoExpediente)
  if (a === b) return true
  // Uno contiene al otro (al menos 6 caracteres para evitar falsos positivos)
  const shorter = a.length < b.length ? a : b
  const longer  = a.length < b.length ? b : a
  return shorter.length >= 6 && longer.includes(shorter)
}

// ─── EMAIL ───────────────────────────────────────────────────────────────────
function construirEmail(expediente, acuerdo, emailDestino) {
  const linkExpediente = `${APP_URL}/app/expedientes`
  const fechaLegible   = new Date(acuerdo.fecha + 'T12:00:00').toLocaleDateString('es-MX', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  })

  const html = `
<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Alerta LexTrack MX</title></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:580px;margin:32px auto;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.08);">
    <!-- Header -->
    <div style="background:linear-gradient(135deg,#1d4ed8,#2563eb);padding:28px 32px;">
      <div style="color:#fff;font-size:13px;letter-spacing:2px;font-weight:700;margin-bottom:6px;">LEXTRACK MX</div>
      <h1 style="color:#fff;font-size:20px;font-weight:800;margin:0;">Movimiento detectado en el Boletín Judicial</h1>
    </div>
    <!-- Cuerpo -->
    <div style="padding:28px 32px;">
      <p style="color:#475569;font-size:14px;line-height:1.6;margin-top:0;">
        Se detectó un acuerdo publicado el <strong>${fechaLegible}</strong> relacionado con tu expediente:
      </p>
      <!-- Tarjeta expediente -->
      <div style="background:#f1f5f9;border-radius:10px;padding:18px 20px;margin:20px 0;border-left:4px solid #2563eb;">
        <div style="font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:.8px;font-weight:700;margin-bottom:6px;">Expediente</div>
        <div style="font-size:18px;font-weight:800;color:#0f172a;">${expediente.num || expediente.numero_expediente}</div>
        <div style="font-size:13px;color:#475569;margin-top:4px;">${expediente.actor || ''} ${expediente.demandado ? 'vs. ' + expediente.demandado : ''}</div>
      </div>
      <!-- Detalle del acuerdo -->
      <div style="margin:20px 0;">
        <div style="font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:.8px;font-weight:700;margin-bottom:8px;">Juzgado</div>
        <div style="font-size:14px;color:#0f172a;font-weight:600;">${acuerdo.juzgado}</div>
      </div>
      <div style="margin:20px 0;">
        <div style="font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:.8px;font-weight:700;margin-bottom:8px;">Acuerdo publicado</div>
        <div style="font-size:14px;color:#0f172a;line-height:1.6;background:#fafafa;border:1px solid #e2e8f0;border-radius:8px;padding:14px 16px;">
          ${acuerdo.descripcion || 'Ver detalles en el sistema'}
        </div>
      </div>
      <!-- CTA -->
      <a href="${linkExpediente}" style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;padding:13px 24px;border-radius:8px;font-size:14px;font-weight:700;margin-top:8px;">
        Ver expediente en LexTrack MX →
      </a>
    </div>
    <!-- Footer -->
    <div style="padding:20px 32px;border-top:1px solid #e2e8f0;background:#f8fafc;">
      <p style="font-size:12px;color:#94a3b8;margin:0;">
        Este correo fue generado automáticamente por LexTrack MX al detectar actividad en el
        Boletín Judicial del Estado de Jalisco. Para desactivar estas alertas, entra al sistema
        y desactiva las notificaciones del expediente.
      </p>
    </div>
  </div>
</body>
</html>`

  return {
    from: `LexTrack MX <${FROM_EMAIL}>`,
    to:   [emailDestino],
    subject: `🔔 Movimiento en expediente ${expediente.num || expediente.numero_expediente} — Boletín ${fechaLegible}`,
    html,
  }
}

// ─── MAIN ────────────────────────────────────────────────────────────────────
async function main() {
  log('=== MATCHER Y ALERTAS ===')

  // 1. Traer todos los acuerdos no procesados de hoy
  const { data: acuerdos, error: errAcuerdos } = await supabase
    .from('acuerdos_boletin')
    .select('*')
    .eq('procesado', false)
    .eq('fecha', HOY)

  if (errAcuerdos) { err('Error cargando acuerdos: ' + errAcuerdos.message); process.exit(1) }
  log(`Acuerdos sin procesar hoy: ${acuerdos?.length || 0}`)
  if (!acuerdos?.length) { log('Nada que procesar'); return }

  // 2. Traer todos los expedientes activos con alertas habilitadas
  const { data: expedientes, error: errExp } = await supabase
    .from('expedientes')
    .select('id, num, actor, demandado, juzgado, materia, user_id, alertas_boletin')
    .eq('alertas_boletin', true)
    .in('estado', ['Activo', 'activo', 'ACTIVO'])

  if (errExp) { err('Error cargando expedientes: ' + errExp.message); process.exit(1) }
  log(`Expedientes activos con alertas: ${expedientes?.length || 0}`)
  if (!expedientes?.length) { log('Sin expedientes activos con alertas'); return }

  // 3. Traer emails de usuarios (usando auth.users via admin API)
  const emailsPorUserId = {}
  try {
    const { data: { users }, error: errUsers } = await supabase.auth.admin.listUsers()
    if (!errUsers && users) {
      users.forEach(u => { emailsPorUserId[u.id] = u.email })
    }
  } catch (e) {
    err('No se pudo obtener emails de usuarios: ' + e.message)
  }

  // 4. Matching
  let matchesTotal   = 0
  let emailsEnviados = 0
  let errores        = 0
  const acuerdosProcesados = new Set()

  for (const acuerdo of acuerdos) {
    for (const expediente of expedientes) {
      const numCoincide     = expedientesCoinciden(acuerdo.expediente_num, expediente.num)
      const juzgadoCoincide = juzgadosCoinciden(acuerdo.juzgado, expediente.juzgado)

      if (!numCoincide || !juzgadoCoincide) continue

      log(`MATCH: ${acuerdo.expediente_num} / ${acuerdo.juzgado} → expediente ID ${expediente.id}`)
      matchesTotal++

      // Verificar que no exista ya la actuación (anti-duplicados)
      const { data: existente } = await supabase
        .from('actuaciones')
        .select('id')
        .eq('expediente_id', expediente.id)
        .eq('fecha', HOY)
        .ilike('descripcion', '%Boletín Judicial%')
        .limit(1)

      if (existente?.length) {
        log(`  Ya registrado, omitiendo`)
        acuerdosProcesados.add(acuerdo.id)
        continue
      }

      // Insertar actuación
      const { error: errAct } = await supabase.from('actuaciones').insert({
        expediente_id: expediente.id,
        descripcion:   `[Auto-detectado / Boletín Judicial] ${acuerdo.descripcion || ''}`.slice(0, 1000),
        fecha:         HOY,
        user_id:       expediente.user_id,
        creado_en:     new Date().toISOString(),
      })

      if (errAct) {
        err(`Error insertando actuación: ${errAct.message}`)
        errores++
      } else {
        log(`  Actuación insertada`)
        acuerdosProcesados.add(acuerdo.id)
      }

      // Enviar email
      const emailDestino = emailsPorUserId[expediente.user_id]
      if (emailDestino && RESEND_API_KEY) {
        try {
          await resend.emails.send(construirEmail(expediente, acuerdo, emailDestino))
          emailsEnviados++
          log(`  Email enviado a ${emailDestino}`)
        } catch (e) {
          err(`Error enviando email: ${e.message}`)
          errores++
        }
      } else if (!emailDestino) {
        log(`  Sin email para user_id ${expediente.user_id}`)
      }
    }
  }

  // 5. Marcar acuerdos como procesados (incluyendo los sin match)
  const idsNoMatch = acuerdos
    .filter(a => !acuerdosProcesados.has(a.id))
    .map(a => a.id)

  // Marcar procesados CON match
  if (acuerdosProcesados.size) {
    await supabase
      .from('acuerdos_boletin')
      .update({ procesado: true })
      .in('id', [...acuerdosProcesados])
  }

  // Marcar sin match también (para no reprocessar mañana)
  if (idsNoMatch.length) {
    await supabase
      .from('acuerdos_boletin')
      .update({ procesado: true })
      .in('id', idsNoMatch)
  }

  const resumen = {
    fecha:            HOY,
    acuerdos_totales: acuerdos.length,
    matches:          matchesTotal,
    emails_enviados:  emailsEnviados,
    errores,
  }

  log('=== RESUMEN MATCHER ===')
  log(JSON.stringify(resumen, null, 2))

  if (process.env.GITHUB_OUTPUT) {
    const fs = await import('fs')
    fs.appendFileSync(process.env.GITHUB_OUTPUT,
      `matches=${matchesTotal}\nemails_enviados=${emailsEnviados}\n`
    )
  }
}

main().catch(e => {
  err(e.message)
  process.exit(1)
})
