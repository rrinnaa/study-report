import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

interface Upload {
  id: number;
  filename: string;
  score: number;
  created_at: string;
}

const MyUploads: React.FC = () => {
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const navigate = useNavigate();

  const fetchUploads = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setError('Пользователь не авторизован');
        return;
      }

      const response = await fetch('http://localhost:8000/api/my-uploads', {
        headers: { 
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Ошибка сервера: ${response.status}`);
      }

      const data = await response.json();
      
      if (Array.isArray(data)) {
        setUploads(data);
      } else {
        setError('Неверный формат данных от сервера');
      }
      
    } catch (err: any) {
      setError(err.message || 'Ошибка при загрузке данных');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUploads();
  }, []);

  const deleteUpload = async (id: number) => {
    if (!confirm('Вы уверены, что хотите удалить эту загрузку?')) {
      return;
    }

    setDeletingId(id);
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setError('Пользователь не авторизован');
        return;
      }

      const response = await fetch(`http://localhost:8000/api/upload/${id}`, {
        method: 'DELETE',
        headers: { 
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Ошибка удаления: ${response.status}`);
      }

      setUploads(uploads.filter(upload => upload.id !== id));
      
    } catch (err: any) {
      alert('Ошибка при удалении: ' + err.message);
    } finally {
      setDeletingId(null);
    }
  };

  const viewFullAnalysis = async (uploadId: number) => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setError('Пользователь не авторизован');
        return;
      }

      const response = await fetch(`http://localhost:8000/api/upload/${uploadId}/details`, {
        headers: { 
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Ошибка загрузки деталей: ${response.status}`);
      }

      const fullResult = await response.json();
      
      sessionStorage.setItem('analysis_result', JSON.stringify(fullResult));
      navigate('/analysis');
      
    } catch (err: any) {
      alert('Ошибка при загрузке деталей анализа: ' + err.message);
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return '#10b981';
    if (score >= 60) return '#f59e0b';
    return '#ef4444';
  };

  const getScoreText = (score: number) => {
    if (score >= 80) return 'Отлично';
    if (score >= 60) return 'Хорошо';
    if (score >= 40) return 'Удовлетворительно';
    return 'Неудовлетворительно';
  };

if (loading) return (
    <div className="container" style={{ textAlign: 'center', padding: '60px 20px' }}>
      <div style={{ 
        width: '40px', 
        height: '40px', 
        border: '4px solid var(--control-border)',
        borderLeft: '4px solid var(--accent)',
        borderRadius: '50%',
        margin: '0 auto 20px',
        animation: 'spin 1s linear infinite'
      }}></div>
      <div style={{ color: 'var(--muted)' }}>Загрузка ваших анализов...</div>
    </div>
  );

  if (error) return (
    <div className="container" style={{ textAlign: 'center', padding: '60px 20px' }}>
      <div style={{ fontSize: '3rem', marginBottom: '20px' }}>⚠️</div>
      <div style={{ color: 'var(--text)', marginBottom: '20px' }}>{error}</div>
      <button 
        className="btn btn-primary"
        onClick={() => window.location.reload()}
      >
        Попробовать снова
      </button>
    </div>
  );

  if (uploads.length === 0) return (
    <div className="container" style={{ textAlign: 'center', padding: '60px 20px' }}>
      <div style={{ fontSize: '4rem', opacity: 0.5, marginBottom: '20px' }}>📁</div>
      <h1 className="h1" style={{ marginBottom: '12px' }}>У вас пока нет анализов</h1>
      <p className="lead" style={{ marginBottom: '30px' }}>Загрузите свой первый документ для анализа</p>
      <button 
        className="btn btn-primary btn-large"
        onClick={() => window.location.href = '/upload'}
      >
        Загрузить документ
      </button>
    </div>
  );

  return (
    <div className="container">
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        marginBottom: '30px',
        paddingBottom: '20px',
        borderBottom: '1px solid var(--control-border)'
      }}>
        <h1 className="h1" style={{ margin: 0 }}>Мои загрузки</h1>
        <div style={{ color: 'var(--muted)' }}>
          Всего анализов: <strong style={{ color: 'var(--text)' }}>{uploads.length}</strong>
        </div>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
        gap: '20px',
        marginTop: '20px'
      }}>
        {uploads.map((upload) => (
          <div 
            key={upload.id}
            style={{
              background: 'var(--page-bg)',
              border: '1px solid var(--control-border)',
              borderRadius: '12px',
              padding: '20px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
              transition: 'all 0.3s ease',
              position: 'relative'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-4px)';
              e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.15)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)';
            }}
          >
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              marginBottom: '15px'
            }}>
              <div style={{ flex: 1 }}>
                <h3 style={{ 
                  margin: '0 0 8px 0',
                  fontSize: '16px',
                  fontWeight: '600',
                  color: 'var(--text)',
                  lineHeight: '1.4',
                  cursor: 'pointer'
                }}
                onClick={() => viewFullAnalysis(upload.id)}
                >
                  {upload.filename}
                </h3>
                <div style={{ 
                  color: 'var(--muted)', 
                  fontSize: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}>
                  <span>📅</span>
                  {new Date(upload.created_at).toLocaleDateString('ru-RU')}
                </div>
              </div>
              
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  deleteUpload(upload.id);
                }}
                disabled={deletingId === upload.id}
                style={{
                  background: 'transparent',
                  border: '1px solid var(--control-border)',
                  color: '#ef4444',
                  padding: '6px 10px',
                  borderRadius: '6px',
                  cursor: deletingId === upload.id ? 'not-allowed' : 'pointer',
                  opacity: deletingId === upload.id ? 0.6 : 1,
                  fontSize: '14px',
                  minWidth: 'auto'
                }}
                title="Удалить анализ"
              >
                {deletingId === upload.id ? '⏳' : '🗑️'}
              </button>
            </div>

            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginTop: '15px',
              paddingTop: '15px',
              borderTop: '1px solid var(--control-border)'
            }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ 
                  fontSize: '12px',
                  color: 'var(--muted)',
                  marginBottom: '4px'
                }}>
                  Оценка
                </div>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  <div 
                    style={{ 
                      backgroundColor: getScoreColor(upload.score),
                      color: 'white',
                      padding: '8px 16px',
                      borderRadius: '20px',
                      fontWeight: '600',
                      fontSize: '16px',
                      minWidth: '60px',
                      cursor: 'pointer'
                    }}
                    onClick={() => viewFullAnalysis(upload.id)}
                    title="Посмотреть полный анализ"
                  >
                    {upload.score}%
                  </div>
                </div>
              </div>

              <div style={{ textAlign: 'center' }}>
                <div style={{ 
                  fontSize: '12px',
                  color: 'var(--muted)',
                  marginBottom: '4px'
                }}>
                  Статус
                </div>
                <div style={{
                  color: getScoreColor(upload.score),
                  fontSize: '14px',
                  fontWeight: '600'
                }}>
                  {getScoreText(upload.score)}
                </div>
              </div>
            </div>

            <button
              onClick={() => viewFullAnalysis(upload.id)}
              style={{
                width: '100%',
                marginTop: '15px',
                padding: '10px',
                background: 'transparent',
                border: '1px solid var(--control-border)',
                borderRadius: '8px',
                color: 'var(--text)',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '500',
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'var(--control-border)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
              }}
            >
              📊 Посмотреть полный анализ
            </button>
          </div>
        ))}
      </div>

      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default MyUploads;