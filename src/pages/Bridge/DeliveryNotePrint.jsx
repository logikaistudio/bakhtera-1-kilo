import React, { useRef, useState } from 'react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

const DeliveryNotePrint = ({ note, onClose }) => {
    const printRef = useRef();
    const [isExporting, setIsExporting] = useState(false);

    const handlePrint = () => {
        window.print();
    };

    const handleExportPDF = async () => {
        setIsExporting(true);
        try {
            const element = printRef.current;

            // Capture the element as canvas with high quality
            const canvas = await html2canvas(element, {
                scale: 2, // Higher quality
                useCORS: true,
                logging: false,
                backgroundColor: '#ffffff',
                width: 1122, // A4 landscape width in pixels at 96 DPI (297mm)
                height: 794,  // A4 landscape height in pixels at 96 DPI (210mm)
            });

            // Convert canvas to image
            const imgData = canvas.toDataURL('image/png');

            // Create PDF in landscape A4
            const pdf = new jsPDF({
                orientation: 'landscape',
                unit: 'mm',
                format: 'a4',
            });

            // A4 landscape dimensions in mm
            const pdfWidth = 297;
            const pdfHeight = 210;

            // Add image to PDF
            pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);

            // Generate filename
            const filename = `Surat_Jalan_${note.delivery_note_number.replace(/\//g, '_')}.pdf`;

            // Save PDF
            pdf.save(filename);
        } catch (error) {
            console.error('Error generating PDF:', error);
            alert('Gagal membuat PDF. Silakan coba lagi.');
        } finally {
            setIsExporting(false);
        }
    };

    // Parse items from JSONB
    const items = typeof note.items === 'string' ? JSON.parse(note.items) : (note.items || []);

    // Format date
    const formatDate = (dateString) => {
        if (!dateString) return '';
        const date = new Date(dateString);
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        return `${day}/${month}/${year}`;
    };

    return (
        <div className="fixed inset-0 bg-white z-50 overflow-auto">
            <div className="no-print sticky top-0 bg-white border-b border-gray-300 p-4 flex items-center justify-between shadow-sm">
                <h2 className="text-lg font-bold text-gray-900">Preview Surat Jalan</h2>
                <div className="flex gap-2">
                    <button
                        onClick={handlePrint}
                        className="btn-primary"
                        disabled={isExporting}
                    >
                        🖨️ Print
                    </button>
                    <button
                        onClick={handleExportPDF}
                        className="btn-primary bg-green-600 hover:bg-green-700"
                        disabled={isExporting}
                    >
                        {isExporting ? '⏳ Generating...' : '📥 Download PDF'}
                    </button>
                    <button
                        onClick={onClose}
                        className="btn-secondary"
                        disabled={isExporting}
                    >
                        ✕ Tutup
                    </button>
                </div>
            </div>

            {/* Print Content - A4 Landscape */}
            <div className="print-container">
                <div ref={printRef} className="print-page">
                    {/* Header with Logo */}
                    <div className="flex items-start justify-between mb-6">
                        {/* Logo & Company Info */}
                        <div className="flex items-center gap-4">
                            <div className="w-20 h-20 bg-gradient-to-br from-orange-500 to-orange-600 rounded-lg flex items-center justify-center">
                                <span className="text-white font-bold text-2xl">B</span>
                            </div>
                            <div>
                                <h1 className="text-2xl font-bold text-orange-600" style={{ fontFamily: 'Arial, sans-serif' }}>
                                    BAKHTERA
                                </h1>
                                <p className="text-sm text-gray-700 font-semibold">freight worldwide</p>
                                <p className="text-xs text-gray-600 mt-1">JAKARTA - JALAN</p>
                            </div>
                        </div>

                        {/* Document Title */}
                        <div className="text-right">
                            <h2 className="text-xl font-bold text-gray-900 mb-2">
                                BAKHTERA FREIGHT WORLDWIDE
                            </h2>
                            <div className="border-2 border-gray-900 px-4 py-1">
                                <p className="text-sm font-semibold">SURAT JALAN</p>
                            </div>
                        </div>
                    </div>

                    {/* Document Info */}
                    <div className="grid grid-cols-2 gap-8 mb-6">
                        <div>
                            <table className="w-full text-sm">
                                <tbody>
                                    <tr>
                                        <td className="py-1 font-semibold w-24">NO:</td>
                                        <td className="py-1">{note.delivery_note_number}</td>
                                    </tr>
                                    <tr>
                                        <td className="py-1 font-semibold">TO:</td>
                                        <td className="py-1">{note.destination || '-'}</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                        <div>
                            <table className="w-full text-sm">
                                <tbody>
                                    <tr>
                                        <td className="py-1 font-semibold w-32">Tanggal:</td>
                                        <td className="py-1">{formatDate(note.date)}</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Main Content - Horizontal Layout */}
                    <div className="border-2 border-gray-900">
                        <table className="w-full text-sm">
                            <tbody>
                                {/* Row 1: Consignee / Seal No */}
                                <tr className="border-b border-gray-900">
                                    <td className="border-r border-gray-900 p-2 font-semibold w-1/6 align-top">
                                        Consignee / Seal No. :
                                    </td>
                                    <td className="p-2 align-top">
                                        <div>{note.consignee || '-'}</div>
                                        {note.seal_number && (
                                            <div className="text-xs text-gray-600 mt-1">Seal: {note.seal_number}</div>
                                        )}
                                    </td>
                                </tr>

                                {/* Row 2: Truck No */}
                                <tr className="border-b border-gray-900">
                                    <td className="border-r border-gray-900 p-2 font-semibold align-top">
                                        Truck No. :
                                    </td>
                                    <td className="p-2 align-top">
                                        {note.truck_number || '-'}
                                    </td>
                                </tr>

                                {/* Row 3: Driver */}
                                <tr className="border-b border-gray-900">
                                    <td className="border-r border-gray-900 p-2 font-semibold align-top">
                                        Driver :
                                    </td>
                                    <td className="p-2 align-top">
                                        <div>{note.driver_name || '-'}</div>
                                        {note.driver_phone && (
                                            <div className="text-xs text-gray-600 mt-1">HP: {note.driver_phone}</div>
                                        )}
                                    </td>
                                </tr>

                                {/* Row 4: Items Table */}
                                <tr className="border-b border-gray-900">
                                    <td className="border-r border-gray-900 p-2 font-semibold align-top">
                                        Barang-barang tersebut telah kami terima dengan lengkap baik :
                                    </td>
                                    <td className="p-0">
                                        {items.length > 0 ? (
                                            <table className="w-full">
                                                <thead>
                                                    <tr className="border-b border-gray-400">
                                                        <th className="p-2 text-left text-xs font-semibold w-12">No</th>
                                                        <th className="p-2 text-left text-xs font-semibold border-l border-gray-400">Kode</th>
                                                        <th className="p-2 text-left text-xs font-semibold border-l border-gray-400">Nama Barang</th>
                                                        <th className="p-2 text-center text-xs font-semibold border-l border-gray-400 w-16">Qty</th>
                                                        <th className="p-2 text-center text-xs font-semibold border-l border-gray-400 w-20">Satuan</th>
                                                        <th className="p-2 text-left text-xs font-semibold border-l border-gray-400">Ket</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {items.map((item, index) => (
                                                        <tr key={index} className="border-b border-gray-300">
                                                            <td className="p-2 text-xs">{index + 1}</td>
                                                            <td className="p-2 text-xs border-l border-gray-300">{item.item_code}</td>
                                                            <td className="p-2 text-xs border-l border-gray-300">{item.item_name}</td>
                                                            <td className="p-2 text-xs text-center border-l border-gray-300">{item.quantity}</td>
                                                            <td className="p-2 text-xs text-center border-l border-gray-300">{item.unit}</td>
                                                            <td className="p-2 text-xs border-l border-gray-300">{item.remarks || '-'}</td>
                                                        </tr>
                                                    ))}
                                                    {/* Empty rows for spacing */}
                                                    {[...Array(Math.max(0, 5 - items.length))].map((_, i) => (
                                                        <tr key={`empty-${i}`} className="border-b border-gray-300">
                                                            <td className="p-2 text-xs">&nbsp;</td>
                                                            <td className="p-2 text-xs border-l border-gray-300">&nbsp;</td>
                                                            <td className="p-2 text-xs border-l border-gray-300">&nbsp;</td>
                                                            <td className="p-2 text-xs border-l border-gray-300">&nbsp;</td>
                                                            <td className="p-2 text-xs border-l border-gray-300">&nbsp;</td>
                                                            <td className="p-2 text-xs border-l border-gray-300">&nbsp;</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        ) : (
                                            <div className="p-4 text-center text-gray-500 text-xs">
                                                Tidak ada barang
                                            </div>
                                        )}
                                    </td>
                                </tr>

                                {/* Row 5: Keterangan */}
                                <tr>
                                    <td className="border-r border-gray-900 p-2 font-semibold align-top">
                                        Keterangan :
                                    </td>
                                    <td className="p-2 align-top min-h-[60px]">
                                        {note.remarks || '-'}
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>

                    {/* Signatures */}
                    <div className="grid grid-cols-2 gap-8 mt-8">
                        {/* Sender Signature */}
                        <div className="text-center">
                            <p className="text-sm font-semibold mb-16">Hormat kami,</p>
                            <div className="border-t border-gray-900 pt-1 inline-block min-w-[200px]">
                                <p className="text-sm font-semibold">{note.sender_name || '( _____________ )'}</p>
                                {note.sender_position && (
                                    <p className="text-xs text-gray-600">{note.sender_position}</p>
                                )}
                            </div>
                        </div>

                        {/* Receiver Signature */}
                        <div className="text-center">
                            <p className="text-sm font-semibold mb-2">Nama Penerima dan Perusahaan</p>
                            <div className="mb-12 min-h-[60px]">
                                {note.receiver_name && (
                                    <>
                                        <p className="text-sm">{note.receiver_name}</p>
                                        {note.receiver_company && (
                                            <p className="text-xs text-gray-600">{note.receiver_company}</p>
                                        )}
                                    </>
                                )}
                            </div>
                            <div className="border-t border-gray-900 pt-1 inline-block min-w-[200px]">
                                <p className="text-sm">Tanggal terima: {note.received_date ? formatDate(note.received_date) : '___/___/20___'}</p>
                            </div>
                        </div>
                    </div>

                    {/* Footer Note */}
                    {note.bc_document_number && (
                        <div className="mt-6 text-xs text-gray-600 text-center">
                            <p>BC Document: {note.bc_document_number}</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Print Styles */}
            <style jsx>{`
                @media print {
                    .no-print {
                        display: none !important;
                    }

                    .print-container {
                        width: 100%;
                        height: 100%;
                    }

                    .print-page {
                        width: 297mm;
                        height: 210mm;
                        padding: 15mm;
                        margin: 0;
                        box-sizing: border-box;
                        page-break-after: always;
                    }

                    @page {
                        size: A4 landscape;
                        margin: 0;
                    }

                    body {
                        margin: 0;
                        padding: 0;
                    }

                    table {
                        page-break-inside: avoid;
                    }
                }

                @media screen {
                    .print-container {
                        display: flex;
                        justify-content: center;
                        padding: 20px;
                        background: #f5f5f5;
                        min-height: calc(100vh - 73px);
                    }

                    .print-page {
                        width: 297mm;
                        min-height: 210mm;
                        padding: 15mm;
                        background: white;
                        box-shadow: 0 0 10px rgba(0,0,0,0.1);
                        margin: 0 auto;
                    }
                }
            `}</style>
        </div>
    );
};

export default DeliveryNotePrint;
