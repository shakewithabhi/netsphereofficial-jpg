import client from './client';

export interface User {
  id: string;
  email: string;
  display_name: string;
  storage_used: number;
  storage_limit: number;
  plan?: string;
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
