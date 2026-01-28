import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const result = await login(email, password);

    if (result.success) {
      if (result.role === "admin") {
        navigate("/admin-dashboard");
      } else {
        navigate("/faculty-dashboard");
      }
    } else {
      setError(result.message);
    }

    setLoading(false);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-100">
      <div className="w-full max-w-md rounded-lg bg-white p-8 shadow-md">
        <h2 className="mb-6 text-center text-2xl font-bold text-blue-900">
          SPST Portal Login
        </h2>

        {error && (
          <div className="mb-4 rounded bg-red-100 p-3 text-sm text-red-700">
            {error}
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
              // CHANGE IS HERE:
              placeholder="Enter your email"
              required
            />
          </div>

          <div className="mb-6">
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Password
            </label>
            <input
              type="password"
              className="w-full rounded border p-2 focus:border-blue-500 focus:outline-none"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="******"
              required
            />
            <div className="text-right mt-1">
              <Link
                to="/forgot-password"
                className="text-xs text-blue-600 hover:underline"
              >
                Forgot Password?
              </Link>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className={`w-full rounded py-2 text-white transition ${
              loading
                ? "bg-blue-400 cursor-not-allowed"
                : "bg-blue-900 hover:bg-blue-800"
            }`}
          >
            {loading ? "Signing In..." : "Sign In"}
          </button>
        </form>
      </div>
    </div>
  );
}
