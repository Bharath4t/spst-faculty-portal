import { useState } from "react";
import toast from "react-hot-toast"; // Ensure this is imported

export default function LeaveModal({ isOpen, onClose, onSubmit }) {
  const [formData, setFormData] = useState({
    type: "CL",
    startDate: "",
    endDate: "",
    reason: "",
    duration: "",
  });

  if (!isOpen) return null;

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    // VALIDATION LOGIC (Now using Toast)
    if (formData.type === "Permission") {
      if (!formData.duration || !formData.reason) {
        toast.error("Please fill Duration and Reason");
        return;
      }
    } else {
      if (!formData.startDate || !formData.endDate || !formData.reason) {
        toast.error("Please fill Start Date, End Date, and Reason");
        return;
      }
    }

    // Success! Send data to parent.
    onSubmit(formData);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg p-6 w-full max-w-md shadow-xl transform transition-all scale-100">
        <h2 className="text-xl font-bold text-blue-900 mb-4">
          Apply for Leave
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Leave Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Leave Type
            </label>
            <select
              name="type"
              value={formData.type}
              onChange={handleChange}
              className="w-full border rounded p-2 mt-1 focus:ring-2 focus:ring-blue-500 outline-none"
            >
              <option value="CL">CL (Casual Leave)</option>
              <option value="SL">SL (Sick Leave)</option>
              <option value="EL">EL (Earned Leave)</option>
              <option value="OD">OD (On Duty)</option>
              <option value="Permission">Permission (Hourly)</option>
            </select>
          </div>

          {/* Conditional Inputs */}
          {formData.type === "Permission" ? (
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Duration
              </label>
              <input
                type="text"
                name="duration"
                value={formData.duration}
                onChange={handleChange}
                className="w-full border rounded p-2 mt-1 focus:ring-2 focus:ring-blue-500 outline-none"
                placeholder="e.g. 2 hours"
              />
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Start Date
                </label>
                <input
                  type="date"
                  name="startDate"
                  value={formData.startDate}
                  onChange={handleChange}
                  className="w-full border rounded p-2 mt-1 focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  End Date
                </label>
                <input
                  type="date"
                  name="endDate"
                  value={formData.endDate}
                  onChange={handleChange}
                  className="w-full border rounded p-2 mt-1 focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
            </div>
          )}

          {/* Reason */}
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Reason
            </label>
            <textarea
              name="reason"
              value={formData.reason}
              onChange={handleChange}
              className="w-full border rounded p-2 mt-1 focus:ring-2 focus:ring-blue-500 outline-none"
              rows="3"
              placeholder="Briefly describe why..."
            ></textarea>
          </div>

          {/* Buttons */}
          <div className="flex justify-end space-x-3 mt-4 pt-2 border-t border-gray-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-900 text-white rounded hover:bg-blue-800 shadow transition"
            >
              Submit Request
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
