import React, { useState, useEffect } from 'react';
import { useDialog } from '../components/DialogProvider';
import { Pagination } from '../components/Pagination';

// ──────────────────────────────────────────────────────────
// Helper: shared date filtering
// ──────────────────────────────────────────────────────────
function filterByDate(dateString: string, dateFilter: string, customDate: string): boolean {
  if (dateFilter === 'all') return true;
  const d = new Date(dateString);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (dateFilter === 'today') return d >= today;
  if (dateFilter === 'yesterday') return d >= yesterday && d < today;
  if (dateFilter === 'last7days') {
    const last7 = new Date(today); last7.setDate(last7.getDate() - 7);
    return d >= last7;
  }
  if (dateFilter === 'thisMonth') return d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear();
  if (dateFilter === 'lastMonth') {
    const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    return d.getMonth() === lastMonth.getMonth() && d.getFullYear() === lastMonth.getFullYear();
  }
  if (dateFilter === 'custom' && customDate) {
    const custom = new Date(customDate);
    return d.getDate() === custom.getDate() && d.getMonth() === custom.getMonth() && d.getFullYear() === custom.getFullYear();
  }
  return true;
}

// ──────────────────────────────────────────────────────────
// Member Attendance Tab
// ──────────────────────────────────────────────────────────
function MemberAttendanceTab() {
  const { showAlert, showConfirm } = useDialog();
  const [logs, setLogs] = useState<any[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedMemberId, setSelectedMemberId] = useState('');
  const [memberSearch, setMemberSearch] = useState('');
  const [showMemberDropdown, setShowMemberDropdown] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilter, setDateFilter] = useState('today');
  const [customDate, setCustomDate] = useState('');

  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 50;

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, dateFilter, customDate]);

  const fetchLogs = async () => {
    setLoading(true);
    const data = await (window as any).api.attendance.getAll();
    setLogs(data);
    setLoading(false);
  };

  useEffect(() => {
    fetchLogs();
    (window as any).api.members.getAll().then(setMembers);

    const api = (window as any).api;
    let cleanupListeners: (() => void) | undefined;
    if (api?.device?.onAttendanceEvent) {
      cleanupListeners = api.device.onAttendanceEvent(async (type: string, data: any) => {
        // Only refresh on attendance events (checkin only)
        if (type === 'checkin') {
          fetchLogs();
        } else if (type === 'ignored') {
          // Show toast notification for 4-hour rule
          const name = data?.member?.firstName || data?.trainer?.firstName || 'User';
          await showAlert(`${name} already checked in recently (4-hour rule).`);
        }
      });
    }

    return () => {
      if (cleanupListeners) cleanupListeners();
    };
  }, []);

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
      (m.phone && m.phone.includes(memberSearch)) ||
      (m.email && m.email.toLowerCase().includes(memberSearch.toLowerCase())) ||
      (m.id && m.id.toLowerCase().includes(memberSearch.toLowerCase())) ||
      (m.employeeNo != null && m.employeeNo.toString().toLowerCase().includes(memberSearch.toLowerCase())) ||
      (m.biometricId && m.biometricId.toLowerCase().includes(memberSearch.toLowerCase()))
    )
  );

  const filteredLogs = logs.filter(log => {
    const term = searchQuery.toLowerCase();
    const matchesSearch = !term ||
      log.member.firstName.toLowerCase().includes(term) ||
      (log.member.lastName && log.member.lastName.toLowerCase().includes(term)) ||
      ((log.member.firstName + " " + (log.member.lastName || "")).toLowerCase().includes(term)) ||
      (log.member.cnic && log.member.cnic.toLowerCase().includes(term)) ||
      (log.member.phone && log.member.phone.toLowerCase().includes(term)) ||
      (log.member.email && log.member.email.toLowerCase().includes(term)) ||
      (log.member.id && log.member.id.toLowerCase().includes(term)) ||
      (log.member.employeeNo != null && log.member.employeeNo.toString().toLowerCase().includes(term)) ||
      (log.member.biometricId && log.member.biometricId.toLowerCase().includes(term));
    return matchesSearch && filterByDate(log.checkInTime, dateFilter, customDate);
  });

  return (
    <>
      <div className="flex gap-3 items-center flex-wrap">
        {/* Search */}
        <div className="relative">
          <svg className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input type="text" placeholder="Search member..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
            className="bg-[#0f1115] border border-[#2a2e37] text-white text-sm rounded-lg block w-48 pl-10 p-2.5 transition-colors" />
        </div>

        {/* Date filter */}
        <div className="flex gap-2 bg-[#0f1115] border border-[#2a2e37] rounded-lg overflow-hidden p-1">
          <select className="bg-transparent text-white text-sm border-none focus:ring-0 cursor-pointer outline-none pl-2"
            value={dateFilter} onChange={e => setDateFilter(e.target.value)}>
            <option value="today">Today</option>
            <option value="yesterday">Yesterday</option>
            <option value="last7days">Last 7 Days</option>
            <option value="thisMonth">This Month</option>
            <option value="lastMonth">Last Month</option>
            <option value="custom">Custom Date</option>
            <option value="all">All Time</option>
          </select>
          {dateFilter === 'custom' && (
            <input type="date" className="bg-transparent text-white text-sm border-l border-[#2a2e37] pl-2 outline-none"
              value={customDate} onChange={e => setCustomDate(e.target.value)} />
          )}
        </div>

        <button onClick={() => setIsModalOpen(true)} className="btn-secondary flex items-center gap-2">Manual Entry</button>
      </div>

      <div className="glass rounded-xl overflow-hidden border border-[#2a2e37]">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-300">
            <thead className="bg-[#1a1d24] text-xs uppercase text-gray-400 border-b border-[#2a2e37]">
              <tr>
                <th className="px-6 py-4 font-medium">Member</th>
                <th className="px-6 py-4 font-medium">Check-In Time</th>
                <th className="px-6 py-4 font-medium">Date</th>
                <th className="px-6 py-4 font-medium">Method</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#2a2e37]">
              {loading ? (
                <tr><td colSpan={4} className="px-6 py-8 text-center text-gray-500">Loading attendance...</td></tr>
              ) : filteredLogs.length === 0 ? (
                <tr><td colSpan={4} className="px-6 py-8 text-center text-gray-500">
                  {searchQuery ? 'No records match your search.' : 'No attendance records found for this period.'}
                </td></tr>
              ) : (
                filteredLogs
                  .slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE)
                  .map(log => {
                    const checkInDate = new Date(log.checkInTime);
                    return (
                      <tr key={log.id} className="hover:bg-[#1a1d24]/50 transition-colors">
                        <td className="px-6 py-4 font-medium text-white">{log.member.firstName} {log.member.lastName}</td>
                        <td className="px-6 py-4">{checkInDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}</td>
                        <td className="px-6 py-4 text-gray-400">{checkInDate.toLocaleDateString('en-US')}</td>
                        <td className="px-6 py-4">
                          <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${log.method === 'BIOMETRIC' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' : 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
                            }`}>{log.method}</span>
                        </td>
                      </tr>
                    );
                  })
              )}
            </tbody>
          </table>
          <Pagination
            currentPage={currentPage}
            totalItems={filteredLogs.length}
            itemsPerPage={ITEMS_PER_PAGE}
            onPageChange={setCurrentPage}
          />
        </div>
      </div>

      {/* Manual Entry Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="glass w-full max-w-sm rounded-2xl p-6 border border-[#2a2e37] shadow-2xl">
            <h2 className="text-xl font-bold text-white mb-4">Manual Check-In — Member</h2>
            {errorMsg && <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg text-sm">{errorMsg}</div>}
            <form onSubmit={handleManualSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">Search Member</label>
                <div className="relative">
                  <input type="text" placeholder="Type name, CNIC or phone..." className="input-field pr-8"
                    value={memberSearch}
                    onChange={e => { setMemberSearch(e.target.value); setSelectedMemberId(''); setShowMemberDropdown(true); }}
                    onFocus={() => setShowMemberDropdown(true)} autoComplete="off" />
                  {memberSearch && (
                    <button type="button" onClick={() => { setMemberSearch(''); setSelectedMemberId(''); }}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                  )}
                  {showMemberDropdown && filteredMembersForSearch.length > 0 && (
                    <div className="absolute z-10 w-full mt-1 bg-[#1a1d24] border border-[#2a2e37] rounded-lg shadow-xl max-h-48 overflow-y-auto">
                      {filteredMembersForSearch.map(m => (
                        <button key={m.id} type="button"
                          className={`w-full text-left px-3 py-2.5 text-sm hover:bg-[#2a2e37] transition-colors flex items-center gap-2 ${selectedMemberId === m.id ? 'bg-primary-600/10 text-primary-400' : 'text-gray-300'}`}
                          onClick={() => { setSelectedMemberId(m.id); setMemberSearch(`${m.firstName} ${m.lastName}`); setShowMemberDropdown(false); }}>
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
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
                    Member selected
                  </p>
                )}
              </div>
              <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-[#2a2e37]">
                <button type="button" onClick={() => setIsModalOpen(false)} className="btn-secondary">Cancel</button>
                <button type="submit"
                  className="btn-primary"
                  disabled={!selectedMemberId}>
                  Check In
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

// ──────────────────────────────────────────────────────────
// Trainer Attendance Tab
// ──────────────────────────────────────────────────────────
function TrainerAttendanceTab() {

  const { showAlert, showConfirm } = useDialog();
  const [logs, setLogs] = useState<any[]>([]);
  const [trainers, setTrainers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedTrainerId, setSelectedTrainerId] = useState('');
  const [trainerSearch, setTrainerSearch] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilter, setDateFilter] = useState('today');
  const [customDate, setCustomDate] = useState('');

  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 50;

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, dateFilter, customDate]);

  const fetchLogs = async () => {
    setLoading(true);
    const data = await (window as any).api.trainerAttendance.getAll();
    setLogs(data);
    setLoading(false);
  };

  useEffect(() => {
    fetchLogs();
    (window as any).api.trainers.getAll().then(setTrainers);

    const api = (window as any).api;
    let cleanupListeners: (() => void) | undefined;
    if (api?.device?.onAttendanceEvent) {
      cleanupListeners = api.device.onAttendanceEvent((type: string) => {
        if (type === 'trainerCheckin') {
          fetchLogs();
        }
      });
    }

    return () => {
      if (cleanupListeners) cleanupListeners();
    };
  }, []);

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTrainerId) return;
    setErrorMsg('');
    try {
      await (window as any).api.trainerAttendance.manualEntry(selectedTrainerId);
      setIsModalOpen(false);
      setSelectedTrainerId('');
      setTrainerSearch('');
      fetchLogs();
    } catch (err: any) {
      const msg = err.message || 'An error occurred';
      setErrorMsg(msg.replace(/Error invoking remote method '.*?': Error: /, ''));
    }
  };

  const filteredTrainersForSearch = trainers.filter(t =>
    trainerSearch === '' ||
    `${t.firstName} ${t.lastName || ''}`.toLowerCase().includes(trainerSearch.toLowerCase()) ||
    (t.phone && t.phone.includes(trainerSearch)) ||
    (t.cnic && t.cnic.includes(trainerSearch)) ||
    (t.id && t.id.toLowerCase().includes(trainerSearch.toLowerCase())) ||
    (t.employeeNo != null && t.employeeNo.toString().toLowerCase().includes(trainerSearch.toLowerCase()))
  );

  const filteredLogs = logs.filter(log => {
    const term = searchQuery.toLowerCase();
    const matchesSearch = !term ||
      log.trainer.firstName.toLowerCase().includes(term) ||
      (log.trainer.lastName && log.trainer.lastName.toLowerCase().includes(term)) ||
      ((log.trainer.firstName + " " + (log.trainer.lastName || "")).toLowerCase().includes(term)) ||
      (log.trainer.cnic && log.trainer.cnic.toLowerCase().includes(term)) ||
      (log.trainer.phone && log.trainer.phone.toLowerCase().includes(term)) ||
      (log.trainer.id && log.trainer.id.toLowerCase().includes(term)) ||
      (log.trainer.employeeNo != null && log.trainer.employeeNo.toString().toLowerCase().includes(term));
    return matchesSearch && filterByDate(log.checkInTime, dateFilter, customDate);
  });

  return (
    <>
      <div className="flex gap-3 items-center flex-wrap">
        <div className="relative">
          <svg className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input type="text" placeholder="Search trainer..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
            className="bg-[#0f1115] border border-[#2a2e37] text-white text-sm rounded-lg block w-48 pl-10 p-2.5 transition-colors" />
        </div>

        <div className="flex gap-2 bg-[#0f1115] border border-[#2a2e37] rounded-lg overflow-hidden p-1">
          <select className="bg-transparent text-white text-sm border-none focus:ring-0 cursor-pointer outline-none pl-2"
            value={dateFilter} onChange={e => setDateFilter(e.target.value)}>
            <option value="today">Today</option>
            <option value="yesterday">Yesterday</option>
            <option value="last7days">Last 7 Days</option>
            <option value="thisMonth">This Month</option>
            <option value="lastMonth">Last Month</option>
            <option value="custom">Custom Date</option>
            <option value="all">All Time</option>
          </select>
          {dateFilter === 'custom' && (
            <input type="date" className="bg-transparent text-white text-sm border-l border-[#2a2e37] pl-2 outline-none"
              value={customDate} onChange={e => setCustomDate(e.target.value)} />
          )}
        </div>

        <button onClick={() => setIsModalOpen(true)} className="btn-secondary flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Log Trainer
        </button>
      </div>

      <div className="glass rounded-xl overflow-hidden border border-[#2a2e37]">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-300">
            <thead className="bg-[#1a1d24] text-xs uppercase text-gray-400 border-b border-[#2a2e37]">
              <tr>
                <th className="px-6 py-4 font-medium">Trainer</th>
                <th className="px-6 py-4 font-medium">Specialty</th>
                <th className="px-6 py-4 font-medium">Check-In Time</th>
                <th className="px-6 py-4 font-medium">Date</th>
                <th className="px-6 py-4 font-medium">Method</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#2a2e37]">
              {loading ? (
                <tr><td colSpan={5} className="px-6 py-8 text-center text-gray-500">Loading trainer logs...</td></tr>
              ) : filteredLogs.length === 0 ? (
                <tr><td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                  {searchQuery ? 'No records match your search.' : 'No trainer attendance records found for this period.'}
                </td></tr>
              ) : (
                filteredLogs
                  .slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE)
                  .map(log => {
                    const checkInDate = new Date(log.checkInTime);
                    return (
                      <tr key={log.id} className="hover:bg-[#1a1d24]/50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold text-sm">
                              {log.trainer.firstName[0]}{log.trainer.lastName ? log.trainer.lastName[0] : ''}
                            </div>
                            <span className="font-medium text-white">{log.trainer.firstName} {log.trainer.lastName || ''}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-gray-400">{log.trainer.specialty || '—'}</td>
                        <td className="px-6 py-4">{checkInDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}</td>
                        <td className="px-6 py-4 text-gray-400">{checkInDate.toLocaleDateString('en-US')}</td>
                        <td className="px-6 py-4">
                          <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${log.method === 'BIOMETRIC' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' : 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
                            }`}>{log.method}</span>
                        </td>
                      </tr>
                    );
                  })
              )}
            </tbody>
          </table>
          <Pagination
            currentPage={currentPage}
            totalItems={filteredLogs.length}
            itemsPerPage={ITEMS_PER_PAGE}
            onPageChange={setCurrentPage}
          />
        </div>
      </div>

      {/* Log Trainer Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="glass w-full max-w-sm rounded-2xl p-6 border border-[#2a2e37] shadow-2xl">
            <h2 className="text-xl font-bold text-white mb-4">Trainer Check-In</h2>
            {errorMsg && <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg text-sm">{errorMsg}</div>}
            <form onSubmit={handleManualSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">Search Trainer</label>
                <div className="relative">
                  <input type="text" placeholder="Type trainer name or phone..." className="input-field pr-8"
                    value={trainerSearch}
                    onChange={e => { setTrainerSearch(e.target.value); setSelectedTrainerId(''); setShowDropdown(true); }}
                    onFocus={() => setShowDropdown(true)} autoComplete="off" />
                  {trainerSearch && (
                    <button type="button" onClick={() => { setTrainerSearch(''); setSelectedTrainerId(''); }}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                  )}
                  {showDropdown && filteredTrainersForSearch.length > 0 && (
                    <div className="absolute z-10 w-full mt-1 bg-[#1a1d24] border border-[#2a2e37] rounded-lg shadow-xl max-h-48 overflow-y-auto">
                      {filteredTrainersForSearch.map(t => (
                        <button key={t.id} type="button"
                          className={`w-full text-left px-3 py-2.5 text-sm hover:bg-[#2a2e37] transition-colors flex items-center gap-2 ${selectedTrainerId === t.id ? 'bg-amber-500/10 text-amber-400' : 'text-gray-300'}`}
                          onClick={() => { setSelectedTrainerId(t.id); setTrainerSearch(`${t.firstName} ${t.lastName || ''}`); setShowDropdown(false); }}>
                          <div className="w-6 h-6 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center text-xs font-bold flex-shrink-0">
                            {t.firstName[0]}{t.lastName ? t.lastName[0] : ''}
                          </div>
                          <div>
                            <div className="font-medium">{t.firstName} {t.lastName || ''}</div>
                            <div className="text-xs text-gray-500">{t.specialty || t.phone || 'Trainer'}</div>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {selectedTrainerId && (
                  <p className="text-xs text-green-400 mt-1 flex items-center gap-1">
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
                    Trainer selected
                  </p>
                )}
              </div>
              <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-[#2a2e37]">
                <button type="button" onClick={() => setIsModalOpen(false)} className="btn-secondary">Cancel</button>
                <button type="submit"
                  className="btn-primary bg-amber-600 hover:bg-amber-500 border-amber-500 shadow-amber-500/20"
                  disabled={!selectedTrainerId}>
                  Check In
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

// ──────────────────────────────────────────────────────────
// Main Attendance Page - Check-In Only
// ──────────────────────────────────────────────────────────
export default function Attendance() {
  const { showAlert, showConfirm } = useDialog();
  const [activeTab, setActiveTab] = useState<'members' | 'trainers'>('members');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Attendance Log</h1>
          <p className="text-gray-400 mt-1">Track member and trainer check-ins.</p>
        </div>
        {/* Tab Toggle */}
        <div className="flex bg-[#0f1115] border border-[#2a2e37] rounded-xl p-1 gap-1">
          <button
            onClick={() => setActiveTab('members')}
            className={`px-5 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'members'
              ? 'bg-primary-600 text-white shadow-lg shadow-primary-600/30'
              : 'text-gray-400 hover:text-white'
              }`}
          >
            <span className="flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Members
            </span>
          </button>
          <button
            onClick={() => setActiveTab('trainers')}
            className={`px-5 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'trainers'
              ? 'bg-amber-600 text-white shadow-lg shadow-amber-600/30'
              : 'text-gray-400 hover:text-white'
              }`}
          >
            <span className="flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138.3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
              </svg>
              Trainers
            </span>
          </button>
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === 'members' ? <MemberAttendanceTab /> : <TrainerAttendanceTab />}
    </div>
  );
}