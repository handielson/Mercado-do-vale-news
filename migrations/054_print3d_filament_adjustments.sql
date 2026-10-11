-- Apply only after 048 with explicit environment approval. No automatic migration.
-- Same raw-material ledger: preserve receipts and production consumptions.
ALTER TABLE print3d_filament_movements
  MODIFY reason ENUM('receipt','production','adjustment') NOT NULL,
  ADD COLUMN note VARCHAR(500) NULL;
