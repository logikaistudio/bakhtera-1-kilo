-- Migration: Role Management System
-- Description: Creates custom authentication and permission management tables
-- Author: System
-- Date: 2026-01-09

-- =============================================================================
-- 1. USERS TABLE (Custom Authentication)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    full_name TEXT NOT NULL,
    email TEXT,
    user_level TEXT NOT NULL CHECK (user_level IN ('super_admin', 'admin', 'approver', 'full_access', 'view_only')),
    portal_access BOOLEAN NOT NULL DEFAULT true,
    is_active BOOLEAN NOT NULL DEFAULT true,
    requires_password_change BOOLEAN NOT NULL DEFAULT true,
    last_login TIMESTAMPTZ,
    created_by UUID REFERENCES public.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add index for faster lookups
CREATE INDEX idx_users_username ON public.users(username);
CREATE INDEX idx_users_email ON public.users(email);
CREATE INDEX idx_users_user_level ON public.users(user_level);
CREATE INDEX idx_users_is_active ON public.users(is_active);

-- Add update trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON public.users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- 2. MENU REGISTRY TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.menu_registry (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    menu_code TEXT UNIQUE NOT NULL,
    menu_name TEXT NOT NULL,
    category TEXT NOT NULL,
    has_approval BOOLEAN NOT NULL DEFAULT false,
    order_index INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_menu_registry_code ON public.menu_registry(menu_code);
CREATE INDEX idx_menu_registry_category ON public.menu_registry(category);

-- =============================================================================
-- 3. USER MENU PERMISSIONS TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.user_menu_permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    menu_code TEXT NOT NULL REFERENCES public.menu_registry(menu_code) ON DELETE CASCADE,
    can_access BOOLEAN NOT NULL DEFAULT false,
    can_view BOOLEAN NOT NULL DEFAULT false,
    can_create BOOLEAN NOT NULL DEFAULT false,
    can_edit BOOLEAN NOT NULL DEFAULT false,
    can_delete BOOLEAN NOT NULL DEFAULT false,
    can_approve BOOLEAN NOT NULL DEFAULT false,
    requires_approval_for_edit BOOLEAN NOT NULL DEFAULT false,
    requires_approval_for_delete BOOLEAN NOT NULL DEFAULT false,
    set_by UUID REFERENCES public.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, menu_code)
);

CREATE INDEX idx_user_menu_permissions_user ON public.user_menu_permissions(user_id);
CREATE INDEX idx_user_menu_permissions_menu ON public.user_menu_permissions(menu_code);

CREATE TRIGGER update_user_menu_permissions_updated_at
    BEFORE UPDATE ON public.user_menu_permissions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- 4. PENDING CHANGES TABLE (Approval Workflow)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.pending_changes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    menu_code TEXT NOT NULL,
    record_id UUID NOT NULL,
    table_name TEXT NOT NULL,
    action_type TEXT NOT NULL CHECK (action_type IN ('edit', 'delete')),
    old_data JSONB NOT NULL,
    new_data JSONB,
    requested_by UUID NOT NULL REFERENCES public.users(id),
    requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    approved_by UUID REFERENCES public.users(id),
    approved_at TIMESTAMPTZ,
    approval_notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_pending_changes_status ON public.pending_changes(status);
CREATE INDEX idx_pending_changes_requested_by ON public.pending_changes(requested_by);
CREATE INDEX idx_pending_changes_approved_by ON public.pending_changes(approved_by);
CREATE INDEX idx_pending_changes_menu_code ON public.pending_changes(menu_code);

-- =============================================================================
-- 5. USER AUDIT LOG TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.user_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    action_type TEXT NOT NULL,
    target_user_id UUID REFERENCES public.users(id),
    performed_by UUID NOT NULL REFERENCES public.users(id),
    old_value JSONB,
    new_value JSONB,
    ip_address TEXT,
    user_agent TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_user_audit_log_target ON public.user_audit_log(target_user_id);
CREATE INDEX idx_user_audit_log_performed_by ON public.user_audit_log(performed_by);
CREATE INDEX idx_user_audit_log_action_type ON public.user_audit_log(action_type);
CREATE INDEX idx_user_audit_log_created_at ON public.user_audit_log(created_at);

