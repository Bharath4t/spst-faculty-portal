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
import toast from "react-hot-toast";

const COLLEGE_COORDS = { lat: 17.74078811356036, lng: 83.25407478363284 };
const ALLOWED_RADIUS_METERS = 200;

export default function FacultyDashboard() {
  const { user, logout } = useAuth();

  const [attendanceMarked, setAttendanceMarked] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [myLeaves, setMyLeaves] = useState([]);
  const [liveProfile, setLiveProfile] = useState(null);

  // --- HELPER: GET INITIALS (Keep this for the circle icon) ---
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
    const executeDelete = async () => {
      try {
        await deleteDoc(doc(db, "leaves", id));
        toast.success("Request deleted");
      } catch (e) {
        toast.error("Failed to delete");
      }
    };

    const warningText =
      status === "Approved"
        ? "Warning: Deleting this won't refund your balance. Continue?"
        : "Are you sure you want to cancel this request?";

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

    if (!navigator.geolocation) {
      toast.error("Geolocation is not supported");
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
          toast.error(`Too far: You are ${d.toFixed(0)}m away.`);
          setLoading(false);
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
          toast.success("Attendance Marked Successfully!");
        } catch (e) {
          console.error(e);
          toast.error("Failed to save attendance");
        } finally {
          setLoading(false);
        }
      },
      (e) => {
        console.error(e);
        toast.error("Please allow GPS access");
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
      toast.success("Leave Request Submitted!");
      setIsModalOpen(false);
    } catch (e) {
      toast.error("Submission failed");
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
    <div className="min-h-screen bg-surface-muted pb-safe">
      {/* 1. BRAND HEADER */}
      <nav className="bg-brand text-white px-5 py-4 flex justify-between items-center shadow-md sticky top-0 z-20">
        <div className="flex items-center gap-3 overflow-hidden">
          {/* Avatar Circle */}
          <div className="h-10 w-10 rounded-full bg-white/10 flex-shrink-0 flex items-center justify-center text-sm font-bold border border-white/20 shadow-inner">
            {getInitials(user?.name)}
          </div>
          {/* Text Area */}
          <div className="min-w-0">
            <h1 className="text-xs font-bold text-blue-200 tracking-wider uppercase">
              SPST Faculty
            </h1>
            <p className="text-sm font-bold text-white truncate leading-tight">
              Hello, {user?.name}
            </p>
          </div>
        </div>

        <button
          onClick={logout}
          className="text-xs bg-brand-dark px-3 py-1.5 rounded border border-blue-800 hover:bg-blue-900 transition shadow-sm font-medium flex-shrink-0 ml-2"
        >
          Logout
        </button>
      </nav>

      <main className="p-4 max-w-lg mx-auto space-y-6">
        {/* 2. HERO ATTENDANCE CARD */}
        <div className="bg-surface rounded-2xl shadow-sm p-1 border border-surface-border">
          {attendanceMarked ? (
            <div className="py-8 flex flex-col items-center justify-center bg-green-50 rounded-xl border border-green-100">
              <div className="h-16 w-16 bg-green-100 rounded-full flex items-center justify-center mb-3">
                <span className="text-3xl">✅</span>
              </div>
              <span className="font-bold text-xl text-status-present">
                Present Today
              </span>
              <span className="text-xs text-green-600 mt-1">
                {new Date().toLocaleDateString()}
              </span>
            </div>
          ) : (
            <button
              onClick={handleMarkAttendance}
              disabled={loading}
              className="w-full py-10 bg-gradient-to-br from-brand to-brand-light text-white rounded-xl shadow-lg active:scale-[0.98] transition-all flex flex-col items-center justify-center gap-3 relative overflow-hidden"
            >
              {loading ? (
                <>
                  <svg
                    className="animate-spin h-8 w-8 text-white opacity-80"
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
                  <span className="text-sm font-medium animate-pulse">
                    Verifying Location...
                  </span>
                </>
              ) : (
                <>
                  <span className="text-4xl">📍</span>
                  <span className="font-bold text-xl tracking-wide">
                    Tap to Mark Attendance
                  </span>
                </>
              )}
            </button>
          )}
        </div>

        {/* 3. SMART LEAVE WALLET */}
        <div>
          <div className="flex justify-between items-end mb-3 px-1">
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">
              Your Balance
            </h3>
            <button
              onClick={() => setIsModalOpen(true)}
              className="text-xs font-bold text-brand-light hover:underline"
            >
              + Apply Leave
            </button>
          </div>

          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-surface p-4 rounded-xl shadow-sm border border-surface-border flex flex-col items-center">
                <span className="text-2xl font-bold text-gray-800">
                  {balances.CL}
                </span>
                <span className="text-[10px] font-bold text-gray-400 uppercase mt-1">
                  Casual Leave
                </span>
              </div>
              <div className="bg-surface p-4 rounded-xl shadow-sm border border-surface-border flex flex-col items-center">
                <span className="text-2xl font-bold text-gray-800">
                  {balances.SL}
                </span>
                <span className="text-[10px] font-bold text-gray-400 uppercase mt-1">
                  Sick Leave
                </span>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="bg-surface p-3 rounded-lg shadow-sm border border-surface-border text-center">
                <span className="block font-bold text-gray-700">
                  {balances.OD}
                </span>
                <span className="text-[9px] text-gray-400 font-bold uppercase">
                  OD
                </span>
              </div>
              <div className="bg-surface p-3 rounded-lg shadow-sm border border-surface-border text-center">
                <span className="block font-bold text-gray-700">
                  {balances.EL}
                </span>
                <span className="text-[9px] text-gray-400 font-bold uppercase">
                  Earned
                </span>
              </div>
              <div className="bg-surface p-3 rounded-lg shadow-sm border border-surface-border text-center">
                <span className="block font-bold text-gray-700">
                  {balances.Permission}
                </span>
                <span className="text-[9px] text-gray-400 font-bold uppercase">
                  Perms
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* 4. HISTORY */}
        <div>
          <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3 px-1">
            Request History
          </h3>
          <div className="space-y-3 pb-8">
            {myLeaves.length === 0 && (
              <div className="text-center py-8 text-gray-400 text-sm italic">
                No leave history found.
              </div>
            )}

            {myLeaves.map((l) => (
              <div
                key={l.id}
                className="bg-surface p-4 rounded-xl shadow-sm border border-surface-border flex justify-between items-start group"
              >
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-bold text-gray-800 text-sm">
                      {l.type} Request
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                        l.status === "Approved"
                          ? "bg-green-100 text-status-present"
                          : l.status === "Rejected"
                            ? "bg-red-100 text-status-absent"
                            : "bg-orange-100 text-status-pending"
                      }`}
                    >
                      {l.status}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500">
                    {l.startDate
                      ? `${l.startDate} to ${l.endDate}`
                      : `${l.duration} • ${l.reason}`}
                  </p>
                  <p className="text-[10px] text-gray-400 mt-1">
                    Applied: {l.appliedOn}
                  </p>
                </div>

                <button
                  onClick={() => handleDeleteLeave(l.id, l.status)}
                  className="p-2 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-full transition"
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
