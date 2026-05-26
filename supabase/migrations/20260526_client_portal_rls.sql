-- ============================================================
-- Migración: Robustez de RLS para el Portal de Clientes
-- Fecha: 2026-05-26
-- ============================================================

-- 1. Actualizar RLS para actuaciones
DROP POLICY IF EXISTS "actuaciones_select" ON actuaciones;
DROP POLICY IF EXISTS "actuaciones_insert" ON actuaciones;
DROP POLICY IF EXISTS "actuaciones_update" ON actuaciones;
DROP POLICY IF EXISTS "actuaciones_delete" ON actuaciones;

-- SELECT: Permite ver si el expediente es visible (según la RLS de expedientes)
CREATE POLICY "actuaciones_select" ON actuaciones
  FOR SELECT
  USING (
    expediente_id IN (SELECT id FROM expedientes)
  );

-- INSERT: Solo abogados/admins del despacho del expediente
CREATE POLICY "actuaciones_insert" ON actuaciones
  FOR INSERT
  WITH CHECK (
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

-- UPDATE: Solo creador si es abogado/admin/asistente activo
CREATE POLICY "actuaciones_update" ON actuaciones
  FOR UPDATE
  USING (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM despacho_miembros
      WHERE user_id = auth.uid()
        AND rol IN ('admin', 'abogado', 'asistente')
        AND activo = true
    )
  );

-- DELETE: Solo creador si es abogado/admin/asistente activo
CREATE POLICY "actuaciones_delete" ON actuaciones
  FOR DELETE
  USING (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM despacho_miembros
      WHERE user_id = auth.uid()
        AND rol IN ('admin', 'abogado', 'asistente')
        AND activo = true
    )
  );


-- 2. Actualizar RLS para documentos
DROP POLICY IF EXISTS "documentos_select" ON documentos;
DROP POLICY IF EXISTS "documentos_insert" ON documentos;
DROP POLICY IF EXISTS "documentos_delete" ON documentos;

-- SELECT: Permite ver si el expediente es visible
CREATE POLICY "documentos_select" ON documentos
  FOR SELECT
  USING (
    expediente_id IN (SELECT id FROM expedientes)
  );

-- INSERT: Solo abogados/admins del despacho del expediente
CREATE POLICY "documentos_insert" ON documentos
  FOR INSERT
  WITH CHECK (
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

-- DELETE: Solo abogados/admins del despacho del expediente
CREATE POLICY "documentos_delete" ON documentos
  FOR DELETE
  USING (
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


-- 3. Actualizar RLS para acuerdos_boletin
DROP POLICY IF EXISTS "acuerdos_boletin_propios" ON acuerdos_boletin;
DROP POLICY IF EXISTS "acuerdos_boletin_select" ON acuerdos_boletin;
DROP POLICY IF EXISTS "acuerdos_boletin_write" ON acuerdos_boletin;

-- SELECT: Permite ver si el expediente es visible
CREATE POLICY "acuerdos_boletin_select" ON acuerdos_boletin
  FOR SELECT
  USING (
    expediente_id IN (SELECT id FROM expedientes)
  );

-- WRITE (INSERT/UPDATE/DELETE): Solo abogados/admins/asistentes activos
CREATE POLICY "acuerdos_boletin_write" ON acuerdos_boletin
  FOR ALL
  USING (
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


-- 4. Actualizar RLS para registro_horas
DROP POLICY IF EXISTS "reg_horas_select" ON registro_horas;
DROP POLICY IF EXISTS "reg_horas_insert" ON registro_horas;
DROP POLICY IF EXISTS "reg_horas_update" ON registro_horas;
DROP POLICY IF EXISTS "reg_horas_delete" ON registro_horas;

CREATE POLICY "reg_horas_select" ON registro_horas
  FOR SELECT
  USING (
    expediente_id IN (SELECT id FROM expedientes)
  );

CREATE POLICY "reg_horas_insert" ON registro_horas
  FOR INSERT
  WITH CHECK (
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
  FOR UPDATE
  USING (
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
  FOR DELETE
  USING (
    despacho_id IN (SELECT auth_despacho_ids())
    AND EXISTS (
      SELECT 1 FROM despacho_miembros
      WHERE user_id = auth.uid()
        AND despacho_id = registro_horas.despacho_id
        AND rol IN ('admin', 'abogado', 'asistente')
        AND activo = true
    )
  );


-- 5. Actualizar RLS para registro_gastos
DROP POLICY IF EXISTS "reg_gastos_select" ON registro_gastos;
DROP POLICY IF EXISTS "reg_gastos_insert" ON registro_gastos;
DROP POLICY IF EXISTS "reg_gastos_update" ON registro_gastos;
DROP POLICY IF EXISTS "reg_gastos_delete" ON registro_gastos;

CREATE POLICY "reg_gastos_select" ON registro_gastos
  FOR SELECT
  USING (
    expediente_id IN (SELECT id FROM expedientes)
  );

CREATE POLICY "reg_gastos_insert" ON registro_gastos
  FOR INSERT
  WITH CHECK (
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
  FOR UPDATE
  USING (
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
  FOR DELETE
  USING (
    despacho_id IN (SELECT auth_despacho_ids())
    AND EXISTS (
      SELECT 1 FROM despacho_miembros
      WHERE user_id = auth.uid()
        AND despacho_id = registro_gastos.despacho_id
        AND rol IN ('admin', 'abogado', 'asistente')
        AND activo = true
    )
  );
