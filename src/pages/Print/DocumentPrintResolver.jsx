import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { printBLCertificate } from '../../utils/printUtils';

const normalizeContainers = (rawContainers) => {
    if (!rawContainers) return [];
    if (Array.isArray(rawContainers)) return rawContainers;

    if (typeof rawContainers === 'string') {
        try {
            const parsed = JSON.parse(rawContainers);
            if (Array.isArray(parsed)) return parsed;
            if (parsed && typeof parsed === 'object') return [parsed];
        } catch {
            return [];
        }
    }

    if (typeof rawContainers === 'object') return [rawContainers];
    return [];
};

const flattenItems = (items = []) => {
    if (!Array.isArray(items)) return [];
    return items.flatMap((entry) => (Array.isArray(entry?.items) ? flattenItems(entry.items) : [entry]));
};

const buildGoodsDescriptionFromShipment = (ship = {}) => {
    const direct = [
        ship.bl_description_packages,
        ship.cargo_description,
        ship.goods_description,
        ship.description_goods,
        ship.description,
        ship.commodity
    ].find((value) => String(value || '').trim());

    if (direct) return String(direct).trim();

    const containers = normalizeContainers(ship.containers);
    return containers
        .map((container) => [container.containerNumber, container.containerType].filter(Boolean).join(' '))
        .filter(Boolean)
        .join('\n');
};

const buildCargoItemsFromShipment = (ship = {}) => {
    const goodsDescription = buildGoodsDescriptionFromShipment(ship);

    if (goodsDescription) {
        return [{
            marks: ship.bl_marks_numbers || ship.container_number || 'N/M',
            packages: ship.bl_number_of_packages || ship.packages || '',
            description: goodsDescription,
            grossWeight: ship.bl_gross_weight_text || ship.gross_weight || ship.weight || '',
            measurement: ship.bl_measurement_text || ship.volume || '',
        }];
    }

    const sourceItems = [
        ...flattenItems(ship.service_items || []),
        ...flattenItems(ship.selling_items || []),
    ];

    if (sourceItems.length > 0) {
        return sourceItems.map((item, idx) => ({
            marks: idx === 0 ? (ship.bl_marks_numbers || ship.container_number || 'N/M') : '',
            packages: item.qty || item.quantity || item.pieces || item.unit || '',
            description: item.description || item.name || item.item_name || item.service_name || item.itemCode || item.item_code || '',
            grossWeight: item.grossWeight || item.gross_weight || item.weight || '',
            measurement: item.measurement || item.measure || item.volume || item.cbm || '',
        }));
    }

    return [];
};

const mapShipmentToPrintData = (shipment = {}, docType = 'BL') => {
    const containers = normalizeContainers(shipment.containers);

    return {
        mode: docType === 'AWB' ? 'AWB' : (shipment.bl_type || 'MBL'),
        blNumber: shipment.bl_number || shipment.awb_number || '-',
        awbNumber: shipment.awb_number || shipment.bl_number || '-',
        soNumber: shipment.so_number || shipment.job_number || '-',

        shipperName: shipment.shipper_name || shipment.shipper || '',
        shipperAddress: shipment.shipper_address || '',
        consigneeName: shipment.consignee_name || shipment.customer_name || shipment.customer || '',
        consigneeAddress: shipment.consignee_address || shipment.customer_address || '',

        blShipperName: shipment.bl_shipper_name,
        blShipperAddress: shipment.bl_shipper_address,
        blConsigneeName: shipment.bl_consignee_name,
        blConsigneeAddress: shipment.bl_consignee_address,
        blNotifyPartyName: shipment.bl_notify_party_name,
        blNotifyPartyAddress: shipment.bl_notify_party_address,

        vessel: shipment.vessel_name || shipment.flight_number || '',
        voyage: shipment.voyage || '',
        portOfLoading: shipment.origin || '',
        portOfDischarge: shipment.destination || '',

        blPlaceOfReceipt: shipment.bl_place_of_receipt,
        blPlaceOfDelivery: shipment.bl_place_of_delivery,
        blPreCarriageBy: shipment.bl_pre_carriage_by,

        containerNumber: shipment.container_number || containers.map((c) => c.containerNumber).filter(Boolean).join(', '),
        sealNumber: shipment.seal_number || containers.map((c) => c.sealNumber).filter(Boolean).join(', '),
        containerized: shipment.bl_containerized || '',

        blMarksNumbers: shipment.bl_marks_numbers,
        blDescriptionPackages: shipment.bl_description_packages,
        cargoDescription: shipment.cargo_description || shipment.commodity || '',
        blNumberOfPackages: shipment.bl_number_of_packages,
        blTotalPackagesInWords: shipment.bl_total_packages_in_words,
        blGrossWeightText: shipment.bl_gross_weight_text,
        blMeasurementText: shipment.bl_measurement_text,

        grossWeight: shipment.gross_weight || shipment.weight,
        volume: shipment.volume,

        blFreightPayableAt: shipment.bl_freight_payable_at,
        blNumberOfOriginals: shipment.bl_number_of_originals,
        blIssuedPlace: shipment.bl_issued_place,
        blIssuedDate: shipment.bl_issued_date,

        blTypeOfMove: shipment.bl_type_of_move,
        blFreightCharges: shipment.bl_freight_charges,
        blPrepaid: shipment.bl_prepaid,
        blCollect: shipment.bl_collect,
        blShippedOnBoardDate: shipment.bl_shipped_on_board_date,

        blForwardingAgentRef: shipment.bl_forwarding_agent_ref,
        blExportReferences: shipment.bl_export_references,

        cargoItems: buildCargoItemsFromShipment(shipment),
    };
};

