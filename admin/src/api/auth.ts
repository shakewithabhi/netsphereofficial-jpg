import client from './client';

export interface LoginPayload {
  email: string;
  password: string;
}

export interface AuthResponse {
  access_token: string;
  refresh_token: string;
  user: UserProfile;
}

export interface UserProfile {
  id: string;
  email: string;
  display_name: string;
  plan: string;
  storage_used: number;
  storage_limit: number;
  is_admin: boolean;
  created_at: string;
}

export const authApi = {
  login: (payload: LoginPayload) =>
    client.post<{ success: boolean; data: AuthResponse }>('/auth/login', payload),

  me: () =>
    client.get<{ success: boolean; data: UserProfile }>('/auth/me'),
};
