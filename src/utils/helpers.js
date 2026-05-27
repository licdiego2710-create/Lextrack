// Calcula los días desde hoy hasta una fecha YYYY-MM-DD.
// Devuelve null si no hay fecha. Negativo si ya pasó.
export const diasHasta = (fechaIso) => {
  if (!fechaIso) return null
  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)
  const target = new Date(fechaIso + 'T00:00:00')
  return Math.round((target - hoy) / 86400000)
}

// Convierte YYYY-MM-DD a DD/MM/YYYY (formato mexicano).
export const fmtFecha = (fechaIso) => {
  if (!fechaIso) return '—'
  const limpia = String(fechaIso).slice(0, 10)
  const [y, m, d] = limpia.split('-')
  if (!y || !m || !d) return fechaIso
  return `${d}/${m}/${y}`
}

// Convierte YYYY-MM-DD a fecha larga en español.
export const fmtFechaLarga = (fechaIso) => {
  if (!fechaIso) return '—'
  try {
    return new Date(fechaIso + 'T00:00:00').toLocaleDateString('es-MX', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    })
  } catch { return fechaIso }
}

// Devuelve { bg, color, label } según los días restantes.
export const urgencyColor = (diasRestantes) => {
  if (diasRestantes === null || diasRestantes === undefined) {
    return { bg: 'var(--muted-bg)', color: 'var(--muted-text)', label: 'Sin fecha' }
  }
  if (diasRestantes < 0) return { bg: 'var(--danger-bg)', color: 'var(--danger-text)', label: `Vencido (${Math.abs(diasRestantes)}d)` }
  if (diasRestantes === 0) return { bg: 'var(--warning-bg)', color: 'var(--warning-text)', label: 'Hoy' }
  if (diasRestantes <= 3) return { bg: 'var(--warning-bg)', color: 'var(--warning-text)', label: `${diasRestantes}d` }
  if (diasRestantes <= 7) return { bg: 'var(--info-bg)', color: 'var(--info-text)', label: `${diasRestantes}d` }
  return { bg: 'var(--success-bg)', color: 'var(--success-text)', label: `${diasRestantes}d` }
}

// Devuelve { bg, color } para el estado de un expediente o demanda.
export const estadoColor = (estado) => {
  const v = (estado || '').toLowerCase()
  if (['activo', 'admitida', 'nueva', 'en proceso'].includes(v)) {
    return { bg: 'var(--success-bg)', color: 'var(--success-text)' }
  }
  if (['vencido', 'desechada', 'rechazada', 'cancelada'].includes(v)) {
    return { bg: 'var(--danger-bg)', color: 'var(--danger-text)' }
  }
  if (['pendiente', 'prevención', 'prevenida', 'urgente'].includes(v)) {
    return { bg: 'var(--warning-bg)', color: 'var(--warning-text)' }
  }
  if (['suspendido', 'archivado'].includes(v)) {
    return { bg: 'var(--muted-bg)', color: 'var(--muted-text)' }
  }
  if (['concluido', 'completada', 'cumplida', 'cumplimiento'].includes(v)) {
    return { bg: 'var(--info-bg)', color: 'var(--info-text)' }
  }
  return { bg: 'var(--muted-bg)', color: 'var(--muted-text)' }
}

