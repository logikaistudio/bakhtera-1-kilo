import React, { useState } from 'react';
import { Search, Edit2, Trash2, Eye } from 'lucide-react';
import Button from './Button';
import { useLanguage } from '../../i18n/LanguageContext';

const DataTable = ({
    data = [],
    columns = [],
    onView,
    onEdit,
    onRemove,
    onRowClick,
    searchable = true,
    searchPlaceholder = 'Search...',
    emptyMessage = 'No data available'
}) => {
    const { t } = useLanguage();
    const [searchTerm, setSearchTerm] = useState('');

    const filteredData = searchable
        ? data.filter(item =>
            Object.values(item).some(value =>
                String(value).toLowerCase().includes(searchTerm.toLowerCase())
            )
        )
        : data;

    return (
        <div className="space-y-4">
            {/* Search */}
            {searchable && (
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-silver-dark" />
                    <input
                        type="text"
                        placeholder={searchPlaceholder}
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-3 rounded-lg bg-dark-surface border border-dark-border text-silver-light focus:border-silver smooth-transition"
                    />
                </div>
            )}

            {/* Table */}
            <div className="glass-card rounded-lg overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-dark-surface">
                            <tr>
                                {columns.map((column, index) => (
                                    <th
                                        key={index}
                                        className="px-6 py-4 text-left text-sm font-semibold text-silver uppercase tracking-wider"
                                    >
                                        {column.header}
                                    </th>
                                ))}
                                {(onView || onEdit || onRemove) && !onRowClick && (
                                    <th className="px-6 py-4 text-right text-sm font-semibold text-silver uppercase tracking-wider">
                                        {t("Actions")}
                                    </th>
                                )}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-dark-border">
                            {filteredData.length === 0 ? (
                                <tr>
                                    <td
                                        colSpan={columns.length + (onView || onEdit || onRemove ? 1 : 0)}
                                        className="px-6 py-12 text-center text-silver-dark"
                                    >
                                        {emptyMessage}
                                    </td>
                                </tr>
                            ) : (
                                filteredData.map((row, rowIndex) => (
                                    <tr
                                        key={rowIndex}
                                        className={`hover:bg-dark-surface smooth-transition ${onRowClick ? 'cursor-pointer' : ''}`}
                                        onClick={onRowClick ? () => onRowClick(row) : undefined}
                                    >
                                        {columns.map((column, colIndex) => (
                                            <td
                                                key={colIndex}
                                                className="px-6 py-4 text-sm text-silver-light whitespace-nowrap"
                                            >
                                                {column.render ? column.render(row) : row[column.key]}
                                            </td>
                                        ))}
                                        {(onView || onEdit || onRemove) && !onRowClick && (
                                            <td className="px-6 py-4 text-right whitespace-nowrap">
                                                <div className="flex items-center justify-end gap-2">
                                                    {onView && (
                                                        <button
                                                            onClick={() => onView(row)}
                                                            className="p-2 rounded-lg hover:bg-dark-card smooth-transition text-silver-dark hover:text-silver"
                                                            title={t("View")}
                                                        >
                                                            <Eye className="w-4 h-4" />
                                                        </button>
                                                    )}
                                                    {onEdit && (
                                                        <button
                                                            onClick={() => onEdit(row)}
                                                            className="p-2 rounded-lg hover:bg-dark-card smooth-transition text-silver-dark hover:text-silver"
                                                            title={t("Edit")}
                                                        >
                                                            <Edit2 className="w-4 h-4" />
                                                        </button>
                                                    )}
                                                    {onRemove && (
                                                        <button
                                                            onClick={() => onRemove(row)}
                                                            className="p-2 rounded-lg hover:bg-dark-card smooth-transition text-silver-dark hover:text-red-500"
                                                            title={t("Remove")}
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        )}
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default DataTable;
