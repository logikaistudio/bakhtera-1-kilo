import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { ChevronDown, Search, X, FolderOpen } from 'lucide-react';

/**
 * COAPicker - Reusable Chart of Accounts dropdown with smart filtering
 * 
 * @param {string} value - Current COA ID
 * @param {function} onChange - Callback (coaId, coaData) => void
 * @param {string} context - 'AR' | 'AP' | 'GENERAL' | 'ASSET'
 * @param {number} minLevel - Minimum level filter (default: 1)
 * @param {string} placeholder - Custom placeholder text
 * @param {string} className - Additional CSS classes
 * @param {boolean} disabled - Disable the picker
 * @param {boolean} showCode - Show code in display (default: true)
 * @param {string} size - 'sm' | 'md' (default: 'sm')
 */
const COAPicker = ({
    value,
    onChange,
    context = 'GENERAL',
    minLevel = 1,
    placeholder = '-- Pilih Akun --',
    className = '',
    disabled = false,
    showCode = true,
    size = 'sm'
}) => {
    const [accounts, setAccounts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedAccount, setSelectedAccount] = useState(null);
    const dropdownRef = useRef(null);
    const searchInputRef = useRef(null);

    // State for Group Mode
    const [isGroupMode, setIsGroupMode] = useState(false);
    const [expandedGroups, setExpandedGroups] = useState({});

    // Toggle Group Mode
    const toggleGroupMode = () => {
        setIsGroupMode(!isGroupMode);
        // Optional: Collapse all when entering group mode
        if (!isGroupMode) {
            setExpandedGroups({});
        }
    };

    // Toggle Specific Group
    const toggleGroup = (groupName) => {
        if (!isGroupMode) return;
        setExpandedGroups(prev => ({
            ...prev,
            [groupName]: !prev[groupName]
        }));
    };

    // Determine filter types based on context
    const getFilterConfig = () => {
        switch (context) {
            case 'AR':
                return {
                    types: ['REVENUE'],
                    flagField: 'is_ar',
                    flagValue: true
                };
            case 'AP':
                return {
                    types: ['EXPENSE'],
                    flagField: 'is_ap',
                    flagValue: true
                };
            case 'EXPENSE':
                return {
                    types: ['EXPENSE', 'COGS'],
                    flagField: null,
                    flagValue: null
                };
            case 'COGS':
                return {
                    // Include ALL possible types so kepala-5 accounts are never excluded by type filter
                    types: ['ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE', 'COGS', 'COST', 'DIRECT_COST', 'OTHER_INCOME', 'OTHER_EXPENSE'],
                    flagField: null,
                    flagValue: null,
                    codePrefix: '5',
                    skipTypeFilter: true  // when codePrefix covers the filter, skip type filtering
                };
            case 'ASSET':
                return {
                    types: ['ASSET'],
                    flagField: null,
                    flagValue: null
                };
            case 'LIABILITY':
                return {
                    types: ['LIABILITY'],
                    flagField: null,
                    flagValue: null
                };
            case 'GENERAL':
            default:
                return {
                    types: ['ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE'],
                    flagField: null,
                    flagValue: null
                };
        }
    };

    // Fetch accounts based on context
    useEffect(() => {
        const fetchAccounts = async () => {
            try {
                setLoading(true);
                const config = getFilterConfig();

                let query = supabase
                    .from('finance_coa')
                    .select('*')
                    .eq('is_active', true)
                    .gte('level', minLevel)
                    .order('code', { ascending: true });

                // Apply type filter only when NOT using codePrefix as primary filter
                if (!config.skipTypeFilter) {
                    query = query.in('type', config.types);
                }

                // Apply additional flag filter if specified
                if (config.flagField && config.flagValue !== null) {
                    query = query.eq(config.flagField, config.flagValue);
                }

                // Apply code prefix filter if specified (e.g. '5' for kepala 5 COGS accounts)
                if (config.codePrefix) {
                    query = query.like('code', `${config.codePrefix}%`);
                }

                const { data, error } = await query;

                if (error) throw error;
                setAccounts(data || []);

                // Find and set selected account if value exists
                if (value && data) {
                    const selected = data.find(acc => acc.id === value);
                    setSelectedAccount(selected || null);
                }
            } catch (error) {
                console.error('COAPicker: Error fetching accounts:', error);
                setAccounts([]);
            } finally {
                setLoading(false);
            }
        };

        fetchAccounts();
    }, [context, minLevel]);

    // Update selected account when value changes
    useEffect(() => {
        if (value && accounts.length > 0) {
            const selected = accounts.find(acc => acc.id === value);
            setSelectedAccount(selected || null);
        } else if (!value) {
            setSelectedAccount(null);
        }
    }, [value, accounts]);

    // Close dropdown on outside click
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsOpen(false);
                setSearchTerm('');
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Focus search input when dropdown opens
    useEffect(() => {
        if (isOpen && searchInputRef.current) {
            setTimeout(() => searchInputRef.current?.focus(), 100);
        }
    }, [isOpen]);

    // Filter accounts by search term
    const filteredAccounts = accounts.filter(acc => {
        if (!searchTerm) return true;
        const term = searchTerm.toLowerCase();
        return (
            acc.code.toLowerCase().includes(term) ||
            acc.name.toLowerCase().includes(term) ||
            (acc.group_name && acc.group_name.toLowerCase().includes(term))
        );
    });

    // Group accounts by group_name for better UX
    const groupedAccounts = filteredAccounts.reduce((groups, acc) => {
        const groupName = acc.group_name || acc.type || 'Other';
        if (!groups[groupName]) {
            groups[groupName] = [];
        }
        groups[groupName].push(acc);
        return groups;
    }, {});

    // Handle account selection
    const handleSelect = (account) => {
        setSelectedAccount(account);
        setIsOpen(false);
        setSearchTerm('');
        if (onChange) {
            onChange(account.id, account);
        }
    };

    // Handle clear selection
    const handleClear = (e) => {
        e.stopPropagation();
        setSelectedAccount(null);
        if (onChange) {
            onChange(null, null);
        }
    };

    // Size classes - smaller font for efficiency
    const sizeClasses = size === 'sm'
        ? 'text-[11px] py-1 px-2'
        : 'text-xs py-1.5 px-3';

    // Get type color for badge
    const getTypeColor = (type) => {
        switch (type) {
            case 'ASSET': return 'text-blue-400';
            case 'LIABILITY': return 'text-orange-400';
            case 'EQUITY': return 'text-purple-400';
            case 'REVENUE': return 'text-green-400';
            case 'EXPENSE': return 'text-red-400';
            default: return 'text-silver-dark';
        }
    };

    return (
        <div ref={dropdownRef} className={`relative ${className}`}>
            {/* Trigger Button */}
            <button
                type="button"
                onClick={() => !disabled && setIsOpen(!isOpen)}
                disabled={disabled}
                className={`w-full flex items-center justify-between gap-2 bg-dark-surface border border-dark-border rounded 
                    ${sizeClasses} text-left transition-colors
                    ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:border-accent-blue cursor-pointer'}
                    ${isOpen ? 'border-accent-blue ring-1 ring-accent-blue/30' : ''}`}
            >
                <span className={`break-words leading-tight ${selectedAccount ? 'text-silver-light' : 'text-silver-dark'}`}>
                    {loading ? (
                        'Loading...'
                    ) : selectedAccount ? (
                        showCode
                            ? `${selectedAccount.code} - ${selectedAccount.name}`
                            : selectedAccount.name
                    ) : (
                        placeholder
                    )}
                </span>
                <div className="flex items-center gap-1 flex-shrink-0">
                    {selectedAccount && !disabled && (
                        <X
                            className="w-3 h-3 text-silver-dark hover:text-white transition-colors"
                            onClick={handleClear}
                        />
                    )}
                    <ChevronDown className={`w-3 h-3 text-silver-dark transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                </div>
            </button>

            {/* Dropdown Panel - Light Theme for Better Visibility */}
            {isOpen && (
                <div className="absolute z-[9999] mt-1 bg-white border border-gray-300 rounded-lg shadow-2xl 
                    max-h-80 overflow-hidden animate-fadeIn flex flex-col" style={{ minWidth: '400px', width: 'max-content', maxWidth: '600px' }}>

                    {/* Search Input & Controls */}
                    <div className="p-3 border-b border-gray-200 bg-gray-50 flex gap-2 flex-shrink-0">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <input
                                ref={searchInputRef}
                                type="text"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                placeholder="Search kode atau nama akun..."
                                className="w-full pl-9 pr-4 py-2 bg-white border border-gray-300 rounded-lg 
                                    text-xs text-gray-800 placeholder-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all"
                            />
                        </div>
                        <button
                            type="button"
                            onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                toggleGroupMode();
                                // Focus input back after toggle so user can keep typing if needed
                                setTimeout(() => searchInputRef.current?.focus(), 50);
                            }}
                            className={`p-2 rounded-lg border transition-all flex-shrink-0 ${isGroupMode
                                ? 'bg-blue-100 border-blue-400 text-blue-700 shadow-sm ring-1 ring-blue-200'
                                : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-100 hover:text-gray-700'
                                }`}
                            title={isGroupMode ? "Switch to List View" : "Switch to Grouped View (Tree)"}
                        >
                            <FolderOpen className="w-4 h-4" />
                        </button>
                    </div>

                    {/* Account List */}
                    <div className="overflow-y-auto flex-1">
                        {Object.keys(groupedAccounts).length === 0 ? (
                            <div className="p-4 text-center text-gray-500 text-sm">
                                {searchTerm ? 'Tidak ditemukan' : 'Tidak ada akun tersedia'}
                            </div>
                        ) : (
                            Object.entries(groupedAccounts).map(([groupName, groupAccounts]) => {
                                const isExpanded = expandedGroups[groupName];
                                const shouldShow = !isGroupMode || isExpanded || searchTerm;

                                return (
                                    <div key={groupName} className={isGroupMode ? 'border-b border-gray-100 last:border-0' : ''}>
                                        {/* Group Header */}
                                        <button
                                            type="button"
                                            onClick={(e) => {
                                                if (isGroupMode) {
                                                    e.preventDefault();
                                                    e.stopPropagation();
                                                    toggleGroup(groupName);
                                                }
                                            }}
                                            className={`w-full px-4 py-2 bg-blue-50 border-b border-blue-100 
                                                flex items-center gap-2 sticky top-0 hover:bg-blue-100 transition-colors
                                                ${!isGroupMode ? 'cursor-default pointer-events-none' : 'cursor-pointer hover:bg-blue-200/50'}`}
                                        >
                                            <FolderOpen className={`w-4 h-4 text-blue-600 transition-transform duration-200 ${isGroupMode && isExpanded ? 'rotate-0' : ''}`} />
                                            <span className="text-xs font-bold text-blue-800 uppercase tracking-wide flex-1 text-left">
                                                {groupName}
                                            </span>
                                            <div className="flex items-center gap-2">
                                                <span className="text-[10px] font-bold text-blue-600 bg-blue-200/50 px-1.5 py-0.5 rounded-full border border-blue-200">
                                                    {groupAccounts.length}
                                                </span>
                                                {isGroupMode && (
                                                    <ChevronDown className={`w-3 h-3 text-blue-500 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                                                )}
                                            </div>
                                        </button>

                                        {/* Group Items */}
                                        {shouldShow && (
                                            <div className="bg-white">
                                                {groupAccounts.map((acc) => (
                                                    <button
                                                        key={acc.id}
                                                        type="button"
                                                        onClick={() => handleSelect(acc)}
                                                        className={`w-full px-4 py-2 text-left hover:bg-blue-50 
                                                            transition-colors flex items-center gap-3 border-b border-gray-50 last:border-0
                                                            ${selectedAccount?.id === acc.id ? 'bg-blue-100/50' : 'bg-white'}`}
                                                    >
                                                        <div className="flex flex-col items-start min-w-[32px] justify-center">
                                                            {acc.parent_code && (
                                                                <span className="text-[9px] text-gray-400 leading-none mb-0.5">
                                                                    {acc.parent_code}
                                                                </span>
                                                            )}
                                                            <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${acc.type === 'REVENUE' ? 'bg-green-100 text-green-700' :
                                                                acc.type === 'EXPENSE' ? 'bg-red-100 text-red-700' :
                                                                    acc.type === 'ASSET' ? 'bg-blue-100 text-blue-700' :
                                                                        acc.type === 'LIABILITY' ? 'bg-orange-100 text-orange-700' :
                                                                            'bg-gray-100 text-gray-600'
                                                                }`}>
                                                                L{acc.level || 1}
                                                            </span>
                                                        </div>
                                                        <span className="font-mono text-blue-700 font-semibold text-[11px] min-w-[80px]">
                                                            {acc.code}
                                                        </span>
                                                        <span className="text-gray-800 text-[11px] flex-1 leading-tight">
                                                            {acc.name}
                                                        </span>
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default COAPicker;
