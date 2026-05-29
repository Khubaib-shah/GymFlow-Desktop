import React, { useState, useEffect } from 'react';

export default function Plans() {
  const [plans, setPlans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState<any>({ name: '', durationDays: 30, price: 0 });
  const [editingId, setEditingId] = useState<string | null>(null);

  const fetchPlans = async () => {
    setLoading(true);
    const data = await (window as any).api.plans.getAll();
    setPlans(data);
    setLoading(false);
  };

  useEffect(() => {
    fetchPlans();
  }, []);

  const openModal = (plan?: any) => {
    if (plan) {
      setFormData({
        name: plan.name,
        durationDays: plan.durationDays,
        price: plan.price
      });
      setEditingId(plan.id);
    } else {
      setFormData({ name: '', durationDays: 30, price: 0 });
      setEditingId(null);
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const submitData = {
      ...formData,
      durationDays: parseInt(formData.durationDays, 10),
      price: parseFloat(formData.price)
    };

    if (editingId) {
      await (window as any).api.plans.update(editingId, submitData);
    } else {
      await (window as any).api.plans.create(submitData);
    }
    setIsModalOpen(false);
    fetchPlans();
  };

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this plan?')) {
      await (window as any).api.plans.delete(id);
      fetchPlans();
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Membership Plans</h1>
          <p className="text-gray-400 mt-1">Configure pricing and durations for your gym plans.</p>
        </div>
        <button onClick={() => openModal()} className="btn-primary flex items-center gap-2">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Plan
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {loading ? (
          <div className="col-span-full text-center py-10 text-gray-500">Loading plans...</div>
        ) : plans.length === 0 ? (
          <div className="col-span-full text-center py-10 text-gray-500 glass rounded-xl">No plans configured yet.</div>
        ) : (
          plans.map(plan => (
            <div key={plan.id} className="glass rounded-xl p-6 border border-[#2a2e37] relative group overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary-500 to-purple-500"></div>
              
              <h3 className="text-xl font-bold text-white">{plan.name}</h3>
              <div className="mt-4 flex items-baseline text-white">
                <span className="text-4xl font-extrabold tracking-tight">Rs {plan.price}</span>
                <span className="ml-1 text-xl font-semibold text-gray-400">/{plan.durationDays} days</span>
              </div>
              
              <div className="mt-6 flex gap-3">
                <button onClick={() => openModal(plan)} className="flex-1 btn-secondary text-sm">Edit Plan</button>
                <button onClick={() => handleDelete(plan.id)} className="p-2 text-gray-400 hover:text-red-400 bg-[#2a2e37] rounded-lg hover:bg-red-500/10 transition-colors">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="glass w-full max-w-sm rounded-2xl p-6 border border-[#2a2e37] shadow-2xl relative">
            <h2 className="text-xl font-bold text-white mb-4">{editingId ? 'Edit Plan' : 'Add Plan'}</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">Plan Name</label>
                <input required type="text" className="input-field" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">Duration (Days)</label>
                <input required type="number" min="1" className="input-field" value={formData.durationDays} onChange={e => setFormData({...formData, durationDays: e.target.value})} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">Price ($)</label>
                <input required type="number" step="0.01" min="0" className="input-field" value={formData.price} onChange={e => setFormData({...formData, price: e.target.value})} />
              </div>
              
              <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-[#2a2e37]">
                <button type="button" onClick={() => setIsModalOpen(false)} className="btn-secondary">Cancel</button>
                <button type="submit" className="btn-primary">Save Plan</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
