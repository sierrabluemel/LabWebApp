-- A certificate records the lead (cable) it was issued for, so swapping leads on a base fixture keeps history.
-- Run by hand on dev, then prod: bun migrations/run.ts migrations/2026-10-27-certificate-lead.sql [dev|prod]
BEGIN;

ALTER TABLE api_certificate ADD COLUMN cable_id BIGINT;
ALTER TABLE api_certificate ADD COLUMN cable_sku TEXT;

-- Old certificates only recorded the lead as text: D3 = 'Identifier/Serial: <id>', D2 = 'Model: <sku>'.
-- When the id differs from sensor_id the certificate was for a lead.
UPDATE api_certificate
SET
    cable_id = substring(generate_certificate_json->>'D3' FROM '[0-9]+$')::bigint,
    cable_sku = substring(generate_certificate_json->>'D2' FROM 'Model: *(.+)$')
WHERE
    generate_certificate_json->>'D3' ~ '[0-9]+$'
    AND substring(generate_certificate_json->>'D3' FROM '[0-9]+$')::bigint <> sensor_id;

CREATE INDEX IF NOT EXISTS api_certificate_cable_id_idx ON api_certificate (cable_id);

COMMIT;
