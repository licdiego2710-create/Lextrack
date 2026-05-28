/* eslint-env node */
/* eslint-disable no-useless-escape */
/**
 * Scraper del Boletín Judicial del Estado de Jalisco
 * https://cjj.gob.mx/bulletin
 *
 * NOTA: Si el portal cambia sus selectores CSS, ajusta las constantes
 * de la sección "SELECTORES" al inicio del archivo.
 */

import { chromium } from 'playwright'
import { createClient } from '@supabase/supabase-js'

// ─── CONFIG ──────────────────────────────────────────────────────────────────
let rawUrl = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').trim()
const isPlaceholder = !rawUrl || rawUrl.includes('YOUR_') || rawUrl.includes('PLACEHOLDER') || rawUrl.includes('***') || rawUrl.length < 10
if (isPlaceholder) {
  rawUrl = 'https://srzyzkiozqtsdzydyouk.supabase.co'
} else if (!rawUrl.startsWith('http://') && !rawUrl.startsWith('https://')) {
  rawUrl = 'https://' + rawUrl
}
const SUPABASE_URL     = rawUrl
const SUPABASE_KEY     = process.env.SUPABASE_SERVICE_KEY   // service_role key
const BOLETIN_URL      = 'https://cjj.gob.mx/bulletin'
const MAX_RETRIES      = 3
const RETRY_WAIT_MS    = 5 * 60 * 1000   // 5 minutos entre reintentos
const PAGE_TIMEOUT_MS  = 60_000
const HOY              = process.env.FECHA || new Date().toISOString().slice(0, 10)  // YYYY-MM-DD

// ─── SELECTORES CJJ Jalisco (Angular SPA, actualizado 2026) ─────────────────
const SEL = {
  // Selector de juzgado — select con name="judge" y opciones C01, C02...
  selectJuzgado:    'select[name="judge"]',
  // Input de fecha
  fechaInput:       'input[type="date"][name="date"]',
  // Botón de búsqueda
  btnBuscar:        'button.search-button',
  // Cards de resultado (Angular .item)
  items:            '.item',
  // Título del item: contiene num expediente y tipo juicio
  itemTitulo:       '.item-title',
  // Contenedor de partes y descripción
  itemTexto:        '.item-text',
}

