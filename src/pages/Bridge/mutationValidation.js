export const validateMutationRequests = (requests) => {
    const totalsByScope = new Map();

    requests.forEach(({ scope, quantity, availableStock, itemName }) => {
        const requested = Number(quantity ?? 0);
        const available = Number(availableStock ?? 0);

        if (!Number.isFinite(requested) || requested < 0) {
            throw new Error(`Jumlah mutasi ${itemName || 'barang'} tidak valid.`);
        }
        if (requested === 0) return;
        if (!scope || !Number.isFinite(available) || available < 0) {
            throw new Error(`Data stok mutasi ${itemName || 'barang'} tidak valid. Muat ulang data dan coba lagi.`);
        }

        const previous = totalsByScope.get(scope);
        const totalRequested = (previous?.quantity || 0) + requested;
        const stockLimit = previous ? Math.min(previous.availableStock, available) : available;

        if (totalRequested > stockLimit) {
            throw new Error(
                `Jumlah mutasi ${itemName || 'barang'} (${totalRequested}) melebihi stok tersedia (${stockLimit}). Muat ulang data dan coba lagi.`
            );
        }

        totalsByScope.set(scope, { quantity: totalRequested, availableStock: stockLimit });
    });
};
