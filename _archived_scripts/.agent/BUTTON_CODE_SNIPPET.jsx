// COPY CODE INI DAN PASTE KE LINE 1403 (SETELAH </Button> "Hapus", SEBELUM <div className="flex gap-3">)

{
    editModal.pengajuan.type === 'inbound' &&
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
    )
}
