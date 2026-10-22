import React, { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import {
    DollarSign, Plus, Search, RefreshCw, Edit, Trash2, Check,
    Eye, ChevronRight, ChevronDown
} from 'lucide-react';
import Button from '../../../components/Common/Button';
import Modal from '../../../components/Common/Modal';
import { useLanguage } from '../../../i18n/LanguageContext';

const BigCosts = () => {
    const { t } = useLanguage();
    const [costs, setCosts] = useState([]);
    const [groupedCosts, setGroupedCosts] = useState([]);
    const [events, setEvents] = useState([]);
    const [vendors, setVendors] = useState([]);
    const [coaOptions, setCoaOptions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    // Modal States
    const [showEditModal, setShowEditModal] = useState(false);
    const [showDetailModal, setShowDetailModal] = useState(false);

    // Selection States
    const [selectedCost, setSelectedCost] = useState(null); // For Edit/Delete single cost
    const [selectedGroup, setSelectedGroup] = useState(null); // For Detail Modal

    const [formData, setFormData] = useState({
        event_id: '',
        vendor_id: '',
        description: '',
        amount: 0,
        cost_date: new Date().toISOString().split('T')[0],
        coa_expense_id: '',
        notes: ''
    });

    useEffect(() => { fetchData(); }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [costsRes, eventsRes, vendorsRes, coaRes] = await Promise.all([
                supabase.from('big_costs').select('*, event:big_events(event_name), vendor:freight_vendors(name), coa:finance_coa(name)').order('created_at', { ascending: false }),
                supabase.from('big_events').select('id, event_name'),
                supabase.from('freight_vendors').select('id, name'),
                supabase.from('finance_coa').select('id, code, name').in('type', ['EXPENSE', 'COGS'])
            ]);

            if (costsRes.error) throw costsRes.error;

            const rawCosts = costsRes.data || [];
            setCosts(rawCosts);
            processGroupedCosts(rawCosts);

            setEvents(eventsRes.data || []);
            setVendors(vendorsRes.data || []);
            setCoaOptions(coaRes.data || []);
        } catch (error) {
            console.error('Error fetching data:', error);
        } finally {
            setLoading(false);
        }
    };

    const processGroupedCosts = (rawCosts) => {
        const groups = {};

        rawCosts.forEach(cost => {
            // Group by quotation_id, fallback to event_id or "Manual"
            const groupKey = cost.quotation_id || cost.event_id || 'manual';

            if (!groups[groupKey]) {
                groups[groupKey] = {
                    key: groupKey,
                    quotation_id: cost.quotation_id,
                    event_id: cost.event_id,
                    event_name: cost.event?.event_name || 'No Event',
                    quotation_number: cost.quotation_id ? extractQuotationNumber(cost.cost_number) : 'Manual / Direct',
                    items: [],
                    total_amount: 0,
                    status: 'approved' // Default to approved, downgrade if any pending
                };
            }

            groups[groupKey].items.push(cost);
            groups[groupKey].total_amount += (cost.amount || 0);
            if (cost.status === 'pending') groups[groupKey].status = 'pending';
        });

        setGroupedCosts(Object.values(groups));
    };

    // Helper to extract quotation number part from COST-BIG-XX-XX-XXXX-XX
    const extractQuotationNumber = (costNumber) => {
        if (!costNumber) return 'Unknown';
        // pattern: COST-[QUOTATION_NUMBER]-ITEMINDEX
        // ex: COST-BIG-25-01-0005-01 -> BIG-25-01-0005
        const parts = costNumber.split('-');
        if (parts.length >= 5) {
            return parts.slice(1, parts.length - 1).join('-');
        }
        return costNumber;
    };

    const formatCurrency = (a) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(a || 0);

    const getStatusBadge = (s) => {
        const styles = { pending: 'bg-yellow-500/20 text-yellow-400', approved: 'bg-blue-500/20 text-blue-400', paid: 'bg-green-500/20 text-green-400' };
        return <span className={`px-2 py-1 rounded-full text-xs font-medium ${styles[s] || styles.pending}`}>{s?.toUpperCase()}</span>;
    };

    // --- Actions ---

    const handleSubmit = async (e) => {
        e.preventDefault();
        const data = {
            ...formData,
            amount: parseFloat(formData.amount) || 0,
            status: 'pending',
            quotation_id: selectedGroup?.quotation_id || null
        };

        try {
            if (selectedCost) {
                await supabase.from('big_costs').update(data).eq('id', selectedCost.id);
            } else {
                await supabase.from('big_costs').insert(data);
            }
            setShowEditModal(false);
            resetForm();
            fetchData();
            if (showDetailModal && selectedGroup) {
                setShowDetailModal(false);
            }
        } catch (error) {
            console.error(error);
            alert(t("Error saving cost"));
        }
    };

    const handleApprove = async () => {
        const cost = selectedCost;
        if (!cost) return;
        if (!confirm(t("Approve this cost? Journal entry will be created."))) return;
        try {
            await supabase.from('big_costs').update({ status: 'approved' }).eq('id', cost.id);
            // Journal: DR Beban, CR Hutang
            const { data: apCoa } = await supabase.from('finance_coa').select('id').eq('type', 'LIABILITY').ilike('name', '%hutang%').single();
            if (cost.coa_expense_id && apCoa) {
                await supabase.from('blink_journal_entries').insert([
                    { entry_date: cost.cost_date, coa_id: cost.coa_expense_id, debit: cost.amount, credit: 0, description: `Biaya Event: ${cost.description}`, reference_type: 'big_cost', reference_id: cost.id },
                    { entry_date: cost.cost_date, coa_id: apCoa.id, debit: 0, credit: cost.amount, description: `Hutang Vendor: ${cost.description}`, reference_type: 'big_cost', reference_id: cost.id }
                ]);
            }
            alert(t("Cost approved and journal created."));
            fetchData();
            setShowEditModal(false);
            if (selectedGroup) setShowDetailModal(false);
        } catch (error) {
            console.error(error);
            alert(t("Error approving cost"));
        }
    };

    const handleDelete = async () => {
        const id = selectedCost?.id;
        if (!id) return;
        if (!confirm(t("Delete?"))) return;
        await supabase.from('big_costs').delete().eq('id', id);
        fetchData();
        setShowEditModal(false);
        if (selectedGroup) setShowDetailModal(false);
    };

    const openEdit = (cost) => {
        setSelectedCost(cost);
        setFormData({
            event_id: cost.event_id || '',
            vendor_id: cost.vendor_id || '',
            description: cost.description || '',
            amount: cost.amount || 0,
            cost_date: cost.cost_date || '',
            coa_expense_id: cost.coa_expense_id || '',
            notes: cost.notes || ''
        });
        setShowEditModal(true);
    };

    const openDetail = (group) => {
        setSelectedGroup(group);
        setShowDetailModal(true);
    };

    const resetForm = () => {
        setSelectedCost(null);
        setFormData({ event_id: '', vendor_id: '', description: '', amount: 0, cost_date: new Date().toISOString().split('T')[0], coa_expense_id: '', notes: '' });
    };

    // Filter Groups
    const filteredGroups = groupedCosts.filter(g =>
        g.quotation_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
        g.event_name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold dark:text-white flex items-center gap-2">
                        <DollarSign className="w-6 h-6 text-red-500" />
                        {t("Event Costs (COGS)")}
                    </h1>
                    <p className="text-sm text-gray-500">{t("Track event expenses (Grouped by Quotation)")}</p>
                </div>
                <Button onClick={() => { resetForm(); setShowEditModal(true); }} icon={Plus}>{t("Add Manual Cost")}</Button>
            </div>

            <div className="flex gap-4">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input type="text" placeholder={t("Search Quotation or Event...")} value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2 border rounded-lg text-sm dark:bg-dark-surface dark:border-dark-border" />
                </div>
                <button onClick={fetchData} className="p-2 hover:bg-gray-100 dark:hover:bg-dark-surface rounded-lg">
                    <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
                </button>
            </div>

            {/* Main Table (Grouped) */}
            <div className="bg-white dark:bg-dark-surface/50 rounded-lg border overflow-hidden">
                <table className="w-full">
                    <thead className="bg-gray-50 dark:bg-dark-surface">
                        <tr>
                            <th className="px-4 py-3 text-left text-xs uppercase">{t("Quotation Ref / Group")}</th>
                            <th className="px-4 py-3 text-left text-xs uppercase">{t("Event")}</th>
                            <th className="px-4 py-3 text-center text-xs uppercase">{t("Items")}</th>
                            <th className="px-4 py-3 text-right text-xs uppercase">{t("Total Amount")}</th>
                            <th className="px-4 py-3 text-center text-xs uppercase">{t("Status")}</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y">
                        {loading ? (
                            <tr><td colSpan={5} className="py-8 text-center bg-transparent">{t("Loading...")}</td></tr>
                        ) : filteredGroups.length === 0 ? (
                            <tr><td colSpan={5} className="py-8 text-center text-gray-500 bg-transparent">{t("No costs found")}</td></tr>
                        ) : (
                            filteredGroups.map(g => (
                                <tr
                                    key={g.key}
                                    className="hover:bg-gray-50 dark:hover:bg-dark-surface/50 cursor-pointer"
                                    onClick={() => openDetail(g)}
                                >
                                    <td className="px-4 py-3 text-sm font-mono font-medium">{g.quotation_number}</td>
                                    <td className="px-4 py-3 text-sm">{g.event_name}</td>
                                    <td className="px-4 py-3 text-center text-sm">
                                        <span className="bg-gray-100 dark:bg-dark-surface px-2 py-1 rounded-full text-xs">
                                            {g.items.length} {t("items")}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-sm text-right font-medium">{formatCurrency(g.total_amount)}</td>
                                    <td className="px-4 py-3 text-center">{getStatusBadge(g.status)}</td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Detail Modal */}
            <Modal isOpen={showDetailModal} onClose={() => setShowDetailModal(false)} title={`Detailed Costs - ${selectedGroup?.quotation_number}`} size="xl">
                <div className="space-y-4">
                    <div className="flex justify-between items-center mb-4">
                        <div>
                            <h3 className="text-lg font-bold">{selectedGroup?.event_name}</h3>
                            <p className="text-sm text-gray-500">{t("Total:")} {formatCurrency(selectedGroup?.total_amount)}</p>
                        </div>
                        {(!selectedGroup?.quotation_id) && (
                            <Button size="sm" onClick={() => { resetForm(); setFormData({ ...formData, event_id: selectedGroup?.event_id }); setShowEditModal(true); }} icon={Plus}>
                                {t("Add Item")}
                            </Button>
                        )}
                    </div>

                    <div className="overflow-x-auto border rounded-lg">
                        <table className="w-full text-sm">
                            <thead className="bg-gray-50 dark:bg-dark-surface">
                                <tr>
                                    <th className="px-3 py-2 text-left">No.</th>
                                    <th className="px-3 py-2 text-left">{t("Description")}</th>
                                    <th className="px-3 py-2 text-left">{t("Vendor")}</th>
                                    <th className="px-3 py-2 text-right">{t("Amount")}</th>
                                    <th className="px-3 py-2 text-center">{t("Status")}</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y cursor-pointer">
                                {selectedGroup?.items.map((item, idx) => (
                                    <tr
                                        key={item.id}
                                        className="hover:bg-gray-50"
                                        onClick={() => openEdit(item)}
                                    >
                                        <td className="px-3 py-2 font-mono text-xs">{item.cost_number}</td>
                                        <td className="px-3 py-2">{item.description}</td>
                                        <td className="px-3 py-2">{item.vendor?.name || '-'}</td>
                                        <td className="px-3 py-2 text-right">{formatCurrency(item.amount)}</td>
                                        <td className="px-3 py-2 text-center">{getStatusBadge(item.status)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </Modal>

            {/* Edit/Add Modal */}
            <Modal isOpen={showEditModal} onClose={() => setShowEditModal(false)} title={selectedCost ? 'Edit Cost' : 'Add Cost'}>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium mb-1">{t("Event")}</label>
                            <select value={formData.event_id} onChange={e => setFormData({ ...formData, event_id: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm dark:bg-dark-surface">
                                <option value="">{t("Select")}</option>
                                {events.map(e => <option key={e.id} value={e.id}>{e.event_name}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1">{t("Vendor")}</label>
                            <select value={formData.vendor_id} onChange={e => setFormData({ ...formData, vendor_id: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm dark:bg-dark-surface">
                                <option value="">{t("Select")}</option>
                                {vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                            </select>
                        </div>
                        <div className="col-span-2">
                            <label className="block text-sm font-medium mb-1">{t("Description")}</label>
                            <input type="text" value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm dark:bg-dark-surface" required />
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1">{t("Amount")}</label>
                            <input type="text" value={formData.amount ? parseInt(formData.amount).toLocaleString('id-ID') : '0'} onChange={e => { const v = e.target.value.replace(/\./g, ''); if (v === '' || /^\d+$/.test(v)) setFormData({ ...formData, amount: v }); }} className="w-full px-3 py-2 border rounded-lg text-sm dark:bg-dark-surface text-right" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1">{t("Date")}</label>
                            <input type="date" value={formData.cost_date} onChange={e => setFormData({ ...formData, cost_date: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm dark:bg-dark-surface" />
                        </div>
                    </div>

                    <div className="flex justify-between gap-2 pt-4">
                        <div className="flex gap-2">
                            {selectedCost && (
                                <>
                                    <Button type="button" variant="danger" onClick={handleDelete} className="flex items-center gap-1">
                                        <Trash2 className="w-4 h-4" /> {t("Delete")}
                                    </Button>
                                    {selectedCost.status === 'pending' && (
                                        <Button type="button" variant="success" onClick={handleApprove} className="flex items-center gap-1">
                                            <Check className="w-4 h-4" /> {t("Approve")}
                                        </Button>
                                    )}
                                </>
                            )}
                        </div>
                        <div className="flex gap-2">
                            <Button type="button" variant="secondary" onClick={() => setShowEditModal(false)}>{t("Cancel")}</Button>
                            <Button type="submit">{t("Save")}</Button>
                        </div>
                    </div>
                </form>
            </Modal>
        </div>
    );
};

export default BigCosts;
