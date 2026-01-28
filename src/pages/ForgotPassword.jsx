import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { Link } from "react-router-dom";

export default function ForgotPassword() {
  const { resetPassword } = useAuth();
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setMessage("");
      setError("");
      setLoading(true);
      await resetPassword(email);
      setMessage("Check your inbox for further instructions.");
    } catch (err) {
      setError("Failed to reset password. Check if the email is correct.");
    }
    setLoading(false);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-100">
      <div className="w-full max-w-md rounded-lg bg-white p-8 shadow-md">
        <h2 className="mb-4 text-center text-2xl font-bold text-blue-900">
          Reset Password
        </h2>

        {error && (
          <div className="mb-4 bg-red-100 p-3 text-sm text-red-700 rounded">
            {error}
          </div>
        )}
        {message && (
          <div className="mb-4 bg-green-100 p-3 text-sm text-green-700 rounded">
            {message}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Email Address
            </label>
            <input
              type="email"
              className="w-full rounded border p-2 focus:border-blue-500 focus:outline-none"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your registered email"
              required
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded bg-blue-900 py-2 text-white hover:bg-blue-800 disabled:bg-blue-400"
          >
            {loading ? "Sending..." : "Send Reset Link"}
          </button>
        </form>

        <div className="mt-4 text-center">
          <Link to="/" className="text-sm text-blue-600 hover:underline">
            Back to Login
          </Link>
        </div>
      </div>
    </div>
  );
}
