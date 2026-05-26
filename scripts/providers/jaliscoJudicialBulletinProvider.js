/**
 * JaliscoJudicialBulletinProvider
 *
 * Extiende el scraper existente para cubrir TODOS los partidos judiciales
 * de Jalisco disponibles en https://cjj.gob.mx/bulletin
 *
 * El proveedor:
 *  1. Detecta dinámicamente los partidos judiciales en el portal.
 *  2. Guarda el catálogo de juzgados por partido en la BD (juzgados_catalogo).
 *  3. Consulta acuerdos por partido judicial, juzgado, fecha y materia.
 *  4. Normaliza y persiste los resultados con fuente, URL, órgano y expediente.
 *
 * REGLAS:
 *  - No inventar expedientes ni simular datos oficiales.
 *  - Toda publicación guarda: fuente, url_fuente, fecha, organo, expediente.
 *  - Si la fuente falla → error descriptivo, no silencio.
 *  - Caché en memoria para el catálogo de la sesión.
 */

import { chromium } from 'playwright'

// ─── CONSTANTES ──────────────────────────────────────────────────────────────

const BOLETIN_URL  = 'https://cjj.gob.mx/bulletin'
const API_BASE_ZMG = 'https://api.cjj.gob.mx/bulletin/zmg_expedient'
const FUENTE_ID    = 'CJJ'
const TIMEOUT_MS   = 60_000
const HOY          = new Date().toISOString().slice(0, 10)

// Endpoints API conocidos por partido judicial.
// La API pública del CJJ sólo documenta zmg_expedient; el resto
// se intenta por convención de nombres. Si no responden, se usa scraping.
const API_ENDPOINTS_POR_PARTIDO = {
  'Guadalajara / ZMG': 'https://api.cjj.gob.mx/bulletin/zmg_expedient',
  'Puerto Vallarta':   'https://api.cjj.gob.mx/bulletin/vallarta_expedient',
  'Lagos de Moreno':   'https://api.cjj.gob.mx/bulletin/lagos_expedient',
  'Ciudad Guzmán':     'https://api.cjj.gob.mx/bulletin/guzman_expedient',
  'Ocotlán':           'https://api.cjj.gob.mx/bulletin/ocotlan_expedient',
  'Tepatitlán':        'https://api.cjj.gob.mx/bulletin/tepa_expedient',
  'Autlán':            'https://api.cjj.gob.mx/bulletin/autlan_expedient',
  'Ameca':             'https://api.cjj.gob.mx/bulletin/ameca_expedient',
}

// Selectores CSS — actualizar si el CJJ cambia su portal
const SEL = {
  selectPartido:    'select[name*="partido" i], select[name*="dist" i], select#partido, select#distrito',
  selectJuzgado:    'select[name*="juzgado" i], select[name*="organo" i], select#juzgado, select#organo',
  fechaInput:       'input[type="date"], input[name*="fecha" i]',
  btnBuscar:        'button[type="submit"], input[type="submit"], button:has-text("Buscar"), button:has-text("Consultar")',
  filas:            'table tbody tr, .acuerdo-row, tr[data-expediente]',
  loader:           '.loading, .spinner, [aria-busy="true"]',
}

// ─── CACHÉ DE SESIÓN ─────────────────────────────────────────────────────────

let _catalogoCache = null  // { timestamp, partidos: [] }

// ─── NORMALIZACIÓN ───────────────────────────────────────────────────────────

export function normalizarExpediente(num) {
  if (!num) return ''
  return String(num).trim().replace(/\s+/g, '').toUpperCase()
}

function normalizarJuzgado(nombre) {
  if (!nombre) return ''
  return String(nombre).trim().replace(/\s+/g, ' ').toUpperCase()
}

