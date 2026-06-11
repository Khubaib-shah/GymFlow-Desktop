import React, { useState, useEffect } from 'react';

export default function Attendance() {
  const [logs, setLogs] = useState<any[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedMemberId, setSelectedMemberId] = useState('');
  const [memberSearch, setMemberSearch] = useState('');
  const [showMemberDropdown, setShowMemberDropdown] = useState(false);
  const [activeSession, setActiveSession] = useState<any>(null);
  const [errorMsg, setErrorMsg] = useState('');

  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilter, setDateFilter] = useState('today');
  const [customDate, setCustomDate] = useState('');

  const fetchLogs = async () => {
    setLoading(true);
    const data = await (window as any).api.attendance.getAll();
    setLogs(data);
    setLoading(false);
  };

  const fetchMembers = async () => {
    const data = await (window as any).api.members.getAll();
    setMembers(data);
  };

  useEffect(() => {
    fetchLogs();
    fetchMembers();
  }, []);

  useEffect(() => {
    if (selectedMemberId) {
      (window as any).api.attendance.getActiveSession(selectedMemberId).then(setActiveSession);
    } else {
      setActiveSession(null);
    }
  }, [selectedMemberId]);

  const handleSync = async () => {
    setSyncing(true);
    try {
      const ip = localStorage.getItem('zkteco_ip') || '192.168.1.201';
      const port = parseInt(localStorage.getItem('zkteco_port') || '4370');
      
      const result = await (window as any).api.attendance.syncDevice(ip, port);
      if (result.success) {
        alert(`Successfully synced ${result.count} new attendance records!`);
        fetchLogs();
      } else {
        alert(`Sync failed: ${result.error}`);
      }
    } catch (err: any) {
      alert(`Sync Error: ${err.message}`);
    } finally {
      setSyncing(false);
    }
  };

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMemberId) return;
    setErrorMsg('');
    
    try {
      await (window as any).api.attendance.manualEntry(selectedMemberId);
      setIsModalOpen(false);
      setSelectedMemberId('');
      setMemberSearch('');
      fetchLogs();
    } catch (err: any) {
      const msg = err.message || 'An error occurred';
      setErrorMsg(msg.replace(/Error invoking remote method '.*?': Error: /, ''));
    }
  };

  const filteredMembersForSearch = members.filter(m =>
    m.status === 'ACTIVE' && m.planId && (
      memberSearch === '' ||
      `${m.firstName} ${m.lastName || ''}`.toLowerCase().includes(memberSearch.toLowerCase()) ||
      (m.cnic && m.cnic.includes(memberSearch)) ||
      (m.phone && m.phone.includes(memberSearch))
    )
  );

  const filteredLogs = logs.filter(log => {
    // Search Filter
    const term = searchQuery.toLowerCase();
    const matchesSearch = !term || 
      log.member.firstName.toLowerCase().includes(term) ||
      log.member.lastName.toLowerCase().includes(term) ||
      (log.member.cnic && log.member.cnic.toLowerCase().includes(term));

    if (!matchesSearch) return false;

    // Date Filter
    const logDate = new Date(log.checkInTime);
    const today = new Date();
    today.setHours(0,0,0,0);
    
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (dateFilter === 'today') {
      return logDate >= today;
    } else if (dateFilter === 'yesterday') {
      return logDate >= yesterday && logDate < today;
    } else if (dateFilter === 'last7days') {
      const last7 = new Date(today);
      last7.setDate(last7.getDate() - 7);
      return logDate >= last7;
    } else if (dateFilter === 'thisMonth') {
      return logDate.getMonth() === today.getMonth() && logDate.getFullYear() === today.getFullYear();
    } else if (dateFilter === 'lastMonth') {
      const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      return logDate.getMonth() === lastMonth.getMonth() && logDate.getFullYear() === lastMonth.getFullYear();
    } else if (dateFilter === 'custom' && customDate) {
      const custom = new Date(customDate);
      return logDate.getDate() === custom.getDate() && 
             logDate.getMonth() === custom.getMonth() && 
             logDate.getFullYear() === custom.getFullYear();
    }

    return true; // fallback or "all"
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Attendance Log</h1>
          <p className="text-gray-400 mt-1">View recent check-ins and sync with ZKTeco biometric device.</p>
        </div>
        <div className="flex gap-3">
          <div className="relative">
            <svg className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input 
              type="text" 
              placeholder="Search member..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-[#0f1115] border border-[#2a2e37] text-white text-sm rounded-lg focus:ring-primary-500 focus:border-primary-500 block w-48 pl-10 p-2.5 transition-colors"
            />
          </div>
          
          <div className="flex gap-2 bg-[#0f1115] border border-[#2a2e37] rounded-lg overflow-hidden p-1">
            <select 
              className="bg-transparent text-white text-sm border-none focus:ring-0 cursor-pointer outline-none pl-2"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
            >
              <option value="today">Today</option>
              <option value="yesterday">Yesterday</option>
              <option value="last7days">Last 7 Days</option>
              <option value="thisMonth">This Month</option>
              <option value="lastMonth">Last Month</option>
              <option value="custom">Custom Date</option>
              <option value="all">All Time</option>
            </select>
            {dateFilter === 'custom' && (
              <input 
                type="date" 
                className="bg-transparent text-white text-sm border-l border-[#2a2e37] pl-2 outline-none"
                value={customDate}
                onChange={(e) => setCustomDate(e.target.value)}
              />
            )}
          </div>

          <button onClick={() => setIsModalOpen(true)} className="btn-secondary flex items-center gap-2">
            Manual Entry
          </button>
          <button 
            onClick={handleSync} 
            disabled={syncing}
            className={`btn-primary flex items-center gap-2 ${syncing ? 'opacity-70 cursor-wait' : ''}`}
          >
            {syncing ? (
              <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            )}
            {syncing ? 'Syncing...' : 'Sync Device'}
          </button>
        </div>
      </div>

      <div className="glass rounded-xl overflow-hidden border border-[#2a2e37]">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-300">
            <thead className="bg-[#1a1d24] text-xs uppercase text-gray-400 border-b border-[#2a2e37]">
              <tr>
                <th className="px-6 py-4 font-medium">Member</th>
                <th className="px-6 py-4 font-medium">Check-In</th>
                <th className="px-6 py-4 font-medium">Check-Out</th>
                <th className="px-6 py-4 font-medium">Method</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#2a2e37]">
              {loading ? (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-gray-500">Loading attendance...</td>
                </tr>
              ) : filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-gray-500">
                    {searchQuery ? 'No records match your search.' : 'No attendance records found for this period.'}
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-[#1a1d24]/50 transition-colors">
                    <td className="px-6 py-4 font-medium text-white">
                      {log.member.firstName} {log.member.lastName}
                    </td>
                    <td className="px-6 py-4">
                      {new Date(log.checkInTime).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 text-gray-400">
                      {log.checkOutTime ? new Date(log.checkOutTime).toLocaleString() : (
                        <span className="text-orange-400 font-medium animate-pulse">Active Session</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                        log.method === 'BIOMETRIC' 
                          ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                          : 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
                      }`}>
                        {log.method}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="glass w-full max-w-sm rounded-2xl p-6 border border-[#2a2e37] shadow-2xl relative">
            <h2 className="text-xl font-bold text-white mb-4">Manual Entry</h2>
            {errorMsg && (
              <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg text-sm">
                {errorMsg}
              </div>
            )}
            <form onSubmit={handleManualSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">Search Member</label>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Type name, CNIC or phone..."
                    className="input-field pr-8"
                    value={memberSearch}
                    onChange={e => {
                      setMemberSearch(e.target.value);
                      setSelectedMemberId('');
                      setShowMemberDropdown(true);
                    }}
                    onFocus={() => setShowMemberDropdown(true)}
                    autoComplete="off"
                  />
                  {memberSearch && (
                    <button type="button" onClick={() => { setMemberSearch(''); setSelectedMemberId(''); }} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                  )}
                  {showMemberDropdown && filteredMembersForSearch.length > 0 && (
                    <div className="absolute z-10 w-full mt-1 bg-[#1a1d24] border border-[#2a2e37] rounded-lg shadow-xl max-h-48 overflow-y-auto">
                      {filteredMembersForSearch.map(m => (
                        <button
                          key={m.id}
                          type="button"
                          className={`w-full text-left px-3 py-2.5 text-sm hover:bg-[#2a2e37] transition-colors flex items-center gap-2 ${
                            selectedMemberId === m.id ? 'bg-primary-600/10 text-primary-400' : 'text-gray-300'
                          }`}
                          onClick={() => {
                            setSelectedMemberId(m.id);
                            setMemberSearch(`${m.firstName} ${m.lastName}`);
                            setShowMemberDropdown(false);
                          }}
                        >
                          <div className="w-6 h-6 rounded-full bg-primary-600/20 text-primary-500 flex items-center justify-center text-xs font-bold flex-shrink-0">
                            {m.firstName[0]}{m.lastName ? m.lastName[0] : ''}
                          </div>
                          <div>
                            <div className="font-medium">{m.firstName} {m.lastName || ''}</div>
                            <div className="text-xs text-gray-500">{m.phone || m.cnic || 'No contact'}</div>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {selectedMemberId && (
                  <p className="text-xs text-green-400 mt-1 flex items-center gap-1">
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/></svg>
                    Member selected
                  </p>
                )}
              </div>
              
              <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-[#2a2e37]">
                <button type="button" onClick={() => setIsModalOpen(false)} className="btn-secondary">Cancel</button>
                <button 
                  type="submit" 
                  className={`btn-primary ${activeSession ? 'bg-orange-600 hover:bg-orange-500 border-orange-500 shadow-orange-500/20' : ''}`} 
                  disabled={!selectedMemberId}
                >
                  {activeSession ? 'Check Out' : 'Check In'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