-- =============================================================================
-- 6. USER SESSIONS TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.user_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    token TEXT UNIQUE NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    ip_address TEXT,
    user_agent TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_user_sessions_user_id ON public.user_sessions(user_id);
CREATE INDEX idx_user_sessions_token ON public.user_sessions(token);
CREATE INDEX idx_user_sessions_expires_at ON public.user_sessions(expires_at);

-- Auto-cleanup expired sessions
CREATE OR REPLACE FUNCTION cleanup_expired_sessions()
RETURNS void AS $$
BEGIN
    DELETE FROM public.user_sessions WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- 7. ROW LEVEL SECURITY (RLS) POLICIES
-- =============================================================================

-- Enable RLS on all tables
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_registry ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_menu_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pending_changes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;

-- For now, allow public access (will be restricted after auth implementation)
CREATE POLICY "Allow public access to users" ON public.users FOR ALL USING (true);
CREATE POLICY "Allow public access to menu_registry" ON public.menu_registry FOR ALL USING (true);
CREATE POLICY "Allow public access to user_menu_permissions" ON public.user_menu_permissions FOR ALL USING (true);
CREATE POLICY "Allow public access to pending_changes" ON public.pending_changes FOR ALL USING (true);
CREATE POLICY "Allow public access to user_audit_log" ON public.user_audit_log FOR ALL USING (true);
CREATE POLICY "Allow public access to user_sessions" ON public.user_sessions FOR ALL USING (true);

-- =============================================================================
-- 8. SEED DATA - INITIAL SUPERADMIN USER
-- =============================================================================

-- Insert initial superadmin user
-- Password: logikaistudio (hashed with bcrypt, rounds=10)
-- Hash generated: $2b$10$kF9.VwZ7vqE8pHQgWxvFx.xQ9YJ9gRV1yGKqYHpLBBN6iVxX3mQYy
INSERT INTO public.users (
    username,
    password_hash,
    full_name,
    email,
    user_level,
    portal_access,
    is_active,
    requires_password_change,
    created_by
) VALUES (
    'superadmin',
    '$2b$10$kF9.VwZ7vqE8pHQgWxvFx.xQ9YJ9gRV1yGKqYHpLBBN6iVxX3mQYy',
    'Super Administrator',
    NULL,
    'super_admin',
    true,
    true,
    true,
    NULL
) ON CONFLICT (username) DO NOTHING;

-- =============================================================================
-- 9. SEED DATA - MENU REGISTRY
-- =============================================================================

INSERT INTO public.menu_registry (menu_code, menu_name, category, has_approval, order_index) VALUES
-- Sales Module
('quotations', 'Quotations', 'Sales', true, 10),
('invoices', 'Invoices', 'Sales', true, 20),
('big_events', 'BIG Events', 'Sales', false, 30),
('big_quotations', 'BIG Quotations', 'Sales', true, 40),
('big_invoices', 'BIG Invoices', 'Sales', true, 50),
('big_ar', 'BIG Accounts Receivable', 'Sales', false, 60),

-- Finance Module
('ar', 'Accounts Receivable', 'Finance', true, 100),
('ap', 'Accounts Payable', 'Finance', true, 110),
('po', 'Purchase Orders', 'Finance', true, 120),
('cogs', 'Cost of Goods Sold', 'Finance', false, 130),
('general_journal', 'General Journal', 'Finance', false, 140),
('general_ledger', 'General Ledger', 'Finance', false, 150),
('trial_balance', 'Trial Balance', 'Finance', false, 160),
('profit_loss', 'Profit & Loss', 'Finance', false, 170),
('coa', 'Chart of Accounts', 'Finance', false, 180),

-- Operations Module
('warehouse', 'Warehouse Management', 'Operations', false, 200),
('shipment', 'Shipment Management', 'Operations', false, 210),

