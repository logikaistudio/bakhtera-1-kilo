const normalize = value => String(value ?? '').trim().toLowerCase();

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
