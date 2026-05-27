/* eslint-env node */
/* eslint-disable no-useless-escape, no-unused-vars */
/**
 * CJF Amparos Sync Service
 *
 * Consulta diariamente el portal DGEJ-CJF por cada amparo registrado en la BD.
 * Si detecta un cambio en el último acuerdo, guarda el nuevo acuerdo en
 * acuerdos_amparo_federal y actualiza amparos_federales.
 *
 * Uso:
 *   node scripts/services/cjfAmparosSyncService.js
 *
 * Variables de entorno requeridas:
 *   SUPABASE_URL         URL del proyecto Supabase
 *   SUPABASE_SERVICE_KEY service_role key
 *
 * Opciones (process.argv[2]):
 *   all        — sincroniza todos los amparos activos (default)
 *   despacho:<id> — solo los amparos del despacho indicado
 */

import { createClient } from '@supabase/supabase-js'
import { chromium }     from 'playwright'

// ─── CONFIG ──────────────────────────────────────────────────────────────────

const CJF_BASE    = 'https://www.dgej.cjf.gob.mx/internet/expedientes/circuitos.asp'
const CIRCUITO    = '3'
const FUENTE      = 'CJF-SYNC'
const USER_AGENT  = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36'
const DELAY_MS    = 3_000   // pausa entre consultas para no saturar el portal
const TIMEOUT_MS  = 30_000

// ─── SUPABASE ────────────────────────────────────────────────────────────────

function crearCliente() {
  let rawUrl = (process.env.SUPABASE_URL || '').trim()
  const isPlaceholder = !rawUrl || rawUrl.includes('YOUR_') || rawUrl.includes('PLACEHOLDER') || rawUrl.includes('***') || rawUrl.length < 10
  if (isPlaceholder) {
    rawUrl = 'https://srzyzkiozqtsdzydyouk.supabase.co'
  } else if (!rawUrl.startsWith('http://') && !rawUrl.startsWith('https://')) {
    rawUrl = 'https://' + rawUrl
  }
  return createClient(
    rawUrl,
    process.env.SUPABASE_SERVICE_KEY
  )
}

// ─── LOGGING ─────────────────────────────────────────────────────────────────

const ts  = () => `[${new Date().toISOString()}]`
const log = (...a) => console.log(ts(), ...a)
const err = (...a) => console.error(ts(), 'ERROR:', ...a)

async function registrarLog(supabase, estado, registros, mensaje = null) {
  await supabase.from('catalogo_sync_log').insert({
    fuente: 'CJF', tipo: 'amparos', estado, registros, mensaje,
  })
}

// ─── NORMALIZACIÓN ───────────────────────────────────────────────────────────

function normalizarNum(raw) {
  return String(raw).trim().replace(/\s+/g, '').toUpperCase().replace(/[–—]/g, '/')
}

function normalizarFecha(raw) {
  if (!raw) return null
  const m = String(raw).match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/)
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw
  return null
}

function construirUrl(numAmparo) {
  const params = new URLSearchParams({ Cir: CIRCUITO, Exp: numAmparo })
  return `${CJF_BASE}?${params}`
}

// ─── PARSER HTML ─────────────────────────────────────────────────────────────

function parsearHtml(html, numBuscado) {
  const numNorm   = normalizarNum(numBuscado)
  const sinEsp    = numNorm.replace(/\s/g, '')
  const textoLimpio = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>').replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ').trim()

  // El número debe aparecer en la página
  if (!textoLimpio.replace(/\s/g, '').toUpperCase().includes(sinEsp)) return null

  // Intentar extraer última fecha y descripción de acuerdo
  const fechaRe   = /\b(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4})\b/g
  const estadoRe  = /\b(en tr[áa]mite|conclu[íi]do|sobreseí[íi]do|enviado|pendiente|suspendido)\b/i
  const organoRe  = /tribunal|juzgado|sala/i

  const fechas    = [...textoLimpio.matchAll(fechaRe)].map(m => m[1])
  const estadoM   = textoLimpio.match(estadoRe)
  const organoM   = textoLimpio.match(/((?:primer|segundo|tercer|cuarto|quinto|juzgado)[^,.\n]{5,80}(?:circuito|jalisco|distrito))/i)

  // Descripción: todo el texto relevante entre paréntesis o después de palabras clave
  const descM = textoLimpio.match(/acuerdo[^.]{0,20}:?\s*([^]{20,500}?)(?:\s+\d{1,2}\/\d{1,2}\/\d{4}|$)/i)

  return {
    num_amparo:    numNorm,
    fecha:         fechas.length > 0 ? normalizarFecha(fechas[fechas.length - 1]) : null,
    descripcion:   (descM?.[1] || textoLimpio.slice(0, 600)).trim() || null,
    estado_asunto: estadoM ? estadoM[1] : null,
    organo:        organoM ? organoM[1].trim().slice(0, 300) : null,
    url_fuente:    construirUrl(numBuscado),
  }
}

