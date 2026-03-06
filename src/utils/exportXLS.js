import XLSX from 'xlsx-js-style';

/**
 * Export data to Excel with customizable layout.
 * @param {Array} data - Array of data objects
 * @param {String} fileName - Filename without extension
 * @param {Array} headerRows - Array of objects: { value: string, style: 'company'|'title'|'normal'|'bold' } or simple strings.
 * @param {Array} columns - Column definitions
 */
export const exportToXLS = (data, fileName, headerRows, columns) => {
    // 1. Create Workbook
    const wb = XLSX.utils.book_new();

    // 2. Extract Headers from Columns
    const headers = columns.map(c => c.header);

    // 3. Map Data Rows
    const dataRows = data.map((item, index) => {
        return columns.map(col => {
            if (col.key === 'no') return index + 1;

            let val = item[col.key];

            // Render function support
            if (col.render && typeof col.render === 'function') {
                val = col.render(item);
            }

            return val !== undefined && val !== null ? val : '-';
        });
    });

    // 4. Construct Worksheet
    const ws = XLSX.utils.aoa_to_sheet([]);
    const colCount = columns.length;

    // --- Styles Definitions ---
    const styles = {
        company: { font: { bold: true, sz: 11, name: 'Arial' }, alignment: { horizontal: "left" } },
        title: { font: { bold: true, sz: 11, name: 'Arial' }, alignment: { horizontal: "left" } }, // Same size but semantically different
        bold: { font: { bold: true, sz: 10, name: 'Arial' }, alignment: { horizontal: "left" } },
        normal: { font: { sz: 10, name: 'Arial' }, alignment: { horizontal: "left" } },
        tableHeader: {
            font: { bold: true, color: { rgb: "FFFFFF" }, name: 'Arial', sz: 10 },
            fill: { patternType: "solid", fgColor: { rgb: "0077BE" } }, // Blue like in screenshot
            alignment: { horizontal: "center", vertical: "center" },
            border: {
                top: { style: "thin", color: { rgb: "000000" } },
                bottom: { style: "thin", color: { rgb: "000000" } },
                left: { style: "thin", color: { rgb: "000000" } },
                right: { style: "thin", color: { rgb: "000000" } }
            }
        },
        cell: {
            font: { sz: 10, name: 'Arial' },
            alignment: { horizontal: "left", vertical: "center" },
            border: {
                top: { style: "thin", color: { rgb: "E0E0E0" } }, // Lighter inner border
                bottom: { style: "thin", color: { rgb: "E0E0E0" } },
                left: { style: "thin", color: { rgb: "E0E0E0" } },
                right: { style: "thin", color: { rgb: "E0E0E0" } }
            }
        }
    };

    const centerCellStyle = { ...styles.cell, alignment: { horizontal: "center", vertical: "center" } };
    const rightCellStyle = { ...styles.cell, alignment: { horizontal: "right", vertical: "center" } };

    // --- Write Header Section (Rows 1...N) ---
    // Start writing from A1
    headerRows.forEach((row, idx) => {
        const cellRef = XLSX.utils.encode_cell({ r: idx, c: 0 });
        const val = typeof row === 'object' ? row.value : row;
        const styleKey = typeof row === 'object' ? row.style : 'normal';

        // Add cell
        XLSX.utils.sheet_add_aoa(ws, [[val]], { origin: cellRef });

        // Add styling
        if (ws[cellRef]) {
            ws[cellRef].s = styles[styleKey] || styles.normal;
        }

        // Do NOT merge across columns unless specifically requested. Image shows NO merge (text overflows visually).
        // But if we want it clean, we can merge A to End if text is long? 
        // Excel default behavior: Overflow if next cell empty. That's fine.
    });

    // --- Write Table ---
    const tableStartRow = headerRows.length; // Immediately after headers? Or add gap?
    // Let caller decide gap by passing empty strings in headerRows.

    // 1. Table Header
    XLSX.utils.sheet_add_aoa(ws, [headers], { origin: { r: tableStartRow, c: 0 } });

    // Style Table Header
    headers.forEach((_, cIdx) => {
        const cellRef = XLSX.utils.encode_cell({ r: tableStartRow, c: cIdx });
        if (ws[cellRef]) ws[cellRef].s = styles.tableHeader;
    });

    // 2. Data Rows
    XLSX.utils.sheet_add_aoa(ws, dataRows, { origin: { r: tableStartRow + 1, c: 0 } });

    // Style Data Cells
    dataRows.forEach((row, rIdx) => {
        const currentRow = tableStartRow + 1 + rIdx;
        row.forEach((_, cIdx) => {
            const cellRef = XLSX.utils.encode_cell({ r: currentRow, c: cIdx });
            if (!ws[cellRef]) return;

            const colDef = columns[cIdx];
            let currentStyle = styles.cell;

            if (colDef.align === 'center') currentStyle = centerCellStyle;
            if (colDef.align === 'right') currentStyle = rightCellStyle;

            ws[cellRef].s = currentStyle;
        });
    });

    // --- 5. Add Summary Row ---
    // Check if any column needs a summary
    const hasSummary = columns.some(c => c.summary);

    if (hasSummary) {
        const summaryRowIndex = tableStartRow + 1 + dataRows.length;
        const summaryCells = columns.map((col, idx) => {
            if (idx === 0) return 'TOTAL'; // Label in first column
            if (col.summary) {
                // Calculate sum for this column
                const sum = data.reduce((acc, item) => {
                    // removing strict validation to coerce fuzzy numbers if any
                    const val = parseFloat(item[col.key]) || 0;
                    return acc + val;
                }, 0);
                return sum;
            }
            return '';
        });

        // Add to worksheet
        XLSX.utils.sheet_add_aoa(ws, [summaryCells], { origin: { r: summaryRowIndex, c: 0 } });

        // Style the Summary Row
        summaryCells.forEach((_, cIdx) => {
            const cellRef = XLSX.utils.encode_cell({ r: summaryRowIndex, c: cIdx });
            if (!ws[cellRef]) return; // Safety check

            ws[cellRef].s = {
                font: { bold: true, sz: 10, name: 'Arial', color: { rgb: "000000" } },
                alignment: { horizontal: cIdx === 0 ? "left" : "center", vertical: "center" },
                fill: { patternType: "solid", fgColor: { rgb: "FFD700" } }, // Gold highlight for visibility
                border: {
                    top: { style: "medium", color: { rgb: "000000" } },
                    bottom: { style: "medium", color: { rgb: "000000" } },
                    left: { style: "thin", color: { rgb: "000000" } },
                    right: { style: "thin", color: { rgb: "000000" } }
                }
            };
        });
    }

    // Set Column Widths
    ws['!cols'] = columns.map(c => ({ wch: c.width || 15 }));

    // Append Sheet
    XLSX.utils.book_append_sheet(wb, ws, "Sheet1");

    // Save file using Blob to ensure browser compatibility
    try {
        const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
        const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=UTF-8' });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `${fileName}.xlsx`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
    } catch (error) {
        console.error("Error saving excel file:", error);
        // Fallback
        XLSX.writeFile(wb, `${fileName}.xlsx`);
    }
};
