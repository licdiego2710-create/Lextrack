-- ============================================================
-- LexTrack MX — Migraciones Pendientes (EJECUTAR EN ORDEN)
-- Pega TODO este archivo en el SQL Editor de Supabase:
-- https://supabase.com/dashboard/project/srzyzkiozqtsdzydyouk/sql/new
-- ============================================================


-- ════════════════════════════════════════════════════════════
-- MIGRACIÓN 1: Corrección de RLS y Recursión Infinita
-- ════════════════════════════════════════════════════════════

-- 1. Eliminar políticas con problemas de recursión o faltantes
DROP POLICY IF EXISTS "dm_select" ON despacho_miembros;
DROP POLICY IF EXISTS "dm_insert" ON despacho_miembros;
DROP POLICY IF EXISTS "dm_update" ON despacho_miembros;
DROP POLICY IF EXISTS "despachos_insert" ON despachos;

-- 2. Función helper SECURITY DEFINER para verificar si el usuario es admin del despacho
--    Al ser SECURITY DEFINER se ejecuta con privilegios del creador (bypass RLS) evitando bucles.
CREATE OR REPLACE FUNCTION auth_is_despacho_admin(p_despacho_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM despacho_miembros
    WHERE despacho_id = p_despacho_id
      AND user_id = auth.uid()
      AND rol = 'admin'
      AND activo = true
  );
$$;

-- 3. Política para permitir inserción de nuevos despachos (onboarding)
CREATE POLICY "despachos_insert" ON despachos
  FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL AND owner_id = auth.uid());

-- 4. Nuevas políticas para despacho_miembros sin recursión
CREATE POLICY "dm_select" ON despacho_miembros
  FOR SELECT
  USING (
    user_id = auth.uid()
    OR despacho_id IN (SELECT auth_despacho_ids())
  );

CREATE POLICY "dm_insert" ON despacho_miembros
  FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    OR auth_is_despacho_admin(despacho_id)
  );

CREATE POLICY "dm_update" ON despacho_miembros
  FOR UPDATE
  USING (
    auth_is_despacho_admin(despacho_id)
  );


-- ════════════════════════════════════════════════════════════
-- MIGRACIÓN 2: Portal de Clientes Seguro y Perfiles de Usuario
-- ════════════════════════════════════════════════════════════

-- 1. Actualizar restricción de roles en despacho_miembros para incluir 'cliente'
ALTER TABLE despacho_miembros 
  DROP CONSTRAINT IF EXISTS despacho_miembros_rol_check;

ALTER TABLE despacho_miembros
  ADD CONSTRAINT despacho_miembros_rol_check CHECK (rol IN ('admin', 'abogado', 'asistente', 'cliente'));

