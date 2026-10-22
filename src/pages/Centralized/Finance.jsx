import React, { useState } from 'react';
import { useData } from '../../context/DataContext';
import DataTable from '../../components/Common/DataTable';
import Modal from '../../components/Common/Modal';
import Button from '../../components/Common/Button';
import { Plus, Wallet, TrendingUp, TrendingDown } from 'lucide-react';
import { useLanguage } from '../../i18n/LanguageContext';

const Finance = () => {
    const { t } = useLanguage();
    const { finance, addFinanceTransaction, updateFinanceTransaction, deleteFinanceTransaction } = useData();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingTransaction, setEditingTransaction] = useState(null);
    const [formData, setFormData] = useState({
        type: 'income',
        category: '',
        amount: '',
        description: '',
        module: 'general',
        date: new Date().toISOString().split('T')[0],
    });

    const types = ['income', 'expense'];
    const categories = ['Sales', 'Service', 'Equipment', 'Operational', 'Marketing', 'Other'];
    const modules = ['general', 'blink', 'bridge', 'big'];

    const handleOpenModal = (transaction = null) => {
        if (transaction) {
            setEditingTransaction(transaction);
            setFormData(transaction);
        } else {
            setEditingTransaction(null);
            setFormData({
                type: 'income',
                category: '',
                amount: '',
                description: '',
                module: 'general',
                date: new Date().toISOString().split('T')[0],
            });
        }
        setIsModalOpen(true);
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        if (editingTransaction) {
            updateFinanceTransaction(editingTransaction.id, formData);
        } else {
            addFinanceTransaction(formData);
        }
        setIsModalOpen(false);
    };

    const handleRemove = (transaction) => {
        if (window.confirm('Are you sure you want to delete this transaction?')) {
            deleteFinanceTransaction(transaction.id);
        }
    };

    // Calculate totals
    const totalIncome = finance
        .filter((t) => t.type === 'income')
        .reduce((sum, t) => sum + parseFloat(t.amount || 0), 0);

    const totalExpense = finance
        .filter((t) => t.type === 'expense')
        .reduce((sum, t) => sum + parseFloat(t.amount || 0), 0);

    const balance = totalIncome - totalExpense;

    const columns = [
        {
            header: 'Date',
            key: 'date',
            render: (row) => new Date(row.date).toLocaleDateString('id-ID'),
        },
        {
            header: 'Type',
            key: 'type',
            render: (row) => (
                <span
                    className={`px-2 py-1 rounded-full text-xs font-medium ${row.type === 'income'
                            ? 'bg-green-500/20 text-green-400'
                            : 'bg-red-500/20 text-red-400'
                        }`}
                >
                    {row.type}
                </span>
            ),
        },
        { header: 'Category', key: 'category' },
        {
            header: 'Quantity',
            key: 'amount',
            render: (row) => (
                <span className={row.type === 'income' ? 'text-green-400' : 'text-red-400'}>
                    Rp {parseFloat(row.amount).toLocaleString('id-ID')}
                </span>
            ),
        },
        { header: 'Description', key: 'description' },
        {
            header: 'Module',
            key: 'module',
            render: (row) => (
                <span className="px-2 py-1 rounded-full text-xs bg-dark-surface text-silver">
                    {row.module}
                </span>
            ),
        },
    ];

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <h1 className="text-4xl font-bold gradient-text mb-2">{t("Finance Management")}</h1>
                    <p className="text-silver-dark">{t("Centralized financial transactions for all modules")}</p>
                </div>
                <Button onClick={() => handleOpenModal()} icon={Plus}>
                    {t("Add Transaction")}
                </Button>
            </div>

            {/* Statistics */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="glass-card p-6 rounded-lg">
                    <div className="flex items-center gap-3">
                        <TrendingUp className="w-8 h-8 text-green-400" />
                        <div>
                            <p className="text-silver-dark text-sm">{t("Total Income")}</p>
                            <p className="text-2xl font-bold text-green-400">
                                Rp {totalIncome.toLocaleString('id-ID')}
                            </p>
                        </div>
                    </div>
                </div>
                <div className="glass-card p-6 rounded-lg">
                    <div className="flex items-center gap-3">
                        <TrendingDown className="w-8 h-8 text-red-400" />
                        <div>
                            <p className="text-silver-dark text-sm">{t("Total Expense")}</p>
                            <p className="text-2xl font-bold text-red-400">
                                Rp {totalExpense.toLocaleString('id-ID')}
                            </p>
                        </div>
                    </div>
                </div>
                <div className="glass-card p-6 rounded-lg">
                    <div className="flex items-center gap-3">
                        <Wallet className="w-8 h-8 text-silver" />
                        <div>
                            <p className="text-silver-dark text-sm">{t("Balance")}</p>
                            <p className={`text-2xl font-bold ${balance >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                Rp {balance.toLocaleString('id-ID')}
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Data Table */}
            <DataTable
                data={finance.sort((a, b) => new Date(b.date) - new Date(a.date))}
                columns={columns}
                onEdit={handleOpenModal}
                onRemove={handleRemove}
                searchPlaceholder="Search transactions..."
                emptyMessage="No transactions found. Click 'Add Transaction' to get started."
            />

            {/* Modal */}
            <Modal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                title={editingTransaction ? 'Edit Transaction' : 'Add New Transaction'}
            >
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-silver-dark mb-2">
                                {t("Type *")}
                            </label>
                            <select
                                required
                                value={formData.type}
                                onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                                className="w-full"
                            >
                                {types.map((type) => (
                                    <option key={type} value={type}>
                                        {type.charAt(0).toUpperCase() + type.slice(1)}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-silver-dark mb-2">
                                {t("Category *")}
                            </label>
                            <select
                                required
                                value={formData.category}
                                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                                className="w-full"
                            >
                                <option value="">{t("Select category")}</option>
                                {categories.map((cat) => (
                                    <option key={cat} value={cat}>
                                        {cat}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-silver-dark mb-2">
                                {t("Quantity *")}
                            </label>
                            <input
                                type="number"
                                required
                                min="0"
                                step="0.01"
                                value={formData.amount}
                                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                                placeholder="0.00"
                                className="w-full"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-silver-dark mb-2">
                                {t("Date *")}
                            </label>
                            <input
                                type="date"
                                required
                                value={formData.date}
                                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                                className="w-full"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-silver-dark mb-2">
                            {t("Module")}
                        </label>
                        <select
                            value={formData.module}
                            onChange={(e) => setFormData({ ...formData, module: e.target.value })}
                            className="w-full"
                        >
                            {modules.map((mod) => (
                                <option key={mod} value={mod}>
                                    {mod.charAt(0).toUpperCase() + mod.slice(1)}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-silver-dark mb-2">
                            {t("Description")}
                        </label>
                        <textarea
                            value={formData.description}
                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                            placeholder={t("Enter transaction description")}
                            rows={3}
                            className="w-full"
                        />
                    </div>

                    <div className="flex justify-end gap-3 mt-6">
                        <Button type="button" variant="secondary" onClick={() => setIsModalOpen(false)}>
                            {t("Cancel")}
                        </Button>
                        <Button type="submit">
                            {editingTransaction ? 'Update' : 'Create'} {t("Transaction")}
                        </Button>
                    </div>
                </form>
            </Modal>
        </div>
    );
};

export default Finance;
