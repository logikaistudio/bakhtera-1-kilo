import React, { useState } from 'react';
import { useData } from '../../../context/DataContext';
import DataTable from '../../../components/Common/DataTable';
import Modal from '../../../components/Common/Modal';
import Button from '../../../components/Common/Button';
import { Plus, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../../../i18n/LanguageContext';

// Currency formatter for Indonesian format (xxx.xxx.xxx)
const formatCurrency = (value) => {
    const num = parseFloat(value) || 0;
    return num.toLocaleString('id-ID', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
};

const EventManagement = () => {
    const { t } = useLanguage();
    const { events, addEvent, updateEvent, deleteEvent, customers } = useData();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingEvent, setEditingEvent] = useState(null);
    const [formData, setFormData] = useState({
        event_name: '',
        event_date: '',
        venue: '',
        client_id: '',
        description: '',
        status: 'planning',
    });

    const navigate = useNavigate();
    const statuses = ['planning', 'confirmed', 'ongoing', 'completed'];

    const handleOpenModal = (event = null) => {
        if (event) {
            setEditingEvent(event);
            setFormData({
                event_name: event.event_name || '',
                event_date: event.event_date || '',
                venue: event.venue || '',
                client_id: event.client_id || '',
                description: event.description || '',
                status: event.status || 'planning',
            });
        } else {
            setEditingEvent(null);
            setFormData({
                event_name: '',
                event_date: '',
                venue: '',
                client_id: '',
                description: '',
                status: 'planning',
            });
        }
        setIsModalOpen(true);
    };

    const handleSubmit = (e) => {
        e.preventDefault();

        const eventData = {
            event_name: formData.event_name,
            event_date: formData.event_date || null,
            venue: formData.venue,
            client_id: formData.client_id || null,
            description: formData.description,
            status: formData.status,
        };

        if (editingEvent) {
            updateEvent(editingEvent.id, eventData);
        } else {
            addEvent(eventData);
        }
        setIsModalOpen(false);
    };

    const handleRemove = (event) => {
        if (window.confirm(`Are you sure you want to delete ${event.event_name}?`)) {
            deleteEvent(event.id);
        }
    };

    // Get customer name by id
    const getCustomerName = (clientId) => {
        const customer = customers.find(c => c.id === clientId);
        return customer?.name || '-';
    };

    const columns = [
        { header: 'Event Name', key: 'event_name' },
        {
            header: 'Date',
            key: 'event_date',
            render: (row) => row.event_date ? new Date(row.event_date).toLocaleDateString('id-ID') : '-',
        },
        { header: 'Venue', key: 'venue' },
        {
            header: 'Customer',
            key: 'client_id',
            render: (row) => getCustomerName(row.client_id),
        },
        {
            header: 'Status',
            key: 'status',
            render: (row) => (
                <span
                    className={`px-2 py-1 rounded-full text-xs font-medium ${row.status === 'completed'
                        ? 'bg-green-500/20 text-green-400'
                        : row.status === 'ongoing'
                            ? 'bg-purple-500/20 text-purple-400'
                            : row.status === 'confirmed'
                                ? 'bg-blue-500/20 text-blue-400'
                                : 'bg-yellow-500/20 text-yellow-400'
                        }`}
                >
                    {row.status}
                </span>
            ),
        },
    ];

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center gap-4 mb-6">
                <button
                    onClick={() => navigate('/big')}
                    className="p-2 rounded-lg hover:bg-dark-surface smooth-transition text-silver-dark hover:text-silver"
                >
                    <ArrowLeft className="w-5 h-5" />
                </button>
                <div className="flex-1">
                    <h1 className="text-4xl font-bold gradient-text mb-2">{t("Event Management")}</h1>
                    <p className="text-silver-dark">{t("Manage events and scheduling")}</p>
                </div>
                <Button onClick={() => handleOpenModal()} icon={Plus}>
                    {t("Add Event")}
                </Button>
            </div>

            {/* Data Table */}
            <DataTable
                data={events}
                columns={columns}
                onRowClick={handleOpenModal}
                searchPlaceholder="Search events..."
                emptyMessage="No events found. Click 'Add Event' to get started."
            />

            {/* Modal */}
            <Modal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                title={editingEvent ? 'Edit Event' : 'Add New Event'}
            >
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-silver-dark mb-2">
                            {t("Event Name *")}
                        </label>
                        <input
                            type="text"
                            required
                            value={formData.event_name}
                            onChange={(e) => setFormData({ ...formData, event_name: e.target.value })}
                            placeholder={t("Enter event name")}
                            className="w-full"
                        />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-silver-dark mb-2">
                                {t("Date")}
                            </label>
                            <input
                                type="date"
                                value={formData.event_date}
                                onChange={(e) => setFormData({ ...formData, event_date: e.target.value })}
                                className="w-full"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-silver-dark mb-2">
                                {t("Venue")}
                            </label>
                            <input
                                type="text"
                                value={formData.venue}
                                onChange={(e) => setFormData({ ...formData, venue: e.target.value })}
                                placeholder={t("Event venue")}
                                className="w-full"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-silver-dark mb-2">
                            {t("Customer")}
                        </label>
                        <select
                            value={formData.client_id}
                            onChange={(e) => setFormData({ ...formData, client_id: e.target.value })}
                            className="w-full"
                        >
                            <option value="">{t("Select customer")}</option>
                            {customers.map((customer) => (
                                <option key={customer.id} value={customer.id}>
                                    {customer.name}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-silver-dark mb-2">
                            {t("Status *")}
                        </label>
                        <select
                            required
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

                    <div>
                        <label className="block text-sm font-medium text-silver-dark mb-2">
                            {t("Description")}
                        </label>
                        <textarea
                            value={formData.description}
                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                            placeholder={t("Event details and description")}
                            rows={3}
                            className="w-full"
                        />
                    </div>

                    <div className="flex justify-between gap-3 mt-6">
                        {editingEvent ? (
                            <Button
                                type="button"
                                variant="danger"
                                onClick={() => {
                                    if (window.confirm(`Are you sure you want to delete ${editingEvent.event_name}?`)) {
                                        deleteEvent(editingEvent.id);
                                        setIsModalOpen(false);
                                    }
                                }}
                            >
                                {t("Delete")}
                            </Button>
                        ) : <div />}
                        <div className="flex gap-3">
                            <Button type="button" variant="secondary" onClick={() => setIsModalOpen(false)}>
                                {t("Cancel")}
                            </Button>
                            <Button type="submit">{editingEvent ? 'Update' : 'Create'} {t("Event")}</Button>
                        </div>
                    </div>
                </form>
            </Modal>
        </div>
    );
};

export default EventManagement;