// ─── JUZGADOS COMPLETOS DEL CJJ JALISCO ─────────────────────────────────────
const JUZGADOS = [
  // Civiles
  { nombre: 'Primero Civil',          materia: 'Civil' },
  { nombre: 'Segundo Civil',          materia: 'Civil' },
  { nombre: 'Tercero Civil',          materia: 'Civil' },
  { nombre: 'Cuarto Civil',           materia: 'Civil' },
  { nombre: 'Quinto Civil',           materia: 'Civil' },
  { nombre: 'Sexto Civil',            materia: 'Civil' },
  { nombre: 'Séptimo Civil',          materia: 'Civil' },
  { nombre: 'Octavo Civil',           materia: 'Civil' },
  { nombre: 'Noveno Civil',           materia: 'Civil' },
  { nombre: 'Décimo Civil',           materia: 'Civil' },
  { nombre: 'Décimo Primero Civil',   materia: 'Civil' },
  { nombre: 'Décimo Segundo Civil',   materia: 'Civil' },
  { nombre: 'Décimo Tercero Civil',   materia: 'Civil' },
  // Mercantiles
  { nombre: 'Primero Mercantil',      materia: 'Mercantil' },
  { nombre: 'Segundo Mercantil',      materia: 'Mercantil' },
  { nombre: 'Tercero Mercantil',      materia: 'Mercantil' },
  { nombre: 'Cuarto Mercantil',       materia: 'Mercantil' },
  { nombre: 'Quinto Mercantil',       materia: 'Mercantil' },
  { nombre: 'Sexto Mercantil',        materia: 'Mercantil' },
  { nombre: 'Séptimo Mercantil',      materia: 'Mercantil' },
  { nombre: 'Octavo Mercantil',       materia: 'Mercantil' },
  { nombre: 'Noveno Mercantil',       materia: 'Mercantil' },
  { nombre: 'Décimo Mercantil',       materia: 'Mercantil' },
  { nombre: 'Décimo Primero Mercantil',  materia: 'Mercantil' },
  { nombre: 'Décimo Segundo Mercantil', materia: 'Mercantil' },
  { nombre: 'Primero Oral Mercantil', materia: 'Mercantil' },
  { nombre: 'Segundo Oral Mercantil', materia: 'Mercantil' },
  { nombre: 'Tercero Oral Mercantil', materia: 'Mercantil' },
  // Familiares
  { nombre: 'Primero Familiar',       materia: 'Familiar' },
  { nombre: 'Segundo Familiar',       materia: 'Familiar' },
  { nombre: 'Tercero Familiar',       materia: 'Familiar' },
  { nombre: 'Cuarto Familiar',        materia: 'Familiar' },
  { nombre: 'Quinto Familiar',        materia: 'Familiar' },
  { nombre: 'Sexto Familiar',         materia: 'Familiar' },
  { nombre: 'Séptimo Familiar',       materia: 'Familiar' },
  { nombre: 'Octavo Familiar',        materia: 'Familiar' },
  { nombre: 'Noveno Familiar',        materia: 'Familiar' },
  { nombre: 'Décimo Familiar',        materia: 'Familiar' },
  { nombre: 'Décimo Primero Familiar',materia: 'Familiar' },
  { nombre: 'Décimo Segundo Familiar',materia: 'Familiar' },
  { nombre: 'Décimo Tercero Familiar',materia: 'Familiar' },
  { nombre: 'Décimo Cuarto Familiar', materia: 'Familiar' },
  { nombre: 'Especializado NNA',      materia: 'Familiar' },
  // Penales
  { nombre: 'Primero Penal',          materia: 'Penal' },
  { nombre: 'Segundo Penal',          materia: 'Penal' },
  { nombre: 'Tercero Penal',          materia: 'Penal' },
  { nombre: 'Cuarto Penal',           materia: 'Penal' },
  { nombre: 'Quinto Penal',           materia: 'Penal' },
  { nombre: 'Sexto Penal',            materia: 'Penal' },
  { nombre: 'Séptimo Penal',          materia: 'Penal' },
  { nombre: 'Octavo Penal',           materia: 'Penal' },
  { nombre: 'Noveno Penal',           materia: 'Penal' },
  { nombre: 'Décimo Penal',           materia: 'Penal' },
  { nombre: 'Décimo Primero Penal',   materia: 'Penal' },
  { nombre: 'Décimo Segundo Penal',   materia: 'Penal' },
  { nombre: 'Décimo Tercero Penal',   materia: 'Penal' },
  { nombre: 'Décimo Cuarto Penal',    materia: 'Penal' },
  { nombre: 'Décimo Quinto Penal',    materia: 'Penal' },
  { nombre: 'Décimo Sexto Penal',     materia: 'Penal' },
  // STJ
  { nombre: 'Primera Sala STJ',       materia: 'Civil' },
  { nombre: 'Segunda Sala STJ',       materia: 'Civil' },
  { nombre: 'Tercera Sala STJ',       materia: 'Mercantil' },
  { nombre: 'Cuarta Sala STJ',        materia: 'Familiar' },
  { nombre: 'Quinta Sala STJ',        materia: 'Penal' },
  { nombre: 'Sexta Sala STJ',         materia: 'Penal' },
  { nombre: 'Séptima Sala STJ',       materia: 'Civil' },
  { nombre: 'Octava Sala STJ',        materia: 'Civil' },
  { nombre: 'Novena Sala STJ',        materia: 'Administrativo' },
  { nombre: 'Décima Sala STJ',        materia: 'Administrativo' },
  { nombre: 'Décima Primera Sala Penal STJ', materia: 'Penal' },
  { nombre: 'Sala Auxiliar Mixta Civil', materia: 'Civil' },
  // Administrativo
  { nombre: 'Primera Sala Unitaria Administrativa',   materia: 'Administrativo' },
  { nombre: 'Segunda Sala Unitaria Administrativa',   materia: 'Administrativo' },
  { nombre: 'Tercera Sala Unitaria Administrativa',   materia: 'Administrativo' },
  { nombre: 'Primera Sala Colegiada Administrativa',  materia: 'Administrativo' },
  { nombre: 'Segunda Sala Colegiada Administrativa',  materia: 'Administrativo' },
  { nombre: 'Pleno Tribunal Administrativo',          materia: 'Administrativo' },
  // Adolescentes
  { nombre: 'Primero para Adolescentes',  materia: 'Penal' },
  { nombre: 'Segundo para Adolescentes',  materia: 'Penal' },
  // Ejecución de Penas
  { nombre: 'Primero de Ejecución de Penas',  materia: 'Penal' },
  { nombre: 'Segundo de Ejecución de Penas',  materia: 'Penal' },
  { nombre: 'Tercero de Ejecución de Penas',  materia: 'Penal' },
  { nombre: 'Cuarto de Ejecución de Penas',   materia: 'Penal' },
  // Foráneos
  { nombre: 'Ahualulco de Mercado',   materia: 'Civil' },
  { nombre: 'Ameca',                  materia: 'Civil' },
  { nombre: 'Arandas',                materia: 'Civil' },
  { nombre: 'Autlán de Navarro',      materia: 'Civil' },
  { nombre: 'Casimiro Castillo',      materia: 'Civil' },
  { nombre: 'Cihuatlán',              materia: 'Civil' },
  { nombre: 'Ciudad Guzmán',          materia: 'Civil' },
  { nombre: 'Colotlán',               materia: 'Civil' },
  { nombre: 'Encarnación de Díaz',    materia: 'Civil' },
  { nombre: 'La Barca',               materia: 'Civil' },
  { nombre: 'Lagos de Moreno',        materia: 'Civil' },
  { nombre: 'Ocotlán',                materia: 'Civil' },
  { nombre: 'Puerto Vallarta',        materia: 'Civil' },
  { nombre: 'San Juan de los Lagos',  materia: 'Civil' },
  { nombre: 'Sayula',                 materia: 'Civil' },
  { nombre: 'Tamazula de Gordiano',   materia: 'Civil' },
  { nombre: 'Tequila',                materia: 'Civil' },
  { nombre: 'Tepatitlán de Morelos',  materia: 'Civil' },
  { nombre: 'Tlajomulco de Zúñiga',   materia: 'Civil' },
  { nombre: 'Tonal',                  materia: 'Civil' },
  { nombre: 'Zapotlán el Grande',     materia: 'Civil' },
]

