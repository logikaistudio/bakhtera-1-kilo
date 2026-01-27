import * as XLSX from 'xlsx';

/**
 * Export Partners to Excel Template
 * Template includes all partner fields for easy bulk editing
 */
export const exportPartnerTemplate = (partners = []) => {
    // Define columns
    const columns = [
        'partner_code',
        'partner_name',
        'partner_type',
        'contact_person',
        'email',
        'phone',
        'mobile',
        'address_line1',
        'address_line2',
        'city',
        'postal_code',
        'country',
        'tax_id',
        'is_customer',
        'is_vendor',
        'is_agent',
        'is_transporter',
        'payment_terms',
        'currency',
        'credit_limit',
        'bank_name',
        'bank_account_number',
        'bank_account_holder',
        'notes'
    ];

    // Create worksheet data
    const wsData = [];

    // Header row with descriptions
    wsData.push([
        'Partner Code*',
        'Partner Name*',
        'Type (company/individual)',
        'Contact Person',
        'Email',
        'Phone',
        'Mobile',
        'Address Line 1',
        'Address Line 2',
        'City',
        'Postal Code',
        'Country',
        'Tax ID (NPWP)',
        'Is Customer? (TRUE/FALSE)',
        'Is Vendor? (TRUE/FALSE)',
        'Is Agent? (TRUE/FALSE)',
        'Is Transporter? (TRUE/FALSE)',
        'Payment Terms',
        'Currency (IDR/USD/EUR)',
        'Credit Limit',
        'Bank Name',
        'Bank Account Number',
        'Bank Account Holder',
        'Notes'
    ]);

    // Example row (optional - shows format)
    if (!partners || partners.length === 0) {
        wsData.push([
            'BP-2601-0001',
            'PT Contoh Mitra Indonesia',
            'company',
            'John Doe',
            'john@example.com',
            '+62 21 1234567',
            '+62 812 3456789',
            'Jl. Sudirman No. 123',
            'Gedung ABC Lt. 5',
            'Jakarta',
            '12345',
            'Indonesia',
            '01.234.567.8-901.000',
            'TRUE',
            'FALSE',
            'FALSE',
            'FALSE',
            'NET 30',
            'IDR',
            '100000000',
            'Bank Mandiri',
            '1234567890',
            'PT Contoh Mitra Indonesia',
            'Preferred customer'
        ]);
    } else {
        // Export existing partners
        partners.forEach(partner => {
            wsData.push([
                partner.partner_code || '',
                partner.partner_name || '',
                partner.partner_type || 'company',
                partner.contact_person || '',
                partner.email || '',
                partner.phone || '',
                partner.mobile || '',
                partner.address_line1 || '',
                partner.address_line2 || '',
                partner.city || '',
                partner.postal_code || '',
                partner.country || 'Indonesia',
                partner.tax_id || '',
                partner.is_customer ? 'TRUE' : 'FALSE',
                partner.is_vendor ? 'TRUE' : 'FALSE',
                partner.is_agent ? 'TRUE' : 'FALSE',
                partner.is_transporter ? 'TRUE' : 'FALSE',
                partner.payment_terms || 'NET 30',
                partner.currency || 'IDR',
                partner.credit_limit || 0,
                partner.bank_name || '',
                partner.bank_account_number || '',
                partner.bank_account_holder || '',
                partner.notes || ''
            ]);
        });
    }

    // Create workbook and worksheet
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(wsData);

    // Set column widths
    ws['!cols'] = [
        { wch: 15 }, // partner_code
        { wch: 30 }, // partner_name
        { wch: 12 }, // partner_type
        { wch: 20 }, // contact_person
        { wch: 25 }, // email
        { wch: 18 }, // phone
        { wch: 18 }, // mobile
        { wch: 35 }, // address_line1
        { wch: 35 }, // address_line2
        { wch: 15 }, // city
        { wch: 10 }, // postal_code
        { wch: 12 }, // country
        { wch: 20 }, // tax_id
        { wch: 12 }, // is_customer
        { wch: 12 }, // is_vendor
        { wch: 12 }, // is_agent
        { wch: 15 }, // is_transporter
        { wch: 12 }, // payment_terms
        { wch: 8 },  // currency
        { wch: 15 }, // credit_limit
        { wch: 20 }, // bank_name
        { wch: 20 }, // bank_account_number
        { wch: 25 }, // bank_account_holder
        { wch: 30 }  // notes
    ];

    // Add worksheet to workbook
    XLSX.utils.book_append_sheet(wb, ws, 'Partners');

    // Add instructions sheet
    const instructionsData = [
        ['PARTNER IMPORT TEMPLATE - INSTRUCTIONS'],
        [''],
        ['How to use this template:'],
        ['1. Fill in partner data in the "Partners" sheet'],
        ['2. Required fields are marked with * (partner_code, partner_name)'],
        ['3. For boolean fields (is_customer, is_vendor, etc.), use TRUE or FALSE'],
        ['4. partner_code should be unique (format: BP-YYMM-XXXX)'],
        ['5. Leave partner_code empty for auto-generation'],
        ['6. Save the file and use "Import Partners" button in the app'],
        [''],
        ['Field Descriptions:'],
        ['- partner_code: Unique identifier (auto-generated if empty)'],
        ['- partner_name: Full legal name of the partner'],
        ['- partner_type: "company" or "individual"'],
        ['- is_customer: Set TRUE if partner can be billed (receivables)'],
        ['- is_vendor: Set TRUE if partner can receive PO (payables)'],
        ['- is_agent: Set TRUE for overseas/local agent partners'],
        ['- is_transporter: Set TRUE for trucking/airline/shipping line'],
        ['- payment_terms: NET 7, NET 14, NET 30, NET 60, COD'],
        ['- currency: IDR, USD, EUR'],
        [''],
        ['Tips:'],
        ['- One partner can have multiple roles (e.g., both Customer and Vendor)'],
        ['- Bank details are optional but useful for payment processing'],
        ['- Address fields support multi-line text'],
        [''],
        ['Support: contact your system administrator']
    ];

    const wsInstructions = XLSX.utils.aoa_to_sheet(instructionsData);
    wsInstructions['!cols'] = [{ wch: 80 }];
    XLSX.utils.book_append_sheet(wb, wsInstructions, 'Instructions');

    // Generate file
    const fileName = partners && partners.length > 0
        ? `Partners_Export_${new Date().toISOString().split('T')[0]}.xlsx`
        : `Partners_Import_Template.xlsx`;

    XLSX.writeFile(wb, fileName);

    return {
        success: true,
        fileName: fileName,
        recordCount: partners ? partners.length : 0
    };
};

