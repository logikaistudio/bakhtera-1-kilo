import React from 'react';
import './SnapshotsList.css';

const SnapshotsList = ({
  snapshots,
  loading,
  onRestore,
  onDelete,
  pagination,
  onPageChange
}) => {
  const formatDate = (date) => {
    return new Date(date).toLocaleString();
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return 'N/A';
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 Bytes';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return (Math.round((bytes / Math.pow(1024, i)) * 100) / 100) + ' ' + sizes[i];
  };

  const getStatusBadge = (status) => {
    const statusMap = {
      pending: { label: 'Pending', color: 'yellow' },
      in_progress: { label: 'In Progress', color: 'blue' },
      completed: { label: 'Completed', color: 'green' },
      failed: { label: 'Failed', color: 'red' },
      restored: { label: 'Restored', color: 'purple' }
    };

    const { label, color } = statusMap[status] || { label: status, color: 'gray' };
    return <span className={`badge badge-${color}`}>{label}</span>;
  };

  const getTypeLabel = (type) => {
    return type === 'auto' ? '🤖 Auto' : '👤 Manual';
  };

  const totalPages = Math.ceil(pagination.total / pagination.limit);

  if (loading) {
    return <div className="snapshots-list loading">Loading snapshots...</div>;
  }

  if (snapshots.length === 0) {
    return <div className="snapshots-list empty">No snapshots found</div>;
  }

  return (
    <div className="snapshots-list">
      <div className="list-header">
        <h3>Backup Snapshots ({pagination.total})</h3>
      </div>

      {/* Table */}
      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Name</th>
              <th>Type</th>
              <th>Records</th>
              <th>Size</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {snapshots.map((snapshot) => (
              <tr key={snapshot.id} className={`status-${snapshot.status}`}>
                <td className="date">{formatDate(snapshot.snapshot_date)}</td>
                <td className="name" title={snapshot.snapshot_name}>
                  {snapshot.snapshot_name}
                </td>
                <td className="type">{getTypeLabel(snapshot.backup_type)}</td>
                <td className="records">{snapshot.total_records}</td>
                <td className="size">{formatFileSize(snapshot.backup_size_bytes)}</td>
                <td className="status">{getStatusBadge(snapshot.status)}</td>
                <td className="actions">
                  <button
                    className="btn-action btn-restore"
                    onClick={() => onRestore(snapshot)}
                    title="Restore from this snapshot"
                    disabled={snapshot.status !== 'completed'}
                  >
                    ↩️ Restore
                  </button>
                  <button
                    className="btn-action btn-delete"
                    onClick={() => onDelete(snapshot.id)}
                    title="Delete this snapshot"
                  >
                    🗑️ Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="pagination">
          <button
            onClick={() => onPageChange(pagination.page - 1)}
            disabled={pagination.page === 0}
          >
            ← Previous
          </button>
          <span>
            Page {pagination.page + 1} of {totalPages}
          </span>
          <button
            onClick={() => onPageChange(pagination.page + 1)}
            disabled={pagination.page >= totalPages - 1}
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
};

export default SnapshotsList;
