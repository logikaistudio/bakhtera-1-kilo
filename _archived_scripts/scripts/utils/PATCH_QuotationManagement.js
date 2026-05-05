/**
 * PATCH FILE - QuotationManagement fetchQuotations Fix
 * 
 * PROBLEM: Blank page karena Supabase return snake_case tapi UI expect camelCase
 * SOLUTION: Add field mapping in fetchQuotations function
 * 
 * FILE: src/pages/Blink/QuotationManagement.jsx
 * LINES: ~87-96
 */

// REPLACE THIS:
/*
            if (error) throw error;
            
            setQuotations(data || []);
        } catch (error) {
            console.error('Error fetching quotations:', error);
            alert('Failed to load quotations from database');
        } finally {
            setLoading(false);
        }
*/

// WITH THIS:
{
    if (error) throw error;

    // Map snake_case fields to camelCase for UI
    const mapped = (data || []).map(q => ({
        ...q,  // Keep all original fields
        // Add camelCase aliases
        jobNumber: q.job_number || q.jobNumber,
        quotationNumber: q.quotation_number || q.quotationNumber,
        customerName: q.customer_name || q.customerName || '',
        customerCompany: q.customer_company || q.customerCompany || '',
        customerId: q.customer_id || q.customerId,
        customerAddress: q.customer_address || q.customerAddress || '',
        salesPerson: q.sales_person || q.salesPerson || '',
        quotationType: q.quotation_type || q.quotationType || 'RG',
        quotationDate: q.quotation_date || q.quotationDate,
        validUntil: q.valid_until || q.validUntil,
        serviceType: q.service_type || q.serviceType,
        cargoType: q.cargo_type || q.cargoType,
        totalAmount: q.total_amount || q.totalAmount || 0,
        serviceItems: q.service_items || q.serviceItems || [],
        rejectionReason: q.rejection_reason || q.rejectionReason,
        createdAt: q.created_at || q.createdAt,
        updatedAt: q.updated_at || q.updatedAt,
        currency: q.currency || 'USD',
        status: q.status || 'draft'
    }));

    console.log('✅ Fetched and mapped', mapped.length, 'quotations');
    setQuotations(mapped);
} catch (error) {
    console.error('❌ Error fetching quotations:', error);
    // Don't alert - prevents blocking UI
    setQuotations([]);
} finally {
    setLoading(false);
}
}

/**
 * HOW TO APPLY:
 * 1. Open: src/pages/Blink/QuotationManagement.jsx
 * 2. Find: const fetchQuotations = async () => { (around line 79)
 * 3. Look for: if (error) throw error;
 * 4. Replace the section from "if (error)" to end of function
 * 5. Save file
 * 6. Browser will hot-reload
 * 7. Refresh QuotationManagement page
 */
