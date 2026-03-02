import React, { useState, useEffect } from 'react';
import { useData } from '../../context/DataContext';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import { FileText, Plus, Eye, Printer, Edit, Trash2, Search, Filter, Calendar, Truck, Package, CheckCircle, Clock, Send, Download } from 'lucide-react';
import DeliveryNoteForm from './DeliveryNoteForm';
import DeliveryNotePrint from './DeliveryNotePrint';

const DeliveryNotes = () => {
    const { canCreate, canEdit, canDelete } = useAuth();
    const hasCreate = canCreate('bridge_delivery');
    const hasEdit = canEdit('bridge_delivery');
    const hasDelete = canDelete('bridge_delivery');
    const { quotations } = useData();
    const [deliveryNotes, setDeliveryNotes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [selectedNote, setSelectedNote] = useState(null);
    const [viewMode, setViewMode] = useState('list'); // list, create, edit, view

    // Load delivery notes from Supabase
    useEffect(() => {
        loadDeliveryNotes();
    }, []);

    const loadDeliveryNotes = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('freight_delivery_notes')
                .select('*')
                .order('date', { ascending: false });

            if (error) throw error;
            setDeliveryNotes(data || []);
        } catch (error) {
            console.error('Error loading delivery notes:', error);
        } finally {
            setLoading(false);
        }
    };

    // Generate delivery note number
    const generateDeliveryNoteNumber = () => {
        const now = new Date();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const year = now.getFullYear();
        const count = deliveryNotes.filter(dn =>
            dn.delivery_note_number.includes(`/${month}/${year}`)
        ).length + 1;
        return `SJ-${String(count).padStart(3, '0')}/${month}/${year}`;
    };

    // Filter delivery notes
    const filteredNotes = deliveryNotes.filter(note => {
        const matchSearch = !searchTerm ||
            note.delivery_note_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (note.consignee || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            (note.driver_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            (note.truck_number || '').toLowerCase().includes(searchTerm.toLowerCase());

        const matchStatus = statusFilter === 'all' || note.status === statusFilter;

        const matchDate = (!dateFrom || note.date >= dateFrom) && (!dateTo || note.date <= dateTo);

        return matchSearch && matchStatus && matchDate;
    });

    // Status badge component
    const StatusBadge = ({ status }) => {
        const statusConfig = {
            draft: { icon: Clock, color: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300', label: 'Draft' },
            sent: { icon: Send, color: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300', label: 'Terkirim' },
            received: { icon: CheckCircle, color: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300', label: 'Diterima' }
        };

        const config = statusConfig[status] || statusConfig.draft;
        const Icon = config.icon;

        return (
            <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${config.color}`}>
                <Icon className="w-3 h-3" />
                {config.label}
            </span>
        );
    };

    // Format date
    const formatDate = (dateString) => {
        if (!dateString) return '-';
        const date = new Date(dateString);
        return date.toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' });
    };

    // Delete delivery note
    const handleDelete = async (id) => {
        if (!hasDelete) return;
        if (!window.confirm('Apakah Anda yakin ingin menghapus surat jalan ini?')) return;

        try {
            const { error } = await supabase
                .from('freight_delivery_notes')
                .delete()
                .eq('id', id);

            if (error) throw error;
            await loadDeliveryNotes();
        } catch (error) {
            console.error('Error deleting delivery note:', error);
            alert('Gagal menghapus surat jalan');
        }
    };

    // Print delivery note
    const handlePrint = (note) => {
        setSelectedNote(note);
        setViewMode('print');
    };

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-dark-bg p-6">
            {/* Header */}
            <div className="mb-6">
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900 dark:text-silver-light flex items-center gap-2">
                            <FileText className="w-7 h-7 text-accent-blue" />
                            Surat Jalan
                        </h1>
                        <p className="text-sm text-gray-600 dark:text-silver-dark mt-1">
                            Kelola surat jalan pengiriman barang
                        </p>
                    </div>
                    {hasCreate && (
                        <button
                            onClick={() => {
                                setSelectedNote(null);
                                setViewMode('create');
                            }}
                            className="btn-primary flex items-center gap-2"
                        >
                            <Plus className="w-4 h-4" />
                            Buat Surat Jalan
                        </button>
                    )}
                </div>

                {/* Filters */}
                <div className="glass-card p-4">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        {/* Search */}
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <input
                                type="text"
                                placeholder="Cari No. SJ, Penerima, Driver..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="input-field pl-10 w-full"
                            />
                        </div>

                        {/* Status Filter */}
                        <div className="relative">
                            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <select
                                value={statusFilter}
                                onChange={(e) => setStatusFilter(e.target.value)}
                                className="input-field pl-10 w-full"
                            >
                                <option value="all">Semua Status</option>
                                <option value="draft">Draft</option>
                                <option value="sent">Terkirim</option>
                                <option value="received">Diterima</option>
                            </select>
                        </div>

                        {/* Date From */}
                        <div className="relative">
                            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <input
                                type="date"
                                value={dateFrom}
                                onChange={(e) => setDateFrom(e.target.value)}
                                className="input-field pl-10 w-full"
                                placeholder="Dari Tanggal"
                            />
                        </div>

                        {/* Date To */}
                        <div className="relative">
                            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <input
                                type="date"
                                value={dateTo}
                                onChange={(e) => setDateTo(e.target.value)}
                                className="input-field pl-10 w-full"
                                placeholder="Sampai Tanggal"
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                <div className="glass-card p-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-gray-600 dark:text-silver-dark">Total Surat Jalan</p>
                            <p className="text-2xl font-bold text-gray-900 dark:text-silver-light">{deliveryNotes.length}</p>
                        </div>
                        <FileText className="w-10 h-10 text-accent-blue opacity-20" />
                    </div>
                </div>

                <div className="glass-card p-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-gray-600 dark:text-silver-dark">Draft</p>
                            <p className="text-2xl font-bold text-gray-700 dark:text-gray-300">
                                {deliveryNotes.filter(n => n.status === 'draft').length}
                            </p>
                        </div>
                        <Clock className="w-10 h-10 text-gray-400 opacity-20" />
                    </div>
                </div>

                <div className="glass-card p-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-gray-600 dark:text-silver-dark">Terkirim</p>
                            <p className="text-2xl font-bold text-blue-700 dark:text-blue-300">
                                {deliveryNotes.filter(n => n.status === 'sent').length}
                            </p>
                        </div>
                        <Send className="w-10 h-10 text-blue-400 opacity-20" />
                    </div>
                </div>

                <div className="glass-card p-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-gray-600 dark:text-silver-dark">Diterima</p>
                            <p className="text-2xl font-bold text-green-700 dark:text-green-300">
                                {deliveryNotes.filter(n => n.status === 'received').length}
                            </p>
                        </div>
                        <CheckCircle className="w-10 h-10 text-green-400 opacity-20" />
                    </div>
                </div>
            </div>

            {/* Table */}
            <div className="glass-card overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-accent-blue">
                            <tr>
                                <th className="px-4 py-3 text-left text-xs font-bold text-white">No. Surat Jalan</th>
                                <th className="px-4 py-3 text-left text-xs font-bold text-white">Tanggal</th>
                                <th className="px-4 py-3 text-left text-xs font-bold text-white">Tujuan</th>
                                <th className="px-4 py-3 text-left text-xs font-bold text-white">Penerima</th>
                                <th className="px-4 py-3 text-left text-xs font-bold text-white">Driver</th>
                                <th className="px-4 py-3 text-left text-xs font-bold text-white">Truck No.</th>
                                <th className="px-4 py-3 text-center text-xs font-bold text-white">Status</th>
                                <th className="px-4 py-3 text-center text-xs font-bold text-white">Aksi</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 dark:divide-dark-border">
                            {loading ? (
                                <tr>
                                    <td colSpan="8" className="px-4 py-8 text-center text-gray-500">
                                        Loading...
                                    </td>
                                </tr>
                            ) : filteredNotes.length === 0 ? (
                                <tr>
                                    <td colSpan="8" className="px-4 py-8 text-center text-gray-500">
                                        Tidak ada data surat jalan
                                    </td>
                                </tr>
                            ) : (
                                filteredNotes.map((note) => (
                                    <tr key={note.id} className="hover:bg-gray-50 dark:hover:bg-dark-surface transition-colors">
                                        <td className="px-4 py-3 text-sm font-medium text-accent-blue">
                                            {note.delivery_note_number}
                                        </td>
                                        <td className="px-4 py-3 text-sm text-gray-700 dark:text-silver-light">
                                            {formatDate(note.date)}
                                        </td>
                                        <td className="px-4 py-3 text-sm text-gray-700 dark:text-silver-light">
                                            {note.destination || '-'}
                                        </td>
                                        <td className="px-4 py-3 text-sm text-gray-700 dark:text-silver-light">
                                            {note.consignee || '-'}
                                        </td>
                                        <td className="px-4 py-3 text-sm text-gray-700 dark:text-silver-light">
                                            {note.driver_name || '-'}
                                        </td>
                                        <td className="px-4 py-3 text-sm text-gray-700 dark:text-silver-light">
                                            {note.truck_number || '-'}
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            <StatusBadge status={note.status} />
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex items-center justify-center gap-2">
                                                <button
                                                    onClick={() => {
                                                        setSelectedNote(note);
                                                        setViewMode('view');
                                                    }}
                                                    className="p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors"
                                                    title="Lihat Detail"
                                                >
                                                    <Eye className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => handlePrint(note)}
                                                    className="p-1.5 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded transition-colors"
                                                    title="Print"
                                                >
                                                    <Printer className="w-4 h-4" />
                                                </button>
                                                {note.status === 'draft' && (
                                                    <>
                                                        {hasEdit && (
                                                            <button
                                                                onClick={() => {
                                                                    setSelectedNote(note);
                                                                    setViewMode('edit');
                                                                }}
                                                                className="p-1.5 text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-900/20 rounded transition-colors"
                                                                title="Edit"
                                                            >
                                                                <Edit className="w-4 h-4" />
                                                            </button>
                                                        )}
                                                        {hasDelete && (
                                                            <button
                                                                onClick={() => handleDelete(note.id)}
                                                                className="p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                                                                title="Hapus"
                                                            >
                                                                <Trash2 className="w-4 h-4" />
                                                            </button>
                                                        )}
                                                    </>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>


            {/* Modals */}
            {(viewMode === 'create' || viewMode === 'edit') && (
                <DeliveryNoteForm
                    note={selectedNote}
                    mode={viewMode}
                    onClose={() => {
                        setViewMode('list');
                        setSelectedNote(null);
                    }}
                    onSave={() => {
                        loadDeliveryNotes();
                        setViewMode('list');
                        setSelectedNote(null);
                    }}
                />
            )}

            {/* Print Modal */}
            {viewMode === 'print' && selectedNote && (
                <DeliveryNotePrint
                    note={selectedNote}
                    onClose={() => {
                        setViewMode('list');
                        setSelectedNote(null);
                    }}
                />
            )}
        </div>
    );
};

export default DeliveryNotes;
