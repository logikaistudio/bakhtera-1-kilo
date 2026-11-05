-- Keep the operator-selected destination as the canonical location for all mutation logs.
-- Preserve file attachments when older rows store documents as a JSON array.
ALTER TABLE freight_mutation_logs
ADD COLUMN IF NOT EXISTS mutation_location TEXT CHECK (mutation_location IN ('warehouse', 'pameran', 'outbound')),
ADD COLUMN IF NOT EXISTS storage_location TEXT;

UPDATE freight_mutation_logs
SET documents = jsonb_set(
    CASE
        WHEN documents IS NULL THEN '{}'::jsonb
        WHEN jsonb_typeof(documents) = 'object' THEN documents
        WHEN jsonb_typeof(documents) = 'array' THEN jsonb_build_object('files', documents)
        ELSE '{}'::jsonb
    END,
    '{mutationLocation}',
    to_jsonb(destination),
    true
)
WHERE destination IS NOT NULL
  AND btrim(destination) <> '';

-- Only classify known canonical destinations. Do not mark arbitrary locations such as Parkiran as outbound.
UPDATE freight_mutation_logs
SET mutation_location = CASE
    WHEN lower(btrim(destination)) IN ('warehouse', 'gudang') THEN 'warehouse'
    WHEN lower(btrim(destination)) = 'outbound' THEN 'outbound'
    WHEN lower(btrim(destination)) LIKE '%pameran%'
      OR lower(btrim(destination)) LIKE 'hall %' THEN 'pameran'
    ELSE NULL
END
WHERE destination IS NOT NULL;