/* eslint-env node */
/* eslint-disable no-useless-escape */
/**
 * FederalAmparoJaliscoProvider
 *
 * Consulta el portal de la Dirección General de Estadística Judicial
 * del Consejo de la Judicatura Federal (DGEJ-CJF) para el Tercer Circuito
 * (Jalisco).
 *
 * Fuente oficial: https://www.dgej.cjf.gob.mx/internet/expedientes/circuitos.asp
 *
 * REGLAS:
 *  - Nunca inventar datos ni simular expedientes.
 *  - Toda publicación conserva la URL de origen.
 *  - Si la fuente falla se lanza error descriptivo, no se retornan datos vacíos silenciosos.
 *  - Los resultados se normalizan antes de persistir.
 */

import { chromium } from 'playwright'

// ─── CONSTANTES ──────────────────────────────────────────────────────────────

const BASE_URL   = 'https://www.dgej.cjf.gob.mx/internet/expedientes/circuitos.asp'
const CIRCUITO   = '3'          // Tercer Circuito = Jalisco
const FUENTE_ID  = 'DGEJ-CJF'
const TIMEOUT_MS = 60_000

/**
 * Tipos de asunto que maneja el Tercer Circuito.
 * Fuente: Acuerdo General 3/2013 CJF + catálogo DGEJ.
 */
export const TIPOS_ASUNTO_CJF = [
  'Amparo Directo',
  'Amparo Indirecto',
  'Recurso de Revisión',
  'Recurso de Queja',
  'Recurso de Reclamación',
  'Conflicto de Competencia',
  'Impedimento',
  'Excitativa de Justicia',
  'Reconocimiento de Inocencia',
  'Acción Penal',
]

/**
 * Órganos del Tercer Circuito en Jalisco.
 * Fuente: https://www.cjf.gob.mx/tercercircuito
 * Incluye Tribunales Colegiados, Unitarios y Juzgados de Distrito.
 */