/**
 * Parse imported Excel file and validate data
 */
export const parsePartnerImportFile = (file) => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = (e) => {
            try {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: 'array' });

                // Read first sheet (Partners)
                const firstSheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[firstSheetName];

                // Convert to JSON
                const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

                // Skip header row
                const headers = jsonData[0];
                const rows = jsonData.slice(1);

                // Parse and validate rows
                const partners = [];
                const errors = [];

                rows.forEach((row, index) => {
                    // Skip empty rows
                    if (!row || row.length === 0 || !row[1]) {
                        return;
                    }

                    const rowNumber = index + 2; // +2 because: +1 for header, +1 for 0-index

                    // Parse boolean helper
                    const parseBool = (val) => {
                        if (typeof val === 'boolean') return val;
                        if (typeof val === 'string') {
                            return val.toUpperCase() === 'TRUE';
                        }
                        return false;
                    };

                    const partner = {
                        partner_code: row[0] || '', // Can be empty for auto-generation
                        partner_name: row[1],
                        partner_type: row[2] || 'company',
                        contact_person: row[3] || '',
                        email: row[4] || '',
                        phone: row[5] || '',
                        mobile: row[6] || '',
                        address_line1: row[7] || '',
                        address_line2: row[8] || '',
                        city: row[9] || '',
                        postal_code: row[10] || '',
                        country: row[11] || 'Indonesia',
                        tax_id: row[12] || '',
                        is_customer: parseBool(row[13]),
                        is_vendor: parseBool(row[14]),
                        is_agent: parseBool(row[15]),
                        is_transporter: parseBool(row[16]),
                        payment_terms: row[17] || 'NET 30',
                        currency: row[18] || 'IDR',
                        credit_limit: parseFloat(row[19]) || 0,
                        bank_name: row[20] || '',
                        bank_account_number: row[21] || '',
                        bank_account_holder: row[22] || '',
                        notes: row[23] || '',
                        status: 'active'
                    };

                    // Validation
                    if (!partner.partner_name) {
                        errors.push({ row: rowNumber, error: 'Partner name is required' });
                        return;
                    }

                    // Validate partner_type
                    if (!['company', 'individual'].includes(partner.partner_type)) {
                        errors.push({ row: rowNumber, error: 'Invalid partner_type (must be "company" or "individual")' });
                        return;
                    }

                    // Validate currency
                    if (!['IDR', 'USD', 'EUR'].includes(partner.currency)) {
                        errors.push({ row: rowNumber, error: 'Invalid currency (must be IDR, USD, or EUR)' });
                        return;
                    }

                    partners.push(partner);
                });

                resolve({
                    success: true,
                    partners: partners,
                    errors: errors,
                    totalRows: rows.length,
                    validRows: partners.length
                });
            } catch (error) {
                reject({
                    success: false,
                    error: 'Failed to parse file: ' + error.message
                });
            }
        };

        reader.onerror = () => {
            reject({
                success: false,
                error: 'Failed to read file'
            });
        };

        reader.readAsArrayBuffer(file);
    });
};

/**
 * Bulk insert partners to Supabase
 */
export const bulkImportPartners = async (supabase, partners) => {
    try {
        const { data, error } = await supabase
            .from('blink_business_partners')
            .insert(partners)
            .select();

        if (error) throw error;

        return {
            success: true,
            imported: data.length,
            data: data
        };
    } catch (error) {
        return {
            success: false,
            error: error.message
        };
    }
};
