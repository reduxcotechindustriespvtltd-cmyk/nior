import axios from 'axios'

export const api = axios.create({ baseURL: '/api/proxy' })

api.interceptors.request.use(config => {
  const token = getToken()
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  r => r,
  err => {
    if (err.response?.status === 401) {
      clearToken()
      window.location.href = '/auth/login'
    }
    return Promise.reject(err)
  }
)

export function setToken(token: string) {
  localStorage.setItem('sp_tok', token)
}

export function getToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem('sp_tok')
}

export function clearToken() {
  localStorage.removeItem('sp_tok')
}

export function isAuthenticated(): boolean {
  return !!getToken()
}
