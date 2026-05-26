-- ============================================================
-- Migración: Configuración del Despacho
-- ============================================================

CREATE TABLE IF NOT EXISTS despacho_config (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  despacho_id     UUID        NOT NULL UNIQUE REFERENCES despachos(id) ON DELETE CASCADE,
  nombre_completo TEXT,
  razon_social    TEXT,
  rfc             TEXT,
  direccion       TEXT,
  telefono        TEXT,
  email_oficial   TEXT,
  logo_url        TEXT,
  membrete_texto  TEXT,
  actualizado_en  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE despacho_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "config_select" ON despacho_config
  FOR SELECT USING (despacho_id IN (SELECT auth_despacho_ids()));

CREATE POLICY "config_upsert" ON despacho_config
  FOR ALL USING (
    despacho_id IN (
      SELECT despacho_id FROM despacho_miembros
      WHERE user_id = auth.uid()
        AND rol = 'admin'
        AND activo = true
    )
  );

-- También agregar columna asignado_a en tareas si no existe
ALTER TABLE tareas ADD COLUMN IF NOT EXISTS asignado_a UUID REFERENCES auth.users(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_tareas_asignado ON tareas (asignado_a);

SELECT 'despacho_config y tareas.asignado_a creados ✅' AS resultado;
