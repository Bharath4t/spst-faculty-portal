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
} from "firebase/firestore";
import toast from "react-hot-toast"; // 1. IMPORT TOAST

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

  const handleDeleteLeave = (id, status) => {
    // 1. DEFINE THE ACTION
    const executeDelete = async () => {
      try {
        await deleteDoc(doc(db, "leaves", id));
        toast.success("Request deleted");
      } catch (e) {
        toast.error("Failed to delete");
      }
    };

    // 2. DEFINE THE WARNING TEXT
    const warningText =
      status === "Approved"
        ? "Warning: Deleting this won't refund your balance. Continue?"
        : "Are you sure you want to cancel this request?";

    // 3. SHOW CUSTOM TOAST
    toast(
      (t) => (
        <div className="flex flex-col gap-2 max-w-xs">
          <p className="font-medium text-sm text-gray-800">{warningText}</p>
          <div className="flex gap-2 justify-end">
            <button
              onClick={() => toast.dismiss(t.id)}
              className="px-3 py-1 text-xs text-gray-500 border rounded hover:bg-gray-50"
            >
              No
            </button>
            <button
              onClick={() => {
                toast.dismiss(t.id);
                executeDelete();
              }}
              className="px-3 py-1 text-xs text-white bg-red-600 rounded font-bold shadow-sm hover:bg-red-700"
            >
              Yes, Delete
            </button>
          </div>
        </div>
      ),
      { duration: 6000 },
    );
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
      toast.error("Geolocation is not supported"); // NEW TOAST
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
          toast.error(`Too far: ${d.toFixed(0)}m away (Max 200m)`); // NEW TOAST
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
          toast.success("Attendance Marked Successfully!"); // NEW TOAST
        } catch (e) {
          console.error(e);
          toast.error("Failed to save attendance"); // NEW TOAST
        } finally {
          setLoading(false);
        }
      },
      (e) => {
        console.error(e);
        toast.error("Please allow GPS access"); // NEW TOAST
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
      toast.success("Leave Request Submitted!"); // NEW TOAST
      setIsModalOpen(false);
    } catch (e) {
      toast.error("Submission failed"); // NEW TOAST
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
    <div className="min-h-screen bg-gray-50 pb-10">
      <nav className="bg-white shadow px-6 py-4 flex justify-between items-center sticky top-0 z-10">
        <div>
          <h1 className="text-xl font-bold text-blue-900">SPST Faculty</h1>
          <p className="text-xs text-gray-500">Welcome, {user?.name}</p>
        </div>
        <button
          onClick={logout}
          className="text-sm text-red-600 hover:text-red-800 font-medium"
        >
          Logout
        </button>
      </nav>

      <main className="p-4 max-w-lg mx-auto space-y-6">
        {/* TODAY STATUS */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wide mb-4">
            Today's Action
          </h2>
          <div className="flex flex-col items-center justify-center space-y-4">
            {attendanceMarked ? (
              <div className="w-full py-4 bg-green-50 text-green-700 rounded-lg flex flex-col items-center border border-green-200">
                <span className="text-3xl">✅</span>
                <span className="font-bold text-lg mt-2">Present</span>
                <span className="text-xs text-green-600">
                  {new Date().toLocaleDateString()}
                </span>
              </div>
            ) : (
              <div className="w-full">
                <p className="text-center text-gray-400 text-sm mb-4">
                  You are not marked present yet.
                </p>
                <button
                  onClick={handleMarkAttendance}
                  disabled={loading}
                  className="w-full py-4 bg-gradient-to-r from-blue-600 to-blue-800 text-white rounded-xl font-bold text-lg shadow-lg hover:shadow-xl transition transform active:scale-95 flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <div className="flex items-center gap-2">
                      {/* THE SPINNER SVG */}
                      <svg
                        className="animate-spin h-5 w-5 text-white"
                        xmlns="http://www.w3.org/2000/svg"
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
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        ></path>
                      </svg>
                      <span>Locating...</span>
                    </div>
                  ) : (
                    <>📍 Tap to Mark Present</>
                  )}
                </button>
                <p className="text-center text-xs text-orange-500 mt-2 h-4">
                  {locationStatus}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* LIVE WALLET (Mobile Optimized Grid) */}
        <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
          <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wide mb-4">
            Leave Wallet
          </h3>
          <div className="grid grid-cols-3 gap-3">
            <div className="p-3 bg-blue-50 rounded-lg border border-blue-100 text-center">
              <p className="text-xl font-bold text-blue-900">{balances.CL}</p>
              <p className="text-[10px] text-blue-600 font-bold uppercase">
                Casual
              </p>
            </div>
            <div className="p-3 bg-green-50 rounded-lg border border-green-100 text-center">
              <p className="text-xl font-bold text-green-900">{balances.SL}</p>
              <p className="text-[10px] text-green-600 font-bold uppercase">
                Sick
              </p>
            </div>
            <div className="p-3 bg-purple-50 rounded-lg border border-purple-100 text-center">
              <p className="text-xl font-bold text-purple-900">{balances.OD}</p>
              <p className="text-[10px] text-purple-600 font-bold uppercase">
                On Duty
              </p>
            </div>
            {/* Hidden less important ones on small screens or keep them if needed */}
            <div className="p-3 bg-yellow-50 rounded-lg border border-yellow-100 text-center">
              <p className="text-xl font-bold text-yellow-900">{balances.EL}</p>
              <p className="text-[10px] text-yellow-600 font-bold uppercase">
                Earned
              </p>
            </div>
            <div className="p-3 bg-gray-50 rounded-lg border border-gray-200 text-center">
              <p className="text-xl font-bold text-gray-800">
                {balances.Permission}
              </p>
              <p className="text-[10px] text-gray-500 font-bold uppercase">
                Perms
              </p>
            </div>
          </div>
          <button
            onClick={() => setIsModalOpen(true)}
            className="mt-5 w-full py-3 border border-blue-100 text-blue-600 font-semibold rounded-lg hover:bg-blue-50 transition"
          >
            + Request New Leave
          </button>
        </div>

        {/* HISTORY (Card Layout for Mobile) */}
        <div>
          <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wide mb-3 px-1">
            Recent History
          </h3>
          <div className="space-y-3">
            {myLeaves.length === 0 && (
              <p className="text-gray-400 text-sm text-center py-4">
                No history found.
              </p>
            )}
            {myLeaves.map((l) => (
              <div
                key={l.id}
                className="bg-white p-4 rounded-lg shadow-sm border border-gray-100 flex justify-between items-center"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-gray-800">{l.type}</span>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${l.status === "Approved" ? "bg-green-100 text-green-800" : l.status === "Rejected" ? "bg-red-100 text-red-800" : "bg-yellow-100 text-yellow-800"}`}
                    >
                      {l.status}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 mt-1">{l.appliedOn}</p>
                </div>
                <button
                  onClick={() => handleDeleteLeave(l.id, l.status)}
                  className="p-2 text-gray-300 hover:text-red-500 transition"
                >
                  🗑️
                </button>
              </div>
            ))}
          </div>
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
