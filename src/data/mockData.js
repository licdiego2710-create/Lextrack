// Datos mock para módulos sin backend conectado todavía.
// Juzgados reales de Jalisco, partes ficticias y profesionales.

const JUZGADOS_JALISCO = [
  'Juzgado 1° de lo Mercantil del Primer Partido Judicial - Guadalajara',
  'Juzgado 5° de lo Mercantil del Primer Partido Judicial - Guadalajara',
  'Juzgado 9° de lo Mercantil del Primer Partido Judicial - Guadalajara',
  'Juzgado 3° de lo Civil del Primer Partido Judicial - Guadalajara',
  'Juzgado 7° de lo Civil del Primer Partido Judicial - Guadalajara',
  'Juzgado 2° de lo Familiar del Primer Partido Judicial - Guadalajara',
  'Juzgado 4° de lo Familiar del Primer Partido Judicial - Guadalajara',
  'Juzgado de Distrito en Materia Administrativa - Zapopan',
  'Tribunal de Justicia Administrativa del Estado de Jalisco',
  'Junta Local de Conciliación y Arbitraje - Guadalajara',
  'Tribunal Laboral Federal de Asuntos Individuales - Zapopan',
  'Juzgado 8° de lo Mercantil - Zapopan',
]

const PERSONAS = [
  'Javier Ruiz Hernández', 'María Fernanda Castillo López', 'Roberto Carlos Aguilar',
  'Lic. Patricia Mendoza Vázquez', 'Construcciones Pacífico S.A. de C.V.',
  'Grupo Inmobiliario Tequila S.A.P.I.', 'Banco Mercantil del Noroeste S.A.',
  'Eduardo Iván Castañeda', 'Cementos Jalisco S.A. de C.V.', 'Aseguradora Atlas S.A.',
  'Distribuidora Comercial de Occidente S.A.', 'Laura Beatriz Romero Salinas',
  'Industrias Metalmecánicas del Bajío', 'Jorge Antonio Padilla Núñez',
  'Servicios Logísticos Tapatíos S.A.', 'Hortencia Guzmán Velázquez',
  'Tecnología Industrial Mexicana S.A.', 'Adriana Sofía Rojas Méndez',
  'Inversiones Hospitalarias del Occidente', 'Promotora Inmobiliaria Solares Verdes',
]

const ABOGADOS = [
  'Lic. Diego Salinas Rivera', 'Lic. María Elena Torres', 'Lic. Carlos Ramírez Núñez',
  'Lic. Fernanda Ochoa', 'Lic. Roberto Macías Aguilar',
]

const TIPOS_JUICIO = [
  'Juicio Ordinario Mercantil', 'Juicio Ejecutivo Mercantil', 'Juicio Oral Mercantil',
  'Juicio Ordinario Civil', 'Juicio Hipotecario', 'Juicio de Divorcio Incausado',
  'Amparo Indirecto', 'Juicio Contencioso Administrativo', 'Juicio Ordinario Laboral',
]

const fechaIso = (offsetDias = 0) => {
  const d = new Date()
  d.setDate(d.getDate() + offsetDias)
  return d.toISOString().slice(0, 10)
}