// ─── SUPABASE ────────────────────────────────────────────────────────────────
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

// ─── HELPERS ─────────────────────────────────────────────────────────────────
function log(msg)  { console.log(`[${new Date().toISOString()}] ${msg}`) }
function err(msg)  { console.error(`[${new Date().toISOString()}] ERROR: ${msg}`) }
function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

function normalizarExpediente(num) {
  if (!num) return ''
  return String(num).trim()
    .replace(/\s+/g, '')
    .toUpperCase()
}

function normalizarJuzgado(nombre) {
  if (!nombre) return ''
  return String(nombre).trim()
    .replace(/\s+/g, ' ')
    .replace(/[^\w\s]/g, '')
    .toUpperCase()
}

// ─── SCRAPER PRINCIPAL ───────────────────────────────────────────────────────
async function scrapearBoletin() {
  const browser = await chromium.launch({
    headless: true,
  })

  const page = await browser.newPage()
  page.setDefaultTimeout(PAGE_TIMEOUT_MS)

  const acuerdos = []

  try {
    log(`Navegando a ${BOLETIN_URL}`)
    await page.goto(BOLETIN_URL, { waitUntil: 'networkidle' })
    await page.waitForTimeout(3000)

    // ── Estrategia principal: portal Angular CJJ con select[name="judge"] ──
    const tieneSelector = await page.$(SEL.selectJuzgado)

    if (tieneSelector) {
      log('Portal Angular CJJ detectado — scraping por juzgado')
      const opciones = await page.$$eval(SEL.selectJuzgado + ' option', opts =>
        opts.filter(o => o.value).map(o => ({ value: o.value, text: o.textContent.trim() }))
      )
      log(`Encontrados ${opciones.length} juzgados en el selector`)

      for (const opcion of opciones) {
        try {
          // Seleccionar juzgado
          await page.selectOption(SEL.selectJuzgado, opcion.value)
          await page.waitForTimeout(800)

          // Asegurar modo "Por Fecha" (radio button)
          const radioFecha = await page.$('input[type="radio"][id="date"]')
          if (radioFecha) await radioFecha.check()

          // Llenar fecha
          await page.fill(SEL.fechaInput, HOY)
          await page.waitForTimeout(300)

          // Buscar — esperar a que Angular renderice los resultados
          await page.click(SEL.btnBuscar)
          try {
            // Esperar el texto "resultados encontrados" como señal de carga completa
            await page.waitForSelector('text=resultados encontrados', { timeout: 10000 })
          } catch {
            // Si no aparece, dar tiempo extra
            await page.waitForTimeout(4000)
          }

          const encontrados = await extraerItems(page, opcion.text)
          acuerdos.push(...encontrados)
          log(`  ${opcion.text}: ${encontrados.length} acuerdos`)
        } catch (e) {
          err(`Error en juzgado ${opcion.text}: ${e.message}`)
        }
      }
    } else {
      // ── Fallback: extracción directa por texto ──
      log('Sin selector de juzgado, intentando extracción directa')
      const fechaEl = await page.$(SEL.fechaInput)
      if (fechaEl) {
        await fechaEl.fill(HOY)
        const btnBuscar = await page.$(SEL.btnBuscar)
        if (btnBuscar) {
          await btnBuscar.click()
          await page.waitForTimeout(3000)
        }
      }
      const encontrados = await extraerItems(page, null)
      acuerdos.push(...encontrados)
      log(`Extracción directa: ${encontrados.length} acuerdos`)
    }

    if (acuerdos.length === 0) {
      log('Sin resultados en items, intentando extracción por texto del body')
      const encontrados = await extraerPorTexto(page)
      acuerdos.push(...encontrados)
    }

  } finally {
    await browser.close()
  }

  return acuerdos
}

