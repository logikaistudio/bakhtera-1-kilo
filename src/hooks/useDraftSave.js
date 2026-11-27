import { useEffect, useCallback } from 'react';

/**
 * Hook untuk auto-save draft ke localStorage
 * @param {string} draftKey - Unique key untuk draft (misal: warehouse_edit_{pengajuanId})
 * @param {object} data - Data yang akan di-save (editData, entryTime, selectedPengajuan)
 * @param {number} interval - Interval auto-save dalam milliseconds (default: 30000 = 30 detik)
 */
export const useDraftSave = (draftKey, data, interval = 30000) => {
  useEffect(() => {
    if (!draftKey || !data) return;

    const timer = setInterval(() => {
      try {
        const draft = {
          data,
          timestamp: Date.now(),
          version: 1
        };
        localStorage.setItem(draftKey, JSON.stringify(draft));
        console.log(`💾 Draft auto-saved: ${draftKey}`);
      } catch (error) {
        console.error('❌ Gagal menyimpan draft:', error);
      }
    }, interval);

    return () => clearInterval(timer);
  }, [draftKey, data, interval]);
};

/**
 * Ambil draft dari localStorage
 * @param {string} draftKey - Unique key untuk draft
 * @returns {object|null} Draft data atau null jika tidak ada
 */
export const getDraftFromStorage = (draftKey) => {
  try {
    const stored = localStorage.getItem(draftKey);
    if (!stored) return null;

    const draft = JSON.parse(stored);
    return draft;
  } catch (error) {
    console.error('❌ Gagal membaca draft:', error);
    return null;
  }
};

/**
 * Hapus draft dari localStorage
 * @param {string} draftKey - Unique key untuk draft
 */
export const clearDraftFromStorage = (draftKey) => {
  try {
    localStorage.removeItem(draftKey);
    console.log(`🗑️ Draft dihapus: ${draftKey}`);
  } catch (error) {
    console.error('❌ Gagal menghapus draft:', error);
  }
};

/**
 * Check apakah ada draft untuk pengajuan tertentu
 * @param {string} pengajuanId - ID pengajuan
 * @returns {boolean}
 */
export const hasDraftForPengajuan = (pengajuanId) => {
  const draftKey = `warehouse_edit_${pengajuanId}`;
  const draft = getDraftFromStorage(draftKey);
  return draft && draft.data ? true : false;
};

/**
 * Format timestamp draft menjadi readable string
 * @param {number} timestamp - Milliseconds since epoch
 * @returns {string} Formatted datetime
 */
export const formatDraftTimestamp = (timestamp) => {
  try {
    const date = new Date(timestamp);
    return date.toLocaleString('id-ID', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  } catch (error) {
    return 'Waktu tidak valid';
  }
};

/**
 * Callback untuk meminta user restore draft
 * @param {string} pengajuanId - ID pengajuan
 * @returns {boolean} true jika user menyetujui restore
 */
export const promptRestoreDraft = (pengajuanId) => {
  const draftKey = `warehouse_edit_${pengajuanId}`;
  const draft = getDraftFromStorage(draftKey);

  if (!draft || !draft.data) return false;

  const draftTime = formatDraftTimestamp(draft.timestamp);
  const message = `📋 Draft ditemukan dari:\n${draftTime}\n\nApakah Anda ingin melanjutkan dari draft ini atau mulai dari data terbaru di database?`;

  return confirm(message);
};
