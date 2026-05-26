-- ============================================================
-- Migración: Corrección de RLS y Recursión Infinita
-- Fecha: 2026-05-26
-- ============================================================

-- 1. Eliminar políticas con problemas de recursión o faltantes
DROP POLICY IF EXISTS "dm_select" ON despacho_miembros;
DROP POLICY IF EXISTS "dm_insert" ON despacho_miembros;
DROP POLICY IF EXISTS "dm_update" ON despacho_miembros;
DROP POLICY IF EXISTS "despachos_insert" ON despachos;

-- 2. Crear función helper con SECURITY DEFINER para verificar si el usuario es administrador del despacho
-- Al ser SECURITY DEFINER, se ejecuta con los privilegios del creador (bypass RLS) evitando bucles de recursión.
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

-- 3. Crear política para permitir la inserción de nuevos despachos (necesario para el registro/onboarding)
CREATE POLICY "despachos_insert" ON despachos
  FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL AND owner_id = auth.uid());

-- 4. Crear nuevas políticas para despacho_miembros seguras y sin recursión
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