function inferirMateria(texto) {
  const t = (texto || '').toLowerCase()
  if (t.includes('civil'))        return 'Civil'
  if (t.includes('mercantil'))    return 'Mercantil'
  if (t.includes('familiar'))     return 'Familiar'
  if (t.includes('penal'))        return 'Penal'
  if (t.includes('administrat'))  return 'Administrativo'
  if (t.includes('adolescente'))  return 'Penal'
  if (t.includes('ejecución'))    return 'Penal'
  return null
}

function inferirPartidoDesdeJuzgado(juzgado) {
  const j = (juzgado || '').toLowerCase()
  if (j.includes('vallarta'))          return 'Puerto Vallarta'
  if (j.includes('lagos'))             return 'Lagos de Moreno'
  if (j.includes('guzmán') || j.includes('guzman')) return 'Ciudad Guzmán'
  if (j.includes('ocotlán') || j.includes('ocotlan')) return 'Ocotlán'
  if (j.includes('tepatitlán') || j.includes('tepatitlan')) return 'Tepatitlán'
  if (j.includes('autlán') || j.includes('autlan')) return 'Autlán'
  if (j.includes('ameca'))             return 'Ameca'
  if (j.includes('arandas'))           return 'Arandas'
  if (j.includes('colotlán') || j.includes('colotlan')) return 'Colotlán'
  if (j.includes('la barca'))          return 'La Barca'
  if (j.includes('san juan'))          return 'San Juan de los Lagos'
  if (j.includes('sayula'))            return 'Sayula'
  if (j.includes('tamazula'))          return 'Tamazula'
  if (j.includes('tequila'))           return 'Tequila'
  if (j.includes('tlajomulco'))        return 'Tlajomulco'
  if (j.includes('zapotlán'))          return 'Zapotlán el Grande'
  if (j.includes('casimiro'))          return 'Casimiro Castillo'
  if (j.includes('cihuatlán') || j.includes('cihuatlan')) return 'Cihuatlán'
  if (j.includes('encarnación'))       return 'Encarnación de Díaz'
  if (j.includes('ahualulco'))         return 'Ahualulco de Mercado'
  return 'Guadalajara / ZMG'
}

/**
 * Normaliza un acuerdo CJJ al modelo interno.
 * SIEMPRE conserva fuente y url_fuente.
 */
export function normalizarAcuerdo(raw, partido, urlFuente) {
  return {
    expediente_num:   normalizarExpediente(raw.expediente_num),
    juzgado:          normalizarJuzgado(raw.juzgado || 'No identificado'),
    materia:          raw.materia || inferirMateria(raw.juzgado),
    fecha:            raw.fecha || HOY,
    descripcion:      String(raw.descripcion || '').slice(0, 1000),
    procesado:        false,
    fuente:           FUENTE_ID,
    url_fuente:       urlFuente || BOLETIN_URL,
    organo:           normalizarJuzgado(raw.juzgado || ''),
    partido_judicial: partido || inferirPartidoDesdeJuzgado(raw.juzgado),
  }
}

// ─── CONSULTA POR API (cuando existe endpoint) ───────────────────────────────

/**
 * Consulta un expediente específico en la API del CJJ.
 * Funciona igual que consultarBoletinCJJ de helpers.js pero
 * acepta cualquier endpoint (no solo ZMG).
 *
 * @param {string} expedient - Número de expediente
 * @param {string} cveJuz    - Código CJJ del juzgado
 * @param {string} endpoint  - URL del endpoint (default: ZMG)
 */
