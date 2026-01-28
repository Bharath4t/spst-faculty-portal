import { useState, useEffect } from "react";

export default function EditBalanceModal({
  isOpen,
  onClose,
  currentUser,
  onSave,
}) {
  // Default structure if user has no data yet
  const [balances, setBalances] = useState({
    CL: 12,
    SL: 5,
    EL: 0,
    OD: 10,
    Permission: 2,
  });

  // Load user's existing data when modal opens
  useEffect(() => {
    if (currentUser?.leaveBalances) {
      setBalances(currentUser.leaveBalances);
    } else {
      // Reset to defaults if new user
      setBalances({ CL: 12, SL: 5, EL: 0, OD: 10, Permission: 2 });
    }
  }, [currentUser]);

  if (!isOpen) return null;

  const handleChange = (e) => {
    setBalances({
      ...balances,
      [e.target.name]: parseInt(e.target.value) || 0,
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(currentUser.id, balances);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-sm shadow-xl">
        <h2 className="text-xl font-bold text-blue-900 mb-4">
          Manage Leave Balance
        </h2>
        <p className="text-sm text-gray-500 mb-4">
          Editing for:{" "}
          <span className="font-bold text-gray-800">{currentUser?.name}</span>
        </p>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase">
                Casual (CL)
              </label>
              <input
                type="number"
                name="CL"
                value={balances.CL}
                onChange={handleChange}
                className="w-full border rounded p-2"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase">
                Sick (SL)
              </label>
              <input
                type="number"
                name="SL"
                value={balances.SL}
                onChange={handleChange}
                className="w-full border rounded p-2"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase">
                Earned (EL)
              </label>
              <input
                type="number"
                name="EL"
                value={balances.EL}
                onChange={handleChange}
                className="w-full border rounded p-2"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase">
                On Duty (OD)
              </label>
              <input
                type="number"
                name="OD"
                value={balances.OD}
                onChange={handleChange}
                className="w-full border rounded p-2"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase">
              Permissions (Count)
            </label>
            <input
              type="number"
              name="Permission"
              value={balances.Permission}
              onChange={handleChange}
              className="w-full border rounded p-2"
            />
          </div>

          <div className="flex justify-end space-x-3 mt-6">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-900 text-white rounded hover:bg-blue-800"
            >
              Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
