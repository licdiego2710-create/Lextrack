-- ─────────────────────────────────────────────────────────────────────────────
-- Índice de partes judiciales para búsqueda por nombre
-- Alimentado por el scraper nocturno del boletín CJJ Jalisco
-- ─────────────────────────────────────────────────────────────────────────────

-- Columnas adicionales en acuerdos_boletin para almacenar partes
ALTER TABLE acuerdos_boletin
  ADD COLUMN IF NOT EXISTS actor     TEXT,
  ADD COLUMN IF NOT EXISTS demandado TEXT;

-- ── Tabla principal de partes ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS partes_judiciales (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  acuerdo_id      UUID        REFERENCES acuerdos_boletin(id) ON DELETE CASCADE,

  expediente_num  TEXT        NOT NULL,
  nombre          TEXT        NOT NULL,   -- nombre normalizado (mayúsculas, sin acentos)
  nombre_raw      TEXT        NOT NULL,   -- texto original
  rol             TEXT,                   -- 'actor' | 'demandado' | 'parte'
  juzgado         TEXT,
  materia         TEXT,
  partido_judicial TEXT,
  fecha           DATE,
  fuente          TEXT        NOT NULL DEFAULT 'CJJ',
  url_fuente      TEXT,

  creado_en       TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (acuerdo_id, nombre, rol)
);

-- Índice full-text para búsqueda por nombre
CREATE INDEX IF NOT EXISTS idx_partes_fts
  ON partes_judiciales
  USING gin(to_tsvector('spanish', nombre));

-- Índice trigrama para búsqueda parcial (LIKE '%nombre%')
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS idx_partes_trgm
  ON partes_judiciales
  USING gin(nombre gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_partes_expediente
  ON partes_judiciales (expediente_num);

CREATE INDEX IF NOT EXISTS idx_partes_fecha
  ON partes_judiciales (fecha DESC);

CREATE INDEX IF NOT EXISTS idx_partes_materia
  ON partes_judiciales (materia, fecha DESC);

-- ── Función de búsqueda ────────────────────────────────────────────────────
-- Retorna expedientes donde aparece el nombre buscado, con conteos por materia

CREATE OR REPLACE FUNCTION buscar_partes(
  p_nombre        TEXT,
  p_materia       TEXT    DEFAULT NULL,
  p_partido       TEXT    DEFAULT NULL,
  p_fecha_desde   DATE    DEFAULT NULL,
  p_fecha_hasta   DATE    DEFAULT NULL,
  p_limit         INTEGER DEFAULT 100
)
RETURNS TABLE (
  expediente_num  TEXT,
  actor           TEXT,
  demandado       TEXT,
  juzgado         TEXT,
  materia         TEXT,
  partido_judicial TEXT,
  fecha           DATE,
  url_fuente      TEXT,
  rol_buscado     TEXT,
  total_acuerdos  BIGINT
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    p.expediente_num,
    MAX(CASE WHEN p.rol = 'actor'    THEN p.nombre_raw END) AS actor,
    MAX(CASE WHEN p.rol = 'demandado' THEN p.nombre_raw END) AS demandado,
    MAX(p.juzgado)           AS juzgado,
    MAX(p.materia)           AS materia,
    MAX(p.partido_judicial)  AS partido_judicial,
    MAX(p.fecha)             AS fecha,
    MAX(p.url_fuente)        AS url_fuente,
    STRING_AGG(DISTINCT p.rol, ', ') AS rol_buscado,
    COUNT(*)                 AS total_acuerdos
  FROM partes_judiciales p
  WHERE
    p.nombre % unaccent(upper(p_nombre))   -- trigrama similarity
    OR p.nombre ILIKE '%' || p_nombre || '%'
  AND (p_materia IS NULL OR p.materia = p_materia)
  AND (p_partido IS NULL OR p.partido_judicial ILIKE '%' || p_partido || '%')
  AND (p_fecha_desde IS NULL OR p.fecha >= p_fecha_desde)
  AND (p_fecha_hasta IS NULL OR p.fecha <= p_fecha_hasta)
  GROUP BY p.expediente_num
  ORDER BY MAX(p.fecha) DESC NULLS LAST
  LIMIT p_limit;
$$;

-- Instalar unaccent para ignorar acentos en búsqueda
CREATE EXTENSION IF NOT EXISTS unaccent;

-- ── RLS — tabla pública (datos del boletín oficial, no datos privados) ─────

ALTER TABLE partes_judiciales ENABLE ROW LEVEL SECURITY;

-- Cualquier usuario autenticado puede buscar (datos son públicos del boletín)
CREATE POLICY "partes publicas para usuarios autenticados"
  ON partes_judiciales FOR SELECT
  TO authenticated
  USING (true);

-- Solo el service_role puede insertar/actualizar (scraper usa service key)
CREATE POLICY "solo service puede escribir partes"
  ON partes_judiciales FOR INSERT
  TO service_role
  WITH CHECK (true);
