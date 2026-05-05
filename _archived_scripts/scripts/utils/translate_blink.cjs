const fs = require('fs');
const path = require('path');

const targetDirs = [
    '/Users/hoeltzie/Documents/Apps Builder/freight_bakhtera-1-v2/src/pages/Blink',
    '/Users/hoeltzie/Documents/Apps Builder/freight_bakhtera-1-v2/src/components/Blink',
    '/Users/hoeltzie/Documents/Apps Builder/freight_bakhtera-1-v2/src/components/Common'
];

const dictionary = [
    // Status & Badges
    { from: />Menunggu Approval</g, to: '>Pending Approval<' },
    { from: />Disetujui</g, to: '>Approved<' },
    { from: />Ditolak</g, to: '>Rejected<' },
    { from: />Perlu Revisi</g, to: '>Needs Revision<' },
    { from: />Terkirim</g, to: '>Sent<' },
    { from: />Diproses</g, to: '>Processing<' },

    // Buttons and actions text
    { from: />Tambah</g, to: '>Add<' },
    { from: />Simpan</g, to: '>Save<' },
    { from: />Batal</g, to: '>Cancel<' },
    { from: />Ubah</g, to: '>Edit<' },
    { from: />Hapus</g, to: '>Delete<' },
    { from: />Tutup</g, to: '>Close<' },
    { from: />Semua</g, to: '>All<' },
    { from: />Filter</g, to: '>Filter<' },
    { from: />Pilih</g, to: '>Select<' },
    { from: />Cetak</g, to: '>Print<' },
    { from: />Lihat Detail</g, to: '>View Details<' },
    { from: />Konfirmasi</g, to: '>Confirm<' },
    { from: />Kembali</g, to: '>Back<' },

    // common alerts or confirms
    { from: /Aksi ini tidak dapat dibatalkan/g, to: 'This action cannot be undone' },
    { from: /Apakah Anda yakin ingin menghapus/g, to: 'Are you sure you want to delete' },
    { from: /Tindakan ini tidak dapat dibatalkan/g, to: 'This action cannot be undone' },
    { from: /Berhasil menghapus/g, to: 'Successfully deleted' },
    { from: /Gagal menghapus/g, to: 'Failed to delete' },

    // Misc UI text
    { from: />Cari</g, to: '>Search<' },
    { from: /placeholder="Cari/g, to: 'placeholder="Search' },
    { from: />Memuat data\.\.\.</g, to: '>Loading data...<' },
    { from: />Memuat\.\.\.</g, to: '>Loading...<' },
    { from: />Tidak ada data</g, to: '>No data<' },
    { from: />Belum ada data</g, to: '>No data yet<' },

    // Financial specific
    { from: />Jurnal Umum</g, to: '>General Journal<' },
    { from: />Buku Besar</g, to: '>General Ledger<' },
    { from: />Neraca Saldo</g, to: '>Trial Balance<' },
    { from: />Laba Rugi</g, to: '>Profit & Loss<' },
    { from: />Neraca</g, to: '>Balance Sheet<' },
    { from: />Jumlah</g, to: '>Amount<' },
    { from: />Catatan</g, to: '>Notes<' },
    { from: />Deskripsi</g, to: '>Description<' },

    // Form placeholders/labels
    { from: /Pilih Customer/g, to: 'Select Customer' },
    { from: /Pilih Vendor/g, to: 'Select Vendor' },
    { from: /Pilih Partner/g, to: 'Select Partner' },
    { from: /Quotation Baru/g, to: 'New Quotation' },
    { from: /Kelola penawaran harga/g, to: 'Manage quotations' },

    // Alert values (mostly string literals)
    { from: /'Berhasil menyimpan/g, to: "'Successfully saved" },
    { from: /'Berhasil menghapus/g, to: "'Successfully deleted" },
    { from: /'Gagal menyimpan/g, to: "'Failed to save" },
    { from: /'Gagal menghapus/g, to: "'Failed to delete" },
    { from: /'Data berhasil/g, to: "'Data successfully" },

    // Other specific indonesian string literals
    { from: /Yakin hapus/g, to: 'Are you sure you want to delete' },
    { from: /Yakin menghapus/g, to: 'Are you sure you want to delete' },
    { from: /Data yang akan dihapus:/g, to: 'Data to be deleted:' }
];

function walkDir(dir, callback) {
    if (!fs.existsSync(dir)) return;
    fs.readdirSync(dir).forEach(f => {
        let dirPath = path.join(dir, f);
        let isDirectory = fs.statSync(dirPath).isDirectory();
        isDirectory ? walkDir(dirPath, callback) : callback(path.join(dir, f));
    });
}

let modifiedCount = 0;

targetDirs.forEach(dir => {
    walkDir(dir, function (filePath) {
        if (filePath.endsWith('.jsx') || filePath.endsWith('.js')) {
            let content = fs.readFileSync(filePath, 'utf8');
            let modified = false;
            dictionary.forEach(d => {
                if (d.from.test(content)) {
                    content = content.replace(d.from, d.to);
                    modified = true;
                }
            });
            if (modified) {
                fs.writeFileSync(filePath, content, 'utf8');
                console.log(`Updated: ${filePath.split('/').pop()}`);
                modifiedCount++;
            }
        }
    });
});

console.log(`Total files updated: ${modifiedCount}`);