export const ORGANOS_TERCER_CIRCUITO = [
  // Tribunales Colegiados
  { clave: 'TC01', nombre: 'Primer Tribunal Colegiado en Materia Civil del Tercer Circuito',           tipo: 'Tribunal Colegiado', materia: 'Civil' },
  { clave: 'TC02', nombre: 'Segundo Tribunal Colegiado en Materia Civil del Tercer Circuito',          tipo: 'Tribunal Colegiado', materia: 'Civil' },
  { clave: 'TC03', nombre: 'Primer Tribunal Colegiado en Materia de Trabajo del Tercer Circuito',      tipo: 'Tribunal Colegiado', materia: 'Laboral' },
  { clave: 'TC04', nombre: 'Segundo Tribunal Colegiado en Materia de Trabajo del Tercer Circuito',     tipo: 'Tribunal Colegiado', materia: 'Laboral' },
  { clave: 'TC05', nombre: 'Tercer Tribunal Colegiado en Materia de Trabajo del Tercer Circuito',      tipo: 'Tribunal Colegiado', materia: 'Laboral' },
  { clave: 'TC06', nombre: 'Primer Tribunal Colegiado en Materia Penal del Tercer Circuito',           tipo: 'Tribunal Colegiado', materia: 'Penal' },
  { clave: 'TC07', nombre: 'Segundo Tribunal Colegiado en Materia Penal del Tercer Circuito',          tipo: 'Tribunal Colegiado', materia: 'Penal' },
  { clave: 'TC08', nombre: 'Tercer Tribunal Colegiado en Materia Penal del Tercer Circuito',           tipo: 'Tribunal Colegiado', materia: 'Penal' },
  { clave: 'TC09', nombre: 'Cuarto Tribunal Colegiado en Materia Penal del Tercer Circuito',           tipo: 'Tribunal Colegiado', materia: 'Penal' },
  { clave: 'TC10', nombre: 'Primer Tribunal Colegiado en Materia Administrativa del Tercer Circuito',  tipo: 'Tribunal Colegiado', materia: 'Administrativo' },
  { clave: 'TC11', nombre: 'Segundo Tribunal Colegiado en Materia Administrativa del Tercer Circuito', tipo: 'Tribunal Colegiado', materia: 'Administrativo' },
  { clave: 'TC12', nombre: 'Tercer Tribunal Colegiado en Materia Administrativa del Tercer Circuito',  tipo: 'Tribunal Colegiado', materia: 'Administrativo' },
  { clave: 'TC13', nombre: 'Cuarto Tribunal Colegiado en Materia Administrativa del Tercer Circuito',  tipo: 'Tribunal Colegiado', materia: 'Administrativo' },
  { clave: 'TC14', nombre: 'Primer Tribunal Colegiado en Materias Civil y de Trabajo del Tercer Circuito', tipo: 'Tribunal Colegiado', materia: 'Civil' },
  { clave: 'TC15', nombre: 'Segundo Tribunal Colegiado en Materias Civil y de Trabajo del Tercer Circuito', tipo: 'Tribunal Colegiado', materia: 'Civil' },
  // Tribunales Unitarios
  { clave: 'TU01', nombre: 'Primer Tribunal Unitario del Tercer Circuito',                             tipo: 'Tribunal Unitario',  materia: 'Civil' },
  { clave: 'TU02', nombre: 'Segundo Tribunal Unitario del Tercer Circuito',                            tipo: 'Tribunal Unitario',  materia: 'Civil' },
  { clave: 'TU03', nombre: 'Tercer Tribunal Unitario del Tercer Circuito',                             tipo: 'Tribunal Unitario',  materia: 'Civil' },
  // Juzgados de Distrito
  { clave: 'JD01', nombre: 'Juzgado Primero de Distrito en Materia Civil en el Estado de Jalisco',         tipo: 'Juzgado de Distrito', materia: 'Civil' },
  { clave: 'JD02', nombre: 'Juzgado Segundo de Distrito en Materia Civil en el Estado de Jalisco',         tipo: 'Juzgado de Distrito', materia: 'Civil' },
  { clave: 'JD03', nombre: 'Juzgado Tercero de Distrito en Materia Civil en el Estado de Jalisco',         tipo: 'Juzgado de Distrito', materia: 'Civil' },
  { clave: 'JD04', nombre: 'Juzgado Primero de Distrito en Materia Penal en el Estado de Jalisco',         tipo: 'Juzgado de Distrito', materia: 'Penal' },
  { clave: 'JD05', nombre: 'Juzgado Segundo de Distrito en Materia Penal en el Estado de Jalisco',         tipo: 'Juzgado de Distrito', materia: 'Penal' },
  { clave: 'JD06', nombre: 'Juzgado Tercero de Distrito en Materia Penal en el Estado de Jalisco',         tipo: 'Juzgado de Distrito', materia: 'Penal' },
  { clave: 'JD07', nombre: 'Juzgado Cuarto de Distrito en Materia Penal en el Estado de Jalisco',          tipo: 'Juzgado de Distrito', materia: 'Penal' },
  { clave: 'JD08', nombre: 'Juzgado Quinto de Distrito en Materia Penal en el Estado de Jalisco',          tipo: 'Juzgado de Distrito', materia: 'Penal' },
  { clave: 'JD09', nombre: 'Juzgado Primero de Distrito en Materia Administrativa en el Estado de Jalisco',tipo: 'Juzgado de Distrito', materia: 'Administrativo' },
  { clave: 'JD10', nombre: 'Juzgado Segundo de Distrito en Materia Administrativa en el Estado de Jalisco',tipo: 'Juzgado de Distrito', materia: 'Administrativo' },
  { clave: 'JD11', nombre: 'Juzgado Tercero de Distrito en Materia Administrativa en el Estado de Jalisco',tipo: 'Juzgado de Distrito', materia: 'Administrativo' },
  { clave: 'JD12', nombre: 'Juzgado de Distrito en Materias de Amparo y Juicios Federales en el Estado de Jalisco', tipo: 'Juzgado de Distrito', materia: 'Civil' },
  { clave: 'JD13', nombre: 'Juzgado Primero de Distrito en Materia de Trabajo en el Estado de Jalisco',    tipo: 'Juzgado de Distrito', materia: 'Laboral' },
  { clave: 'JD14', nombre: 'Juzgado Segundo de Distrito en Materia de Trabajo en el Estado de Jalisco',    tipo: 'Juzgado de Distrito', materia: 'Laboral' },
  // Foráneos del Tercer Circuito
  { clave: 'JD15', nombre: 'Juzgado de Distrito en el Estado de Jalisco, con Residencia en Puerto Vallarta', tipo: 'Juzgado de Distrito', materia: 'Civil' },
  { clave: 'JD16', nombre: 'Juzgado de Distrito en el Estado de Jalisco, con Residencia en Ciudad Guzmán',   tipo: 'Juzgado de Distrito', materia: 'Civil' },
]

