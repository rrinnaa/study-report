import React, { Suspense, lazy, useMemo, useState, useEffect } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Header from './components/Header'
import Home from './pages/Home'
import Seo from './components/Seo'
import NotFound from './pages/NotFound'
import { LEGACY_ROUTE_REDIRECTS, ROUTES } from './constants/routes'
import { apiService } from './services/api';

const Auth = lazy(() => import('./pages/Auth'))
const Upload = lazy(() => import('./pages/Upload'))
const Analysis = lazy(() => import('./pages/Analysis'))
const MyUploads = lazy(() => import('./pages/MyUploads'))
const EditProfile = lazy(() => import('./pages/EditProfile'))
const AdminPanel = lazy(() => import('./pages/AdminPanel'))

function RouteSeo() {
  const location = useLocation()

  const seo = useMemo(() => {
    if (location.pathname === ROUTES.HOME) {
      return {
        title: 'Анализ структуры учебных отчётов | Study Report',
        description: 'Проверка учебных работ: загрузите отчёт и получите анализ структуры, ошибок и рекомендации по оформлению.',
        canonicalPath: ROUTES.HOME,
        noindex: false,
        jsonLd: {
          '@context': 'https://schema.org',
          '@type': 'SoftwareApplication',
          name: 'Study Report Analyzer',
          applicationCategory: 'EducationalApplication',
          operatingSystem: 'Web',
          description: 'Сервис проверки структуры учебных отчётов и научных работ.',
          url: ROUTES.HOME,
        },
      }
    }

    const privateRoutes = [
      ROUTES.AUTH,
      ROUTES.UPLOAD,
      ROUTES.ANALYSIS,
      ROUTES.MY_UPLOADS,
      ROUTES.EDIT_PROFILE,
      ROUTES.ADMIN,
    ]

    if (privateRoutes.includes(location.pathname as typeof privateRoutes[number])) {
      const titles: Record<string, string> = {
        [ROUTES.AUTH]: 'Вход и регистрация | Study Report',
        [ROUTES.UPLOAD]: 'Загрузка отчёта | Study Report',
        [ROUTES.ANALYSIS]: 'Результат анализа | Study Report',
        [ROUTES.MY_UPLOADS]: 'Мои загрузки | Study Report',
        [ROUTES.EDIT_PROFILE]: 'Редактирование профиля | Study Report',
        [ROUTES.ADMIN]: 'Панель администратора | Study Report',
      }

      return {
        title: titles[location.pathname] || 'Study Report',
        description: 'Рабочая страница личного кабинета сервиса Study Report.',
        canonicalPath: location.pathname,
        noindex: true,
      }
    }

    return {
      title: 'Страница не найдена | Study Report',
      description: 'Запрошенная страница не найдена.',
      canonicalPath: location.pathname,
      noindex: true,
    }
  }, [location.pathname])

  return <Seo {...seo} />
}

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
      <RouteSeo />
      <Header isLoggedIn={isLoggedIn} setIsLoggedIn={setIsLoggedIn} />
      <Suspense
        fallback={
          <div style={{ display: 'flex', justifyContent: 'center', padding: '48px', color: 'var(--muted)' }}>
            Загрузка страницы...
          </div>
        }
      >
        <Routes>
          <Route path={ROUTES.HOME} element={<Home setIsLoggedIn={setIsLoggedIn} />} />
          <Route
            path={ROUTES.UPLOAD}
            element={isLoggedIn ? <Upload /> : <Navigate to={ROUTES.AUTH} replace />}
          />
          <Route
            path={ROUTES.ANALYSIS}
            element={isLoggedIn ? <Analysis /> : <Navigate to={ROUTES.AUTH} replace />}
          />
          <Route
            path={ROUTES.MY_UPLOADS}
            element={isLoggedIn ? <MyUploads /> : <Navigate to={ROUTES.AUTH} replace />}
          />
          <Route
            path={ROUTES.EDIT_PROFILE}
            element={isLoggedIn ? <EditProfile /> : <Navigate to={ROUTES.AUTH} replace />}
          />
          <Route
            path={ROUTES.ADMIN}
            element={isLoggedIn && apiService.getCurrentUser()?.role === 'admin' ? <AdminPanel /> : <Navigate to={ROUTES.HOME} replace />}
          />
          <Route
            path={ROUTES.AUTH}
            element={
              !isLoggedIn ? (
                <Auth setIsLoggedIn={setIsLoggedIn} />
              ) : (
                <Navigate to={ROUTES.UPLOAD} replace />
              )
            }
          />

          {Object.entries(LEGACY_ROUTE_REDIRECTS).map(([fromPath, toPath]) => (
            <Route key={fromPath} path={fromPath} element={<Navigate to={toPath} replace />} />
          ))}

          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </>
  );
}