// 15 demandas con flujo real: recepción → prevención → cumplimiento → admisión/desechamiento
export const mockDemandas = [
  { id: 1, fechaRecepcion: fechaIso(-45), promovente: 'Construcciones Pacífico S.A. de C.V.', demandado: 'Inversiones Hospitalarias del Occidente', tipoJuicio: 'Juicio Ordinario Mercantil', estado: 'Admitida', fechaPrevencion: null, fechaCumplimiento: null, observaciones: 'Admitida sin prevención. Se ordenó emplazamiento.', usuarioCaptura: 'Lic. Diego Salinas Rivera' },
  { id: 2, fechaRecepcion: fechaIso(-32), promovente: 'Javier Ruiz Hernández', demandado: 'Distribuidora Comercial de Occidente S.A.', tipoJuicio: 'Juicio Ejecutivo Mercantil', estado: 'Prevención', fechaPrevencion: fechaIso(-25), fechaCumplimiento: null, observaciones: 'Prevenida para exhibir título ejecutivo original.', usuarioCaptura: 'Lic. María Elena Torres' },
  { id: 3, fechaRecepcion: fechaIso(-28), promovente: 'Banco Mercantil del Noroeste S.A.', demandado: 'Roberto Carlos Aguilar', tipoJuicio: 'Juicio Hipotecario', estado: 'Cumplimiento', fechaPrevencion: fechaIso(-22), fechaCumplimiento: fechaIso(-10), observaciones: 'Cumplimentada la prevención. Pendiente acuerdo de admisión.', usuarioCaptura: 'Lic. Diego Salinas Rivera' },
  { id: 4, fechaRecepcion: fechaIso(-21), promovente: 'María Fernanda Castillo López', demandado: 'Eduardo Iván Castañeda', tipoJuicio: 'Juicio de Divorcio Incausado', estado: 'Admitida', fechaPrevencion: null, fechaCumplimiento: null, observaciones: 'Acuerdo de admisión y medidas provisionales.', usuarioCaptura: 'Lic. Fernanda Ochoa' },
  { id: 5, fechaRecepcion: fechaIso(-18), promovente: 'Cementos Jalisco S.A. de C.V.', demandado: 'Industrias Metalmecánicas del Bajío', tipoJuicio: 'Juicio Oral Mercantil', estado: 'Nueva', fechaPrevencion: null, fechaCumplimiento: null, observaciones: 'En espera de acuerdo de radicación.', usuarioCaptura: 'Lic. Carlos Ramírez Núñez' },
  { id: 6, fechaRecepcion: fechaIso(-15), promovente: 'Lic. Patricia Mendoza Vázquez', demandado: 'Promotora Inmobiliaria Solares Verdes', tipoJuicio: 'Juicio Ordinario Civil', estado: 'Desechada', fechaPrevencion: fechaIso(-10), fechaCumplimiento: null, observaciones: 'Desechada por no cumplimentarse la prevención en el plazo legal.', usuarioCaptura: 'Lic. Roberto Macías Aguilar' },
  { id: 7, fechaRecepcion: fechaIso(-12), promovente: 'Grupo Inmobiliario Tequila S.A.P.I.', demandado: 'Aseguradora Atlas S.A.', tipoJuicio: 'Amparo Indirecto', estado: 'Admitida', fechaPrevencion: null, fechaCumplimiento: null, observaciones: 'Admitida. Se suspende el acto reclamado para efectos.', usuarioCaptura: 'Lic. Diego Salinas Rivera' },
  { id: 8, fechaRecepcion: fechaIso(-9), promovente: 'Servicios Logísticos Tapatíos S.A.', demandado: 'Tecnología Industrial Mexicana S.A.', tipoJuicio: 'Juicio Ordinario Mercantil', estado: 'Prevención', fechaPrevencion: fechaIso(-3), fechaCumplimiento: null, observaciones: 'Prevenida para acompañar instrumento notarial de poder.', usuarioCaptura: 'Lic. María Elena Torres' },
  { id: 9, fechaRecepcion: fechaIso(-7), promovente: 'Hortencia Guzmán Velázquez', demandado: 'Jorge Antonio Padilla Núñez', tipoJuicio: 'Juicio de Divorcio Incausado', estado: 'Cumplimiento', fechaPrevencion: fechaIso(-5), fechaCumplimiento: fechaIso(-1), observaciones: 'Cumplimentada. Pasa para acuerdo.', usuarioCaptura: 'Lic. Fernanda Ochoa' },
  { id: 10, fechaRecepcion: fechaIso(-6), promovente: 'Laura Beatriz Romero Salinas', demandado: 'Adriana Sofía Rojas Méndez', tipoJuicio: 'Juicio Ordinario Civil', estado: 'Admitida', fechaPrevencion: null, fechaCumplimiento: null, observaciones: 'Admisión y emplazamiento ordenado.', usuarioCaptura: 'Lic. Carlos Ramírez Núñez' },
  { id: 11, fechaRecepcion: fechaIso(-4), promovente: 'Distribuidora Comercial de Occidente S.A.', demandado: 'Construcciones Pacífico S.A. de C.V.', tipoJuicio: 'Juicio Ejecutivo Mercantil', estado: 'Nueva', fechaPrevencion: null, fechaCumplimiento: null, observaciones: 'Recibida por turno. Pendiente revisión inicial.', usuarioCaptura: 'Lic. Diego Salinas Rivera' },
  { id: 12, fechaRecepcion: fechaIso(-3), promovente: 'Roberto Carlos Aguilar', demandado: 'Banco Mercantil del Noroeste S.A.', tipoJuicio: 'Amparo Indirecto', estado: 'Nueva', fechaPrevencion: null, fechaCumplimiento: null, observaciones: 'Demanda de amparo en revisión.', usuarioCaptura: 'Lic. Roberto Macías Aguilar' },
  { id: 13, fechaRecepcion: fechaIso(-2), promovente: 'Inversiones Hospitalarias del Occidente', demandado: 'Cementos Jalisco S.A. de C.V.', tipoJuicio: 'Juicio Ordinario Mercantil', estado: 'Prevención', fechaPrevencion: fechaIso(-1), fechaCumplimiento: null, observaciones: 'Prevenida para precisar prestaciones.', usuarioCaptura: 'Lic. María Elena Torres' },
  { id: 14, fechaRecepcion: fechaIso(-1), promovente: 'Eduardo Iván Castañeda', demandado: 'Industrias Metalmecánicas del Bajío', tipoJuicio: 'Juicio Contencioso Administrativo', estado: 'Nueva', fechaPrevencion: null, fechaCumplimiento: null, observaciones: 'Pendiente acuerdo de admisión.', usuarioCaptura: 'Lic. Fernanda Ochoa' },
  { id: 15, fechaRecepcion: fechaIso(0),  promovente: 'Aseguradora Atlas S.A.', demandado: 'Servicios Logísticos Tapatíos S.A.', tipoJuicio: 'Juicio Oral Mercantil', estado: 'Nueva', fechaPrevencion: null, fechaCumplimiento: null, observaciones: 'Demanda recibida hoy.', usuarioCaptura: 'Lic. Diego Salinas Rivera' },
]

