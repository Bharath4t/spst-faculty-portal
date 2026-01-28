import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { Toaster } from "react-hot-toast"; // 1. IMPORT THIS
import Login from "./pages/Login";
import FacultyDashboard from "./pages/FacultyDashboard";
import AdminDashboard from "./pages/AdminDashboard";
import ForgotPassword from "./pages/ForgotPassword";

// PROTECTED ROUTE COMPONENT
const ProtectedRoute = ({ children, allowedRole }) => {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" />;
  if (allowedRole && user.role !== allowedRole) {
    return user.role === "admin" ? (
      <Navigate to="/admin-dashboard" />
    ) : (
      <Navigate to="/faculty-dashboard" />
    );
  }
  return children;
};

export default function App() {
  return (
    <AuthProvider>
      <Router>
        {/* 2. ADD THE TOASTER HERE (Configured for top-center) */}
        <Toaster position="top-center" reverseOrder={false} />

        <Routes>
          <Route path="/" element={<Navigate to="/login" />} />
          <Route path="/login" element={<Login />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />

          <Route
            path="/faculty-dashboard"
            element={
              <ProtectedRoute allowedRole="staff">
                <FacultyDashboard />
              </ProtectedRoute>
            }
          />

          <Route
            path="/admin-dashboard"
            element={
              <ProtectedRoute allowedRole="admin">
                <AdminDashboard />
              </ProtectedRoute>
            }
          />
        </Routes>
      </Router>
    </AuthProvider>
  );
}
