import React, { useState } from 'react';
import { Plus, Package as PackageIcon, Trash2, Edit2, ChevronDown, ChevronRight, Eye } from 'lucide-react';
import Button from './Button';
import PackageItemManager from './PackageItemManager';

const PackageManager = ({ packages = [], onChange, itemMaster = [], readOnly = false }) => {
    const [expandedPackages, setExpandedPackages] = useState({});
    const [showPackageForm, setShowPackageForm] = useState(false);
    const [editingPackageId, setEditingPackageId] = useState(null);
    const [packageNumber, setPackageNumber] = useState('');

    const togglePackage = (packageId) => {
        setExpandedPackages(prev => ({
            ...prev,
            [packageId]: !prev[packageId]
        }));
    };

    const handleAddPackage = () => {
        if (readOnly) return;
        if (!packageNumber.trim()) {
            alert('Masukkan nomor package');
            return;
        }

        if (editingPackageId) {
            // Update existing package
            const updated = packages.map(pkg =>
                pkg.id === editingPackageId
                    ? { ...pkg, packageNumber: packageNumber.trim() }
                    : pkg
            );
            onChange(updated);
            setEditingPackageId(null);
        } else {
            // Add new package
            const newPackage = {
                id: `pkg-${Date.now()}`,
                packageNumber: packageNumber.trim(),
                items: []
            };
            onChange([...packages, newPackage]);
            // Auto expand new package
            setExpandedPackages(prev => ({
                ...prev,
                [newPackage.id]: true
            }));
        }

        setPackageNumber('');
        setShowPackageForm(false);
    };

    const handleEditPackage = (pkg) => {
        if (readOnly) return;
        setPackageNumber(pkg.packageNumber);
        setEditingPackageId(pkg.id);
        setShowPackageForm(true);
    };

    const handleRemovePackage = (packageId) => {
        if (readOnly) return;
        const pkg = packages.find(p => p.id === packageId);
        if (pkg.items && pkg.items.length > 0) {
            if (!window.confirm(`Package ini berisi ${pkg.items.length} barang. Yakin ingin menghapus?`)) {
                return;
            }
        }
        onChange(packages.filter(p => p.id !== packageId));
    };

    const handleItemsChange = (packageId, items) => {
        if (readOnly) return;
        const updated = packages.map(pkg =>
            pkg.id === packageId
                ? { ...pkg, items }
                : pkg
        );
        onChange(updated);
    };

    const handleCancelPackageForm = () => {
        setPackageNumber('');
        setEditingPackageId(null);
        setShowPackageForm(false);
    };

    const totalPackages = packages.length;
    const totalItems = packages.reduce((sum, pkg) => sum + (pkg.items?.length || 0), 0);
    const totalValue = packages.reduce((sum, pkg) => {
        const pkgValue = pkg.items?.reduce((s, item) => s + (item.value || 0), 0) || 0;
        return sum + pkgValue;
    }, 0);

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <PackageIcon className="w-5 h-5 text-accent-purple" />
                    <h3 className="text-lg font-semibold text-silver-light">
                        {readOnly ? '📦 Data Package (Referensi)' : 'Package Management'}
                    </h3>
                    <span className="text-xs text-silver-dark">
                        ({totalPackages} package, {totalItems} total barang)
                    </span>
                    {readOnly && (
                        <span className="px-2 py-0.5 bg-yellow-500/20 text-yellow-400 text-xs rounded-full border border-yellow-500/30">
                            <Eye className="w-3 h-3 inline mr-1" />
                            Read Only
                        </span>
                    )}
                </div>
                {!showPackageForm && !readOnly && (
                    <Button size="sm" onClick={() => setShowPackageForm(true)} icon={Plus}>
                        Tambah Package
                    </Button>
                )}
            </div>

            {/* Add/Edit Package Form - Hidden in Read Only mode */}
            {showPackageForm && !readOnly && (
                <div className="glass-card p-4 rounded-lg border-2 border-accent-purple bg-accent-purple/10">
                    <h4 className="text-sm font-semibold text-silver-light mb-3">
                        {editingPackageId ? 'Edit Package' : 'Tambah Package Baru'}
                    </h4>
                    <div className="flex gap-3">
                        <div className="flex-1">
                            <label className="block text-sm font-medium text-silver mb-2">
                                Nomor Package *
                            </label>
                            <input
                                type="text"
                                value={packageNumber}
                                onChange={(e) => setPackageNumber(e.target.value)}
                                onKeyPress={(e) => e.key === 'Enter' && handleAddPackage()}
                                placeholder="contoh: PKG-001, BOX-A1"
                                className="w-full"
                                autoFocus
                            />
                        </div>
                        <div className="flex items-end gap-2">
                            <Button
                                type="button"
                                variant="secondary"
                                size="sm"
                                onClick={handleCancelPackageForm}
                            >
                                Batal
                            </Button>
                            <Button
                                type="button"
                                size="sm"
                                onClick={handleAddPackage}
                                icon={Plus}
                            >
                                {editingPackageId ? 'Simpan' : 'Tambah'}
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Packages List */}
            {packages.length === 0 && !showPackageForm && (
                <div className="glass-card p-8 rounded-lg text-center text-silver-dark">
                    <PackageIcon className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p>Belum ada package</p>
                    {!readOnly && <p className="text-xs mt-1">Klik "Tambah Package" untuk mulai</p>}
                </div>
            )}

            {packages.map((pkg, index) => {
                const isExpanded = expandedPackages[pkg.id];
                const itemCount = pkg.items?.length || 0;
                const pkgValue = pkg.items?.reduce((sum, item) => sum + (item.value || 0), 0) || 0;

                return (
                    <div key={pkg.id} className={`glass-card rounded-lg border overflow-hidden ${readOnly ? 'border-yellow-500/30 bg-yellow-500/5' : 'border-dark-border'}`}>
                        {/* Package Header */}
                        <div className={`p-4 ${readOnly ? 'bg-yellow-500/10' : 'bg-accent-purple/20'}`}>
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3 flex-1">
                                    <button
                                        type="button"
                                        onClick={() => togglePackage(pkg.id)}
                                        className={`p-1 rounded smooth-transition ${readOnly ? 'hover:bg-yellow-500/20' : 'hover:bg-accent-purple/30'}`}
                                    >
                                        {isExpanded ? (
                                            <ChevronDown className={`w-5 h-5 ${readOnly ? 'text-yellow-400' : 'text-accent-purple'}`} />
                                        ) : (
                                            <ChevronRight className={`w-5 h-5 ${readOnly ? 'text-yellow-400' : 'text-accent-purple'}`} />
                                        )}
                                    </button>

                                    <PackageIcon className={`w-5 h-5 ${readOnly ? 'text-yellow-400' : 'text-accent-purple'}`} />

                                    <div className="flex-1">
                                        <div className="flex items-center gap-3">
                                            <h4 className="font-semibold text-silver-light">
                                                {pkg.packageNumber}
                                            </h4>
                                            <span className="text-xs text-silver-dark">
                                                Package #{index + 1}
                                            </span>
                                        </div>
                                        <p className="text-xs text-silver-dark mt-1">
                                            {itemCount} barang
                                            {pkgValue > 0 && ` • Nilai total: Rp ${pkgValue.toLocaleString('id-ID')}`}
                                        </p>
                                    </div>
                                </div>

                                {/* Hide edit/delete buttons in read only mode */}
                                {!readOnly && (
                                    <div className="flex items-center gap-2">
                                        <button
                                            type="button"
                                            onClick={(e) => { e.stopPropagation(); handleEditPackage(pkg); }}
                                            className="p-2 hover:bg-blue-500/20 rounded smooth-transition"
                                            title="Edit Package"
                                        >
                                            <Edit2 className="w-4 h-4 text-blue-400" />
                                        </button>
                                        <button
                                            type="button"
                                            onClick={(e) => { e.stopPropagation(); handleRemovePackage(pkg.id); }}
                                            className="p-2 hover:bg-red-500/20 rounded smooth-transition"
                                            title="Hapus Package"
                                        >
                                            <Trash2 className="w-4 h-4 text-red-400" />
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Package Items (Expandable) */}
                        {isExpanded && (
                            <div className="p-4 bg-white border-t border-gray-200">
                                <PackageItemManager
                                    items={pkg.items || []}
                                    onChange={(items) => handleItemsChange(pkg.id, items)}
                                    itemMaster={itemMaster}
                                    readOnly={readOnly}
                                />
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
};

export default PackageManager;

