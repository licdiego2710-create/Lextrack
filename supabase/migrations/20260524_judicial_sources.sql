-- ============================================================
-- Migración: Fuentes Judiciales Ampliadas — LexTrack MX
-- Fecha: 2026-05-24
-- Agrega:
--   1. Catálogo dinámico de partidos judiciales y juzgados
--   2. Tabla de amparos federales (DGEJ-CJF Tercer Circuito)
--   3. Log de sincronización de catálogos
-- ============================================================


-- ── 1. PARTIDOS JUDICIALES Y JUZGADOS (catálogo dinámico) ───
-- Permite almacenar juzgados de cualquier partido judicial de
-- Jalisco leídos dinámicamente del portal CJJ, sin hardcodear.

CREATE TABLE IF NOT EXISTS juzgados_catalogo (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  fuente          TEXT        NOT NULL CHECK (fuente IN ('CJJ','CJF')),
  partido_judicial TEXT       NOT NULL,          -- ej: "Guadalajara ZMG", "Lagos de Moreno", "Puerto Vallarta"
  nombre          TEXT        NOT NULL,           -- ej: "Noveno Mercantil"
  cve_juz         TEXT,                           -- código API CJJ (si aplica)
  circuito        TEXT,                           -- para CJF: "3" = Jalisco
  materia         TEXT,
  municipio       TEXT,
  tipo_organo     TEXT,                           -- "juzgado" | "sala" | "tribunal"
  endpoint_api    TEXT,                           -- endpoint específico de la API, si existe
  activo          BOOLEAN     NOT NULL DEFAULT TRUE,
  actualizado_en  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (fuente, partido_judicial, nombre)
);

CREATE INDEX IF NOT EXISTS idx_juzcat_fuente  ON juzgados_catalogo (fuente, partido_judicial);
CREATE INDEX IF NOT EXISTS idx_juzcat_cve     ON juzgados_catalogo (cve_juz) WHERE cve_juz IS NOT NULL;


-- ── 2. AMPAROS FEDERALES (DGEJ-CJF Tercer Circuito Jalisco) ──
-- Almacena resultados de búsquedas en el portal del CJF.
-- Fuente oficial: https://www.dgej.cjf.gob.mx/internet/expedientes/circuitos.asp

CREATE TABLE IF NOT EXISTS amparos_federales (
  id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Vínculo opcional con expediente interno
  expediente_id        UUID        REFERENCES expedientes(id) ON DELETE SET NULL,
  despacho_id          UUID        REFERENCES despachos(id)  ON DELETE CASCADE,
  user_id              UUID        REFERENCES auth.users(id),
  -- Datos del amparo
  num_amparo           TEXT        NOT NULL,      -- ej: "1234/2024"
  tipo_asunto          TEXT,                      -- "Amparo Directo", "Amparo Indirecto", "Recurso de Revisión"
  organo               TEXT        NOT NULL,      -- nombre del juzgado/tribunal federal
  circuito             TEXT        NOT NULL DEFAULT '3',  -- Jalisco = Tercer Circuito
  ponente              TEXT,
  actor                TEXT,                      -- quejoso
  autoridad_responsable TEXT,
  fecha_presentacion   DATE,
  fecha_acuerdo        DATE,                      -- fecha del acuerdo más reciente
  descripcion_acuerdo  TEXT,                      -- texto del último acuerdo
  estado_asunto        TEXT,                      -- estado en el tribunal
  -- Trazabilidad obligatoria
  url_fuente           TEXT        NOT NULL,      -- URL oficial de origen (DGEJ-CJF)
  fuente               TEXT        NOT NULL DEFAULT 'DGEJ-CJF',
  -- Control
  leido                BOOLEAN     NOT NULL DEFAULT FALSE,
  auto_detectado       BOOLEAN     NOT NULL DEFAULT FALSE,
  creado_en            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  actualizado_en       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (num_amparo, organo, circuito)
);

CREATE INDEX IF NOT EXISTS idx_af_despacho  ON amparos_federales (despacho_id);
CREATE INDEX IF NOT EXISTS idx_af_exp       ON amparos_federales (expediente_id) WHERE expediente_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_af_num       ON amparos_federales (num_amparo);
CREATE INDEX IF NOT EXISTS idx_af_leido     ON amparos_federales (leido) WHERE NOT leido;