// 20 tareas
export const mockTareas = [
  { id: 1, titulo: 'Presentar escrito de pruebas', expedienteId: '306/2024', responsable: 'Lic. Diego Salinas Rivera', fechaLimite: fechaIso(2), prioridad: 'Alta', estado: 'Pendiente', descripcion: 'Ofrecimiento de pruebas documentales y testimoniales antes del cierre del plazo.' },
  { id: 2, titulo: 'Revisar contestación de demanda', expedienteId: '412/2024', responsable: 'Lic. María Elena Torres', fechaLimite: fechaIso(5), prioridad: 'Normal', estado: 'En proceso', descripcion: 'Analizar excepciones opuestas y preparar réplica.' },
  { id: 3, titulo: 'Acudir a audiencia preliminar', expedienteId: '208/2024', responsable: 'Lic. Carlos Ramírez Núñez', fechaLimite: fechaIso(3), prioridad: 'Urgente', estado: 'Pendiente', descripcion: 'Audiencia de conciliación 10:00 hrs.' },
  { id: 4, titulo: 'Redactar amparo indirecto', expedienteId: '512/2025', responsable: 'Lic. Diego Salinas Rivera', fechaLimite: fechaIso(7), prioridad: 'Alta', estado: 'En proceso', descripcion: 'Contra acto reclamado: orden de embargo.' },
  { id: 5, titulo: 'Notificar sentencia interlocutoria', expedienteId: '118/2024', responsable: 'Lic. Fernanda Ochoa', fechaLimite: fechaIso(-2), prioridad: 'Alta', estado: 'Vencida', descripcion: 'Sentencia incidental sobre nulidad de notificaciones.' },
  { id: 6, titulo: 'Solicitar copias certificadas', expedienteId: '306/2024', responsable: 'Lic. Roberto Macías Aguilar', fechaLimite: fechaIso(1), prioridad: 'Normal', estado: 'Pendiente', descripcion: 'Para integrar autorización de copias.' },
  { id: 7, titulo: 'Promover ejecución de sentencia', expedienteId: '048/2023', responsable: 'Lic. Diego Salinas Rivera', fechaLimite: fechaIso(10), prioridad: 'Normal', estado: 'Pendiente', descripcion: 'Ejecutar sentencia firme con embargo de bienes.' },
  { id: 8, titulo: 'Audiencia desahogo de pruebas', expedienteId: '725/2024', responsable: 'Lic. Carlos Ramírez Núñez', fechaLimite: fechaIso(4), prioridad: 'Alta', estado: 'Pendiente', descripcion: 'Desahogo de testimonial a cargo del actor.' },
  { id: 9, titulo: 'Contestar demanda de divorcio', expedienteId: '901/2024', responsable: 'Lic. Fernanda Ochoa', fechaLimite: fechaIso(9), prioridad: 'Alta', estado: 'En proceso', descripcion: 'Plazo de 9 días para contestación.' },
  { id: 10, titulo: 'Revisar acuerdo de admisión', expedienteId: '512/2025', responsable: 'Lic. María Elena Torres', fechaLimite: fechaIso(0), prioridad: 'Urgente', estado: 'Pendiente', descripcion: 'Verificar términos del acuerdo publicado hoy.' },
  { id: 11, titulo: 'Preparar alegatos', expedienteId: '208/2024', responsable: 'Lic. Diego Salinas Rivera', fechaLimite: fechaIso(6), prioridad: 'Normal', estado: 'Pendiente', descripcion: 'Alegatos finales antes de citación a sentencia.' },
  { id: 12, titulo: 'Recurso de revocación', expedienteId: '118/2024', responsable: 'Lic. Roberto Macías Aguilar', fechaLimite: fechaIso(-1), prioridad: 'Urgente', estado: 'Vencida', descripcion: 'Recurso contra auto admisorio.' },
  { id: 13, titulo: 'Junta de avenencia laboral', expedienteId: 'LAB/077/2024', responsable: 'Lic. Fernanda Ochoa', fechaLimite: fechaIso(8), prioridad: 'Alta', estado: 'Pendiente', descripcion: 'Audiencia de conciliación previa al juicio.' },
  { id: 14, titulo: 'Liquidación de adeudo', expedienteId: '048/2023', responsable: 'Lic. Carlos Ramírez Núñez', fechaLimite: fechaIso(15), prioridad: 'Normal', estado: 'En proceso', descripcion: 'Elaborar planilla de liquidación.' },
  { id: 15, titulo: 'Solicitud de medidas cautelares', expedienteId: '725/2024', responsable: 'Lic. Diego Salinas Rivera', fechaLimite: fechaIso(2), prioridad: 'Alta', estado: 'Pendiente', descripcion: 'Embargo precautorio sobre cuenta bancaria.' },
  { id: 16, titulo: 'Cierre de expediente', expedienteId: '910/2023', responsable: 'Lic. María Elena Torres', fechaLimite: fechaIso(-5), prioridad: 'Normal', estado: 'Completada', descripcion: 'Archivado por convenio celebrado entre las partes.' },
  { id: 17, titulo: 'Renuncia a notificación personal', expedienteId: '412/2024', responsable: 'Lic. Roberto Macías Aguilar', fechaLimite: fechaIso(3), prioridad: 'Normal', estado: 'Pendiente', descripcion: 'Notificación por estrados.' },
  { id: 18, titulo: 'Audiencia constitucional', expedienteId: '512/2025', responsable: 'Lic. Fernanda Ochoa', fechaLimite: fechaIso(12), prioridad: 'Alta', estado: 'Pendiente', descripcion: 'Amparo indirecto, juzgado de Distrito.' },
  { id: 19, titulo: 'Notificar acuerdo a contraparte', expedienteId: '901/2024', responsable: 'Lic. Carlos Ramírez Núñez', fechaLimite: fechaIso(1), prioridad: 'Normal', estado: 'En proceso', descripcion: 'Acuerdo de admisión a la contraparte.' },
  { id: 20, titulo: 'Revisar laudo definitivo', expedienteId: 'LAB/077/2024', responsable: 'Lic. Diego Salinas Rivera', fechaLimite: fechaIso(20), prioridad: 'Alta', estado: 'Pendiente', descripcion: 'Análisis y proyección de amparo directo.' },
]

