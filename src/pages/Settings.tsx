import React, { useState, useEffect } from "react";

export default function Settings() {
  const [admissionFee, setAdmissionFee] = useState("4000");
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetting, setResetting] = useState(false);

  const [enabled, setEnabled] = useState(false);
  const [deviceType, setDeviceType] = useState("zkteco-k70");
  const [ip, setIp] = useState("");
  const [port, setPort] = useState("4370");
  const [timeout, setTimeout] = useState("10000");
  const [pollInterval, setPollInterval] = useState("5000");
  const [status, setStatus] = useState<
    "idle" | "checking" | "connected" | "offline"
  >("idle");
  const [deviceInfo, setDeviceInfo] = useState<any>(null);
  const [deviceStatus, setDeviceStatus] = useState<any>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setAdmissionFee(localStorage.getItem("admission_fee") || "4000");

    (window as any).api.device
      .getSettings()
      .then((response: any) => {
        const config = response?.data ?? response;
        setEnabled(Boolean(config?.enabled));
        setDeviceType(config?.deviceType || "zkteco-k70");
        setIp(config?.ip || "");
        setPort(String(config?.port || 4370));
        setTimeout(String(config?.timeout || 10000));
        setPollInterval(String(config?.pollInterval || 5000));
      })
      .catch(() => undefined);

    (window as any).api.device
      .getStatus()
      .then((res: any) => {
        const s = res?.data ?? res;
        if (s?.connected) setStatus("connected");
        else if (s?.status === "connecting") setStatus("checking");
        else setStatus("offline");
        setDeviceStatus(s);
      })
      .catch(() => undefined);

    const api = (window as any).api;
    let cleanupStatus: (() => void) | undefined;
    if (api?.device?.onStatusChange) {
      cleanupStatus = api.device.onStatusChange((s: any) => {
        setDeviceStatus(s);
        if (s?.connected) {
          setStatus("connected");
          setError("");
        } else if (s?.status === "connecting") {
          setStatus("checking");
        } else {
          setStatus("offline");
          if (s?.message) setError(s.message);
        }
      });
    }

    return () => {
      if (cleanupStatus) cleanupStatus();
    };
  }, []);

  const saveSettings = () => {
    localStorage.setItem("admission_fee", admissionFee);
    alert("Settings saved locally.");
  };

  const saveDeviceSettings = async () => {
    setSaving(true);
    try {
      const response = await (window as any).api.device.saveSettings({
        enabled,
        deviceType,
        ip,
        port: Number(port),
        timeout: Number(timeout),
        pollInterval: Number(pollInterval),
      });
      if (response?.success) {
        alert("ZKTeco settings saved and applied.");
      } else {
        alert(response?.error || "Unable to save ZKTeco settings.");
      }
    } catch (err: any) {
      alert(err?.message || "Unable to save ZKTeco settings.");
    } finally {
      setSaving(false);
    }
  };

  const testDeviceConnection = async () => {
    setStatus("checking");
    setError("");
    setDeviceInfo(null);

    try {
      const saved = await (window as any).api.device.saveSettings({
        enabled,
        deviceType,
        ip,
        port: Number(port),
        timeout: Number(timeout),
        pollInterval: Number(pollInterval),
      });
      if (!saved?.success) throw new Error(saved?.error || "Invalid settings");
      const result = await (window as any).api.device.testConnection();
      if (result?.success) {
        setStatus("connected");
        setDeviceInfo(result.data);
      } else {
        setStatus("offline");
        setError(result?.error || "Device unreachable");
      }
    } catch (err: any) {
      setStatus("offline");
      setError(err.message || "Connection failed");
    }
  };

  const connectDevice = async () => {
    setStatus("checking");
    setError("");
    try {
      const result = await (window as any).api.device.connect();
      if (result?.success) {
        setStatus("connected");
      } else {
        setStatus("offline");
        setError(result?.error || "Connect failed");
      }
    } catch (err: any) {
      setStatus("offline");
      setError(err.message || "Connect failed");
    }
  };

  const disconnectDevice = async () => {
    try {
      await (window as any).api.device.disconnect();
      setStatus("offline");
      setError("Device disconnected");
    } catch (err: any) {
      setError(err.message || "Disconnect failed");
    }
  };

  const reconnectDevice = async () => {
    setStatus("checking");
    setError("");
    try {
      const result = await (window as any).api.device.reconnect();
      if (result?.success) {
        setStatus("connected");
      } else {
        setStatus("offline");
        setError(result?.error || "Reconnect failed");
      }
    } catch (err: any) {
      setStatus("offline");
      setError(err.message || "Reconnect failed");
    }
  };

  const handleBackup = async () => {
    const res = await (window as any).api.system.backupDb();
    if (res.success) {
      alert(`Database successfully backed up to:\n${res.filePath}`);
    } else {
      if (res.error !== "User canceled") alert(`Backup failed: ${res.error}`);
    }
  };

  const handleRestore = async () => {
    if (
      confirm(
        "Warning: Restoring will overwrite the current database and restart the application. Continue?",
      )
    ) {
      const res = await (window as any).api.system.restoreDb();
      if (!res.success && res.error !== "User canceled") {
        alert(`Restore failed: ${res.error}`);
      }
    }
  };

  const handleReset = async () => {
    setResetting(true);
    try {
      const res = await (window as any).api.system.resetDb();
      if (res.success) {
        setShowResetModal(false);
        window.location.reload();
      } else {
        alert(`Reset failed: ${res.error}`);
      }
    } catch (err: any) {
      alert(`Reset failed: ${err.message}`);
    } finally {
      setResetting(false);
    }
  };

  return (
    <div className="max-w-4xl space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-white tracking-tight">
          Settings
        </h1>
        <p className="text-gray-400 mt-1">
          Configure local hardware and system preferences.
        </p>
      </div>

      <div className="glass rounded-xl p-6 border border-dark-border">
        <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
          <svg
            className="w-5 h-5 text-primary-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z"
            />
          </svg>
          ZKTeco K70 Device
          {status === "connected" && (
            <span className="ml-auto text-xs font-medium px-2.5 py-1 rounded-full bg-green-500/10 text-green-400 border border-green-500/20">
              ● Connected
            </span>
          )}
          {status === "offline" && (
            <span className="ml-auto text-xs font-medium px-2.5 py-1 rounded-full bg-red-500/10 text-red-400 border border-red-500/20">
              ● Offline
            </span>
          )}
          {status === "checking" && (
            <span className="ml-auto text-xs font-medium px-2.5 py-1 rounded-full bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 flex items-center gap-1.5">
              <svg
                className="animate-spin w-3 h-3"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                ></circle>
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                ></path>
              </svg>
              Testing...
            </span>
          )}
        </h2>

        <div className="grid grid-cols-2 gap-6">
          <div className="col-span-2">
            <label className="inline-flex items-center gap-2 text-sm font-medium text-gray-400">
              <input
                type="checkbox"
                checked={enabled}
                onChange={(e) => setEnabled(e.target.checked)}
                className="rounded border-gray-600 bg-transparent"
              />
              Enable Device
            </label>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1.5">
              Device Type
            </label>
            <input
              type="text"
              value={deviceType}
              onChange={(e) => setDeviceType(e.target.value)}
              className="input-field"
              disabled
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1.5">
              IP Address
            </label>
            <input
              type="text"
              value={ip}
              onChange={(e) => setIp(e.target.value)}
              className="input-field"
              placeholder="192.168.1.201"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1.5">
              Port
            </label>
            <input
              type="text"
              value={port}
              onChange={(e) => setPort(e.target.value)}
              className="input-field"
              placeholder="4370"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1.5">
              Timeout (ms)
            </label>
            <input
              type="text"
              value={timeout}
              onChange={(e) => setTimeout(e.target.value)}
              className="input-field"
              placeholder="10000"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1.5">
              Polling Interval (ms)
            </label>
            <input
              type="text"
              value={pollInterval}
              onChange={(e) => setPollInterval(e.target.value)}
              className="input-field"
              placeholder="5000"
            />
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button
            onClick={connectDevice}
            disabled={status === "checking"}
            className="btn-secondary flex items-center gap-2"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 10V3L4 14h7v7l9-11h-7z"
              />
            </svg>
            Connect
          </button>
          <button
            onClick={disconnectDevice}
            className="btn-secondary flex items-center gap-2"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"
              />
            </svg>
            Disconnect
          </button>
          <button
            onClick={reconnectDevice}
            disabled={status === "checking"}
            className="btn-secondary flex items-center gap-2"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
            Reconnect
          </button>
        </div>

        {(deviceInfo || deviceStatus) && (
          <div className="mt-4 p-4 rounded-lg bg-[#0f1115] border border-[#2a2e37] text-sm space-y-2">
            <h3 className="text-white font-semibold mb-2">
              Device Status Card
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <span className="text-gray-400">Device Name:</span>{" "}
                <span className="text-white ml-2">
                  {deviceStatus?.deviceName ||
                    deviceInfo?.deviceName ||
                    "ZKTeco K70"}
                </span>
              </div>
              <div>
                <span className="text-gray-400">IP:</span>{" "}
                <span className="text-white ml-2">{ip || "N/A"}</span>
              </div>
              <div>
                <span className="text-gray-400">Port:</span>{" "}
                <span className="text-white ml-2">{port || "N/A"}</span>
              </div>
              <div>
                <span className="text-gray-400">Status:</span>{" "}
                <span
                  className={`ml-2 ${status === "connected" ? "text-green-400" : "text-red-400"}`}
                >
                  {status === "connected" ? "Connected" : "Disconnected"}
                </span>
              </div>
              <div>
                <span className="text-gray-400">Last Connected:</span>{" "}
                <span className="text-white ml-2">
                  {deviceStatus?.lastConnectedAt
                    ? new Date(deviceStatus.lastConnectedAt).toLocaleString()
                    : "N/A"}
                </span>
              </div>
              <div>
                <span className="text-gray-400">Last Error:</span>{" "}
                <span className="text-white ml-2">
                  {deviceStatus?.message || error || "None"}
                </span>
              </div>
              <div>
                <span className="text-gray-400">User Count:</span>{" "}
                <span className="text-white ml-2">
                  {deviceInfo?.userCount ?? "Unknown"}
                </span>
              </div>
              <div>
                <span className="text-gray-400">Attendance Count:</span>{" "}
                <span className="text-white ml-2">
                  {deviceInfo?.attendanceCount ?? "Unknown"}
                </span>
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="mt-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
            {error}
          </div>
        )}

        {deviceInfo && !deviceStatus && (
          <div className="mt-4 p-3 rounded-lg bg-green-500/10 border border-green-500/20 text-green-400 text-sm space-y-1">
            <p>
              <strong>User Count:</strong> {deviceInfo.userCount ?? "Unknown"}
            </p>
            <p>
              <strong>Attendance Count:</strong>{" "}
              {deviceInfo.attendanceCount ?? "Unknown"}
            </p>
            <p>
              <strong>Status:</strong> {deviceInfo.status || "Connected"}
            </p>
          </div>
        )}

        <div className="flex gap-3 mt-6">
          <button
            onClick={testDeviceConnection}
            disabled={status === "checking"}
            className="btn-secondary flex items-center gap-2"
          >
            {status === "checking" ? (
              <>
                <svg
                  className="animate-spin w-4 h-4"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  ></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                  ></path>
                </svg>
                Testing...
              </>
            ) : (
              <>
                <svg
                  className="w-4 h-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 10V3L4 14h7v7l9-11h-7z"
                  />
                </svg>
                Test Connection
              </>
            )}
          </button>
          <button
            onClick={saveDeviceSettings}
            disabled={saving}
            className="btn-primary"
          >
            {saving ? "Saving..." : "Save Device Settings"}
          </button>
        </div>
      </div>

      <div className="glass rounded-xl p-6 border border-dark-border">
        <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
          <svg
            className="w-5 h-5 text-primary-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          Financial Settings
        </h2>

        <div className="grid grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1.5">
              Admission Fee (Rs)
            </label>
            <input
              type="number"
              value={admissionFee}
              onChange={(e) => setAdmissionFee(e.target.value)}
              className="input-field"
            />
          </div>
        </div>

        <button onClick={saveSettings} className="btn-primary mt-6">
          Save Settings
        </button>
      </div>

      <div className="glass rounded-xl p-6 border border-dark-border">
        <h2 className="text-xl font-bold text-white mb-1 flex items-center gap-2">
          <svg
            className="w-5 h-5 text-primary-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4"
            />
          </svg>
          Database Management
        </h2>
        <p className="text-sm text-gray-500 mb-5">
          Backup, restore from a file, or wipe all data.
        </p>

        <div className="flex gap-4">
          <button
            onClick={handleBackup}
            className="btn-secondary flex-1 flex items-center justify-center gap-2"
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
                d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4"
              />
            </svg>
            Backup Database
          </button>

          <button
            onClick={handleRestore}
            className="btn-secondary flex-1 flex items-center justify-center gap-2 text-yellow-400 hover:text-yellow-300"
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
                d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"
              />
            </svg>
            Restore from File
          </button>

          <button
            onClick={() => setShowResetModal(true)}
            className="btn-secondary flex-1 flex items-center justify-center gap-2 text-red-400 hover:text-red-300 hover:bg-red-500/10 border-red-500/20"
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
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
              />
            </svg>
            Reset All Data
          </button>
        </div>
      </div>

      {showResetModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="glass w-full max-w-md rounded-2xl p-6 border border-red-500/30 shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center shrink-0">
                <svg
                  className="w-5 h-5 text-red-400"
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
              <div>
                <h3 className="text-lg font-bold text-white">Reset All Data</h3>
                <p className="text-sm text-gray-400">
                  This action cannot be undone.
                </p>
              </div>
            </div>
            <p className="text-gray-300 text-sm mb-6">
              This will permanently delete{" "}
              <strong className="text-white">
                all members, trainers, plans, attendance records, and payments
              </strong>
              . The app will reload automatically after the reset.
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setShowResetModal(false)}
                className="btn-secondary flex-1"
                disabled={resetting}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleReset}
                disabled={resetting}
                className="flex-1 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {resetting ? (
                  <>
                    <svg
                      className="animate-spin w-4 h-4"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      ></circle>
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                      ></path>
                    </svg>
                    Resetting...
                  </>
                ) : (
                  "Yes, Reset Everything"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
