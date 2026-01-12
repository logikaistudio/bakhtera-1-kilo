import XLSX from 'xlsx-js-style';

/**
 * Export BL Certificate to Excel dengan format sesuai certificate form
 * @param {Object} blData - Data BL dengan service items
 * @param {Object} customerData - Data customer (Bill To & Consignee)
 */
export const exportBLCertificateToExcel = (blData, customerData = {}) => {
    // Create workbook
    const wb = XLSX.utils.book_new();

    // Prepare data array untuk Excel
    const data = [];

    // Header - Company Info
    data.push(['BAKHTERA FREIGHT FORWARDER']);
    data.push(['CERTIFICATE']);
    data.push([]);

    // Job Number & BL Info
    data.push(['Job Number:', blData.jobNumber || 'N/A', '', '', 'Date:', new Date().toLocaleDateString('id-ID')]);
    data.push(['BL Number:', blData.blNumber]);
    data.push(['Shipment:', blData.shipmentNumber]);
    data.push([]);

    // Customer Info (auto-populated dari blData)
    data.push(['BILL TO:', customerData?.billTo || blData.customer || 'Customer Name']);
    data.push(['Address:', customerData?.billToAddress || blData.customerAddress || 'Customer Address']);
    data.push([]);

    const consignee = customerData?.consignee || blData.consignee;
    if (consignee) {
        data.push(['CONSIGNEE:', consignee]);
        data.push(['Address:', customerData?.consigneeAddress || blData.consigneeAddress || '']);
        data.push([]);
    }

    // Shipping Details
    data.push(['Shipping Line:', blData.shippingLine]);
    data.push(['Vessel/Voyage:', blData.vesselVoyage]);
    data.push(['Port of Loading:', blData.origin]);
    data.push(['Port of Discharge:', blData.destination]);

    if (blData.containerNumber) {
        data.push(['Container No:', blData.containerNumber]);
        data.push(['Container Type:', blData.containerType]);
    }

    if (blData.sealNumber) {
        data.push(['Seal No:', blData.sealNumber]);
    }

    if (blData.measurement) {
        data.push(['Measurement:', blData.measurement]);
    }

    if (blData.grossWeight) {
        data.push(['Gross Weight:', blData.grossWeight]);
    }

    data.push([]);
    data.push([]);

    // Service Items Table Header
    data.push([
        'Description',
        'Qty',
        'Unit',
        'Selling',
        'Unit Price Selling',
        'Buying (COGS)',
        'Unit Price Buying',
        'Profit',
        'Margin %'
    ]);

    // Service Items
    let totalSelling = 0;
    let totalBuying = 0;
    let totalProfit = 0;

    blData.serviceItems.forEach(item => {
        data.push([
            item.description,
            item.qty,
            item.unit,
            item.sellingTotal,
            item.sellingRate,
            item.buyingTotal,
            item.buyingRate,
            item.profit,
            item.margin.toFixed(2) + '%'
        ]);

        totalSelling += item.sellingTotal;
        totalBuying += item.buyingTotal;
        totalProfit += item.profit;
    });

    // Grand Total Row
    data.push([]);
    const avgMargin = totalSelling > 0 ? ((totalProfit / totalSelling) * 100).toFixed(2) : 0;
    data.push([
        'GRAND TOTAL',
        '',
        '',
        totalSelling,
        '',
        totalBuying,
        '',
        totalProfit,
        avgMargin + '%'
    ]);

    data.push([]);
    data.push([]);

    // Footer
    data.push(['Currency:', blData.currency || 'USD']);
    data.push([]);
    data.push(['Approved By:', '', '', '', 'Director']);
    data.push([]);
    data.push(['Date:', new Date().toLocaleDateString('id-ID')]);

    // Create worksheet
    const ws = XLSX.utils.aoa_to_sheet(data);

    // Set column widths
    ws['!cols'] = [
        { wch: 25 }, // Description
        { wch: 8 },  // Qty
        { wch: 12 }, // Unit
        { wch: 15 }, // Selling
        { wch: 15 }, // Unit Price Selling
        { wch: 15 }, // Buying
        { wch: 15 }, // Unit Price Buying
        { wch: 15 }, // Profit
        { wch: 12 }  // Margin
    ];

    // Add worksheet to workbook
    XLSX.utils.book_append_sheet(wb, ws, 'Certificate');

    // Generate filename
    const filename = `Certificate_${blData.blNumber}_${new Date().toISOString().slice(0, 10)}.xlsx`;

    // Download file
    XLSX.writeFile(wb, filename);

    return filename;
};

/**
 * Export AWB Certificate to Excel
 * @param {Object} awbData - Data AWB dengan service items (jika ada breakdown)
 * @param {Object} customerData - Data customer
 */
