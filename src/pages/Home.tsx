import React, { Dispatch, SetStateAction } from 'react';
import { useNavigate } from 'react-router-dom';

interface HomeProps {
  setIsLoggedIn: Dispatch<SetStateAction<boolean>>;
}

export default function Home({ setIsLoggedIn }: HomeProps) {
  const navigate = useNavigate();

  const handleUploadClick = () => {
    const token = localStorage.getItem('token');
    if (token) navigate('/upload');
    else navigate('/auth');
  };

  return (
    <div className="home">
      <h1 className="h1">Проверка учебных отчетов по структуре</h1>
      <p className="lead">
        Загрузите файл с отчётом — мы сравним структуру с эталонным шаблоном и покажем, чего не хватает.
      </p>
      <div style={{ display: 'flex', justifyContent: 'center', gap: 12 }}>
        <button className="btn btn-primary" onClick={handleUploadClick}>
          Загрузить файл
        </button>
        <button className="btn" onClick={() => navigate('/auth')}>
          Вход / Регистрация
        </button>
      </div>
    </div>
  );
}

