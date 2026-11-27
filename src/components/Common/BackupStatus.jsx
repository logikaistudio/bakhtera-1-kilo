import React from 'react';
import './BackupStatus.css';

const BackupStatus = ({ status, isScheduled }) => {
  const formatDate = (date) => {
    if (!date) return 'Never';
    return new Date(date).toLocaleString();
  };

  const getTimeUntilNextBackup = () => {
    if (!status.nextBackup) return 'N/A';

    const now = new Date();
    const diff = new Date(status.nextBackup) - now;

    if (diff <= 0) return 'Scheduled for today';

    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    return `in ${hours}h ${minutes}m`;
  };

  return (
    <div className="backup-status">
      <div className="status-box">
        <div className="status-icon">{isScheduled ? '✅' : '⚠️'}</div>
        <div className="status-content">
          <div className="status-title">Auto-Backup Status</div>
          <div className="status-row">
            <span className="label">Status:</span>
            <span className="value">{isScheduled ? '🟢 Scheduled' : '🔴 Disabled'}</span>
          </div>
          <div className="status-row">
            <span className="label">Last Backup:</span>
            <span className="value">{formatDate(status.lastBackup)}</span>
          </div>
          <div className="status-row">
            <span className="label">Next Backup:</span>
            <span className="value">
              {formatDate(status.nextBackup)} ({getTimeUntilNextBackup()})
            </span>
          </div>
          <div className="status-row schedule">
            <span className="label">Schedule:</span>
            <span className="value">Daily at 00:00 UTC</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BackupStatus;
