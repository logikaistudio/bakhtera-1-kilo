import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { Search, Building2, User, ChevronDown } from 'lucide-react';

/**
 * PartnerPicker - Universal component for selecting business partners
 * @param {Object} props
 * @param {string} props.value - Selected partner ID
 * @param {function} props.onChange - Callback when partner selected
 * @param {string} props.roleFilter - Filter by role: 'customer', 'vendor', 'agent', 'transporter', 'all'
 * @param {string} props.placeholder - Placeholder text
 * @param {boolean} props.required - Is field required
 * @param {string} props.size - Size: 'sm', 'md', 'lg'
 * @param {function} props.onPartnerLoad - Callback to get full partner data after selection
 */
const PartnerPicker = ({
    value,
    onChange,
    roleFilter = 'all',
    placeholder = 'Pilih Mitra...',
    required = false,
    size = 'md',
    theme = 'dark',
    onPartnerLoad
}) => {
    const [partners, setPartners] = useState([]);
    const [loading, setLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [isOpen, setIsOpen] = useState(false);
    const [selectedPartner, setSelectedPartner] = useState(null);
    const searchDebounce = useRef(null);

    // Load selected partner by ID on mount / value change
    useEffect(() => {
        if (!value) return;
        const existing = partners.find(p => p.id === value);
        if (existing) {
            setSelectedPartner(existing);
            if (onPartnerLoad) onPartnerLoad(existing);
        } else {
            // Fetch specific partner by ID if not in current list
            supabase
                .from('blink_business_partners')
                .select('*')
                .eq('id', value)
                .single()
                .then(({ data }) => {
                    if (data) {
                        setSelectedPartner(data);
                        if (onPartnerLoad) onPartnerLoad(data);
                    }
                });
        }
    }, [value]);

    // Server-side search: fetch when searchTerm changes (debounced)
    useEffect(() => {
        if (!isOpen) return;
        if (searchDebounce.current) clearTimeout(searchDebounce.current);
        searchDebounce.current = setTimeout(() => {
            fetchPartners(searchTerm);
        }, 300);
        return () => clearTimeout(searchDebounce.current);
    }, [searchTerm, isOpen, roleFilter]);

    // When dropdown opens, do initial fetch
    useEffect(() => {
        if (isOpen) fetchPartners('');
    }, [isOpen]);

    const fetchPartners = async (search) => {
        try {
            setLoading(true);
            let query = supabase
                .from('blink_business_partners')
                .select('*')
                .eq('status', 'active');

            if (roleFilter !== 'all') {
                query = query.eq(`is_${roleFilter}`, true);
            }

            if (search && search.trim().length > 0) {
                query = query.ilike('partner_name', `%${search.trim()}%`);
            }

            const { data, error } = await query.order('partner_name').limit(200);

            if (error) throw error;
            setPartners(data || []);
        } catch (error) {
            console.error('❌ PartnerPicker: Error fetching partners:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSelect = (partner) => {
        setSelectedPartner(partner);
        onChange(partner.id);
        setIsOpen(false);
        setSearchTerm('');
        if (onPartnerLoad) {
            onPartnerLoad(partner);
        }
    };

    // Sanitize partner_name: remove carriage-return/newline characters
    // that come from bulk-imported data (e.g. "EMO TRANS MIAMI\r\nEMOMIA")
    const cleanName = (name) => {
        if (!name) return '';
        // Split on \r\n or \n, take only the first line (actual company name)
        return name.split(/\r?\n/)[0].trim();
    };

    const filteredPartners = partners;

    const sizeClasses = {
        sm: 'text-xs py-1.5 px-2',
        md: 'text-sm py-2 px-3',
        lg: 'text-base py-3 px-4'
    };

    const getRoleBadges = (partner) => {
        const roles = [];
        if (partner.is_customer) roles.push('Cust');
        if (partner.is_vendor) roles.push('Vend');
        if (partner.is_agent) roles.push('Agent');
        if (partner.is_consignee) roles.push('Consignee');
        if (partner.is_shipper) roles.push('Shipper');
        if (partner.is_transporter) roles.push('Transp');
        return roles.join(', ');
    };

    return (
        <div className="relative">
            {/* Display Field */}
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className={`w-full border rounded-lg text-left flex items-center justify-between ${sizeClasses[size]} 
                ${theme === 'light' ? 'border-gray-300' : 'bg-dark-surface border-dark-border text-silver-light'} 
                ${!selectedPartner && theme !== 'light' ? 'text-silver-dark' : ''}`}
                style={theme === 'light' ? { backgroundColor: '#ffffff', color: !selectedPartner ? '#9ca3af' : '#1f2937' } : {}}
            >
                <div className="flex items-center gap-2 flex-1 min-w-0">
                    {selectedPartner ? (
                        <>
                            {selectedPartner.partner_type === 'company' ? (
                                <Building2 className={`w-4 h-4 flex-shrink-0 ${theme === 'light' ? 'text-gray-500' : 'text-silver-dark'}`} />
                            ) : (
                                <User className={`w-4 h-4 flex-shrink-0 ${theme === 'light' ? 'text-gray-500' : 'text-silver-dark'}`} />
                            )}
                            <span className="truncate">{cleanName(selectedPartner.partner_name)}</span>
                            <span className="text-xs text-blue-500 font-mono flex-shrink-0">
                                {getRoleBadges(selectedPartner)}
                            </span>
                        </>
                    ) : (
                        <span>{placeholder}</span>
                    )}
                </div>
                <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''} ${theme === 'light' ? 'text-gray-500' : 'text-silver-dark'}`} />
            </button>

            {/* Dropdown */}
            {isOpen && (
                <div
                    className={`absolute z-50 mt-1 w-full border rounded-lg shadow-xl max-h-80 overflow-hidden 
                    ${theme === 'light' ? 'border-gray-300' : 'bg-dark-card border-dark-border'}`}
                    style={theme === 'light' ? { backgroundColor: '#ffffff' } : {}}
                >
                    {/* Search */}
                    <div
                        className={`p-2 border-b sticky top-0 ${theme === 'light' ? 'border-gray-200' : 'border-dark-border bg-dark-card'}`}
                        style={theme === 'light' ? { backgroundColor: '#ffffff' } : {}}
                    >
                        <div className="relative">
                            <Search className={`absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 ${theme === 'light' ? 'text-gray-400' : 'text-silver-dark'}`} />
                            <input
                                type="text"
                                placeholder="Search mitra..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className={`w-full pl-8 pr-3 py-1.5 border rounded text-sm outline-none
                                ${theme === 'light' ? 'border-gray-300 focus:border-blue-500' : 'bg-dark-surface border-dark-border text-silver-light'}`}
                                style={theme === 'light' ? { backgroundColor: '#f9fafb', color: '#1f2937' } : {}}
                                autoFocus
                            />
                        </div>
                    </div>

                    {/* List */}
                    <div className="overflow-y-auto max-h-64">
                        {loading ? (
                            <div className={`p-4 text-center text-sm ${theme === 'light' ? 'text-gray-500' : 'text-silver-dark'}`}>Loading...</div>
                        ) : filteredPartners.length === 0 ? (
                            <div className={`p-4 text-center text-sm ${theme === 'light' ? 'text-gray-500' : 'text-silver-dark'}`}>
                                {searchTerm ? 'Tidak ditemukan' : 'Belum ada mitra'}
                            </div>
                        ) : (
                            filteredPartners.map(partner => (
                                <button
                                    key={partner.id}
                                    type="button"
                                    onClick={() => handleSelect(partner)}
                                    className={`w-full px-3 py-2 transition-colors text-left border-b last:border-0 
                                    ${theme === 'light' ? 'border-gray-100' : 'border-dark-border/50 hover:bg-dark-surface'}`}
                                    style={theme === 'light' ? { backgroundColor: '#ffffff' } : {}}
                                    onMouseEnter={theme === 'light' ? (e) => { e.currentTarget.style.backgroundColor = '#eff6ff'; } : undefined}
                                    onMouseLeave={theme === 'light' ? (e) => { e.currentTarget.style.backgroundColor = '#ffffff'; } : undefined}
                                >
                                    <div className="flex items-center gap-2">
                                        {partner.partner_type === 'company' ? (
                                            <Building2 className={`w-4 h-4 flex-shrink-0 ${theme === 'light' ? 'text-gray-400' : 'text-silver-dark'}`} />
                                        ) : (
                                            <User className={`w-4 h-4 flex-shrink-0 ${theme === 'light' ? 'text-gray-400' : 'text-silver-dark'}`} />
                                        )}
                                        <div className="flex-1 min-w-0">
                                            <p className={`text-sm font-medium truncate ${theme !== 'light' ? 'text-silver-light' : ''}`}
                                                style={theme === 'light' ? { color: '#1f2937' } : {}}>
                                                {cleanName(partner.partner_name)}
                                            </p>
                                            <div className="flex items-center gap-2 mt-0.5">
                                                <span className={`text-xs font-mono ${theme === 'light' ? 'text-gray-500' : 'text-silver-dark'}`}>{partner.partner_code}</span>
                                                <span className="text-xs text-blue-500 font-bold">{getRoleBadges(partner)}</span>
                                            </div>
                                        </div>
                                    </div>
                                </button>
                            ))
                        )}
                    </div>

                    {/* Footer Info */}
                    <div
                        className={`p-2 border-t text-[10px] 
                        ${theme === 'light' ? 'border-gray-200' : 'border-dark-border bg-dark-surface/50 text-silver-dark'}`}
                        style={theme === 'light' ? { backgroundColor: '#f9fafb', color: '#6b7280' } : {}}
                    >
                        <p>Tip: Cust=Customer, Vend=Vendor, Agent=Agent, Consignee=Consignee, Shipper=Shipper, Transp=Transporter</p>
                    </div>
                </div>
            )}

            {/* Overlay to close dropdown */}
            {isOpen && (
                <div
                    className="fixed inset-0 z-40"
                    onClick={() => setIsOpen(false)}
                />
            )}
        </div>
    );
};

export default PartnerPicker;
