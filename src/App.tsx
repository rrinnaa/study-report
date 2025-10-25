import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Header from './components/Header'
import Home from './pages/Home'
import Auth from './pages/Auth'
import Upload from './pages/Upload'
import Analysis from './pages/Analysis'

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('token');
    setIsLoggedIn(!!token);
  }, []);

  return (
    <>
      <Header isLoggedIn={isLoggedIn} setIsLoggedIn={setIsLoggedIn} />
      <Routes>
        <Route path="/" element={<Home setIsLoggedIn={setIsLoggedIn} />} />
        <Route
          path="/upload"
          element={isLoggedIn ? <Upload /> : <Navigate to="/auth" replace />}
        />
        <Route path="/auth" element={<Auth setIsLoggedIn={setIsLoggedIn} />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}