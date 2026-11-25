const submissionNumberCollator = new Intl.Collator('id-ID', {
    numeric: true,
    sensitivity: 'base'
});

const getLogTimestamp = (log) => {
    const value = log.createdAt || (log.date ? `${log.date}T${log.time || '00:00:00'}` : null);
    const timestamp = value ? new Date(value).getTime() : 0;
    return Number.isNaN(timestamp) ? 0 : timestamp;
};

export const sortMutationLogsBySubmission = (logs) => [...logs].sort((a, b) => {
    const submissionOrder = submissionNumberCollator.compare(
        String(b.pengajuanNumber || ''),
        String(a.pengajuanNumber || '')
    );
    if (submissionOrder !== 0) return submissionOrder;

    return getLogTimestamp(b) - getLogTimestamp(a) ||
        String(b.id || '').localeCompare(String(a.id || ''));
});
