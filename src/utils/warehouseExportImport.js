/**
 * Warehouse Inventory Export/Import Utilities
 * Phase 2: Bulk data entry support
 * 
 * Features:
 * - Export pengajuan to Excel/JSON template
 * - Import data from Excel/JSON
 * - Merge imported data (replace or update partial)
 */

import * as XLSX from 'xlsx';

/**
 * Template columns definition for export
 */
const EXPORT_COLUMNS = [
  { key: 'no', header: 'No', width: 5 },
  { key: 'package', header: 'Package', width: 15 },
  { key: 'itemCode', header: 'Kode Barang', width: 15 },
  { key: 'itemName', header: 'Nama Item', width: 25 },
  { key: 'quantity', header: 'Qty', width: 10 },
  { key: 'uom', header: 'Satuan', width: 10 },
  { key: 'condition', header: 'Kondisi', width: 10 },
  { key: 'value', header: 'Nilai', width: 12 },
  { key: 'notes', header: 'Catatan', width: 20 }
];

/**
 * Flatten pengajuan packages/items to flat array for export
 */
export const flattenPengajuanForExport = (pengajuan) => {
  const exportData = (pengajuan.packages || []).flatMap((pkg, pkgIdx) =>
    (pkg.items || []).map((item, itemIdx) => ({
      no: itemIdx + 1,
      package: pkg.packageNumber || `PKG-${pkgIdx + 1}`,
      itemCode: item.itemCode || '',
      itemName: item.name || item.itemName || '',
      quantity: item.quantity || 0,
      uom: item.uom || 'pcs',
      condition: item.condition || 'Baik',
      value: item.value || 0,
      notes: item.notes || item.remarks || ''
    }))
  );

  return exportData;
};

/**
 * Export pengajuan to Excel file
 */
export const exportWarehouseToExcel = (pengajuan) => {
  try {
    const exportData = flattenPengajuanForExport(pengajuan);

    // Create workbook & worksheet
    const ws = XLSX.utils.json_to_sheet(exportData);
    
    // Set column widths
    const colWidths = EXPORT_COLUMNS.map(col => ({ wch: col.width }));
    ws['!cols'] = colWidths;

    // Set header row style (blue background)
    const headerCells = Object.keys(ws).filter(key => key.match(/^[A-Z]\d/));
    headerCells.forEach((cell, idx) => {
      if (idx < EXPORT_COLUMNS.length) {
        ws[cell].fill = { patternType: 'solid', fgColor: { rgb: 'FF4472C4' } };
        ws[cell].font = { bold: true, color: { rgb: 'FFFFFFFF' } };
      }
    });

    // Freeze panes (header row)
    ws['!freeze'] = { xSplit: 0, ySplit: 1 };

    // Create workbook
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Data Inventaris');

    // Add metadata sheet
    const metaWs = XLSX.utils.aoa_to_sheet([
      ['Pengajuan Number', pengajuan.quotationNumber || pengajuan.quotation_number],
      ['BC Document Number', pengajuan.bcDocumentNumber || pengajuan.bc_document_number],
      ['Export Date', new Date().toLocaleString('id-ID')],
      ['Template Version', '1.0'],
      ['', ''],
      ['Instruksi:', ''],
      ['1. Edit data di kolom yang diperlukan', ''],
      ['2. JANGAN ubah nama kolom header', ''],
      ['3. JANGAN hapus baris', ''],
      ['4. Package tetap sama, atau ubah sesuai kebutuhan', ''],
      ['5. Upload kembali file ini untuk import', '']
    ]);
    
    XLSX.utils.book_append_sheet(wb, metaWs, 'Info');

    // Download file
    const filename = `${pengajuan.quotationNumber || 'Template'}_${new Date().getTime()}.xlsx`;
    XLSX.writeFile(wb, filename);

    return { success: true, filename };
  } catch (error) {
    console.error('❌ Export error:', error);
    throw new Error(`Gagal export file: ${error.message}`);
  }
};

/**
 * Export to JSON format (for backup/transfer)
 */
export const exportWarehouseToJSON = (pengajuan) => {
  try {
    const templateData = {
      metadata: {
        pengajuanNumber: pengajuan.quotationNumber || pengajuan.quotation_number,
        bcDocumentNumber: pengajuan.bcDocumentNumber || pengajuan.bc_document_number,
        exportDate: new Date().toISOString(),
        version: '1.0'
      },
      packages: (pengajuan.packages || []).map(pkg => ({
        packageNumber: pkg.packageNumber,
        items: (pkg.items || []).map(item => ({
          itemCode: item.itemCode,
          itemName: item.name || item.itemName,
          quantity: item.quantity,
          uom: item.uom,
          condition: item.condition,
          value: item.value,
          notes: item.notes
        }))
      }))
    };

    const json = JSON.stringify(templateData, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${pengajuan.quotationNumber || 'template'}_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);

    return { success: true, format: 'json' };
  } catch (error) {
    console.error('❌ JSON export error:', error);
    throw new Error(`Gagal export JSON: ${error.message}`);
  }
};

/**
 * Parse imported file (Excel or JSON)
 */
