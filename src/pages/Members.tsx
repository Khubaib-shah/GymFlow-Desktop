import React, { useState, useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { buildWhatsAppUrl } from "../utils/whatsapp";

// Utility functions for masking and formatting
const formatCNIC = (value: string) => {
  const v = value.replace(/\D/g, "").substring(0, 13);
  if (v.length > 12)
    return `${v.substring(0, 5)}-${v.substring(5, 12)}-${v.substring(12)}`;
  if (v.length > 5) return `${v.substring(0, 5)}-${v.substring(5)}`;
  return v;
};

const formatPhone = (value: string) => {
  const v = value.replace(/\D/g, "").substring(0, 11);
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

const getDaysUntilExpiry = (membershipEnd: string | null) => {
  if (!membershipEnd) return null;
  const end = new Date(membershipEnd);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.ceil(
    (end.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
  );
  return diff;
};

export default function Members() {
  const [members, setMembers] = useState<any[]>([]);
  const [trainers, setTrainers] = useState<any[]>([]);
  const [plans, setPlans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState<any>({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    status: "LEAD",
    cnic: "",
    dob: "",
    gender: "",
    address: "",
    planId: "",
    trainerId: "",
  });
  const [createPaymentMethod, setCreatePaymentMethod] = useState("CASH");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [deviceSyncStatus, setDeviceSyncStatus] = useState<
    Record<
      string,
      { onDevice: boolean; employeeNo: number | null; deviceSynced: boolean }
    >
  >({});
  const [syncLoading, setSyncLoading] = useState(true);

  // Renew Modal State
  const [renewModalOpen, setRenewModalOpen] = useState(false);
  const [selectedRenewMember, setSelectedRenewMember] = useState<any>(null);
  const [selectedPlanId, setSelectedPlanId] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("CASH");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  // Enrollment modal state
  const [enrollModalOpen, setEnrollModalOpen] = useState(false);
  const [enrollMemberId, setEnrollMemberId] = useState<string | null>(null);
  const [enrollEmployeeNo, setEnrollEmployeeNo] = useState<number | null>(null);
  const [enrollMessage, setEnrollMessage] = useState<string>(
    "Please create the user on the device and place the finger when ready.",
  );
  const [enrollCountdown, setEnrollCountdown] = useState<number>(120);
  const enrollTimerRef = useRef<number | null>(null);
  const enrollCountdownRef = useRef<number | null>(null);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    return () => {
      if (enrollTimerRef.current) window.clearInterval(enrollTimerRef.current);
      if (enrollCountdownRef.current)
        window.clearInterval(enrollCountdownRef.current);
    };
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const renewId = params.get("renew");
    if (renewId && members.length > 0) {
      const member = members.find((m) => m.id === renewId);
      if (member) {
        openRenewModal(member);
        // Clear the query param
        navigate("/members", { replace: true });
      }
    }
  }, [location.search, members, navigate]);

  const fetchDeviceSyncStatus = async () => {
    setSyncLoading(true);
    try {
      const res = await (window as any).api.members.getDeviceSyncStatus();
      if (res?.success && Array.isArray(res.data)) {
        const map: Record<
          string,
          {
            onDevice: boolean;
            employeeNo: number | null;
            deviceSynced: boolean;
          }
        > = {};
        for (const s of res.data) {
          map[s.id] = {
            onDevice: s.onDevice,
            employeeNo: s.employeeNo,
            deviceSynced: s.deviceSynced,
          };
        }
        setDeviceSyncStatus(map);
      }
    } catch {
      // ignore
    } finally {
      setSyncLoading(false);
    }
  };

  const closeEnrollModal = () => {
    if (enrollTimerRef.current) {
      window.clearInterval(enrollTimerRef.current);
      enrollTimerRef.current = null;
    }
    if (enrollCountdownRef.current) {
      window.clearInterval(enrollCountdownRef.current);
      enrollCountdownRef.current = null;
    }
    setEnrollModalOpen(false);
    setEnrollMemberId(null);
    setEnrollEmployeeNo(null);
    setEnrollCountdown(120);
  };

  const fetchMembers = async () => {
    setLoading(true);
    const data = await (window as any).api.members.getAll();
    setMembers(data);
    console.log("[Members UI] Fetched members:", data);
    setLoading(false);
  };

  useEffect(() => {
    fetchMembers();
    fetchDeviceSyncStatus();
    (window as any).api.trainers.getAll().then(setTrainers);
    (window as any).api.plans.getAll().then(setPlans);
  }, []);

  const openModal = (member?: any) => {
    if (member) {
      setFormData({
        ...member,
        dob: member.dob ? new Date(member.dob).toISOString().split("T")[0] : "",
        planId: member.planId || "",
        trainerId: member.trainerId || "",
        cnic: member.cnic || "",
        gender: member.gender || "",
        address: member.address || "",
      });
      setEditingId(member.id);
    } else {
      setFormData({
        firstName: "",
        lastName: "",
        email: "",
        phone: "",
        status: "LEAD",
        cnic: "",
        dob: "",
        gender: "",
        address: "",
        planId: "",
        trainerId: "",
      });
      setCreatePaymentMethod("CASH");
      setEditingId(null);
    }
    setErrorMsg("");
    setIsModalOpen(true);
  };

  // Whether the new member form should ask for payment (has plan and is ACTIVE)
  const newMemberNeedsPayment =
    !editingId && formData.planId && formData.status === "ACTIVE";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");

    // Validations
    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      setErrorMsg("Please enter a valid email address.");
      return;
    }

    if (formData.dob) {
      const age = calculateAge(formData.dob);
      if (age > 65) {
        setErrorMsg("The member cannot be over 65 years old.");
        return;
      }
      if (age < 12) {
        setErrorMsg("The member must be at least 12 years old.");
        return;
      }
    }

    if (formData.cnic && formData.cnic.length !== 15) {
      setErrorMsg("Please enter a valid 13-digit CNIC.");
      return;
    }

    if (formData.phone && formData.phone.length !== 12) {
      setErrorMsg("Please enter a valid 11-digit phone number.");
      return;
    }

    // Prepare data for Prisma
    const dataToSave = { ...formData };
    if (!dataToSave.planId) dataToSave.planId = null;
    if (!dataToSave.trainerId) dataToSave.trainerId = null;
    if (!dataToSave.cnic) dataToSave.cnic = null;
    if (dataToSave.dob) dataToSave.dob = new Date(dataToSave.dob).toISOString();
    else dataToSave.dob = null;

    // Auto-calculate membership dates for new ACTIVE members with a plan
    if (!editingId && dataToSave.status === "ACTIVE" && dataToSave.planId) {
      const selectedPlan = plans.find((p: any) => p.id === dataToSave.planId);
      if (selectedPlan) {
        const today = new Date();
        dataToSave.membershipStart = today.toISOString();
        const endDate = new Date(today);
        endDate.setDate(endDate.getDate() + selectedPlan.durationDays);
        dataToSave.membershipEnd = endDate.toISOString();
      }
    }

    if (editingId) {
      const {
        id,
        createdAt,
        updatedAt,
        plan,
        trainer,
        attendances,
        employeeNo,
        deviceSynced,
        ...updateData
      } = dataToSave;
      await (window as any).api.members.update(editingId, updateData);
    } else {
      const newMember = await (window as any).api.members.create(dataToSave);

      // If new active member with a plan, create initial payment (plan fee + admission fee)
      if (newMember && dataToSave.planId && dataToSave.status === "ACTIVE") {
        const plan = plans.find((p: any) => p.id === dataToSave.planId);
        const admissionFee = parseFloat(
          localStorage.getItem("admission_fee") || "0",
        );
        const totalAmount = (plan?.price || 0) + admissionFee;
        await (window as any).api.payments.create({
          memberId: newMember.id,
          planId: dataToSave.planId,
          amount: totalAmount,
          method: createPaymentMethod,
          notes:
            admissionFee > 0
              ? `Admission Fee (Rs ${admissionFee}) + Plan Fee (Rs ${plan?.price || 0})`
              : "Initial Subscription",
        });
      }

      // Device sync feedback
      if (
        newMember &&
        newMember.deviceSynced === false &&
        newMember.deviceError
      ) {
        // If error mentions enrollment/ enroll operator, open enrollment modal and poll member record
        const msg = String(newMember.deviceError || "").toLowerCase();
        // Open operator enrollment modal for any device errors that indicate remote/manual enrollment
        if (
          msg.includes("enroll") ||
          msg.includes("create user") ||
          msg.includes("manual") ||
          msg.includes("remote") ||
          msg.includes("not supported")
        ) {
          setEnrollMemberId(newMember.id);
          setEnrollEmployeeNo(newMember.employeeNo ?? null);
          const uiMessage =
            newMember.deviceError ||
            newMember.error ||
            "Please enroll on device";
          setEnrollMessage(uiMessage);
          setEnrollCountdown(120);
          setEnrollModalOpen(true);
          console.info(
            "[Members UI] Opening enrollment modal for member",
            newMember.id,
            "employeeNo",
            newMember.employeeNo,
            "msg:",
            msg,
            "uiMessage:",
            uiMessage,
          );
          try {
            window.alert(`Please enroll fingerprint on the device for user ID ${newMember.employeeNo}.
\n${uiMessage}`);
          } catch { }

          // start polling member record for deviceSynced
          if (enrollTimerRef.current)
            window.clearInterval(enrollTimerRef.current);
          enrollTimerRef.current = window.setInterval(async () => {
            try {
              const refreshed = await (window as any).api.members.getById(
                newMember.id,
              );
              if (refreshed?.deviceSynced) {
                // success
                window.clearInterval(enrollTimerRef.current!);
                enrollTimerRef.current = null;
                if (enrollCountdownRef.current)
                  window.clearInterval(enrollCountdownRef.current);
                enrollCountdownRef.current = null;
                setEnrollModalOpen(false);
                fetchMembers();
                return;
              }
            } catch {
              // ignore
            }
          }, 2000) as unknown as number;

          // countdown timer
          if (enrollCountdownRef.current)
            window.clearInterval(enrollCountdownRef.current);
          enrollCountdownRef.current = window.setInterval(() => {
            setEnrollCountdown((c) => {
              if (c <= 1) {
                // timeout
                if (enrollCountdownRef.current)
                  window.clearInterval(enrollCountdownRef.current!);
                enrollCountdownRef.current = null;
                if (enrollTimerRef.current)
                  window.clearInterval(enrollTimerRef.current);
                enrollTimerRef.current = null;
                setEnrollModalOpen(false);
                return 0;
              }
              return c - 1;
            });
          }, 1000) as unknown as number;
        } else {
          alert(
            `⚠️ Member saved locally but could not sync to device.\n\nReason: ${newMember.deviceError}\n\nYou can sync later from Settings.`,
          );
        }
      }
    }
    setIsModalOpen(false);
    fetchMembers();
    fetchDeviceSyncStatus();
  };

  const handleDelete = async (id: string) => {
    if (confirm("Are you sure you want to delete this member?")) {
      await (window as any).api.members.delete(id);
      fetchMembers();
      fetchDeviceSyncStatus();
    }
  };

  const openRenewModal = (member: any) => {
    setSelectedRenewMember(member);
    setSelectedPlanId(member.planId || (plans.length > 0 ? plans[0].id : ""));
    setPaymentMethod("CASH");
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
      membershipStart:
        selectedRenewMember.membershipEnd &&
          new Date(selectedRenewMember.membershipEnd) > new Date()
          ? selectedRenewMember.membershipStart
          : new Date().toISOString(),
      membershipEnd: newEndDate.toISOString(),
      status: "ACTIVE",
    });

    // Calculate total: plan price + admission fee for SUSPENDED members
    const isSuspended = selectedRenewMember.status === "SUSPENDED";
    const admissionFee = isSuspended
      ? parseFloat(localStorage.getItem("admission_fee") || "0")
      : 0;
    const totalAmount = plan.price + admissionFee;

    await (window as any).api.payments.create({
      memberId: selectedRenewMember.id,
      planId: selectedPlanId,
      amount: totalAmount,
      method: paymentMethod,
      notes:
        isSuspended && admissionFee > 0
          ? `Subscription Renewal + Re-Admission Fee (Rs ${admissionFee})`
          : "Subscription Renewal",
    });

    setRenewModalOpen(false);
    fetchMembers();
  };

  const statusCounts = {
    ALL: members.length,
    LEAD: members.filter((m) => m.status === "LEAD").length,
    ACTIVE: members.filter((m) => m.status === "ACTIVE").length,
    EXPIRED: members.filter((m) => m.status === "EXPIRED").length,
    INACTIVE: members.filter((m) => m.status === "INACTIVE").length,
    SUSPENDED: members.filter((m) => m.status === "SUSPENDED").length,
  };

  const filteredMembers = members.filter((m) => {
    const term = searchQuery.toLowerCase();
    const matchesSearch =
      m.firstName.toLowerCase().includes(term) ||
      (m.lastName && m.lastName.toLowerCase().includes(term)) ||
      (m.cnic && m.cnic.toLowerCase().includes(term)) ||
      (m.phone && m.phone.toLowerCase().includes(term)) ||
      (m.email && m.email.toLowerCase().includes(term));
    const matchesStatus = statusFilter === "ALL" || m.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const filterConfig: {
    key: string;
    label: string;
    color: string;
    activeColor: string;
  }[] = [
      {
        key: "ALL",
        label: "All Members",
        color:
          "border-[#2a2e37] text-gray-400 hover:text-white hover:border-gray-500",
        activeColor: "bg-white/10 border-white/30 text-white",
      },
      {
        key: "LEAD",
        label: "Leads",
        color:
          "border-[#2a2e37] text-gray-400 hover:text-blue-400 hover:border-blue-500/40",
        activeColor: "bg-blue-500/10 border-blue-500/40 text-blue-400",
      },
      {
        key: "ACTIVE",
        label: "Active",
        color:
          "border-[#2a2e37] text-gray-400 hover:text-green-400 hover:border-green-500/40",
        activeColor: "bg-green-500/10 border-green-500/40 text-green-400",
      },
      {
        key: "EXPIRED",
        label: "Expired",
        color:
          "border-[#2a2e37] text-gray-400 hover:text-red-400 hover:border-red-500/40",
        activeColor: "bg-red-500/10 border-red-500/40 text-red-400",
      },
      {
        key: "INACTIVE",
        label: "Inactive",
        color:
          "border-[#2a2e37] text-gray-400 hover:text-yellow-400 hover:border-yellow-500/40",
        activeColor: "bg-yellow-500/10 border-yellow-500/40 text-yellow-400",
      },
      {
        key: "SUSPENDED",
        label: "Suspended",
        color:
          "border-[#2a2e37] text-gray-400 hover:text-orange-400 hover:border-orange-500/40",
        activeColor: "bg-orange-500/10 border-orange-500/40 text-orange-400",
      },
    ];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">
            Members
          </h1>
          <p className="text-gray-400 mt-1">
            Manage your gym members and their subscriptions.
          </p>
        </div>
        <div className="flex gap-4">
          <div className="relative">
            <svg
              className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            <input
              type="text"
              placeholder="Search members..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-[#0f1115] border border-[#2a2e37] text-white text-sm rounded-lg focus:ring-primary-500 focus:border-primary-500 block w-64 pl-10 p-2.5 transition-colors"
            />
          </div>
          <button
            onClick={fetchDeviceSyncStatus}
            disabled={syncLoading}
            className="btn-secondary flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <svg
              className={`w-5 h-5 ${syncLoading ? 'animate-spin' : ''}`}
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
            Sync
          </button>
          <button
            onClick={() => openModal()}
            className="btn-primary flex items-center gap-2 shadow-lg shadow-primary-600/20"
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
                d="M12 4v16m8-8H4"
              />
            </svg>
            Add Member
          </button>
        </div>
      </div>

      {/* Status Filter Pills */}
      <div className="flex items-center gap-2 flex-wrap">
        {filterConfig.map((f) => (
          <button
            key={f.key}
            onClick={() => setStatusFilter(f.key)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm font-medium transition-all ${statusFilter === f.key ? f.activeColor : f.color
              }`}
          >
            {f.label}
            <span
              className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${statusFilter === f.key ? "bg-white/20" : "bg-[#1a1d24]"
                }`}
            >
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
                <th className="px-6 py-4 font-medium">Name &amp; CNIC</th>
                <th className="px-6 py-4 font-medium">Contact</th>
                <th className="px-6 py-4 font-medium">Status</th>
                <th className="px-6 py-4 font-medium">Plan &amp; Trainer</th>
                <th className="px-6 py-4 font-medium">Device</th>
                <th className="px-6 py-4 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#2a2e37]">
              {loading ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-6 py-8 text-center text-gray-500"
                  >
                    Loading members...
                  </td>
                </tr>
              ) : filteredMembers.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-6 py-8 text-center text-gray-500"
                  >
                    {searchQuery
                      ? "No members match your search."
                      : "No members found. Add one to get started."}
                  </td>
                </tr>
              ) : (
                filteredMembers.map((member) => {
                  const daysLeft = getDaysUntilExpiry(member.membershipEnd);
                  const isExpiringSoon =
                    daysLeft !== null &&
                    daysLeft >= 0 &&
                    daysLeft <= 7 &&
                    member.status === "ACTIVE";
                  const whatsappUrl = buildWhatsAppUrl(member);

                  return (
                    <tr
                      key={member.id}
                      className="hover:bg-[#1a1d24]/50 transition-colors"
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-primary-600/20 text-primary-500 flex items-center justify-center font-bold">
                            {member.firstName[0]}
                            {member.lastName ? member.lastName[0] : ""}
                          </div>
                          <div>
                            <div className="font-medium text-white">
                              {member.firstName} {member.lastName || ""}
                            </div>
                            <div className="text-xs text-gray-500">
                              {member.cnic || "No CNIC"}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-gray-300">
                          {member.phone || "N/A"}
                        </div>
                        <div className="text-xs text-gray-500">
                          {member.email || "N/A"}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col gap-1">
                          <span
                            className={`px-2.5 py-1 rounded-full text-xs font-medium w-fit ${member.status === "ACTIVE"
                              ? "bg-green-500/10 text-green-400 border border-green-500/20"
                              : member.status === "LEAD"
                                ? "bg-blue-500/10 text-blue-400 border border-blue-500/20"
                                : member.status === "EXPIRED"
                                  ? "bg-red-500/10 text-red-400 border border-red-500/20"
                                  : member.status === "INACTIVE"
                                    ? "bg-yellow-500/10 text-yellow-400 border border-yellow-500/20"
                                    : member.status === "SUSPENDED"
                                      ? "bg-orange-500/10 text-orange-400 border border-orange-500/20"
                                      : "bg-gray-500/10 text-gray-400 border border-gray-500/20"
                              }`}
                          >
                            {member.status}
                          </span>
                          {isExpiringSoon && (
                            <span className="text-xs text-amber-400 font-medium">
                              ⚠ Expires in {daysLeft}d
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-gray-300">
                          {member.plan?.name || "No Plan"}
                        </div>
                        <div className="text-xs text-gray-500">
                          Trainer:{" "}
                          {member.trainer
                            ? `${member.trainer.firstName} ${member.trainer.lastName || ""}`
                            : "None"}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col gap-1 text-xs">
                          {member.employeeNo && (
                            <span className="text-gray-400">
                              ID: {member.employeeNo}
                            </span>
                          )}
                          {(() => {
                            if (syncLoading) {
                              return (
                                <span className="text-gray-400 text-xs animate-pulse">Checking...</span>
                              );
                            }
                            const sync = deviceSyncStatus[member.id];
                            if (!sync) return null;

                            if (!member.employeeNo && !sync.onDevice) {
                              return (
                                <span className="text-gray-500">Not on Device</span>

                              );
                            }
                          })()}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {/* WhatsApp button — only shown if member has a phone */}
                          {whatsappUrl && (
                            <a
                              href={whatsappUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              title="Send WhatsApp message"
                              className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-green-500/10 text-green-400 hover:bg-green-500/20 hover:text-green-300 transition-all border border-green-500/20 hover:border-green-500/40"
                            >
                              {/* WhatsApp Icon */}
                              <svg
                                className="w-4 h-4"
                                viewBox="0 0 24 24"
                                fill="currentColor"
                              >
                                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                              </svg>
                            </a>
                          )}
                          <button
                            onClick={() => openRenewModal(member)}
                            className="text-primary-400 hover:text-primary-300 transition-colors font-medium text-sm"
                          >
                            Renew
                          </button>
                          <button
                            onClick={() => openModal(member)}
                            className="text-gray-400 hover:text-white transition-colors text-sm"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDelete(member.id)}
                            className="text-gray-400 hover:text-red-400 transition-colors text-sm"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Member Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="glass w-full max-w-lg rounded-2xl p-6 border border-[#2a2e37] shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold text-white mb-4">
              {editingId ? "Edit Member" : "Add Member"}
            </h2>
            {errorMsg && (
              <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg text-sm">
                {errorMsg}
              </div>
            )}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">
                    First Name
                  </label>
                  <input
                    required
                    type="text"
                    className="input-field"
                    value={formData.firstName}
                    onChange={(e) =>
                      setFormData({ ...formData, firstName: e.target.value })
                    }
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">
                    Last Name
                  </label>
                  <input
                    type="text"
                    className="input-field"
                    value={formData.lastName || ""}
                    onChange={(e) =>
                      setFormData({ ...formData, lastName: e.target.value })
                    }
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">
                    Email
                  </label>
                  <input
                    type="email"
                    className="input-field"
                    value={formData.email || ""}
                    onChange={(e) =>
                      setFormData({ ...formData, email: e.target.value })
                    }
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">
                    Phone
                  </label>
                  <input
                    type="text"
                    placeholder="03XX-XXXXXXX"
                    className="input-field"
                    value={formData.phone || ""}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        phone: formatPhone(e.target.value),
                      })
                    }
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">
                    CNIC / National ID
                  </label>
                  <input
                    type="text"
                    placeholder="XXXXX-XXXXXXX-X"
                    className="input-field"
                    value={formData.cnic || ""}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        cnic: formatCNIC(e.target.value),
                      })
                    }
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">
                    Date of Birth
                  </label>
                  <input
                    type="date"
                    className="input-field"
                    value={formData.dob || ""}
                    onChange={(e) =>
                      setFormData({ ...formData, dob: e.target.value })
                    }
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">
                    Gender
                  </label>
                  <select
                    className="input-field"
                    value={formData.gender || ""}
                    onChange={(e) =>
                      setFormData({ ...formData, gender: e.target.value })
                    }
                  >
                    <option value="">Select Gender</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">
                    Address
                  </label>
                  <input
                    type="text"
                    className="input-field"
                    value={formData.address || ""}
                    onChange={(e) =>
                      setFormData({ ...formData, address: e.target.value })
                    }
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">
                    Status
                  </label>
                  <select
                    className="input-field"
                    value={formData.status}
                    onChange={(e) =>
                      setFormData({ ...formData, status: e.target.value })
                    }
                  >
                    <option value="LEAD">Lead</option>
                    <option value="ACTIVE">Active</option>
                    <option value="INACTIVE">Inactive</option>
                    <option value="SUSPENDED">Suspended</option>
                    <option value="EXPIRED">Expired</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">
                    Plan
                  </label>
                  <select
                    className="input-field"
                    value={formData.planId || ""}
                    onChange={(e) => {
                      const planId = e.target.value;
                      const status =
                        planId && formData.status === "LEAD"
                          ? "ACTIVE"
                          : formData.status;
                      setFormData({ ...formData, planId, status });
                    }}
                  >
                    <option value="">No Plan</option>
                    {plans.map((p: any) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">
                    Trainer
                  </label>
                  <select
                    className="input-field"
                    value={formData.trainerId || ""}
                    onChange={(e) =>
                      setFormData({ ...formData, trainerId: e.target.value })
                    }
                  >
                    <option value="">No Trainer</option>
                    {trainers.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.firstName} {t.lastName}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Payment section: only for new ACTIVE members with a plan */}
              {newMemberNeedsPayment &&
                (() => {
                  const selectedPlan = plans.find(
                    (p: any) => p.id === formData.planId,
                  );
                  const admissionFee = parseFloat(
                    localStorage.getItem("admission_fee") || "0",
                  );
                  const total = (selectedPlan?.price || 0) + admissionFee;
                  return (
                    <div className="border-t border-[#2a2e37] pt-4 space-y-3">
                      <p className="text-sm font-semibold text-primary-400 flex items-center gap-2">
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
                            d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"
                          />
                        </svg>
                        Initial Payment
                      </p>
                      <div>
                        <label className="block text-sm font-medium text-gray-400 mb-1">
                          Payment Method
                        </label>
                        <select
                          className="input-field"
                          value={createPaymentMethod}
                          onChange={(e) =>
                            setCreatePaymentMethod(e.target.value)
                          }
                        >
                          <option value="CASH">Cash</option>
                          <option value="ONLINE">Online</option>
                        </select>
                      </div>
                      <div className="bg-[#0f1115] p-3 rounded-lg border border-[#2a2e37] text-sm space-y-1">
                        <div className="flex justify-between text-gray-400">
                          <span>Plan Fee:</span>
                          <span className="text-white">
                            Rs {selectedPlan?.price?.toFixed(2) || "0.00"}
                          </span>
                        </div>
                        {admissionFee > 0 && (
                          <div className="flex justify-between text-gray-400">
                            <span>Admission Fee:</span>
                            <span className="text-white">
                              Rs {admissionFee.toFixed(2)}
                            </span>
                          </div>
                        )}
                        <div className="flex justify-between text-primary-400 font-bold border-t border-[#2a2e37] pt-1 mt-1">
                          <span>Total:</span>
                          <span>Rs {total.toFixed(2)}</span>
                        </div>
                      </div>
                    </div>
                  );
                })()}

              {/* Enrollment Modal */}
              {enrollModalOpen && enrollMemberId && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                  <div className="glass w-full max-w-md rounded-2xl p-6 border border-[#2a2e37] shadow-2xl relative">
                    <h2 className="text-lg font-bold text-white mb-2">
                      Enroll Fingerprint on Device
                    </h2>
                    <p className="text-sm text-gray-400 mb-4">
                      {enrollMessage}
                    </p>
                    <div className="bg-[#0f1115] p-3 rounded-lg border border-[#2a2e37] text-sm mb-4">
                      <div className="flex justify-between text-gray-400 mb-1">
                        <span>Member ID</span>
                        <span className="text-white">{enrollMemberId}</span>
                      </div>
                      <div className="flex justify-between text-gray-400">
                        <span>Device Employee No</span>
                        <span className="text-white">
                          {enrollEmployeeNo ?? "N/A"}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 mb-4">
                      <div className="flex-1">
                        <div className="text-xs text-gray-400">
                          Waiting for enrollment...
                        </div>
                        <div className="text-2xl font-bold text-white">
                          {enrollCountdown}s
                        </div>
                      </div>
                      <div className="w-12 h-12 rounded-full bg-primary-600/20 flex items-center justify-center text-primary-400 font-bold">
                        ⌛
                      </div>
                    </div>

                    <div className="flex justify-end gap-3">
                      <button
                        type="button"
                        onClick={closeEnrollModal}
                        className="btn-secondary"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          closeEnrollModal();
                          fetchMembers();
                        }}
                        className="btn-primary"
                      >
                        I'll enroll later
                      </button>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-[#2a2e37]">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="btn-secondary"
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  Save Member
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Renew Modal */}
      {renewModalOpen &&
        selectedRenewMember &&
        (() => {
          const isSuspended = selectedRenewMember.status === "SUSPENDED";
          const admissionFee = isSuspended
            ? parseFloat(localStorage.getItem("admission_fee") || "0")
            : 0;
          const selectedPlan = plans.find((p: any) => p.id === selectedPlanId);
          const totalAmount = (selectedPlan?.price || 0) + admissionFee;

          return (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
              <div className="glass w-full max-w-sm rounded-2xl p-6 border border-[#2a2e37] shadow-2xl relative animate-in zoom-in-95 duration-200">
                <h2 className="text-xl font-bold text-white mb-1">
                  Renew Subscription
                </h2>
                <p className="text-sm text-gray-400 mb-4">
                  Extend membership for {selectedRenewMember.firstName}.
                  {isSuspended && (
                    <span className="block mt-1 text-orange-400 text-xs">
                      ⚠ Suspended member — admission fee will be charged.
                    </span>
                  )}
                </p>

                <form onSubmit={submitRenew} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-1">
                      Select New Plan
                    </label>
                    <select
                      required
                      className="input-field"
                      value={selectedPlanId}
                      onChange={(e) => setSelectedPlanId(e.target.value)}
                    >
                      <option value="" disabled>
                        Select a plan...
                      </option>
                      {plans.map((p: any) => (
                        <option key={p.id} value={p.id}>
                          {p.name} ({p.durationDays} Days - Rs {p.price})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-1">
                      Payment Method
                    </label>
                    <select
                      className="input-field"
                      value={paymentMethod}
                      onChange={(e) => setPaymentMethod(e.target.value)}
                    >
                      <option value="CASH">Cash</option>
                      <option value="ONLINE">Online</option>
                    </select>
                  </div>

                  <div className="bg-[#0f1115] p-3 rounded-lg border border-[#2a2e37] text-sm text-gray-400 flex justify-between items-center">
                    <span>Current Expiration:</span>
                    <span className="text-white font-medium">
                      {selectedRenewMember.membershipEnd
                        ? new Date(
                          selectedRenewMember.membershipEnd,
                        ).toLocaleDateString()
                        : "None"}
                    </span>
                  </div>

                  {selectedPlan && (
                    <div className="bg-[#0f1115] p-3 rounded-lg border border-[#2a2e37] text-sm space-y-1">
                      <div className="flex justify-between text-gray-400">
                        <span>Plan Fee:</span>
                        <span className="text-white">
                          Rs {selectedPlan.price.toFixed(2)}
                        </span>
                      </div>
                      {isSuspended && admissionFee > 0 && (
                        <div className="flex justify-between text-orange-400">
                          <span>Re-Admission Fee:</span>
                          <span>Rs {admissionFee.toFixed(2)}</span>
                        </div>
                      )}
                      <div className="flex justify-between text-primary-400 font-bold border-t border-[#2a2e37] pt-1 mt-1">
                        <span>Total to Pay:</span>
                        <span className="text-white text-lg">
                          Rs {totalAmount.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  )}

                  <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-[#2a2e37]">
                    <button
                      type="button"
                      onClick={() => setRenewModalOpen(false)}
                      className="btn-secondary"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="btn-primary"
                      disabled={!selectedPlanId || plans.length === 0}
                    >
                      Confirm Renewal
                    </button>
                  </div>
                </form>
              </div>
            </div>
          );
        })()}
    </div>
  );
}
