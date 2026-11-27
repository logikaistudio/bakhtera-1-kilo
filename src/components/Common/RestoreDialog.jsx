import React, { useState } from 'react';
import './RestoreDialog.css';

const RestoreDialog = ({ snapshot, loading, onConfirm, onCancel }) => {
  const [createPreBackup, setCreatePreBackup] = useState(true);

  const handleConfirm = () => {
    onConfirm(snapshot.id, createPreBackup);
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleString();
  };

  return (
    <div className="restore-dialog-overlay">
      <div className="restore-dialog modal">
        <div className="modal-header">
          <h3>Restore from Snapshot</h3>
          <button className="close-btn" onClick={onCancel}>
            ✕
          </button>
        </div>

        <div className="modal-body">
          {/* Snapshot Info */}
          <div className="snapshot-info">
            <div className="info-row">
              <span className="label">Snapshot:</span>
              <span className="value">{snapshot.snapshot_name}</span>
            </div>
            <div className="info-row">
              <span className="label">Date:</span>
              <span className="value">{formatDate(snapshot.snapshot_date)}</span>
            </div>
            <div className="info-row">
              <span className="label">Records:</span>
              <span className="value">{snapshot.total_records}</span>
            </div>
          </div>

          {/* Warning */}
          <div className="warning-box">
            <div className="warning-icon">⚠️</div>
            <div className="warning-content">
              <p className="warning-title">Warning</p>
              <p className="warning-text">
                This will replace your current data with the snapshot data. This action
                cannot be undone.
              </p>
            </div>
          </div>

          {/* Pre-backup Option */}
          <div className="checkbox-group">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={createPreBackup}
                onChange={(e) => setCreatePreBackup(e.target.checked)}
              />
              <span>Create backup of current data before restore</span>
            </label>
            <p className="checkbox-help">
              Recommended: Automatically create a backup before restoring (can be undone later)
            </p>
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onCancel} disabled={loading}>
            Cancel
          </button>
          <button
            className="btn btn-danger"
            onClick={handleConfirm}
            disabled={loading}
          >
            {loading ? (
              <>
                <span className="spinner"></span>
                Restoring...
              </>
            ) : (
              <>✓ Confirm Restore</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default RestoreDialog;
