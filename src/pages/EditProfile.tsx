import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiService } from '../services/api';

interface UserProfile {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
}

const EditProfile: React.FC = () => {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    email: '',
    password: '',
    confirmPassword: ''
  });

  useEffect(() => {
    const handleLogout = () => {
      navigate('/auth');
    };

    window.addEventListener('logout', handleLogout);
    
    return () => {
      window.removeEventListener('logout', handleLogout);
    };
  }, [navigate]);

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const response = await apiService.request('/profile');
      
      if (response.ok) {
        const userProfile = await response.json();
        setProfile(userProfile);
        setFormData({
          first_name: userProfile.first_name,
          last_name: userProfile.last_name,
          email: userProfile.email,
          password: '',
          confirmPassword: ''
        });
      } else {
        throw new Error('Ошибка загрузки профиля');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSaving(true);

    if (formData.password && formData.password !== formData.confirmPassword) {
      setError('Пароли не совпадают');
      setSaving(false);
      return;
    }

    if (formData.password) {
      const passwordRegex = /^(?=.*[A-Z])(?=.*\d)[A-Za-z\d]{6,14}$/;
      if (!passwordRegex.test(formData.password)) {
        setError('Пароль должен содержать 6-14 символов, одну заглавную букву и одну цифру');
        setSaving(false);
        return;
      }
    }

    try {
      const updateData: any = {
        first_name: formData.first_name,
        last_name: formData.last_name,
        email: formData.email
      };

      if (formData.password) {
        updateData.password = formData.password;
      }

      const response = await apiService.request('/profile', {
        method: 'PUT',
        body: JSON.stringify(updateData)
      });

      if (response.ok) {
        alert('Профиль успешно обновлен');
        navigate('/');
      } else {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Ошибка сохранения');
      }
      
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteProfile = async () => {
    if (!window.confirm('Вы уверены, что хотите удалить профиль? Это действие нельзя отменить.')) {
      return;
    }

    setDeleting(true);
    setError('');

    try {
      const response = await apiService.request('/profile', {
        method: 'DELETE'
      });

      if (response.ok) {
        await apiService.logout();
        alert('Профиль успешно удален');
        navigate('/auth');
      } else {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Ошибка удаления профиля');
      }
      
    } catch (err: any) {
      setError(err.message);
    } finally {
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
  };

  const getPasswordValidationMessage = (password: string): string | null => {
    if (!password) return null;
    
    if (password.length < 6 || password.length > 14) {
      return "Пароль должен быть от 6 до 14 символов";
    }
    if (!/(?=.*[A-Z])/.test(password)) {
      return "Должна быть хотя бы одна заглавная буква";
    }
    if (!/(?=.*\d)/.test(password)) {
      return "Должна быть хотя бы одна цифра";
    }
    if (!/^[A-Za-z\d]+$/.test(password)) {
      return "Только латинские буквы и цифры";
    }
    return null;
  };

  if (loading) {
    return (
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
        <div style={{ color: 'var(--muted)' }}>Загрузка профиля...</div>
      </div>
    );
  }

  const passwordValidation = formData.password ? getPasswordValidationMessage(formData.password) : null;
  const passwordsMatch = !formData.password || formData.password === formData.confirmPassword;

  return (
    <div className="container">
      <div style={{ maxWidth: '480px', margin: '0 auto', padding: '20px' }}>
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '12px',
          marginBottom: '30px'
        }}>
          <button 
            className="btn"
            onClick={() => navigate(-1)}
            style={{ padding: '8px 12px' }}
          >
            ← Назад
          </button>
          <h1 className="h1" style={{ margin: 0 }}>Редактировать профиль</h1>
        </div>

        {error && (
          <div style={{
            background: '#fef2f2',
            border: '1px solid #fecaca',
            color: '#dc2626',
            padding: '12px 16px',
            borderRadius: '8px',
            marginBottom: '20px'
          }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="auth-card">
            <div style={{ marginBottom: '16px' }}>
              <label style={{
                display: 'block',
                marginBottom: '6px',
                fontWeight: '500',
                color: 'var(--text)'
              }}>
                Имя
              </label>
              <input
                type="text"
                name="first_name"
                value={formData.first_name}
                onChange={handleChange}
                required
                className="input"
                style={{ width: '100%' }}
              />
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{
                display: 'block',
                marginBottom: '6px',
                fontWeight: '500',
                color: 'var(--text)'
              }}>
                Фамилия
              </label>
              <input
                type="text"
                name="last_name"
                value={formData.last_name}
                onChange={handleChange}
                required
                className="input"
                style={{ width: '100%' }}
              />
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{
                display: 'block',
                marginBottom: '6px',
                fontWeight: '500',
                color: 'var(--text)'
              }}>
                Email
              </label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                required
                className="input"
                style={{ width: '100%' }}
              />
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{
                display: 'block',
                marginBottom: '6px',
                fontWeight: '500',
                color: 'var(--text)'
              }}>
                Новый пароль (оставьте пустым, если не хотите менять)
              </label>
              <input
                type="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                className="input"
                style={{ 
                  width: '100%',
                  borderColor: formData.password && passwordValidation ? '#dc2626' : undefined
                }}
                placeholder="Минимум 6 символов, заглавная буква и цифра"
              />
              {passwordValidation && (
                <div style={{ 
                  color: '#dc2626', 
                  fontSize: '12px', 
                  marginTop: '4px' 
                }}>
                  {passwordValidation}
                </div>
              )}
            </div>

            {formData.password && (
              <div style={{ marginBottom: '24px' }}>
                <label style={{
                  display: 'block',
                  marginBottom: '6px',
                  fontWeight: '500',
                  color: 'var(--text)'
                }}>
                  Подтвердите новый пароль
                </label>
                <input
                  type="password"
                  name="confirmPassword"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  className="input"
                  style={{ 
                    width: '100%',
                    borderColor: formData.confirmPassword && !passwordsMatch ? '#dc2626' : undefined
                  }}
                />
                {formData.confirmPassword && !passwordsMatch && (
                  <div style={{ 
                    color: '#dc2626', 
                    fontSize: '12px', 
                    marginTop: '4px' 
                  }}>
                    Пароли не совпадают
                  </div>
                )}
              </div>
            )}

            <button
              type="submit"
              disabled={saving || Boolean(formData.password && (passwordValidation || !passwordsMatch))}
              className="btn btn-primary"
              style={{ 
                width: '100%', 
                marginBottom: '12px',
                opacity: (formData.password && (!!passwordValidation || !passwordsMatch)) ? 0.6 : 1
              }}
            >
              {saving ? 'Сохранение...' : 'Сохранить изменения'}
            </button>

            <button
              type="button"
              onClick={() => navigate('/')}
              className="btn"
              style={{ width: '100%', marginBottom: '24px' }}
            >
              Отмена
            </button>

            <div style={{ 
              borderTop: '1px solid #e5e7eb', 
              paddingTop: '24px',
              textAlign: 'center'
            }}>
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(true)}
                disabled={deleting}
                className="btn"
                style={{ 
                  color: '#dc2626',
                  borderColor: '#dc2626',
                  background: 'transparent'
                }}
              >
                {deleting ? 'Удаление...' : 'Удалить профиль'}
              </button>
            </div>
          </div>
        </form>

        {showDeleteConfirm && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000
          }}>
            <div style={{
              background: 'white',
              padding: '24px',
              borderRadius: '12px',
              maxWidth: '400px',
              width: '90%'
            }}>
              <h3 style={{ marginBottom: '16px', color: '#dc2626' }}>
                Удаление профиля
              </h3>
              <p style={{ marginBottom: '20px', lineHeight: '1.5' }}>
                Вы уверены, что хотите удалить свой профиль? Это действие нельзя отменить. 
                Все ваши данные будут безвозвратно удалены.
              </p>
              <div style={{ 
                display: 'flex', 
                gap: '12px',
                justifyContent: 'flex-end'
              }}>
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="btn"
                  disabled={deleting}
                >
                  Отмена
                </button>
                <button
                  onClick={handleDeleteProfile}
                  disabled={deleting}
                  className="btn"
                  style={{ 
                    background: '#dc2626',
                    color: 'white',
                    borderColor: '#dc2626'
                  }}
                >
                  {deleting ? 'Удаление...' : 'Удалить'}
                </button>
              </div>
            </div>
          </div>
        )}
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

export default EditProfile;