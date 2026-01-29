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
      if (result.role === "admin") navigate("/admin-dashboard");
      else navigate("/faculty-dashboard");
    } else {
      setError(result.message);
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex bg-white font-sans text-gray-900">
      {/* 1. LEFT PANEL: BRANDING (Hidden on mobile, visible on large screens) */}
      <div className="hidden lg:flex w-1/2 bg-blue-900 relative overflow-hidden items-center justify-center">
        {/* Abstract Background Pattern */}
        <div className="absolute inset-0 opacity-10">
          <svg
            className="h-full w-full"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
          >
            <path d="M0 100 C 20 0 50 0 100 100 Z" fill="white" />
          </svg>
        </div>

        <div className="relative z-10 text-center p-12 text-white max-w-lg">
          <div className="mb-6 flex justify-center">
            <img
              src="/logo.png"
              alt="SPST Logo"
              className="h-24 w-24 object-contain"
            />
          </div>
          <h1 className="text-4xl font-bold mb-4 tracking-tight">
            SPST Portal
          </h1>
          <p className="text-blue-100 text-lg leading-relaxed">
            School of Pharmacy and Science Technology.
            <br />
            Faculty Attendance & Management System.
          </p>
        </div>
      </div>

      {/* 2. RIGHT PANEL: LOGIN FORM */}
      <div className="w-full lg:w-1/2 flex flex-col justify-center px-8 md:px-16 lg:px-24 py-12 relative">
        {/* Mobile Header (Only shows on small screens) */}
        <div className="lg:hidden mb-8 text-center">
          <div className="flex justify-center mb-3">
            <img
              src="/logo.png"
              alt="SPST Logo"
              className="h-16 w-16 object-contain"
            />
          </div>
          <h2 className="text-2xl font-bold text-gray-900">SPST Portal</h2>
        </div>

        <div className="max-w-md w-full mx-auto">
          <div className="mb-10">
            <h2 className="text-3xl font-bold text-gray-900 mb-2">
              Welcome Back
            </h2>
            <p className="text-gray-500">
              Please enter your details to sign in.
            </p>
          </div>

          {error && (
            <div className="mb-6 rounded-lg bg-red-50 p-4 text-sm text-red-700 border-l-4 border-red-500 flex items-start gap-3 animate-in fade-in slide-in-from-top-2">
              <svg
                className="w-5 h-5 flex-shrink-0 mt-0.5"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                  clipRule="evenodd"
                />
              </svg>
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Email Input with Icon */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Email Address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-5 w-5"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
                    <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
                  </svg>
                </div>
                <input
                  type="email"
                  className="w-full pl-10 pr-4 py-3 rounded-lg border border-gray-300 text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 focus:outline-none transition-all"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@spst.edu"
                  required
                />
              </div>
            </div>

            {/* Password Input with Icon */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-5 w-5"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fillRule="evenodd"
                      d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
                <input
                  type="password"
                  className="w-full pl-10 pr-4 py-3 rounded-lg border border-gray-300 text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 focus:outline-none transition-all"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                />
              </div>
              <div className="flex justify-end mt-2">
                <Link
                  to="/forgot-password"
                  className="text-sm font-medium text-blue-600 hover:text-blue-800 hover:underline"
                >
                  Forgot Password?
                </Link>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className={`w-full py-3.5 px-4 rounded-lg text-white font-bold text-lg shadow-lg flex justify-center items-center transition-all transform active:scale-[0.98] ${
                loading
                  ? "bg-blue-400 cursor-not-allowed"
                  : "bg-gradient-to-r from-blue-800 to-blue-900 hover:shadow-xl"
              }`}
            >
              {loading ? (
                <div className="flex items-center gap-2">
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
                  <span>Verifying...</span>
                </div>
              ) : (
                "Sign In to Portal"
              )}
            </button>
          </form>

          {/* Footer Links */}
          <div className="mt-12 text-center text-xs text-gray-400 space-y-2">
            <p>© 2026 SPST Department of Pharmacy.</p>
            <div className="flex justify-center gap-4">
              <a href="#" className="hover:text-gray-600">
                Privacy Policy
              </a>
              <span>•</span>
              <a href="#" className="hover:text-gray-600">
                Help Center
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