// ─── CONSULTA AL PORTAL CJF ──────────────────────────────────────────────────

async function consultarCJF(browser, numAmparo) {
  const url     = construirUrl(numAmparo)
  const context = await browser.newContext({ userAgent: USER_AGENT })
  const page    = await context.newPage()

  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: TIMEOUT_MS })

    // Si hay formulario y no hay datos, intentar submit
    const hasForm = await page.$('form').catch(() => null)
    if (hasForm) {
      await page.fill('input[name="Exp"], input[type="text"]', numAmparo).catch(() => {})
      await page.click('input[type="submit"], button[type="submit"]').catch(() => {})
      await page.waitForLoadState('domcontentloaded').catch(() => {})
    }

    const html = await page.content()
    return parsearHtml(html, numAmparo)

  } finally {
    await context.close().catch(() => {})
  }
}

// ─── DETECTAR CAMBIO ─────────────────────────────────────────────────────────

function hayNuevoAcuerdo(amparo, nuevosDatos) {
  if (!nuevosDatos) return false
  if (!nuevosDatos.fecha) return false

  const fechaActual  = amparo.fecha_acuerdo
  const descActual   = amparo.descripcion_acuerdo || ''
  const fechaNueva   = nuevosDatos.fecha
  const descNueva    = nuevosDatos.descripcion || ''

  // Hay nuevo acuerdo si la fecha es más reciente o la descripción cambió
  if (!fechaActual && fechaNueva) return true
  if (fechaActual && fechaNueva > fechaActual)  return true
  if (fechaActual === fechaNueva && descNueva !== descActual && descNueva.length > 10) return true

  return false
}

// ─── GUARDAR NUEVO ACUERDO ────────────────────────────────────────────────────

async function guardarNuevoAcuerdo(supabase, amparo, datos) {
  const fila = {
    amparo_id:     amparo.id,
    expediente_id: amparo.expediente_id || null,
    despacho_id:   amparo.despacho_id,
    user_id:       amparo.user_id,
    num_amparo:    amparo.num_amparo,
    organo:        datos.organo || amparo.organo || null,
    fecha:         datos.fecha,
    descripcion:   datos.descripcion ? datos.descripcion.slice(0, 1000) : null,
    estado_asunto: datos.estado_asunto || null,
    url_fuente:    datos.url_fuente,
    auto_detectado: true,
    fuente:        FUENTE,
    leido:         false,
  }

  // Upsert — ignora si ya existe el mismo acuerdo
  const { error } = await supabase
    .from('acuerdos_amparo_federal')
    .upsert(fila, { onConflict: 'amparo_id,fecha,descripcion', ignoreDuplicates: true })

  if (error && !error.message?.includes('duplicate') && !error.message?.includes('unique')) {
    throw new Error(`Error guardando acuerdo: ${error.message}`)
  }

  // Actualizar amparos_federales con los datos más recientes
  await supabase
    .from('amparos_federales')
    .update({
      fecha_acuerdo:      datos.fecha,
      descripcion_acuerdo: datos.descripcion ? datos.descripcion.slice(0, 800) : null,
      estado_asunto:      datos.estado_asunto || null,
      actualizado_en:     new Date().toISOString(),
    })
    .eq('id', amparo.id)

  return fila
}