// 30 entradas de bitácora
export const mockBitacora = [
  { id: 1, usuario: 'Lic. Diego Salinas Rivera', accion: 'Creó expediente', entidad: 'Expediente 306/2024', fecha: fechaIso(0), detalle: 'Alta de expediente Mercantil ordinario.' },
  { id: 2, usuario: 'Lic. María Elena Torres', accion: 'Subió documento', entidad: 'Expediente 412/2024', fecha: fechaIso(0), detalle: 'Demanda inicial.pdf · 1.2 MB' },
  { id: 3, usuario: 'Lic. Diego Salinas Rivera', accion: 'Editó actuación', entidad: 'Expediente 306/2024', fecha: fechaIso(-1), detalle: 'Actualización de promoción pendiente.' },
  { id: 4, usuario: 'Lic. Fernanda Ochoa', accion: 'Cerró tarea', entidad: 'Tarea T-16', fecha: fechaIso(-1), detalle: 'Cierre de expediente 910/2023.' },
  { id: 5, usuario: 'Lic. Carlos Ramírez Núñez', accion: 'Creó tarea', entidad: 'Tarea T-19', fecha: fechaIso(-1), detalle: 'Notificación a contraparte.' },
  { id: 6, usuario: 'Lic. Roberto Macías Aguilar', accion: 'Modificó estado', entidad: 'Expediente 118/2024', fecha: fechaIso(-2), detalle: 'Activo → Vencido.' },
  { id: 7, usuario: 'Lic. María Elena Torres', accion: 'Registró demanda', entidad: 'Demanda D-13', fecha: fechaIso(-2), detalle: 'Prevenida — precisar prestaciones.' },
  { id: 8, usuario: 'Lic. Diego Salinas Rivera', accion: 'Eliminó archivo', entidad: 'Expediente 048/2023', fecha: fechaIso(-3), detalle: 'borrador_v1.docx (obsoleto).' },
  { id: 9, usuario: 'Lic. Fernanda Ochoa', accion: 'Creó actuación', entidad: 'Expediente 901/2024', fecha: fechaIso(-3), detalle: 'Notificación personal recibida.' },
  { id: 10, usuario: 'Lic. Diego Salinas Rivera', accion: 'Exportó CSV', entidad: 'Módulo Expedientes', fecha: fechaIso(-3), detalle: 'Exportación de 42 expedientes.' },
  { id: 11, usuario: 'Lic. Carlos Ramírez Núñez', accion: 'Importó CSV', entidad: 'Módulo Expedientes', fecha: fechaIso(-4), detalle: '8 expedientes importados.' },
  { id: 12, usuario: 'Lic. Roberto Macías Aguilar', accion: 'Creó usuario', entidad: 'Usuario U-5', fecha: fechaIso(-5), detalle: 'Alta de pasante Lic. Karla Méndez.' },
  { id: 13, usuario: 'Lic. María Elena Torres', accion: 'Subió documento', entidad: 'Expediente 725/2024', fecha: fechaIso(-5), detalle: 'Contestación.pdf · 850 KB' },
  { id: 14, usuario: 'Lic. Diego Salinas Rivera', accion: 'Inició sesión', entidad: 'Sistema', fecha: fechaIso(-5), detalle: 'Acceso desde IP 187.190.x.x' },
  { id: 15, usuario: 'Lic. Fernanda Ochoa', accion: 'Modificó tarea', entidad: 'Tarea T-9', fecha: fechaIso(-6), detalle: 'Reasignación a Lic. María Elena.' },
  { id: 16, usuario: 'Lic. Carlos Ramírez Núñez', accion: 'Cerró expediente', entidad: 'Expediente 910/2023', fecha: fechaIso(-7), detalle: 'Convenio firmado entre las partes.' },
  { id: 17, usuario: 'Lic. Diego Salinas Rivera', accion: 'Generó reporte', entidad: 'Módulo Estadísticas', fecha: fechaIso(-8), detalle: 'Reporte mensual abril.' },
  { id: 18, usuario: 'Lic. María Elena Torres', accion: 'Editó parte', entidad: 'Parte P-7', fecha: fechaIso(-8), detalle: 'Actualización de teléfono.' },
  { id: 19, usuario: 'Lic. Roberto Macías Aguilar', accion: 'Eliminó tarea', entidad: 'Tarea T-22', fecha: fechaIso(-9), detalle: 'Tarea duplicada.' },
  { id: 20, usuario: 'Lic. Fernanda Ochoa', accion: 'Creó audiencia', entidad: 'Agenda', fecha: fechaIso(-10), detalle: 'Audiencia preliminar 14:00 hrs.' },
  { id: 21, usuario: 'Lic. Diego Salinas Rivera', accion: 'Modificó configuración', entidad: 'Sistema', fecha: fechaIso(-11), detalle: 'Activó notificaciones por correo.' },
  { id: 22, usuario: 'Lic. Carlos Ramírez Núñez', accion: 'Subió documento', entidad: 'Expediente 208/2024', fecha: fechaIso(-12), detalle: 'Sentencia.pdf · 2.1 MB' },
  { id: 23, usuario: 'Lic. María Elena Torres', accion: 'Creó parte', entidad: 'Parte P-12', fecha: fechaIso(-13), detalle: 'Alta de tercero llamado a juicio.' },
  { id: 24, usuario: 'Lic. Diego Salinas Rivera', accion: 'Eliminó expediente', entidad: 'Expediente 555/2022', fecha: fechaIso(-14), detalle: 'Expediente erróneo.' },
  { id: 25, usuario: 'Lic. Roberto Macías Aguilar', accion: 'Creó tarea', entidad: 'Tarea T-13', fecha: fechaIso(-15), detalle: 'Junta laboral.' },
  { id: 26, usuario: 'Lic. Fernanda Ochoa', accion: 'Modificó estado', entidad: 'Demanda D-3', fecha: fechaIso(-16), detalle: 'Prevención → Cumplimiento.' },
  { id: 27, usuario: 'Lic. María Elena Torres', accion: 'Inició sesión', entidad: 'Sistema', fecha: fechaIso(-17), detalle: 'Acceso desde navegador Edge.' },
  { id: 28, usuario: 'Lic. Diego Salinas Rivera', accion: 'Generó reporte', entidad: 'Módulo Estadísticas', fecha: fechaIso(-18), detalle: 'Reporte trimestral Q1.' },
  { id: 29, usuario: 'Lic. Carlos Ramírez Núñez', accion: 'Creó actuación', entidad: 'Expediente 412/2024', fecha: fechaIso(-19), detalle: 'Auto admisorio.' },
  { id: 30, usuario: 'Lic. Roberto Macías Aguilar', accion: 'Subió documento', entidad: 'Expediente 048/2023', fecha: fechaIso(-20), detalle: 'Liquidación.xlsx · 320 KB' },
]

