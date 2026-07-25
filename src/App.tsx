import React, { useState, useEffect } from "react";
import { Routes, Route, Navigate, useNavigate } from "react-router-dom";
import Login from "./pages/Login";
import Setup from "./pages/Setup";
import DashboardLayout from "./components/DashboardLayout";
import Dashboard from "./pages/Dashboard";
import Members from "./pages/Members";
import Trainers from "./pages/Trainers";
import Plans from "./pages/Plans";
import Attendance from "./pages/Attendance";
import Reports from "./pages/Reports";
import Settings from "./pages/Settings";
import { ErrorBoundary } from "./components/ErrorBoundary";

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [sessionLoaded, setSessionLoaded] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const navigate = useNavigate();

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: string } | null>(
    null,
  );
  const [problemMember, setProblemMember] = useState<{ member: any; type: string } | null>(
    null,
  );

  useEffect(() => {
    // Listen for real-time device attendance events
    const api = (window as any).api;
    let cleanupListeners: (() => void) | undefined;
    let toastTimer: ReturnType<typeof setTimeout> | null = null;

    if (api?.device?.onAttendanceEvent) {
      const handleAttendanceEvent = (type: string, data: any) => {
        if (data.startupSync) return; // Ignore bulk offline syncs for notifications

        const memberName =
          `${data.member?.firstName || ""} ${data.member?.lastName || ""}`.trim() ||
          "Member";
        let msg = "";
        
        if (type === "checkin") {
          msg = `Welcome ${memberName}!`;
          // Auto-sync fingerprints if they enrolled on device but DB has none
          if (data.member?.id && data.deviceUserId) {
            api.members.getById(data.member.id).then((fullMember: any) => {
              if (fullMember && (!fullMember.fingerprints || fullMember.fingerprints.length === 0)) {
                api.device.syncUser(data.deviceUserId)
                  .then(() => window.dispatchEvent(new Event('gymflow:member_updated')))
                  .catch((err: any) => console.error("Auto-sync failed", err));
              }
            }).catch((err: any) => console.error("Failed to fetch full member", err));
          }
        } else if (type === "expired") {
          msg = `Dear ${memberName}, your subscription has expired. Please renew your membership.`;
        } else if (type === "inactive") {
          msg = `Dear ${memberName}, your membership has been suspended. Please contact reception.`;
        } else if (type === "trainerCheckin") {
          const trainerName =
            `${data.trainer?.firstName || ""} ${data.trainer?.lastName || ""}`.trim() ||
            "Trainer";
          msg = `Welcome ${trainerName}!`;
          // Auto-sync fingerprints for trainers too
          if (data.trainer?.id && data.deviceUserId) {
            api.trainers.getAll().then((trainers: any[]) => {
              const fullTrainer = trainers.find(t => t.id === data.trainer.id);
              if (fullTrainer && (!fullTrainer.fingerprints || fullTrainer.fingerprints.length === 0)) {
                api.device.syncUser(data.deviceUserId)
                  .then(() => window.dispatchEvent(new Event('gymflow:trainer_updated')))
                  .catch((err: any) => console.error("Auto-sync failed", err));
              }
            }).catch((err: any) => console.error("Failed to fetch trainers", err));
          }
        }

        if (msg) {
          // Show Toast
          setToast({
            message: msg,
            type: type === "checkin" || type === "trainerCheckin" ? "success" : "error",
          });
          // Clear any existing toast timer before setting a new one
          if (toastTimer) clearTimeout(toastTimer);
          toastTimer = setTimeout(() => setToast(null), 5000);

          // Speech Synthesis
          const voices = speechSynthesis.getVoices();
          const speech = new SpeechSynthesisUtterance(msg);
          speech.voice = voices[2];
          speech.rate = 0.95;
          speech.pitch = 1;
          window.speechSynthesis.cancel();
          window.speechSynthesis.speak(speech);

          if ((type === "expired" || type === "inactive") && data.member) {
            setProblemMember({ member: data.member, type });
          }
        }
      };

      // Expose to window for easy testing via DevTools console
      (window as any).simulateAttendanceEvent = handleAttendanceEvent;

      cleanupListeners = api.device.onAttendanceEvent(handleAttendanceEvent);
    }

    // Check if the initial owner exists
    let cancelled = false;
    (window as any).api.auth
      .checkHasOwner()
      .then((hasOwner: boolean) => {
        if (cancelled) return;
        if (!hasOwner) {
          // Setup required
          setIsInitializing(false);
          navigate("/setup");
        } else {
          // Ready to login or go to app
          setIsInitializing(false);
          // If we are on the login page but already authenticated, go to dashboard
          if (isAuthenticated && window.location.hash === "#/login") {
            navigate("/dashboard");
          }
        }
      })
      .catch((err: any) => {
        if (cancelled) return;
        console.error("Failed to check owner:", err);
        setErrorMsg(
          "Database connection failed. Ensure the server is running.",
        );
        setIsInitializing(false);
      });

    return () => {
      cancelled = true;
      // Cleanup listeners on unmount to prevent leaks
      if (cleanupListeners) cleanupListeners();
      // Clear toast timer
      if (toastTimer) clearTimeout(toastTimer);
      // Cancel any ongoing speech
      window.speechSynthesis.cancel();
    };
  }, [isAuthenticated, navigate]);

  useEffect(() => {
    (window as any).api.auth.getSession().then((val: boolean) => {
      setIsAuthenticated(val);
      setSessionLoaded(true);
    });
  }, []);

  if (errorMsg)
    return (
      <div className="flex h-screen items-center justify-center text-white bg-red-900 p-8 break-all">
        Critical Error: {errorMsg}
      </div>
    );
  if (isInitializing || !sessionLoaded)
    return (
      <div className="flex h-screen items-center justify-center text-white">
        Loading...
      </div>
    );

  const handleLogin = () => {
    setIsAuthenticated(true);
    (window as any).api.auth.setSession(true);
    navigate("/");
  };

  return (
    <ErrorBoundary>
      <>
        <Routes>
          <Route path="/login" element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <Login onLogin={handleLogin} />} />
          <Route
            path="/setup"
            element={
              <Setup
                onCreated={() => {
                  window.location.hash = "#/login";
                }}
              />
            }
          />

          {/* Protected Routes */}
          <Route
            path="/"
            element={
              isAuthenticated ? (
                <DashboardLayout />
              ) : (
                <Navigate to="/login" replace />
              )
            }
          >
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
          <div
            className={`fixed top-4 right-4 z-50 p-4 rounded-lg shadow-lg border transition-all transform duration-300 ${toast.type === "error"
              ? "bg-red-900/90 border-red-500 text-white"
              : "bg-emerald-900/90 border-emerald-500 text-white"
              }`}
          >
            <div className="flex items-center gap-3">
              {toast.type === "error" ? (
                <svg
                  className="w-6 h-6 text-red-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
              ) : (
                <svg
                  className="w-6 h-6 text-emerald-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              )}
              <span className="font-semibold">{toast.message}</span>
            </div>
          </div>
        )}
        {problemMember && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
            <div className="glass w-full max-w-md rounded-2xl p-6 border border-red-500/30 shadow-2xl relative text-center">
              {/* Close button - top right */}
              <button
                onClick={() => {
                  window.speechSynthesis.cancel();
                  setProblemMember(null);
                }}
                className="absolute top-3 right-3 w-8 h-8 flex items-center justify-center rounded-full bg-red-500/10 text-red-400 hover:bg-red-500/20 hover:text-red-300 transition-all"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>

              <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-4 border border-red-500/20">
                <svg
                  className="w-8 h-8 text-red-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">
                {problemMember.type === "expired" ? "Membership Expired" : "Membership Suspended"}
              </h2>
              <p className="text-gray-300 mb-6">
                <span className="font-semibold text-white">
                  {problemMember.member.firstName} {problemMember.member.lastName}
                </span>
                , your{" "}
                {problemMember.member.plan?.name ? (
                  <span className="font-semibold text-white">
                    {problemMember.member.plan?.name}
                  </span>
                ) : (
                  ""
                )}{" "}
                membership {problemMember.type === "expired" ? "expired on" : "was suspended on"}{" "}
                <span className="font-semibold text-red-400">
                  {new Date(problemMember.member.membershipEnd).toLocaleDateString(
                    "en-US",
                    { month: "long", day: "numeric" },
                  )}
                </span>
                .
              </p>
              <div className="flex gap-3 justify-center">
                <button
                  onClick={() => {
                    window.speechSynthesis.cancel();
                    setProblemMember(null);
                  }}
                  className="btn-secondary flex-1"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    const id = problemMember.member.id;
                    window.speechSynthesis.cancel();
                    setProblemMember(null);
                    navigate(`/members?renew=${id}`);
                  }}
                  className="btn-primary flex-1 bg-red-600 hover:bg-red-500 shadow-lg shadow-red-500/20 border-red-500"
                >
                  Renew
                </button>
              </div>
            </div>
          </div>
        )}
      </>
    </ErrorBoundary>
  );
}
