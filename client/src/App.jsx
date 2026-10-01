import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { FleetProvider } from './contexts/FleetContext';
import Layout from './components/Layout';
import AuthScreen from './pages/AuthScreen';
import FleetDashboard from './pages/FleetDashboard';
import DevicesManager from './pages/DevicesManager';
import UsersDirectory from './pages/UsersDirectory';
import ReportsHub from './pages/ReportsHub';
import Geofences from './pages/Geofences';
import SystemPorts from './pages/SystemPorts';
import NotificationsCenter from './pages/NotificationsCenter';
import DriversManager from './pages/DriversManager';
import MaintenanceHub from './pages/MaintenanceHub';
import GroupsManager from './pages/GroupsManager';

function ExternalAppRedirect() {
  React.useEffect(() => {
    window.location.href = '/app';
  }, []);
  return (
    <div className="fixed inset-0 bg-slate-900 flex items-center justify-center text-white text-xs font-bold">
      Loading Tracking App...
    </div>
  );
}

const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return <div className="fixed inset-0 bg-slate-900 flex items-center justify-center text-white">Loading...</div>;
  if (!user) return <Navigate to="/login" />;
  return <FleetProvider>{children}</FleetProvider>;
};

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<AuthScreen />} />

          {/* User Mobile Tracking App Route Forwarder */}
          <Route path="/app/*" element={<ExternalAppRedirect />} />
          <Route path="/app" element={<ExternalAppRedirect />} />

          {/* Admin Fleet Operations Portal */}
          <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
            <Route index element={<FleetDashboard />} />
            <Route path="devices" element={<DevicesManager />} />
            <Route path="users" element={<UsersDirectory />} />
            <Route path="reports" element={<ReportsHub />} />
            <Route path="geofences" element={<Geofences />} />
            <Route path="notifications" element={<NotificationsCenter />} />
            <Route path="drivers" element={<DriversManager />} />
            <Route path="maintenance" element={<MaintenanceHub />} />
            <Route path="groups" element={<GroupsManager />} />
            <Route path="system" element={<SystemPorts />} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
