import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import Login from "./pages/Login";
import FacultyDashboard from "./pages/FacultyDashboard";
import AdminDashboard from "./pages/AdminDashboard";
import ForgotPassword from "./pages/ForgotPassword"; // 1. IMPORT THIS

// PROTECTED ROUTE COMPONENT
const ProtectedRoute = ({ children, allowedRole }) => {
  const { user } = useAuth();

  // 1. If not logged in, kick them to Login
  if (!user) {
    return <Navigate to="/login" />;
  }

  // 2. If logged in but wrong role, kick them back
  if (allowedRole && user.role !== allowedRole) {
    return user.role === "admin" ? (
      <Navigate to="/admin-dashboard" />
    ) : (
      <Navigate to="/faculty-dashboard" />
    );
  }

  // 3. If all good, show the page
  return children;
};

export default function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/" element={<Navigate to="/login" />} />
          <Route path="/login" element={<Login />} />

          {/* NEW FORGOT PASSWORD ROUTE */}
          <Route path="/forgot-password" element={<ForgotPassword />} />

          {/* FACULTY ROUTE */}
          <Route
            path="/faculty-dashboard"
            element={
              <ProtectedRoute allowedRole="staff">
                <FacultyDashboard />
              </ProtectedRoute>
            }
          />

          {/* ADMIN ROUTE */}
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
