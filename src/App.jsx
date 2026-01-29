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
        <Toaster
          position="top-center"
          reverseOrder={false}
          gutter={8}
          toastOptions={{
            duration: 2000, // Auto-close after 2 seconds
            style: {
              background: "#fff", // Default white background
              color: "#333", // Dark text
              boxShadow:
                "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)", // Nice shadow
              padding: "12px 16px",
              borderRadius: "10px",
              fontWeight: "500",
              fontSize: "14px",
            },
            success: {
              iconTheme: {
                primary: "#16a34a", // Professional Green
                secondary: "white",
              },
              style: {
                border: "1px solid #dcfce7", // Subtle green border
                background: "#f0fdf4", // Very light green background
                color: "#166534", // Dark green text
              },
            },
            error: {
              iconTheme: {
                primary: "#ef4444",
                secondary: "white",
              },
              style: {
                border: "1px solid #fee2e2",
                background: "#fef2f2",
                color: "#991b1b",
              },
            },
          }}
        />
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
