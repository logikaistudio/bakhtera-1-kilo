/**
 * Order Type Detection Utility
 * Auto-classifies shipments based on origin/destination cities
 */

// Indonesian cities & country markers
const INDONESIAN_CITIES = [
    'jakarta', 'jkt', 'batam', 'surabaya', 'medan', 'makassar', 'bandung', 
    'semarang', 'palembang', 'banjarmasin', 'pontianak', 'jayapura', 'denpasar',
    'yogyakarta', 'solo', 'malang', 'kupang', 'manado', 'padang', 'cirebon',
    'tangerang', 'bogor', 'depok', 'bekasi', 'indonesia', 'id'
];

/**
 * Detect if a city name is in Indonesia
 * @param {string} cityName - City or port name
 * @returns {boolean}
 */
export function isIndonesianCity(cityName) {
    if (!cityName || typeof cityName !== 'string') return false;
    const normalized = cityName.toLowerCase().trim();
    return INDONESIAN_CITIES.some(city => normalized.includes(city));
}

/**
 * Detect trade direction based on origin and destination
 * @param {string} origin - Origin city/country
 * @param {string} destination - Destination city/country
 * @returns {'import' | 'export' | 'domestic' | null}
 * 
 * Rules:
 * - IMPORT: Indonesia → Foreign
 * - EXPORT: Foreign → Indonesia
 * - DOMESTIC: Indonesia → Indonesia
 * - null: Cannot determine
 */
export function detectTradeDirection(origin, destination) {
    if (!origin || !destination) return null;

    const isOriginIndo = isIndonesianCity(origin);
    const isDestIndo = isIndonesianCity(destination);

    if (isOriginIndo && !isDestIndo) {
        return 'export'; // Sending out of Indonesia
    }
    if (!isOriginIndo && isDestIndo) {
        return 'import'; // Receiving into Indonesia
    }
    if (isOriginIndo && isDestIndo) {
        return 'domestic'; // Both in Indonesia
    }

    return null; // Cannot determine
}

/**
 * Get quotation type label
 * @param {string} quotationType - 'RG' | 'PJ' | 'EV' | null
 * @returns {string}
 */
export function getQuotationTypeLabel(quotationType) {
    const typeMap = {
        'RG': 'Regular',
        'PJ': 'Project',
        'EV_ENT': 'Event Entertaint & Concert',
        'EV_AUTO': 'Event Automotive',
        'EV_KEK': 'Event KEK',
        'EV_FAIR': 'Event Fair & Excebition',
        'EV': 'Event'
    };
    return typeMap[quotationType] || quotationType || 'Regular';
}

/**
 * Build complete SO type string combining trade direction + quotation type
 * @param {string} tradeDirection - 'import' | 'export' | 'domestic'
 * @param {string} quotationType - 'RG' | 'PJ' | 'EV' | null
 * @returns {string} e.g. "IMPORT-REGULAR", "EXPORT-PROJECT"
 */
export function formatSOType(tradeDirection, quotationType) {
    if (!tradeDirection) return 'UNCLASSIFIED';

    const direction = tradeDirection.toUpperCase();
    const quoteType = getQuotationTypeLabel(quotationType).toUpperCase();

    return `${direction}-${quoteType}`;
}

/**
 * Get SO type description (human-readable)
 * @param {string} soType - Full SO type like "IMPORT-REGULAR"
 * @returns {string}
 */
export function getSOTypeDescription(soType) {
    const descriptions = {
        'IMPORT-REGULAR': 'Regular Import',
        'IMPORT-PROJECT': 'Project Import',
        'IMPORT-EVENT': 'Event Import',
        'EXPORT-REGULAR': 'Regular Export',
        'EXPORT-PROJECT': 'Project Export',
        'EXPORT-EVENT': 'Event Export',
        'DOMESTIC-REGULAR': 'Domestic Regular',
        'DOMESTIC-PROJECT': 'Domestic Project',
        'DOMESTIC-EVENT': 'Domestic Event',
    };
    return descriptions[soType] || soType || 'Unknown';
}

/**
 * Validate if SO type and actual origin/destination match
 * @param {object} shipment - Shipment object with origin, destination, trade_direction, quotationType
 * @returns {object} { isValid, expectedType, actualType, issues: [] }
 */
export function validateSOType(shipment) {
    const {
        origin,
        destination,
        trade_direction,
        tradeDirection,
        quotationType,
        quotation_type
    } = shipment;

    const actualDirection = trade_direction || tradeDirection;
    const actualQuoteType = quotationType || quotation_type;
    const detectedDirection = detectTradeDirection(origin, destination);
    const expectedSOType = formatSOType(detectedDirection, actualQuoteType);
    const actualSOType = formatSOType(actualDirection, actualQuoteType);

    const issues = [];
    let isValid = true;

    // Check if detected direction matches actual
    if (detectedDirection && actualDirection && detectedDirection !== actualDirection) {
        isValid = false;
        issues.push(
            `Trade direction mismatch: Detected "${detectedDirection}" based on ` +
            `origin "${origin}" → destination "${destination}", ` +
            `but form shows "${actualDirection}"`
        );
    }

    // Check if required fields exist
    if (!origin) issues.push('Origin city is required');
    if (!destination) issues.push('Destination city is required');
    if (!actualDirection) issues.push('Trade direction must be selected');

    return {
        isValid: isValid && issues.length === 0,
        expectedSOType,
        actualSOType,
        detectedDirection,
        actualDirection,
        issues
    };
}

/**
 * Get all possible SO type combinations
 * @returns {array} Array of {value, label} for dropdowns
 */
export function getSOTypeOptions() {
    const directions = ['import', 'export', 'domestic'];
    const quotationTypes = [
        { code: 'RG', label: 'Regular' },
        { code: 'PJ', label: 'Project' },
        { code: 'EV_ENT', label: 'Event Entertaint & Concert' },
        { code: 'EV_AUTO', label: 'Event Automotive' },
        { code: 'EV_KEK', label: 'Event KEK' },
        { code: 'EV_FAIR', label: 'Event Fair & Excebition' }
    ];

    return directions.flatMap(dir =>
        quotationTypes.map(qt => ({
            value: formatSOType(dir, qt.code),
            label: getSOTypeDescription(formatSOType(dir, qt.code))
        }))
    );
}
