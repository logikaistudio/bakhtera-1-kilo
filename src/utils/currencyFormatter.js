// Helper function to format number to localized format
export const formatCurrency = (value) => {
    if (value === null || value === undefined || value === '') {
        return '0';
    }

    const num = typeof value === 'string' ? parseFloat(value) : Number(value);
    if (isNaN(num)) return '0';

    // Show decimals only when present, up to 6 fraction digits
    const options = {
        minimumFractionDigits: 0,
        maximumFractionDigits: 6
    };

    return num.toLocaleString('id-ID', options);
};

// Format currency with prefix symbol based on currency code
export const formatWithCurrency = (value, currencyCode = 'IDR') => {
    const formatted = formatCurrency(value);
    const prefix = getCurrencySymbol(currencyCode);
    return `${prefix} ${formatted}`;
};

// Get currency symbol/prefix
export const getCurrencySymbol = (code) => {
    const symbols = {
        'IDR': 'Rp',
        'USD': '$',
        'EUR': '€',
        'SGD': 'S$',
        'JPY': '¥',
        'CNY': '¥',
        'GBP': '£',
    };
    return symbols[code] || code;
};

// Helper function to parse formatted currency back to number
export const parseCurrency = (value) => {
    if (value === null || value === undefined) return 0;
    if (typeof value === 'number') return value;

    let s = String(value).trim();
    if (s === '') return 0;

    // Remove currency symbols and spaces
    s = s.replace(/[^0-9.,-]/g, '');

    // If both dot and comma present, decide which is decimal separator
    const lastDot = s.lastIndexOf('.');
    const lastComma = s.lastIndexOf(',');

    if (lastComma > -1 && lastDot > -1) {
        // If comma comes after dot, comma is decimal separator (e.g., 1.234,56)
        if (lastComma > lastDot) {
            s = s.replace(/\./g, ''); // remove thousand sep
            s = s.replace(/,/g, '.'); // make decimal dot
        } else {
            // dot after comma => treat dot as decimal
            s = s.replace(/,/g, '');
        }
    } else if (lastComma > -1 && lastDot === -1) {
        // only comma present -> treat comma as decimal separator
        s = s.replace(/,/g, '.');
    } else {
        // only dot present or none -> remove any thousand dots (leave decimal dot)
        // remove dots that are thousand separators (heuristic: if more than one dot or dot followed by three digits)
        // Replace occurrences of dot that are followed by 3 digits with ''
        s = s.replace(/\.(?=\d{3}(?:\.|,|$))/g, '');
    }

    const parsed = parseFloat(s);
    return isNaN(parsed) ? 0 : parsed;
};

// Hook for currency input handling
export const useCurrencyInput = (initialValue = 0) => {
    const [displayValue, setDisplayValue] = React.useState(formatCurrency(initialValue));
    const [numericValue, setNumericValue] = React.useState(initialValue);

    const handleChange = (e) => {
        const inputValue = e.target.value;
        const formatted = formatCurrency(inputValue);
        const numeric = parseCurrency(formatted);

        setDisplayValue(formatted);
        setNumericValue(numeric);

        return numeric;
    };

    const setValue = (value) => {
        const formatted = formatCurrency(value);
        const numeric = parseCurrency(formatted);
        setDisplayValue(formatted);
        setNumericValue(numeric);
    };

    return {
        displayValue,
        numericValue,
        handleChange,
        setValue
    };
};
