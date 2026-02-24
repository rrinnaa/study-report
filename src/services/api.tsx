class ApiService {
  private baseURL = 'http://127.0.0.1:8000/api';
  private accessToken: string | null = null;
  private refreshToken: string | null = null;
  private isRefreshing = false;
  private refreshSubscribers: ((token: string) => void)[] = [];

  constructor() {
    this.loadTokens();
  }

  private loadTokens() {
    this.accessToken = localStorage.getItem('access_token');
    this.refreshToken = localStorage.getItem('refresh_token');
  }

  private saveTokens(access: string, refresh: string) {
    this.accessToken = access;
    this.refreshToken = refresh;
    localStorage.setItem('access_token', access);
    localStorage.setItem('refresh_token', refresh);
  }

  private clearTokens() {
    this.accessToken = null;
    this.refreshToken = null;
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user');
  }

  private saveUser(user: any) {
    localStorage.setItem('user', JSON.stringify(user));
  }

  async request(url: string, options: RequestInit = {}) {
    const isPublicRequest = ['/login', '/register', '/refresh'].includes(url);
    
    if (!this.accessToken && localStorage.getItem('access_token')) {
      this.loadTokens();
    }
    
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (!isPublicRequest && this.accessToken) {
      headers['Authorization'] = `Bearer ${this.accessToken}`;
    }

    let response = await fetch(`${this.baseURL}${url}`, { ...options, headers });

    if (response.status === 401 && !isPublicRequest) {
      if (this.isRefreshing) {
        return new Promise<Response>((resolve, reject) => {
          this.refreshSubscribers.push((newToken: string) => {
            headers['Authorization'] = `Bearer ${newToken}`;
            fetch(`${this.baseURL}${url}`, { ...options, headers })
              .then(resolve)
              .catch(reject);
          });
        });
      }

      this.isRefreshing = true;

      try {
        const refreshed = await this.refreshTokens();
        if (refreshed) {
          this.refreshSubscribers.forEach(callback => callback(this.accessToken!));
          this.refreshSubscribers = [];
          
          headers['Authorization'] = `Bearer ${this.accessToken}`;
          response = await fetch(`${this.baseURL}${url}`, { ...options, headers });
        } else {
          this.clearTokens();
          window.dispatchEvent(new Event('logout'));
          throw new Error('Требуется повторный вход');
        }
      } finally {
        this.isRefreshing = false;
      }
    }

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Ошибка сервера' }));
      throw new Error(error.detail || `Ошибка: ${response.status}`);
    }

    return response;
  }

  private async refreshTokens(): Promise<boolean> {
    if (!this.refreshToken) return false;

    try {
      const response = await fetch(`${this.baseURL}/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: this.refreshToken }),
      });

      if (response.ok) {
        const data = await response.json();
        this.saveTokens(data.access_token, data.refresh_token);
        this.saveUser(data.user);
        return true;
      } else {
        this.clearTokens();
        return false;
      }
    } catch {
      this.clearTokens();
      return false;
    }
  }

  async login(email: string, password: string) {
    const response = await this.request('/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    const data = await response.json();
    this.saveTokens(data.access_token, data.refresh_token);
    this.saveUser(data.user);
    return data.user;
  }

  async register(userData: {
    first_name: string;
    last_name: string;
    email: string;
    password: string;
  }) {
    const response = await this.request('/register', {
      method: 'POST',
      body: JSON.stringify(userData),
    });
    const data = await response.json();
    this.saveTokens(data.access_token, data.refresh_token);
    this.saveUser(data.user);
    return data.user;
  }

  async logout() {
    try {
      await this.request('/logout', { method: 'POST' });
    } catch {
    } finally {
      this.clearTokens();
    }
  }

  async getProfile() {
    const response = await this.request('/profile');
    const user = await response.json();
    this.saveUser(user);
    return user;
  }

  async updateProfile(profileData: {
    first_name?: string;
    last_name?: string;
    email?: string;
    password?: string;
  }) {
    const response = await this.request('/profile', {
      method: 'PUT',
      body: JSON.stringify(profileData),
    });
    const user = await response.json();
    this.saveUser(user);
    return user;
  }

  async deleteProfile() {
    const response: Response = await this.request('/profile', {
      method: 'DELETE',
    });

    this.clearTokens();
    return response.json();
  }

  isAuthenticated(): boolean {
    return !!this.accessToken;
  }

  getCurrentUser() {
    const user = localStorage.getItem('user');
    return user ? JSON.parse(user) : null;
  }
  
  async getAllUsers(skip: number = 0, limit: number = 100) {
    const response = await this.request(`/users?skip=${skip}&limit=${limit}`);
    return response.json();
  }

  async updateUserRole(userId: number, role: string) {
    const response = await this.request(`/users/${userId}/role`, {
      method: 'PUT',
      body: JSON.stringify({ role }),
    });
    return response.json();
  }

  async deleteUser(userId: number) {
    const response = await this.request(`/users/${userId}`, {
      method: 'DELETE',
    });
    return response.json();
  }

  async getMyUploads(params: {
    page?: number;
    limit?: number;
    search?: string;
    min_score?: number;
    max_score?: number;
    sort_by?: string;
    sort_order?: string;
  } = {}) {
    const queryParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        queryParams.append(key, String(value));
      }
    });
    
    const response = await this.request(`/my-uploads?${queryParams.toString()}`);
    return response.json();
  }

  async getDownloadUrl(uploadId: number): Promise<{ download_url: string; filename: string }> {
    const response = await this.request(`/upload/${uploadId}/download-url`);
    return response.json();
  }

  async getAllAnalyses(params: {
    page?: number;
    limit?: number;
    search?: string;
    min_score?: number;
    max_score?: number;
    user_id?: number;
    sort_by?: string;
    sort_order?: string;
  } = {}) {
    const queryParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        queryParams.append(key, String(value));
      }
    });
    
    const response = await this.request(`/all-analyses?${queryParams.toString()}`);
    return response.json();
  }
}

export const apiService = new ApiService();