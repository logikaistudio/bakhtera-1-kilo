import React, { useState } from 'react';
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
    FileCheck,
    Trash2,
    AlertTriangle,
    CheckCircle2,
    XCircle,
    Loader2,
    ChevronDown,
    ChevronUp,
    Database,
    X
} from 'lucide-react';
import { supabase } from '../../lib/supabase';

// ─── Table definitions with order of deletion (child → parent) ───────────────
const BLINK_TABLES = [
    {
        key: 'journal_entries',
        table: 'blink_journal_entries',
        label: 'General Journal Entries',
        description: 'Semua jurnal umum keuangan Blink',
        category: 'finance',
        icon: '📒'
    },
    {
        key: 'ap_transactions',
        table: 'blink_ap_transactions',
        label: 'Accounts Payable (AP)',
        description: 'Data hutang ke vendor',
        category: 'finance',
        icon: '🧾'
    },
    {
        key: 'ar_transactions',
        table: 'blink_ar_transactions',
        label: 'Accounts Receivable (AR)',
        description: 'Data piutang dari customer',
        category: 'finance',
        icon: '💳'
    },
    {
        key: 'payments',
        table: 'blink_payments',
        label: 'Invoice Payments',
        description: 'Data pembayaran invoice',
        category: 'finance',
        icon: '💵'
    },
    {
        key: 'invoices',
        table: 'blink_invoices',
        label: 'Invoices',
        description: 'Data invoice penjualan',
        category: 'finance',
        icon: '📄'
    },
    {
        key: 'purchase_orders',
        table: 'blink_purchase_orders',
        label: 'Purchase Orders (PO)',
        description: 'Data PO ke vendor',
        category: 'finance',
        icon: '🛒'
    },
    {
        key: 'tracking_updates',
        table: 'blink_tracking_updates',
        label: 'Tracking Updates',
        description: 'Riwayat tracking pengiriman',
        category: 'operations',
        icon: '📍'
    },
    {
        key: 'shipments',
        table: 'blink_shipments',
        label: 'Shipments',
        description: 'Data pengiriman operasional',
        category: 'operations',
        icon: '🚢'
    },
    {
        key: 'sales_quotations',
        table: 'blink_sales_quotations',
        label: 'Sales Quotations',
        description: 'Data penawaran sales ke customer',
        category: 'sales',
        icon: '📋'
    },
    {
        key: 'quotations',
        table: 'blink_quotations',
        label: 'Quotation Management (Ops)',
        description: 'Data quotation operasional',
        category: 'operations',
        icon: '📜'
    },
];

const CATEGORY_LABELS = {
    finance: { label: '💰 Finance / Keuangan', color: 'text-amber-400' },
    operations: { label: '🚚 Operasional', color: 'text-cyan-400' },
    sales: { label: '📋 Sales & Marketing', color: 'text-blue-400' },
};

