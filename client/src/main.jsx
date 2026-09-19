import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import './styles.css';
import { AuthProvider, useAuth } from './auth.jsx';
import { LangProvider } from './i18n.jsx';
import { Spinner } from './ui.jsx';
import Landing from './pages/Landing.jsx';
import { Login, Signup, Forgot, Reset } from './pages/Auth.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Wizard from './pages/Wizard.jsx';
import Project from './pages/Project.jsx';
import Experiments from './pages/Experiments.jsx';
import Market from './pages/Market.jsx';
import Account from './pages/Account.jsx';
import Admin from './pages/Admin.jsx';
import Settings from './pages/Settings.jsx';

function RequireAuth({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div style={{ paddingTop: 120 }}><Spinner label="Loading…" /></div>;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function App() {
  return (
    <BrowserRouter>
      <LangProvider>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/forgot" element={<Forgot />} />
          <Route path="/reset" element={<Reset />} />
          <Route path="/app" element={<RequireAuth><Dashboard /></RequireAuth>} />
          <Route path="/app/new" element={<RequireAuth><Wizard /></RequireAuth>} />
          <Route path="/app/projects/:id" element={<RequireAuth><Project /></RequireAuth>} />
          <Route path="/app/experiments" element={<RequireAuth><Experiments /></RequireAuth>} />
          <Route path="/app/market" element={<RequireAuth><Market /></RequireAuth>} />
          <Route path="/app/account" element={<RequireAuth><Account /></RequireAuth>} />
          <Route path="/app/settings" element={<RequireAuth><Settings /></RequireAuth>} />
          <Route path="/app/admin" element={<RequireAuth><Admin /></RequireAuth>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
      </LangProvider>
    </BrowserRouter>
  );
}

createRoot(document.getElementById('root')).render(<App />);
