-- ============================================================
-- Migración: Días Inhábiles — LexTrack MX
-- Fecha: 2026-05-25
-- ============================================================

CREATE TABLE IF NOT EXISTS dias_inhabiles (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  despacho_id    UUID        NOT NULL REFERENCES despachos(id) ON DELETE CASCADE,
  fecha          DATE        NOT NULL,
  nota           TEXT,
  creado_por     UUID        NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id),
  creado_en      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (despacho_id, fecha)
);

CREATE INDEX IF NOT EXISTS idx_dias_inhabiles_desp ON dias_inhabiles (despacho_id);

ALTER TABLE dias_inhabiles ENABLE ROW LEVEL SECURITY;

-- POLICIES
DO $$ BEGIN
  DROP POLICY IF EXISTS "dias_inhabiles_select" ON dias_inhabiles;
  DROP POLICY IF EXISTS "dias_inhabiles_insert" ON dias_inhabiles;
  DROP POLICY IF EXISTS "dias_inhabiles_update" ON dias_inhabiles;
  DROP POLICY IF EXISTS "dias_inhabiles_delete" ON dias_inhabiles;
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

CREATE POLICY "dias_inhabiles_select" ON dias_inhabiles
  FOR SELECT
  USING (despacho_id IN (SELECT auth_despacho_ids()));

CREATE POLICY "dias_inhabiles_insert" ON dias_inhabiles
  FOR INSERT
  WITH CHECK (
    creado_por = auth.uid()
    AND despacho_id IN (SELECT auth_despacho_ids())
  );

CREATE POLICY "dias_inhabiles_update" ON dias_inhabiles
  FOR UPDATE
  USING (despacho_id IN (SELECT auth_despacho_ids()));

CREATE POLICY "dias_inhabiles_delete" ON dias_inhabiles
  FOR DELETE
  USING (
    despacho_id IN (
      SELECT despacho_id FROM despacho_miembros
      WHERE user_id = auth.uid() AND rol IN ('admin','abogado') AND activo = true
    )
  );
