-- Create freight_pic table for PIC (Person In Charge) master data
CREATE TABLE IF NOT EXISTS freight_pic (
    id TEXT PRIMARY KEY,
    nik TEXT UNIQUE NOT NULL,
    nama TEXT NOT NULL,
    jabatan TEXT NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index on NIK for faster lookups
CREATE INDEX IF NOT EXISTS idx_freight_pic_nik ON freight_pic(nik);

-- Create index on active status for filtering
CREATE INDEX IF NOT EXISTS idx_freight_pic_active ON freight_pic(is_active);

-- Add RLS (Row Level Security) policies
ALTER TABLE freight_pic ENABLE ROW LEVEL SECURITY;

-- Allow all operations for authenticated users
CREATE POLICY "Allow all operations for authenticated users" ON freight_pic
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_freight_pic_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_freight_pic_updated_at
    BEFORE UPDATE ON freight_pic
    FOR EACH ROW
    EXECUTE FUNCTION update_freight_pic_updated_at();