ALTER TABLE amparos_federales ENABLE ROW LEVEL SECURITY;

CREATE POLICY "af_select" ON amparos_federales
  FOR SELECT
  USING (
    user_id = auth.uid()
    OR despacho_id IN (SELECT auth_despacho_ids())
  );

CREATE POLICY "af_insert" ON amparos_federales
  FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND (despacho_id IS NULL OR despacho_id IN (SELECT auth_despacho_ids()))
  );

CREATE POLICY "af_update" ON amparos_federales
  FOR UPDATE
  USING (
    user_id = auth.uid()
    OR despacho_id IN (SELECT auth_despacho_ids())
  );

CREATE POLICY "af_delete" ON amparos_federales
  FOR DELETE
  USING (
    despacho_id IN (
      SELECT despacho_id FROM despacho_miembros
      WHERE user_id = auth.uid() AND rol IN ('admin','abogado') AND activo = true
    )
  );


-- ── 3. COLUMNA fuente EN acuerdos_boletin ────────────────────
-- Identifica de qué fuente proviene cada acuerdo:
-- 'CJJ-ZMG' (original), 'CJJ-FORANEO', 'CJF-TERCER-CIRCUITO'

ALTER TABLE acuerdos_boletin
  ADD COLUMN IF NOT EXISTS fuente     TEXT NOT NULL DEFAULT 'CJJ-ZMG',
  ADD COLUMN IF NOT EXISTS url_fuente TEXT,
  ADD COLUMN IF NOT EXISTS organo     TEXT,
  ADD COLUMN IF NOT EXISTS partido_judicial TEXT;

CREATE INDEX IF NOT EXISTS idx_acboletin_fuente
  ON acuerdos_boletin (fuente, fecha);


-- ── 4. LOG DE SINCRONIZACIÓN ──────────────────────────────────
-- Registra cada ejecución del sync de catálogo para auditoría.

CREATE TABLE IF NOT EXISTS catalogo_sync_log (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  fuente      TEXT        NOT NULL,
  tipo        TEXT        NOT NULL,    -- 'catalogo' | 'acuerdos' | 'amparos'
  estado      TEXT        NOT NULL,    -- 'ok' | 'error' | 'parcial'
  registros   INTEGER     DEFAULT 0,
  mensaje     TEXT,
  ejecutado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ── 5. FUNCIÓN: amparo a actuación ───────────────────────────
-- Permite vincular un amparo federal encontrado a un expediente
-- interno y crear la actuación correspondiente.

CREATE OR REPLACE FUNCTION vincular_amparo_a_expediente(
  p_amparo_id    UUID,
  p_expediente_id UUID
)
RETURNS VOID
LANGUAGE PLPGSQL
SECURITY DEFINER
AS $$
DECLARE
  v_amparo amparos_federales%ROWTYPE;
BEGIN
  SELECT * INTO v_amparo FROM amparos_federales WHERE id = p_amparo_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Amparo no encontrado'; END IF;

  -- Vincular
  UPDATE amparos_federales
  SET expediente_id = p_expediente_id, actualizado_en = NOW()
  WHERE id = p_amparo_id;

  -- Crear actuación automática
  INSERT INTO actuaciones (
    expediente_id, descripcion, fecha, user_id, despacho_id, creado_en
  )
  SELECT
    p_expediente_id,
    '[Auto-detectado / Amparo Federal CJF] ' || COALESCE(v_amparo.tipo_asunto,'') ||
    ' — ' || v_amparo.organo ||
    CASE WHEN v_amparo.descripcion_acuerdo IS NOT NULL
         THEN ': ' || LEFT(v_amparo.descripcion_acuerdo, 300)
         ELSE '' END,
    COALESCE(v_amparo.fecha_acuerdo, CURRENT_DATE),
    v_amparo.user_id,
    v_amparo.despacho_id,
    NOW()
  FROM amparos_federales WHERE id = p_amparo_id;
END;
$$;
