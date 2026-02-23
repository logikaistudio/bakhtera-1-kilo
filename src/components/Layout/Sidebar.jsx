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
    AlertCircle
} from 'lucide-react';

import { Sun, Moon } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { changePassword } from '../../services/userService';
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
    const navigate = useNavigate();
    const { user, logout } = useAuth();
    const [isOpen, setIsOpen] = useState(false);
    const [expandedSection, setExpandedSection] = useState('');
    const [expandedCategories, setExpandedCategories] = useState(['marketing', 'operations', 'finance', 'costing', 'profit', 'data', 'bridge-operasional', 'bridge-finance', 'bridge-data', 'central-users']); // All expanded by default
    const [showChangePassword, setShowChangePassword] = useState(false);
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

    // DEBUG: log user level (remove after verifying)
    console.log('[Sidebar] user object:', user);
    console.log('[Sidebar] user_level:', user?.user_level);

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
                { path: '/bridge/ata-carnet', label: 'ATA Carnet' },
                { path: '/bridge/pengajuan', label: 'Pengajuan' },
                { path: '/bridge/inventory', label: 'Inventaris Gudang' },
                { path: '/bridge/outbound-inventory', label: 'Laporan Barang Keluar' },
                { path: '/bridge/goods-movement', label: 'Pergerakan Barang' },
                { path: '/bridge/delivery-notes', label: 'Surat Jalan' },
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
                                                                                {subItem.items.map((menuItem) => (
                                                                                    <Link
                                                                                        key={menuItem.path}
                                                                                        to={menuItem.path}
                                                                                        onClick={() => isMobile && setIsOpen(false)}
                                                                                        className={`block pl-12 pr-4 py-1.5 text-sm smooth-transition border-l-2 ml-4 ${isActive(menuItem.path)
                                                                                            ? 'bg-accent-blue/20 text-accent-blue font-medium border-accent-blue active-sidebar-item'
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
                                                                                {subItem.items.map((menuItem, itemIdx) => {
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
                                                                        className="w-full flex items-center justify-between px-4 py-2 text-sm font-semibold text-silver hover:text-silver-light smooth-transition"
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
                                                                                                <span className="text-xs font-bold text-silver uppercase tracking-wider">
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
                                                                                            className={`block pl-12 pr-4 py-1.5 text-sm smooth-transition border-l-2 ml-4 ${isActive(item.path)
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
                                                                className={`flex items-center gap-2 pl-10 pr-3 py-1.5 rounded-r-lg text-sm smooth-transition border-l-2 ${isActive(subItem.path)
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

                        {/* Admin Menu - Admin & Super Admin */}
                        {(['super_admin', 'admin', 'superuser'].includes(user?.user_level?.toLowerCase())) && (
                            <>
                                <div className="px-4 pt-4 pb-2">
                                    <div className="border-t border-dark-border/30" />
                                </div>
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
                                        <span>Administrasi</span>
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
                            </>
                        )}
                    </div>
                </div>
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
