import React from 'react';
import { useData } from '../../context/DataContext';

const BridgeOverview = () => {
    const {
        quotations = [],
        warehouseInventory = [],
        inboundTransactions = [],
        outboundTransactions = [],
        goodsMovements = []
    } = useData();

    // Calculate statistics based on real data
    const pengajuanMasuk = (quotations || []).filter(q => q?.type === 'inbound').length;
    const pengajuanKeluar = (quotations || []).filter(q => q?.type === 'outbound').length;

    // Items in warehouse - count from warehouse_inventory table
    const itemsInWarehouse = (warehouseInventory || []).length;

    // Items in exhibition/fair - count items from goods_movements with destination 'pameran'
    // Get latest movement for each item to determine current location
    const itemLocations = {};
    (goodsMovements || []).forEach(movement => {
        const itemKey = `${movement?.itemCode || movement?.assetName}-${movement?.serialNumber}`;
        if (!itemLocations[itemKey] || new Date(movement?.date) > new Date(itemLocations[itemKey]?.date)) {
            itemLocations[itemKey] = movement;
        }
    });
    const itemsInFair = Object.values(itemLocations).filter(m =>
        m?.destination === 'pameran' || m?.position === 'pameran'
    ).length;

    // Total inbound items - flatten and count all items from inbound transactions
    const totalInboundItems = (inboundTransactions || []).reduce((total, transaction) => {
        if (transaction?.items && transaction?.items?.length > 0) {
            return total + transaction.items.length;
        }
        return total + 1; // If no items array, count the transaction itself as 1 item
    }, 0);

    // Total outbound items - flatten and count all items from outbound transactions
    const totalOutboundItems = (outboundTransactions || []).reduce((total, transaction) => {
        if (transaction?.items && transaction?.items?.length > 0) {
            return total + transaction.items.length;
        }
        return total + 1; // If no items array, count the transaction itself as 1 item
    }, 0);

    const stats = [
        {
            title: 'Pengajuan Masuk',
            value: pengajuanMasuk
        },
        {
            title: 'Pengajuan Keluar',
            value: pengajuanKeluar
        },
        {
            title: 'Barang di Warehouse',
            value: itemsInWarehouse
        },
        {
            title: 'Barang di Pameran',
            value: itemsInFair
        },
        {
            title: 'Barang Masuk',
            value: totalInboundItems
        },
        {
            title: 'Barang Keluar',
            value: totalOutboundItems
        }
    ];

    return (
        <div className="p-6 space-y-6">
            {/* Header */}
            <div className="mb-6">
                <h1 className="text-4xl font-bold gradient-text mb-2">Bridge Overview</h1>
                <p className="text-silver-dark">
                    Ringkasan data pengajuan dan inventori barang TPPB
                </p>
            </div>

            {/* Statistics Grid - 6 columns in 1 row */}
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
                {stats.map((stat, index) => (
                    <div
                        key={index}
                        className="glass-card p-4 rounded-lg hover:scale-105 smooth-transition h-full flex flex-col justify-center min-w-0" // min-w-0 penting untuk grid item agar text-ellipsis bekerja
                    >
                        <div className="flex flex-col items-center text-center">
                            <p className="text-xs font-medium text-silver-dark mb-1 whitespace-nowrap w-full overflow-hidden text-ellipsis">
                                {stat.title}
                            </p>
                            <h3 className="text-2xl font-bold text-silver-light">
                                {stat.value.toLocaleString('id-ID')}
                            </h3>
                        </div>
                    </div>
                ))}
            </div>

            {/* Quick Info */}
            <div className="glass-card p-6 rounded-lg mt-8">
                <h3 className="text-lg font-semibold text-silver-light mb-4">
                    📊 Informasi Tambahan
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-4 bg-dark-surface/50 rounded-lg">
                        <p className="text-sm text-silver-dark mb-1">Net Movement</p>
                        <p className="text-xl font-bold text-silver-light">
                            {(totalInboundItems - totalOutboundItems).toLocaleString('id-ID')} items
                        </p>
                        <p className="text-xs text-silver-dark mt-1">
                            Selisih barang masuk dan keluar
                        </p>
                    </div>
                    <div className="p-4 bg-dark-surface/50 rounded-lg">
                        <p className="text-sm text-silver-dark mb-1">Occupancy Rate</p>
                        <p className="text-xl font-bold text-silver-light">
                            {totalInboundItems > 0
                                ? ((itemsInWarehouse / totalInboundItems) * 100).toFixed(1)
                                : 0}%
                        </p>
                        <p className="text-xs text-silver-dark mt-1">
                            Persentase barang di warehouse
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default BridgeOverview;