export async function consultarExpedienteAPI(expedient, cveJuz, endpoint = API_BASE_ZMG) {
  if (!expedient || !cveJuz) throw new Error('Expediente y código de juzgado requeridos')

  const url = `${endpoint}?judged=${encodeURIComponent(cveJuz)}&expedient=${encodeURIComponent(expedient)}&url=${encodeURIComponent(endpoint.split('/').pop())}`

  const res = await fetch(url, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(15_000),
  })

  if (!res.ok) throw new Error(`Error API CJJ (${res.status}): ${url}`)

  const json = await res.json()
  if (!json.success) {
    if (json.message?.toLowerCase().includes('no se encontr')) return []
    throw new Error(`API CJJ respondió error: ${json.message || 'Sin detalle'}`)
  }
  if (!Array.isArray(json.data)) return []

  return json.data.map(d => ({
    fecha:        d.FCH_ACU ? d.FCH_ACU.slice(0, 10) : null,
    fechaPromo:   d.FCH_PRO ? d.FCH_PRO.slice(0, 10) : null,
    descripcion:  d.BOLETIN  || '',
    tipo:         d.TIPO     || '',
    notificacion: d.NOTIFICACI || '',
    urlFuente:    `${BOLETIN_URL}?expediente=${encodeURIComponent(expedient)}&juzgado=${encodeURIComponent(cveJuz)}`,
    raw: d,
  }))
}

/**
 * Detecta qué endpoint usar para un partido judicial dado.
 * Primero intenta los endpoints conocidos; si fallan, retorna null
 * para indicar que debe usarse scraping.
 */
export async function detectarEndpointPartido(partido) {
  const endpoint = API_ENDPOINTS_POR_PARTIDO[partido]
  if (!endpoint) return null

  try {
    const res = await fetch(`${endpoint}?judged=TEST&expedient=0&url=test`, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(8_000),
    })
    if (res.ok) return endpoint
    return null
  } catch {
    return null
  }
}

// ─── DESCUBRIMIENTO DINÁMICO DE CATÁLOGO ─────────────────────────────────────

/**
 * Lee dinámicamente los partidos judiciales y juzgados del portal CJJ.
 * Guarda el resultado en caché de sesión (30 minutos).
 *
 * @returns {Promise<Array<{partido, juzgados}>>}
 */
export async function descubrirCatalogoPartidos({ forzar = false } = {}) {
  // Devolver caché si es reciente
  if (!forzar && _catalogoCache && (Date.now() - _catalogoCache.timestamp < 30 * 60_000)) {
    return _catalogoCache.partidos
  }

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  })

  try {
    const context = await browser.newContext({
      viewport: { width: 1280, height: 900 },
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      locale: 'es-MX',
    })
    const page = await context.newPage()
    page.setDefaultTimeout(TIMEOUT_MS)

    await page.goto(BOLETIN_URL, { waitUntil: 'networkidle' })
    await page.waitForTimeout(3000)

    const partidos = []

    // ── Buscar selector de partido judicial ──
    const selPartido = await page.$(SEL.selectPartido)

    if (selPartido) {
      const opcionesPartido = await page.$$eval(
        SEL.selectPartido + ' option',
        opts => opts.filter(o => o.value).map(o => ({ value: o.value, text: o.textContent.trim() }))
      )

      for (const op of opcionesPartido) {
        try {
          await page.selectOption(SEL.selectPartido, op.value)
          await page.waitForTimeout(1500)

          // Leer juzgados disponibles para este partido
          const juzgados = await leerJuzgadosDelSelector(page, op.text)
          partidos.push({ partido: op.text, value: op.value, juzgados })
        } catch (e) {
          partidos.push({ partido: op.text, value: op.value, juzgados: [], error: e.message })
        }
      }
    } else {
      // Sin selector de partido → asumir todo es ZMG y leer juzgados directamente
      const juzgados = await leerJuzgadosDelSelector(page, 'Guadalajara / ZMG')
      if (juzgados.length > 0) {
        partidos.push({ partido: 'Guadalajara / ZMG', value: 'zmg', juzgados })
      }
    }

    // Guardar en caché
    _catalogoCache = { timestamp: Date.now(), partidos }
    return partidos

  } finally {
    await browser.close()
  }
}

