// ============================================================================
// QUICK OUTBOUND BUTTON IN EDIT MODAL
// Location: /src/pages/Bridge/PengajuanManagement.jsx - Line ~1394-1411
// ============================================================================

// FIND THIS (Footer buttons section dalam Edit Modal):
{/* Buttons */ }
{/* Buttons */ }
<div className="flex justify-between items-center pt-4 border-t border-dark-border">
    <Button
        variant="danger"
        onClick={handleDeleteQuotation}
        icon={Trash2}
        className="bg-red-500/10 text-red-400 hover:bg-red-500/20 border-red-500/20"
    >
        Hapus
    </Button>
    <div className="flex gap-3">
        <Button variant="secondary" onClick={handleCancelEdit}>
            Batal
        </Button>
        <Button onClick={handleSaveEdit} icon={CheckCircle}>
            Simpan Perubahan
        </Button>
    </div>
</div>

// REPLACE WITH (ADD Quick Outbound Button):
{/* Buttons */ }
<div className="flex justify-between items-center pt-4 border-t border-dark-border">
    <Button
        variant="danger"
        onClick={handleDeleteQuotation}
        icon={Trash2}
        className="bg-red-500/10 text-red-400 hover:bg-red-500/20 border-red-500/20"
    >
        Hapus
    </Button>

    {/* Quick Outbound Button - NEW: Only for approved inbound */}
    {editModal.pengajuan.type === 'inbound' &&
        (editModal.pengajuan.documentStatus || editModal.pengajuan.document_status) === 'approved' && (
            <Button
                variant="primary"
                onClick={(e) => {
                    handleQuickOutbound(editModal.pengajuan, e);
                    setEditModal({ show: false, pengajuan: null });
                }}
                icon={ArrowRight}
                className="bg-accent-purple hover:bg-accent-purple/80"
            >
                Ajukan Barang Keluar
            </Button>
        )}

    <div className="flex gap-3">
        <Button variant="secondary" onClick={handleCancelEdit}>
            Batal
        </Button>
        <Button onClick={handleSaveEdit} icon={CheckCircle}>
            Simpan Perubahan
        </Button>
    </div>
</div>

// ============================================================================
// WHAT THIS DOES:
// - Shows "Ajukan Barang Keluar" button ONLY for:
//   * TYPE = 'inbound'  
//   * STATUS = 'approved'
// - Button positioned in CENTER (between Hapus and Batal/Simpan)
// - Purple color matching outbound theme
// - Onclick: Auto-populate outbound form + close modal
// - Icon: ArrowRight (already imported)
// ============================================================================

// ============================================================================
// QUICK INSTRUCTIONS:
// 1. Open: /src/pages/Bridge/PengajuanManagement.jsx
// 2. Press Ctrl+G (Cmd+G on Mac)
// 3. Go to line: 1394
// 4. Find the buttons section
// 5. Copy the REPLACE WITH code above
// 6. Replace the old code
// 7. Save
// 8. Test: Click inbound approved row → Modal opens → See button!
// ============================================================================
