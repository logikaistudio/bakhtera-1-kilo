import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import {
    DollarSign,
    TrendingUp,
    TrendingDown,
    Search,
    Download,
    Ship,
    Plane,
    Truck,
    Package,
    AlertTriangle,
    CheckCircle,
    Eye,
    Filter
} from 'lucide-react';
import Button from '../../components/Common/Button';
import SellingBuyingDetailModal from '../../components/Blink/SellingBuyingDetailModal';
import { formatCurrency } from '../../utils/currencyFormatter';

const SellingVsBuying = () => {
    const [shipments, setShipments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedShipment, setSelectedShipment] = useState(null);
    const [filterStatus, setFilterStatus] = useState('all'); // all, profit, loss, break-even

    // Fetch shipments with COGS data
    useEffect(() => {
        fetchShipments();
    }, []);

    const fetchShipments = async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('blink_shipments')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;

            // Process shipments to include profit calculations
            const processedShipments = (data || []).map(shipment => {
                const quotedAmount = parseFloat(shipment.quoted_amount) || 0;
                const cogsData = shipment.cogs || {};

                // Calculate total COGS
                let totalCOGS = 0;
                const cogsFields = ['oceanFreight', 'airFreight', 'trucking', 'thc', 'documentation', 'customs', 'insurance', 'demurrage', 'other'];
                cogsFields.forEach(field => {
                    totalCOGS += parseFloat(cogsData[field]) || 0;
                });

                // Add additional costs
                if (cogsData.additionalCosts && Array.isArray(cogsData.additionalCosts)) {
                    cogsData.additionalCosts.forEach(cost => {
                        totalCOGS += parseFloat(cost.amount) || 0;
                    });
                }

                // Add buying items
                const buyingItems = shipment.buying_items || [];
                buyingItems.forEach(item => {
                    totalCOGS += parseFloat(item.amount) || 0;
                });

                const profit = quotedAmount - totalCOGS;
                const margin = quotedAmount > 0 ? ((profit / quotedAmount) * 100).toFixed(2) : 0;

                return {
                    ...shipment,
                    id: shipment.id,
                    jobNumber: shipment.job_number,
                    soNumber: shipment.so_number,
                    customer: shipment.customer,
                    serviceType: shipment.service_type,
                    origin: shipment.origin,
                    destination: shipment.destination,
                    quotedAmount,
                    totalCOGS,
                    profit,
                    margin: parseFloat(margin),
                    currency: shipment.currency || 'USD',
                    sellingItems: shipment.selling_items || shipment.service_items || [],
                    buyingItems: buyingItems,
                    cogsData: cogsData
                };
            });

            setShipments(processedShipments);
        } catch (error) {
            console.error('Error fetching shipments:', error);
        } finally {
            setLoading(false);
        }
    };



    // Filter shipments
    const filteredShipments = shipments.filter(s => {
        // Search filter
        const matchSearch = !searchTerm ||
            s.jobNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            s.customer?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            s.soNumber?.toLowerCase().includes(searchTerm.toLowerCase());

        // Status filter
        let matchStatus = true;
        if (filterStatus === 'profit') matchStatus = s.profit > 0;
        else if (filterStatus === 'loss') matchStatus = s.profit < 0;
        else if (filterStatus === 'break-even') matchStatus = s.profit === 0;

        return matchSearch && matchStatus;
    });

    // Calculate totals
    const totals = filteredShipments.reduce((acc, s) => ({
        selling: acc.selling + s.quotedAmount,
        buying: acc.buying + s.totalCOGS,
        profit: acc.profit + s.profit
    }), { selling: 0, buying: 0, profit: 0 });

    const overallMargin = totals.selling > 0 ? ((totals.profit / totals.selling) * 100).toFixed(2) : 0;

    // Get service icon
    const getServiceIcon = (type) => {
        switch (type) {
            case 'sea': return Ship;
            case 'air': return Plane;
            case 'land': return Truck;
            default: return Package;
        }
    };

    // Handle view detail
    const handleViewDetail = (shipment) => {
        setSelectedShipment(shipment);
        // Optional: Update URL without reloading to reflect current state if clicked manually
        // window.history.pushState({}, '', `/blink/finance/selling-buying?id=${shipment.id}`);
    };

    const handleBackToList = () => {
        setSelectedShipment(null);
        // Clear URL param
        window.history.pushState({}, '', '/blink/finance/selling-buying');
    };

    // Auto-open detail from URL query param logic
    const location = useLocation();

    useEffect(() => {
        if (!loading && shipments.length > 0) {
            const params = new URLSearchParams(location.search);
            const shipmentId = params.get('id');

            if (shipmentId) {
                const targetShipment = shipments.find(s => s.id === shipmentId);
                if (targetShipment) {
                    setSelectedShipment(targetShipment);
                }
            }
        }
    }, [location.search, loading, shipments]);

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-accent-orange"></div>
            </div>
        );
    }



    // Export to Excel
    const handleExport = () => {
        // Create CSV content
        let csv = 'Job Number,SO Number,Customer,Service,Origin,Destination,Selling,Buying (COGS),Profit,Margin (%)\n';

        filteredShipments.forEach(s => {
            csv += `"${s.jobNumber}","${s.soNumber || '-'}","${s.customer}","${s.serviceType}","${s.origin}","${s.destination}",${s.quotedAmount},${s.totalCOGS},${s.profit},${s.margin}\n`;
        });

        // Add totals
        csv += `\n"TOTAL","","","","","",${totals.selling},${totals.buying},${totals.profit},${overallMargin}\n`;

        // Download
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `selling-vs-buying-${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
    };

    // LIST VIEW RENDER
    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold gradient-text">Selling vs Buying</h1>
                    <p className="text-silver-dark mt-1">Analisis perbandingan harga jual vs biaya modal per item</p>
                </div>
                <Button onClick={handleExport} icon={Download} variant="secondary">
                    Export CSV
                </Button>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="glass-card p-4 rounded-lg">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-xs text-silver-dark uppercase tracking-wider font-semibold">Total Selling</p>
                            <p className="text-xl font-bold text-green-400 mt-1">
                                Rp {totals.selling.toLocaleString('id-ID')}
                            </p>
                        </div>
                        <TrendingUp className="w-8 h-8 text-green-400 opacity-80" />
                    </div>
                </div>

                <div className="glass-card p-4 rounded-lg">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-xs text-silver-dark uppercase tracking-wider font-semibold">Total Buying (COGS)</p>
                            <p className="text-xl font-bold text-orange-400 mt-1">
                                Rp {totals.buying.toLocaleString('id-ID')}
                            </p>
                        </div>
                        <TrendingDown className="w-8 h-8 text-orange-400 opacity-80" />
                    </div>
                </div>

                <div className="glass-card p-4 rounded-lg">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-xs text-silver-dark uppercase tracking-wider font-semibold">Total Profit</p>
                            <p className={`text-xl font-bold mt-1 ${totals.profit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                Rp {totals.profit.toLocaleString('id-ID')}
                            </p>
                        </div>
                        <DollarSign className={`w-8 h-8 ${totals.profit >= 0 ? 'text-emerald-400' : 'text-red-400'} opacity-80`} />
                    </div>
                </div>

                <div className="glass-card p-4 rounded-lg">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-xs text-silver-dark uppercase tracking-wider font-semibold">Overall Margin</p>
                            <p className={`text-xl font-bold mt-1 ${parseFloat(overallMargin) >= 0 ? 'text-blue-400' : 'text-red-400'}`}>
                                {overallMargin}%
                            </p>
                        </div>
                        {parseFloat(overallMargin) >= 10 ? (
                            <CheckCircle className="w-8 h-8 text-emerald-400 opacity-80" />
                        ) : parseFloat(overallMargin) >= 0 ? (
                            <AlertTriangle className="w-8 h-8 text-yellow-400 opacity-80" />
                        ) : (
                            <AlertTriangle className="w-8 h-8 text-red-400 opacity-80" />
                        )}
                    </div>
                </div>
            </div>

            {/* Filters */}
            <div className="flex flex-col md:flex-row gap-4">
                {/* Search */}
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-silver-dark" />
                    <input
                        type="text"
                        placeholder="Search Job Number, Customer, atau SO Number..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-9 pr-4 py-1.5 text-sm bg-dark-surface border border-dark-border rounded-lg text-silver-light focus:outline-none focus:border-accent-orange"
                    />
                </div>

                {/* Status Filter */}
                <div className="flex items-center gap-2">
                    <Filter className="w-4 h-4 text-silver-dark" />
                    <select
                        value={filterStatus}
                        onChange={(e) => setFilterStatus(e.target.value)}
                        className="px-3 py-1.5 text-sm bg-dark-surface border border-dark-border rounded-lg text-silver-light focus:outline-none focus:border-accent-orange"
                    >
                        <option value="all">Semua Status</option>
                        <option value="profit">Profit</option>
                        <option value="loss">Loss</option>
                        <option value="break-even">Break Even</option>
                    </select>
                </div>
            </div>

            {/* Comparison Table */}
            <div className="glass-card rounded-lg overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full whitespace-nowrap">
                        <thead className="bg-accent-orange">
                            <tr>
                                <th className="px-4 py-2 text-left text-[10px] font-bold text-white uppercase tracking-wider">Job Number</th>
                                <th className="px-4 py-2 text-left text-[10px] font-bold text-white uppercase tracking-wider">Customer</th>
                                <th className="px-4 py-2 text-left text-[10px] font-bold text-white uppercase tracking-wider">Route</th>
                                <th className="px-4 py-2 text-center text-[10px] font-bold text-white uppercase tracking-wider">Service</th>
                                <th className="px-4 py-2 text-right text-[10px] font-bold text-white uppercase tracking-wider">Selling</th>
                                <th className="px-4 py-2 text-right text-[10px] font-bold text-white uppercase tracking-wider">Buying</th>
                                <th className="px-4 py-2 text-right text-[10px] font-bold text-white uppercase tracking-wider">Profit</th>
                                <th className="px-4 py-2 text-center text-[10px] font-bold text-white uppercase tracking-wider">Margin</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-dark-border">
                            {filteredShipments.length === 0 ? (
                                <tr>
                                    <td colSpan="8" className="px-4 py-8 text-center">
                                        <Package className="w-8 h-8 text-silver-dark mx-auto mb-2" />
                                        <p className="text-xs text-silver-dark">
                                            {searchTerm || filterStatus !== 'all'
                                                ? 'Tidak ada data yang cocok dengan filter'
                                                : 'Belum ada data shipment dengan COGS'
                                            }
                                        </p>
                                    </td>
                                </tr>
                            ) : (
                                filteredShipments.map((shipment) => {
                                    const ServiceIcon = getServiceIcon(shipment.serviceType);
                                    const isProfit = shipment.profit >= 0;
                                    const isLowMargin = shipment.margin > 0 && shipment.margin < 10;
                                    const currencySymbol = shipment.currency === 'IDR' ? 'Rp' : '$';

                                    return (
                                        <tr
                                            key={shipment.id}
                                            className="hover:bg-dark-surface smooth-transition cursor-pointer group"
                                            onClick={() => handleViewDetail(shipment)}
                                        >
                                            <td className="px-4 py-2 text-xs">
                                                <div className="flex items-center gap-2">
                                                    <span className="font-medium text-accent-orange hover:underline">{shipment.jobNumber}</span>
                                                    {shipment.soNumber && (
                                                        <>
                                                            <span className="text-gray-400">•</span>
                                                            <span className="text-silver-dark font-mono">{shipment.soNumber}</span>
                                                        </>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-4 py-2 text-xs text-silver-light font-medium">{shipment.customer}</td>
                                            <td className="px-4 py-2 text-xs">
                                                <span className="text-silver-light">
                                                    {shipment.origin} <span className="text-gray-500">→</span> {shipment.destination}
                                                </span>
                                            </td>
                                            <td className="px-4 py-2 text-center">
                                                <ServiceIcon className="w-4 h-4 text-silver-dark mx-auto group-hover:text-accent-orange transition-colors" />
                                            </td>
                                            <td className="px-4 py-2 text-right text-xs">
                                                <span className="font-medium text-green-400 font-mono">
                                                    {currencySymbol} {shipment.quotedAmount.toLocaleString('id-ID')}
                                                </span>
                                            </td>
                                            <td className="px-4 py-2 text-right text-xs">
                                                <span className="font-medium text-orange-400 font-mono">
                                                    {currencySymbol} {shipment.totalCOGS.toLocaleString('id-ID')}
                                                </span>
                                            </td>
                                            <td className="px-4 py-2 text-right text-xs">
                                                <span className={`font-bold font-mono ${isProfit ? 'text-emerald-400' : 'text-red-400'}`}>
                                                    {currencySymbol} {shipment.profit.toLocaleString('id-ID')}
                                                </span>
                                            </td>
                                            <td className="px-4 py-2 text-center text-xs">
                                                <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${shipment.profit < 0 ? 'bg-red-500/10 text-red-400 border-red-500/20' :
                                                    isLowMargin ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' :
                                                        'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                                    }`}>
                                                    {shipment.margin}%
                                                </span>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                        {filteredShipments.length > 0 && (
                            <tfoot className="bg-dark-surface border-t-2 border-accent-orange">
                                <tr>
                                    <td colSpan="4" className="px-4 py-2 text-right font-bold text-xs text-silver-light uppercase tracking-wider">
                                        TOTAL ({filteredShipments.length} Shipments)
                                    </td>
                                    <td className="px-4 py-2 text-right font-bold text-xs text-green-400 font-mono">
                                        Rp {totals.selling.toLocaleString('id-ID')}
                                    </td>
                                    <td className="px-4 py-2 text-right font-bold text-xs text-orange-400 font-mono">
                                        Rp {totals.buying.toLocaleString('id-ID')}
                                    </td>
                                    <td className="px-4 py-2 text-right font-bold text-xs font-mono">
                                        <span className={totals.profit >= 0 ? 'text-emerald-400' : 'text-red-400'}>
                                            Rp {totals.profit.toLocaleString('id-ID')}
                                        </span>
                                    </td>
                                    <td className="px-4 py-2 text-center font-bold text-xs">
                                        <span className={parseFloat(overallMargin) >= 0 ? 'text-blue-400' : 'text-red-400'}>
                                            {overallMargin}%
                                        </span>
                                    </td>
                                </tr>
                            </tfoot>
                        )}
                    </table>
                </div>
            </div>

            {/* Shared Detail Modal */}
            <SellingBuyingDetailModal
                isOpen={!!selectedShipment}
                onClose={handleBackToList}
                shipment={selectedShipment}
            />
        </div>
    );
};

export default SellingVsBuying;