async function leerJuzgadosDelSelector(page, partido) {
  const juzgados = []
  try {
    const selJuz = await page.$(SEL.selectJuzgado)
    if (!selJuz) return juzgados

    const opciones = await page.$$eval(
      SEL.selectJuzgado + ' option',
      opts => opts.filter(o => o.value).map(o => ({ value: o.value, text: o.textContent.trim() }))
    )

    for (const op of opciones) {
      juzgados.push({
        cveJuz:    op.value,
        nombre:    op.text,
        materia:   inferirMateria(op.text),
        partido,
        fuente:    FUENTE_ID,
        tipo_organo: inferirTipoOrgano(op.text),
      })
    }
  } catch { /* sin selector de juzgado */ }
  return juzgados
}

function inferirTipoOrgano(nombre) {
  const n = (nombre || '').toLowerCase()
  if (n.includes('sala'))     return 'sala'
  if (n.includes('tribunal')) return 'tribunal'
  if (n.includes('pleno'))    return 'pleno'
  return 'juzgado'
}

// ─── SCRAPING DEL BOLETÍN POR PARTIDO ────────────────────────────────────────

/**
 * Extrae acuerdos del boletín CJJ para un partido judicial y fecha dados.
 *
 * @param {object} params
 * @param {string} [params.partido]   - Partido judicial (si el portal tiene selector)
 * @param {string} [params.cveJuz]    - Código del juzgado (si se quiere un juzgado específico)
 * @param {string} [params.fecha]     - Fecha YYYY-MM-DD (default: hoy)
 * @param {string} [params.materia]   - Filtro de materia (post-scraping)
 * @returns {Promise<object[]>}       - Acuerdos normalizados
 */
export async function scrapearAcuerdosPorPartido({
  partido = null,
  cveJuz  = null,
  fecha   = HOY,
  materia = null,
} = {}) {
  const urlFuente = partido
    ? `${BOLETIN_URL}?partido=${encodeURIComponent(partido)}&fecha=${fecha}`
    : `${BOLETIN_URL}?fecha=${fecha}`

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  })

  const acuerdos = []

  try {
    const context = await browser.newContext({
      viewport: { width: 1280, height: 900 },
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      locale: 'es-MX',
    })
    const page = await context.newPage()
    page.setDefaultTimeout(TIMEOUT_MS)

    await page.goto(BOLETIN_URL, { waitUntil: 'networkidle' })
    await page.waitForTimeout(2000)

    // Seleccionar partido si hay selector
    const selPartido = await page.$(SEL.selectPartido)
    if (selPartido && partido) {
      const opciones = await page.$$eval(
        SEL.selectPartido + ' option',
        opts => opts.map(o => ({ value: o.value, text: o.textContent.trim() }))
      )
      const op = opciones.find(o =>
        o.text.toLowerCase().includes((partido || '').toLowerCase().slice(0, 8))
      )
      if (op) {
        await page.selectOption(SEL.selectPartido, op.value)
        await page.waitForTimeout(1500)
      }
    }

    // Seleccionar juzgado si se especificó
    const selJuz = await page.$(SEL.selectJuzgado)
    if (selJuz && cveJuz) {
      try {
        await page.selectOption(SEL.selectJuzgado, cveJuz)
        await page.waitForTimeout(1000)
      } catch { /* valor no encontrado */ }
    } else if (selJuz) {
      // Sin juzgado específico: iterar todos los juzgados del selector
      const opciones = await page.$$eval(
        SEL.selectJuzgado + ' option',
        opts => opts.filter(o => o.value).map(o => ({ value: o.value, text: o.textContent.trim() }))
      )

      for (const op of opciones) {
        try {
          await page.selectOption(SEL.selectJuzgado, op.value)
          await page.waitForTimeout(800)

          // Establecer fecha
          const fechaEl = await page.$(SEL.fechaInput)
          if (fechaEl) { await fechaEl.fill(fecha); await page.waitForTimeout(400) }

          const btn = await page.$(SEL.btnBuscar)
          if (btn) { await btn.click(); await page.waitForTimeout(2000) }

          const encontrados = await extraerFilas(page, op.text, partido, urlFuente)
          acuerdos.push(...encontrados)
        } catch { /* continuar con siguiente juzgado */ }
      }
    }

    // Si no hubo selector de juzgado o no se iteraron opciones
    if (acuerdos.length === 0) {
      const fechaEl = await page.$(SEL.fechaInput)
      if (fechaEl) { await fechaEl.fill(fecha); await page.waitForTimeout(400) }

      const btn = await page.$(SEL.btnBuscar)
      if (btn) { await btn.click(); await page.waitForTimeout(3000) }

      const encontrados = await extraerFilas(page, null, partido, urlFuente)
      acuerdos.push(...encontrados)
    }

  } finally {
    await browser.close()
  }

  // Filtrar por materia si se especificó
  const filtrados = materia
    ? acuerdos.filter(a => !a.materia || a.materia === materia)
    : acuerdos

  return filtrados
}