const DocumentPrintResolver = () => {
    const [searchParams] = useSearchParams();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [printData, setPrintData] = useState(null);
    const hasTriggeredPrint = useRef(false);

    const docNo = useMemo(() => (searchParams.get('docNo') || '').trim(), [searchParams]);
    const docTypeRaw = useMemo(() => (searchParams.get('docType') || 'BL').trim().toUpperCase(), [searchParams]);
    const docType = docTypeRaw.includes('AWB') ? 'AWB' : 'BL';

    useEffect(() => {
        const load = async () => {
            if (!docNo) {
                setError('Parameter docNo tidak ditemukan di URL barcode.');
                setLoading(false);
                return;
            }

            setLoading(true);
            setError('');

            try {
                let query = supabase.from('blink_shipments').select('*').limit(1);

                if (docType === 'AWB') {
                    query = query.or(`awb_number.eq.${docNo},bl_number.eq.${docNo}`);
                } else {
                    query = query.or(`bl_number.eq.${docNo},awb_number.eq.${docNo}`);
                }

                const { data, error: fetchError } = await query;
                if (fetchError) throw fetchError;

                const row = data?.[0];
                if (!row) {
                    setError(`Dokumen ${docType} dengan nomor ${docNo} tidak ditemukan.`);
                    setPrintData(null);
                    return;
                }

                const mapped = mapShipmentToPrintData(row, docType);
                setPrintData(mapped);
            } catch (err) {
                setError(err.message || 'Gagal memuat data dokumen.');
                setPrintData(null);
            } finally {
                setLoading(false);
            }
        };

        load();
    }, [docNo, docType]);

    useEffect(() => {
        if (!printData || hasTriggeredPrint.current) return;

        hasTriggeredPrint.current = true;
        printBLCertificate(printData);
    }, [printData]);

    return (
        <div className="p-6 max-w-3xl mx-auto">
            <h1 className="text-2xl font-bold text-silver-light mb-2">Print Document Resolver</h1>
            <p className="text-sm text-silver-dark mb-5">
                Scan barcode mengarah ke halaman ini. Dokumen akan otomatis dibuka ke preview cetak.
            </p>

            <div className="glass-card border border-dark-border rounded-xl p-4 space-y-3">
                <div className="text-sm"><strong>Doc Type:</strong> {docType}</div>
                <div className="text-sm"><strong>Doc Number:</strong> {docNo || '-'}</div>

                {loading && <div className="text-sm text-silver-dark">Memuat data dokumen...</div>}
                {!loading && error && <div className="text-sm text-red-400">{error}</div>}

                {!loading && printData && (
                    <>
                        <div className="text-sm text-green-400">Dokumen ditemukan. Jendela print/preview sudah dibuka otomatis.</div>
                        <button
                            onClick={() => printBLCertificate(printData)}
                            className="px-4 py-2 text-sm bg-accent-blue text-white rounded-lg hover:bg-accent-blue/90 smooth-transition"
                        >
                            Buka Ulang Preview Cetak
                        </button>
                    </>
                )}
            </div>
        </div>
    );
};

export default DocumentPrintResolver;
