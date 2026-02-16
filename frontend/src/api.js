/**
 * API Client for Brimfrost Frontend
 * Handles authentication, token management, and API calls
 */

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
const TOKEN_KEY = 'brimfrost_token';

class APIClient {
  constructor() {
    this.token = localStorage.getItem(TOKEN_KEY);
  }

  /**
   * Set authentication token
   */
  setToken(token) {
    this.token = token;
    if (token) {
      localStorage.setItem(TOKEN_KEY, token);
    } else {
      localStorage.removeItem(TOKEN_KEY);
    }
  }

  /**
   * Get authentication token
   */
  getToken() {
    return this.token;
  }

  /**
   * Check if user is authenticated
   */
  isAuthenticated() {
    return !!this.token;
  }

  /**
   * Clear authentication
   */
  logout() {
    this.setToken(null);
  }

  /**
   * Make HTTP request with authentication
   */
  async request(method, endpoint, data = null) {
    const url = `${API_URL}${endpoint}`;
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json',
      },
    };

    if (this.token) {
      options.headers['Authorization'] = `Bearer ${this.token}`;
    }

    if (data) {
      options.body = JSON.stringify(data);
    }

    try {
      const response = await fetch(url, options);
      const json = await response.json();

      if (!response.ok) {
        throw new Error(json.message || 'API Error');
      }

      return json;
    } catch (error) {
      console.error('API Error:', error);
      throw error;
    }
  }

  /**
   * Login with email and password
   */
  async login(email, password) {
    const response = await this.request('POST', '/auth/login', {
      email,
      password,
    });
    this.setToken(response.data.token);
    return response.data;
  }

  /**
   * Register new account
   */
  async register(email, password, name) {
    const response = await this.request('POST', '/auth/register', {
      email,
      password,
      name,
    });
    this.setToken(response.data.token);
    return response.data;
  }

  /**
   * Get all persons
   */
  async getPersons() {
    const response = await this.request('GET', '/persons');
    return response.data;
  }

  /**
   * Get single person with details
   */
  async getPerson(id) {
    const response = await this.request('GET', `/persons/${id}`);
    return response.data;
  }

  /**
   * Search persons
   */
  async search(query) {
    const params = new URLSearchParams({ q: query });
    const response = await this.request('GET', `/search?${params}`);
    return response.data;
  }

  /**
   * Get person's media
   */
  async getPersonMedia(id) {
    const response = await this.request('GET', `/persons/${id}/media`);
    return response.data;
  }

  /**
   * Create new person (admin)
   */
  async createPerson(data) {
    const response = await this.request('POST', '/admin/persons', data);
    return response.data;
  }

  /**
   * Update person (admin)
   */
  async updatePerson(id, data) {
    const response = await this.request('PATCH', `/admin/persons/${id}`, data);
    return response.data;
  }

  /**
   * Delete person (admin)
   */
  async deletePerson(id) {
    const response = await this.request('DELETE', `/admin/persons/${id}`);
    return response.data;
  }
}

export default new APIClient();
