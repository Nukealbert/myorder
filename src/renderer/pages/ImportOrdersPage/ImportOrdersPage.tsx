import React, { useState } from 'react';
import { useAppStore } from '../../stores/app.store';
import { DesktopAPI } from '../../../preload/desktop-api.types';
import { ParsedOrder } from '../../../main/modules/pdf/parsers/amazon.parser';
import * as crypto from 'crypto';

const desktop = (window as any).desktop as DesktopAPI;

interface ImportOrdersPageProps {
  addToast: (text: string, type: 'success' | 'error' | 'info') => void;
  setActiveTab: (tab: 'import' | 'dispatch' | 'history' | 'settings') => void;
}

export default function ImportOrdersPage({ addToast, setActiveTab }: ImportOrdersPageProps) {
  const { settings, importNewBatch, activeBatch } = useAppStore();
  const [filePath, setFilePath] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileHash, setFileHash] = useState<string | null>(null);
  
  const [pages, setPages] = useState<ParsedOrder[]>([]);
  const [pageCount, setPageCount] = useState(0);
  const [skippedPages, setSkippedPages] = useState<number[]>([]);
  const [processing, setProcessing] = useState(false);
  const [processingProgress, setProcessingProgress] = useState(0);

  // Edit Correction Modal State
  const [editingOrder, setEditingOrder] = useState<ParsedOrder | null>(null);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editPin, setEditPin] = useState('');
  const [editAddress, setEditAddress] = useState('');

  // Handle PDF selection
  const handleSelectFile = async () => {
    try {
      const selected = await desktop.selectPdf();
      if (selected) {
        setFilePath(selected.filePath);
        setFileName(selected.fileName);
        setPages([]);
        setSkippedPages([]);
        addToast(`Selected file: ${selected.fileName}`, 'info');
      }
    } catch (err: any) {
      addToast(`Error selecting file: ${err.message}`, 'error');
    }
  };

  // Process the PDF (parsing pages)
  const handleProcessFile = async () => {
    if (!filePath || !fileName) return;

    setProcessing(true);
    setProcessingProgress(15);
    addToast('Parsing PDF text layers...', 'info');

    try {
      // Create a mock hash to represent this file uniquely
      const hashInput = filePath + Date.now().toString();
      // We can generate a quick unique hash
      const uniqueHash = hashInput.split('').reduce((a, b) => {
        a = ((a << 5) - a) + b.charCodeAt(0);
        return a & a;
      }, 0).toString(16);
      
      setFileHash(uniqueHash);

      const parsed = await desktop.parsePdf(filePath);
      
      setProcessingProgress(70);
      setPages(parsed.pages);
      setPageCount(parsed.pageCount);
      
      // Auto-skip completely blank pages (which have no Order ID)
      const emptyPages: number[] = [];
      parsed.pages.forEach(p => {
        if (!p.external_order_id) {
          emptyPages.push(p.page_number);
        }
      });
      setSkippedPages(emptyPages);

      setProcessingProgress(100);
      addToast(`Processed ${parsed.pageCount} pages. Found ${parsed.pages.filter(p => p.extraction_status === 'VALID').length} valid invoices.`, 'success');
    } catch (err: any) {
      addToast(`Failed to process PDF: ${err.message}`, 'error');
    } finally {
      setTimeout(() => {
        setProcessing(false);
        setProcessingProgress(0);
      }, 500);
    }
  };

  // Toggle exclusion/skipping of pages
  const handleToggleSkip = (pageNumber: number) => {
    setSkippedPages(prev => 
      prev.includes(pageNumber) 
        ? prev.filter(p => p !== pageNumber) 
        : [...prev, pageNumber]
    );
  };

  // Open Edit Correction Dialog
  const handleOpenEdit = (order: ParsedOrder) => {
    setEditingOrder(order);
    setEditName(order.customer_name);
    setEditPhone(order.phone);
    setEditPin(order.pin_code);
    setEditAddress(order.address);
  };

  // Save manual correction inside state (and validate using rules)
  const handleSaveCorrection = () => {
    if (!editingOrder) return;

    // Validate inputs
    let error: string | null = null;
    let status: 'VALID' | 'WARNING' | 'INVALID' = 'VALID';

    if (!editPhone.match(/^\d{10}$/)) {
      status = 'WARNING';
      error = 'Phone number must be exactly 10 digits';
    }
    if (!editPin.match(/^\d{6}$/)) {
      status = 'WARNING';
      error = 'PIN code must be exactly 6 digits';
    }
    if (!editName.trim()) {
      status = 'WARNING';
      error = 'Customer name is required';
    }

    setPages(prev => prev.map(p => {
      if (p.page_number === editingOrder.page_number) {
        return {
          ...p,
          customer_name: editName,
          phone: editPhone,
          pin_code: editPin,
          address: editAddress,
          extraction_status: status,
          extraction_error: error
        };
      }
      return p;
    }));

    addToast(`Corrected page ${editingOrder.page_number} details.`, 'success');
    setEditingOrder(null);
  };

  // Save changes to database and create Batch
  const handleCreateBatch = async () => {
    if (!pages.length || !fileHash || !fileName) return;

    // Filter out pages that are skipped or unchecked
    const activePages = pages.filter(p => !skippedPages.includes(p.page_number));
    
    // Check if there are still invalid pages left in active selection
    const invalidPages = activePages.filter(p => p.extraction_status === 'INVALID');
    if (invalidPages.length > 0) {
      addToast(`Please resolve or skip the ${invalidPages.length} invalid pages before proceeding.`, 'error');
      return;
    }

    try {
      addToast('Saving imported batch...', 'info');
      
      const ordersToImport = activePages.map(p => ({
        batch_id: 0, // Assigned by repository
        marketplace: 'Amazon',
        external_order_id: p.external_order_id,
        customer_name: p.customer_name,
        phone: p.phone,
        pin_code: p.pin_code,
        address: p.address,
        order_date: p.order_date,
        page_number: p.page_number,
        extraction_status: p.extraction_status,
        extraction_error: p.extraction_error
      }));

      await importNewBatch({
        marketplace: 'Amazon',
        sourceFilename: fileName,
        fileHash: fileHash,
        pageCount: pageCount,
        orders: ordersToImport
      });

      addToast('Batch saved successfully to SQLite database!', 'success');
      setActiveTab('dispatch');
    } catch (err: any) {
      addToast(`Import failed: ${err.message}`, 'error');
    }
  };

  // Generate Processed PDF with Overlaid Barcodes and Seller Header
  const handleGeneratePdf = async () => {
    if (!filePath || !pages.length) return;

    const sellerHeader = settings?.sellerHeader || 'GYAN POST (BOOKS)';
    const defaultOutputName = `Overlaid_${fileName}`;

    try {
      const savePath = await desktop.selectSavePath(defaultOutputName);
      if (!savePath) return;

      addToast('Generating barcoded invoices PDF...', 'info');

      // Map page data for only non-skipped pages that have valid Order IDs
      const overlayPages = pages
        .filter(p => !skippedPages.includes(p.page_number) && p.external_order_id)
        .map(p => ({
          pageNumber: p.page_number,
          orderId: p.external_order_id,
          sellerHeader
        }));

      await desktop.generateProcessedPdf(filePath, savePath, overlayPages);
      addToast(`Saved process PDF to: ${savePath}`, 'success');
    } catch (err: any) {
      addToast(`PDF creation failed: ${err.message}`, 'error');
    }
  };

  const validCount = pages.filter(p => !skippedPages.includes(p.page_number) && p.extraction_status === 'VALID').length;
  const warningCount = pages.filter(p => !skippedPages.includes(p.page_number) && p.extraction_status === 'WARNING').length;
  const invalidCount = pages.filter(p => !skippedPages.includes(p.page_number) && p.extraction_status === 'INVALID').length;
  const totalCount = pages.length - skippedPages.length;

  return (
    <div>
      <h1>Load Invoices PDF</h1>
      <p className="page-subtitle">Select your Amazon PDF invoice file to read the customer orders.</p>

      <div className="import-page-grid">
        {/* Left Control Card */}
        <div className="card flex flex-col gap-16">
          <h3>1. Choose Invoice File</h3>
          
          <div 
            className={`upload-dropzone ${filePath ? 'has-file' : ''}`}
            onClick={handleSelectFile}
            style={{ cursor: 'pointer' }}
          >
            <div className="upload-icon">{filePath ? '📄' : '📥'}</div>
            <div className="upload-text">
              {filePath ? (
                <>
                  <span className="file-highlight">{fileName}</span>
                  <span className="file-subtext">Click to choose a different PDF file</span>
                </>
              ) : (
                <>
                  <span className="file-highlight">Select Amazon Invoice PDF</span>
                  <span className="file-subtext">Click here to browse your files</span>
                </>
              )}
            </div>
          </div>

          {filePath && !pages.length && (
            <button 
              className="btn btn-primary w-full mt-12" 
              onClick={handleProcessFile} 
              disabled={processing}
              style={{ padding: '16px 28px', fontSize: '1rem', textShadow: '0 1px 2px rgba(0,0,0,0.2)' }}
            >
              {processing ? (
                <div className="flex items-center justify-center gap-8">
                  <div className="spinner" style={{ width: '18px', height: '18px', borderWidth: '2.5px' }} />
                  <span>Reading Invoices...</span>
                </div>
              ) : '⚡ Read Invoices'}
            </button>
          )}

          {processing && (
            <div className="w-full mt-12">
              <div className="flex justify-between" style={{ fontSize: '0.85rem', marginBottom: '6px' }}>
                <span className="text-secondary">Reading PDF invoices...</span>
                <span style={{ fontWeight: 'bold' }}>{processingProgress}%</span>
              </div>
              <div style={{ height: '8px', width: '100%', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{ width: `${processingProgress}%`, height: '100%', background: 'var(--color-brand-gradient)', transition: 'width 0.1s ease' }} />
              </div>
            </div>
          )}

          {pages.length > 0 && (
            <div className="mt-12 flex flex-col gap-16">
              <h3>2. Summary</h3>
              <div className="summary-stats-grid">
                <div className="stat-card">
                  <span className="stat-label">Total Invoices</span>
                  <span className="stat-value">{totalCount}</span>
                </div>
                <div className="stat-card stat-valid">
                  <span className="stat-label">Valid Orders</span>
                  <span className="stat-value text-success">{validCount}</span>
                </div>
                <div className="stat-card stat-warning">
                  <span className="stat-label">Warnings</span>
                  <span className="stat-value text-warning">{warningCount}</span>
                </div>
                <div className="stat-card stat-invalid">
                  <span className="stat-label">Invalid</span>
                  <span className="stat-value text-error">{invalidCount}</span>
                </div>
              </div>

              <div className="flex gap-12 mt-24">
                <button 
                  className="btn btn-secondary flex-1" 
                  onClick={handleGeneratePdf}
                  disabled={invalidCount > 0}
                >
                  🖨️ Save PDF with Barcodes
                </button>
                <button 
                  className="btn btn-primary flex-1" 
                  onClick={handleCreateBatch}
                  disabled={invalidCount > 0}
                >
                  💾 Save Orders List
                </button>
              </div>
              {invalidCount > 0 && (
                <p className="text-error" style={{ fontSize: '0.8rem', textAlign: 'center' }}>
                  ⚠️ Please correct or skip all invalid pages before printing or saving.
                </p>
              )}
            </div>
          )}
        </div>

        {/* Info card when active batch loaded */}
        <div className="card">
          <h3>Active Invoice Batch</h3>
          {activeBatch ? (
            <div className="mt-12 flex flex-col gap-12" style={{ fontSize: '0.95rem' }}>
              <div className="flex justify-between" style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
                <span className="text-secondary">Filename:</span>
                <strong>{activeBatch.source_filename}</strong>
              </div>
              <div className="flex justify-between" style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
                <span className="text-secondary">Status:</span>
                <span className="badge badge-valid">{activeBatch.status}</span>
              </div>
              <div className="flex justify-between" style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
                <span className="text-secondary">Orders Count:</span>
                <strong>{activeBatch.valid_order_count} Valid</strong>
              </div>
              <div className="flex justify-between" style={{ paddingBottom: '4px' }}>
                <span className="text-secondary">Created:</span>
                <strong>{new Date(activeBatch.created_at).toLocaleString()}</strong>
              </div>
            </div>
          ) : (
            <p className="text-muted mt-12">No active invoice batch loaded yet. Select a PDF file above to begin.</p>
          )}
        </div>
      </div>

      {/* Pages Review Table */}
      {pages.length > 0 && (
        <div className="card">
          <h3>Check Extracted Details</h3>
          <p className="text-secondary" style={{ fontSize: '0.85rem', marginBottom: '16px' }}>
            Review details page by page. Uncheck pages if you want to skip them, or click Edit if there is a mistake in phone or PIN code.
          </p>

          <div style={{ overflowX: 'auto', maxHeight: '400px' }}>
            <table>
              <thead>
                <tr>
                  <th style={{ width: '40px' }}>Skip</th>
                  <th style={{ width: '60px' }}>Page</th>
                  <th>Order ID</th>
                  <th>Customer Name</th>
                  <th>Phone Number</th>
                  <th>PIN Code</th>
                  <th>Status</th>
                  <th style={{ width: '80px' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {pages.map(p => {
                  const isSkipped = skippedPages.includes(p.page_number);
                  return (
                    <tr key={p.page_number} style={{ opacity: isSkipped ? 0.4 : 1 }}>
                      <td>
                        <input 
                          type="checkbox" 
                          checked={!isSkipped} 
                          onChange={() => handleToggleSkip(p.page_number)}
                          style={{ transform: 'scale(1.2)', cursor: 'pointer' }}
                        />
                      </td>
                      <td>{p.page_number}</td>
                      <td style={{ fontFamily: 'monospace' }}>{p.external_order_id || 'N/A'}</td>
                      <td>{p.customer_name || <em className="text-muted">Empty</em>}</td>
                      <td>{p.phone || <em className="text-muted">Empty</em>}</td>
                      <td>{p.pin_code || <em className="text-muted">Empty</em>}</td>
                      <td>
                        {isSkipped ? (
                          <span className="badge badge-warning" style={{ backgroundColor: 'rgba(255,255,255,0.05)', color: '#888', border: '1px solid #444' }}>SKIPPED</span>
                        ) : (
                          <span className={`badge badge-${p.extraction_status.toLowerCase()}`}>
                            {p.extraction_status}
                          </span>
                        )}
                      </td>
                      <td>
                        <button 
                          className="btn btn-secondary" 
                          style={{ padding: '4px 8px', fontSize: '0.8rem' }}
                          onClick={() => handleOpenEdit(p)}
                          disabled={isSkipped}
                        >
                          ✏️ Edit
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Manual Correction Modal */}
      {editingOrder && (
        <div className="pincode-modal-overlay">
          <div className="pincode-modal">
            <h3>Correct Invoice Extraction - Page {editingOrder.page_number}</h3>
            
            <div className="form-group mt-12">
              <label>Customer Name</label>
              <input type="text" value={editName} onChange={e => setEditName(e.target.value)} />
            </div>

            <div className="form-group">
              <label>Phone Number (10 digits)</label>
              <input type="text" value={editPhone} onChange={e => setEditPhone(e.target.value)} maxLength={10} />
            </div>

            <div className="form-group">
              <label>PIN Code (6 digits)</label>
              <input type="text" value={editPin} onChange={e => setEditPin(e.target.value)} maxLength={6} />
            </div>

            <div className="form-group">
              <label>Full Address</label>
              <textarea rows={3} value={editAddress} onChange={e => setEditAddress(e.target.value)} />
            </div>

            <div className="flex gap-12 mt-24 justify-between">
              <button className="btn btn-secondary" onClick={() => setEditingOrder(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSaveCorrection}>Save Corrections</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
