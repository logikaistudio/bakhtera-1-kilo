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
        marks: blData.blMarksNumbers || blData.marksNumbers || blData.containerNumber || 'N/M',
        pkgs: blData.blTotalPackagesText || blData.totalPackages || '1 CONTAINER',
        description: blData.blDescriptionPackages || blData.descriptionPackages || blData.cargoDescription || 'GENERAL CARGO',
        weight: blData.blGrossWeightText || blData.grossWeight || '',
        measurement: blData.blMeasurementText || blData.measurement || '',

        freightPayable: blData.blFreightPayableAt || blData.freightPayableAt || 'DESTINATION',
        originals: blData.blNumberOfOriginals || blData.numberOfOriginals || 'THREE (3)',
        placeIssue: blData.blIssuedPlace || blData.issuedPlace || 'JAKARTA',
        dateIssue: blData.blIssuedDate || blData.issuedDate || new Date().toLocaleDateString('en-GB'),

        mode: blData.blType || 'MBL'
    };

    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Bill of Lading - ${d.blNo}</title>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600&display=swap');

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
            font-family: 'Arial Narrow', 'Inter', sans-serif;
            font-size: 9pt;
            line-height: 1.2;
            color: #000;
            background: white;
            width: 210mm;
            margin: 0 auto;
        }

        .page {
            width: 210mm;
            min-height: 297mm;
            padding: 8mm;
            position: relative;
        }

        .container {
            border: 1px solid #000;
            height: 281mm;
            display: flex;
            flex-direction: column;
        }

        /* GRID SYSTEM */
        .row { display: flex; width: 100%; border-bottom: 1px solid #000; }
        .row:last-child { border-bottom: none; }
        .col { border-right: 1px solid #000; padding: 4px; }
        .col:last-child { border-right: none; }
        
        /* TYPOGRAPHY */
        .label { font-size: 6pt; text-transform: uppercase; color: #333; margin-bottom: 2px; display: block; }
        .value { font-size: 9pt; font-weight: normal; white-space: pre-wrap; }
        .value-bold { font-size: 9pt; font-weight: bold; }
        .small-text { font-size: 7pt; }
        
        .header-logo {
            text-align: right;
            padding: 8px;
            font-weight: bold;
            font-size: 14pt;
        }

        /* TABLE PARTICULARS */
        .particulars-table {
            width: 100%;
            border-collapse: collapse;
            flex: 1;
        }
        .particulars-table th {
            border-bottom: 1px solid #000;
            border-right: 1px solid #000;
            padding: 4px;
            font-size: 7pt;
            text-transform: uppercase;
            text-align: center;
            background: #f5f5f5;
        }
        .particulars-table td {
            border-right: 1px solid #000;
            padding: 6px 4px;
            vertical-align: top;
            font-size: 9pt;
        }
        .particulars-table th:last-child, .particulars-table td:last-child {
            border-right: none;
        }

        .carrier-watermark {
            position: absolute;
            top: 45%;
            left: 50%;
            transform: translate(-50%, -50%) rotate(-45deg);
            font-size: 72pt;
            color: rgba(0,0,0,0.04);
            z-index: 0;
            white-space: nowrap;
            pointer-events: none;
        }

        .print-btn {
            position: fixed; top: 20px; right: 20px;
            padding: 12px 24px; background: #2563eb; color: white;
            border: none; border-radius: 8px; cursor: pointer;
            font-weight: bold; box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            z-index: 9999;
        }
        .print-btn:hover { background: #1d4ed8; }

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
    <button class="print-btn no-print" onclick="window.print()">🖨️ PRINT BL</button>
    
    <!-- PAGE 1: BILL OF LADING -->
    <div class="page">
        <div class="carrier-watermark">BAKHTERA</div>

        <div class="container">
            
            <!-- ROW 1: Shipper & BL Info -->
            <div class="row">
                <div class="col" style="width: 50%;">
                    <span class="label">Shipper / Exporter</span>
                    <div class="value-bold">${d.shipper}</div>
                    <div class="value">${d.shipperAddr}</div>
                </div>
                <div class="col" style="width: 50%; padding: 0; display: flex; flex-direction: column;">
                    <div style="flex: 1; padding: 4px; border-bottom: 1px solid #000;">
                        <div style="display: flex;">
                           <div style="width: 60%; border-right: 1px solid #000; padding-right: 4px;">
                               <span class="label">Bill of Lading No.</span>
                               <div class="value-bold" style="font-size: 11pt;">${d.blNo}</div>
                           </div>
                           <div style="width: 40%; padding-left: 4px;">
                               <span class="label">Reference No.</span>
                               <div class="value">${d.bookingNo}</div>
                           </div>
                        </div>
                    </div>
                    <div style="flex: 1; padding: 4px;">
                         <span class="label">Export References</span>
                         <div class="value small-text">${d.exportRefs}</div>
                    </div>
                </div>
            </div>

            <!-- ROW 2: Consignee & Agent -->
            <div class="row">
                <div class="col" style="width: 50%;">
                    <span class="label">Consignee (to Order of)</span>
                    <div class="value-bold">${d.consignee}</div>
                    <div class="value">${d.consigneeAddr}</div>
                </div>
                <div class="col" style="width: 50%;">
                    <span class="label">Forwarding Agent References</span>
                    <div class="value small-text">${d.agentRefs}</div>
                    <div class="header-logo">
                        BAKHTERA FREIGHT<br>
                        <span style="font-size: 9pt; font-weight: normal;">INTERNATIONAL LOGISTICS</span>
                    </div>
                </div>
            </div>

            <!-- ROW 3: Notify & routing -->
            <div class="row">
                <div class="col" style="width: 50%;">
                    <span class="label">Notify Party</span>
                    <div class="value-bold">${d.notify}</div>
                    <div class="value">${d.notifyAddr}</div>
                </div>
                <div class="col" style="width: 50%; padding:0; display: flex; flex-direction: column;">
                    <div style="display:flex; border-bottom: 1px solid #000;">
                        <div style="flex:1; padding:4px; border-right:1px solid #000;">
                            <span class="label">Place of Receipt</span>
                            <div class="value">${d.placeReceipt}</div>
                        </div>
                         <div style="flex:1; padding:4px;">
                            <span class="label">Pre-Carriage By</span>
                            <div class="value">${d.preCarriage}</div>
                        </div>
                    </div>
                     <div style="flex:1; padding:4px;">
                         <span class="label">Point and Country of Origin</span>
                         <div class="value">INDONESIA</div>
                    </div>
                </div>
            </div>

            <!-- ROW 4: Vessel Info -->
            <div class="row">
                <div class="col" style="width: 25%;">
                    <span class="label">Vessel</span>
                    <div class="value">${d.vessel}</div>
                </div>
                <div class="col" style="width: 25%;">
                    <span class="label">Voyage No.</span>
                    <div class="value">${d.voyage}</div>
                </div>
                <div class="col" style="width: 25%;">
                    <span class="label">Port of Loading</span>
                    <div class="value">${d.pol}</div>
                </div>
                 <div class="col" style="width: 25%;">
                    <span class="label">Type of Move</span>
                    <div class="value">FCL/FCL</div>
                </div>
            </div>

            <!-- ROW 5: Discharge Info -->
            <div class="row">
                 <div class="col" style="width: 25%;">
                    <span class="label">Port of Discharge</span>
                    <div class="value">${d.pod}</div>
                </div>
                <div class="col" style="width: 25%;">
                    <span class="label">Place of Delivery</span>
                    <div class="value">${d.placeDelivery}</div>
                </div>
                 <div class="col" style="width: 25%;">
                    <span class="label">Loading Pier/Terminal</span>
                    <div class="value">${d.loadingPier}</div>
                </div>
                 <div class="col" style="width: 25%;">
                    <span class="label">Number of Originals</span>
                    <div class="value">${d.originals}</div>
                </div>
            </div>

            <!-- ROW 6: Cargo Particulars Header -->
            <div style="border-bottom: 1px solid #000; text-align: center; font-weight: bold; background: #f0f0f0; padding: 3px; font-size: 8pt;">
                PARTICULARS FURNISHED BY SHIPPER
            </div>

            <!-- ROW 7: Cargo Table -->
            <div style="flex: 1; display: flex; border-bottom: 1px solid #000;">
                <table class="particulars-table">
                    <thead>
                        <tr>
                            <th style="width: 18%">Marks & Numbers</th>
                            <th style="width: 10%">No. of Pkgs</th>
                            <th style="width: 47%">Description of Packages and Goods</th>
                            <th style="width: 12%">Gross Weight</th>
                            <th style="width: 13%">Measurement</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td>
                                <div class="value" style="white-space: pre-wrap;">${d.marks}</div>
                                <div class="value small-text" style="margin-top: 8px;">
                                    ${d.containerNo ? 'CNTR: ' + d.containerNo : ''}
                                    ${d.sealNo ? '<br>SEAL: ' + d.sealNo : ''}
                                </div>
                            </td>
                             <td style="text-align: center;">
                                <div class="value">${d.pkgs}</div>
                            </td>
                            <td>
                                <div class="value" style="font-weight: bold;">${d.description}</div>
                            </td>
                             <td style="text-align: right;">
                                <div class="value">${d.weight}</div>
                            </td>
                             <td style="text-align: right;">
                                <div class="value">${d.measurement}</div>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>

            <!-- ROW 8: Totals -->
            <div class="row" style="background: #f5f5f5;">
                <div class="col" style="width: 30%;">
                     <span class="label">Total Number of Packages (In Words)</span>
                </div>
                <div class="col" style="width: 70%;">
                     <div class="value-bold" style="text-transform: uppercase;">${d.pkgs}</div>
                </div>
            </div>

            <!-- ROW 9: Freight & Charges -->
            <div class="row" style="min-height: 60px;">
                 <div class="col" style="width: 25%;">
                     <span class="label">Freight & Charges</span>
                </div>
                 <div class="col" style="width: 25%;">
                     <span class="label">Prepaid</span>
                </div>
                 <div class="col" style="width: 25%;">
                     <span class="label">Collect</span>
                </div>
                 <div class="col" style="width: 25%;">
                     <span class="label">Freight Payable At</span>
                     <div class="value" style="text-transform: uppercase;">${d.freightPayable}</div>
                </div>
            </div>

            <!-- ROW 10: Footer (NO Authorized Signature) -->
            <div class="row" style="min-height: 100px;">
                 <div class="col" style="width: 50%; padding: 8px;">
                     <span class="label">Date of Issue of B/L</span>
                     <div class="value">${d.dateIssue}</div>
                     <br>
                     <span class="label">Place of Issue of B/L</span>
                     <div class="value" style="text-transform: uppercase;">${d.placeIssue}</div>
                     <br><br>
                     <div style="border-top: 1px solid #000; display: inline-block; padding-top: 2px; width: 180px;">
                        <span class="label">Shipped on Board Date</span>
                     </div>
                </div>
                 <div class="col" style="width: 50%; padding: 8px;">
                     <span class="label">Signed for the Carrier</span>
                     <div style="font-weight: bold; margin-top: 4px;">BAKHTERA FREIGHT FORWARDER</div>
                     <div style="font-size: 7pt;">AS CARRIER</div>
                     <br><br>
                     <div style="font-size: 6pt; color: #666;">
                        This Bill of Lading is subject to the terms and conditions printed overleaf.
                     </div>
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