// 12 partes procesales
export const mockPartes = [
  { id: 1, nombre: 'Construcciones Pacífico S.A. de C.V.', tipo: 'Actor (persona moral)', telefono: '33-1234-5678', correo: 'legal@cpacifico.mx', expediente: '306/2024' },
  { id: 2, nombre: 'Inversiones Hospitalarias del Occidente', tipo: 'Demandado (persona moral)', telefono: '33-2233-4455', correo: 'juridico@iho.com.mx', expediente: '306/2024' },
  { id: 3, nombre: 'Javier Ruiz Hernández', tipo: 'Actor (persona física)', telefono: '33-9988-7766', correo: 'jruiz@correo.com', expediente: '412/2024' },
  { id: 4, nombre: 'Distribuidora Comercial de Occidente S.A.', tipo: 'Demandado (persona moral)', telefono: '33-5544-3322', correo: 'contacto@dcoccidente.mx', expediente: '412/2024' },
  { id: 5, nombre: 'Banco Mercantil del Noroeste S.A.', tipo: 'Actor (persona moral)', telefono: '33-8000-1100', correo: 'juridico@bmn.mx', expediente: '208/2024' },
  { id: 6, nombre: 'Roberto Carlos Aguilar', tipo: 'Demandado (persona física)', telefono: '33-7766-5544', correo: 'rcaguilar@correo.com', expediente: '208/2024' },
  { id: 7, nombre: 'María Fernanda Castillo López', tipo: 'Actora (persona física)', telefono: '33-1100-2200', correo: 'mfcastillo@correo.com', expediente: '901/2024' },
  { id: 8, nombre: 'Eduardo Iván Castañeda', tipo: 'Demandado (persona física)', telefono: '33-3344-5566', correo: 'eduivan@correo.com', expediente: '901/2024' },
  { id: 9, nombre: 'Lic. Patricia Mendoza Vázquez', tipo: 'Apoderado legal', telefono: '33-4455-6677', correo: 'lic.mendoza@firma.mx', expediente: '512/2025' },
  { id: 10, nombre: 'Grupo Inmobiliario Tequila S.A.P.I.', tipo: 'Actor (persona moral)', telefono: '33-2211-3344', correo: 'legal@grupotequila.mx', expediente: '512/2025' },
  { id: 11, nombre: 'Aseguradora Atlas S.A.', tipo: 'Demandada (persona moral)', telefono: '33-7000-8000', correo: 'siniestros@atlas.com.mx', expediente: '512/2025' },
  { id: 12, nombre: 'Cementos Jalisco S.A. de C.V.', tipo: 'Tercero llamado a juicio', telefono: '33-9900-1010', correo: 'juridico@cjalisco.mx', expediente: '725/2024' },
]

