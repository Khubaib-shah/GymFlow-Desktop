import React, { useState, useEffect } from 'react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell } from 'recharts';

export default function Reports() {
  const [members, setMembers] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [attendances, setAttendances] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [dateFilter, setDateFilter] = useState('all');
  const [customDate, setCustomDate] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [mData, pData, aData] = await Promise.all([
          (window as any).api.members.getAll(),
          (window as any).api.payments.getAll(),
          (window as any).api.attendance.getRecent(1000) // fetch up to 1000 recent attendances
        ]);
        setMembers(mData);
        setPayments(pData);
        setAttendances(aData);
      } catch (err) {
        console.error('Failed to fetch report data', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  // --- Filtering Logic ---
  const filterByDate = (dateString: string) => {
    if (dateFilter === 'all') return true;

    const d = new Date(dateString);
    const today = new Date();
    today.setHours(0,0,0,0);
    
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (dateFilter === 'today') {
      return d >= today;
    } else if (dateFilter === 'yesterday') {
      return d >= yesterday && d < today;
    } else if (dateFilter === 'last7days') {
      const last7 = new Date(today);
      last7.setDate(last7.getDate() - 7);
      return d >= last7;
    } else if (dateFilter === 'thisMonth') {
      return d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear();
    } else if (dateFilter === 'lastMonth') {
      const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      return d.getMonth() === lastMonth.getMonth() && d.getFullYear() === lastMonth.getFullYear();
    } else if (dateFilter === 'custom' && customDate) {
      const custom = new Date(customDate);
      return d.getDate() === custom.getDate() && 
             d.getMonth() === custom.getMonth() && 
             d.getFullYear() === custom.getFullYear();
    }
    return true;
  };

  const filteredPayments = payments.filter(p => filterByDate(p.paymentDate));
  const filteredAttendances = attendances.filter(a => filterByDate(a.checkInTime));
  const filteredMembers = members.filter(m => filterByDate(m.createdAt));

  // --- Calculations ---

  // 1. Revenue
  const totalRevenue = filteredPayments.reduce((sum, p) => sum + p.amount, 0);
  
  // Revenue by Method
  const revByMethodMap = filteredPayments.reduce((acc, p) => {
    acc[p.method] = (acc[p.method] || 0) + p.amount;
    return acc;
  }, {} as Record<string, number>);
  const revenueByMethod: { name: string; value: number }[] = Object.entries(revByMethodMap).map(([name, value]) => ({ name, value: value as number }));

  // Revenue Over Time (Last 7 Days)
  const last7Days = Array.from({length: 7}).map((_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  });

  const revenueOverTimeMap = filteredPayments.reduce((acc, p) => {
    const dateStr = new Date(p.paymentDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    acc[dateStr] = (acc[dateStr] || 0) + p.amount;
    return acc;
  }, {} as Record<string, number>);

  const revenueChartData = last7Days.map(date => ({
    date,
    revenue: revenueOverTimeMap[date] || 0
  }));

  // 2. Attendance
  const checkinsByDayMap = filteredAttendances.reduce((acc, a) => {
    const dateStr = new Date(a.checkInTime).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    acc[dateStr] = (acc[dateStr] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const attendanceChartData = last7Days.map(date => ({
    date,
    checkins: checkinsByDayMap[date] || 0
  }));

  const COLORS = ['#6366f1', '#a855f7', '#ec4899', '#14b8a6'];

  const handlePrint = () => {
    window.print();
  };

  const exportToCSV = (data: any[], filename: string) => {
    if (data.length === 0) {
      alert(`No data to export for ${filename}.`);
      return;
    }
    const headers = Object.keys(data[0]).filter(k => typeof data[0][k] !== 'object');
    const csvContent = [
      headers.join(','),
      ...data.map(row => headers.map(header => `"${String(row[header] || '').replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${filename}_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  const exportRevenue = () => {
    if (filteredPayments.length === 0) {
      alert('No revenue data to export for the selected period.');
      return;
    }
    const rows = filteredPayments.map(p => ({
      'Member Name': p.member ? `${p.member.firstName} ${p.member.lastName}` : 'N/A',
      'Phone':       p.member?.phone || 'N/A',
      'Amount (Rs)': p.amount,
      'Method':      p.method,
      'Date':        new Date(p.paymentDate).toLocaleDateString(),
      'Notes':       p.notes || '',
    }));
    const headers = Object.keys(rows[0]);
    const csvContent = [
      headers.join(','),
      ...rows.map(row => headers.map(h => `"${String((row as any)[h] || '').replace(/"/g, '""')}"`).join(','))
    ].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `revenue_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  if (loading) {
    return <div className="text-gray-500 py-10 text-center">Loading reports...</div>;
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500 print:text-black">
      <div className="flex justify-between items-end print:hidden">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Full Reports</h1>
          <p className="text-gray-400 mt-1">Analytics, revenue, and attendance insights.</p>
        </div>
        <div className="flex gap-3">
          <div className="flex gap-2 bg-[#0f1115] border border-[#2a2e37] rounded-lg overflow-hidden p-1 mr-2">
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
          
          <button onClick={exportRevenue} className="btn-secondary flex items-center gap-2">
            Export Revenue
          </button>
          <button onClick={() => exportToCSV(filteredMembers, 'members')} className="btn-secondary flex items-center gap-2">
            Export Members
          </button>
          <button onClick={handlePrint} className="btn-primary flex items-center gap-2 shadow-lg shadow-primary-600/20">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
            Save as PDF
          </button>
        </div>
      </div>

      <div className="hidden print:block mb-8">
        <h1 className="text-3xl font-bold">Gym Management Report</h1>
        <p className="text-gray-600">Generated on: {new Date().toLocaleString()}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Total Revenue */}
        <div className="glass print:border-gray-200 print:bg-white p-6 rounded-xl border border-[#2a2e37] shadow-lg">
          <p className="text-sm font-medium text-gray-400 print:text-gray-600">Revenue {dateFilter === 'all' ? '(Lifetime)' : '(Period)'}</p>
          <h3 className="text-4xl font-bold text-green-500 mt-2">Rs {totalRevenue.toFixed(2)}</h3>
        </div>
        
        {/* Total Members */}
        <div className="glass print:border-gray-200 print:bg-white p-6 rounded-xl border border-[#2a2e37] shadow-lg">
          <p className="text-sm font-medium text-gray-400 print:text-gray-600">Members {dateFilter === 'all' ? '(Total)' : '(Joined in Period)'}</p>
          <h3 className="text-4xl font-bold text-white print:text-black mt-2">{dateFilter === 'all' ? members.length : filteredMembers.length}</h3>
        </div>

        {/* Recent Attendances */}
        <div className="glass print:border-gray-200 print:bg-white p-6 rounded-xl border border-[#2a2e37] shadow-lg">
          <p className="text-sm font-medium text-gray-400 print:text-gray-600">Check-ins {dateFilter === 'all' ? '(Last 1000)' : '(Period)'}</p>
          <h3 className="text-4xl font-bold text-primary-500 mt-2">{filteredAttendances.length}</h3>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue Chart */}
        <div className="glass print:border-gray-200 print:bg-white p-6 rounded-xl border border-[#2a2e37] shadow-lg h-[350px] flex flex-col">
          <h2 className="text-lg font-bold text-white print:text-black mb-4">Revenue (Last 7 Days)</h2>
          <div className="flex-1">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={revenueChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2a2e37" vertical={false} />
                <XAxis dataKey="date" stroke="#9ca3af" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#9ca3af" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(val) => `Rs ${val}`} />
                <Tooltip cursor={{stroke: '#2a2e37', strokeWidth: 1}} contentStyle={{backgroundColor: '#13151a', borderColor: '#2a2e37', borderRadius: '8px', color: 'white'}} itemStyle={{color: '#e5e7eb'}} />
                <Line type="monotone" dataKey="revenue" stroke="#22c55e" strokeWidth={3} dot={{r: 4, fill: '#22c55e', strokeWidth: 0}} activeDot={{r: 6}} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Attendance Chart */}
        <div className="glass print:border-gray-200 print:bg-white p-6 rounded-xl border border-[#2a2e37] shadow-lg h-[350px] flex flex-col">
          <h2 className="text-lg font-bold text-white print:text-black mb-4">Check-ins (Last 7 Days)</h2>
          <div className="flex-1">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={attendanceChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2a2e37" vertical={false} />
                <XAxis dataKey="date" stroke="#9ca3af" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#9ca3af" fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip cursor={{fill: '#2a2e37'}} contentStyle={{backgroundColor: '#13151a', borderColor: '#2a2e37', borderRadius: '8px', color: 'white'}} itemStyle={{color: '#e5e7eb'}} />
                <Bar dataKey="checkins" fill="#6366f1" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue by Method Pie */}
        <div className="glass print:border-gray-200 print:bg-white p-6 rounded-xl border border-[#2a2e37] shadow-lg h-[300px] flex flex-col items-center">
          <h2 className="text-lg font-bold text-white print:text-black w-full text-left mb-2">Revenue by Method</h2>
          {revenueByMethod.length === 0 ? (
            <div className="flex-1 flex items-center text-gray-500">No revenue data.</div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={revenueByMethod} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                  {revenueByMethod.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{backgroundColor: '#13151a', borderColor: '#2a2e37', borderRadius: '8px', color: 'white'}} itemStyle={{color: '#e5e7eb'}} formatter={(val) => `Rs ${Number(val).toFixed(2)}`} />
              </PieChart>
            </ResponsiveContainer>
          )}
          <div className="flex gap-4 mt-2">
            {revenueByMethod.map((entry, index) => (
              <div key={entry.name} className="flex items-center gap-1.5 text-xs text-gray-400">
                <div className="w-3 h-3 rounded-full" style={{backgroundColor: COLORS[index % COLORS.length]}}></div>
                {entry.name}: Rs {entry.value.toFixed(2)}
              </div>
            ))}
          </div>
        </div>
      </div>

    </div>
  );
}
