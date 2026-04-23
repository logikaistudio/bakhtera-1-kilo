import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
    LayoutDashboard,
    Plane,
    Building2,
    Calendar,
    Users,
    UserCircle,
    Wallet,
    Menu,
    X,
    ChevronRight,
    TrendingUp,
    Truck,
    DollarSign,
    Package,
    FileCheck,
    Shield,
    LogOut,
    Key,
    Eye,
    EyeOff,
    CheckCircle,
    AlertCircle,
    Bell
} from 'lucide-react';


import { changePassword } from '../../services/userService';
import { useAuth } from '../../context/AuthContext';
import { useData } from '../../context/DataContext';



const Sidebar = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const { user, logout, canAccess, isSuperAdmin, isAdmin } = useAuth();
    // Helper: check if user can access a portal (admin/super_admin always can)
    const canAccessPortal = (menuCode) => isSuperAdmin() || isAdmin() || canAccess(menuCode);
    const { pendingApprovals = [] } = useData();
    const [isOpen, setIsOpen] = useState(false);
    const [expandedSection, setExpandedSection] = useState('');
    const [expandedCategories, setExpandedCategories] = useState(['blink-marketing', 'blink-operations', 'blink-finance', 'blink-costing', 'blink-profit', 'blink-data', 'blink-approval', 'bridge-operasional', 'bridge-finance', 'bridge-data', 'bridge-persetujuan', 'central-users']); // All expanded by default
    const [showChangePassword, setShowChangePassword] = useState(false);

    // Count pending approvals for badge (only relevant for bridge_manager and super_admin)
    const isApprover = ['super_admin', 'bridge_manager', 'admin'].includes(user?.user_level);
    const pendingApprovalCount = isApprover
        ? pendingApprovals.filter(r => r.status === 'pending').length
        : 0;
    const [blinkOpsPendingCount, setBlinkOpsPendingCount] = React.useState(0);
    const [blinkSalesPendingCount, setBlinkSalesPendingCount] = React.useState(0);
    
    React.useEffect(() => {
        const fetchBlinkPending = async () => {
            try {
                const { supabase } = await import('../../lib/supabase');
                
                // Fetch Operations Pending
                const [qRes, sRes, iRes, pRes] = await Promise.all([
                    supabase.from('blink_quotations').select('id', { count: 'exact', head: true }).eq('status', 'manager_approval'),
                    supabase.from('blink_shipments').select('id', { count: 'exact', head: true }).eq('status', 'manager_approval'),
                    supabase.from('blink_invoices').select('id', { count: 'exact', head: true }).eq('status', 'manager_approval'),
                    supabase.from('blink_purchase_orders').select('id', { count: 'exact', head: true }).in('status', ['submitted', 'manager_approval'])
                ]);
                const opsCount = (qRes.count || 0) + (sRes.count || 0) + (iRes.count || 0) + (pRes.count || 0);
                setBlinkOpsPendingCount(opsCount);
                
                // Fetch Sales Pending
                const sqRes = await supabase.from('blink_sales_quotations').select('id', { count: 'exact', head: true }).eq('status', 'manager_approval');
                setBlinkSalesPendingCount(sqRes.data ? (sqRes.count || 0) : 0);
                
            } catch (e) { /* silent */ }
        };
        fetchBlinkPending();
        const interval = setInterval(fetchBlinkPending, 60000); // refresh every 60s
        window.addEventListener('blink_approval_updated', fetchBlinkPending);
        return () => {
            clearInterval(interval);
            window.removeEventListener('blink_approval_updated', fetchBlinkPending);
        };
    }, []);
    const lastPathRef = React.useRef(null);

    // Initial check and Listener for path changes
    React.useEffect(() => {
        const path = location.pathname;
        const getSection = (p) => {
            if (p.startsWith('/bridge')) return 'bridge';
            if (p.startsWith('/pabean')) return 'pabean';
            if (p.startsWith('/big')) return 'big';
            if (p.startsWith('/blink')) return 'blink';
            return '';
        };

        const currentSection = getSection(path);

        // Handle initial load
        if (lastPathRef.current === null) {
            if (currentSection) {
                setExpandedSection(currentSection);
                scrollToElement('menu-' + currentSection);
            }
        } else {
            // Handle navigation
            const prevSection = getSection(lastPathRef.current);
            if (currentSection && currentSection !== prevSection) {
                setExpandedSection(currentSection);
                scrollToElement('menu-' + currentSection);
            } else if (!currentSection && prevSection) {
                setExpandedSection('');
            }
        }

        lastPathRef.current = path;
    }, [location.pathname]);

    // Helper to scroll to element
    const scrollToElement = (elementId) => {
        setTimeout(() => {
            const element = document.getElementById(elementId);
            if (element) {
                element.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        }, 100);
    };

    const isActive = (path) => location.pathname === path;

    const handleLogout = async () => {
        await logout();
        navigate('/login');
    };

    const mainMenuItems = [
        { path: '/', label: 'Dashboard Bakhtera-1', icon: LayoutDashboard },
        { path: '/blink', label: 'BLINK', subtitle: 'Freight & Forward Management', icon: Plane },
        { path: '/big', label: 'BIG', subtitle: 'Event Organizer', icon: Calendar },
        { path: '/bridge', label: 'BRIDGE', subtitle: 'Bounded Management', icon: Building2 },
        { path: '/pabean', label: 'Pabean', subtitle: 'Customs Portal', icon: Building2 },
    ];

    const centralizedMenuItems = [];


    // Bridge submenu items (with menuCode for per-menu access control)
    const bridgeSubMenuItems = [
        // Dashboard standalone
        { path: '/bridge', label: 'Dashboard Bridge', icon: LayoutDashboard, menuCode: 'bridge_dashboard' },

        // Operasional Category
        {
            type: 'category', label: '📦 Operasional', items: [
                { path: '/bridge/ata-carnet', label: 'ATA Carnet', menuCode: 'bridge_ata_carnet' },
                { path: '/bridge/asset-inventory', label: 'Asset Inventory', menuCode: 'bridge_asset_inventory' },
                { path: '/bridge/pengajuan', label: 'Pengajuan', menuCode: 'bridge_pengajuan' },
                { path: '/bridge/inventory', label: 'Inventaris Gudang', menuCode: 'bridge_inventory' },
                { path: '/bridge/outbound-inventory', label: 'Laporan Barang Keluar', menuCode: 'bridge_outbound' },
                { path: '/bridge/goods-movement', label: 'Pergerakan Barang', menuCode: 'bridge_movement' },
                { path: '/bridge/delivery-notes', label: 'Surat Jalan', menuCode: 'bridge_delivery' },
            ]
        },

        // Finance Category
        {
            type: 'category', label: '💰 Finance', items: [
                // Transaksi
                { type: 'divider', label: '📋 Transaksi' },
                { path: '/bridge/finance/invoices', label: 'Invoice', menuCode: 'bridge_finance', indent: true },
                { path: '/bridge/finance/po', label: 'Purchase Order', menuCode: 'bridge_finance', indent: true },
                { path: '/bridge/finance/ar', label: 'Account Receivable (AR)', menuCode: 'bridge_finance', indent: true },
                { path: '/bridge/finance/ap', label: 'Account Payable (AP)', menuCode: 'bridge_finance', indent: true },
                // Pencatatan
                { type: 'divider', label: '📝 Pencatatan' },
                { path: '/bridge/finance/general-journal', label: 'General Jurnal', menuCode: 'bridge_finance', indent: true },
                { path: '/bridge/finance/general-ledger', label: 'General Ledger', menuCode: 'bridge_finance', indent: true },
                // Laporan
                { type: 'divider', label: '📊 Laporan' },
                { path: '/bridge/finance/trial-balance', label: 'Trial Balance', menuCode: 'bridge_finance', indent: true },
                { path: '/bridge/finance/profit-loss', label: 'Profit & Loss', menuCode: 'bridge_finance', indent: true },
                { path: '/bridge/finance/balance-sheet', label: 'Balance Sheet', menuCode: 'bridge_finance', indent: true },
            ]
        },

        // Master Data Category
        {
            type: 'category', label: '⚙️ Master Data', items: [
                { path: '/bridge/master/partners', label: 'Mitra Bisnis', menuCode: 'bridge_partners' },
                { path: '/bridge/bc-master', label: 'Master Kode BC', menuCode: 'bridge_bc_master' },
                { path: '/bridge/hs-master', label: 'Master Kode HS', menuCode: 'bridge_hs_master' },
                { path: '/bridge/item-master', label: 'Master Kode Barang', menuCode: 'bridge_item_master' },
                { path: '/bridge/code-of-account', label: 'Code of Account', menuCode: 'bridge_coa' },
            ]
        },

        // Persetujuan & Log Category
        {
            type: 'category', label: '🔔 Persetujuan & Log', items: [
                { path: '/bridge/approvals', label: 'Approval Manager', menuCode: 'bridge_approval', showBadge: true },
                { path: '/bridge/logger', label: 'Activity Logger', menuCode: 'bridge_activity' },
                { path: '/bridge/master/settings', label: 'Pengaturan Modul', menuCode: 'bridge_settings' },
            ]
        },
    ];

    // Pabean submenu items (with menuCode for per-menu access control)
    const pabeanSubMenuItems = [
        { path: '/bridge/pabean', label: 'Dashboard Pabean', menuCode: 'bridge_pabean' },
        { path: '/bridge/pabean/barang-masuk', label: 'Barang Masuk', menuCode: 'bridge_barang_masuk' },
        { path: '/bridge/pabean/barang-keluar', label: 'Barang Keluar', menuCode: 'bridge_barang_keluar' },
        { path: '/bridge/pabean/barang-reject', label: 'Barang Reject', menuCode: 'bridge_barang_reject' },
        { path: '/bridge/pabean/pergerakan', label: 'Barang Mutasi', menuCode: 'bridge_pabean_movement' },
    ];

    // BIG submenu - Event Organizer
    const bigSubMenuItems = [
        { path: '/big', label: 'Dashboard BIG', icon: LayoutDashboard, menuCode: 'big_dashboard' },

        // Sales Category
        {
            type: 'category', label: '📋 Sales', items: [
                { path: '/big/sales/quotations', label: 'Quotations', menuCode: 'big_quotations' },
            ]
        },

        // Operations Category
        {
            type: 'category', label: '⚙️ Operations', items: [
                { path: '/big/operations/events', label: 'Event Management', menuCode: 'big_events' },
                { path: '/big/operations/costs', label: 'Event Costs', menuCode: 'big_costs' },
            ]
        },

        // Finance Category
        {
            type: 'category', label: '💰 Finance', items: [
                { path: '/big/finance/invoices', label: 'Invoice', menuCode: 'big_invoices' },
                { path: '/big/finance/ar', label: 'Piutang (AR)', menuCode: 'big_ar' },
            ]
        },

        // Master Data Category
        {
            type: 'category', label: '⚙️ Master Data', items: [
                { path: '/big/master/settings', label: 'Pengaturan Modul', menuCode: 'big_settings' },
            ]
        },
    ];

    // BLINK submenu - dengan Dashboard terpisah + 3 department categories + Master Data
    const blinkSubMenuItems = [
        // Dashboard - Standalone (outside categories)
        { path: '/blink', label: 'Dashboard', icon: LayoutDashboard, menuCode: 'blink_dashboard' },

        // Sales & Marketing Category
        {
            type: 'category', label: '📋 Sales & Marketing', items: [
                { path: '/blink/sales-quotations', label: 'Sales Quotation', menuCode: 'blink_sales_quotations' },
                { path: '/blink/flow-monitor', label: 'Flow Monitor', menuCode: 'blink_flow_monitor' },
                { path: '/blink/sales-achievement', label: 'Sales Achievement', menuCode: 'blink_sales' },
                { path: '/blink/sales-approvals', label: 'Approval Center', menuCode: 'blink_sales_approval', showBadge: true }
            ]
        },

        // Operations Category
        {
            type: 'category', label: '🚚 Operations', items: [
                { path: '/blink/operations/quotations', label: 'Quotation', menuCode: 'blink_quotations' },
                { path: '/blink/shipments', label: 'Shipment Management', menuCode: 'blink_shipments' },
                { path: '/blink/operations/bl', label: 'BL/AWB Documents', menuCode: 'blink_bl' },
                { path: '/blink/approvals', label: 'Approval Center', menuCode: 'blink_approval', showBadge: true },
            ]
        },

        // Profit & Costing Category
        {
            type: 'category', label: '📈 Profit & Costing', items: [
                { path: '/blink/finance/selling-buying', label: 'Selling vs Buying Analysis', menuCode: 'blink_selling_buying' },
            ]
        },

        // Finance Category with Subcategories
        {
            type: 'category', label: '💰 Finance', items: [
                // Subcategory: Transaksi
                { type: 'divider', label: '📋 Transactions' },
                { path: '/blink/finance/invoices', label: 'Invoice', menuCode: 'blink_invoices' },
                { path: '/blink/finance/purchase-orders', label: 'Purchase Order', menuCode: 'blink_purchase_order' },
                { path: '/blink/finance/ar', label: 'Account Receivables (AR)', menuCode: 'blink_ar' },
                { path: '/blink/finance/ap', label: 'Account Payables (AP)', menuCode: 'blink_ap' },
                // Subcategory: Pencatatan
                { type: 'divider', label: '📝 Records' },
                { path: '/blink/finance/auto-journal', label: 'Auto Jurnal (12 bulan)', menuCode: 'blink_auto_journal' },
                { path: '/blink/finance/reversing-journal', label: 'Reversing Jurnal', menuCode: 'blink_reversing_journal' },
                { path: '/blink/finance/general-journal', label: 'General Jurnal', menuCode: 'blink_journal' },
                { path: '/blink/finance/noted-journal', label: 'Jurnal Noted (Audit)', menuCode: 'blink_noted_journal' },
                { path: '/blink/finance/general-ledger', label: 'General Ledger', menuCode: 'blink_ledger' },
                { path: '/blink/finance/trial-balance', label: 'Trial Balance', menuCode: 'blink_trial_balance' },
                // Subcategory: Laporan
                { type: 'divider', label: '📊 Reports' },
                { path: '/blink/finance/profit-loss', label: 'Profit & Loss (P&L)', menuCode: 'blink_pnl' },
                { path: '/blink/finance/balance-sheet', label: 'Balance Sheet', menuCode: 'blink_balance_sheet' },
            ]
        },

        // Master Data Category
        {
            type: 'category', label: '⚙️ Master Data', items: [
                { path: '/blink/master/coa', label: 'COA Master', menuCode: 'blink_coa' },
                { path: '/blink/master/partners', label: 'Business Partners', menuCode: 'blink_partners' },
                { path: '/blink/master/settings', label: 'Module Settings', menuCode: 'blink_settings' },
            ]
        },
    ];

    const MenuLink = ({ item, isMobile = false }) => (
        <Link
            to={item.path}
            onClick={() => isMobile && setIsOpen(false)}
            className={`flex items-center gap-3 px-4 py-3 rounded-lg smooth-transition text-sm ${isActive(item.path)
                ? 'bg-silver text-dark-bg sidebar-active-item'
                : 'text-silver-dark hover:text-silver-light hover:bg-dark-surface'
                }`}
        >
            <item.icon className="w-5 h-5 flex-shrink-0" />
            <div className="flex-1">
                <div className="font-medium">{item.label}</div>
                {item.subtitle && (
                    <div className={`text-xs ${isActive(item.path) ? 'opacity-70' : 'text-silver-dark'}`}>
                        {item.subtitle}
                    </div>
                )}
            </div>
        </Link>
    );

    const SidebarContent = ({ isMobile = false }) => (
        <div className="flex flex-col h-full">
            {/* Logo */}
            <div className="px-6 py-6 border-b border-dark-border">
                <div>
                    <h1 className="text-2xl font-bold gradient-text">BAKHTERA-1</h1>
                    <p className="text-xs text-silver-dark mt-1">Freight & Asset Management</p>
                </div>
            </div>

            {/* Navigation */}
            <nav className="flex-1 px-4 py-6 space-y-8 overflow-y-auto">
                {/* Modul Utama */}
                <div>
                    <h3 className="px-4 mb-3 text-xs font-semibold text-silver-dark uppercase tracking-wider">
                        Modul Utama
                    </h3>
                    <div className="space-y-1">
                        {mainMenuItems.map((item) => {
                            // Special handling for Bridge with submenu
                            if (item.path === '/bridge') {
                                if (!canAccessPortal('bridge_dashboard')) return null;
                                const isExpanded = expandedSection === 'bridge';
                                const isBridgeActive = location.pathname.startsWith('/bridge');

                                return (
                                    <div key={item.path}>
                                        <div className="flex items-center gap-1" id="menu-bridge">
                                            <Link
                                                to={item.path}
                                                onClick={() => {
                                                    if (isMobile) setIsOpen(false);
                                                    const isCurrentlyExpanded = expandedSection === 'bridge';
                                                    setExpandedSection(isCurrentlyExpanded ? '' : 'bridge');
                                                    if (!isCurrentlyExpanded) scrollToElement('menu-bridge');
                                                }}
                                                className={`flex-1 flex items-center gap-3 px-4 py-3 rounded-lg smooth-transition text-sm ${isBridgeActive
                                                    ? 'bg-white/20 text-white'
                                                    : 'text-silver-dark hover:text-white hover:bg-white/10'
                                                    }`}
                                            >
                                                <item.icon className="w-5 h-5 flex-shrink-0" />
                                                <div className="flex-1 text-left">
                                                    <div className="font-medium">{item.label}</div>
                                                    <div className={`text-xs ${isBridgeActive ? 'text-white/70' : 'text-silver-dark'}`}>
                                                        {item.subtitle}
                                                    </div>
                                                </div>
                                            </Link>
                                            <button
                                                onClick={() => {
                                                    const newState = isExpanded ? '' : 'bridge';
                                                    setExpandedSection(newState);
                                                    if (newState === 'bridge') scrollToElement('menu-bridge');
                                                }}
                                                className="p-2 hover:bg-dark-surface rounded-lg smooth-transition"
                                            >
                                                <ChevronRight className={`w-4 h-4 transition-transform text-silver-dark ${isExpanded ? 'rotate-90' : ''}`} />
                                            </button>
                                        </div>

                                        <AnimatePresence>
                                            {isExpanded && (
                                                <motion.div
                                                    initial={{ height: 0, opacity: 0 }}
                                                    animate={{ height: 'auto', opacity: 1 }}
                                                    exit={{ height: 0, opacity: 0 }}
                                                    className="ml-8 mt-1 space-y-1 overflow-hidden"
                                                >
                                                    {bridgeSubMenuItems.map((subItem, idx) => {
                                                        // Render category with nested items
                                                        if (subItem.type === 'category') {
                                                            const categoryKey = 'bridge-' + subItem.label.toLowerCase().split(' ').pop();
                                                            const isCategoryExpanded = expandedCategories.includes(categoryKey);

                                                            // Hide category if no accessible items
                                                            const accessibleItems = subItem.items.filter(menuItem =>
                                                                !menuItem.menuCode || canAccessPortal(menuItem.menuCode)
                                                            );
                                                            if (accessibleItems.length === 0) return null;

                                                            return (
                                                                <div key={`category-${idx}`}>
                                                                    <button
                                                                        onClick={() => {
                                                                            setExpandedCategories(prev =>
                                                                                prev.includes(categoryKey)
                                                                                    ? prev.filter(c => c !== categoryKey)
                                                                                    : [...prev, categoryKey]
                                                                            );
                                                                        }}
                                                                        className="w-full flex items-center justify-between px-4 py-2 text-sm font-semibold text-silver hover:text-silver-light smooth-transition"
                                                                    >
                                                                        <span>{subItem.label}</span>
                                                                        <ChevronRight className={`w-3 h-3 transition-transform ${isCategoryExpanded ? 'rotate-90' : ''}`} />
                                                                    </button>

                                                                    <AnimatePresence>
                                                                        {isCategoryExpanded && (
                                                                            <motion.div
                                                                                initial={{ height: 0, opacity: 0 }}
                                                                                animate={{ height: 'auto', opacity: 1 }}
                                                                                exit={{ height: 0, opacity: 0 }}
                                                                                className="overflow-hidden"
                                                                            >
                                                                                {subItem.items.filter(menuItem =>
                                                                                    !menuItem.menuCode || canAccessPortal(menuItem.menuCode)
                                                                                ).map((menuItem) => (
                                                                                    <Link
                                                                                        key={menuItem.path}
                                                                                        to={menuItem.path}
                                                                                        onClick={() => isMobile && setIsOpen(false)}
                                                                                        className={`flex items-center pl-12 pr-4 py-1.5 text-sm smooth-transition border-l-2 ml-4 ${isActive(menuItem.path)
                                                                                            ? 'bg-white/20 text-white font-medium border-white sidebar-active-item'
                                                                                            : 'text-silver-dark hover:text-white hover:bg-white/10 border-transparent hover:border-white/50'
                                                                                            }`}
                                                                                    >
                                                                                        <span className="flex-1">{menuItem.label}</span>
                                                                                        {menuItem.showBadge && pendingApprovalCount > 0 && (
                                                                                            <span className="ml-2 min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold px-1 animate-pulse">
                                                                                                {pendingApprovalCount > 99 ? '99+' : pendingApprovalCount}
                                                                                            </span>
                                                                                        )}
                                                                                    </Link>
                                                                                ))}
                                                                            </motion.div>
                                                                        )}
                                                                    </AnimatePresence>
                                                                </div>
                                                            );
                                                        }

                                                        // Standalone menu items (with access check)
                                                        if (subItem.menuCode && !canAccessPortal(subItem.menuCode)) return null;
                                                        return (
                                                            <Link
                                                                key={subItem.path}
                                                                to={subItem.path}
                                                                onClick={() => isMobile && setIsOpen(false)}
                                                                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm smooth-transition ${isActive(subItem.path)
                                                                    ? 'bg-white/20 text-white font-medium'
                                                                    : 'text-silver-dark hover:text-white hover:bg-white/10'
                                                                    }`}
                                                            >
                                                                {subItem.icon && <subItem.icon className="w-4 h-4" />}
                                                                <span>{subItem.label}</span>
                                                            </Link>
                                                        );
                                                    })}
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
                                    </div>
                                );
                            }

                            // Special handling for Pabean with submenu
                            if (item.path === '/pabean') {
                                if (!canAccessPortal('bridge_pabean')) return null;
                                const isExpanded = expandedSection === 'pabean';
                                const isPabeanActive = location.pathname.startsWith('/pabean');

                                return (
                                    <div key={item.path}>
                                        <div className="flex items-center gap-1" id="menu-pabean">
                                            <Link
                                                to={item.path}
                                                onClick={() => {
                                                    if (isMobile) setIsOpen(false);
                                                    const isCurrentlyExpanded = expandedSection === 'pabean';
                                                    setExpandedSection(isCurrentlyExpanded ? '' : 'pabean');
                                                    if (!isCurrentlyExpanded) scrollToElement('menu-pabean');
                                                }}
                                                className={`flex-1 flex items-center gap-3 px-4 py-3 rounded-lg smooth-transition text-sm ${isPabeanActive
                                                    ? 'bg-white/20 text-white'
                                                    : 'text-silver-dark hover:text-white hover:bg-white/10'
                                                    }`}
                                            >
                                                <item.icon className="w-5 h-5 flex-shrink-0" />
                                                <div className="flex-1 text-left">
                                                    <div className="font-medium">{item.label}</div>
                                                    <div className={`text-xs ${isPabeanActive ? 'text-white/70' : 'text-silver-dark'}`}>
                                                        {item.subtitle}
                                                    </div>
                                                </div>
                                            </Link>
                                            <button
                                                onClick={() => {
                                                    const newState = isExpanded ? '' : 'pabean';
                                                    setExpandedSection(newState);
                                                    if (newState === 'pabean') scrollToElement('menu-pabean');
                                                }}
                                                className="p-2 hover:bg-dark-surface rounded-lg smooth-transition"
                                            >
                                                <ChevronRight className={`w-4 h-4 transition-transform text-silver-dark ${isExpanded ? 'rotate-90' : ''}`} />
                                            </button>
                                        </div>

                                        <AnimatePresence>
                                            {isExpanded && (
                                                <motion.div
                                                    initial={{ height: 0, opacity: 0 }}
                                                    animate={{ height: 'auto', opacity: 1 }}
                                                    exit={{ height: 0, opacity: 0 }}
                                                    className="ml-8 mt-1 space-y-1 overflow-hidden"
                                                >
                                                    {pabeanSubMenuItems.filter(subItem =>
                                                        !subItem.menuCode || canAccessPortal(subItem.menuCode)
                                                    ).map((subItem) => (
                                                        <Link
                                                            key={subItem.path}
                                                            to={subItem.path}
                                                            onClick={() => isMobile && setIsOpen(false)}
                                                            className={`block px-4 py-2 rounded-lg text-sm smooth-transition ${isActive(subItem.path)
                                                                ? 'bg-accent-green text-white'
                                                                : 'text-silver-dark hover:text-silver-light hover:bg-dark-surface'
                                                                }`}
                                                        >
                                                            {subItem.label}
                                                        </Link>
                                                    ))}
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
                                    </div>
                                );
                            }

                            // Special handling for BIG with submenu
                            if (item.path === '/big') {
                                if (!canAccessPortal('big_dashboard')) return null;
                                const isExpanded = expandedSection === 'big';
                                const isBigActive = location.pathname.startsWith('/big');

                                return (
                                    <div key={item.path}>
                                        <div className="flex items-center gap-1" id="menu-big">
                                            <Link
                                                to={item.path}
                                                onClick={() => {
                                                    if (isMobile) setIsOpen(false);
                                                    const isCurrentlyExpanded = expandedSection === 'big';
                                                    setExpandedSection(isCurrentlyExpanded ? '' : 'big');
                                                    if (!isCurrentlyExpanded) scrollToElement('menu-big');
                                                }}
                                                className={`flex-1 flex items-center gap-3 px-4 py-3 rounded-lg smooth-transition text-sm ${isBigActive
                                                    ? 'text-silver-light'
                                                    : 'text-silver-dark hover:text-silver-light hover:bg-dark-surface'
                                                    }`}
                                            >
                                                <item.icon className="w-5 h-5 flex-shrink-0" />
                                                <div className="flex-1 text-left">
                                                    <div className="font-medium">{item.label}</div>
                                                    <div className={`text-xs ${isBigActive ? 'text-silver-dark' : 'text-silver-dark'}`}>
                                                        {item.subtitle}
                                                    </div>
                                                </div>
                                            </Link>
                                            <button
                                                onClick={() => {
                                                    const newState = isExpanded ? '' : 'big';
                                                    setExpandedSection(newState);
                                                    if (newState === 'big') scrollToElement('menu-big');
                                                }}
                                                className="p-2 hover:bg-dark-surface rounded-lg smooth-transition"
                                            >
                                                <ChevronRight className={`w-4 h-4 transition-transform text-silver-dark ${isExpanded ? 'rotate-90' : ''}`} />
                                            </button>
                                        </div>

                                        <AnimatePresence>
                                            {isExpanded && (
                                                <motion.div
                                                    initial={{ height: 0, opacity: 0 }}
                                                    animate={{ height: 'auto', opacity: 1 }}
                                                    exit={{ height: 0, opacity: 0 }}
                                                    className="ml-8 mt-1 space-y-1 overflow-hidden"
                                                >
                                                    {bigSubMenuItems.map((subItem, idx) => {
                                                        // Standalone menu items (Dashboard)
                                                        if (!subItem.type) {
                                                            if (subItem.menuCode && !canAccessPortal(subItem.menuCode)) return null;
                                                            return (
                                                                <Link
                                                                    key={subItem.path}
                                                                    to={subItem.path}
                                                                    onClick={() => isMobile && setIsOpen(false)}
                                                                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm smooth-transition ${isActive(subItem.path)
                                                                        ? 'bg-accent-orange text-white'
                                                                        : 'text-silver-dark hover:text-silver-light hover:bg-dark-surface'
                                                                        }`}
                                                                >
                                                                    {subItem.icon && <subItem.icon className="w-4 h-4" />}
                                                                    <span>{subItem.label}</span>
                                                                </Link>
                                                            );
                                                        }

                                                        // Render category dengan nested items
                                                        if (subItem.type === 'category') {
                                                            const categoryKey = 'big-' + subItem.label.toLowerCase().split(' ').pop();
                                                            const isCategoryExpanded = expandedCategories.includes(categoryKey);

                                                            // Filter items yang bisa diakses
                                                            const accessibleItems = subItem.items.filter(menuItem =>
                                                                !menuItem.menuCode || canAccessPortal(menuItem.menuCode)
                                                            );
                                                            if (accessibleItems.length === 0) return null;

                                                            return (
                                                                <div key={`category-${idx}`}>
                                                                    <button
                                                                        onClick={() => {
                                                                            setExpandedCategories(prev =>
                                                                                prev.includes(categoryKey)
                                                                                    ? prev.filter(c => c !== categoryKey)
                                                                                    : [...prev, categoryKey]
                                                                            );
                                                                        }}
                                                                        className="w-full flex items-center justify-between px-4 py-2 text-sm font-semibold text-silver hover:text-silver-light smooth-transition"
                                                                    >
                                                                        <span>{subItem.label}</span>
                                                                        <ChevronRight className={`w-3 h-3 transition-transform ${isCategoryExpanded ? 'rotate-90' : ''}`} />
                                                                    </button>

                                                                    <AnimatePresence>
                                                                        {isCategoryExpanded && (
                                                                            <motion.div
                                                                                initial={{ height: 0, opacity: 0 }}
                                                                                animate={{ height: 'auto', opacity: 1 }}
                                                                                exit={{ height: 0, opacity: 0 }}
                                                                                className="overflow-hidden"
                                                                            >
                                                                                {accessibleItems.map((menuItem, itemIdx) => {
                                                                                    if (menuItem.type === 'divider') {
                                                                                        return (
                                                                                            <div key={`divider-${itemIdx}`} className="pl-6 pr-4 pt-3 pb-1 border-t border-dark-border/30 mt-1 first:mt-0 first:border-t-0">
                                                                                                <span className="text-xs font-bold text-silver uppercase tracking-wider">
                                                                                                    {menuItem.label}
                                                                                                </span>
                                                                                            </div>
                                                                                        );
                                                                                    }

                                                                                    return (
                                                                                        <Link
                                                                                            key={menuItem.path}
                                                                                            to={menuItem.path}
                                                                                            onClick={() => isMobile && setIsOpen(false)}
                                                                                            className={`block pl-12 pr-4 py-1.5 text-sm smooth-transition border-l-2 ml-4 ${isActive(menuItem.path)
                                                                                                ? 'bg-white/10 text-white font-medium border-white'
                                                                                                : 'text-silver-dark hover:text-white hover:bg-white/10 border-transparent hover:border-white/50'
                                                                                                }`}
                                                                                        >
                                                                                            {menuItem.label}
                                                                                        </Link>
                                                                                    );
                                                                                })}
                                                                            </motion.div>
                                                                        )}
                                                                    </AnimatePresence>
                                                                </div>
                                                            );
                                                        }

                                                        return null;
                                                    })}
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
                                    </div>
                                );
                            }

                            // Special handling for BLINK with submenu
                            if (item.path === '/blink') {
                                if (!canAccessPortal('blink_dashboard')) return null;
                                const isExpanded = expandedSection === 'blink';
                                const isBlinkActive = location.pathname.startsWith('/blink');

                                return (
                                    <div key={item.path}>
                                        <div className="flex items-center gap-1" id="menu-blink">
                                            <Link
                                                to={item.path}
                                                onClick={() => {
                                                    if (isMobile) setIsOpen(false);
                                                    const isCurrentlyExpanded = expandedSection === 'blink';
                                                    setExpandedSection(isCurrentlyExpanded ? '' : 'blink');
                                                    if (!isCurrentlyExpanded) scrollToElement('menu-blink');
                                                }}
                                                className={`flex-1 flex items-center gap-3 px-4 py-3 rounded-lg smooth-transition text-sm ${isBlinkActive
                                                    ? 'text-silver-light'
                                                    : 'text-silver-dark hover:text-silver-light hover:bg-dark-surface'
                                                    }`}
                                            >
                                                <item.icon className="w-5 h-5 flex-shrink-0" />
                                                <div className="flex-1 text-left">
                                                    <div className="font-medium">{item.label}</div>
                                                    <div className={`text-xs ${isBlinkActive ? 'text-silver-dark' : 'text-silver-dark'}`}>
                                                        {item.subtitle}
                                                    </div>
                                                </div>
                                            </Link>
                                            <button
                                                onClick={() => {
                                                    const newState = isExpanded ? '' : 'blink';
                                                    setExpandedSection(newState);
                                                    if (newState === 'blink') scrollToElement('menu-blink');
                                                }}
                                                className="p-2 hover:bg-dark-surface rounded-lg smooth-transition"
                                            >
                                                <ChevronRight className={`w-4 h-4 transition-transform text-silver-dark ${isExpanded ? 'rotate-90' : ''}`} />
                                            </button>
                                        </div>

                                        <AnimatePresence>
                                            {isExpanded && (
                                                <motion.div
                                                    initial={{ height: 0, opacity: 0 }}
                                                    animate={{ height: 'auto', opacity: 1 }}
                                                    exit={{ height: 0, opacity: 0 }}
                                                    className="ml-8 mt-1 space-y-1 overflow-hidden"
                                                >
                                                    {blinkSubMenuItems.map((subItem, idx) => {
                                                        // Standalone items (Dashboard)
                                                        if (!subItem.type) {
                                                            if (subItem.menuCode && !canAccessPortal(subItem.menuCode)) return null;
                                                            return (
                                                                <Link
                                                                    key={subItem.path}
                                                                    to={subItem.path}
                                                                    onClick={() => isMobile && setIsOpen(false)}
                                                                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm smooth-transition ${isActive(subItem.path)
                                                                        ? 'bg-white/20 text-white font-medium'
                                                                        : 'text-silver-dark hover:text-white hover:bg-white/10'
                                                                        }`}
                                                                >
                                                                    {subItem.icon && <subItem.icon className="w-4 h-4" />}
                                                                    <span>{subItem.label}</span>
                                                                </Link>
                                                            );
                                                        }

                                                        // Render category dengan nested items
                                                        if (subItem.type === 'category') {
                                                            const lastWord = subItem.label.toLowerCase().split(' ').pop();
                                                            const categoryKey = 'blink-' + lastWord;
                                                            const isCategoryExpanded = expandedCategories.includes(categoryKey);

                                                            // Filter items yang bisa diakses (skip dividers in filter)
                                                            const accessibleItems = subItem.items.filter(itemObj =>
                                                                itemObj.type === 'divider' || !itemObj.menuCode || canAccessPortal(itemObj.menuCode)
                                                            );
                                                            // Count actual menu items (non-divider) accessible
                                                            const hasAccessibleMenuItems = accessibleItems.some(itemObj => itemObj.type !== 'divider');
                                                            if (!hasAccessibleMenuItems) return null;

                                                            return (
                                                                <div key={`category-${idx}`}>
                                                                    {/* Category Header - Clickable */}
                                                                    <button
                                                                        onClick={() => {
                                                                            setExpandedCategories(prev =>
                                                                                prev.includes(categoryKey)
                                                                                    ? prev.filter(c => c !== categoryKey)
                                                                                    : [...prev, categoryKey]
                                                                            );
                                                                        }}
                                                                        className="w-full flex items-center justify-between px-4 py-2 text-sm font-semibold text-silver hover:text-silver-light smooth-transition"
                                                                    >
                                                                        <span>{subItem.label}</span>
                                                                        <ChevronRight className={`w-3 h-3 transition-transform ${isCategoryExpanded ? 'rotate-90' : ''}`} />
                                                                    </button>

                                                                    {/* Category Items */}
                                                                    <AnimatePresence>
                                                                        {isCategoryExpanded && (
                                                                            <motion.div
                                                                                initial={{ height: 0, opacity: 0 }}
                                                                                animate={{ height: 'auto', opacity: 1 }}
                                                                                exit={{ height: 0, opacity: 0 }}
                                                                                className="overflow-hidden"
                                                                            >
                                                                                {accessibleItems.map((itemObj, itemIdx) => {
                                                                                    // Handle divider type for subcategory headers
                                                                                    if (itemObj.type === 'divider') {
                                                                                        return (
                                                                                            <div key={`divider-${itemIdx}`} className="pl-6 pr-4 pt-3 pb-1 border-t border-dark-border/30 mt-1 first:mt-0 first:border-t-0">
                                                                                                <span className="text-xs font-bold text-silver uppercase tracking-wider">
                                                                                                    {itemObj.label}
                                                                                                </span>
                                                                                            </div>
                                                                                        );
                                                                                    }

                                                                                    // Regular menu item with indentation
                                                                                    return (
                                                                                        <Link
                                                                                            key={itemObj.path}
                                                                                            to={itemObj.path}
                                                                                            onClick={() => isMobile && setIsOpen(false)}
                                                                                            className={`flex items-center ${itemObj.indent ? 'pl-16' : 'pl-12'} pr-4 py-1.5 text-sm smooth-transition border-l-2 ml-4 ${isActive(itemObj.path)
                                                                                                ? 'bg-white/20 text-white font-medium border-white sidebar-active-item'
                                                                                                : 'text-silver-dark hover:text-white hover:bg-white/10 border-transparent hover:border-white/50'
                                                                                                }`}
                                                                                        >
                                                                                            <span className="flex-1">{itemObj.label}</span>
                                                                                            {itemObj.showBadge && (itemObj.menuCode === 'blink_sales_approval' ? blinkSalesPendingCount : blinkOpsPendingCount) > 0 && (
                                                                                                <span className="ml-2 min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-yellow-500 text-white text-[10px] font-bold px-1 animate-pulse">
                                                                                                    {(itemObj.menuCode === 'blink_sales_approval' ? blinkSalesPendingCount : blinkOpsPendingCount) > 99 ? '99+' : (itemObj.menuCode === 'blink_sales_approval' ? blinkSalesPendingCount : blinkOpsPendingCount)}
                                                                                                </span>
                                                                                            )}
                                                                                        </Link>
                                                                                    );
                                                                                })}
                                                                            </motion.div>
                                                                        )}
                                                                    </AnimatePresence>
                                                                </div>
                                                            );
                                                        }

                                                        return null;
                                                    })}
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
                                    </div>
                                );
                            }

                            return <MenuLink key={item.path} item={item} isMobile={isMobile} />;
                        })}
                    </div>
                </div>

                {/* Admin Section - only for admin/super_admin */}
                {(['super_admin', 'admin', 'superuser'].includes(user?.user_level?.toLowerCase())) && (
                    <div>
                        <h3 className="px-4 mb-3 text-xs font-semibold text-silver-dark uppercase tracking-wider">
                            Administrasi
                        </h3>
                        <div className="space-y-1">
                            <button
                                onClick={() => {
                                    setExpandedCategories(prev =>
                                        prev.includes('central-users')
                                            ? prev.filter(c => c !== 'central-users')
                                            : [...prev, 'central-users']
                                    );
                                }}
                                className="w-full flex items-center justify-between px-4 py-2 mt-2 text-sm font-semibold text-silver hover:text-silver-light smooth-transition focus:outline-none"
                            >
                                <div className="flex items-center gap-2">
                                    <Shield className="w-4 h-4 text-red-400" />
                                    <span>User Management</span>
                                </div>
                                <ChevronRight className={`w-3 h-3 transition-transform ${expandedCategories.includes('central-users') ? 'rotate-90' : ''}`} />
                            </button>

                            <AnimatePresence>
                                {expandedCategories.includes('central-users') && (
                                    <motion.div
                                        initial={{ height: 0, opacity: 0 }}
                                        animate={{ height: 'auto', opacity: 1 }}
                                        exit={{ height: 0, opacity: 0 }}
                                        className="overflow-hidden mt-1 space-y-1"
                                    >
                                        <Link
                                            to="/admin/users"
                                            onClick={() => isMobile && setIsOpen(false)}
                                            className={`block pl-10 pr-4 py-1.5 text-sm smooth-transition border-l-2 ml-4 ${isActive('/admin/users')
                                                ? 'bg-red-500/20 text-red-500 font-medium border-red-500 active-sidebar-item'
                                                : 'text-silver-dark hover:text-silver-light hover:bg-dark-surface/50 border-transparent hover:border-silver-dark/50'
                                                }`}
                                        >
                                            Manajemen User
                                        </Link>
                                        <Link
                                            to="/admin/permissions"
                                            onClick={() => isMobile && setIsOpen(false)}
                                            className={`block pl-10 pr-4 py-1.5 text-sm smooth-transition border-l-2 ml-4 ${isActive('/admin/permissions')
                                                ? 'bg-red-500/20 text-red-500 font-medium border-red-500 active-sidebar-item'
                                                : 'text-silver-dark hover:text-silver-light hover:bg-dark-surface/50 border-transparent hover:border-silver-dark/50'
                                                }`}
                                        >
                                            Manajemen Role & Akses
                                        </Link>
                                        <Link
                                            to="/admin/user-permissions"
                                            onClick={() => isMobile && setIsOpen(false)}
                                            className={`block pl-10 pr-4 py-1.5 text-sm smooth-transition border-l-2 ml-4 ${isActive('/admin/user-permissions')
                                                ? 'bg-red-500/20 text-red-500 font-medium border-red-500 active-sidebar-item'
                                                : 'text-silver-dark hover:text-silver-light hover:bg-dark-surface/50 border-transparent hover:border-silver-dark/50'
                                                }`}
                                        >
                                            Penugasan Role User
                                        </Link>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    </div>
                )}
            </nav>

            {/* Footer - User Info + Logout */}
            <div className="px-4 py-3 border-t border-dark-border">
                {/* User info row */}
                <div className="flex items-center gap-3 px-2 py-2 mb-2 rounded-lg bg-dark-surface/50">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-accent-blue to-accent-cyan flex items-center justify-center flex-shrink-0">
                        <UserCircle className="w-5 h-5 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-silver-light truncate">
                            {user?.full_name || user?.username || 'User'}
                        </div>
                        <div className="text-xs text-silver-dark truncate capitalize">
                            {user?.user_level?.replace(/_/g, ' ') || 'User'}
                        </div>
                    </div>
                </div>

                {/* Logout button */}
                <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-red-400 hover:text-red-300 hover:bg-red-500/10 smooth-transition font-medium"
                >
                    <LogOut className="w-4 h-4 flex-shrink-0" />
                    <span>Keluar</span>
                </button>

                {/* Change Password button */}
                <button
                    onClick={() => setShowChangePassword(true)}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-accent-blue hover:text-blue-300 hover:bg-blue-500/10 smooth-transition font-medium"
                >
                    <Key className="w-4 h-4 flex-shrink-0" />
                    <span>Ubah Password</span>
                </button>

                {/* Branding */}
                <div className="text-center pt-2 border-t border-dark-border/30 mt-2">
                    <p className="text-[10px] text-silver-dark/50">
                        © 2024 Bakhtera-1 • v1.0.0
                    </p>
                    <a
                        href="https://logikai.studio"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[10px] text-accent-orange/60 hover:text-accent-orange/90 transition-colors"
                    >
                        By : LogikAi.studio
                    </a>
                </div>
            </div>
        </div>
    );

    return (
        <>
            {/* Mobile Menu Button */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="fixed top-4 left-4 z-50 lg:hidden p-2 rounded-lg bg-dark-card border border-dark-border text-silver hover:text-silver-light smooth-transition"
            >
                {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>

            {/* Desktop Sidebar */}
            <aside className="hidden lg:flex lg:w-[308px] lg:flex-col lg:fixed lg:inset-y-0 glass-card border-r border-dark-border">
                <SidebarContent />
            </aside>

            {/* Mobile Sidebar */}
            <AnimatePresence>
                {isOpen && (
                    <>
                        {/* Backdrop */}
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setIsOpen(false)}
                            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-40 lg:hidden"
                        />

                        {/* Sidebar */}
                        <motion.aside
                            initial={{ x: '-100%' }}
                            animate={{ x: 0 }}
                            exit={{ x: '-100%' }}
                            transition={{ type: 'tween', duration: 0.3 }}
                            className="fixed inset-y-0 left-0 w-64 glass-card border-r border-dark-border z-50 lg:hidden"
                        >
                            <SidebarContent isMobile />
                        </motion.aside>
                    </>
                )}
            </AnimatePresence>
            {/* Change Password Modal */}
            {showChangePassword && (
                <ChangePasswordModal
                    userId={user?.id}
                    onClose={() => setShowChangePassword(false)}
                />
            )}
        </>
    );
};

/* =============================================================================
 * CHANGE PASSWORD MODAL
 * ============================================================================= */
const ChangePasswordModal = ({ userId, onClose }) => {
    const [oldPassword, setOldPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showOld, setShowOld] = useState(false);
    const [showNew, setShowNew] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setSuccess('');

        if (newPassword !== confirmPassword) {
            setError('Konfirmasi password tidak cocok');
            return;
        }

        setLoading(true);
        const result = await changePassword(userId, oldPassword, newPassword);

        if (result.success) {
            setSuccess(result.message);
            setOldPassword('');
            setNewPassword('');
            setConfirmPassword('');
            setTimeout(() => onClose(), 2000);
        } else {
            setError(result.error);
        }
        setLoading(false);
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="bg-dark-card border border-dark-border rounded-2xl p-6 w-full max-w-sm shadow-2xl mx-4">
                <div className="flex items-center justify-between mb-5">
                    <h2 className="text-lg font-semibold text-silver-light flex items-center gap-2">
                        <Key className="w-5 h-5 text-accent-blue" />
                        Ubah Password
                    </h2>
                    <button onClick={onClose} className="text-silver-dark hover:text-silver-light smooth-transition">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {error && (
                    <div className="flex items-center gap-2 px-3 py-2.5 mb-4 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
                        <AlertCircle className="w-4 h-4 flex-shrink-0" />
                        {error}
                    </div>
                )}

                {success && (
                    <div className="flex items-center gap-2 px-3 py-2.5 mb-4 rounded-lg bg-green-500/10 border border-green-500/30 text-green-400 text-sm">
                        <CheckCircle className="w-4 h-4 flex-shrink-0" />
                        {success}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                    {/* Old Password */}
                    <div>
                        <label className="block text-sm text-silver-dark mb-1.5">Password Lama</label>
                        <div className="relative">
                            <input
                                type={showOld ? 'text' : 'password'}
                                value={oldPassword}
                                onChange={e => setOldPassword(e.target.value)}
                                className="w-full px-3 py-2.5 pr-10 rounded-lg bg-dark-surface border border-dark-border text-silver-light text-sm focus:outline-none focus:ring-2 focus:ring-accent-blue/50 focus:border-accent-blue/50"
                                placeholder="Masukkan password saat ini"
                                required
                                autoFocus
                            />
                            <button
                                type="button"
                                onClick={() => setShowOld(!showOld)}
                                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-silver-dark hover:text-silver-light"
                            >
                                {showOld ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                        </div>
                    </div>

                    {/* New Password */}
                    <div>
                        <label className="block text-sm text-silver-dark mb-1.5">Password Baru</label>
                        <div className="relative">
                            <input
                                type={showNew ? 'text' : 'password'}
                                value={newPassword}
                                onChange={e => setNewPassword(e.target.value)}
                                className="w-full px-3 py-2.5 pr-10 rounded-lg bg-dark-surface border border-dark-border text-silver-light text-sm focus:outline-none focus:ring-2 focus:ring-accent-blue/50 focus:border-accent-blue/50"
                                placeholder="Min 8 karakter, huruf & angka"
                                required
                                minLength={8}
                            />
                            <button
                                type="button"
                                onClick={() => setShowNew(!showNew)}
                                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-silver-dark hover:text-silver-light"
                            >
                                {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                        </div>
                        {/* Strength indicator */}
                        {newPassword && (
                            <div className="mt-1.5 space-y-1">
                                <div className="flex gap-1">
                                    {[1, 2, 3, 4].map(i => (
                                        <div key={i} className={`h-1 flex-1 rounded-full transition-colors ${newPassword.length >= 8 && /[a-zA-Z]/.test(newPassword) && /[0-9]/.test(newPassword)
                                            ? i <= 3 ? 'bg-green-500' : (/[^a-zA-Z0-9]/.test(newPassword) ? 'bg-green-500' : 'bg-gray-600')
                                            : newPassword.length >= 8
                                                ? i <= 2 ? 'bg-yellow-500' : 'bg-gray-600'
                                                : i <= 1 ? 'bg-red-500' : 'bg-gray-600'
                                            }`} />
                                    ))}
                                </div>
                                <p className={`text-[11px] ${newPassword.length >= 8 && /[a-zA-Z]/.test(newPassword) && /[0-9]/.test(newPassword)
                                    ? 'text-green-400' : 'text-silver-dark'
                                    }`}>
                                    {newPassword.length < 8 ? `${8 - newPassword.length} karakter lagi` :
                                        !/[a-zA-Z]/.test(newPassword) ? 'Tambahkan huruf' :
                                            !/[0-9]/.test(newPassword) ? 'Tambahkan angka' :
                                                '✓ Password kuat'}
                                </p>
                            </div>
                        )}
                    </div>

                    {/* Confirm Password */}
                    <div>
                        <label className="block text-sm text-silver-dark mb-1.5">Konfirmasi Password Baru</label>
                        <input
                            type={showNew ? 'text' : 'password'}
                            value={confirmPassword}
                            onChange={e => setConfirmPassword(e.target.value)}
                            className={`w-full px-3 py-2.5 rounded-lg bg-dark-surface border text-silver-light text-sm focus:outline-none focus:ring-2 focus:ring-accent-blue/50 ${confirmPassword && confirmPassword !== newPassword
                                ? 'border-red-500/50'
                                : confirmPassword && confirmPassword === newPassword
                                    ? 'border-green-500/50'
                                    : 'border-dark-border'
                                }`}
                            placeholder="Ketik ulang password baru"
                            required
                        />
                        {confirmPassword && confirmPassword !== newPassword && (
                            <p className="text-[11px] text-red-400 mt-1">Password tidak cocok</p>
                        )}
                    </div>

                    {/* Buttons */}
                    <div className="flex justify-end gap-3 pt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-sm text-silver-dark hover:text-silver-light smooth-transition rounded-lg hover:bg-dark-surface"
                        >
                            Batal
                        </button>
                        <button
                            type="submit"
                            disabled={loading || !oldPassword || !newPassword || newPassword !== confirmPassword}
                            className="px-4 py-2 text-sm font-medium bg-accent-blue text-white rounded-lg hover:bg-accent-blue/90 smooth-transition disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {loading ? 'Menyimpan...' : 'Ubah Password'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default Sidebar;
