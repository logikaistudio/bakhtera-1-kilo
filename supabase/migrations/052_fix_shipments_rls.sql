-- Enable RLS on blink_shipments if not already
ALTER TABLE blink_shipments ENABLE ROW LEVEL SECURITY;

-- Drop existing restricted policies if likely to conflict (optional, but cleaner)
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON blink_shipments;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON blink_shipments;
DROP POLICY IF EXISTS "Enable update for authenticated users" ON blink_shipments;

-- Create a permissive policy for development
CREATE POLICY "Allow all access for blink_shipments" ON blink_shipments
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- Do the same for blink_quotations to be sure
ALTER TABLE blink_quotations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON blink_quotations;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON blink_quotations;
DROP POLICY IF EXISTS "Enable update for authenticated users" ON blink_quotations;

CREATE POLICY "Allow all access for blink_quotations" ON blink_quotations
    FOR ALL
    USING (true)
    WITH CHECK (true);
