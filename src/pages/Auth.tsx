import { useNavigate } from 'react-router-dom'
import React, { useState } from 'react'

interface AuthProps {
  setIsLoggedIn: React.Dispatch<React.SetStateAction<boolean>>
}

interface User {
  id: number
  first_name: string
  last_name: string
  email: string
}

interface AuthResponse {
  access_token: string
  token_type: string
  user: User
}

export default function Auth({ setIsLoggedIn }: AuthProps) {
  const [tab, setTab] = useState<'login' | 'register'>('login')
  const [login, setLogin] = useState({ email: '', password: '' })
  const [reg, setReg] = useState({ first: '', last: '', email: '', password: '' })
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  function validatePassword(password: string): string | null {
    if (password.length < 6 || password.length > 14) {
      return "Пароль должен быть от 6 до 14 символов"
    }
    if (!/(?=.*[A-Z])/.test(password)) {
      return "Пароль должен содержать хотя бы одну заглавную букву"
    }
    if (!/(?=.*\d)/.test(password)) {
      return "Пароль должен содержать хотя бы одну цифру"
    }
    if (!/^[A-Za-z\d]+$/.test(password)) {
      return "Пароль должен содержать только латинские буквы и цифры"
    }
    return null
  }

  function validateEmail(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  }

  async function handleLogin() {
    try {
      setError(null)
      setLoading(true)

      if (!login.email || !login.password) {
        setError('Заполните все поля')
        return
      }

      if (!validateEmail(login.email)) {
        setError('Введите корректный email')
        return
      }

      const res = await fetch('http://127.0.0.1:8000/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: login.email,
          password: login.password,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data?.detail || 'Неверная почта или пароль')
      }

      localStorage.setItem('token', data.access_token)
      if (data.user) {
        localStorage.setItem('user', JSON.stringify(data.user))
      }
      
      setIsLoggedIn(true)
      navigate('/upload')

    } catch (err: any) {
      setError(err.message || 'Ошибка входа')
    } finally {
      setLoading(false)
    }
  }

  async function handleRegister() {
    try {
      setError(null)
      setLoading(true)

      if (!reg.first || !reg.last || !reg.email || !reg.password) {
        setError('Заполните все поля')
        return
      }

      if (!validateEmail(reg.email)) {
        setError('Введите корректный email')
        return
      }

      const passwordError = validatePassword(reg.password)
      if (passwordError) {
        setError(passwordError)
        return
      }

      const res = await fetch('http://127.0.0.1:8000/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          first_name: reg.first,
          last_name: reg.last,
          email: reg.email,
          password: reg.password,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data?.detail || 'Ошибка регистрации')
      }

      localStorage.setItem('token', data.access_token)
      if (data.user) {
        localStorage.setItem('user', JSON.stringify(data.user))
      }
      
      setIsLoggedIn(true)
      navigate('/upload')

    } catch (err: any) {
      setError(err.message || 'Ошибка регистрации')
    } finally {
      setLoading(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent, type: 'login' | 'register') => {
    if (e.key === 'Enter') {
      if (type === 'login') handleLogin()
      else handleRegister()
    }
  }

  return (
    <div className="auth-card">
      <div className="tabs">
        <div
          className={`tab ${tab === 'login' ? 'active' : ''}`}
          onClick={() => {
            setTab('login')
            setError(null)
          }}
        >
          Вход
        </div>
        <div
          className={`tab ${tab === 'register' ? 'active' : ''}`}
          onClick={() => {
            setTab('register')
            setError(null)
          }}
        >
          Регистрация
        </div>
      </div>

      {error && (
        <div style={{ 
          color: 'red', 
          marginBottom: 16, 
          padding: '8px 12px', 
          backgroundColor: '#fff5f5',
          border: '1px solid #fed7d7',
          borderRadius: 8,
          fontSize: 14
        }}>
          {error}
        </div>
      )}

      {tab === 'login' && (
        <div>
          <input
            className="input"
            placeholder="Почта"
            value={login.email}
            onChange={(e) => setLogin({ ...login, email: e.target.value })}
            onKeyPress={(e) => handleKeyPress(e, 'login')}
            style={{ width: '100%', padding: 12, marginBottom: 12 }}
            disabled={loading}
          />
          <input
            className="input"
            placeholder="Пароль"
            type="password"
            value={login.password}
            onChange={(e) => setLogin({ ...login, password: e.target.value })}
            onKeyPress={(e) => handleKeyPress(e, 'login')}
            style={{ width: '100%', padding: 12, marginBottom: 16 }}
            disabled={loading}
          />
          <button 
            className="btn btn-primary btn-large" 
            onClick={handleLogin}
            disabled={loading}
            style={{ 
              width: '100%',
              opacity: loading ? 0.6 : 1,
              cursor: loading ? 'not-allowed' : 'pointer'
            }}
          >
            {loading ? 'Вход...' : 'Войти'}
          </button>
        </div>
      )}

      {tab === 'register' && (
        <div>
          <input
            className="input"
            placeholder="Имя"
            value={reg.first}
            onChange={(e) => setReg({ ...reg, first: e.target.value })}
            onKeyPress={(e) => handleKeyPress(e, 'register')}
            style={{ width: '100%', padding: 12, marginBottom: 12 }}
            disabled={loading}
          />
          <input
            className="input"
            placeholder="Фамилия"
            value={reg.last}
            onChange={(e) => setReg({ ...reg, last: e.target.value })}
            onKeyPress={(e) => handleKeyPress(e, 'register')}
            style={{ width: '100%', padding: 12, marginBottom: 12 }}
            disabled={loading}
          />
          <input
            className="input"
            placeholder="Почта"
            value={reg.email}
            onChange={(e) => setReg({ ...reg, email: e.target.value })}
            onKeyPress={(e) => handleKeyPress(e, 'register')}
            style={{ width: '100%', padding: 12, marginBottom: 12 }}
            disabled={loading}
          />
          <input
            className="input"
            placeholder="Пароль"
            type="password"
            value={reg.password}
            onChange={(e) => setReg({ ...reg, password: e.target.value })}
            onKeyPress={(e) => handleKeyPress(e, 'register')}
            style={{ width: '100%', padding: 12, marginBottom: 8 }}
            disabled={loading}
          />
          <div style={{ 
            fontSize: '12px', 
            color: 'var(--muted)', 
            marginBottom: 16,
            lineHeight: '1.4',
            textAlign: 'left'
          }}>
            • 6-14 символов<br/>
            • Латинские буквы и цифры<br/>
            • Минимум одна заглавная буква<br/>
            • Минимум одна цифра
          </div>
          <button 
            className="btn btn-primary btn-large" 
            onClick={handleRegister}
            disabled={loading}
            style={{ 
              width: '100%',
              opacity: loading ? 0.6 : 1,
              cursor: loading ? 'not-allowed' : 'pointer'
            }}
          >
            {loading ? 'Регистрация...' : 'Зарегистрироваться'}
          </button>
        </div>
      )}

      <div style={{ 
        marginTop: 20, 
        paddingTop: 20, 
        borderTop: '1px solid var(--control-border)',
        textAlign: 'center',
        fontSize: 14,
        color: 'var(--muted)'
      }}>
        {tab === 'login' ? 'Нет аккаунта? ' : 'Уже есть аккаунт? '}
        <span 
          style={{ 
            color: 'var(--accent)', 
            cursor: 'pointer',
            fontWeight: 500
          }}
          onClick={() => {
            setTab(tab === 'login' ? 'register' : 'login')
            setError(null)
          }}
        >
          {tab === 'login' ? 'Зарегистрируйтесь' : 'Войдите'}
        </span>
      </div>
    </div>
  )
}