/**
 * Extrae acuerdos desde las cards .item del portal Angular de CJJ
 * Estructura de cada .item:
 *   .item-title → "1104/2011 Tipo . Juicio CIVIL SUMARIO HIPO"
 *   .item-text div:first-child → "ACTOR vs. DEMANDADO"
 *   .item-text div:last-child → "DESCRIPCIÓN DEL ACUERDO"
 */
async function extraerItems(page, juzgadoNombre) {
  const resultados = []

  try {
    // Esperar que aparezcan items o confirmar que no hay resultados
    try {
      await page.waitForSelector(SEL.items, { state: 'attached', timeout: 5000 })
    } catch (e) { 
      log(`waitForSelector .item failed for ${juzgadoNombre}: ${e.message}`)
      return resultados /* sin items */ 
    }

    const items = await page.$$(SEL.items)
    log(`Found ${items.length} items for ${juzgadoNombre}`)

    for (const item of items) {
      try {
        // Número de expediente y tipo juicio desde .item-title
        const tituloEl = await item.$('.item-title')
        const tituloTexto = tituloEl ? (await tituloEl.textContent()).trim() : ''

        // Limpiar el título: quitar "Tipo", "Juicio", etiquetas internas
        // Formato: "1104/2011 Tipo . Juicio CIVIL SUMARIO HIPO"
        const expMatch = tituloTexto.match(/^\s*(\S+)/)
        const expedienteNum = expMatch ? expMatch[1].trim() : ''
        if (!expedienteNum || expedienteNum.length < 3) continue

        // Tipo de juicio (después de "Juicio")
        const tipoMatch = tituloTexto.match(/Juicio\s+(.+)$/i)
        const tipoJuicio = tipoMatch ? tipoMatch[1].trim().replace(/\s+/g, ' ') : ''

        // Partes desde .item-text — primer div hijo
        const itemTextoEl = await item.$('.item-text')
        const divs = itemTextoEl ? await itemTextoEl.$$('div') : []

        let partesTexto = ''
        let descripcion = ''
        if (divs.length >= 1) partesTexto = ((await divs[0].textContent()) || '').trim()
        if (divs.length >= 2) descripcion = ((await divs[1].textContent()) || '').trim()
        // Si solo hay 1 div, puede ser solo descripción
        if (divs.length === 1 && !partesTexto.includes(' vs. ')) {
          descripcion = partesTexto
          partesTexto = ''
        }

        // Extraer actor y demandado del texto de partes
        let actor = null
        let demandado = null
        const vsMatch = partesTexto.match(/^(.+?)\s+vs\.\s+(.*)$/i)
        if (vsMatch) {
          actor     = vsMatch[1].trim() || null
          demandado = vsMatch[2].trim() || null
          if (!demandado) demandado = null
        } else if (partesTexto) {
          // No hay "vs." — todo el texto es el actor o parte
          actor = partesTexto
        }

        resultados.push({
          expediente_num: normalizarExpediente(expedienteNum),
          juzgado:        normalizarJuzgado(juzgadoNombre || ''),
          materia:        inferirMateria(juzgadoNombre || ''),
          actor:          actor ? actor.slice(0, 300) : null,
          demandado:      demandado ? demandado.slice(0, 300) : null,
          fecha:          HOY,
          descripcion:    (tipoJuicio + (descripcion ? ' — ' + descripcion : '')).slice(0, 1000) || '',
          procesado:      false,
        })
      } catch { /* item inválido, omitir */ }
    }
  } catch (e) {
    err(`extraerItems: ${e.message}`)
  }

  return resultados
}

