
import React, { useState } from 'react';
import { Plus, Edit2, Trash2, Search, Filter, FileText, Calendar, Box, Globe, CreditCard, Download, Printer } from 'lucide-react';
import * as XLSX from 'xlsx';
import { useAuth } from '../../context/AuthContext';
import Button from '../../components/Common/Button';
import Modal from '../../components/Common/Modal';

const AtaCarnet = () => {
    const { canCreate, canEdit, canDelete } = useAuth();
    const hasCreate = canCreate('bridge_ata_carnet');
    const hasEdit = canEdit('bridge_ata_carnet');
    const hasDelete = canDelete('bridge_ata_carnet');

    // Dummy Data
    const [carnetList, setCarnetList] = useState([
        {
            id: 1,
            carnetNumber: 'ATA-2024-001',
            holder: 'PT. Logistics Indonesia',
            origin: 'Indonesia',
            entryDate: '2024-01-15',
            expiryDate: '2025-01-15',
            description: 'Exhibition Equipment - Audio Systems',
            serialNumber: 'SN-99887766',
            quantity: 5,
            currency: 'USD',
            value: 15000,
            destination: 'Singapore',
            status: 'Out'
        },
        {
            id: 2,
            carnetNumber: 'ATA-2024-005',
            holder: 'Global Events Ltd',
            origin: 'Singapore',
            entryDate: '2024-02-10',
            expiryDate: '2025-02-10',
            description: 'Broadcasting Cameras',
            serialNumber: 'Sony-X100-22',
            quantity: 2,
            currency: 'SGD',
            value: 25000,
            destination: 'Jakarta',
            status: 'In'
        }
    ]);

    const [showModal, setShowModal] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    const initialFormState = {
        id: '',
        carnetNumber: '',
        holder: '',
        origin: '',
        entryDate: '',
        expiryDate: '',
        description: '',
        serialNumber: '',
        quantity: '',
        currency: 'IDR',
        value: '',
        destination: '',
        status: 'In' // Default layout
    };

    const [formData, setFormData] = useState(initialFormState);

    const handleOpenAdd = () => {
        setIsEditing(false);
        setFormData(initialFormState);
        setShowModal(true);
    };

    const handleEdit = (item) => {
        setIsEditing(true);
        setFormData(item);
        setShowModal(true);
    };

    const handleDelete = (id) => {
        if (window.confirm('Are you sure run delete this Carnet document?')) {
            setCarnetList(prev => prev.filter(item => item.id !== id));
        }
    };

    const handleSubmit = (e) => {
        e.preventDefault();

        if (isEditing) {
            setCarnetList(prev => prev.map(item => item.id === formData.id ? formData : item));
        } else {
            const newItem = {
                ...formData,
                id: Date.now()
            };
            setCarnetList(prev => [...prev, newItem]);
        }
        setShowModal(false);
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
    };

    // Filter logic
    const filteredList = carnetList.filter(item =>
        item.carnetNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.holder.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.description.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const handleExportExcel = () => {
        const dataToExport = filteredList.map((item, index) => ({
            'No': index + 1,
            'Carnet Number': item.carnetNumber,
            'Holder': item.holder,
            'Origin': item.origin,
            'Entry Date': item.entryDate,
            'Expiry Date': item.expiryDate,
            'Description': item.description,
            'Serial Number': item.serialNumber,
            'Quantity': item.quantity,
            'Currency': item.currency,
            'Value': item.value,
            'Destination': item.destination,
            'Status': item.status
        }));

        const ws = XLSX.utils.json_to_sheet(dataToExport);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "ATA Carnet");

        // Auto-width columns
        const colWidths = [
            { wch: 5 },  // No
            { wch: 20 }, // Carnet No
            { wch: 25 }, // Holder
            { wch: 15 }, // Origin
            { wch: 12 }, // Entry
            { wch: 12 }, // Expiry
            { wch: 40 }, // Desc
            { wch: 20 }, // SN
            { wch: 10 }, // Qty
            { wch: 8 },  // Curr
            { wch: 15 }, // Value
            { wch: 15 }, // Destination
            { wch: 10 }  // Status
        ];
        ws['!cols'] = colWidths;

        XLSX.writeFile(wb, `ATA_Carnet_Export_${new Date().toISOString().split('T')[0]}.xlsx`);
    };

    const handleRowClick = (item) => {
        handleEdit(item);
    };

    const handlePrint = () => {
        alert("Fitur cetak akan segera tersedia (Coming Soon)");
    };

    return (
        <div className="p-6 space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-silver-light">ATA Carnet Management</h1>
                    <p className="text-silver-dark text-sm mt-1">Manage temporary admission documents (ATA Carnet)</p>
                </div>
                <div className="flex gap-2">
                    <Button onClick={handleExportExcel} variant="secondary">
                        <Download className="w-4 h-4 mr-2" />
                        Export Excel
                    </Button>
                    {hasCreate && (
                        <Button onClick={handleOpenAdd} variant="primary">
                            <Plus className="w-4 h-4 mr-2" />
                            New Carnet
                        </Button>
                    )}
                </div>
            </div>

            {/* Filters */}
            <div className="glass-card p-4 rounded-xl flex gap-4 items-center">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-silver-dark w-4 h-4" />
                    <input
                        type="text"
                        placeholder="Search by Carnet No, Holder, or Description..."
                        className="w-full pl-10 pr-4 py-2 bg-dark-bg border border-dark-border rounded-lg text-silver focus:outline-none focus:border-accent-blue transition-colors"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                {/* Add more filters if needed */}
            </div>

            {/* Table */}
            <div className="glass-card rounded-xl overflow-hidden border border-dark-border">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="bg-dark-surface border-b border-dark-border">
                                <th className="px-4 py-3 text-left text-xs font-semibold text-silver uppercase tracking-wider min-w-[150px]">Carnet Number</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-silver uppercase tracking-wider min-w-[200px]">Holder / Origin</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-silver uppercase tracking-wider min-w-[100px]">Entry Date</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-silver uppercase tracking-wider min-w-[100px]">Expiry Date</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-silver uppercase tracking-wider min-w-[200px] w-1/4">Description / SN</th>
                                <th className="px-4 py-3 text-right text-xs font-semibold text-silver uppercase tracking-wider min-w-[120px]">Qty / Value</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-silver uppercase tracking-wider min-w-[120px]">Destination</th>
                                <th className="px-4 py-3 text-center text-xs font-semibold text-silver uppercase tracking-wider min-w-[100px]">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-dark-border/50">
                            {filteredList.length > 0 ? (
                                filteredList.map((item) => (
                                    <tr
                                        key={item.id}
                                        className="hover:bg-dark-surface/50 transition-colors cursor-pointer"
                                        onClick={() => handleRowClick(item)}
                                    >
                                        <td className="px-4 py-3 text-silver-light text-sm font-medium whitespace-nowrap">{item.carnetNumber}</td>
                                        <td className="px-4 py-3">
                                            <div className="text-sm text-silver-light line-clamp-1">{item.holder}</div>
                                            <div className="text-xs text-silver-dark mt-0.5">{item.origin}</div>
                                        </td>
                                        <td className="px-4 py-3 text-xs text-silver whitespace-nowrap">{item.entryDate}</td>
                                        <td className="px-4 py-3 text-xs text-silver whitespace-nowrap">{item.expiryDate}</td>
                                        <td className="px-4 py-3">
                                            <div className="text-sm text-silver-light line-clamp-2" title={item.description}>{item.description}</div>
                                            <div className="text-xs text-silver-dark mt-0.5 font-mono line-clamp-1">SN: {item.serialNumber}</div>
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            <div className="text-xs text-silver-light font-bold">{item.quantity} Units</div>
                                            <div className="text-xs text-silver-dark">{item.currency} {Number(item.value).toLocaleString()}</div>
                                        </td>
                                        <td className="px-4 py-3 text-silver-light text-sm">{item.destination}</td>
                                        <td className="px-4 py-3 text-center">
                                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${item.status === 'In'
                                                ? 'bg-green-500/20 text-green-400'
                                                : 'bg-blue-500/20 text-blue-400'
                                                }`}>
                                                {item.status}
                                            </span>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan="8" className="px-6 py-8 text-center text-silver-dark">
                                        No ATA Carnet documents found.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Add/Edit Modal */}
            <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={isEditing ? (hasEdit ? 'Edit ATA Carnet' : 'View ATA Carnet') : 'New ATA Carnet'}>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <fieldset disabled={isEditing && !hasEdit} className="grid grid-cols-1 md:grid-cols-2 gap-4 border-none p-0 m-0">
                        {/* Section 1: Document Info */}
                        <div className="col-span-full space-y-4 pb-4 border-b border-dark-border">
                            <h3 className="text-sm font-semibold text-silver-dark uppercase tracking-wider mb-2 flex items-center gap-2">
                                <FileText className="w-4 h-4" /> Document Details
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-medium text-silver-dark mb-1">Carnet Number</label>
                                    <input required name="carnetNumber" value={formData.carnetNumber} onChange={handleChange} className="form-input w-full bg-dark-bg border-dark-border rounded-lg text-silver px-3 py-2 disabled:opacity-60 disabled:cursor-not-allowed" placeholder="e.g. ATA-2024-XXX" />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-silver-dark mb-1">Holder Name</label>
                                    <input required name="holder" value={formData.holder} onChange={handleChange} className="form-input w-full bg-dark-bg border-dark-border rounded-lg text-silver px-3 py-2 disabled:opacity-60 disabled:cursor-not-allowed" placeholder="Company or Individual Name" />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-silver-dark mb-1">Origin Country</label>
                                    <input required name="origin" value={formData.origin} onChange={handleChange} className="form-input w-full bg-dark-bg border-dark-border rounded-lg text-silver px-3 py-2 disabled:opacity-60 disabled:cursor-not-allowed" placeholder="e.g. Indonesia" />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-silver-dark mb-1">Destination</label>
                                    <input required name="destination" value={formData.destination} onChange={handleChange} className="form-input w-full bg-dark-bg border-dark-border rounded-lg text-silver px-3 py-2 disabled:opacity-60 disabled:cursor-not-allowed" placeholder="e.g. Singapore" />
                                </div>
                            </div>
                        </div>

                        {/* Section 2: Dates & Status */}
                        <div className="col-span-full space-y-4 pb-4 border-b border-dark-border">
                            <h3 className="text-sm font-semibold text-silver-dark uppercase tracking-wider mb-2 flex items-center gap-2">
                                <Calendar className="w-4 h-4" /> Schedule & Status
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div>
                                    <label className="block text-xs font-medium text-silver-dark mb-1">Entry Date</label>
                                    <input type="date" required name="entryDate" value={formData.entryDate} onChange={handleChange} className="form-input w-full bg-dark-bg border-dark-border rounded-lg text-silver px-3 py-2 disabled:opacity-60 disabled:cursor-not-allowed" />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-silver-dark mb-1">Expiry Date</label>
                                    <input type="date" required name="expiryDate" value={formData.expiryDate} onChange={handleChange} className="form-input w-full bg-dark-bg border-dark-border rounded-lg text-silver px-3 py-2 disabled:opacity-60 disabled:cursor-not-allowed" />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-silver-dark mb-1">Status</label>
                                    <select name="status" value={formData.status} onChange={handleChange} className="form-select w-full bg-dark-bg border-dark-border rounded-lg text-silver px-3 py-2 disabled:opacity-60 disabled:cursor-not-allowed">
                                        <option value="In">In (Import)</option>
                                        <option value="Out">Out (Export)</option>
                                    </select>
                                </div>
                            </div>
                        </div>

                        {/* Section 3: Item Details */}
                        <div className="col-span-full space-y-4">
                            <h3 className="text-sm font-semibold text-silver-dark uppercase tracking-wider mb-2 flex items-center gap-2">
                                <Box className="w-4 h-4" /> Item Details
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="md:col-span-2">
                                    <label className="block text-xs font-medium text-silver-dark mb-1">Item Description</label>
                                    <textarea required name="description" value={formData.description} onChange={handleChange} rows="2" className="form-textarea w-full bg-dark-bg border-dark-border rounded-lg text-silver px-3 py-2 disabled:opacity-60 disabled:cursor-not-allowed" placeholder="Detailed description of goods..." />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-silver-dark mb-1">Serial Number</label>
                                    <input name="serialNumber" value={formData.serialNumber} onChange={handleChange} className="form-input w-full bg-dark-bg border-dark-border rounded-lg text-silver px-3 py-2 disabled:opacity-60 disabled:cursor-not-allowed" placeholder="Unique Serial No." />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-silver-dark mb-1">Quantity</label>
                                    <input type="number" required name="quantity" value={formData.quantity} onChange={handleChange} className="form-input w-full bg-dark-bg border-dark-border rounded-lg text-silver px-3 py-2 disabled:opacity-60 disabled:cursor-not-allowed" placeholder="0" />
                                </div>
                                <div className="grid grid-cols-3 gap-2 md:col-span-2">
                                    <div className="col-span-1">
                                        <label className="block text-xs font-medium text-silver-dark mb-1">Currency</label>
                                        <select name="currency" value={formData.currency} onChange={handleChange} className="form-select w-full bg-dark-bg border-dark-border rounded-lg text-silver px-3 py-2 disabled:opacity-60 disabled:cursor-not-allowed">
                                            <option value="IDR">IDR</option>
                                            <option value="USD">USD</option>
                                            <option value="SGD">SGD</option>
                                            <option value="EUR">EUR</option>
                                        </select>
                                    </div>
                                    <div className="col-span-2">
                                        <label className="block text-xs font-medium text-silver-dark mb-1">Value</label>
                                        <input type="number" required name="value" value={formData.value} onChange={handleChange} className="form-input w-full bg-dark-bg border-dark-border rounded-lg text-silver px-3 py-2 disabled:opacity-60 disabled:cursor-not-allowed" placeholder="Total Value" />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </fieldset>

                    <div className="flex justify-between items-center mt-6 pt-4 border-t border-dark-border">
                        {/* Left Side: Additional Actions in Edit Mode */}
                        <div className="flex gap-2">
                            {isEditing && (
                                <>
                                    {hasDelete && (
                                        <Button type="button" variant="danger" onClick={() => {
                                            handleDelete(formData.id);
                                            setShowModal(false);
                                        }}>
                                            <Trash2 className="w-4 h-4 mr-1" /> Delete
                                        </Button>
                                    )}
                                    <Button type="button" variant="secondary" onClick={handlePrint}>
                                        <Printer className="w-4 h-4 mr-1" /> Print
                                    </Button>
                                </>
                            )}
                        </div>

                        {/* Right Side: Standard Actions */}
                        <div className="flex gap-2">
                            <Button type="button" variant="secondary" onClick={() => setShowModal(false)}>
                                {isEditing && !hasEdit ? 'Close' : 'Cancel'}
                            </Button>
                            {!isEditing && hasCreate && (
                                <Button type="submit" variant="primary">Create Carnet</Button>
                            )}
                            {isEditing && hasEdit && (
                                <Button type="submit" variant="primary">Update Changes</Button>
                            )}
                        </div>
                    </div>
                </form>
            </Modal>
        </div>
    );
};

export default AtaCarnet;
