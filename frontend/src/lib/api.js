const BASE = import.meta.env.VITE_API_URL || '';

function getToken() {
  return localStorage.getItem('wf_token');
}

async function request(method, path, body) {
  const token = getToken();
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${BASE}/api${path}`, {
    method,
    headers,
    body: body != null ? JSON.stringify(body) : undefined,
  });

  if (res.status === 401) {
    localStorage.removeItem('wf_token');
    window.location.href = '/login';
    throw new Error('Unauthorized');
  }

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

export const api = {
  get:    (path)        => request('GET',    path),
  post:   (path, body)  => request('POST',   path, body),
  put:    (path, body)  => request('PUT',    path, body),
  patch:  (path, body)  => request('PATCH',  path, body),
  delete: (path)        => request('DELETE', path),
};

// Auth endpoints
export const authApi = {
  setup:          (body) => request('POST', '/auth/setup', body),
  login:          (body) => request('POST', '/auth/login', body),
  changePassword: (body) => api.post('/auth/change-password', body),
  isSetup: async () => {
    try {
      const res = await fetch(`${BASE}/api/auth/setup`);
      return res.status !== 404;
    } catch {
      return false;
    }
  },
};

// Profile
export const profileApi = {
  get:    ()     => api.get('/profile'),
  update: (body) => api.put('/profile', body),
};

// Snapshots (net worth history)
export const snapshotsApi = {
  list:   ()     => api.get('/snapshots'),
  create: (body) => api.post('/snapshots', body),
  delete: (id)   => api.delete(`/snapshots/${id}`),
};

// Investments / holdings
export const investmentsApi = {
  list:   ()     => api.get('/investments'),
  create: (body) => api.post('/investments', body),
  update: (id, body) => api.put(`/investments/${id}`, body),
  delete: (id)   => api.delete(`/investments/${id}`),
};

// Transactions (buy/sell/dividend)
export const transactionsApi = {
  list:   (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return api.get(`/transactions${qs ? '?' + qs : ''}`);
  },
  create: (body) => api.post('/transactions', body),
  update: (id, body) => api.put(`/transactions/${id}`, body),
  delete: (id)   => api.delete(`/transactions/${id}`),
};

// CPF
export const cpfApi = {
  get:    ()     => api.get('/cpf'),
  update: (body) => api.put('/cpf', body),
};

// SRS
export const srsApi = {
  get:    ()     => api.get('/srs'),
  update: (body) => api.put('/srs', body),
};

// Dividends
export const dividendsApi = {
  list:   ()     => api.get('/dividends'),
  create: (body) => api.post('/dividends', body),
  update: (id, body) => api.put(`/dividends/${id}`, body),
  delete: (id)   => api.delete(`/dividends/${id}`),
};

// Loans / mortgages
export const loansApi = {
  list:   ()     => api.get('/loans'),
  create: (body) => api.post('/loans', body),
  update: (id, body) => api.put(`/loans/${id}`, body),
  delete: (id)   => api.delete(`/loans/${id}`),
};

// Plan / goals
export const planApi = {
  get:    ()     => api.get('/plan'),
  update: (body) => api.put('/plan', body),
};
