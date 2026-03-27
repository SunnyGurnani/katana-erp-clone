import { api } from './api';

export interface TokenResponse {
  accessToken: string;
  refreshToken: string;
  tenants?: TenantInfo[];
  currentTenantId?: string | null;
}

export interface User {
  id: string;
  email: string;
  fullName: string;
  isActive: boolean;
  isSuperuser: boolean;
  tenants?: TenantInfo[];
}

export interface TenantInfo {
  id: string;
  name: string;
  slug: string;
  logoUrl?: string | null;
  role: string;
  isDefault: boolean;
}

export async function login(email: string, password: string): Promise<TokenResponse> {
  const { data } = await api.post<TokenResponse & { user: User }>('/auth/login', { email, password });
  if (typeof window !== 'undefined') {
    localStorage.setItem('access_token', data.accessToken);
    localStorage.setItem('refresh_token', data.refreshToken);
    if (data.currentTenantId) {
      localStorage.setItem('tenant_id', data.currentTenantId);
    }
    if (data.tenants?.length) {
      localStorage.setItem('tenants', JSON.stringify(data.tenants));
    }
  }
  return data;
}

export function logout() {
  if (typeof window !== 'undefined') localStorage.clear();
  window.location.href = '/login';
}

export function getCurrentTenantId(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('tenant_id');
}

export function setCurrentTenantId(tenantId: string) {
  if (typeof window !== 'undefined') {
    localStorage.setItem('tenant_id', tenantId);
  }
}

export function getTenants(): TenantInfo[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem('tenants');
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export async function switchTenant(tenantId: string): Promise<void> {
  await api.post(`/auth/tenants/${tenantId}/switch`);
  setCurrentTenantId(tenantId);
  // Reload to refresh all data for the new tenant
  window.location.reload();
}

export async function getMe(): Promise<User> {
  const { data } = await api.get<User & { tenants?: TenantInfo[] }>('/auth/me');
  if (data.tenants?.length && typeof window !== 'undefined') {
    localStorage.setItem('tenants', JSON.stringify(data.tenants));
  }
  return data;
}

export async function createTenant(name: string): Promise<TenantInfo> {
  const { data } = await api.post<TenantInfo>('/auth/tenants', { name });
  // Update local tenant list
  const tenants = getTenants();
  tenants.push({ ...data, role: 'owner', isDefault: false });
  localStorage.setItem('tenants', JSON.stringify(tenants));
  return data;
}
