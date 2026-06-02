-- Table: blink_sales_targets
-- Stores yearly revenue targets per sales person for Blink module

CREATE TABLE IF NOT EXISTS blink_sales_targets (
    id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    sales_name  text NOT NULL UNIQUE,
    yearly_target bigint NOT NULL DEFAULT 0,
    created_at  timestamptz DEFAULT now(),
    updated_at  timestamptz DEFAULT now()
);

-- RLS: allow authenticated users to read & write
ALTER TABLE blink_sales_targets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "blink_sales_targets_select" ON blink_sales_targets
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "blink_sales_targets_insert" ON blink_sales_targets
    FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "blink_sales_targets_update" ON blink_sales_targets
    FOR UPDATE TO authenticated USING (true);

CREATE POLICY "blink_sales_targets_delete" ON blink_sales_targets
    FOR DELETE TO authenticated USING (true);
