import React, { createContext, useContext, useState } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Layout from './components/Layout.jsx';
import Login from './pages/Login.jsx';
import Setup from './pages/Setup.jsx';
import Overview from './pages/Overview.jsx';
import Investments from './pages/Investments.jsx';
import CPF from './pages/CPF.jsx';
import SRS from './pages/SRS.jsx';
import Dividends from './pages/Dividends.jsx';
import Loans from './pages/Loans.jsx';
import History from './pages/History.jsx';
import Plan from './pages/Plan.jsx';

// Auth context
export const AuthContext = createContext(null);

export function useAuth() {
  return useContext(AuthContext);
}

function RequireAuth({ children }) {
  const { token } = useAuth();
  const location = useLocation();
  if (!token) return <Navigate to="/login" state={{ from: location }} replace />;
  return children;
}

export default function App() {
  const [token, setToken] = useState(() => localStorage.getItem('wf_token'));
  const [profile, setProfile] = useState(null);

  function login(newToken, profileData) {
    localStorage.setItem('wf_token', newToken);
    setToken(newToken);
    if (profileData) setProfile(profileData);
  }

  function logout() {
    localStorage.removeItem('wf_token');
    setToken(null);
    setProfile(null);
  }

  return (
    <AuthContext.Provider value={{ token, profile, login, logout, setProfile }}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/setup" element={<Setup />} />
        <Route path="/" element={<RequireAuth><Layout /></RequireAuth>}>
          <Route index element={<Overview />} />
          <Route path="investments" element={<Investments />} />
          <Route path="cpf" element={<CPF />} />
          <Route path="srs" element={<SRS />} />
          <Route path="dividends" element={<Dividends />} />
          <Route path="loans" element={<Loans />} />
          <Route path="history" element={<History />} />
          <Route path="plan" element={<Plan />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthContext.Provider>
  );
}
