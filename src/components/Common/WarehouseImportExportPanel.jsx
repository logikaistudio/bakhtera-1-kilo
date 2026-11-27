import React, { useState } from 'react';
import { Upload, Download, AlertCircle, CheckCircle, FileUp } from 'lucide-react';
import Button from './Button';

/**
 * Component untuk Import/Export data Warehouse Inventory
 * User bisa pilih merge mode: replace atau update
 */
const WarehouseImportExportPanel = ({ 
  onExport, 
  onImport, 
  isLoading = false,
  exportInProgress = false
}) => {
  const [showImportOptions, setShowImportOptions] = useState(false);
  const [mergeMode, setMergeMode] = useState('replace');
  const [importMessage, setImportMessage] = useState(null);
  const fileInputRef = React.useRef(null);

  const handleExportClick = async () => {
    try {
      await onExport();
      setImportMessage({
        type: 'success',
        text: '✅ File berhasil di-export. Simpan file dan edit sesuai kebutuhan.'
      });
      setTimeout(() => setImportMessage(null), 4000);
    } catch (error) {
      setImportMessage({
        type: 'error',
        text: `❌ Export gagal: ${error.message}`
      });
    }
  };

  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setImportMessage({ type: 'loading', text: '⏳ Sedang import data...' });
      await onImport(file, mergeMode);
      setImportMessage({
        type: 'success',
        text: `✅ Import berhasil! Mode: ${mergeMode === 'replace' ? 'Replace Semua' : 'Update Sebagian'}`
      });
      setShowImportOptions(false);
      setTimeout(() => setImportMessage(null), 4000);
    } catch (error) {
      setImportMessage({
        type: 'error',
        text: `❌ Import gagal: ${error.message}`
      });
    } finally {
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  return (
    <div className="space-y-3">
      {/* Message Alert */}
      {importMessage && (
        <div className={`p-3 rounded-lg flex items-start gap-2 ${
          importMessage.type === 'success' ? 'bg-green-50 dark:bg-green-900/20' :
          importMessage.type === 'error' ? 'bg-red-50 dark:bg-red-900/20' :
          'bg-blue-50 dark:bg-blue-900/20'
        }`}>
          {importMessage.type === 'success' && <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />}
          {importMessage.type === 'error' && <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />}
          {importMessage.type === 'loading' && <FileUp className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5 animate-pulse" />}
          <p className={`text-sm ${
            importMessage.type === 'success' ? 'text-green-800 dark:text-green-200' :
            importMessage.type === 'error' ? 'text-red-800 dark:text-red-200' :
            'text-blue-800 dark:text-blue-200'
          }`}>
            {importMessage.text}
          </p>
        </div>
      )}

      {/* Export Button */}
      <Button
        onClick={handleExportClick}
        variant="secondary"
        icon={Download}
        disabled={exportInProgress || isLoading}
        className="w-full text-sm"
      >
        {exportInProgress ? '⏳ Sedang export...' : '📥 Export Template (Excel)'}
      </Button>

      {/* Import Toggle Button */}
      <Button
        onClick={() => setShowImportOptions(!showImportOptions)}
        variant="secondary"
        icon={Upload}
        disabled={isLoading}
        className="w-full text-sm"
      >
        {showImportOptions ? '✕ Tutup Import' : '📤 Import Data (Excel/JSON)'}
      </Button>

      {/* Import Options Panel */}
      {showImportOptions && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3 space-y-3">
          {/* Merge Mode Selection */}
          <div>
            <label className="text-xs font-semibold text-gray-700 dark:text-gray-300 block mb-2">
              Pilih mode import:
            </label>
            <div className="space-y-2">
              {/* Replace Mode */}
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="mergeMode"
                  value="replace"
                  checked={mergeMode === 'replace'}
                  onChange={(e) => setMergeMode(e.target.value)}
                  className="w-4 h-4"
                />
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    🔄 Replace Semua Data
                  </p>
                  <p className="text-xs text-gray-600 dark:text-gray-400">
                    Ganti seluruh data dengan file yang di-import
                  </p>
                </div>
              </label>

              {/* Update Mode */}
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="mergeMode"
                  value="update"
                  checked={mergeMode === 'update'}
                  onChange={(e) => setMergeMode(e.target.value)}
                  className="w-4 h-4"
                />
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    ✏️ Update Sebagian (Merge)
                  </p>
                  <p className="text-xs text-gray-600 dark:text-gray-400">
                    Merge data: update yang ada, tambah yang baru
                  </p>
                </div>
              </label>
            </div>
          </div>

          {/* File Input */}
          <div>
            <label className="text-xs font-semibold text-gray-700 dark:text-gray-300 block mb-2">
              Pilih file (.xlsx atau .json):
            </label>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.json,.csv"
              onChange={handleFileSelect}
              disabled={isLoading}
              className="w-full text-xs cursor-pointer file:cursor-pointer file:bg-blue-600 file:text-white file:border-0 file:rounded file:px-3 file:py-1"
            />
            <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
              Format: Excel (.xlsx) atau JSON
            </p>
          </div>

          {/* Help Text */}
          <div className="bg-white dark:bg-dark-surface p-2 rounded text-xs text-gray-700 dark:text-gray-300 space-y-1">
            <p><strong>Replace Mode:</strong></p>
            <ul className="list-disc list-inside ml-1">
              <li>Menghapus semua item yang sekarang</li>
              <li>Import item dari file</li>
              <li>Gunakan untuk entry baru dari awal</li>
            </ul>
            
            <p className="mt-2"><strong>Update Mode:</strong></p>
            <ul className="list-disc list-inside ml-1">
              <li>Update qty/notes item yang sudah ada (match by itemCode)</li>
              <li>Tambah item baru yang belum ada</li>
              <li>Gunakan untuk melengkapi/update data</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
};

export default WarehouseImportExportPanel;
