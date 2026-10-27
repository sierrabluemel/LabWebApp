-- Spares ship with an order in case a sensor fails; they are tested with the batch but get no certificate unless promoted.
-- Run by hand on dev, then prod: bun migrations/run.ts migrations/2026-10-27-sensor-spare.sql [dev|prod]
BEGIN;

ALTER TABLE api_sensor ADD COLUMN spare BOOLEAN NOT NULL DEFAULT FALSE;

COMMIT;