export const exportAWBCertificateToExcel = (awbData, customerData = {}) => {
    const wb = XLSX.utils.book_new();
    const data = [];

    // Header
    data.push(['BAKHTERA FREIGHT FORWARDER']);
    data.push(['AIR WAYBILL CERTIFICATE']);
    data.push([]);

    // AWB Info
    data.push(['AWB Number:', awbData.awbNumber, '', '', 'Date:', new Date().toLocaleDateString('id-ID')]);
    data.push(['Type:', awbData.awbType]);
    if (awbData.masterAWB) {
        data.push(['Master AWB:', awbData.masterAWB]);
    }
    data.push(['Shipment:', awbData.shipmentNumber]);
    data.push([]);

    // Customer Info
    data.push(['BILL TO:', customerData.billTo || 'Customer Name']);
    data.push([]);

    // Flight Details
    data.push(['Airline:', awbData.airline]);
    data.push(['Flight Number:', awbData.flightNumber]);
    data.push(['Origin:', awbData.origin]);
    data.push(['Destination:', awbData.destination]);
    data.push(['Pieces:', awbData.pieces]);
    data.push(['Chargeable Weight:', awbData.chargeableWeight + ' kg']);
    data.push([]);
    data.push([]);

    // If has service breakdown
    if (awbData.serviceItems && awbData.serviceItems.length > 0) {
        // Service Items Table
        data.push([
            'Description',
            'Qty',
            'Unit',
            'Selling',
            'Rate Selling',
            'Buying',
            'Rate Buying',
            'Profit',
            'Margin %'
        ]);

        awbData.serviceItems.forEach(item => {
            data.push([
                item.description,
                item.qty,
                item.unit,
                item.sellingTotal,
                item.sellingRate,
                item.buyingTotal,
                item.buyingRate,
                item.profit,
                item.margin.toFixed(2) + '%'
            ]);
        });

        data.push([]);
        data.push([
            'GRAND TOTAL',
            '',
            '',
            awbData.grandTotal.selling,
            '',
            awbData.grandTotal.buying,
            '',
            awbData.grandTotal.profit,
            awbData.grandTotal.margin.toFixed(2) + '%'
        ]);
    } else {
        // Simple selling/buying summary
        data.push(['CHARGES SUMMARY']);
        data.push([]);
        data.push(['Selling Rate per kg:', awbData.sellingRate]);
        data.push(['Total Selling:', awbData.sellingTotal]);
        data.push([]);
        data.push(['Buying Rate per kg:', awbData.buyingRate]);
        data.push(['Total Buying:', awbData.buyingTotal]);
        data.push([]);
        data.push(['Gross Profit:', awbData.profit]);
        data.push(['Profit Margin:', awbData.margin.toFixed(2) + '%']);
    }

    data.push([]);
    data.push([]);
    data.push(['Currency:', awbData.currency || 'IDR']);
    data.push([]);
    data.push(['Approved By:', '', '', '', 'Director']);
    data.push([]);
    data.push(['Date:', new Date().toLocaleDateString('id-ID')]);

    const ws = XLSX.utils.aoa_to_sheet(data);

    ws['!cols'] = [
        { wch: 25 },
        { wch: 8 },
        { wch: 12 },
        { wch: 15 },
        { wch: 15 },
        { wch: 15 },
        { wch: 15 },
        { wch: 15 },
        { wch: 12 }
    ];

    XLSX.utils.book_append_sheet(wb, ws, 'AWB Certificate');

    const filename = `AWB_Certificate_${awbData.awbNumber}_${new Date().toISOString().slice(0, 10)}.xlsx`;
    XLSX.writeFile(wb, filename);

    return filename;
};

/**
 * Export Selling/Buying Comparison Report untuk multiple shipments
 * @param {Array} shipments - Array of shipments (BL atau AWB)
 * @param {String} type - 'BL' or 'AWB'
 */
export const exportSellingBuyingReport = (shipments, type = 'BL') => {
    const wb = XLSX.utils.book_new();
    const data = [];

    // Header
    data.push([`SELLING vs BUYING COMPARISON REPORT - ${type}`]);
    data.push(['Generated:', new Date().toLocaleString('id-ID')]);
    data.push([]);

    // Table Header
    data.push([
        `${type} Number`,
        'Customer',
        'Route',
        'Total Selling',
        'Total Buying',
        'Gross Profit',
        'Margin %',
        'Status'
    ]);

    // Data rows
    let totalSelling = 0;
    let totalBuying = 0;
    let totalProfit = 0;

    shipments.forEach(ship => {
        const selling = ship.grandTotal?.selling || ship.sellingTotal || 0;
        const buying = ship.grandTotal?.buying || ship.buyingTotal || 0;
        const profit = ship.grandTotal?.profit || ship.profit || 0;
        const margin = ship.grandTotal?.margin || ship.margin || 0;

        data.push([
            ship.blNumber || ship.awbNumber,
            ship.customer || '',
            `${ship.origin} → ${ship.destination}`,
            selling,
            buying,
            profit,
            margin.toFixed(2) + '%',
            ship.status
        ]);

        totalSelling += selling;
        totalBuying += buying;
        totalProfit += profit;
    });

    // Total row
    data.push([]);
    const avgMargin = totalSelling > 0 ? ((totalProfit / totalSelling) * 100).toFixed(2) : 0;
    data.push([
        'GRAND TOTAL',
        '',
        '',
        totalSelling,
        totalBuying,
        totalProfit,
        avgMargin + '%',
        ''
    ]);

    const ws = XLSX.utils.aoa_to_sheet(data);

    ws['!cols'] = [
        { wch: 18 },
        { wch: 25 },
        { wch: 20 },
        { wch: 15 },
        { wch: 15 },
        { wch: 15 },
        { wch: 12 },
        { wch: 12 }
    ];

    XLSX.utils.book_append_sheet(wb, ws, 'Comparison Report');

    const filename = `Selling_Buying_Report_${type}_${new Date().toISOString().slice(0, 10)}.xlsx`;
    XLSX.writeFile(wb, filename);

    return filename;
};
