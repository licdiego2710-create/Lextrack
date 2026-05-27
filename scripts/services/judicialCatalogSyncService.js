/* eslint-env node */
/**
 * JudicialCatalogSyncService
 *
 * Sincroniza dinámicamente los catálogos de:
 *  1. Partidos judiciales y juzgados del CJJ Jalisco (scraping del portal)
 *  2. Órganos del Tercer Circuito CJF (catálogo estático actualizable)
 *
 * Uso:
 *   node scripts/services/judicialCatalogSyncService.js
 *
 * Variables de entorno requeridas:
 *   SUPABASE_URL         URL del proyecto Supabase
 *   SUPABASE_SERVICE_KEY service_role key (no la anon key)
 */

import { createClient } from '@supabase/supabase-js'
import { descubrirCatalogoPartidos }   from '../providers/jaliscoJudicialBulletinProvider.js'
import { getCatalogoTercerCircuito }   from '../providers/federalAmparoJaliscoProvider.js'

// ─── SUPABASE ────────────────────────────────────────────────────────────────

let rawUrl = (process.env.SUPABASE_URL || '').trim()
const isPlaceholder = !rawUrl || rawUrl.includes('YOUR_') || rawUrl.includes('PLACEHOLDER') || rawUrl.includes('***') || rawUrl.length < 10
if (isPlaceholder) {
  rawUrl = 'https://srzyzkiozqtsdzydyouk.supabase.co'
} else if (!rawUrl.startsWith('http://') && !rawUrl.startsWith('https://')) {
  rawUrl = 'https://' + rawUrl
}
const supabase = createClient(
  rawUrl,
  process.env.SUPABASE_SERVICE_KEY
)

// ─── HELPERS ─────────────────────────────────────────────────────────────────

function log(msg)  { console.log(`[${new Date().toISOString()}] ${msg}`) }
function err(msg)  { console.error(`[${new Date().toISOString()}] ERROR: ${msg}`) }

async function registrarLog(fuente, tipo, estado, registros, mensaje) {
  await supabase.from('catalogo_sync_log').insert({
    fuente, tipo, estado, registros, mensaje,
  })
}

// ─── SYNC CATÁLOGO CJJ ────────────────────────────────────────────────────────

/**
 * Lee dinámicamente los partidos judiciales y juzgados del portal CJJ
 * y los guarda/actualiza en la tabla juzgados_catalogo.
 *
 * Estrategia:
 *  - Si el portal devuelve opciones → usar datos reales del portal.
 *  - Si el portal no responde → conservar lo que ya hay en BD.
 *  - Nunca eliminar registros existentes (sólo marcar activo=false si desaparecen).
 */
async function syncCatalogoCJJ() {
  log('── Sincronizando catálogo CJJ Jalisco ──')
  let registros = 0

  try {
    const partidos = await descubrirCatalogoPartidos({ forzar: true })
    log(`Partidos descubiertos: ${partidos.length}`)

    // Obtener todos los juzgados de todos los partidos
    const filas = []
    for (const p of partidos) {
      if (!p.juzgados || p.juzgados.length === 0) {
        log(`  ${p.partido}: sin juzgados (portal puede no tener selector)`)
        continue
      }
      log(`  ${p.partido}: ${p.juzgados.length} juzgados`)
      for (const j of p.juzgados) {
        filas.push({
          fuente:           'CJJ',
          partido_judicial: p.partido,
          nombre:           j.nombre,
          cve_juz:          j.cveJuz || null,
          materia:          j.materia || null,
          tipo_organo:      j.tipo_organo || 'juzgado',
          municipio:        p.partido,
          activo:           true,
          actualizado_en:   new Date().toISOString(),
        })
      }
    }

    if (filas.length === 0) {
      log('Portal CJJ sin datos de catálogo — conservando registros existentes')
      await registrarLog('CJJ', 'catalogo', 'parcial', 0, 'Portal sin selectores dinámicos')
      return 0
    }

    // Upsert por (fuente, partido_judicial, nombre)
    const { error, count } = await supabase
      .from('juzgados_catalogo')
      .upsert(filas, {
        onConflict:    'fuente,partido_judicial,nombre',
        ignoreDuplicates: false,
        count:         'exact',
      })

    if (error) throw error
    registros = count || filas.length
    log(`Catálogo CJJ sincronizado: ${registros} registros`)
    await registrarLog('CJJ', 'catalogo', 'ok', registros, null)

  } catch (e) {
    err(`Sync catálogo CJJ: ${e.message}`)
    await registrarLog('CJJ', 'catalogo', 'error', 0, e.message)
  }

  return registros
}

// ─── SYNC CATÁLOGO CJF ────────────────────────────────────────────────────────

/**
 * Sincroniza el catálogo estático del Tercer Circuito (CJF).
 * No requiere scraping — usa el catálogo definido en el provider.
 */
async function syncCatalogoCJF() {
  log('── Sincronizando catálogo CJF Tercer Circuito ──')

  try {
    const filas = getCatalogoTercerCircuito().map(o => ({
      ...o,
      actualizado_en: new Date().toISOString(),
    }))

    const { error, count } = await supabase
      .from('juzgados_catalogo')
      .upsert(filas, {
        onConflict:    'fuente,partido_judicial,nombre',
        ignoreDuplicates: false,
        count:         'exact',
      })

    if (error) throw error
    const registros = count || filas.length
    log(`Catálogo CJF sincronizado: ${registros} órganos`)
    await registrarLog('CJF', 'catalogo', 'ok', registros, null)
    return registros

  } catch (e) {
    err(`Sync catálogo CJF: ${e.message}`)
    await registrarLog('CJF', 'catalogo', 'error', 0, e.message)
    return 0
  }
}

