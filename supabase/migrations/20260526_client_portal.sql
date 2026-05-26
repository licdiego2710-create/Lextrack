-- ============================================================
-- Migración: Portal de Clientes Seguro y Perfiles de Usuario
-- Fecha: 2026-05-26
-- ============================================================

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

-- Políticas para user_profiles
CREATE POLICY "profiles_select" ON user_profiles
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "profiles_upsert" ON user_profiles
  FOR ALL USING (id = auth.uid()) WITH CHECK (id = auth.uid());


-- 3. Agregar columna cliente_id a la tabla expedientes
ALTER TABLE expedientes
  ADD COLUMN IF NOT EXISTS cliente_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_exp_cliente ON expedientes (cliente_id);


-- 4. Reestructurar Políticas RLS de Expedientes
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
