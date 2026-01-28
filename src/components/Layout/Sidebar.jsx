import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
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
    Shield
} from 'lucide-react';

import { Sun, Moon } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';

// Theme Toggle Component
const ThemeToggle = () => {
    const { theme, toggleTheme } = useTheme();

    return (
        <button
            onClick={toggleTheme}
            className="p-2 rounded-lg bg-dark-surface hover:bg-dark-card border border-dark-border transition-all duration-300 hover:border-accent-blue"
            title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
        >
            {theme === 'dark' ? (
                <Sun className="w-5 h-5 text-accent-orange" />
            ) : (
                <Moon className="w-5 h-5 text-accent-blue" />
            )}
        </button>
    );
};

const Sidebar = () => {
    const location = useLocation();
    const { user } = useAuth();
    const [isOpen, setIsOpen] = useState(false);
    const [expandedSection, setExpandedSection] = useState('');
    const [expandedCategories, setExpandedCategories] = useState(['marketing', 'operations', 'finance', 'costing', 'profit', 'data', 'bridge-operasional', 'bridge-finance', 'bridge-data']); // All expanded by default

    const isActive = (path) => location.pathname === path;

    const mainMenuItems = [
        { path: '/', label: 'Dashboard Bakhtera-1', icon: LayoutDashboard },
        { path: '/blink', label: 'BLINK', subtitle: 'Freight & Forward Management', icon: Plane },
        { path: '/big', label: 'BIG', subtitle: 'Event Organizer', icon: Calendar },
        { path: '/bridge', label: 'BRIDGE', subtitle: 'Bounded Management', icon: Building2 },
        { path: '/pabean', label: 'Pabean', subtitle: 'Customs Portal', icon: Building2 },
    ];

    const centralizedMenuItems = [
        { path: '/vendors', label: 'Manajemen Vendor', icon: Users },
        { path: '/customers', label: 'Manajemen Pelanggan', icon: UserCircle },
        { path: '/finance', label: 'Keuangan', icon: Wallet },
        { path: '/finance/coa', label: 'Master Akun (COA)', icon: FileCheck },
        { path: '/settings', label: 'Pengaturan Perusahaan', icon: Building2 },
    ];

    // Bridge submenu items
    const bridgeSubMenuItems = [
        // Operasional Category
        {
            type: 'category', label: '📦 Operasional', items: [
                { path: '/bridge/pengajuan', label: 'Pengajuan' },
                { path: '/bridge/inventory', label: 'Inventaris Gudang' },
                { path: '/bridge/outbound-inventory', label: 'Laporan Barang Keluar' },
                { path: '/bridge/goods-movement', label: 'Pergerakan Barang' },
            ]
        },

        // Finance Category
        {
            type: 'category', label: '💰 Finance', items: [
                { path: '/bridge/finance/invoices', label: 'Invoice' },
                { path: '/bridge/finance/po', label: 'PO' },
                { path: '/bridge/finance/ar', label: 'AR' },
                { path: '/bridge/finance/ap', label: 'AP' },
            ]
        },

        // Master Data Category
        {
            type: 'category', label: '⚙️ Master Data', items: [
                { path: '/bridge/master/partners', label: 'Mitra Bisnis' },
                { path: '/bridge/bc-master', label: 'Master Kode BC' },
                { path: '/bridge/hs-master', label: 'Master Kode HS' },
                { path: '/bridge/item-master', label: 'Master Kode Barang' },
                { path: '/bridge/pic-master', label: 'Master PIC' },
                { path: '/bridge/code-of-account', label: 'Code of Account' },
            ]
        },
    ];

    // ... Pabean and other definitions ...

    // ... (Inside SidebarContent) ...
    // Note: I need to replace the definition AND the rendering logic.
    // Since replace_file_content handles a contiguous block, I will replace the definition first,
    // then I'll need another call for the rendering logic if they are far apart.
    // Wait, the definition is lines 72-83. The rendering is lines 215-271. 
    // They are far apart. I should use multi_replace.


    // Pabean submenu items
    const pabeanSubMenuItems = [
        { path: '/pabean/barang-masuk', label: 'Barang Masuk' },
        { path: '/pabean/barang-keluar', label: 'Barang Keluar' },
        { path: '/pabean/pergerakan', label: 'Barang Mutasi' },
    ];

    // BIG submenu - Event Organizer
    const bigSubMenuItems = [
        { path: '/big', label: 'Dashboard', icon: LayoutDashboard },

        // Sales Category
        {
            type: 'category', label: '📋 Sales', items: [
                { path: '/big/sales/quotations', label: 'Quotations' },
            ]
        },

        // Operations Category
        {
            type: 'category', label: '⚙️ Operations', items: [
                { path: '/big/operations/events', label: 'Event Management' },
                { path: '/big/operations/costs', label: 'Event Costs' },
            ]
        },

        // Finance Category
        {
            type: 'category', label: '💰 Finance', items: [
                { path: '/big/finance/invoices', label: 'Invoices' },
                { path: '/big/finance/ar', label: 'Piutang (AR)' },
            ]
        },
    ];

    // BLINK submenu - dengan Dashboard terpisah + 3 department categories + Master Data
    const blinkSubMenuItems = [
        // Dashboard - Standalone (outside categories)
        { path: '/blink', label: 'Dashboard', icon: LayoutDashboard },

        // Sales & Marketing Category
        {
            type: 'category', label: '📋 Sales & Marketing', items: [
                { path: '/blink/quotations', label: 'Quotations' },
                { path: '/blink/flow-monitor', label: 'Flow Monitor' },
                { path: '/blink/sales-achievement', label: 'Sales Achievement' }
            ]
        },

        // Operations Category
        {
            type: 'category', label: '🚚 Operations', items: [
                { path: '/blink/shipments', label: 'Shipment Management' },
                { path: '/blink/operations/bl', label: 'Document BL/AWB' },
            ]
        },

        // Profit & Costing Category (New - Promoted for Visibility)
        {
            type: 'category', label: '📈 Profit & Costing', items: [
                { path: '/blink/finance/selling-buying', label: 'Selling vs Buying Analysis' },
            ]
        },

        // Finance Category with Subcategories
        {
            type: 'category', label: '💰 Finance', items: [
                // Subcategory: Transaksi
                { type: 'divider', label: '📋 Transaksi' },
                { path: '/blink/finance/invoices', label: 'Invoice' },
                { path: '/blink/finance/purchase-orders', label: 'Purchase Order' },
                { path: '/blink/finance/ar', label: 'Piutang (AR)' },
                { path: '/blink/finance/ap', label: 'Hutang (AP)' },
                // Subcategory: Pencatatan
                { type: 'divider', label: '📝 Pencatatan' },
                { path: '/blink/finance/general-journal', label: 'Jurnal Umum' },
                { path: '/blink/finance/general-ledger', label: 'Buku Besar' },
                { path: '/blink/finance/trial-balance', label: 'Neraca Saldo' },
                // Subcategory: Laporan
                { type: 'divider', label: '📊 Laporan' },
                { path: '/blink/finance/profit-loss', label: 'Laba Rugi' },
                { path: '/blink/finance/balance-sheet', label: 'Neraca' },
            ]
        },

        // Master Data Category
        {
            type: 'category', label: '⚙️ Master Data', items: [
                { path: '/blink/master/partners', label: 'Mitra Bisnis' },
                { path: '/blink/master/routes', label: 'Master Routes' },
            ]
        },
    ];

    const MenuLink = ({ item, isMobile = false }) => (
        <Link
            to={item.path}
            onClick={() => isMobile && setIsOpen(false)}
            className={`flex items-center gap-3 px-4 py-3 rounded-lg smooth-transition ${isActive(item.path)
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
            <div className="px-6 py-6 border-b border-dark-border flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold gradient-text">BAKHTERA-1</h1>
                    <p className="text-xs text-silver-dark mt-1">Freight & Asset Management</p>
                </div>
                {/* Theme Toggle */}
                <ThemeToggle />
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
                                const isExpanded = expandedSection === 'bridge' || location.pathname.startsWith('/bridge');
                                const isBridgeActive = location.pathname.startsWith('/bridge');

                                return (
                                    <div key={item.path}>
                                        <div className="flex items-center gap-1">
                                            <Link
                                                to={item.path}
                                                onClick={() => isMobile && setIsOpen(false)}
                                                className={`flex-1 flex items-center gap-3 px-4 py-3 rounded-lg smooth-transition ${isBridgeActive
                                                    ? 'bg-accent-blue bg-opacity-20 text-accent-blue'
                                                    : 'text-silver-dark hover:text-silver-light hover:bg-dark-surface'
                                                    }`}
                                            >
                                                <item.icon className="w-5 h-5 flex-shrink-0" />
                                                <div className="flex-1 text-left">
                                                    <div className="font-medium">{item.label}</div>
                                                    <div className={`text-xs ${isBridgeActive ? 'text-accent-blue/70' : 'text-silver-dark'}`}>
                                                        {item.subtitle}
                                                    </div>
                                                </div>
                                            </Link>
                                            <button
                                                onClick={() => setExpandedSection(isExpanded ? '' : 'bridge')}
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
                                                                        className="w-full flex items-center justify-between px-4 py-2 text-xs font-semibold text-silver hover:text-silver-light smooth-transition"
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
                                                                                {subItem.items.map((menuItem) => (
                                                                                    <Link
                                                                                        key={menuItem.path}
                                                                                        to={menuItem.path}
                                                                                        onClick={() => isMobile && setIsOpen(false)}
                                                                                        className={`block pl-12 pr-4 py-1.5 text-xs smooth-transition border-l-2 ml-4 ${isActive(menuItem.path)
                                                                                            ? 'bg-accent-blue/20 text-accent-blue font-medium border-accent-blue'
                                                                                            : 'text-silver-dark hover:text-silver-light hover:bg-dark-surface/50 border-transparent hover:border-silver-dark/50'
                                                                                            }`}
                                                                                    >
                                                                                        {menuItem.label}
                                                                                    </Link>
                                                                                ))}
                                                                            </motion.div>
                                                                        )}
                                                                    </AnimatePresence>
                                                                </div>
                                                            );
                                                        }

                                                        // Standalone menu items
                                                        return (
                                                            <Link
                                                                key={subItem.path}
                                                                to={subItem.path}
                                                                onClick={() => isMobile && setIsOpen(false)}
                                                                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm smooth-transition ${isActive(subItem.path)
                                                                    ? 'bg-accent-blue text-white'
                                                                    : 'text-silver-dark hover:text-silver-light hover:bg-dark-surface'
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
                                const isExpanded = expandedSection === 'pabean' || location.pathname.startsWith('/pabean');
                                const isPabeanActive = location.pathname.startsWith('/pabean');

                                return (
                                    <div key={item.path}>
                                        <div className="flex items-center gap-1">
                                            <Link
                                                to={item.path}
                                                onClick={() => isMobile && setIsOpen(false)}
                                                className={`flex-1 flex items-center gap-3 px-4 py-3 rounded-lg smooth-transition ${isPabeanActive
                                                    ? 'bg-accent-green bg-opacity-20 text-accent-green'
                                                    : 'text-silver-dark hover:text-silver-light hover:bg-dark-surface'
                                                    }`}
                                            >
                                                <item.icon className="w-5 h-5 flex-shrink-0" />
                                                <div className="flex-1 text-left">
                                                    <div className="font-medium">{item.label}</div>
                                                    <div className={`text-xs ${isPabeanActive ? 'text-accent-green/70' : 'text-silver-dark'}`}>
                                                        {item.subtitle}
                                                    </div>
                                                </div>
                                            </Link>
                                            <button
                                                onClick={() => setExpandedSection(isExpanded ? '' : 'pabean')}
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
                                                    {pabeanSubMenuItems.map((subItem) => (
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
                                const isExpanded = expandedSection === 'big' || location.pathname.startsWith('/big');
                                const isBigActive = location.pathname.startsWith('/big');

                                return (
                                    <div key={item.path}>
                                        <div className="flex items-center gap-1">
                                            <Link
                                                to={item.path}
                                                onClick={() => isMobile && setIsOpen(false)}
                                                className={`flex-1 flex items-center gap-3 px-4 py-3 rounded-lg smooth-transition ${isBigActive
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
                                                onClick={() => setExpandedSection(isExpanded ? '' : 'big')}
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
                                                        // Render category dengan nested items
                                                        if (subItem.type === 'category') {
                                                            const categoryKey = 'big-' + subItem.label.toLowerCase().split(' ').pop();
                                                            const isCategoryExpanded = expandedCategories.includes(categoryKey);

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
                                                                        className="w-full flex items-center justify-between px-4 py-2 text-xs font-semibold text-silver hover:text-silver-light smooth-transition"
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
                                                                                {subItem.items.map((menuItem, itemIdx) => {
                                                                                    if (menuItem.type === 'divider') {
                                                                                        return (
                                                                                            <div key={`divider-${itemIdx}`} className="pl-6 pr-4 pt-3 pb-1 border-t border-dark-border/30 mt-1 first:mt-0 first:border-t-0">
                                                                                                <span className="text-[10px] font-bold text-silver uppercase tracking-wider">
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
                                                                                            className={`block pl-12 pr-4 py-1.5 text-xs smooth-transition border-l-2 ml-4 ${isActive(menuItem.path)
                                                                                                ? 'bg-accent-orange/20 text-accent-orange font-medium border-accent-orange'
                                                                                                : 'text-silver-dark hover:text-silver-light hover:bg-dark-surface/50 border-transparent hover:border-silver-dark/50'
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

                                                        // Standalone menu items
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
                                                    })}
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
                                    </div>
                                );
                            }

                            // Special handling for BLINK with submenu
                            if (item.path === '/blink') {
                                const isExpanded = expandedSection === 'blink' || location.pathname.startsWith('/blink');
                                const isBlinkActive = location.pathname.startsWith('/blink');

                                return (
                                    <div key={item.path}>
                                        <div className="flex items-center gap-1">
                                            <Link
                                                to={item.path}
                                                onClick={() => isMobile && setIsOpen(false)}
                                                className={`flex-1 flex items-center gap-3 px-4 py-3 rounded-lg smooth-transition ${isBlinkActive
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
                                                onClick={() => setExpandedSection(isExpanded ? '' : 'blink')}
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
                                                        // Render category dengan nested items
                                                        if (subItem.type === 'category') {
                                                            const categoryKey = subItem.label.toLowerCase().split(' ').pop(); // 'sales', 'operations', 'finance'
                                                            const isCategoryExpanded = expandedCategories.includes(categoryKey);

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
                                                                        className="w-full flex items-center justify-between px-4 py-2 text-xs font-semibold text-silver hover:text-silver-light smooth-transition"
                                                                    >
                                                                        <span>{subItem.label}</span>
                                                                        <ChevronRight className={`w-3 h-3 transition-transform ${isCategoryExpanded ? 'rotate-90' : ''}`} />
                                                                    </button>

                                                                    {/* Category Items - dengan indentation */}
                                                                    <AnimatePresence>
                                                                        {isCategoryExpanded && (
                                                                            <motion.div
                                                                                initial={{ height: 0, opacity: 0 }}
                                                                                animate={{ height: 'auto', opacity: 1 }}
                                                                                exit={{ height: 0, opacity: 0 }}
                                                                                className="overflow-hidden"
                                                                            >
                                                                                {subItem.items.map((item, itemIdx) => {
                                                                                    // Handle divider type for subcategory headers
                                                                                    if (item.type === 'divider') {
                                                                                        return (
                                                                                            <div key={`divider-${itemIdx}`} className="pl-6 pr-4 pt-3 pb-1 border-t border-dark-border/30 mt-1 first:mt-0 first:border-t-0">
                                                                                                <span className="text-[10px] font-bold text-silver uppercase tracking-wider">
                                                                                                    {item.label}
                                                                                                </span>
                                                                                            </div>
                                                                                        );
                                                                                    }

                                                                                    // Regular menu item with indentation
                                                                                    return (
                                                                                        <Link
                                                                                            key={item.path}
                                                                                            to={item.path}
                                                                                            onClick={() => isMobile && setIsOpen(false)}
                                                                                            className={`block pl-12 pr-4 py-1.5 text-xs smooth-transition border-l-2 ml-4 ${isActive(item.path)
                                                                                                ? 'bg-accent-orange/20 text-accent-orange font-medium border-accent-orange'
                                                                                                : 'text-silver-dark hover:text-silver-light hover:bg-dark-surface/50 border-transparent hover:border-silver-dark/50'
                                                                                                }`}
                                                                                        >
                                                                                            {item.label}
                                                                                        </Link>
                                                                                    );
                                                                                })}
                                                                            </motion.div>
                                                                        )}
                                                                    </AnimatePresence>
                                                                </div>
                                                            );
                                                        }

                                                        // Render standalone menu items (non-category)
                                                        // Handle divider type for subcategory headers
                                                        if (subItem.type === 'divider') {
                                                            return (
                                                                <div key={`divider-${idx}`} className="px-3 pt-4 pb-1 border-t border-dark-border/30 mt-2 first:mt-0 first:border-t-0">
                                                                    <span className="text-xs font-bold text-silver uppercase tracking-wider">
                                                                        {subItem.label === 'Pendaftaran' ? 'Pengajuan' : subItem.label}
                                                                    </span>
                                                                </div>
                                                            );
                                                        }

                                                        return (
                                                            <Link
                                                                key={subItem.path}
                                                                to={subItem.path}
                                                                onClick={() => isMobile && setIsOpen(false)}
                                                                className={`flex items-center gap-2 pl-10 pr-3 py-1.5 rounded-r-lg text-xs smooth-transition border-l-2 ${isActive(subItem.path)
                                                                    ? 'bg-accent-orange/20 text-accent-orange font-medium border-accent-orange'
                                                                    : 'text-silver-dark hover:text-silver-light hover:bg-dark-surface/50 font-normal border-transparent hover:border-silver-dark/30'
                                                                    }`}
                                                            >
                                                                {subItem.icon && <subItem.icon className="w-3 h-3" />}
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

                            return <MenuLink key={item.path} item={item} isMobile={isMobile} />;
                        })}
                    </div>
                </div>

                {/* Fungsi Terpusat */}
                <div>
                    <h3 className="px-4 mb-3 text-xs font-semibold text-silver-dark uppercase tracking-wider">
                        Fungsi Terpusat
                    </h3>
                    <div className="space-y-1">
                        {centralizedMenuItems.map((item) => (
                            <MenuLink key={item.path} item={item} isMobile={isMobile} />
                        ))}

                        {/* Admin Menu - Super Admin Only */}
                        {user?.user_level === 'super_admin' && (
                            <>
                                <div className="px-4 pt-4 pb-2">
                                    <div className="border-t border-dark-border/30" />
                                </div>
                                <Link
                                    to="/admin/users"
                                    onClick={() => isMobile && setIsOpen(false)}
                                    className={`flex items-center gap-3 px-4 py-3 rounded-lg smooth-transition ${isActive('/admin/users')
                                        ? 'bg-red-500 bg-opacity-20 text-red-400'
                                        : 'text-silver-dark hover:text-silver-light hover:bg-dark-surface'
                                        }`}
                                >
                                    <Shield className="w-5 h-5 flex-shrink-0" />
                                    <div className="flex-1">
                                        <div className="font-medium">User Management</div>
                                        <div className={`text-xs ${isActive('/admin/users') ? 'text-red-300' : 'text-silver-dark'}`}>
                                            Manage users & roles
                                        </div>
                                    </div>
                                </Link>
                                <Link
                                    to="/admin/permissions"
                                    onClick={() => isMobile && setIsOpen(false)}
                                    className={`flex items-center gap-3 px-4 py-3 rounded-lg smooth-transition ${isActive('/admin/permissions')
                                        ? 'bg-red-500 bg-opacity-20 text-red-400'
                                        : 'text-silver-dark hover:text-silver-light hover:bg-dark-surface'
                                        }`}
                                >
                                    <Shield className="w-5 h-5 flex-shrink-0" />
                                    <div className="flex-1">
                                        <div className="font-medium">Role Permissions</div>
                                        <div className={`text-xs ${isActive('/admin/permissions') ? 'text-red-300' : 'text-silver-dark'}`}>
                                            Assign by role
                                        </div>
                                    </div>
                                </Link>
                                <Link
                                    to="/admin/user-permissions"
                                    onClick={() => isMobile && setIsOpen(false)}
                                    className={`flex items-center gap-3 px-4 py-3 rounded-lg smooth-transition ${isActive('/admin/user-permissions')
                                        ? 'bg-red-500 bg-opacity-20 text-red-400'
                                        : 'text-silver-dark hover:text-silver-light hover:bg-dark-surface'
                                        }`}
                                >
                                    <Shield className="w-5 h-5 flex-shrink-0" />
                                    <div className="flex-1">
                                        <div className="font-medium">User Permissions</div>
                                        <div className={`text-xs ${isActive('/admin/user-permissions') ? 'text-red-300' : 'text-silver-dark'}`}>
                                            Assign by user
                                        </div>
                                    </div>
                                </Link>
                            </>
                        )}
                    </div>
                </div>
            </nav>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-dark-border text-center">
                <p className="text-xs text-silver-dark mb-0.5">
                    © 2024 Bakhtera-1 • v1.0.0
                </p>
                <a
                    href="https://logikai.studio"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[10px] text-accent-orange hover:text-accent-orange/80 transition-colors font-medium"
                >
                    By : LogikAi.studio
                </a>
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
            <aside className="hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0 glass-card border-r border-dark-border">
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
        </>
    );
};

export default Sidebar;
