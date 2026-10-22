import React, { useState } from 'react';
import { useData } from '../../context/DataContext';
import DataTable from '../../components/Common/DataTable';
import Modal from '../../components/Common/Modal';
import Button from '../../components/Common/Button';
import { Plus, UserCircle, Download } from 'lucide-react';
import { exportToCSV } from '../../utils/exportCSV';
import { useLanguage } from '../../i18n/LanguageContext';

const CustomerManagement = () => {
    const { t } = useLanguage();
    const { customers, addCustomer, updateCustomer, deleteCustomer } = useData();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingCustomer, setEditingCustomer] = useState(null);
    const [formData, setFormData] = useState({
        name: '',
        company: '',
        email: '',
        phone: '',
        address: '',
        npwp: '',
        status: 'active',
    });

    const statuses = ['active', 'inactive'];

    const handleOpenModal = (customer = null) => {
        if (customer) {
            setEditingCustomer(customer);
            setFormData(customer);
        } else {
            setEditingCustomer(null);
            setFormData({
                name: '',
                company: '',
                email: '',
                phone: '',
                address: '',
                npwp: '',
                status: 'active',
            });
        }
        setIsModalOpen(true);
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        if (editingCustomer) {
            updateCustomer(editingCustomer.id, formData);
        } else {
            addCustomer(formData);
        }
        setIsModalOpen(false);
    };

    const handleRemove = (customer) => {
        if (window.confirm(`Are you sure you want to delete ${customer.name}?`)) {
            deleteCustomer(customer.id);
        }
    };

    const columns = [
        { header: 'Name', key: 'name' },
        { header: 'Company', key: 'company' },
        { header: 'Email', key: 'email' },
        { header: 'Phone', key: 'phone' },
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
            { key: 'name', header: 'Customer Name' },
            { key: 'company', header: 'Company' },
            { key: 'email', header: 'Email' },
            { key: 'phone', header: 'Phone' },
            { key: 'address', header: 'Address' },
            { key: 'npwp', header: 'NPWP' },
            { key: 'status', header: 'Status' }
        ];

        exportToCSV(customers, 'Data_Customer', columns);
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <h1 className="text-4xl font-bold gradient-text mb-2">{t("Manajemen Customer")}</h1>
                    <p className="text-silver-dark">{t("Centralized customer database for all modules")}</p>
                </div>
                <div className="flex gap-3">
                    <Button onClick={handleExportCSV} variant="secondary" icon={Download}>
                        {t("Export CSV")}
                    </Button>
                    <Button onClick={() => handleOpenModal()} icon={Plus}>
                        {t("Add Customer")}
                    </Button>
                </div>
            </div>

            {/* Statistics */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="glass-card p-6 rounded-lg">
                    <div className="flex items-center gap-3">
                        <UserCircle className="w-8 h-8 text-silver" />
                        <div>
                            <p className="text-silver-dark text-sm">{t("Total Customer")}</p>
                            <p className="text-3xl font-bold text-silver-light">{customers.length}</p>
                        </div>
                    </div>
                </div>
                <div className="glass-card p-6 rounded-lg">
                    <div className="flex items-center gap-3">
                        <div className="w-3 h-3 rounded-full bg-green-500" />
                        <div>
                            <p className="text-silver-dark text-sm">{t("Active")}</p>
                            <p className="text-3xl font-bold text-silver-light">
                                {customers.filter((c) => c.status === 'active').length}
                            </p>
                        </div>
                    </div>
                </div>
                <div className="glass-card p-6 rounded-lg">
                    <div className="flex items-center gap-3">
                        <div className="w-3 h-3 rounded-full bg-red-500" />
                        <div>
                            <p className="text-silver-dark text-sm">{t("Inactive")}</p>
                            <p className="text-3xl font-bold text-silver-light">
                                {customers.filter((c) => c.status === 'inactive').length}
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Data Table */}
            <DataTable
                data={customers}
                columns={columns}
                onRowClick={handleOpenModal}
                searchPlaceholder="Cari pelanggan..."
                emptyMessage="No customers found. Click 'Add Customer' to get started."
            />

            {/* Modal */}
            <Modal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                title={editingCustomer ? 'Edit Customer' : 'Add Customer Baru'}
            >
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-silver-dark mb-2">
                            {t("Customer Name *")}
                        </label>
                        <input
                            type="text"
                            required
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            placeholder={t("Enter customer name")}
                            className="w-full"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-silver-dark mb-2">
                            {t("Company")}
                        </label>
                        <input
                            type="text"
                            value={formData.company}
                            onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                            placeholder={t("Enter company name")}
                            className="w-full"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-silver-dark mb-2">
                            {t("NPWP")}
                        </label>
                        <input
                            type="text"
                            value={formData.npwp}
                            onChange={(e) => setFormData({ ...formData, npwp: e.target.value })}
                            placeholder="00.000.000.0-000.000"
                            className="w-full"
                            maxLength="20"
                        />
                        <p className="text-xs text-silver-dark mt-1">{t("Format: 00.000.000.0-000.000")}</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-silver-dark mb-2">
                                {t("Email")}
                            </label>
                            <input
                                type="email"
                                value={formData.email}
                                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                placeholder={t("customer@example.com")}
                                className="w-full"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-silver-dark mb-2">
                                {t("Phone")}
                            </label>
                            <input
                                type="tel"
                                value={formData.phone}
                                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                placeholder={t("+62 xxx xxxx xxxx")}
                                className="w-full"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-silver-dark mb-2">
                            {t("Address")}
                        </label>
                        <textarea
                            value={formData.address}
                            onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                            placeholder={t("Enter full address")}
                            rows={3}
                            className="w-full"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-silver-dark mb-2">
                            {t("Status")}
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

                    <div className="flex justify-between gap-3 mt-6">
                        {editingCustomer && (
                            <Button
                                type="button"
                                variant="secondary"
                                onClick={() => handleRemove(editingCustomer)}
                                className="bg-red-500/20 hover:bg-red-500/30 text-red-400"
                            >
                                {t("Delete")}
                            </Button>
                        )}
                        <div className="flex gap-3 ml-auto">
                            <Button type="button" variant="secondary" onClick={() => setIsModalOpen(false)}>
                                {t("Cancel")}
                            </Button>
                            <Button type="submit">{editingCustomer ? 'Update' : 'Create'} {t("Customer")}</Button>
                        </div>
                    </div>
                </form>
            </Modal>
        </div>
    );
};

export default CustomerManagement;
