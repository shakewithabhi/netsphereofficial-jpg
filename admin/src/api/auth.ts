import client from './client';

export interface LoginPayload {
  email: string;
  password: string;
}

export interface RegisterPayload {
  email: string;
  password: string;
  display_name?: string;
}

export interface Verify2FAPayload {
  email: string;
  password: string;
  code: string;
}

export interface AuthResponse {
  access_token: string;
  refresh_token: string;
  user: UserProfile;
  requires_2fa?: boolean;
}

export interface UserProfile {
  id: string;
  email: string;
  display_name: string;
  plan: string;
  storage_used: number;
  storage_limit: number;
  is_admin: boolean;
  two_factor_enabled: boolean;
  created_at: string;
}

export const authApi = {
  login: (payload: LoginPayload) =>
    client.post<{ success: boolean; data: AuthResponse }>('/auth/login', payload),

  register: (payload: RegisterPayload) =>
    client.post<{ success: boolean; data: AuthResponse }>('/auth/register', payload),

  verify2FA: (payload: Verify2FAPayload) =>
    client.post<{ success: boolean; data: AuthResponse }>('/auth/verify-2fa', payload),

  me: () =>
    client.get<{ success: boolean; data: UserProfile }>('/auth/me'),
};