-- Bridge Module (Customs/Pabean)
('bc_master', 'BC Master', 'Bridge', false, 300),
('customs_doc', 'Customs Documentation', 'Bridge', false, 310),
('inbound', 'Inbound Management', 'Bridge', false, 320),
('outbound', 'Outbound Management', 'Bridge', false, 330),
('item_master', 'Item Master', 'Bridge', false, 340),
('inspection', 'Inspection Management', 'Bridge', false, 350),
('goods_movement', 'Goods Movement', 'Bridge', false, 360),
('barang_masuk', 'Barang Masuk', 'Bridge', false, 370),
('barang_keluar', 'Barang Keluar', 'Bridge', false, 380),
('barang_reject', 'Barang Reject', 'Bridge', false, 390),

-- Admin Module
('user_management', 'User Management', 'Admin', false, 900),
('company_settings', 'Company Settings', 'Admin', false, 910)
ON CONFLICT (menu_code) DO NOTHING;

-- =============================================================================
-- 10. HELPER FUNCTIONS
-- =============================================================================

-- Function to check if user has permission
CREATE OR REPLACE FUNCTION check_user_permission(
    p_user_id UUID,
    p_menu_code TEXT,
    p_permission TEXT
)
RETURNS BOOLEAN AS $$
DECLARE
    v_user_level TEXT;
    v_has_permission BOOLEAN;
BEGIN
    -- Get user level
    SELECT user_level INTO v_user_level
    FROM public.users
    WHERE id = p_user_id AND is_active = true;
    
    -- Super admin and admin have all permissions
    IF v_user_level IN ('super_admin', 'admin') THEN
        RETURN true;
    END IF;
    
    -- Check specific permission
    EXECUTE format('
        SELECT COALESCE(%I, false)
        FROM public.user_menu_permissions
        WHERE user_id = $1 AND menu_code = $2
    ', 'can_' || p_permission)
    INTO v_has_permission
    USING p_user_id, p_menu_code;
    
    RETURN COALESCE(v_has_permission, false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get user's accessible menus
CREATE OR REPLACE FUNCTION get_user_menus(p_user_id UUID)
RETURNS TABLE (
    menu_code TEXT,
    menu_name TEXT,
    category TEXT,
    can_access BOOLEAN,
    can_view BOOLEAN,
    can_create BOOLEAN,
    can_edit BOOLEAN,
    can_delete BOOLEAN,
    can_approve BOOLEAN
) AS $$
DECLARE
    v_user_level TEXT;
BEGIN
    -- Get user level
    SELECT u.user_level INTO v_user_level
    FROM public.users u
    WHERE u.id = p_user_id AND u.is_active = true;
    
    -- Super admin and admin get all menus
    IF v_user_level IN ('super_admin', 'admin') THEN
        RETURN QUERY
        SELECT 
            mr.menu_code,
            mr.menu_name,
            mr.category,
            true::BOOLEAN as can_access,
            true::BOOLEAN as can_view,
            true::BOOLEAN as can_create,
            true::BOOLEAN as can_edit,
            true::BOOLEAN as can_delete,
            true::BOOLEAN as can_approve
        FROM public.menu_registry mr
        ORDER BY mr.order_index;
    ELSE
        -- Return menus based on permissions
        RETURN QUERY
        SELECT 
            mr.menu_code,
            mr.menu_name,
            mr.category,
            COALESCE(ump.can_access, false) as can_access,
            COALESCE(ump.can_view, false) as can_view,
            COALESCE(ump.can_create, false) as can_create,
            COALESCE(ump.can_edit, false) as can_edit,
            COALESCE(ump.can_delete, false) as can_delete,
            COALESCE(ump.can_approve, false) as can_approve
        FROM public.menu_registry mr
        LEFT JOIN public.user_menu_permissions ump ON mr.menu_code = ump.menu_code AND ump.user_id = p_user_id
        WHERE COALESCE(ump.can_access, false) = true
        ORDER BY mr.order_index;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- MIGRATION COMPLETE
-- =============================================================================

COMMENT ON TABLE public.users IS 'Custom user authentication and management table';
COMMENT ON TABLE public.menu_registry IS 'Registry of all application menus/features';
COMMENT ON TABLE public.user_menu_permissions IS 'Granular permissions per user per menu';
COMMENT ON TABLE public.pending_changes IS 'Approval workflow for edit/delete operations';
COMMENT ON TABLE public.user_audit_log IS 'Audit trail of user management actions';
COMMENT ON TABLE public.user_sessions IS 'User session management';