// Mantener extraerFilas como alias para compatibilidad
async function extraerFilas(page, juzgadoNombre) {
  return extraerItems(page, juzgadoNombre)
}

async function _extraerFilasLegacy(page, juzgadoNombre) {
  const resultados = []

  try {
    try { /* sin loader */ } catch { }

    const filas = await page.$$(SEL.filas)

    for (const fila of filas) {
      try {
        const celdas = await fila.$$('td')
        if (celdas.length < 2) continue

        const textos = await Promise.all(celdas.map(c => c.textContent()))
        const limpio = textos.map(t => t?.trim() || '')

        let expedienteNum = limpio[0]
        let juzgado       = juzgadoNombre || ''
        let actor         = null
        let demandado     = null
        let descripcion   = limpio[limpio.length - 1]

        // Layout de 5+ cols: [exp, juzgado, actor, demandado, descripcion]
        if (limpio.length >= 5) {
          juzgado     = juzgadoNombre || limpio[1]
          actor       = limpio[2] || null
          demandado   = limpio[3] || null
          descripcion = limpio[4]
        // Layout de 4 cols: [exp, actor, demandado, descripcion]
        } else if (limpio.length === 4) {
          actor       = limpio[1] || null
          demandado   = limpio[2] || null
          descripcion = limpio[3]
        // Layout de 3 cols: [exp, juzgado/partes, descripcion]
        } else if (limpio.length === 3) {
          juzgado     = juzgadoNombre || limpio[1]
          descripcion = limpio[2]
          // Intentar extraer partes de la descripción o col2
          const partes = extraerPartesDeTexto(limpio[1] + ' ' + limpio[2])
          actor     = partes.actor
          demandado = partes.demandado
        } else {
          juzgado     = juzgadoNombre || limpio[1] || ''
        }

        // Si no se encontraron partes en cols, intentar parsear de descripcion
        if (!actor && !demandado && descripcion) {
          const partes = extraerPartesDeTexto(descripcion)
          actor     = partes.actor
          demandado = partes.demandado
        }

        if (!expedienteNum || expedienteNum.length < 3) continue

        resultados.push({
          expediente_num: normalizarExpediente(expedienteNum),
          juzgado:        normalizarJuzgado(juzgado),
          materia:        inferirMateria(juzgado),
          actor:          actor ? actor.slice(0, 300) : null,
          demandado:      demandado ? demandado.slice(0, 300) : null,
          fecha:          HOY,
          descripcion:    descripcion?.slice(0, 1000) || '',
          procesado:      false,
        })
      } catch { /* fila inválida, omitir */ }
    }
  } catch (e) {
    err(`extraerFilas: ${e.message}`)
  }

  return resultados
}

