import React, { useState, useEffect } from 'react';

export default function Settings() {
  const [zkIp, setZkIp] = useState('192.168.1.201');
  const [zkPort, setZkPort] = useState('4370');
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetting, setResetting] = useState(false);
  
  useEffect(() => {
    setZkIp(localStorage.getItem('zkteco_ip') || '192.168.1.201');
    setZkPort(localStorage.getItem('zkteco_port') || '4370');
  }, []);

  const saveSettings = () => {
    localStorage.setItem('zkteco_ip', zkIp);
    localStorage.setItem('zkteco_port', zkPort);
    alert('Settings saved locally.');
  };

  const handleBackup = async () => {
    const res = await (window as any).api.system.backupDb();
    if (res.success) {
      alert(`Database successfully backed up to:\n${res.filePath}`);
    } else {
      if (res.error !== 'User canceled') alert(`Backup failed: ${res.error}`);
    }
  };

  const handleRestore = async () => {
    if (confirm('Warning: Restoring will overwrite the current database and restart the application. Continue?')) {
      const res = await (window as any).api.system.restoreDb();
      if (!res.success && res.error !== 'User canceled') {
        alert(`Restore failed: ${res.error}`);
      }
    }
  };

  const handleReset = async () => {
    setResetting(true);
    try {
      const res = await (window as any).api.system.resetDb();
      if (res.success) {
        setShowResetModal(false);
        window.location.reload();
      } else {
        alert(`Reset failed: ${res.error}`);
      }
    } catch (err: any) {
      alert(`Reset failed: ${err.message}`);
    } finally {
      setResetting(false);
    }
  };

  return (
    <div className="max-w-4xl space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-white tracking-tight">Settings</h1>
        <p className="text-gray-400 mt-1">Configure local hardware and system preferences.</p>
      </div>

      <div className="glass rounded-xl p-6 border border-[#2a2e37]">
        <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
          <svg className="w-5 h-5 text-primary-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 11c0 3.517-1.009 6.799-2.753 9.571m-3.44-2.04l.054-.09A13.916 13.916 0 008 11a4 4 0 118 0c0 1.017-.07 2.019-.203 3m-2.118 6.844A21.88 21.88 0 0015.171 17m3.839 1.132c.645-2.266.99-4.659.99-7.132A8 8 0 008 4.07M3 15.364c.64-1.319 1-2.8 1-4.364 0-1.457.39-2.823 1.07-4" />
          </svg>
          ZKTeco Device Configuration
        </h2>
        
        <div className="grid grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1.5">Device IP Address</label>
            <input type="text" value={zkIp} onChange={e => setZkIp(e.target.value)} className="input-field" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1.5">Port</label>
            <input type="text" value={zkPort} onChange={e => setZkPort(e.target.value)} className="input-field" />
          </div>
        </div>
        
        <button onClick={saveSettings} className="btn-primary mt-6">Save Device Settings</button>
      </div>

      <div className="glass rounded-xl p-6 border border-[#2a2e37]">
        <h2 className="text-xl font-bold text-white mb-1 flex items-center gap-2">
          <svg className="w-5 h-5 text-primary-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
          </svg>
          Database Management
        </h2>
        <p className="text-sm text-gray-500 mb-5">Backup, restore from a file, or wipe all data.</p>
        
        <div className="flex gap-4">
          <button onClick={handleBackup} className="btn-secondary flex-1 flex items-center justify-center gap-2">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
            </svg>
            Backup Database
          </button>
          
          <button onClick={handleRestore} className="btn-secondary flex-1 flex items-center justify-center gap-2 text-yellow-400 hover:text-yellow-300">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
            </svg>
            Restore from File
          </button>

          <button
            onClick={() => setShowResetModal(true)}
            className="btn-secondary flex-1 flex items-center justify-center gap-2 text-red-400 hover:text-red-300 hover:bg-red-500/10 border-red-500/20"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            Reset All Data
          </button>
        </div>
      </div>

      {showResetModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="glass w-full max-w-md rounded-2xl p-6 border border-red-500/30 shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Reset All Data</h3>
                <p className="text-sm text-gray-400">This action cannot be undone.</p>
              </div>
            </div>
            <p className="text-gray-300 text-sm mb-6">
              This will permanently delete <strong className="text-white">all members, trainers, plans, attendance records, and payments</strong>. The app will reload automatically after the reset.
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setShowResetModal(false)}
                className="btn-secondary flex-1"
                disabled={resetting}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleReset}
                disabled={resetting}
                className="flex-1 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {resetting ? (
                  <>
                    <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                    </svg>
                    Resetting...
                  </>
                ) : 'Yes, Reset Everything'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
