-- ============================================================
-- Migración: Boletín Judicial — LexTrack MX
-- Fecha: 2026-05-20
-- ============================================================

-- 1. Columnas nuevas en la tabla expedientes
ALTER TABLE expedientes
  ADD COLUMN IF NOT EXISTS alertas_boletin    BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS email_notificacion TEXT,
  ADD COLUMN IF NOT EXISTS cve_juz            TEXT,        -- Código CVE_JUZ de la API del CJJ (ej: M09)
  ADD COLUMN IF NOT EXISTS ultimo_movimiento  DATE,
  ADD COLUMN IF NOT EXISTS nuevo_acuerdo      BOOLEAN DEFAULT FALSE;

-- 2. Tabla de acuerdos detectados del boletín judicial
CREATE TABLE IF NOT EXISTS acuerdos_boletin (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  expediente_id  UUID        NOT NULL REFERENCES expedientes(id) ON DELETE CASCADE,
  fecha          DATE        NOT NULL,
  descripcion    TEXT        NOT NULL,
  leido          BOOLEAN     NOT NULL DEFAULT FALSE,
  auto_detectado BOOLEAN     NOT NULL DEFAULT TRUE,
  creado_en      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índice para consultas por expediente
CREATE INDEX IF NOT EXISTS idx_acuerdos_boletin_expediente
  ON acuerdos_boletin (expediente_id, fecha DESC);

-- RLS: cada usuario solo ve acuerdos de sus expedientes
ALTER TABLE acuerdos_boletin ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "acuerdos_boletin_propios" ON acuerdos_boletin
  FOR ALL
  USING (
    expediente_id IN (
      SELECT id FROM expedientes WHERE user_id = auth.uid()
    )
  );
