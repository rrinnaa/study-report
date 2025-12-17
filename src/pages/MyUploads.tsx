import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiService } from '../services/api';

interface Upload {
  id: number;
  filename: string;
  score: number;
  created_at: string;
}

interface PaginationData {
  items: Upload[];
  total: number;
  page: number;
  limit: number;
}

const MyUploads: React.FC = () => {
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 6,
    total: 0
  });
  const navigate = useNavigate();

  const fetchUploads = async (page = 1) => {
    try {
      const response = await apiService.request(`/my-uploads?page=${page}&limit=${pagination.limit}`);
      const data: PaginationData = await response.json();
      
      if (data && Array.isArray(data.items)) {
        setUploads(data.items);
        setPagination({
          page: data.page,
          limit: data.limit,
          total: data.total
        });
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
      const response = await apiService.request(`/upload/${id}`, {
        method: 'DELETE'
      });

      await response.json();
      
      fetchUploads(pagination.page);
    } catch (err: any) {
      alert('Ошибка при удалении: ' + err.message);
    } finally {
      setDeletingId(null);
    }
  };

  const viewFullAnalysis = async (uploadId: number) => {
    try {
      const response = await apiService.request(`/upload/${uploadId}/details`);
      const fullResult = await response.json();
      
      const upload = uploads.find(u => u.id === uploadId);
      sessionStorage.setItem('analysis_result', JSON.stringify(fullResult));
      sessionStorage.setItem('uploaded_file_name', upload?.filename || '');
      
      navigate('/analysis');
    } catch (err: any) {
      alert('Ошибка при загрузке деталей анализа: ' + err.message);
    }
  };

  useEffect(() => {
    const handleLogout = () => {
      navigate('/auth');
    };

    window.addEventListener('logout', handleLogout);
    
    return () => {
      window.removeEventListener('logout', handleLogout);
    };
  }, [navigate]);

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

  const handleRetry = async () => {
    setLoading(true);
    setError('');
    await fetchUploads(pagination.page);
  };

  const [isChangingPage, setIsChangingPage] = useState(false);

  const changePage = (newPage: number) => {
  if (isChangingPage) return; 
  
  if (newPage >= 1 && newPage <= totalPages) {
    setIsChangingPage(true);
    setLoading(true);
    fetchUploads(newPage).finally(() => setIsChangingPage(false));
  }
};
  
  const totalPages = Math.ceil(pagination.total / pagination.limit);

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
        onClick={handleRetry}
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
        onClick={() => navigate('/upload')} 
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
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ color: 'var(--muted)' }}>
            Показано: <strong style={{ color: 'var(--text)' }}>{uploads.length}</strong> из <strong style={{ color: 'var(--text)' }}>{pagination.total}</strong>
          </div>
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
                  {new Date(upload.created_at).toLocaleDateString('ru-RU', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
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

      {totalPages > 1 && (
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          gap: '10px',
          marginTop: '40px',
          paddingTop: '20px',
          borderTop: '1px solid var(--control-border)'
        }}>
          <button
            onClick={() => changePage(pagination.page - 1)}
            disabled={pagination.page <= 1 || isChangingPage}
            className="btn"
            style={{
              padding: '8px 16px',
              opacity: pagination.page <= 1 ? 0.5 : 1,
              cursor: pagination.page <= 1 ? 'not-allowed' : 'pointer'
            }}
          >
            ← Назад
          </button>

          <div style={{
            display: 'flex',
            gap: '5px',
            alignItems: 'center'
          }}>
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              let pageNum;
              if (totalPages <= 5) {
                pageNum = i + 1;
              } else if (pagination.page <= 3) {
                pageNum = i + 1;
              } else if (pagination.page >= totalPages - 2) {
                pageNum = totalPages - 4 + i;
              } else {
                pageNum = pagination.page - 2 + i;
              }

              return (
                <button
                  key={pageNum}
                  onClick={() => changePage(pageNum)}
                  style={{
                    padding: '8px 12px',
                    background: pagination.page === pageNum ? 'var(--accent)' : 'transparent',
                    color: pagination.page === pageNum ? 'white' : 'var(--text)',
                    border: '1px solid var(--control-border)',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    minWidth: '40px'
                  }}
                >
                  {pageNum}
                </button>
              );
            })}
          </div>

          <button
            onClick={() => changePage(pagination.page + 1)}
            disabled={pagination.page >= totalPages}
            className="btn"
            style={{
              padding: '8px 16px',
              opacity: pagination.page >= totalPages ? 0.5 : 1,
              cursor: pagination.page >= totalPages ? 'not-allowed' : 'pointer'
            }}
          >
            Вперёд →
          </button>
        </div>
      )}

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