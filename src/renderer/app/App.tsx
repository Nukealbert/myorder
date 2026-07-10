import React, { useEffect, useState } from 'react';
import { useAppStore } from '../stores/app.store';
import ImportOrdersPage from '../pages/ImportOrdersPage/ImportOrdersPage';
import DispatchPage from '../pages/DispatchPage/DispatchPage';
import BatchHistoryPage from '../pages/BatchHistoryPage/BatchHistoryPage';
import SettingsPage from '../pages/SettingsPage/SettingsPage';
import PinDirectoryPage from '../pages/PinDirectoryPage/PinDirectoryPage';

export interface ToastMessage {
  id: number;
  text: string;
  type: 'success' | 'error' | 'info';
}

export default function App() {
  const { loadSettings, loadLatestBatch, loadBatches, activeBatch } = useAppStore();
  const [activeTab, setActiveTab] = useState<'import' | 'dispatch' | 'history' | 'settings' | 'pincodes'>('import');
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  useEffect(() => {
    // Initialise app state on boot
    loadSettings();
    loadLatestBatch();
    loadBatches();
  }, []);

  const addToast = (text: string, type: 'success' | 'error' | 'info' = 'info') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, text, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  };

  const renderActiveTab = () => {
    switch (activeTab) {
      case 'import':
        return <ImportOrdersPage addToast={addToast} setActiveTab={setActiveTab} />;
      case 'dispatch':
        return <DispatchPage addToast={addToast} setActiveTab={setActiveTab} />;
      case 'history':
        return <BatchHistoryPage addToast={addToast} setActiveTab={setActiveTab} />;
      case 'pincodes':
        return <PinDirectoryPage addToast={addToast} />;
      case 'settings':
        return <SettingsPage addToast={addToast} />;
      default:
        return <ImportOrdersPage addToast={addToast} setActiveTab={setActiveTab} />;
    }
  };

  return (
    <div className="app-container">
      {/* Navigation Header */}
      <header className="app-navbar">
        <div className="brand-section">
          <div className="brand-logo">A</div>
          <span className="brand-name">Amazon Dispatch Register</span>
        </div>
        <nav className="nav-links">
          <button 
            className={`nav-button ${activeTab === 'import' ? 'active' : ''}`}
            onClick={() => setActiveTab('import')}
          >
            📥 Load Invoices
          </button>
          <button 
            className={`nav-button ${activeTab === 'dispatch' ? 'active' : ''}`}
            onClick={() => setActiveTab('dispatch')}
          >
            🚚 Scan & Dispatch
          </button>
          <button 
            className={`nav-button ${activeTab === 'history' ? 'active' : ''}`}
            onClick={() => setActiveTab('history')}
          >
            📚 Saved Batches
          </button>
          <button 
            className={`nav-button ${activeTab === 'pincodes' ? 'active' : ''}`}
            onClick={() => setActiveTab('pincodes')}
          >
            📍 PIN Directory
          </button>
          <button 
            className={`nav-button ${activeTab === 'settings' ? 'active' : ''}`}
            onClick={() => setActiveTab('settings')}
          >
            ⚙️ Settings
          </button>
        </nav>
      </header>

      {/* Active Batch Status Banner */}
      {activeBatch && (
        <div className="active-batch-banner">
          <div>
            Current Invoice File: <strong>{activeBatch.source_filename}</strong> ({activeBatch.marketplace})
          </div>
          <div>
            Status: <span className={`text-${activeBatch.status === 'READY' || activeBatch.status === 'EXPORTED' ? 'success' : 'warning'}`}>
              {activeBatch.status === 'NEEDS_REVIEW' ? 'Needs Correction' : activeBatch.status}
            </span>
            &nbsp;|&nbsp; Pages: {activeBatch.page_count}
            &nbsp;|&nbsp; Orders: {activeBatch.valid_order_count + activeBatch.invalid_order_count}
          </div>
        </div>
      )}

      {/* View Content Area */}
      <main className="app-content">
        {renderActiveTab()}
      </main>

      {/* Global Alert Notification Toasts */}
      <div className="toast-container">
        {toasts.map(toast => (
          <div key={toast.id} className={`toast toast-${toast.type}`}>
            <div>
              {toast.type === 'success' && '✅'}
              {toast.type === 'error' && '❌'}
              {toast.type === 'info' && 'ℹ️'}
            </div>
            <div>{toast.text}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
