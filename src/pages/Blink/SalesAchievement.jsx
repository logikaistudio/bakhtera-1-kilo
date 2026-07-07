import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import {
    TrendingUp, Target, DollarSign, CheckCircle, Award, Users,
    X, Printer, ArrowLeft, Plus, Edit2, Trash2, Settings, Calendar
} from 'lucide-react';

const fmtIDR = (v) => {
    if (!v || v === 0) return 'Rp 0';
    if (v >= 1e9) return `Rp ${(v / 1e9).toFixed(1)}M`;
    if (v >= 1e6) return `Rp ${(v / 1e6).toFixed(0)}jt`;
    return `Rp ${Number(v).toLocaleString('id-ID')}`;
};

const SalesAchievement = () => {
    const { canCreate, canEdit, canDelete, isSuperAdmin } = useAuth();
    const canRunSuperAdminBatch = isSuperAdmin();

    const [soAchievement, setSoAchievement] = useState({
        totalQuotations: 0,
        soCreated: 0,
        percentage: 0
    });

    const [paymentAchievement, setPaymentAchievement] = useState({
        soCreated: 0,
        paymentClosed: 0,
        totalAmount: 0,
        paidAmount: 0,
        percentage: 0
    });

    const [salesPersonData, setSalesPersonData] = useState([]);
    const [showDetailModal, setShowDetailModal] = useState(false);
    const [selectedSalesPerson, setSelectedSalesPerson] = useState(null);

    // Target management
    const [salesTargets, setSalesTargets] = useState({});   // { sales_name: yearly_target }
    const [targetList, setTargetList] = useState([]);       // raw DB rows
    const [selectedTargetIds, setSelectedTargetIds] = useState([]);
    const [monthlyPaid, setMonthlyPaid] = useState({});     // { sales_name: amount in current month }
    const [showTargetModal, setShowTargetModal] = useState(false);
    const [targetForm, setTargetForm] = useState({ sales_name: '', yearly_target: '', division: 'Umum' });
    const [editingTargetId, setEditingTargetId] = useState(null);
    const [isSavingTarget, setIsSavingTarget] = useState(false);

    const now = new Date();
    const currentMonth = now.getMonth();   // 0-based
    const currentYear = now.getFullYear();

    useEffect(() => {
        fetchSalesTargets();
        fetchAchievementData();
    }, []);

    // ── Target CRUD ─────────────────────────────────────────────────────────
    const fetchSalesTargets = async () => {
        try {
            const { data, error } = await supabase
                .from('blink_sales_targets')
                .select('*')
                .order('sales_name');
            if (error) throw error;
            setTargetList(data || []);
            const map = {};
            (data || []).forEach(t => { map[t.sales_name] = { yearly_target: t.yearly_target, division: t.division || 'Umum' }; });
            setSalesTargets(map);
            setSelectedTargetIds([]);
        } catch (err) {
            console.error('Error fetching sales targets:', err);
        }
    };

    const handleSaveTarget = async () => {
        const name = targetForm.sales_name.trim();
        const target = Number(targetForm.yearly_target);
        if (!name || !target || target <= 0) {
            alert('Isi nama sales dan target tahunan dengan benar.');
            return;
        }
        setIsSavingTarget(true);
        try {
            if (editingTargetId) {
                const { error } = await supabase
                    .from('blink_sales_targets')
                    .update({ sales_name: name, yearly_target: target, division: targetForm.division.trim() || 'Umum', updated_at: new Date().toISOString() })
                    .eq('id', editingTargetId);
                if (error) throw error;
            } else {
                const { error } = await supabase
                    .from('blink_sales_targets')
                    .insert([{ sales_name: name, yearly_target: target, division: targetForm.division.trim() || 'Umum' }]);
                if (error) throw error;
            }
            setTargetForm({ sales_name: '', yearly_target: '' });
            setEditingTargetId(null);
            await fetchSalesTargets();
        } catch (err) {
            alert('Gagal menyimpan target: ' + err.message);
        } finally {
            setIsSavingTarget(false);
        }
    };

    const handleEditTarget = (row) => {
        setEditingTargetId(row.id);
        setTargetForm({ sales_name: row.sales_name, yearly_target: String(row.yearly_target), division: row.division || 'Umum' });
    };

    const handleDeleteTarget = async (id) => {
        if (!window.confirm('Hapus target ini?')) return;
        try {
            const { error } = await supabase.from('blink_sales_targets').delete().eq('id', id);
            if (error) throw error;
            await fetchSalesTargets();
        } catch (err) {
            alert('Gagal menghapus target: ' + err.message);
        }
    };

    const toggleSelectAllTargets = () => {
        if (targetList.length === 0) return;
        if (selectedTargetIds.length === targetList.length) {
            setSelectedTargetIds([]);
            return;
        }
        setSelectedTargetIds(targetList.map(t => t.id));
    };

    const toggleSelectOneTarget = (id) => {
        setSelectedTargetIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
    };

    const handleDeleteSelectedTargets = async () => {
        if (!canRunSuperAdminBatch || selectedTargetIds.length === 0) return;
        if (!window.confirm(`Hapus ${selectedTargetIds.length} target terpilih?`)) return;

        try {
            const { error } = await supabase
                .from('blink_sales_targets')
                .delete()
                .in('id', selectedTargetIds);
            if (error) throw error;
            await fetchSalesTargets();
        } catch (err) {
            alert('Gagal menghapus target terpilih: ' + err.message);
        }
    };

    const handleDeleteAllTargets = async () => {
        if (!canRunSuperAdminBatch) return;
        if (targetList.length === 0) {
            alert('Tidak ada target untuk dihapus.');
            return;
        }
        if (!window.confirm(`Hapus seluruh target sales (${targetList.length} baris)?`)) return;
        if (!window.confirm('Konfirmasi terakhir: semua target sales akan dihapus permanen. Lanjutkan?')) return;

        try {
            const { error } = await supabase
                .from('blink_sales_targets')
                .delete()
                .neq('id', '00000000-0000-0000-0000-000000000000');
            if (error) throw error;
            await fetchSalesTargets();
        } catch (err) {
            alert('Gagal menghapus semua target: ' + err.message);
        }
    };

    // ── Achievement Data ─────────────────────────────────────────────────────
    const fetchAchievementData = async () => {
        try {
            // Fetch all quotations
            const { data: quotations, error: quotError } = await supabase
                .from('blink_quotations')
                .select('*');

            if (quotError) throw quotError;

            // Filter non-operation quotations (exclude quotation_type 'OP')
            const nonOpQuotations = quotations?.filter(q => q.quotation_type !== 'OP') || [];
            const convertedQuotations = nonOpQuotations.filter(q => q.status === 'converted');

            const soPercentage = nonOpQuotations.length > 0
                ? (convertedQuotations.length / nonOpQuotations.length) * 100
                : 0;

            setSoAchievement({
                totalQuotations: nonOpQuotations.length,
                soCreated: convertedQuotations.length,
                percentage: soPercentage
            });

            // Fetch shipments for payment achievement
            const { data: shipments, error: shipError } = await supabase
                .from('blink_shipments')
                .select('*');

            if (shipError) throw shipError;

            const totalSO = shipments?.length || 0;
            const paidShipments = shipments?.filter(s =>
                s.status === 'delivered' || s.status === 'completed'
            ) || [];

            const totalAmount = shipments?.reduce((sum, s) => {
                const amount = s.quoted_amount || 0;
                const idrAmount = s.currency === 'USD' ? amount * 15000 : amount;
                return sum + idrAmount;
            }, 0) || 0;

            const paidAmount = paidShipments.reduce((sum, s) => {
                const amount = s.quoted_amount || 0;
                const idrAmount = s.currency === 'USD' ? amount * 15000 : amount;
                return sum + idrAmount;
            }, 0);

            const paymentPercentage = totalSO > 0 ? (paidShipments.length / totalSO) * 100 : 0;

            setPaymentAchievement({
                soCreated: totalSO,
                paymentClosed: paidShipments.length,
                totalAmount,
                paidAmount,
                percentage: paymentPercentage
            });

            // Calculate sales person performance
            const salesPersonMap = new Map();

            nonOpQuotations.forEach(q => {
                const sp = q.sales_person || 'Unknown';
                if (!salesPersonMap.has(sp)) {
                    salesPersonMap.set(sp, {
                        name: sp,
                        totalQuotations: 0,
                        convertedQuotations: 0,
                        totalValue: 0,
                        paidValue: 0,
                        monthlyPaidValue: 0,
                        details: []
                    });
                }
                const data = salesPersonMap.get(sp);
                data.totalQuotations++;
                if (q.status === 'converted') {
                    data.convertedQuotations++;
                }

                // Add quotation to details
                const correspondingShipment = shipments?.find(s =>
                    s.job_number === q.job_number || s.quotation_id === q.id
                );

                data.details.push({
                    quotationNo: q.job_number,
                    quotationDate: q.created_at,
                    customer: q.customer_name || q.customer,
                    paymentDate: correspondingShipment && (correspondingShipment.status === 'delivered' || correspondingShipment.status === 'completed')
                        ? correspondingShipment.updated_at
                        : null,
                    paidAmount: correspondingShipment && (correspondingShipment.status === 'delivered' || correspondingShipment.status === 'completed')
                        ? (correspondingShipment.currency === 'USD' ? (correspondingShipment.quoted_amount || 0) * 15000 : (correspondingShipment.quoted_amount || 0))
                        : 0
                });
            });

            // Add payment data from shipments (yearly + monthly)
            shipments?.forEach(s => {
                const sp = s.sales_person || 'Unknown';
                if (!salesPersonMap.has(sp)) {
                    salesPersonMap.set(sp, {
                        name: sp,
                        totalQuotations: 0,
                        convertedQuotations: 0,
                        totalValue: 0,
                        paidValue: 0,
                        monthlyPaidValue: 0,
                        details: []
                    });
                }
                const data = salesPersonMap.get(sp);
                const amount = s.quoted_amount || 0;
                const idrAmount = s.currency === 'USD' ? amount * 15000 : amount;
                data.totalValue += idrAmount;

                if (s.status === 'delivered' || s.status === 'completed') {
                    data.paidValue += idrAmount;

                    // Monthly: check if updated_at is in current month & year
                    const updatedDate = s.updated_at ? new Date(s.updated_at) : null;
                    if (updatedDate &&
                        updatedDate.getMonth() === currentMonth &&
                        updatedDate.getFullYear() === currentYear) {
                        data.monthlyPaidValue += idrAmount;
                    }
                }
            });

            const salesPersonArray = Array.from(salesPersonMap.values())
                .filter(sp => sp.name !== 'Unknown')
                .sort((a, b) => b.paidValue - a.paidValue);

            setSalesPersonData(salesPersonArray);

        } catch (error) {
            console.error('Error fetching achievement data:', error);
        }
    };

    const handlePrintTXT = () => {
        if (!selectedSalesPerson) return;

        const yearlyTarget = salesTargets[selectedSalesPerson.name]?.yearly_target || 0;
        const monthlyTarget = yearlyTarget / 12;
        const totalPercent = yearlyTarget > 0 ? (selectedSalesPerson.paidValue / yearlyTarget) * 100 : 0;
        const paymentPercent = selectedSalesPerson.totalValue > 0 ? (selectedSalesPerson.paidValue / selectedSalesPerson.totalValue) * 100 : 0;
        const monthlyPercent = monthlyTarget > 0 ? (selectedSalesPerson.monthlyPaidValue / monthlyTarget) * 100 : 0;

        const MONTHS_ID = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

        let txtContent = `
================================================================================
                    SALES ACHIEVEMENT REPORT
                    ${selectedSalesPerson.name}
================================================================================

RINGKASAN PENCAPAIAN:
------------------------------------------------------------
Target Per Tahun        : Rp ${yearlyTarget.toLocaleString('id-ID')}
Target Per Bulan        : Rp ${Math.round(monthlyTarget).toLocaleString('id-ID')}
Total Quotations        : ${selectedSalesPerson.totalQuotations}
SO Created              : ${selectedSalesPerson.convertedQuotations}
Pencapaian Tahunan      : Rp ${selectedSalesPerson.paidValue.toLocaleString('id-ID')} (${totalPercent.toFixed(1)}%)
Bulan Berjalan          : Rp ${selectedSalesPerson.monthlyPaidValue.toLocaleString('id-ID')} / ${MONTHS_ID[currentMonth]} (${monthlyPercent.toFixed(1)}%)
Payment Achievement     : ${paymentPercent.toFixed(1)}%

================================================================================
                    DETAIL QUOTATION & PEMBAYARAN
================================================================================

`;

        if (selectedSalesPerson.details && selectedSalesPerson.details.length > 0) {
            selectedSalesPerson.details.forEach((detail, idx) => {
                const quotationDate = detail.quotationDate ? new Date(detail.quotationDate).toLocaleDateString('id-ID') : '-';
                const paymentDate = detail.paymentDate ? new Date(detail.paymentDate).toLocaleDateString('id-ID') : '-';
                const paidAmount = detail.paidAmount > 0 ? `Rp ${detail.paidAmount.toLocaleString('id-ID')}` : '-';

                txtContent += `
${idx + 1}. ${detail.quotationNo || '-'}
    Tanggal Quotation   : ${quotationDate}
    Customer            : ${detail.customer || '-'}
    Tanggal Pembayaran  : ${paymentDate}
    Jumlah Terbayar     : ${paidAmount}
------------------------------------------------------------`;
            });
        } else {
            txtContent += '\nTidak ada data quotation tersedia.\n';
        }

        txtContent += `

================================================================================
Laporan dicetak pada: ${new Date().toLocaleString('id-ID')}
================================================================================
`;

        const blob = new Blob([txtContent], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `Sales_Achievement_${selectedSalesPerson.name.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.txt`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    const AchievementBar = ({ title, subtitle, icon: Icon, achieved, target, percentage, additionalInfo }) => {
        const getColor = () => {
            if (percentage >= 100) return 'from-green-500 to-emerald-600';
            if (percentage >= 75) return 'from-blue-500 to-cyan-600';
            if (percentage >= 50) return 'from-yellow-500 to-orange-600';
            return 'from-red-500 to-pink-600';
        };

        return (
            <div className="glass-card p-6 rounded-lg">
                <div className="flex items-center gap-3 mb-4">
                    <div className={`p-3 rounded-lg bg-gradient-to-br ${getColor()} bg-opacity-20`}>
                        <Icon className="w-6 h-6 text-white" />
                    </div>
                    <div className="flex-1">
                        <h3 className="text-lg font-semibold text-silver-light">{title}</h3>
                        <p className="text-sm text-silver-dark">{subtitle}</p>
                        <p className="text-xs text-silver-dark mt-1">
                            {achieved} / {target} {additionalInfo}
                        </p>
                    </div>
                    <div className="text-right">
                        <p className="text-3xl font-bold text-accent-orange">{percentage.toFixed(1)}%</p>
                    </div>
                </div>

                {/* Progress Bar */}
                <div className="relative h-4 bg-dark-surface rounded-full overflow-hidden">
                    <div
                        className={`absolute inset-y-0 left-0 bg-gradient-to-r ${getColor()} rounded-full transition-all duration-500`}
                        style={{ width: `${Math.min(percentage, 100)}%` }}
                    />
                </div>

                {/* Achievement Status */}
                <div className="mt-4 flex items-center justify-between text-sm">
                    <span className="text-silver-dark">
                        {percentage >= 100 ? '🎉 Target Achieved!' : `${(100 - percentage).toFixed(1)}% to target`}
                    </span>
                    {percentage >= 100 && (
                        <Award className="w-5 h-5 text-yellow-400" />
                    )}
                </div>
            </div>
        );
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-start justify-between">
                <div>
                    <h1 className="text-3xl font-bold gradient-text">Sales Achievement</h1>
                    <p className="text-silver-dark mt-1">Track performance dari Quotation hingga Payment Closing</p>
                </div>
                {canCreate('blink_sales') && (
                    <button
                        onClick={() => { setTargetForm({ sales_name: '', yearly_target: '' }); setEditingTargetId(null); setShowTargetModal(true); }}
                        className="flex items-center gap-2 px-4 py-2 bg-accent-orange hover:bg-accent-orange/80 text-white rounded-lg transition-colors text-sm font-medium"
                    >
                        <Settings className="w-4 h-4" />
                        Kelola Target
                    </button>
                )}
            </div>

            {/* Achievement Bars */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <AchievementBar
                    title="SO Achievement"
                    subtitle="Quotation (Non-Operation) → Sales Order"
                    icon={Target}
                    achieved={soAchievement.soCreated}
                    target={soAchievement.totalQuotations}
                    percentage={soAchievement.percentage}
                    additionalInfo="SO Created"
                />

                <AchievementBar
                    title="Payment Achievement"
                    subtitle="Sales Order → Payment Closed"
                    icon={DollarSign}
                    achieved={paymentAchievement.paymentClosed}
                    target={paymentAchievement.soCreated}
                    percentage={paymentAchievement.percentage}
                    additionalInfo="Payments Closed"
                />
            </div>

            {/* Info Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="glass-card p-4 rounded-lg">
                    <div className="flex items-center gap-3">
                        <CheckCircle className="w-8 h-8 text-green-400" />
                        <div>
                            <p className="text-sm text-silver-dark">Total Quotations</p>
                            <p className="text-2xl font-bold text-silver-light">{soAchievement.totalQuotations}</p>
                        </div>
                    </div>
                </div>

                <div className="glass-card p-4 rounded-lg">
                    <div className="flex items-center gap-3">
                        <Target className="w-8 h-8 text-blue-400" />
                        <div>
                            <p className="text-sm text-silver-dark">SO Created</p>
                            <p className="text-2xl font-bold text-silver-light">{soAchievement.soCreated}</p>
                        </div>
                    </div>
                </div>

                <div className="glass-card p-4 rounded-lg">
                    <div className="flex items-center gap-3">
                        <DollarSign className="w-8 h-8 text-yellow-400" />
                        <div>
                            <p className="text-sm text-silver-dark">Total SO Value</p>
                            <p className="text-lg font-bold text-silver-light">
                                Rp {paymentAchievement.totalAmount.toLocaleString('id-ID')}
                            </p>
                        </div>
                    </div>
                </div>

                <div className="glass-card p-4 rounded-lg">
                    <div className="flex items-center gap-3">
                        <TrendingUp className="w-8 h-8 text-green-400" />
                        <div>
                            <p className="text-sm text-silver-dark">Paid Value</p>
                            <p className="text-lg font-bold text-silver-light">
                                Rp {paymentAchievement.paidAmount.toLocaleString('id-ID')}
                            </p>
                        </div>
                    </div>
                </div>
            </div>


            {/* Sales Person Performance Table */}
            <div className="glass-card rounded-lg overflow-hidden">
                <div className="p-6 border-b border-dark-border">
                    <h2 className="text-xl font-bold text-silver-light flex items-center gap-2">
                        <Users className="w-6 h-6 text-accent-orange" />
                        Sales Person Achievement
                    </h2>
                    <p className="text-sm text-silver-dark mt-1">Klik baris untuk lihat detail · Target berdasarkan data yang dikelola via tombol Kelola Target</p>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-dark-surface">
                            <tr>
                                <th className="px-4 py-4 text-left text-xs font-bold text-silver uppercase">Nama Sales</th>
                                <th className="px-4 py-4 text-right text-xs font-bold text-silver uppercase">Target / Tahun</th>
                                <th className="px-4 py-4 text-center text-xs font-bold text-silver uppercase">Pencapaian Tahunan</th>
                                <th className="px-4 py-4 text-center text-xs font-bold text-silver uppercase">Bulan Berjalan</th>
                                <th className="px-4 py-4 text-center text-xs font-bold text-silver uppercase">% Target</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-dark-border">
                            {salesPersonData.length === 0 ? (
                                <tr>
                                    <td colSpan="5" className="px-6 py-8 text-center text-silver-dark">
                                        Belum ada data sales person
                                    </td>
                                </tr>
                            ) : (() => {
                                // Group by division
                                const groups = {};
                                salesPersonData.forEach(sp => {
                                    const div = salesTargets[sp.name]?.division || 'Umum';
                                    if (!groups[div]) groups[div] = [];
                                    groups[div].push(sp);
                                });
                                const divGroups = Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));

                                const barColor = (pct) =>
                                    pct >= 100 ? 'from-green-500 to-emerald-600' :
                                    pct >= 75  ? 'from-blue-500 to-cyan-600' :
                                    pct >= 50  ? 'from-yellow-500 to-orange-500' :
                                                 'from-red-500 to-pink-600';

                                return divGroups.map(([divName, members]) => {
                                    const divTargetTotal = members.reduce((s, sp) => s + (salesTargets[sp.name]?.yearly_target || 0), 0);
                                    const divAnnual = members.reduce((s, sp) => s + sp.paidValue, 0);
                                    const divMonthly = members.reduce((s, sp) => s + sp.monthlyPaidValue, 0);

                                    return (
                                        <React.Fragment key={divName}>
                                            {/* Division Header Row */}
                                            <tr className="bg-dark-surface/80">
                                                <td colSpan={5} className="px-4 py-2.5">
                                                    <div className="flex items-center justify-between flex-wrap gap-2">
                                                        <div className="flex items-center gap-2">
                                                            <Users className="w-4 h-4 text-accent-orange" />
                                                            <span className="text-sm font-bold text-accent-orange uppercase tracking-wide">{divName}</span>
                                                            <span className="text-xs text-silver-dark">({members.length} sales)</span>
                                                        </div>
                                                        <div className="flex gap-5 text-xs">
                                                            <span className="text-silver-dark">Target: <span className="text-silver-light font-semibold">{fmtIDR(divTargetTotal)}</span></span>
                                                            <span className="text-silver-dark">Tahunan: <span className="text-green-400 font-semibold">{fmtIDR(divAnnual)}</span></span>
                                                            <span className="text-silver-dark">Bulan Ini: <span className="text-blue-400 font-semibold">{fmtIDR(divMonthly)}</span></span>
                                                        </div>
                                                    </div>
                                                </td>
                                            </tr>
                                            {/* Member Rows */}
                                            {members.map((sp, index) => {
                                                const yearlyTarget = salesTargets[sp.name]?.yearly_target || 0;
                                                const monthlyTarget = yearlyTarget > 0 ? yearlyTarget / 12 : 0;
                                                const yearlyPct = yearlyTarget > 0 ? Math.min((sp.paidValue / yearlyTarget) * 100, 100) : 0;
                                                const monthlyPct = monthlyTarget > 0 ? Math.min((sp.monthlyPaidValue / monthlyTarget) * 100, 100) : 0;
                                                const totalPct = yearlyTarget > 0 ? (sp.paidValue / yearlyTarget) * 100 : 0;
                                                const badgeColor = totalPct >= 100 ? 'bg-green-500/20 text-green-400' :
                                                                   totalPct >= 75  ? 'bg-blue-500/20 text-blue-400' :
                                                                   totalPct >= 50  ? 'bg-yellow-500/20 text-yellow-400' :
                                                                                     'bg-red-500/20 text-red-400';
                                                return (
                                                    <tr
                                                        key={index}
                                                        onClick={() => { setSelectedSalesPerson(sp); setShowDetailModal(true); }}
                                                        className="hover:bg-dark-surface/50 transition-colors cursor-pointer"
                                                    >
                                                        <td className="px-4 py-4 pl-8">
                                                            <div className="flex items-center gap-3">
                                                                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-accent-orange to-orange-600 flex items-center justify-center text-white text-xs font-bold shrink-0">
                                                                    {sp.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                                                                </div>
                                                                <div>
                                                                    <p className="text-sm font-semibold text-silver-light">{sp.name}</p>
                                                                    <p className="text-xs text-silver-dark">{sp.totalQuotations} quot · {sp.convertedQuotations} SO</p>
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td className="px-4 py-4 text-right">
                                                            {yearlyTarget > 0 ? (
                                                                <div>
                                                                    <p className="text-sm font-semibold text-silver-light">{fmtIDR(yearlyTarget)}</p>
                                                                    <p className="text-xs text-silver-dark">{fmtIDR(Math.round(monthlyTarget))}/bln</p>
                                                                </div>
                                                            ) : (
                                                                <span className="text-xs text-silver-dark italic">Belum diset</span>
                                                            )}
                                                        </td>
                                                        <td className="px-4 py-4">
                                                            <div className="space-y-1 min-w-[160px]">
                                                                <div className="flex justify-between text-xs">
                                                                    <span className="text-silver-light font-medium">{fmtIDR(sp.paidValue)}</span>
                                                                    <span className={`font-semibold ${yearlyPct >= 100 ? 'text-green-400' : yearlyPct >= 50 ? 'text-yellow-400' : 'text-red-400'}`}>
                                                                        {yearlyTarget > 0 ? `${((sp.paidValue / yearlyTarget) * 100).toFixed(1)}%` : '—'}
                                                                    </span>
                                                                </div>
                                                                <div className="relative h-2 bg-dark-surface rounded-full overflow-hidden">
                                                                    <div className={`absolute inset-y-0 left-0 bg-gradient-to-r ${barColor(yearlyPct)} rounded-full transition-all duration-500`}
                                                                        style={{ width: `${yearlyPct}%` }} />
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td className="px-4 py-4">
                                                            <div className="space-y-1 min-w-[160px]">
                                                                <div className="flex justify-between text-xs">
                                                                    <span className="text-silver-light font-medium">{fmtIDR(sp.monthlyPaidValue)}</span>
                                                                    <span className={`font-semibold ${monthlyPct >= 100 ? 'text-green-400' : monthlyPct >= 50 ? 'text-yellow-400' : 'text-red-400'}`}>
                                                                        {monthlyTarget > 0 ? `${((sp.monthlyPaidValue / monthlyTarget) * 100).toFixed(1)}%` : '—'}
                                                                    </span>
                                                                </div>
                                                                <div className="relative h-2 bg-dark-surface rounded-full overflow-hidden">
                                                                    <div className={`absolute inset-y-0 left-0 bg-gradient-to-r ${barColor(monthlyPct)} rounded-full transition-all duration-500`}
                                                                        style={{ width: `${monthlyPct}%` }} />
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td className="px-4 py-4 text-center">
                                                            <div className="flex flex-col items-center gap-1">
                                                                <span className={`px-3 py-1 rounded-lg text-sm font-bold ${badgeColor}`}>
                                                                    {yearlyTarget > 0 ? `${totalPct.toFixed(1)}%` : '—'}
                                                                </span>
                                                                {totalPct >= 100 && <Award className="w-4 h-4 text-yellow-400" />}
                                                            </div>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </React.Fragment>
                                    );
                                });
                            })()}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* ── Modal Kelola Target ────────────────────────────────────────────── */}
            {showTargetModal && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="glass-card rounded-lg w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
                        <div className="p-6 border-b border-dark-border flex items-center justify-between">
                            <div>
                                <h2 className="text-xl font-bold text-silver-light flex items-center gap-2">
                                    <Target className="w-5 h-5 text-accent-orange" />
                                    Kelola Target Sales
                                </h2>
                                <p className="text-sm text-silver-dark mt-1">Atur target pendapatan tahunan per sales</p>
                            </div>
                            <button onClick={() => { setShowTargetModal(false); setEditingTargetId(null); setTargetForm({ sales_name: '', yearly_target: '' }); }}
                                className="p-2 hover:bg-dark-surface rounded-lg transition-colors">
                                <X className="w-5 h-5 text-silver-dark" />
                            </button>
                        </div>

                        <div className="p-6 flex flex-col gap-6 overflow-auto">
                            {/* Form tambah/edit */}
                            <div className="bg-dark-surface/50 rounded-lg p-4 space-y-3">
                                <h3 className="text-sm font-semibold text-silver-light">
                                    {editingTargetId ? 'Edit Target' : 'Tambah Target Baru'}
                                </h3>
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                    <div>
                                        <label className="block text-xs text-silver-dark mb-1">Nama Sales *</label>
                                        <input
                                            type="text"
                                            value={targetForm.sales_name}
                                            onChange={e => setTargetForm(f => ({ ...f, sales_name: e.target.value }))}
                                            placeholder="Contoh: Budi Santoso"
                                            className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-black placeholder:text-gray-400 text-sm focus:outline-none focus:border-accent-orange"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs text-silver-dark mb-1">Divisi</label>
                                        <input
                                            type="text"
                                            list="division-suggestions"
                                            value={targetForm.division}
                                            onChange={e => setTargetForm(f => ({ ...f, division: e.target.value }))}
                                            placeholder="Contoh: Sea Freight"
                                            className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-black placeholder:text-gray-400 text-sm focus:outline-none focus:border-accent-orange"
                                        />
                                        <datalist id="division-suggestions">
                                            <option value="Sea Freight" />
                                            <option value="Air Freight" />
                                            <option value="Land Transport" />
                                            <option value="Customs" />
                                            <option value="Umum" />
                                        </datalist>
                                    </div>
                                    <div>
                                        <label className="block text-xs text-silver-dark mb-1">Target / Tahun (Rp) *</label>
                                        <input
                                            type="number"
                                            value={targetForm.yearly_target}
                                            onChange={e => setTargetForm(f => ({ ...f, yearly_target: e.target.value }))}
                                            placeholder="Contoh: 1000000000"
                                            className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-black placeholder:text-gray-400 text-sm focus:outline-none focus:border-accent-orange"
                                        />
                                        {targetForm.yearly_target && Number(targetForm.yearly_target) > 0 && (
                                            <p className="text-xs text-silver-dark mt-1">
                                                = {fmtIDR(Number(targetForm.yearly_target))} · {fmtIDR(Math.round(Number(targetForm.yearly_target) / 12))}/bulan
                                            </p>
                                        )}
                                    </div>
                                </div>
                                <div className="flex gap-2 justify-end">
                                    {editingTargetId && (
                                        <button onClick={() => { setEditingTargetId(null); setTargetForm({ sales_name: '', yearly_target: '' }); }}
                                            className="px-4 py-2 text-sm bg-dark-card border border-dark-border text-silver-light rounded-lg hover:bg-dark-surface transition-colors">
                                            Batal
                                        </button>
                                    )}
                                    <button onClick={handleSaveTarget} disabled={isSavingTarget}
                                        className="flex items-center gap-2 px-4 py-2 text-sm bg-accent-orange hover:bg-accent-orange/80 text-white rounded-lg transition-colors disabled:opacity-50">
                                        {isSavingTarget ? 'Menyimpan...' : (editingTargetId ? 'Simpan Perubahan' : <><Plus className="w-4 h-4" />Tambah Target</>)}
                                    </button>
                                </div>
                            </div>

                            {/* Daftar target */}
                            <div>
                                <div className="flex items-center justify-between mb-3">
                                    <h3 className="text-sm font-semibold text-silver-light">Daftar Target ({targetList.length})</h3>
                                    {canRunSuperAdminBatch && (
                                        <div className="flex gap-2">
                                            <button
                                                onClick={handleDeleteSelectedTargets}
                                                disabled={selectedTargetIds.length === 0}
                                                className={`px-3 py-1.5 text-xs rounded-lg transition-colors ${selectedTargetIds.length > 0 ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30' : 'bg-dark-surface text-silver-dark cursor-not-allowed opacity-60'}`}
                                            >
                                                Hapus Terpilih ({selectedTargetIds.length})
                                            </button>
                                            <button
                                                onClick={handleDeleteAllTargets}
                                                disabled={targetList.length === 0}
                                                className={`px-3 py-1.5 text-xs rounded-lg transition-colors ${targetList.length > 0 ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30' : 'bg-dark-surface text-silver-dark cursor-not-allowed opacity-60'}`}
                                            >
                                                Bersihkan Semua Data
                                            </button>
                                        </div>
                                    )}
                                </div>
                                {targetList.length === 0 ? (
                                    <p className="text-sm text-silver-dark text-center py-6">Belum ada target yang diset</p>
                                ) : (
                                    <table className="w-full text-sm">
                                        <thead className="bg-dark-surface">
                                            <tr>
                                                <th className="px-3 py-2 text-center text-xs font-bold text-silver uppercase">
                                                    <input
                                                        type="checkbox"
                                                        checked={targetList.length > 0 && selectedTargetIds.length === targetList.length}
                                                        onChange={toggleSelectAllTargets}
                                                        className="w-4 h-4"
                                                    />
                                                </th>
                                                <th className="px-3 py-2 text-left text-xs font-bold text-silver uppercase">Nama Sales</th>
                                                <th className="px-3 py-2 text-left text-xs font-bold text-silver uppercase">Divisi</th>
                                                <th className="px-3 py-2 text-right text-xs font-bold text-silver uppercase">Target / Tahun</th>
                                                <th className="px-3 py-2 text-right text-xs font-bold text-silver uppercase">Target / Bulan</th>
                                                <th className="px-3 py-2 text-center text-xs font-bold text-silver uppercase">Aksi</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-dark-border">
                                            {targetList.map(row => (
                                                <tr key={row.id} className="hover:bg-dark-surface/30">
                                                    <td className="px-3 py-3 text-center">
                                                        <input
                                                            type="checkbox"
                                                            checked={selectedTargetIds.includes(row.id)}
                                                            onChange={() => toggleSelectOneTarget(row.id)}
                                                            className="w-4 h-4"
                                                        />
                                                    </td>
                                                    <td className="px-3 py-3 text-black font-medium">{row.sales_name}</td>
                                                    <td className="px-3 py-3 text-black">{row.division || 'Umum'}</td>
                                                    <td className="px-3 py-3 text-right text-black">{fmtIDR(row.yearly_target)}</td>
                                                    <td className="px-3 py-3 text-right text-black">{fmtIDR(Math.round(row.yearly_target / 12))}</td>
                                                    <td className="px-3 py-3">
                                                        <div className="flex justify-center gap-2">
                                                            <button onClick={() => handleEditTarget(row)}
                                                                className="p-1.5 hover:bg-blue-500/20 text-blue-400 rounded-lg transition-colors">
                                                                <Edit2 className="w-4 h-4" />
                                                            </button>
                                                            {canDelete('blink_sales') && (
                                                                <button onClick={() => handleDeleteTarget(row.id)}
                                                                    className="p-1.5 hover:bg-red-500/20 text-red-400 rounded-lg transition-colors">
                                                                    <Trash2 className="w-4 h-4" />
                                                                </button>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Detail Modal */}
            {showDetailModal && selectedSalesPerson && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="glass-card rounded-lg max-w-5xl w-full max-h-[90vh] overflow-hidden">
                        <div className="p-6 border-b border-dark-border flex items-center justify-between">
                            <div>
                                <h2 className="text-2xl font-bold text-silver-light">
                                    Detail Pencapaian — {selectedSalesPerson.name}
                                </h2>
                                <div className="flex gap-4 mt-1 text-sm text-silver-dark">
                                    {salesTargets[selectedSalesPerson.name]?.yearly_target > 0 && (
                                        <>
                                            <span>Target: {fmtIDR(salesTargets[selectedSalesPerson.name]?.yearly_target)}/thn</span>
                                            <span>·</span>
                                            <span>Tahunan: {fmtIDR(selectedSalesPerson.paidValue)} ({((selectedSalesPerson.paidValue / salesTargets[selectedSalesPerson.name]?.yearly_target) * 100).toFixed(1)}%)</span>
                                            <span>·</span>
                                            <span>Bulan ini: {fmtIDR(selectedSalesPerson.monthlyPaidValue)}</span>
                                        </>
                                    )}
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <button onClick={handlePrintTXT}
                                    className="flex items-center gap-2 px-4 py-2 bg-accent-orange hover:bg-accent-orange/80 text-white rounded-lg transition-colors">
                                    <Printer className="w-4 h-4" />
                                    Cetak TXT
                                </button>
                                <button onClick={() => setShowDetailModal(false)}
                                    className="flex items-center gap-2 px-4 py-2 bg-dark-surface hover:bg-dark-card border border-dark-border text-silver-light rounded-lg transition-colors">
                                    <ArrowLeft className="w-4 h-4" />
                                    Kembali
                                </button>
                            </div>
                        </div>

                        <div className="overflow-auto max-h-[calc(90vh-120px)] p-6">
                            <table className="w-full">
                                <thead className="bg-dark-surface sticky top-0">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-bold text-silver uppercase">No. Quotation</th>
                                        <th className="px-6 py-3 text-left text-xs font-bold text-silver uppercase">Tanggal</th>
                                        <th className="px-6 py-3 text-left text-xs font-bold text-silver uppercase">Customer</th>
                                        <th className="px-6 py-3 text-left text-xs font-bold text-silver uppercase">Tanggal Pembayaran</th>
                                        <th className="px-6 py-3 text-right text-xs font-bold text-silver uppercase">Jumlah Terbayar</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-dark-border">
                                    {selectedSalesPerson.details && selectedSalesPerson.details.length > 0 ? (
                                        selectedSalesPerson.details.map((detail, idx) => (
                                            <tr key={idx} className="hover:bg-dark-surface/30">
                                                <td className="px-6 py-3 text-sm text-silver-light">{detail.quotationNo}</td>
                                                <td className="px-6 py-3 text-sm text-silver-dark">
                                                    {detail.quotationDate ? new Date(detail.quotationDate).toLocaleDateString('id-ID') : '-'}
                                                </td>
                                                <td className="px-6 py-3 text-sm text-silver-light">{detail.customer}</td>
                                                <td className="px-6 py-3 text-sm text-silver-dark">
                                                    {detail.paymentDate ? new Date(detail.paymentDate).toLocaleDateString('id-ID') : '-'}
                                                </td>
                                                <td className="px-6 py-3 text-sm text-right font-semibold text-green-400">
                                                    {detail.paidAmount > 0 ? `Rp ${detail.paidAmount.toLocaleString('id-ID')}` : '-'}
                                                </td>
                                            </tr>
                                        ))
                                    ) : (
                                        <tr>
                                            <td colSpan="5" className="px-6 py-8 text-center text-silver-dark">
                                                No quotation data available
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SalesAchievement;
