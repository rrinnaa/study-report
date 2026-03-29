import React, { Dispatch, SetStateAction, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ROUTES } from '../constants/routes';
import { apiService } from '../services/api';

interface HomeProps {
  setIsLoggedIn: Dispatch<SetStateAction<boolean>>;
}

export default function Home({ setIsLoggedIn }: HomeProps) {
  const navigate = useNavigate();
  const [tip, setTip] = useState<string>('');
  const [tipLoading, setTipLoading] = useState(true);
  const [tipError, setTipError] = useState<string>('');

  useEffect(() => {
    const user = apiService.getCurrentUser();
    setIsLoggedIn(apiService.isAuthenticated() && Boolean(user));

    let cancelled = false;

    const loadTip = async () => {
      try {
        setTipLoading(true);
        setTipError('');
        const data = await apiService.getStudyTip();
        if (cancelled) return;
        setTip(data.tip || 'Сформулируйте цель отчета в одном предложении перед началом работы.');
      } catch {
        if (cancelled) return;
        setTipError('Внешний сервис советов временно недоступен.');
        setTip('Сохраняйте единый стиль заголовков, чтобы структура отчета была читаемой.');
      } finally {
        if (!cancelled) {
          setTipLoading(false);
        }
      }
    };

    loadTip();

    return () => {
      cancelled = true;
    };
  }, [setIsLoggedIn]);

  const handleUploadClick = () => {
    if (apiService.isAuthenticated()) navigate(ROUTES.UPLOAD);
    else navigate(ROUTES.AUTH);
  };

  return (
    <main className="home" aria-label="Главная страница сервиса анализа учебных работ">
      <section>
        <h1 className="h1">Проверка учебных отчетов по структуре</h1>
        <p className="lead">
          Загрузите файл с отчётом, и сервис проверит ключевые разделы: введение, цели, ход работы, выводы и рекомендации.
        </p>
      </section>

      <section style={{ display: 'flex', justifyContent: 'center', gap: 12, flexWrap: 'wrap' }}>
        <button className="btn btn-primary" onClick={handleUploadClick}>
          Загрузить файл
        </button>
        <button className="btn" onClick={() => navigate(ROUTES.AUTH)}>
          Вход / Регистрация
        </button>
      </section>

      <section
        style={{
          maxWidth: 760,
          margin: '28px auto 0',
          textAlign: 'left',
          border: '1px solid var(--control-border)',
          borderRadius: 12,
          padding: '18px 20px',
          background: '#f8fafc',
        }}
        aria-live="polite"
      >
        <h2 style={{ marginTop: 0, marginBottom: 10, fontSize: 20 }}>Совет по оформлению</h2>
        {tipLoading && <p style={{ margin: 0, color: 'var(--muted)' }}>Загрузка данных...</p>}
        {!tipLoading && <p style={{ margin: 0 }}>{tip}</p>}
        {tipError && <p style={{ color: '#b45309', marginTop: 10, marginBottom: 0 }}>{tipError}</p>}
      </section>
    </main>
  );
}

