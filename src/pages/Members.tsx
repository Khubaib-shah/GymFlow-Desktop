import React, { useState, useEffect } from 'react';

// Utility functions for masking and formatting
const formatCNIC = (value: string) => {
  const v = value.replace(/\D/g, '').substring(0, 13);
  if (v.length > 12) return `${v.substring(0, 5)}-${v.substring(5, 12)}-${v.substring(12)}`;
  if (v.length > 5) return `${v.substring(0, 5)}-${v.substring(5)}`;
  return v;
};

const formatPhone = (value: string) => {
  const v = value.replace(/\D/g, '').substring(0, 11);
  if (v.length > 4) return `${v.substring(0, 4)}-${v.substring(4)}`;
  return v;
};

const calculateAge = (dob: string) => {
  if (!dob) return 0;
  const dobDate = new Date(dob);
  const today = new Date();
  let age = today.getFullYear() - dobDate.getFullYear();
  const m = today.getMonth() - dobDate.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < dobDate.getDate())) age--;
  return age;
};
export default function Members() {
  const [members, setMembers] = useState<any[]>([]);
  const [trainers, setTrainers] = useState<any[]>([]);
  const [plans, setPlans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState<any>({ 
    firstName: '', lastName: '', email: '', phone: '', status: 'ACTIVE',
    cnic: '', dob: '', gender: '', address: '', planId: '', trainerId: ''
  });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  // Renew Modal State
  const [renewModalOpen, setRenewModalOpen] = useState(false);
  const [selectedRenewMember, setSelectedRenewMember] = useState<any>(null);
  const [selectedPlanId, setSelectedPlanId] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  const fetchMembers = async () => {
    setLoading(true);
    const data = await (window as any).api.members.getAll();
    setMembers(data);
    setLoading(false);
  };

  useEffect(() => {
    fetchMembers();
    (window as any).api.trainers.getAll().then(setTrainers);
    (window as any).api.plans.getAll().then(setPlans);
  }, []);

  const openModal = (member?: any) => {
    if (member) {
      setFormData({
        ...member,
        dob: member.dob ? new Date(member.dob).toISOString().split('T')[0] : '',
        planId: member.planId || '',
        trainerId: member.trainerId || '',
        cnic: member.cnic || '',
        gender: member.gender || '',
        address: member.address || '',
      });
      setEditingId(member.id);
    } else {
      setFormData({ 
        firstName: '', lastName: '', email: '', phone: '', status: 'ACTIVE',
        cnic: '', dob: '', gender: '', address: '', planId: '', trainerId: ''
      });
      setEditingId(null);
    }
    setErrorMsg('');
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    // Validations
    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      setErrorMsg("Please enter a valid email address.");
      return;
    }

    if (formData.dob) {
      const age = calculateAge(formData.dob);
      if (age > 65) {
        setErrorMsg("Member cannot be older than 65 years.");
        return;
      }
      if (age < 12) {
        setErrorMsg("Member must be at least 12 years old.");
        return;
      }
    }
    
    if (formData.cnic && formData.cnic.length !== 15) {
      setErrorMsg("Please enter a complete 13-digit CNIC.");
      return;
    }

    if (formData.phone && formData.phone.length !== 12) {
      setErrorMsg("Please enter a complete 11-digit phone number.");
      return;
    }
    
    // Prepare data for Prisma
    const dataToSave = { ...formData };
    if (!dataToSave.planId) dataToSave.planId = null;
    if (!dataToSave.trainerId) dataToSave.trainerId = null;
    if (!dataToSave.cnic) dataToSave.cnic = null;
    if (dataToSave.dob) dataToSave.dob = new Date(dataToSave.dob).toISOString();
    else dataToSave.dob = null;

    if (editingId) {
      const { id, createdAt, updatedAt, plan, trainer, attendances, ...updateData } = dataToSave;
      await (window as any).api.members.update(editingId, updateData);
    } else {
      await (window as any).api.members.create(dataToSave);
    }
    setIsModalOpen(false);
    fetchMembers();
  };

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this member?')) {
      await (window as any).api.members.delete(id);
      fetchMembers();
    }
  };

  const openRenewModal = (member: any) => {
    setSelectedRenewMember(member);
    setSelectedPlanId(member.planId || (plans.length > 0 ? plans[0].id : ''));
    setRenewModalOpen(true);
  };

  const submitRenew = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRenewMember || !selectedPlanId) return;

    const plan = plans.find((p: any) => p.id === selectedPlanId);
    if (!plan) return;

    let newStartDate = new Date();
    if (selectedRenewMember.membershipEnd) {
      const currentEnd = new Date(selectedRenewMember.membershipEnd);
      if (currentEnd > new Date()) {
        newStartDate = currentEnd;
      }
    }

    const newEndDate = new Date(newStartDate);
    newEndDate.setDate(newEndDate.getDate() + plan.durationDays);

    await (window as any).api.members.update(selectedRenewMember.id, {
      planId: selectedPlanId,
      membershipStart: selectedRenewMember.membershipEnd && new Date(selectedRenewMember.membershipEnd) > new Date() ? selectedRenewMember.membershipStart : new Date().toISOString(),
      membershipEnd: newEndDate.toISOString(),
      status: 'ACTIVE'
    });

    // Record Payment
    await (window as any).api.payments.create({
      memberId: selectedRenewMember.id,
      planId: selectedPlanId,
      amount: plan.price,
      method: paymentMethod,
      notes: 'Subscription Renewal'
    });

    setRenewModalOpen(false);
    fetchMembers();
  };

  const statusCounts = {
    ALL: members.length,
    ACTIVE: members.filter(m => m.status === 'ACTIVE').length,
    EXPIRED: members.filter(m => m.status === 'EXPIRED').length,
    INACTIVE: members.filter(m => m.status === 'INACTIVE').length,
    SUSPENDED: members.filter(m => m.status === 'SUSPENDED').length,
  };

  const filteredMembers = members.filter(m => {
    const term = searchQuery.toLowerCase();
    const matchesSearch = (
      m.firstName.toLowerCase().includes(term) ||
      m.lastName.toLowerCase().includes(term) ||
      (m.cnic && m.cnic.toLowerCase().includes(term)) ||
      (m.phone && m.phone.toLowerCase().includes(term)) ||
      (m.email && m.email.toLowerCase().includes(term))
    );
    const matchesStatus = statusFilter === 'ALL' || m.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const filterConfig: { key: string; label: string; color: string; activeColor: string }[] = [
    { key: 'ALL',       label: 'All Members', color: 'border-[#2a2e37] text-gray-400 hover:text-white hover:border-gray-500',          activeColor: 'bg-white/10 border-white/30 text-white' },
    { key: 'ACTIVE',    label: 'Active',      color: 'border-[#2a2e37] text-gray-400 hover:text-green-400 hover:border-green-500/40',  activeColor: 'bg-green-500/10 border-green-500/40 text-green-400' },
    { key: 'EXPIRED',   label: 'Expired',     color: 'border-[#2a2e37] text-gray-400 hover:text-red-400 hover:border-red-500/40',    activeColor: 'bg-red-500/10 border-red-500/40 text-red-400' },
    { key: 'INACTIVE',  label: 'Inactive',    color: 'border-[#2a2e37] text-gray-400 hover:text-yellow-400 hover:border-yellow-500/40', activeColor: 'bg-yellow-500/10 border-yellow-500/40 text-yellow-400' },
    { key: 'SUSPENDED', label: 'Suspended',   color: 'border-[#2a2e37] text-gray-400 hover:text-orange-400 hover:border-orange-500/40', activeColor: 'bg-orange-500/10 border-orange-500/40 text-orange-400' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Members</h1>
          <p className="text-gray-400 mt-1">Manage your gym members and their subscriptions.</p>
        </div>
        <div className="flex gap-4">
          <div className="relative">
            <svg className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input 
              type="text" 
              placeholder="Search members..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-[#0f1115] border border-[#2a2e37] text-white text-sm rounded-lg focus:ring-primary-500 focus:border-primary-500 block w-64 pl-10 p-2.5 transition-colors"
            />
          </div>
          <button onClick={() => openModal()} className="btn-primary flex items-center gap-2 shadow-lg shadow-primary-600/20">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Member
          </button>
        </div>
      </div>

      {/* Status Filter Pills */}
      <div className="flex items-center gap-2 flex-wrap">
        {filterConfig.map(f => (
          <button
            key={f.key}
            onClick={() => setStatusFilter(f.key)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm font-medium transition-all ${
              statusFilter === f.key ? f.activeColor : f.color
            }`}
          >
            {f.label}
            <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${
              statusFilter === f.key ? 'bg-white/20' : 'bg-[#1a1d24]'
            }`}>
              {statusCounts[f.key as keyof typeof statusCounts]}
            </span>
          </button>
        ))}
      </div>

      <div className="glass rounded-xl overflow-hidden border border-[#2a2e37]">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-300">
            <thead className="bg-[#1a1d24] text-xs uppercase text-gray-400 border-b border-[#2a2e37]">
              <tr>
                <th className="px-6 py-4 font-medium">Name & CNIC</th>
                <th className="px-6 py-4 font-medium">Contact</th>
                <th className="px-6 py-4 font-medium">Status</th>
                <th className="px-6 py-4 font-medium">Plan & Trainer</th>
                <th className="px-6 py-4 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#2a2e37]">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-gray-500">Loading members...</td>
                </tr>
              ) : filteredMembers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
                    {searchQuery ? 'No members match your search.' : 'No members found. Add one to get started.'}
                  </td>
                </tr>
              ) : (
                filteredMembers.map((member) => (
                  <tr key={member.id} className="hover:bg-[#1a1d24]/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-primary-600/20 text-primary-500 flex items-center justify-center font-bold">
                          {member.firstName[0]}{member.lastName[0]}
                        </div>
                        <div>
                          <div className="font-medium text-white">{member.firstName} {member.lastName}</div>
                          <div className="text-xs text-gray-500">{member.cnic || 'No CNIC'}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-gray-300">{member.phone || 'N/A'}</div>
                      <div className="text-xs text-gray-500">{member.email || 'N/A'}</div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                        member.status === 'ACTIVE' 
                          ? 'bg-green-500/10 text-green-400 border border-green-500/20'
                          : 'bg-red-500/10 text-red-400 border border-red-500/20'
                      }`}>
                        {member.status}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-gray-300">{member.plan?.name || 'No Plan'}</div>
                      <div className="text-xs text-gray-500">Trainer: {member.trainer ? `${member.trainer.firstName} ${member.trainer.lastName}` : 'None'}</div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button onClick={() => openRenewModal(member)} className="text-primary-400 hover:text-primary-300 transition-colors mr-3 font-medium">Renew</button>
                      <button onClick={() => openModal(member)} className="text-gray-400 hover:text-white transition-colors mr-3">Edit</button>
                      <button onClick={() => handleDelete(member.id)} className="text-gray-400 hover:text-red-400 transition-colors">Delete</button>
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
          <div className="glass w-full max-w-lg rounded-2xl p-6 border border-[#2a2e37] shadow-2xl relative">
            <h2 className="text-xl font-bold text-white mb-4">{editingId ? 'Edit Member' : 'Add Member'}</h2>
            {errorMsg && (
              <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg text-sm">
                {errorMsg}
              </div>
            )}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">First Name</label>
                  <input required type="text" className="input-field" value={formData.firstName} onChange={e => setFormData({...formData, firstName: e.target.value})} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">Last Name</label>
                  <input required type="text" className="input-field" value={formData.lastName} onChange={e => setFormData({...formData, lastName: e.target.value})} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">Email</label>
                  <input type="email" className="input-field" value={formData.email || ''} onChange={e => setFormData({...formData, email: e.target.value})} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">Phone</label>
                  <input type="text" placeholder="03XX-XXXXXXX" className="input-field" value={formData.phone || ''} onChange={e => setFormData({...formData, phone: formatPhone(e.target.value)})} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">CNIC / National ID</label>
                  <input type="text" placeholder="XXXXX-XXXXXXX-X" className="input-field" value={formData.cnic || ''} onChange={e => setFormData({...formData, cnic: formatCNIC(e.target.value)})} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">Date of Birth</label>
                  <input type="date" className="input-field" value={formData.dob || ''} onChange={e => setFormData({...formData, dob: e.target.value})} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">Gender</label>
                  <select className="input-field" value={formData.gender || ''} onChange={e => setFormData({...formData, gender: e.target.value})}>
                    <option value="">Select Gender</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">Address</label>
                  <input type="text" className="input-field" value={formData.address || ''} onChange={e => setFormData({...formData, address: e.target.value})} />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">Status</label>
                  <select className="input-field" value={formData.status} onChange={e => setFormData({...formData, status: e.target.value})}>
                    <option value="ACTIVE">Active</option>
                    <option value="INACTIVE">Inactive</option>
                    <option value="SUSPENDED">Suspended</option>
                    <option value="EXPIRED">Expired</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">Plan</label>
                  <select className="input-field" value={formData.planId || ''} onChange={e => setFormData({...formData, planId: e.target.value})}>
                    <option value="">No Plan</option>
                    {plans.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">Trainer</label>
                  <select className="input-field" value={formData.trainerId || ''} onChange={e => setFormData({...formData, trainerId: e.target.value})}>
                    <option value="">No Trainer</option>
                    {trainers.map(t => <option key={t.id} value={t.id}>{t.firstName} {t.lastName}</option>)}
                  </select>
                </div>
              </div>
              
              <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-[#2a2e37]">
                <button type="button" onClick={() => setIsModalOpen(false)} className="btn-secondary">Cancel</button>
                <button type="submit" className="btn-primary">Save Member</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Renew Modal */}
      {renewModalOpen && selectedRenewMember && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="glass w-full max-w-sm rounded-2xl p-6 border border-[#2a2e37] shadow-2xl relative animate-in zoom-in-95 duration-200">
            <h2 className="text-xl font-bold text-white mb-1">Renew Subscription</h2>
            <p className="text-sm text-gray-400 mb-4">Extend membership for {selectedRenewMember.firstName}.</p>
            
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
                  {plans.map((p: any) => (
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
                <span className="text-white font-medium">{selectedRenewMember.membershipEnd ? new Date(selectedRenewMember.membershipEnd).toLocaleDateString() : 'None'}</span>
              </div>

              {plans.find((p: any) => p.id === selectedPlanId) && (
                <div className="bg-primary-600/10 p-3 rounded-lg border border-primary-500/20 text-sm text-primary-400 flex justify-between items-center">
                  <span>Amount to Pay:</span>
                  <span className="text-white font-bold text-lg">Rs {plans.find((p: any) => p.id === selectedPlanId)?.price.toFixed(2)}</span>
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