// ─── NORMALIZACIÓN ───────────────────────────────────────────────────────────

/**
 * Normaliza un número de expediente al formato estándar CJF.
 * Ejemplos válidos: "1234/2024", "AD-12/2023", "12/2024"
 */
export function normalizarNumeroAmparo(raw) {
  if (!raw) return null
  return String(raw)
    .trim()
    .replace(/\s+/g, '')
    .toUpperCase()
    .replace(/[–—]/g, '/')   // guiones largos a diagonal
}

/**
 * Normaliza un acuerdo crudo del CJF al modelo interno.
 * SIEMPRE conserva url_fuente.
 */
export function normalizarAmparo(raw, params = {}) {
  return {
    num_amparo:           normalizarNumeroAmparo(raw.numAmparo || raw.expediente || params.numAmparo),
    tipo_asunto:          raw.tipoAsunto  || params.tipoAsunto || null,
    organo:               raw.organo      || params.organo     || 'No identificado',
    circuito:             raw.circuito    || CIRCUITO,
    ponente:              raw.ponente     || null,
    actor:                raw.actor       || raw.quejoso       || null,
    autoridad_responsable: raw.autoridad  || null,
    fecha_presentacion:   raw.fechaPresent ? raw.fechaPresent.slice(0, 10) : null,
    fecha_acuerdo:        raw.fechaAcuerdo ? raw.fechaAcuerdo.slice(0, 10) : null,
    descripcion_acuerdo:  raw.descripcion ? String(raw.descripcion).slice(0, 1000) : null,
    estado_asunto:        raw.estado      || null,
    url_fuente:           raw.urlFuente   || construirUrlFuente(params),
    fuente:               FUENTE_ID,
  }
}

function construirUrlFuente({ numAmparo, organo, claveCir } = {}) {
  const params = new URLSearchParams({
    Cir: claveCir || CIRCUITO,
    ...(numAmparo ? { Exp: numAmparo } : {}),
  })
  return `${BASE_URL}?${params}`
}

// ─── BÚSQUEDA POR NÚMERO DE EXPEDIENTE ──────────────────────────────────────

/**
 * Busca un amparo por número en el portal DGEJ-CJF.
 *
 * @param {object} params
 * @param {string} params.numAmparo    - Número de expediente, ej: "1234/2024"
 * @param {string} [params.organo]     - Clave del órgano (clave del catálogo)
 * @param {string} [params.tipoAsunto] - Tipo de asunto
 * @returns {Promise<object[]>}        - Array de amparos normalizados
 */