// Extrae actor y demandado de un texto libre del boletín
function extraerPartesDeTexto(texto) {
  if (!texto) return { actor: null, demandado: null }
  const t = texto.toUpperCase()

  // Patrón: "NOMBRE vs NOMBRE" o "NOMBRE c/ NOMBRE" o "NOMBRE contra NOMBRE"
  const vsMatch = t.match(/^(.{3,80}?)\s+(?:VS\.?|C\/|CONTRA|VS\/)\s+(.{3,80})/)
  if (vsMatch) {
    return {
      actor:     vsMatch[1].trim().replace(/[^A-ZÁÉÍÓÚÜÑ\s\.\,\-]/g, '').trim() || null,
      demandado: vsMatch[2].trim().replace(/[^A-ZÁÉÍÓÚÜÑ\s\.\,\-]/g, '').trim() || null,
    }
  }

  // Patrón: "ACTOR: ... DEMANDADO: ..."
  const actorMatch = t.match(/(?:ACTOR|PARTE ACTORA|PROMOVENTE)[:\s]+([A-ZÁÉÍÓÚÜÑ\s\.\,]{5,80})/)
  const demMatch   = t.match(/(?:DEMANDADO|PARTE DEMANDADA|TERCERO)[:\s]+([A-ZÁÉÍÓÚÜÑ\s\.\,]{5,80})/)
  if (actorMatch || demMatch) {
    return {
      actor:     actorMatch ? actorMatch[1].trim() : null,
      demandado: demMatch   ? demMatch[1].trim()   : null,
    }
  }

  return { actor: null, demandado: null }
}

async function extraerPorTexto(page) {
  // Extrae todo el contenido visible y trata de parsear expedientes
  const texto = await page.textContent('body')
  const resultados = []

  // Patrón común: números de expediente en formato XXX/YYYY o XX/XXX/YYYY
  const patron = /\b(\d{1,6}\/(?:\w+\/)?(?:20\d{2}|19\d{2}))\b/g
  const matches = [...(texto?.matchAll(patron) || [])]

  for (const m of matches) {
    resultados.push({
      expediente_num: normalizarExpediente(m[1]),
      juzgado:        'No identificado',
      materia:        null,
      fecha:          HOY,
      descripcion:    'Extraído del texto del boletín',
      procesado:      false,
    })
  }

  // Deduplicar
  const vistos = new Set()
  return resultados.filter(r => {
    if (vistos.has(r.expediente_num)) return false
    vistos.add(r.expediente_num)
    return true
  })
}

function inferirMateria(juzgado) {
  if (!juzgado) return null
  const j = juzgado.toLowerCase()
  if (j.includes('civil'))          return 'Civil'
  if (j.includes('mercantil'))      return 'Mercantil'
  if (j.includes('familiar'))       return 'Familiar'
  if (j.includes('penal'))          return 'Penal'
  if (j.includes('administrat'))    return 'Administrativo'
  if (j.includes('adolescente'))    return 'Penal'
  if (j.includes('ejecución'))      return 'Penal'
  return null
}

// ─── GUARDAR EN SUPABASE ─────────────────────────────────────────────────────
function normalizarNombre(nombre) {
  if (!nombre) return null
  return nombre.trim()
    .toUpperCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')  // quitar acentos
    .replace(/\s+/g, ' ')
    .slice(0, 300)
}

async function guardarAcuerdos(acuerdos) {
  if (!acuerdos.length) { log('Sin acuerdos para guardar'); return 0 }

  let insertados = 0
  const lotes = []
  for (let i = 0; i < acuerdos.length; i += 100) {
    lotes.push(acuerdos.slice(i, i + 100))
  }

  for (const lote of lotes) {
    const { data, error } = await supabase
      .from('acuerdos_boletin')
      .insert(lote, { count: 'exact' })
      .select('id, expediente_num, juzgado, materia, actor, demandado, fecha')

    if (error) {
      err(`Error insertando lote: ${error.message}`)
      continue
    }

    insertados += (data?.length || lote.length)

    // Insertar partes en índice de búsqueda
    if (data?.length) {
      await guardarPartes(data)
    }
  }

  return insertados
}

