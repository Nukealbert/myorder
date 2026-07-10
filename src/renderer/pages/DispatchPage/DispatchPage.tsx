import React, { useState, useEffect, useRef } from 'react';
import { useAppStore } from '../../stores/app.store';
import { DesktopAPI } from '../../../preload/desktop-api.types';
import { PinCodeRecord } from '../../../main/database/repositories/pincode.repository';

const desktop = (window as any).desktop as DesktopAPI;

interface DispatchPageProps {
  addToast: (text: string, type: 'success' | 'error' | 'info') => void;
  setActiveTab: (tab: 'import' | 'dispatch' | 'history' | 'settings') => void;
}

export default function DispatchPage({ addToast, setActiveTab }: DispatchPageProps) {
  const { activeBatch, activeShipments, settings, addShipment, removeShipment } = useAppStore();

  const [weight, setWeight] = useState('');
  const [orderId, setOrderId] = useState('');
  const [postId, setPostId] = useState('');

  // Scanned order details loaded live
  const [matchedOrder, setMatchedOrder] = useState<any | null>(null);
  const [pincodeDetails, setPincodeDetails] = useState<PinCodeRecord | null>(null);

  // Focus Refs for keyboard workflow
  const weightRef = useRef<HTMLInputElement>(null);
  const orderIdRef = useRef<HTMLInputElement>(null);
  const postIdRef = useRef<HTMLInputElement>(null);
  const submitBtnRef = useRef<HTMLButtonElement>(null);

  // PIN code correction modal state
  const [showPincodeModal, setShowPincodeModal] = useState(false);
  const [missingPincode, setMissingPincode] = useState('');
  const [correctedOffice, setCorrectedOffice] = useState('');
  const [correctedDistrict, setCorrectedDistrict] = useState('');
  const [correctedState, setCorrectedState] = useState('');

  // Scan activity log
  const [scanLogs, setScanLogs] = useState<{ id: number; message: string; type: 'success' | 'error' | 'info' }[]>([]);

  // Focus Weight field on mount
  useEffect(() => {
    if (weightRef.current) {
      weightRef.current.focus();
    }
  }, []);

  const addLog = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setScanLogs(prev => [{ id: Date.now(), message, type }, ...prev].slice(0, 30));
  };

  // Keyboard navigation & scanning handler
  const handleWeightKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (!weight || parseFloat(weight) <= 0) {
        addToast('Please enter a valid weight (grams)', 'error');
        return;
      }
      addLog(`Weight entered: ${weight}g`, 'info');
      orderIdRef.current?.focus();
    }
  };

  const handleOrderIdKeyDown = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (!activeBatch) {
        addToast('No active batch selected. Import a PDF first.', 'error');
        return;
      }
      
      const cleanOrderId = orderId.trim();
      if (!cleanOrderId) return;

      addLog(`Scanning Order ID: ${cleanOrderId}...`, 'info');

      try {
        // Look up order in current batch
        const order = await desktop.findOrderInBatch(activeBatch.id, cleanOrderId);
        if (!order) {
          const errMsg = `Order ${cleanOrderId} was not found in the current imported batch.`;
          addToast(errMsg, 'error');
          addLog(errMsg, 'error');
          setOrderId('');
          return;
        }

        // Verify if order is already shipped
        const alreadyShipped = activeShipments.find(s => s.external_order_id === cleanOrderId);
        if (alreadyShipped) {
          const errMsg = `This order was already assigned to Post ID ${alreadyShipped.post_id}.`;
          addToast(errMsg, 'error');
          addLog(errMsg, 'error');
          setOrderId('');
          return;
        }

        setMatchedOrder(order);
        addLog(`Found Order details for ${order.customer_name}. PIN: ${order.pin_code}`, 'success');

        // Look up PIN code
        const pinRecord = await desktop.lookupPinCode(order.pin_code);
        if (!pinRecord) {
          // PIN code is missing from local database, prompt for correction
          setMissingPincode(order.pin_code);
          setCorrectedOffice('');
          setCorrectedDistrict('');
          setCorrectedState('');
          setShowPincodeModal(true);
          addLog(`PIN code ${order.pin_code} not found in offline database. Prompting correction.`, 'info');
        } else {
          setPincodeDetails(pinRecord);
          // Advance focus to Post ID field
          postIdRef.current?.focus();
        }
      } catch (err: any) {
        addToast(`Order lookup error: ${err.message}`, 'error');
      }
    }
  };

  const handlePostIdKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      submitBtnRef.current?.focus();
    }
  };

  // Save manual PIN code correction
  const handleSavePincodeCorrection = async () => {
    if (!correctedOffice.trim() || !correctedDistrict.trim() || !correctedState.trim()) {
      addToast('All PIN-code correction fields are required.', 'error');
      return;
    }

    try {
      const newRecord = {
        pin_code: missingPincode,
        office_name: correctedOffice.trim(),
        district: correctedDistrict.trim(),
        state: correctedState.trim()
      };

      await desktop.savePinCodeCorrection(newRecord);
      setPincodeDetails(newRecord);
      setShowPincodeModal(false);
      addToast(`PIN code ${missingPincode} correction saved.`, 'success');
      addLog(`PIN code ${missingPincode} corrected and saved.`, 'success');
      
      // Focus Post ID input after modal closes
      setTimeout(() => {
        postIdRef.current?.focus();
      }, 100);
    } catch (err: any) {
      addToast(`Failed to save correction: ${err.message}`, 'error');
    }
  };

  // Submit the parcel dispatch record
  const handleSubmitShipment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeBatch || !matchedOrder || !pincodeDetails) {
      addToast('Missing scanned Order or PIN code directory match.', 'error');
      return;
    }

    const grams = parseInt(weight);
    if (isNaN(grams) || grams <= 0) {
      addToast('Enter a weight greater than 0 grams.', 'error');
      return;
    }

    const cleanPostId = postId.trim().toUpperCase();
    if (!cleanPostId.match(/^[A-Z]{2}\d{9}IN$/i)) {
      addToast('Post ID must be a valid India Post ID (e.g. CB138381160IN)', 'error');
      return;
    }

    try {
      await addShipment({
        batch_id: activeBatch.id,
        order_id: matchedOrder.id,
        post_id: cleanPostId,
        weight_grams: grams,
        post_office: pincodeDetails.office_name,
        district: pincodeDetails.district,
        state: pincodeDetails.state
      });

      addToast(`Shipment successfully saved! Post ID: ${cleanPostId}`, 'success');
      addLog(`Dispatched Order ${matchedOrder.external_order_id} via ${cleanPostId} (${grams}g)`, 'success');

      // Reset form fields
      setOrderId('');
      setPostId('');
      setMatchedOrder(null);
      setPincodeDetails(null);

      // Focus workflow depending on settings
      if (settings?.retainWeight) {
        // Keep weight, focus Order ID directly
        orderIdRef.current?.focus();
      } else {
        // Clear weight, focus weight input
        setWeight('');
        weightRef.current?.focus();
      }
    } catch (err: any) {
      addToast(err.message || 'Failed to submit shipment', 'error');
      addLog(`Submission failed: ${err.message}`, 'error');
    }
  };

  // Handle Export Excel from Dispatch page
  const handleExportBatch = async () => {
    if (!activeBatch || activeShipments.length === 0) return;

    try {
      const defaultName = `Amazon_Dispatch_${new Date().toISOString().split('T')[0]}_${activeShipments.length}-orders.xlsx`;
      const savePath = await desktop.selectExcelSavePath(defaultName);
      if (!savePath) return;

      addToast('Exporting to Excel...', 'info');
      const result = await desktop.exportExcel(activeBatch.id, savePath);
      addToast(`Excel batch exported: ${result.rowCount} orders saved.`, 'success');
      addLog(`Excel exported: ${result.filePath} (${result.rowCount} rows)`, 'success');
    } catch (err: any) {
      addToast(`Export failed: ${err.message}`, 'error');
    }
  };

  return (
    <div style={{ height: '100%' }}>
      <div className="flex justify-between items-center" style={{ marginBottom: '8px' }}>
        <div>
          <h1>Scan Parcels</h1>
          <p className="page-subtitle">Type parcel weight and scan barcodes to dispatch. Click fields to focus.</p>
        </div>
        {activeBatch && activeShipments.length > 0 && (
          <button className="btn btn-primary" onClick={handleExportBatch}>
            📥 Save Excel Sheet ({activeShipments.length})
          </button>
        )}
      </div>

      {!activeBatch ? (
        <div className="card text-center flex flex-col items-center justify-center gap-16" style={{ padding: '80px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <p className="text-muted" style={{ fontSize: '1.2rem', marginBottom: '16px' }}>
            ⚠️ Please select and load an Amazon invoice batch to begin scanning parcels.
          </p>
          <button className="btn btn-primary" onClick={() => setActiveTab('import')} style={{ maxWidth: '240px' }}>
            📥 Load Invoices PDF
          </button>
        </div>
      ) : (
        <div className="dispatch-main-layout">
          {/* Left Form Panel */}
          <form className="card dispatch-form-card" onSubmit={handleSubmitShipment}>
            <div className="flex flex-col gap-20">
              <h3>Scan Details</h3>

              {/* Step 1: Weight Input */}
              <div className={`scan-step-card ${!weight ? 'active-step' : 'completed-step'}`}>
                <div className="step-num">01</div>
                <div className="step-content">
                  <label>Weight (in grams) *</label>
                  <input 
                    type="number"
                    ref={weightRef}
                    value={weight}
                    onChange={e => setWeight(e.target.value)}
                    onKeyDown={handleWeightKeyDown}
                    placeholder="Enter weight & press Enter"
                    autoComplete="off"
                    className="scan-input"
                  />
                  {weight && <span className="step-badge">✓ {weight}g</span>}
                </div>
              </div>

              {/* Step 2: Order ID */}
              <div className={`scan-step-card ${weight && !orderId ? 'active-step' : orderId ? 'completed-step' : 'disabled-step'}`}>
                <div className="step-num">02</div>
                <div className="step-content">
                  <label>Scan Order ID Barcode *</label>
                  <input 
                    type="text"
                    ref={orderIdRef}
                    value={orderId}
                    onChange={e => setOrderId(e.target.value)}
                    onKeyDown={handleOrderIdKeyDown}
                    placeholder="Scan Order ID barcode"
                    autoComplete="off"
                    disabled={!weight}
                    className="scan-input"
                  />
                  {orderId && <span className="step-badge">✓ Verified</span>}
                </div>
              </div>

              {/* Customer Match Card Badge */}
              {matchedOrder && (
                <div className="customer-preview-badge">
                  <div className="customer-avatar">
                    {matchedOrder.customer_name ? matchedOrder.customer_name.charAt(0).toUpperCase() : 'C'}
                  </div>
                  <div className="customer-details">
                    <span className="customer-name">{matchedOrder.customer_name}</span>
                    <span className="customer-contact">📞 {matchedOrder.phone} | 📍 {matchedOrder.pin_code}</span>
                    {pincodeDetails ? (
                      <span className="customer-location text-success">🗺️ {pincodeDetails.office_name}, {pincodeDetails.district}, {pincodeDetails.state}</span>
                    ) : (
                      <span className="customer-location text-error">⚠️ PIN Code details not found</span>
                    )}
                  </div>
                </div>
              )}

              {/* Step 3: India Post ID */}
              <div className={`scan-step-card ${matchedOrder && !postId ? 'active-step' : postId ? 'completed-step' : 'disabled-step'}`}>
                <div className="step-num">03</div>
                <div className="step-content">
                  <label>Scan India Post Barcode (Tracking ID) *</label>
                  <input 
                    type="text"
                    ref={postIdRef}
                    value={postId}
                    onChange={e => setPostId(e.target.value)}
                    onKeyDown={handlePostIdKeyDown}
                    placeholder="Scan Post tracking ID"
                    autoComplete="off"
                    disabled={!matchedOrder || !pincodeDetails}
                    className="scan-input"
                  />
                  {postId && <span className="step-badge">✓ Scanned</span>}
                </div>
              </div>

              <button 
                type="submit" 
                ref={submitBtnRef}
                className="btn btn-primary w-full mt-12"
                disabled={!weight || !orderId || !postId || !matchedOrder || !pincodeDetails}
                style={{ padding: '16px 28px', fontSize: '1rem', textShadow: '0 1px 2px rgba(0,0,0,0.2)' }}
              >
                💾 Save Parcel Details
              </button>
            </div>

            {/* Live Scan Logger Console */}
            <div>
              <label>Scan History Logs</label>
              <div className="scan-logs">
                {scanLogs.length === 0 ? (
                  <span className="text-muted">Ready for scanning...</span>
                ) : (
                  scanLogs.map(log => (
                    <div key={log.id} className={`scan-log-entry text-${log.type}`}>
                      <span>&gt; {log.message}</span>
                      <span className="text-muted" style={{ fontSize: '0.75rem' }}>{new Date(log.id).toLocaleTimeString()}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </form>

          {/* Right Shipments Table Panel */}
          <div className="card shipments-list-card">
            <h3>Scanned Parcels List ({activeShipments.length})</h3>
            <p className="text-secondary" style={{ fontSize: '0.85rem', marginBottom: '16px' }}>
              List of parcels scanned and saved in the database.
            </p>

            <div className="shipments-table-wrapper">
              {activeShipments.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-muted)' }}>
                  No shipments registered in this batch yet. Scan a parcel on the left to start.
                </div>
              ) : (
                <table>
                  <thead>
                    <tr>
                      <th>Post ID</th>
                      <th>Order ID</th>
                      <th>Customer Name</th>
                      <th>PIN Code</th>
                      <th>District / State</th>
                      <th>Weight</th>
                      <th style={{ width: '50px' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeShipments.map(s => (
                      <tr key={s.id}>
                        <td style={{ fontFamily: 'monospace', fontWeight: 'bold' }}>{s.post_id}</td>
                        <td style={{ fontFamily: 'monospace' }}>{s.external_order_id}</td>
                        <td>{s.customer_name}</td>
                        <td>{s.pin_code}</td>
                        <td>{s.district}, {s.state}</td>
                        <td>{s.weight_grams}g</td>
                        <td>
                          <button 
                            className="btn btn-danger" 
                            style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                            onClick={() => removeShipment(s.id, activeBatch.id)}
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Pincode missing correction modal */}
      {showPincodeModal && (
        <div className="pincode-modal-overlay">
          <div className="pincode-modal">
            <h3 className="text-warning">⚠️ PIN Code Details Not Found</h3>
            <p className="text-secondary mt-12" style={{ fontSize: '0.9rem' }}>
              PIN code <strong>{missingPincode}</strong> was not found in the directory. Please enter the post office details to save it permanently:
            </p>

            <div className="form-group mt-12">
              <label>Post Office Name</label>
              <input 
                type="text" 
                value={correctedOffice} 
                onChange={e => setCorrectedOffice(e.target.value)} 
                placeholder="e.g. Tanakpur SO" 
              />
            </div>

            <div className="form-group">
              <label>District</label>
              <input 
                type="text" 
                value={correctedDistrict} 
                onChange={e => setCorrectedDistrict(e.target.value)} 
                placeholder="e.g. Champawat" 
              />
            </div>

            <div className="form-group">
              <label>State</label>
              <input 
                type="text" 
                value={correctedState} 
                onChange={e => setCorrectedState(e.target.value)} 
                placeholder="e.g. UTTARAKHAND" 
              />
            </div>

            <div className="flex gap-12 mt-24 justify-between">
              <button 
                type="button" 
                className="btn btn-secondary" 
                onClick={() => {
                  setShowPincodeModal(false);
                  setOrderId('');
                  setMatchedOrder(null);
                  weightRef.current?.focus();
                }}
              >
                Cancel Scan
              </button>
              <button 
                type="button" 
                className="btn btn-primary" 
                onClick={handleSavePincodeCorrection}
              >
                Save & Continue Scan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
