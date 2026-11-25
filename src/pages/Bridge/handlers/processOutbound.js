// Handler untuk memproses outbound ke Pabean
// Insert ke freight_outbound dan update warehouse inventory
import { planWarehouseStockDeductions } from '../warehouseStock';

export const createProcessOutboundHandler = (selectedItem, setIsSaving, setShowDetailModal, editedItem = null, isEditing = false, onSuccess = null) => async () => {
    // Use editedItem if in edit mode, otherwise selectedItem
    const itemToProcess = (isEditing && editedItem) ? editedItem : selectedItem;
    if (!itemToProcess) return;

    const confirmMsg = `Anda akan memproses pengajuan ${itemToProcess.quotationNumber || itemToProcess.quotation_number} ke Pabean - Barang Keluar.\n\nProses ini akan:\n1. Mencatat barang keluar di laporan Pabean (freight_outbound)\n2. Mengurangi stok di gudang (freight_warehouse)\n\nPastikan data sudah benar. Lanjutkan?`;
    if (!window.confirm(confirmMsg)) return;

    setIsSaving(true);
    try {
        let successCount = 0;
        const errors = [];
        const { supabase } = await import('../../../lib/supabase');

        // First, save any edited changes to the database
        if (isEditing && editedItem) {
            const updatePayload = {
                packages: editedItem.packages,
                pic: editedItem.pic,
                approved_date: editedItem.approvedDate || editedItem.approved_date,
            };

            const { error: saveError } = await supabase
                .from('freight_quotations')
                .update(updatePayload)
                .eq('id', editedItem.id);

            if (saveError) {
                throw new Error('Gagal menyimpan perubahan: ' + saveError.message);
            }
        }

        // Get source pengajuan ID - try multiple fields
        const sourcePengajuanId = itemToProcess.sourcePengajuanId || itemToProcess.source_pengajuan_id;
        const sourcePengajuanNumber = itemToProcess.sourcePengajuanNumber || itemToProcess.source_pengajuan_number;

        console.log('🔍 Processing outbound:', {
            quotationNumber: itemToProcess.quotationNumber || itemToProcess.quotation_number,
            sourcePengajuanId,
            sourcePengajuanNumber
        });

        // STEP 1: Process each item - Insert ke freight_outbound & Update warehouse
        for (const pkg of (itemToProcess.packages || [])) {
            for (const item of (pkg.items || [])) {
                try {
                    const itemCode = item.itemCode || item.item_code;
                    const itemName = item.name || item.itemName || item.item_name;
                    // Use outboundQuantity if available, fallback to quantity
                    const quantity = Number(item.outboundQuantity !== undefined ? item.outboundQuantity : item.quantity) || 0;

                    if (quantity <= 0) {
                        console.log(`⏭️ Skipping ${itemCode} - quantity is 0`);
                        continue; // Skip items with 0 quantity
                    }

                    // 1a. Insert ke freight_outbound
                    const outboundPayload = {
                        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                        pengajuan_id: itemToProcess.id,
                        pengajuan_number: itemToProcess.quotationNumber || itemToProcess.quotation_number,
                        customs_doc_number: itemToProcess.bcDocumentNumber || itemToProcess.bc_document_number,
                        customs_doc_date: itemToProcess.bcDocumentDate || itemToProcess.bc_document_date,
                        customs_doc_type: itemToProcess.bcDocType || itemToProcess.bc_doc_type,
                        item_code: itemCode,
                        asset_name: itemName,
                        quantity: quantity,
                        unit: item.uom || 'pcs',
                        currency: itemToProcess.invoiceCurrency || itemToProcess.invoice_currency || 'IDR',
                        destination: (itemToProcess.destination && itemToProcess.destination.toLowerCase() !== (await import('../../../constants/locationOptions')).DEFAULT_LOCATION.toLowerCase()) ? itemToProcess.destination : 'Outbound',
                        receiver: itemToProcess.customer,
                        date: (itemToProcess.approvedDate || itemToProcess.approved_date || new Date().toISOString()).split('T')[0],
                        created_at: new Date().toISOString(),
                        documents: {
                            packageNumber: pkg.packageNumber,
                            source_pengajuan_number: sourcePengajuanNumber,
                            source_bc_document_number: itemToProcess.sourceBcDocumentNumber || itemToProcess.source_bc_document_number,
                            hsCode: item.hsCode || item.hs_code,
                            condition: item.condition || 'Baik',
                            notes: item.notes || 'Outbound from approved quotation',
                            price: item.price,
                            value: (Number(item.price) || 0) * quantity
                        }
                    };

                    if (!sourcePengajuanId && !sourcePengajuanNumber) {
                        throw new Error(`Pengajuan sumber untuk ${itemCode} tidak ditemukan.`);
                    }

                    let warehouseQuery = supabase
                        .from('freight_warehouse')
                        .select('id,quantity')
                        .eq('item_code', itemCode)
                        .eq('package_number', pkg.packageNumber);

                    if (sourcePengajuanId) {
                        warehouseQuery = warehouseQuery.eq('pengajuan_id', sourcePengajuanId);
                    } else {
                        warehouseQuery = warehouseQuery.eq('pengajuan_number', sourcePengajuanNumber);
                    }

                    let { data: warehouseItems, error: whQueryError } = await warehouseQuery;
                    if (whQueryError) throw new Error(`Gagal membaca stok warehouse: ${whQueryError.message}`);

                    if ((!warehouseItems || warehouseItems.length === 0) && sourcePengajuanId && sourcePengajuanNumber) {
                        const result = await supabase
                            .from('freight_warehouse')
                            .select('id,quantity')
                            .eq('pengajuan_number', sourcePengajuanNumber)
                            .eq('item_code', itemCode)
                            .eq('package_number', pkg.packageNumber);

                        if (result.error) throw new Error(`Gagal membaca stok warehouse: ${result.error.message}`);
                        warehouseItems = result.data;
                    }

                    if (!warehouseItems?.length) {
                        throw new Error(`Stok ${itemName || itemCode} untuk pengajuan sumber tidak ditemukan.`);
                    }

                    const stockDeductions = planWarehouseStockDeductions(warehouseItems, quantity);
                    const appliedDeductions = [];
                    try {
                        for (const deduction of stockDeductions) {
                            const { data: updatedRow, error: updateError } = await supabase
                                .from('freight_warehouse')
                                .update({ quantity: deduction.quantity })
                                .eq('id', deduction.id)
                                .eq('quantity', deduction.previousQuantity)
                                .select('id')
                                .maybeSingle();

                            if (updateError) throw updateError;
                            if (!updatedRow) throw new Error('Stok berubah saat diproses. Muat ulang data dan coba lagi.');
                            appliedDeductions.push(deduction);
                        }
                    } catch (updateError) {
                        for (const deduction of appliedDeductions.reverse()) {
                            const { error: rollbackError } = await supabase
                                .from('freight_warehouse')
                                .update({ quantity: deduction.previousQuantity })
                                .eq('id', deduction.id)
                                .eq('quantity', deduction.quantity);
                            if (rollbackError) {
                                throw new Error(`Stok gagal diperbarui dan pemulihan stok juga gagal: ${rollbackError.message}`);
                            }
                        }
                        throw updateError;
                    }

                    const { error: outboundError } = await supabase
                        .from('freight_outbound')
                        .insert([outboundPayload]);

                    if (outboundError) {
                        for (const deduction of appliedDeductions.reverse()) {
                            const { error: rollbackError } = await supabase
                                .from('freight_warehouse')
                                .update({ quantity: deduction.previousQuantity })
                                .eq('id', deduction.id)
                                .eq('quantity', deduction.quantity);
                            if (rollbackError) {
                                throw new Error(`Outbound gagal dicatat dan pemulihan stok juga gagal: ${rollbackError.message}`);
                            }
                        }
                        throw new Error(`Insert freight_outbound: ${outboundError.message}`);
                    }

                    successCount++;
                    console.log(`✅ Processed ${itemCode}: quantity = ${quantity}`);

                } catch (err) {
                    console.error(`Error processing item ${item.itemCode}:`, err);
                    errors.push(`${item.itemCode || 'unknown'}: ${err.message}`);
                }
            }
        }

        // STEP 2: Update quotation status to 'processed'
        if (errors.length === 0 && successCount > 0) {
            const { error: statusError } = await supabase
                .from('freight_quotations')
                .update({
                    outbound_status: 'processed',
                    outbound_date: new Date().toISOString()
                })
                .eq('id', itemToProcess.id);

            if (statusError) {
                console.error("Failed to update status:", statusError);
                alert("⚠️ Data berhasil diproses, tetapi gagal update status dokumen.\n\nSilakan refresh halaman.");
            } else {
                alert(`✅ Berhasil memproses ${successCount} item ke Pabean!\n\n📊 Detail:\n- ${successCount} item tercatat di freight_outbound\n- Stok gudang telah dikurangi\n- Status: Barang Keluar dari Gudang`);
                // Call onSuccess callback to refresh data
                if (onSuccess && typeof onSuccess === 'function') {
                    await onSuccess();
                }
                setShowDetailModal(false);
            }
        } else if (successCount > 0) {
            alert(`⚠️ Proses selesai dengan sebagian error:\n\n${errors.join('\n\n')}\n\nBerhasil: ${successCount} item\nGagal: ${errors.length} item`);
        } else {
            alert(`❌ Tidak ada item yang berhasil diproses.\n\nError:\n${errors.join('\n\n')}`);
        }

    } catch (error) {
        console.error("Failed to process outbound:", error);
        alert("❌ Gagal memproses ke Pabean:\n\n" + error.message);
    } finally {
        setIsSaving(false);
    }
};
