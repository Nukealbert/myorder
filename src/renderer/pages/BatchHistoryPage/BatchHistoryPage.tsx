import React, { useState } from 'react';
import { useAppStore } from '../../stores/app.store';
import { DesktopAPI } from '../../../preload/desktop-api.types';
import { ImportBatch } from '../../../main/database/repositories/batch.repository';

const desktop = (window as any).desktop as DesktopAPI;

interface BatchHistoryPageProps {
  addToast: (text: string, type: 'success' | 'error' | 'info') => void;
  setActiveTab: (tab: 'import' | 'dispatch' | 'history' | 'settings') => void;
}

export default function BatchHistoryPage({ addToast, setActiveTab }: BatchHistoryPageProps) {
  const { batches, activeBatch, setActiveBatch, archiveBatch, deleteBatch } = useAppStore();
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);

  const handleOpenBatch = async (batch: ImportBatch) => {
    try {
      await setActiveBatch(batch);
      addToast(`Switched active batch to: ${batch.source_filename}`, 'success');
      setActiveTab('dispatch');
    } catch (err: any) {
      addToast(`Failed to load batch data: ${err.message}`, 'error');
    }
  };

  const handleExportExcel = async (batch: ImportBatch) => {
    try {
      // Fetch batch shipments to check if any exist
      const shipments = await desktop.getBatchShipments(batch.id);
      if (shipments.length === 0) {
        addToast('No shipments have been scanned for this batch yet.', 'error');
        return;
      }

      const defaultName = `Amazon_Dispatch_${new Date().toISOString().split('T')[0]}_${shipments.length}-orders.xlsx`;
      const savePath = await desktop.selectExcelSavePath(defaultName);
      if (!savePath) return;

      addToast('Exporting spreadsheet...', 'info');
      const result = await desktop.exportExcel(batch.id, savePath);
      addToast(`Spreadsheet exported with ${result.rowCount} rows.`, 'success');
      
      // Reload batches list
      const useStore = useAppStore.getState();
      await useStore.loadBatches();
      if (activeBatch?.id === batch.id) {
        await useStore.loadBatchData(batch.id);
      }
    } catch (err: any) {
      addToast(`Spreadsheet export failed: ${err.message}`, 'error');
    }
  };

  const handleArchive = async (batch: ImportBatch) => {
    if (confirm(`Are you sure you want to archive batch: ${batch.source_filename}? It will be marked as ARCHIVED.`)) {
      await archiveBatch(batch.id);
      addToast('Batch archived.', 'success');
    }
  };

  const handleDeleteClick = (id: number) => {
    setDeleteConfirmId(id);
  };

  const handleConfirmDelete = async (id: number) => {
    try {
      await deleteBatch(id);
      addToast('Batch and all associated data permanently deleted from SQLite.', 'success');
      setDeleteConfirmId(null);
    } catch (err: any) {
      addToast(`Failed to delete batch: ${err.message}`, 'error');
    }
  };

  return (
    <div>
      <h1>Saved Batches</h1>
      <p className="page-subtitle">View and reopen previously loaded invoice lists, download Excel files, or archive files.</p>

      <div className="card">
        {batches.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-muted)' }}>
            No invoice lists loaded yet. Go to Load Invoices to choose a file.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Invoice File</th>
                  <th>Marketplace</th>
                  <th>Total Invoices</th>
                  <th>Status</th>
                  <th>Load Date</th>
                  <th>Completion Date</th>
                  <th style={{ width: '380px', textAlign: 'right' }}>Options</th>
                </tr>
              </thead>
              <tbody>
                {batches.map(batch => {
                  const totalOrders = batch.valid_order_count + batch.invalid_order_count;
                  const isActive = activeBatch?.id === batch.id;
                  
                  return (
                    <tr key={batch.id} style={{ borderLeft: isActive ? '4px solid var(--color-brand)' : 'none' }}>
                      <td>{batch.id}</td>
                      <td style={{ fontWeight: isActive ? 'bold' : 'normal' }}>
                        {batch.source_filename} {isActive && <span className="text-success" style={{ fontSize: '0.8rem' }}>(Active)</span>}
                      </td>
                      <td>{batch.marketplace}</td>
                      <td>{totalOrders} Invoices</td>
                      <td>
                        <span className={`badge badge-${batch.status === 'READY' || batch.status === 'EXPORTED' ? 'valid' : 'warning'}`}>
                          {batch.status}
                        </span>
                      </td>
                      <td>{new Date(batch.created_at).toLocaleString()}</td>
                      <td>{batch.completed_at ? new Date(batch.completed_at).toLocaleString() : '-'}</td>
                      <td>
                        <div className="flex gap-8 justify-between" style={{ justifyContent: 'flex-end' }}>
                          <button 
                            className="btn btn-secondary" 
                            style={{ padding: '6px 12px', fontSize: '0.8rem' }}
                            onClick={() => handleOpenBatch(batch)}
                            disabled={isActive || batch.status === 'ARCHIVED'}
                          >
                            🔓 Reopen for Scan
                          </button>
                          
                          <button 
                            className="btn btn-secondary" 
                            style={{ padding: '6px 12px', fontSize: '0.8rem' }}
                            onClick={() => handleExportExcel(batch)}
                            disabled={batch.status === 'ARCHIVED'}
                          >
                            📊 Save Excel
                          </button>

                          <button 
                            className="btn btn-secondary" 
                            style={{ padding: '6px 12px', fontSize: '0.8rem' }}
                            onClick={() => handleArchive(batch)}
                            disabled={batch.status === 'ARCHIVED'}
                          >
                            🗄️ Archive
                          </button>

                          {deleteConfirmId === batch.id ? (
                            <div className="flex gap-8">
                              <button 
                                className="btn btn-danger" 
                                style={{ padding: '6px 12px', fontSize: '0.8rem' }}
                                onClick={() => handleConfirmDelete(batch.id)}
                              >
                                Confirm
                              </button>
                              <button 
                                className="btn btn-secondary" 
                                style={{ padding: '6px 12px', fontSize: '0.8rem' }}
                                onClick={() => setDeleteConfirmId(null)}
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <button 
                              className="btn btn-danger" 
                              style={{ padding: '6px 12px', fontSize: '0.8rem' }}
                              onClick={() => handleDeleteClick(batch.id)}
                            >
                              🗑️ Delete
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
