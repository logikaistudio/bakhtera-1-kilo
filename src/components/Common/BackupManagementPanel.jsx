import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import {
  createSnapshot,
  listSnapshots,
  restoreSnapshot,
  deleteSnapshot
} from '../../services/backupService';

import SnapshotsList from './SnapshotsList';
import BackupStatus from './BackupStatus';
import BackupActions from './BackupActions';
import RestoreDialog from './RestoreDialog';
import './BackupManagementPanel.css';

const BackupManagementPanel = () => {
  // States
  const [snapshots, setSnapshots] = useState([]);
  const [loading, setLoading] = useState(false);
  const [backupRunning, setBackupRunning] = useState(false);
  const [restoreRunning, setRestoreRunning] = useState(false);

  const [showRestoreDialog, setShowRestoreDialog] = useState(false);
  const [selectedSnapshot, setSelectedSnapshot] = useState(null);

  const [autoBackupStatus, setAutoBackupStatus] = useState({
    lastBackup: null,
    nextBackup: null,
    isScheduled: true
  });

  const [notification, setNotification] = useState({
    visible: false,
    type: '', // 'success' | 'error' | 'info'
    message: ''
  });

  const [pagination, setPagination] = useState({
    page: 0,
    limit: 10,
    total: 0
  });

  // ==================== EFFECTS ====================

  useEffect(() => {
    loadSnapshots();
    loadAutoBackupStatus();

    // Refresh every 30 seconds
    const interval = setInterval(() => {
      loadSnapshots();
      loadAutoBackupStatus();
    }, 30000);

    return () => clearInterval(interval);
  }, [pagination.page]);

  // ==================== HANDLERS ====================

  const loadSnapshots = async () => {
    setLoading(true);
    try {
      const offset = pagination.page * pagination.limit;
      const result = await listSnapshots(pagination.limit, offset);

      if (result.success) {
        setSnapshots(result.snapshots);
        setPagination((prev) => ({
          ...prev,
          total: result.total
        }));
      } else {
        showNotification('error', result.error);
      }
    } catch (error) {
      showNotification('error', `Failed to load snapshots: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const loadAutoBackupStatus = async () => {
    try {
      // Get last backup
      const { data: lastSnapshot } = await supabase
        .from('snapshots')
        .select('*')
        .eq('backup_type', 'auto')
        .order('snapshot_date', { ascending: false })
        .limit(1)
        .single();

      if (lastSnapshot) {
        setAutoBackupStatus((prev) => ({
          ...prev,
          lastBackup: lastSnapshot.snapshot_date
        }));
      }

      // Calculate next backup (00:00 UTC next day)
      const now = new Date();
      const nextBackup = new Date(now);
      nextBackup.setUTCDate(nextBackup.getUTCDate() + 1);
      nextBackup.setUTCHours(0, 0, 0, 0);

      setAutoBackupStatus((prev) => ({
        ...prev,
        nextBackup
      }));
    } catch (error) {
      console.error('Error loading auto-backup status:', error);
    }
  };

  const handleManualBackup = async () => {
    setBackupRunning(true);

    try {
      const result = await createSnapshot(
        `manual-${Date.now()}`,
        'manual',
        'Manual backup created by user'
      );

      if (result.success) {
        showNotification('success', result.message);
        loadSnapshots();
        loadAutoBackupStatus();
      } else {
        showNotification('error', result.message);
      }
    } catch (error) {
      showNotification('error', `Backup failed: ${error.message}`);
    } finally {
      setBackupRunning(false);
    }
  };

  const handleRestoreClick = (snapshot) => {
    setSelectedSnapshot(snapshot);
    setShowRestoreDialog(true);
  };

  const handleRestoreConfirm = async (snapshotId, createPreBackup) => {
    setRestoreRunning(true);

    try {
      const result = await restoreSnapshot(snapshotId, createPreBackup);

      if (result.success) {
        showNotification('success', result.message);
        loadSnapshots();
        setShowRestoreDialog(false);
      } else {
        showNotification('error', result.message);
      }
    } catch (error) {
      showNotification('error', `Restore failed: ${error.message}`);
    } finally {
      setRestoreRunning(false);
    }
  };

  const handleDeleteSnapshot = async (snapshotId) => {
    if (!window.confirm('Are you sure? This action cannot be undone.')) {
      return;
    }

    try {
      const result = await deleteSnapshot(snapshotId);

      if (result.success) {
        showNotification('success', result.message);
        loadSnapshots();
      } else {
        showNotification('error', result.message);
      }
    } catch (error) {
      showNotification('error', `Delete failed: ${error.message}`);
    }
  };

  const handlePageChange = (newPage) => {
    setPagination((prev) => ({
      ...prev,
      page: newPage
    }));
  };

  const showNotification = (type, message) => {
    setNotification({
      visible: true,
      type,
      message
    });

    setTimeout(() => {
      setNotification({ visible: false, type: '', message: '' });
    }, 5000);
  };

  // ==================== RENDER ====================

  return (
    <div className="backup-management-panel">
      {/* Header */}
      <div className="panel-header">
        <h2>🔄 Backup Management</h2>
        <p>Bridge Database - Warehouse & Quotations</p>
      </div>

      {/* Notification */}
      {notification.visible && (
        <div className={`notification notification-${notification.type}`}>
          <span>{notification.message}</span>
          <button onClick={() => setNotification({ ...notification, visible: false })}>
            ✕
          </button>
        </div>
      )}

      {/* Auto-Backup Status */}
      <BackupStatus status={autoBackupStatus} isScheduled={autoBackupStatus.isScheduled} />

      {/* Actions */}
      <BackupActions onManualBackup={handleManualBackup} loading={backupRunning} />

      {/* Snapshots List */}
      <SnapshotsList
        snapshots={snapshots}
        loading={loading}
        onRestore={handleRestoreClick}
        onDelete={handleDeleteSnapshot}
        pagination={pagination}
        onPageChange={handlePageChange}
      />

      {/* Restore Dialog */}
      {showRestoreDialog && (
        <RestoreDialog
          snapshot={selectedSnapshot}
          loading={restoreRunning}
          onConfirm={handleRestoreConfirm}
          onCancel={() => setShowRestoreDialog(false)}
        />
      )}

      {/* Info Section */}
      <div className="panel-info">
        <h3>📋 Information</h3>
        <ul>
          <li>✓ Auto-snapshots created daily at 00:00 UTC</li>
          <li>✓ Snapshots retained for 30 days</li>
          <li>✓ Create manual snapshots anytime</li>
          <li>✓ Pre-restore backup created automatically</li>
          <li>✓ All operations logged in audit trail</li>
        </ul>
      </div>
    </div>
  );
};

export default BackupManagementPanel;