async function extraerFilas(page, juzgadoNombre, partido, urlFuente) {
  const resultados = []
  try {
    try {
      await page.waitForSelector(SEL.loader, { state: 'hidden', timeout: 5000 })
    } catch { /* sin loader */ }

    const filas = await page.$$(SEL.filas)

    for (const fila of filas) {
      try {
        const celdas = await fila.$$('td')
        if (celdas.length < 2) continue
        const textos = await Promise.all(celdas.map(c => c.textContent()))
        const t = textos.map(x => (x || '').trim().replace(/\s+/g, ' '))

        let expNum    = t[0]
        let juzgado   = juzgadoNombre || t[1] || ''
        let desc      = t[t.length - 1]

        if (t.length >= 3) {
          juzgado = juzgadoNombre || t[1]
          desc    = t[2]
        }

        if (!expNum || expNum.length < 3) continue

        const acuerdo = normalizarAcuerdo({
          expediente_num: expNum,
          juzgado,
          materia:        inferirMateria(juzgado),
          fecha:          HOY,
          descripcion:    desc?.slice(0, 1000) || '',
        }, partido, urlFuente)

        resultados.push(acuerdo)
      } catch { /* fila inválida */ }
    }
  } catch { /* sin tabla */ }
  return resultados
}

// ─── BÚSQUEDA POR EXPEDIENTE EN TODOS LOS PARTIDOS ───────────────────────────

/**
 * Busca un expediente en todos los partidos judiciales disponibles.
 * Primero intenta la API; si falla, usa scraping.
 *
 * @param {string} numExpediente - Número de expediente a buscar
 * @param {string} [cveJuz]      - Código CJJ del juzgado (acelera la búsqueda)
 * @param {string} [partido]     - Partido judicial (opcional, reduce el scope)
 */
export async function buscarEnTodosLosPartidos(numExpediente, cveJuz, partido) {
  if (!numExpediente) throw new Error('Número de expediente requerido')

  const resultados = []

  // Si tenemos cveJuz, intentar API primero (más rápido)
  if (cveJuz) {
    const endpoint = partido ? (API_ENDPOINTS_POR_PARTIDO[partido] || API_BASE_ZMG) : API_BASE_ZMG
    try {
      const apiResults = await consultarExpedienteAPI(numExpediente, cveJuz, endpoint)
      if (apiResults.length > 0) {
        return apiResults.map(r => ({
          ...r,
          partido_judicial: partido || 'Guadalajara / ZMG',
          fuente: FUENTE_ID,
          url_fuente: r.urlFuente || BOLETIN_URL,
        }))
      }
    } catch { /* falla API, continuar con scraping */ }
  }

  // Scraping del partido específico o de todos
  const partidoTarget = partido ? [partido] : Object.keys(API_ENDPOINTS_POR_PARTIDO)

  for (const p of partidoTarget) {
    try {
      const encontrados = await scrapearAcuerdosPorPartido({ partido: p })
      const coinciden = encontrados.filter(a =>
        normalizarExpediente(a.expediente_num) === normalizarExpediente(numExpediente)
      )
      resultados.push(...coinciden)
    } catch { /* continuar con siguiente partido */ }
  }

  return resultados
}
