-- ============================================================
-- Migración: Multi-Tenant — LexTrack MX
-- Fecha: 2026-05-24
-- ============================================================


-- ── 1. TABLA DESPACHOS (sin policies aún) ───────────────────
CREATE TABLE IF NOT EXISTS despachos (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre         TEXT        NOT NULL,
  slug           TEXT        UNIQUE,
  plan           TEXT        NOT NULL DEFAULT 'free',
  owner_id       UUID        NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  creado_en      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE despachos ENABLE ROW LEVEL SECURITY;


-- ── 2. TABLA DESPACHO_MIEMBROS ──────────────────────────────
CREATE TABLE IF NOT EXISTS despacho_miembros (
  id           UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  despacho_id  UUID    NOT NULL REFERENCES despachos(id) ON DELETE CASCADE,
  user_id      UUID    NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rol          TEXT    NOT NULL DEFAULT 'abogado'
                       CHECK (rol IN ('admin', 'abogado', 'asistente')),
  activo       BOOLEAN NOT NULL DEFAULT TRUE,
  invitado_por UUID    REFERENCES auth.users(id),
  creado_en    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (despacho_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_dm_user ON despacho_miembros (user_id, activo);
CREATE INDEX IF NOT EXISTS idx_dm_desp ON despacho_miembros (despacho_id, activo);

ALTER TABLE despacho_miembros ENABLE ROW LEVEL SECURITY;


-- ── 3. POLICIES DE DESPACHOS (ahora sí existe despacho_miembros) ──
CREATE POLICY "despachos_select" ON despachos
  FOR SELECT
  USING (
    id IN (
      SELECT despacho_id FROM despacho_miembros
      WHERE user_id = auth.uid() AND activo = true
    )
  );

CREATE POLICY "despachos_update" ON despachos
  FOR UPDATE
  USING (owner_id = auth.uid());


-- ── 4. POLICIES DE DESPACHO_MIEMBROS ────────────────────────
CREATE POLICY "dm_select" ON despacho_miembros
  FOR SELECT
  USING (
    despacho_id IN (
      SELECT despacho_id FROM despacho_miembros dm2
      WHERE dm2.user_id = auth.uid() AND dm2.activo = true
    )
  );

CREATE POLICY "dm_insert" ON despacho_miembros
  FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    OR despacho_id IN (
      SELECT despacho_id FROM despacho_miembros dm2
      WHERE dm2.user_id = auth.uid() AND dm2.rol = 'admin' AND dm2.activo = true
    )
  );

CREATE POLICY "dm_update" ON despacho_miembros
  FOR UPDATE
  USING (
    despacho_id IN (
      SELECT despacho_id FROM despacho_miembros dm2
      WHERE dm2.user_id = auth.uid() AND dm2.rol = 'admin' AND dm2.activo = true
    )
  );


-- ── 5. TABLA INVITACIONES ────────────────────────────────────
CREATE TABLE IF NOT EXISTS invitaciones (
  id          UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  despacho_id UUID    NOT NULL REFERENCES despachos(id) ON DELETE CASCADE,
  email       TEXT,
  rol         TEXT    NOT NULL DEFAULT 'abogado'
                      CHECK (rol IN ('admin', 'abogado', 'asistente')),
  token       TEXT    UNIQUE NOT NULL,
  creado_por  UUID    NOT NULL REFERENCES auth.users(id),
  usada       BOOLEAN NOT NULL DEFAULT FALSE,
  expira_en   TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
  creado_en   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inv_token ON invitaciones (token) WHERE NOT usada;
CREATE INDEX IF NOT EXISTS idx_inv_desp  ON invitaciones (despacho_id);

ALTER TABLE invitaciones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "inv_select" ON invitaciones
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "inv_insert" ON invitaciones
  FOR INSERT
  WITH CHECK (
    creado_por = auth.uid()
    AND despacho_id IN (
      SELECT despacho_id FROM despacho_miembros
      WHERE user_id = auth.uid() AND rol = 'admin' AND activo = true
    )
  );

CREATE POLICY "inv_update" ON invitaciones
  FOR UPDATE
  USING (auth.uid() IS NOT NULL AND NOT usada AND expira_en > NOW());


-- ── 6. FUNCIÓN HELPER RLS ────────────────────────────────────
CREATE OR REPLACE FUNCTION auth_despacho_ids()
RETURNS SETOF UUID
LANGUAGE SQL
SECURITY DEFINER
STABLE
AS $$
  SELECT despacho_id
  FROM   despacho_miembros
  WHERE  user_id = auth.uid()
    AND  activo  = true
$$;


-- ── 7. COLUMNA despacho_id EN TABLAS EXISTENTES ──────────────
ALTER TABLE expedientes
  ADD COLUMN IF NOT EXISTS despacho_id UUID REFERENCES despachos(id) ON DELETE CASCADE;

ALTER TABLE actuaciones
  ADD COLUMN IF NOT EXISTS despacho_id UUID REFERENCES despachos(id) ON DELETE CASCADE;

ALTER TABLE documentos
  ADD COLUMN IF NOT EXISTS despacho_id UUID REFERENCES despachos(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_exp_desp ON expedientes (despacho_id) WHERE despacho_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_act_desp ON actuaciones (despacho_id) WHERE despacho_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_doc_desp ON documentos  (despacho_id) WHERE despacho_id IS NOT NULL;


-- ── 8. RLS — EXPEDIENTES ─────────────────────────────────────
DO $$ BEGIN
  DROP POLICY IF EXISTS "expedientes_propios" ON expedientes;
  DROP POLICY IF EXISTS "expedientes_select"  ON expedientes;
  DROP POLICY IF EXISTS "expedientes_insert"  ON expedientes;
  DROP POLICY IF EXISTS "expedientes_update"  ON expedientes;
  DROP POLICY IF EXISTS "expedientes_delete"  ON expedientes;
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

ALTER TABLE expedientes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "expedientes_select" ON expedientes
  FOR SELECT
  USING (user_id = auth.uid() OR despacho_id IN (SELECT auth_despacho_ids()));

CREATE POLICY "expedientes_insert" ON expedientes
  FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND (despacho_id IS NULL OR despacho_id IN (SELECT auth_despacho_ids()))
  );

CREATE POLICY "expedientes_update" ON expedientes
  FOR UPDATE
  USING (user_id = auth.uid() OR despacho_id IN (SELECT auth_despacho_ids()));

CREATE POLICY "expedientes_delete" ON expedientes
  FOR DELETE
  USING (
    user_id = auth.uid()
    OR despacho_id IN (
      SELECT despacho_id FROM despacho_miembros
      WHERE user_id = auth.uid() AND rol IN ('admin','abogado') AND activo = true
    )
  );


-- ── 9. RLS — ACTUACIONES ─────────────────────────────────────
DO $$ BEGIN
  DROP POLICY IF EXISTS "actuaciones_propias" ON actuaciones;
  DROP POLICY IF EXISTS "actuaciones_select"  ON actuaciones;
  DROP POLICY IF EXISTS "actuaciones_insert"  ON actuaciones;
  DROP POLICY IF EXISTS "actuaciones_update"  ON actuaciones;
  DROP POLICY IF EXISTS "actuaciones_delete"  ON actuaciones;
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

ALTER TABLE actuaciones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "actuaciones_select" ON actuaciones
  FOR SELECT
  USING (
    user_id = auth.uid()
    OR despacho_id IN (SELECT auth_despacho_ids())
    OR expediente_id IN (
      SELECT id FROM expedientes WHERE despacho_id IN (SELECT auth_despacho_ids())
    )
  );

CREATE POLICY "actuaciones_insert" ON actuaciones
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "actuaciones_update" ON actuaciones
  FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "actuaciones_delete" ON actuaciones
  FOR DELETE
  USING (
    user_id = auth.uid()
    OR expediente_id IN (
      SELECT id FROM expedientes WHERE despacho_id IN (SELECT auth_despacho_ids())
    )
  );


-- ── 10. RLS — DOCUMENTOS ─────────────────────────────────────
DO $$ BEGIN
  DROP POLICY IF EXISTS "documentos_propios" ON documentos;
  DROP POLICY IF EXISTS "documentos_select"  ON documentos;
  DROP POLICY IF EXISTS "documentos_insert"  ON documentos;
  DROP POLICY IF EXISTS "documentos_delete"  ON documentos;
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

ALTER TABLE documentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "documentos_select" ON documentos
  FOR SELECT
  USING (
    user_id = auth.uid()
    OR despacho_id IN (SELECT auth_despacho_ids())
    OR expediente_id IN (
      SELECT id FROM expedientes WHERE despacho_id IN (SELECT auth_despacho_ids())
    )
  );

CREATE POLICY "documentos_insert" ON documentos
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "documentos_delete" ON documentos
  FOR DELETE
  USING (
    user_id = auth.uid()
    OR expediente_id IN (
      SELECT id FROM expedientes WHERE despacho_id IN (SELECT auth_despacho_ids())
    )
  );


-- ── 11. FUNCIÓN DE MIGRACIÓN DE DATOS EXISTENTES ─────────────
CREATE OR REPLACE FUNCTION migrar_datos_a_despacho(p_despacho_id UUID)
RETURNS VOID
LANGUAGE PLPGSQL
SECURITY DEFINER
AS $$
BEGIN
  UPDATE expedientes
  SET    despacho_id = p_despacho_id
  WHERE  user_id = auth.uid() AND despacho_id IS NULL;

  UPDATE actuaciones
  SET    despacho_id = p_despacho_id
  WHERE  user_id = auth.uid() AND despacho_id IS NULL;

  UPDATE documentos
  SET    despacho_id = p_despacho_id
  WHERE  user_id = auth.uid() AND despacho_id IS NULL;
END;
$$;
