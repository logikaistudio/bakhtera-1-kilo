import React, { useMemo, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Building2, PlusCircle, ShieldCheck, XCircle } from 'lucide-react';

const INITIAL_BRANCHES = [
    { code: 'CBG-JKT', name: 'Cabang Jakarta', city: 'Jakarta', status: 'active', mode: 'standalone' },
    { code: 'CBG-SBY', name: 'Cabang Surabaya', city: 'Surabaya', status: 'active', mode: 'standalone' },
    { code: 'CBG-DPS', name: 'Cabang Denpasar', city: 'Denpasar', status: 'active', mode: 'shared' },
];

const CabangManagement = () => {
    const { user, isAdmin, isSuperAdmin } = useAuth();
    const [branches, setBranches] = useState(INITIAL_BRANCHES);
    const [form, setForm] = useState({ code: '', name: '', city: '', mode: 'standalone' });

    const isAdminHq = useMemo(() => {
        const level = String(user?.user_level || '').toLowerCase();
        return isSuperAdmin() || isAdmin() || level === 'admin_hq';
    }, [isAdmin, isSuperAdmin, user?.user_level]);

    const handleCreate = (e) => {
        e.preventDefault();
        if (!isAdminHq) return;
        if (!form.code.trim() || !form.name.trim()) return;

        setBranches((prev) => [
            {
                code: form.code.trim().toUpperCase(),
                name: form.name.trim(),
                city: form.city.trim() || '-',
                status: 'active',
                mode: form.mode,
            },
            ...prev,
        ]);

        setForm({ code: '', name: '', city: '', mode: 'standalone' });
    };

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold text-silver-light">Manajemen Cabang</h1>
                <p className="text-sm text-silver-dark mt-1">
                    Pembuatan cabang hanya untuk Admin HQ. Cabang memiliki modul Sales dan Finance setara BXPO, BLINK, dan BIG.
                </p>
            </div>

            <div className="glass-card rounded-xl border border-dark-border p-4 flex items-start gap-3">
                {isAdminHq ? (
                    <>
                        <ShieldCheck className="w-5 h-5 text-emerald-300 mt-0.5" />
                        <div>
                            <p className="text-sm text-emerald-300 font-medium">Akses Admin HQ terdeteksi</p>
                            <p className="text-xs text-silver-dark mt-1">Anda dapat membuat cabang baru dan menentukan mode standalone/shared.</p>
                        </div>
                    </>
                ) : (
                    <>
                        <XCircle className="w-5 h-5 text-red-300 mt-0.5" />
                        <div>
                            <p className="text-sm text-red-300 font-medium">Akses dibatasi</p>
                            <p className="text-xs text-silver-dark mt-1">Hanya Admin HQ yang boleh membuat cabang baru.</p>
                        </div>
                    </>
                )}
            </div>

            <form onSubmit={handleCreate} className="glass-card rounded-xl border border-dark-border p-4 space-y-4">
                <div className="flex items-center gap-2 mb-1">
                    <PlusCircle className="w-4 h-4 text-accent-blue" />
                    <h2 className="text-base font-semibold text-silver-light">Create Cabang</h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <input
                        type="text"
                        placeholder="Kode cabang (contoh: CBG-BDG)"
                        value={form.code}
                        onChange={(e) => setForm((prev) => ({ ...prev, code: e.target.value }))}
                        className="w-full px-3 py-2.5 rounded-lg bg-dark-surface border border-dark-border text-silver-light text-sm focus:outline-none focus:ring-2 focus:ring-accent-blue/40"
                        disabled={!isAdminHq}
                    />
                    <input
                        type="text"
                        placeholder="Nama cabang"
                        value={form.name}
                        onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                        className="w-full px-3 py-2.5 rounded-lg bg-dark-surface border border-dark-border text-silver-light text-sm focus:outline-none focus:ring-2 focus:ring-accent-blue/40"
                        disabled={!isAdminHq}
                    />
                    <input
                        type="text"
                        placeholder="Kota"
                        value={form.city}
                        onChange={(e) => setForm((prev) => ({ ...prev, city: e.target.value }))}
                        className="w-full px-3 py-2.5 rounded-lg bg-dark-surface border border-dark-border text-silver-light text-sm focus:outline-none focus:ring-2 focus:ring-accent-blue/40"
                        disabled={!isAdminHq}
                    />
                    <select
                        value={form.mode}
                        onChange={(e) => setForm((prev) => ({ ...prev, mode: e.target.value }))}
                        className="w-full px-3 py-2.5 rounded-lg bg-dark-surface border border-dark-border text-silver-light text-sm focus:outline-none focus:ring-2 focus:ring-accent-blue/40"
                        disabled={!isAdminHq}
                    >
                        <option value="standalone">Standalone</option>
                        <option value="shared">Shared HQ Finance</option>
                    </select>
                </div>

                <button
                    type="submit"
                    disabled={!isAdminHq}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-accent-blue text-white text-sm font-medium hover:bg-accent-blue/90 smooth-transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    <Building2 className="w-4 h-4" />
                    Simpan Cabang
                </button>
            </form>

            <div className="glass-card rounded-xl border border-dark-border overflow-hidden">
                <div className="px-5 py-4 border-b border-dark-border">
                    <h2 className="text-base font-semibold text-silver-light">Daftar Cabang</h2>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="bg-dark-surface/40 border-b border-dark-border/80">
                                <th className="text-left px-5 py-3 text-silver-dark">Kode</th>
                                <th className="text-left px-5 py-3 text-silver-dark">Nama</th>
                                <th className="text-left px-5 py-3 text-silver-dark">Kota</th>
                                <th className="text-left px-5 py-3 text-silver-dark">Mode</th>
                                <th className="text-left px-5 py-3 text-silver-dark">Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {branches.map((item) => (
                                <tr key={item.code} className="border-b border-dark-border/40 hover:bg-dark-surface/40 smooth-transition">
                                    <td className="px-5 py-3 text-silver-light font-medium">{item.code}</td>
                                    <td className="px-5 py-3 text-silver">{item.name}</td>
                                    <td className="px-5 py-3 text-silver">{item.city}</td>
                                    <td className="px-5 py-3">
                                        <span className={`inline-flex px-2 py-1 rounded-md text-xs border ${item.mode === 'standalone'
                                            ? 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30'
                                            : 'bg-purple-500/15 text-purple-300 border-purple-500/30'
                                            }`}>
                                            {item.mode}
                                        </span>
                                    </td>
                                    <td className="px-5 py-3">
                                        <span className="inline-flex px-2 py-1 rounded-md text-xs border bg-emerald-500/15 text-emerald-300 border-emerald-500/30">
                                            {item.status}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default CabangManagement;
