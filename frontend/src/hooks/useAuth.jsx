import { createContext, useContext, useState } from "react";
import api from "../api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user,    setUser]    = useState(() => JSON.parse(localStorage.getItem("mt_user") || "null"));
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState(null);

  async function login(username, password) {
    setLoading(true); setError(null);
    try {
      const { data } = await api.post("/auth/login", { username, password });
      localStorage.setItem("mt_token", data.token);
      localStorage.setItem("mt_user",  JSON.stringify(data.user));
      setUser(data.user);
      return true;
    } catch (err) {
      setError(err.response?.data?.error || "Login failed");
      return false;
    } finally { setLoading(false); }
  }

  function logout() {
    localStorage.removeItem("mt_token");
    localStorage.removeItem("mt_user");
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, login, logout, loading, error }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
