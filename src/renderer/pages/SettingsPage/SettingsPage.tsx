import React, { useState, useEffect } from 'react';
import { useAppStore } from '../../stores/app.store';
import { DesktopAPI } from '../../../preload/desktop-api.types';

const desktop = (window as any).desktop as DesktopAPI;

interface SettingsPageProps {
  addToast: (text: string, type: 'success' | 'error' | 'info') => void;
}

export default function SettingsPage({ addToast }: SettingsPageProps) {
  const { settings, updateSettings, loadSettings, loadLatestBatch, loadBatches } = useAppStore();

  const [sellerHeader, setSellerHeader] = useState('');
  const [defaultOutputFolder, setDefaultOutputFolder] = useState('');
  const [barcodeWidth, setBarcodeWidth] = useState(140);
  const [barcodeHeight, setBarcodeHeight] = useState(35);
  const [defaultMarketplace, setDefaultMarketplace] = useState('Amazon');
  const [weightUnit, setWeightUnit] = useState('grams');
  const [retainWeight, setRetainWeight] = useState(false);

  useEffect(() => {
    if (settings) {
      setSellerHeader(settings.sellerHeader);
      setDefaultOutputFolder(settings.defaultOutputFolder);
      setBarcodeWidth(settings.barcodeWidth);
      setBarcodeHeight(settings.barcodeHeight);
      setDefaultMarketplace(settings.defaultMarketplace);
      setWeightUnit(settings.weightUnit);
      setRetainWeight(settings.retainWeight);
    }
  }, [settings]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sellerHeader.trim()) {
      addToast('Seller header name is required.', 'error');
      return;
    }

    try {
      await updateSettings({
        sellerHeader: sellerHeader.trim(),
        defaultOutputFolder,
        barcodeWidth,
        barcodeHeight,
        defaultMarketplace,
        weightUnit,
        retainWeight,
        pinCodeDbVersion: settings?.pinCodeDbVersion || '1.0.0 (Offline Seed)'
      });
      addToast('Settings saved successfully.', 'success');
    } catch (err: any) {
      addToast(`Failed to save settings: ${err.message}`, 'error');
    }
  };

  const handleBackup = async () => {
    try {
      const backupPath = await desktop.backupDatabase();
      addToast(`Database backed up to: ${backupPath}`, 'success');
    } catch (err: any) {
      addToast(`Backup failed: ${err.message}`, 'error');
    }
  };

  const handleRestore = async () => {
    if (confirm('WARNING: Restoring a database backup will overwrite your current data and shipments. Do you want to proceed?')) {
      try {
        const success = await desktop.restoreDatabase();
        if (success) {
          addToast('Database successfully restored from backup file.', 'success');
          // Reload stores to refresh UI with restored data
          await loadSettings();
          await loadLatestBatch();
          await loadBatches();
        } else {
          addToast('Restore operation canceled or failed.', 'info');
        }
      } catch (err: any) {
        addToast(`Restore failed: ${err.message}`, 'error');
      }
    }
  };

  return (
    <div>
      <h1>Settings</h1>
      <p className="page-subtitle">Configure invoice header print details, scanner preferences, and manual database backups.</p>

      <form onSubmit={handleSave} className="card" style={{ maxWidth: '640px' }}>
        <h3>General Settings</h3>
        <br />

        <div className="form-group">
          <label>Shop Name (Header printed on PDF) *</label>
          <input 
            type="text" 
            value={sellerHeader} 
            onChange={e => setSellerHeader(e.target.value)} 
            placeholder="e.g. GYAN POST (BOOKS)"
          />
        </div>

        <div className="form-group">
          <label>Default folder to save files</label>
          <input 
            type="text" 
            value={defaultOutputFolder} 
            onChange={e => setDefaultOutputFolder(e.target.value)} 
            placeholder="Folder path to save files"
          />
        </div>

        <div className="flex gap-16">
          <div className="form-group flex-1">
            <label>Barcode Width (px)</label>
            <input 
              type="number" 
              value={barcodeWidth} 
              onChange={e => setBarcodeWidth(parseInt(e.target.value) || 0)} 
            />
          </div>
          <div className="form-group flex-1">
            <label>Barcode Height (px)</label>
            <input 
              type="number" 
              value={barcodeHeight} 
              onChange={e => setBarcodeHeight(parseInt(e.target.value) || 0)} 
            />
          </div>
        </div>

        <div className="flex gap-16">
          <div className="form-group flex-1">
            <label>Marketplace</label>
            <select value={defaultMarketplace} onChange={e => setDefaultMarketplace(e.target.value)}>
              <option value="Amazon">Amazon</option>
            </select>
          </div>
          <div className="form-group flex-1">
            <label>Weight Unit</label>
            <select value={weightUnit} onChange={e => setWeightUnit(e.target.value)}>
              <option value="grams">Grams (g)</option>
            </select>
          </div>
        </div>

        <div className="form-group mt-12" style={{ flexDirection: 'row', alignItems: 'center' }}>
          <input 
            type="checkbox" 
            id="retain-weight"
            checked={retainWeight} 
            onChange={e => setRetainWeight(e.target.checked)} 
            style={{ transform: 'scale(1.2)', cursor: 'pointer', marginRight: '10px' }}
          />
          <label htmlFor="retain-weight" style={{ cursor: 'pointer', textTransform: 'none' }}>
            Keep previous weight value after saving a parcel (default is off)
          </label>
        </div>

        <div className="form-group mt-12" style={{ borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
          <label>PIN Code Directory Version</label>
          <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
            {settings?.pinCodeDbVersion || '1.0.0 (Offline Seed)'}
          </p>
        </div>

        <button type="submit" className="btn btn-primary w-full mt-24">
          💾 Save Settings
        </button>
      </form>

      {/* Backup and Restore Card */}
      <div className="card" style={{ maxWidth: '640px' }}>
        <h3>Database Backup & Restore</h3>
        <p className="text-secondary" style={{ fontSize: '0.85rem', marginTop: '4px', marginBottom: '16px' }}>
          Create a manual copy of your database, or restore details from a previous database file.
        </p>

        <div className="flex gap-16">
          <button className="btn btn-secondary flex-1" onClick={handleBackup}>
            📦 Backup Database
          </button>
          <button className="btn btn-secondary flex-1" onClick={handleRestore} style={{ borderColor: 'rgba(245, 158, 11, 0.3)', color: 'var(--color-warning)' }}>
            ⚠️ Restore Database
          </button>
        </div>
      </div>
    </div>
  );
}
