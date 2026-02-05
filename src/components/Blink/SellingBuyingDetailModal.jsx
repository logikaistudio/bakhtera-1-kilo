import React, { useMemo } from 'react';
import { X, TrendingUp, TrendingDown, AlertTriangle, CheckCircle, DollarSign, Download } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const SellingBuyingDetailModal = ({ isOpen, onClose, shipment }) => {
    if (!isOpen || !shipment) return null;

    // Smart Mapping Logic
    const comparisonData = useMemo(() => {
        const categories = {
            freight: { label: 'Freight (Ocean/Air)', selling: [], buying: [], totalS: 0, totalB: 0 },
            trucking: { label: 'Trucking & Local', selling: [], buying: [], totalS: 0, totalB: 0 },
            terminal: { label: 'Terminal & Handling', selling: [], buying: [], totalS: 0, totalB: 0 },
            doc: { label: 'Document & Customs', selling: [], buying: [], totalS: 0, totalB: 0 },
            insurance: { label: 'Insurance', selling: [], buying: [], totalS: 0, totalB: 0 },
            others: { label: 'Others', selling: [], buying: [], totalS: 0, totalB: 0 }
        };

        const categorizeSellingItem = (item) => {
            const name = (item.name || item.description || '').toLowerCase();
            if (name.includes('freight') || name.includes('shipping') || name.includes('ocean') || name.includes('air')) return 'freight';
            if (name.includes('truck') || name.includes('pickup') || name.includes('delivery') || name.includes('land')) return 'trucking';
            if (name.includes('thc') || name.includes('terminal') || name.includes('handling') || name.includes('lift')) return 'terminal';
            if (name.includes('doc') || name.includes('custom') || name.includes('peb') || name.includes('pib') || name.includes('admin')) return 'doc';
            if (name.includes('insurance') || name.includes('asuransi')) return 'insurance';
            return 'others';
        };

        // Process Selling Items
        const sellingItems = shipment.sellingItems || shipment.service_items || [];
        sellingItems.forEach(item => {
            const cat = categorizeSellingItem(item);
            const amount = parseFloat(item.total || item.amount || 0);
            categories[cat].selling.push({ name: item.name || item.description, amount });
            categories[cat].totalS += amount;
        });

        // Process Buying Fields (COGS)
        const cogs = shipment.cogs || shipment.cogsData || {};

        const addBuying = (cat, name, amount) => {
            if (amount > 0) {
                categories[cat].buying.push({ name, amount });
                categories[cat].totalB += amount;
            }
        };

        addBuying('freight', 'Ocean Freight', parseFloat(cogs.oceanFreight || 0));
        addBuying('freight', 'Air Freight', parseFloat(cogs.airFreight || 0));
        addBuying('trucking', 'Trucking', parseFloat(cogs.trucking || 0));
        addBuying('terminal', 'THC', parseFloat(cogs.thc || 0));
        addBuying('doc', 'Documentation', parseFloat(cogs.documentation || 0));
        addBuying('doc', 'Customs', parseFloat(cogs.customs || 0));
        addBuying('insurance', 'Insurance', parseFloat(cogs.insurance || 0));
        addBuying('others', 'Demurrage', parseFloat(cogs.demurrage || 0));
        addBuying('others', cogs.otherDescription || 'Other', parseFloat(cogs.other || 0));

        // Buying Items (Additional)
        const buyingItems = shipment.buyingItems || [];
        buyingItems.forEach(item => {
            const cat = categorizeSellingItem(item);
            const amount = parseFloat(item.amount || 0);
            categories[cat].buying.push({ name: item.description, amount });
            categories[cat].totalB += amount;
        });

        // Calculate Totals
        let grandTotalS = 0;
        let grandTotalB = 0;
        Object.values(categories).forEach(c => {
            // Sort items for apple-to-apple alignment
            c.selling.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
            c.buying.sort((a, b) => (a.name || '').localeCompare(b.name || ''));

            grandTotalS += c.totalS;
            grandTotalB += c.totalB;
        });

        return { categories, grandTotalS, grandTotalB };
    }, [shipment]);

    const currency = shipment.currency === 'IDR' ? 'Rp' : '$';
    const profit = comparisonData.grandTotalS - comparisonData.grandTotalB;
    const margin = comparisonData.grandTotalS > 0 ? ((profit / comparisonData.grandTotalS) * 100).toFixed(1) : 0;
    const isHealthy = margin >= 10;
    const isLoss = profit < 0;

    const handleExportPDF = () => {
        const doc = new jsPDF('l', 'mm', 'a4');
        const pageWidth = doc.internal.pageSize.width;

        // Header
        doc.setFontSize(14);
        doc.setFont("helvetica", "bold");
        doc.text(`Profit Analysis: ${shipment.jobNumber}`, 14, 15);

        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(100);
        doc.text(`${shipment.customer || 'Unknown Customer'} • ${shipment.origin || 'Origin'} -> ${shipment.destination || 'Destination'}`, 14, 21);

        // Cards Section - Draw rectangles and text
        const cardTop = 30;
        const cardHeight = 25;
        const cardWidth = (pageWidth - 28 - 15) / 4; // 14 margin left/right, 5 gap * 3 ? 
        // Let's use simple spacing
        const gap = 5;
        const startX = 14;

        const drawCard = (x, title, value, colorObj) => {
            doc.setDrawColor(220, 220, 220);
            doc.setFillColor(colorObj.bg);
            doc.roundedRect(x, cardTop, cardWidth, cardHeight, 3, 3, 'FD');

            doc.setFontSize(7);
            doc.setTextColor(100);
            doc.text(title.toUpperCase(), x + 4, cardTop + 6);

            doc.setFontSize(12);
            doc.setTextColor(colorObj.text);
            doc.setFont("helvetica", "bold");
            doc.text(value, x + 4, cardTop + 18);
        };

        // Margin Card
        drawCard(startX, "Margin", `${margin}%`, {
            bg: isLoss ? '#fef2f2' : isHealthy ? '#ecfdf5' : '#fefce8',
            text: isLoss ? '#b91c1c' : isHealthy ? '#047857' : '#a16207'
        });

        // Profit Card
        drawCard(startX + cardWidth + gap, "Profit", `${currency} ${profit.toLocaleString('id-ID')}`, { bg: '#ffffff', text: isLoss ? '#dc2626' : '#1f2937' });

        // Selling Card
        drawCard(startX + (cardWidth + gap) * 2, "Selling", `${currency} ${comparisonData.grandTotalS.toLocaleString('id-ID')}`, { bg: '#ffffff', text: '#1f2937' });

        // Buying Card
        drawCard(startX + (cardWidth + gap) * 3, "Buying", `${currency} ${comparisonData.grandTotalB.toLocaleString('id-ID')}`, { bg: '#ffffff', text: '#1f2937' });

        // Table Data Prep
        const tableBody = [];

        Object.values(comparisonData.categories).forEach(cat => {
            if (cat.selling.length === 0 && cat.buying.length === 0) return;

            const maxRows = Math.max(cat.selling.length, cat.buying.length);

            // Header for Category
            // We can treat the category label as a spanning row or just the first column

            for (let i = 0; i < maxRows; i++) {
                const sItem = cat.selling[i];
                const bItem = cat.buying[i];

                tableBody.push([
                    i === 0 ? cat.label : '',
                    sItem ? sItem.name : '',
                    sItem ? sItem.amount.toLocaleString('id-ID') : '',
                    bItem ? bItem.name : '',
                    bItem ? bItem.amount.toLocaleString('id-ID') : ''
                ]);
            }

            // Subtotal Row
            if (maxRows > 0) {
                tableBody.push([
                    { content: '', styles: { cellPadding: 1 } },
                    { content: '', styles: { cellPadding: 1 } },
                    { content: cat.totalS.toLocaleString('id-ID'), styles: { fontStyle: 'bold', textColor: [22, 163, 74], halign: 'right', fontSize: 7 } },
                    { content: '', styles: { cellPadding: 1 } },
                    { content: cat.totalB.toLocaleString('id-ID'), styles: { fontStyle: 'bold', textColor: [234, 88, 12], halign: 'right', fontSize: 7 } }
                ]);
                // Add a spacer/border row implied by autoTable themes/grid
            }
        });

        autoTable(doc, {
            startY: 65,
            head: [['CATEGORY', 'SELLING ITEMS', 'AMOUNT (S)', 'BUYING ITEMS', 'AMOUNT (B)']],
            body: tableBody,
            theme: 'grid',
            headStyles: { fillColor: [249, 250, 251], textColor: [100, 100, 100], fontSize: 8, fontStyle: 'bold' },
            bodyStyles: { fontSize: 7, textColor: [50, 50, 50] },
            columnStyles: {
                0: { fontStyle: 'bold', cellWidth: 40 },
                1: { cellWidth: 80 },
                2: { halign: 'right', fontStyle: 'bold', textColor: [22, 163, 74] },
                3: { cellWidth: 80 },
                4: { halign: 'right', fontStyle: 'bold', textColor: [234, 88, 12] }
            },
            alternateRowStyles: { fillColor: [255, 255, 255] },
        });

        doc.save(`Profit_Analysis_${shipment.jobNumber}.pdf`);
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in font-sans">
            <div className="bg-white dark:bg-dark-card border border-gray-200 dark:border-dark-border rounded-xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
                {/* Header Clean */}
                <div className="px-6 py-4 border-b border-gray-100 dark:border-dark-border flex justify-between items-center bg-white dark:bg-dark-surface">
                    <div className="flex items-center gap-3">
                        <TrendingUp className="w-5 h-5 text-accent-orange" />
                        <div>
                            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                                Profit Analysis: {shipment.jobNumber}
                            </h2>
                            <p className="text-xs text-gray-500 dark:text-silver-dark mt-0.5">
                                {shipment.customer || 'Unknown Customer'} • {shipment.origin || 'Origin'} → {shipment.destination || 'Destination'}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={handleExportPDF}
                            className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-white/5 dark:hover:bg-white/10 text-gray-700 dark:text-gray-200 rounded-lg text-xs font-medium transition-colors"
                        >
                            <Download className="w-4 h-4" />
                            Export PDF
                        </button>
                        <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-white/10 rounded-full transition-colors text-gray-400 hover:text-gray-600 dark:text-silver-dark dark:hover:text-white">
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Content Scrollable */}
                <div className="flex-1 overflow-y-auto p-6 bg-white dark:bg-dark-bg">
                    {/* Summary Cards */}
                    <div className="grid grid-cols-4 gap-4 mb-8">
                        {/* Margin Card (Featured) */}
                        <div className={`p-4 rounded-xl border flex items-center justify-between ${isLoss ? 'bg-red-50 border-red-200 dark:bg-red-500/10 dark:border-red-500/30' :
                            isHealthy ? 'bg-emerald-50 border-emerald-200 dark:bg-emerald-500/10 dark:border-emerald-500/30' :
                                'bg-yellow-50 border-yellow-200 dark:bg-yellow-500/10 dark:border-yellow-500/30'
                            }`}>
                            <div>
                                <p className="text-[10px] uppercase font-semibold tracking-wider mb-1 text-gray-500 dark:text-silver-dark opacity-80">Margin</p>
                                <p className={`text-3xl font-bold ${isLoss ? 'text-red-700 dark:text-red-400' :
                                    isHealthy ? 'text-emerald-700 dark:text-emerald-400' :
                                        'text-yellow-700 dark:text-yellow-400'
                                    }`}>
                                    {margin}%
                                </p>
                            </div>
                            {isLoss ? <AlertTriangle className="w-8 h-8 text-red-500/50" /> :
                                isHealthy ? <CheckCircle className="w-8 h-8 text-emerald-500/50" /> :
                                    <AlertTriangle className="w-8 h-8 text-yellow-500/50" />}
                        </div>

                        {/* Profit Card */}
                        <div className="bg-white dark:bg-dark-card border border-gray-200 dark:border-dark-border p-4 rounded-xl shadow-sm">
                            <p className="text-[10px] uppercase text-gray-500 dark:text-silver-dark font-semibold tracking-wider mb-2">Profit</p>
                            <p className={`text-2xl font-bold ${isLoss ? 'text-red-600 dark:text-red-400' : 'text-gray-800 dark:text-white'}`}>
                                {currency} {profit.toLocaleString('id-ID')}
                            </p>
                        </div>

                        {/* Selling Card */}
                        <div className="bg-white dark:bg-dark-card border border-gray-200 dark:border-dark-border p-4 rounded-xl shadow-sm">
                            <p className="text-[10px] uppercase text-gray-500 dark:text-silver-dark font-semibold tracking-wider mb-2">Selling</p>
                            <p className="text-2xl font-bold text-gray-800 dark:text-white">
                                {currency} {comparisonData.grandTotalS.toLocaleString('id-ID')}
                            </p>
                        </div>

                        {/* Buying Card */}
                        <div className="bg-white dark:bg-dark-card border border-gray-200 dark:border-dark-border p-4 rounded-xl shadow-sm">
                            <p className="text-[10px] uppercase text-gray-500 dark:text-silver-dark font-semibold tracking-wider mb-2">Buying</p>
                            <p className="text-2xl font-bold text-gray-800 dark:text-white">
                                {currency} {comparisonData.grandTotalB.toLocaleString('id-ID')}
                            </p>
                        </div>
                    </div>

                    {/* Apple-to-Apple Comparison Table */}
                    <div className="border border-gray-100 dark:border-dark-border rounded-xl local-table-shadow overflow-hidden">
                        <div className="grid grid-cols-12 bg-gray-50 dark:bg-dark-card py-3 px-6 border-b border-gray-100 dark:border-dark-border text-xs font-bold text-gray-500 dark:text-silver-dark uppercase tracking-wider">
                            <div className="col-span-2">Category</div>
                            <div className="col-span-5 border-r border-gray-200 dark:border-dark-border/50 pr-4">Selling Items</div>
                            <div className="col-span-5 pl-4">Buying Items (COGS)</div>
                        </div>

                        <div className="bg-white dark:bg-dark-surface">
                            {Object.entries(comparisonData.categories).map(([key, cat]) => {
                                if (cat.selling.length === 0 && cat.buying.length === 0) return null;

                                const maxRows = Math.max(cat.selling.length, cat.buying.length);

                                return (
                                    <div key={key} className="group border-b border-gray-50 dark:border-dark-border/30 last:border-0 hover:bg-gray-50/50 dark:hover:bg-white/5 transition-colors">
                                        <div className="grid grid-cols-12 py-4 px-6 min-h-[70px]">
                                            {/* Category Label */}
                                            <div className="col-span-2 flex items-start pt-1">
                                                <span className="text-xs font-semibold text-gray-600 dark:text-silver-light bg-gray-100 dark:bg-white/10 px-3 py-1.5 rounded-md">
                                                    {cat.label}
                                                </span>
                                            </div>

                                            {/* Items Container - Aligned Rows */}
                                            <div className="col-span-10 grid grid-cols-2">
                                                {Array.from({ length: maxRows }).map((_, idx) => {
                                                    const sItem = cat.selling[idx];
                                                    const bItem = cat.buying[idx];

                                                    return (
                                                        <React.Fragment key={idx}>
                                                            {/* Selling Item */}
                                                            <div className={`col-span-1 border-r border-gray-100 dark:border-dark-border/30 pr-4 flex justify-between items-baseline text-xs ${idx > 0 ? 'mt-3' : ''}`}>
                                                                {sItem ? (
                                                                    <>
                                                                        <span className="text-gray-700 dark:text-silver-light font-medium truncate mr-4 tracking-wide">{sItem.name}</span>
                                                                        <span className="text-green-600 dark:text-green-400 font-bold font-mono whitespace-nowrap">
                                                                            {sItem.amount.toLocaleString('id-ID')}
                                                                        </span>
                                                                    </>
                                                                ) : <span className="text-gray-300 dark:text-silver-dark/30 italic">-</span>}
                                                            </div>

                                                            {/* Buying Item */}
                                                            <div className={`col-span-1 pl-4 flex justify-between items-baseline text-xs ${idx > 0 ? 'mt-3' : ''}`}>
                                                                {bItem ? (
                                                                    <>
                                                                        <span className="text-gray-700 dark:text-silver-light font-medium truncate mr-4 tracking-wide">{bItem.name}</span>
                                                                        <span className="text-orange-600 dark:text-orange-400 font-bold font-mono whitespace-nowrap">
                                                                            {bItem.amount.toLocaleString('id-ID')}
                                                                        </span>
                                                                    </>
                                                                ) : <span className="text-gray-300 dark:text-silver-dark/30 italic">-</span>}
                                                            </div>
                                                        </React.Fragment>
                                                    );
                                                })}

                                                {/* Subtotals */}
                                                {(cat.selling.length > 0 || cat.buying.length > 0) && (
                                                    <React.Fragment>
                                                        <div className="col-span-1 border-r border-gray-100 dark:border-dark-border/30 pr-4 pt-3 mt-1 border-t border-gray-100 dark:border-dark-border/30 flex justify-end">
                                                            <span className="text-[10px] text-green-600/60 dark:text-green-500/60 font-bold">
                                                                {cat.totalS.toLocaleString('id-ID')}
                                                            </span>
                                                        </div>
                                                        <div className="col-span-1 pl-4 pt-3 mt-1 border-t border-gray-100 dark:border-dark-border/30 flex justify-end">
                                                            <span className="text-[10px] text-orange-600/60 dark:text-orange-500/60 font-bold">
                                                                {cat.totalB.toLocaleString('id-ID')}
                                                            </span>
                                                        </div>
                                                    </React.Fragment>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SellingBuyingDetailModal;
