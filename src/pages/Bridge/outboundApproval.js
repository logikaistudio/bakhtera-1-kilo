const normalize = value => String(value ?? '').trim().toLowerCase();

const getDocumentMetadata = (documents) => {
    if (!documents || typeof documents !== 'string') return documents || {};

    try {
        return JSON.parse(documents);
    } catch (error) {
        console.warn('Unable to parse outbound submission document metadata:', error);
        return {};
    }
};

export const hasApprovedOutboundForSource = ({ quotations = [], submissionId, submissionNumber }) => {
    const targetId = normalize(submissionId);
    const targetNumber = normalize(submissionNumber);

    return quotations.some(quotation => {
        if (
            normalize(quotation.type) !== 'outbound' ||
            normalize(quotation.documentStatus || quotation.document_status) !== 'approved'
        ) {
            return false;
        }

        const documents = getDocumentMetadata(quotation.documents);
        const sourceId = quotation.sourcePengajuanId || quotation.source_pengajuan_id ||
            documents?.sourcePengajuanId || documents?.source_pengajuan_id;
        const sourceNumber = quotation.sourcePengajuanNumber || quotation.source_pengajuan_number ||
            documents?.sourcePengajuanNumber || documents?.source_pengajuan_number;

        return Boolean(
            (targetId && (
                normalize(quotation.id) === targetId ||
                normalize(sourceId) === targetId
            )) ||
            (targetNumber && (
                normalize(quotation.quotationNumber || quotation.quotation_number) === targetNumber ||
                normalize(sourceNumber) === targetNumber
            ))
        );
    });
};
