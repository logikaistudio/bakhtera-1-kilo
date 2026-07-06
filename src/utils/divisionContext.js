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
    return resolveDivisionFromPathname(window.location?.pathname || '');
};

export const canViewPartnerInDivision = (partner, activeDivision, isAdminUser = false) => {
    if (!partner) return false;
    if (isAdminUser) return true;

    const ownerDivision = partner.owner_division || DIVISIONS.BLINK;
    const isShared = partner.is_shared === true;
    return ownerDivision === activeDivision || isShared;
};