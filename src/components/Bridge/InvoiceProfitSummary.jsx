import React from 'react';
import { TrendingUp, TrendingDown, DollarSign, Package, AlertTriangle } from 'lucide-react';

/**
 * InvoiceProfitSummary
 *
 * KEY RULE: cogs_items amounts are stored in INVOICE CURRENCY equivalent at creation time
 * (calculateTotals sums item.amount directly, no conversion).
 * Therefore we must display amounts using invoice.currency, not item.currency.
 * item.currency is shown as an informational badge only (indicates source currency).
 */
const InvoiceProfitSummary = ({ invoice, formatCurrency }) => {
    if (!invoice) return null;

    const invCurrency = invoice.currency || 'IDR';

    const cogsItems = invoice.cogs_items || [];
    const revenueItems = invoice.invoice_items || [];

    // cogs_subtotal is already stored in invoice currency (computed at save time)
    const cogsSubtotalDisplay = invoice.cogs_subtotal
        || cogsItems.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);

    const totalRevenue = invoice.total_amount || 0;
    const grossProfit = invoice.gross_profit != null
        ? invoice.gross_profit
        : (totalRevenue - cogsSubtotalDisplay);
    const profitMargin = invoice.profit_margin != null
        ? invoice.profit_margin
        : (totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0);

    // Determine profit status
    const getProfitStatus = (margin) => {
        if (margin >= 30) return { label: 'Excellent', color: 'text-green-400', bgColor: 'bg-green-500/10', icon: TrendingUp };
        if (margin >= 20) return { label: 'Good', color: 'text-blue-400', bgColor: 'bg-blue-500/10', icon: TrendingUp };
        if (margin >= 10) return { label: 'Fair', color: 'text-yellow-400', bgColor: 'bg-yellow-500/10', icon: AlertTriangle };
        if (margin >= 0) return { label: 'Low', color: 'text-orange-400', bgColor: 'bg-orange-500/10', icon: AlertTriangle };
        return { label: 'Loss', color: 'text-red-400', bgColor: 'bg-red-500/10', icon: TrendingDown };
    };

    const status = getProfitStatus(profitMargin);
    const StatusIcon = status.icon;

    return (
        <div className="space-y-3">
            {/* Profit Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
                {/* Revenue */}
                <div className="glass-card p-2.5 rounded-lg border border-blue-500/30 bg-blue-500/5">
                    <div className="flex items-center gap-2 mb-1">
                        <DollarSign className="w-3.5 h-3.5 text-blue-400" />
                        <span className="text-[10px] text-silver-dark">Revenue</span>
                    </div>
                    <div className="text-sm font-bold text-blue-400">
                        {formatCurrency(totalRevenue, invCurrency)}
                    </div>
                    <div className="text-[9px] text-silver-dark mt-0.5">
                        {revenueItems.length} item(s)
                    </div>
                </div>

                {/* COGS */}
                <div className="glass-card p-2.5 rounded-lg border border-orange-500/30 bg-orange-500/5">
                    <div className="flex items-center gap-2 mb-1">
                        <Package className="w-3.5 h-3.5 text-orange-400" />
                        <span className="text-[10px] text-silver-dark">COGS</span>
                    </div>
                    <div className="text-sm font-bold text-orange-400">
                        {formatCurrency(cogsSubtotalDisplay, invCurrency)}
                    </div>
                    <div className="text-[9px] text-silver-dark mt-0.5">
                        {cogsItems.length} cost item(s)
                    </div>
                </div>

                {/* Gross Profit */}
                <div className={`glass-card p-2.5 rounded-lg border ${status.color.replace('text-', 'border-')}/30 ${status.bgColor}`}>
                    <div className="flex items-center gap-2 mb-1">
                        <StatusIcon className={`w-3.5 h-3.5 ${status.color}`} />
                        <span className="text-[10px] text-silver-dark">Gross Profit</span>
                    </div>
                    <div className={`text-sm font-bold ${status.color}`}>
                        {formatCurrency(grossProfit, invCurrency)}
                    </div>
                    <div className="text-[9px] text-silver-dark mt-0.5">
                        {status.label}
                    </div>
                </div>

                {/* Profit Margin */}
                <div className={`glass-card p-2.5 rounded-lg border ${status.color.replace('text-', 'border-')}/30 ${status.bgColor}`}>
                    <div className="flex items-center gap-2 mb-1">
                        <TrendingUp className={`w-3.5 h-3.5 ${status.color}`} />
                        <span className="text-[10px] text-silver-dark">Margin</span>
                    </div>
                    <div className={`text-sm font-bold ${status.color}`}>
                        {profitMargin.toFixed(2)}%
                    </div>
                    <div className="text-[9px] text-silver-dark mt-0.5">
                        Profit Margin
                    </div>
                </div>
            </div>

            {/* Detailed COGS Breakdown */}
            {cogsItems.length > 0 && (
                <div className="glass-card p-3 rounded-lg border border-dark-border">
                    <h4 className="text-xs font-semibold text-silver-light mb-2 flex items-center gap-2">
                        <Package className="w-3.5 h-3.5 text-orange-400" />
                        Cost of Goods Sold (COGS) Details
                        <span className="ml-auto text-[9px] font-normal text-silver-dark bg-dark-surface px-2 py-0.5 rounded">
                            Amounts in {invCurrency}
                        </span>
                    </h4>
                    <div className="space-y-1">
                        <div className="grid grid-cols-12 gap-2 text-[9px] font-semibold text-silver-dark pb-1 border-b border-dark-border">
                            <div className="col-span-5">Description</div>
                            <div className="col-span-2 text-center">Qty</div>
                            <div className="col-span-2 text-right">Rate</div>
                            <div className="col-span-3 text-right">Amount ({invCurrency})</div>
                        </div>
                        {cogsItems.map((item, index) => {
                            // item.currency is the SOURCE currency label (informational only)
                            // item.amount is already stored in invoice currency equivalent
                            const sourceCurr = item.currency;
                            const showSourceBadge = sourceCurr && sourceCurr !== invCurrency;

                            return (
                                <div key={index} className="grid grid-cols-12 gap-2 text-[10px] text-silver-light py-1 hover:bg-white/5 rounded">
                                    <div className="col-span-5 truncate">
                                        <span>{item.description}</span>
                                        {/* Show source currency badge if different — for info only */}
                                        {showSourceBadge && (
                                            <span className="ml-1 px-1 py-0.5 rounded text-[8px] font-semibold bg-yellow-500/20 text-yellow-400">
                                                src:{sourceCurr}
                                            </span>
                                        )}
                                        {item.vendor && (
                                            <span className="text-[9px] text-silver-dark ml-1">
                                                ({item.vendor})
                                            </span>
                                        )}
                                    </div>
                                    <div className="col-span-2 text-center">
                                        {item.qty} {item.unit}
                                    </div>
                                    <div className="col-span-2 text-right font-mono">
                                        {(item.rate || 0).toLocaleString('id-ID')}
                                    </div>
                                    <div className="col-span-3 text-right font-mono font-semibold">
                                        {/* Display amount in invoice currency — no conversion needed */}
                                        {formatCurrency(item.amount || 0, invCurrency)}
                                    </div>
                                </div>
                            );
                        })}
                        <div className="grid grid-cols-12 gap-2 text-[10px] font-bold text-orange-400 pt-2 border-t border-dark-border">
                            <div className="col-span-9 text-right">
                                TOTAL COGS ({invCurrency}):
                            </div>
                            <div className="col-span-3 text-right font-mono">
                                {formatCurrency(cogsSubtotalDisplay, invCurrency)}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Profit Analysis Summary */}
            <div className="glass-card p-3 rounded-lg border border-accent-orange/30 bg-accent-orange/5">
                <h4 className="text-xs font-semibold text-accent-orange mb-2">Profit Analysis Summary</h4>
                <div className="space-y-1.5 text-[10px]">
                    <div className="flex justify-between">
                        <span className="text-silver-dark">Revenue (incl. tax):</span>
                        <span className="text-blue-400 font-semibold">{formatCurrency(totalRevenue, invCurrency)}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-silver-dark">Cost of Goods Sold:</span>
                        <span className="text-orange-400 font-semibold">{formatCurrency(cogsSubtotalDisplay, invCurrency)}</span>
                    </div>
                    <div className="h-px bg-dark-border my-1"></div>
                    <div className="flex justify-between items-center">
                        <span className={`font-semibold ${status.color}`}>Gross Profit:</span>
                        <span className={`font-bold text-sm ${status.color}`}>{formatCurrency(grossProfit, invCurrency)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                        <span className={`font-semibold ${status.color}`}>Profit Margin:</span>
                        <span className={`font-bold text-sm ${status.color}`}>{profitMargin.toFixed(2)}%</span>
                    </div>
                </div>
            </div>

            {/* Warning if no COGS */}
            {cogsItems.length === 0 && (
                <div className="glass-card p-2.5 rounded-lg border border-yellow-500/30 bg-yellow-500/5">
                    <div className="flex items-start gap-2">
                        <AlertTriangle className="w-3.5 h-3.5 text-yellow-400 mt-0.5 flex-shrink-0" />
                        <div className="flex-1">
                            <p className="text-[10px] text-yellow-400 font-semibold mb-0.5">No COGS Data</p>
                            <p className="text-[9px] text-silver-dark">
                                Cost of Goods Sold data is not available for this invoice.
                                Profit calculation shows 100% margin. Add COGS items from shipment for accurate profit analysis.
                            </p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default InvoiceProfitSummary;
