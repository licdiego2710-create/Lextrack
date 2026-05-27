-- ============================================================
-- Migración: Mejoras para Captura Manual y Flujo Judicial
-- Fecha: 2026-05-27
-- ============================================================

-- 1. Nuevas columnas en la tabla de expedientes
ALTER TABLE expedientes
  ADD COLUMN IF NOT EXISTS anio                INTEGER,
  ADD COLUMN IF NOT EXISTS partido_judicial    TEXT,
  ADD COLUMN IF NOT EXISTS abogado_responsable TEXT,
  ADD COLUMN IF NOT EXISTS fecha_inicio        DATE,
  ADD COLUMN IF NOT EXISTS ultimo_acuerdo      TEXT,
  ADD COLUMN IF NOT EXISTS proxima_fecha        DATE;

-- 2. Eliminar restricciones antiguas de check en prospectos
ALTER TABLE prospectos
  DROP CONSTRAINT IF EXISTS prospectos_etapa_check,
  DROP CONSTRAINT IF EXISTS prospectos_prioridad_check;

-- 3. Nuevas columnas en la tabla de prospectos
ALTER TABLE prospectos
  ADD COLUMN IF NOT EXISTS fuente_contacto     TEXT,
  ADD COLUMN IF NOT EXISTS tipo_asunto         TEXT,
  ADD COLUMN IF NOT EXISTS descripcion_caso     TEXT,
  ADD COLUMN IF NOT EXISTS urgencia            TEXT DEFAULT 'media',
  ADD COLUMN IF NOT EXISTS responsable         TEXT,
  ADD COLUMN IF NOT EXISTS fecha_contacto      DATE,
  ADD COLUMN IF NOT EXISTS proximo_seguimiento DATE,
  ADD COLUMN IF NOT EXISTS observaciones       TEXT;

-- 4. Nuevas columnas en la tabla de actuaciones
ALTER TABLE actuaciones
  ADD COLUMN IF NOT EXISTS tipo_actuacion      TEXT,
  ADD COLUMN IF NOT EXISTS genera_termino      BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS fecha_vencimiento   DATE,
  ADD COLUMN IF NOT EXISTS responsable         TEXT,
  ADD COLUMN IF NOT EXISTS estatus_cumplimiento TEXT DEFAULT 'Pendiente';

-- 5. Crear tabla para expediente_partes
CREATE TABLE IF NOT EXISTS expediente_partes (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  expediente_id  UUID        NOT NULL REFERENCES expedientes(id) ON DELETE CASCADE,
  despacho_id    UUID        REFERENCES despachos(id) ON DELETE CASCADE,
  nombre         TEXT        NOT NULL,
  rol            TEXT        NOT NULL, -- Actor, Demandado, Tercero, Apoderado, Autorizado
  domicilio      TEXT,
  correo         TEXT,
  telefono       TEXT,
  observaciones  TEXT,
  creado_en      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_expediente_partes_exp ON expediente_partes(expediente_id);

-- Habilitar RLS en expediente_partes
ALTER TABLE expediente_partes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "expediente_partes_select" ON expediente_partes
  FOR SELECT USING (expediente_id IN (SELECT id FROM expedientes));

CREATE POLICY "expediente_partes_write" ON expediente_partes
  FOR ALL USING (
    expediente_id IN (
      SELECT id FROM expedientes
      WHERE EXISTS (
        SELECT 1 FROM despacho_miembros
        WHERE user_id = auth.uid()
          AND despacho_id = expedientes.despacho_id
          AND rol IN ('admin', 'abogado', 'asistente')
          AND activo = true
      )
    )
  );

-- 6. Crear tabla para expediente_audiencias
CREATE TABLE IF NOT EXISTS expediente_audiencias (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  expediente_id  UUID        NOT NULL REFERENCES expedientes(id) ON DELETE CASCADE,
  despacho_id    UUID        REFERENCES despachos(id) ON DELETE CASCADE,
  titulo         TEXT        NOT NULL,
  fecha_hora     TIMESTAMPTZ NOT NULL,
  lugar          TEXT,
  observaciones  TEXT,
  creado_en      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_expediente_audiencias_exp ON expediente_audiencias(expediente_id);

-- Habilitar RLS en expediente_audiencias
ALTER TABLE expediente_audiencias ENABLE ROW LEVEL SECURITY;

CREATE POLICY "expediente_audiencias_select" ON expediente_audiencias
  FOR SELECT USING (expediente_id IN (SELECT id FROM expedientes));

CREATE POLICY "expediente_audiencias_write" ON expediente_audiencias
  FOR ALL USING (
    expediente_id IN (
      SELECT id FROM expedientes
      WHERE EXISTS (
        SELECT 1 FROM despacho_miembros
        WHERE user_id = auth.uid()
          AND despacho_id = expedientes.despacho_id
          AND rol IN ('admin', 'abogado', 'asistente')
          AND activo = true
      )
    )
  );

-- 7. Crear tabla para expediente_fuentes
CREATE TABLE IF NOT EXISTS expediente_fuentes (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  expediente_id  UUID        NOT NULL REFERENCES expedientes(id) ON DELETE CASCADE,
  despacho_id    UUID        REFERENCES despachos(id) ON DELETE CASCADE,
  nombre         TEXT        NOT NULL,
  tipo           TEXT, -- CJF, Poder Judicial, Boletín, Otro
  url            TEXT,
  num_externo    TEXT,
  organo         TEXT,
  ultima_consulta DATE,
  observaciones  TEXT,
  creado_en      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_expediente_fuentes_exp ON expediente_fuentes(expediente_id);

-- Habilitar RLS en expediente_fuentes
ALTER TABLE expediente_fuentes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "expediente_fuentes_select" ON expediente_fuentes
  FOR SELECT USING (expediente_id IN (SELECT id FROM expedientes));

CREATE POLICY "expediente_fuentes_write" ON expediente_fuentes
  FOR ALL USING (
    expediente_id IN (
      SELECT id FROM expedientes
      WHERE EXISTS (
        SELECT 1 FROM despacho_miembros
        WHERE user_id = auth.uid()
          AND despacho_id = expedientes.despacho_id
          AND rol IN ('admin', 'abogado', 'asistente')
          AND activo = true
      )
    )
  );
