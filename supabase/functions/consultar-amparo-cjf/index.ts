import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// ─── CONSTANTES ──────────────────────────────────────────────────────────────

const CJF_BASE    = 'https://www.dgej.cjf.gob.mx/internet/expedientes/circuitos.asp'
const CIRCUITO    = '3'   // Tercer Circuito = Jalisco
const FUENTE      = 'DGEJ-CJF'
const USER_AGENT  = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36'

// ─── NORMALIZACIÓN ────────────────────────────────────────────────────────────

function normalizarNum(raw: string): string {
  return raw.trim().replace(/\s+/g, '').toUpperCase().replace(/[–—]/g, '/')
}

function normalizarFecha(raw: string): string | null {
  if (!raw) return null
  // dd/mm/yyyy → yyyy-mm-dd
  const m = raw.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/)
  if (m) return `${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw
  return null
}

function construirUrlFuente(numAmparo: string, cir = CIRCUITO): string {
  return `${CJF_BASE}?Cir=${cir}&Exp=${encodeURIComponent(numAmparo)}`
}

// ─── PARSER HTML ─────────────────────────────────────────────────────────────
// Extrae datos de la respuesta HTML del portal DGEJ-CJF.
// El portal usa tablas HTML clásicas — parseamos con regex sobre el texto limpio.

interface AmparoRaw {
  numAmparo: string
  tipoAsunto: string | null
  organo: string
  ponente: string | null
  actor: string | null
  autoridad: string | null
  fechaPresent: string | null
  fechaAcuerdo: string | null
  descripcion: string | null
  estado: string | null
  urlFuente: string
}

function parsearHtmlCJF(html: string, numBuscado: string): AmparoRaw[] {
  const resultados: AmparoRaw[] = []
  const urlFuente = construirUrlFuente(numBuscado)

  // Limpiar HTML — quitar tags, normalizar espacios
  const textoLimpio = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim()

  // Verificar que el número buscado aparece en la respuesta
  const numNorm = normalizarNum(numBuscado)
  const sinEspacios = textoLimpio.replace(/\s/g, '').toUpperCase()
  const numSinEsp   = numNorm.replace(/\s/g, '')

  if (!sinEspacios.includes(numSinEsp)) {
    // El número no está en la página — no hay resultados
    return []
  }

  // Extraer bloques de tabla — el portal CJF usa <tr> con datos del expediente
  // Intentar extraer filas de tabla como fragmentos de texto
  const filasRaw = html.match(/<tr[\s\S]*?<\/tr>/gi) || []

  for (const fila of filasRaw) {
    const celdas = (fila.match(/<td[\s\S]*?<\/td>/gi) || [])
      .map(td => td.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim())
      .filter(t => t.length > 0)

    if (celdas.length < 2) continue

    // Verificar que alguna celda contiene el número buscado
    const filaTexto = celdas.join(' ').replace(/\s/g, '').toUpperCase()
    if (!filaTexto.includes(numSinEsp)) continue

    // Intentar identificar campos por patrones
    const fechaRe   = /\b(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4})\b/
    const organoRe  = /tribunal|juzgado|sala/i
    const estadoRe  = /tr[áa]mite|conclu|sobreseí|enviado|pendiente/i

    const fechas   = celdas.map(c => c.match(fechaRe)?.[1]).filter(Boolean) as string[]
    const organo   = celdas.find(c => organoRe.test(c)) || 'Tercer Circuito Jalisco (CJF)'
    const estado   = celdas.find(c => estadoRe.test(c)) || null
    const ponente  = celdas.find(c => /magistrado|juez/i.test(c) && c.length < 100) || null
    const descLong = celdas.filter(c => c.length > 40 && !organoRe.test(c) && !estadoRe.test(c))

    resultados.push({
      numAmparo:   numNorm,
      tipoAsunto:  inferirTipo(celdas.join(' ')),
      organo:      organo.slice(0, 300),
      ponente:     ponente ? ponente.slice(0, 200) : null,
      actor:       null,   // el portal CJF no expone partes públicamente en la búsqueda básica
      autoridad:   null,
      fechaPresent: fechas.length > 0 ? normalizarFecha(fechas[0]) : null,
      fechaAcuerdo: fechas.length > 1 ? normalizarFecha(fechas[1]) : (fechas[0] ? normalizarFecha(fechas[0]) : null),
      descripcion:  descLong.join(' | ').slice(0, 800) || null,
      estado:       estado ? estado.slice(0, 100) : null,
      urlFuente,
    })
  }

  // Si no se pudo parsear tabla pero el número SÍ está en la página
  if (resultados.length === 0) {
    resultados.push({
      numAmparo:   numNorm,
      tipoAsunto:  inferirTipo(textoLimpio),
      organo:      extraerOrgano(textoLimpio) || 'Tercer Circuito Jalisco (CJF)',
      ponente:     null,
      actor:       null,
      autoridad:   null,
      fechaPresent: null,
      fechaAcuerdo: extraerFecha(textoLimpio),
      descripcion:  'Expediente localizado en portal DGEJ-CJF. Consulte la fuente oficial para detalles completos.',
      estado:       extraerEstado(textoLimpio),
      urlFuente,
    })
  }

  return resultados
}

function inferirTipo(texto: string): string {
  const t = texto.toLowerCase()
  if (t.includes('directo'))   return 'Amparo Directo'
  if (t.includes('indirecto')) return 'Amparo Indirecto'
  if (t.includes('revisión') || t.includes('revision')) return 'Recurso de Revisión'
  if (t.includes('queja'))     return 'Recurso de Queja'
  return 'Amparo'
}

function extraerOrgano(texto: string): string | null {
  const m = texto.match(/((?:primer|segundo|tercer|cuarto|quinto|primer|juzgado)[^,.\n]{5,80}(?:circuito|jalisco|distrito))/i)
  return m ? m[1].trim() : null
}

function extraerFecha(texto: string): string | null {
  const m = texto.match(/\b(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4})\b/)
  return m ? normalizarFecha(m[1]) : null
}

function extraerEstado(texto: string): string | null {
  const m = texto.match(/\b(en tr[áa]mite|conclu[íi]do|sobreseí[íi]do|enviado|pendiente)\b/i)
  return m ? m[1] : null
}

// ─── CONSULTA AL PORTAL CJF ──────────────────────────────────────────────────

async function consultarPortalCJF(numAmparo: string, cveOrgano?: string): Promise<AmparoRaw[]> {
  const params = new URLSearchParams({
    Cir: CIRCUITO,
    Exp: numAmparo,
    ...(cveOrgano ? { Org: cveOrgano } : {}),
  })

  const url = `${CJF_BASE}?${params}`

  // Intento 1: GET directo con el número en la URL
  const res = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      'Accept': 'text/html,application/xhtml+xml',
      'Accept-Language': 'es-MX,es;q=0.9',
      'Referer': CJF_BASE,
    },
    signal: AbortSignal.timeout(25_000),
  })

  if (!res.ok) {
    throw new Error(`Portal CJF respondió ${res.status} para ${url}`)
  }

  const html = await res.text()

  // Si hay formulario, intentar POST
  if (html.includes('<form') && !html.toLowerCase().includes(numAmparo.toLowerCase())) {
    const formAction = html.match(/action="([^"]+)"/i)?.[1] || CJF_BASE
    const actionUrl  = formAction.startsWith('http') ? formAction : `https://www.dgej.cjf.gob.mx${formAction}`

    const body = new URLSearchParams({
      Cir: CIRCUITO,
      Exp: numAmparo,
      ...(cveOrgano ? { Org: cveOrgano } : {}),
    })

    const resPost = await fetch(actionUrl, {
      method: 'POST',
      headers: {
        'User-Agent': USER_AGENT,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Referer': url,
        'Accept': 'text/html',
      },
      body: body.toString(),
      signal: AbortSignal.timeout(25_000),
    })

    if (resPost.ok) {
      const htmlPost = await resPost.text()
      const parsed = parsearHtmlCJF(htmlPost, numAmparo)
      if (parsed.length > 0) return parsed
    }
  }

  return parsearHtmlCJF(html, numAmparo)
}

