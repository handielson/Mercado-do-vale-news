ALTER TABLE smartphone_photo_intakes
  ADD COLUMN IF NOT EXISTS review_confirmed TINYINT(1) NOT NULL DEFAULT 0 AFTER prices_confirmed,
  ADD COLUMN IF NOT EXISTS review_confirmed_at DATETIME NULL AFTER review_confirmed;
