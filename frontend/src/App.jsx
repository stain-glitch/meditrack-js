import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./hooks/useAuth";
import Layout from "./components/Layout";
import Login      from "./pages/Login";
import Dashboard  from "./pages/Dashboard";
import Batches    from "./pages/Batches";
import BatchDetail from "./pages/BatchDetail";
import { Alerts } from "./pages/Alerts";
import Activity   from "./pages/Activity";
import Transfers  from "./pages/Transfers";
import Users      from "./pages/Users";
import "./styles/global.css";

function Protected({ children }) {
  const { user } = useAuth();
  return user ? <Layout>{children}</Layout> : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/"          element={<Protected><Dashboard /></Protected>} />
          <Route path="/batches"   element={<Protected><Batches /></Protected>} />
          <Route path="/batches/:id" element={<Protected><BatchDetail /></Protected>} />
          <Route path="/alerts"    element={<Protected><Alerts /></Protected>} />
          <Route path="/activity"  element={<Protected><Activity /></Protected>} />
          <Route path="/transfers" element={<Protected><Transfers /></Protected>} />
          <Route path="/users"     element={<Protected><Users /></Protected>} />
          <Route path="*"          element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
