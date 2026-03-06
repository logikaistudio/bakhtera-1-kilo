ALTER TABLE bridge_assets
ADD COLUMN IF NOT EXISTS location VARCHAR(50) DEFAULT 'Warehouse';

COMMENT ON COLUMN bridge_assets.location IS 'Lokasi Aset (Warehouse, Event, Kantor, Outdoor)';
