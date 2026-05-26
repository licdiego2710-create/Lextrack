-- ============================================================
-- Migración: Cobranza y Facturación de Clientes
-- Fecha: 2026-05-26
-- ============================================================

-- 1. Tabla de Registro de Horas
CREATE TABLE IF NOT EXISTS registro_horas (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  despacho_id    UUID        NOT NULL REFERENCES despachos(id) ON DELETE CASCADE,
  expediente_id  UUID        NOT NULL REFERENCES expedientes(id) ON DELETE CASCADE,
  user_id        UUID        NOT NULL REFERENCES auth.users(id),
  descripcion    TEXT        NOT NULL,
  horas          NUMERIC(5,2) NOT NULL CHECK (horas > 0),
  tarifa_hora    NUMERIC(10,2) NOT NULL DEFAULT 0.00 CHECK (tarifa_hora >= 0),
  facturable     BOOLEAN     NOT NULL DEFAULT TRUE,
  facturado      BOOLEAN     NOT NULL DEFAULT FALSE,
  fecha          DATE        NOT NULL DEFAULT CURRENT_DATE,
  creado_en      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reg_horas_exp ON registro_horas (expediente_id);
CREATE INDEX IF NOT EXISTS idx_reg_horas_desp ON registro_horas (despacho_id);

ALTER TABLE registro_horas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "reg_horas_select" ON registro_horas
  FOR SELECT USING (despacho_id IN (SELECT auth_despacho_ids()));

CREATE POLICY "reg_horas_insert" ON registro_horas
  FOR INSERT WITH CHECK (
    user_id = auth.uid()
    AND despacho_id IN (SELECT auth_despacho_ids())
  );

CREATE POLICY "reg_horas_update" ON registro_horas
  FOR UPDATE USING (despacho_id IN (SELECT auth_despacho_ids()));

CREATE POLICY "reg_horas_delete" ON registro_horas
  FOR DELETE USING (despacho_id IN (SELECT auth_despacho_ids()));


-- 2. Tabla de Registro de Gastos
CREATE TABLE IF NOT EXISTS registro_gastos (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  despacho_id    UUID        NOT NULL REFERENCES despachos(id) ON DELETE CASCADE,
  expediente_id  UUID        NOT NULL REFERENCES expedientes(id) ON DELETE CASCADE,
  concepto       TEXT        NOT NULL,
  monto          NUMERIC(10,2) NOT NULL CHECK (monto > 0),
  fecha          DATE        NOT NULL DEFAULT CURRENT_DATE,
  facturado      BOOLEAN     NOT NULL DEFAULT FALSE,
  comprobante_url TEXT,
  creado_en      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reg_gastos_exp ON registro_gastos (expediente_id);
CREATE INDEX IF NOT EXISTS idx_reg_gastos_desp ON registro_gastos (despacho_id);

ALTER TABLE registro_gastos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "reg_gastos_select" ON registro_gastos
  FOR SELECT USING (despacho_id IN (SELECT auth_despacho_ids()));

CREATE POLICY "reg_gastos_insert" ON registro_gastos
  FOR INSERT WITH CHECK (despacho_id IN (SELECT auth_despacho_ids()));

CREATE POLICY "reg_gastos_update" ON registro_gastos
  FOR UPDATE USING (despacho_id IN (SELECT auth_despacho_ids()));

CREATE POLICY "reg_gastos_delete" ON registro_gastos
  FOR DELETE USING (despacho_id IN (SELECT auth_despacho_ids()));
