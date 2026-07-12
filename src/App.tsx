import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import Login from './pages/Login';
import Setup from './pages/Setup';
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
  const [toast, setToast] = useState<{message: string, type: string} | null>(null);

  useEffect(() => {
    // Listen for real-time device attendance events
    const api = (window as any).api;
    let cleanupListeners: (() => void) | undefined;

     if (api?.device?.onAttendanceEvent) {
       cleanupListeners = api.device.onAttendanceEvent((type: string, data: any) => {
         const memberName = `${data.member?.firstName || ''} ${data.member?.lastName || ''}`.trim() || 'Member';
         let msg = '';
         if (type === 'checkin') msg = `Welcome, ${memberName}`;
         else if (type === 'checkout') msg = `Goodbye, ${memberName}`;
         else if (type === 'expired') msg = `Dear ${memberName}, your subscription has expired. Please renew your membership.`;
         else if (type === 'inactive') msg = `Dear ${memberName}, your membership has been suspended. Please contact reception.`;
         else if (type === 'unknown') msg = `Member not found. Please contact reception.`;

         if (msg) {
           // Speak
           const utterance = new SpeechSynthesisUtterance(msg);
           window.speechSynthesis.speak(utterance);
           
           // Show Toast
           setToast({ message: msg, type: type === 'checkin' ? 'success' : 'error' });
           setTimeout(() => setToast(null), 5000);
         }
       });
     }

    // Check if the initial owner exists
    (window as any).api.auth.checkHasOwner()
      .then((hasOwner: boolean) => {
        if (!hasOwner) {
          // Setup required
          setIsInitializing(false);
          navigate('/setup');
        } else {
          // Ready to login or go to app
          setIsInitializing(false);
          // If we are on the login page but already authenticated, go to dashboard
          if (isAuthenticated && window.location.hash === '#/login') {
            navigate('/dashboard');
          }
        }
      })
      .catch((err: any) => {
        console.error('Failed to check owner:', err);
        setErrorMsg('Database connection failed. Ensure the server is running.');
        setIsInitializing(false);
      });

    return () => {
      // Cleanup listeners on unmount to prevent leaks
      if (cleanupListeners) cleanupListeners();
    };
  }, [isAuthenticated, navigate]);

  if (errorMsg) return <div className="flex h-screen items-center justify-center text-white bg-red-900 p-8 break-all">Critical Error: {errorMsg}</div>;
  if (isInitializing) return <div className="flex h-screen items-center justify-center text-white">Loading...</div>;

  const handleLogin = () => {
    setIsAuthenticated(true);
    localStorage.setItem('isAuthenticated', 'true');
    navigate('/');
  };

  return (
    <>
    <Routes>
      <Route path="/login" element={<Login onLogin={handleLogin} />} />
      <Route path="/setup" element={<Setup onCreated={() => { window.location.hash = '#/login'; }} />} />
      
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
    {toast && (
      <div className={`fixed top-4 right-4 z-50 p-4 rounded-lg shadow-lg border transition-all transform duration-300 ${
        toast.type === 'error' ? 'bg-red-900/90 border-red-500 text-white' : 'bg-emerald-900/90 border-emerald-500 text-white'
      }`}>
        <div className="flex items-center gap-3">
          {toast.type === 'error' ? (
             <svg className="w-6 h-6 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
             </svg>
          ) : (
             <svg className="w-6 h-6 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
             </svg>
          )}
          <span className="font-semibold">{toast.message}</span>
        </div>
      </div>
    )}
    </>
  );
}
