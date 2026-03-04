/**
 * printPDF.js
 * -----------
 * Shared utility to generate a clean print-to-PDF window for financial reports.
 * Works with browser's native Print → Save as PDF — no extra dependencies needed.
 */

const PRINT_STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');

  * { box-sizing: border-box; margin: 0; padding: 0; }

  body {
    font-family: 'Inter', 'Segoe UI', Arial, sans-serif;
    font-size: 10px;
    color: #1e293b;
    background: #fff;
    padding: 0;
  }

  .print-wrapper {
    max-width: 100%;
    padding: 20px 24px 32px;
  }

  /* ── Header ── */
  .report-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 18px;
    padding-bottom: 14px;
    border-bottom: 2px solid #0070BB;
  }
  .report-header .company { font-size: 13px; font-weight: 700; color: #0f172a; }
  .report-header .report-name { font-size: 18px; font-weight: 800; color: #0070BB; margin: 2px 0; }
  .report-header .period { font-size: 10px; color: #64748b; }
  .report-header .meta { text-align: right; font-size: 9px; color: #94a3b8; line-height: 1.6; }

  /* ── Table ── */
  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 9.5px;
    margin-bottom: 12px;
  }
  thead tr {
    background: #0070BB;
    color: #fff;
  }
  thead th {
    padding: 7px 8px;
    text-align: left;
    font-weight: 700;
    font-size: 9px;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    white-space: nowrap;
  }
  thead th.text-right { text-align: right; }
  thead th.text-center { text-align: center; }

  tbody tr { border-bottom: 1px solid #e2e8f0; }
  tbody tr:nth-child(even) { background: #f8fafc; }
  tbody tr.row-header { background: #eff6ff; font-weight: 600; }
  tbody tr.row-opening { background: #fefce8; }
  tbody tr.row-closing { background: #f3e8ff; }

  tbody td {
    padding: 5px 8px;
    vertical-align: top;
  }
  tbody td.text-right { text-align: right; font-variant-numeric: tabular-nums; }
  tbody td.text-center { text-align: center; }
  tbody td.mono { font-family: 'Courier New', monospace; font-size: 9px; }
  tbody td.code { color: #d97706; font-family: monospace; font-size: 9px; }
  tbody td.muted { color: #94a3b8; }
  tbody td.green { color: #15803d; font-weight: 600; }
  tbody td.red { color: #dc2626; font-weight: 600; }
  tbody td.blue { color: #1d4ed8; }
  tbody td.purple { color: #7c3aed; font-weight: 600; }
  tbody td.yellow-label { color: #92400e; font-weight: 700; }
  tbody td.bold { font-weight: 700; }

  tfoot tr { background: #0070BB; color: #fff; }
  tfoot td {
    padding: 7px 8px;
    font-weight: 700;
    font-size: 9.5px;
  }
  tfoot td.text-right { text-align: right; font-variant-numeric: tabular-nums; }

  /* ── Footer note ── */
  .print-note {
    font-size: 8.5px;
    color: #94a3b8;
    margin-top: 10px;
    border-top: 1px solid #e2e8f0;
    padding-top: 8px;
    line-height: 1.5;
  }

  /* ── Badge ── */
  .badge {
    display: inline-block;
    padding: 1px 5px;
    border-radius: 3px;
    font-size: 8px;
    font-weight: 600;
    border: 1px solid currentColor;
  }
  .badge-balanced { color: #15803d; background: #dcfce7; }
  .badge-unbalanced { color: #dc2626; background: #fee2e2; }

  /* ── Summary box ── */
  .summary-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 8px;
    margin-bottom: 14px;
  }
  .summary-card {
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    padding: 8px 10px;
    border-left: 4px solid #0070BB;
  }
  .summary-card .label { font-size: 8px; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; }
  .summary-card .value { font-size: 12px; font-weight: 700; color: #0f172a; margin-top: 2px; font-variant-numeric: tabular-nums; }
  .summary-card.green-card { border-left-color: #15803d; }
  .summary-card.green-card .value { color: #15803d; }
  .summary-card.blue-card { border-left-color: #1d4ed8; }
  .summary-card.blue-card .value { color: #1d4ed8; }
  .summary-card.purple-card { border-left-color: #7c3aed; }
  .summary-card.purple-card .value { color: #7c3aed; }
  .summary-card.red-card { border-left-color: #dc2626; }
  .summary-card.red-card .value { color: #dc2626; }

  @page {
    size: A4 landscape;
    margin: 14mm 12mm;
  }

  @media print {
    html, body { height: auto; }
    .print-wrapper { padding: 0; }
  }
`;

/**
 * Open a clean print window with formatted HTML content.
 * @param {Object} opts
 * @param {string}  opts.reportName   - e.g. "Trial Balance"
 * @param {Object}  opts.companyInfo  - { company_name, company_address, company_phone, company_email, company_npwp, logo_url }
 * @param {string}  opts.period       - e.g. "01 Jan 2025 – 31 Dec 2025"
 * @param {string}  opts.bodyHTML     - The HTML body (table + summary cards etc.)
 * @param {string}  [opts.note]       - Optional footnote text
 * @param {string}  [opts.company]    - (legacy) plain string company name fallback
 */
export const printReport = ({ reportName, company, companyInfo, period, bodyHTML, note }) => {
  const now = new Date().toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });

  // Resolve company data — prefer companyInfo object, fall back to legacy string
  const co = companyInfo || {};
  const coName = co.company_name || company || 'Company';
  const coAddress = co.company_address || '';
  const coPhone = co.company_phone || '';
  const coEmail = co.company_email || '';
  const coNpwp = co.company_npwp || '';
  const coLogo = co.logo_url || '';

  const logoHTML = coLogo
    ? `<img src="${coLogo}" alt="Logo" style="max-height:56px;max-width:140px;object-fit:contain;" />`
    : `<div style="width:48px;height:48px;background:#e2e8f0;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:20px;">&#127968;</div>`;

  const coDetails = [
    coAddress ? `<div>${coAddress.replace(/\n/g, ', ')}</div>` : '',
    coPhone ? `<div>Tel: ${coPhone}</div>` : '',
    coEmail ? `<div>${coEmail}</div>` : '',
    coNpwp ? `<div>NPWP: ${coNpwp}</div>` : '',
  ].filter(Boolean).join('');

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>${reportName} \u2013 ${period}</title>
  <style>${PRINT_STYLES}
    .report-header { border-bottom: 2px solid #0070BB; padding-bottom: 14px; margin-bottom:18px; display:flex; justify-content:space-between; align-items:flex-start; }
    .header-left { display:flex; align-items:flex-start; gap:14px; }
    .header-company-name { font-size:15px; font-weight:800; color:#0f172a; margin-bottom:3px; }
    .header-company-detail { font-size:8.5px; color:#64748b; line-height:1.7; }
    .header-right { text-align:right; }
    .header-report-name { font-size:18px; font-weight:800; color:#0070BB; }
    .header-period { font-size:10px; color:#64748b; margin-top:2px; }
    .header-printed { font-size:8px; color:#94a3b8; margin-top:4px; }
  </style>
</head>
<body>
  <div class="print-wrapper">
    <div class="report-header">
      <div class="header-left">
        ${logoHTML}
        <div>
          <div class="header-company-name">${coName}</div>
          <div class="header-company-detail">${coDetails}</div>
        </div>
      </div>
      <div class="header-right">
        <div class="header-report-name">${reportName}</div>
        <div class="header-period">Period: ${period}</div>
        <div class="header-printed">Printed: ${now}</div>
      </div>
    </div>

    ${bodyHTML}

    ${note ? `<div class="print-note">${note}</div>` : ''}
  </div>
  <script>
    window.onload = () => { window.print(); };
  <\/script>
</body>
</html>`;

  const win = window.open('', '_blank', 'width=1200,height=800');
  if (!win) { alert('Please allow pop-ups to print PDF.'); return; }
  win.document.write(html);
  win.document.close();
};


/** Format number as IDR string for print (plain text, no JSX) */
export const fmtPrint = (value) => {
  if (value === undefined || value === null || value === 0) return '-';
  const neg = value < 0;
  const abs = Math.abs(value);
  const s = `Rp ${abs.toLocaleString('id-ID')}`;
  return neg ? `(${s})` : s;
};

/** Format a date string for display */
export const fmtDatePrint = (dateStr) => {
  if (!dateStr) return '-';
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric'
  });
};