// ─── GUARDAR EN SUPABASE ──────────────────────────────────────────────────────

async function guardarAmparos(
  supabase: ReturnType<typeof createClient>,
  amparos: AmparoRaw[],
  { expedienteId, despachoId, userId }: { expedienteId?: string; despachoId?: string; userId: string }
) {
  const filas = amparos.map(a => ({
    expediente_id:         expedienteId || null,
    despacho_id:           despachoId   || null,
    user_id:               userId,
    num_amparo:            a.numAmparo,
    tipo_asunto:           a.tipoAsunto,
    organo:                a.organo,
    circuito:              CIRCUITO,
    ponente:               a.ponente,
    actor:                 a.actor,
    autoridad_responsable: a.autoridad,
    fecha_presentacion:    a.fechaPresent,
    fecha_acuerdo:         a.fechaAcuerdo,
    descripcion_acuerdo:   a.descripcion,
    estado_asunto:         a.estado,
    url_fuente:            a.urlFuente,
    fuente:                FUENTE,
    auto_detectado:        true,
    actualizado_en:        new Date().toISOString(),
  }))

  const { data, error } = await supabase
    .from('amparos_federales')
    .upsert(filas, { onConflict: 'num_amparo,organo,circuito' })
    .select()

  if (error) throw new Error(`Error guardando en BD: ${error.message}`)
  return data || []
}

