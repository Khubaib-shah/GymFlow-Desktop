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

export default function Trainers() {
  const [trainers, setTrainers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState<any>({ 
    firstName: '', lastName: '', specialty: '', phone: '',
    cnic: '', dob: '', gender: '', address: '' 
  });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  // Profile modal state
  const [profileTrainer, setProfileTrainer] = useState<any>(null);

  const fetchTrainers = async () => {
    setLoading(true);
    const data = await (window as any).api.trainers.getAll();
    setTrainers(data);
    setLoading(false);
  };

  useEffect(() => {
    fetchTrainers();
  }, []);

  const openModal = (trainer?: any) => {
    if (trainer) {
      setFormData({
        ...trainer,
        dob: trainer.dob ? new Date(trainer.dob).toISOString().split('T')[0] : '',
        cnic: trainer.cnic || '',
        gender: trainer.gender || '',
        address: trainer.address || '',
        specialty: trainer.specialty || '',
        phone: trainer.phone || ''
      });
      setEditingId(trainer.id);
    } else {
      setFormData({ 
        firstName: '', lastName: '', specialty: '', phone: '',
        cnic: '', dob: '', gender: '', address: '' 
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
    if (formData.dob) {
      const age = calculateAge(formData.dob);
      if (age > 65) {
        setErrorMsg("Trainer cannot be older than 65 years.");
        return;
      }
      if (age < 18) {
        setErrorMsg("Trainer must be at least 18 years old.");
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

    const dataToSave = { ...formData };
    if (!dataToSave.cnic) dataToSave.cnic = null;
    if (dataToSave.dob) dataToSave.dob = new Date(dataToSave.dob).toISOString();
    else dataToSave.dob = null;

    if (editingId) {
      const { id, createdAt, updatedAt, _count, members, ...updateData } = dataToSave;
      await (window as any).api.trainers.update(editingId, updateData);
    } else {
      await (window as any).api.trainers.create(dataToSave);
    }
    setIsModalOpen(false);
    fetchTrainers();
  };

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this trainer?')) {
      await (window as any).api.trainers.delete(id);
      fetchTrainers();
    }
  };

  const statusColor = (status: string) => {
    switch (status) {
      case 'ACTIVE':    return 'bg-green-500/10 text-green-400 border border-green-500/20';
      case 'EXPIRED':   return 'bg-red-500/10 text-red-400 border border-red-500/20';
      case 'SUSPENDED': return 'bg-orange-500/10 text-orange-400 border border-orange-500/20';
      default:          return 'bg-gray-500/10 text-gray-400 border border-gray-500/20';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Trainers</h1>
          <p className="text-gray-400 mt-1">Manage your coaching staff and their specialties.</p>
        </div>
        <button onClick={() => openModal()} className="btn-primary flex items-center gap-2">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Trainer
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          <div className="col-span-full text-center py-10 text-gray-500">Loading trainers...</div>
        ) : trainers.length === 0 ? (
          <div className="col-span-full text-center py-10 text-gray-500 glass rounded-xl">No trainers found.</div>
        ) : (
          trainers.map(trainer => (
            <div
              key={trainer.id}
              onClick={() => setProfileTrainer(trainer)}
              className="glass rounded-xl p-6 border border-[#2a2e37] flex flex-col items-center text-center relative group cursor-pointer hover:border-primary-500/40 transition-colors"
            >
              <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-purple-600 to-indigo-500 mb-4 p-1 shadow-lg shadow-purple-500/20">
                <div className="w-full h-full bg-[#13151a] rounded-full flex items-center justify-center text-2xl font-bold text-white">
                  {trainer.firstName[0]}{trainer.lastName[0]}
                </div>
              </div>
              <h3 className="text-lg font-bold text-white">{trainer.firstName} {trainer.lastName}</h3>
              <p className="text-sm text-primary-400 font-medium mt-1">{trainer.specialty || 'General Fitness'}</p>
              
              <div className="w-full h-px bg-gradient-to-r from-transparent via-[#2a2e37] to-transparent my-4"></div>
              
              <div className="flex justify-around w-full text-sm">
                <div>
                  <div className="text-gray-400">Assigned</div>
                  <div className="font-semibold text-white">{trainer._count?.members || 0} Members</div>
                </div>
                {trainer.phone && (
                  <div>
                    <div className="text-gray-400">Phone</div>
                    <div className="font-semibold text-white text-xs">{trainer.phone}</div>
                  </div>
                )}
              </div>

              {/* Action buttons — shown on hover, stop propagation so they don't open profile */}
              <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={(e) => { e.stopPropagation(); openModal(trainer); }}
                  className="text-gray-400 hover:text-white p-2 bg-[#13151a] rounded-lg"
                >
                  Edit
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); handleDelete(trainer.id); }}
                  className="text-gray-400 hover:text-red-400 p-2 bg-[#13151a] rounded-lg"
                >
                  Del
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* ── TRAINER PROFILE MODAL ─────────────────────────────────────────── */}
      {profileTrainer && (
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={() => setProfileTrainer(null)}
        >
          <div
            className="glass w-full max-w-2xl rounded-2xl border border-[#2a2e37] shadow-2xl overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="relative bg-gradient-to-r from-purple-900/40 to-indigo-900/40 p-6 pb-16">
              <button
                onClick={() => setProfileTrainer(null)}
                className="absolute top-4 right-4 text-gray-400 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
              <div className="flex items-end gap-5">
                <div className="w-24 h-24 rounded-full bg-gradient-to-tr from-purple-600 to-indigo-500 p-1 shadow-xl shadow-purple-500/30 flex-shrink-0">
                  <div className="w-full h-full bg-[#13151a] rounded-full flex items-center justify-center text-3xl font-bold text-white">
                    {profileTrainer.firstName[0]}{profileTrainer.lastName[0]}
                  </div>
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-white">{profileTrainer.firstName} {profileTrainer.lastName}</h2>
                  <p className="text-primary-400 font-medium">{profileTrainer.specialty || 'General Fitness'}</p>
                  {profileTrainer.phone && <p className="text-gray-400 text-sm mt-1">{profileTrainer.phone}</p>}
                </div>
              </div>
            </div>

            {/* Details */}
            <div className="p-6 -mt-8 space-y-6">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {profileTrainer.cnic && (
                  <div className="glass bg-[#0f1115]/50 rounded-lg p-3">
                    <div className="text-xs text-gray-500 mb-1">CNIC</div>
                    <div className="text-sm text-white font-medium">{profileTrainer.cnic}</div>
                  </div>
                )}
                {profileTrainer.gender && (
                  <div className="glass bg-[#0f1115]/50 rounded-lg p-3">
                    <div className="text-xs text-gray-500 mb-1">Gender</div>
                    <div className="text-sm text-white font-medium">{profileTrainer.gender}</div>
                  </div>
                )}
                {profileTrainer.dob && (
                  <div className="glass bg-[#0f1115]/50 rounded-lg p-3">
                    <div className="text-xs text-gray-500 mb-1">Age</div>
                    <div className="text-sm text-white font-medium">{calculateAge(profileTrainer.dob)} yrs</div>
                  </div>
                )}
                {profileTrainer.address && (
                  <div className="glass bg-[#0f1115]/50 rounded-lg p-3 col-span-2">
                    <div className="text-xs text-gray-500 mb-1">Address</div>
                    <div className="text-sm text-white font-medium">{profileTrainer.address}</div>
                  </div>
                )}
                <div className="glass bg-[#0f1115]/50 rounded-lg p-3">
                  <div className="text-xs text-gray-500 mb-1">Joined</div>
                  <div className="text-sm text-white font-medium">{new Date(profileTrainer.createdAt).toLocaleDateString()}</div>
                </div>
              </div>

              {/* Assigned Members */}
              <div>
                <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  Assigned Members ({profileTrainer.members?.length || 0})
                </h3>
                {!profileTrainer.members || profileTrainer.members.length === 0 ? (
                  <div className="text-gray-500 text-sm text-center py-6 glass rounded-lg border border-[#2a2e37]">
                    No members currently assigned to this trainer.
                  </div>
                ) : (
                  <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                    {profileTrainer.members.map((m: any) => (
                      <div key={m.id} className="flex items-center justify-between glass bg-[#0f1115]/50 rounded-lg px-4 py-3 border border-[#2a2e37]">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-primary-600/20 text-primary-500 flex items-center justify-center font-bold text-xs flex-shrink-0">
                            {m.firstName[0]}{m.lastName[0]}
                          </div>
                          <div>
                            <div className="text-sm font-medium text-white">{m.firstName} {m.lastName}</div>
                            <div className="text-xs text-gray-500">{m.phone || m.email || 'No contact'}</div>
                          </div>
                        </div>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColor(m.status)}`}>
                          {m.status}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-3 pt-2 border-t border-[#2a2e37]">
                <button onClick={() => setProfileTrainer(null)} className="btn-secondary">Close</button>
                <button
                  onClick={() => { setProfileTrainer(null); openModal(profileTrainer); }}
                  className="btn-primary"
                >
                  Edit Trainer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── ADD / EDIT FORM MODAL ─────────────────────────────────────────── */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="glass w-full max-w-lg rounded-2xl p-6 border border-[#2a2e37] shadow-2xl relative">
            <h2 className="text-xl font-bold text-white mb-4">{editingId ? 'Edit Trainer' : 'Add Trainer'}</h2>
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
                  <label className="block text-sm font-medium text-gray-400 mb-1">Specialty</label>
                  <input type="text" className="input-field" value={formData.specialty} onChange={e => setFormData({...formData, specialty: e.target.value})} />
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
              
              <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-[#2a2e37]">
                <button type="button" onClick={() => setIsModalOpen(false)} className="btn-secondary">Cancel</button>
                <button type="submit" className="btn-primary">Save Trainer</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
