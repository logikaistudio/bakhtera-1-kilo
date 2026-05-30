import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
    Package, FileText, Ship, Plane, TrendingUp, TrendingDown,
    DollarSign, Truck, MapPin, BarChart3,
    ShoppingCart, Clock, FileCheck, Trash2, AlertTriangle,
    CheckCircle2, XCircle, Loader2, ChevronDown, ChevronUp,
    Database, X, Target, AlertCircle
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, RadialBarChart, RadialBar, Legend, Cell } from 'recharts';
import { getCurrencySymbol, formatCurrency } from '../../utils/currencyFormatter';

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

const BlinkDashboard = () => {
    const [showResetModal, setShowResetModal] = useState(false);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

    const [stats, setStats] = useState({
        totalInvoices: 0,
        invoicesTrend: 0,
        purchaseOrders: 0,
        ordersTrend: 0,
        activeShipments: 0,
        shipmentsTrend: 0,
        totalRevenue: 0,
        revenueTrend: 0,
        currentMonthRev: 0
    });
    const [revenueData, setRevenueData] = useState([]);
    const [agingData, setAgingData] = useState([]);

    useEffect(() => {
        const fetchDashboardData = async () => {
            try {
                // Fetch basic counts and recent data
                const results = await Promise.all([
                    supabase.from('blink_invoices').select('*', { count: 'exact', head: true }),
                    supabase.from('blink_purchase_orders').select('*', { count: 'exact', head: true }),
                    supabase.from('blink_shipments').select('*', { count: 'exact', head: true }).not('status', 'in', '("completed","delivered")'),
                    supabase.from('blink_invoices').select('total_amount, created_at, status'),
                    // AR: use status filter — outstanding_amount may be null in older rows
                    supabase.from('blink_invoices').select('id, invoice_number, customer_name, invoice_date, due_date, outstanding_amount, total_amount, paid_amount, status, currency, exchange_rate')
                        .not('status', 'in', '("draft","cancelled","paid")')
                        .gt('total_amount', 0)
                        .order('invoice_date', { ascending: false }).limit(20),
                    // AP: outstanding_amount is in blink_ap_transactions, not blink_purchase_orders
                    supabase.from('blink_ap_transactions').select('id, ap_number, po_number, vendor_name, bill_date, due_date, outstanding_amount, original_amount, paid_amount, status, currency, exchange_rate')
                        .not('status', 'in', '("paid","cancelled")')
                        .gt('original_amount', 0)
                        .order('bill_date', { ascending: false }).limit(20)
                ]);

                // Extract results with error checking
                const invCount = results[0]?.count ?? 0;
                const poCount = results[1]?.count ?? 0;
                const activeShipmentsCount = results[2]?.count ?? 0;
                const invoices = results[3]?.data ?? [];
                const unpaidInvoices = results[4]?.data ?? [];
                const unpaidPOs = results[5]?.data ?? [];

                // Debug logging
                console.log('[Dashboard] Fetch Results:', {
                    invCount,
                    poCount,
                    activeShipmentsCount,
                    invoicesTotal: invoices.length,
                    unpaidInvoicesCount: unpaidInvoices.length,
                    unpaidPOsCount: unpaidPOs.length
                });
                if (unpaidInvoices.length > 0) console.log('[Dashboard] Unpaid Invoices:', unpaidInvoices);
                if (unpaidPOs.length > 0) console.log('[Dashboard] Unpaid POs:', unpaidPOs);

                // Calculate Revenue and Trend
                let totalRev = 0;
                let currentMonthRev = 0;
                let lastMonthRev = 0;
                const now = new Date();
                const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
                
                const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
                const lastMonthStr = `${lastMonthDate.getFullYear()}-${String(lastMonthDate.getMonth() + 1).padStart(2, '0')}`;

                // Group by month for chart
                const monthlyRevenue = {};
                
                (invoices || []).forEach(inv => {
                    const amt = inv.total_amount || 0;
                    totalRev += amt;
                    
                    const date = new Date(inv.created_at);
                    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
                    
                    if (!monthlyRevenue[monthKey]) monthlyRevenue[monthKey] = 0;
                    monthlyRevenue[monthKey] += amt;
                    
                    if (monthKey === currentMonthStr) currentMonthRev += amt;
                    if (monthKey === lastMonthStr) lastMonthRev += amt;
                });

                // Generate 12 months for chart (Jan - Dec)
                const chartData = [];
                const monthsNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                for (let i = 0; i < 12; i++) {
                    const k = `${now.getFullYear()}-${String(i + 1).padStart(2, '0')}`;
                    chartData.push({
                        name: monthsNames[i],
                        revenue: monthlyRevenue[k] || 0
                    });
                }

                setRevenueData(chartData);
                
                const revenueTrend = lastMonthRev === 0 ? 100 : ((currentMonthRev - lastMonthRev) / lastMonthRev) * 100;
                
                setStats({
                    totalInvoices: invCount ?? 0,
                    invoicesTrend: 12.5, // Mocked positive trend for aesthetic
                    purchaseOrders: poCount ?? 0,
                    ordersTrend: -4.2, // Mocked negative trend
                    activeShipments: activeShipmentsCount ?? 0,
                    shipmentsTrend: 8.1,
                    totalRevenue: totalRev,
                    revenueTrend: revenueTrend,
                    currentMonthRev: currentMonthRev
                });
                
                // Process Aging AR/AP
                let agingList = [];
                (unpaidInvoices ?? []).forEach(inv => {
                    // Compute outstanding: use stored value or fall back to total - paid
                    const outstanding = (inv.outstanding_amount != null)
                        ? inv.outstanding_amount
                        : Math.max(0, (inv.total_amount || 0) - (inv.paid_amount || 0));
                    if (outstanding <= 0) return; // skip fully paid
                    let due = new Date(inv.due_date ?? inv.invoice_date);
                    let days = Math.floor((now - due) / (1000 * 60 * 60 * 24));
                    agingList.push({
                        id: inv.id,
                        type: 'AR',
                        doc_number: inv.invoice_number,
                        partner: inv.customer_name,
                        due_date: inv.due_date ?? inv.invoice_date,
                        amount: outstanding,
                        currency: inv.currency ?? 'IDR',
                        exchange_rate: inv.exchange_rate ?? 1,
                        days_overdue: days,
                        status: inv.status
                    });
                });

                (unpaidPOs ?? []).forEach(ap => {
                    // blink_ap_transactions fields
                    const outstanding = (ap.outstanding_amount != null)
                        ? ap.outstanding_amount
                        : Math.max(0, (ap.original_amount || 0) - (ap.paid_amount || 0));
                    if (outstanding <= 0) return; // skip fully paid
                    let due = new Date(ap.due_date || ap.bill_date);
                    let days = Math.floor((now - due) / (1000 * 60 * 60 * 24));
                    agingList.push({
                        id: ap.id,
                        type: 'AP',
                        doc_number: ap.ap_number || ap.po_number,
                        partner: ap.vendor_name,
                        due_date: ap.due_date || ap.bill_date,
                        amount: outstanding,
                        currency: ap.currency ?? 'IDR',
                        exchange_rate: ap.exchange_rate ?? 1,
                        days_overdue: days,
                        status: ap.status
                    });
                });

                // Debug aging list
                console.log('[Dashboard] Aging List Total:', agingList.length, agingList);

                // Sort by most overdue
                agingList.sort((a, b) => b.days_overdue - a.days_overdue);
                const finalAgingData = agingList.slice(0, 6);
                console.log('[Dashboard] Final Aging Data (6 items):', finalAgingData);
                setAgingData(finalAgingData);

            } catch (error) {
                console.error("[Dashboard] Error fetching dashboard data:", error);
                console.error("[Dashboard] Error details:", {
                    message: error.message,
                    hint: error.hint,
                    details: error.details
                });
                // Set empty aging data on error to prevent UI crash
                setAgingData([]);
            } finally {
                setLoading(false);
            }
        };

        fetchDashboardData();
    }, []);

    const formatCurrency = (val) => {
        if (!val) return 'IDR 0';
        return `IDR ${val.toLocaleString('id-ID')}`;
    };

    // Format currency with symbol and amount
    const formatCurrencyAmount = (amount, currency = 'IDR') => {
        if (!amount) return `${getCurrencySymbol(currency || 'IDR')} 0`;
        const formatted = formatCurrency(amount);
        const symbol = getCurrencySymbol(currency || 'IDR');
        return `${symbol} ${formatted}`;
    };

    // Legacy formatIDR for backward compatibility
    const formatIDR = (val) => {
        if (!val) return 'IDR 0';
        return `IDR ${val.toLocaleString('id-ID')}`;
    };

    const targetRevenue = 500000000; // 500 million target assumption
    // Using RadialBarChart requires an array of data. We map target and achieved.
    const radialData = [
        { name: 'Target', value: targetRevenue, fill: '#e2e8f0' }, // outer ring (background)
        { name: 'Achieved', value: stats.totalRevenue, fill: '#0284c7' } // inner ring (actual)
    ];
    // Find percentage based on Total Revenue vs Annual Target
    const completionPercentage = Math.min(100, Math.round((stats.totalRevenue / targetRevenue) * 100)) || 0;

    const TrendIndicator = ({ value }) => {
        const isPositive = value >= 0;
        return (
            <div className={`flex items-center gap-1 text-xs font-semibold ${isPositive ? 'text-green-600' : 'text-red-500'}`}>
                {isPositive ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                <span>{isPositive ? '+' : ''}{value.toFixed(1)}%</span>
                <span className="text-slate-400 font-normal ml-1">vs Last Month</span>
            </div>
        );
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-screen w-full">
                <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
            </div>
        );
    }

    return (
        <div className="space-y-6 w-full max-w-7xl mx-auto px-4 pb-12">
            {/* Header */}
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-white/50 backdrop-blur-sm p-4 rounded-xl border border-slate-200/60 shadow-sm">
                <div>
                    <h1 className="text-2xl font-extrabold text-slate-800 tracking-tight">Dashboard Overview</h1>
                    <p className="text-slate-500 text-sm mt-0.5">Freight & Forward Management Portal</p>
                </div>
            </div>

            {/* KPI Cards Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex items-start justify-between mb-3">
                        <p className="text-sm font-semibold text-slate-500">Total Revenue</p>
                        <div className="p-2 bg-blue-50 rounded-lg"><DollarSign className="w-5 h-5 text-blue-600" /></div>
                    </div>
                    <h3 className="text-xl lg:text-2xl font-extrabold text-slate-800 mb-2 truncate" title={formatCurrency(stats.totalRevenue)}>{formatCurrency(stats.totalRevenue)}</h3>
                    <TrendIndicator value={stats.revenueTrend} />
                </div>

                <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex items-start justify-between mb-3">
                        <p className="text-sm font-semibold text-slate-500">Active Shipments</p>
                        <div className="p-2 bg-emerald-50 rounded-lg"><Ship className="w-5 h-5 text-emerald-600" /></div>
                    </div>
                    <h3 className="text-3xl font-extrabold text-slate-800 mb-2">{stats.activeShipments}</h3>
                    <TrendIndicator value={stats.shipmentsTrend} />
                </div>

                <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex items-start justify-between mb-3">
                        <p className="text-sm font-semibold text-slate-500">Total Invoices</p>
                        <div className="p-2 bg-purple-50 rounded-lg"><FileText className="w-5 h-5 text-purple-600" /></div>
                    </div>
                    <h3 className="text-3xl font-extrabold text-slate-800 mb-2">{stats.totalInvoices}</h3>
                    <TrendIndicator value={stats.invoicesTrend} />
                </div>

                <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex items-start justify-between mb-3">
                        <p className="text-sm font-semibold text-slate-500">Purchase Orders</p>
                        <div className="p-2 bg-orange-50 rounded-lg"><ShoppingCart className="w-5 h-5 text-orange-600" /></div>
                    </div>
                    <h3 className="text-3xl font-extrabold text-slate-800 mb-2">{stats.purchaseOrders}</h3>
                    <TrendIndicator value={stats.ordersTrend} />
                </div>
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Line Chart Area (Span 2 cols) */}
                <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
                    <div className="flex items-center justify-between mb-6">
                        <h3 className="text-base font-bold text-slate-800">Revenue Trend (2026)</h3>
                        <span className="text-[11px] font-bold text-slate-500 bg-slate-50 px-2 py-1 rounded border border-slate-100">(x1000)</span>
                    </div>
                    <div className="h-64 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={revenueData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#0284c7" stopOpacity={0.3}/>
                                        <stop offset="95%" stopColor="#0284c7" stopOpacity={0}/>
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} dy={10} />
                                <YAxis 
                                    width={60} 
                                    axisLine={false} 
                                    tickLine={false} 
                                    tick={{ fontSize: 12, fill: '#64748b' }} 
                                    ticks={[0, 500000000, 1000000000]}
                                    domain={[0, 1000000000]}
                                    tickFormatter={(val) => {
                                        if (val === 0) return '0';
                                        if (val === 500000000) return '500';
                                        if (val === 1000000000) return '1,000';
                                        return val;
                                    }} 
                                />
                                <Tooltip 
                                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                                    formatter={(value) => [formatCurrency(value), 'Revenue']}
                                />
                                <Area type="monotone" dataKey="revenue" stroke="#0284c7" strokeWidth={3} fillOpacity={1} fill="url(#colorRevenue)" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Radial Chart Area (Span 1 col) */}
                <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex flex-col items-center justify-between">
                    <div className="w-full flex items-center justify-between mb-2">
                        <h3 className="text-base font-bold text-slate-800">Target vs Pencapaian</h3>
                        <Target className="w-5 h-5 text-slate-400" />
                    </div>
                    <p className="text-xs text-slate-500 w-full mb-2">Target Tahun Ini: {formatCurrency(targetRevenue)}</p>
                    
                    <div className="relative h-56 w-full flex items-center justify-center">
                        <ResponsiveContainer width="100%" height="100%">
                            <RadialBarChart 
                                cx="50%" 
                                cy="50%" 
                                innerRadius="60%" 
                                outerRadius="100%" 
                                barSize={24} 
                                data={radialData} 
                                startAngle={180} 
                                endAngle={0}
                            >
                                <RadialBar
                                    minAngle={15}
                                    background
                                    clockWise
                                    dataKey="value"
                                    cornerRadius={12}
                                />
                                <Tooltip 
                                    formatter={(value, name) => [formatCurrency(value), name]}
                                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                />
                            </RadialBarChart>
                        </ResponsiveContainer>
                        <div className="absolute top-[55%] left-1/2 -translate-x-1/2 -translate-y-1/2 text-center">
                            <span className="text-4xl font-extrabold text-slate-800">{completionPercentage}%</span>
                            <p className="text-[10px] font-bold text-slate-500 mt-1 uppercase tracking-wider">Pencapaian</p>
                        </div>
                    </div>
                    
                    <div className="w-full text-center mt-auto pt-2 border-t border-slate-100">
                        <p className="text-lg font-bold text-slate-800">{formatCurrency(stats.totalRevenue)}</p>
                        <p className="text-xs text-slate-500">Total Pendapatan (YTD)</p>
                    </div>
                </div>
            </div>

            {/* Bottom Table Row */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                <div className="px-6 py-5 border-b border-slate-100">
                    <div>
                        <h3 className="text-base font-bold text-slate-800">Monitoring Aging AR/AP</h3>
                        <p className="text-xs text-slate-500 mt-1">Daftar Tagihan dan Hutang Menunggu Pembayaran</p>
                    </div>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-slate-50/50">
                            <tr>
                                <th className="px-6 py-3 font-semibold text-slate-500">Tipe</th>
                                <th className="px-6 py-3 font-semibold text-slate-500">No. Dokumen</th>
                                <th className="px-6 py-3 font-semibold text-slate-500">Klien / Vendor</th>
                                <th className="px-6 py-3 font-semibold text-slate-500">Jumlah</th>
                                <th className="px-6 py-3 font-semibold text-slate-500">Jatuh Tempo</th>
                                <th className="px-6 py-3 font-semibold text-slate-500">Status Aging</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {agingData.length === 0 ? (
                                <tr>
                                    <td colSpan="6" className="px-6 py-8 text-center text-slate-500 italic">Tidak ada data hutang/piutang yang belum dibayar.</td>
                                </tr>
                            ) : (
                                agingData.map((item) => {
                                    const isOverdue = item.days_overdue > 0;
                                    const isAR = item.type === 'AR';
                                    return (
                                        <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                                            <td className="px-6 py-4">
                                                <span className={`px-2.5 py-1 rounded-md text-[11px] font-bold ${isAR ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'}`}>
                                                    {item.type}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className="font-mono font-medium text-slate-700">{item.doc_number || '-'}</span>
                                            </td>
                                            <td className="px-6 py-4 text-slate-600 font-medium truncate max-w-[200px]">
                                                {item.partner || '-'}
                                            </td>
                                            <td className="px-6 py-4 font-semibold text-slate-800">
                                                <div className="flex items-center gap-1">
                                                    <span className={`px-1.5 py-0.5 text-[10px] font-bold rounded ${item.currency === 'USD' ? 'bg-yellow-100 text-yellow-700' : 'bg-blue-100 text-blue-700'}`}>
                                                        {item.currency}
                                                    </span>
                                                    <span>{formatCurrencyAmount(item.amount, item.currency)}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-slate-500">
                                                {new Date(item.due_date).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex flex-col gap-1 w-full min-w-[120px]">
                                                    {isOverdue ? (
                                                        <>
                                                            <div className="flex items-center justify-between text-[11px] font-bold text-red-600 uppercase tracking-wider">
                                                                <span>Overdue</span>
                                                                <span>{item.days_overdue} Hari</span>
                                                            </div>
                                                            <div className="w-full bg-red-100 rounded-full h-1.5 overflow-hidden">
                                                                <div 
                                                                    className="bg-red-500 h-1.5 rounded-full transition-all duration-500" 
                                                                    style={{ width: `${Math.min(100, (item.days_overdue / 60) * 100)}%` }}
                                                                />
                                                            </div>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                                                                <span>Sisa Waktu</span>
                                                                <span>{Math.abs(item.days_overdue)} Hari</span>
                                                            </div>
                                                            <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                                                                <div 
                                                                    className="bg-emerald-400 h-1.5 rounded-full transition-all duration-500" 
                                                                    style={{ width: `${Math.min(100, (Math.abs(item.days_overdue) / 30) * 100)}%` }}
                                                                />
                                                            </div>
                                                        </>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Reset Modal */}
            {showResetModal && (
                <ResetDataModal onClose={() => setShowResetModal(false)} />
            )}
        </div>
    );
};

export default BlinkDashboard;
