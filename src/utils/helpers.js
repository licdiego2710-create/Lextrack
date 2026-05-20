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
export const ETAPAS = ['Admisión', 'Emplazamiento', 'Etapa Probatoria', 'Alegatos', 'Sentencia', 'Ejecución / Embargo', 'Recursos', 'Archivo']

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
export const MATERIAS = ['Mercantil', 'Civil', 'Laboral', 'Administrativo', 'Familiar']
export const ESTADOS = ['Activo', 'Vencido', 'Suspendido', 'Concluido']
export const PRIORIDADES = ['Normal', 'Alta', 'Urgente']
export const TIPOS_PROMO = ['Demanda', 'Contestación de demanda', 'Ofrecimiento de pruebas', 'Desahogo de pruebas', 'Alegatos', 'Recurso de revocación', 'Recurso de apelación', 'Amparo directo', 'Amparo indirecto', 'Incidente', 'Tercería', 'Aclaración de sentencia', 'Escrito libre', 'Otro']
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
