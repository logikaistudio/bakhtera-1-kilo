import React from 'react';
import { Link } from 'react-router-dom';
import {
    Package,
    FileText,
    Ship,
    Plane,
    TrendingUp,
    DollarSign,
    Truck,
    MapPin,
    BarChart3,
    PieChart,
    ShoppingCart,
    Clock,
    FileCheck
} from 'lucide-react';

const BlinkDashboard = () => {
    // Menu items organized by department
    const salesMarketingMenus = [
        {
            path: '/blink/quotations',
            label: 'Quotation Management',
            description: 'Kelola penawaran harga untuk customer',
            icon: FileText,
            color: 'blue'
        },
        {
            path: '/blink/finance/sales',
            label: 'Sales & Revenue',
            description: 'Tracking pendapatan penjualan',
            icon: TrendingUp,
            color: 'emerald'
        }
    ];

    const operationsMenus = [
        {
            path: '/blink/shipments',
            label: 'Shipment Management',
            description: 'Kelola pengiriman dan status',
            icon: Ship,
            color: 'cyan'
        },
        {
            path: '/blink/operations/tracking',
            label: 'Tracking & Monitoring',
            description: 'Monitor shipment dalam perjalanan',
            icon: MapPin,
            color: 'orange'
        },
        {
            path: '/blink/operations/bl',
            label: 'BL Documents',
            description: 'Bill of Lading management',
            icon: FileCheck,
            color: 'indigo'
        },
        {
            path: '/blink/operations/awb',
            label: 'AWB Documents',
            description: 'Air Waybill management',
            icon: Plane,
            color: 'sky'
        },
        {
            path: '/blink/master/routes',
            label: 'Master Routes',
            description: 'Database rute pengiriman',
            icon: Truck,
            color: 'slate'
        }
    ];

    const financeMenus = [
        {
            path: '/blink/finance/sales',
            label: 'BL Margin Analysis',
            description: 'Analisa margin Bill of Lading',
            icon: BarChart3,
            color: 'green'
        },
        {
            path: '/blink/finance/sales',
            label: 'AWB Margin Analysis',
            description: 'Analisa margin Air Waybill',
            icon: PieChart,
            color: 'violet'
        },
        {
            path: '/blink/finance/profit-loss',
            label: 'Laba Rugi (Profit & Loss)',
            description: 'Laporan Laba Rugi Realtime',
            icon: DollarSign,
            color: 'amber'
        },
        {
            path: '/blink/finance/selling-buying',
            label: 'Selling vs Buying',
            description: 'Analisis margin per shipment (Manajer)',
            icon: TrendingUp,
            color: 'emerald'
        }
    ];

    const colorClasses = {
        blue: 'from-blue-500/20 to-blue-600/20 border-blue-500/30 hover:border-blue-500/50',
        purple: 'from-purple-500/20 to-purple-600/20 border-purple-500/30 hover:border-purple-500/50',
        emerald: 'from-emerald-500/20 to-emerald-600/20 border-emerald-500/30 hover:border-emerald-500/50',
        cyan: 'from-cyan-500/20 to-cyan-600/20 border-cyan-500/30 hover:border-cyan-500/50',
        orange: 'from-orange-500/20 to-orange-600/20 border-orange-500/30 hover:border-orange-500/50',
        indigo: 'from-indigo-500/20 to-indigo-600/20 border-indigo-500/30 hover:border-indigo-500/50',
        sky: 'from-sky-500/20 to-sky-600/20 border-sky-500/30 hover:border-sky-500/50',
        slate: 'from-slate-500/20 to-slate-600/20 border-slate-500/30 hover:border-slate-500/50',
        green: 'from-green-500/20 to-green-600/20 border-green-500/30 hover:border-green-500/50',
        violet: 'from-violet-500/20 to-violet-600/20 border-violet-500/30 hover:border-violet-500/50',
        amber: 'from-amber-500/20 to-amber-600/20 border-amber-500/30 hover:border-amber-500/50'
    };

    const iconColorClasses = {
        blue: 'text-blue-400',
        purple: 'text-purple-400',
        emerald: 'text-emerald-400',
        cyan: 'text-cyan-400',
        orange: 'text-orange-400',
        indigo: 'text-indigo-400',
        sky: 'text-sky-400',
        slate: 'text-slate-400',
        green: 'text-green-400',
        violet: 'text-violet-400',
        amber: 'text-amber-400'
    };

    const MenuCard = ({ menu }) => {
        const Icon = menu.icon;
        return (
            <Link
                to={menu.path}
                className={`block p-5 rounded-lg bg-gradient-to-br ${colorClasses[menu.color]} border smooth-transition transform hover:scale-105 hover:shadow-lg`}
            >
                <div className="flex items-start gap-4">
                    <div className={`p-3 rounded-lg bg-dark-surface/50 ${iconColorClasses[menu.color]}`}>
                        <Icon className="w-6 h-6" />
                    </div>
                    <div className="flex-1">
                        <h3 className="text-lg font-semibold text-silver-light mb-1">{menu.label}</h3>
                        <p className="text-sm text-silver-dark">{menu.description}</p>
                    </div>
                </div>
            </Link>
        );
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-4xl font-bold gradient-text">BLINK Dashboard</h1>
                <p className="text-silver-dark mt-2">Freight & Forward Management Portal</p>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="glass-card p-6 rounded-lg">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-silver-dark">Total Quotations</p>
                            <p className="text-3xl font-bold text-silver-light mt-1">0</p>
                        </div>
                        <FileText className="w-10 h-10 text-blue-400" />
                    </div>
                </div>

                <div className="glass-card p-6 rounded-lg">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-silver-dark">Sales Orders</p>
                            <p className="text-3xl font-bold text-silver-light mt-1">0</p>
                        </div>
                        <Package className="w-10 h-10 text-purple-400" />
                    </div>
                </div>

                <div className="glass-card p-6 rounded-lg">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-silver-dark">Active Shipments</p>
                            <p className="text-3xl font-bold text-silver-light mt-1">0</p>
                        </div>
                        <Ship className="w-10 h-10 text-emerald-400" />
                    </div>
                </div>

                <div className="glass-card p-6 rounded-lg">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-silver-dark">Total Revenue</p>
                            <p className="text-3xl font-bold text-silver-light mt-1">$0</p>
                        </div>
                        <DollarSign className="w-10 h-10 text-orange-400" />
                    </div>
                </div>
            </div>

            {/* Sales & Marketing Section */}
            <div>
                <div className="mb-4">
                    <h2 className="text-2xl font-bold text-silver-light flex items-center gap-2">
                        📋 Sales & Marketing
                    </h2>
                    <p className="text-sm text-silver-dark mt-1">Kelola quotation, sales order, dan revenue tracking</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {salesMarketingMenus.map((menu, index) => (
                        <MenuCard key={index} menu={menu} />
                    ))}
                </div>
            </div>

            {/* Operations Section */}
            <div>
                <div className="mb-4">
                    <h2 className="text-2xl font-bold text-silver-light flex items-center gap-2">
                        🚚 Operations
                    </h2>
                    <p className="text-sm text-silver-dark mt-1">Manajemen shipment, tracking, dokumen, dan master data</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {operationsMenus.map((menu, index) => (
                        <MenuCard key={index} menu={menu} />
                    ))}
                </div>
            </div>

            {/* Finance Section */}
            <div>
                <div className="mb-4">
                    <h2 className="text-2xl font-bold text-silver-light flex items-center gap-2">
                        💰 Finance
                    </h2>
                    <p className="text-sm text-silver-dark mt-1">Analisa margin BL/AWB dan profitabilitas</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {financeMenus.map((menu, index) => (
                        <MenuCard key={index} menu={menu} />
                    ))}
                </div>
            </div>

            {/* Welcome Message */}
            <div className="glass-card p-8 rounded-lg text-center">
                <Plane className="w-16 h-16 text-accent-orange mx-auto mb-4" />
                <h2 className="text-2xl font-bold text-silver-light mb-2">Selamat Datang di BLINK</h2>
                <p className="text-silver-dark max-w-2xl mx-auto">
                    Freight & Forward Management System untuk mengelola quotation, sales order, shipment, dan profit tracking.
                    Mulai dengan memilih salah satu menu di atas sesuai departemen Anda.
                </p>
            </div>
        </div>
    );
};

export default BlinkDashboard;