// ─── SYNC ACUERDOS CJJ (TODOS LOS PARTIDOS) ──────────────────────────────────

/**
 * Lanza el scraping del boletín para todos los partidos judiciales
 * disponibles y guarda los acuerdos en acuerdos_boletin.
 *
 * Reutiliza la lógica de guardarAcuerdos del scraper original pero
 * ahora con campos fuente, url_fuente y partido_judicial.
 *
 * @param {string} [fecha] - Fecha YYYY-MM-DD (default: hoy)
 */
async function syncAcuerdosTodosPartidos(fecha) {
  const { scrapearAcuerdosPorPartido } = await import('../providers/jaliscoJudicialBulletinProvider.js')

  log(`── Scraping boletín CJJ todos los partidos (${fecha || 'hoy'}) ──`)

  // Obtener partidos del catálogo (ya sincronizado)
  const { data: catalogoPartidos } = await supabase
    .from('juzgados_catalogo')
    .select('partido_judicial')
    .eq('fuente', 'CJJ')
    .eq('activo', true)

  // Partidos únicos
  const partidos = [...new Set((catalogoPartidos || []).map(r => r.partido_judicial))]

  if (partidos.length === 0) {
    log('Catálogo vacío — ejecutando scraping genérico')
    partidos.push(null)  // scraping sin filtro de partido
  }

  log(`Partidos a scrapear: ${partidos.length}`)

  let totalAcuerdos = 0
  let errores = 0

  for (const partido of partidos) {
    try {
      log(`  Scrapeando: ${partido || '(genérico)'}`)
      const acuerdos = await scrapearAcuerdosPorPartido({ partido, fecha })
      log(`    → ${acuerdos.length} acuerdos`)

      if (acuerdos.length > 0) {
        const insertados = await guardarAcuerdos(acuerdos)
        totalAcuerdos += insertados
      }
    } catch (e) {
      err(`Error en partido ${partido}: ${e.message}`)
      errores++
    }
  }

  const estado = errores === 0 ? 'ok' : errores === partidos.length ? 'error' : 'parcial'
  await registrarLog('CJJ', 'acuerdos', estado, totalAcuerdos,
    errores > 0 ? `${errores} partidos fallaron` : null)

  log(`Total acuerdos guardados: ${totalAcuerdos} (errores: ${errores})`)
  return totalAcuerdos
}

async function guardarAcuerdos(acuerdos) {
  if (!acuerdos.length) return 0
  let insertados = 0

  for (let i = 0; i < acuerdos.length; i += 100) {
    const lote = acuerdos.slice(i, i + 100)
    const { error, count } = await supabase
      .from('acuerdos_boletin')
      .insert(lote, { count: 'exact' })

    if (error) {
      // Ignorar errores de duplicados (única constraint)
      if (!error.message?.includes('duplicate') && !error.message?.includes('unique')) {
        err(`Error insertando acuerdos: ${error.message}`)
      }
    } else {
      insertados += count || lote.length
    }
  }

  return insertados
}

// ─── VALIDACIÓN DE VARIABLES DE ENTORNO ──────────────────────────────────────

function validarEntorno() {
  const faltantes = ['SUPABASE_URL', 'SUPABASE_SERVICE_KEY'].filter(k => !process.env[k])
  if (faltantes.length) {
    throw new Error(`Variables de entorno faltantes: ${faltantes.join(', ')}`)
  }
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────

async function main() {
  log('=== JUDICIAL CATALOG SYNC SERVICE ===')

  try {
    validarEntorno()
  } catch (e) {
    err(e.message)
    process.exit(1)
  }

  const modo = process.argv[2] || 'all'
  const fecha = process.argv[3] || new Date().toISOString().slice(0, 10)

  const resumen = {
    modo,
    fecha,
    catalogoCJJ:  0,
    catalogoCJF:  0,
    acuerdosCJJ:  0,
  }

  switch (modo) {
    case 'catalogo':
    case 'all':
      resumen.catalogoCJJ = await syncCatalogoCJJ()
      resumen.catalogoCJF = await syncCatalogoCJF()
      if (modo === 'catalogo') break
      // fallthrough

    case 'acuerdos':
      resumen.acuerdosCJJ = await syncAcuerdosTodosPartidos(fecha)
      break

    case 'catalogo-cjf':
      resumen.catalogoCJF = await syncCatalogoCJF()
      break

    case 'catalogo-cjj':
      resumen.catalogoCJJ = await syncCatalogoCJJ()
      break

    default:
      err(`Modo desconocido: ${modo}. Opciones: all | catalogo | acuerdos | catalogo-cjf | catalogo-cjj`)
      process.exit(1)
  }

  log('=== RESUMEN ===')
  log(JSON.stringify(resumen, null, 2))

  // Output para GitHub Actions
  if (process.env.GITHUB_OUTPUT) {
    const fs = await import('fs')
    for (const [k, v] of Object.entries(resumen)) {
      fs.appendFileSync(process.env.GITHUB_OUTPUT, `${k}=${v}\n`)
    }
  }
}

main().catch(e => {
  err(e.message)
  process.exit(1)
})