// ─── Reset Modal ──────────────────────────────────────────────────────────────
const ResetDataModal = ({ onClose }) => {
    const [step, setStep] = useState(1); // 1=select, 2=confirm, 3=processing, 4=done
    const [selectedKeys, setSelectedKeys] = useState(new Set());
    const [selectAll, setSelectAll] = useState(false);
    const [confirmText, setConfirmText] = useState('');
    const [results, setResults] = useState([]); // [{table, label, success, count}]
    const [expandedCategories, setExpandedCategories] = useState({ finance: true, operations: true, sales: true });

    const CONFIRM_KEYWORD = 'HAPUS';

    const toggleTable = (key) => {
        setSelectedKeys(prev => {
            const next = new Set(prev);
            if (next.has(key)) next.delete(key);
            else next.add(key);
            return next;
        });
    };

    const toggleSelectAll = () => {
        if (selectAll) {
            setSelectedKeys(new Set());
        } else {
            setSelectedKeys(new Set(BLINK_TABLES.map(t => t.key)));
        }
        setSelectAll(!selectAll);
    };

    const toggleCategory = (cat) => {
        setExpandedCategories(prev => ({ ...prev, [cat]: !prev[cat] }));
    };

    const groupedTables = BLINK_TABLES.reduce((acc, t) => {
        if (!acc[t.category]) acc[t.category] = [];
        acc[t.category].push(t);
        return acc;
    }, {});

    const selectedCount = selectedKeys.size;
    const canProceed = selectedCount > 0;
    const canConfirm = confirmText === CONFIRM_KEYWORD;

    const handleExecuteDelete = async () => {
        setStep(3);
        const orderedSelected = BLINK_TABLES.filter(t => selectedKeys.has(t.key));
        const resultList = [];

        for (const tbl of orderedSelected) {
            try {
                // Count rows first
                const { count } = await supabase
                    .from(tbl.table)
                    .select('*', { count: 'exact', head: true });

                // Delete all rows
                const { error } = await supabase
                    .from(tbl.table)
                    .delete()
                    .neq('id', '00000000-0000-0000-0000-000000000000'); // delete all (workaround for RLS)

                resultList.push({
                    ...tbl,
                    success: !error,
                    count: count ?? 0,
                    error: error?.message
                });
            } catch (err) {
                resultList.push({
                    ...tbl,
                    success: false,
                    count: 0,
                    error: err.message
                });
            }
            setResults([...resultList]);
        }

        setStep(4);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-[rgba(0,0,0,0.5)] backdrop-blur-sm"
                onClick={step !== 3 ? onClose : undefined}
            />

            {/* Modal */}
            <div className="relative bg-white border border-red-200 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between p-5 border-b border-gray-200 bg-red-50">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-red-100 rounded-lg">
                            <Trash2 className="w-5 h-5 text-red-600" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-red-800">Reset Data Development</h2>
                            <p className="text-xs text-red-600">Hapus data percobaan dari modul BLINK</p>
                        </div>
                    </div>
                    {step !== 3 && (
                        <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-lg transition-colors">
                            <X className="w-5 h-5 text-gray-500" />
                        </button>
                    )}
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-5 space-y-4">

                    {/* STEP 1 – Pilih tabel */}
                    {step === 1 && (
                        <>
                            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-2">
                                <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                                <p className="text-xs text-amber-800">
                                    Fitur ini khusus untuk <strong>development</strong>. Centang tabel yang ingin dihapus
                                    datanya. Data yang dihapus <strong>tidak dapat dikembalikan</strong>.
                                </p>
                            </div>

                            {/* Select All */}
                            <label className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 border border-gray-200 cursor-pointer hover:bg-gray-100 transition-colors">
                                <input
                                    type="checkbox"
                                    checked={selectAll}
                                    onChange={toggleSelectAll}
                                    className="w-4 h-4 accent-red-600"
                                />
                                <Database className="w-4 h-4 text-red-500" />
                                <span className="text-sm font-semibold text-gray-800">Pilih Semua Tabel</span>
                                <span className="ml-auto text-xs text-gray-500">{BLINK_TABLES.length} tabel</span>
                            </label>

                            {/* Grouped by category */}
                            {Object.entries(groupedTables).map(([cat, tables]) => (
                                <div key={cat} className="border border-gray-200 rounded-lg overflow-hidden">
                                    <button
                                        onClick={() => toggleCategory(cat)}
                                        className="w-full flex items-center justify-between p-3 bg-gray-50 hover:bg-gray-100 transition-colors"
                                    >
                                        <span className={`text-sm font-semibold ${CATEGORY_LABELS[cat]?.color?.replace('400', '700') ?? 'text-gray-700'}`}>
                                            {CATEGORY_LABELS[cat]?.label ?? cat}
                                        </span>
                                        {expandedCategories[cat]
                                            ? <ChevronUp className="w-4 h-4 text-gray-500" />
                                            : <ChevronDown className="w-4 h-4 text-gray-500" />
                                        }
                                    </button>
                                    {expandedCategories[cat] && (
                                        <div className="divide-y divide-gray-100">
                                            {tables.map(tbl => (
                                                <label
                                                    key={tbl.key}
                                                    className="flex items-center gap-3 p-3 cursor-pointer hover:bg-gray-50 transition-colors"
                                                >
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedKeys.has(tbl.key)}
                                                        onChange={() => toggleTable(tbl.key)}
                                                        className="w-4 h-4 accent-red-600 flex-shrink-0"
                                                    />
                                                    <span className="text-lg">{tbl.icon}</span>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-sm text-gray-800 font-medium">{tbl.label}</p>
                                                        <p className="text-xs text-gray-500 truncate">{tbl.description}</p>
                                                    </div>
                                                </label>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </>
                    )}

                    {/* STEP 2 – Konfirmasi */}
                    {step === 2 && (
                        <>
                            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                                <h3 className="text-sm font-bold text-red-800 mb-2 flex items-center gap-2">
                                    <AlertTriangle className="w-4 h-4 text-red-600" />
                                    Konfirmasi Penghapusan
                                </h3>
                                <p className="text-xs text-red-700 mb-3">
                                    Anda akan menghapus data dari <strong>{selectedCount} tabel</strong> berikut:
                                </p>
                                <ul className="space-y-1">
                                    {BLINK_TABLES.filter(t => selectedKeys.has(t.key)).map(t => (
                                        <li key={t.key} className="flex items-center gap-2 text-xs text-red-700">
                                            <span>{t.icon}</span>
                                            <span>{t.label}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs text-gray-600">
                                    Ketik <strong className="text-red-600 font-mono">{CONFIRM_KEYWORD}</strong> untuk mengkonfirmasi:
                                </label>
                                <input
                                    type="text"
                                    value={confirmText}
                                    onChange={e => setConfirmText(e.target.value)}
                                    placeholder={`Ketik ${CONFIRM_KEYWORD} di sini...`}
                                    className="w-full bg-white border border-gray-300 rounded-lg px-4 py-2.5 text-gray-800 text-sm focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 font-mono"
                                    autoFocus
                                />
                            </div>
                        </>
                    )}

                    {/* STEP 3 – Processing */}
                    {step === 3 && (
                        <div className="space-y-3">
                            <div className="text-center py-2">
                                <Loader2 className="w-8 h-8 text-red-500 animate-spin mx-auto mb-2" />
                                <p className="text-sm text-gray-600">Menghapus data...</p>
                            </div>
                            {results.map(r => (
                                <div key={r.key} className="flex items-center gap-3 p-2.5 rounded-lg bg-gray-50 border border-gray-100">
                                    {r.success
                                        ? <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
                                        : <XCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                                    }
                                    <span className="text-sm text-gray-700 flex-1">{r.label}</span>
                                    <span className="text-xs text-gray-500">{r.count} baris dihapus</span>
                                </div>
                            ))}
                            {BLINK_TABLES.filter(t => selectedKeys.has(t.key) && !results.find(r => r.key === t.key)).map(t => (
                                <div key={t.key} className="flex items-center gap-3 p-2.5 rounded-lg bg-gray-50 border border-gray-100">
                                    <Loader2 className="w-4 h-4 text-gray-400 animate-spin flex-shrink-0" />
                                    <span className="text-sm text-gray-500 flex-1">{t.label}</span>
                                    <span className="text-xs text-gray-400">menunggu...</span>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* STEP 4 – Done */}
                    {step === 4 && (
                        <div className="space-y-3">
                            <div className="text-center py-2">
                                <CheckCircle2 className="w-10 h-10 text-green-500 mx-auto mb-2" />
                                <p className="text-base font-semibold text-gray-800">Penghapusan Selesai</p>
                                <p className="text-xs text-gray-500 mt-1">Semua proses telah selesai</p>
                            </div>
                            {results.map(r => (
                                <div key={r.key} className={`flex items-center gap-3 p-2.5 rounded-lg ${r.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
                                    {r.success
                                        ? <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0" />
                                        : <XCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
                                    }
                                    <span className="text-sm text-gray-700 flex-1">{r.icon} {r.label}</span>
                                    {r.success
                                        ? <span className="text-xs text-green-600">{r.count} baris</span>
                                        : <span className="text-xs text-red-600 truncate max-w-[120px]" title={r.error}>Error</span>
                                    }
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-5 border-t border-gray-200 flex gap-3 justify-end bg-gray-50 rounded-b-2xl">
                    {step === 1 && (
                        <>
                            <button
                                onClick={onClose}
                                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors bg-white"
                            >
                                Batal
                            </button>
                            <button
                                onClick={() => setStep(2)}
                                disabled={!canProceed}
                                className="px-5 py-2 text-sm font-semibold bg-red-600 hover:bg-red-700 disabled:bg-gray-300 disabled:text-gray-500 text-white rounded-lg transition-colors flex items-center gap-2"
                            >
                                <Trash2 className="w-4 h-4" />
                                Lanjut ({selectedCount} tabel)
                            </button>
                        </>
                    )}
                    {step === 2 && (
                        <>
                            <button
                                onClick={() => setStep(1)}
                                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors bg-white"
                            >
                                Kembali
                            </button>
                            <button
                                onClick={handleExecuteDelete}
                                disabled={!canConfirm}
                                className="px-5 py-2 text-sm font-semibold bg-red-600 hover:bg-red-700 disabled:bg-gray-300 disabled:text-gray-500 text-white rounded-lg transition-colors flex items-center gap-2"
                            >
                                <Trash2 className="w-4 h-4" />
                                Hapus Sekarang
                            </button>
                        </>
                    )}
                    {step === 4 && (
                        <button
                            onClick={onClose}
                            className="px-5 py-2 text-sm font-semibold bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-lg transition-colors"
                        >
                            Tutup
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

// ─── BlinkDashboard ───────────────────────────────────────────────────────────
const BlinkDashboard = () => {
    const [showResetModal, setShowResetModal] = useState(false);

    // Menu items organized by department
    const salesMarketingMenus = [
        {
            path: '/blink/sales-quotations',
            label: 'Sales Quotation',
            description: 'Manage quotations untuk customer',
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
            path: '/blink/operations/quotations',
            label: 'Quotation Management',
            description: 'Manage quotations operasional',
            icon: FileText,
            color: 'blue'
        },
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
            <div className="flex items-start justify-between gap-4">
                <div>
                    <h1 className="text-4xl font-bold gradient-text">BLINK Dashboard</h1>
                    <p className="text-silver-dark mt-2">Freight & Forward Management Portal</p>
                </div>

                {/* ── DEV: Reset Data Button ── */}
                <button
                    onClick={() => setShowResetModal(true)}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-red-500/40 bg-red-950/30 hover:bg-red-900/40 hover:border-red-500/70 text-red-400 hover:text-red-300 transition-all duration-200 text-sm font-medium flex-shrink-0 group"
                    title="Hapus data percobaan (Development only)"
                >
                    <Trash2 className="w-4 h-4 group-hover:scale-110 transition-transform" />
                    <span className="hidden sm:inline">Reset Dev Data</span>
                    <span className="inline sm:hidden">Reset</span>
                    <span className="px-1.5 py-0.5 rounded text-xs bg-red-500/20 text-red-400 font-mono hidden sm:inline">DEV</span>
                </button>
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

            {/* Reset Modal */}
            {showResetModal && (
                <ResetDataModal onClose={() => setShowResetModal(false)} />
            )}
        </div>
    );
};

export default BlinkDashboard;
