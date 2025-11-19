import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiService } from '../services/api'; 

interface HeaderProps {
  isLoggedIn: boolean;
  setIsLoggedIn: React.Dispatch<React.SetStateAction<boolean>>;
}

interface UserProfile {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
}

const Header: React.FC<HeaderProps> = ({ isLoggedIn, setIsLoggedIn }) => {
  const navigate = useNavigate();
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowProfileMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const handleSystemLogout = () => {
      setIsLoggedIn(false);
      setUserProfile(null);
      navigate('/auth');
    };

    window.addEventListener('logout', handleSystemLogout);
    
    return () => {
      window.removeEventListener('logout', handleSystemLogout);
    };
  }, [navigate, setIsLoggedIn]);

  useEffect(() => {
    if (isLoggedIn) {
      fetchUserProfile();
    }
  }, [isLoggedIn]);

  const fetchUserProfile = async () => {
    try {
      const response = await apiService.request('/profile');
      
      if (response.ok) {
        const profile = await response.json();
        setUserProfile(profile);
      }
    } catch (error) {
      console.error('Ошибка загрузки профиля:', error);
    }
  };

  const handleLogout = async () => {
    try {
      await apiService.logout(); 
    } catch (error) {
      console.error('Ошибка при выходе:', error);
    } finally {
      setIsLoggedIn(false);
      setUserProfile(null);
      setShowProfileMenu(false);
      navigate('/');
    }
  };

  const getInitials = () => {
    if (!userProfile) return 'U';
    return `${userProfile.first_name[0]}${userProfile.last_name[0]}`.toUpperCase();
  };

  return (
    <header style={{ position: 'relative', height: 72, background: '#000000', color: 'white' }}>
      <div style={{ position: 'absolute', left: 8, top: 0, bottom: 0, display: 'flex', alignItems: 'center' }}>
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: 8,
            background: 'rgba(255,255,255,0.2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 700
          }}
        >
          OR
        </div>
      </div>

      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: 0,
          bottom: 0,
          transform: 'translateX(-50%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 20,
          fontWeight: 700
        }}
      >
        Отчетик
      </div>

      <div
        style={{
          position: 'absolute',
          right: 8,
          top: 0,
          bottom: 0,
          display: 'flex',
          alignItems: 'center',
          gap: 12
        }}
      >
        <button style={btnStyle} onClick={() => navigate('/')}>
          Главная
        </button>

        {isLoggedIn && (
          <>
            <button style={btnStyle} onClick={() => navigate('/upload')}>
              Загрузить
            </button>
            <button style={btnStyle} onClick={() => navigate('/my-uploads')}>
              Мои загрузки
            </button>
          </>
        )}

        {!isLoggedIn ? (
          <button style={btnStyle} onClick={() => navigate('/auth')}>
            Вход / Регистрация
          </button>
        ) : (
          <div style={{ position: 'relative' }} ref={menuRef}>
            <button
              style={{
                ...btnStyle,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '44px',
                height: '44px',
                padding: 0
              }}
              onClick={() => setShowProfileMenu(!showProfileMenu)}
              title="Профиль"
            >
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: '50%',
                  background: 'rgba(255,255,255,0.2)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 14,
                  fontWeight: 600
                }}
              >
                {getInitials()}
              </div>
            </button>

            {showProfileMenu && (
              <div
                style={{
                  position: 'absolute',
                  top: '100%',
                  right: 0,
                  marginTop: '8px',
                  background: 'white',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                  minWidth: '200px',
                  zIndex: 1000
                }}
              >
                <div
                  style={{
                    padding: '12px 16px',
                    borderBottom: '1px solid #f3f4f6'
                  }}
                >
                  <div style={{ fontWeight: 600, color: '#000000' }}>
                    {userProfile?.first_name} {userProfile?.last_name}
                  </div>
                  <div style={{ fontSize: '14px', color: '#6b7280', marginTop: '4px' }}>
                    {userProfile?.email}
                  </div>
                </div>
                
                <div style={{ padding: '8px' }}>
                  <button
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      background: 'transparent',
                      border: 'none',
                      borderRadius: '6px',
                      color: '#000000',
                      cursor: 'pointer',
                      textAlign: 'left',
                      fontSize: '14px'
                    }}
                    onClick={() => {
                      setShowProfileMenu(false);
                      navigate('/edit-profile');
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = '#f3f4f6';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'transparent';
                    }}
                  >
                    Редактировать профиль
                  </button>

                  <button
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      background: 'transparent',
                      border: 'none',
                      borderRadius: '6px',
                      color: '#000000',
                      cursor: 'pointer',
                      textAlign: 'left',
                      fontSize: '14px',
                      marginTop: '4px'
                    }}
                    onClick={handleLogout}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = '#f3f4f6';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'transparent';
                    }}
                  >
                    Выйти
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  );
};

const btnStyle: React.CSSProperties = {
  padding: '8px 12px',
  borderRadius: 8,
  background: 'transparent',
  border: '1px solid rgba(255,255,255,0.4)',
  color: 'white',
  cursor: 'pointer'
};

export default Header;