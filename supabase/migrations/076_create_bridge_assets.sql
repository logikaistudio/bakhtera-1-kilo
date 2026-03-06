CREATE TABLE IF NOT EXISTS bridge_assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    brand VARCHAR(255),
    type VARCHAR(255),
    serial_number VARCHAR(255),
    quantity INTEGER DEFAULT 1,
    condition VARCHAR(50) DEFAULT 'Baik',
    location VARCHAR(50) DEFAULT 'Warehouse',
    operational_date DATE,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id),
    updated_by UUID REFERENCES auth.users(id)
);

-- Comments for documentation
COMMENT ON TABLE bridge_assets IS 'Menyimpan data asset inventaris untuk modul Bridge Operasional';
COMMENT ON COLUMN bridge_assets.name IS 'Nama Aset';
COMMENT ON COLUMN bridge_assets.brand IS 'Merk';
COMMENT ON COLUMN bridge_assets.type IS 'Tipe Aset';
COMMENT ON COLUMN bridge_assets.serial_number IS 'Serial Number';
COMMENT ON COLUMN bridge_assets.quantity IS 'Jumlah';
COMMENT ON COLUMN bridge_assets.condition IS 'Kondisi (Baik, Rusak, dsb)';
COMMENT ON COLUMN bridge_assets.operational_date IS 'Tanggal mulai operasional';
COMMENT ON COLUMN bridge_assets.notes IS 'Keterangan tambahan';

-- Enable RLS
ALTER TABLE bridge_assets ENABLE ROW LEVEL SECURITY;

-- Create policies for RLS
CREATE POLICY "Enable read access for all users" ON bridge_assets FOR SELECT USING (true);
CREATE POLICY "Enable insert for authenticated users" ON bridge_assets FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Enable update for authenticated users" ON bridge_assets FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "Enable delete for authenticated users" ON bridge_assets FOR DELETE USING (auth.role() = 'authenticated');

-- Create trigger for updated_at if not exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_bridge_assets_updated_at') THEN
        CREATE TRIGGER set_bridge_assets_updated_at
            BEFORE UPDATE ON bridge_assets
            FOR EACH ROW
            EXECUTE FUNCTION moddatetime('updated_at');
    END IF;
END
$$;