// Reduce un texto a las iniciales (máx 2 caracteres).
export const iniciales = (nombre) => {
  if (!nombre) return '—'
  const parts = String(nombre).trim().split(/\s+/)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

// Capitaliza la primera letra.
export const capitalize = (s) => s ? s.charAt(0).toUpperCase() + s.slice(1) : ''

// Constantes del dominio jurídico mexicano.
export const ETAPAS = [
  'Captura inicial',
  'Demanda presentada',
  'Radicación',
  'Emplazamiento pendiente',
  'Emplazado',
  'Contestación pendiente',
  'Audiencia',
  'Pruebas',
  'Alegatos',
  'Sentencia',
  'Ejecución de sentencia',
  'Embargo',
  'Avalúo',
  'Remate',
  'Adjudicación',
  'Archivo',
  'Suspendido',
  'Concluido'
]

export const JUZGADOS_JALISCO = [
  { grupo: 'Civiles',     items: ['Primero Civil','Segundo Civil','Tercero Civil','Cuarto Civil','Quinto Civil','Sexto Civil','Séptimo Civil','Octavo Civil','Noveno Civil','Décimo Civil','Décimo Primero Civil','Décimo Segundo Civil','Décimo Tercero Civil'] },
  { grupo: 'Mercantiles', items: ['Primero Mercantil','Segundo Mercantil','Tercero Mercantil','Cuarto Mercantil','Quinto Mercantil','Sexto Mercantil','Séptimo Mercantil','Octavo Mercantil','Noveno Mercantil','Décimo Mercantil','Décimo Primero Mercantil','Décimo Segundo Mercantil','Primero Oral Mercantil','Segundo Oral Mercantil','Tercero Oral Mercantil'] },
  { grupo: 'Familiares',  items: ['Primero Familiar','Segundo Familiar','Tercero Familiar','Cuarto Familiar','Quinto Familiar','Sexto Familiar','Séptimo Familiar','Octavo Familiar','Noveno Familiar','Décimo Familiar','Décimo Primero Familiar','Décimo Segundo Familiar','Décimo Tercero Familiar','Décimo Cuarto Familiar','Especializado NNA'] },
  { grupo: 'Penales',     items: ['Primero Penal','Segundo Penal','Tercero Penal','Cuarto Penal','Quinto Penal','Sexto Penal','Séptimo Penal','Octavo Penal','Noveno Penal','Décimo Penal','Décimo Primero Penal','Décimo Segundo Penal','Décimo Tercero Penal','Décimo Cuarto Penal','Décimo Quinto Penal','Décimo Sexto Penal'] },
  { grupo: 'STJ — Supremo Tribunal', items: ['Primera Sala STJ','Segunda Sala STJ','Tercera Sala STJ','Cuarta Sala STJ','Quinta Sala STJ','Sexta Sala STJ','Séptima Sala STJ','Octava Sala STJ','Novena Sala STJ','Décima Sala STJ','Décima Primera Sala Penal STJ','Sala Auxiliar Mixta Civil'] },
  { grupo: 'Administrativo', items: ['Primera Sala Unitaria Administrativa','Segunda Sala Unitaria Administrativa','Tercera Sala Unitaria Administrativa','Primera Sala Colegiada Administrativa','Segunda Sala Colegiada Administrativa','Pleno Tribunal Administrativo'] },
  { grupo: 'Adolescentes', items: ['Primero para Adolescentes','Segundo para Adolescentes'] },
  { grupo: 'Ejecución de Penas', items: ['Primero de Ejecución de Penas','Segundo de Ejecución de Penas','Tercero de Ejecución de Penas','Cuarto de Ejecución de Penas'] },
  { grupo: 'Foráneos', items: ['Ahualulco de Mercado','Ameca','Arandas','Autlán de Navarro','Casimiro Castillo','Cihuatlán','Ciudad Guzmán','Colotlán','Encarnación de Díaz','La Barca','Lagos de Moreno','Ocotlán','Puerto Vallarta','San Juan de los Lagos','Sayula','Tamazula de Gordiano','Tequila','Tepatitlán de Morelos','Tlajomulco de Zúñiga','Tonalá','Zapotlán el Grande'] },
]

// Mapa de nombres de juzgado → código CVE_JUZ de la API del CJJ Jalisco.
// Confirmado: M09 = "Noveno Mercantil" via api.cjj.gob.mx/bulletin/zmg_expedient
// Patrón: [PREFIJO][2 dígitos]
export const CJJ_CODES = {
  // CIVILES  (prefijo C)
  'Primero Civil': 'C01', 'Segundo Civil': 'C02', 'Tercero Civil': 'C03',
  'Cuarto Civil': 'C04', 'Quinto Civil': 'C05', 'Sexto Civil': 'C06',
  'Séptimo Civil': 'C07', 'Octavo Civil': 'C08', 'Noveno Civil': 'C09',
  'Décimo Civil': 'C10', 'Décimo Primero Civil': 'C11', 'Décimo Segundo Civil': 'C12',
  'Décimo Tercero Civil': 'C13',
  // MERCANTILES  (prefijo M) — M09 confirmado
  'Primero Mercantil': 'M01', 'Segundo Mercantil': 'M02', 'Tercero Mercantil': 'M03',
  'Cuarto Mercantil': 'M04', 'Quinto Mercantil': 'M05', 'Sexto Mercantil': 'M06',
  'Séptimo Mercantil': 'M07', 'Octavo Mercantil': 'M08', 'Noveno Mercantil': 'M09',
  'Décimo Mercantil': 'M10', 'Décimo Primero Mercantil': 'M11', 'Décimo Segundo Mercantil': 'M12',
  'Primero Oral Mercantil': 'OM1', 'Segundo Oral Mercantil': 'OM2', 'Tercero Oral Mercantil': 'OM3',
  // FAMILIARES  (prefijo FA)
  'Primero Familiar': 'FA1', 'Segundo Familiar': 'FA2', 'Tercero Familiar': 'FA3',
  'Cuarto Familiar': 'FA4', 'Quinto Familiar': 'FA5', 'Sexto Familiar': 'FA6',
  'Séptimo Familiar': 'FA7', 'Octavo Familiar': 'FA8', 'Noveno Familiar': 'FA9',
  'Décimo Familiar': 'FA10', 'Décimo Primero Familiar': 'FA11', 'Décimo Segundo Familiar': 'FA12',
  'Décimo Tercero Familiar': 'FA13', 'Décimo Cuarto Familiar': 'FA14',
  'Especializado NNA': 'NNA',
  // PENALES  (prefijo P)
  'Primero Penal': 'P01', 'Segundo Penal': 'P02', 'Tercero Penal': 'P03',
  'Cuarto Penal': 'P04', 'Quinto Penal': 'P05', 'Sexto Penal': 'P06',
  'Séptimo Penal': 'P07', 'Octavo Penal': 'P08', 'Noveno Penal': 'P09',
  'Décimo Penal': 'P10', 'Décimo Primero Penal': 'P11', 'Décimo Segundo Penal': 'P12',
  'Décimo Tercero Penal': 'P13', 'Décimo Cuarto Penal': 'P14',
  'Décimo Quinto Penal': 'P15', 'Décimo Sexto Penal': 'P16',
  // STJ — SUPREMO TRIBUNAL  (prefijo S)
  'Primera Sala STJ': 'S01', 'Segunda Sala STJ': 'S02', 'Tercera Sala STJ': 'S03',
  'Cuarta Sala STJ': 'S04', 'Quinta Sala STJ': 'S05', 'Sexta Sala STJ': 'S06',
  'Séptima Sala STJ': 'S07', 'Octava Sala STJ': 'S08', 'Novena Sala STJ': 'S09',
  'Décima Sala STJ': 'S10', 'Décima Primera Sala Penal STJ': 'SP1', 'Sala Auxiliar Mixta Civil': 'SAM',
  // ADMINISTRATIVO
  'Primera Sala Unitaria Administrativa': 'UA1', 'Segunda Sala Unitaria Administrativa': 'UA2',
  'Tercera Sala Unitaria Administrativa': 'UA3',
  'Primera Sala Colegiada Administrativa': 'CA1', 'Segunda Sala Colegiada Administrativa': 'CA2',
  'Pleno Tribunal Administrativo': 'PTA',
  // ADOLESCENTES
  'Primero para Adolescentes': 'AD1', 'Segundo para Adolescentes': 'AD2',
  // EJECUCIÓN DE PENAS
  'Primero de Ejecución de Penas': 'EP1', 'Segundo de Ejecución de Penas': 'EP2',
  'Tercero de Ejecución de Penas': 'EP3', 'Cuarto de Ejecución de Penas': 'EP4',
}

// Obtiene el CVE_JUZ de la API del CJJ para un nombre de juzgado.
// Devuelve null si el juzgado no está en el mapa (ej. foráneos, otro).
export const getCjjCode = (juzgado) => CJJ_CODES[juzgado] || null

// Consulta la API pública del CJJ Jalisco y devuelve todos los acuerdos del expediente.
// Requiere: expedient = "1234/2024", cveJuz = "M09"
// Devuelve: array de { fecha, fechaPromo, descripcion, tipo } o lanza error.
export const consultarBoletinCJJ = async (expedient, cveJuz) => {
  if (!expedient || !cveJuz) throw new Error('Número de expediente y código de juzgado requeridos')
  const url = `https://api.cjj.gob.mx/bulletin/zmg_expedient?judged=${encodeURIComponent(cveJuz)}&expedient=${encodeURIComponent(expedient)}&url=bulletin/zmg_expedient`
  const res = await fetch(url, { headers: { Accept: 'application/json' } })
  if (!res.ok) throw new Error(`Error CJJ: ${res.status}`)
  const json = await res.json()
  if (!json.success || !Array.isArray(json.data)) return []
  return json.data.map(d => ({
    fecha: d.FCH_ACU ? d.FCH_ACU.slice(0, 10) : null,
    fechaPromo: d.FCH_PRO ? d.FCH_PRO.slice(0, 10) : null,
    descripcion: d.BOLETIN || '',
    tipo: d.TIPO || '',
    notificacion: d.NOTIFICACI || '',
    raw: d,
  }))
}
// ─── CONSULTA AMPARO FEDERAL (DGEJ-CJF TERCER CIRCUITO) ─────────────────────
// Fuente oficial: https://www.dgej.cjf.gob.mx/internet/expedientes/circuitos.asp
// Utiliza un proxy CORS o se ejecuta server-side (scripts/providers/).
// En el cliente, construye la URL de la fuente oficial para mostrar al usuario.

export const CJF_CIRCUITO_3_URL = 'https://www.dgej.cjf.gob.mx/internet/expedientes/circuitos.asp?Cir=3'

/**
 * Construye la URL oficial del DGEJ-CJF para un expediente de amparo.
 * La URL se usa como referencia y enlace al usuario; la consulta real
 * la hace el scraper server-side.
 */
export const urlAmparoFederalCJF = (numAmparo) => {
  const params = new URLSearchParams({ Cir: '3', Exp: numAmparo || '' })
  return `https://www.dgej.cjf.gob.mx/internet/expedientes/circuitos.asp?${params}`
}

/**
 * Consulta amparos federales guardados en la BD para un expediente dado.
 * (Los datos los carga el scraper; aquí solo leemos lo persistido.)
 * Se llama desde Expedientes.jsx cuando el usuario activa la pestaña "Amparo Federal".
 *
 * @param {object} supabase - Cliente Supabase
 * @param {string} expId    - UUID del expediente interno (expediente_id)
 * @param {string} orgId    - UUID del despacho (para RLS)
 */
export const consultarAmparosFederalesGuardados = async (supabase, expId) => {
  const { data, error } = await supabase
    .from('amparos_federales')
    .select('*')
    .eq('expediente_id', expId)
    .order('fecha_acuerdo', { ascending: false })

  if (error) throw new Error(`Error consultando amparos federales: ${error.message}`)
  return data || []
}

/**
 * Guarda un amparo federal vinculado a un expediente interno.
 * Normaliza antes de insertar. Nunca duplica (UNIQUE por num_amparo + organo + circuito).
 */
export const guardarAmparo = async (supabase, amparo, { expedienteId, despachoId, userId }) => {
  const payload = {
    expediente_id:        expedienteId || null,
    despacho_id:          despachoId   || null,
    user_id:              userId,
    num_amparo:           String(amparo.numAmparo || '').trim().toUpperCase(),
    tipo_asunto:          amparo.tipoAsunto   || null,
    organo:               amparo.organo       || 'Tercer Circuito Jalisco (CJF)',
    circuito:             amparo.circuito     || '3',
    ponente:              amparo.ponente      || null,
    actor:                amparo.actor        || null,
    autoridad_responsable: amparo.autoridad   || null,
    fecha_presentacion:   amparo.fechaPresent || null,
    fecha_acuerdo:        amparo.fechaAcuerdo || null,
    descripcion_acuerdo:  amparo.descripcion  || null,
    estado_asunto:        amparo.estado       || null,
    url_fuente:           amparo.urlFuente    || urlAmparoFederalCJF(amparo.numAmparo),
    fuente:               'DGEJ-CJF',
  }

  const { data, error } = await supabase
    .from('amparos_federales')
    .upsert(payload, { onConflict: 'num_amparo,organo,circuito' })
    .select()
    .single()

  if (error) throw new Error(`Error guardando amparo: ${error.message}`)
  return data
}

/**
 * Carga el historial de acuerdos de un amparo federal específico.
 * Tabla: acuerdos_amparo_federal
 */
export const cargarAcuerdosAmparo = async (supabase, amparoId) => {
  const { data, error } = await supabase
    .from('acuerdos_amparo_federal')
    .select('*')
    .eq('amparo_id', amparoId)
    .order('fecha', { ascending: false })

  if (error) throw new Error(`Error cargando acuerdos del amparo: ${error.message}`)
  return data || []
}

/**
 * Marca como leídos todos los acuerdos no leídos de un amparo.
 */
export const marcarAcuerdosAmparoLeidos = async (supabase, amparoId) => {
  const { error } = await supabase
    .from('acuerdos_amparo_federal')
    .update({ leido: true })
    .eq('amparo_id', amparoId)
    .eq('leido', false)

  if (error) throw new Error(`Error marcando acuerdos como leídos: ${error.message}`)
}

/**
 * Órganos del Tercer Circuito para el selector del formulario.
 * Espejo del catálogo en federalAmparoJaliscoProvider.js (para uso en el cliente).
 */
export const ORGANOS_CJF_TERCER_CIRCUITO = [
  { grupo: 'Tribunales Colegiados', items: [
    'Primer Tribunal Colegiado en Materia Civil del Tercer Circuito',
    'Segundo Tribunal Colegiado en Materia Civil del Tercer Circuito',
    'Primer Tribunal Colegiado en Materia de Trabajo del Tercer Circuito',
    'Segundo Tribunal Colegiado en Materia de Trabajo del Tercer Circuito',
    'Tercer Tribunal Colegiado en Materia de Trabajo del Tercer Circuito',
    'Primer Tribunal Colegiado en Materia Penal del Tercer Circuito',
    'Segundo Tribunal Colegiado en Materia Penal del Tercer Circuito',
    'Tercer Tribunal Colegiado en Materia Penal del Tercer Circuito',
    'Cuarto Tribunal Colegiado en Materia Penal del Tercer Circuito',
    'Primer Tribunal Colegiado en Materia Administrativa del Tercer Circuito',
    'Segundo Tribunal Colegiado en Materia Administrativa del Tercer Circuito',
    'Tercer Tribunal Colegiado en Materia Administrativa del Tercer Circuito',
    'Cuarto Tribunal Colegiado en Materia Administrativa del Tercer Circuito',
    'Primer Tribunal Colegiado en Materias Civil y de Trabajo del Tercer Circuito',
    'Segundo Tribunal Colegiado en Materias Civil y de Trabajo del Tercer Circuito',
  ]},
  { grupo: 'Tribunales Unitarios', items: [
    'Primer Tribunal Unitario del Tercer Circuito',
    'Segundo Tribunal Unitario del Tercer Circuito',
    'Tercer Tribunal Unitario del Tercer Circuito',
  ]},
  { grupo: 'Juzgados de Distrito', items: [
    'Juzgado Primero de Distrito en Materia Civil en el Estado de Jalisco',
    'Juzgado Segundo de Distrito en Materia Civil en el Estado de Jalisco',
    'Juzgado Tercero de Distrito en Materia Civil en el Estado de Jalisco',
    'Juzgado Primero de Distrito en Materia Penal en el Estado de Jalisco',
    'Juzgado Segundo de Distrito en Materia Penal en el Estado de Jalisco',
    'Juzgado Tercero de Distrito en Materia Penal en el Estado de Jalisco',
    'Juzgado Cuarto de Distrito en Materia Penal en el Estado de Jalisco',
    'Juzgado Quinto de Distrito en Materia Penal en el Estado de Jalisco',
    'Juzgado Primero de Distrito en Materia Administrativa en el Estado de Jalisco',
    'Juzgado Segundo de Distrito en Materia Administrativa en el Estado de Jalisco',
    'Juzgado Tercero de Distrito en Materia Administrativa en el Estado de Jalisco',
    'Juzgado de Distrito en Materias de Amparo y Juicios Federales en el Estado de Jalisco',
    'Juzgado Primero de Distrito en Materia de Trabajo en el Estado de Jalisco',
    'Juzgado Segundo de Distrito en Materia de Trabajo en el Estado de Jalisco',
    'Juzgado de Distrito en el Estado de Jalisco, con Residencia en Puerto Vallarta',
    'Juzgado de Distrito en el Estado de Jalisco, con Residencia en Ciudad Guzmán',
  ]},
]

export const MATERIAS = ['Mercantil', 'Civil', 'Laboral', 'Administrativo', 'Familiar']
export const ESTADOS = ['Activo', 'Vencido', 'Suspendido', 'Concluido']
export const PRIORIDADES = ['Normal', 'Alta', 'Urgente']
export const TIPOS_PROMO = ['Demanda', 'Contestación de demanda', 'Ofrecimiento de pruebas', 'Desahogo de pruebas', 'Alegatos', 'Recurso de revocación', 'Recurso de apelación', 'Amparo directo', 'Amparo indirecto', 'Incidente', 'Tercería', 'Aclaración de sentencia', 'Escrito libre', 'Otro']
// Infiere la materia jurídica a partir del nombre del juzgado seleccionado.
// Devuelve null si no puede determinarse (ej. "Otro / Foráneo").
export const materiaDesdJuzgado = (juzgado) => {
  if (!juzgado || juzgado === '__otro__') return null
  const j = juzgado.toLowerCase()
  if (j.includes('civil') && !j.includes('mercantil')) return 'Civil'
  if (j.includes('mercantil')) return 'Mercantil'
  if (j.includes('familiar') || j.includes('nna')) return 'Familiar'
  if (j.includes('penal') || j.includes('adolescente') || j.includes('ejecución de penas')) return 'Penal'
  if (j.includes('administrativ')) return 'Administrativo'
  // STJ — inferir por sala
  if (j.includes('stj') && j.includes('penal')) return 'Penal'
  if (j.includes('stj') || j.includes('sala')) return 'Civil'
  return null
}

export const TIPOS = [
  'Juicio Ordinario Mercantil', 'Juicio Ejecutivo Mercantil', 'Juicio Oral Mercantil', 'Juicio de Fianza', 'Providencia Precautoria',
  'Juicio Ordinario Civil', 'Juicio Ejecutivo Civil', 'Juicio Sumario Civil', 'Juicio Hipotecario', 'Juicio de Arrendamiento Inmobiliario',
  'Juicio de Usucapión', 'Juicio Sucesorio Testamentario', 'Juicio Sucesorio Intestamentario', 'Juicio de Nulidad', 'Juicio de Responsabilidad Civil',
  'Jurisdicción Voluntaria Civil',
  'Juicio de Divorcio Incausado', 'Juicio de Divorcio Necesario', 'Juicio de Alimentos', 'Juicio de Guarda y Custodia',
  'Juicio de Patria Potestad', 'Juicio de Reconocimiento de Paternidad', 'Juicio de Adopción', 'Juicio de Interdicción',
  'Juicio de Rectificación de Acta del Estado Civil', 'Jurisdicción Voluntaria Familiar',
  'Juicio Ordinario Laboral', 'Juicio Especial Laboral',
  'Juicio Contencioso Administrativo', 'Recurso de Revocación Administrativo',
  'Amparo Directo', 'Amparo Indirecto', 'Recurso de Apelación', 'Recurso de Revocación',
  'Tercería', 'Incidente', 'Reconvención', 'Diligencias Preliminares', 'Otro',
]

export function exportarCSV(data, headers, keys, filename = 'exportacion') {
  const esc = (v) => {
    if (v === null || v === undefined) return ''
    const s = String(v).replace(/"/g, '""')
    return s.includes(',') || s.includes('\n') || s.includes('"') ? `"${s}"` : s
  }
  const bom = '\uFEFF'
  const csv = bom + [
    headers.map(esc).join(','),
    ...data.map(row => keys.map(k => esc(row[k])).join(','))
  ].join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${filename}.csv`
  a.click()
  URL.revokeObjectURL(url)
}
