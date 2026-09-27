-- LOCAL ONLY: apply after 040 and 046, before enabling production.
-- Every future production launch records the material actually spent in grams.
-- The number is immutable with the event; migration 048 adds the physical
-- filament/colour ledger that is consumed in the same production transaction.
ALTER TABLE print3d_production_events
  ADD COLUMN material_consumed_grams DECIMAL(12,3) NULL AFTER rejected_quantity,
  ADD CONSTRAINT chk_print3d_event_material_grams
    CHECK (material_consumed_grams IS NULL OR material_consumed_grams >= 0);
