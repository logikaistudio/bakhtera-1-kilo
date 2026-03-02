import React from 'react';
import { useData } from '../context/DataContext';
import { useNavigate } from 'react-router-dom';
import StatCard from '../components/Common/StatCard';
import Button from '../components/Common/Button';
import {
    Plane,
    Building2,
    Calendar,
    Users,
    UserCircle,
    Wallet,
    TrendingUp,
    Package,
    ArrowRight
} from 'lucide-react';
import { motion } from 'framer-motion';

const FreightDashboard = () => {
    const { vendors, customers, finance, shipments, assets, events } = useData();
    const navigate = useNavigate();

    // Calculate statistics
    const totalRevenue = (finance || [])
        .filter(t => t?.type === 'income')
        .reduce((sum, t) => sum + parseFloat(t?.amount || 0), 0);

    const totalExpense = (finance || [])
        .filter(t => t?.type === 'expense')
        .reduce((sum, t) => sum + parseFloat(t?.amount || 0), 0);

    const activeShipments = (shipments || []).filter(s => s?.status !== 'completed').length;
    const activeAssets = (assets || []).filter(a => a?.status === 'in-use').length;
    const upcomingEvents = (events || []).filter(e => e?.status === 'planning' || e?.status === 'confirmed').length;

    const moduleCards = [
        {
            title: 'Blink',
            subtitle: 'Management System',
            icon: Plane,
            path: '/blink',
            stats: [
                { label: 'Pengiriman Aktif', value: activeShipments },
                { label: 'Total Pengiriman', value: shipments.length },
            ],
            color: 'from-blue-500/20 to-blue-600/20',
        },
        {
            title: 'Bridge',
            subtitle: 'Manajemen Aset TPPB',
            icon: Building2,
            path: '/bridge',
            stats: [
                { label: 'Aset Aktif', value: activeAssets },
                { label: 'Total Aset', value: assets.length },
            ],
            color: 'from-purple-500/20 to-purple-600/20',
        },
        {
            title: 'Big',
            subtitle: 'Penyelenggara Acara',
            icon: Calendar,
            path: '/big',
            stats: [
                { label: 'Acara Mendatang', value: upcomingEvents },
                { label: 'Total Acara', value: events.length },
            ],
            color: 'from-orange-500/20 to-orange-600/20',
        },
    ];

    return (
        <div className="space-y-8">
            {/* Header */}
            <div>
                <h1 className="text-4xl font-bold gradient-text mb-2">Dashboard Bakhtera-1</h1>
                <p className="text-silver-dark">Ringkasan platform manajemen terintegrasi</p>
            </div>

            {/* Overall Statistics */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard
                    icon={Users}
                    label="Total Vendor"
                    value={(vendors || []).length}
                    iconColor="text-blue-400"
                />
                <StatCard
                    icon={UserCircle}
                    label="Total Pelanggan"
                    value={(customers || []).length}
                    iconColor="text-green-400"
                />
                <StatCard
                    icon={TrendingUp}
                    label="Total Pendapatan"
                    value={`Rp ${totalRevenue.toLocaleString('id-ID')}`}
                    iconColor="text-emerald-400"
                />
                <StatCard
                    icon={Wallet}
                    label="Total Pengeluaran"
                    value={`Rp ${totalExpense.toLocaleString('id-ID')}`}
                    iconColor="text-red-400"
                />
            </div>

            {/* Module Cards */}
            <div>
                <h2 className="text-2xl font-bold text-silver-light mb-6">Ringkasan Modul</h2>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {moduleCards.map((module, index) => (
                        <motion.div
                            key={module.path}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.1 }}
                            className="relative glass-card glass-card-hover p-6 rounded-lg cursor-pointer group"
                            onClick={() => navigate(module.path)}
                        >
                            <div className={`absolute inset-0 bg-gradient-to-br ${module.color} rounded-lg opacity-0 group-hover:opacity-100 smooth-transition`} />

                            <div className="relative">
                                <div className="flex items-start justify-between mb-4">
                                    <div className={`p-3 rounded-lg bg-gradient-to-br ${module.color}`}>
                                        <module.icon className="w-8 h-8 text-silver-light" />
                                    </div>
                                    <ArrowRight className="w-5 h-5 text-silver-dark group-hover:text-silver group-hover:translate-x-1 smooth-transition" />
                                </div>

                                <h3 className="text-xl font-bold text-silver-light mb-1">{module.title}</h3>
                                <p className="text-sm text-silver-dark mb-4">{module.subtitle}</p>

                                <div className="space-y-2">
                                    {module.stats.map((stat, idx) => (
                                        <div key={idx} className="flex justify-between items-center">
                                            <span className="text-sm text-silver-dark">{stat.label}</span>
                                            <span className="text-lg font-semibold text-silver-light">{stat.value}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </motion.div>
                    ))}
                </div>
            </div>

            {/* Recent Activity */}
            <div className="glass-card p-6 rounded-lg">
                <h2 className="text-2xl font-bold text-silver-light mb-4">Aksi Cepat</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Button
                        onClick={() => navigate('/vendors')}
                        variant="secondary"
                        icon={Users}
                        className="w-full"
                    >
                        Kelola Vendor
                    </Button>
                    <Button
                        onClick={() => navigate('/customers')}
                        variant="secondary"
                        icon={UserCircle}
                        className="w-full"
                    >
                        Kelola Pelanggan
                    </Button>
                    <Button
                        onClick={() => navigate('/finance')}
                        variant="secondary"
                        icon={Wallet}
                        className="w-full"
                    >
                        Lihat Keuangan
                    </Button>
                </div>
            </div>
        </div>
    );
};

export default FreightDashboard;
