import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { apiService } from '../services/api';
import { ROUTES } from '../constants/routes';

interface Upload {
  id: number;
  filename: string;
  score: number;
  created_at: string;
  has_file: boolean;
}

interface PaginationData {
  items: Upload[];
  total: number;
  page: number;
  limit: number;
}

const MyUploads: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [uploads, setUploads] = useState<Upload[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState('');
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [downloadingId, setDownloadingId] = useState<number | null>(null);
  const [isChangingPage, setIsChangingPage] = useState(false);
  const [pagination, setPagination] = useState({ page: 1, limit: 6, total: 0 });

  const [searchQuery, setSearchQuery] = useState(searchParams.get('search') || '');
  const [sortBy, setSortBy] = useState<'created_at' | 'score'>(
    (searchParams.get('sort_by') as 'created_at' | 'score') || 'created_at'
  );
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>(
    (searchParams.get('sort_order') as 'asc' | 'desc') || 'desc'
  );

  const fetchUploads = async (page = 1, isSearch = false) => {
    try {
      isSearch ? setIsSearching(true) : setLoading(true);
      
      const params: any = { page, limit: pagination.limit };
      
      if (searchQuery.trim()) params.search = searchQuery.trim();
      if (sortBy) {
        params.sort_by = sortBy;
        params.sort_order = sortOrder;
      }
      
      const data: PaginationData = await apiService.getMyUploads(params);
      
      if (data && Array.isArray(data.items)) {
        setUploads(data.items);
        setPagination({ page: data.page, limit: data.limit, total: data.total });
      } else {
        setError('Неверный формат данных от сервера');
      }
    } catch (err: any) {
      setError(err.message || 'Ошибка при загрузке данных');
    } finally {
      setLoading(false);
      setIsSearching(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => fetchUploads(1, true), searchQuery ? 500 : 0);
    return () => clearTimeout(timer);
  }, [searchQuery, sortBy, sortOrder]);
  
  useEffect(() => {
    const params = new URLSearchParams();
    
    if (searchQuery.trim()) params.set('search', searchQuery.trim());
    if (sortBy !== 'created_at') params.set('sort_by', sortBy);
    if (sortOrder !== 'desc') params.set('sort_order', sortOrder);
    if (pagination.page > 1) params.set('page', String(pagination.page));
    
    setSearchParams(params, { replace: true });
  }, [searchQuery, sortBy, sortOrder, pagination.page]);

  const deleteUpload = async (id: number) => {
    if (!confirm('Вы уверены, что хотите удалить эту загрузку?')) return;

    setDeletingId(id);
    try {
      await apiService.request(`/upload/${id}`, { method: 'DELETE' });
      await fetchUploads(pagination.page);
    } catch (err: any) {
      alert('Ошибка при удалении: ' + err.message);
    } finally {
      setDeletingId(null);
    }
  };

  const downloadFile = async (id: number) => {
    setDownloadingId(id);
    try {
      const { download_url, filename } = await apiService.getDownloadUrl(id);
      const a = document.createElement('a');
      a.href = download_url;
      a.download = filename;
      a.target = '_blank';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (err: any) {
      alert('Ошибка при скачивании: ' + err.message);
    } finally {
      setDownloadingId(null);
    }
  };

  const viewFullAnalysis = async (uploadId: number) => {
    try {
      const response = await apiService.request(`/upload/${uploadId}/details`);
      const fullResult = await response.json();
      
      const upload = uploads.find(u => u.id === uploadId);
      sessionStorage.setItem('analysis_result', JSON.stringify(fullResult));
      sessionStorage.setItem('uploaded_file_name', upload?.filename || '');
      
      navigate(ROUTES.ANALYSIS);
    } catch (err: any) {
      alert('Ошибка при загрузке деталей анализа: ' + err.message);
    }
  };

  useEffect(() => {
    const handleLogout = () => navigate(ROUTES.AUTH);
    window.addEventListener('logout', handleLogout);
    return () => window.removeEventListener('logout', handleLogout);
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

  const hasActiveFilters = searchQuery.trim() || sortBy !== 'created_at' || sortOrder !== 'desc';

  if (uploads.length === 0) {
    if (hasActiveFilters) {
      return (
        <div className="container" style={{ textAlign: 'center', padding: '60px 20px' }}>
          <div style={{ fontSize: '4rem', opacity: 0.5, marginBottom: '20px' }}>🔍</div>
          <h1 className="h1" style={{ marginBottom: '12px' }}>Ничего не найдено</h1>
          <p className="lead" style={{ marginBottom: '30px', color: 'var(--muted)' }}>
            По вашему запросу "{searchQuery}" не найдено ни одного документа
          </p>
          <button 
            className="btn btn-primary"
            onClick={() => {
              setSearchQuery('');
              setSortBy('created_at');
              setSortOrder('desc');
            }}
          >
            🔄 Сбросить фильтры
          </button>
        </div>
      );
    }
    
    return (
      <div className="container" style={{ textAlign: 'center', padding: '60px 20px' }}>
        <div style={{ fontSize: '4rem', opacity: 0.5, marginBottom: '20px' }}>📁</div>
        <h1 className="h1" style={{ marginBottom: '12px' }}>У вас пока нет анализов</h1>
        <p className="lead" style={{ marginBottom: '30px' }}>Загрузите свой первый документ для анализа</p>
        <button 
          className="btn btn-primary btn-large"
          onClick={() => navigate(ROUTES.UPLOAD)} 
        >
          Загрузить документ
        </button>
      </div>
    );
  }

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
          Показано: <strong style={{ color: 'var(--text)' }}>{uploads.length}</strong> из <strong style={{ color: 'var(--text)' }}>{pagination.total}</strong>
        </div>
      </div>

      <div style={{
        display: 'flex',
        gap: '10px',
        marginBottom: '24px',
        flexWrap: 'wrap',
        alignItems: 'stretch'
      }}>
        <div style={{ flex: '1 1 200px', minWidth: '150px', maxWidth: '220px', position: 'relative' }}>
          <input
            type="text"
            placeholder="🔍 Поиск..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              padding: '9px 12px',
              paddingRight: isSearching ? '35px' : '12px',
              border: '1px solid var(--control-border)',
              borderRadius: '8px',
              background: 'var(--control-bg)',
              color: 'var(--text)',
              fontSize: '14px',
              boxSizing: 'border-box'
            }}
          />
          {isSearching && (
            <div style={{
              position: 'absolute',
              right: '10px',
              top: '50%',
              transform: 'translateY(-50%)',
              width: '16px',
              height: '16px',
              border: '2px solid var(--control-border)',
              borderLeft: '2px solid var(--accent)',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite'
            }}></div>
          )}
        </div>

        <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'nowrap', flex: '0 0 auto' }}>
          <span style={{ color: 'var(--muted)', fontSize: '13px', whiteSpace: 'nowrap' }}>Сортировка:</span>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as 'created_at' | 'score')}
            style={{
              padding: '9px 10px',
              border: '1px solid var(--control-border)',
              borderRadius: '8px',
              background: 'var(--control-bg)',
              color: 'var(--text)',
              fontSize: '14px',
              cursor: 'pointer',
              minWidth: '120px'
            }}
          >
            <option value="created_at">📅 По дате</option>
            <option value="score">⭐ По оценке</option>
          </select>

          <button
            onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
            style={{
              padding: '9px 12px',
              background: 'transparent',
              border: '1px solid var(--control-border)',
              borderRadius: '8px',
              color: 'var(--text)',
              cursor: 'pointer',
              fontSize: '16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.2s ease',
              minWidth: '38px'
            }}
            title={sortOrder === 'asc' ? 'По возрастанию' : 'По убыванию'}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--control-border)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
            }}
          >
            {sortOrder === 'asc' ? '↑' : '↓'}
          </button>
        </div>

        {(searchQuery || sortBy !== 'created_at' || sortOrder !== 'desc') && (
          <button
            onClick={() => {
              setSearchQuery('');
              setSortBy('created_at');
              setSortOrder('desc');
            }}
            style={{
              padding: '9px 12px',
              background: 'transparent',
              border: '1px solid var(--control-border)',
              borderRadius: '8px',
              color: 'var(--muted)',
              cursor: 'pointer',
              fontSize: '14px',
              whiteSpace: 'nowrap',
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = 'var(--text)';
              e.currentTarget.style.background = 'var(--control-border)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = 'var(--muted)';
              e.currentTarget.style.background = 'transparent';
            }}
          >
            🔄 Сбросить
          </button>
        )}
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
              
              {upload.has_file && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  downloadFile(upload.id);
                }}
                disabled={downloadingId === upload.id}
                style={{
                  background: 'transparent',
                  border: '1px solid var(--control-border)',
                  color: 'var(--accent)',
                  padding: '6px 10px',
                  borderRadius: '6px',
                  cursor: downloadingId === upload.id ? 'not-allowed' : 'pointer',
                  opacity: downloadingId === upload.id ? 0.6 : 1,
                  fontSize: '14px',
                  minWidth: 'auto'
                }}
                title="Скачать PDF-отчёт"
              >
                {downloadingId === upload.id ? '⏳' : '📄'}
              </button>
              )}

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