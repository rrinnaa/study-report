import React from 'react';
import { useNavigate } from 'react-router-dom';

interface HeaderProps {
  isLoggedIn: boolean;
  setIsLoggedIn: React.Dispatch<React.SetStateAction<boolean>>;
}

const Header: React.FC<HeaderProps> = ({ isLoggedIn, setIsLoggedIn }) => {
  const navigate = useNavigate();

  return (
    <header style={{ position: 'relative', height: 72, background: '#000000', color: 'white' }}>
      <div style={{ position: 'absolute', left: 8, top: 0, bottom: 0, display: 'flex', alignItems: 'center' }}>
        <div style={{ width: 44, height: 44, borderRadius: 8, background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>
          OR
        </div>
      </div>

      <div style={{ position: 'absolute', left: '50%', top: 0, bottom: 0, transform: 'translateX(-50%)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 700 }}>
        Отчетик
      </div>

      <div style={{ position: 'absolute', right: 8, top: 0, bottom: 0, display: 'flex', alignItems: 'center', gap: 12 }}>
        <button style={btnStyle} onClick={() => navigate('/')}>Главная</button>
        {isLoggedIn && <button style={btnStyle} onClick={() => navigate('/upload')}>Загрузить</button>}
        {!isLoggedIn ? (
          <button style={btnStyle} onClick={() =>  navigate('/auth')}>
            Вход / Регистрация
          </button>
        ) : (
          <button style={btnStyle} onClick={() => { localStorage.removeItem('token'); setIsLoggedIn(false); navigate('/') }}>
            Выйти
          </button>
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

