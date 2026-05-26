-- ============================================================
-- Migración: CRM Prospectos — LexTrack MX
-- Fecha: 2026-05-24
-- ============================================================

CREATE TABLE IF NOT EXISTS prospectos (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  despacho_id   UUID        NOT NULL REFERENCES despachos(id) ON DELETE CASCADE,
  user_id       UUID        NOT NULL REFERENCES auth.users(id),
  nombre        TEXT        NOT NULL,
  email         TEXT,
  telefono      TEXT,
  asunto        TEXT,
  materia       TEXT        DEFAULT 'Mercantil',
  etapa         TEXT        NOT NULL DEFAULT 'Nuevo'
                            CHECK (etapa IN ('Nuevo','Contactado','Reunión','Propuesta','Ganado','Perdido')),
  prioridad     TEXT        NOT NULL DEFAULT 'Normal'
                            CHECK (prioridad IN ('Normal','Alta','Urgente')),
  origen        TEXT,
  notas         TEXT,
  valor_estimado NUMERIC(12,2),
  expediente_id UUID        REFERENCES expedientes(id) ON DELETE SET NULL,
  creado_en     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_prosp_desp  ON prospectos (despacho_id, etapa);
CREATE INDEX IF NOT EXISTS idx_prosp_user  ON prospectos (user_id);

ALTER TABLE prospectos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "prospectos_select" ON prospectos
  FOR SELECT
  USING (despacho_id IN (SELECT auth_despacho_ids()));

CREATE POLICY "prospectos_insert" ON prospectos
  FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND despacho_id IN (SELECT auth_despacho_ids())
  );

CREATE POLICY "prospectos_update" ON prospectos
  FOR UPDATE
  USING (despacho_id IN (SELECT auth_despacho_ids()));

CREATE POLICY "prospectos_delete" ON prospectos
  FOR DELETE
  USING (
    despacho_id IN (
      SELECT despacho_id FROM despacho_miembros
      WHERE user_id = auth.uid() AND rol IN ('admin','abogado') AND activo = true
    )
  );
