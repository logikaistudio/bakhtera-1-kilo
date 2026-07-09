/**
 * Print utility untuk generate printable BL/AWB certificates
 * Menggunakan standard layout BILL OF LADING
 * Includes Terms & Conditions on Page 2 (back side)
 */

/**
 * Generate HTML untuk BL Certificate yang siap print
 * @param {Object} blData - Data BL lengkap
 * @returns {string} HTML string
 */
export const generateBLPrintHTML = (blData) => {
    const flattenCargoItems = (items = []) => {
        if (!Array.isArray(items)) return [];

        return items.flatMap((entry) => {
            if (Array.isArray(entry?.items)) return flattenCargoItems(entry.items);
            return [entry];
        });
    };

    const formatCargoItem = (item = {}, index = 0) => ({
        marks: item.marks || item.marksNumbers || item.containerNumber || (index === 0 ? (blData.blMarksNumbers || blData.marksNumbers || blData.containerNumber || 'N/M') : ''),
        packages: item.packages || item.package || item.qty || item.quantity || item.pieces || '',
        description: item.description || item.item_name || item.name || item.service_name || item.itemCode || item.item_code || '',
        weight: item.grossWeight || item.gross_weight || item.weight || '',
        measurement: item.measurement || item.measure || item.volume || item.cbm || ''
    });

    const sourceCargoItems = flattenCargoItems(blData.cargoItems || blData.cargo_items || [])
        .map(formatCargoItem)
        .filter(item => item.description || item.packages || item.weight || item.measurement || item.marks);

    // Prefer BL specific fields if available, otherwise fallback to generic
    const d = {
        shipper: blData.blShipperName || blData.shipperName || blData.shipper || '',
        shipperAddr: blData.blShipperAddress || blData.shipperAddress || '',
        consignee: blData.blConsigneeName || blData.consigneeName || blData.consignee || '',
        consigneeAddr: blData.blConsigneeAddress || blData.consigneeAddress || '',
        notify: blData.blNotifyPartyName || blData.notifyPartyName || 'SAME AS CONSIGNEE',
        notifyAddr: blData.blNotifyPartyAddress || blData.notifyPartyAddress || '',

        blNo: blData.blNumber || blData.mbl || blData.hbl || '-',
        bookingNo: blData.soNumber || '-',
        exportRefs: blData.blExportReferences || blData.exportReferences || '',
        agentRefs: blData.blForwardingAgentRef || blData.forwardingAgentRef || '',

        preCarriage: blData.blPreCarriageBy || blData.preCarriageBy || '',
        placeReceipt: blData.blPlaceOfReceipt || blData.placeOfReceipt || blData.portOfLoading || '',
        vessel: blData.vessel || blData.vesselName || '',
        voyage: blData.voyage || '',
        pol: blData.portOfLoading || '',
        pod: blData.portOfDischarge || '',
        placeDelivery: blData.blPlaceOfDelivery || blData.placeOfDelivery || blData.portOfDischarge || '',
        loadingPier: blData.blLoadingPier || blData.loadingPier || '',

        containerNo: blData.containerNumber || '',
        sealNo: blData.sealNumber || '',
        containerized: blData.containerized || blData.blContainerized || '',
        marks: blData.blMarksNumbers || blData.marksNumbers || blData.containerNumber || 'N/M',
        numberOfPackages: blData.blNumberOfPackages || blData.numberOfPackages || '1',
        totalPackagesInWords: blData.blTotalPackagesInWords || blData.totalPackagesInWords || 'SAY: ONE (1) CONTAINER ONLY',
        description: blData.blDescriptionPackages || blData.descriptionPackages || blData.cargoDescription || 'GENERAL CARGO',
        weight: blData.blGrossWeightText || blData.grossWeight || '',
        measurement: blData.blMeasurementText || blData.measurement || '',

        freightPayable: blData.blFreightPayableAt || blData.freightPayableAt || 'DESTINATION',
        originals: blData.blNumberOfOriginals || blData.numberOfOriginals || 'THREE (3)',
        placeIssue: blData.blIssuedPlace || blData.issuedPlace || 'JAKARTA',
        dateIssue: blData.blIssuedDate || blData.issuedDate || new Date().toLocaleDateString('en-GB'),

        // NEW: Fields that were previously hardcoded
        typeOfMove: blData.blTypeOfMove || blData.typeOfMove || 'FCL/FCL',
        countryOfOrigin: blData.blCountryOfOrigin || blData.countryOfOrigin || 'INDONESIA',
        freightCharges: blData.blFreightCharges || blData.freightCharges || '',
        prepaid: blData.blPrepaid || blData.prepaid || '',
        collect: blData.blCollect || blData.collect || '',
        shippedOnBoardDate: blData.blShippedOnBoardDate || blData.shippedOnBoardDate || '',

        mode: blData.blType || blData.type || blData.awbType || 'MBL',

        // Print options
        watermark: blData.watermark || null,
        releaseType: blData.releaseType || null,
    };

    const coLogo = blData.logo_url || blData.company_logo || blData.companyLogo || '/logo%20bakhtera%20lama.png';
    const modeUpper = String(d.mode || '').toUpperCase();
    const isAirDocument = modeUpper.includes('AWB') || modeUpper.includes('AIR');
    const documentTitle = isAirDocument ? 'AIR WAYBILL' : 'OCEAN BILL OF LADING';
    const documentNumberLabel = isAirDocument ? 'AWB Number' : 'B/L Number';
    const barcodeValue = (() => {
        const base = typeof window !== 'undefined' && window.location?.origin
            ? window.location.origin
            : 'https://bakhtera.app';
        return `${base}/p/${encodeURIComponent(isAirDocument ? 'AWB' : 'BL')}/${encodeURIComponent(d.blNo || '')}`;
    })();
    const barcodeUrl = `https://bwipjs-api.metafloor.com/?bcid=code128&text=${encodeURIComponent(barcodeValue)}&scale=2&height=18&includetext=false`;
    const barcodeFallbackUrl = `https://barcode.tec-it.com/barcode.ashx?data=${encodeURIComponent(barcodeValue)}&code=Code128&dpi=200&translate-esc=on`;
    const cargoRows = sourceCargoItems.length > 0
        ? sourceCargoItems.map((item, index) => (
            index === 0 && d.description
                ? { ...item, description: d.description }
                : item
        ))
        : [{
            marks: d.marks,
            packages: d.numberOfPackages,
            description: d.description,
            weight: d.weight,
            measurement: d.measurement
        }];
    const cargoRowsHTML = cargoRows.map((item, index) => `
                        <tr>
                            <td><div class="value">${item.marks || ''}</div>${index === 0 && (d.containerNo || d.sealNo) ? `<div class="value small-text" style="margin-top:6px;">${d.containerNo ? 'CNTR: ' + d.containerNo : ''}${d.sealNo ? '<br>SEAL: ' + d.sealNo : ''}</div>` : ''}</td>
                            <td style="text-align:center;"><div class="value-bold">${item.packages || ''}</div></td>
                            <td><div class="value-bold" style="text-align:left; line-height:1.15;">${item.description || ''}</div></td>
                            <td style="text-align:right;"><div class="value-bold">${item.weight || ''}</div></td>
                            <td style="text-align:right;"><div class="value-bold">${item.measurement || ''}</div></td>
                        </tr>`).join('');
    const watermarkRaw = (d.watermark || '').toString().trim();
    const watermarkNormalized = watermarkRaw.toUpperCase().replace(/[-_\s]+/g, ' ').trim();
    const isCopyNonNegotiable = watermarkNormalized.includes('COPY') && watermarkNormalized.includes('NEGOTIABLE');
    const prepaidDisplay = String(d.prepaid || '').trim();
    const containerizedSelected = (() => {
        const raw = String(d.containerized || '').trim().toUpperCase();
        if (raw === 'YES' || raw === 'Y') return 'YES';
        if (raw === 'NO' || raw === 'N') return 'NO';
        return (d.containerNo || String(d.typeOfMove || '').toUpperCase().includes('FCL')) ? 'YES' : 'NO';
    })();
    const watermarkHTML = d.watermark
        ? isCopyNonNegotiable
            ? `<div class="doc-watermark copy-non-negotiable"><span>COPY</span><span>NON NEGOTIABLE</span></div>`
            : `<div class="doc-watermark">${watermarkRaw}</div>`
        : '';

    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>${documentTitle} - ${d.blNo}</title>
    <style>
        @media print {
            @page {
                size: A4;
                margin: 0;
            }
            body {
                margin: 0;
                padding: 0;
                -webkit-print-color-adjust: exact;
            }
            .no-print {
                display: none !important;
            }
            .page-break {
                page-break-before: always;
            }
        }
        
        * { box-sizing: border-box; }
        
        body {
            font-family: Arial, Helvetica, sans-serif;
            font-size: 8pt;
            line-height: 1.18;
            color: #000;
            background: white;
            width: 210mm;
            margin: 0 auto;
        }

        .page {
            width: 210mm;
            min-height: 297mm;
            padding: 7mm 8mm;
            position: relative;
        }

        .container {
            width: 178mm;
            height: 270mm;
            margin: 0 auto;
            border: 0.8px solid #222;
            display: flex;
            flex-direction: column;
            background: #fff;
        }

        /* GRID SYSTEM */
        .row { display: flex; width: 100%; border-bottom: 0.8px solid #222; }
        .row:last-child { border-bottom: none; }
        .col { border-right: 0.8px solid #222; padding: 3px 4px; }
        .col:last-child { border-right: none; }
        
        /* TYPOGRAPHY */
        .label { font-size: 5.5pt; text-transform: uppercase; color: #555; margin-bottom: 1.5px; display: block; line-height: 1.05; }
        .value { font-size: 7.6pt; font-weight: normal; white-space: pre-wrap; line-height: 1.08; word-break: break-word; overflow-wrap: anywhere; }
        .value-bold { font-size: 7.6pt; font-weight: 700; white-space: pre-wrap; line-height: 1.08; word-break: break-word; overflow-wrap: anywhere; }
        .small-text { font-size: 6.5pt; }
        .doc-title { font-size: 12pt; font-weight: 800; color: #6b7280; text-align: right; text-transform: uppercase; letter-spacing: .3px; text-decoration: underline; }
        .field { min-height: 18mm; }
        .field-sm { min-height: 9.5mm; }
        .freight-note { font-size: 8pt; font-weight: 800; text-transform: uppercase; margin-top: 13mm; white-space: nowrap; line-height: 1; letter-spacing: .1px; }
        .containerized-choice { display: inline-flex; align-items: center; gap: 3.2mm; font-size: 7pt; font-weight: 800; text-transform: uppercase; }
        .containerized-choice span { min-width: 7mm; text-align: left; }
        .containerized-choice .selected { text-decoration: underline; }
        .containerized-choice .opt { display: inline-flex; align-items: center; gap: 1.8mm; }
        .containerized-choice .box { width: 4.5mm; height: 4.5mm; border: 0.8px solid #111; display: inline-flex; align-items: center; justify-content: center; font-size: 7.2pt; line-height: 1; }
        
        .header-logo {
            text-align: left;
            padding: 1px 2px 2px 2px;
            font-weight: 800;
            font-size: 16pt;
            line-height: 1;
        }
        .header-logo .company-main {
            display:block;
            font-size: 20pt;
            font-weight: 900;
            letter-spacing: .2px;
            margin-bottom: 2px;
            color: #f97316;
            font-style: italic;
        }
        .header-logo .company-sub {
            display:block;
            font-size: 9pt;
            font-weight: 600;
            color: #777;
            font-style: italic;
        }

        /* TABLE PARTICULARS */
        .particulars-table {
            width: 100%;
            border-collapse: collapse;
            flex: 1;
        }
        .particulars-table th {
            border-bottom: 0.8px solid #222;
            border-right: 0.8px solid #222;
            padding: 3px 4px;
            font-size: 5.8pt;
            text-transform: uppercase;
            text-align: center;
            background: #fff;
        }
        .particulars-table td {
            border-right: 0.8px solid #222;
            padding: 8px 5px;
            vertical-align: top;
            font-size: 8pt;
        }
        .particulars-table th:last-child, .particulars-table td:last-child {
            border-right: none;
        }

        .doc-watermark {
            position: absolute;
            top: calc(58% + 10mm);
            left: 50%;
            transform: translate(-50%, -50%) rotate(-30deg);
            font-size: 20pt;
            font-weight: 900;
            color: rgba(254, 90, 29, 0.45);
            z-index: 0;
            white-space: nowrap;
            pointer-events: none;
            letter-spacing: 4px;
        }

        .doc-watermark.copy-non-negotiable {
            top: calc(58% + 10mm);
            font-size: 15.4pt; /* 30% smaller than 22pt */
            color: transparent;
            -webkit-text-fill-color: transparent;
            -webkit-text-stroke: 1.4px rgba(254, 90, 29, 0.95);
            text-transform: uppercase;
            letter-spacing: 3px;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            line-height: 1.2;
        }

        .release-stamp {
            display: inline-block;
            margin-top: 6px;
            border: 2px solid #ea580c;
            color: #ea580c;
            font-size: 7.5pt;
            font-weight: bold;
            padding: 2px 8px;
            letter-spacing: 1.5px;
            transform: rotate(-3deg);
            background: rgba(234, 88, 12, 0.05);
            margin-left: 24mm;
            opacity: 0.8;
        }

        .print-btn {
            position: fixed; top: 20px; right: 20px;
            padding: 12px 24px; background: #2563eb; color: white;
            border: none; border-radius: 8px; cursor: pointer;
            font-weight: bold; box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            z-index: 9999;
        }
        .print-btn:hover { background: #1d4ed8; }

        .signature-line {
            border-top: 0.8px solid #222;
            width: 46mm;
            padding-top: 2px;
            font-size: 7pt;
            margin-top: 10mm;
        }

        /* PAGE 2: Terms & Conditions */
        .terms-page {
            padding: 10mm;
            font-size: 5.5pt;
            line-height: 1.3;
            column-count: 3;
            column-gap: 8mm;
            text-align: justify;
        }
        .terms-page h2 {
            font-size: 8pt;
            margin: 0 0 4mm 0;
            column-span: all;
            text-align: center;
            text-transform: uppercase;
            border-bottom: 1px solid #000;
            padding-bottom: 2mm;
        }
        .terms-page h3 {
            font-size: 6pt;
            margin: 2mm 0 1mm 0;
            text-transform: uppercase;
        }
        .terms-page p {
            margin: 0 0 2mm 0;
        }
        .terms-page ol, .terms-page ul {
            margin: 0 0 2mm 0;
            padding-left: 3mm;
        }
        .terms-page li {
            margin-bottom: 1mm;
        }

    </style>
</head>
<body>
    <button class="print-btn no-print" onclick="window.print()">🖨️ PRINT ${isAirDocument ? 'AWB' : 'BL'}</button>

    <!-- PAGE 1: BILL OF LADING / AIR WAYBILL -->
    <div class="page">
        ${watermarkHTML}
        <div class="container">
            <div class="row" style="min-height: 43mm;">
                <div class="col" style="width: 52%; display:flex; flex-direction:column;">
                    <div class="header-logo" style="min-height:19mm; margin-bottom:1mm;">
                        ${coLogo ? `<img src="${coLogo}" alt="Logo" style="max-height:18mm;max-width:58mm;object-fit:contain;" />` : `<span class="company-main">bakhtera</span><span class="company-sub">freight worldwide</span>`}
                        ${d.releaseType ? `<br><span class="release-stamp">${d.releaseType}</span>` : ''}
                    </div>
                    <span class="label">Shipper</span>
                    <div class="value-bold" style="font-size:7.2pt; line-height:1.05; margin-bottom:1px;">${d.shipper}</div>
                    <div class="value" style="font-size:6.6pt; line-height:1.08; white-space:pre-wrap; max-height:11mm; overflow:hidden;">${d.shipperAddr}</div>
                </div>
                <div class="col" style="width: 48%; padding:0; display:flex; flex-direction:column;">
                    <div style="height:14mm; padding:2px 4px; border-bottom:0.8px solid #222; display:flex; justify-content:space-between; align-items:flex-start; gap:4px;">
                        <div style="display:flex; flex-direction:column; align-items:flex-start; justify-content:flex-start; min-width:31mm; background:#fff; padding:0.4mm 0.9mm; border-radius:1px;">
                            <img src="${barcodeUrl}" alt="Barcode ${d.blNo}" onerror="this.onerror=null;this.src='${barcodeFallbackUrl}'" style="height:10.8mm; width:29.8mm; object-fit:contain;" />
                        </div>
                        <div class="doc-title" style="padding-top:0.55mm;">${documentTitle}</div>
                    </div>
                    <div style="height:11mm; display:flex; border-bottom:0.8px solid #222;">
                        <div style="width:55%; border-right:0.8px solid #222; padding:3px 4px;">
                            <span class="label">Booking Number</span>
                            <div class="value-bold">${d.bookingNo}</div>
                        </div>
                        <div style="width:45%; padding:3px 4px;">
                            <span class="label">${documentNumberLabel}</span>
                            <div class="value-bold">${d.blNo}</div>
                        </div>
                    </div>
                    <div style="flex:1; padding:3px 4px;">
                        <span class="label">Export References</span>
                        <div class="value small-text">${d.exportRefs}</div>
                    </div>
                </div>
            </div>

            <div class="row" style="min-height:30mm;">
                <div class="col field" style="width:52%;">
                    <span class="label">Consignee</span>
                    <div class="value-bold" style="font-size:7.2pt; line-height:1.05; margin-bottom:1px;">${d.consignee}</div>
                    <div class="value" style="font-size:6.6pt; line-height:1.08; white-space:pre-wrap; max-height:12mm; overflow:hidden;">${d.consigneeAddr}</div>
                </div>
                <div class="col field" style="width:48%;">
                    <span class="label">Forwarding Agent (Name and address - references)</span>
                    <div class="value-bold small-text" style="line-height:1.05; white-space:pre-wrap; max-height:12mm; overflow:hidden;">${d.agentRefs}</div>
                </div>
            </div>

            <div class="row" style="min-height:24mm;">
                <div class="col field" style="width:100%;">
                    <span class="label">Notify Party</span>
                    <div class="value-bold" style="font-size:7.2pt; line-height:1.05; margin-bottom:1px;">${d.notify}</div>
                    <div class="value" style="font-size:6.6pt; line-height:1.08; white-space:pre-wrap; max-height:10mm; overflow:hidden;">${d.notifyAddr}</div>
                </div>
            </div>

            <div class="row" style="min-height:15mm;">
                <div class="col field-sm" style="width:26%;"><span class="label">Pre-Carriage By</span><div class="value-bold">${d.preCarriage}</div></div>
                <div class="col field-sm" style="width:26%;"><span class="label">Place of Receipt</span><div class="value-bold">${d.placeReceipt}</div></div>
                <div class="col field-sm" style="width:24%;"><span class="label">Freight Payable At</span><div class="value-bold" style="text-transform:uppercase;">${d.freightPayable}</div></div>
                <div class="col field-sm" style="width:24%;"><span class="label">Number of Original B/L's</span><div class="value-bold">${d.originals}</div></div>
            </div>

            <div class="row" style="min-height:15mm;">
                <div class="col field-sm" style="width:26%;"><span class="label">Ocean Vessel & Voy No</span><div class="value-bold">${[d.vessel, d.voyage].filter(Boolean).join(' / ')}</div></div>
                <div class="col field-sm" style="width:26%;"><span class="label">Port of Loading</span><div class="value-bold">${d.pol}</div></div>
                <div class="col field-sm" style="width:24%;"><span class="label">Port of Discharge</span><div class="value-bold">${d.pod}</div></div>
                <div class="col field-sm" style="width:24%;"><span class="label">Place of Delivery</span><div class="value-bold">${d.placeDelivery}</div></div>
            </div>

            <div class="row" style="min-height:10mm;">
                <div class="col field-sm" style="width:52%;"><span class="label">Containerized (Vessel only)</span><div class="value containerized-choice" style="margin-top:1mm; justify-content:flex-start; text-align:left;"><span class="opt"><span class="box">${containerizedSelected === 'YES' ? '&#10003;' : ''}</span><span>YES</span></span><span class="opt"><span class="box">${containerizedSelected === 'NO' ? '&#10003;' : ''}</span><span>NO</span></span></div></div>
                <div class="col field-sm" style="width:48%;"><span class="label">Type of Move</span><div class="value-bold">${d.typeOfMove}</div></div>
            </div>

            <div style="height:88mm; display:flex; border-bottom:0.8px solid #222; position:relative;">
                <table class="particulars-table">
                    <thead>
                        <tr>
                            <th style="width:18%">Marks and Numbers</th>
                            <th style="width:12%">Number of Packages</th>
                            <th style="width:45%; text-align:left; padding-left:6px;">Description<br>As Per Merchant's Information</th>
                            <th style="width:12%">Gross Weight</th>
                            <th style="width:13%">Measurement</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${cargoRowsHTML}
                    </tbody>
                </table>
            </div>

            <div class="row" style="height:61mm; position:relative;">
                <div class="col" style="width:52%; padding:0; display:flex; flex-direction:column;">
                    <div style="height:11mm; border-bottom:0.8px solid #222; display:flex; align-items:center; justify-content:center; text-align:center; font-size:7pt; color:#555;">
                        FREIGHT RATES, CHARGES, WEIGHTS AND / OR<br>MEASUREMENTS SUBJECT TO CORRECTION
                    </div>
                    <div style="display:flex; flex:1;">
                        <div style="width:38%; border-right:0.8px solid #222; padding:4px; display:flex; align-items:center; justify-content:center; text-align:center;"><div class="freight-note">${prepaidDisplay || ''}</div></div>
                        <div style="width:31%; border-right:0.8px solid #222; padding:4px 4px 4px 5px; display:flex; flex-direction:column; align-items:flex-start; justify-content:center; text-align:left;"><div class="value-bold" style="font-size:8pt; line-height:1.2; text-transform:uppercase; text-align:left; white-space:pre-wrap; word-break:break-word;">${d.freightCharges}</div></div>
                        <div style="width:31%; padding:4px;"><span class="label">Total Packages in Words</span><div class="value-bold" style="text-transform:uppercase;">${d.totalPackagesInWords}</div></div>
                    </div>
                </div>
                <div class="col" style="width:48%; padding:5px 6px; position:relative;">
                    <div style="font-size:5.7pt; color:#555; line-height:1.2; text-align:justify;">
                        Received by Carrier for shipment by ocean vessel between port of loading and port of discharge, and for arrangement or procurement of pre-carriage from place of receipt and on-carriage to place of delivery where stated. The goods to be delivered at the above mentioned port of discharge or place of delivery whichever applicable subject always to exceptions, limitations, conditions and liberties set out on the reverse side hereof.
                    </div>
                    <div style="margin-top:4mm; font-size:7pt;">DATED AT <strong>${String(d.placeIssue || '').toUpperCase()}</strong> ${d.dateIssue ? `ON ${d.dateIssue}` : ''}</div>
                    ${d.shippedOnBoardDate ? `<div style="margin-top:2mm; font-size:7pt;">SHIPPED ON BOARD<br><strong>${String(d.placeIssue || '').toUpperCase()}</strong><br>ON DATE <strong>${d.shippedOnBoardDate}</strong></div>` : ''}
                    <div style="margin-top:6mm; font-size:8pt;">By <strong>BAKHTERA FREIGHT WORLDWIDE</strong></div>
                    <div class="signature-line">As Agent For Carrier</div>
                </div>
            </div>
        </div>
    </div>

    <!-- PAGE 2: TERMS & CONDITIONS (Printed on Back) -->
    <div class="page page-break">
        <div class="terms-page">
            <h2>Bill of Lading for Port-to-Port Shipment or for Combined Transport</h2>
            
            <h3>1. Definitions</h3>
            <p>"Carrier" means the party on whose behalf this Bill of Lading has been signed. "Merchant" includes the Shipper, Consignee, Receiver or the Holder of this Bill of Lading, and anyone acting on their behalf. "Goods" means the cargo and any container or package not supplied by the Carrier.</p>
            
            <h3>2. Carrier's Tariff</h3>
            <p>The provisions of the Carrier's applicable Tariff are incorporated herein. Copies of the relevant provisions of the Tariff are obtainable from the Carrier upon request. In the case of inconsistency between this Bill of Lading and the Tariff, this Bill of Lading shall prevail.</p>
            
            <h3>3. Warranty</h3>
            <p>The Merchant warrants that in agreeing to the terms hereof he is, or is authorized to be acting as, the agent of and on behalf of the owner of the Goods and of anyone else who has or may have an interest in them.</p>
            
            <h3>4. Sub-Contracting</h3>
            <p>The Carrier shall be entitled to sub-contract on any terms the carriage of the Goods to any extent and any and all duties whatsoever undertaken by the Carrier in relation to the Goods.</p>
            
            <h3>5. Issuance of This Bill of Lading</h3>
            <p>By accepting this Bill of Lading the Merchant agrees to be bound by all stipulations, exceptions, terms and conditions on the face and back hereof whether written, printed, stamped or incorporated, as fully as if signed by the Merchant.</p>
            
            <h3>6. Carrier's Responsibility</h3>
            <p>The Carrier shall be responsible for loss of or damage to the Goods occurring between the time when he receives the Goods and the time of delivery.</p>
            <ol>
                <li>Where loss or damage occurs during carriage by sea or inland waterway, the Carrier's liability shall be determined by the Hague-Visby Rules or any compulsory legislation of the port of loading or discharge.</li>
                <li>Where loss or damage occurs at any time not covered above, the Carrier shall be liable only if the loss or damage was caused by the negligence of the Carrier, his servants or agents.</li>
            </ol>
            
            <h3>7. Shipper-Packed Containers</h3>
            <p>If a container is not packed by the Carrier:</p>
            <ol>
                <li>The Carrier shall not be liable for any loss of or damage to the contents.</li>
                <li>The Merchant warrants that the container and its contents are fit for carriage.</li>
                <li>The Merchant shall indemnify the Carrier for any loss or liability arising from the container.</li>
            </ol>
            
            <h3>8. Dangerous Goods/Contraband</h3>
            <p>The Merchant undertakes not to tender for transportation any Goods which are contraband, or which may render the Carrier liable to penalties or forfeiture. Dangerous Goods may only be shipped with the prior consent of the Carrier.</p>
            
            <h3>9. Description of Goods and Merchant's Packaging</h3>
            <p>The Merchant warrants: a) that the particulars furnished by or on behalf of the Merchant are accurate; b) that the Goods are properly packed and marked; c) that the contents of any container packed by the Merchant are accurately described.</p>
            
            <h3>10. Freight and Charges</h3>
            <p>Freight shall be deemed earned on receipt of the Goods by the Carrier and shall be paid in full in any event. The Carrier's lien on the Goods for all monies due shall survive delivery.</p>
            
            <h3>11. Limitation of Liability</h3>
            <p>The Carrier's liability shall not exceed the limits set forth in the Hague-Visby Rules or US COGSA 1936, whichever is applicable. Unless declared and inserted in this Bill of Lading, the Carrier shall not be liable for an amount exceeding 666.67 SDR per package or 2 SDR per kilogram, whichever is higher.</p>
            
            <h3>12. Notice of Loss</h3>
            <p>Unless notice of loss or damage and the general nature of such loss or damage be given in writing to the Carrier at the port of discharge before or at the time of removal of the Goods, such removal shall be prima facie evidence of delivery as described.</p>
            
            <h3>13. Time Bar</h3>
            <p>The Carrier shall be discharged from all liability unless suit is brought within one year after delivery of the Goods or the date when the Goods should have been delivered.</p>
            
            <h3>14. Law and Jurisdiction</h3>
            <p>This Bill of Lading shall be governed by Indonesian law. Any dispute shall be referred to the courts of Jakarta, Indonesia, which shall have exclusive jurisdiction.</p>
            
            <h3>15. General Average</h3>
            <p>General Average shall be adjusted at any port or place at the option of the Carrier and shall be settled according to the York-Antwerp Rules 1994.</p>
            
            <h3>16. Both-to-Blame Collision</h3>
            <p>If the ship comes into collision with another ship as a result of the negligence of the other ship and any negligence on the part of the Carrier, the Merchant undertakes to pay the Carrier or defend the Carrier against any claim.</p>
            
            <h3>17. Variation of Contract</h3>
            <p>No servant or agent of the Carrier shall have power to waive or vary any terms of this Bill of Lading unless such waiver or variation is in writing and is authorized by the Carrier.</p>
            
            <h3>18. Separability</h3>
            <p>If any provision of this Bill of Lading is held to be invalid, the remaining provisions shall remain in full force and effect.</p>
            
            <h3>19. Optional Stowage</h3>
            <p>Goods may be stowed on or under deck at the Carrier's option without notice to the Merchant. For all purposes, such stowage shall be considered proper stowage.</p>
            
            <h3>20. Deck Cargo</h3>
            <p>The Carrier shall not be liable for loss or damage arising from risks inherent in carriage on deck. Containers, whether stowed on or under deck, shall be carried at the Carrier's sole risk and discretion.</p>
            
            <h3>21. Delay</h3>
            <p>The Carrier does not guarantee any particular date or time of arrival. The Carrier shall not be liable for any loss caused by delay.</p>
            
            <h3>22. Methods and Route of Transportation</h3>
            <p>The Carrier may at any time transfer the Goods from one vessel to another, or proceed by any route in his discretion, forwards or backwards, with liberty to call at any port, for any purpose whatsoever.</p>
            
            <h3>23. Matters Affecting Performance</h3>
            <p>If at any time the performance of this contract is affected by any hindrance, risk, delay, or difficulty, the Carrier may treat the contract as fulfilled by delivering the Goods at any place the Carrier deems fit.</p>
            
            <p style="margin-top: 6mm; text-align: center; font-weight: bold; font-size: 6pt;">
                --- END OF TERMS AND CONDITIONS ---
            </p>
        </div>
    </div>

</body>
</html>
    `;
};

/**
 * Print BL Certificate
 * Open new window dengan printable HTML dan trigger print dialog
 * @param {Object} blData - Data BL
 */
export const printBLCertificate = (blData) => {
    const htmlContent = generateBLPrintHTML(blData);

    const printWindow = window.open('', '_blank', 'width=1000,height=1200');

    if (printWindow) {
        printWindow.document.write(htmlContent);
        printWindow.document.close();

        printWindow.onload = () => {
            setTimeout(() => {
                // Auto print disabled - user can click Print button
            }, 500);
        };
    } else {
        alert('Please allow popups to print the certificate');
    }
};

/**
 * Generate AWB Print HTML
 */
export const generateAWBPrintHTML = (awbData) => {
    return generateBLPrintHTML(awbData);
};

export const printAWBCertificate = (awbData) => {
    printBLCertificate(awbData);
};
