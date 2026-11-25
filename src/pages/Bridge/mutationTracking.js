const normalize = (value) => String(value || '').trim().toLowerCase();

export const applyMutationTracking = (quotationPackages, mutations, mutationLogs, quotationNumber) => {
    const updatedPackages = JSON.parse(JSON.stringify(quotationPackages || []));
    const mutationCounts = new Map();

    for (const mutation of mutations) {
        const pkg = updatedPackages[mutation._pkgIndex];
        const item = pkg?.items?.[mutation._itemIndex];
        if (!item) continue;

        const mutationScope = JSON.stringify([
            normalize(quotationNumber),
            normalize(pkg.packageNumber),
            normalize(item.itemCode)
        ]);
        let savedCount = mutationCounts.get(mutationScope);
        if (savedCount === undefined) {
            savedCount = mutationLogs.filter(log =>
                normalize(log.pengajuanNumber) === normalize(quotationNumber) &&
                normalize(log.itemCode) === normalize(item.itemCode) &&
                normalize(log.packageNumber) === normalize(pkg.packageNumber)
            ).length;
        }

        const mutationNumber = savedCount + 1;
        item.mutationStatus = mutationNumber >= 3 ? 're-mutasi' : `mutasi-${mutationNumber}`;
        item.lastMutationDate = mutation.date;
        item.lastMutationQty = mutation.mutatedQty;
        item.totalMutated = (Number(item.totalMutated) || 0) + (Number(mutation.mutatedQty) || 0);
        mutationCounts.set(mutationScope, mutationNumber);
    }

    return updatedPackages;
};
