import { useState } from "react";
import { initializeApp } from "firebase/app";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { db, firebaseConfig } from "../firebase";

export default function AddStaffModal({ isOpen, onClose, onUserAdded }) {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    designation: "",
    role: "staff",
    type: "Teaching",
    CL: 12,
    SL: 5,
    OD: 10,
    EL: 0,
    Permission: 2,
  });
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleChange = (e) =>
    setFormData({ ...formData, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    let secondaryApp = null;
    try {
      secondaryApp = initializeApp(firebaseConfig, "Secondary");
      const secondaryAuth = getAuth(secondaryApp);
      const userCredential = await createUserWithEmailAndPassword(
        secondaryAuth,
        formData.email,
        formData.password,
      );
      await setDoc(doc(db, "users", userCredential.user.uid), {
        uid: userCredential.user.uid,
        ...formData,
        leaveBalances: {
          CL: Number(formData.CL),
          SL: Number(formData.SL),
          EL: Number(formData.EL),
          OD: Number(formData.OD),
          Permission: Number(formData.Permission),
        },
        createdAt: new Date(),
      });
      await signOut(secondaryAuth);
      if (onUserAdded) onUserAdded();
      onClose();
    } catch (error) {
      console.error("Error adding staff:", error);

      // NEW: Specific handling for "Email Taken"
      if (error.code === "auth/email-already-in-use") {
        alert(
          "⚠️ Ghost User Detected!\n\nThis email is already in Firebase Authentication, but not in your Database.\n\nSOLUTION:\nGo to Firebase Console -> Authentication and manually delete this email before trying again.",
        );
      } else {
        alert("Failed: " + error.message);
      }
    } finally {
      setLoading(false);
      // secondaryApp is garbage collected automatically
    }
  };

  return (
    // 1. BACKDROP BLUR & TRANSITION
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm transition-opacity">
      {/* 2. SCALE ANIMATION */}
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden transform transition-all scale-100 animate-in fade-in zoom-in-95 duration-200">
        <div className="bg-gray-50 px-6 py-4 border-b border-gray-100 flex justify-between items-center">
          <h2 className="text-lg font-bold text-gray-800">Add New Staff</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-500 mb-1">
                Name
              </label>
              <input
                name="name"
                onChange={handleChange}
                required
                className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-brand-light outline-none"
                placeholder="Dr. John Doe"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 mb-1">
                Designation
              </label>
              <input
                name="designation"
                onChange={handleChange}
                required
                className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-brand-light outline-none"
                placeholder="Asst. Professor"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-500 mb-1">
                Type
              </label>
              <select
                name="type"
                onChange={handleChange}
                className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-brand-light outline-none"
              >
                <option value="Teaching">Teaching</option>
                <option value="Non-Teaching">Non-Teaching</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 mb-1">
                Role
              </label>
              <select
                name="role"
                onChange={handleChange}
                className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-brand-light outline-none"
              >
                <option value="staff">Staff (Faculty)</option>
                <option value="admin">Admin (HOD)</option>
              </select>
            </div>
          </div>

          <div className="bg-blue-50/50 p-3 rounded-lg border border-blue-100 grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-500 mb-1">
                Email
              </label>
              <input
                type="email"
                name="email"
                onChange={handleChange}
                required
                className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-brand-light outline-none"
                placeholder="staff@spst.edu"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 mb-1">
                Password
              </label>
              <input
                type="text"
                name="password"
                onChange={handleChange}
                required
                className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-brand-light outline-none"
                placeholder="Default Password"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-500 mb-2">
              Initial Leave Balances
            </label>
            <div className="grid grid-cols-5 gap-2">
              {["CL", "SL", "OD", "EL", "Permission"].map((type) => (
                <div key={type}>
                  <input
                    type="number"
                    name={type}
                    defaultValue={formData[type]}
                    onChange={handleChange}
                    className="w-full border rounded-lg p-2 text-center text-sm focus:ring-2 focus:ring-brand-light outline-none"
                    placeholder={type}
                  />
                  <span className="block text-[10px] text-center text-gray-400 font-bold mt-1">
                    {type}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end space-x-3 pt-4 border-t border-gray-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg text-sm font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-brand text-white rounded-lg hover:bg-brand-dark text-sm font-bold shadow-sm"
            >
              {loading ? "Creating..." : "Create User"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
