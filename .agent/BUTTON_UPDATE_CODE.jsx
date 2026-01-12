// ============================================================================
// UPDATE EXISTING CODE - Button Section with "Edit Pilihan"
// Location: Around line 855-877 in PengajuanManagement.jsx
// FIND and REPLACE the existing {sourcePengajuanId ? ( section
// ============================================================================

// FIND THIS:
/*
                            {sourcePengajuanId ? (
                                <div className="flex items-center justify-between bg-dark-surface/50 p-3 rounded-lg">
                                    <div className="flex items-center gap-2">
                                        <Package className="w-5 h-5 text-accent-green" />
                                        <span className="text-sm text-silver">
                                            Sumber: <span className="font-medium text-accent-green">{formData.sourcePengajuanNumber}</span>
                                        </span>
                                        <span className="text-xs text-silver-dark">
                                            ({formData.packages?.length || 0} package, {formData.packages?.reduce((sum, pkg) => sum + (pkg.items?.length || 0), 0) || 0} item)
                                        </span>
                                    </div>
                                    <Button
                                        type="button"
                                        variant="secondary"
                                        size="sm"
                                        onClick={() => {
                                            setSourcePengajuanId(null);
                                            setFormData(prev => ({ ...prev, packages: [], sourcePengajuanId: null, sourcePengajuanNumber: null }));
                                        }}
                                    >
                                        Ganti
                                    </Button>
                                </div>
                            ) : (
*/

// REPLACE WITH THIS:
{
    sourcePengajuanId ? (
        <div className="space-y-2">
            <div className="flex items-center justify-between bg-dark-surface/50 p-3 rounded-lg">
                <div className="flex items-center gap-2">
                    <Package className="w-5 h-5 text-accent-green" />
                    <span className="text-sm text-silver">
                        Sumber: <span className="font-medium text-accent-green">{formData.sourcePengajuanNumber}</span>
                    </span>
                    <span className="text-xs text-silver-dark">
                        ({formData.packages?.length || 0} package, {formData.packages?.reduce((sum, pkg) => sum + (pkg.items?.length || 0), 0) || 0} item)
                    </span>
                </div>
                <div className="flex gap-2">
                    <Button
                        type="button"
                        variant="primary"
                        size="sm"
                        icon={Edit2}
                        onClick={handleEditItemSelection}
                    >
                        Edit Pilihan
                    </Button>
                    <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => {
                            setSourcePengajuanId(null);
                            setFormData(prev => ({ ...prev, packages: [], sourcePengajuanId: null, sourcePengajuanNumber: null }));
                        }}
                    >
                        Ganti
                    </Button>
                </div>
            </div>
            <p className="text-xs text-silver-dark italic">
                💡 Klik "Edit Pilihan" untuk menyesuaikan item atau quantity yang akan dikeluarkan
            </p>
        </div>
    ) : (

// ============================================================================
// KEY CHANGES:
// 1. Wrapped in <div className="space-y-2"> for vertical spacing
// 2. Changed button container from single button to <div className="flex gap-2">
// 3. Added new "Edit Pilihan" button with Edit2 icon
// 4. Added hint text below the selection box
// ============================================================================
