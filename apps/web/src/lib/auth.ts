import { api } from './api';
export interface TokenResponse { accessToken: string; refreshToken: string; }
export interface User { id: string; email: string; fullName: string; isActive: boolean; isSuperuser: boolean; }
export async function login(email: string, password: string): Promise<TokenResponse> {
  const { data } = await api.post<TokenResponse>('/auth/login', { email, password });
  if (typeof window !== 'undefined') { localStorage.setItem('access_token', data.accessToken); localStorage.setItem('refresh_token', data.refreshToken); }
  return data;
}
export function logout() { if (typeof window !== 'undefined') localStorage.clear(); window.location.href = '/login'; }
export async function getMe(): Promise<User> { const { data } = await api.get<User>('/auth/me'); return data; }
