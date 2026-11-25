const normalize = value => String(value ?? '').trim().toLowerCase();

export const shouldShowWarehouseMutationRow = (warehouseStock, hasOutstandingExternalStock) =>
    Number(warehouseStock ?? 0) > 0 || !hasOutstandingExternalStock;

export const getExternalLocationBalances = (mutations) => {
    const balances = new Map();
    const isWarehouse = location => ['warehouse', 'gudang'].includes(normalize(location));
    const changeBalance = (location, change) => {
        const key = normalize(location);
        if (!key || isWarehouse(key)) return;
        const current = balances.get(key) || { location: String(location).trim(), quantity: 0 };
        current.quantity += change;
        balances.set(key, current);
    };

    mutations.forEach(mutation => {
        const quantity = Number(mutation.mutatedQty ?? mutation.mutated_qty) || 0;
        if (quantity <= 0) return;
        changeBalance(mutation.origin, -quantity);
        changeBalance(mutation.destination, quantity);
    });

    return Array.from(balances.values())
        .map(balance => ({ ...balance, quantity: Math.max(0, balance.quantity) }))
        .filter(balance => balance.quantity > 0);
};

export const getWarehouseStock = (warehouseInventory, {
    submissionId,
    submissionNumber,
    packageNumber,
    itemCode,
    warehouseInventoryId,
    preferInventoryId = false
}) => {
    if (warehouseInventoryId && (preferInventoryId || (!submissionId && !submissionNumber))) {
        const row = warehouseInventory.find(item => String(item.id) === String(warehouseInventoryId));
        return row ? Number(row.currentStock ?? row.quantity ?? row.current_stock ?? 0) : null;
    }

    const targetSubmissionId = normalize(submissionId);
    const targetSubmissionNumber = normalize(submissionNumber);
    const targetPackage = normalize(packageNumber);
    const targetItemCode = normalize(itemCode);
    if (!targetSubmissionId && !targetSubmissionNumber) return null;

    const rows = warehouseInventory.filter(item =>
        normalize(item.itemCode || item.item_code) === targetItemCode &&
        (!targetPackage || normalize(item.packageNumber || item.package_number) === targetPackage) &&
        (targetSubmissionId
            ? normalize(item.pengajuanId || item.pengajuan_id) === targetSubmissionId
            : normalize(item.pengajuanNumber || item.pengajuan_number) === targetSubmissionNumber)
    );

    if (rows.length === 0) return null;

    return rows.reduce(
        (total, item) => total + Number(item.currentStock ?? item.quantity ?? item.current_stock ?? 0),
        0
    );
};

export const planWarehouseStockDeductions = (warehouseRows, requestedQuantity) => {
    const requested = Number(requestedQuantity);
    if (!Number.isFinite(requested) || requested <= 0) {
        throw new Error('Jumlah barang keluar tidak valid.');
    }

    const stockRows = warehouseRows.map(row => {
        const quantity = Number(row.quantity ?? 0);
        if (!row.id || !Number.isFinite(quantity) || quantity < 0) {
            throw new Error('Data stok warehouse tidak valid.');
        }
        return { id: row.id, quantity };
    });

    const available = stockRows.reduce((total, row) => total + row.quantity, 0);
    if (requested > available) {
        throw new Error(`Stok gudang tidak mencukupi (tersedia ${available}, diminta ${requested}).`);
    }

    let remaining = requested;
    return stockRows.flatMap(row => {
        if (remaining === 0 || row.quantity === 0) return [];

        const deducted = Math.min(row.quantity, remaining);
        remaining -= deducted;
        return [{
            id: row.id,
            previousQuantity: row.quantity,
            quantity: row.quantity - deducted
        }];
    });
};
