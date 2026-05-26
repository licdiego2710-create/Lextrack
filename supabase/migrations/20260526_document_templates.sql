-- ============================================================
-- Migración: Automatización de Documentos (Plantillas)
-- Fecha: 2026-05-26
-- ============================================================

CREATE TABLE IF NOT EXISTS plantillas_documentos (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  despacho_id    UUID        NOT NULL REFERENCES despachos(id) ON DELETE CASCADE,
  nombre         TEXT        NOT NULL,
  descripcion    TEXT,
  contenido      TEXT        NOT NULL,
  materia        TEXT,
  creado_en      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_plantillas_desp ON plantillas_documentos (despacho_id);

ALTER TABLE plantillas_documentos ENABLE ROW LEVEL SECURITY;

-- SELECT: Solo miembros activos (admin, abogado, asistente) del despacho pueden ver plantillas
CREATE POLICY "plantillas_select" ON plantillas_documentos
  FOR SELECT USING (
    despacho_id IN (
      SELECT despacho_id FROM despacho_miembros
      WHERE user_id = auth.uid()
        AND rol IN ('admin', 'abogado', 'asistente')
        AND activo = true
    )
  );

-- WRITE (INSERT, UPDATE, DELETE): Solo administradores y abogados activos del despacho pueden modificar plantillas
CREATE POLICY "plantillas_write" ON plantillas_documentos
  FOR ALL USING (
    despacho_id IN (
      SELECT despacho_id FROM despacho_miembros
      WHERE user_id = auth.uid()
        AND rol IN ('admin', 'abogado')
        AND activo = true
    )
  );
