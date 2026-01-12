-- Create table for HS Codes
CREATE TABLE IF NOT EXISTS public.freight_hs_codes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    hs_code VARCHAR(255) NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE public.freight_hs_codes ENABLE ROW LEVEL SECURITY;

-- Policies (Allow all access for now as per dev mode)
CREATE POLICY "Enable read access for all users" ON public.freight_hs_codes FOR SELECT USING (true);
CREATE POLICY "Enable insert access for all users" ON public.freight_hs_codes FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update access for all users" ON public.freight_hs_codes FOR UPDATE USING (true);
CREATE POLICY "Enable delete access for all users" ON public.freight_hs_codes FOR DELETE USING (true);

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.freight_hs_codes;