// 5 usuarios
export const mockUsuarios = [
  { id: 1, nombre: 'Lic. Diego Salinas Rivera', correo: 'diego.salinas@firma.mx', rol: 'Administrador', activo: true },
  { id: 2, nombre: 'Lic. María Elena Torres', correo: 'maria.torres@firma.mx', rol: 'Abogada', activo: true },
  { id: 3, nombre: 'Lic. Carlos Ramírez Núñez', correo: 'carlos.ramirez@firma.mx', rol: 'Abogado', activo: true },
  { id: 4, nombre: 'Lic. Fernanda Ochoa', correo: 'fernanda.ochoa@firma.mx', rol: 'Abogada', activo: true },
  { id: 5, nombre: 'Lic. Karla Méndez Soto', correo: 'karla.mendez@firma.mx', rol: 'Pasante', activo: false },
]

// 12 meses
const MES_NOMBRES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
export const mockEstadisticasMensuales = MES_NOMBRES.map((mes, i) => {
  const base = 18 + Math.round(Math.sin(i * 0.7) * 8 + 6)
  const demandas = base + Math.floor(Math.random() * 5)
  const prevenidas = Math.round(demandas * 0.28)
  const admitidas = Math.round(demandas * 0.55)
  const desechadas = Math.round(demandas * 0.06)
  const cumplimientos = Math.round(prevenidas * 0.82)
  return { mes, demandas, admitidas, prevenidas, cumplimientos, desechadas }
})

