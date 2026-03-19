import client from './client';

export interface User {
  id: string;
  email: string;
  display_name: string;
  storage_used: number;
  storage_limit: number;
  plan?: string;
  avatar_url?: string;
  created_at: string;
}

export interface AuthResponse {
  access_token: string;
  refresh_token: string;
  user: User;
}

export async function login(email: string, password: string): Promise<AuthResponse> {
  const res = await client.post('/auth/login', { email, password });
  return res.data.data;
}

export async function register(
  email: string,
  password: string,
  display_name: string
): Promise<AuthResponse> {
  const res = await client.post('/auth/register', { email, password, display_name });
  return res.data.data;
}

export async function getProfile(): Promise<User> {
  const res = await client.get('/auth/me');
  return res.data.data;
}

// Two-Factor Authentication

export interface TwoFactorSetupResponse {
  secret: string;
  qr_url: string;
}

export interface TwoFactorVerifyResponse {
  backup_codes: string[];
}

export interface LoginResponse {
  access_token?: string;
  refresh_token?: string;
  user?: User;
  requires_2fa?: boolean;
  temp_token?: string;
}

export async function enable2FA(): Promise<TwoFactorSetupResponse> {
  const res = await client.post('/auth/2fa/enable');
  return res.data.data;
}

export async function verify2FA(code: string): Promise<TwoFactorVerifyResponse> {
  const res = await client.post('/auth/2fa/verify', { code });
  return res.data.data;
}

export async function disable2FA(code: string): Promise<void> {
  await client.post('/auth/2fa/disable', { code });
}

export async function verify2FALogin(
  code: string,
  tempToken: string
): Promise<AuthResponse> {
  const res = await client.post('/auth/2fa/verify-login', {
    code,
    temp_token: tempToken,
  });
  return res.data.data;
}

// Profile avatar upload

export async function uploadAvatar(file: File): Promise<{ avatar_url: string }> {
  const formData = new FormData();
  formData.append('avatar', file);
  const res = await client.put('/auth/profile/avatar', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return res.data.data;
}

// Change password

export async function changePassword(
  currentPassword: string,
  newPassword: string
): Promise<void> {
  await client.post('/auth/change-password', {
    old_password: currentPassword,
    new_password: newPassword,
  });
}
