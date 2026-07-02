import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import Button from '../../components/Common/Button';
import { 
    Coins, 
    Plus, 
    Edit, 
    Trash2, 
    Calendar, 
    TrendingUp, 
    X, 
    Save, 
    DollarSign,
    RefreshCw,
    Search
} from 'lucide-react';

const ExchangeRates = () => {
    const { user } = useAuth();
    const [rates, setRates] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    
    // Modal states
    const [showModal, setShowModal] = useState(false);
    const [modalMode, setModalMode] = useState('add'); // 'add' | 'edit'
    const [selectedId, setSelectedId] = useState(null);
    const [formData, setFormData] = useState({
        effective_date: new Date().toISOString().split('T')[0],
        rate: '16000'
    });

    useEffect(() => {
        fetchRates();
    }, []);

    const fetchRates = async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('blink_exchange_rates')
                .select('*')
                .order('effective_date', { ascending: false });

            if (error) throw error;
            setRates(data || []);
        } catch (error) {
            console.error('Error fetching exchange rates:', error);
            alert('Gagal mengambil data kurs referensi: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    const handleOpenAdd = () => {
        setModalMode('add');
        setSelectedId(null);
        setFormData({
            effective_date: new Date().toISOString().split('T')[0],
            rate: '16000'
        });
        setShowModal(true);
    };

    const handleOpenEdit = (rateObj) => {
        setModalMode('edit');
        setSelectedId(rateObj.id);
        setFormData({
            effective_date: rateObj.effective_date,
            rate: String(rateObj.rate)
        });
        setShowModal(true);
    };

    const handleSave = async (e) => {
        e.preventDefault();
        
        const rateVal = parseFloat(formData.rate);
        if (isNaN(rateVal) || rateVal <= 0) {
            alert('Nilai kurs harus berupa angka positif!');
            return;
        }

        if (!formData.effective_date) {
            alert('Tanggal berlaku wajib diisi!');
            return;
        }

        try {
            if (modalMode === 'add') {
                // Check if date already exists
                const existing = rates.find(r => r.effective_date === formData.effective_date);
                if (existing) {
                    alert(`Kurs untuk tanggal ${formData.effective_date} sudah ada! Silakan edit data yang ada.`);
                    return;
                }

                const { error } = await supabase
                    .from('blink_exchange_rates')
                    .insert([{
                        rate: rateVal,
                        effective_date: formData.effective_date,
                        created_by: user?.name || user?.email || 'System'
                    }]);

                if (error) throw error;
                alert('✅ Kurs referensi berhasil ditambahkan');
            } else {
                const { error } = await supabase
                    .from('blink_exchange_rates')
                    .update({
                        rate: rateVal,
                        effective_date: formData.effective_date
                    })
                    .eq('id', selectedId);

                if (error) throw error;
                alert('✅ Kurs referensi berhasil diperbarui');
            }

            setShowModal(false);
            fetchRates();
        } catch (error) {
            console.error('Error saving exchange rate:', error);
            alert('Gagal menyimpan kurs referensi: ' + error.message);
        }
    };

    const handleDelete = async (id, date) => {
        if (!confirm(`Apakah Anda yakin ingin menghapus kurs referensi untuk tanggal ${date}?`)) {
            return;
        }

        try {
            const { error } = await supabase
                .from('blink_exchange_rates')
                .delete()
                .eq('id', id);

            if (error) throw error;
            alert('✅ Kurs referensi berhasil dihapus');
            fetchRates();
        } catch (error) {
            console.error('Error deleting exchange rate:', error);
            alert('Gagal menghapus kurs referensi: ' + error.message);
        }
    };

    // Filter rates based on search query
    const filteredRates = rates.filter(r => {
        if (!searchQuery) return true;
        const q = searchQuery.toLowerCase();
        return (
            r.effective_date.includes(q) ||
            String(r.rate).includes(q) ||
            (r.created_by || '').toLowerCase().includes(q)
        );
    });

    const latestRateObj = rates.length > 0 ? rates[0] : null;

    return (
        <div className="space-y-6 p-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold gradient-text flex items-center gap-2">
                        <Coins className="w-8 h-8 text-accent-orange" />
                        Kurs Referensi
                    </h1>
                    <p className="text-sm text-silver-dark mt-1">
                        Kelola kurs patokan USD ke IDR beserta tanggal berlakunya
                    </p>
                </div>
                <div className="flex gap-2">
                    <Button size="sm" variant="secondary" icon={RefreshCw} onClick={fetchRates} disabled={loading}>
                        Refresh
                    </Button>
                    <Button size="sm" variant="primary" icon={Plus} onClick={handleOpenAdd}>
                        Tambah Kurs
                    </Button>
                </div>
            </div>

            {/* Top Cards (Summary) */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="glass-card p-5 rounded-lg flex items-center justify-between">
                    <div>
                        <p className="text-xs text-silver-dark uppercase tracking-wider font-semibold">Kurs Saat Ini (Terbaru)</p>
                        <p className="text-3xl font-bold text-accent-orange mt-2">
                            {latestRateObj ? `Rp ${parseFloat(latestRateObj.rate).toLocaleString('id-ID', { minimumFractionDigits: 2 })}` : 'Tidak Ada'}
                        </p>
                        <p className="text-xs text-silver-dark mt-1">
                            {latestRateObj ? `Mulai Berlaku: ${new Date(latestRateObj.effective_date).toLocaleDateString('id-ID')}` : '-'}
                        </p>
                    </div>
                    <div className="w-12 h-12 bg-accent-orange/10 rounded-lg flex items-center justify-center">
                        <TrendingUp className="w-6 h-6 text-accent-orange" />
                    </div>
                </div>

                <div className="glass-card p-5 rounded-lg">
                    <p className="text-xs text-silver-dark uppercase tracking-wider font-semibold">Jumlah Riwayat Kurs</p>
                    <p className="text-3xl font-bold text-silver-light mt-2">{rates.length}</p>
                    <p className="text-xs text-silver-dark mt-1">Total data tersimpan di database</p>
                </div>

                <div className="glass-card p-5 rounded-lg">
                    <p className="text-xs text-silver-dark uppercase tracking-wider font-semibold">Mata Uang Acuan</p>
                    <p className="text-3xl font-bold text-blue-400 mt-2">USD ↔ IDR</p>
                    <p className="text-xs text-silver-dark mt-1">Penyetaraan nilai 1 USD dalam Rupiah</p>
                </div>
            </div>

            {/* Search Bar */}
            <div className="glass-card p-4 rounded-lg flex items-center gap-3">
                <Search className="w-5 h-5 text-silver-dark" />
                <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Cari berdasarkan tanggal (YYYY-MM-DD), nilai kurs, atau pembuat..."
                    className="flex-1 bg-transparent border-none outline-none text-silver-light placeholder-silver-dark text-sm"
                />
                {searchQuery && (
                    <button onClick={() => setSearchQuery('')} className="text-silver-dark hover:text-silver-light">
                        <X className="w-4 h-4" />
                    </button>
                )}
            </div>

            {/* Table */}
            {loading ? (
                <div className="glass-card p-12 text-center">
                    <div className="w-8 h-8 border-2 border-accent-orange border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                    <p className="text-silver-dark text-sm">Memuat data kurs...</p>
                </div>
            ) : filteredRates.length === 0 ? (
                <div className="glass-card p-12 text-center">
                    <Coins className="w-12 h-12 text-silver-dark mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-silver-light mb-1">Tidak Ada Data</h3>
                    <p className="text-silver-dark text-sm">Belum ada data kurs referensi yang cocok.</p>
                </div>
            ) : (
                <div className="glass-card rounded-lg overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-accent-orange">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-semibold text-white uppercase tracking-wider">Tanggal Berlaku</th>
                                    <th className="px-6 py-3 text-right text-xs font-semibold text-white uppercase tracking-wider">Nilai Tukar (USD ↔ IDR)</th>
                                    <th className="px-6 py-3 text-left text-xs font-semibold text-white uppercase tracking-wider">Dibuat Oleh</th>
                                    <th className="px-6 py-3 text-left text-xs font-semibold text-white uppercase tracking-wider">Tanggal Input</th>
                                    <th className="px-6 py-3 text-center text-xs font-semibold text-white uppercase tracking-wider w-32">Aksi</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-dark-border">
                                {filteredRates.map((r) => (
                                    <tr key={r.id} className="hover:bg-dark-surface smooth-transition">
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-silver-light flex items-center gap-2">
                                            <Calendar className="w-4 h-4 text-accent-orange" />
                                            {new Date(r.effective_date).toLocaleDateString('id-ID', {
                                                day: 'numeric',
                                                month: 'long',
                                                year: 'numeric'
                                            })}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-silver-light font-mono font-bold">
                                            Rp {parseFloat(r.rate).toLocaleString('id-ID', { minimumFractionDigits: 2 })}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-silver-dark">
                                            {r.created_by || '-'}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-silver-dark">
                                            {new Date(r.created_at).toLocaleDateString('id-ID')} {new Date(r.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-medium">
                                            <div className="flex justify-center gap-2">
                                                <button
                                                    onClick={() => handleOpenEdit(r)}
                                                    className="p-1.5 bg-dark-surface hover:bg-dark-border border border-dark-border text-blue-400 hover:text-blue-300 rounded smooth-transition"
                                                    title="Ubah Kurs"
                                                >
                                                    <Edit className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(r.id, r.effective_date)}
                                                    className="p-1.5 bg-dark-surface hover:bg-red-500/10 border border-dark-border text-red-500 hover:text-red-400 rounded smooth-transition"
                                                    title="Hapus Kurs"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Modal Tambah/Edit Kurs */}
            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <div className="bg-dark-card border border-dark-border rounded-xl shadow-2xl w-full max-w-md">
                        <div className="px-6 py-4 border-b border-dark-border flex justify-between items-center bg-dark-surface rounded-t-xl">
                            <h3 className="text-lg font-semibold text-silver-light flex items-center gap-2">
                                <Coins className="w-5 h-5 text-accent-orange" />
                                {modalMode === 'add' ? 'Tambah Kurs Referensi' : 'Edit Kurs Referensi'}
                            </h3>
                            <button onClick={() => setShowModal(false)} className="p-1 hover:bg-white/10 rounded-full text-silver-dark hover:text-silver-light">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <form onSubmit={handleSave}>
                            <div className="p-6 space-y-4">
                                <div>
                                    <label className="block text-xs text-silver-dark uppercase font-semibold mb-1">Tanggal Berlaku</label>
                                    <div className="relative">
                                        <input
                                            type="date"
                                            value={formData.effective_date}
                                            onChange={(e) => setFormData({ ...formData, effective_date: e.target.value })}
                                            className="w-full px-3 py-2 bg-dark-surface border border-dark-border rounded text-silver-light text-sm outline-none focus:border-accent-orange"
                                            required
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs text-silver-dark uppercase font-semibold mb-1">Nilai Kurs (USD to IDR)</label>
                                    <div className="relative flex items-center">
                                        <span className="absolute left-3 text-silver-dark text-sm font-semibold">Rp</span>
                                        <input
                                            type="number"
                                            value={formData.rate}
                                            onChange={(e) => setFormData({ ...formData, rate: e.target.value })}
                                            placeholder="e.g. 16300"
                                            className="w-full pl-9 pr-3 py-2 bg-dark-surface border border-dark-border rounded text-silver-light text-sm outline-none focus:border-accent-orange font-mono"
                                            required
                                            min="1"
                                            step="0.0001"
                                        />
                                    </div>
                                    <p className="text-[10px] text-silver-dark mt-1">
                                        Penyetaraan nilai 1 USD ke dalam Rupiah (IDR).
                                    </p>
                                </div>
                            </div>
                            <div className="px-6 py-4 border-t border-dark-border flex justify-end gap-2 bg-dark-surface rounded-b-xl">
                                <Button variant="secondary" size="sm" type="button" onClick={() => setShowModal(false)}>
                                    Batal
                                </Button>
                                <Button variant="primary" size="sm" type="submit" icon={Save}>
                                    Simpan
                                </Button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ExchangeRates;
