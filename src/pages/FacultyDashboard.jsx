import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import LeaveModal from "../components/LeaveModal";
import { db } from "../firebase";
import {
  collection,
  addDoc,
  setDoc,
  deleteDoc,
  doc,
  getDoc,
  query,
  where,
  onSnapshot,
  serverTimestamp,
} from "firebase/firestore"; // Added deleteDoc

const COLLEGE_COORDS = { lat: 17.74078811356036, lng: 83.25407478363284 };
const ALLOWED_RADIUS_METERS = 200;

export default function FacultyDashboard() {
  const { user, logout } = useAuth();

  const [attendanceMarked, setAttendanceMarked] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [locationStatus, setLocationStatus] = useState("");
  const [myLeaves, setMyLeaves] = useState([]);
  const [liveProfile, setLiveProfile] = useState(null);

  const getTodayString = () => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  useEffect(() => {
    if (!user) return;
    const unsub = onSnapshot(doc(db, "users", user.uid), (doc) =>
      setLiveProfile(doc.data()),
    );
    return unsub;
  }, [user]);

  useEffect(() => {
    const checkAttendance = async () => {
      if (!user) return;
      const docSnap = await getDoc(
        doc(db, "attendance", `${user.uid}_${getTodayString()}`),
      );
      if (docSnap.exists()) setAttendanceMarked(true);
    };
    checkAttendance();
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, "leaves"), where("userId", "==", user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      data.sort(
        (a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0),
      );
      setMyLeaves(data);
    });
    return unsubscribe;
  }, [user]);

  // --- DELETE FUNCTION ---
  const handleDeleteLeave = async (id, status) => {
    // If approved, warn them it won't refund balance (basic version)
    if (status === "Approved") {
      if (
        !confirm(
          "Removing this from history won't refund your leave balance. Continue?",
        )
      )
        return;
    } else {
      if (!confirm("Are you sure you want to cancel/delete this request?"))
        return;
    }

    try {
      await deleteDoc(doc(db, "leaves", id));
      // No alert needed, realtime listener will update UI
    } catch (e) {
      alert("Failed to delete.");
    }
  };

  const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371e3;
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  const handleMarkAttendance = () => {
    setLoading(true);
    setLocationStatus("Getting location...");
    if (!navigator.geolocation) {
      alert("No GPS");
      setLoading(false);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const d = calculateDistance(
          pos.coords.latitude,
          pos.coords.longitude,
          COLLEGE_COORDS.lat,
          COLLEGE_COORDS.lng,
        );
        if (d > ALLOWED_RADIUS_METERS) {
          alert(`Too far: ${d.toFixed(0)}m`);
          setLoading(false);
          setLocationStatus("Too far.");
          return;
        }
        try {
          await setDoc(
            doc(db, "attendance", `${user.uid}_${getTodayString()}`),
            {
              uid: user.uid,
              name: user.name,
              date: getTodayString(),
              status: "Present",
              timestamp: serverTimestamp(),
              location: { lat: pos.coords.latitude, lng: pos.coords.longitude },
            },
          );
          setAttendanceMarked(true);
          setLocationStatus("Marked!");
          alert("Success!");
        } catch (e) {
          console.error(e);
          alert("Failed");
        } finally {
          setLoading(false);
        }
      },
      (e) => {
        alert("Allow GPS");
        setLoading(false);
      },
    );
  };

  const handleLeaveSubmit = async (leaveData) => {
    try {
      setLoading(true);
      await addDoc(collection(db, "leaves"), {
        ...leaveData,
        userId: user.uid,
        userName: user.name,
        userDesignation: user.designation,
        status: "Pending",
        appliedOn: getTodayString(),
        createdAt: serverTimestamp(),
      });
      alert(`Success! Request submitted.`);
      setIsModalOpen(false);
    } catch (e) {
      alert("Error");
    } finally {
      setLoading(false);
    }
  };

  const balances = liveProfile?.leaveBalances || {
    CL: 0,
    SL: 0,
    EL: 0,
    OD: 0,
    Permission: 0,
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow px-6 py-4 flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold text-blue-900">
            SPST Faculty Portal
          </h1>
          <p className="text-sm text-gray-500">Welcome, {user?.name}</p>
        </div>
        <button
          onClick={logout}
          className="text-sm text-red-600 hover:text-red-800 font-medium"
        >
          Logout
        </button>
      </nav>

      <main className="p-6 max-w-4xl mx-auto space-y-6">
        {/* TODAY STATUS */}
        <div className="bg-white p-6 rounded-lg shadow-md border-l-4 border-blue-500">
          <h2 className="text-lg font-semibold text-gray-700 mb-4">
            Today's Status
          </h2>
          <div className="flex justify-between items-center">
            <div>
              <p className="text-3xl font-bold text-gray-800">
                {new Date().toLocaleDateString("en-GB", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                })}
              </p>
              <p className="text-orange-600 font-medium mt-2">
                {locationStatus}
              </p>
            </div>
            {attendanceMarked ? (
              <div className="px-6 py-3 bg-green-100 text-green-800 rounded-full font-bold border border-green-200">
                ✓ Present
              </div>
            ) : (
              <button
                onClick={handleMarkAttendance}
                disabled={loading}
                className="px-6 py-3 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 shadow-lg"
              >
                {loading ? "Locating..." : "Mark Present"}
              </button>
            )}
          </div>
        </div>

        {/* LIVE WALLET */}
        <div className="bg-white p-6 rounded-lg shadow-sm">
          <h3 className="text-gray-500 text-sm font-medium uppercase mb-4">
            Your Leave Balance
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-center">
            <div className="p-3 bg-blue-50 rounded border border-blue-100">
              <p className="text-2xl font-bold text-blue-900">{balances.CL}</p>
              <p className="text-xs text-blue-600 uppercase">Casual</p>
            </div>
            <div className="p-3 bg-green-50 rounded border border-green-100">
              <p className="text-2xl font-bold text-green-900">{balances.SL}</p>
              <p className="text-xs text-green-600 uppercase">Sick</p>
            </div>
            <div className="p-3 bg-yellow-50 rounded border border-yellow-100">
              <p className="text-2xl font-bold text-yellow-900">
                {balances.EL}
              </p>
              <p className="text-xs text-yellow-600 uppercase">Earned</p>
            </div>
            <div className="p-3 bg-purple-50 rounded border border-purple-100">
              <p className="text-2xl font-bold text-purple-900">
                {balances.OD}
              </p>
              <p className="text-xs text-purple-600 uppercase">On Duty</p>
            </div>
            <div className="p-3 bg-gray-50 rounded border border-gray-200">
              <p className="text-2xl font-bold text-gray-800">
                {balances.Permission}
              </p>
              <p className="text-xs text-gray-500 uppercase">Permissions</p>
            </div>
          </div>
          <button
            onClick={() => setIsModalOpen(true)}
            className="mt-6 w-full py-2 border-2 border-dashed border-gray-300 text-gray-600 rounded hover:border-blue-500 hover:text-blue-500 transition"
          >
            + Apply for New Leave
          </button>
        </div>

        {/* HISTORY WITH DELETE BUTTON */}
        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b bg-gray-50 flex justify-between items-center">
            <h3 className="font-bold text-gray-700">My Request History</h3>
          </div>
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="bg-gray-100 text-gray-600">
                <th className="px-6 py-3">Applied On</th>
                <th className="px-6 py-3">Type</th>
                <th className="px-6 py-3">Status</th>
                <th className="px-6 py-3">Action</th>
              </tr>
            </thead>
            <tbody>
              {myLeaves.map((l) => (
                <tr key={l.id} className="border-b">
                  <td className="px-6 py-3">{l.appliedOn}</td>
                  <td className="px-6 py-3">{l.type}</td>
                  <td className="px-6 py-3">
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-bold ${l.status === "Approved" ? "bg-green-100 text-green-800" : l.status === "Rejected" ? "bg-red-100 text-red-800" : "bg-yellow-100 text-yellow-800"}`}
                    >
                      {l.status}
                    </span>
                  </td>

                  {/* DELETE BUTTON */}
                  <td className="px-6 py-3">
                    <button
                      onClick={() => handleDeleteLeave(l.id, l.status)}
                      className="text-gray-400 hover:text-red-600 transition"
                      title="Delete Request"
                    >
                      🗑️
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
      <LeaveModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleLeaveSubmit}
      />
    </div>
  );
}