// Documentos de ejemplo
export const mockDocumentos = [
  { id: 1, nombre: 'Demanda inicial - 306-2024.pdf', tipo: 'PDF', tamano: '1.2 MB', expediente: '306/2024', subidoPor: 'Lic. Diego Salinas', fecha: fechaIso(-2) },
  { id: 2, nombre: 'Contestación - 412-2024.docx', tipo: 'DOCX', tamano: '85 KB', expediente: '412/2024', subidoPor: 'Lic. María Elena Torres', fecha: fechaIso(-5) },
  { id: 3, nombre: 'Sentencia - 208-2024.pdf', tipo: 'PDF', tamano: '2.1 MB', expediente: '208/2024', subidoPor: 'Lic. Carlos Ramírez', fecha: fechaIso(-12) },
  { id: 4, nombre: 'Acuerdo de admisión - 512-2025.pdf', tipo: 'PDF', tamano: '410 KB', expediente: '512/2025', subidoPor: 'Lic. Diego Salinas', fecha: fechaIso(-1) },
  { id: 5, nombre: 'Liquidación - 048-2023.xlsx', tipo: 'XLSX', tamano: '320 KB', expediente: '048/2023', subidoPor: 'Lic. Roberto Macías', fecha: fechaIso(-20) },
  { id: 6, nombre: 'Audiencia - acta - 901-2024.pdf', tipo: 'PDF', tamano: '660 KB', expediente: '901/2024', subidoPor: 'Lic. Fernanda Ochoa', fecha: fechaIso(-7) },
  { id: 7, nombre: 'Poder notarial - 725-2024.pdf', tipo: 'PDF', tamano: '1.0 MB', expediente: '725/2024', subidoPor: 'Lic. María Elena Torres', fecha: fechaIso(-3) },
  { id: 8, nombre: 'Notificación - 118-2024.jpg', tipo: 'JPG', tamano: '512 KB', expediente: '118/2024', subidoPor: 'Lic. Carlos Ramírez', fecha: fechaIso(-9) },
]

export { JUZGADOS_JALISCO, PERSONAS, ABOGADOS, TIPOS_JUICIO }
