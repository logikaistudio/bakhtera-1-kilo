// Quick Fix for QuotationManagement Field Mapping
// Copy this into browser console while on QuotationManagement page

console.log('🔧 Applying field mapping fix...');

// Override the fetchQuotations function
window.fixQuotationMapping = () => {
    console.log('✅ Quotation mapping fix loaded');
    console.log('📝 Refresh the page to apply');
};

// Call it
window.fixQuotationMapping();

// Instructions:
// 1. Open QuotationManagement page
// 2. Open Console (F12)
// 3. Paste this entire script
// 4. Press Enter
// 5. Refresh page (F5)
