import React from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { TrackingProvider } from './contexts/TrackingContext';
import Layout from './components/Layout';
import AuthScreen from './pages/AuthScreen';
import VehiclesPage from './pages/VehiclesPage';
import LiveMapPage from './pages/LiveMapPage';
import HistoryPage from './pages/HistoryPage';
import ReportsPage from './pages/ReportsPage';
import AlertsPage from './pages/AlertsPage';
import ProfilePage from './pages/ProfilePage';

import PublicTrackingPage from './pages/PublicTrackingPage';

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="w-full h-full min-h-[100dvh] bg-slate-50 flex flex-col items-center justify-center text-slate-500 space-y-3">
        <div className="w-10 h-10 border-3 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
        <span className="text-xs font-bold text-slate-700">Connecting to Vehicles...</span>
      </div>
    );
  }

  if (!user) {
    return <AuthScreen />;
  }

  return (
    <TrackingProvider>
      {children}
    </TrackingProvider>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          {/* Public Live Tracking Link (No Login Required) */}
          <Route path="/track/:id" element={<PublicTrackingPage />} />
          <Route path="/share/:id" element={<PublicTrackingPage />} />

          {/* Authenticated Customer Fleet Portal */}
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route index element={<VehiclesPage />} />
            <Route path="map" element={<LiveMapPage />} />
            <Route path="history" element={<HistoryPage />} />
            <Route path="reports" element={<ReportsPage />} />
            <Route path="alerts" element={<AlertsPage />} />
            <Route path="profile" element={<ProfilePage />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}
