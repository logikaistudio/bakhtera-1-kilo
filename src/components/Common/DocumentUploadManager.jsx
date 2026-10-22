import React, { useState } from 'react';
import { Upload, File, X, FileText, Image } from 'lucide-react';
import Button from './Button';
import { formatCurrency } from '../../utils/currencyFormatter';
import { useLanguage } from '../../i18n/LanguageContext';

const DocumentUploadManager = ({ documents = [], onChange, maxFiles = null, maxSizeKB = 200 }) => {
    const { t } = useLanguage();
    const [documentName, setDocumentName] = useState('');
    const [uploading, setUploading] = useState(false);

    const getFileIcon = (fileType) => {
        if (fileType === 'pdf') return FileText;
        if (fileType === 'jpeg' || fileType === 'png') return Image;
        return File;
    };

    const validateFile = (file) => {
        // Check file type
        const validTypes = ['application/pdf', 'image/jpeg', 'image/png'];
        if (!validTypes.includes(file.type)) {
            alert(t("Tipe file tidak valid. Hanya PDF, JPEG, dan PNG yang diperbolehkan."));
            return false;
        }

        // Check file size (convert to KB)
        const fileSizeKB = file.size / 1024;
        if (fileSizeKB > maxSizeKB) {
            alert(`Ukuran file terlalu besar. Maksimal ${maxSizeKB}KB. File Anda: ${Math.round(fileSizeKB)}KB`);
            return false;
        }

        return true;
    };

    const handleFileSelect = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        // Check max files limit
        if (maxFiles && documents.length >= maxFiles) {
            alert(`Maksimal ${maxFiles} dokumen.`);
            e.target.value = '';
            return;
        }

        // Validate file
        if (!validateFile(file)) {
            e.target.value = '';
            return;
        }

        // Check if document name is provided
        if (!documentName.trim()) {
            alert(t("Masukkan nama dokumen terlebih dahulu."));
            e.target.value = '';
            return;
        }

        setUploading(true);

        try {
            // Convert to base64
            const reader = new FileReader();
            reader.onload = (event) => {
                const newDocument = {
                    id: `doc-${Date.now()}`,
                    name: documentName.trim(),
                    fileName: file.name,
                    fileType: file.type.split('/')[1],
                    fileSize: file.size,
                    fileData: event.target.result,
                    uploadedAt: new Date().toISOString()
                };

                onChange([...documents, newDocument]);
                setDocumentName('');
                e.target.value = '';
                setUploading(false);
            };

            reader.onerror = () => {
                alert(t("Gagal membaca file"));
                setUploading(false);
                e.target.value = '';
            };

            reader.readAsDataURL(file);
        } catch (error) {
            alert('Gagal mengupload file: ' + error.message);
            setUploading(false);
            e.target.value = '';
        }
    };

    const handleRemove = (docId) => {
        if (window.confirm('Hapus dokumen ini?')) {
            onChange(documents.filter(doc => doc.id !== docId));
        }
    };

    const formatFileSize = (bytes) => {
        return `${Math.round(bytes / 1024)} KB`;
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center gap-2">
                <Upload className="w-5 h-5 text-accent-purple" />
                <h3 className="text-lg font-semibold text-silver-light">{t("Dokumen Pendukung")}</h3>
                <span className="text-xs text-silver-dark">
                    ({documents.length}{maxFiles ? `/${maxFiles}` : ''} {t("dokumen, max")} {maxSizeKB}{t("KB per file)")}
                </span>
            </div>

            {/* Upload Form */}
            <div className="glass-card p-4 rounded-lg border border-dark-border">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div>
                        <label className="block text-sm font-medium text-silver mb-2">
                            {t("Nama Dokumen")}
                        </label>
                        <input
                            type="text"
                            value={documentName}
                            onChange={(e) => setDocumentName(e.target.value)}
                            placeholder={t("contoh: KTP Direktur, NPWP Perusahaan")}
                            className="w-full"
                            disabled={uploading || (maxFiles ? documents.length >= maxFiles : false)}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-silver mb-2">
                            {t("Pilih File (PDF/JPEG/PNG)")}
                        </label>
                        <input
                            type="file"
                            accept=".pdf,.jpg,.jpeg,.png"
                            onChange={handleFileSelect}
                            className="w-full"
                            disabled={uploading || (maxFiles ? documents.length >= maxFiles : false)}
                        />
                    </div>
                </div>
                {uploading && (
                    <div className="text-sm text-accent-blue">
                        {t("Mengupload dokumen...")}
                    </div>
                )}
                {maxFiles && documents.length >= maxFiles && (
                    <div className="text-sm text-accent-orange">
                        {t("⚠️ Batas maksimal")} {maxFiles} {t("dokumen tercapai")}
                    </div>
                )}
            </div>

            {/* Documents List */}
            {documents.length > 0 && (
                <div className="glass-card rounded-lg overflow-hidden">
                    <table className="w-full">
                        <thead className="bg-accent-purple">
                            <tr>
                                <th className="px-4 py-3 text-left text-sm font-semibold text-white">{t("Icon")}</th>
                                <th className="px-4 py-3 text-left text-sm font-semibold text-white">{t("Nama Dokumen")}</th>
                                <th className="px-4 py-3 text-left text-sm font-semibold text-white">{t("File")}</th>
                                <th className="px-4 py-3 text-left text-sm font-semibold text-white">{t("Ukuran")}</th>
                                <th className="px-4 py-3 text-left text-sm font-semibold text-white">{t("Upload")}</th>
                                <th className="px-4 py-3 text-center text-sm font-semibold text-white">{t("Aksi")}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-dark-border">
                            {documents.map(doc => {
                                const IconComponent = getFileIcon(doc.fileType);
                                return (
                                    <tr key={doc.id} className="hover:bg-dark-surface smooth-transition">
                                        <td className="px-4 py-3">
                                            <IconComponent className="w-5 h-5 text-accent-purple" />
                                        </td>
                                        <td className="px-4 py-3 text-sm text-silver-light font-medium">
                                            {doc.name}
                                        </td>
                                        <td className="px-4 py-3 text-sm text-silver-dark">
                                            {doc.fileName}
                                        </td>
                                        <td className="px-4 py-3 text-sm text-silver">
                                            {formatFileSize(doc.fileSize)}
                                        </td>
                                        <td className="px-4 py-3 text-sm text-silver-dark">
                                            {new Date(doc.uploadedAt).toLocaleDateString('id-ID')}
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex items-center justify-center">
                                                <button
                                                    type="button"
                                                    onClick={() => handleRemove(doc.id)}
                                                    className="p-1 hover:bg-red-500 hover:bg-opacity-20 rounded smooth-transition"
                                                    title={t("Hapus Dokumen")}
                                                >
                                                    <X className="w-4 h-4 text-red-400" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};

export default DocumentUploadManager;
