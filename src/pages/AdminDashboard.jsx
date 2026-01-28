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

  // Modal State
  const [isBalanceModalOpen, setIsBalanceModalOpen] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState(null);

  const getTodayString = () => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  // 1. FETCH ALL STAFF
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

  // 2. LISTEN TO ATTENDANCE
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

  // 3. LISTEN TO LEAVES
  useEffect(() => {
    const q = query(collection(db, "leaves"), orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(q, (snap) =>
      setLeaves(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    );
    return unsubscribe;
  }, []);

  // --- ACTIONS ---
  // --- ACTIONS (WITH TOAST CONFIRMATION) ---
  const handleAction = (id, action) => {
    // 1. We create the function that actually does the work
    const executeAction = async () => {
      try {
        // Dismiss the confirmation toast immediately
        toast.dismiss(id);

        // Update Status
        await updateDoc(doc(db, "leaves", id), { status: action });

        // IF APPROVED -> DEDUCT BALANCE
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
              toast.error(`Approved, but unknown Leave Type: ${typeKey}`);
            }
          }

          // CONFLICT LOGIC
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
              toast("User was marked Present. Changed to 'On Leave'.", {
                icon: "⚠️",
              });
            }
          }
        }
      } catch (e) {
        console.error(e);
        toast.error("Action failed.");
      }
    };

    // 2. We Trigger the "Custom Toast" with Buttons
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
                toast.dismiss(t.id); // Close the question
                executeAction(); // Run the code
              }}
              className={`px-3 py-1 text-xs text-white rounded font-bold shadow-sm ${action === "Approved" ? "bg-green-600 hover:bg-green-700" : "bg-red-600 hover:bg-red-700"}`}
            >
              Yes, {action}
            </button>
          </div>
        </div>
      ),
      { duration: 5000, id: id },
    ); // Use ID to prevent duplicates
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

      // OLD: alert("Updated!");
      // NEW:
      toast.success("Balances updated successfully!");
    } catch (e) {
      // OLD: alert("Failed.");
      // NEW:
      toast.error("Failed to update balance.");
    }
  };

  // --- FILTERS ---
  const pendingLeaves = leaves.filter((l) => l.status === "Pending");
  const pendingCount = pendingLeaves.length;
  const pendingUids = [...new Set(pendingLeaves.map((l) => l.userId))];

  const presentCount = presentUids.length;
  const absentCount = staffList.length - presentCount;

  const getFilteredStaff = () => {
    if (activeFilter === "PRESENT")
      return staffList.filter((staff) => presentUids.includes(staff.id));
    if (activeFilter === "ABSENT")
      return staffList.filter((staff) => !presentUids.includes(staff.id));
    if (activeFilter === "PENDING")
      return staffList.filter((staff) => pendingUids.includes(staff.id));
    return staffList;
  };

  const filteredList = getFilteredStaff();

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
    <div className="min-h-screen bg-gray-100">
      <nav className="bg-blue-900 text-white px-6 py-4 flex justify-between items-center shadow-lg">
        <div>
          <h1 className="text-xl font-bold">SPST Admin Console</h1>
          <p className="text-xs text-blue-200">
            Logged in as: {user?.name} (HOD)
          </p>
        </div>
        <button
          onClick={logout}
          className="bg-blue-800 hover:bg-blue-700 px-4 py-2 rounded text-sm transition"
        >
          Logout
        </button>
      </nav>

      <main className="p-6 max-w-6xl mx-auto space-y-8">
        {/* STATS CARDS */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div
            onClick={() => setActiveFilter("ALL")}
            className={`bg-white p-6 rounded shadow border-t-4 border-blue-500 cursor-pointer transform hover:scale-105 transition ${activeFilter === "ALL" ? "bg-blue-50 ring-2 ring-blue-500" : ""}`}
          >
            <h3 className="text-gray-500 text-sm">Total Staff</h3>
            <p className="text-4xl font-bold text-gray-800">
              {staffList.length}
            </p>
          </div>
          <div
            onClick={() => setActiveFilter("PRESENT")}
            className={`bg-white p-6 rounded shadow border-t-4 border-green-500 cursor-pointer transform hover:scale-105 transition ${activeFilter === "PRESENT" ? "bg-green-50 ring-2 ring-green-500" : ""}`}
          >
            <h3 className="text-gray-500 text-sm">Present Today</h3>
            <p className="text-4xl font-bold text-green-600">{presentCount}</p>
          </div>
          <div
            onClick={() => setActiveFilter("ABSENT")}
            className={`bg-white p-6 rounded shadow border-t-4 border-red-500 cursor-pointer transform hover:scale-105 transition ${activeFilter === "ABSENT" ? "bg-red-50 ring-2 ring-red-500" : ""}`}
          >
            <h3 className="text-gray-500 text-sm">Absentees</h3>
            <p className="text-4xl font-bold text-red-600">{absentCount}</p>
          </div>
          <div
            onClick={() => setActiveFilter("PENDING")}
            className={`bg-white p-6 rounded shadow border-t-4 border-orange-500 cursor-pointer transform hover:scale-105 transition ${activeFilter === "PENDING" ? "bg-orange-50 ring-2 ring-orange-500" : ""}`}
          >
            <h3 className="text-gray-500 text-sm">Pending Leaves</h3>
            <p className="text-4xl font-bold text-gray-800">{pendingCount}</p>
          </div>
        </div>

        {/* PENDING APPROVALS */}
        <div className="bg-white rounded shadow overflow-hidden">
          <div className="px-6 py-4 border-b bg-yellow-50">
            <h2 className="font-bold text-yellow-800">⚠️ Pending Approvals</h2>
          </div>
          {pendingCount === 0 ? (
            <div className="p-6 text-center text-gray-500">
              No pending requests.
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 text-sm text-gray-600">
                  <th className="px-6 py-3 border-b">Faculty</th>
                  <th className="px-6 py-3 border-b">Type</th>
                  <th className="px-6 py-3 border-b">Details</th>
                  <th className="px-6 py-3 border-b">Actions</th>
                </tr>
              </thead>
              <tbody>
                {leaves
                  .filter((l) => l.status === "Pending")
                  .map((leave) => (
                    <tr key={leave.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 border-b font-medium">
                        {leave.userName}
                      </td>
                      <td className="px-6 py-4 border-b">
                        <span className="bg-purple-100 text-purple-800 px-2 py-1 rounded text-xs font-bold">
                          {leave.type}
                        </span>
                      </td>
                      <td className="px-6 py-4 border-b text-sm">
                        {leave.type === "Permission"
                          ? leave.duration
                          : `${leave.startDate} to ${leave.endDate}`}
                        <br />
                        <span className="text-gray-400 text-xs">
                          {leave.reason}
                        </span>
                      </td>
                      <td className="px-6 py-4 border-b space-x-2">
                        <button
                          onClick={() => handleAction(leave.id, "Approved")}
                          className="bg-green-600 text-white px-3 py-1 rounded text-xs hover:bg-green-700"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => handleAction(leave.id, "Rejected")}
                          className="bg-red-600 text-white px-3 py-1 rounded text-xs hover:bg-red-700"
                        >
                          Reject
                        </button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          )}
        </div>

        {/* STAFF DIRECTORY */}
        <div className="bg-white rounded shadow overflow-hidden transition-all">
          <div
            className={`px-6 py-4 border-b flex justify-between items-center ${activeFilter === "ABSENT" ? "bg-red-50" : activeFilter === "PRESENT" ? "bg-green-50" : activeFilter === "PENDING" ? "bg-orange-50" : "bg-gray-50"}`}
          >
            <h2 className="font-bold text-gray-700">
              {activeFilter === "ALL" && "All Staff Directory"}
              {activeFilter === "PRESENT" && "✅ Present Today"}
              {activeFilter === "ABSENT" && "❌ Absentees List"}
              {activeFilter === "PENDING" && "⏳ Pending Applicants"}
            </h2>
            <span className="text-xs text-gray-500 font-mono">
              Showing: {filteredList.length}
            </span>
          </div>

          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 text-sm text-gray-600">
                <th className="px-6 py-3 border-b">Name</th>
                <th className="px-6 py-3 border-b">Designation</th>
                {/* --- RESTORED COLUMN: TYPE --- */}
                <th className="px-6 py-3 border-b">Type</th>
                <th className="px-6 py-3 border-b">Status</th>
                <th className="px-6 py-3 border-b">Leaves</th>
                <th className="px-6 py-3 border-b">Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredList.map((staff) => {
                const leaveStatus = getLeaveStatusForToday(staff.id);
                const isPresent = presentUids.includes(staff.id);
                return (
                  <tr key={staff.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 border-b font-medium">
                      {staff.name}
                    </td>
                    <td className="px-6 py-4 border-b text-gray-500">
                      {staff.designation || "Staff"}
                    </td>

                    {/* --- RESTORED CELL: TYPE --- */}
                    <td className="px-6 py-4 border-b">
                      <span
                        className={`px-2 py-1 rounded text-xs ${staff.type === "Teaching" ? "bg-indigo-100 text-indigo-800" : "bg-gray-100 text-gray-800"}`}
                      >
                        {staff.type || "N/A"}
                      </span>
                    </td>

                    <td className="px-6 py-4 border-b">
                      {isPresent ? (
                        <span className="text-green-600 font-bold text-xs">
                          ● Present
                        </span>
                      ) : leaveStatus === "On Leave" ? (
                        <span className="bg-yellow-100 text-yellow-800 px-2 py-1 rounded text-xs font-bold">
                          On Leave
                        </span>
                      ) : (
                        <span className="text-red-500 font-bold text-xs">
                          ● Absent
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 border-b text-sm">
                      {staff.leaveBalances ? (
                        <span className="text-gray-600">
                          <b>{staff.leaveBalances.CL}</b> CL,{" "}
                          <b>{staff.leaveBalances.OD}</b> OD
                        </span>
                      ) : (
                        <span className="text-red-400 text-xs">Not Set</span>
                      )}
                    </td>
                    <td className="px-6 py-4 border-b">
                      <button
                        onClick={() => {
                          setSelectedStaff(staff);
                          setIsBalanceModalOpen(true);
                        }}
                        className="text-blue-600 hover:underline text-sm font-medium"
                      >
                        Edit Balance
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* HISTORY */}
        {showHistory ? (
          <div className="bg-white rounded shadow overflow-hidden mt-8 relative opacity-75">
            <div className="px-6 py-4 border-b flex justify-between items-center bg-gray-50">
              <h2 className="font-bold text-gray-600 text-sm">
                Recent Activity Log
              </h2>
              <button
                onClick={() => setShowHistory(false)}
                className="text-gray-400 hover:text-red-600 font-bold px-2 py-1"
              >
                ✕
              </button>
            </div>
            <table className="w-full text-left border-collapse">
              <tbody>
                {leaves
                  .filter((l) => l.status !== "Pending")
                  .slice(0, 3)
                  .map((leave) => (
                    <tr
                      key={leave.id}
                      className="border-b text-xs text-gray-500"
                    >
                      <td className="px-6 py-2">{leave.userName}</td>
                      <td className="px-6 py-2">{leave.type}</td>
                      <td className="px-6 py-2">
                        <span
                          className={`px-2 py-0.5 rounded ${leave.status === "Approved" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}
                        >
                          {leave.status}
                        </span>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-right">
            <button
              onClick={() => setShowHistory(true)}
              className="text-xs text-gray-400 hover:text-gray-600"
            >
              Show Log
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
    </div>
  );
}
