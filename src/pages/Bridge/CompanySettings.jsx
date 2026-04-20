import React, { useState, useEffect } from 'react';
import { useData } from '../../context/DataContext';
import Modal from '../../components/Common/Modal';
import Button from '../../components/Common/Button';
import { Plus, Building, MapPin, CreditCard, Upload, X, Image as ImageIcon, Trash2, Phone, Mail, FileText } from 'lucide-react';
import { validateAndConvertImage } from '../../utils/validateImage';

const BridgeCompanySettings = () => {
    const {
        bridgeSettings, // Bridge Settings
        bridgeBankAccounts, // Bridge Bank Accounts
        updateCompanySettings,
        addBankAccount,
        updateBankAccount,
        deleteBankAccount,
        uploadCompanyLogo,
        fetchCompanySettings
    } = useData();

    // Module Identifier
    const MODULE = 'bridge';

    // Local state for form
    const [companyName, setCompanyName] = useState('');
    const [companyAddress, setCompanyAddress] = useState('');
    const [companyPhone, setCompanyPhone] = useState('');
    const [companyFax, setCompanyFax] = useState('');
    const [companyEmail, setCompanyEmail] = useState('');
    const [companyNpwp, setCompanyNpwp] = useState('');
    const [logoUrl, setLogoUrl] = useState('');
    const [logoPreview, setLogoPreview] = useState(null);
    const [isUploading, setIsUploading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    // Bank account modal state
    const [isBankModalOpen, setIsBankModalOpen] = useState(false);
    const [editingBank, setEditingBank] = useState(null);
    const [bankFormData, setBankFormData] = useState({
        bank_name: '',
        account_number: '',
        account_holder: '',
        branch: '',
        swift_code: '',
        currency: 'IDR'
    });

    // Load company settings on mount
    useEffect(() => {
        if (bridgeSettings) {
            setCompanyName(bridgeSettings.company_name || '');
            setCompanyAddress(bridgeSettings.company_address || '');
            setCompanyPhone(bridgeSettings.company_phone || '');
            setCompanyFax(bridgeSettings.company_fax || '');
            setCompanyEmail(bridgeSettings.company_email || '');
            setCompanyNpwp(bridgeSettings.company_npwp || '');
            setLogoUrl(bridgeSettings.logo_url || '');
        }
    }, [bridgeSettings]);

    // Handle company info save
    const handleSaveCompanyInfo = async () => {
        setIsSaving(true);
        try {
            console.log(`💾 Saving ${MODULE} company info...`);
            await updateCompanySettings({
                company_name: companyName,
                company_address: companyAddress,
                company_phone: companyPhone,
                company_fax: companyFax,
                company_email: companyEmail,
                company_npwp: companyNpwp,
                logo_url: logoUrl
            }, MODULE);
            console.log('✅ Company info saved!');

            // Refresh data from database
            await fetchCompanySettings(MODULE);

            alert('✅ Informasi perusahaan berhasil disimpan');
        } catch (error) {
            console.error('Error saving company info:', error);
            alert('❌ Gagal menyimpan: ' + error.message);
        } finally {
            setIsSaving(false);
        }
    };

    // Handle logo upload
    const handleLogoUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setIsUploading(true);
        try {
            // Validate image
            const { base64 } = await validateAndConvertImage(file);

            // Upload to Supabase (using existing function, assuming generic bucket)
            const uploadedUrl = await uploadCompanyLogo(file, MODULE);

            if (uploadedUrl) {
                setLogoUrl(uploadedUrl);
                setLogoPreview(base64); // Show optimistic preview
            }
        } catch (error) {
            console.error('Upload failed:', error);
            alert('Upload logo gagal: ' + error.message);
        } finally {
            setIsUploading(false);
        }
    };

    // Bank Account Handlers
    const handleAddBank = () => {
        if (!bridgeSettings?.id) {
            alert('Simpan informasi perusahaan terlebih dahulu sebelum menambahkan rekening bank.');
            return;
        }
        setEditingBank(null);
        setBankFormData({
            bank_name: '',
            account_number: '',
            account_holder: '',
            branch: '',
            swift_code: '',
            currency: 'IDR'
        });
        setIsBankModalOpen(true);
    };

    const handleEditBank = (bank) => {
        setEditingBank(bank);
        setBankFormData({
            bank_name: bank.bank_name,
            account_number: bank.account_number,
            account_holder: bank.account_holder,
            branch: bank.branch || '',
            swift_code: bank.swift_code || '',
            currency: bank.currency || 'IDR'
        });
        setIsBankModalOpen(true);
    };

    const handleDeleteBank = async (id) => {
        if (window.confirm('Hapus rekening ini?')) {
            try {
                await deleteBankAccount(id, MODULE);
                alert('Rekening dihapus');
            } catch (error) {
                alert('Gagal menghapus rekening');
            }
        }
    };

    const handleBankSubmit = async (e) => {
        e.preventDefault();
        try {
            if (editingBank) {
                await updateBankAccount(editingBank.id, bankFormData, MODULE);
            } else {
                await addBankAccount(bankFormData, MODULE);
            }
            setIsBankModalOpen(false);
            // alert('Rekening berhasil disimpan'); // Optional feedback
        } catch (error) {
            alert('Gagal menyimpan rekening: ' + error.message);
        }
    };

    return (
        <div className="p-6 max-w-7xl mx-auto">
            <h1 className="text-2xl font-bold mb-6 flex items-center gap-2">
                <Building className="h-6 w-6 text-indigo-600" />
                Pengaturan Perusahaan (Bridge)
            </h1>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left Column - Company Data Form */}
                <div className="lg:col-span-2 space-y-6">
                    {/* General Info Card */}
                    <div className="bg-white rounded-lg shadow p-6 border border-gray-100">
                        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2 border-b pb-2">
                            <FileText className="h-5 w-5 text-gray-500" />
                            Informasi Umum
                        </h2>

                        <div className="grid grid-cols-1 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Nama Perusahaan</label>
                                <input
                                    type="text"
                                    value={companyName}
                                    onChange={(e) => setCompanyName(e.target.value)}
                                    className="w-full px-3 py-2 border rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                                    placeholder="PT. Example Name"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Alamat Lengkap</label>
                                <textarea
                                    value={companyAddress}
                                    onChange={(e) => setCompanyAddress(e.target.value)}
                                    rows={3}
                                    className="w-full px-3 py-2 border rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                                    placeholder="Jl. Alamat Perusahaan..."
                                />
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
                                        <Phone className="h-3 w-3" /> Telepon
                                    </label>
                                    <input
                                        type="text"
                                        value={companyPhone}
                                        onChange={(e) => setCompanyPhone(e.target.value)}
                                        className="w-full px-3 py-2 border rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
                                        <Phone className="h-3 w-3" /> Fax
                                    </label>
                                    <input
                                        type="text"
                                        value={companyFax}
                                        onChange={(e) => setCompanyFax(e.target.value)}
                                        className="w-full px-3 py-2 border rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
                                        <Mail className="h-3 w-3" /> Email
                                    </label>
                                    <input
                                        type="email"
                                        value={companyEmail}
                                        onChange={(e) => setCompanyEmail(e.target.value)}
                                        className="w-full px-3 py-2 border rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">NPWP</label>
                                    <input
                                        type="text"
                                        value={companyNpwp}
                                        onChange={(e) => setCompanyNpwp(e.target.value)}
                                        className="w-full px-3 py-2 border rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="mt-6 flex justify-end">
                            <Button onClick={handleSaveCompanyInfo} disabled={isSaving}>
                                {isSaving ? 'Menyimpan...' : 'Simpan Perubahan'}
                            </Button>
                        </div>
                    </div>

                    {/* Bank Accounts Card */}
                    <div className="bg-white rounded-lg shadow p-6 border border-gray-100">
                        <div className="flex justify-between items-center mb-4 border-b pb-2">
                            <h2 className="text-lg font-semibold flex items-center gap-2">
                                <CreditCard className="h-5 w-5 text-gray-500" />
                                Rekening Bank
                            </h2>
                            <Button
                                size="sm"
                                onClick={handleAddBank}
                                Icon={Plus}
                                disabled={!bridgeSettings?.id || (bridgeBankAccounts && bridgeBankAccounts.length >= 4)}
                                title={!bridgeSettings?.id ? "Simpan informasi perusahaan terlebih dahulu" : bridgeBankAccounts && bridgeBankAccounts.length >= 4 ? "Maksimal 4 rekening bank" : ""}
                            >
                                Tambah Rekening
                            </Button>
                        </div>

                        <div className="space-y-3">
                            {bridgeBankAccounts && bridgeBankAccounts.length === 0 ? (
                                <p className="text-gray-500 text-center py-4">Belum ada rekening bank terdaftar.</p>
                            ) : (
                                bridgeBankAccounts && bridgeBankAccounts.map((bank) => (
                                    <div key={bank.id} className="flex justify-between items-center p-3 border rounded-md hover:bg-gray-50 transition-colors">
                                        <div>
                                            <div className="font-bold text-gray-800">{bank.bank_name} ({bank.currency || 'IDR'})</div>
                                            <div className="text-indigo-600 font-mono tracking-wide">{bank.account_number}</div>
                                            <div className="text-sm text-gray-600">a/n {bank.account_holder}</div>
                                            {bank.branch && <div className="text-xs text-gray-500">Cabang: {bank.branch}</div>}
                                        </div>
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => handleEditBank(bank)}
                                                className="p-1.5 text-blue-600 hover:bg-blue-50 rounded"
                                            >
                                                Edit
                                            </button>
                                            <button
                                                onClick={() => handleDeleteBank(bank.id)}
                                                className="p-1.5 text-red-600 hover:bg-red-50 rounded"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>

                {/* Right Column - Logo & Preview */}
                <div className="lg:col-span-1 space-y-6">
                    <div className="bg-white rounded-lg shadow p-6 border border-gray-100">
                        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                            <ImageIcon className="h-5 w-5 text-gray-500" />
                            Logo Perusahaan
                        </h2>

                        <div className="flex flex-col items-center">
                            <div className="w-48 h-48 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center bg-gray-50 mb-4 overflow-hidden relative group">
                                {logoUrl || logoPreview ? (
                                    <img
                                        src={logoPreview || logoUrl}
                                        alt="Company Logo"
                                        className="max-w-full max-h-full object-contain"
                                    />
                                ) : (
                                    <div className="text-gray-400 text-center p-4">
                                        <Building className="h-12 w-12 mx-auto mb-2 opacity-50" />
                                        <span className="text-sm">No Logo</span>
                                    </div>
                                )}

                                {isUploading && (
                                    <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center text-white">
                                        Uploading...
                                    </div>
                                )}
                            </div>

                            <input
                                type="file"
                                id="logo-upload"
                                className="hidden"
                                accept="image/*"
                                onChange={handleLogoUpload}
                                disabled={isUploading}
                            />
                            <label
                                htmlFor="logo-upload"
                                className="cursor-pointer bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-50 flex items-center gap-2 shadow-sm"
                            >
                                <Upload className="h-4 w-4" />
                                {logoUrl ? 'Ganti Logo' : 'Upload Logo'}
                            </label>
                            <p className="text-xs text-gray-500 mt-2 text-center">
                                Format: PNG, JPG (Max 2MB)<br />
                                Disarankan background transparan
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Bank Account Modal */}
            <Modal
                isOpen={isBankModalOpen}
                onClose={() => setIsBankModalOpen(false)}
                title={editingBank ? "Edit Rekening Bank" : "Tambah Rekening Bank"}
            >
                <form onSubmit={handleBankSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium mb-1">Nama Bank</label>
                        <input
                            type="text"
                            value={bankFormData.bank_name}
                            onChange={(e) => setBankFormData({ ...bankFormData, bank_name: e.target.value })}
                            placeholder="Contoh: BCA, Mandiri"
                            className="w-full px-3 py-2 border rounded-md"
                            required
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1">Nomor Rekening</label>
                        <input
                            type="text"
                            value={bankFormData.account_number}
                            onChange={(e) => setBankFormData({ ...bankFormData, account_number: e.target.value })}
                            className="w-full px-3 py-2 border rounded-md"
                            required
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1">Atas Nama (A/N)</label>
                        <input
                            type="text"
                            value={bankFormData.account_holder}
                            onChange={(e) => setBankFormData({ ...bankFormData, account_holder: e.target.value })}
                            className="w-full px-3 py-2 border rounded-md"
                            required
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium mb-1">Mata Uang</label>
                            <select
                                value={bankFormData.currency}
                                onChange={(e) => setBankFormData({ ...bankFormData, currency: e.target.value })}
                                className="w-full px-3 py-2 border rounded-md"
                            >
                                <option value="IDR">IDR</option>
                                <option value="USD">USD</option>
                                <option value="EUR">EUR</option>
                                <option value="SGD">SGD</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1">Cabang (Branch)</label>
                            <input
                                type="text"
                                value={bankFormData.branch}
                                onChange={(e) => setBankFormData({ ...bankFormData, branch: e.target.value })}
                                placeholder="Contoh: KCU Jakarta"
                                className="w-full px-3 py-2 border rounded-md"
                            />
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1">SWIFT Code (Opsional)</label>
                        <input
                            type="text"
                            value={bankFormData.swift_code}
                            onChange={(e) => setBankFormData({ ...bankFormData, swift_code: e.target.value })}
                            placeholder="BMRIIDJA"
                            className="w-full px-3 py-2 border rounded-md"
                        />
                    </div>

                    <div className="flex gap-3 justify-end mt-6">
                        <Button
                            type="button"
                            variant="secondary"
                            onClick={() => setIsBankModalOpen(false)}
                        >
                            Batal
                        </Button>
                        <Button type="submit">
                            {editingBank ? 'Update' : 'Simpan'}
                        </Button>
                    </div>
                </form>
            </Modal>
        </div >
    );
};

export default BridgeCompanySettings;
