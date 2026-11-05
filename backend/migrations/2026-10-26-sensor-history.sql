-- One api_sensor row per (sensor, batch) so recalibrations keep their batch history.
-- Run by hand on dev, then prod, off-hours (the backfill rewrites every certificate and reading row).
-- Afterward run: VACUUM ANALYZE api_certificate, api_reading;
BEGIN;

-- CASCADE drops any FKs from api_certificate/api_reading that point at sensor_id, which can no longer be unique
ALTER TABLE api_sensor DROP CONSTRAINT sensor_pkey CASCADE;
ALTER TABLE api_sensor ADD COLUMN id SERIAL PRIMARY KEY;
ALTER TABLE api_sensor ADD CONSTRAINT api_sensor_sensor_batch_key UNIQUE (sensor_id, batch_id);

ALTER TABLE api_certificate ADD COLUMN batch_id INT REFERENCES api_batch(batch_id);
ALTER TABLE api_reading ADD COLUMN batch_id INT REFERENCES api_batch(batch_id);

-- Each sensor has exactly one row before this migration, so the backfill is unambiguous
UPDATE api_certificate c SET batch_id = s.batch_id FROM api_sensor s WHERE s.sensor_id = c.sensor_id;
UPDATE api_reading r SET batch_id = s.batch_id FROM api_sensor s WHERE s.sensor_id = r.sensor_id;

-- The Home page and invoice report filter certificates by date range; without this they scan the whole table
CREATE INDEX IF NOT EXISTS api_certificate_timestamp_idx ON api_certificate ("timestamp");

COMMIT;
