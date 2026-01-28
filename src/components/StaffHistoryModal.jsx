import { useState, useEffect } from "react";
import { db } from "../firebase";
import { doc, getDoc } from "firebase/firestore";

export default function StaffHistoryModal({ isOpen, onClose, currentUser }) {
  const [weeklyStats, setWeeklyStats] = useState([]);
  const [loading, setLoading] = useState(false);

  // --- 1. CALCULATE LAST 7 DAYS ---
  const getLast7Days = () => {
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");

      days.push({
        dateStr: `${year}-${month}-${day}`,
        dayName: d.toLocaleDateString("en-US", { weekday: "short" }), // "Mon"
        fullDate: d.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        }), // "Jan 28"
      });
    }
    return days;
  };

  // --- 2. FETCH DATA WHEN USER OPENS ---
  useEffect(() => {
    const fetchHistory = async () => {
      if (!isOpen || !currentUser) return;
      setLoading(true);

      const last7 = getLast7Days();
      const stats = [];

      for (const day of last7) {
        // [FIX] Use 'currentUser.id' (System ID) instead of 'currentUser.uid' (Field ID)
        // This guarantees we find the doc even if the profile data is slightly incomplete.
        const docRef = doc(
          db,
          "attendance",
          `${currentUser.id}_${day.dateStr}`,
        );
        const docSnap = await getDoc(docRef);

        stats.push({
          ...day,
          status: docSnap.exists() ? "Present" : "Absent",
        });
      }
      setWeeklyStats(stats);
      setLoading(false);
    };

    fetchHistory();
  }, [isOpen, currentUser]);

  if (!isOpen || !currentUser) return null;

  // Calculate Consistency Score
  const presentCount = weeklyStats.filter((s) => s.status === "Present").length;
  const consistency = Math.round((presentCount / 7) * 100);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm transition-opacity">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden transform transition-all scale-100 animate-in fade-in zoom-in-95 duration-200">
        {/* HEADER */}
        <div className="bg-gray-50 px-6 py-4 border-b border-gray-100 flex justify-between items-center">
          <div>
            <h2 className="text-lg font-bold text-gray-800">
              {currentUser.name}
            </h2>
            <p className="text-xs text-gray-500">
              Attendance History (Last 7 Days)
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 bg-white p-1 rounded-full border border-gray-200 shadow-sm"
          >
            ✕
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* STATS SUMMARY */}
          <div className="flex gap-4">
            <div className="flex-1 bg-green-50 border border-green-100 p-3 rounded-lg text-center">
              <span className="block text-2xl font-bold text-green-700">
                {presentCount}
              </span>
              <span className="text-[10px] uppercase font-bold text-green-600">
                Days Present
              </span>
            </div>
            <div className="flex-1 bg-blue-50 border border-blue-100 p-3 rounded-lg text-center">
              <span className="block text-2xl font-bold text-blue-700">
                {consistency}%
              </span>
              <span className="text-[10px] uppercase font-bold text-blue-600">
                Consistency
              </span>
            </div>
          </div>

          {/* THE GRAPH */}
          <div className="bg-white border border-gray-100 rounded-xl p-4 shadow-inner">
            {loading ? (
              <div className="h-24 flex items-center justify-center text-gray-400 text-xs">
                Loading history...
              </div>
            ) : (
              <div className="flex justify-between items-end h-24 px-2">
                {weeklyStats.map((stat, index) => {
                  const isPresent = stat.status === "Present";
                  return (
                    <div
                      key={stat.dateStr}
                      className="flex flex-col items-center gap-2 group relative"
                    >
                      {/* BAR */}
                      <div
                        className={`w-3 rounded-full transition-all duration-500 ${
                          isPresent
                            ? "bg-green-500 shadow-green-200 shadow-md"
                            : "bg-gray-200"
                        }`}
                        style={{ height: isPresent ? "64px" : "12px" }}
                      ></div>
                      <span className="text-[10px] font-bold text-gray-400">
                        {stat.dayName}
                      </span>

                      {/* TOOLTIP */}
                      <div className="absolute bottom-full mb-2 bg-gray-800 text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition whitespace-nowrap z-10">
                        {stat.fullDate}: {stat.status}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="text-center">
            <button
              onClick={onClose}
              className="text-sm font-medium text-gray-500 hover:text-gray-700 underline"
            >
              Close Report
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
