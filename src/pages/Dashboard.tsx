import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

export default function Dashboard() {
  const [members, setMembers] = useState<any[]>([]);
  const [trainers, setTrainers] = useState<any[]>([]);
  const [plans, setPlans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [renewModalOpen, setRenewModalOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState<any>(null);
  const [selectedPlanId, setSelectedPlanId] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('CASH');

  const [dateFilter, setDateFilter] = useState('all');
  const [customDate, setCustomDate] = useState('');

  const fetchData = async () => {
    setLoading(true);
    const m = await (window as any).api.members.getAll();
    const t = await (window as any).api.trainers.getAll();
    const p = await (window as any).api.plans.getAll();
    setMembers(m);
    setTrainers(t);
    setPlans(p);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Date Filtering Logic
  const filteredMembers = members.filter(m => {
    if (dateFilter === 'all') return true;

    const mDate = new Date(m.createdAt);
    const today = new Date();
    today.setHours(0,0,0,0);
    
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (dateFilter === 'today') {
      return mDate >= today;
    } else if (dateFilter === 'yesterday') {
      return mDate >= yesterday && mDate < today;
    } else if (dateFilter === 'last7days') {
      const last7 = new Date(today);
      last7.setDate(last7.getDate() - 7);
      return mDate >= last7;
    } else if (dateFilter === 'thisMonth') {
      return mDate.getMonth() === today.getMonth() && mDate.getFullYear() === today.getFullYear();
    } else if (dateFilter === 'lastMonth') {
      const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      return mDate.getMonth() === lastMonth.getMonth() && mDate.getFullYear() === lastMonth.getFullYear();
    } else if (dateFilter === 'custom' && customDate) {
      const custom = new Date(customDate);
      return mDate.getDate() === custom.getDate() && 
             mDate.getMonth() === custom.getMonth() && 
             mDate.getFullYear() === custom.getFullYear();
    }
    return true;
  });

  // Stats
  const activeMembers = filteredMembers.filter(m => m.status === 'ACTIVE').length;
  
  // Alert Members (Expiring in <= 3 days, or already expired)
  const todayDate = new Date();
  todayDate.setHours(0, 0, 0, 0);
  
  const threeDaysFromNow = new Date(todayDate);
  threeDaysFromNow.setDate(todayDate.getDate() + 3);

  const alertMembers = filteredMembers.filter(m => {
    if (!m.membershipEnd) return true; // No membership end date = needs attention
    const endDate = new Date(m.membershipEnd);
    return endDate <= threeDaysFromNow;
  }).sort((a, b) => {
    const dateA = a.membershipEnd ? new Date(a.membershipEnd).getTime() : 0;
    const dateB = b.membershipEnd ? new Date(b.membershipEnd).getTime() : 0;
    return dateA - dateB;
  });

  // Recent Members
  const recentMembers = [...filteredMembers].sort((a, b) => 
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  ).slice(0, 5);

  // Chart Data
  const membersByPlan = plans.map(p => ({
    name: p.name,
    count: filteredMembers.filter(m => m.planId === p.id).length
  }));

  const handleRenew = (member: any) => {
    setSelectedMember(member);
    setSelectedPlanId(member.planId || (plans.length > 0 ? plans[0].id : ''));
    setRenewModalOpen(true);
  };

  const submitRenew = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMember || !selectedPlanId) return;

    const plan = plans.find(p => p.id === selectedPlanId);
    if (!plan) return;

    let newStartDate = new Date();
    if (selectedMember.membershipEnd) {
      const currentEnd = new Date(selectedMember.membershipEnd);
      if (currentEnd > new Date()) {
        newStartDate = currentEnd;
      }
    }

    const newEndDate = new Date(newStartDate);
    newEndDate.setDate(newEndDate.getDate() + plan.durationDays);

    await (window as any).api.members.update(selectedMember.id, {
      planId: selectedPlanId,
      membershipStart: selectedMember.membershipEnd && new Date(selectedMember.membershipEnd) > new Date() ? selectedMember.membershipStart : new Date().toISOString(), // Keep old start if active, otherwise reset
      membershipEnd: newEndDate.toISOString(),
      status: 'ACTIVE'
    });

    // Record Payment
    await (window as any).api.payments.create({
      memberId: selectedMember.id,
      planId: selectedPlanId,
      amount: plan.price,
      method: paymentMethod,
      notes: 'Subscription Renewal'
    });

    setRenewModalOpen(false);
    fetchData();
  };

  if (loading) {
    return <div className="text-gray-500 py-10 text-center">Loading dashboard...</div>;
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Dashboard</h1>
          <p className="text-gray-400 mt-1">Overview of your gym's current status.</p>
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
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="glass p-6 rounded-xl border border-[#2a2e37] shadow-lg relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <svg className="w-16 h-16 text-primary-500" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z"/></svg>
          </div>
          <p className="text-sm font-medium text-gray-400">Members ({dateFilter === 'all' ? 'Total' : 'Joined'})</p>
          <h3 className="text-3xl font-bold text-white mt-2">{filteredMembers.length}</h3>
        </div>
        
        <div className="glass p-6 rounded-xl border border-[#2a2e37] shadow-lg relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <svg className="w-16 h-16 text-green-500" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>
          </div>
          <p className="text-sm font-medium text-gray-400">Active Members</p>
          <h3 className="text-3xl font-bold text-white mt-2">{activeMembers}</h3>
        </div>

        <div className="glass p-6 rounded-xl border border-[#2a2e37] shadow-lg relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <svg className="w-16 h-16 text-orange-500" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>
          </div>
          <p className="text-sm font-medium text-gray-400">Needs Attention</p>
          <h3 className="text-3xl font-bold text-white mt-2">{alertMembers.length}</h3>
        </div>

        <div className="glass p-6 rounded-xl border border-[#2a2e37] shadow-lg relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <svg className="w-16 h-16 text-purple-500" fill="currentColor" viewBox="0 0 24 24"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>
          </div>
          <p className="text-sm font-medium text-gray-400">Total Trainers</p>
          <h3 className="text-3xl font-bold text-white mt-2">{trainers.length}</h3>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Alerts Table */}
        <div className="lg:col-span-2 glass rounded-xl border border-[#2a2e37] shadow-lg overflow-hidden flex flex-col h-[400px]">
          <div className="p-4 border-b border-[#2a2e37] flex justify-between items-center bg-[#1a1d24]/50">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <svg className="w-5 h-5 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
              Alert Members
            </h2>
            <span className="text-xs bg-orange-500/20 text-orange-400 px-2 py-1 rounded-full font-medium">Expiring Soon / Expired</span>
          </div>
          <div className="flex-1 overflow-auto">
            {alertMembers.length === 0 ? (
              <div className="flex items-center justify-center h-full text-gray-500 text-sm">No members need attention!</div>
            ) : (
              <table className="w-full text-left text-sm text-gray-300">
                <thead className="bg-[#1a1d24] text-xs uppercase text-gray-400 sticky top-0 z-10">
                  <tr>
                    <th className="px-4 py-3 font-medium">Name</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium">Expires</th>
                    <th className="px-4 py-3 font-medium text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#2a2e37]">
                  {alertMembers.map(member => {
                    const isExpired = member.membershipEnd && new Date(member.membershipEnd) < todayDate;
                    return (
                      <tr key={member.id} className="hover:bg-[#1a1d24]/50 transition-colors">
                        <td className="px-4 py-3 font-medium text-white">{member.firstName} {member.lastName}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${isExpired ? 'bg-red-500/20 text-red-400' : 'bg-orange-500/20 text-orange-400'}`}>
                            {isExpired ? 'Expired' : 'Expiring'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-400">
                          {member.membershipEnd ? new Date(member.membershipEnd).toLocaleDateString() : 'N/A'}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button onClick={() => handleRenew(member)} className="text-xs bg-primary-600 hover:bg-primary-500 text-white px-3 py-1.5 rounded transition-colors shadow-lg shadow-primary-600/20">
                            Renew
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Chart */}
        <div className="glass rounded-xl border border-[#2a2e37] shadow-lg flex flex-col h-[400px]">
          <div className="p-4 border-b border-[#2a2e37] bg-[#1a1d24]/50">
            <h2 className="text-lg font-bold text-white">Members by Plan</h2>
          </div>
          <div className="flex-1 p-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={membersByPlan}>
                <XAxis dataKey="name" stroke="#9ca3af" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#9ca3af" fontSize={12} tickLine={false} axisLine={false} width={30} />
                <Tooltip cursor={{fill: '#2a2e37'}} contentStyle={{backgroundColor: '#13151a', borderColor: '#2a2e37', borderRadius: '8px', color: '#fff'}} itemStyle={{color: '#e5e7eb'}} />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {membersByPlan.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={['#6366f1', '#a855f7', '#ec4899', '#14b8a6'][index % 4]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
      
      {/* Recent Members */}
      <div className="glass rounded-xl border border-[#2a2e37] shadow-lg overflow-hidden flex flex-col">
          <div className="p-4 border-b border-[#2a2e37] flex justify-between items-center bg-[#1a1d24]/50">
            <h2 className="text-lg font-bold text-white">Recently Joined</h2>
          </div>
          <div className="flex-1 overflow-auto">
            {recentMembers.length === 0 ? (
              <div className="flex items-center justify-center py-8 text-gray-500 text-sm">No members yet.</div>
            ) : (
              <table className="w-full text-left text-sm text-gray-300">
                <thead className="bg-[#1a1d24] text-xs uppercase text-gray-400">
                  <tr>
                    <th className="px-4 py-3 font-medium">Name</th>
                    <th className="px-4 py-3 font-medium">Joined On</th>
                    <th className="px-4 py-3 font-medium">Plan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#2a2e37]">
                  {recentMembers.map(member => (
                    <tr key={member.id} className="hover:bg-[#1a1d24]/50 transition-colors">
                      <td className="px-4 py-3 font-medium text-white">{member.firstName} {member.lastName}</td>
                      <td className="px-4 py-3 text-gray-400">
                        {new Date(member.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 rounded text-xs font-medium bg-[#2a2e37] text-gray-300">
                          {member.plan?.name || 'N/A'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
      </div>

      {/* Renew Modal */}
      {renewModalOpen && selectedMember && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="glass w-full max-w-sm rounded-2xl p-6 border border-[#2a2e37] shadow-2xl relative animate-in zoom-in-95 duration-200">
            <h2 className="text-xl font-bold text-white mb-1">Renew Subscription</h2>
            <p className="text-sm text-gray-400 mb-4">Extend membership for {selectedMember.firstName}.</p>
            
            <form onSubmit={submitRenew} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">Select New Plan</label>
                <select 
                  required 
                  className="input-field" 
                  value={selectedPlanId} 
                  onChange={e => setSelectedPlanId(e.target.value)}
                >
                  <option value="" disabled>Select a plan...</option>
                  {plans.map(p => (
                    <option key={p.id} value={p.id}>{p.name} ({p.durationDays} Days - Rs {p.price})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">Payment Method</label>
                <select 
                  className="input-field" 
                  value={paymentMethod} 
                  onChange={e => setPaymentMethod(e.target.value)}
                >
                  <option value="CASH">Cash</option>
                  <option value="CARD">Credit/Debit Card</option>
                  <option value="TRANSFER">Bank Transfer</option>
                </select>
              </div>
              
              <div className="bg-[#0f1115] p-3 rounded-lg border border-[#2a2e37] text-sm text-gray-400 flex justify-between items-center">
                <span>Current Expiration:</span>
                <span className="text-white font-medium">{selectedMember.membershipEnd ? new Date(selectedMember.membershipEnd).toLocaleDateString() : 'None'}</span>
              </div>
              
              {plans.find(p => p.id === selectedPlanId) && (
                <div className="bg-primary-600/10 p-3 rounded-lg border border-primary-500/20 text-sm text-primary-400 flex justify-between items-center">
                  <span>Amount to Pay:</span>
                  <span className="text-white font-bold text-lg">Rs {plans.find(p => p.id === selectedPlanId)?.price.toFixed(2)}</span>
                </div>
              )}

              <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-[#2a2e37]">
                <button type="button" onClick={() => setRenewModalOpen(false)} className="btn-secondary">Cancel</button>
                <button type="submit" className="btn-primary" disabled={!selectedPlanId || plans.length === 0}>
                  Confirm Renewal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