async function guardarPartes(acuerdos) {
  const partes = []

  for (const a of acuerdos) {
    if (a.actor && a.actor.trim().length >= 3) {
      partes.push({
        acuerdo_id:     a.id,
        expediente_num: a.expediente_num,
        nombre:         normalizarNombre(a.actor),
        nombre_raw:     a.actor.trim(),
        rol:            'actor',
        juzgado:        a.juzgado || null,
        materia:        a.materia || null,
        partido_judicial: inferirPartido(a.juzgado),
        fecha:          a.fecha,
        fuente:         'CJJ',
      })
    }
    if (a.demandado && a.demandado.trim().length >= 3) {
      partes.push({
        acuerdo_id:     a.id,
        expediente_num: a.expediente_num,
        nombre:         normalizarNombre(a.demandado),
        nombre_raw:     a.demandado.trim(),
        rol:            'demandado',
        juzgado:        a.juzgado || null,
        materia:        a.materia || null,
        partido_judicial: inferirPartido(a.juzgado),
        fecha:          a.fecha,
        fuente:         'CJJ',
      })
    }
  }

  if (!partes.length) return

  // Insertar en lotes, ignorar duplicados
  for (let i = 0; i < partes.length; i += 100) {
    const lote = partes.slice(i, i + 100)
    const { error } = await supabase
      .from('partes_judiciales')
      .upsert(lote, { onConflict: 'acuerdo_id,nombre,rol', ignoreDuplicates: true })

    if (error && !error.message?.includes('duplicate') && !error.message?.includes('unique')) {
      err(`Error guardando partes: ${error.message}`)
    }
  }

  log(`  → ${partes.length} partes indexadas`)
}

function inferirPartido(juzgado) {
  if (!juzgado) return 'ZMG'
  const j = juzgado.toUpperCase()
  const foraneos = [
    'PUERTO VALLARTA', 'LAGOS DE MORENO', 'CIUDAD GUZMAN', 'ZAPOTLAN',
    'TEPATITLAN', 'LA BARCA', 'OCOTLAN', 'ARANDAS', 'AMECA', 'TEQUILA',
    'AUTLAN', 'COLOTLAN', 'ENCARNACION', 'SAN JUAN DE LOS LAGOS',
    'SAYULA', 'TAMAZULA', 'TLAJOMULCO', 'TONAL', 'CIHUATLAN', 'CASIMIRO',
    'AHUALULCO',
  ]
  for (const f of foraneos) {
    if (j.includes(f)) return f.charAt(0) + f.slice(1).toLowerCase()
  }
  return 'ZMG'
}

// ─── MAIN CON REINTENTOS ─────────────────────────────────────────────────────
async function main() {
  log('=== SCRAPER BOLETÍN JUDICIAL JALISCO ===')
  log(`Fecha objetivo: ${HOY}`)

  let intento = 0
  let acuerdos = []

  while (intento < MAX_RETRIES) {
    intento++
    log(`Intento ${intento} de ${MAX_RETRIES}`)

    try {
      acuerdos = await scrapearBoletin()
      if (acuerdos.length > 0) break
      log('Sin resultados, puede que el boletín aún no esté publicado')
      break
    } catch (e) {
      err(`Intento ${intento} fallido: ${e.message}`)
      if (intento < MAX_RETRIES) {
        log(`Esperando ${RETRY_WAIT_MS / 60000} min antes del siguiente intento...`)
        await sleep(RETRY_WAIT_MS)
      }
    }
  }

  const guardados = await guardarAcuerdos(acuerdos)

  const resumen = {
    fecha: HOY,
    acuerdos_scrapeados: acuerdos.length,
    acuerdos_guardados: guardados,
    intentos: intento,
  }

  log('=== RESUMEN SCRAPER ===')
  log(JSON.stringify(resumen, null, 2))

  // Guardar resumen como output de GitHub Actions
  if (process.env.GITHUB_OUTPUT) {
    const fs = await import('fs')
    fs.appendFileSync(process.env.GITHUB_OUTPUT,
      `acuerdos_scrapeados=${acuerdos.length}\n`
    )
  }

  return resumen
}

main().catch(e => {
  err(e.message)
  process.exit(1)
})
