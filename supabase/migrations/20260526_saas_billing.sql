-- ============================================================
-- Migración: SaaS Billing — LexTrack MX
-- Fecha: 2026-05-26
-- ============================================================

ALTER TABLE despachos
  ADD COLUMN IF NOT EXISTS stripe_customer_id      TEXT,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id  TEXT,
  ADD COLUMN IF NOT EXISTS stripe_status           TEXT,
  ADD COLUMN IF NOT EXISTS stripe_price_id          TEXT;

CREATE INDEX IF NOT EXISTS idx_despachos_stripe_cust ON despachos (stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_despachos_stripe_sub ON despachos (stripe_subscription_id);

-- Actualizar políticas de despachos para permitir la visualización de facturación a miembros
DO $$ BEGIN
  DROP POLICY IF EXISTS "despachos_select_members" ON despachos;
EXCEPTION WHEN undefined_object THEN NULL;
END $$;
