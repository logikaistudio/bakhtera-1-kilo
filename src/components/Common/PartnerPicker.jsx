import React, { useState, useEffect } from 'react';
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
    onPartnerLoad
}) => {
    const [partners, setPartners] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [isOpen, setIsOpen] = useState(false);
    const [selectedPartner, setSelectedPartner] = useState(null);

    useEffect(() => {
        fetchPartners();
    }, [roleFilter]);

    useEffect(() => {
        if (value && partners.length > 0) {
            const partner = partners.find(p => p.id === value);
            setSelectedPartner(partner);
            if (partner && onPartnerLoad) {
                onPartnerLoad(partner);
            }
        }
    }, [value, partners]);

    const fetchPartners = async () => {
        try {
            setLoading(true);
            console.log('🔍 PartnerPicker: Fetching partners with roleFilter:', roleFilter);

            let query = supabase
                .from('blink_business_partners')
                .select('*')
                .eq('status', 'active');

            // Apply role filter
            if (roleFilter !== 'all') {
                const roleColumn = `is_${roleFilter}`;
                console.log('🔍 PartnerPicker: Applying filter:', roleColumn, '= true');
                query = query.eq(roleColumn, true);
            }

            const { data, error } = await query.order('partner_name');

            if (error) {
                console.error('❌ PartnerPicker: Error fetching partners:', error);
                console.error('Error details:', {
                    message: error.message,
                    details: error.details,
                    hint: error.hint,
                    code: error.code
                });
                throw error;
            }

            console.log('✅ PartnerPicker: Successfully fetched', data?.length || 0, 'partners');
            setPartners(data || []);
        } catch (error) {
            console.error('❌ PartnerPicker: Catch block error:', error);
            // Show user-friendly error
            alert(`Failed to load partners: ${error.message}\n\nPlease check:\n1. Database connection\n2. Table 'blink_business_partners' exists\n3. RLS policies are configured`);
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

    const filteredPartners = partners.filter(p =>
        !searchTerm ||
        p.partner_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.partner_code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.email?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const sizeClasses = {
        sm: 'text-xs py-1.5 px-2',
        md: 'text-sm py-2 px-3',
        lg: 'text-base py-3 px-4'
    };

    const getRoleBadges = (partner) => {
        const roles = [];
        if (partner.is_customer) roles.push('C');
        if (partner.is_vendor) roles.push('V');
        if (partner.is_agent) roles.push('A');
        if (partner.is_transporter) roles.push('T');
        return roles.join('+');
    };

    return (
        <div className="relative">
            {/* Display Field */}
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className={`w-full bg-dark-surface border border-dark-border rounded-lg text-left text-silver-light flex items-center justify-between ${sizeClasses[size]} ${!selectedPartner ? 'text-silver-dark' : ''}`}
            >
                <div className="flex items-center gap-2 flex-1 min-w-0">
                    {selectedPartner ? (
                        <>
                            {selectedPartner.partner_type === 'company' ? (
                                <Building2 className="w-4 h-4 text-silver-dark flex-shrink-0" />
                            ) : (
                                <User className="w-4 h-4 text-silver-dark flex-shrink-0" />
                            )}
                            <span className="truncate">{selectedPartner.partner_name}</span>
                            <span className="text-xs text-blue-400 font-mono flex-shrink-0">
                                {getRoleBadges(selectedPartner)}
                            </span>
                        </>
                    ) : (
                        <span className="text-silver-dark">{placeholder}</span>
                    )}
                </div>
                <ChevronDown className={`w-4 h-4 text-silver-dark transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {/* Dropdown */}
            {isOpen && (
                <div className="absolute z-50 mt-1 w-full bg-dark-card border border-dark-border rounded-lg shadow-xl max-h-80 overflow-hidden">
                    {/* Search */}
                    <div className="p-2 border-b border-dark-border sticky top-0 bg-dark-card">
                        <div className="relative">
                            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-silver-dark" />
                            <input
                                type="text"
                                placeholder="Cari mitra..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-8 pr-3 py-1.5 bg-dark-surface border border-dark-border rounded text-sm text-silver-light"
                                autoFocus
                            />
                        </div>
                    </div>

                    {/* List */}
                    <div className="overflow-y-auto max-h-64">
                        {loading ? (
                            <div className="p-4 text-center text-silver-dark text-sm">Loading...</div>
                        ) : filteredPartners.length === 0 ? (
                            <div className="p-4 text-center text-silver-dark text-sm">
                                {searchTerm ? 'Tidak ditemukan' : 'Belum ada mitra'}
                            </div>
                        ) : (
                            filteredPartners.map(partner => (
                                <button
                                    key={partner.id}
                                    type="button"
                                    onClick={() => handleSelect(partner)}
                                    className="w-full px-3 py-2 hover:bg-dark-surface transition-colors text-left border-b border-dark-border/50 last:border-0"
                                >
                                    <div className="flex items-center gap-2">
                                        {partner.partner_type === 'company' ? (
                                            <Building2 className="w-4 h-4 text-silver-dark flex-shrink-0" />
                                        ) : (
                                            <User className="w-4 h-4 text-silver-dark flex-shrink-0" />
                                        )}
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium text-silver-light truncate">
                                                {partner.partner_name}
                                            </p>
                                            <div className="flex items-center gap-2 mt-0.5">
                                                <span className="text-xs text-silver-dark font-mono">{partner.partner_code}</span>
                                                <span className="text-xs text-blue-400 font-bold">{getRoleBadges(partner)}</span>
                                            </div>
                                        </div>
                                    </div>
                                </button>
                            ))
                        )}
                    </div>

                    {/* Footer Info */}
                    <div className="p-2 border-t border-dark-border bg-dark-surface/50 text-[10px] text-silver-dark">
                        <p>Tip: C=Customer, V=Vendor, A=Agent, T=Transporter</p>
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
