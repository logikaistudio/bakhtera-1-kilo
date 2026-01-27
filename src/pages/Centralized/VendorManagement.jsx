import React, { useState, useMemo } from 'react';
import { useData } from '../../context/DataContext';
import DataTable from '../../components/Common/DataTable';
import Modal from '../../components/Common/Modal';
import Button from '../../components/Common/Button';
import { Plus, Users, Download } from 'lucide-react';
import { exportToCSV } from '../../utils/exportCSV';

const VendorManagement = () => {
    const { businessPartners, addBusinessPartner, updateBusinessPartner, deleteBusinessPartner } = useData();

    // Filter vendors from business partners
    const vendors = useMemo(() =>
        businessPartners.filter(p => p.is_vendor),
        [businessPartners]
    );

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingVendor, setEditingVendor] = useState(null);
    const [formData, setFormData] = useState({
        partner_name: '',
        contact_person: '',
        email: '',
        phone: '',
        category: '',
        tax_id: '',
        status: 'active',
        is_customer: false,
        is_vendor: true,
        is_agent: false,
        is_transporter: false,
    });

    const categories = ['Shipping', 'Warehouse', 'Equipment', 'Event Supplies', 'General'];
    const statuses = ['active', 'inactive'];

    const handleOpenModal = (vendor = null) => {
        if (vendor) {
            setEditingVendor(vendor);
            setFormData({
                partner_name: vendor.partner_name,
                contact_person: vendor.contact_person || '',
                email: vendor.email || '',
                phone: vendor.phone || '',
                category: vendor.category || '',
                tax_id: vendor.tax_id || '',
                status: vendor.status || 'active',
                is_customer: vendor.is_customer || false,
                is_vendor: vendor.is_vendor || true,
                is_agent: vendor.is_agent || false,
                is_transporter: vendor.is_transporter || false,
            });
        } else {
            setEditingVendor(null);
            setFormData({
                partner_name: '',
                contact_person: '',
                email: '',
                phone: '',
                category: '',
                tax_id: '',
                status: 'active',
                is_customer: false,
                is_vendor: true,
                is_agent: false,
                is_transporter: false,
            });
        }
        setIsModalOpen(true);
    };


    const handleSubmit = (e) => {
        e.preventDefault();
        if (editingVendor) {
            updateBusinessPartner(editingVendor.id, formData);
        } else {
            addBusinessPartner(formData);
        }
        setIsModalOpen(false);
    };

    const handleRemove = (vendor) => {
        if (window.confirm(`Are you sure you want to delete ${vendor.partner_name}?`)) {
            deleteBusinessPartner(vendor.id);
        }
    };

    const columns = [
        { header: 'Name', key: 'partner_name' },
        { header: 'Contact', key: 'contact_person' },
        { header: 'Email', key: 'email' },
        { header: 'Phone', key: 'phone' },
        { header: 'Category', key: 'category' },
        {
            header: 'Roles',
            key: 'roles',
            render: (row) => (
                <div className="flex gap-1 flex-wrap">
                    {row.is_vendor && <span className="px-2 py-0.5 rounded text-xs bg-blue-500/20 text-blue-400">Vendor</span>}
                    {row.is_customer && <span className="px-2 py-0.5 rounded text-xs bg-green-500/20 text-green-400">Customer</span>}
                    {row.is_agent && <span className="px-2 py-0.5 rounded text-xs bg-purple-500/20 text-purple-400">Agent</span>}
                    {row.is_transporter && <span className="px-2 py-0.5 rounded text-xs bg-orange-500/20 text-orange-400">Transporter</span>}
                </div>
            ),
        },
        {
            header: 'Status',
            key: 'status',
            render: (row) => (
                <span
                    className={`px-2 py-1 rounded-full text-xs font-medium ${row.status === 'active'
                        ? 'bg-green-500/20 text-green-400'
                        : 'bg-red-500/20 text-red-400'
                        }`}
                >
                    {row.status}
                </span>
            ),
        },
    ];

    // Export to CSV handler
    const handleExportCSV = () => {
        const columns = [
            { key: 'partner_name', header: 'Vendor Name' },
            { key: 'contact_person', header: 'Contact Person' },
            { key: 'email', header: 'Email' },
            { key: 'phone', header: 'Phone' },
            { key: 'category', header: 'Category' },
            { key: 'tax_id', header: 'NPWP' },
            { key: 'status', header: 'Status' }
        ];

        exportToCSV(vendors, 'Data_Vendor', columns);
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <h1 className="text-4xl font-bold gradient-text mb-2">Vendor Management</h1>
                    <p className="text-silver-dark">Centralized vendor database for all modules</p>
                </div>
                <div className="flex gap-3">
                    <Button onClick={handleExportCSV} variant="secondary" icon={Download}>
                        Export CSV
                    </Button>
                    <Button onClick={() => handleOpenModal()} icon={Plus}>
                        Add Vendor
                    </Button>
                </div>
            </div>

            {/* Statistics */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="glass-card p-6 rounded-lg">
                    <div className="flex items-center gap-3">
                        <Users className="w-8 h-8 text-silver" />
                        <div>
                            <p className="text-silver-dark text-sm">Total Vendors</p>
                            <p className="text-3xl font-bold text-silver-light">{vendors.length}</p>
                        </div>
                    </div>
                </div>
                <div className="glass-card p-6 rounded-lg">
                    <div className="flex items-center gap-3">
                        <div className="w-3 h-3 rounded-full bg-green-500" />
                        <div>
                            <p className="text-silver-dark text-sm">Active</p>
                            <p className="text-3xl font-bold text-silver-light">
                                {vendors.filter((v) => v.status === 'active').length}
                            </p>
                        </div>
                    </div>
                </div>
                <div className="glass-card p-6 rounded-lg">
                    <div className="flex items-center gap-3">
                        <div className="w-3 h-3 rounded-full bg-red-500" />
                        <div>
                            <p className="text-silver-dark text-sm">Inactive</p>
                            <p className="text-3xl font-bold text-silver-light">
                                {vendors.filter((v) => v.status === 'inactive').length}
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Data Table */}
            <DataTable
                data={vendors}
                columns={columns}
                onRowClick={handleOpenModal}
                searchPlaceholder="Cari vendor..."
                emptyMessage="No vendors found. Click 'Add Vendor' to get started."
            />

            {/* Modal */}
            <Modal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                title={editingVendor ? 'Edit Vendor' : 'Add New Vendor'}
            >
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-silver-dark mb-2">
                            Partner Name *
                        </label>
                        <input
                            type="text"
                            required
                            value={formData.partner_name}
                            onChange={(e) => setFormData({ ...formData, partner_name: e.target.value })}
                            placeholder="Enter partner name"
                            className="w-full"
                        />
                    </div>

                    {/* Partner Roles */}
                    <div>
                        <label className="block text-sm font-medium text-silver-dark mb-2">
                            Partner Roles *
                        </label>
                        <div className="grid grid-cols-2 gap-3">
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={formData.is_customer}
                                    onChange={(e) => setFormData({ ...formData, is_customer: e.target.checked })}
                                    className="w-4 h-4"
                                />
                                <span className="text-sm text-silver-light">Customer</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={formData.is_vendor}
                                    onChange={(e) => setFormData({ ...formData, is_vendor: e.target.checked })}
                                    className="w-4 h-4"
                                />
                                <span className="text-sm text-silver-light">Vendor</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={formData.is_agent}
                                    onChange={(e) => setFormData({ ...formData, is_agent: e.target.checked })}
                                    className="w-4 h-4"
                                />
                                <span className="text-sm text-silver-light">Agent</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={formData.is_transporter}
                                    onChange={(e) => setFormData({ ...formData, is_transporter: e.target.checked })}
                                    className="w-4 h-4"
                                />
                                <span className="text-sm text-silver-light">Transporter</span>
                            </label>
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-silver-dark mb-2">
                            Contact Person
                        </label>
                        <input
                            type="text"
                            value={formData.contact_person}
                            onChange={(e) => setFormData({ ...formData, contact_person: e.target.value })}
                            placeholder="Enter contact person name"
                            className="w-full"
                        />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-silver-dark mb-2">
                                Email
                            </label>
                            <input
                                type="email"
                                value={formData.email}
                                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                placeholder="partner@example.com"
                                className="w-full"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-silver-dark mb-2">
                                Phone
                            </label>
                            <input
                                type="tel"
                                value={formData.phone}
                                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                placeholder="+62 xxx xxxx xxxx"
                                className="w-full"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-silver-dark mb-2">
                            NPWP
                        </label>
                        <input
                            type="text"
                            value={formData.tax_id}
                            onChange={(e) => setFormData({ ...formData, tax_id: e.target.value })}
                            placeholder="00.000.000.0-000.000"
                            className="w-full"
                            maxLength="20"
                        />
                        <p className="text-xs text-silver-dark mt-1">Format: 00.000.000.0-000.000</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-silver-dark mb-2">
                                Category
                            </label>
                            <select
                                value={formData.category}
                                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                                className="w-full"
                            >
                                <option value="">Select category</option>
                                {categories.map((cat) => (
                                    <option key={cat} value={cat}>
                                        {cat}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-silver-dark mb-2">
                                Status
                            </label>
                            <select
                                value={formData.status}
                                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                                className="w-full"
                            >
                                {statuses.map((status) => (
                                    <option key={status} value={status}>
                                        {status.charAt(0).toUpperCase() + status.slice(1)}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className="flex justify-between gap-3 mt-6">
                        {editingVendor && (
                            <Button
                                type="button"
                                variant="secondary"
                                onClick={() => handleRemove(editingVendor)}
                                className="bg-red-500/20 hover:bg-red-500/30 text-red-400"
                            >
                                Delete
                            </Button>
                        )}
                        <div className="flex gap-3 ml-auto">
                            <Button type="button" variant="secondary" onClick={() => setIsModalOpen(false)}>
                                Cancel
                            </Button>
                            <Button type="submit">{editingVendor ? 'Update' : 'Create'} Vendor</Button>
                        </div>
                    </div>
                </form>
            </Modal>
        </div>
    );
};

export default VendorManagement;
