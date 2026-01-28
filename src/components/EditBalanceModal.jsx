import { useState, useEffect } from "react";

export default function EditBalanceModal({
  isOpen,
  onClose,
  currentUser,
  onSave,
}) {
  const [balances, setBalances] = useState({
    CL: 0,
    SL: 0,
    OD: 0,
    EL: 0,
    Permission: 0,
  });

  useEffect(() => {
    if (currentUser?.leaveBalances) {
      setBalances(currentUser.leaveBalances);
    }
  }, [currentUser]);

  if (!isOpen || !currentUser) return null;

  const handleChange = (e) => {
    setBalances({ ...balances, [e.target.name]: Number(e.target.value) });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(currentUser.id, balances);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm transition-opacity">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden transform transition-all scale-100 animate-in fade-in zoom-in-95 duration-200">
        <div className="bg-gray-50 px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-800">Edit Balances</h2>
          <p className="text-xs text-gray-500">{currentUser.name}</p>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            {["CL", "SL", "OD", "EL", "Permission"].map((type) => (
              <div key={type}>
                <label className="block text-xs font-bold text-gray-500 mb-1">
                  {type}
                </label>
                <input
                  type="number"
                  name={type}
                  value={balances[type] || 0}
                  onChange={handleChange}
                  className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-brand-light outline-none font-mono"
                />
              </div>
            ))}
          </div>

          <div className="flex justify-end space-x-3 pt-4 mt-2 border-t border-gray-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg text-sm font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-brand text-white rounded-lg hover:bg-brand-dark text-sm font-bold shadow-sm"
            >
              Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
