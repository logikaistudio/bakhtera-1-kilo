import React, { useState, useEffect } from 'react';
import { supabase } from '../../../../lib/supabase';
import {
    FileText, Plus, Search, RefreshCw, Edit, Trash2, Check, CreditCard
} from 'lucide-react';
import Button from '../../../../components/Common/Button';
import Modal from '../../../../components/Common/Modal';

const BigInvoices = () => {
    const [invoices, setInvoices] = useState([]);
    const [approvedQuotations, setApprovedQuotations] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [showModal, setShowModal] = useState(false);
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [selectedInvoice, setSelectedInvoice] = useState(null);
    const [paymentAmount, setPaymentAmount] = useState(0);

    useEffect(() => { fetchData(); }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            const { data: inv } = await supabase.from('big_invoices').select(`*, event:big_events(event_name), client:freight_customers(name)`).order('created_at', { ascending: false });
            const { data: quot } = await supabase.from('big_quotations').select('id, quotation_number, total_amount, event_id, client_id').eq('status', 'approved');
            setInvoices(inv || []);
            const existingIds = (inv || []).map(i => i.quotation_id).filter(Boolean);
            setApprovedQuotations((quot || []).filter(q => !existingIds.includes(q.id)));
        } catch (e) { console.error(e); }
        setLoading(false);
    };

    const formatCurrency = (a) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(a || 0);

    const getStatusBadge = (s) => {
        const styles = { draft: 'bg-gray-500/20 text-gray-400', unpaid: 'bg-yellow-500/20 text-yellow-400', partial: 'bg-blue-500/20 text-blue-400', paid: 'bg-green-500/20 text-green-400' };
        return <span className={`px-2 py-1 rounded-full text-xs font-medium ${styles[s] || styles.draft}`}>{s?.toUpperCase()}</span>;
    };

    const generateFromQuotation = async (q) => {
        const { data: full } = await supabase.from('big_quotations').select('*, items:big_quotation_items(*)').eq('id', q.id).single();
        const { data: inv } = await supabase.from('big_invoices').insert({
            invoice_number: `INV-${full.quotation_number}`,
            quotation_id: q.id, event_id: full.event_id, client_id: full.client_id,
            due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            subtotal: full.subtotal, tax_rate: full.tax_rate, tax_amount: full.tax_amount, total_amount: full.total_amount, status: 'draft'
        }).select().single();
        if (full.items?.length) await supabase.from('big_invoice_items').insert(full.items.map(i => ({ invoice_id: inv.id, description: i.description, quantity: i.quantity, unit: i.unit, unit_price: i.unit_price, amount: i.amount })));
        fetchData(); setShowModal(false);
    };

    const handleApprove = async (inv) => {
        if (!confirm('Approve invoice?')) return;
        await supabase.from('big_invoices').update({ status: 'unpaid' }).eq('id', inv.id);
        await supabase.from('big_ar_transactions').insert({ invoice_id: inv.id, client_id: inv.client_id, due_date: inv.due_date, original_amount: inv.total_amount, outstanding_amount: inv.total_amount });
        const { data: arCoa } = await supabase.from('finance_coa').select('id').eq('type', 'ASSET').ilike('name', '%piutang%').single();
        const { data: revCoa } = await supabase.from('finance_coa').select('id').eq('type', 'REVENUE').limit(1).single();
        if (arCoa && revCoa) await supabase.from('blink_journal_entries').insert([
            { entry_date: new Date().toISOString().split('T')[0], coa_id: arCoa.id, debit: inv.total_amount, credit: 0, description: `AR Invoice ${inv.invoice_number}`, reference_type: 'big_invoice', reference_id: inv.id },
            { entry_date: new Date().toISOString().split('T')[0], coa_id: revCoa.id, debit: 0, credit: inv.total_amount, description: `Revenue ${inv.invoice_number}`, reference_type: 'big_invoice', reference_id: inv.id }
        ]);
        fetchData();
    };

    const handlePayment = async () => {
        const newPaid = (selectedInvoice.paid_amount || 0) + paymentAmount;
        const status = newPaid >= selectedInvoice.total_amount ? 'paid' : 'partial';
        await supabase.from('big_invoices').update({ paid_amount: newPaid, status }).eq('id', selectedInvoice.id);
        await supabase.from('big_ar_transactions').update({ paid_amount: newPaid, outstanding_amount: selectedInvoice.total_amount - newPaid, status: status === 'paid' ? 'paid' : 'partial' }).eq('invoice_id', selectedInvoice.id);
        setShowPaymentModal(false); fetchData();
    };

    const filteredInvoices = invoices.filter(i => (i.invoice_number?.toLowerCase().includes(searchTerm.toLowerCase()) || i.client?.name?.toLowerCase().includes(searchTerm.toLowerCase())) && (statusFilter === 'all' || i.status === statusFilter));

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div><h1 className="text-2xl font-bold dark:text-white flex items-center gap-2"><FileText className="w-6 h-6 text-green-500" />Event Invoices</h1></div>
                <Button onClick={() => setShowModal(true)} icon={Plus}>From Quotation</Button>
            </div>
            <div className="flex gap-4">
                <div className="relative flex-1"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" /><input type="text" placeholder="Search..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2 border rounded-lg text-sm dark:bg-dark-surface dark:border-dark-border" /></div>
                <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="px-4 py-2 border rounded-lg text-sm dark:bg-dark-surface dark:border-dark-border"><option value="all">All</option><option value="draft">Draft</option><option value="unpaid">Unpaid</option><option value="partial">Partial</option><option value="paid">Paid</option></select>
                <button onClick={fetchData} className="p-2 hover:bg-gray-100 dark:hover:bg-dark-surface rounded-lg"><RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} /></button>
            </div>
            <div className="bg-white dark:bg-dark-surface/50 rounded-lg border overflow-hidden">
                <table className="w-full"><thead className="bg-gray-50 dark:bg-dark-surface"><tr><th className="px-4 py-3 text-left text-xs uppercase">Invoice</th><th className="px-4 py-3 text-left text-xs uppercase">Event</th><th className="px-4 py-3 text-left text-xs uppercase">Client</th><th className="px-4 py-3 text-right text-xs uppercase">Total</th><th className="px-4 py-3 text-right text-xs uppercase">Paid</th><th className="px-4 py-3 text-center text-xs uppercase">Status</th><th className="px-4 py-3 text-center text-xs uppercase">Actions</th></tr></thead>
                    <tbody className="divide-y">{loading ? <tr><td colSpan={7} className="py-8 text-center">Loading...</td></tr> : filteredInvoices.map(i => (
                        <tr key={i.id} className="hover:bg-gray-50 dark:hover:bg-dark-surface/50"><td className="px-4 py-3 text-sm font-mono">{i.invoice_number}</td><td className="px-4 py-3 text-sm">{i.event?.event_name || '-'}</td><td className="px-4 py-3 text-sm">{i.client?.name || '-'}</td><td className="px-4 py-3 text-sm text-right">{formatCurrency(i.total_amount)}</td><td className="px-4 py-3 text-sm text-right text-green-600">{formatCurrency(i.paid_amount)}</td><td className="px-4 py-3 text-center">{getStatusBadge(i.status)}</td>
                            <td className="px-4 py-3 flex justify-center gap-1">{i.status === 'draft' && <button onClick={() => handleApprove(i)} className="p-1 hover:bg-gray-100 rounded"><Check className="w-4 h-4 text-green-500" /></button>}{['unpaid', 'partial'].includes(i.status) && <button onClick={() => { setSelectedInvoice(i); setPaymentAmount(i.total_amount - (i.paid_amount || 0)); setShowPaymentModal(true); }} className="p-1 hover:bg-gray-100 rounded"><CreditCard className="w-4 h-4 text-blue-500" /></button>}</td></tr>
                    ))}</tbody></table>
            </div>
            <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="Generate from Quotation">{approvedQuotations.length === 0 ? <p className="text-center py-8 text-gray-500">No approved quotations</p> : approvedQuotations.map(q => <div key={q.id} className="flex justify-between items-center p-3 border rounded-lg mb-2"><span className="font-mono">{q.quotation_number} - {formatCurrency(q.total_amount)}</span><Button size="sm" onClick={() => generateFromQuotation(q)}>Generate</Button></div>)}</Modal>
            <Modal isOpen={showPaymentModal} onClose={() => setShowPaymentModal(false)} title="Record Payment"><div className="space-y-4"><p className="font-mono text-lg">{selectedInvoice?.invoice_number}</p><div className="grid grid-cols-2 gap-4"><div><span className="text-sm text-gray-500">Total</span><p>{formatCurrency(selectedInvoice?.total_amount)}</p></div><div><span className="text-sm text-gray-500">Outstanding</span><p className="text-red-600">{formatCurrency((selectedInvoice?.total_amount || 0) - (selectedInvoice?.paid_amount || 0))}</p></div></div><input type="number" value={paymentAmount} onChange={e => setPaymentAmount(parseFloat(e.target.value) || 0)} className="w-full px-3 py-2 border rounded-lg dark:bg-dark-surface" /><div className="flex justify-end gap-2"><Button variant="secondary" onClick={() => setShowPaymentModal(false)}>Cancel</Button><Button onClick={handlePayment}>Record</Button></div></div></Modal>
        </div>
    );
};

export default BigInvoices;