// ─── MAIN SYNC ───────────────────────────────────────────────────────────────

async function sincronizarAmparos(filtroDespacho = null) {
  const supabase = crearCliente()

  // Cargar amparos activos
  let query = supabase
    .from('amparos_federales')
    .select('id, num_amparo, organo, circuito, expediente_id, despacho_id, user_id, fecha_acuerdo, descripcion_acuerdo')
    .eq('circuito', CIRCUITO)

  if (filtroDespacho) {
    query = query.eq('despacho_id', filtroDespacho)
  }

  const { data: amparos, error: errLoad } = await query
  if (errLoad) throw new Error(`Error cargando amparos: ${errLoad.message}`)
  if (!amparos?.length) { log('Sin amparos registrados — nada que sincronizar'); return 0 }

  log(`Amparos a sincronizar: ${amparos.length}`)

  // Deduplicar por num_amparo (varios expedientes pueden tener el mismo amparo)
  const porNum = new Map()
  for (const a of amparos) {
    if (!porNum.has(a.num_amparo)) porNum.set(a.num_amparo, [])
    porNum.get(a.num_amparo).push(a)
  }

  log(`Números únicos: ${porNum.size}`)

  const browser  = await chromium.launch({ headless: true })
  let nuevos     = 0
  let errores    = 0
  let procesados = 0

  try {
    for (const [numAmparo, registros] of porNum) {
      procesados++
      log(`[${procesados}/${porNum.size}] Consultando ${numAmparo}...`)

      try {
        const datos = await consultarCJF(browser, numAmparo)

        if (!datos) {
          log(`  → No encontrado en portal CJF`)
        } else {
          log(`  → Fecha portal: ${datos.fecha} | Estado: ${datos.estado_asunto || 'N/A'}`)

          // Guardar para cada registro que tenga este num_amparo
          for (const amparo of registros) {
            if (hayNuevoAcuerdo(amparo, datos)) {
              await guardarNuevoAcuerdo(supabase, amparo, datos)
              nuevos++
              log(`  ✓ Nuevo acuerdo guardado para despacho ${amparo.despacho_id}`)
            }
          }
        }

      } catch (e) {
        err(`${numAmparo}: ${e.message}`)
        errores++
      }

      // Pausa para no saturar el portal
      if (procesados < porNum.size) {
        await new Promise(r => setTimeout(r, DELAY_MS))
      }
    }
  } finally {
    await browser.close()
  }

  const estado = errores === 0 ? 'ok' : errores === porNum.size ? 'error' : 'parcial'
  await registrarLog(supabase, estado, nuevos,
    errores > 0 ? `${errores} amparos fallaron` : null)

  log(`=== RESUMEN: ${nuevos} acuerdos nuevos | ${errores} errores | ${procesados} consultados ===`)
  return nuevos
}

// ─── VALIDACIÓN ──────────────────────────────────────────────────────────────

function validarEntorno() {
  const faltantes = ['SUPABASE_URL', 'SUPABASE_SERVICE_KEY'].filter(k => !process.env[k])
  if (faltantes.length) throw new Error(`Variables de entorno faltantes: ${faltantes.join(', ')}`)
}

// ─── ENTRY POINT ─────────────────────────────────────────────────────────────

async function main() {
  log('=== CJF AMPAROS SYNC SERVICE ===')

  try { validarEntorno() } catch (e) { err(e.message); process.exit(1) }

  const arg   = process.argv[2] || 'all'
  const filtro = arg.startsWith('despacho:') ? arg.replace('despacho:', '') : null

  if (filtro) log(`Modo: despacho específico (${filtro})`)
  else         log('Modo: todos los despachos')

  const nuevos = await sincronizarAmparos(filtro)

  // Output para GitHub Actions
  if (process.env.GITHUB_OUTPUT) {
    const fs = await import('fs')
    fs.appendFileSync(process.env.GITHUB_OUTPUT, `acuerdos_nuevos=${nuevos}\n`)
  }
}

main().catch(e => { err(e.message); process.exit(1) })