export const parseImportedFile = async (file) => {
  try {
    if (file.type === 'application/json' || file.name.endsWith('.json')) {
      // Parse JSON
      const text = await file.text();
      const data = JSON.parse(text);
      return { format: 'json', data };
    } else {
      // Parse Excel
      const arrayBuffer = await file.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: 'array' });
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(worksheet);
      return { format: 'excel', data: jsonData };
    }
  } catch (error) {
    console.error('❌ Parse error:', error);
    throw new Error(`Gagal parse file: ${error.message}`);
  }
};

/**
 * Validate imported data structure
 */
export const validateImportedData = (data, format) => {
  const errors = [];
  const warnings = [];

  if (format === 'json') {
    if (!data.packages || !Array.isArray(data.packages)) {
      errors.push('Format JSON tidak valid: harus punya "packages" array');
    } else {
      data.packages.forEach((pkg, pkgIdx) => {
        if (!pkg.packageNumber) {
          warnings.push(`Package ${pkgIdx} tidak punya packageNumber`);
        }
        if (!pkg.items || !Array.isArray(pkg.items)) {
          errors.push(`Package ${pkgIdx}: harus punya "items" array`);
        }
      });
    }
  } else if (format === 'excel') {
    // Validate Excel columns
    const requiredColumns = ['itemCode', 'itemName', 'quantity'];
    const firstRow = data[0] || {};
    const missingColumns = requiredColumns.filter(col => !(col in firstRow));
    
    if (missingColumns.length > 0) {
      errors.push(`Kolom tidak ditemukan: ${missingColumns.join(', ')}`);
    }

    // Validate data
    data.forEach((row, idx) => {
      if (!row.quantity || isNaN(row.quantity)) {
        errors.push(`Baris ${idx + 1}: Quantity harus angka`);
      }
      if (!row.itemName || row.itemName.toString().trim() === '') {
        errors.push(`Baris ${idx + 1}: Item Name tidak boleh kosong`);
      }
    });
  }

  return { valid: errors.length === 0, errors, warnings };
};

/**
 * Convert flat Excel data back to package structure
 */
export const convertFlatDataToPackages = (flatData) => {
  const packageMap = new Map();

  flatData.forEach((row, idx) => {
    const packageNumber = row.package || 'Default Package';
    
    if (!packageMap.has(packageNumber)) {
      packageMap.set(packageNumber, {
        packageNumber,
        items: []
      });
    }

    packageMap.get(packageNumber).items.push({
      _originalItemIdx: idx,
      itemCode: row.itemCode || '',
      name: row.itemName || '',
      itemName: row.itemName || '',
      quantity: parseInt(row.quantity, 10) || 0,
      uom: row.uom || 'pcs',
      condition: row.condition || 'Baik',
      value: parseFloat(row.value) || 0,
      notes: row.notes || ''
    });
  });

  return Array.from(packageMap.values());
};

/**
 * Merge imported data with existing editData
 * mergeMode: 'replace' (seluruh data) atau 'update' (partial/update yang ada saja)
 */
export const mergeImportedData = (editData, importedData, mergeMode = 'replace') => {
  const merged = JSON.parse(JSON.stringify(editData)); // Deep clone

  try {
    if (mergeMode === 'replace') {
      // Replace seluruh packages
      merged.packages = importedData;
      console.log('✅ Data replaced completely');
    } else if (mergeMode === 'update') {
      // Update: merge berdasarkan itemCode & packageNumber
      importedData.forEach(importedPkg => {
        const existingPkg = merged.packages?.find(
          p => p.packageNumber === importedPkg.packageNumber
        );

        if (existingPkg) {
          // Update existing package items
          importedPkg.items.forEach(importedItem => {
            const existingItem = existingPkg.items?.find(
              i => i.itemCode === importedItem.itemCode
            );

            if (existingItem) {
              // Update existing item (merge fields)
              Object.assign(existingItem, importedItem);
            } else {
              // Add new item
              existingPkg.items.push(importedItem);
            }
          });
        } else {
          // Add new package
          merged.packages.push(importedPkg);
        }
      });
      console.log('✅ Data updated (partial merge)');
    }

    return { success: true, data: merged };
  } catch (error) {
    console.error('❌ Merge error:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Main import handler - orchestrates the entire import process
 */
export const handleImportWarehouseData = async (file, editData, mergeMode = 'replace') => {
  try {
    // Step 1: Parse file
    const { format, data: rawData } = await parseImportedFile(file);
    console.log(`✅ File parsed as ${format}:`, rawData);

    // Step 2: Validate data
    const validation = validateImportedData(rawData, format);
    if (!validation.valid) {
      return {
        success: false,
        errors: validation.errors,
        warnings: validation.warnings
      };
    }

    // Step 3: Convert to packages structure
    let importedPackages;
    if (format === 'json') {
      importedPackages = rawData.packages;
    } else {
      importedPackages = convertFlatDataToPackages(rawData);
    }

    console.log(`✅ Converted to packages:`, importedPackages);

    // Step 4: Merge with existing data
    const mergeResult = mergeImportedData(editData, importedPackages, mergeMode);
    if (!mergeResult.success) {
      return { success: false, errors: [mergeResult.error] };
    }

    // Step 5: Return success
    return {
      success: true,
      warnings: validation.warnings,
      data: mergeResult.data,
      itemsImported: importedPackages.reduce(
        (sum, pkg) => sum + (pkg.items?.length || 0),
        0
      ),
      mergeMode
    };
  } catch (error) {
    console.error('❌ Import handler error:', error);
    return {
      success: false,
      errors: [error.message]
    };
  }
};
