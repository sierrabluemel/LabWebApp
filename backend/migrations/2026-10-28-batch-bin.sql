-- Physical bin (B-Y21, B-R01...) holding a batch, scanned at receiving. Separate from current_location, which is the shelf/stage.
-- Run by hand on dev, then prod: bun migrations/run.ts migrations/2026-10-28-batch-bin.sql [dev|prod]
BEGIN;

ALTER TABLE api_batch ADD COLUMN bin TEXT;
-- one bin holds one batch at a time; scanning a bin already in use is rejected
CREATE UNIQUE INDEX api_batch_bin_unique ON api_batch (bin) WHERE bin IS NOT NULL;

COMMIT;
