import React, { useState } from 'react';
import { FileText, Search, Plus, Minus, Edit, Trash2, Activity } from 'lucide-react';
import { useData } from '../../context/DataContext';
import { useLanguage } from '../../i18n/LanguageContext';

const ActivityLogger = () => {
    const { t } = useLanguage();
    const { activityLogs = [] } = useData();
    const [searchTerm, setSearchTerm] = useState('');
    const [filterAction, setFilterAction] = useState('all');
    const [filterModule, setFilterModule] = useState('all');

    // Get unique modules for filter
    const uniqueModules = [...new Set(activityLogs.map(log => log.module))];

    // Filter logs
    const filteredLogs = activityLogs.filter(log => {
        const matchesSearch =
            log.entityName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            log.user?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            log.details?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            log.entityId?.toLowerCase().includes(searchTerm.toLowerCase());

        const matchesAction = filterAction === 'all' || log.action === filterAction;
        const matchesModule = filterModule === 'all' || log.module === filterModule;

        return matchesSearch && matchesAction && matchesModule;
    });

    // Action badge configuration
    const getActionConfig = (action) => {
        const configs = {
            add: {
                icon: Plus,
                color: 'text-accent-green',
                bg: 'bg-accent-green/20',
                label: 'Add'
            },
            edit: {
                icon: Edit,
                color: 'text-accent-blue',
                bg: 'bg-accent-blue/20',
                label: 'Edit'
            },
            delete: {
                icon: Trash2,
                color: 'text-red-400',
                bg: 'bg-red-500/20',
                label: 'Delete'
            }
        };
        return configs[action] || configs.add;
    };

    // Format timestamp
    const formatTimestamp = (timestamp) => {
        const date = new Date(timestamp);
        return {
            date: date.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }),
            time: date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
        };
    };

    return (
        <div className="p-6 space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-bold gradient-text">{t("Activity Logger")}</h1>
                <p className="text-silver-dark mt-1">{t("Audit log untuk semua perubahan data di Bridge")}</p>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="glass-card p-4 rounded-lg border border-accent-purple">
                    <div className="flex items-center gap-3">
                        <Activity className="w-10 h-10 text-accent-purple" />
                        <div>
                            <p className="text-xs text-silver-dark">{t("Total Activities")}</p>
                            <p className="text-2xl font-bold text-accent-purple">{activityLogs.length}</p>
                        </div>
                    </div>
                </div>
                <div className="glass-card p-4 rounded-lg border border-accent-green">
                    <div className="flex items-center gap-3">
                        <Plus className="w-10 h-10 text-accent-green" />
                        <div>
                            <p className="text-xs text-silver-dark">{t("Added")}</p>
                            <p className="text-2xl font-bold text-accent-green">
                                {activityLogs.filter(log => log.action === 'add').length}
                            </p>
                        </div>
                    </div>
                </div>
                <div className="glass-card p-4 rounded-lg border border-accent-blue">
                    <div className="flex items-center gap-3">
                        <Edit className="w-10 h-10 text-accent-blue" />
                        <div>
                            <p className="text-xs text-silver-dark">{t("Edited")}</p>
                            <p className="text-2xl font-bold text-accent-blue">
                                {activityLogs.filter(log => log.action === 'edit').length}
                            </p>
                        </div>
                    </div>
                </div>
                <div className="glass-card p-4 rounded-lg border border-red-500">
                    <div className="flex items-center gap-3">
                        <Trash2 className="w-10 h-10 text-red-400" />
                        <div>
                            <p className="text-xs text-silver-dark">{t("Deleted")}</p>
                            <p className="text-2xl font-bold text-red-400">
                                {activityLogs.filter(log => log.action === 'delete').length}
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Filters */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Search */}
                <div className="glass-card p-4 rounded-lg">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-silver-dark" />
                        <input
                            type="text"
                            placeholder={t("Cari aktivitas, user, atau detail...")}
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 bg-dark-surface border border-dark-border rounded-lg text-silver-light focus:border-accent-blue focus:outline-none"
                        />
                    </div>
                </div>

                {/* Action Filter */}
                <div className="glass-card p-4 rounded-lg">
                    <select
                        value={filterAction}
                        onChange={(e) => setFilterAction(e.target.value)}
                        className="w-full px-4 py-2 bg-dark-surface border border-dark-border rounded-lg text-silver-light focus:border-accent-blue focus:outline-none"
                    >
                        <option value="all">{t("Semua Aksi")}</option>
                        <option value="add">{t("Add")}</option>
                        <option value="edit">{t("Edit")}</option>
                        <option value="delete">{t("Delete")}</option>
                    </select>
                </div>

                {/* Module Filter */}
                <div className="glass-card p-4 rounded-lg">
                    <select
                        value={filterModule}
                        onChange={(e) => setFilterModule(e.target.value)}
                        className="w-full px-4 py-2 bg-dark-surface border border-dark-border rounded-lg text-silver-light focus:border-accent-blue focus:outline-none"
                    >
                        <option value="all">{t("Semua Module")}</option>
                        {uniqueModules.map(module => (
                            <option key={module} value={module}>{module}</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Activity Log Table */}
            <div className="glass-card rounded-lg overflow-hidden">
                <div className="p-4 border-b border-dark-border">
                    <div className="flex items-center gap-2">
                        <FileText className="w-5 h-5 text-accent-purple" />
                        <h2 className="text-lg font-semibold text-silver-light">{t("Activity Logs")}</h2>
                        <span className="ml-auto text-sm text-silver-dark">{filteredLogs.length} {t("entries")}</span>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-accent-purple/10">
                            <tr>
                                <th className="px-4 py-3 text-center text-xs font-semibold text-silver">No</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-silver">{t("Timestamp")}</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-silver">{t("Module")}</th>
                                <th className="px-4 py-3 text-center text-xs font-semibold text-silver">{t("Action")}</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-silver">{t("Entity Type")}</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-silver">{t("Entity ID")}</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-silver">{t("Entity Name")}</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-silver">{t("User")}</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-silver">{t("Details")}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-dark-border">
                            {filteredLogs.length === 0 ? (
                                <tr>
                                    <td colSpan="9" className="px-4 py-12 text-center">
                                        <Activity className="w-16 h-16 mx-auto mb-4 opacity-30 text-silver-dark" />
                                        <p className="text-lg text-silver-dark">{t("Tidak ada activity log")}</p>
                                        <p className="text-sm text-silver-dark mt-2">{t("Activity akan muncul di sini")}</p>
                                    </td>
                                </tr>
                            ) : (
                                filteredLogs.map((log, idx) => {
                                    const actionConfig = getActionConfig(log.action);
                                    const ActionIcon = actionConfig.icon;
                                    const { date, time } = formatTimestamp(log.timestamp);

                                    return (
                                        <tr key={log.id} className="hover:bg-dark-surface/50 smooth-transition">
                                            <td className="px-4 py-3 text-sm text-center text-silver-light font-medium">
                                                {idx + 1}
                                            </td>
                                            <td className="px-4 py-3 text-sm text-silver-light">
                                                <div className="flex flex-col">
                                                    <span className="font-medium">{date}</span>
                                                    <span className="text-xs text-silver-dark">{time}</span>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-sm text-silver-light">
                                                <span className="px-2 py-1 bg-accent-purple/20 text-accent-purple text-xs rounded">
                                                    {log.module}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${actionConfig.bg} ${actionConfig.color}`}>
                                                    <ActionIcon className="w-3 h-3" />
                                                    {actionConfig.label}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-sm text-silver-light">{log.entityType}</td>
                                            <td className="px-4 py-3 text-sm text-accent-blue font-mono text-xs">{log.entityId}</td>
                                            <td className="px-4 py-3 text-sm text-silver-light font-medium max-w-xs truncate">
                                                {log.entityName}
                                            </td>
                                            <td className="px-4 py-3 text-sm text-silver-light">{log.user}</td>
                                            <td className="px-4 py-3 text-sm text-silver-dark max-w-xs truncate">
                                                {log.details}
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default ActivityLogger;
