import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Header from './components/Header'
import Home from './pages/Home'
import Auth from './pages/Auth'
import Upload from './pages/Upload'
import Analysis from './pages/Analysis'
import MyUploads from './pages/MyUploads'
import EditProfile from './pages/EditProfile';
import { apiService } from './services/api';

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkAuth = () => {
      const authenticated = apiService.isAuthenticated();
      setIsLoggedIn(authenticated);
      setIsLoading(false);
    };

    checkAuth();

    const handleLogout = () => {
      setIsLoggedIn(false);
    };

    window.addEventListener('logout', handleLogout);
    
    return () => {
      window.removeEventListener('logout', handleLogout);
    };
  }, []);

  if (isLoading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        fontSize: '18px',
        color: 'var(--muted)'
      }}>
        Загрузка...
      </div>
    );
  }

  return (
    <>
      <Header isLoggedIn={isLoggedIn} setIsLoggedIn={setIsLoggedIn} />
      <Routes>
        <Route path="/" element={<Home setIsLoggedIn={setIsLoggedIn} />} />
        <Route
          path="/upload"
          element={isLoggedIn ? <Upload /> : <Navigate to="/auth" replace />}
        />
        <Route
          path="/analysis"
          element={isLoggedIn ? <Analysis /> : <Navigate to="/auth" replace />}
        />
        <Route
          path="/my-uploads"
          element={isLoggedIn ? <MyUploads /> : <Navigate to="/auth" replace />}
        />
        <Route 
          path="/edit-profile" 
          element={isLoggedIn ? <EditProfile /> : <Navigate to="/auth" replace />} 
        />
        <Route 
          path="/auth" 
          element={
            !isLoggedIn ? (
              <Auth setIsLoggedIn={setIsLoggedIn} />
            ) : (
              <Navigate to="/upload" replace />
            )
          } 
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}