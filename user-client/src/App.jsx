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

import AppSplashScreen from './components/AppSplashScreen';
import PublicTrackingPage from './pages/PublicTrackingPage';

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  const [initialSplash, setInitialSplash] = React.useState(true);

  React.useEffect(() => {
    const timer = setTimeout(() => {
      setInitialSplash(false);
    }, 1200);
    return () => clearTimeout(timer);
  }, []);

  if (loading || initialSplash) {
    return <AppSplashScreen message="Authenticating Fleet Hardware..." />;
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
