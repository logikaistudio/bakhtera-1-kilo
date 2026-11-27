import React from 'react';
import './BackupActions.css';

const BackupActions = ({ onManualBackup, loading }) => {
  return (
    <div className="backup-actions">
      <button className="btn btn-primary" onClick={onManualBackup} disabled={loading}>
        {loading ? (
          <>
            <span className="spinner"></span>
            Creating Backup...
          </>
        ) : (
          <>💾 Create Manual Backup</>
        )}
      </button>

      <div className="actions-info">
        <p>
          💡 Create a manual backup snapshot anytime. All manual backups are retained for
          30 days.
        </p>
      </div>
    </div>
  );
};

export default BackupActions;
