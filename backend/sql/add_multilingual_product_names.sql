-- Run once on existing databases to support multilingual product names.
ALTER TABLE farmer_product
  ADD COLUMN IF NOT EXISTS name_hi VARCHAR(255) NULL,
  ADD COLUMN IF NOT EXISTS name_te VARCHAR(255) NULL;

-- Optional: backfill from current English name so pages never render empty text.
UPDATE farmer_product
SET
  name_hi = COALESCE(NULLIF(name_hi, ''), name),
  name_te = COALESCE(NULLIF(name_te, ''), name)
WHERE 1 = 1;
