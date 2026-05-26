-- ============================================================
-- Migración: Módulos Core (Bitácora y Partes Datos) — LexTrack MX
-- Fecha: 2026-05-25
-- ============================================================

-- ── 1. TABLA BITÁCORA DE ACTIVIDAD ───────────────────────────
CREATE TABLE IF NOT EXISTS bitacora_actividad (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  despacho_id    UUID        NOT NULL REFERENCES despachos(id) ON DELETE CASCADE,
  user_id        UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_email     TEXT        NOT NULL,
  accion         TEXT        NOT NULL, -- ej: 'crear_expediente', 'actualizar_expediente', 'eliminar_expediente', 'subir_documento'
  detalles       TEXT        NOT NULL,
  creado_en      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bitacora_desp ON bitacora_actividad (despacho_id, creado_en DESC);

ALTER TABLE bitacora_actividad ENABLE ROW LEVEL SECURITY;

-- POLICIES BITÁCORA
DO $$ BEGIN
  DROP POLICY IF EXISTS "bitacora_select" ON bitacora_actividad;
  DROP POLICY IF EXISTS "bitacora_insert" ON bitacora_actividad;
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

CREATE POLICY "bitacora_select" ON bitacora_actividad
  FOR SELECT
  USING (despacho_id IN (SELECT auth_despacho_ids()));

CREATE POLICY "bitacora_insert" ON bitacora_actividad
  FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND despacho_id IN (SELECT auth_despacho_ids())
  );


-- ── 2. TABLA CONTACTOS DE PARTES PROCESALES ───────────────────
CREATE TABLE IF NOT EXISTS partes_datos (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  despacho_id    UUID        NOT NULL REFERENCES despachos(id) ON DELETE CASCADE,
  nombre         TEXT        NOT NULL,
  telefono       TEXT,
  correo         TEXT,
  notas          TEXT,
  creado_en      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (despacho_id, nombre)
);

CREATE INDEX IF NOT EXISTS idx_partes_datos_desp ON partes_datos (despacho_id);

ALTER TABLE partes_datos ENABLE ROW LEVEL SECURITY;

-- POLICIES PARTES DATOS
DO $$ BEGIN
  DROP POLICY IF EXISTS "partes_datos_select" ON partes_datos;
  DROP POLICY IF EXISTS "partes_datos_insert" ON partes_datos;
  DROP POLICY IF EXISTS "partes_datos_update" ON partes_datos;
  DROP POLICY IF EXISTS "partes_datos_delete" ON partes_datos;
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

CREATE POLICY "partes_datos_select" ON partes_datos
  FOR SELECT
  USING (despacho_id IN (SELECT auth_despacho_ids()));

CREATE POLICY "partes_datos_insert" ON partes_datos
  FOR INSERT
  WITH CHECK (
    despacho_id IN (SELECT auth_despacho_ids())
  );

CREATE POLICY "partes_datos_update" ON partes_datos
  FOR UPDATE
  USING (despacho_id IN (SELECT auth_despacho_ids()));

CREATE POLICY "partes_datos_delete" ON partes_datos
  FOR DELETE
  USING (
    despacho_id IN (
      SELECT despacho_id FROM despacho_miembros
      WHERE user_id = auth.uid() AND rol IN ('admin','abogado') AND activo = true
    )
  );
