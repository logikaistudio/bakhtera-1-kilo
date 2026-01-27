import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import Button from '../../components/Common/Button';
import Modal from '../../components/Common/Modal';
import XLSX from 'xlsx-js-style';
import {
    Plus, Search, Edit, Trash2, FileText, CheckCircle, XCircle, Grid, List, Upload, Clock
} from 'lucide-react';

const { read, utils } = XLSX;

const COAMaster = () => {
    const [accounts, setAccounts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterType, setFilterType] = useState('ALL');
    const fileInputRef = useRef(null);

    // Modals
    const [showModal, setShowModal] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [formData, setFormData] = useState({
        id: null,
        code: '',
        name: '',
        type: 'ASSET',
        description: '',
        parent_code: '',
        level: 1,
        is_trial_balance: true,
        is_profit_loss: false,
        is_balance_sheet: false,
        is_ar: false,
        is_ap: false,
        is_cashflow: false,
        is_active: true
    });

    const accountTypes = ['ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE'];

    useEffect(() => {
        fetchAccounts();
    }, []);

    const fetchAccounts = async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('finance_coa')
                .select('*')
                .order('code', { ascending: true });

            if (error) throw error;
            setAccounts(data || []);
        } catch (error) {
            console.error('Error fetching accounts:', error);
        } finally {
            setLoading(false);
        }
    };

    // Import States
    const [pendingImportData, setPendingImportData] = useState([]);
    const [showImportModal, setShowImportModal] = useState(false);
    const [importMode, setImportMode] = useState('APPEND');
    const [importStats, setImportStats] = useState({ totalRows: 0, validRows: 0, skippedRows: 0, typeCounts: {} });

    const handleFileUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();

        reader.onload = async (evt) => {
            try {
                const bstr = evt.target.result;
                const wb = read(bstr, { type: 'binary' });
                const wsname = wb.SheetNames[0];
                const ws = wb.Sheets[wsname];
                const data = utils.sheet_to_json(ws);

                console.log('==================================================');
                console.log('[COA Import] FILE LOADED:', file.name);
                console.log('[COA Import] Total rows:', data.length);
                console.log('[COA Import] Columns:', data.length > 0 ? Object.keys(data[0]) : []);
                console.log('[COA Import] Sample row 1:', data[0]);
                console.log('==================================================');

                if (data.length === 0) {
                    alert('Excel file is empty or format is incorrect.');
                    return;
                }

                // Helper: Find column value by checking if column header CONTAINS any keyword
                const getVal = (row, ...keywords) => {
                    const rowKeys = Object.keys(row);
                    for (const key of rowKeys) {
                        const keyClean = key.toLowerCase().trim().replace(/[^a-z0-9]/g, '');
                        for (const kw of keywords) {
                            const kwClean = kw.toLowerCase().trim().replace(/[^a-z0-9]/g, '');
                            if (keyClean.includes(kwClean) || kwClean.includes(keyClean)) {
                                return row[key];
                            }
                        }
                    }
                    return undefined;
                };

                // Helper to parse boolean
                const parseBool = (val, defaultValue) => {
                    if (val === undefined || val === null || val === '') return defaultValue;
                    const s = String(val).toUpperCase().trim();
                    if (['TRUE', 'YES', '1', 'Y', 'V', '✓'].includes(s)) return true;
                    if (['FALSE', 'NO', '0', 'N', 'X'].includes(s)) return false;
                    return defaultValue;
                };

                // Helper to map Group/Type to valid database type
                const mapToType = (groupStr) => {
                    if (!groupStr) return 'ASSET';
                    const g = String(groupStr).toUpperCase().trim();

                    // ASSET - check for "Asset" or "Assets" using prefix
                    if (g.includes('ASSET') || g.includes('ASET') || g.includes('HARTA') ||
                        g.includes('LANCAR') || g.includes('TETAP') || g.includes('PIUTANG') ||
                        g.includes('PERSEDIAAN') || g.includes('INVENTORY') || g.includes('RECEIVABLE') ||
                        g.includes('KAS') || g.includes('CASH')) {
                        return 'ASSET';
                    }

                    // LIABILITY - use "LIABIL" prefix to match both "Liability" and "Liabilities"
                    if (g.includes('LIABIL') || g.includes('LIABILITAS') || g.includes('KEWAJIBAN') ||
                        g.includes('UTANG') || g.includes('HUTANG') || g.includes('PAYABLE') ||
                        g.includes('ACCRUED') || g.includes('KREDITOR')) {
                        return 'LIABILITY';
                    }

                    // EQUITY - use "EQUIT" prefix to match "Equity" and variations
                    if (g.includes('EQUIT') || g.includes('EKUITAS') || g.includes('MODAL') ||
                        g.includes('CAPITAL') || g.includes('RETAINED') || g.includes('LABA DITAHAN') ||
                        g.includes('STOCKHOLDER') || g.includes('SHAREHOLDER')) {
                        return 'EQUITY';
                    }

                    // REVENUE - check for income-related keywords
                    // "Operational Income" should go here, not EXPENSE
                    if (g.includes('REVENUE') || g.includes('INCOME') || g.includes('PENDAPATAN') ||
                        g.includes('PENJUALAN') || g.includes('SALES') || g.includes('PENGHASILAN')) {
                        return 'REVENUE';
                    }

                    // EXPENSE - only if not matched by REVENUE above
                    if (g.includes('EXPENSE') || g.includes('BEBAN') || g.includes('BIAYA') ||
                        g.includes('COST') || g.includes('HPP') || g.includes('COGS') ||
                        g.includes('OPERATIONAL') || g.includes('OPERATING') || g.includes('OVERHEAD') ||
                        g.includes('NON OPERATIONAL') || g.includes('ADMIN') || g.includes('GENERAL') ||
                        g.includes('DEPRECIATION') || g.includes('AMORTIZATION')) {
                        return 'EXPENSE';
                    }

                    console.log(`[COA Import] Unknown type: "${groupStr}" - defaulting to ASSET`);
                    return 'ASSET';
                };


                // Transform Data
                const skippedRows = [];
                const validData = data.map((row, idx) => {
                    const rawCode = getVal(row, 'Code', 'Kode', 'No', 'Nomor', 'Account');
                    const rawName = getVal(row, 'Name', 'Nama', 'Account Name');
                    const rawParent = getVal(row, 'Master Code', 'Parent Code', 'Parent', 'Induk', 'Header');
                    const rawGroup = getVal(row, 'Group', 'Type', 'Tipe', 'Jenis', 'Kategori', 'Category');
                    const rawLevel = getVal(row, 'Level', 'Lvl', 'Tingkat');
                    const rawDesc = getVal(row, 'Description', 'Keterangan', 'Notes');

                    // Skip empty rows
                    if (!rawCode && !rawName) return null;

                    // Validate required
                    if (!rawCode) {
                        skippedRows.push({ row: idx + 2, reason: 'Missing Code', sample: JSON.stringify(row).slice(0, 100) });
                        return null;
                    }
                    if (!rawName) {
                        skippedRows.push({ row: idx + 2, reason: 'Missing Name', sample: JSON.stringify(row).slice(0, 100) });
                        return null;
                    }

                    const mappedType = mapToType(rawGroup);
                    const defaultPL = mappedType === 'REVENUE' || mappedType === 'EXPENSE';
                    const defaultBS = mappedType === 'ASSET' || mappedType === 'LIABILITY' || mappedType === 'EQUITY';

                    // Boolean flags
                    const rawTB = getVal(row, 'Trial Balance', 'TB', 'Neraca Saldo');
                    const rawPL = getVal(row, 'Profit Loss', 'PL', 'Laba Rugi');
                    const rawBS = getVal(row, 'Balance Sheet', 'BS', 'Neraca');
                    const rawAR = getVal(row, 'AR', 'Piutang', 'Receivable');
                    const rawAP = getVal(row, 'AP', 'Hutang', 'Payable');
                    const rawCF = getVal(row, 'Cashflow', 'CF', 'Arus Kas');

                    const result = {
                        code: String(rawCode).trim(),
                        name: String(rawName).trim(),
                        type: mappedType,
                        group_name: rawGroup ? String(rawGroup).trim() : null, // Store original group from Excel
                        parent_code: rawParent ? String(rawParent).trim() : null,
                        description: rawDesc ? String(rawDesc).trim() : '',
                        level: parseInt(rawLevel) || 1,
                        is_trial_balance: parseBool(rawTB, true),
                        is_profit_loss: parseBool(rawPL, defaultPL),
                        is_balance_sheet: parseBool(rawBS, defaultBS),
                        is_ar: parseBool(rawAR, false),
                        is_ap: parseBool(rawAP, false),
                        is_cashflow: parseBool(rawCF, false),
                        updated_at: new Date().toISOString()
                    };

                    if (idx < 5) console.log(`[COA Import] Row ${idx + 1}:`, result);
                    return result;
                }).filter(item => item !== null && item.code && item.name);

                // Summary
                console.log(`[COA Import] ========== SUMMARY ==========`);
                console.log(`[COA Import] Excel rows: ${data.length}`);
                console.log(`[COA Import] Valid: ${validData.length}`);
                console.log(`[COA Import] Skipped: ${skippedRows.length}`);
                if (skippedRows.length > 0) console.log(`[COA Import] Skipped details:`, skippedRows.slice(0, 10));

                const typeCounts = validData.reduce((acc, item) => {
                    acc[item.type] = (acc[item.type] || 0) + 1;
                    return acc;
                }, {});

                // Count by group_name for sub-category distribution
                const groupCounts = validData.reduce((acc, item) => {
                    const groupName = item.group_name || 'Unknown';
                    acc[groupName] = (acc[groupName] || 0) + 1;
                    return acc;
                }, {});

                console.log(`[COA Import] Type distribution:`, typeCounts);
                console.log(`[COA Import] Group distribution:`, groupCounts);
                console.log(`[COA Import] =============================`);

                if (validData.length === 0) {
                    alert(`No valid data found (0 of ${data.length} rows).\n\nEnsure Excel has columns: Code, Name`);
                    return;
                }

                // Save stats for display
                setImportStats({
                    totalRows: data.length,
                    validRows: validData.length,
                    skippedRows: skippedRows.length,
                    typeCounts,
                    groupCounts
                });

                setPendingImportData(validData);
                setImportMode('APPEND');
                setShowImportModal(true);

            } catch (error) {
                console.error('Error importing file:', error);
                alert('Failed to import file: ' + error.message);
            } finally {
                if (fileInputRef.current) fileInputRef.current.value = '';
            }
        };

        reader.readAsBinaryString(file);
    };

    const executeImport = async () => {
        try {
            if (importMode === 'REPLACE') {
                if (!confirm('WARNING: This will DELETE ALL existing accounts and replace with new data. Continue?')) return;

                setLoading(true);
                const { error: deleteError } = await supabase
                    .from('finance_coa')
                    .delete()
                    .neq('id', '00000000-0000-0000-0000-000000000000');

                if (deleteError) {
                    if (deleteError.code === '23503' || deleteError.message?.includes('foreign key')) {
                        alert('Failed: Some accounts are linked to transactions. Use APPEND mode instead.');
                        setLoading(false);
                        return;
                    }
                    throw deleteError;
                }

                const { error } = await supabase.from('finance_coa').insert(pendingImportData);
                if (error) throw error;
                alert(`✅ REPLACE Import Berhasil!\n\n📊 Statistik Import:\n• Data dibaca dari Excel: ${importStats.totalRows}\n• Data valid: ${importStats.validRows}\n• Data dilewati: ${importStats.skippedRows}\n• Data berhasil diupload: ${pendingImportData.length}`);

            } else {
                setLoading(true);
                const { error } = await supabase
                    .from('finance_coa')
                    .upsert(pendingImportData, { onConflict: 'code' });

                if (error) throw error;
                alert(`✅ APPEND Import Berhasil!\n\n📊 Statistik Import:\n• Data dibaca dari Excel: ${importStats.totalRows}\n• Data valid: ${importStats.validRows}\n• Data dilewati: ${importStats.skippedRows}\n• Data berhasil diupload: ${pendingImportData.length}`);
            }

            setShowImportModal(false);
            setPendingImportData([]);
            fetchAccounts();

        } catch (error) {
            console.error('Error executing import:', error);
            alert('Import Failed: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    const handleDownloadTemplate = () => {
        const data = [
            {
                "Code": "1101",
                "Name": "Example Account",
                "Master Code": "1100",
                "Group": "ASSET",
                "Level": "1",
                "Trial Balance": "TRUE",
                "Profit & Loss": "FALSE",
                "Balance Sheet": "TRUE",
                "AR": "FALSE",
                "AP": "FALSE",
                "Cashflow": "FALSE",
                "Description": "Optional description"
            }
        ];

        const ws = utils.json_to_sheet(data);
        ws['!cols'] = [
            { wch: 20 }, { wch: 35 }, { wch: 20 }, { wch: 20 },
            { wch: 8 }, { wch: 15 }, { wch: 15 }, { wch: 15 },
            { wch: 8 }, { wch: 8 }, { wch: 10 }, { wch: 30 }
        ];

        const wb = utils.book_new();
        utils.book_append_sheet(wb, ws, "Template");
        XLSX.writeFile(wb, "Template_COA_Import.xlsx");
    };

    const handleSave = async (e) => {
        e.preventDefault();
        try {
            const payload = {
                code: formData.code,
                name: formData.name,
                type: formData.type,
                description: formData.description,
                parent_code: formData.parent_code || null,
                level: parseInt(formData.level) || 1,
                is_trial_balance: formData.is_trial_balance,
                is_profit_loss: formData.is_profit_loss,
                is_balance_sheet: formData.is_balance_sheet,
                is_ar: formData.is_ar,
                is_ap: formData.is_ap,
                is_cashflow: formData.is_cashflow,
            };

            if (isEditing) {
                const { error } = await supabase
                    .from('finance_coa')
                    .update(payload)
                    .eq('id', formData.id);
                if (error) throw error;
            } else {
                const { error } = await supabase
                    .from('finance_coa')
                    .insert([payload]);
                if (error) throw error;
            }

            await fetchAccounts();
            setShowModal(false);
            resetForm();
            alert(isEditing ? 'Account updated!' : 'Account created!');
        } catch (error) {
            console.error('Error saving account:', error);
            alert('Error saving account: ' + error.message);
        }
    };

    const handleDelete = async (id) => {
        if (!confirm('Are you sure you want to delete this account?')) return;
        try {
            const { error } = await supabase
                .from('finance_coa')
                .delete()
                .eq('id', id);

            if (error) throw error;
            await fetchAccounts();
        } catch (error) {
            console.error('Error deleting account:', error);
            alert('Error deleting account: ' + error.message);
        }
    };

    const resetForm = () => {
        setFormData({
            id: null,
            code: '',
            name: '',
            type: 'ASSET',
            description: '',
            parent_code: '',
            level: 1,
            is_trial_balance: true,
            is_profit_loss: false,
            is_balance_sheet: false,
            is_ar: false,
            is_ap: false,
            is_cashflow: false,
            is_active: true
        });
        setIsEditing(false);
    };

    const handleEdit = (acc) => {
        setFormData(acc);
        setIsEditing(true);
        setShowModal(true);
    };

    const filteredAccounts = accounts.filter(acc => {
        const matchesSearch = acc.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
            acc.name.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesType = filterType === 'ALL' || acc.type === filterType;
        return matchesSearch && matchesType;
    });

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold gradient-text">Chart of Accounts</h1>
                    <p className="text-silver-dark mt-1">Master Data Kode Akuntansi Keuangan</p>
                </div>
                <div className="flex gap-3">
                    <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileUpload}
                        className="hidden"
                        accept=".xlsx, .xls"
                    />
                    <Button
                        variant="plain"
                        icon={FileText}
                        onClick={handleDownloadTemplate}
                        className="bg-blue-500/10 text-blue-400 border-blue-500/20 hover:bg-blue-500/20"
                    >
                        Download Template
                    </Button>
                    <Button
                        variant="secondary"
                        icon={Upload}
                        onClick={() => fileInputRef.current.click()}
                    >
                        Import Excel
                    </Button>
                    <Button onClick={() => { resetForm(); setShowModal(true); }} icon={Plus}>
                        Add Account
                    </Button>
                </div>
            </div>

            {/* Filters */}
            <div className="flex flex-col md:flex-row gap-4 mb-4">
                <div className="relative flex-1">
                    <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-4 h-4 text-silver-dark" />
                    <input
                        type="text"
                        placeholder="Search code or account name..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 bg-dark-surface border border-dark-border rounded-lg text-sm text-silver-light focus:border-accent-blue outline-none transition-colors"
                    />
                </div>
                <select
                    value={filterType}
                    onChange={(e) => setFilterType(e.target.value)}
                    className="px-4 py-2.5 bg-dark-surface border border-dark-border rounded-lg text-sm text-silver-light min-w-[180px] focus:border-accent-blue outline-none transition-colors"
                >
                    <option value="ALL">All Types</option>
                    {accountTypes.map(type => (
                        <option key={type} value={type}>{type}</option>
                    ))}
                </select>
            </div>

            {/* Table */}
            <div className="glass-card rounded-lg overflow-hidden border border-dark-border/50">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-dark-surface border-b border-dark-border">
                            <tr className="leading-tight">
                                <th className="px-2 py-1 text-left text-[11px] font-bold text-silver-light uppercase whitespace-nowrap">Code</th>
                                <th className="px-2 py-1 text-left text-[11px] font-bold text-silver-light uppercase whitespace-nowrap">Name</th>
                                <th className="px-2 py-1 text-left text-[11px] font-bold text-silver-light uppercase whitespace-nowrap">Type</th>
                                <th className="px-2 py-1 text-left text-[11px] font-bold text-silver-light uppercase whitespace-nowrap">Group</th>
                                <th className="px-2 py-1 text-center text-[11px] font-bold text-silver-light uppercase whitespace-nowrap">Master Code</th>
                                <th className="px-2 py-1 text-center text-[11px] font-bold text-silver-light uppercase whitespace-nowrap">Lvl</th>
                                <th className="px-2 py-1 text-center text-[11px] font-bold text-silver-light uppercase whitespace-nowrap">TB</th>
                                <th className="px-2 py-1 text-center text-[11px] font-bold text-silver-light uppercase whitespace-nowrap">P&L</th>
                                <th className="px-2 py-1 text-center text-[11px] font-bold text-silver-light uppercase whitespace-nowrap">BS</th>
                                <th className="px-2 py-1 text-center text-[11px] font-bold text-silver-light uppercase whitespace-nowrap">AR</th>
                                <th className="px-2 py-1 text-center text-[11px] font-bold text-silver-light uppercase whitespace-nowrap">AP</th>
                                <th className="px-2 py-1 text-center text-[11px] font-bold text-silver-light uppercase whitespace-nowrap">CF</th>
                                <th className="px-2 py-1 text-right text-[11px] font-bold text-silver-light uppercase whitespace-nowrap">Updated</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-dark-border/10">
                            {loading ? (
                                <tr><td colSpan="13" className="text-center py-4 text-silver-dark text-xs">Loading accounts...</td></tr>
                            ) : filteredAccounts.length === 0 ? (
                                <tr><td colSpan="13" className="text-center py-4 text-silver-dark text-xs">No accounts found.</td></tr>
                            ) : (
                                filteredAccounts.map((acc) => (
                                    <tr
                                        key={acc.id}
                                        onClick={() => handleEdit(acc)}
                                        className="hover:bg-dark-surface/50 cursor-pointer h-6"
                                    >
                                        <td className="px-2 text-[11px] font-semibold text-accent-blue font-mono whitespace-nowrap">{acc.code}</td>
                                        <td className="px-2 text-[11px] text-silver-light whitespace-nowrap">{acc.name}</td>
                                        <td className="px-2 whitespace-nowrap">
                                            <span className={`px-1 text-[9px] font-bold rounded
                                                ${acc.type === 'ASSET' ? 'bg-blue-500/20 text-blue-400' :
                                                    acc.type === 'LIABILITY' ? 'bg-orange-500/20 text-orange-400' :
                                                        acc.type === 'EQUITY' ? 'bg-purple-500/20 text-purple-400' :
                                                            acc.type === 'REVENUE' ? 'bg-green-500/20 text-green-400' :
                                                                'bg-red-500/20 text-red-400'
                                                }`}>
                                                {acc.type}
                                            </span>
                                        </td>
                                        <td className="px-2 text-[10px] text-silver-dark whitespace-nowrap">{acc.group_name || '-'}</td>
                                        <td className="px-2 text-[10px] text-silver-dark text-center whitespace-nowrap">{acc.parent_code || '-'}</td>
                                        <td className="px-2 text-[10px] text-silver-dark text-center">{acc.level || 1}</td>
                                        <td className="px-1 text-center">{acc.is_trial_balance ? <CheckCircle className="w-3 h-3 text-green-400 inline" /> : null}</td>
                                        <td className="px-1 text-center">{acc.is_profit_loss ? <CheckCircle className="w-3 h-3 text-green-400 inline" /> : null}</td>
                                        <td className="px-1 text-center">{acc.is_balance_sheet ? <CheckCircle className="w-3 h-3 text-green-400 inline" /> : null}</td>
                                        <td className="px-1 text-center">{acc.is_ar ? <CheckCircle className="w-3 h-3 text-green-400 inline" /> : null}</td>
                                        <td className="px-1 text-center">{acc.is_ap ? <CheckCircle className="w-3 h-3 text-green-400 inline" /> : null}</td>
                                        <td className="px-1 text-center">{acc.is_cashflow ? <CheckCircle className="w-3 h-3 text-green-400 inline" /> : null}</td>
                                        <td className="px-2 text-[10px] text-silver-dark text-right font-mono whitespace-nowrap">
                                            {new Date(acc.updated_at || acc.created_at || Date.now()).toLocaleDateString('id-ID', {
                                                day: 'numeric', month: 'short'
                                            })}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Import Confirmation Modal */}
            {showImportModal && (
                <Modal isOpen={true} onClose={() => setShowImportModal(false)} title="Import Options">
                    <div className="p-5 space-y-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-blue-500/10 rounded-full border border-blue-500/20">
                                <Upload className="w-5 h-5 text-blue-400" />
                            </div>
                            <div>
                                <h3 className="text-base font-bold text-silver-light">Confirm Import</h3>
                                <p className="text-silver-dark text-xs">
                                    📊 Data dibaca: <strong>{importStats.totalRows}</strong> baris
                                    | Valid: <strong className="text-green-400">{importStats.validRows}</strong>
                                    | Dilewati: <strong className="text-orange-400">{importStats.skippedRows}</strong>
                                </p>
                            </div>
                        </div>

                        <div className="space-y-2">
                            {/* Type Distribution */}
                            <div className="bg-dark-surface/50 rounded-lg p-3 border border-dark-border">
                                <p className="text-xs font-semibold text-silver-light mb-2">📊 Distribusi Type (5 Kategori Utama):</p>
                                <div className="flex flex-wrap gap-2">
                                    {Object.entries(importStats.typeCounts || {}).map(([type, count]) => (
                                        <span key={type} className={`px-2 py-1 rounded text-[11px] font-semibold border
                                            ${type === 'ASSET' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' :
                                                type === 'LIABILITY' ? 'bg-orange-500/10 text-orange-400 border-orange-500/20' :
                                                    type === 'EQUITY' ? 'bg-purple-500/10 text-purple-400 border-purple-500/20' :
                                                        type === 'REVENUE' ? 'bg-green-500/10 text-green-400 border-green-500/20' :
                                                            'bg-red-500/10 text-red-400 border-red-500/20'}`}>
                                            {type}: {count}
                                        </span>
                                    ))}
                                </div>
                            </div>

                            {/* Group Distribution */}
                            <div className="bg-dark-surface/50 rounded-lg p-3 border border-dark-border">
                                <p className="text-xs font-semibold text-silver-light mb-2">📁 Distribusi Group (Sub-Kategori dari Excel):</p>
                                <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                                    {Object.entries(importStats.groupCounts || {}).sort((a, b) => b[1] - a[1]).map(([group, count]) => (
                                        <span key={group} className="px-2 py-0.5 rounded text-[10px] bg-dark-surface border border-dark-border text-silver-light">
                                            {group}: <strong className="text-accent-blue">{count}</strong>
                                        </span>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="space-y-2">

                            <label className={`flex items-start p-3 rounded-lg border cursor-pointer transition-colors ${importMode === 'APPEND' ? 'bg-blue-500/10 border-blue-500/50' : 'bg-dark-surface border-dark-border hover:border-gray-500'}`}>
                                <input
                                    type="radio"
                                    name="importMode"
                                    value="APPEND"
                                    checked={importMode === 'APPEND'}
                                    onChange={(e) => setImportMode(e.target.value)}
                                    className="mt-0.5 mr-3"
                                />
                                <div>
                                    <span className="block text-sm font-semibold text-silver-light">Append / Update (Recommended)</span>
                                    <span className="block text-[11px] text-silver-dark mt-0.5">Adds new accounts & updates existing ones. Safe.</span>
                                </div>
                            </label>

                            <label className={`flex items-start p-3 rounded-lg border cursor-pointer transition-colors ${importMode === 'REPLACE' ? 'bg-red-500/10 border-red-500/50' : 'bg-dark-surface border-dark-border hover:border-gray-500'}`}>
                                <input
                                    type="radio"
                                    name="importMode"
                                    value="REPLACE"
                                    checked={importMode === 'REPLACE'}
                                    onChange={(e) => setImportMode(e.target.value)}
                                    className="mt-0.5 mr-3"
                                />
                                <div>
                                    <span className="block text-sm font-semibold text-red-400">Replace All (Destructive)</span>
                                    <span className="block text-[11px] text-silver-dark mt-0.5">Deletes ALL current accounts first. <strong>Fails if data is in use.</strong></span>
                                </div>
                            </label>
                        </div>

                        <div className="flex justify-end gap-2 pt-3 border-t border-dark-border">
                            <button
                                onClick={() => setShowImportModal(false)}
                                className="px-3 py-1.5 text-xs font-medium text-silver-dark hover:bg-dark-surface rounded-lg transition-colors"
                            >
                                Cancel
                            </button>
                            <Button onClick={executeImport} className={`py-1.5 text-xs ${importMode === 'REPLACE' ? 'bg-red-500 hover:bg-red-600' : ''}`}>
                                {importMode === 'REPLACE' ? 'Replace & Import' : 'Import Data'}
                            </Button>
                        </div>
                    </div>
                </Modal>
            )}

            {/* Editor Modal */}
            {showModal && (
                <Modal isOpen={true} onClose={() => setShowModal(false)} title={isEditing ? "Edit Account" : "New Account"}>
                    <form onSubmit={handleSave} className="p-4 space-y-3 max-h-[85vh] overflow-y-auto">
                        <div className="flex justify-between items-center mb-2">
                            <h2 className="text-lg font-bold text-silver-light">{isEditing ? 'Edit Account' : 'Create New Account'}</h2>
                            {isEditing && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        if (confirm('Are you sure you want to delete this account?')) {
                                            handleDelete(formData.id);
                                            setShowModal(false);
                                        }
                                    }}
                                    className="text-red-400 hover:text-red-300 flex items-center gap-1 text-xs bg-red-500/10 px-2 py-1 rounded border border-red-500/20"
                                >
                                    <Trash2 className="w-3.5 h-3.5" /> Delete
                                </button>
                            )}
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block text-xs font-medium text-silver-dark mb-1">Account Code</label>
                                <input
                                    type="text"
                                    value={formData.code}
                                    onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                                    className="w-full px-3 py-1.5 text-sm bg-dark-surface border border-dark-border rounded-lg text-silver-light focus:border-accent-blue outline-none"
                                    required
                                    placeholder="e.g. 1101"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-silver-dark mb-1">Master Code</label>
                                <input
                                    type="text"
                                    value={formData.parent_code}
                                    onChange={(e) => setFormData({ ...formData, parent_code: e.target.value })}
                                    className="w-full px-3 py-1.5 text-sm bg-dark-surface border border-dark-border rounded-lg text-silver-light focus:border-accent-blue outline-none"
                                    placeholder="Parent Code"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-medium text-silver-dark mb-1">Account Name</label>
                            <input
                                type="text"
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                className="w-full px-3 py-1.5 text-sm bg-dark-surface border border-dark-border rounded-lg text-silver-light focus:border-accent-blue outline-none"
                                required
                                placeholder="e.g. Kas Besar"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block text-xs font-medium text-silver-dark mb-1">Group (Type)</label>
                                <select
                                    value={formData.type}
                                    onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                                    className="w-full px-3 py-1.5 text-sm bg-dark-surface border border-dark-border rounded-lg text-silver-light focus:border-accent-blue outline-none"
                                >
                                    {accountTypes.map(t => (
                                        <option key={t} value={t}>
                                            {t.charAt(0) + t.slice(1).toLowerCase()}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-silver-dark mb-1">Level</label>
                                <input
                                    type="number"
                                    value={formData.level}
                                    onChange={(e) => setFormData({ ...formData, level: e.target.value })}
                                    className="w-full px-3 py-1.5 text-sm bg-dark-surface border border-dark-border rounded-lg text-silver-light focus:border-accent-blue outline-none"
                                    min="1"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-medium text-silver-dark mb-1">Description</label>
                            <textarea
                                value={formData.description}
                                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                className="w-full px-3 py-1.5 text-sm bg-dark-surface border border-dark-border rounded-lg text-silver-light focus:border-accent-blue outline-none"
                                rows="2"
                                placeholder="Optional description"
                            />
                        </div>

                        {/* Report Flags */}
                        <div className="space-y-2 pt-2 border-t border-dark-border">
                            <p className="text-xs font-semibold text-silver-light">Report Settings</p>
                            <div className="grid grid-cols-2 gap-x-2 gap-y-1">
                                <label className="flex items-center space-x-2 text-xs text-silver-dark cursor-pointer hover:text-white transition-colors">
                                    <input type="checkbox" checked={formData.is_trial_balance} onChange={(e) => setFormData({ ...formData, is_trial_balance: e.target.checked })} className="rounded bg-dark-surface border-gray-600 w-3.5 h-3.5 accent-accent-blue" />
                                    <span>Trial Balance</span>
                                </label>
                                <label className="flex items-center space-x-2 text-xs text-silver-dark cursor-pointer hover:text-white transition-colors">
                                    <input type="checkbox" checked={formData.is_profit_loss} onChange={(e) => setFormData({ ...formData, is_profit_loss: e.target.checked })} className="rounded bg-dark-surface border-gray-600 w-3.5 h-3.5 accent-accent-blue" />
                                    <span>Profit & Loss</span>
                                </label>
                                <label className="flex items-center space-x-2 text-xs text-silver-dark cursor-pointer hover:text-white transition-colors">
                                    <input type="checkbox" checked={formData.is_balance_sheet} onChange={(e) => setFormData({ ...formData, is_balance_sheet: e.target.checked })} className="rounded bg-dark-surface border-gray-600 w-3.5 h-3.5 accent-accent-blue" />
                                    <span>Balance Sheet</span>
                                </label>
                                <label className="flex items-center space-x-2 text-xs text-silver-dark cursor-pointer hover:text-white transition-colors">
                                    <input type="checkbox" checked={formData.is_ar} onChange={(e) => setFormData({ ...formData, is_ar: e.target.checked })} className="rounded bg-dark-surface border-gray-600 w-3.5 h-3.5 accent-accent-blue" />
                                    <span>Accounts Receivable (AR)</span>
                                </label>
                                <label className="flex items-center space-x-2 text-xs text-silver-dark cursor-pointer hover:text-white transition-colors">
                                    <input type="checkbox" checked={formData.is_ap} onChange={(e) => setFormData({ ...formData, is_ap: e.target.checked })} className="rounded bg-dark-surface border-gray-600 w-3.5 h-3.5 accent-accent-blue" />
                                    <span>Accounts Payable (AP)</span>
                                </label>
                                <label className="flex items-center space-x-2 text-xs text-silver-dark cursor-pointer hover:text-white transition-colors">
                                    <input type="checkbox" checked={formData.is_cashflow} onChange={(e) => setFormData({ ...formData, is_cashflow: e.target.checked })} className="rounded bg-dark-surface border-gray-600 w-3.5 h-3.5 accent-accent-blue" />
                                    <span>Cashflow</span>
                                </label>
                            </div>
                        </div>

                        <div className="flex justify-end gap-2 pt-3">
                            <button
                                type="button"
                                onClick={() => setShowModal(false)}
                                className="px-3 py-1.5 text-xs text-silver-dark hover:bg-dark-surface rounded-lg transition-colors"
                            >
                                Cancel
                            </button>
                            <Button type="submit" className="py-1.5 px-4 text-xs">
                                {isEditing ? 'Update Account' : 'Create Account'}
                            </Button>
                        </div>
                    </form>
                </Modal>
            )}
        </div>
    );
};

export default COAMaster;
