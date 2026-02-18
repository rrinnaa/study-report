import React, { useState, useEffect } from 'react';
import { apiService } from '../services/api';

interface User {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  role: string;
}

const AdminPanel: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedRole, setSelectedRole] = useState<{ [key: number]: string }>({});

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      setError('');
      const data = await apiService.getAllUsers(0, 100);
      setUsers(data);
      // Инициализируем выбранные роли текущими ролями
      const roleMap: { [key: number]: string } = {};
      data.forEach((user: User) => {
        roleMap[user.id] = user.role;
      });
      setSelectedRole(roleMap);
    } catch (err) {
      setError(`Ошибка загрузки пользователей: ${err}`);
    } finally {
      setLoading(false);
    }
  };

  const handleRoleChange = async (userId: number, newRole: string) => {
    try {
      setError('');
      await apiService.updateUserRole(userId, newRole);
      // Обновляем роль в локальном состоянии
      setSelectedRole({ ...selectedRole, [userId]: newRole });
      setUsers(
        users.map((user) =>
          user.id === userId ? { ...user, role: newRole } : user
        )
      );
    } catch (err) {
      setError(`Ошибка изменения роли: ${err}`);
    }
  };

  const handleDeleteUser = async (userId: number) => {
    if (!confirm('Вы уверены, что хотите удалить этого пользователя?')) {
      return;
    }

    try {
      setError('');
      await apiService.deleteUser(userId);
      setUsers(users.filter((user) => user.id !== userId));
    } catch (err) {
      setError(`Ошибка удаления пользователя: ${err}`);
    }
  };

  return (
    <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
      <h1 style={{ marginBottom: '24px', fontSize: '28px', fontWeight: 700 }}>
        Администраторская панель
      </h1>

      {error && (
        <div
          style={{
            padding: '12px 16px',
            backgroundColor: '#fee2e2',
            color: '#991b1b',
            borderRadius: '8px',
            marginBottom: '16px',
          }}
        >
          {error}
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px' }}>
          <p>Загрузка пользователей...</p>
        </div>
      ) : (
        <div
          style={{
            overflowX: 'auto',
            borderRadius: '8px',
            border: '1px solid #e5e7eb',
          }}
        >
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              backgroundColor: '#ffffff',
            }}
          >
            <thead>
              <tr style={{ backgroundColor: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                <th style={tableCellStyle}>ID</th>
                <th style={tableCellStyle}>Имя</th>
                <th style={tableCellStyle}>Email</th>
                <th style={tableCellStyle}>Текущая роль</th>
                <th style={tableCellStyle}>Изменить роль</th>
                <th style={tableCellStyle}>Действия</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user, index) => (
                <tr
                  key={user.id}
                  style={{
                    borderBottom: '1px solid #e5e7eb',
                    backgroundColor: index % 2 === 0 ? '#ffffff' : '#f9fafb',
                  }}
                >
                  <td style={tableCellStyle}>{user.id}</td>
                  <td style={tableCellStyle}>
                    {user.first_name} {user.last_name}
                  </td>
                  <td style={tableCellStyle}>{user.email}</td>
                  <td style={tableCellStyle}>
                    <span
                      style={{
                        display: 'inline-block',
                        padding: '4px 8px',
                        borderRadius: '4px',
                        fontSize: '12px',
                        fontWeight: 600,
                        backgroundColor:
                          user.role === 'admin' ? '#dbeafe' : '#dcfce7',
                        color: user.role === 'admin' ? '#1e40af' : '#166534',
                      }}
                    >
                      {user.role}
                    </span>
                  </td>
                  <td style={tableCellStyle}>
                    <select
                      value={selectedRole[user.id] || user.role}
                      onChange={(e) => handleRoleChange(user.id, e.target.value)}
                      style={{
                        padding: '6px 10px',
                        borderRadius: '4px',
                        border: '1px solid #d1d5db',
                        fontSize: '14px',
                        cursor: 'pointer',
                      }}
                    >
                      <option value="user">User</option>
                      <option value="admin">Admin</option>
                    </select>
                  </td>
                  <td style={tableCellStyle}>
                    <button
                      onClick={() => handleDeleteUser(user.id)}
                      style={{
                        padding: '6px 12px',
                        backgroundColor: '#fee2e2',
                        color: '#991b1b',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '14px',
                        fontWeight: 500,
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = '#fecaca';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = '#fee2e2';
                      }}
                    >
                      Удалить
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!loading && users.length === 0 && (
        <div
          style={{
            textAlign: 'center',
            padding: '40px',
            color: '#6b7280',
          }}
        >
          <p>Нет пользователей</p>
        </div>
      )}

      <div style={{ marginTop: '24px', padding: '16px', backgroundColor: '#f3f4f6', borderRadius: '8px' }}>
        <h2 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '12px' }}>
          Информация
        </h2>
        <p style={{ fontSize: '14px', color: '#6b7280', margin: '8px 0' }}>
          • Всего пользователей: <strong>{users.length}</strong>
        </p>
        <p style={{ fontSize: '14px', color: '#6b7280', margin: '8px 0' }}>
          • Администраторов: <strong>{users.filter((u) => u.role === 'admin').length}</strong>
        </p>
        <p style={{ fontSize: '14px', color: '#6b7280', margin: '8px 0' }}>
          • Обычных пользователей: <strong>{users.filter((u) => u.role === 'user').length}</strong>
        </p>
      </div>
    </div>
  );
};

const tableCellStyle: React.CSSProperties = {
  padding: '12px 16px',
  textAlign: 'left',
  fontSize: '14px',
};

export default AdminPanel;
