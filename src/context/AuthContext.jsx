import { createContext, useContext, useEffect, useState } from "react";
import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  sendPasswordResetEmail, // 1. IMPORT THIS
} from "firebase/auth";
import { auth, db } from "../firebase";
import { doc, getDoc } from "firebase/firestore";

const AuthContext = createContext();

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Login
  const login = async (email, password) => {
    try {
      const userCredential = await signInWithEmailAndPassword(
        auth,
        email,
        password,
      );
      const { uid } = userCredential.user;

      const userDoc = await getDoc(doc(db, "users", uid));
      if (userDoc.exists()) {
        const userData = userDoc.data();
        setUser({ uid, ...userData });
        return { success: true, role: userData.role };
      } else {
        return { success: false, message: "User data not found." };
      }
    } catch (error) {
      console.error("Login Error:", error);
      return { success: false, message: "Invalid Email or Password" };
    }
  };

  // Logout
  const logout = () => {
    return signOut(auth);
  };

  // 2. RESET PASSWORD FUNCTION
  const resetPassword = (email) => {
    return sendPasswordResetEmail(auth, email);
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        const userDoc = await getDoc(doc(db, "users", currentUser.uid));
        if (userDoc.exists()) {
          setUser({ uid: currentUser.uid, ...userDoc.data() });
        } else {
          setUser(null);
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const value = {
    user,
    login,
    logout,
    resetPassword, // 3. EXPORT IT
    loading,
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
}
