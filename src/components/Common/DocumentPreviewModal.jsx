import React, { useEffect, useState } from 'react';

const DocumentPreviewModal = ({ show, doc, onClose }) => {
    if (!show || !doc) return null;

    const getMime = (d) => {
        if (d.fileType) return d.fileType.startsWith('image/') ? d.fileType : d.fileType;
        if (d.type) return d.type;
        if (d.fileName) {
            const ext = d.fileName.split('.').pop().toLowerCase();
            if (['jpg','jpeg','png','gif'].includes(ext)) return `image/${ext === 'jpg' ? 'jpeg' : ext}`;
            if (ext === 'pdf') return 'application/pdf';
        }
        return 'application/octet-stream';
    };

    const src = doc.url || doc.fileData || doc.data || doc.base64 || '';
    const [resolvedSrc, setResolvedSrc] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [objectUrl, setObjectUrl] = useState(null);

    const mime = getMime(doc);

    useEffect(() => {
        let active = true;
        setError(null);
        setResolvedSrc(null);
        setObjectUrl(null);

        const cleanup = () => {
            if (objectUrl) {
                try { URL.revokeObjectURL(objectUrl); } catch (e) {}
            }
        };

        const load = async () => {
            if (!src) return;
            // If data URI, use directly
            if (src.startsWith && src.startsWith('data:')) {
                setResolvedSrc(src);
                return;
            }

            // Try to fetch remote URL and convert to object URL to avoid framing issues
            try {
                setLoading(true);
                const res = await fetch(src, { method: 'GET' });
                if (!res.ok) throw new Error('Failed to fetch file: ' + res.status);
                const blob = await res.blob();
                const url = URL.createObjectURL(blob);
                if (!active) {
                    URL.revokeObjectURL(url);
                    return;
                }
                setObjectUrl(url);
                setResolvedSrc(url);
                // If blob provides content-type, update mime for rendering
                if (blob.type) {
                    // noop - getMime prefers explicit fields; resolved rendering checks blob mime via src
                }
            } catch (err) {
                console.warn('DocumentPreviewModal: fetch -> object URL failed, falling back to direct URL', err);
                // fallback: use remote url directly (may fail due to X-Frame-Options)
                if (active) setResolvedSrc(src);
                else setError(err.message || String(err));
            } finally {
                if (active) setLoading(false);
            }
        };

        load();

        return () => {
            active = false;
            cleanup();
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [src]);

    return (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-70 p-4" style={{ zIndex: 9999 }}>
            <div className="bg-dark-surface rounded-lg w-full max-w-4xl max-h-[90vh] overflow-hidden">
                <div className="flex items-center justify-between p-3 border-b border-dark-border">
                    <div className="text-sm font-semibold text-silver-light">Preview: {doc.name || doc.fileName || 'Dokumen'}</div>
                    <button onClick={onClose} className="text-silver-dark hover:text-white p-1">✕</button>
                </div>
                <div className="p-3 overflow-auto" style={{height: '75vh'}}>
                    {loading ? (
                        <div className="text-sm text-silver-dark">Memuat preview...</div>
                    ) : error ? (
                        <div className="text-sm text-silver-dark">Error memuat preview: {error}</div>
                    ) : (resolvedSrc ? (
                        (mime === 'application/pdf' || (resolvedSrc && resolvedSrc.endsWith && resolvedSrc.endsWith('.pdf'))) ? (
                            <iframe
                                title="pdf-preview"
                                src={resolvedSrc}
                                className="w-full h-full"
                                onLoad={() => console.debug('iframe loaded for', doc.name || doc.fileName)}
                                onError={() => {
                                    console.warn('iframe failed to load, opening in new tab:', resolvedSrc);
                                    try { window.open(resolvedSrc, '_blank'); } catch(e){}
                                    onClose();
                                }}
                            />
                        ) : mime.startsWith('image/') || (resolvedSrc && /blob:|data:/.test(resolvedSrc)) ? (
                            <img src={resolvedSrc} alt={doc.name || doc.fileName} className="mx-auto max-h-[70vh]" />
                        ) : (
                            <div className="text-sm text-silver-dark">Tidak dapat menampilkan preview untuk tipe file ini. Silakan unduh untuk melihat.</div>
                        )
                    ) : (
                        <div className="text-sm text-silver-dark">Tidak ada sumber preview.</div>
                    ))}
                </div>
                <div className="p-3 border-t border-dark-border flex justify-end gap-2">
                    <a href={resolvedSrc || src} target="_blank" rel="noopener noreferrer" className="px-3 py-1 bg-accent-blue text-white rounded">Open in new tab</a>
                </div>
            </div>
        </div>
    );
};

export default DocumentPreviewModal;
