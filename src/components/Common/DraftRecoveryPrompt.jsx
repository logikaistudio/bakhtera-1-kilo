import React from 'react';
import { AlertCircle, Trash2, RotateCcw } from 'lucide-react';
import Button from './Button';

/**
 * Component untuk menampilkan draft recovery prompt
 * User dapat memilih untuk restore draft atau discard
 */
const DraftRecoveryPrompt = ({ 
  draftTime, 
  onRecover, 
  onDiscard, 
  pengajuanNumber 
}) => {
  return (
    <div className="bg-blue-50 border-l-4 border-blue-500 p-4 mb-4 rounded">
      <div className="flex items-start gap-3">
        <AlertCircle className="text-blue-600 flex-shrink-0 mt-0.5" size={20} />
        <div className="flex-1">
          <h3 className="font-semibold text-blue-900 mb-1">
            📋 Draft Tersimpan Ditemukan
          </h3>
          <p className="text-blue-800 text-sm mb-2">
            Pengajuan <span className="font-mono font-semibold">{pengajuanNumber}</span>
          </p>
          <p className="text-blue-700 text-sm mb-3">
            Waktu tersimpan: <span className="font-semibold">{draftTime}</span>
          </p>
          <p className="text-blue-700 text-xs mb-3">
            Jika terjadi gangguan saat Anda mengedit, perubahan Anda telah otomatis tersimpan. 
            Anda dapat melanjutkan dari draft ini atau mulai dari data terbaru di database.
          </p>
          
          <div className="flex gap-2">
            <Button
              onClick={onRecover}
              variant="primary"
              icon={RotateCcw}
              size="sm"
              className="text-xs"
            >
              Lanjutkan Draft
            </Button>
            <Button
              onClick={onDiscard}
              variant="secondary"
              icon={Trash2}
              size="sm"
              className="text-xs"
            >
              Discard & Mulai Baru
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DraftRecoveryPrompt;
