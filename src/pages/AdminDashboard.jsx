import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { db } from "../firebase";
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  doc,
  updateDoc,
  deleteDoc,
  where,
  getDocs,
  getDoc,
} from "firebase/firestore";
import EditBalanceModal from "../components/EditBalanceModal";
import AddStaffModal from "../components/AddStaffModal";
import StaffHistoryModal from "../components/StaffHistoryModal";
import toast from "react-hot-toast";

export default function AdminDashboard() {
  const { user, logout } = useAuth();

  // --- DATA STATES ---
  const [leaves, setLeaves] = useState([]);
  const [staffList, setStaffList] = useState([]);
  const [presentUids, setPresentUids] = useState([]);

  // --- UI STATES ---
  const [activeFilter, setActiveFilter] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  // --- MODAL STATES ---
  const [isBalanceModalOpen, setIsBalanceModalOpen] = useState(false);
  const [isAddStaffOpen, setIsAddStaffOpen] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);

  const [selectedStaff, setSelectedStaff] = useState(null);

  // --- HELPERS ---
  const getTodayString = () => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const getInitials = (name) => {
    return (
      name
        ?.split(" ")
        .map((n) => n[0])
        .join("")
        .substring(0, 2)
        .toUpperCase() || "??"
    );
  };

  // --- DYNAMIC HEADER STYLING ---
  const getHeaderStyle = () => {
    switch (activeFilter) {
      case "PRESENT":
        return {
          title: "Present Staff",
          bg: "bg-green-50",
          text: "text-green-800",
          border: "border-green-100",
          icon: "✅",
        };
      case "ABSENT":
        return {
          title: "Absentees List",
          bg: "bg-red-50",
          text: "text-red-800",
          border: "border-red-100",
          icon: "🚨",
        };
      case "PENDING":
        return {
          title: "Pending Approvals",
          bg: "bg-orange-50",
          text: "text-orange-800",
          border: "border-orange-100",
          icon: "⏳",
        };
      default:
        return {
          title: "Staff Directory",
          bg: "bg-white",
          text: "text-gray-800",
          border: "border-surface-border",
          icon: "📂",
        };
    }
  };

  const headerStyle = getHeaderStyle();

  // --- DATA FETCHING ---
  useEffect(() => {
    const fetchStaff = async () => {
      const q = query(collection(db, "users"), where("role", "==", "staff"));
      const snapshot = await getDocs(q);
      const staffData = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setStaffList(staffData);
    };
    fetchStaff();
  }, []);

  useEffect(() => {
    const q = query(
      collection(db, "attendance"),
      where("date", "==", getTodayString()),
    );
    const unsubscribe = onSnapshot(q, (snap) => {
      // Just get the raw list here. We filter ghosts later.
      const uids = snap.docs
        .filter((doc) => doc.data().status === "Present")
        .map((doc) => doc.data().uid);
      setPresentUids(uids);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    const q = query(collection(db, "leaves"), orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(q, (snap) =>
      setLeaves(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    );
    return unsubscribe;
  }, []);

  // --- ACTIONS (FULL LOGIC RESTORED) ---
  const handleAction = (id, action) => {
    const executeAction = async () => {
      try {
        toast.dismiss(id);
        // 1. Update the Leave Request Status
        await updateDoc(doc(db, "leaves", id), { status: action });

        // 2. If Approved, Deduct Balance & Update Attendance
        if (action === "Approved") {
          const leaveDoc = leaves.find((l) => l.id === id);
          if (!leaveDoc) return;

          const userRef = doc(db, "users", leaveDoc.userId);
          const userSnap = await getDoc(userRef);

          if (userSnap.exists()) {
            const userData = userSnap.data();
            let currentBalances = userData.leaveBalances || {
              CL: 0,
              SL: 0,
              EL: 0,
              OD: 0,
              Permission: 0,
            };

            // Calculate Cost
            let cost = 0;
            if (leaveDoc.type === "Permission") {
              cost = 1;
            } else {
              const start = new Date(leaveDoc.startDate);
              const end = new Date(leaveDoc.endDate);
              const diffTime = Math.abs(end - start);
              cost = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
            }

            // Deduct from Balance
            let typeKey = leaveDoc.type;
            if (currentBalances[typeKey] !== undefined) {
              currentBalances[typeKey] = currentBalances[typeKey] - cost;
              await updateDoc(userRef, { leaveBalances: currentBalances });
              // Update local state to reflect change immediately
              setStaffList((prev) =>
                prev.map((s) =>
                  s.id === leaveDoc.userId
                    ? { ...s, leaveBalances: currentBalances }
                    : s,
                ),
              );
              toast.success(`Approved! Deducted ${cost} ${typeKey}.`);
            } else {
              toast.error(`Unknown Leave Type: ${typeKey}`);
            }
          }

          // 3. Mark "On Leave" in Attendance if today is covered
          const today = getTodayString();
          if (leaveDoc.startDate <= today && leaveDoc.endDate >= today) {
            const attendanceRef = doc(
              db,
              "attendance",
              `${leaveDoc.userId}_${today}`,
            );
            const attSnap = await getDoc(attendanceRef);
            // Only overwrite if they marked Present, or create if missing?
            // Logic: If they are Approved for leave, they are "On Leave" regardless.
            if (attSnap.exists()) {
              await updateDoc(attendanceRef, { status: "On Leave" });
            } else {
              // Optional: Create an "On Leave" attendance record if you want it to show in history
              // await setDoc(attendanceRef, { ... })
            }
            toast("Marked as 'On Leave' for today.", { icon: "⚠️" });
          }
        }
      } catch (e) {
        console.error(e);
        toast.error("Action failed.");
      }
    };

    toast(
      (t) => (
        <div className="flex flex-col gap-2">
          <p className="font-medium text-sm text-gray-800">
            Are you sure you want to <b>{action}</b> this?
          </p>
          <div className="flex gap-2 justify-end">
            <button
              onClick={() => toast.dismiss(t.id)}
              className="px-3 py-1 text-xs text-gray-500 border rounded hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                toast.dismiss(t.id);
                executeAction();
              }}
              className={`px-3 py-1 text-xs text-white rounded font-bold shadow-sm ${action === "Approved" ? "bg-green-600" : "bg-red-600"}`}
            >
              Yes, {action}
            </button>
          </div>
        </div>
      ),
      { duration: 5000, id: id },
    );
  };

  const handleDeleteUser = (staffId) => {
    const executeDelete = async () => {
      try {
        await deleteDoc(doc(db, "users", staffId));
        setStaffList((prev) => prev.filter((s) => s.id !== staffId));
        toast.success("User deleted from directory.");
      } catch (e) {
        toast.error("Delete failed.");
        console.error(e);
      }
    };

    toast(
      (t) => (
        <div className="flex flex-col gap-2 max-w-xs">
          <p className="font-bold text-sm text-red-800">Delete this user?</p>
          <p className="text-xs text-gray-600">
            This removes them from the list. (Login access may persist until
            password reset).
          </p>
          <div className="flex gap-2 justify-end">
            <button
              onClick={() => toast.dismiss(t.id)}
              className="px-3 py-1 text-xs border rounded"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                toast.dismiss(t.id);
                executeDelete();
              }}
              className="px-3 py-1 text-xs bg-red-600 text-white rounded font-bold"
            >
              Yes, Delete
            </button>
          </div>
        </div>
      ),
      { duration: 6000 },
    );
  };

  const handleSaveBalance = async (staffId, newBalances) => {
    try {
      await updateDoc(doc(db, "users", staffId), {
        leaveBalances: newBalances,
      });
      setStaffList(
        staffList.map((s) =>
          s.id === staffId ? { ...s, leaveBalances: newBalances } : s,
        ),
      );
      toast.success("Balances updated!");
    } catch (e) {
      toast.error("Failed.");
    }
  };

  // --- STATS CALCULATION (GHOST USER FIX) ---
  const pendingLeaves = leaves.filter((l) => l.status === "Pending");
  const pendingCount = pendingLeaves.length;
  const pendingUids = [...new Set(pendingLeaves.map((l) => l.userId))];

  // FIX: Filter presentUids to ONLY include IDs that actually exist in staffList
  const validPresentUids = presentUids.filter((uid) =>
    staffList.some((staff) => staff.id === uid),
  );

  const presentCount = validPresentUids.length;
  const absentCount = staffList.length - presentCount;

  const filteredList = staffList.filter((staff) => {
    let matchesStatus = true;
    // We use raw presentUids for individual row status to match DB state,
    // but the counts at the top use validPresentUids.
    if (activeFilter === "PRESENT")
      matchesStatus = presentUids.includes(staff.id);
    else if (activeFilter === "ABSENT")
      matchesStatus = !presentUids.includes(staff.id);
    else if (activeFilter === "PENDING")
      matchesStatus = pendingUids.includes(staff.id);

    const q = searchQuery.toLowerCase();
    const matchesSearch =
      staff.name?.toLowerCase().includes(q) ||
      staff.email?.toLowerCase().includes(q);
    return matchesStatus && matchesSearch;
  });

  const getLeaveStatusForToday = (userId) => {
    const today = getTodayString();
    const activeLeave = leaves.find(
      (l) =>
        l.userId === userId &&
        l.status === "Approved" &&
        l.startDate <= today &&
        l.endDate >= today,
    );
    return activeLeave ? "On Leave" : null;
  };

  // --- REUSABLE ACTIONS COMPONENT ---
  const StaffActions = ({ staff }) => (
    <div className="flex justify-end gap-2">
      <button
        onClick={() => {
          setSelectedStaff(staff);
          setIsHistoryModalOpen(true);
        }}
        className="p-2 text-blue-400 hover:text-blue-600 bg-blue-50 rounded-full"
        title="History"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-4 w-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
          />
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
          />
        </svg>
      </button>
      <button
        onClick={() => {
          setSelectedStaff(staff);
          setIsBalanceModalOpen(true);
        }}
        className="p-2 text-orange-400 hover:text-orange-600 bg-orange-50 rounded-full"
        title="Edit"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-4 w-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
          />
        </svg>
      </button>
      <button
        onClick={() => handleDeleteUser(staff.id)}
        className="p-2 text-red-400 hover:text-red-600 bg-red-50 rounded-full"
        title="Delete"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-4 w-4"
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
      </button>
    </div>
  );

  return (
    <div className="min-h-screen bg-surface-muted font-sans text-gray-900 pb-12">
      {/* HEADER */}
      <nav className="bg-white border-b border-surface-border px-4 md:px-8 py-4 flex justify-between items-center sticky top-0 z-30 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 bg-brand rounded-lg flex items-center justify-center text-white font-bold">
            SP
          </div>
          <div>
            <h1 className="text-lg font-bold text-gray-900 tracking-tight leading-none">
              Admin Console
            </h1>
            <p className="text-xs text-gray-500 hidden md:block">
              Department of Pharmacy
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-600 hidden md:block">
            Hello, <b>{user?.name}</b>
          </span>
          <button
            onClick={logout}
            className="text-sm font-medium text-red-600 hover:text-red-700 border border-red-100 px-3 py-1 rounded-lg"
          >
            Logout
          </button>
        </div>
      </nav>

      <main className="p-4 md:p-8 max-w-[1600px] mx-auto space-y-6 md:space-y-8">
        {/* 1. KPI HEAD-UP DISPLAY */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-6">
          {[
            {
              label: "Total Staff",
              val: staffList.length,
              color: "text-gray-900",
              filter: "ALL",
            },
            {
              label: "Present",
              val: presentCount,
              color: "text-status-present",
              filter: "PRESENT",
            },
            {
              label: "Absent",
              val: absentCount,
              color: "text-status-absent",
              filter: "ABSENT",
            },
            {
              label: "Pending",
              val: pendingCount,
              color: "text-status-pending",
              filter: "PENDING",
            },
          ].map((stat) => (
            <div
              key={stat.label}
              onClick={() => {
                setActiveFilter(stat.filter);
                setSearchQuery("");
              }}
              className={`bg-white p-4 md:p-5 rounded-xl border border-surface-border shadow-sm cursor-pointer transition hover:shadow-md group ${activeFilter === stat.filter ? "ring-2 ring-brand ring-offset-2" : ""}`}
            >
              <h3 className="text-[10px] md:text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">
                {stat.label}
              </h3>
              <p className={`text-2xl md:text-3xl font-bold ${stat.color}`}>
                {stat.val}
              </p>
            </div>
          ))}
        </div>

        {/* 2. MAIN LAYOUT */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* LEFT PANEL: DATABASE (70% WIDTH) */}
          <div className="lg:col-span-8 space-y-6">
            <div className="bg-white rounded-xl border border-surface-border shadow-sm overflow-hidden flex flex-col">
              {/* DYNAMIC HEADER */}
              <div
                className={`px-4 md:px-6 py-4 border-b ${headerStyle.border} ${headerStyle.bg} transition-colors duration-300 flex flex-col md:flex-row justify-between items-center gap-4`}
              >
                <div className="flex items-center gap-3 w-full md:w-auto">
                  <span className="text-2xl">{headerStyle.icon}</span>
                  <div>
                    <h2
                      className={`text-lg font-bold ${headerStyle.text} tracking-tight`}
                    >
                      {headerStyle.title}
                    </h2>
                    <p className="text-xs text-gray-500 font-medium">
                      {filteredList.length} staff members
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 w-full md:w-auto">
                  <input
                    type="text"
                    placeholder="Search..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="flex-1 pl-3 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-light outline-none md:w-56 bg-white/80"
                  />
                  <button
                    onClick={() => setIsAddStaffOpen(true)}
                    className="text-xs font-bold text-white bg-brand px-3 py-2 rounded-lg hover:bg-brand-dark shadow-sm whitespace-nowrap"
                  >
                    + Add
                  </button>
                </div>
              </div>

              {/* === VIEW 1: DESKTOP TABLE === */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-gray-50 text-xs font-bold text-gray-500 uppercase tracking-wider sticky top-0 z-10 shadow-sm">
                    <tr>
                      <th className="px-6 py-3 border-b border-gray-100">
                        Faculty
                      </th>
                      <th className="px-6 py-3 border-b border-gray-100">
                        Status
                      </th>
                      <th className="px-6 py-3 border-b border-gray-100">
                        Balance
                      </th>
                      <th className="px-6 py-3 border-b border-gray-100 text-right">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {filteredList.map((staff) => {
                      const leaveStatus = getLeaveStatusForToday(staff.id);
                      const isPresent = presentUids.includes(staff.id);
                      return (
                        <tr
                          key={staff.id}
                          className="hover:bg-blue-50/30 transition group"
                        >
                          <td className="px-6 py-3">
                            <div className="flex items-center gap-3">
                              <div className="h-8 w-8 rounded-full bg-gray-100 border text-gray-500 flex items-center justify-center text-xs font-bold">
                                {getInitials(staff.name)}
                              </div>
                              <div>
                                <p className="font-bold text-gray-800 text-sm">
                                  {staff.name}
                                </p>
                                <p className="text-[10px] text-gray-400 uppercase">
                                  {staff.designation || "Staff"}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-3">
                            {isPresent ? (
                              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-green-50 text-status-present border border-green-100">
                                ● Present
                              </span>
                            ) : leaveStatus === "On Leave" ? (
                              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-yellow-50 text-status-leave border border-yellow-100">
                                ● On Leave
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-50 text-status-absent border border-red-100">
                                ● Absent
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-3">
                            <div className="flex gap-3 text-xs">
                              <span className="font-bold">
                                {staff.leaveBalances?.CL || 0}{" "}
                                <span className="text-gray-400 font-normal">
                                  CL
                                </span>
                              </span>
                              <span className="font-bold">
                                {staff.leaveBalances?.OD || 0}{" "}
                                <span className="text-gray-400 font-normal">
                                  OD
                                </span>
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-3 text-right">
                            <StaffActions staff={staff} />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* === VIEW 2: MOBILE CARDS === */}
              <div className="md:hidden bg-gray-50 p-4 space-y-3">
                {filteredList.map((staff) => {
                  const leaveStatus = getLeaveStatusForToday(staff.id);
                  const isPresent = presentUids.includes(staff.id);
                  return (
                    <div
                      key={staff.id}
                      className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm"
                    >
                      <div className="flex justify-between items-start mb-3">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-full bg-gray-100 border text-gray-500 flex items-center justify-center text-sm font-bold">
                            {getInitials(staff.name)}
                          </div>
                          <div>
                            <p className="font-bold text-gray-800">
                              {staff.name}
                            </p>
                            <p className="text-xs text-gray-500">
                              {staff.designation || "Staff"}
                            </p>
                          </div>
                        </div>
                        {isPresent ? (
                          <span className="px-2 py-1 rounded text-[10px] font-bold bg-green-100 text-green-700">
                            Present
                          </span>
                        ) : leaveStatus === "On Leave" ? (
                          <span className="px-2 py-1 rounded text-[10px] font-bold bg-yellow-100 text-yellow-700">
                            On Leave
                          </span>
                        ) : (
                          <span className="px-2 py-1 rounded text-[10px] font-bold bg-red-100 text-red-700">
                            Absent
                          </span>
                        )}
                      </div>
                      <div className="flex justify-between items-center border-t border-gray-50 pt-3">
                        <div className="text-xs text-gray-500">
                          Balance:{" "}
                          <b className="text-gray-800">
                            {staff.leaveBalances?.CL || 0} CL
                          </b>{" "}
                          •{" "}
                          <b className="text-gray-800">
                            {staff.leaveBalances?.OD || 0} OD
                          </b>
                        </div>
                        <StaffActions staff={staff} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* RIGHT PANEL: ACTION CENTER (30% WIDTH) */}
          <div className="lg:col-span-4 space-y-6">
            {/* INBOX */}
            <div className="bg-white rounded-xl border border-surface-border shadow-sm overflow-hidden">
              <div className="bg-orange-50 px-4 py-3 border-b border-orange-100 flex justify-between items-center">
                <h3 className="font-bold text-orange-900 text-sm flex items-center gap-2">
                  <span>⚡ Action Center</span>
                  {pendingCount > 0 && (
                    <span className="bg-orange-200 text-orange-900 text-[10px] px-1.5 py-0.5 rounded-full">
                      {pendingCount}
                    </span>
                  )}
                </h3>
              </div>

              <div className="divide-y divide-gray-50 max-h-[400px] overflow-y-auto">
                {pendingCount === 0 ? (
                  <div className="p-8 text-center text-gray-400 text-sm">
                    <p>All caught up!</p>
                  </div>
                ) : (
                  pendingLeaves.map((leave) => (
                    <div key={leave.id} className="p-4">
                      <div className="flex justify-between items-start mb-2">
                        <span className="text-sm font-bold text-gray-800">
                          {leave.userName}
                        </span>
                        <span className="text-[10px] font-bold bg-gray-100 px-1.5 py-0.5 rounded text-gray-600 uppercase">
                          {leave.type}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 mb-2">
                        {leave.type === "Permission"
                          ? leave.duration
                          : `${leave.startDate} to ${leave.endDate}`}
                      </p>
                      <p className="text-xs text-gray-600 bg-gray-50 p-2 rounded mb-3 italic">
                        "{leave.reason}"
                      </p>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleAction(leave.id, "Approved")}
                          className="flex-1 bg-green-600 text-white text-xs font-bold py-1.5 rounded"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => handleAction(leave.id, "Rejected")}
                          className="flex-1 bg-white border border-gray-200 text-red-600 text-xs font-bold py-1.5 rounded"
                        >
                          Reject
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* ACTIVITY LOG */}
            <div className="bg-white rounded-xl border border-surface-border shadow-sm p-4">
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">
                Recent Activity
              </h3>
              <div className="space-y-4">
                {leaves.slice(0, 5).map((log) => (
                  <div key={log.id} className="flex items-start gap-3">
                    <div
                      className={`mt-1 w-1.5 h-1.5 rounded-full flex-shrink-0 ${log.status === "Approved" ? "bg-green-500" : log.status === "Rejected" ? "bg-red-500" : "bg-orange-400"}`}
                    ></div>
                    <div>
                      <p className="text-xs text-gray-800 font-medium">
                        <span className="font-bold">{log.userName}</span>{" "}
                        <span className="text-gray-500 font-normal">
                          requested
                        </span>{" "}
                        <span className="font-bold">{log.type}</span>
                      </p>
                      <p className="text-[10px] text-gray-400 mt-0.5 capitalize">
                        {log.status} • {log.appliedOn}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>

      <EditBalanceModal
        isOpen={isBalanceModalOpen}
        onClose={() => setIsBalanceModalOpen(false)}
        currentUser={selectedStaff}
        onSave={handleSaveBalance}
      />
      <AddStaffModal
        isOpen={isAddStaffOpen}
        onClose={() => setIsAddStaffOpen(false)}
        onUserAdded={() => {}}
      />
      <StaffHistoryModal
        isOpen={isHistoryModalOpen}
        onClose={() => setIsHistoryModalOpen(false)}
        currentUser={selectedStaff}
      />
    </div>
  );
}
