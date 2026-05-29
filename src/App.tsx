import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import Login from './pages/Login';
import DashboardLayout from './components/DashboardLayout';
import Dashboard from './pages/Dashboard';
import Members from './pages/Members';
import Trainers from './pages/Trainers';
import Plans from './pages/Plans';
import Attendance from './pages/Attendance';
import Reports from './pages/Reports';
import Settings from './pages/Settings';

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(
    localStorage.getItem('isAuthenticated') === 'true'
  );
  const [isInitializing, setIsInitializing] = useState(true);
  const navigate = useNavigate();

  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    // Check if the initial owner exists
    (window as any).api.auth.checkHasOwner()
      .then((hasOwner: boolean) => {
        if (!hasOwner) {
          // Setup required
        }
        setIsInitializing(false);
      })
      .catch((err: any) => {
        console.error("Backend Error:", err);
        setErrorMsg(err.message || String(err));
        setIsInitializing(false);
      });
  }, []);

  if (errorMsg) return <div className="flex h-screen items-center justify-center text-white bg-red-900 p-8 break-all">Critical Error: {errorMsg}</div>;
  if (isInitializing) return <div className="flex h-screen items-center justify-center text-white">Loading...</div>;

  const handleLogin = () => {
    setIsAuthenticated(true);
    localStorage.setItem('isAuthenticated', 'true');
    navigate('/');
  };

  return (
    <Routes>
      <Route path="/login" element={<Login onLogin={handleLogin} />} />
      
      {/* Protected Routes */}
      <Route path="/" element={isAuthenticated ? <DashboardLayout /> : <Navigate to="/login" replace />}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="members" element={<Members />} />
        <Route path="trainers" element={<Trainers />} />
        <Route path="plans" element={<Plans />} />
        <Route path="attendance" element={<Attendance />} />
        <Route path="reports" element={<Reports />} />
        <Route path="settings" element={<Settings />} />
      </Route>
    </Routes>
  );
}