-- 2. Crear tabla pública de Perfiles de Usuario
CREATE TABLE IF NOT EXISTS user_profiles (
  id             UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email          TEXT        NOT NULL,
  nombre         TEXT,
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_select" ON user_profiles;
DROP POLICY IF EXISTS "profiles_upsert" ON user_profiles;

CREATE POLICY "profiles_select" ON user_profiles
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "profiles_upsert" ON user_profiles
  FOR ALL USING (id = auth.uid()) WITH CHECK (id = auth.uid());

-- 3. Agregar columna cliente_id a la tabla expedientes
ALTER TABLE expedientes
  ADD COLUMN IF NOT EXISTS cliente_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_exp_cliente ON expedientes (cliente_id);

-- 4. Reestructurar Políticas RLS de Expedientes para portal de clientes
DROP POLICY IF EXISTS "expedientes_select" ON expedientes;
DROP POLICY IF EXISTS "expedientes_insert" ON expedientes;
DROP POLICY IF EXISTS "expedientes_update" ON expedientes;
DROP POLICY IF EXISTS "expedientes_delete" ON expedientes;

-- SELECT: Abogados/Admins ven todo el despacho; clientes solo ven donde son cliente_id
CREATE POLICY "expedientes_select" ON expedientes
  FOR SELECT USING (
    user_id = auth.uid()
    OR (
      despacho_id IN (SELECT auth_despacho_ids())
      AND (
        EXISTS (
          SELECT 1 FROM despacho_miembros
          WHERE user_id = auth.uid()
            AND despacho_id = expedientes.despacho_id
            AND rol IN ('admin', 'abogado', 'asistente')
            AND activo = true
        )
        OR cliente_id = auth.uid()
      )
    )
  );

-- INSERT: Solo abogados o admins del despacho pueden crear expedientes
CREATE POLICY "expedientes_insert" ON expedientes
  FOR INSERT WITH CHECK (
    user_id = auth.uid()
    AND (despacho_id IS NULL OR despacho_id IN (SELECT auth_despacho_ids()))
    AND EXISTS (
      SELECT 1 FROM despacho_miembros
      WHERE user_id = auth.uid()
        AND despacho_id = expedientes.despacho_id
        AND rol IN ('admin', 'abogado')
        AND activo = true
    )
  );

-- UPDATE: Solo abogados o admins
CREATE POLICY "expedientes_update" ON expedientes
  FOR UPDATE USING (
    user_id = auth.uid()
    OR (
      despacho_id IN (SELECT auth_despacho_ids())
      AND EXISTS (
        SELECT 1 FROM despacho_miembros
        WHERE user_id = auth.uid()
          AND despacho_id = expedientes.despacho_id
          AND rol IN ('admin', 'abogado')
          AND activo = true
      )
    )
  );

-- DELETE: Solo admins del despacho
CREATE POLICY "expedientes_delete" ON expedientes
  FOR DELETE USING (
    despacho_id IN (
      SELECT despacho_id FROM despacho_miembros
      WHERE user_id = auth.uid()
        AND rol = 'admin'
        AND activo = true
    )
  );


-- ════════════════════════════════════════════════════════════
-- MIGRACIÓN 3: Cobranza y Facturación de Clientes
-- ════════════════════════════════════════════════════════════

-- 1. Tabla de Registro de Horas
CREATE TABLE IF NOT EXISTS registro_horas (
  id             UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  despacho_id    UUID         NOT NULL REFERENCES despachos(id) ON DELETE CASCADE,
  expediente_id  UUID         NOT NULL REFERENCES expedientes(id) ON DELETE CASCADE,
  user_id        UUID         NOT NULL REFERENCES auth.users(id),
  descripcion    TEXT         NOT NULL,
  horas          NUMERIC(5,2) NOT NULL CHECK (horas > 0),
  tarifa_hora    NUMERIC(10,2) NOT NULL DEFAULT 0.00 CHECK (tarifa_hora >= 0),
  facturable     BOOLEAN      NOT NULL DEFAULT TRUE,
  facturado      BOOLEAN      NOT NULL DEFAULT FALSE,
  fecha          DATE         NOT NULL DEFAULT CURRENT_DATE,
  creado_en      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reg_horas_exp  ON registro_horas (expediente_id);
CREATE INDEX IF NOT EXISTS idx_reg_horas_desp ON registro_horas (despacho_id);

ALTER TABLE registro_horas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "reg_horas_select" ON registro_horas;
DROP POLICY IF EXISTS "reg_horas_insert" ON registro_horas;
DROP POLICY IF EXISTS "reg_horas_update" ON registro_horas;
DROP POLICY IF EXISTS "reg_horas_delete" ON registro_horas;

CREATE POLICY "reg_horas_select" ON registro_horas
  FOR SELECT USING (despacho_id IN (SELECT auth_despacho_ids()));

CREATE POLICY "reg_horas_insert" ON registro_horas
  FOR INSERT WITH CHECK (
    user_id = auth.uid()
    AND despacho_id IN (SELECT auth_despacho_ids())
    AND EXISTS (
      SELECT 1 FROM despacho_miembros
      WHERE user_id = auth.uid()
        AND despacho_id = registro_horas.despacho_id
        AND rol IN ('admin', 'abogado', 'asistente')
        AND activo = true
    )
  );

CREATE POLICY "reg_horas_update" ON registro_horas
  FOR UPDATE USING (
    despacho_id IN (SELECT auth_despacho_ids())
    AND EXISTS (
      SELECT 1 FROM despacho_miembros
      WHERE user_id = auth.uid()
        AND despacho_id = registro_horas.despacho_id
        AND rol IN ('admin', 'abogado', 'asistente')
        AND activo = true
    )
  );

CREATE POLICY "reg_horas_delete" ON registro_horas
  FOR DELETE USING (
    despacho_id IN (SELECT auth_despacho_ids())
    AND EXISTS (
      SELECT 1 FROM despacho_miembros
      WHERE user_id = auth.uid()
        AND despacho_id = registro_horas.despacho_id
        AND rol IN ('admin', 'abogado', 'asistente')
        AND activo = true
    )
  );

-- 2. Tabla de Registro de Gastos
CREATE TABLE IF NOT EXISTS registro_gastos (
  id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  despacho_id     UUID         NOT NULL REFERENCES despachos(id) ON DELETE CASCADE,
  expediente_id   UUID         NOT NULL REFERENCES expedientes(id) ON DELETE CASCADE,
  concepto        TEXT         NOT NULL,
  monto           NUMERIC(10,2) NOT NULL CHECK (monto > 0),
  fecha           DATE         NOT NULL DEFAULT CURRENT_DATE,
  facturado       BOOLEAN      NOT NULL DEFAULT FALSE,
  comprobante_url TEXT,
  creado_en       TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reg_gastos_exp  ON registro_gastos (expediente_id);
CREATE INDEX IF NOT EXISTS idx_reg_gastos_desp ON registro_gastos (despacho_id);

ALTER TABLE registro_gastos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "reg_gastos_select" ON registro_gastos;
DROP POLICY IF EXISTS "reg_gastos_insert" ON registro_gastos;
DROP POLICY IF EXISTS "reg_gastos_update" ON registro_gastos;
DROP POLICY IF EXISTS "reg_gastos_delete" ON registro_gastos;

CREATE POLICY "reg_gastos_select" ON registro_gastos
  FOR SELECT USING (
    expediente_id IN (SELECT id FROM expedientes)
  );

CREATE POLICY "reg_gastos_insert" ON registro_gastos
  FOR INSERT WITH CHECK (
    despacho_id IN (SELECT auth_despacho_ids())
    AND EXISTS (
      SELECT 1 FROM despacho_miembros
      WHERE user_id = auth.uid()
        AND despacho_id = registro_gastos.despacho_id
        AND rol IN ('admin', 'abogado', 'asistente')
        AND activo = true
    )
  );

CREATE POLICY "reg_gastos_update" ON registro_gastos
  FOR UPDATE USING (
    despacho_id IN (SELECT auth_despacho_ids())
    AND EXISTS (
      SELECT 1 FROM despacho_miembros
      WHERE user_id = auth.uid()
        AND despacho_id = registro_gastos.despacho_id
        AND rol IN ('admin', 'abogado', 'asistente')
        AND activo = true
    )
  );

CREATE POLICY "reg_gastos_delete" ON registro_gastos
  FOR DELETE USING (
    despacho_id IN (SELECT auth_despacho_ids())
    AND EXISTS (
      SELECT 1 FROM despacho_miembros
      WHERE user_id = auth.uid()
        AND despacho_id = registro_gastos.despacho_id
        AND rol IN ('admin', 'abogado', 'asistente')
        AND activo = true
    )
  );


-- ════════════════════════════════════════════════════════════
-- MIGRACIÓN 4: Robustez de RLS para el Portal de Clientes
-- ════════════════════════════════════════════════════════════

-- 1. RLS para actuaciones
DROP POLICY IF EXISTS "actuaciones_select" ON actuaciones;
DROP POLICY IF EXISTS "actuaciones_insert" ON actuaciones;
DROP POLICY IF EXISTS "actuaciones_update" ON actuaciones;
DROP POLICY IF EXISTS "actuaciones_delete" ON actuaciones;

CREATE POLICY "actuaciones_select" ON actuaciones
  FOR SELECT USING (
    expediente_id IN (SELECT id FROM expedientes)
  );

CREATE POLICY "actuaciones_insert" ON actuaciones
  FOR INSERT WITH CHECK (
    user_id = auth.uid()
    AND expediente_id IN (
      SELECT id FROM expedientes
      WHERE EXISTS (
        SELECT 1 FROM despacho_miembros
        WHERE user_id = auth.uid()
          AND despacho_id = expedientes.despacho_id
          AND rol IN ('admin', 'abogado', 'asistente')
          AND activo = true
      )
    )
  );

CREATE POLICY "actuaciones_update" ON actuaciones
  FOR UPDATE USING (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM despacho_miembros
      WHERE user_id = auth.uid()
        AND rol IN ('admin', 'abogado', 'asistente')
        AND activo = true
    )
  );

CREATE POLICY "actuaciones_delete" ON actuaciones
  FOR DELETE USING (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM despacho_miembros
      WHERE user_id = auth.uid()
        AND rol IN ('admin', 'abogado', 'asistente')
        AND activo = true
    )
  );

-- 2. RLS para documentos
DROP POLICY IF EXISTS "documentos_select" ON documentos;
DROP POLICY IF EXISTS "documentos_insert" ON documentos;
DROP POLICY IF EXISTS "documentos_delete" ON documentos;

CREATE POLICY "documentos_select" ON documentos
  FOR SELECT USING (
    expediente_id IN (SELECT id FROM expedientes)
  );

CREATE POLICY "documentos_insert" ON documentos
  FOR INSERT WITH CHECK (
    user_id = auth.uid()
    AND expediente_id IN (
      SELECT id FROM expedientes
      WHERE EXISTS (
        SELECT 1 FROM despacho_miembros
        WHERE user_id = auth.uid()
          AND despacho_id = expedientes.despacho_id
          AND rol IN ('admin', 'abogado', 'asistente')
          AND activo = true
      )
    )
  );

CREATE POLICY "documentos_delete" ON documentos
  FOR DELETE USING (
    expediente_id IN (
      SELECT id FROM expedientes
      WHERE EXISTS (
        SELECT 1 FROM despacho_miembros
        WHERE user_id = auth.uid()
          AND despacho_id = expedientes.despacho_id
          AND rol IN ('admin', 'abogado', 'asistente')
          AND activo = true
      )
    )
  );

-- 3. RLS para acuerdos_boletin
DROP POLICY IF EXISTS "acuerdos_boletin_propios" ON acuerdos_boletin;
DROP POLICY IF EXISTS "acuerdos_boletin_select" ON acuerdos_boletin;
DROP POLICY IF EXISTS "acuerdos_boletin_write" ON acuerdos_boletin;

CREATE POLICY "acuerdos_boletin_select" ON acuerdos_boletin
  FOR SELECT USING (
    expediente_id IN (SELECT id FROM expedientes)
  );

CREATE POLICY "acuerdos_boletin_write" ON acuerdos_boletin
  FOR ALL USING (
    expediente_id IN (
      SELECT id FROM expedientes
      WHERE EXISTS (
        SELECT 1 FROM despacho_miembros
        WHERE user_id = auth.uid()
          AND despacho_id = expedientes.despacho_id
          AND rol IN ('admin', 'abogado', 'asistente')
          AND activo = true
      )
    )
  );


-- ════════════════════════════════════════════════════════════
-- MIGRACIÓN 5: Automatización de Documentos (Plantillas)
-- ════════════════════════════════════════════════════════════

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

DROP POLICY IF EXISTS "plantillas_select" ON plantillas_documentos;
DROP POLICY IF EXISTS "plantillas_write" ON plantillas_documentos;

-- SELECT: Solo miembros activos (admin, abogado, asistente) del despacho
CREATE POLICY "plantillas_select" ON plantillas_documentos
  FOR SELECT USING (
    despacho_id IN (
      SELECT despacho_id FROM despacho_miembros
      WHERE user_id = auth.uid()
        AND rol IN ('admin', 'abogado', 'asistente')
        AND activo = true
    )
  );

-- WRITE: Solo administradores y abogados activos del despacho
CREATE POLICY "plantillas_write" ON plantillas_documentos
  FOR ALL USING (
    despacho_id IN (
      SELECT despacho_id FROM despacho_miembros
      WHERE user_id = auth.uid()
        AND rol IN ('admin', 'abogado')
        AND activo = true
    )
  );


-- ════════════════════════════════════════════════════════════
-- MIGRACIÓN 6: Captura Manual y Flujos de Trabajo (Mejoras Despacho)
-- ════════════════════════════════════════════════════════════

-- 1. Nuevas columnas en la tabla de expedientes
ALTER TABLE expedientes
  ADD COLUMN IF NOT EXISTS anio                INTEGER,
  ADD COLUMN IF NOT EXISTS partido_judicial    TEXT,
  ADD COLUMN IF NOT EXISTS abogado_responsable TEXT,
  ADD COLUMN IF NOT EXISTS fecha_inicio        DATE,
  ADD COLUMN IF NOT EXISTS ultimo_acuerdo      TEXT,
  ADD COLUMN IF NOT EXISTS proxima_fecha        DATE;

-- 2. Eliminar restricciones antiguas de check en prospectos
ALTER TABLE prospectos
  DROP CONSTRAINT IF EXISTS prospectos_etapa_check,
  DROP CONSTRAINT IF EXISTS prospectos_prioridad_check;

-- 3. Nuevas columnas en la tabla de prospectos
ALTER TABLE prospectos
  ADD COLUMN IF NOT EXISTS fuente_contacto     TEXT,
  ADD COLUMN IF NOT EXISTS tipo_asunto         TEXT,
  ADD COLUMN IF NOT EXISTS descripcion_caso     TEXT,
  ADD COLUMN IF NOT EXISTS urgencia            TEXT DEFAULT 'media',
  ADD COLUMN IF NOT EXISTS responsable         TEXT,
  ADD COLUMN IF NOT EXISTS fecha_contacto      DATE,
  ADD COLUMN IF NOT EXISTS proximo_seguimiento DATE,
  ADD COLUMN IF NOT EXISTS observaciones       TEXT;

-- 4. Nuevas columnas en la tabla de actuaciones
ALTER TABLE actuaciones
  ADD COLUMN IF NOT EXISTS tipo_actuacion      TEXT,
  ADD COLUMN IF NOT EXISTS genera_termino      BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS fecha_vencimiento   DATE,
  ADD COLUMN IF NOT EXISTS responsable         TEXT,
  ADD COLUMN IF NOT EXISTS estatus_cumplimiento TEXT DEFAULT 'Pendiente';

-- 5. Crear tabla para expediente_partes
CREATE TABLE IF NOT EXISTS expediente_partes (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  expediente_id  UUID        NOT NULL REFERENCES expedientes(id) ON DELETE CASCADE,
  despacho_id    UUID        REFERENCES despachos(id) ON DELETE CASCADE,
  nombre         TEXT        NOT NULL,
  rol            TEXT        NOT NULL, -- Actor, Demandado, Tercero, Apoderado, Autorizado
  domicilio      TEXT,
  correo         TEXT,
  telefono       TEXT,
  observaciones  TEXT,
  creado_en      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_expediente_partes_exp ON expediente_partes(expediente_id);

-- Habilitar RLS en expediente_partes
ALTER TABLE expediente_partes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "expediente_partes_select" ON expediente_partes
  FOR SELECT USING (expediente_id IN (SELECT id FROM expedientes));

CREATE POLICY "expediente_partes_write" ON expediente_partes
  FOR ALL USING (
    expediente_id IN (
      SELECT id FROM expedientes
      WHERE EXISTS (
        SELECT 1 FROM despacho_miembros
        WHERE user_id = auth.uid()
          AND despacho_id = expedientes.despacho_id
          AND rol IN ('admin', 'abogado', 'asistente')
          AND activo = true
      )
    )
  );

-- 6. Crear tabla para expediente_audiencias
CREATE TABLE IF NOT EXISTS expediente_audiencias (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  expediente_id  UUID        NOT NULL REFERENCES expedientes(id) ON DELETE CASCADE,
  despacho_id    UUID        REFERENCES despachos(id) ON DELETE CASCADE,
  titulo         TEXT        NOT NULL,
  fecha_hora     TIMESTAMPTZ NOT NULL,
  lugar          TEXT,
  observaciones  TEXT,
  creado_en      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_expediente_audiencias_exp ON expediente_audiencias(expediente_id);

-- Habilitar RLS en expediente_audiencias
ALTER TABLE expediente_audiencias ENABLE ROW LEVEL SECURITY;

CREATE POLICY "expediente_audiencias_select" ON expediente_audiencias
  FOR SELECT USING (expediente_id IN (SELECT id FROM expedientes));

CREATE POLICY "expediente_audiencias_write" ON expediente_audiencias
  FOR ALL USING (
    expediente_id IN (
      SELECT id FROM expedientes
      WHERE EXISTS (
        SELECT 1 FROM despacho_miembros
        WHERE user_id = auth.uid()
          AND despacho_id = expedientes.despacho_id
          AND rol IN ('admin', 'abogado', 'asistente')
          AND activo = true
      )
    )
  );

-- 7. Crear tabla para expediente_fuentes
CREATE TABLE IF NOT EXISTS expediente_fuentes (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  expediente_id  UUID        NOT NULL REFERENCES expedientes(id) ON DELETE CASCADE,
  despacho_id    UUID        REFERENCES despachos(id) ON DELETE CASCADE,
  nombre         TEXT        NOT NULL,
  tipo           TEXT, -- CJF, Poder Judicial, Boletín, Otro
  url            TEXT,
  num_externo    TEXT,
  organo         TEXT,
  ultima_consulta DATE,
  observaciones  TEXT,
  creado_en      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_expediente_fuentes_exp ON expediente_fuentes(expediente_id);

-- Habilitar RLS en expediente_fuentes
ALTER TABLE expediente_fuentes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "expediente_fuentes_select" ON expediente_fuentes
  FOR SELECT USING (expediente_id IN (SELECT id FROM expedientes));

CREATE POLICY "expediente_fuentes_write" ON expediente_fuentes
  FOR ALL USING (
    expediente_id IN (
      SELECT id FROM expedientes
      WHERE EXISTS (
        SELECT 1 FROM despacho_miembros
        WHERE user_id = auth.uid()
          AND despacho_id = expedientes.despacho_id
          AND rol IN ('admin', 'abogado', 'asistente')
          AND activo = true
      )
    )
  );


-- ════════════════════════════════════════════════════════════
-- FIN — Todas las migraciones aplicadas
-- ════════════════════════════════════════════════════════════
SELECT 'Migraciones aplicadas correctamente ✅' AS resultado;