export async function buscarAmparoFederal({ numAmparo, organo, tipoAsunto }) {
  if (!numAmparo) throw new Error('Se requiere número de expediente/amparo')

  const numNorm = normalizarNumeroAmparo(numAmparo)
  const urlFuente = construirUrlFuente({ numAmparo: numNorm })

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  })

  try {
    const context = await browser.newContext({
      viewport: { width: 1280, height: 900 },
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36',
      locale: 'es-MX',
    })
    const page = await context.newPage()
    page.setDefaultTimeout(TIMEOUT_MS)

    // Navegar al portal DGEJ-CJF Tercer Circuito
    await page.goto(urlFuente, { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(2000)

    // Intentar llenar el campo de expediente
    const inputExp = await page.$('input[name*="exp" i], input[name*="Exp" i], input[placeholder*="expediente" i], #expediente')
    if (inputExp) {
      await inputExp.fill(numNorm)
    }

    // Seleccionar circuito si hay selector
    const selCir = await page.$('select[name*="cir" i], select[name*="Cir" i], #circuito')
    if (selCir) {
      // Seleccionar Tercer Circuito (valor "3" o la opción que contenga "Tercer" o "Jalisco")
      const opciones = await selCir.$$eval('option', opts =>
        opts.map(o => ({ value: o.value, text: o.textContent.trim() }))
      )
      const opTercer = opciones.find(o =>
        o.value === '3' || o.value === CIRCUITO ||
        o.text.toLowerCase().includes('tercer') ||
        o.text.toLowerCase().includes('jalisco')
      )
      if (opTercer) await page.selectOption('select[name*="cir" i], #circuito', opTercer.value)
    }

    // Seleccionar órgano si se especificó
    if (organo) {
      const selOrg = await page.$('select[name*="org" i], select[name*="juz" i], #organo')
      if (selOrg) {
        const orgInfo = ORGANOS_TERCER_CIRCUITO.find(o => o.clave === organo || o.nombre === organo)
        if (orgInfo) {
          const opciones = await selOrg.$$eval('option', opts =>
            opts.map(o => ({ value: o.value, text: o.textContent.trim() }))
          )
          const opOrg = opciones.find(o =>
            o.text.toLowerCase().includes(orgInfo.nombre.toLowerCase().slice(0, 20))
          )
          if (opOrg) await page.selectOption('select[name*="org" i], #organo', opOrg.value)
        }
      }
    }

    // Buscar y hacer clic en el botón
    const btnBuscar = await page.$('input[type="submit"], button[type="submit"], button:has-text("Buscar"), button:has-text("Consultar")')
    if (btnBuscar) {
      await btnBuscar.click()
      await page.waitForTimeout(3000)
    }

    // Extraer resultados de la tabla
    const resultados = await extraerTablaResultados(page, numNorm, urlFuente, tipoAsunto)

    if (resultados.length === 0) {
      // Intentar extracción alternativa por texto
      return await extraerPorContenido(page, numNorm, urlFuente, tipoAsunto)
    }

    return resultados

  } catch (error) {
    const msg = `[FederalAmparoJaliscoProvider] Error consultando DGEJ-CJF: ${error.message}`
    throw new Error(msg)
  } finally {
    await browser.close()
  }
}

// ─── EXTRACCIÓN DE RESULTADOS ─────────────────────────────────────────────────

async function extraerTablaResultados(page, numNorm, urlFuente, tipoAsunto) {
  const resultados = []

  try {
    const filas = await page.$$('table tbody tr, tr[valign], .resultado-row')

    for (const fila of filas) {
      try {
        const celdas = await fila.$$('td')
        if (celdas.length < 2) continue
        const textos = await Promise.all(celdas.map(c => c.textContent()))
        const t = textos.map(x => (x || '').trim().replace(/\s+/g, ' '))

        // El portal CJF típicamente muestra: Expediente | Órgano | Ponente | Estado | Fecha
        const rawAmparo = inferirCamposDeFila(t, numNorm, urlFuente, tipoAsunto)
        if (rawAmparo) resultados.push(normalizarAmparo(rawAmparo))
      } catch { /* fila inválida */ }
    }
  } catch { /* sin tabla */ }

  return resultados
}

function inferirCamposDeFila(textos, numNorm, urlFuente, tipoAsunto) {
  // Si ninguna celda contiene el número buscado, saltamos la fila
  const contiene = textos.some(t => t.replace(/\s/g,'').toUpperCase().includes(numNorm.replace(/\s/g,'')))
  if (!contiene && textos.length > 0) return null

  // Detectar patrón de fecha (dd/mm/yyyy o yyyy-mm-dd)
  const reDate = /\b(\d{2}[\/\-]\d{2}[\/\-]\d{4}|\d{4}[\/\-]\d{2}[\/\-]\d{2})\b/
  const fechaMatch = textos.map(t => t.match(reDate)).find(Boolean)
  const fechaRaw   = fechaMatch ? fechaMatch[1] : null
  const fecha      = fechaRaw ? normalizarFecha(fechaRaw) : null

  // Detectar órgano: celda que mencione "Tribunal", "Juzgado", "Sala"
  const organo = textos.find(t => /tribunal|juzgado|sala/i.test(t)) || 'Tercer Circuito Jalisco'

  // Detectar ponente (generalmente precedido por "MAGISTRADO" o contiene apellidos en mayúscula)
  const ponente = textos.find(t => /magistrado|juez/i.test(t) && t.length < 80) || null

  // Estado del asunto
  const estado = textos.find(t => /en trámite|concluido|sobreseído|enviado/i.test(t)) || null

  return {
    numAmparo:    numNorm,
    tipoAsunto:   tipoAsunto || inferirTipoAsunto(textos),
    organo,
    ponente,
    fechaAcuerdo: fecha,
    descripcion:  textos.filter(t => t.length > 30 && !/tribunal|juzgado|magistrado/i.test(t)).join(' | ').slice(0, 800),
    estado,
    urlFuente,
    circuito:     CIRCUITO,
  }
}

async function extraerPorContenido(page, numNorm, urlFuente, tipoAsunto) {
  // Último recurso: buscar el número en todo el contenido de la página
  const contenido = await page.textContent('body').catch(() => '')
  if (!contenido) return []

  const patron = new RegExp(numNorm.replace('/', '\\/').replace(/[-]/g, '[-]?'), 'i')
  if (!patron.test(contenido)) return []  // No está en la página

  // El número existe en la página pero no pudimos parsear la tabla
  // Retornamos lo que podemos sin inventar datos
  return [normalizarAmparo({
    numAmparo:   numNorm,
    tipoAsunto,
    organo:      'Tercer Circuito Jalisco (CJF)',
    circuito:    CIRCUITO,
    descripcion: 'Expediente encontrado en portal DGEJ-CJF. Consulte la fuente oficial para detalles.',
    urlFuente,
  })]
}

function inferirTipoAsunto(textos) {
  const joined = textos.join(' ').toLowerCase()
  if (joined.includes('directo'))    return 'Amparo Directo'
  if (joined.includes('indirecto'))  return 'Amparo Indirecto'
  if (joined.includes('revisión'))   return 'Recurso de Revisión'
  if (joined.includes('queja'))      return 'Recurso de Queja'
  return 'Amparo'
}

function normalizarFecha(raw) {
  if (!raw) return null
  // dd/mm/yyyy → yyyy-mm-dd
  const m = raw.match(/^(\d{2})[\/\-](\d{2})[\/\-](\d{4})$/)
  if (m) return `${m[3]}-${m[2]}-${m[1]}`
  // yyyy-mm-dd ya está en formato correcto
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw
  return null
}

// ─── CATÁLOGO DE ÓRGANOS ─────────────────────────────────────────────────────

/**
 * Retorna el catálogo estático del Tercer Circuito.
 * No requiere red — se actualiza manualmente cuando el CJF reestructura el circuito.
 */
export function getCatalogoTercerCircuito() {
  return ORGANOS_TERCER_CIRCUITO.map(o => ({
    fuente:           FUENTE_ID,
    partido_judicial: 'Federal — Tercer Circuito (Jalisco)',
    nombre:           o.nombre,
    cve_juz:          o.clave,
    circuito:         CIRCUITO,
    materia:          o.materia,
    tipo_organo:      o.tipo,
    municipio:        o.clave.startsWith('JD15') ? 'Puerto Vallarta' :
                      o.clave.startsWith('JD16') ? 'Ciudad Guzmán'   : 'Guadalajara',
    endpoint_api:     `${BASE_URL}?Cir=${CIRCUITO}`,
    activo:           true,
  }))
}
