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
  where,
  getDocs,
  getDoc,
} from "firebase/firestore";
import EditBalanceModal from "../components/EditBalanceModal";
import AddStaffModal from "../components/AddStaffModal";
import toast from "react-hot-toast";

export default function AdminDashboard() {
  const { user, logout } = useAuth();

  // Data States
  const [leaves, setLeaves] = useState([]);
  const [staffList, setStaffList] = useState([]);
  const [presentUids, setPresentUids] = useState([]);

  // UI States
  const [showHistory, setShowHistory] = useState(true);
  const [activeFilter, setActiveFilter] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [isBalanceModalOpen, setIsBalanceModalOpen] = useState(false);
  const [isAddStaffOpen, setIsAddStaffOpen] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState(null);

  const getTodayString = () => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  // --- HELPERS ---
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

  // NEW: DYNAMIC HEADING HELPER
  const getSectionTitle = () => {
    switch (activeFilter) {
      case "PRESENT":
        return "Present Staff";
      case "ABSENT":
        return "Absentees List";
      case "PENDING":
        return "Pending Requests";
      default:
        return "Staff Directory";
    }
  };

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

  // --- ACTIONS ---
  const handleAction = (id, action) => {
    const executeAction = async () => {
      try {
        toast.dismiss(id);
        await updateDoc(doc(db, "leaves", id), { status: action });

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

            let cost = 0;
            if (leaveDoc.type === "Permission") {
              cost = 1;
            } else {
              const start = new Date(leaveDoc.startDate);
              const end = new Date(leaveDoc.endDate);
              const diffTime = Math.abs(end - start);
              cost = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
            }

            let typeKey = leaveDoc.type;
            if (currentBalances[typeKey] !== undefined) {
              currentBalances[typeKey] = currentBalances[typeKey] - cost;
              await updateDoc(userRef, { leaveBalances: currentBalances });
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

          const today = getTodayString();
          if (leaveDoc.startDate <= today && leaveDoc.endDate >= today) {
            const attendanceRef = doc(
              db,
              "attendance",
              `${leaveDoc.userId}_${today}`,
            );
            const attSnap = await getDoc(attendanceRef);
            if (attSnap.exists() && attSnap.data().status === "Present") {
              await updateDoc(attendanceRef, { status: "On Leave" });
              toast("User marked Present. Changed to 'On Leave'.", {
                icon: "⚠️",
              });
            }
          }
        }
      } catch (e) {
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

  // --- FILTERS & STATS ---
  const pendingLeaves = leaves.filter((l) => l.status === "Pending");
  const pendingCount = pendingLeaves.length;
  const pendingUids = [...new Set(pendingLeaves.map((l) => l.userId))];
  const presentCount = presentUids.length;
  const absentCount = staffList.length - presentCount;

  // UPDATED FILTER LOGIC
  const filteredList = staffList.filter((staff) => {
    let matchesStatus = true;
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

  return (
    <div className="min-h-screen bg-surface-muted font-sans text-gray-900">
      {/* HEADER */}
      <nav className="bg-white border-b border-surface-border px-8 py-4 flex justify-between items-center sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 bg-brand rounded-lg flex items-center justify-center text-white font-bold">
            SP
          </div>
          <div>
            <h1 className="text-lg font-bold text-gray-900 tracking-tight leading-none">
              Admin Console
            </h1>
            <p className="text-xs text-gray-500">Department of Pharmacy</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-600 hidden md:block">
            Hello, <b>{user?.name}</b>
          </span>
          <button
            onClick={logout}
            className="text-sm font-medium text-red-600 hover:text-red-700"
          >
            Logout
          </button>
        </div>
      </nav>

      <main className="p-8 max-w-7xl mx-auto space-y-8">
        {/* 1. KPI GRID */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {[
            {
              label: "Total Staff",
              val: staffList.length,
              color: "text-gray-900",
              filter: "ALL",
            },
            {
              label: "Present Today",
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
              label: "Pending Requests",
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
              className={`bg-white p-6 rounded-xl border border-surface-border shadow-sm cursor-pointer transition hover:shadow-md hover:border-brand-light group ${activeFilter === stat.filter ? "ring-2 ring-brand ring-offset-2" : ""}`}
            >
              <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                {stat.label}
              </h3>
              <p className={`text-4xl font-bold ${stat.color}`}>{stat.val}</p>
            </div>
          ))}
        </div>

        {/* 2. INBOX (Pending Approvals) */}
        {pendingCount > 0 && (
          <div className="bg-white rounded-xl border border-orange-100 shadow-sm overflow-hidden">
            <div className="px-6 py-4 bg-orange-50 border-b border-orange-100 flex justify-between items-center">
              <h2 className="font-bold text-orange-900 flex items-center gap-2">
                <span>⚡ Action Required</span>
                <span className="bg-orange-200 text-orange-800 text-xs px-2 py-0.5 rounded-full">
                  {pendingCount}
                </span>
              </h2>
            </div>
            <div className="divide-y divide-gray-100">
              {pendingLeaves.map((leave) => (
                <div
                  key={leave.id}
                  className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-orange-50/30 transition"
                >
                  <div className="flex items-start gap-3">
                    <div className="h-10 w-10 rounded-full bg-brand-light text-white flex items-center justify-center text-sm font-bold shadow-sm">
                      {getInitials(leave.userName)}
                    </div>
                    <div>
                      <p className="font-bold text-gray-900">
                        {leave.userName}
                      </p>
                      <div className="flex items-center gap-2 text-sm text-gray-500 mt-0.5">
                        <span className="bg-gray-100 px-2 py-0.5 rounded text-xs font-bold text-gray-700">
                          {leave.type}
                        </span>
                        <span>
                          •{" "}
                          {leave.type === "Permission"
                            ? leave.duration
                            : `${leave.startDate} to ${leave.endDate}`}
                        </span>
                      </div>
                      <p className="text-xs text-gray-400 mt-1 italic">
                        "{leave.reason}"
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleAction(leave.id, "Approved")}
                      className="px-4 py-2 bg-green-600 text-white text-xs font-bold rounded shadow-sm hover:bg-green-700 flex items-center gap-2"
                    >
                      <span>✓ Approve</span>
                    </button>
                    <button
                      onClick={() => handleAction(leave.id, "Rejected")}
                      className="px-4 py-2 bg-white border border-gray-200 text-red-600 text-xs font-bold rounded shadow-sm hover:bg-red-50 hover:border-red-200"
                    >
                      Reject
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 3. DATA TABLE */}
        <div className="bg-white rounded-xl border border-surface-border shadow-sm overflow-hidden flex flex-col">
          {/* Table Header */}
          <div className="px-6 py-4 border-b border-surface-border flex justify-between items-center bg-gray-50">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                {/* DYNAMIC HEADING IS HERE */}
                <h2 className="font-bold text-gray-800">{getSectionTitle()}</h2>
                <span className="text-xs bg-gray-200 text-gray-600 px-2 py-0.5 rounded-full">
                  {filteredList.length}
                </span>
              </div>
            </div>

            {/* SEARCH AND ADD BUTTON */}
            <div className="flex items-center gap-3">
              <div className="relative hidden md:block">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
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
                  placeholder="Search..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 pr-4 py-1.5 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-light focus:border-brand-light outline-none w-64"
                />
              </div>

              <button
                onClick={() => setIsAddStaffOpen(true)}
                className="text-xs font-bold text-brand bg-brand-light/10 px-3 py-1.5 rounded hover:bg-brand-light/20 transition flex items-center gap-1"
              >
                <span>+</span> Add Staff
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead className="bg-gray-50 text-xs font-bold text-gray-500 uppercase tracking-wider sticky top-0 z-10 shadow-sm">
                <tr>
                  <th className="px-6 py-4 border-b border-gray-100">
                    Faculty Member
                  </th>
                  <th className="px-6 py-4 border-b border-gray-100">Role</th>
                  <th className="px-6 py-4 border-b border-gray-100">Status</th>
                  <th className="px-6 py-4 border-b border-gray-100">
                    Balance (CL/OD)
                  </th>
                  <th className="px-6 py-4 border-b border-gray-100 text-right">
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
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="h-9 w-9 rounded-full bg-gray-100 border border-gray-200 text-gray-500 flex items-center justify-center text-xs font-bold group-hover:border-brand-light group-hover:text-brand transition">
                            {getInitials(staff.name)}
                          </div>
                          <div>
                            <p className="font-medium text-gray-900 text-sm">
                              {staff.name}
                            </p>
                            <p className="text-xs text-gray-500">
                              {staff.email}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="text-sm text-gray-700">
                            {staff.designation || "Staff"}
                          </span>
                          <span className="text-[10px] text-gray-400 uppercase font-bold">
                            {staff.type || "N/A"}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {isPresent ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-green-50 text-status-present border border-green-100">
                            <span className="w-1.5 h-1.5 rounded-full bg-status-present"></span>{" "}
                            Present
                          </span>
                        ) : leaveStatus === "On Leave" ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-yellow-50 text-status-leave border border-yellow-100">
                            <span className="w-1.5 h-1.5 rounded-full bg-status-leave"></span>{" "}
                            On Leave
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-red-50 text-status-absent border border-red-100">
                            <span className="w-1.5 h-1.5 rounded-full bg-status-absent"></span>{" "}
                            Absent
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        {staff.leaveBalances ? (
                          <div className="flex items-center gap-3 text-sm">
                            <div className="flex flex-col items-center">
                              <span className="font-bold text-gray-800">
                                {staff.leaveBalances.CL}
                              </span>
                              <span className="text-[9px] text-gray-400 font-bold">
                                CL
                              </span>
                            </div>
                            <div className="w-px h-6 bg-gray-200"></div>
                            <div className="flex flex-col items-center">
                              <span className="font-bold text-gray-800">
                                {staff.leaveBalances.OD}
                              </span>
                              <span className="text-[9px] text-gray-400 font-bold">
                                OD
                              </span>
                            </div>
                          </div>
                        ) : (
                          <span className="text-gray-400 text-xs italic">
                            Not Set
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => {
                            setSelectedStaff(staff);
                            setIsBalanceModalOpen(true);
                          }}
                          className="p-2 text-gray-400 hover:text-brand hover:bg-blue-50 rounded-full transition"
                          title="Edit Balance"
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
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* 4. ACTIVITY LOG */}
        {showHistory && (
          <div className="bg-white rounded-xl border border-surface-border shadow-sm p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                Recent Activity
              </h3>
              <button
                onClick={() => setShowHistory(false)}
                className="text-gray-400 hover:text-red-500"
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
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
            <div className="space-y-3">
              {leaves.slice(0, 5).map((log) => (
                <div
                  key={log.id}
                  className="flex items-center justify-between text-sm border-b border-gray-50 pb-2 last:border-0 last:pb-0"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-1.5 h-1.5 rounded-full ${log.status === "Approved" ? "bg-green-500" : log.status === "Rejected" ? "bg-red-500" : "bg-orange-500"}`}
                    ></div>
                    <span className="text-gray-700 font-medium">
                      {log.userName}
                    </span>
                    <span className="text-gray-400 text-xs">• {log.type}</span>
                  </div>
                  <span
                    className={`text-xs px-2 py-0.5 rounded font-bold ${log.status === "Approved" ? "bg-green-50 text-green-700" : log.status === "Rejected" ? "bg-red-50 text-red-700" : "bg-orange-50 text-orange-700"}`}
                  >
                    {log.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
        {!showHistory && (
          <div className="text-right">
            <button
              onClick={() => setShowHistory(true)}
              className="text-xs text-gray-400 hover:text-gray-600 underline"
            >
              Show Activity Log
            </button>
          </div>
        )}
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
    </div>
  );
}
