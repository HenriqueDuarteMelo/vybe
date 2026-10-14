import { api } from "./api";
import type { AuthResponse, User } from "@vybe/shared";

export async function login(email: string, password: string): Promise<AuthResponse> {
  return api.post<AuthResponse>("/auth/login", { email, password });
}

export async function register(
  email: string,
  username: string,
  password: string
): Promise<AuthResponse> {
  return api.post<AuthResponse>("/auth/register", { email, username, password });
}

export async function getProfile(): Promise<User> {
  return api.get<User>("/auth/me");
}