// ─── HANDLER PRINCIPAL ───────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  try {
    const {
      num_amparo,
      cve_organo,
      expediente_id,
      despacho_id,
    } = await req.json()

    if (!num_amparo?.trim()) {
      return new Response(
        JSON.stringify({ error: 'Se requiere num_amparo' }),
        { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } }
      )
    }

    const numNorm = normalizarNum(num_amparo)

    // Cliente Supabase con el JWT del usuario (respeta RLS)
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )

    // Obtener user_id del JWT
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'No autenticado' }),
        { status: 401, headers: { ...cors, 'Content-Type': 'application/json' } }
      )
    }

    // Consultar el portal CJF
    let amparosRaw: AmparoRaw[] = []
    let errorPortal: string | null = null

    try {
      amparosRaw = await consultarPortalCJF(numNorm, cve_organo)
    } catch (e) {
      errorPortal = (e as Error).message
    }

    // Si no se encontró nada en el portal, devolver error claro
    if (amparosRaw.length === 0 && !errorPortal) {
      return new Response(
        JSON.stringify({
          encontrado: false,
          mensaje: `El número ${numNorm} no fue localizado en el portal DGEJ-CJF Tercer Circuito. Verifica el número e intenta de nuevo.`,
          url_consultada: construirUrlFuente(numNorm),
        }),
        { headers: { ...cors, 'Content-Type': 'application/json' } }
      )
    }

    if (errorPortal) {
      return new Response(
        JSON.stringify({
          error: `Error al consultar el portal CJF: ${errorPortal}`,
          url_consultada: construirUrlFuente(numNorm),
          sugerencia: 'Verifica manualmente en el portal oficial.',
        }),
        { status: 502, headers: { ...cors, 'Content-Type': 'application/json' } }
      )
    }

    // Guardar resultados en BD
    const guardados = await guardarAmparos(supabase, amparosRaw, {
      expedienteId: expediente_id,
      despachoId:   despacho_id,
      userId:       user.id,
    })

    return new Response(
      JSON.stringify({
        encontrado:  true,
        total:       guardados.length,
        amparos:     guardados,
        url_fuente:  construirUrlFuente(numNorm),
        fuente:      FUENTE,
      }),
      { headers: { ...cors, 'Content-Type': 'application/json' } }
    )

  } catch (e) {
    return new Response(
      JSON.stringify({ error: (e as Error).message }),
      { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } }
    )
  }
})
