export const DIVISIONS = {
    BLINK: 'blink',
    BXPO: 'bxpo'
};

export const resolveDivisionFromPathname = (pathname = '') => {
    if (typeof pathname !== 'string') return DIVISIONS.BLINK;
    if (pathname.startsWith('/bxpo')) return DIVISIONS.BXPO;
    return DIVISIONS.BLINK;
};

export const getActiveDivision = () => {
    if (typeof window === 'undefined') return DIVISIONS.BLINK;
    const params = new URLSearchParams(window.location?.search || '');
    const requested = (params.get('division') || '').toLowerCase();
    if (requested === DIVISIONS.BXPO) return DIVISIONS.BXPO;
    if (requested === DIVISIONS.BLINK) return DIVISIONS.BLINK;
    return resolveDivisionFromPathname(window.location?.pathname || '');
};

export const canViewPartnerInDivision = (partner, activeDivision, isAdminUser = false) => {
    if (!partner) return false;
    // Filter by division so each portal only shows its own partners.
    // Applies equally to all users (no admin-only bypass).
    const ownerDivision = partner.owner_division || DIVISIONS.BLINK;
    const isShared = partner.is_shared === true;
    return ownerDivision === activeDivision || isShared;
};