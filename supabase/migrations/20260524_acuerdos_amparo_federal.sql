-- ─────────────────────────────────────────────────────────────────────────────
-- Historial de acuerdos de amparos federales (CJF Tercer Circuito)
-- Cada fila = un acuerdo detectado automáticamente o capturado por el usuario.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS acuerdos_amparo_federal (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  amparo_id        UUID        REFERENCES amparos_federales(id) ON DELETE CASCADE,
  expediente_id    UUID        REFERENCES expedientes(id) ON DELETE SET NULL,
  despacho_id      UUID        NOT NULL REFERENCES despachos(id),
  user_id          UUID        NOT NULL REFERENCES auth.users(id),

  num_amparo       TEXT        NOT NULL,
  organo           TEXT,
  fecha            DATE,
  descripcion      TEXT,
  estado_asunto    TEXT,
  url_fuente       TEXT        NOT NULL,

  leido            BOOLEAN     NOT NULL DEFAULT false,
  auto_detectado   BOOLEAN     NOT NULL DEFAULT true,
  fuente           TEXT        NOT NULL DEFAULT 'CJF-SYNC',

  creado_en        TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Evita duplicados: mismo amparo, misma fecha, misma descripción
  UNIQUE (amparo_id, fecha, descripcion)
);

-- Índices de acceso frecuente
CREATE INDEX IF NOT EXISTS idx_acuerdos_amparo_despacho
  ON acuerdos_amparo_federal (despacho_id, creado_en DESC);

CREATE INDEX IF NOT EXISTS idx_acuerdos_amparo_id
  ON acuerdos_amparo_federal (amparo_id, fecha DESC);

CREATE INDEX IF NOT EXISTS idx_acuerdos_amparo_expediente
  ON acuerdos_amparo_federal (expediente_id, fecha DESC);

CREATE INDEX IF NOT EXISTS idx_acuerdos_amparo_no_leido
  ON acuerdos_amparo_federal (despacho_id, leido) WHERE leido = false;

-- ── RLS ──────────────────────────────────────────────────────────────────────

ALTER TABLE acuerdos_amparo_federal ENABLE ROW LEVEL SECURITY;

-- Los usuarios solo ven acuerdos de su despacho
CREATE POLICY "ver acuerdos amparo de mi despacho"
  ON acuerdos_amparo_federal FOR SELECT
  USING (despacho_id IN (SELECT auth_despacho_ids()));

CREATE POLICY "insertar acuerdos amparo de mi despacho"
  ON acuerdos_amparo_federal FOR INSERT
  WITH CHECK (despacho_id IN (SELECT auth_despacho_ids()));

CREATE POLICY "actualizar acuerdos amparo de mi despacho"
  ON acuerdos_amparo_federal FOR UPDATE
  USING (despacho_id IN (SELECT auth_despacho_ids()));

-- ── Función helper: marcar leídos todos los acuerdos de un amparo ─────────

CREATE OR REPLACE FUNCTION marcar_acuerdos_amparo_leidos(p_amparo_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  UPDATE acuerdos_amparo_federal
  SET leido = true
  WHERE amparo_id = p_amparo_id
    AND leido = false
    AND despacho_id = ANY(auth_despacho_ids());

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;
