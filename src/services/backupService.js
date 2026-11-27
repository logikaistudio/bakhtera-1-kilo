/**
 * Backup & Recovery Service
 * Purpose: Handle all backup creation, restore, and management operations
 * Version: 1.0
 * Date: 2024-12-27
 */

import { supabase } from '../lib/supabase';
import * as pako from 'pako'; // For compression

// ============================================================
// 1. CORE FUNCTIONS
// ============================================================

/**
 * CREATE SNAPSHOT
 * Purpose: Create a new backup snapshot
 * Input: name (string), type ('manual'|'auto'), description (string)
 * Returns: {success, snapshotId, message, recordCounts}
 */
export const createSnapshot = async (
  name = '',
  type = 'manual',
  description = ''
) => {
  const startTime = Date.now();

  try {
    // Auto-generate name if not provided
    const snapshotName = name ||
      `${type}-${new Date().toISOString().replace(/[:.]/g, '-')}`;

    console.log(`[Backup] Starting ${type} backup: ${snapshotName}`);

    // 1. Export all data
    const exportedData = await exportAllData();

    // 2. Calculate hash
    const dataHash = calculateHash(JSON.stringify(exportedData));

    // 3. Compress data
    const compressedData = compressData(exportedData);

    // 4. Count records
    const recordCounts = exportedData.metadata?.row_counts || {};
    const totalRecords = Object.values(recordCounts).reduce(
      (sum, count) => sum + count,
      0
    );

    // 5. Upload to Supabase Storage
    const fileName = `${type}-${Date.now()}.json.gz`;
    const filePath = `backups/${new Date().toISOString().split('T')[0]}/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('bridge-backups')
      .upload(filePath, compressedData);

    if (uploadError) throw uploadError;

    // 6. Create snapshot record
    const { data: snapshot, error: snapshotError } = await supabase
      .from('snapshots')
      .insert({
        snapshot_name: snapshotName,
        snapshot_date: new Date(),
        backup_type: type,
        status: 'in_progress',
        record_counts: recordCounts,
        total_records: totalRecords,
        data_hash: dataHash,
        backup_location: filePath,
        backup_size_bytes: compressedData.length,
        created_by: type === 'auto' ? 'system' : 'manual',
        description,
        expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      })
      .select()
      .single();

    if (snapshotError) throw snapshotError;

    // 7. Store backup data
    const { error: dataError } = await supabase
      .from('snapshot_data')
      .insert({
        snapshot_id: snapshot.id,
        backup_data: exportedData,
        compressed: true
      });

    if (dataError) throw dataError;

    // 8. Log operation
    await logBackupOperation('backup', 'completed', snapshot.id, {
      record_counts: recordCounts,
      file_size: compressedData.length,
      duration_ms: Date.now() - startTime
    });

    // 9. Update status to completed
    await supabase.from('snapshots').update({ status: 'completed' }).eq('id', snapshot.id);

    return {
      success: true,
      snapshotId: snapshot.id,
      snapshotName,
      recordCounts,
      totalRecords,
      message: `Backup created: ${snapshotName}`
    };
  } catch (error) {
    console.error('[Backup] Error creating snapshot:', error);

    await logBackupOperation('backup', 'failed', null, {
      error: error.message
    });

    return {
      success: false,
      error: error.message,
      message: `Backup failed: ${error.message}`
    };
  }
};

/**
 * LIST SNAPSHOTS
 * Purpose: Retrieve all snapshots with pagination
 * Input: limit (number), offset (number)
 * Returns: {snapshots: [...], total: number, page_info: {...}}
 */
export const listSnapshots = async (limit = 30, offset = 0) => {
  try {
    // Count total
    const { count: totalCount } = await supabase
      .from('snapshots')
      .select('id', { count: 'exact', head: true });

    // Fetch paginated results
    const { data: snapshots, error } = await supabase
      .from('snapshots')
      .select('*')
      .order('snapshot_date', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;

    return {
      success: true,
      snapshots: snapshots || [],
      total: totalCount || 0,
      pageInfo: {
        limit,
        offset,
        hasMore: offset + limit < (totalCount || 0)
      }
    };
  } catch (error) {
    console.error('[Backup] Error listing snapshots:', error);
    return {
      success: false,
      snapshots: [],
      error: error.message
    };
  }
};

/**
 * RESTORE SNAPSHOT
 * Purpose: Restore data from a backup snapshot
 * Input: snapshotId (UUID), createPreBackup (boolean)
 * Returns: {success, restoredRecords, message}
 */
export const restoreSnapshot = async (snapshotId, createPreBackup = true) => {
  const startTime = Date.now();

  try {
    console.log(`[Restore] Starting restore from snapshot: ${snapshotId}`);

    // 1. Create pre-backup if requested
    if (createPreBackup) {
      console.log('[Restore] Creating pre-restore backup...');
      const preBackupResult = await createSnapshot(
        `pre-restore-${snapshotId.substring(0, 8)}`,
        'manual',
        'Automatic backup before restore'
      );
      if (!preBackupResult.success) throw new Error('Pre-backup failed');
    }

    // 2. Load snapshot
    const { data: snapshot, error: snapshotError } = await supabase
      .from('snapshots')
      .select('*')
      .eq('id', snapshotId)
      .single();

    if (snapshotError) throw snapshotError;
    if (!snapshot) throw new Error('Snapshot not found');

    // 3. Load snapshot data
    const { data: snapshotData, error: dataError } = await supabase
      .from('snapshot_data')
      .select('backup_data')
      .eq('snapshot_id', snapshotId)
      .single();

    if (dataError) throw dataError;

    // 4. Verify integrity
    const dataHash = calculateHash(JSON.stringify(snapshotData.backup_data));
    if (dataHash !== snapshot.data_hash) {
      throw new Error('Data integrity check failed - hash mismatch');
    }

    // 5-7. Restore data for each table
    const restoredData = snapshotData.backup_data;
    const restoredRecords = {};

    // Tables to restore (in dependency order)
    const tablesToRestore = ['quotations', 'packages', 'items', 'warehouse_stock', 'mutation_logs'];

    for (const table of tablesToRestore) {
      if (restoredData[table]?.length > 0) {
        // Delete all existing
        await supabase.from(table).delete().neq('id', '');

        // Insert from backup
        const { error: insertError } = await supabase
          .from(table)
          .insert(restoredData[table]);

        if (insertError) throw insertError;

        restoredRecords[table] = restoredData[table].length;
      }
    }

    // 8. Update snapshot status
    await supabase
      .from('snapshots')
      .update({
        status: 'restored',
        restored_at: new Date()
      })
      .eq('id', snapshotId);

    // 9. Log operation
    await logBackupOperation('restore', 'completed', snapshotId, {
      restored_records: restoredRecords,
      duration_ms: Date.now() - startTime
    });

    return {
      success: true,
      restoredRecords,
      duration: Date.now() - startTime,
      message: `Restore completed from ${snapshot.snapshot_name}`
    };
  } catch (error) {
    console.error('[Restore] Error restoring snapshot:', error);

    await logBackupOperation('restore', 'failed', snapshotId, {
      error: error.message
    });

    return {
      success: false,
      error: error.message,
      message: `Restore failed: ${error.message}`
    };
  }
};

/**
 * DELETE SNAPSHOT
 * Purpose: Delete a snapshot and its data
 * Input: snapshotId (UUID)
 * Returns: {success, message}
 */
export const deleteSnapshot = async (snapshotId) => {
  try {
    // Load snapshot for storage cleanup
    const { data: snapshot } = await supabase
      .from('snapshots')
      .select('backup_location')
      .eq('id', snapshotId)
      .single();

    // Delete from storage
    if (snapshot?.backup_location) {
      await supabase.storage
        .from('bridge-backups')
        .remove([snapshot.backup_location])
        .catch((err) => console.warn('Storage delete warning:', err));
    }

    // Delete from database (cascades to snapshot_data)
    const { error } = await supabase.from('snapshots').delete().eq('id', snapshotId);

    if (error) throw error;

    // Log operation
    await logBackupOperation('delete', 'completed', snapshotId, {});

    return {
      success: true,
      message: 'Snapshot deleted successfully'
    };
  } catch (error) {
    console.error('[Delete] Error deleting snapshot:', error);
    return {
      success: false,
      error: error.message,
      message: `Delete failed: ${error.message}`
    };
  }
};

/**
 * TRIGGER AUTO BACKUP
 * Purpose: Called by scheduler daily at 00:00 UTC
 * Returns: {success, backup, cleanup}
 */
export const triggerAutoBackup = async () => {
  console.log('[AutoBackup] Triggered at', new Date().toISOString());

  try {
    // Create auto backup
    const backupResult = await createSnapshot('', 'auto', 'Scheduled automatic backup');

    if (!backupResult.success) throw new Error(backupResult.message);

    // Cleanup old backups
    const cleanupResult = await cleanupOldSnapshots(30);

    return {
      success: true,
      backup: backupResult,
      cleanup: cleanupResult,
      message: 'Auto-backup completed successfully'
    };
  } catch (error) {
    console.error('[AutoBackup] Error:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * CLEANUP OLD SNAPSHOTS
 * Purpose: Delete snapshots older than retention period
 * Input: retentionDays (number, default 30)
 * Returns: {success, deleted_count}
 */
export const cleanupOldSnapshots = async (retentionDays = 30) => {
  try {
    console.log(`[Cleanup] Starting cleanup (retention: ${retentionDays} days)`);

    // Find old snapshots
    const expirationDate = new Date();
    expirationDate.setDate(expirationDate.getDate() - retentionDays);

    const { data: oldSnapshots, error: fetchError } = await supabase
      .from('snapshots')
      .select('id, snapshot_name, backup_location')
      .lt('expires_at', expirationDate);

    if (fetchError) throw fetchError;

    if (!oldSnapshots || oldSnapshots.length === 0) {
      console.log('[Cleanup] No snapshots to delete');
      return { success: true, deleted_count: 0 };
    }

    console.log(`[Cleanup] Found ${oldSnapshots.length} snapshots to delete`);

    // Delete each snapshot
    for (const snapshot of oldSnapshots) {
      try {
        // Delete from storage
        if (snapshot.backup_location) {
          await supabase.storage
            .from('bridge-backups')
            .remove([snapshot.backup_location])
            .catch((err) => console.warn('Storage delete error:', err));
        }

        // Delete from database (cascades to snapshot_data)
        await supabase.from('snapshots').delete().eq('id', snapshot.id);
      } catch (err) {
        console.error(`Error deleting snapshot ${snapshot.id}:`, err);
      }
    }

    return {
      success: true,
      deleted_count: oldSnapshots.length,
      message: `Deleted ${oldSnapshots.length} old snapshots`
    };
  } catch (error) {
    console.error('[Cleanup] Error:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

// ============================================================
// 2. HELPER FUNCTIONS
// ============================================================

/**
 * EXPORT ALL DATA
 * Purpose: Query and export all warehouse/quotation data
 * Returns: {quotations: [...], packages: [...], ..., metadata: {...}}
 */
const exportAllData = async () => {
  console.log('[Export] Fetching all data...');

  try {
    const [
      { data: quotations },
      { data: packages },
      { data: items },
      { data: warehouse_stock },
      { data: mutations }
    ] = await Promise.all([
      supabase.from('quotations').select('*'),
      supabase.from('packages').select('*'),
      supabase.from('items').select('*'),
      supabase.from('warehouse_stock').select('*'),
      supabase.from('mutation_logs').select('*')
    ]);

    const exportedData = {
      quotations: quotations || [],
      packages: packages || [],
      items: items || [],
      warehouse_stock: warehouse_stock || [],
      mutations: mutations || [],
      metadata: {
        version: 1,
        export_date: new Date().toISOString(),
        row_counts: {
          quotations: (quotations || []).length,
          packages: (packages || []).length,
          items: (items || []).length,
          warehouse_stock: (warehouse_stock || []).length,
          mutations: (mutations || []).length
        }
      }
    };

    console.log('[Export] Data exported:', exportedData.metadata.row_counts);
    return exportedData;
  } catch (error) {
    console.error('[Export] Error:', error);
    throw error;
  }
};

/**
 * CALCULATE HASH
 * Purpose: Generate hash for data integrity verification
 */
const calculateHash = (data) => {
  const str = typeof data === 'string' ? data : JSON.stringify(data);
  let hash = 0;

  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32-bit integer
  }

  return Math.abs(hash).toString(16);
};

/**
 * COMPRESS DATA
 * Purpose: Gzip compress JSON data for storage
 */
const compressData = (data) => {
  try {
    const jsonString = JSON.stringify(data);
    const compressed = pako.gzip(jsonString);
    return compressed;
  } catch (error) {
    console.error('[Compress] Error:', error);
    throw error;
  }
};

/**
 * DECOMPRESS DATA
 * Purpose: Decompress gzip data
 */
export const decompressData = (compressedData) => {
  try {
    const decompressed = pako.ungzip(compressedData, { to: 'string' });
    return JSON.parse(decompressed);
  } catch (error) {
    console.error('[Decompress] Error:', error);
    throw error;
  }
};

/**
 * LOG BACKUP OPERATION
 * Purpose: Record backup operations in audit log
 */
const logBackupOperation = async (operation, status, snapshotId, details) => {
  try {
    const { error } = await supabase.from('backup_logs').insert({
      snapshot_id: snapshotId,
      operation,
      status,
      details,
      initiated_by: 'system'
    });

    if (error) console.warn('[Log] Error logging operation:', error);
  } catch (error) {
    console.error('[Log] Error:', error);
  }
};

/**
 * GET SNAPSHOT DETAILS
 * Purpose: Get detailed information about a snapshot
 */
export const getSnapshotDetails = async (snapshotId) => {
  try {
    const { data: snapshot, error } = await supabase
      .from('snapshots')
      .select('*')
      .eq('id', snapshotId)
      .single();

    if (error) throw error;

    return {
      success: true,
      snapshot
    };
  } catch (error) {
    console.error('[Details] Error:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * GET BACKUP LOGS
 * Purpose: Get operation logs for a snapshot
 */
export const getBackupLogs = async (snapshotId, limit = 50) => {
  try {
    const { data: logs, error } = await supabase
      .from('backup_logs')
      .select('*')
      .eq('snapshot_id', snapshotId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;

    return {
      success: true,
      logs: logs || []
    };
  } catch (error) {
    console.error('[Logs] Error:', error);
    return {
      success: false,
      logs: [],
      error: error.message
    };
  }
};
