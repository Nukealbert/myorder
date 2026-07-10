import React, { useState, useEffect } from 'react';
import { DesktopAPI } from '../../../preload/desktop-api.types';
import { PinCodeRecord } from '../../../main/database/repositories/pincode.repository';

const desktop = (window as any).desktop as DesktopAPI;

interface PinDirectoryPageProps {
  addToast: (text: string, type: 'success' | 'error' | 'info') => void;
}

export default function PinDirectoryPage({ addToast }: PinDirectoryPageProps) {
  const [query, setQuery] = useState('');
  const [rows, setRows] = useState<PinCodeRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const limit = 50;

  // Add PIN Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [newPin, setNewPin] = useState('');
  const [newOffice, setNewOffice] = useState('');
  const [newDistrict, setNewDistrict] = useState('');
  const [newState, setNewState] = useState('');

  const fetchPinCodes = async () => {
    setLoading(true);
    try {
      const offset = (page - 1) * limit;
      const result = await desktop.searchPinCodes(query, limit, offset);
      setRows(result.rows);
      setTotal(result.total);
    } catch (err: any) {
      addToast(`Failed to search PIN codes: ${err.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  // Run fetch when query or page changes
  useEffect(() => {
    // Reset to page 1 on query change
    fetchPinCodes();
  }, [query, page]);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value);
    setPage(1); // Reset page to 1
  };

  const handleAddPinCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPin.match(/^\d{6}$/)) {
      addToast('PIN code must be exactly 6 digits', 'error');
      return;
    }
    if (!newOffice.trim()) {
      addToast('Post Office name is required', 'error');
      return;
    }
    if (!newDistrict.trim()) {
      addToast('District is required', 'error');
      return;
    }
    if (!newState.trim()) {
      addToast('State is required', 'error');
      return;
    }

    try {
      await desktop.savePinCodeCorrection({
        pin_code: newPin,
        office_name: newOffice,
        district: newDistrict,
        state: newState
      });
      addToast(`Successfully saved PIN code ${newPin} to database!`, 'success');
      setShowAddModal(false);
      // Reset form
      setNewPin('');
      setNewOffice('');
      setNewDistrict('');
      setNewState('');
      // Refetch active list
      fetchPinCodes();
    } catch (err: any) {
      addToast(`Failed to save PIN code: ${err.message}`, 'error');
    }
  };

  const totalPages = Math.ceil(total / limit) || 1;

  return (
    <div>
      <div className="flex justify-between items-center" style={{ marginBottom: '8px' }}>
        <div>
          <h1>PIN Code Directory</h1>
          <p className="page-subtitle">Search, view, and manage all offline Indian Post Office mappings stored in your database.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowAddModal(true)}>
          ➕ Add PIN Code
        </button>
      </div>

      {/* Stats and Search Card */}
      <div className="card flex flex-col gap-16" style={{ marginBottom: '24px' }}>
        <div className="flex justify-between items-center" style={{ flexWrap: 'wrap', gap: '16px' }}>
          <div style={{ flex: '1', minWidth: '280px' }}>
            <label>Search Directory</label>
            <input 
              type="text" 
              value={query}
              onChange={handleSearchChange}
              placeholder="Search by PIN, post office, district, or state..."
              style={{ marginTop: '8px' }}
            />
          </div>
          
          <div className="stat-card" style={{ minWidth: '180px', borderLeft: '3px solid var(--color-brand)' }}>
            <span className="stat-label">Total PINs Stored</span>
            <span className="stat-value text-success">{total.toLocaleString()}</span>
          </div>
        </div>
      </div>

      {/* Results Table Card */}
      <div className="card">
        <h3>Post Office Mappings</h3>
        
        {loading && rows.length === 0 ? (
          <div className="flex justify-center items-center" style={{ padding: '60px 0' }}>
            <div className="spinner" />
          </div>
        ) : rows.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-muted)' }}>
            No matching PIN codes found in the database.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th style={{ width: '120px' }}>PIN Code</th>
                  <th>Post Office Name</th>
                  <th>District</th>
                  <th>State</th>
                  <th>Office Type</th>
                  <th>Delivery Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(row => (
                  <tr key={row.pin_code}>
                    <td style={{ fontWeight: 'bold', fontFamily: 'monospace' }}>{row.pin_code}</td>
                    <td>{row.office_name}</td>
                    <td>{row.district}</td>
                    <td>{row.state}</td>
                    <td>
                      <span className="badge" style={{ backgroundColor: 'rgba(255,255,255,0.05)', color: 'var(--text-secondary)' }}>
                        {row.office_type || 'SO'}
                      </span>
                    </td>
                    <td>
                      <span className="badge badge-valid">
                        {row.delivery_status || 'Delivery'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Pagination Controls */}
            <div className="flex justify-between items-center mt-24" style={{ flexWrap: 'wrap', gap: '16px' }}>
              <span className="text-secondary" style={{ fontSize: '0.9rem' }}>
                Showing <strong>{((page - 1) * limit) + 1}</strong> to <strong>{Math.min(page * limit, total)}</strong> of <strong>{total}</strong> entries
              </span>

              <div className="flex gap-12">
                <button 
                  className="btn btn-secondary" 
                  onClick={() => setPage(prev => Math.max(prev - 1, 1))}
                  disabled={page === 1}
                  style={{ padding: '8px 16px', fontSize: '0.85rem' }}
                >
                  ◀ Previous
                </button>
                <span className="flex items-center" style={{ fontSize: '0.9rem', fontWeight: '600', padding: '0 8px' }}>
                  Page {page} of {totalPages}
                </span>
                <button 
                  className="btn btn-secondary" 
                  onClick={() => setPage(prev => Math.min(prev + 1, totalPages))}
                  disabled={page === totalPages}
                  style={{ padding: '8px 16px', fontSize: '0.85rem' }}
                >
                  Next ▶
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Add new PIN Code Modal */}
      {showAddModal && (
        <div className="pincode-modal-overlay">
          <form className="pincode-modal" onSubmit={handleAddPinCode}>
            <h3>Add New PIN Code Mapping</h3>
            
            <div className="form-group mt-12">
              <label>PIN Code (6 digits) *</label>
              <input 
                type="text" 
                value={newPin} 
                onChange={e => setNewPin(e.target.value)} 
                maxLength={6}
                placeholder="e.g. 110001" 
                required
              />
            </div>

            <div className="form-group">
              <label>Post Office Name *</label>
              <input 
                type="text" 
                value={newOffice} 
                onChange={e => setNewOffice(e.target.value)} 
                placeholder="e.g. Connaught Place" 
                required
              />
            </div>

            <div className="form-group">
              <label>District *</label>
              <input 
                type="text" 
                value={newDistrict} 
                onChange={e => setNewDistrict(e.target.value)} 
                placeholder="e.g. New Delhi" 
                required
              />
            </div>

            <div className="form-group">
              <label>State *</label>
              <input 
                type="text" 
                value={newState} 
                onChange={e => setNewState(e.target.value)} 
                placeholder="e.g. DELHI" 
                required
              />
            </div>

            <div className="flex gap-12 mt-24 justify-between">
              <button type="button" className="btn btn-secondary" onClick={() => setShowAddModal(false)}>Cancel</button>
              <button type="submit" className="btn btn-primary">Save PIN Code</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
