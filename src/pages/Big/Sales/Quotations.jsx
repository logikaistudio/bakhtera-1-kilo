import React, { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { useNavigate } from 'react-router-dom';
import {
    FileText, Plus, Search, Calendar, DollarSign,
    ChevronRight, RefreshCw, Eye, Edit, Trash2, Check, X, Send
} from 'lucide-react';
import Button from '../../../components/Common/Button';
import Modal from '../../../components/Common/Modal';
import { parseCurrency } from '../../../utils/currencyFormatter';

const BigQuotations = () => {
    const navigate = useNavigate();
    const [quotations, setQuotations] = useState([]);
    const [events, setEvents] = useState([]);
    const [customers, setCustomers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [showModal, setShowModal] = useState(false);
    const [selectedQuotation, setSelectedQuotation] = useState(null);
    const [formData, setFormData] = useState({
        event_id: '',
        client_id: '',
        valid_until: '',
        tax_rate: 11,
        notes: '',
        items: [{ description: '', quantity: 1, unit: 'pcs', unit_price: 0 }]
    });

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [quotationsRes, eventsRes, customersRes] = await Promise.all([
                supabase.from('big_quotations').select(`
                    *,
                    event:big_events(event_name),
                    client:freight_customers(name),
                    items:big_quotation_items(*)
                `).order('created_at', { ascending: false }),
                supabase.from('big_events').select('id, event_name, client_id').in('status', ['planning', 'confirmed', 'ongoing']),
                supabase.from('freight_customers').select('id, name')
            ]);

            if (quotationsRes.error) throw quotationsRes.error;
            if (eventsRes.error) throw eventsRes.error;
            if (customersRes.error) throw customersRes.error;

            setQuotations(quotationsRes.data || []);
            setEvents(eventsRes.data || []);
            setCustomers(customersRes.data || []);
        } catch (error) {
            console.error('Error fetching data:', error);
        } finally {
            setLoading(false);
        }
    };

    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('id-ID', {
            style: 'currency',
            currency: 'IDR',
            minimumFractionDigits: 0
        }).format(amount || 0);
    };

    const getStatusBadge = (status) => {
        const styles = {
            draft: 'bg-gray-500/20 text-gray-400',
            sent: 'bg-blue-500/20 text-blue-400',
            approved: 'bg-green-500/20 text-green-400',
            rejected: 'bg-red-500/20 text-red-400',
            expired: 'bg-yellow-500/20 text-yellow-400',
            pending_review: 'bg-orange-500/20 text-orange-400'
        };
        return (
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${styles[status] || styles.draft}`}>
                {status?.replace('_', ' ').toUpperCase()}
            </span>
        );
    };

    // Helper to generate timestamp for internal notes
    const getTimestamp = () => {
        const now = new Date();
        return now.toLocaleString('id-ID', {
            year: 'numeric', month: '2-digit', day: '2-digit',
            hour: '2-digit', minute: '2-digit'
        });
    };

    const calculateTotals = (items, taxRate) => {
        const subtotal = items.reduce((sum, item) => sum + (parseCurrency(item.quantity) * parseCurrency(item.unit_price)), 0);
        const taxAmount = subtotal * (taxRate / 100);
        const total = subtotal + taxAmount;
        return { subtotal, taxAmount, total };
    };

    const handleItemChange = (index, field, value) => {
        const newItems = [...formData.items];
        newItems[index][field] = value;
        newItems[index].amount = parseCurrency(newItems[index].quantity) * parseCurrency(newItems[index].unit_price);
        setFormData({ ...formData, items: newItems });
    };

    // Auto-fill client when event is selected
    const handleEventChange = (eventId) => {
        const selectedEvent = events.find(e => e.id === eventId);
        setFormData(prev => ({
            ...prev,
            event_id: eventId,
            client_id: selectedEvent?.client_id || prev.client_id
        }));
    };

    const addItem = () => {
        setFormData({
            ...formData,
            items: [...formData.items, { description: '', quantity: 1, unit: 'pcs', unit_price: 0 }]
        });
    };

    const removeItem = (index) => {
        if (formData.items.length > 1) {
            const newItems = formData.items.filter((_, i) => i !== index);
            setFormData({ ...formData, items: newItems });
        }
    };

    // Generate quotation number: BIG-YY-MM-XXXX
    const generateQuotationNumber = async () => {
        const now = new Date();
        const year = now.getFullYear().toString().slice(-2);
        const month = (now.getMonth() + 1).toString().padStart(2, '0');
        const prefix = `BIG-${year}-${month}-`;

        // Get count of existing quotations this month
        const { count } = await supabase
            .from('big_quotations')
            .select('*', { count: 'exact', head: true })
            .like('quotation_number', `${prefix}%`);

        const nextNumber = ((count || 0) + 1).toString().padStart(4, '0');
        return `${prefix}${nextNumber}`;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const { subtotal, taxAmount, total } = calculateTotals(formData.items, formData.tax_rate);

            const quotationData = {
                event_id: formData.event_id || null,
                client_id: formData.client_id || null,
                valid_until: formData.valid_until || null,
                tax_rate: formData.tax_rate,
                subtotal,
                tax_amount: taxAmount,
                total_amount: total,
                notes: formData.notes
            };

            if (selectedQuotation) {
                // Check if editing an already approved quotation -> trigger re-approval
                const wasApproved = selectedQuotation.status === 'approved';

                let updateData = { ...quotationData };

                if (wasApproved) {
                    // Change to pending_review and add internal note
                    const existingNotes = selectedQuotation.internal_notes || '';
                    const newNote = `[${getTimestamp()}] Edited after approval - pending re-review. Previous total: ${formatCurrency(selectedQuotation.total_amount)}, New total: ${formatCurrency(total)}`;
                    updateData.status = 'pending_review';
                    updateData.internal_notes = existingNotes ? `${existingNotes}\n${newNote}` : newNote;
                } else {
                    updateData.status = 'draft';
                }

                const { error } = await supabase
                    .from('big_quotations')
                    .update(updateData)
                    .eq('id', selectedQuotation.id);
                if (error) throw error;

                // Delete old items and insert new
                await supabase.from('big_quotation_items').delete().eq('quotation_id', selectedQuotation.id);
                const itemsToInsert = formData.items.map((item, idx) => ({
                    quotation_id: selectedQuotation.id,
                    description: item.description,
                    quantity: parseCurrency(item.quantity),
                    unit: item.unit,
                    unit_price: parseCurrency(item.unit_price),
                    amount: parseCurrency(item.quantity) * parseCurrency(item.unit_price),
                    sort_order: idx
                }));
                await supabase.from('big_quotation_items').insert(itemsToInsert);

                if (wasApproved) {
                    alert('Quotation edited. Status changed to "Pending Review". Please re-approve to sync Invoice & COGS.');
                }
            } else {
                // Generate quotation number for new quotation
                const quotation_number = await generateQuotationNumber();

                // Insert
                const { data, error } = await supabase
                    .from('big_quotations')
                    .insert({ ...quotationData, quotation_number, status: 'draft' })
                    .select()
                    .single();
                if (error) throw error;

                // Insert items
                const itemsToInsert = formData.items.map((item, idx) => ({
                    quotation_id: data.id,
                    description: item.description,
                    quantity: parseCurrency(item.quantity),
                    unit: item.unit,
                    unit_price: parseCurrency(item.unit_price),
                    amount: parseCurrency(item.quantity) * parseCurrency(item.unit_price),
                    sort_order: idx
                }));
                await supabase.from('big_quotation_items').insert(itemsToInsert);
            }

            setShowModal(false);
            resetForm();
            fetchData();
        } catch (error) {
            console.error('Error saving quotation:', error);
            alert('Error saving quotation: ' + error.message);
        }
    };

    const handleApprove = async (quotation) => {
        const isReApproval = quotation.status === 'pending_review';
        const confirmMsg = isReApproval
            ? 'Re-approve this quotation? Invoice & COGS will be updated to reflect changes.'
            : 'Approve this quotation? An invoice will be generated automatically.';

        if (!confirm(confirmMsg)) return;

        try {
            // Get full quotation with items
            const { data: fullQuotation, error: fetchError } = await supabase
                .from('big_quotations')
                .select('*, items:big_quotation_items(*)')
                .eq('id', quotation.id)
                .single();
            if (fetchError) throw fetchError;

            const now = new Date();
            const year = now.getFullYear().toString().slice(-2);
            const month = (now.getMonth() + 1).toString().padStart(2, '0');
            const timestamp = getTimestamp();

            if (isReApproval) {
                // === RE-APPROVAL FLOW ===
                // Update quotation status back to approved with internal note
                const existingNotes = fullQuotation.internal_notes || '';
                const newNote = `[${timestamp}] Re-approved. Changes synced to Invoice & COGS.`;
                await supabase
                    .from('big_quotations')
                    .update({
                        status: 'approved',
                        internal_notes: existingNotes ? `${existingNotes}\n${newNote}` : newNote
                    })
                    .eq('id', quotation.id);

                // Find and update linked Invoice
                const { data: existingInvoice } = await supabase
                    .from('big_invoices')
                    .select('*')
                    .eq('quotation_id', quotation.id)
                    .single();

                if (existingInvoice) {
                    const invNotes = existingInvoice.internal_notes || '';
                    const invNewNote = `[${timestamp}] Updated from quotation re-approval. New total: ${formatCurrency(fullQuotation.total_amount)}`;

                    // Update invoice totals
                    await supabase
                        .from('big_invoices')
                        .update({
                            subtotal: fullQuotation.subtotal,
                            tax_rate: fullQuotation.tax_rate,
                            tax_amount: fullQuotation.tax_amount,
                            total_amount: fullQuotation.total_amount,
                            internal_notes: invNotes ? `${invNotes}\n${invNewNote}` : invNewNote
                        })
                        .eq('id', existingInvoice.id);

                    // Replace invoice items
                    await supabase.from('big_invoice_items').delete().eq('invoice_id', existingInvoice.id);
                    if (fullQuotation.items?.length > 0) {
                        const invoiceItems = fullQuotation.items.map(item => ({
                            invoice_id: existingInvoice.id,
                            description: item.description,
                            quantity: item.quantity,
                            unit: item.unit,
                            unit_price: item.unit_price,
                            amount: item.amount,
                            sort_order: item.sort_order
                        }));
                        await supabase.from('big_invoice_items').insert(invoiceItems);
                    }

                    // Update AR transaction if exists
                    await supabase
                        .from('big_ar_transactions')
                        .update({
                            original_amount: fullQuotation.total_amount,
                            outstanding_amount: fullQuotation.total_amount - (existingInvoice.paid_amount || 0)
                        })
                        .eq('invoice_id', existingInvoice.id);
                }

                // Find and update linked COGS entries
                const { data: existingCosts } = await supabase
                    .from('big_costs')
                    .select('*')
                    .eq('quotation_id', quotation.id);

                if (existingCosts?.length > 0) {
                    // Delete old COGS and recreate
                    await supabase.from('big_costs').delete().eq('quotation_id', quotation.id);
                }

                // Recreate COGS from updated quotation items
                if (fullQuotation.items?.length > 0) {
                    const costEntries = fullQuotation.items.map((item, idx) => {
                        const costNumber = `COST-${fullQuotation.quotation_number}-${(idx + 1).toString().padStart(2, '0')}`;
                        return {
                            cost_number: costNumber,
                            quotation_id: quotation.id,
                            event_id: fullQuotation.event_id,
                            description: item.description,
                            amount: item.amount * 0.7,
                            cost_date: new Date().toISOString().split('T')[0],
                            status: 'pending',
                            notes: `Auto-generated from Quotation ${fullQuotation.quotation_number}`,
                            internal_notes: `[${timestamp}] Created from re-approval of quotation.`
                        };
                    });
                    await supabase.from('big_costs').insert(costEntries);
                }

                alert('Quotation re-approved. Invoice & COGS have been updated!');
            } else {
                // === FIRST APPROVAL FLOW ===
                // Update quotation status to approved
                const existingNotes = fullQuotation.internal_notes || '';
                const newNote = `[${timestamp}] Approved. Invoice & COGS generated.`;
                await supabase
                    .from('big_quotations')
                    .update({
                        status: 'approved',
                        internal_notes: existingNotes ? `${existingNotes}\n${newNote}` : newNote
                    })
                    .eq('id', quotation.id);

                // Generate invoice number based on Quotation Number: INV-[QuotationNumber]
                const invoiceNumber = `INV-${fullQuotation.quotation_number}`;

                // Create invoice
                const { data: invoice, error: invError } = await supabase
                    .from('big_invoices')
                    .insert({
                        invoice_number: invoiceNumber,
                        quotation_id: quotation.id,
                        event_id: fullQuotation.event_id,
                        client_id: fullQuotation.client_id,
                        due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                        subtotal: fullQuotation.subtotal,
                        tax_rate: fullQuotation.tax_rate,
                        tax_amount: fullQuotation.tax_amount,
                        total_amount: fullQuotation.total_amount,
                        status: 'draft',
                        internal_notes: `[${timestamp}] Generated from quotation ${fullQuotation.quotation_number}`
                    })
                    .select()
                    .single();
                if (invError) throw invError;

                // Copy quotation items to invoice items
                if (fullQuotation.items?.length > 0) {
                    const invoiceItems = fullQuotation.items.map(item => ({
                        invoice_id: invoice.id,
                        description: item.description,
                        quantity: item.quantity,
                        unit: item.unit,
                        unit_price: item.unit_price,
                        amount: item.amount,
                        sort_order: item.sort_order
                    }));
                    await supabase.from('big_invoice_items').insert(invoiceItems);
                }

                // Generate COGS entries from quotation items
                if (fullQuotation.items?.length > 0) {
                    // Use Quotation Number for COGS: COST-[QuotationNumber]-[ItemIndex]
                    const costEntries = fullQuotation.items.map((item, idx) => {
                        const costNumber = `COST-${fullQuotation.quotation_number}-${(idx + 1).toString().padStart(2, '0')}`;
                        return {
                            cost_number: costNumber,
                            quotation_id: quotation.id,
                            event_id: fullQuotation.event_id,
                            description: item.description,
                            amount: item.amount * 0.7,
                            cost_date: new Date().toISOString().split('T')[0],
                            status: 'pending',
                            notes: `Auto-generated from Quotation ${fullQuotation.quotation_number}`,
                            internal_notes: `[${timestamp}] Created from initial approval.`
                        };
                    });
                    await supabase.from('big_costs').insert(costEntries);
                }

                alert(`Invoice ${invoiceNumber} and COGS entries have been generated!`);
            }

            fetchData();
        } catch (error) {
            console.error('Error approving:', error);
            alert('Error: ' + error.message);
        }
    };

    const handleDelete = async (id) => {
        if (!confirm('Delete this quotation? This will also delete related Invoices and COGS.')) return;
        try {
            // Manual Cascade Delete
            // 1. Delete COGS
            await supabase.from('big_costs').delete().eq('quotation_id', id);

            // 2. Delete Invoices (items cascade automatically from invoice)
            await supabase.from('big_invoices').delete().eq('quotation_id', id);

            // 3. Delete Quotation (items cascade automatically)
            const { error } = await supabase.from('big_quotations').delete().eq('id', id);
            if (error) throw error;

            fetchData();
            alert('Quotation and related records deleted successfully.');
        } catch (error) {
            console.error('Error deleting:', error);
            alert('Error deleting: ' + error.message);
        }
    };

    const openEdit = (quotation) => {
        setSelectedQuotation(quotation);
        setFormData({
            event_id: quotation.event_id || '',
            client_id: quotation.client_id || '',
            valid_until: quotation.valid_until || '',
            tax_rate: quotation.tax_rate || 11,
            notes: quotation.notes || '',
            items: quotation.items?.length > 0 ? quotation.items : [{ description: '', quantity: 1, unit: 'pcs', unit_price: 0 }]
        });
        setShowModal(true);
    };

    const resetForm = () => {
        setSelectedQuotation(null);
        setFormData({
            event_id: '',
            client_id: '',
            valid_until: '',
            tax_rate: 11,
            notes: '',
            items: [{ description: '', quantity: 1, unit: 'pcs', unit_price: 0 }]
        });
    };

    const filteredQuotations = quotations.filter(q => {
        const matchSearch = q.quotation_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            q.event?.event_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            q.client?.name?.toLowerCase().includes(searchTerm.toLowerCase());
        const matchStatus = statusFilter === 'all' || q.status === statusFilter;
        return matchSearch && matchStatus;
    });

    const { subtotal, taxAmount, total } = calculateTotals(formData.items, formData.tax_rate);

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <FileText className="w-6 h-6 text-green-500" />
                        Event Quotations
                    </h1>
                    <p className="text-gray-500 dark:text-silver-dark text-sm">Manage quotations for events</p>
                </div>
                <Button onClick={() => { resetForm(); setShowModal(true); }} icon={Plus}>
                    New Quotation
                </Button>
            </div>

            {/* Filters */}
            <div className="flex flex-col md:flex-row gap-4">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Search quotations..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 bg-white dark:bg-dark-surface border border-gray-200 dark:border-dark-border rounded-lg text-sm"
                    />
                </div>
                <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="px-4 py-2 bg-white dark:bg-dark-surface border border-gray-200 dark:border-dark-border rounded-lg text-sm"
                >
                    <option value="all">All Status</option>
                    <option value="draft">Draft</option>
                    <option value="sent">Sent</option>
                    <option value="approved">Approved</option>
                    <option value="rejected">Rejected</option>
                </select>
                <button onClick={fetchData} className="p-2 hover:bg-gray-100 dark:hover:bg-dark-surface rounded-lg">
                    <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
                </button>
            </div>

            {/* Table */}
            <div className="bg-white dark:bg-dark-surface/50 rounded-lg border border-gray-200 dark:border-dark-border overflow-hidden">
                <table className="w-full">
                    <thead className="bg-gray-50 dark:bg-dark-surface">
                        <tr>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-silver-dark uppercase">No. Quotation</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-silver-dark uppercase">Event</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-silver-dark uppercase">Client</th>
                            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-silver-dark uppercase">Total</th>
                            <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-silver-dark uppercase">Status</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-dark-border">
                        {loading ? (
                            <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-500">Loading...</td></tr>
                        ) : filteredQuotations.length === 0 ? (
                            <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-500">No quotations found</td></tr>
                        ) : (
                            filteredQuotations.map((q) => (
                                <tr
                                    key={q.id}
                                    className="hover:bg-gray-50 dark:hover:bg-dark-surface/50 cursor-pointer"
                                    onClick={() => openEdit(q)}
                                >
                                    <td className="px-4 py-3 text-sm font-mono">{q.quotation_number}</td>
                                    <td className="px-4 py-3 text-sm">{q.event?.event_name || '-'}</td>
                                    <td className="px-4 py-3 text-sm">{q.client?.name || '-'}</td>
                                    <td className="px-4 py-3 text-sm text-right font-medium">{formatCurrency(q.total_amount)}</td>
                                    <td className="px-4 py-3 text-center">{getStatusBadge(q.status)}</td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Modal */}
            <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={selectedQuotation ? 'Edit Quotation' : 'New Quotation'} size="xl">
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium mb-1">Event</label>
                            <select
                                value={formData.event_id}
                                onChange={(e) => handleEventChange(e.target.value)}
                                className="w-full px-3 py-2 border rounded-lg text-sm dark:bg-dark-surface dark:border-dark-border"
                            >
                                <option value="">Select Event</option>
                                {events.map(e => <option key={e.id} value={e.id}>{e.event_name}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1">Client</label>
                            <select
                                value={formData.client_id}
                                onChange={(e) => setFormData({ ...formData, client_id: e.target.value })}
                                className="w-full px-3 py-2 border rounded-lg text-sm dark:bg-dark-surface dark:border-dark-border"
                            >
                                <option value="">Select Client</option>
                                {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1">Valid Until</label>
                            <input
                                type="date"
                                value={formData.valid_until}
                                onChange={(e) => setFormData({ ...formData, valid_until: e.target.value })}
                                className="w-full px-3 py-2 border rounded-lg text-sm dark:bg-dark-surface dark:border-dark-border"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1">Tax Rate (%)</label>
                            <input
                                type="number"
                                value={formData.tax_rate}
                                onChange={(e) => setFormData({ ...formData, tax_rate: parseFloat(e.target.value) || 0 })}
                                className="w-full px-3 py-2 border rounded-lg text-sm dark:bg-dark-surface dark:border-dark-border"
                            />
                        </div>
                    </div>

                    {/* Line Items */}
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <label className="block text-sm font-medium">Line Items</label>
                            <button type="button" onClick={addItem} className="text-xs text-blue-500 hover:underline">+ Add Item</button>
                        </div>
                        <div className="space-y-2">
                            {formData.items.map((item, idx) => (
                                <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                                    <input
                                        type="text"
                                        placeholder="Description"
                                        value={item.description}
                                        onChange={(e) => handleItemChange(idx, 'description', e.target.value)}
                                        className="col-span-5 px-2 py-1 border rounded text-sm dark:bg-dark-surface dark:border-dark-border"
                                    />
                                    <input
                                        type="text"
                                        placeholder="Qty"
                                        value={item.quantity}
                                        onChange={(e) => handleItemChange(idx, 'quantity', e.target.value)}
                                        className="col-span-2 px-2 py-1 border rounded text-sm dark:bg-dark-surface dark:border-dark-border"
                                    />
                                    <input
                                        type="text"
                                        placeholder="Unit Price"
                                        value={item.unit_price || item.unit_price === 0 ? (typeof item.unit_price === 'string' ? item.unit_price : parseCurrency(item.unit_price).toLocaleString('id-ID', { minimumFractionDigits: Number.isInteger(parseCurrency(item.unit_price)) ? 0 : 2, maximumFractionDigits: 6 })) : ''}
                                        onChange={(e) => {
                                            const value = e.target.value;
                                            if (value === '' || /^[\d.,]+$/.test(value)) {
                                                handleItemChange(idx, 'unit_price', value);
                                            }
                                        }}
                                        className="col-span-3 px-2 py-1 border rounded text-sm dark:bg-dark-surface dark:border-dark-border text-right"
                                    />
                                    <span className="col-span-1 text-sm text-right">{formatCurrency(parseCurrency(item.quantity) * parseCurrency(item.unit_price))}</span>
                                    {formData.items.length > 1 && (
                                        <button type="button" onClick={() => removeItem(idx)} className="col-span-1 text-red-500">
                                            <X className="w-4 h-4" />
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Totals */}
                    <div className="border-t pt-4 space-y-1 text-right">
                        <div className="text-sm">Subtotal: {formatCurrency(subtotal)}</div>
                        <div className="text-sm">Tax ({formData.tax_rate}%): {formatCurrency(taxAmount)}</div>
                        <div className="text-lg font-bold">Total: {formatCurrency(total)}</div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-1">Notes</label>
                        <textarea
                            value={formData.notes}
                            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                            className="w-full px-3 py-2 border rounded-lg text-sm dark:bg-dark-surface dark:border-dark-border"
                            rows={2}
                        />
                    </div>

                    <div className="flex justify-between gap-2 pt-4">
                        {selectedQuotation ? (
                            <div className="flex gap-2">
                                <Button
                                    type="button"
                                    variant="danger"
                                    onClick={() => {
                                        if (confirm('Delete this quotation?')) {
                                            handleDelete(selectedQuotation.id);
                                            setShowModal(false);
                                        }
                                    }}
                                >
                                    Delete
                                </Button>
                                {selectedQuotation.status === 'draft' && (
                                    <Button
                                        type="button"
                                        variant="success"
                                        onClick={() => {
                                            handleApprove(selectedQuotation);
                                            setShowModal(false);
                                        }}
                                    >
                                        Approve
                                    </Button>
                                )}
                            </div>
                        ) : <div />}
                        <div className="flex gap-2">
                            <Button type="button" variant="secondary" onClick={() => setShowModal(false)}>Cancel</Button>
                            <Button type="submit">Save Quotation</Button>
                        </div>
                    </div>
                </form>
            </Modal>
        </div>
    );
};

export default BigQuotations;
